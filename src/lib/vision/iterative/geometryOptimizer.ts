// @ts-nocheck
/**
 * CALDRA VISION — GEOMETRY OPTIMIZER & CONVERGENCE CONTROLLER
 *
 * Executa as iterações de autocorreção local e global:
 * - Refino de extremidades e fechamento de gaps
 * - Fusão de microsegmentos colineares
 * - Eliminação de ruído residual
 * - Controle de estagnação e Backtracking para o melhor estado conhecido
 */

import type { Prim } from "../geometryRecognizer";
import { VectorRasterizer } from "./vectorRasterizer";
import { VectorComparisonEngine } from "./vectorComparisonEngine";
import type { ComparisonMetrics, IterationRecord, IterativeVisionOptions } from "./types";

export class GeometryOptimizer {
  /**
   * Executa uma passada de otimização local sobre a geometria atual.
   */
  static optimizeStep(
    prims: Prim[],
    referenceMask: Uint8Array,
    width: number,
    height: number,
    options: IterativeVisionOptions = {},
  ): {
    optimizedPrims: Prim[];
    comparison: ComparisonMetrics;
    score: number;
    visualScore: number;
    geometricScore: number;
  } {
    const coincTol = options.coincidenceTolerance ?? 3.0;

    // 1. Unifica segmentos colineares contíguos
    let current = this.mergeCollinearSegments(prims, 2.0);

    // 2. Fecha gaps entre extremidades próximas
    current = this.snapEndpoints(current, coincTol);

    // 3. Remove microsegmentos isolados de ruído (< 2px)
    current = this.removeMicroNoise(current, 2.0);

    // 4. Rasteriza e avalia a nova geometria
    const raster = VectorRasterizer.rasterize(current, width, height, 2);
    const comparison = VectorComparisonEngine.compare(referenceMask, raster, width, height);

    // Cálculo do score
    const visualScore = Math.min(1.0, comparison.iou * 1.25);
    const technicalCount = current.filter(
      (p) => p.kind === "line" || p.kind === "circle" || p.kind === "arc",
    ).length;
    const geometricScore = technicalCount / Math.max(1, current.length);
    const complexityScore = 1 / (1 + current.length * 0.003);

    const score = visualScore * 0.5 + geometricScore * 0.35 + complexityScore * 0.15;

    return {
      optimizedPrims: current,
      comparison,
      score,
      visualScore,
      geometricScore,
    };
  }

  /**
   * Fecha gaps entre extremidades de linhas adjacentes.
   */
  private static snapEndpoints(prims: Prim[], tol: number): Prim[] {
    const result = prims.map((p) => ({ ...p }));

    for (let i = 0; i < result.length; i++) {
      const p1 = result[i];
      if (p1.kind !== "line") continue;

      for (let j = i + 1; j < result.length; j++) {
        const p2 = result[j];
        if (p2.kind !== "line") continue;

        // p1.end com p2.start
        const d1 = Math.hypot(p1.x2 - p2.x1, p1.y2 - p2.y1);
        if (d1 > 0 && d1 <= tol) {
          const mx = (p1.x2 + p2.x1) * 0.5;
          const my = (p1.y2 + p2.y1) * 0.5;
          p1.x2 = mx;
          p1.y2 = my;
          p2.x1 = mx;
          p2.y1 = my;
        }

        // p1.end com p2.end
        const d2 = Math.hypot(p1.x2 - p2.x2, p1.y2 - p2.y2);
        if (d2 > 0 && d2 <= tol) {
          const mx = (p1.x2 + p2.x2) * 0.5;
          const my = (p1.y2 + p2.y2) * 0.5;
          p1.x2 = mx;
          p1.y2 = my;
          p2.x2 = mx;
          p2.y2 = my;
        }

        // p1.start com p2.start
        const d3 = Math.hypot(p1.x1 - p2.x1, p1.y1 - p2.y1);
        if (d3 > 0 && d3 <= tol) {
          const mx = (p1.x1 + p2.x1) * 0.5;
          const my = (p1.y1 + p2.y1) * 0.5;
          p1.x1 = mx;
          p1.y1 = my;
          p2.x1 = mx;
          p2.y1 = my;
        }
      }
    }

    return result;
  }

  /**
   * Une segmentos de reta colineares contíguos em uma única reta contínua.
   */
  private static mergeCollinearSegments(prims: Prim[], distTol: number): Prim[] {
    const lines = prims.filter((p) => p.kind === "line");
    const others = prims.filter((p) => p.kind !== "line");
    const mergedLines: Prim[] = [];
    const used = new Uint8Array(lines.length);

    for (let i = 0; i < lines.length; i++) {
      if (used[i]) continue;
      const l1 = lines[i];
      if (l1.kind !== "line") continue;

      let x1 = l1.x1;
      let y1 = l1.y1;
      let x2 = l1.x2;
      let y2 = l1.y2;
      used[i] = 1;

      let changed = true;
      while (changed) {
        changed = false;
        const baseAngle = Math.atan2(y2 - y1, x2 - x1);

        for (let j = 0; j < lines.length; j++) {
          if (used[j]) continue;
          const l2 = lines[j];
          if (l2.kind !== "line") continue;

          let diffAngle = Math.abs(Math.atan2(l2.y2 - l2.y1, l2.x2 - l2.x1) - baseAngle);
          while (diffAngle > Math.PI) diffAngle -= Math.PI;
          diffAngle = Math.abs(diffAngle);

          // Ângulos próximos (menos de 3°)
          if (diffAngle < 0.05 || Math.abs(diffAngle - Math.PI) < 0.05) {
            // Verifica conexão das pontas
            if (Math.hypot(x2 - l2.x1, y2 - l2.y1) <= distTol) {
              x2 = l2.x2;
              y2 = l2.y2;
              used[j] = 1;
              changed = true;
              break;
            } else if (Math.hypot(x2 - l2.x2, y2 - l2.y2) <= distTol) {
              x2 = l2.x1;
              y2 = l2.y1;
              used[j] = 1;
              changed = true;
              break;
            } else if (Math.hypot(x1 - l2.x2, y1 - l2.y2) <= distTol) {
              x1 = l2.x1;
              y1 = l2.y1;
              used[j] = 1;
              changed = true;
              break;
            } else if (Math.hypot(x1 - l2.x1, y1 - l2.y1) <= distTol) {
              x1 = l2.x2;
              y1 = l2.y2;
              used[j] = 1;
              changed = true;
              break;
            }
          }
        }
      }

      mergedLines.push({
        kind: "line",
        x1,
        y1,
        x2,
        y2,
        hole: l1.hole,
        quality: 0.95,
        status: "convertida",
      });
    }

    return [...mergedLines, ...others];
  }

  /**
   * Remove microsegmentos soltos menores que o limiar de ruído.
   */
  private static removeMicroNoise(prims: Prim[], minLengthPx: number): Prim[] {
    return prims.filter((p) => {
      if (p.kind === "line") {
        return Math.hypot(p.x2 - p.x1, p.y2 - p.y1) >= minLengthPx;
      }
      if (p.kind === "circle") {
        return p.r >= minLengthPx * 0.5;
      }
      return true;
    });
  }
}
