// @ts-nocheck
/**
 * CALDRA CAD — FORMING TOOLS & DEFORMATION ENGINE (FASE 12)
 *
 * Motor geométrico para geração e cálculo de ferramentas de conformação em chapa:
 *  - Nervuras de reforço em dobras (Gussets)
 *  - Venezianas de respiro e aeração (Louvers)
 *  - Estampos, repuxos e escareados (Embosses, Countersinks)
 *  - Anotações de ferramental e furação no Flat Pattern
 */

import type { Vector2D, Vector3D, SolidBody3D, Face3D } from "../canonical";
import type {
  SheetMetalGussetDef,
  SheetMetalLouverDef,
  SheetMetalEmbossDef,
  FormingFlatPatternAnnotation,
} from "./types";
import type { Entity } from "@/lib/lab2d/core";

export interface FormingEngineResult {
  gussetAnnotations: FormingFlatPatternAnnotation[];
  louverAnnotations: FormingFlatPatternAnnotation[];
  embossAnnotations: FormingFlatPatternAnnotation[];
  allFlatPatternEntities: Entity[];
  totalPiercesAdded: number;
  formingToolCount: number;
}

export class FormingEngine {
  /**
   * Processa uma nervura de reforço (Gusset) aplicada sobre uma dobra da chapa.
   */
  public static processGusset(
    gusset: SheetMetalGussetDef,
    bendLineStart: Vector2D,
    bendLineEnd: Vector2D,
  ): FormingFlatPatternAnnotation {
    // Interpola a posição do centro do gusset ao longo da linha de dobra
    const t = Math.max(0, Math.min(1, gusset.normalizedPosition));
    const cx = bendLineStart.x + t * (bendLineEnd.x - bendLineStart.x);
    const cy = bendLineStart.y + t * (bendLineEnd.y - bendLineStart.y);

    const halfW = gusset.widthMm / 2;
    const halfD = gusset.depthMm / 2;

    // Vetor diretor da dobra
    const dx = bendLineEnd.x - bendLineStart.x;
    const dy = bendLineEnd.y - bendLineStart.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Vetor normal à dobra
    const nx = -uy;
    const ny = ux;

    const entities: Entity[] = [];

    // Linha de centro da nervura de conformação
    entities.push({
      id: `gusset_${gusset.id}_cl`,
      type: "line",
      p1: { x: cx - nx * halfD, y: cy - ny * halfD },
      p2: { x: cx + nx * halfD, y: cy + ny * halfD },
      role: "MARK",
    });

    // Contorno do punção de repuxo no gabarito
    const p1 = { x: cx - ux * halfW - nx * halfD, y: cy - uy * halfW - ny * halfD };
    const p2 = { x: cx + ux * halfW - nx * halfD, y: cy + uy * halfW - ny * halfD };
    const p3 = { x: cx + ux * halfW + nx * halfD, y: cy + uy * halfW + ny * halfD };
    const p4 = { x: cx - ux * halfW + nx * halfD, y: cy - uy * halfW + ny * halfD };

    entities.push(
      { id: `gusset_${gusset.id}_e1`, type: "line", p1, p2, role: "MARK" },
      { id: `gusset_${gusset.id}_e2`, type: "line", p1: p2, p2: p3, role: "MARK" },
      { id: `gusset_${gusset.id}_e3`, type: "line", p1: p3, p2: p4, role: "MARK" },
      { id: `gusset_${gusset.id}_e4`, type: "line", p1: p4, p2: p1, role: "MARK" },
    );

    return {
      id: gusset.id,
      toolType: "GUSSET",
      name:
        gusset.name ||
        `Nervura ${gusset.type === "ROUNDED" ? "Arredondada" : "Plana"} ${gusset.widthMm}x${gusset.depthMm}`,
      center2D: { x: cx, y: cy },
      entities,
      toolingCode: `PUNCH_GUSSET_${gusset.type}_W${gusset.widthMm}_D${gusset.depthMm}`,
      notes: `Gusset de reforço em dobra. Profundidade: ${gusset.depthMm}mm, Largura: ${gusset.widthMm}mm`,
    };
  }

  /**
   * Processa uma veneziana de respiro / ventilação (Louver).
   * No flat pattern / corte CNC, a borda frontal é CISALHADA (CUT) e o fundo é CONFORMADO (MARK).
   */
  public static processLouver(louver: SheetMetalLouverDef): FormingFlatPatternAnnotation {
    const cx = louver.position.x;
    const cy = louver.position.y;
    const halfL = louver.lengthMm / 2;
    const angleRad = (louver.rotationDeg * Math.PI) / 180;

    const ux = Math.cos(angleRad);
    const uy = Math.sin(angleRad);
    const nx = -uy;
    const ny = ux;

    const cutOffset = louver.cutSide === "LEFT" ? -louver.heightMm : louver.heightMm;

    // Linha frontal cortada pela ferramenta de punção / laser (Role CUT)
    const cutStart = { x: cx - ux * halfL, y: cy - uy * halfL };
    const cutEnd = { x: cx + ux * halfL, y: cy + uy * halfL };

    const entities: Entity[] = [
      {
        id: `louver_${louver.id}_cut`,
        type: "line",
        p1: cutStart,
        p2: cutEnd,
        role: "CUT",
      },
    ];

    // Cúpula traseira conformada por repuxo (Role MARK)
    const backCenter = { x: cx + nx * cutOffset, y: cy + ny * cutOffset };
    entities.push(
      {
        id: `louver_${louver.id}_back_left`,
        type: "line",
        p1: cutStart,
        p2: backCenter,
        role: "MARK",
      },
      {
        id: `louver_${louver.id}_back_right`,
        type: "line",
        p1: backCenter,
        p2: cutEnd,
        role: "MARK",
      },
    );

    return {
      id: louver.id,
      toolType: "LOUVER",
      name: louver.name || `Veneziana ${louver.lengthMm}x${louver.heightMm}mm`,
      center2D: { x: cx, y: cy },
      entities,
      toolingCode: `PUNCH_LOUVER_L${louver.lengthMm}_H${louver.heightMm}`,
      notes: `Aleta de respiro veneziana. Corte frontal de ${louver.lengthMm}mm e abertura de ${louver.heightMm}mm`,
    };
  }

