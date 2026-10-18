/**
 * PLANO DE CORTE — direção, ponto de partida e sequência.
 *
 * A SEQUÊNCIA é a própria ordem das entidades no array do plano: é assim que
 * o DXF é escrito, então o que se vê no painel é o que a máquina recebe.
 * A DIREÇÃO é a ordem dos vértices da entidade. Nada é armazenado à parte,
 * portanto undo/redo e autosave já cobrem o plano de corte.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { closestOnSegment, dist, segmentsOf, type Entity } from "./core";
import { reversePath } from "./bezier";

export const isCutPath = (e: Entity) => e.layer === "corte" && e.type !== "text";

/** Caminho fechado: círculo, polilinha/curva fechada. */
export const isClosedPath = (e: Entity) =>
  e.type === "circle" ||
  ((e.type === "polyline" || e.type === "path") && e.closed) ||
  e.type === "arc";

/** Comprimento de corte em mm. */
export function pathLength(e: Entity): number {
  if (e.type === "circle") return 2 * Math.PI * e.r;
  if (e.type === "arc") {
    let sweep = e.a1 - e.a0;
    while (sweep < 0) sweep += Math.PI * 2;
    return e.r * sweep;
  }
  return segmentsOf(e).reduce((acc, s) => acc + dist(s[0], s[1]), 0);
}

/** Ponto de partida (perfuração) do caminho. */
export function startPointOf(e: Entity): Vec2 {
  switch (e.type) {
    case "line":
      return { x: e.x1, y: e.y1 };
    case "polyline":
      return e.pts[0] ?? { x: 0, y: 0 };
    case "path":
      return e.start;
    case "circle":
      return { x: e.cx + e.r, y: e.cy };
    case "arc":
      return { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) };
    case "point":
      return { x: e.x, y: e.y };
    default:
      return { x: 0, y: 0 };
  }
}

/** Ponto final do caminho (igual à partida em caminhos fechados). */
export function endPointOf(e: Entity): Vec2 {
  switch (e.type) {
    case "line":
      return { x: e.x2, y: e.y2 };
    case "polyline":
      return e.closed ? (e.pts[0] ?? { x: 0, y: 0 }) : (e.pts[e.pts.length - 1] ?? { x: 0, y: 0 });
    case "path":
      return e.closed ? e.start : (e.segs[e.segs.length - 1]?.p ?? e.start);
    case "arc":
      return { x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) };
    default:
      return startPointOf(e);
  }
}

/** Inverte a direção do caminho (ordem dos vértices / ângulos do arco). */
export function reverseEntity(e: Entity): Entity {
  switch (e.type) {
    case "line":
      return { ...e, x1: e.x2, y1: e.y2, x2: e.x1, y2: e.y1 };
    case "polyline":
      return { ...e, pts: [...e.pts].reverse() };
    case "arc":
      return { ...e, a0: e.a1, a1: e.a0 };
    case "path": {
      const r = reversePath(e.start, e.segs, e.closed);
      return { ...e, start: r.start, segs: r.segs };
    }
    default:
      // CIRCLE e TEXT não carregam direção no DXF — sem efeito, sem erro.
      return e;
  }
}

/** Define o ponto de partida de um caminho fechado, preservando a direção. */
export function setStartPoint(e: Entity, p: Vec2): Entity {
  if (e.type === "polyline" && e.closed && e.pts.length > 2) {
    const pts = [...e.pts];
    // insere o ponto na aresta mais próxima quando não coincide com um vértice
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = dist(p, pts[i]!);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    if (bd > 1e-6) {
      let si = -1;
      let sd = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        const d = dist(p, closestOnSegment(p, [a, b]));
        if (d < sd) {
          sd = d;
          si = i;
        }
      }
      if (si >= 0 && sd < bd) {
        pts.splice(si + 1, 0, p);
        bi = si + 1;
      }
    }
    return { ...e, pts: [...pts.slice(bi), ...pts.slice(0, bi)] };
  }
  if (e.type === "circle") {
    const a = Math.atan2(p.y - e.cy, p.x - e.cx);
    // círculo não guarda partida no DXF; convertemos para polilinha fechada
    const n = 64;
    return {
      ...e,
      type: "polyline",
      closed: true,
      pts: Array.from({ length: n }, (_, i) => {
        const t = a + (i / n) * Math.PI * 2;
        return { x: e.cx + e.r * Math.cos(t), y: e.cy + e.r * Math.sin(t) };
      }),
    } as Entity;
  }
  return e;
}

