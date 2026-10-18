/**
 * bezier — suporte a curvas cúbicas no modelo interno do CHAMFER.
 *
 * Um caminho (`path`) é um ponto inicial seguido de segmentos cúbicos.
 * Segmentos retos são representados com `line: true` (os controles são
 * ignorados), o que mantém cantos vivos perfeitos sem virar polilinha.
 */

import type { Vec2 } from "@/lib/geometry/types";

export type BezierSeg = {
  /** Primeiro ponto de controle (ignorado quando `line`). */
  c1: Vec2;
  /** Segundo ponto de controle (ignorado quando `line`). */
  c2: Vec2;
  /** Ponto final do segmento. */
  p: Vec2;
  /** Segmento reto — canto vivo preservado. */
  line?: boolean;
};

const fx = (n: number) => (Math.abs(n) < 1e-9 ? "0" : Number(n.toFixed(4)).toString());

/** Pontos-âncora do caminho (início + fim de cada segmento). */
export function pathAnchors(start: Vec2, segs: BezierSeg[]): Vec2[] {
  return [start, ...segs.map((s) => s.p)];
}

/** Todos os pontos de controle reais (usado para estatística de peso). */
export function controlPointCount(segs: BezierSeg[]): number {
  return segs.reduce((n, s) => n + (s.line ? 1 : 3), 1);
}

export function cubicAt(p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

/** Amostra o caminho em pontos (para bbox, hit-test e achatamento opcional). */
export function samplePath(start: Vec2, segs: BezierSeg[], closed: boolean, perSeg = 12): Vec2[] {
  const out: Vec2[] = [start];
  let cur = start;
  for (const s of segs) {
    if (s.line) {
      out.push(s.p);
    } else {
      for (let i = 1; i <= perSeg; i++) out.push(cubicAt(cur, s.c1, s.c2, s.p, i / perSeg));
    }
    cur = s.p;
  }
  if (closed && out.length > 1) out.push(start);
  return out;
}

/** Segmentos retos equivalentes — alimenta snap, trim e verificação. */
export function pathSegments(start: Vec2, segs: BezierSeg[], closed: boolean): [Vec2, Vec2][] {
  const pts = samplePath(start, segs, closed, 8);
  const out: [Vec2, Vec2][] = [];
  for (let i = 0; i < pts.length - 1; i++) out.push([pts[i]!, pts[i + 1]!]);
  return out;
}

/** Aplica uma transformação a todos os pontos do caminho. */
export function mapPath(
  start: Vec2,
  segs: BezierSeg[],
  f: (p: Vec2) => Vec2,
): { start: Vec2; segs: BezierSeg[] } {
  return {
    start: f(start),
    segs: segs.map((s) => ({ ...s, c1: f(s.c1), c2: f(s.c2), p: f(s.p) })),
  };
}

/** Caminho SVG nativo — curva de verdade, sem achatar. */
export function pathToSvg(start: Vec2, segs: BezierSeg[], closed: boolean): string {
  let d = `M ${fx(start.x)} ${fx(start.y)}`;
  for (const s of segs) {
    d += s.line
      ? ` L ${fx(s.p.x)} ${fx(s.p.y)}`
      : ` C ${fx(s.c1.x)} ${fx(s.c1.y)} ${fx(s.c2.x)} ${fx(s.c2.y)} ${fx(s.p.x)} ${fx(s.p.y)}`;
  }
  return closed ? `${d} Z` : d;
}

/** Comprimento aproximado do caminho (mm). */
export function pathLength(start: Vec2, segs: BezierSeg[], closed: boolean): number {
  const pts = samplePath(start, segs, closed, 16);
  let l = 0;
  for (let i = 0; i < pts.length - 1; i++)
    l += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
  return l;
}

/** Área fechada aproximada (mm²). */
export function pathArea(start: Vec2, segs: BezierSeg[]): number {
  const pts = samplePath(start, segs, false, 16);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/**
 * Detecta caminho circular: se todos os pontos amostrados ficam a uma
 * distância constante do centroide dentro da tolerância, vira CIRCLE.
 */
export function circleFromPath(
  start: Vec2,
  segs: BezierSeg[],
  tol: number,
): { cx: number; cy: number; r: number } | null {
  const pts = samplePath(start, segs, false, 8);
  if (pts.length < 8) return null;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  let r = 0;
  for (const p of pts) r += Math.hypot(p.x - cx, p.y - cy);
  r /= pts.length;
  if (r <= 0) return null;
  for (const p of pts) if (Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) > tol) return null;
  return { cx, cy, r };
}

/** Converte um caminho em polilinha (achatamento opcional na exportação). */
export function flattenPath(start: Vec2, segs: BezierSeg[], closed: boolean, perSeg = 16): Vec2[] {
  const pts = samplePath(start, segs, false, perSeg);
  return closed ? pts : pts;
}

/** Inverte o sentido do caminho, preservando cantos vivos e curvatura. */
export function reversePath(
  start: Vec2,
  segs: BezierSeg[],
  closed: boolean,
): { start: Vec2; segs: BezierSeg[] } {
  if (!segs.length) return { start, segs };
  const anchors = pathAnchors(start, segs);
  const out: BezierSeg[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i]!;
    const from = anchors[i]!;
    out.push({ c1: s.c2, c2: s.c1, p: from, ...(s.line === undefined ? {} : { line: s.line }) });
  }
  void closed;
  return { start: anchors[anchors.length - 1]!, segs: out };
}
