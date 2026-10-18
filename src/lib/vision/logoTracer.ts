/**
 * logoTracer — motor de traçado por curvas (algoritmo Potrace, port em TS).
 *
 * Entrada: máscara binária. Saída: contornos como curvas de Bézier cúbicas
 * com hierarquia externo/interno. Nada aqui é amostrado em polilinha: a
 * fidelidade do modo LOGO vem de manter as curvas como curvas.
 *
 * Baseado no algoritmo Potrace de Peter Selinger (licença permissiva).
 */

import type { BezierSeg } from "@/lib/lab2d/bezier";
import type { Binary } from "./imagePreprocessor";

export type TurnPolicy = "black" | "white" | "left" | "right" | "minority" | "majority";

export type TraceOptions = {
  /** Descarta manchas com área menor que este valor (px). */
  turdsize: number;
  /** Suavidade dos cantos: menor preserva mais cantos vivos. */
  alphamax: number;
  /** Tolerância da otimização de curvas: menor = mais fiel. */
  opttolerance: number;
  /** Resolve ambiguidade nas junções. */
  turnpolicy: TurnPolicy;
  /** Liga a otimização de curvas (junta segmentos compatíveis). */
  optimize?: boolean;
};

export const DEFAULT_TRACE: TraceOptions = {
  turdsize: 3,
  alphamax: 1.0,
  opttolerance: 0.2,
  turnpolicy: "minority",
  optimize: true,
};

export type TracedPath = {
  /** Ponto inicial em pixels. */
  start: { x: number; y: number };
  segs: BezierSeg[];
  /** Contorno interno (furo de letra, ilha). */
  hole: boolean;
  /** Índice do contorno externo que contém este furo. */
  parent: number | null;
  /** Área absoluta em px². */
  area: number;
};

/* --------------------------------------------------------------- estruturas */

type P = { x: number; y: number };
const pt = (x = 0, y = 0): P => ({ x, y });

type Sum = { x: number; y: number; xy: number; x2: number; y2: number };

type Curve = {
  n: number;
  tag: ("CURVE" | "CORNER")[];
  c: P[];
  alphaCurve: number;
  vertex: P[];
  alpha: number[];
  alpha0: number[];
  beta: number[];
};

const newCurve = (n: number): Curve => ({
  n,
  tag: new Array<"CURVE" | "CORNER">(n),
  c: new Array<P>(n * 3),
  alphaCurve: 0,
  vertex: new Array<P>(n),
  alpha: new Array<number>(n),
  alpha0: new Array<number>(n),
  beta: new Array<number>(n),
});

type Path = {
  area: number;
  len: number;
  pt: P[];
  sign: "+" | "-";
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  x0: number;
  y0: number;
  sums: Sum[];
  lon: number[];
  m: number;
  po: number[];
  curve: Curve;
};

const newPath = (): Path => ({
  area: 0,
  len: 0,
  pt: [],
  sign: "+",
  minX: 100000,
  minY: 100000,
  maxX: -1,
  maxY: -1,
  x0: 0,
  y0: 0,
  sums: [],
  lon: [],
  m: 0,
  po: [],
  curve: newCurve(0),
});

/* ------------------------------------------------------------- utilidades */

