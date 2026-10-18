/**
 * CORTE COMUM (shared-line cutting).
 *
 * Peças vizinhas que dividem a mesma aresta têm essa aresta cortada UMA vez.
 * Este módulo é puro: detecta candidatos e devolve a geometria resultante —
 * quem confirma é o usuário, na interface. Nada é alterado sem confirmação.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, uid, type Entity } from "./core";

export type ShareTol = {
  /** Tolerância angular de colinearidade (graus). */
  angleDeg: number;
  /** Afastamento máximo entre as arestas (mm). */
  gapMm: number;
  /** Sobreposição mínima para valer a pena (mm). */
  minLenMm: number;
};

export const DEFAULT_SHARE_TOL: ShareTol = { angleDeg: 0.5, gapMm: 0.2, minLenMm: 1.0 };

export type ShareCandidate = {
  id: string;
  kind: "line" | "arc";
  aId: string;
  bId: string;
  /** Índice do segmento dentro da polilinha (0 em linhas). */
  aSeg: number;
  bSeg: number;
  /** Trecho comum reto. */
  p1: Vec2;
  p2: Vec2;
  /** Trecho comum em arco. */
  arc?: { cx: number; cy: number; r: number; a0: number; a1: number };
  length: number;
};

type Seg = { eid: string; index: number; a: Vec2; b: Vec2 };

const TAU = Math.PI * 2;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

function segmentsFor(e: Entity): Seg[] {
  if (e.type === "line")
    return [{ eid: e.id, index: 0, a: { x: e.x1, y: e.y1 }, b: { x: e.x2, y: e.y2 } }];
  if (e.type === "polyline") {
    const out: Seg[] = [];
    const n = e.pts.length;
    for (let i = 0; i < n - 1; i++)
      out.push({ eid: e.id, index: i, a: e.pts[i]!, b: e.pts[i + 1]! });
    if (e.closed && n > 2) out.push({ eid: e.id, index: n - 1, a: e.pts[n - 1]!, b: e.pts[0]! });
    return out;
  }
  return [];
}

/** Projeção escalar de p sobre a reta (o, d) normalizada. */
const proj = (p: Vec2, o: Vec2, d: Vec2) => (p.x - o.x) * d.x + (p.y - o.y) * d.y;

function lineCandidate(s1: Seg, s2: Seg, tol: ShareTol): ShareCandidate | null {
  const l1 = dist(s1.a, s1.b);
  const l2 = dist(s2.a, s2.b);
  if (l1 < 1e-6 || l2 < 1e-6) return null;
  const d1 = { x: (s1.b.x - s1.a.x) / l1, y: (s1.b.y - s1.a.y) / l1 };
  const d2 = { x: (s2.b.x - s2.a.x) / l2, y: (s2.b.y - s2.a.y) / l2 };
  const cosA = Math.abs(d1.x * d2.x + d1.y * d2.y);
  if (cosA < Math.cos((tol.angleDeg * Math.PI) / 180)) return null;

  // afastamento perpendicular entre as retas
  const nrm = { x: -d1.y, y: d1.x };
  const off1 = Math.abs((s2.a.x - s1.a.x) * nrm.x + (s2.a.y - s1.a.y) * nrm.y);
  const off2 = Math.abs((s2.b.x - s1.a.x) * nrm.x + (s2.b.y - s1.a.y) * nrm.y);
  if (off1 > tol.gapMm || off2 > tol.gapMm) return null;

  const t = [0, l1, proj(s2.a, s1.a, d1), proj(s2.b, s1.a, d1)];
  const lo = Math.max(Math.min(t[0]!, t[1]!), Math.min(t[2]!, t[3]!));
  const hi = Math.min(Math.max(t[0]!, t[1]!), Math.max(t[2]!, t[3]!));
  const overlap = hi - lo;
  if (overlap < tol.minLenMm) return null;

  return {
    id: uid(),
    kind: "line",
    aId: s1.eid,
    bId: s2.eid,
    aSeg: s1.index,
    bSeg: s2.index,
    p1: { x: s1.a.x + d1.x * lo, y: s1.a.y + d1.y * lo },
    p2: { x: s1.a.x + d1.x * hi, y: s1.a.y + d1.y * hi },
    length: overlap,
  };
}

