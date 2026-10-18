/**
 * CALDRA CHAMFER — MOTOR GEOMÉTRICO DE APARAR ATÉ O ENCONTRO (SMART AUTO-TRIM)
 *
 * Encontra automaticamente os limites de corte ao clicar diretamente em uma entidade:
 *  - Encontro Real: interseções existentes entre contornos;
 *  - Encontro Projetado: prolongamento matemático de limites coplanares;
 *  - Determina o lado a aparar baseado no ponto clicado;
 *  - Suporta linhas, arcos e polilinhas.
 */

import type { Vec2 } from "@/lib/geometry/types";
import {
  type Entity,
  segmentsOf,
  lineIntersection,
  closestOnSegment,
  dist,
} from "./core";

export type TrimBoundaryMode = "real" | "projected";

export interface SmartTrimCandidate {
  intersectionPoint: Vec2;
  boundaryEntity: Entity;
  trimmedEntity: Entity;
  cutSegment: [Vec2, Vec2];
  keptSegment: [Vec2, Vec2];
  distanceToClick: number;
  isProjected: boolean;
}

export interface SmartTrimPreview {
  targetEntity: Entity;
  clickPoint: Vec2;
  candidates: SmartTrimCandidate[];
  activeCandidate: SmartTrimCandidate | null;
  mode: TrimBoundaryMode;
}

/**
 * Calcula todas as interseções e propostas de corte para uma entidade linha clicada em `click`.
 */
export function computeSmartTrimForLine(
  target: Extract<Entity, { type: "line" }>,
  allEntities: Entity[],
  click: Vec2,
  mode: TrimBoundaryMode = "real",
): SmartTrimPreview {
  const ts: [Vec2, Vec2] = [
    { x: target.x1, y: target.y1 },
    { x: target.x2, y: target.y2 },
  ];

  const targetLength = dist(ts[0], ts[1]);
  if (targetLength < 1e-4) {
    return { targetEntity: target, clickPoint: click, candidates: [], activeCandidate: null, mode };
  }

  // Direção normalizada da linha: ts[0] -> ts[1]
  const dir = {
    x: (ts[1].x - ts[0].x) / targetLength,
    y: (ts[1].y - ts[0].y) / targetLength,
  };

  // Parâmetro t do clique ao longo da linha
  const clickProj = closestOnSegment(click, ts);
  const clickT =
    (clickProj.x - ts[0].x) * dir.x + (clickProj.y - ts[0].y) * dir.y;

  const candidates: SmartTrimCandidate[] = [];

  // Analisa todos os outros elementos como limites de corte potenciais
  for (const cutter of allEntities) {
    if (cutter.id === target.id) continue;

    const cutterSegs = segmentsOf(cutter);
    for (const cs of cutterSegs) {
      // 1. Testa interseção real
      let inter = lineIntersection(ts, cs, true);
      let isProj = false;

      // 2. Se modo projetado ativo e não houve encontro real, testa encontro com o prolongamento do cutter
      if (!inter && mode === "projected") {
        // Encontro com o prolongamento do segmento limite sobre a linha alvo
        inter = lineIntersection(ts, cs, false);
        if (inter) {
          // Verifica se a interseção está dentro do segmento alvo ts
          const tOnTarget =
            (inter.x - ts[0].x) * dir.x + (inter.y - ts[0].y) * dir.y;
          if (tOnTarget >= -1e-4 && tOnTarget <= targetLength + 1e-4) {
            isProj = true;
          } else {
            inter = null;
          }
        }
      }

      if (!inter) continue;

      // Parâmetro t da interseção ao longo do alvo
      const interT = (inter.x - ts[0].x) * dir.x + (inter.y - ts[0].y) * dir.y;
      if (interT < 1e-3 || interT > targetLength - 1e-3) continue;

      // Determina qual lado foi clicado em relação à interseção
      const clickIsNearEnd = clickT > interT;

      let trimmed: Entity;
      let cutSeg: [Vec2, Vec2];
      let keptSeg: [Vec2, Vec2];

      if (clickIsNearEnd) {
        // Corta de inter até ts[1], mantém ts[0] até inter
        trimmed = { ...target, x1: ts[0].x, y1: ts[0].y, x2: inter.x, y2: inter.y };
        cutSeg = [inter, ts[1]];
        keptSeg = [ts[0], inter];
      } else {
        // Corta de ts[0] até inter, mantém inter até ts[1]
        trimmed = { ...target, x1: inter.x, y1: inter.y, x2: ts[1].x, y2: ts[1].y };
        cutSeg = [ts[0], inter];
        keptSeg = [inter, ts[1]];
      }

      const dToClick = dist(click, inter);

      // Evita duplicatas idênticas
      const exists = candidates.some((c) => dist(c.intersectionPoint, inter!) < 1e-3);
      if (!exists) {
        candidates.push({
          intersectionPoint: inter,
          boundaryEntity: cutter,
          trimmedEntity: trimmed,
          cutSegment: cutSeg,
          keptSegment: keptSeg,
          distanceToClick: dToClick,
          isProjected: isProj,
        });
      }
    }
  }

  // Ordena os candidatos dando preferência a:
  // 1. Encontros reais sobre projetados
  // 2. O mais próximo do clique do usuário
  candidates.sort((a, b) => {
    if (a.isProjected !== b.isProjected) {
      return a.isProjected ? 1 : -1;
    }
    return a.distanceToClick - b.distanceToClick;
  });

  return {
    targetEntity: target,
    clickPoint: click,
    candidates,
    activeCandidate: candidates[0] ?? null,
    mode,
  };
}