/** Caminhos de corte na ordem atual do plano. */
export const cutPaths = (entities: Entity[]) => entities.filter(isCutPath);

/** Reescreve as posições dos caminhos de corte segundo `orderedIds`. */
export function applyCutOrder(entities: Entity[], orderedIds: string[]): Entity[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const queue = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Entity[];
  let k = 0;
  return entities.map((e) => (isCutPath(e) ? (queue[k++] ?? e) : e));
}

/** Move um caminho uma posição na sequência (dir: -1 sobe, +1 desce). */
export function moveCutPath(entities: Entity[], id: string, dir: -1 | 1): Entity[] {
  const ids = cutPaths(entities).map((e) => e.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return entities;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return applyCutOrder(entities, ids);
}

/** Move um bloco de ids (grupo) para antes da posição `target` na sequência. */
export function moveCutBlock(entities: Entity[], ids: string[], targetId: string): Entity[] {
  const order = cutPaths(entities).map((e) => e.id);
  const block = order.filter((id) => ids.includes(id));
  if (!block.length) return entities;
  const rest = order.filter((id) => !ids.includes(id));
  let at = rest.indexOf(targetId);
  if (at < 0) at = rest.length;
  return applyCutOrder(entities, [...rest.slice(0, at), ...block, ...rest.slice(at)]);
}

/**
 * Sugestão de sequência: guloso vizinho-mais-próximo a partir do ponto de
 * partida atual do primeiro caminho. Furos (caminhos internos) primeiro.
 */
export function suggestSequence(entities: Entity[]): Entity[] {
  const paths = cutPaths(entities);
  if (paths.length < 2) return entities;

  const box = (e: Entity) => {
    const pts = segmentsOf(e).flat();
    if (e.type === "circle" || e.type === "arc")
      return { minX: e.cx - e.r, minY: e.cy - e.r, maxX: e.cx + e.r, maxY: e.cy + e.r };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  };
  const boxes = new Map(paths.map((e) => [e.id, box(e)]));
  const containsCount = (e: Entity) => {
    const b = boxes.get(e.id)!;
    let n = 0;
    for (const o of paths) {
      if (o.id === e.id) continue;
      const ob = boxes.get(o.id)!;
      if (b.minX >= ob.minX && b.maxX <= ob.maxX && b.minY >= ob.minY && b.maxY <= ob.maxY) n++;
    }
    return n;
  };
  // mais "contido" = furo interno → cortado antes de liberar a peça
  const depth = new Map(paths.map((e) => [e.id, containsCount(e)]));

  const pending = [...paths].sort((a, b) => depth.get(b.id)! - depth.get(a.id)!);
  const out: Entity[] = [];
  let cur = startPointOf(pending[0]!);
  while (pending.length) {
    const level = depth.get(pending[0]!.id)!;
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pending.length; i++) {
      const e = pending[i]!;
      if (depth.get(e.id)! !== level) break;
      const d = dist(cur, startPointOf(e));
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const [picked] = pending.splice(bi, 1);
    out.push(picked!);
    cur = endPointOf(picked!);
  }
  return applyCutOrder(
    entities,
    out.map((e) => e.id),
  );
}

export type CutStats = { paths: number; totalLength: number; pierces: number };

export function cutStats(entities: Entity[]): CutStats {
  const paths = cutPaths(entities);
  return {
    paths: paths.length,
    totalLength: paths.reduce((acc, e) => acc + pathLength(e), 0),
    pierces: paths.length,
  };
}