const mod = (a: number, n: number) => (a >= n ? a % n : a >= 0 ? a : n - 1 - ((-1 - a) % n));
const xprod = (a: P, b: P) => a.x * b.y - a.y * b.x;
const cyclic = (a: number, b: number, c: number) => (a <= c ? a <= b && b < c : a <= b || b < c);
const sign = (i: number) => (i > 0 ? 1 : i < 0 ? -1 : 0);
const interval = (l: number, a: P, b: P) => pt(a.x + l * (b.x - a.x), a.y + l * (b.y - a.y));
const dorthInfty = (p0: P, p2: P) => pt(-sign(p2.y - p0.y), sign(p2.x - p0.x));
const dpara = (p0: P, p1: P, p2: P) =>
  (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
const ddenom = (p0: P, p2: P) => {
  const r = dorthInfty(p0, p2);
  return r.y * (p2.x - p0.x) - r.x * (p2.y - p0.y);
};
const cprod = (p0: P, p1: P, p2: P, p3: P) =>
  (p1.x - p0.x) * (p3.y - p2.y) - (p3.x - p2.x) * (p1.y - p0.y);
const iprod = (p0: P, p1: P, p2: P) =>
  (p1.x - p0.x) * (p2.x - p0.x) + (p1.y - p0.y) * (p2.y - p0.y);
const iprod1 = (p0: P, p1: P, p2: P, p3: P) =>
  (p1.x - p0.x) * (p3.x - p2.x) + (p1.y - p0.y) * (p3.y - p2.y);
const ddist = (p: P, q: P) => Math.hypot(p.x - q.x, p.y - q.y);

function bezierAt(t: number, p0: P, p1: P, p2: P, p3: P): P {
  const s = 1 - t;
  return pt(
    s * s * s * p0.x + 3 * (s * s * t) * p1.x + 3 * (t * t * s) * p2.x + t * t * t * p3.x,
    s * s * s * p0.y + 3 * (s * s * t) * p1.y + 3 * (t * t * s) * p2.y + t * t * t * p3.y,
  );
}

function tangent(p0: P, p1: P, p2: P, p3: P, q0: P, q1: P) {
  const A = cprod(p0, p1, q0, q1);
  const B = cprod(p1, p2, q0, q1);
  const C = cprod(p2, p3, q0, q1);
  const a = A - 2 * B + C;
  const b = -2 * A + 2 * B;
  const c = A;
  const d = b * b - 4 * a * c;
  if (a === 0 || d < 0) return -1;
  const s = Math.sqrt(d);
  const r1 = (-b + s) / (2 * a);
  const r2 = (-b - s) / (2 * a);
  if (r1 >= 0 && r1 <= 1) return r1;
  if (r2 >= 0 && r2 <= 1) return r2;
  return -1;
}

const quadform = (q: number[], w: P) => {
  const v = [w.x, w.y, 1];
  let sum = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) sum += v[i]! * q[i * 3 + j]! * v[j]!;
  return sum;
};

/* ------------------------------------------------------------ etapa 1: paths */

function bmToPathlist(bin: Binary, opt: TraceOptions): Path[] {
  const w = bin.width;
  const h = bin.height;
  const src = bin.data;
  const work = Uint8Array.from(src);
  const at = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && work[y * w + x] === 1;
  const atSrc = (x: number, y: number) =>
    x >= 0 && x < w && y >= 0 && y < h && src[y * w + x] === 1;
  const paths: Path[] = [];

  const findNext = (from: P): P | null => {
    let i = w * from.y + from.x;
    while (i < work.length && work[i] !== 1) i++;
    return i < work.length ? pt(i % w, Math.floor(i / w)) : null;
  };

  const majority = (x: number, y: number) => {
    for (let i = 2; i < 5; i++) {
      let ct = 0;
      for (let a = -i + 1; a <= i - 1; a++) {
        ct += at(x + a, y + i - 1) ? 1 : -1;
        ct += at(x + i - 1, y + a + 1) ? 1 : -1;
        ct += at(x + a - 1, y - i) ? 1 : -1;
        ct += at(x - i, y + a) ? 1 : -1;
      }
      if (ct > 0) return 1;
      if (ct < 0) return 0;
    }
    return 0;
  };

  const findPath = (start: P): Path => {
    const path = newPath();
    let x = start.x;
    let y = start.y;
    let dirx = 0;
    let diry = 1;
    path.sign = atSrc(start.x, start.y) ? "+" : "-";
    for (;;) {
      path.pt.push(pt(x, y));
      if (x > path.maxX) path.maxX = x;
      if (x < path.minX) path.minX = x;
      if (y > path.maxY) path.maxY = y;
      if (y < path.minY) path.minY = y;
      path.len++;
      x += dirx;
      y += diry;
      path.area -= x * diry;
      if (x === start.x && y === start.y) break;
      const l = at(x + (dirx + diry - 1) / 2, y + (diry - dirx - 1) / 2);
      const r = at(x + (dirx - diry - 1) / 2, y + (diry + dirx - 1) / 2);
      if (r && !l) {
        const turnRight =
          opt.turnpolicy === "right" ||
          (opt.turnpolicy === "black" && path.sign === "+") ||
          (opt.turnpolicy === "white" && path.sign === "-") ||
          (opt.turnpolicy === "majority" && majority(x, y) === 1) ||
          (opt.turnpolicy === "minority" && majority(x, y) === 0);
        if (turnRight) {
          const t = dirx;
          dirx = -diry;
          diry = t;
        } else {
          const t = dirx;
          dirx = diry;
          diry = -t;
        }
      } else if (r) {
        const t = dirx;
        dirx = -diry;
        diry = t;
      } else if (!l) {
        const t = dirx;
        dirx = diry;
        diry = -t;
      }
    }
    return path;
  };

  const xorPath = (path: Path) => {
    let y1 = path.pt[0]!.y;
    for (let i = 1; i < path.len; i++) {
      const x = path.pt[i]!.x;
      const y = path.pt[i]!.y;
      if (y !== y1) {
        const minY = y1 < y ? y1 : y;
        for (let j = x; j < path.maxX; j++) {
          const idx = minY * w + j;
          work[idx] = work[idx] ? 0 : 1;
        }
        y1 = y;
      }
    }
  };

  let cursor: P | null = pt(0, 0);
  let guard = 0;
  while ((cursor = findNext(cursor)) && guard++ < 20000) {
    const path = findPath(cursor);
    xorPath(path);
    if (path.area > opt.turdsize) paths.push(path);
  }
  return paths;
}

