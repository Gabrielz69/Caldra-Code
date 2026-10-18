/**
 * qualityReport — confiança por entidade e pontuação geral da vetorização.
 *
 * DETECTADA  → primitiva encontrada diretamente (círculo completo, traço reto).
 * CONVERTIDA → ajustada dentro da tolerância (linha/arco por mínimos quadrados).
 * APROXIMADA → não coube em primitiva; virou polilinha no limite da tolerância.
 */

import type { Prim, PrimStatus } from "./geometryRecognizer";

export type QualityItem = {
  index: number;
  kind: Prim["kind"];
  status: PrimStatus;
  /** Desvio máximo entre a geometria e o traçado original, em mm. */
  devMm: number;
  /** Caixa da primitiva em pixels da imagem analisada — usada para "ir até". */
  box: { x: number; y: number; w: number; h: number };
};

export type QualityReport = {
  items: QualityItem[];
  low: QualityItem[];
  /** 0–100. */
  score: number;
  maxDevMm: number;
  avgDevMm: number;
  counts: Record<PrimStatus, number>;
};

function boxOf(p: Prim) {
  if (p.kind === "line")
    return {
      x: Math.min(p.x1, p.x2),
      y: Math.min(p.y1, p.y2),
      w: Math.abs(p.x2 - p.x1),
      h: Math.abs(p.y2 - p.y1),
    };
  if (p.kind === "polyline") {
    const xs = p.pts.map((q) => q.x);
    const ys = p.pts.map((q) => q.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: p.cx - p.r, y: p.cy - p.r, w: p.r * 2, h: p.r * 2 };
}

export function buildQuality(prims: Prim[], mmPerPx: number): QualityReport {
  const items: QualityItem[] = prims.map((p, index) => ({
    index,
    kind: p.kind,
    status: p.status ?? (p.kind === "polyline" ? "aproximada" : "convertida"),
    devMm: (p.dev ?? 0) * mmPerPx,
    box: boxOf(p),
  }));

  const counts: Record<PrimStatus, number> = { detectada: 0, convertida: 0, aproximada: 0 };
  for (const i of items) counts[i.status]++;

  const maxDevMm = items.reduce((m, i) => Math.max(m, i.devMm), 0);
  const avgDevMm = items.length ? items.reduce((s, i) => s + i.devMm, 0) / items.length : 0;

  // pontuação: penaliza aproximações e desvio médio relativo ao tamanho da peça
  let extent = 0;
  for (const i of items) extent = Math.max(extent, (i.box.w + i.box.h) * mmPerPx);
  const rel = extent > 0 ? avgDevMm / (extent * 0.5) : 0;
  const approxRatio = items.length ? counts.aproximada / items.length : 0;
  const score = items.length
    ? Math.max(0, Math.min(100, Math.round(100 - approxRatio * 45 - Math.min(45, rel * 900))))
    : 0;

  const low = items
    .filter((i) => i.status === "aproximada" || i.devMm >= maxDevMm * 0.75)
    .sort((a, b) => b.devMm - a.devMm)
    .slice(0, 12);

  return { items, low, score, maxDevMm, avgDevMm, counts };
}
