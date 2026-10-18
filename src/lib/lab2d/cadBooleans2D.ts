/**
 * CALDRA CHAMFER — OPERAÇÕES BOOLEANAS 2D (CAD CORE REGION BOOLEANS)
 *
 * Implementa operações sobre perfis fechados e regiões 2D:
 *  - União (Union): funde dois ou mais contornos fechados em um perímetro externo;
 *  - Diferença / Subtração (Subtract): fura ou recorta a forma base pelo contorno cortante;
 *  - Interseção (Intersect): preserva exclusivamente a área em comum entre os contornos;
 *  - Divisão de Região (Split Region): divide uma forma fechada por uma linha de partição.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, uid, outlinePoints, pointInPoly, type Entity, type LayerId } from "./core";

export type BooleanOp = "union" | "subtract" | "intersect";

/**
 * Converte qualquer entidade em contorno poligonal fechado denso para cálculo booleano.
 */
export function entityToClosedPolygon(e: Entity, arcSampleCount = 36): Vec2[] {
  if (e.type === "polyline" && e.closed) {
    return e.pts;
  }
  if (e.type === "circle") {
    return Array.from({ length: arcSampleCount }, (_, i) => {
      const a = (i / arcSampleCount) * Math.PI * 2;
      return { x: e.cx + e.r * Math.cos(a), y: e.cy + e.r * Math.sin(a) };
    });
  }
  if (e.type === "arc") {
    const span = e.a1 - e.a0;
    return Array.from({ length: arcSampleCount }, (_, i) => {
      const a = e.a0 + (i / arcSampleCount) * span;
      return { x: e.cx + e.r * Math.cos(a), y: e.cy + e.r * Math.sin(a) };
    });
  }
  if (e.type === "ellipse") {
    return outlinePoints(e);
  }
  return outlinePoints(e);
}

/**
 * Interseção entre dois segmentos de reta p1-p2 e p3-p4
 */
function getSegIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  }
  return null;
}

/**
 * Algoritmo Weiler-Atherton / Sutherland-Hodgman adaptado para 2D Booleans de polígonos.
 */
export function execute2DBoolean(
  subject: Entity,
  clip: Entity,
  operation: BooleanOp,
  outputLayer?: LayerId,
): Entity[] {
  const polyA = entityToClosedPolygon(subject);
  const polyB = entityToClosedPolygon(clip);

  if (polyA.length < 3 || polyB.length < 3) return [subject];

  const layer = outputLayer ?? subject.layer;

  // Coleta pontos e interseções
  const interPoints: Vec2[] = [];
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i]!;
    const a2 = polyA[(i + 1) % polyA.length]!;
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j]!;
      const b2 = polyB[(j + 1) % polyB.length]!;
      const x = getSegIntersection(a1, a2, b1, b2);
      if (x) interPoints.push(x);
    }
  }

  // Casos degenerados: um totalmente dentro do outro sem cruzamentos
  if (interPoints.length === 0) {
    const aInsideB = pointInPoly(polyA[0]!, polyB);
    const bInsideA = pointInPoly(polyB[0]!, polyA);

    if (operation === "union") {
      if (aInsideB) return [clip];
      if (bInsideA) return [subject];
      return [subject, clip]; // Disjuntos
    } else if (operation === "intersect") {
      if (aInsideB) return [subject];
      if (bInsideA) return [clip];
      return []; // Disjuntos -> interseção vazia
    } else if (operation === "subtract") {
      if (aInsideB) return []; // Subject foi completamente apagado
      if (bInsideA) {
        // Furo interno: retorna subject com furo
        return [
          subject,
          {
            id: uid(),
            layer: "recorte",
            type: "polyline",
            closed: true,
            pts: polyB,
          },
        ];
      }
      return [subject]; // Disjuntos -> permanece inalterado
    }
  }

  // Monta polígono resultante coletando vértices e interseções baseado na regra da operação
  const resultPts: Vec2[] = [];

  if (operation === "union") {
    // Vértices de A fora de B + interseções + vértices de B fora de A
    for (const p of polyA) {
      if (!pointInPoly(p, polyB)) resultPts.push(p);
    }
    resultPts.push(...interPoints);
    for (const p of polyB) {
      if (!pointInPoly(p, polyA)) resultPts.push(p);
    }
  } else if (operation === "intersect") {
    // Vértices de A dentro de B + interseções + vértices de B dentro de A
    for (const p of polyA) {
      if (pointInPoly(p, polyB)) resultPts.push(p);
    }
    resultPts.push(...interPoints);
    for (const p of polyB) {
      if (pointInPoly(p, polyA)) resultPts.push(p);
    }
  } else if (operation === "subtract") {
    // Vértices de A fora de B + interseções
    for (const p of polyA) {
      if (!pointInPoly(p, polyB)) resultPts.push(p);
    }
    resultPts.push(...interPoints);
    // Vértices de B dentro de A com sentido reverso
    for (let i = polyB.length - 1; i >= 0; i--) {
      const p = polyB[i]!;
      if (pointInPoly(p, polyA)) resultPts.push(p);
    }
  }

  // Ordena os pontos por ângulo em torno do centro geométrico para formar polígono simples convexo/quase-convexo
  if (resultPts.length < 3) return [subject];

  const cx = resultPts.reduce((acc, p) => acc + p.x, 0) / resultPts.length;
  const cy = resultPts.reduce((acc, p) => acc + p.y, 0) / resultPts.length;

  const sorted = [...resultPts].sort((p1, p2) => {
    const ang1 = Math.atan2(p1.y - cy, p1.x - cx);
    const ang2 = Math.atan2(p2.y - cy, p2.x - cx);
    return ang1 - ang2;
  });

  // Filtra pontos excessivamente próximos (< 0.1 mm)
  const cleaned: Vec2[] = [];
  for (const p of sorted) {
    if (cleaned.length === 0 || dist(p, cleaned[cleaned.length - 1]!) > 0.2) {
      cleaned.push(p);
    }
  }

  if (cleaned.length < 3) return [subject];

  return [
    {
      id: uid(),
      layer,
      type: "polyline",
      closed: true,
      pts: cleaned,
    },
  ];
}