function arcCandidate(
  a: Extract<Entity, { type: "arc" }>,
  b: Extract<Entity, { type: "arc" }>,
  tol: ShareTol,
): ShareCandidate | null {
  if (dist({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }) > tol.gapMm) return null;
  if (Math.abs(a.r - b.r) > tol.gapMm) return null;
  const span = (e: typeof a) => {
    const s = norm(e.a0);
    let w = norm(e.a1) - s;
    if (w <= 0) w += TAU;
    return { s, w };
  };
  const sa = span(a);
  const sb = span(b);
  // desloca b para o referencial de a e mede a interseção angular
  const delta = norm(sb.s - sa.s);
  const lo = Math.max(0, delta);
  const hi = Math.min(sa.w, delta + sb.w);
  const overlap = hi - lo;
  if (overlap <= 0 || overlap * a.r < tol.minLenMm) return null;
  return {
    id: uid(),
    kind: "arc",
    aId: a.id,
    bId: b.id,
    aSeg: 0,
    bSeg: 0,
    p1: { x: a.cx + a.r * Math.cos(sa.s + lo), y: a.cy + a.r * Math.sin(sa.s + lo) },
    p2: { x: a.cx + a.r * Math.cos(sa.s + hi), y: a.cy + a.r * Math.sin(sa.s + hi) },
    arc: { cx: a.cx, cy: a.cy, r: a.r, a0: sa.s + lo, a1: sa.s + hi },
    length: overlap * a.r,
  };
}

/**
 * Detecta trechos compartilhados entre caminhos de CORTE distintos.
 * Assíncrona e fatiada: mantém a interface viva com milhares de entidades.
 */
export async function detectSharedCuts(
  entities: Entity[],
  tol: ShareTol = DEFAULT_SHARE_TOL,
  onProgress?: (ratio: number) => void,
  shouldCancel?: () => boolean,
): Promise<ShareCandidate[]> {
  const cuts = entities.filter((e) => e.layer === "corte" && !e.shared);
  const segs = cuts.flatMap(segmentsFor);
  const arcs = cuts.filter((e) => e.type === "arc") as Extract<Entity, { type: "arc" }>[];

  // agrupamento por forma normal da reta: só pares plausíveis são comparados
  const buckets = new Map<string, Seg[]>();
  const cell = Math.max(tol.gapMm * 4, 1);
  const angStep = Math.max(tol.angleDeg, 0.1) * 2;
  for (const s of segs) {
    const l = dist(s.a, s.b);
    if (l < 1e-6) continue;
    const ang = norm(Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x)) % Math.PI;
    const nrm = { x: -(s.b.y - s.a.y) / l, y: (s.b.x - s.a.x) / l };
    const c = s.a.x * nrm.x + s.a.y * nrm.y;
    const ai = Math.round((ang * 180) / Math.PI / angStep);
    const ci = Math.round(Math.abs(c) / cell);
    for (const da of [-1, 0, 1])
      for (const dc of [-1, 0, 1]) {
        const key = `${ai + da}|${ci + dc}`;
        const list = buckets.get(key) ?? [];
        if (da === 0 && dc === 0) list.push(s);
        buckets.set(key, list);
      }
  }
  // segunda passada: cada segmento vê os vizinhos das 9 células
  const near = new Map<string, Seg[]>();
  for (const [key, list] of buckets) near.set(key, list);

  const found: ShareCandidate[] = [];
  const used = new Set<string>();
  const keys = [...near.keys()];
  let done = 0;
  for (const key of keys) {
    const list = near.get(key)!;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const s1 = list[i]!;
        const s2 = list[j]!;
        if (s1.eid === s2.eid) continue;
        const pairKey = [s1.eid + s1.index, s2.eid + s2.index].sort().join("~");
        if (used.has(pairKey)) continue;
        const c = lineCandidate(s1, s2, tol);
        if (c) {
          used.add(pairKey);
          found.push(c);
        }
      }
    done++;
    if (done % 40 === 0) {
      onProgress?.(done / keys.length);
      await new Promise((r) => setTimeout(r, 0));
      if (shouldCancel?.()) return found;
    }
  }

  for (let i = 0; i < arcs.length; i++)
    for (let j = i + 1; j < arcs.length; j++) {
      const c = arcCandidate(arcs[i]!, arcs[j]!, tol);
      if (c) found.push(c);
    }

  onProgress?.(1);
  return found.sort((a, b) => b.length - a.length);
}

/* -------------------------------------------------------------- aplicação */

