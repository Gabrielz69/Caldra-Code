/**
 * Índice espacial (grade uniforme) do CHAMFER.
 *
 * Reconstruído apenas quando a geometria muda. Serve a dois consumidores:
 * culling da renderização (só desenha o que intersecta a viewport) e
 * hit-test/snap (nunca varre todas as entidades).
 */

import { boxOf, overlaps, type Box, type Entity } from "./core";

export type SpatialIndex = {
  /** Entidades cuja caixa intersecta a caixa consultada. */
  query: (b: Box) => Entity[];
  /** Todas as entidades indexadas, na ordem original. */
  items: Entity[];
  /** Caixa de cada entidade (evita recalcular no render). */
  boxOfId: (id: string) => Box | undefined;
  size: number;
};

const EMPTY: Entity[] = [];

export function buildIndex(entities: Entity[]): SpatialIndex {
  const boxes = new Map<string, Box>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const e of entities) {
    const b = boxOf(e);
    boxes.set(e.id, b);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  if (!entities.length || !Number.isFinite(minX)) {
    return {
      query: () => EMPTY,
      items: entities,
      boxOfId: (id) => boxes.get(id),
      size: 0,
    };
  }

  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  // ~n células para n entidades, limitado para não estourar memória
  const cols = Math.max(1, Math.min(256, Math.round(Math.sqrt(entities.length))));
  const cw = w / cols;
  const ch = h / cols;

  const cells = new Map<number, Entity[]>();
  const key = (cx: number, cy: number) => cy * 1024 + cx;
  const clamp = (v: number) => Math.max(0, Math.min(cols - 1, v));

  for (const e of entities) {
    const b = boxes.get(e.id)!;
    const x0 = clamp(Math.floor((b.minX - minX) / cw));
    const x1 = clamp(Math.floor((b.maxX - minX) / cw));
    const y0 = clamp(Math.floor((b.minY - minY) / ch));
    const y1 = clamp(Math.floor((b.maxY - minY) / ch));
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const k = key(cx, cy);
        const bucket = cells.get(k);
        if (bucket) bucket.push(e);
        else cells.set(k, [e]);
      }
  }

  const query = (q: Box): Entity[] => {
    // Para desenhos técnicos com até 150 entidades, teste direto de overlaps sem quantização de células
    if (entities.length <= 150) {
      return entities.filter((e) => {
        const b = boxes.get(e.id);
        return b ? overlaps(b, q) : true;
      });
    }

    const x0 = clamp(Math.floor((q.minX - minX) / cw));
    const x1 = clamp(Math.floor((q.maxX - minX) / cw));
    const y0 = clamp(Math.floor((q.minY - minY) / ch));
    const y1 = clamp(Math.floor((q.maxY - minY) / ch));
    const seen = new Set<string>();
    const out: Entity[] = [];
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = cells.get(key(cx, cy));
        if (!bucket) continue;
        for (const e of bucket) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          const b = boxes.get(e.id);
          if (b && overlaps(b, q)) out.push(e);
        }
      }
    return out;
  };

  return { query, items: entities, boxOfId: (id) => boxes.get(id), size: entities.length };
}

/** Caixa do mundo correspondente à viewport atual, com margem em px de tela. */
export function viewportBox(
  view: { tx: number; ty: number; k: number },
  width: number,
  height: number,
  marginPx = 64,
): Box {
  const safeK = Number.isFinite(view.k) && view.k > 0 ? view.k : 1;
  const safeTx = Number.isFinite(view.tx) ? view.tx : 0;
  const safeTy = Number.isFinite(view.ty) ? view.ty : 0;
  const safeW = Number.isFinite(width) && width > 0 ? width : 800;
  const safeH = Number.isFinite(height) && height > 0 ? height : 600;

  const toWorldX = (px: number) => (px - safeTx) / safeK;
  const toWorldY = (py: number) => (py - safeTy) / safeK;
  const x1 = toWorldX(-marginPx);
  const x2 = toWorldX(safeW + marginPx);
  const y1 = toWorldY(-marginPx);
  const y2 = toWorldY(safeH + marginPx);
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  };
}