/* --------------------------------------------------------- etapa 2: curvas */

function calcSums(path: Path) {
  path.x0 = path.pt[0]!.x;
  path.y0 = path.pt[0]!.y;
  const s: Sum[] = [{ x: 0, y: 0, xy: 0, x2: 0, y2: 0 }];
  for (let i = 0; i < path.len; i++) {
    const x = path.pt[i]!.x - path.x0;
    const y = path.pt[i]!.y - path.y0;
    const p = s[i]!;
    s.push({ x: p.x + x, y: p.y + y, xy: p.xy + x * y, x2: p.x2 + x * x, y2: p.y2 + y * y });
  }
  path.sums = s;
}

function calcLon(path: Path) {
  const n = path.len;
  const p = path.pt;
  const pivk: number[] = [];
  const nc: number[] = [];
  const ct = [0, 0, 0, 0];
  path.lon = [];
  const constraint = [pt(), pt()];
  const cur = pt();
  const off = pt();
  const dk = pt();
  let k = 0;

  for (let i = n - 1; i >= 0; i--) {
    if (p[i]!.x !== p[k]!.x && p[i]!.y !== p[k]!.y) k = i + 1;
    nc[i] = k;
  }

  for (let i = n - 1; i >= 0; i--) {
    ct[0] = ct[1] = ct[2] = ct[3] = 0;
    let dir = (3 + 3 * (p[mod(i + 1, n)]!.x - p[i]!.x) + (p[mod(i + 1, n)]!.y - p[i]!.y)) / 2;
    ct[dir]!++;
    constraint[0]!.x = 0;
    constraint[0]!.y = 0;
    constraint[1]!.x = 0;
    constraint[1]!.y = 0;
    k = nc[i]!;
    let k1 = i;
    let foundk = false;
    for (;;) {
      dir = (3 + 3 * sign(p[k]!.x - p[k1]!.x) + sign(p[k]!.y - p[k1]!.y)) / 2;
      ct[dir] = (ct[dir] ?? 0) + 1;
      if (ct[0] && ct[1] && ct[2] && ct[3]) {
        pivk[i] = k1;
        foundk = true;
        break;
      }
      cur.x = p[k]!.x - p[i]!.x;
      cur.y = p[k]!.y - p[i]!.y;
      if (xprod(constraint[0]!, cur) < 0 || xprod(constraint[1]!, cur) > 0) break;
      if (!(Math.abs(cur.x) <= 1 && Math.abs(cur.y) <= 1)) {
        off.x = cur.x + (cur.y >= 0 && (cur.y > 0 || cur.x < 0) ? 1 : -1);
        off.y = cur.y + (cur.x <= 0 && (cur.x < 0 || cur.y < 0) ? 1 : -1);
        if (xprod(constraint[0]!, off) >= 0) {
          constraint[0]!.x = off.x;
          constraint[0]!.y = off.y;
        }
        off.x = cur.x + (cur.y <= 0 && (cur.y < 0 || cur.x < 0) ? 1 : -1);
        off.y = cur.y + (cur.x >= 0 && (cur.x > 0 || cur.y < 0) ? 1 : -1);
        if (xprod(constraint[1]!, off) <= 0) {
          constraint[1]!.x = off.x;
          constraint[1]!.y = off.y;
        }
      }
      k1 = k;
      k = nc[k1]!;
      if (!cyclic(k, i, k1)) break;
    }
    if (!foundk) {
      dk.x = sign(p[k]!.x - p[k1]!.x);
      dk.y = sign(p[k]!.y - p[k1]!.y);
      cur.x = p[k1]!.x - p[i]!.x;
      cur.y = p[k1]!.y - p[i]!.y;
      const a = xprod(constraint[0]!, cur);
      const b = xprod(constraint[0]!, dk);
      const c = xprod(constraint[1]!, cur);
      const d = xprod(constraint[1]!, dk);
      let j = 10000000;
      if (b < 0) j = Math.floor(a / -b);
      if (d > 0) j = Math.min(j, Math.floor(-c / d));
      pivk[i] = mod(k1 + j, n);
    }
  }

  let j = pivk[n - 1]!;
  path.lon[n - 1] = j;
  for (let i = n - 2; i >= 0; i--) {
    if (cyclic(i + 1, pivk[i]!, j)) j = pivk[i]!;
    path.lon[i] = j;
  }
  for (let i = n - 1; cyclic(mod(i + 1, n), j, path.lon[i]!); i--) path.lon[i] = j;
}

