/**
 * contourFitter — reconhecimento de ALTA QUALIDADE do modo TÉCNICO.
 *
 * Em vez de simplificar o contorno com um epsilon global e emendar segmentos,
 * este módulo:
 *   1. detecta CANTOS por curvatura e parte o contorno neles;
 *   2. ajusta LINHA (mínimos quadrados + refino das extremidades) ou
 *      ARCO/CÍRCULO (ajuste algébrico + refino) em cada trecho;
 *   3. usa epsilon ADAPTATIVO por contorno — a tolerância do usuário passa a
 *      ser o DESVIO MÁXIMO permitido, não um fator arbitrário;
 *   4. regulariza (ortogonaliza, fecha círculos) apenas dentro da tolerância;
 *   5. marca cada primitiva com status e desvio medido em px.
 */

import type { Contour, PxPoint } from "./visionEngine";
import { fitCircle, simplify, type Prim, type PrimStatus } from "./geometryRecognizer";

export type FitOptions = {
  /** Desvio máximo permitido, em px. */
  maxDevPx: number;
  diagonalPx: number;
  /** Procurar círculo completo antes de partir o contorno. */
  preferCircles?: boolean;
  /** Ortogonalizar/fechar dentro da tolerância. */
  regularize?: boolean;
};

const TAU = Math.PI * 2;

function perp(p: PxPoint, a: PxPoint, b: PxPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Desvio máximo de um trecho em relação à reta infinita a–b. */
function lineDev(run: PxPoint[], a: PxPoint, b: PxPoint) {
  let m = 0;
  for (const p of run) m = Math.max(m, perp(p, a, b));
  return m;
}

/** Desvio radial máximo de um trecho em relação ao círculo (cx,cy,r). */
function circleDev(run: PxPoint[], cx: number, cy: number, r: number) {
  let m = 0;
  for (const p of run) m = Math.max(m, Math.abs(Math.hypot(p.x - cx, p.y - cy) - r));
  return m;
}

/**
 * Reta por mínimos quadrados totais (PCA) com as extremidades PROJETADAS —
 * o resultado passa exatamente pelo eixo do trecho, sem depender do 1º/último
 * pixel, que costuma estar contaminado pelo canto.
 */
function fitLine(run: PxPoint[]) {
  const n = run.length;
  let mx = 0;
  let my = 0;
  for (const p of run) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of run) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const p of run) {
    const t = (p.x - mx) * ux + (p.y - my) * uy;
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
  }
  const a = { x: mx + ux * t0, y: my + uy * t0 };
  const b = { x: mx + ux * t1, y: my + uy * t1 };
  return { a, b, dev: lineDev(run, a, b) };
}

/** Cobertura angular e extremos de um trecho em torno de um centro. */
function span(run: PxPoint[], cx: number, cy: number) {
  const a0 = Math.atan2(run[0]!.y - cy, run[0]!.x - cx);
  const a1 = Math.atan2(run[run.length - 1]!.y - cy, run[run.length - 1]!.x - cx);
  // sentido definido pelo ponto médio do trecho
  const mid = run[Math.floor(run.length / 2)]!;
  const am = Math.atan2(mid.y - cy, mid.x - cx);
  const norm = (v: number) => ((v % TAU) + TAU) % TAU;
  const ccw = norm(am - a0) < norm(a1 - a0);
  const sweep = ccw ? norm(a1 - a0) : norm(a0 - a1);
  return ccw ? { a0, a1, sweep } : { a0: a1, a1: a0, sweep };
}

/**
 * Detecta cantos por curvatura: ângulo entre as cordas que chegam e saem de
 * cada ponto, com supressão de não-máximos. Cantos de 90° de uma chapa saem
 * limpos; curvas suaves não geram canto nenhum.
 */