/** Remove o intervalo [q1,q2] do segmento `index`, devolvendo o que sobra. */
function subtract(e: Entity, index: number, q1: Vec2, q2: Vec2): Entity[] {
  if (e.type === "line") {
    const a = { x: e.x1, y: e.y1 };
    const b = { x: e.x2, y: e.y2 };
    const l = dist(a, b) || 1;
    const d = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    const t1 = proj(q1, a, d);
    const t2 = proj(q2, a, d);
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    const out: Entity[] = [];
    if (lo > 0.01) out.push({ ...e, id: uid(), x2: a.x + d.x * lo, y2: a.y + d.y * lo });
    if (hi < l - 0.01) out.push({ ...e, id: uid(), x1: a.x + d.x * hi, y1: a.y + d.y * hi });
    return out;
  }
  if (e.type === "polyline") {
    const pts = [...e.pts];
    const n = pts.length;
    const a = pts[index]!;
    const b = pts[(index + 1) % n]!;
    const near1 = dist(a, q1) <= dist(a, q2) ? q1 : q2;
    const near2 = near1 === q1 ? q2 : q1;
    if (e.closed) {
      // caminho fechado vira aberto, começando depois do trecho comum
      const rest = [
        near2,
        ...Array.from({ length: n - 1 }, (_, k) => pts[(index + 1 + k) % n]!),
        near1,
      ].filter((p, i, arr) => i === 0 || dist(p, arr[i - 1]!) > 1e-6);
      return rest.length > 1 ? [{ ...e, id: uid(), closed: false, pts: rest }] : [];
    }
    const head = [...pts.slice(0, index + 1), near1].filter(
      (p, i, arr) => i === 0 || dist(p, arr[i - 1]!) > 1e-6,
    );
    const tail = [near2, ...pts.slice(index + 1)].filter(
      (p, i, arr) => i === 0 || dist(p, arr[i - 1]!) > 1e-6,
    );
    const out: Entity[] = [];
    if (head.length > 1) out.push({ ...e, id: uid(), closed: false, pts: head });
    if (tail.length > 1) out.push({ ...e, id: uid(), closed: false, pts: tail });
    return out;
  }
  return [e];
}

function subtractArc(e: Extract<Entity, { type: "arc" }>, a0: number, a1: number): Entity[] {
  const s = norm(e.a0);
  let w = norm(e.a1) - s;
  if (w <= 0) w += TAU;
  const lo = norm(a0 - s);
  const hi = lo + (norm(a1 - a0) || 0);
  const out: Entity[] = [];
  if (lo > 1e-4) out.push({ ...e, id: uid(), a0: s, a1: s + lo });
  if (hi < w - 1e-4) out.push({ ...e, id: uid(), a0: s + hi, a1: s + w });
  return out;
}

export type ShareResult = {
  entities: Entity[];
  applied: number;
  savedLength: number;
  savedPierces: number;
};

/** Aplica os candidatos confirmados: o trecho comum passa a existir uma vez. */
export function applySharedCuts(entities: Entity[], candidates: ShareCandidate[]): ShareResult {
  let list = [...entities];
  let applied = 0;
  let savedLength = 0;

  for (const c of candidates) {
    const a = list.find((e) => e.id === c.aId);
    const b = list.find((e) => e.id === c.bId);
    if (!a || !b) continue;

    const shared: Entity =
      c.kind === "arc" && c.arc
        ? {
            id: uid(),
            layer: "corte",
            type: "arc",
            cx: c.arc.cx,
            cy: c.arc.cy,
            r: c.arc.r,
            a0: c.arc.a0,
            a1: c.arc.a1,
            shared: true,
          }
        : {
            id: uid(),
            layer: "corte",
            type: "line",
            x1: c.p1.x,
            y1: c.p1.y,
            x2: c.p2.x,
            y2: c.p2.y,
            shared: true,
          };

    const restA =
      c.kind === "arc" && a.type === "arc" && c.arc
        ? subtractArc(a, c.arc.a0, c.arc.a1)
        : subtract(a, c.aSeg, c.p1, c.p2);
    const restB =
      c.kind === "arc" && b.type === "arc" && c.arc
        ? subtractArc(b, c.arc.a0, c.arc.a1)
        : subtract(b, c.bSeg, c.p1, c.p2);

    list = list.flatMap((e) =>
      e.id === c.aId ? restA : e.id === c.bId ? [...restB, shared] : [e],
    );
    applied++;
    savedLength += c.length;
  }

  return { entities: list, applied, savedLength, savedPierces: applied };
}

/**
 * Revalida trechos comuns após edição/movimento: um trecho que perdeu vizinhos
 * colados de ambos os lados é marcado como INVÁLIDO — nunca some em silêncio.
 */
export function revalidateShared(entities: Entity[], tol: ShareTol = DEFAULT_SHARE_TOL): Entity[] {
  const shared = entities.filter((e) => e.shared);
  if (!shared.length) return entities;
  const others = entities.filter((e) => e.layer === "corte" && !e.shared);
  const segs = others.flatMap(segmentsFor);
  return entities.map((e) => {
    if (!e.shared) return e;
    const ends =
      e.type === "line"
        ? [
            { x: e.x1, y: e.y1 },
            { x: e.x2, y: e.y2 },
          ]
        : e.type === "arc"
          ? [
              { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) },
              { x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) },
            ]
          : [];
    const owners = new Set<string>();
    for (const s of segs)
      for (const p of ends)
        if (Math.min(dist(s.a, p), dist(s.b, p)) <= Math.max(tol.gapMm * 5, 0.5)) owners.add(s.eid);
    const invalid = owners.size < 2;
    return invalid === !!e.invalid ? e : { ...e, invalid };
  });
}