function penalty3(path: Path, i: number, j: number) {
  const n = path.len;
  const p = path.pt;
  const sums = path.sums;
  let r = 0;
  if (j >= n) {
    j -= n;
    r = 1;
  }
  let x: number, y: number, x2: number, xy: number, y2: number, k: number;
  if (r === 0) {
    x = sums[j + 1]!.x - sums[i]!.x;
    y = sums[j + 1]!.y - sums[i]!.y;
    x2 = sums[j + 1]!.x2 - sums[i]!.x2;
    xy = sums[j + 1]!.xy - sums[i]!.xy;
    y2 = sums[j + 1]!.y2 - sums[i]!.y2;
    k = j + 1 - i;
  } else {
    x = sums[j + 1]!.x - sums[i]!.x + sums[n]!.x;
    y = sums[j + 1]!.y - sums[i]!.y + sums[n]!.y;
    x2 = sums[j + 1]!.x2 - sums[i]!.x2 + sums[n]!.x2;
    xy = sums[j + 1]!.xy - sums[i]!.xy + sums[n]!.xy;
    y2 = sums[j + 1]!.y2 - sums[i]!.y2 + sums[n]!.y2;
    k = j + 1 - i + n;
  }
  const px = (p[i]!.x + p[j]!.x) / 2 - p[0]!.x;
  const py = (p[i]!.y + p[j]!.y) / 2 - p[0]!.y;
  const ey = p[j]!.x - p[i]!.x;
  const ex = -(p[j]!.y - p[i]!.y);
  const a = (x2 - 2 * x * px) / k + px * px;
  const b = (xy - x * py - y * px) / k + px * py;
  const c = (y2 - 2 * y * py) / k + py * py;
  const s = ex * ex * a + 2 * ex * ey * b + ey * ey * c;
  return Math.sqrt(Math.max(0, s));
}

function bestPolygon(path: Path) {
  const n = path.len;
  const pen: number[] = [];
  const prev: number[] = [];
  const clip0: number[] = [];
  const clip1: number[] = [];
  const seg0: number[] = [];
  const seg1: number[] = [];

  for (let i = 0; i < n; i++) {
    let c = mod(path.lon[mod(i - 1, n)]! - 1, n);
    if (c === i) c = mod(i + 1, n);
    clip0[i] = c < i ? n : c;
  }
  let j = 1;
  for (let i = 0; i < n; i++) {
    while (j <= clip0[i]!) {
      clip1[j] = i;
      j++;
    }
  }
  let i = 0;
  let m = 0;
  for (j = 0; i < n; j++) {
    seg0[j] = i;
    i = clip0[i]!;
  }
  seg0[j] = n;
  m = j;
  i = n;
  for (j = m; j > 0; j--) {
    seg1[j] = i;
    i = clip1[i]!;
  }
  seg1[0] = 0;

  pen[0] = 0;
  for (j = 1; j <= m; j++) {
    for (i = seg1[j]!; i <= seg0[j]!; i++) {
      let best = -1;
      for (let k = seg0[j - 1]!; k >= clip1[i]!; k--) {
        const thispen = penalty3(path, k, i) + pen[k]!;
        if (best < 0 || thispen < best) {
          prev[i] = k;
          best = thispen;
        }
      }
      pen[i] = best;
    }
  }
  path.m = m;
  path.po = [];
  i = n;
  for (j = m - 1; i > 0; j--) {
    i = prev[i]!;
    path.po[j] = i;
  }
}