export function detectCorners(pts: PxPoint[], closed: boolean, maxDevPx: number): number[] {
  const n = pts.length;
  if (n < 8) return closed ? [] : [0, n - 1];
  const k = Math.max(3, Math.min(28, Math.round(n * 0.03)));
  const score = new Float32Array(n);
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  for (let i = 0; i < n; i++) {
    if (!closed && (i < k || i > n - k - 1)) continue;
    const a = at(i - k);
    const b = at(i);
    const c = at(i + k);
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = TAU - d;
    // um canto real também tem "flecha": distância do vértice à corda a–c
    const sag = perp(b, a, c);
    score[i] = d > 0.55 && sag > Math.max(1, maxDevPx * 0.6) ? d : 0;
  }

  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = score[i]!;
    if (!s) continue;
    let best = true;
    for (let j = -k; j <= k && best; j++) {
      if (!j) continue;
      const m = closed ? (i + j + n) % n : i + j;
      if (m < 0 || m >= n) continue;
      if (score[m]! > s || (score[m]! === s && m < i)) best = false;
    }
    if (best) corners.push(i);
  }
  if (!closed) {
    if (corners[0] !== 0) corners.unshift(0);
    if (corners[corners.length - 1] !== n - 1) corners.push(n - 1);
  }
  return corners;
}

function mkLine(a: PxPoint, b: PxPoint, hole: boolean, dev: number, maxDev: number): Prim {
  return {
    kind: "line",
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    hole,
    quality: Math.max(0, 1 - dev / Math.max(maxDev, 0.001)),
    status: "convertida" as PrimStatus,
    dev,
  };
}

/** Ortogonaliza a reta se o giro necessário couber na tolerância. */
function orthogonalize(p: Prim, maxDev: number): Prim {
  if (p.kind !== "line") return p;
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return p;
  const ang = Math.atan2(dy, dx);
  const snapped = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
  let diff = Math.abs(ang - snapped);
  if (diff > Math.PI) diff = TAU - diff;
  const shift = Math.sin(diff) * len; // deslocamento da extremidade
  if (shift > maxDev - (p.dev ?? 0)) return p;
  const cx = (p.x1 + p.x2) / 2;
  const cy = (p.y1 + p.y2) / 2;
  const ux = Math.cos(snapped) * (len / 2);
  const uy = Math.sin(snapped) * (len / 2);
  return {
    ...p,
    x1: cx - ux,
    y1: cy - uy,
    x2: cx + ux,
    y2: cy + uy,
    dev: (p.dev ?? 0) + shift,
  };
}