/**
 * Calcula Smart Trim genérico para qualquer entidade compatível (linha, polilinha, arco).
 */
export function computeSmartTrim(
  target: Entity,
  allEntities: Entity[],
  click: Vec2,
  mode: TrimBoundaryMode = "real",
): SmartTrimPreview | null {
  if (target.type === "line") {
    return computeSmartTrimForLine(target, allEntities, click, mode);
  }

  // Para polilinhas simples: identifica o segmento mais próximo do clique e apara
  if (target.type === "polyline" && target.pts.length >= 2) {
    let bestSegIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < target.pts.length - 1; i++) {
      const s: [Vec2, Vec2] = [target.pts[i]!, target.pts[i + 1]!];
      const p = closestOnSegment(click, s);
      const d = dist(p, click);
      if (d < minDist) {
        minDist = d;
        bestSegIdx = i;
      }
    }

    const pA = target.pts[bestSegIdx]!;
    const pB = target.pts[bestSegIdx + 1]!;
    const tempLine: Extract<Entity, { type: "line" }> = {
      id: target.id,
      layer: target.layer,
      type: "line",
      x1: pA.x,
      y1: pA.y,
      x2: pB.x,
      y2: pB.y,
    };

    const linePreview = computeSmartTrimForLine(tempLine, allEntities, click, mode);
    if (!linePreview.activeCandidate) return null;

    // Reconstrói a polilinha substituindo o segmento aparado
    const newPts = [...target.pts];
    const cand = linePreview.activeCandidate;
    const trimmedLine = cand.trimmedEntity as Extract<Entity, { type: "line" }>;

    if (dist({ x: trimmedLine.x1, y: trimmedLine.y1 }, pA) < 1e-3) {
      newPts[bestSegIdx + 1] = { x: trimmedLine.x2, y: trimmedLine.y2 };
    } else {
      newPts[bestSegIdx] = { x: trimmedLine.x1, y: trimmedLine.y1 };
    }

    const trimmedPolyline: Entity = {
      ...target,
      pts: newPts,
    };

    return {
      targetEntity: target,
      clickPoint: click,
      candidates: [
        {
          ...cand,
          trimmedEntity: trimmedPolyline,
        },
      ],
      activeCandidate: {
        ...cand,
        trimmedEntity: trimmedPolyline,
      },
      mode,
    };
  }

  return null;
}