function pointslope(path: Path, i: number, j: number, ctr: P, dir: P) {
  const n = path.len;
  const sums = path.sums;
  let r = 0;
  while (j >= n) {
    j -= n;
    r += 1;
  }
  while (i >= n) {
    i -= n;
    r -= 1;
  }
  while (j < 0) {
    j += n;
    r -= 1;
  }
  while (i < 0) {
    i += n;
    r += 1;
  }
  const x = sums[j + 1]!.x - sums[i]!.x + r * sums[n]!.x;
  const y = sums[j + 1]!.y - sums[i]!.y + r * sums[n]!.y;
  const x2 = sums[j + 1]!.x2 - sums[i]!.x2 + r * sums[n]!.x2;
  const xy = sums[j + 1]!.xy - sums[i]!.xy + r * sums[n]!.xy;
  const y2 = sums[j + 1]!.y2 - sums[i]!.y2 + r * sums[n]!.y2;
  const k = j + 1 - i + r * n;

  ctr.x = x / k;
  ctr.y = y / k;

  let a = (x2 - (x * x) / k) / k;
  const b = (xy - (x * y) / k) / k;
  let c = (y2 - (y * y) / k) / k;
  const lambda2 = (a + c + Math.sqrt((a - c) * (a - c) + 4 * b * b)) / 2;
  a -= lambda2;
  c -= lambda2;
  let l: number;
  if (Math.abs(a) >= Math.abs(c)) {
    l = Math.sqrt(a * a + b * b);
    if (l !== 0) {
      dir.x = -b / l;
      dir.y = a / l;
    }
  } else {
    l = Math.sqrt(c * c + b * b);
    if (l !== 0) {
      dir.x = -c / l;
      dir.y = b / l;
    }
  }
  if (l === 0) {
    dir.x = 0;
    dir.y = 0;
  }
}

function adjustVertices(path: Path) {
  const m = path.m;
  const po = path.po;
  const n = path.len;
  const p = path.pt;
  const x0 = path.x0;
  const y0 = path.y0;
  const ctr: P[] = [];
  const dir: P[] = [];
  const q: number[][] = [];
  const v = [0, 0, 0];
  const s = pt();
  path.curve = newCurve(m);

  for (let i = 0; i < m; i++) {
    let j = po[mod(i + 1, m)]!;
    j = mod(j - po[i]!, n) + po[i]!;
    ctr[i] = pt();
    dir[i] = pt();
    pointslope(path, po[i]!, j, ctr[i]!, dir[i]!);
  }

  for (let i = 0; i < m; i++) {
    const qi = new Array<number>(9).fill(0);
    const d = dir[i]!.x * dir[i]!.x + dir[i]!.y * dir[i]!.y;
    if (d !== 0) {
      v[0] = dir[i]!.y;
      v[1] = -dir[i]!.x;
      v[2] = -v[1]! * ctr[i]!.y - v[0]! * ctr[i]!.x;
      for (let l = 0; l < 3; l++) for (let k = 0; k < 3; k++) qi[l * 3 + k] = (v[l]! * v[k]!) / d;
    }
    q[i] = qi;
  }

  for (let i = 0; i < m; i++) {
    const Q = new Array<number>(9).fill(0);
    const w = pt();
    s.x = p[po[i]!]!.x - x0;
    s.y = p[po[i]!]!.y - y0;
    const j = mod(i - 1, m);
    for (let l = 0; l < 3; l++)
      for (let k = 0; k < 3; k++) Q[l * 3 + k] = q[j]![l * 3 + k]! + q[i]![l * 3 + k]!;

    for (;;) {
      const det = Q[0]! * Q[4]! - Q[1]! * Q[3]!;
      if (det !== 0) {
        w.x = (-Q[2]! * Q[4]! + Q[5]! * Q[1]!) / det;
        w.y = (Q[2]! * Q[3]! - Q[5]! * Q[0]!) / det;
        break;
      }
      if (Q[0]! > Q[4]!) {
        v[0] = -Q[1]!;
        v[1] = Q[0]!;
      } else if (Q[4]!) {
        v[0] = -Q[4]!;
        v[1] = Q[3]!;
      } else {
        v[0] = 1;
        v[1] = 0;
      }
      const d = v[0]! * v[0]! + v[1]! * v[1]!;
      v[2] = -v[1]! * s.y - v[0]! * s.x;
      for (let l = 0; l < 3; l++)
        for (let k = 0; k < 3; k++) Q[l * 3 + k] = Q[l * 3 + k]! + (v[l]! * v[k]!) / d;
    }

    const dx = Math.abs(w.x - s.x);
    const dy = Math.abs(w.y - s.y);
    if (dx <= 0.5 && dy <= 0.5) {
      path.curve.vertex[i] = pt(w.x + x0, w.y + y0);
      continue;
    }

    let min = quadform(Q, s);
    let xmin = s.x;
    let ymin = s.y;
    if (Q[0] !== 0) {
      for (let z = 0; z < 2; z++) {
        w.y = s.y - 0.5 + z;
        w.x = -(Q[1]! * w.y + Q[2]!) / Q[0]!;
        const cand = quadform(Q, w);
        if (Math.abs(w.x - s.x) <= 0.5 && cand < min) {
          min = cand;
          xmin = w.x;
          ymin = w.y;
        }
      }
    }
    if (Q[4] !== 0) {
      for (let z = 0; z < 2; z++) {
        w.x = s.x - 0.5 + z;
        w.y = -(Q[3]! * w.x + Q[5]!) / Q[4]!;
        const cand = quadform(Q, w);
        if (Math.abs(w.y - s.y) <= 0.5 && cand < min) {
          min = cand;
          xmin = w.x;
          ymin = w.y;
        }
      }
    }
    for (let l = 0; l < 2; l++) {
      for (let k = 0; k < 2; k++) {
        w.x = s.x - 0.5 + l;
        w.y = s.y - 0.5 + k;
        const cand = quadform(Q, w);
        if (cand < min) {
          min = cand;
          xmin = w.x;
          ymin = w.y;
        }
      }
    }
    path.curve.vertex[i] = pt(xmin + x0, ymin + y0);
  }
}

