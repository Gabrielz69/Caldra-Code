/**
 * CALDRA CHAMFER — COTAS VIVAS DINÂMICAS E INTERATIVAS (DynamicDimensionInteraction)
 *
 * Gera cotas flutuantes inteligentes em tempo real durante operações de desenho e edição:
 *  - Cota de afastamento de borda (offset normal em mm);
 *  - Cota ao longo da borda (distância do início u);
 *  - Cotas ortogonais (ΔX, ΔY) a partir de um canto de referência para furos/círculos;
 *  - Cota de distância linear e ângulo em relação à REF 0,0 temporária.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, uid } from "./core";
import type { EdgeReference } from "./cadGeometricReferences";
import type { TemporaryOrigin } from "./cadCoordinateFrames";
import { CoordinateFrameManager } from "./cadCoordinateFrames";

export type LiveDimensionKind =
  | "offset"
  | "dx"
  | "dy"
  | "distance"
  | "u_along"
  | "v_perp"
  | "diameter"
  | "radius";

export interface LiveDimension {
  id: string;
  kind: LiveDimensionKind;
  value: number;
  label: string;
  startPoint: Vec2;
  endPoint: Vec2;
  midPoint: Vec2;
  normalDir: Vec2;
  isEditable: boolean;
  targetKey: string;
}

export class DynamicDimensionInteraction {
  /**
   * Gera cotas vivas ao posicionar uma linha ou elemento próximo a uma borda de referência.
   */
  static generateEdgeOffsetDimensions(
    cursor: Vec2,
    edge: EdgeReference,
    side: 1 | -1 = 1,
  ): LiveDimension[] {
    const { u, v } = CoordinateFrameManager.worldToUV(cursor, edge);
    const absV = Math.abs(v);
    const dims: LiveDimension[] = [];

    // Ponto na borda onde a projeção ortogonal toca
    const clampedU = Math.max(0, Math.min(edge.length, u));
    const edgeBasePt: Vec2 = {
      x: edge.p1.x + clampedU * edge.dir.x,
      y: edge.p1.y + clampedU * edge.dir.y,
    };

    // Ponto no cursor ou na linha deslocada
    const offsetPt: Vec2 = {
      x: edgeBasePt.x + edge.normal.x * v,
      y: edgeBasePt.y + edge.normal.y * v,
    };

    // 1. Cota Viva de Afastamento (v / offset)
    dims.push({
      id: uid(),
      kind: "offset",
      value: parseFloat(absV.toFixed(2)),
      label: `d = ${absV.toFixed(1)} mm`,
      startPoint: edgeBasePt,
      endPoint: offsetPt,
      midPoint: {
        x: (edgeBasePt.x + offsetPt.x) / 2,
        y: (edgeBasePt.y + offsetPt.y) / 2,
      },
      normalDir: edge.dir,
      isEditable: true,
      targetKey: "offset",
    });

    // 2. Cota ao longo da borda (u) se estiver no segmento
    if (clampedU > 1.0) {
      dims.push({
        id: uid(),
        kind: "u_along",
        value: parseFloat(clampedU.toFixed(2)),
        label: `u = ${clampedU.toFixed(1)} mm`,
        startPoint: edge.p1,
        endPoint: edgeBasePt,
        midPoint: {
          x: (edge.p1.x + edgeBasePt.x) / 2,
          y: (edge.p1.y + edgeBasePt.y) / 2,
        },
        normalDir: edge.normal,
        isEditable: true,
        targetKey: "u",
      });
    }

    return dims;
  }

  /**
   * Gera cotas ortogonais vivas (ΔX e ΔY) em relação a um canto para posicionamento de furo.
   */
  static generateCornerHoleDimensions(
    center: Vec2,
    corner: Vec2,
    diameter = 10,
  ): LiveDimension[] {
    const dx = center.x - corner.x;
    const dy = center.y - corner.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const dims: LiveDimension[] = [];

    // Cota horizontal ΔX
    const cornerCornerX: Vec2 = { x: corner.x, y: corner.y };
    const ptHorizontalEnd: Vec2 = { x: center.x, y: corner.y };
    dims.push({
      id: uid(),
      kind: "dx",
      value: parseFloat(absDx.toFixed(2)),
      label: `ΔX = ${absDx.toFixed(1)} mm`,
      startPoint: cornerCornerX,
      endPoint: ptHorizontalEnd,
      midPoint: {
        x: (cornerCornerX.x + ptHorizontalEnd.x) / 2,
        y: cornerCornerX.y,
      },
      normalDir: { x: 0, y: -1 },
      isEditable: true,
      targetKey: "dx",
    });

    // Cota vertical ΔY
    const ptVerticalEnd: Vec2 = { x: center.x, y: center.y };
    dims.push({
      id: uid(),
      kind: "dy",
      value: parseFloat(absDy.toFixed(2)),
      label: `ΔY = ${absDy.toFixed(1)} mm`,
      startPoint: ptHorizontalEnd,
      endPoint: ptVerticalEnd,
      midPoint: {
        x: ptHorizontalEnd.x,
        y: (ptHorizontalEnd.y + ptVerticalEnd.y) / 2,
      },
      normalDir: { x: 1, y: 0 },
      isEditable: true,
      targetKey: "dy",
    });

    // Cota de diâmetro do furo se positivo
    if (diameter > 0) {
      dims.push({
        id: uid(),
        kind: "diameter",
        value: parseFloat(diameter.toFixed(2)),
        label: `Ø ${diameter.toFixed(1)} mm`,
        startPoint: { x: center.x - diameter / 2, y: center.y },
        endPoint: { x: center.x + diameter / 2, y: center.y },
        midPoint: center,
        normalDir: { x: 0, y: 1 },
        isEditable: true,
        targetKey: "diameter",
      });
    }

    return dims;
  }

  /**
   * Gera cotas vivas a partir de uma Origem Temporária (REF 0,0).
   */
  static generateRefOriginDimensions(
    cursor: Vec2,
    ref: TemporaryOrigin,
  ): LiveDimension[] {
    const dx = cursor.x - ref.p.x;
    const dy = cursor.y - ref.p.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const directDist = Math.hypot(dx, dy);

    if (directDist < 0.5) return [];

    const dims: LiveDimension[] = [];

    // Cota horizontal ΔX
    const ptCorner: Vec2 = { x: cursor.x, y: ref.p.y };
    if (absDx > 1.0) {
      dims.push({
        id: uid(),
        kind: "dx",
        value: parseFloat(absDx.toFixed(2)),
        label: `ΔX = ${dx >= 0 ? "+" : ""}${dx.toFixed(1)} mm`,
        startPoint: ref.p,
        endPoint: ptCorner,
        midPoint: {
          x: (ref.p.x + ptCorner.x) / 2,
          y: ref.p.y,
        },
        normalDir: { x: 0, y: dy >= 0 ? -1 : 1 },
        isEditable: true,
        targetKey: "dx",
      });
    }

    // Cota vertical ΔY
    if (absDy > 1.0) {
      dims.push({
        id: uid(),
        kind: "dy",
        value: parseFloat(absDy.toFixed(2)),
        label: `ΔY = ${dy >= 0 ? "+" : ""}${dy.toFixed(1)} mm`,
        startPoint: ptCorner,
        endPoint: cursor,
        midPoint: {
          x: ptCorner.x,
          y: (ptCorner.y + cursor.y) / 2,
        },
        normalDir: { x: dx >= 0 ? 1 : -1, y: 0 },
        isEditable: true,
        targetKey: "dy",
      });
    }

    // Distância direta L
    dims.push({
      id: uid(),
      kind: "distance",
      value: parseFloat(directDist.toFixed(2)),
      label: `L = ${directDist.toFixed(1)} mm`,
      startPoint: ref.p,
      endPoint: cursor,
      midPoint: {
        x: (ref.p.x + cursor.x) / 2,
        y: (ref.p.y + cursor.y) / 2,
      },
      normalDir: { x: -dy / directDist, y: dx / directDist },
      isEditable: true,
      targetKey: "distance",
    });

    return dims;
  }
}