/** Junta linhas consecutivas quase colineares dentro da tolerância. */
function mergeCollinear(prims: Prim[], maxDev: number): Prim[] {
  const out: Prim[] = [];
  for (const p of prims) {
    const last = out[out.length - 1];
    if (
      last &&
      last.kind === "line" &&
      p.kind === "line" &&
      Math.hypot(last.x2 - p.x1, last.y2 - p.y1) < maxDev
    ) {
      const a = { x: last.x1, y: last.y1 };
      const b = { x: p.x2, y: p.y2 };
      const dev = Math.max(perp({ x: last.x2, y: last.y2 }, a, b), last.dev ?? 0, p.dev ?? 0);
      if (dev <= maxDev) {
        out[out.length - 1] = mkLine(a, b, last.hole, dev, maxDev);
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

function fitRun(run: PxPoint[], hole: boolean, o: FitOptions): Prim[] {
  const maxDev = o.maxDevPx;
  if (run.length < 3) {
    const a = run[0]!;
    const b = run[run.length - 1]!;
    return [mkLine(a, b, hole, 0, maxDev)];
  }

  // 1) reta
  const line = fitLine(run);
  if (line.dev <= maxDev) return [mkLine(line.a, line.b, hole, line.dev, maxDev)];

  // 2) arco (ajuste algébrico + refino do raio pela média das distâncias)
  const fit = fitCircle(run);
  if (fit && fit.r > maxDev * 2 && fit.r < o.diagonalPx * 30) {
    const dev = circleDev(run, fit.cx, fit.cy, fit.r);
    if (dev <= maxDev) {
      const s = span(run, fit.cx, fit.cy);
      if (s.sweep > 0.12) {
        // arco quase completo dentro da tolerância vira CÍRCULO
        if (o.regularize !== false && s.sweep > TAU - 0.35)
          return [
            {
              kind: "circle",
              cx: fit.cx,
              cy: fit.cy,
              r: fit.r,
              hole,
              quality: Math.max(0, 1 - dev / maxDev),
              status: "convertida",
              dev,
            },
          ];
        return [
          {
            kind: "arc",
            cx: fit.cx,
            cy: fit.cy,
            r: fit.r,
            a0: s.a0,
            a1: s.a1,
            hole,
            quality: Math.max(0, 1 - dev / maxDev),
            status: "convertida",
            dev,
          },
        ];
      }
    }
  }

  // 3) bisseção: transições suaves viram duas primitivas (biarc/linha+arco)
  if (run.length >= 24) {
    const mid = Math.floor(run.length / 2);
    const left = run.slice(0, mid + 1);
    const right = run.slice(mid);
    const ok = (part: PxPoint[]) => {
      const l = fitLine(part);
      if (l.dev <= maxDev) return true;
      const f = fitCircle(part);
      return !!f && f.r > maxDev * 2 && circleDev(part, f.cx, f.cy, f.r) <= maxDev;
    };
    if (ok(left) && ok(right)) return [...fitRun(left, hole, o), ...fitRun(right, hole, o)];
  }

  // 4) fallback: polilinha simplificada com epsilon = desvio máximo
  const pts = simplify(run, maxDev);
  return [
    {
      kind: "polyline",
      pts,
      closed: false,
      hole,
      quality: 0.5,
      status: "aproximada",
      dev: maxDev,
    },
  ];
}

/** Contorno de pixels → primitivas reais, com cantos e métricas de desvio. */
export function fitContourHQ(c: Contour, o: FitOptions): Prim[] {
  const src = c.pts;
  const maxDev = o.maxDevPx;
  if (src.length < 4) return [];

  // círculo completo tem prioridade absoluta (furo, flange, tubo)
  if (o.preferCircles !== false && c.closed && src.length >= 16) {
    const fit = fitCircle(src);
    if (fit) {
      const dev = circleDev(src, fit.cx, fit.cy, fit.r);
      if (dev <= maxDev * 1.2 && fit.r > maxDev)
        return [
          {
            kind: "circle",
            cx: fit.cx,
            cy: fit.cy,
            r: fit.r,
            hole: c.hole,
            quality: Math.max(0, 1 - dev / (maxDev * 1.2)),
            status: "detectada",
            dev,
          },
        ];
    }
  }

  const corners = detectCorners(src, c.closed, maxDev);

  // epsilon ADAPTATIVO: contorno simples aceita simplificação mais agressiva
  const density = corners.length / Math.max(1, src.length / 100);
  const adaptive: FitOptions = {
    ...o,
    maxDevPx: density > 2.5 ? maxDev * 0.6 : maxDev,
  };

  let prims: Prim[] = [];
  if (!corners.length) {
    prims = fitRun(c.closed ? [...src, src[0]!] : src, c.hole, adaptive);
  } else if (c.closed) {
    for (let i = 0; i < corners.length; i++) {
      const s = corners[i]!;
      const e = corners[(i + 1) % corners.length]!;
      const run = s < e ? src.slice(s, e + 1) : [...src.slice(s), ...src.slice(0, e + 1)];
      if (run.length >= 2) prims.push(...fitRun(run, c.hole, adaptive));
    }
  } else {
    for (let i = 0; i < corners.length - 1; i++) {
      const run = src.slice(corners[i]!, corners[i + 1]! + 1);
      if (run.length >= 2) prims.push(...fitRun(run, c.hole, adaptive));
    }
  }

  if (o.regularize !== false) prims = prims.map((p) => orthogonalize(p, maxDev));
  prims = mergeCollinear(prims, maxDev);
  return prims;
}