function reversePath(path: Path) {
  const v = path.curve.vertex;
  for (let i = 0, j = path.curve.n - 1; i < j; i++, j--) {
    const t = v[i]!;
    v[i] = v[j]!;
    v[j] = t;
  }
}

function smooth(path: Path, alphamax: number) {
  const curve = path.curve;
  const m = curve.n;
  for (let i = 0; i < m; i++) {
    const j = mod(i + 1, m);
    const k = mod(i + 2, m);
    const p4 = interval(0.5, curve.vertex[k]!, curve.vertex[j]!);
    const denom = ddenom(curve.vertex[i]!, curve.vertex[k]!);
    let alpha: number;
    if (denom !== 0) {
      let dd = dpara(curve.vertex[i]!, curve.vertex[j]!, curve.vertex[k]!) / denom;
      dd = Math.abs(dd);
      alpha = dd > 1 ? 1 - 1 / dd : 0;
      alpha = alpha / 0.75;
    } else {
      alpha = 4 / 3;
    }
    curve.alpha0[j] = alpha;
    if (alpha >= alphamax) {
      curve.tag[j] = "CORNER";
      curve.c[3 * j + 1] = curve.vertex[j]!;
      curve.c[3 * j + 2] = p4;
    } else {
      if (alpha < 0.55) alpha = 0.55;
      else if (alpha > 1) alpha = 1;
      curve.tag[j] = "CURVE";
      curve.c[3 * j + 0] = interval(0.5 + 0.5 * alpha, curve.vertex[i]!, curve.vertex[j]!);
      curve.c[3 * j + 1] = interval(0.5 + 0.5 * alpha, curve.vertex[k]!, curve.vertex[j]!);
      curve.c[3 * j + 2] = p4;
    }
    curve.alpha[j] = alpha;
    curve.beta[j] = 0.5;
  }
  curve.alphaCurve = 1;
}

type Opti = { pen: number; c: [P, P]; t: number; s: number; alpha: number };
const newOpti = (): Opti => ({ pen: 0, c: [pt(), pt()], t: 0, s: 0, alpha: 0 });

