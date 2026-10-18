/**
 * manualTracer — vetorização MANUAL do CHAMFER VISION.
 *
 * O usuário marca pontos sobre a imagem; cada forma vira ENTIDADE REAL do
 * modelo interno (LINE / POLYLINE / ARC), já convertida para mm.
 * Nada aqui depende do React.
 */

import { uid, type Entity } from "@/lib/lab2d/core";
import type { Prim } from "./geometryRecognizer";
import type { PxPoint } from "./visionEngine";

export type ManualShape =
  { kind: "poly"; pts: PxPoint[]; closed: boolean } | { kind: "arc"; pts: PxPoint[] };

export type ManualState = {
  shapes: ManualShape[];
  mode: "linha" | "arco";
  /** Pontos do arco em construção (0–2). */
  pending: PxPoint[];
};

export const EMPTY_MANUAL: ManualState = { shapes: [], mode: "linha", pending: [] };

export function manualPointCount(s: ManualState) {
  return s.shapes.reduce((n, sh) => n + sh.pts.length, 0) + s.pending.length;
}

/** Todos os nós editáveis, com endereço para arraste. */
export function manualNodes(s: ManualState): { shape: number; index: number; p: PxPoint }[] {
  const out: { shape: number; index: number; p: PxPoint }[] = [];
  s.shapes.forEach((sh, si) => sh.pts.forEach((p, i) => out.push({ shape: si, index: i, p })));
  s.pending.forEach((p, i) => out.push({ shape: -1, index: i, p }));
  return out;
}

/** Adiciona um ponto respeitando o modo ativo. */
export function addManualPoint(s: ManualState, p: PxPoint): ManualState {
  if (s.mode === "arco") {
    const pending = [...s.pending, p];
    if (pending.length < 3) return { ...s, pending };
    return { ...s, pending: [], shapes: [...s.shapes, { kind: "arc", pts: pending }] };
  }
  const last = s.shapes[s.shapes.length - 1];
  if (last && last.kind === "poly" && !last.closed)
    return {
      ...s,
      shapes: [...s.shapes.slice(0, -1), { ...last, pts: [...last.pts, p] }],
    };
  return { ...s, shapes: [...s.shapes, { kind: "poly", pts: [p], closed: false }] };
}

/** Fecha o contorno em construção (último ponto liga ao primeiro). */
export function closeManualContour(s: ManualState): ManualState {
  const last = s.shapes[s.shapes.length - 1];
  if (!last || last.kind !== "poly" || last.pts.length < 3) return s;
  return { ...s, shapes: [...s.shapes.slice(0, -1), { ...last, closed: true }] };
}

/** Remove o último ponto marcado. */
export function removeLastManualPoint(s: ManualState): ManualState {
  if (s.pending.length) return { ...s, pending: s.pending.slice(0, -1) };
  const last = s.shapes[s.shapes.length - 1];
  if (!last) return s;
  const pts = last.pts.slice(0, -1);
  if (!pts.length) return { ...s, shapes: s.shapes.slice(0, -1) };
  return {
    ...s,
    shapes: [...s.shapes.slice(0, -1), { ...last, pts } as ManualShape],
  };
}

export function moveManualNode(
  s: ManualState,
  shape: number,
  index: number,
  p: PxPoint,
): ManualState {
  if (shape < 0) {
    const pending = s.pending.slice();
    pending[index] = p;
    return { ...s, pending };
  }
  const shapes = s.shapes.slice();
  const sh = shapes[shape];
  if (!sh) return s;
  const pts = sh.pts.slice();
  pts[index] = p;
  shapes[shape] = { ...sh, pts } as ManualShape;
  return { ...s, shapes };
}

/* ------------------------------------------------------------------ snap */

