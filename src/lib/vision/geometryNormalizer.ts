/**
 * geometryNormalizer — limpeza final antes de entrar no CHAMFER.
 * Trabalha SEMPRE em milímetros, sobre entidades do modelo interno.
 */

import { dist, entityPoints, uid, type Entity } from "@/lib/lab2d/core";
import type { Vec2 } from "@/lib/geometry/types";

export type NormalizeReport = {
  removedTiny: number;
  removedDuplicates: number;
  mergedCollinear: number;
  closedGaps: number;
  nearlyClosed: { id: string; gapMm: number }[];
};

export type NormalizeOptions = {
  /** Comprimento mínimo aceitável (mm). */
  minLengthMm?: number;
  /** Tolerância para duplicados e fechamento (mm). */
  gapMm?: number;
  /** Fecha contornos automaticamente quando o gap é seguro. */
  autoClose?: boolean;
  /** Une segmentos colineares consecutivos. */
  mergeCollinear?: boolean;
};

const len = (e: Entity) => {
  if (e.type === "line") return Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
  if (e.type === "polyline") {
    let t = 0;
    for (let i = 1; i < e.pts.length; i++) t += dist(e.pts[i - 1]!, e.pts[i]!);
    return t;
  }
  if (e.type === "circle") return 2 * Math.PI * e.r;
  if (e.type === "arc") return e.r * Math.abs(e.a1 - e.a0);
  return 1;
};

function signature(e: Entity, q: number) {
  const r = (v: number) => Math.round(v / q);
  if (e.type === "line") {
    const a = [r(e.x1), r(e.y1)].join(",");
    const b = [r(e.x2), r(e.y2)].join(",");
    return `line:${[a, b].sort().join("|")}`;
  }
  if (e.type === "circle") return `circle:${r(e.cx)},${r(e.cy)},${r(e.r)}`;
  if (e.type === "arc") return `arc:${r(e.cx)},${r(e.cy)},${r(e.r)},${r(e.a0)},${r(e.a1)}`;
  if (e.type === "polyline")
    return `poly:${e.closed}:${e.pts.map((p) => `${r(p.x)},${r(p.y)}`).join(";")}`;
  return `text:${e.id}`;
}

/** Remove vértices colineares consecutivos de uma polilinha. */
function mergeCollinearPts(pts: Vec2[], tol: number) {
  if (pts.length < 3) return { pts, merged: 0 };
  const out: Vec2[] = [pts[0]!];
  let merged = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const cross = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    const base = Math.hypot(c.x - a.x, c.y - a.y) || 1;
    if (cross / base <= tol) {
      merged++;
      continue;
    }
    out.push(b);
  }
  out.push(pts[pts.length - 1]!);
  return { pts: out, merged };
}

export function normalizeGeometry(
  input: Entity[],
  opt: NormalizeOptions = {},
): { entities: Entity[]; report: NormalizeReport } {
  const minLength = opt.minLengthMm ?? 0.4;
  const gap = opt.gapMm ?? 0.8;
  const report: NormalizeReport = {
    removedTiny: 0,
    removedDuplicates: 0,
    mergedCollinear: 0,
    closedGaps: 0,
    nearlyClosed: [],
  };

  // 1) segmentos inválidos / minúsculos
  let list = input.filter((e) => {
    const ok =
      len(e) >= minLength &&
      entityPoints(e).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!ok) report.removedTiny++;
    return ok;
  });

  // 2) duplicados e sobreposições
  const seen = new Set<string>();
  list = list.filter((e) => {
    const sig = signature(e, gap);
    if (seen.has(sig)) {
      report.removedDuplicates++;
      return false;
    }
    seen.add(sig);
    return true;
  });

  // 3) colineares + fechamento de contorno
  list = list.map((e) => {
    if (e.type !== "polyline") return e;
    let pts = e.pts;
    if (opt.mergeCollinear !== false) {
      const m = mergeCollinearPts(pts, gap / 2);
      pts = m.pts;
      report.mergedCollinear += m.merged;
    }
    let closed = e.closed;
    if (!closed && pts.length > 2) {
      const g = dist(pts[0]!, pts[pts.length - 1]!);
      if (g <= gap) {
        if (opt.autoClose !== false) {
          closed = true;
          pts = pts.slice(0, -1);
          report.closedGaps++;
        } else report.nearlyClosed.push({ id: e.id, gapMm: g });
      } else if (g <= gap * 6) {
        report.nearlyClosed.push({ id: e.id, gapMm: g });
      }
    }
    return { ...e, pts, closed };
  });

  return { entities: list.map((e) => ({ ...e, id: e.id || uid() })), report };
}

/** Conta entidades duplicadas sem removê-las (pré-visualização). */
export function countDuplicates(list: Entity[], gapMm = 0.8) {
  const seen = new Set<string>();
  let dup = 0;
  for (const e of list) {
    const sig = signature(e, gapMm);
    if (seen.has(sig)) dup++;
    else seen.add(sig);
  }
  return dup;
}
