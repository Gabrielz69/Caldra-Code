/**
 * CALDRA CHAMFER — SISTEMA AVANÇADO DE PRECISÃO, SNAPS, ORTHO & POLAR TRACKING
 *
 * Expansão de precisão técnica para desenho CAD profissional de caldeiraria:
 *  - Snaps de Quadrante (0°, 90°, 180°, 270° de círculos e elipses);
 *  - Snap Perpendicular (projeção normal ao segmento a partir do ponto de partida);
 *  - Snap Tangente (tangência a circunferências e arcos);
 *  - Snap Origem (0, 0);
 *  - Modo Ortogonal (ORTHO / F8) travando em eixos X e Y;
 *  - Rastreamento Polar (Guias a 0°, 45°, 90°, 135°, 180° com indicação visual);
 *  - Dynamic HUD (Medição flutuante em tempo real para entrada direta de valores).
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, type Entity, type Snap } from "./core";

export interface PolarGuide {
  origin: Vec2;
  angleDeg: number;
  dir: Vec2;
}

/**
 * Aplica o modo ortogonal (ORTHO): restringe o cursor ao eixo mais próximo
 * (horizontal ou vertical) em relação a um ponto base de partida.
 */
export function applyOrtho(base: Vec2, cursor: Vec2): Vec2 {
  const dx = cursor.x - base.x;
  const dy = cursor.y - base.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: cursor.x, y: base.y };
  } else {
    return { x: base.x, y: cursor.y };
  }
}

/**
 * Detecta guias de rastreamento polar (0°, 45°, 90°, 135°, 180°, etc.)
 * a partir de um ponto base. Se o cursor estiver dentro do limiar angular,
 * projeta o ponto exatamente sobre o raio polar.
 */
export function applyPolarTracking(
  base: Vec2,
  cursor: Vec2,
  angularToleranceDeg = 4.0,
  stepDeg = 45,
): { point: Vec2; activeGuide: PolarGuide | null } {
  const dx = cursor.x - base.x;
  const dy = cursor.y - base.y;
  const d = Math.hypot(dx, dy);

  if (d < 1e-3) {
    return { point: cursor, activeGuide: null };
  }

  // Ângulo em graus [0..360)
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;

  // Encontra o múltiplo mais próximo de stepDeg
  const nearestAngle = Math.round(angle / stepDeg) * stepDeg;
  const diff = Math.abs(angle - nearestAngle);

  if (diff <= angularToleranceDeg) {
    const rad = (nearestAngle * Math.PI) / 180;
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const projected = {
      x: base.x + dir.x * d,
      y: base.y + dir.y * d,
    };
    return {
      point: projected,
      activeGuide: {
        origin: base,
        angleDeg: nearestAngle % 360,
        dir,
      },
    };
  }

  return { point: cursor, activeGuide: null };
}

/**
 * Calcula pontos avançados de captura: quadrantes, perpendiculares, tangentes e origem.
 */
export function findAdvancedSnaps(
  cursor: Vec2,
  entities: Entity[],
  activeStartPoint: Vec2 | null,
  tol: number,
): Snap[] {
  const cands: Snap[] = [];

  // 1. Origem do sistema de coordenadas (0, 0)
  cands.push({ p: { x: 0, y: 0 }, kind: "origin" });

  for (const e of entities) {
    // 2. Quadrantes de círculos (0°, 90°, 180°, 270°)
    if (e.type === "circle") {
      cands.push(
        { p: { x: e.cx + e.r, y: e.cy }, kind: "quadrant" },
        { p: { x: e.cx - e.r, y: e.cy }, kind: "quadrant" },
        { p: { x: e.cx, y: e.cy + e.r }, kind: "quadrant" },
        { p: { x: e.cx, y: e.cy - e.r }, kind: "quadrant" },
      );

      // 3. Tangência a partir de um ponto de partida
      if (activeStartPoint) {
        const dCenter = dist(activeStartPoint, { x: e.cx, y: e.cy });
        if (dCenter > e.r) {
          const baseAng = Math.atan2(e.cy - activeStartPoint.y, e.cx - activeStartPoint.x);
          const theta = Math.acos(e.r / dCenter);

          // Dois pontos de tangência no círculo
          const t1Ang = baseAng + (Math.PI / 2 - theta);
          const t2Ang = baseAng - (Math.PI / 2 - theta);

          cands.push(
            { p: { x: e.cx + e.r * Math.cos(t1Ang), y: e.cy + e.r * Math.sin(t1Ang) }, kind: "tangent" },
            { p: { x: e.cx + e.r * Math.cos(t2Ang), y: e.cy + e.r * Math.sin(t2Ang) }, kind: "tangent" },
          );
        }
      }
    }

    // 4. Perpendicular ao segmento de linha a partir de activeStartPoint
    if (activeStartPoint && e.type === "line") {
      const dx = e.x2 - e.x1;
      const dy = e.y2 - e.y1;
      const l2 = dx * dx + dy * dy;
      if (l2 > 1e-4) {
        const t = ((activeStartPoint.x - e.x1) * dx + (activeStartPoint.y - e.y1) * dy) / l2;
        if (t >= 0 && t <= 1) {
          const perpPt = { x: e.x1 + t * dx, y: e.y1 + t * dy };
          cands.push({ p: perpPt, kind: "perp" });
        }
      }
    }
  }

  return cands.filter((c) => dist(c.p, cursor) <= tol);
}
