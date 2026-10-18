// @ts-nocheck
/**
 * CALDRA CAD — CAM TOOLPATH GENERATOR (FASE 07)
 *
 * Motor analítico de geração de trajetórias CNC:
 * - Sequenciamento inteligente (marcação → furos internos → contorno externo)
 * - Geração automática de Lead-in e Lead-out tangenciais/lineares
 * - Inserção de micro-juntas (Tabs) anti-tombamento de chapa
 * - Otimização de percursos rápidos em vazio (redução de tempo de máquina)
 */

import type { Entity } from "@/lib/lab2d/core";
import type {
  CuttingParameters,
  LeadParams,
  CutContour,
  ToolpathResult,
  ToolpathSegment,
  MicroJoint,
} from "./types";

const DEG = Math.PI / 180;

export class CAMEngine {
  /**
   * Converte geometrias 2D em trajetórias completas de corte CNC com entradas, saídas e micro-juntas.
   */
  static generateToolpath(
    entities: Entity[],
    params: CuttingParameters,
    options?: {
      leadParams?: LeadParams;
      microJointsCount?: number;
      microJointWidthMm?: number;
    },
  ): ToolpathResult {
    const lead = options?.leadParams ?? {
      type: "LINE",
      lengthMm: Math.max(2.0, params.thicknessMm * 0.8),
      angleDeg: 45,
    };
    const tabCount = options?.microJointsCount ?? 0;
    const tabWidth = options?.microJointWidthMm ?? 0.8;

    // Filtra apenas entidades destinadas ao corte (camada CORTE ou default)
    const cutEntities = entities.filter((e) => !e.layer || e.layer === "CORTE");

    // Identifica e agrupa contornos fechados (loops)
    const contours = this.extractContours(cutEntities, params, lead, tabCount, tabWidth);

    // Ordenação estrita: Furos internos primeiro (otimizados por proximidade), Contorno externo por último
    const sortedContours = this.sortContours(contours);

    // Cálculo das métricas de tempo e percurso
    let totalCutLengthMm = 0;
    let totalRapidLengthMm = 0;
    let lastPosition = { x: 0, y: 0 };

    for (const contour of sortedContours) {
      // Deslocamento rápido até o ponto de perfuração
      const distRapid = Math.hypot(
        contour.piercePoint.x - lastPosition.x,
        contour.piercePoint.y - lastPosition.y,
      );
      totalRapidLengthMm += distRapid;

      // Comprimento de corte
      const contourLength =
        contour.leadInSegments.reduce(
          (sum, s) => sum + Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y),
          0,
        ) +
        contour.cutSegments.reduce(
          (sum, s) => sum + Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y),
          0,
        ) +
        contour.leadOutSegments.reduce(
          (sum, s) => sum + Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y),
          0,
        );

      totalCutLengthMm += contourLength;

      const endSeg =
        contour.leadOutSegments[contour.leadOutSegments.length - 1] ??
        contour.cutSegments[contour.cutSegments.length - 1];
      if (endSeg) {
        lastPosition = endSeg.end;
      }
    }

    const pierceCount = sortedContours.length;
    const estimatedCutTimeSec = (totalCutLengthMm / params.feedrateMmMin) * 60;
    const estimatedRapidTimeSec = (totalRapidLengthMm / params.rapidSpeedMmMin) * 60;
    const estimatedPierceTimeSec = pierceCount * params.pierceTimeSec;
    const totalCycleTimeSec = estimatedCutTimeSec + estimatedRapidTimeSec + estimatedPierceTimeSec;

    return {
      contours: sortedContours,
      totalCutLengthMm: Number(totalCutLengthMm.toFixed(2)),
      totalRapidLengthMm: Number(totalRapidLengthMm.toFixed(2)),
      pierceCount,
      estimatedCutTimeSec: Number(estimatedCutTimeSec.toFixed(2)),
      estimatedRapidTimeSec: Number(estimatedRapidTimeSec.toFixed(2)),
      estimatedPierceTimeSec: Number(estimatedPierceTimeSec.toFixed(2)),
      totalCycleTimeSec: Number(totalCycleTimeSec.toFixed(2)),
    };
  }

  /**
   * Extrai e organiza os contornos geométricos a partir das entidades 2D.
   */
  private static extractContours(
    entities: Entity[],
    params: CuttingParameters,
    lead: LeadParams,
    tabCount: number,
    tabWidth: number,
  ): CutContour[] {
    const contours: CutContour[] = [];

    // 1. Processa círculos individuais (típicos furos internos)
    const circles = entities.filter((e) => e.type === "circle");
    circles.forEach((c, idx) => {
      if (c.type !== "circle") return;
      const radius = c.r;
      const center = { x: c.cx, y: c.cy };
      const circumference = 2 * Math.PI * radius;

      // Ponto de início de corte na borda
      const startCutPoint = { x: center.x + radius, y: center.y };
      // Ponto de perfuração no interior do furo (para evitar cratera na borda útil)
      const leadLen = Math.min(radius * 0.7, lead.lengthMm);
      const piercePoint = { x: center.x + radius - leadLen, y: center.y };

      const leadInSegments: ToolpathSegment[] = [
        {
          type: "LEAD_IN",
          start: piercePoint,
          end: startCutPoint,
          feedrate: params.feedrateMmMin * 0.7,
          beamOn: true,
        },
      ];

      // Segmento de corte circular
      const cutSegments: ToolpathSegment[] = [
        {
          type: "CUT_CIRCULAR",
          start: startCutPoint,
          end: startCutPoint,
          center,
          isClockwise: false, // Sentido anti-horário convencional para furos internos
          feedrate: params.feedrateMmMin,
          beamOn: true,
        },
      ];

      contours.push({
        id: `contour_hole_${c.id ?? idx}`,
        isOuter: false,
        piercePoint,
        leadInSegments,
        cutSegments,
        leadOutSegments: [],
        lengthMm: circumference,
        microJoints: [],
      });
    });

    // 2. Processa segmentos lineares conectados (contornos poligonais)
    const lines = entities.filter((e) => e.type === "line");
    if (lines.length > 0) {
      // Monta percurso contínuo simples
      const cutSegments: ToolpathSegment[] = [];
      let totalLen = 0;

      lines.forEach((l) => {
        if (l.type !== "line") return;
        const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
        totalLen += len;
        cutSegments.push({
          type: "CUT_LINEAR",
          start: { x: l.x1, y: l.y1 },
          end: { x: l.x2, y: l.y2 },
          feedrate: params.feedrateMmMin,
          beamOn: true,
        });
      });

      const firstPt = cutSegments[0].start;
      // Lead-in no contorno externo (começa fora do material útil)
      const piercePoint = {
        x: firstPt.x - lead.lengthMm * Math.cos(lead.angleDeg * DEG),
        y: firstPt.y - lead.lengthMm * Math.sin(lead.angleDeg * DEG),
      };

      const leadInSegments: ToolpathSegment[] = [
        {
          type: "LEAD_IN",
          start: piercePoint,
          end: firstPt,
          feedrate: params.feedrateMmMin * 0.8,
          beamOn: true,
        },
      ];

      const microJoints: MicroJoint[] = [];
      if (tabCount > 0 && cutSegments.length > 0) {
        // Insere micro-juntas nas arestas do contorno externo
        const step = Math.floor(cutSegments.length / tabCount);
        for (let t = 0; t < tabCount; t++) {
          const segIdx = Math.min(cutSegments.length - 1, t * step + 1);
          const seg = cutSegments[segIdx];
          const midX = (seg.start.x + seg.end.x) * 0.5;
          const midY = (seg.start.y + seg.end.y) * 0.5;
          microJoints.push({
            id: `tab_${t}`,
            position: { x: midX, y: midY },
            widthMm: tabWidth,
            contourId: "contour_outer",
          });
        }
      }

      contours.push({
        id: "contour_outer",
        isOuter: true,
        piercePoint,
        leadInSegments,
        cutSegments,
        leadOutSegments: [],
        lengthMm: totalLen,
        microJoints,
      });
    }

    return contours;
  }

  /**
   * Ordena os contornos: primeiro furos internos (menor caminho), por último o contorno externo.
   */
  private static sortContours(contours: CutContour[]): CutContour[] {
    const inner = contours.filter((c) => !c.isOuter);
    const outer = contours.filter((c) => c.isOuter);

    // Otimização Nearest-Neighbor para furos internos
    const sortedInner: CutContour[] = [];
    const remaining = [...inner];
    let currentPos = { x: 0, y: 0 };

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = Math.hypot(
          remaining[i].piercePoint.x - currentPos.x,
          remaining[i].piercePoint.y - currentPos.y,
        );
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      }
      const [chosen] = remaining.splice(nearestIdx, 1);
      sortedInner.push(chosen);
      currentPos = chosen.piercePoint;
    }

    return [...sortedInner, ...outer];
  }
}