/** Extremidades das primitivas já reconhecidas — alvos de captura. */
export function snapTargets(prims: Prim[]): PxPoint[] {
  const out: PxPoint[] = [];
  for (const p of prims) {
    if (p.kind === "line") out.push({ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 });
    else if (p.kind === "polyline") {
      const a = p.pts[0];
      const b = p.pts[p.pts.length - 1];
      if (a) out.push(a);
      if (b) out.push(b);
    } else if (p.kind === "arc") {
      out.push(
        { x: p.cx + p.r * Math.cos(p.a0), y: p.cy + p.r * Math.sin(p.a0) },
        { x: p.cx + p.r * Math.cos(p.a1), y: p.cy + p.r * Math.sin(p.a1) },
      );
    } else out.push({ x: p.cx, y: p.cy });
  }
  return out;
}

export function snapPoint(p: PxPoint, targets: PxPoint[], tolPx: number): PxPoint {
  let best: PxPoint | null = null;
  let bd = tolPx;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d <= bd) {
      bd = d;
      best = t;
    }
  }
  return best ?? p;
}

/* -------------------------------------------------------------- geometria */

/** Arco por 3 pontos: centro, raio e ângulos no sentido do traçado. */
export function arcFrom3Points(a: PxPoint, b: PxPoint, c: PxPoint) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const ua = a.x * a.x + a.y * a.y;
  const ub = b.x * b.x + b.y * b.y;
  const uc = c.x * c.x + c.y * c.y;
  const cx = (ua * (b.y - c.y) + ub * (c.y - a.y) + uc * (a.y - b.y)) / d;
  const cy = (ua * (c.x - b.x) + ub * (a.x - c.x) + uc * (b.x - a.x)) / d;
  const r = Math.hypot(a.x - cx, a.y - cy);
  const ang = (p: PxPoint) => Math.atan2(p.y - cy, p.x - cx);
  const a0 = ang(a);
  const am = ang(b);
  const a1 = ang(c);
  const norm = (v: number) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // sentido anti-horário se o ponto médio estiver entre início e fim
  const ccw = norm(am - a0) < norm(a1 - a0);
  return ccw ? { cx, cy, r, a0, a1 } : { cx, cy, r, a0: a1, a1: a0 };
}

export type ManualToEntitiesOptions = {
  /** mm por pixel. */
  mmPerPx: number;
  /** Origem do conteúdo em px (mesma referência do `toEntities`). */
  origin: PxPoint;
  layer?: string;
};

export function manualToEntities(s: ManualState, opt: ManualToEntitiesOptions): Entity[] {
  const layer = opt.layer ?? "corte";
  const k = opt.mmPerPx;
  const mx = (x: number) => (x - opt.origin.x) * k;
  const my = (y: number) => (y - opt.origin.y) * k;
  const out: Entity[] = [];

  for (const sh of s.shapes) {
    if (sh.kind === "arc") {
      const [a, b, c] = sh.pts;
      if (!a || !b || !c) continue;
      const fit = arcFrom3Points(a, b, c);
      if (!fit) {
        out.push({
          id: uid(),
          layer,
          type: "line",
          x1: mx(a.x),
          y1: my(a.y),
          x2: mx(c.x),
          y2: my(c.y),
        });
        continue;
      }
      out.push({
        id: uid(),
        layer,
        type: "arc",
        cx: mx(fit.cx),
        cy: my(fit.cy),
        r: fit.r * k,
        a0: fit.a0,
        a1: fit.a1,
      });
      continue;
    }
    if (sh.pts.length < 2) continue;
    if (sh.pts.length === 2 && !sh.closed) {
      const [a, b] = sh.pts as [PxPoint, PxPoint];
      out.push({
        id: uid(),
        layer,
        type: "line",
        x1: mx(a.x),
        y1: my(a.y),
        x2: mx(b.x),
        y2: my(b.y),
      });
      continue;
    }
    out.push({
      id: uid(),
      layer,
      type: "polyline",
      closed: sh.closed,
      pts: sh.pts.map((p) => ({ x: mx(p.x), y: my(p.y) })),
    });
  }
  return out;
}