  /**
   * Processa estampos, repuxos e rebaixos (Emboss / Countersink).
   */
  public static processEmboss(emboss: SheetMetalEmbossDef): FormingFlatPatternAnnotation {
    const cx = emboss.position.x;
    const cy = emboss.position.y;
    const entities: Entity[] = [];

    const isCircular = emboss.shape === "CIRCULAR" || emboss.shape === "COUNTERSINK";
    const d = emboss.diameterMm || 20;

    if (isCircular) {
      // Contorno circular de conformação
      entities.push({
        id: `emboss_${emboss.id}_contour`,
        type: "circle",
        center: { x: cx, y: cy },
        radius: d / 2,
        role: "MARK",
      });

      // Se for furado no centro, adiciona círculo com Role CUT (pierce)
      if (emboss.isPierced && emboss.holeDiameterMm && emboss.holeDiameterMm > 0) {
        entities.push({
          id: `emboss_${emboss.id}_hole`,
          type: "circle",
          center: { x: cx, y: cy },
          radius: emboss.holeDiameterMm / 2,
          role: "CUT",
        });
      }
    } else {
      // Oblongo ou retangular
      const w = emboss.widthMm || 20;
      const l = emboss.lengthMm || 40;
      const halfW = w / 2;
      const halfL = l / 2;

      const p1 = { x: cx - halfL, y: cy - halfW };
      const p2 = { x: cx + halfL, y: cy - halfW };
      const p3 = { x: cx + halfL, y: cy + halfW };
      const p4 = { x: cx - halfL, y: cy + halfW };

      entities.push(
        { id: `emboss_${emboss.id}_e1`, type: "line", p1, p2, role: "MARK" },
        { id: `emboss_${emboss.id}_e2`, type: "line", p1: p2, p2: p3, role: "MARK" },
        { id: `emboss_${emboss.id}_e3`, type: "line", p1: p3, p2: p4, role: "MARK" },
        { id: `emboss_${emboss.id}_e4`, type: "line", p1: p4, p2: p1, role: "MARK" },
      );
    }

    return {
      id: emboss.id,
      toolType: "EMBOSS",
      name: emboss.name || `Estampo ${emboss.shape} Prof. ${emboss.depthMm}mm`,
      center2D: { x: cx, y: cy },
      entities,
      toolingCode: `FORM_EMBOSS_${emboss.shape}_D${d}_DEP${emboss.depthMm}`,
      notes: `Estampo/Repuxo ${emboss.shape}. Profundidade: ${emboss.depthMm}mm, Escareamento: ${emboss.draftAngleDeg}°`,
    };
  }

  /**
   * Consolida todos os recursos de conformação de uma peça.
   */
  public static consolidateForming(
    gussets: SheetMetalGussetDef[],
    louvers: SheetMetalLouverDef[],
    embosses: SheetMetalEmbossDef[],
    bendLines: { id: string; start: Vector2D; end: Vector2D }[],
  ): FormingEngineResult {
    const gussetAnnotations: FormingFlatPatternAnnotation[] = [];
    const louverAnnotations: FormingFlatPatternAnnotation[] = [];
    const embossAnnotations: FormingFlatPatternAnnotation[] = [];
    const allFlatPatternEntities: Entity[] = [];
    let totalPiercesAdded = 0;

    const bendMap = new Map(bendLines.map((b) => [b.id, b]));

    for (const g of gussets) {
      const bend = bendMap.get(g.bendLineId) || {
        id: g.bendLineId,
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
      };
      const ann = this.processGusset(g, bend.start, bend.end);
      gussetAnnotations.push(ann);
      allFlatPatternEntities.push(...ann.entities);
    }

    for (const l of louvers) {
      const ann = this.processLouver(l);
      louverAnnotations.push(ann);
      allFlatPatternEntities.push(...ann.entities);
      totalPiercesAdded += 1; // 1 corte por aleta
    }

    for (const e of embosses) {
      const ann = this.processEmboss(e);
      embossAnnotations.push(ann);
      allFlatPatternEntities.push(...ann.entities);
      if (e.isPierced) totalPiercesAdded += 1;
    }

    return {
      gussetAnnotations,
      louverAnnotations,
      embossAnnotations,
      allFlatPatternEntities,
      totalPiercesAdded,
      formingToolCount: gussets.length + louvers.length + embosses.length,
    };
  }
}
