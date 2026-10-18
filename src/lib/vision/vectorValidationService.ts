/**
 * vectorValidationService — validação final antes de "CRIAR GEOMETRIA".
 */

import { dist, type Entity } from "@/lib/lab2d/core";
import type { Calibration } from "./scaleCalibrationService";

export type ValidationIssueV = { level: "ok" | "warn"; message: string; entityId?: string };

export type ValidationReport = {
  counts: { lines: number; circles: number; arcs: number; polylines: number; closed: number };
  bounds: { widthMm: number; heightMm: number };
  issues: ValidationIssueV[];
  ok: boolean;
};

export function validateVector(entities: Entity[], cal: Calibration): ValidationReport {
  const counts = {
    lines: entities.filter((e) => e.type === "line").length,
    circles: entities.filter((e) => e.type === "circle").length,
    arcs: entities.filter((e) => e.type === "arc").length,
    polylines: entities.filter((e) => e.type === "polyline").length,
    closed: entities.filter((e) => e.type === "polyline" && e.closed).length,
  };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const put = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const e of entities) {
    if (e.type === "line") {
      put(e.x1, e.y1);
      put(e.x2, e.y2);
    } else if (e.type === "polyline") for (const p of e.pts) put(p.x, p.y);
    else if (e.type === "circle" || e.type === "arc") {
      put(e.cx - e.r, e.cy - e.r);
      put(e.cx + e.r, e.cy + e.r);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = maxX = minY = maxY = 0;
  }

  const issues: ValidationIssueV[] = [];
  if (!entities.length) issues.push({ level: "warn", message: "Nenhuma geometria reconhecida." });
  if (cal.method === "padrao")
    issues.push({ level: "warn", message: "Escala não calibrada — 1 px = 1 mm." });

  for (const e of entities) {
    if (e.type === "polyline" && !e.closed && e.pts.length > 2) {
      const g = dist(e.pts[0]!, e.pts[e.pts.length - 1]!);
      if (g < 3)
        issues.push({
          level: "warn",
          message: `Contorno quase fechado (${g.toFixed(2)} mm).`,
          entityId: e.id,
        });
    }
    if (e.type === "circle" && e.r < 0.5)
      issues.push({
        level: "warn",
        message: "Círculo muito pequeno — possível ruído.",
        entityId: e.id,
      });
  }

  return {
    counts,
    bounds: { widthMm: maxX - minX, heightMm: maxY - minY },
    issues,
    ok: issues.every((i) => i.level === "ok"),
  };
}