function optiPenalty(
  path: Path,
  i: number,
  j: number,
  res: Opti,
  opttolerance: number,
  convc: number[],
  areac: number[],
): number {
  const curve = path.curve;
  const m = curve.n;
  const vertex = curve.vertex;
  if (i === j) return 1;

  let k = i;
  const i1 = mod(i + 1, m);
  let k1 = mod(k + 1, m);
  const conv = convc[k1]!;
  if (conv === 0) return 1;
  const d0 = ddist(vertex[i]!, vertex[i1]!);
  for (k = k1; k !== j; k = k1) {
    k1 = mod(k + 1, m);
    const k2 = mod(k + 2, m);
    if (convc[k1] !== conv) return 1;
    if (sign(cprod(vertex[i]!, vertex[i1]!, vertex[k1]!, vertex[k2]!)) !== conv) return 1;
    if (
      iprod1(vertex[i]!, vertex[i1]!, vertex[k1]!, vertex[k2]!) <
      d0 * ddist(vertex[k1]!, vertex[k2]!) * -0.999847695156
    )
      return 1;
  }

  const p0 = { ...curve.c[mod(i, m) * 3 + 2]! };
  let p1 = { ...vertex[mod(i + 1, m)]! };
  let p2 = { ...vertex[mod(j, m)]! };
  const p3 = { ...curve.c[mod(j, m) * 3 + 2]! };

  let area = areac[j]! - areac[i]!;
  area -= dpara(vertex[0]!, curve.c[i * 3 + 2]!, curve.c[j * 3 + 2]!) / 2;
  if (i >= j) area += areac[m]!;

  const A1 = dpara(p0, p1, p2);
  const A2 = dpara(p0, p1, p3);
  const A3 = dpara(p0, p2, p3);
  const A4 = A1 + A3 - A2;
  if (A2 === A1) return 1;

  const t = A3 / (A3 - A4);
  const s = A2 / (A2 - A1);
  const A = (A2 * t) / 2;
  if (A === 0) return 1;

  const R = area / A;
  const alpha = 2 - Math.sqrt(4 - R / 0.3);
  res.c[0] = interval(t * alpha, p0, p1);
  res.c[1] = interval(s * alpha, p3, p2);
  res.alpha = alpha;
  res.t = t;
  res.s = s;
  p1 = { ...res.c[0] };
  p2 = { ...res.c[1] };
  res.pen = 0;

  for (k = mod(i + 1, m); k !== j; k = k1) {
    k1 = mod(k + 1, m);
    const tt = tangent(p0, p1, p2, p3, vertex[k]!, vertex[k1]!);
    if (tt < -0.5) return 1;
    const q = bezierAt(tt, p0, p1, p2, p3);
    const d = ddist(vertex[k]!, vertex[k1]!);
    if (d === 0) return 1;
    const d1 = dpara(vertex[k]!, vertex[k1]!, q) / d;
    if (Math.abs(d1) > opttolerance) return 1;
    if (iprod(vertex[k]!, vertex[k1]!, q) < 0 || iprod(vertex[k1]!, vertex[k]!, q) < 0) return 1;
    res.pen += d1 * d1;
  }

  for (k = i; k !== j; k = k1) {
    k1 = mod(k + 1, m);
    const tt = tangent(p0, p1, p2, p3, curve.c[k * 3 + 2]!, curve.c[k1 * 3 + 2]!);
    if (tt < -0.5) return 1;
    const q = bezierAt(tt, p0, p1, p2, p3);
    const d = ddist(curve.c[k * 3 + 2]!, curve.c[k1 * 3 + 2]!);
    if (d === 0) return 1;
    let d1 = dpara(curve.c[k * 3 + 2]!, curve.c[k1 * 3 + 2]!, q) / d;
    let d2 =
      (dpara(curve.c[k * 3 + 2]!, curve.c[k1 * 3 + 2]!, vertex[k1]!) / d) * 0.75 * curve.alpha[k1]!;
    if (d2 < 0) {
      d1 = -d1;
      d2 = -d2;
    }
    if (d1 < d2 - opttolerance) return 1;
    if (d1 < d2) res.pen += (d1 - d2) * (d1 - d2);
  }
  return 0;
}

function optiCurve(path: Path, opttolerance: number) {
  const curve = path.curve;
  const m = curve.n;
  const vert = curve.vertex;
  const pt_: number[] = [];
  const pen: number[] = [];
  const len: number[] = [];
  const opt: Opti[] = [];
  let o = newOpti();

  const convc: number[] = new Array(m);
  const areac: number[] = new Array(m + 1);
  for (let i = 0; i < m; i++)
    convc[i] =
      curve.tag[i] === "CURVE"
        ? sign(dpara(vert[mod(i - 1, m)]!, vert[i]!, vert[mod(i + 1, m)]!))
        : 0;

  let area = 0;
  areac[0] = 0;
  const p0 = curve.vertex[0]!;
  for (let i = 0; i < m; i++) {
    const i1 = mod(i + 1, m);
    if (curve.tag[i1] === "CURVE") {
      const alpha = curve.alpha[i1]!;
      area +=
        (0.3 * alpha * (4 - alpha) * dpara(curve.c[i * 3 + 2]!, vert[i1]!, curve.c[i1 * 3 + 2]!)) /
        2;
      area += dpara(p0, curve.c[i * 3 + 2]!, curve.c[i1 * 3 + 2]!) / 2;
    }
    areac[i + 1] = area;
  }

  pt_[0] = -1;
  pen[0] = 0;
  len[0] = 0;
  for (let j = 1; j <= m; j++) {
    pt_[j] = j - 1;
    pen[j] = pen[j - 1]!;
    len[j] = len[j - 1]! + 1;
    for (let i = j - 2; i >= 0; i--) {
      const r = optiPenalty(path, i, mod(j, m), o, opttolerance, convc, areac);
      if (r) break;
      if (len[j]! > len[i]! + 1 || (len[j] === len[i]! + 1 && pen[j]! > pen[i]! + o.pen)) {
        pt_[j] = i;
        pen[j] = pen[i]! + o.pen;
        len[j] = len[i]! + 1;
        opt[j] = o;
        o = newOpti();
      }
    }
  }

  const om = len[m]!;
  const ocurve = newCurve(om);
  let j = m;
  for (let i = om - 1; i >= 0; i--) {
    if (pt_[j] === j - 1) {
      const jj = mod(j, m);
      ocurve.tag[i] = curve.tag[jj]!;
      ocurve.c[i * 3 + 0] = curve.c[jj * 3 + 0]!;
      ocurve.c[i * 3 + 1] = curve.c[jj * 3 + 1]!;
      ocurve.c[i * 3 + 2] = curve.c[jj * 3 + 2]!;
      ocurve.vertex[i] = curve.vertex[jj]!;
      ocurve.alpha[i] = curve.alpha[jj]!;
      ocurve.alpha0[i] = curve.alpha0[jj]!;
      ocurve.beta[i] = curve.beta[jj]!;
    } else {
      const jj = mod(j, m);
      ocurve.tag[i] = "CURVE";
      ocurve.c[i * 3 + 0] = opt[j]!.c[0];
      ocurve.c[i * 3 + 1] = opt[j]!.c[1];
      ocurve.c[i * 3 + 2] = curve.c[jj * 3 + 2]!;
      ocurve.vertex[i] = interval(opt[j]!.s, curve.c[jj * 3 + 2]!, vert[jj]!);
      ocurve.alpha[i] = opt[j]!.alpha;
      ocurve.alpha0[i] = opt[j]!.alpha;
      ocurve.beta[i] = 0.5;
    }
    j = pt_[j]!;
  }
  ocurve.alphaCurve = 1;
  path.curve = ocurve;
}

