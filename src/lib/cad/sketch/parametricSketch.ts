// @ts-nocheck
/**
 * CALDRA CAD — PARAMETRIC SKETCH (FASE 02)
 *
 * Gerenciador de esboço paramétrico bidirecional:
 * SKETCH PARAMÉTRICO + CONSTRAINTS → SOLVER → CANONICAL MODEL → CHAMFER 2D
 */

import type { Sketch2D, SketchSegment2D } from "../canonical";
import type { Entity } from "@/lib/lab2d/core";
import { ConstraintSolver } from "./solver";
import type {
  SketchPoint,
  SketchSegment,
  GeometricConstraint,
  DimensionParameter,
  ConstraintType,
  SolveResult,
} from "./types";

export class ParametricSketch {
  id: string;
  name: string;
  points: SketchPoint[] = [];
  segments: SketchSegment[] = [];
  constraints: GeometricConstraint[] = [];
  parameters: Map<string, DimensionParameter> = new Map();
  lastSolveResult: SolveResult | null = null;

  constructor(id?: string, name = "Esboço Paramétrico") {
    this.id = id ?? `sketch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.name = name;
  }

  addPoint(x: number, y: number, isFixed = false): SketchPoint {
    const pt: SketchPoint = {
      id: `pt_${this.points.length}_${Math.random().toString(36).slice(2, 5)}`,
      x,
      y,
      isFixed,
    };
    this.points.push(pt);
    return pt;
  }

  addLine(
    p0Id: string,
    p1Id: string,
    role: "CORTE" | "MARCAÇÃO" | "DOBRA" | "RECORTE" = "CORTE",
  ): SketchSegment {
    const seg: SketchSegment = {
      id: `seg_${this.segments.length}`,
      type: "line",
      p0Id,
      p1Id,
      role,
    };
    this.segments.push(seg);
    return seg;
  }

  addConstraint(
    type: ConstraintType,
    pointIds: string[],
    options: { value?: number; expression?: string; segmentIds?: string[] } = {},
  ): GeometricConstraint {
    const constraint: GeometricConstraint = {
      id: `cst_${this.constraints.length}_${type}`,
      type,
      pointIds,
      segmentIds: options.segmentIds,
      value: options.value,
      expression: options.expression,
      isActive: true,
    };
    this.constraints.push(constraint);
    return constraint;
  }

  setDimensionParameter(
    name: string,
    value: number,
    expression?: string,
    unit: "mm" | "deg" = "mm",
  ) {
    this.parameters.set(name, {
      id: `param_${name}`,
      name,
      value,
      expression,
      unit,
    });
  }

  solve(): SolveResult {
    const paramsArray = Array.from(this.parameters.values());
    const { points: solvedPoints, result } = ConstraintSolver.solve(
      this.points,
      this.segments,
      this.constraints,
      paramsArray,
    );

    this.points = solvedPoints;
    this.lastSolveResult = result;
    return result;
  }

  toCanonicalSketch(): Sketch2D {
    const ptMap = new Map<string, SketchPoint>();
    this.points.forEach((p) => ptMap.set(p.id, p));

    const canonicalSegments: SketchSegment2D[] = [];

    for (const seg of this.segments) {
      const p0 = ptMap.get(seg.p0Id);
      const p1 = ptMap.get(seg.p1Id);
      if (!p0 || !p1) continue;

      const role =
        seg.role === "CORTE"
          ? "CUT"
          : seg.role === "MARCAÇÃO"
            ? "MARK"
            : seg.role === "DOBRA"
              ? "BEND"
              : "RECORTE";

      canonicalSegments.push({
        id: seg.id,
        type: seg.type === "line" ? "line" : "arc",
        p0: { x: p0.x, y: p0.y },
        p1: { x: p1.x, y: p1.y },
        role,
      });
    }

    // Área via Shoelace
    let area = 0;
    for (let i = 0; i < canonicalSegments.length; i++) {
      const p0 = canonicalSegments[i].p0;
      const p1 = canonicalSegments[i].p1;
      area += p0.x * p1.y - p1.x * p0.y;
    }
    area = Math.abs(area) * 0.5;

    return {
      id: this.id,
      name: this.name,
      plane: "XY",
      origin: { x: 0, y: 0, z: 0 },
      segments: canonicalSegments,
      isClosed: canonicalSegments.length >= 3,
      area,
    };
  }

  toLab2DEntities(): Entity[] {
    const ptMap = new Map<string, SketchPoint>();
    this.points.forEach((p) => ptMap.set(p.id, p));

    const entities: Entity[] = [];

    for (const seg of this.segments) {
      const p0 = ptMap.get(seg.p0Id);
      const p1 = ptMap.get(seg.p1Id);
      if (!p0 || !p1) continue;

      const layer =
        seg.role === "CUT"
          ? "CORTE"
          : seg.role === "MARK"
            ? "MARCAÇÃO"
            : seg.role === "BEND"
              ? "DOBRA"
              : seg.role;

      entities.push({
        id: seg.id,
        type: "line",
        x1: p0.x,
        y1: p0.y,
        x2: p1.x,
        y2: p1.y,
        layer: layer as "CORTE" | "MARCAÇÃO" | "DOBRA" | "RECORTE",
      });
    }

    return entities;
  }

  static createRectangle(
    width: number,
    height: number,
    originX = 0,
    originY = 0,
    isFixedOrigin = true,
  ): ParametricSketch {
    const sketch = new ParametricSketch(undefined, `Retângulo ${width}×${height}`);

    const p0 = sketch.addPoint(originX, originY, isFixedOrigin);
    const p1 = sketch.addPoint(originX + width, originY);
    const p2 = sketch.addPoint(originX + width, originY + height);
    const p3 = sketch.addPoint(originX, originY + height);

    sketch.addLine(p0.id, p1.id, "CORTE");
    sketch.addLine(p1.id, p2.id, "CORTE");
    sketch.addLine(p2.id, p3.id, "CORTE");
    sketch.addLine(p3.id, p0.id, "CORTE");

    sketch.addConstraint("horizontal", [p0.id, p1.id]);
    sketch.addConstraint("vertical", [p1.id, p2.id]);
    sketch.addConstraint("horizontal", [p3.id, p2.id]);
    sketch.addConstraint("vertical", [p0.id, p3.id]);

    sketch.setDimensionParameter("Largura", width);
    sketch.setDimensionParameter("Altura", height);

    sketch.addConstraint("distance", [p0.id, p1.id], { value: width, expression: "Largura" });
    sketch.addConstraint("distance", [p1.id, p2.id], { value: height, expression: "Altura" });

    if (isFixedOrigin) {
      sketch.addConstraint("fixed", [p0.id]);
    }

    sketch.solve();
    return sketch;
  }
}
