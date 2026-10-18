/**
 * CALDRA CHAMFER — INTEGRAÇÃO DE RESTRIÇÕES GEOMÉTRICAS PARAMÉTRICAS (FASE 04)
 *
 * Conecta as entidades do desenho 2D ao Resolvedor Geométrico Determinístico
 * (ConstraintSolver) de src/lib/cad/sketch/solver.ts.
 *
 * Suporta:
 *  - Horizontal, Vertical, Paralelo, Perpendicular, Coincidente, Tangente,
 *    Concêntrico, Colinear, Igual, Simétrico, Ponto Médio, Fixar.
 *  - Resolução matemática iterativa sem dependência de aproximações visuais;
 *  - Cálculo dos Graus de Liberdade (DoF) e status:
 *      * totalmente definido (verde)
 *      * subdefinido (azul/âmbar)
 *      * sobredefinido (vermelho)
 *      * inválido
 */

import type { Vec2 } from "@/lib/geometry/types";
import type { Entity } from "./core";
import { ConstraintSolver } from "@/lib/cad/sketch/solver";
import type {
  ConstraintType,
  GeometricConstraint,
  SketchPoint,
  SketchSegment,
  SolveResult,
} from "@/lib/cad/sketch/types";

export interface ChamferConstraintModel {
  constraints: GeometricConstraint[];
  status: SolveResult["status"];
  degreesOfFreedom: number;
}

/**
 * Converte as entidades do CHAMFER em pontos e segmentos do resolvedor
 */
export function extractSketchData(entities: Entity[]): {
  points: Map<string, SketchPoint>;
  segments: Map<string, SketchSegment>;
} {
  const points = new Map<string, SketchPoint>();
  const segments = new Map<string, SketchSegment>();

  entities.forEach((e) => {
    if (e.type === "line") {
      const p0Id = `${e.id}_p0`;
      const p1Id = `${e.id}_p1`;
      points.set(p0Id, { id: p0Id, x: e.x1, y: e.y1 });
      points.set(p1Id, { id: p1Id, x: e.x2, y: e.y2 });
      segments.set(e.id, {
        id: e.id,
        type: "line",
        p0Id,
        p1Id,
        role: "CORTE",
      });
    } else if (e.type === "circle") {
      const centerId = `${e.id}_c`;
      const radiusPointId = `${e.id}_r`;
      points.set(centerId, { id: centerId, x: e.cx, y: e.cy });
      points.set(radiusPointId, { id: radiusPointId, x: e.cx + e.r, y: e.cy });
      segments.set(e.id, {
        id: e.id,
        type: "circle",
        p0Id: centerId,
        p1Id: radiusPointId,
        centerId,
        radius: e.r,
        role: "CORTE",
      });
    } else if (e.type === "polyline") {
      for (let i = 0; i < e.pts.length - 1; i++) {
        const segId = `${e.id}_seg_${i}`;
        const p0Id = `${e.id}_pt_${i}`;
        const p1Id = `${e.id}_pt_${i + 1}`;
        points.set(p0Id, { id: p0Id, x: e.pts[i]!.x, y: e.pts[i]!.y });
        points.set(p1Id, { id: p1Id, x: e.pts[i + 1]!.x, y: e.pts[i + 1]!.y });
        segments.set(segId, {
          id: segId,
          type: "line",
          p0Id,
          p1Id,
          role: "CORTE",
        });
      }
    }
  });

  return { points, segments };
}

/**
 * Aplica restrições geométricas e resolve o sistema paramétrico
 */
export function solveChamferSketch(
  entities: Entity[],
  constraints: GeometricConstraint[],
): {
  solvedEntities: Entity[];
  result: SolveResult;
} {
  const { points, segments } = extractSketchData(entities);
  const ptsArray = Array.from(points.values());
  const segsArray = Array.from(segments.values());
  const { points: solvedPts, result } = ConstraintSolver.solve(ptsArray, segsArray, constraints, []);
  solvedPts.forEach((p) => points.set(p.id, p));

  // Mapeia os pontos resolvidos de volta para as entidades do Chamfer
  const solvedEntities = entities.map((e) => {
    if (e.type === "line") {
      const p0 = points.get(`${e.id}_p0`);
      const p1 = points.get(`${e.id}_p1`);
      if (p0 && p1) {
        return {
          ...e,
          x1: p0.x,
          y1: p0.y,
          x2: p1.x,
          y2: p1.y,
        };
      }
    } else if (e.type === "circle") {
      const c = points.get(`${e.id}_c`);
      const rPt = points.get(`${e.id}_r`);
      if (c && rPt) {
        const newRadius = Math.hypot(rPt.x - c.x, rPt.y - c.y);
        return {
          ...e,
          cx: c.x,
          cy: c.y,
          r: Math.max(0.1, newRadius),
        };
      }
    } else if (e.type === "polyline") {
      const newPts: Vec2[] = [];
      for (let i = 0; i < e.pts.length; i++) {
        const pt = points.get(`${e.id}_pt_${i}`);
        newPts.push(pt ? { x: pt.x, y: pt.y } : e.pts[i]!);
      }
      return { ...e, pts: newPts };
    }
    return e;
  });

  return { solvedEntities, result };
}

/**
 * Cria uma restrição paramétrica rápida para entidades selecionadas
 */
export function createConstraintForSelection(
  type: ConstraintType,
  selectedEntities: Entity[],
  allEntities: Entity[],
  value?: number,
): GeometricConstraint | null {
  if (selectedEntities.length === 0) return null;

  const id = `cst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (type === "horizontal" || type === "vertical") {
    const firstLine = selectedEntities.find((e) => e.type === "line");
    if (!firstLine) return null;
    return {
      id,
      type,
      pointIds: [`${firstLine.id}_p0`, `${firstLine.id}_p1`],
      segmentIds: [firstLine.id],
      isActive: true,
    };
  }

  if (type === "parallel" || type === "perpendicular" || type === "equal" || type === "collinear") {
    const lines = selectedEntities.filter((e) => e.type === "line");
    if (lines.length < 2) return null;
    return {
      id,
      type,
      pointIds: [
        `${lines[0]!.id}_p0`,
        `${lines[0]!.id}_p1`,
        `${lines[1]!.id}_p0`,
        `${lines[1]!.id}_p1`,
      ],
      segmentIds: [lines[0]!.id, lines[1]!.id],
      isActive: true,
    };
  }

  if (type === "fixed") {
    const first = selectedEntities[0]!;
    const ptId = first.type === "line" ? `${first.id}_p0` : `${first.id}_c`;
    return {
      id,
      type: "fixed",
      pointIds: [ptId],
      isActive: true,
    };
  }

  if (type === "coincident") {
    if (selectedEntities.length < 2) return null;
    const pt1 = `${selectedEntities[0]!.id}_p0`;
    const pt2 = `${selectedEntities[1]!.id}_p0`;
    return {
      id,
      type: "coincident",
      pointIds: [pt1, pt2],
      isActive: true,
    };
  }

  if (type === "concentric") {
    const circles = selectedEntities.filter((e) => e.type === "circle");
    if (circles.length < 2) return null;
    return {
      id,
      type: "concentric",
      pointIds: [`${circles[0]!.id}_c`, `${circles[1]!.id}_c`],
      isActive: true,
    };
  }

  return null;
}