/* ----------------------------------------------------------- saída pública */

function curveToSegs(curve: Curve): { start: P; segs: BezierSeg[] } {
  const n = curve.n;
  const start = { ...curve.c[(n - 1) * 3 + 2]! };
  const segs: BezierSeg[] = [];
  for (let i = 0; i < n; i++) {
    if (curve.tag[i] === "CURVE") {
      segs.push({
        c1: { ...curve.c[i * 3 + 0]! },
        c2: { ...curve.c[i * 3 + 1]! },
        p: { ...curve.c[i * 3 + 2]! },
      });
    } else {
      const corner = curve.c[i * 3 + 1]!;
      const end = curve.c[i * 3 + 2]!;
      segs.push({ c1: { ...corner }, c2: { ...corner }, p: { ...corner }, line: true });
      segs.push({ c1: { ...end }, c2: { ...end }, p: { ...end }, line: true });
    }
  }
  return { start, segs };
}

function polyOf(start: P, segs: BezierSeg[]): P[] {
  const out: P[] = [start];
  let cur = start;
  for (const s of segs) {
    if (s.line) out.push(s.p);
    else for (let i = 1; i <= 6; i++) out.push(bezierAt(i / 6, cur, s.c1, s.c2, s.p));
    cur = s.p;
  }
  return out;
}

function areaOf(poly: P[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function pointInPoly(p: P, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/** Traça a máscara binária em contornos de Bézier com hierarquia. */
export function tracePaths(bin: Binary, opt: TraceOptions = DEFAULT_TRACE): TracedPath[] {
  const paths = bmToPathlist(bin, opt);
  const traced: TracedPath[] = [];
  const polys: P[][] = [];

  for (const path of paths) {
    if (path.len < 4) continue;
    calcSums(path);
    calcLon(path);
    bestPolygon(path);
    if (path.m < 1) continue;
    adjustVertices(path);
    if (path.sign === "-") reversePath(path);
    smooth(path, opt.alphamax);
    if (opt.optimize !== false && path.curve.n > 2) optiCurve(path, opt.opttolerance);
    if (!path.curve.n) continue;

    const { start, segs } = curveToSegs(path.curve);
    const poly = polyOf(start, segs);
    traced.push({
      start,
      segs,
      hole: path.sign === "-",
      parent: null,
      area: areaOf(poly),
    });
    polys.push(poly);
  }

  // hierarquia: cada furo aponta para o menor contorno externo que o contém
  traced.forEach((t, i) => {
    if (!t.hole) return;
    const probe = polys[i]![0]!;
    let best = -1;
    let bestArea = Infinity;
    traced.forEach((o, j) => {
      if (j === i || o.hole || o.area <= t.area) return;
      if (pointInPoly(probe, polys[j]!) && o.area < bestArea) {
        best = j;
        bestArea = o.area;
      }
    });
    t.parent = best >= 0 ? best : null;
  });

  return traced;
}
