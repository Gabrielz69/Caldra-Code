/**
 * skeletonizer — etapa central do MODO TRAÇADO do CHAMFER VISION.
 *
 * Foto de traçado à mão → máscara binária por limiar ADAPTATIVO →
 * afinamento Zhang-Suen (1 px) → polilinhas centrais com tratamento de
 * bifurcações, remoção de espinhos e fechamento de vãos.
 *
 * Tudo em TypeScript puro: nada de opencv.js, nada de servidor.
 */

import type { Binary } from "./imagePreprocessor";
import type { PxPoint } from "./visionEngine";

export type AdaptiveOptions = {
  /** Ganho de brilho aplicado antes do limiar (-100..100). */
  brightness?: number;
  /** Ganho de contraste (-100..100). */
  contrast?: number;
  /** Constante subtraída da média local — quanto maior, menos tinta. */
  bias?: number;
  /** Lado da janela local em px (ímpar); ausente = 1/8 da menor dimensão. */
  window?: number;
  invert?: boolean;
};

/**
 * Limiar adaptativo por média local (integral image) — compensa iluminação
 * irregular típica de foto de papel.
 */
export function adaptiveBinarize(image: ImageData, opt: AdaptiveOptions = {}): Binary {
  const { width: w, height: h, data } = image;
  const brightness = opt.brightness ?? 0;
  const contrast = opt.contrast ?? 0;
  const bias = opt.bias ?? 10;
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));

  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]! / 255;
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    let v = 0.299 * r + 0.587 * g + 0.114 * b + brightness;
    v = cf * (v - 128) + 128;
    gray[p] = Math.min(255, Math.max(0, v));
  }

  // imagem integral para média local em O(1)
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x]!;
      sum[(y + 1) * (w + 1) + (x + 1)] = sum[y * (w + 1) + (x + 1)]! + row;
    }
  }

  let win = opt.window ?? Math.round(Math.min(w, h) / 8);
  if (win % 2 === 0) win += 1;
  const rad = Math.max(3, Math.floor(win / 2));

  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad);
    const y1 = Math.min(h - 1, y + rad);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rad);
      const x1 = Math.min(w - 1, x + rad);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s =
        sum[(y1 + 1) * (w + 1) + (x1 + 1)]! -
        sum[y0 * (w + 1) + (x1 + 1)]! -
        sum[(y1 + 1) * (w + 1) + x0]! +
        sum[y0 * (w + 1) + x0]!;
      const mean = s / area;
      const v = gray[y * w + x]!;
      const ink = opt.invert ? v > mean + bias : v < mean - bias;
      out[y * w + x] = ink ? 1 : 0;
    }
  }
  return { data: out, width: w, height: h };
}

/** Afinamento Zhang-Suen: reduz o traço a 1 px preservando conectividade. */
export function thinZhangSuen(bin: Binary, maxIter = 60): Binary {
  const { width: w, height: h } = bin;
  const img = Uint8Array.from(bin.data);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]!);

  const step = (pass: 0 | 1) => {
    const remove: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!img[y * w + x]) continue;
        const p2 = at(x, y - 1);
        const p3 = at(x + 1, y - 1);
        const p4 = at(x + 1, y);
        const p5 = at(x + 1, y + 1);
        const p6 = at(x, y + 1);
        const p7 = at(x - 1, y + 1);
        const p8 = at(x - 1, y);
        const p9 = at(x - 1, y - 1);
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0;
        for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) a++;
        if (a !== 1) continue;
        if (pass === 0) {
          if (p2 * p4 * p6 !== 0) continue;
          if (p4 * p6 * p8 !== 0) continue;
        } else {
          if (p2 * p4 * p8 !== 0) continue;
          if (p2 * p6 * p8 !== 0) continue;
        }
        remove.push(y * w + x);
      }
    }
    for (const i of remove) img[i] = 0;
    return remove.length;
  };

  for (let it = 0; it < maxIter; it++) {
    const a = step(0);
    const b = step(1);
    if (!a && !b) break;
  }
  return { data: img, width: w, height: h };
}

const N8: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export type Chain = { pts: PxPoint[]; closed: boolean };

/** Extrai as polilinhas centrais do esqueleto, dividindo nas bifurcações. */
export function traceSkeleton(skel: Binary): Chain[] {
  const { data, width: w, height: h } = skel;
  const idx = (x: number, y: number) => y * w + x;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!data[idx(x, y)];
  /**
   * Vizinhança 8 com redução diagonal: um vizinho na diagonal é ignorado
   * quando já existe caminho ortogonal até ele. Sem isso o esqueleto vira
   * uma sucessão de falsas bifurcações e o traço se fragmenta.
   */
  const nbrs = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    const out: number[] = [];
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (!on(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (on(x + dx, y) || on(x, y + dy))) continue;
      out.push(idx(nx, ny));
    }
    return out;
  };

  const deg = new Uint8Array(data.length);
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (!data[i]) continue;
    pixels.push(i);
    deg[i] = nbrs(i).length;
  }

  const pt = (i: number): PxPoint => ({ x: i % w, y: Math.floor(i / w) });
  const used = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const chains: Chain[] = [];
  const visitedMid = new Uint8Array(data.length);

  const walk = (node: number, first: number) => {
    if (used.has(key(node, first))) return;
    const path = [node, first];
    used.add(key(node, first));
    let prev = node;
    let cur = first;
    while (deg[cur] === 2) {
      visitedMid[cur] = 1;
      const next = nbrs(cur).find((n) => n !== prev);
      if (next === undefined) break;
      if (used.has(key(cur, next))) break;
      used.add(key(cur, next));
      path.push(next);
      prev = cur;
      cur = next;
      if (cur === node) break;
    }
    if (path.length >= 2)
      chains.push({ pts: path.map(pt), closed: path[0] === path[path.length - 1] });
  };

  for (const i of pixels) if (deg[i] !== 2) for (const n of nbrs(i)) walk(i, n);

  // ciclos puros (todos os pixels com grau 2)
  for (const i of pixels) {
    if (deg[i] !== 2 || visitedMid[i]) continue;
    const path = [i];
    visitedMid[i] = 1;
    let prev = -1;
    let cur = i;
    for (;;) {
      const next = nbrs(cur).find((n) => n !== prev && !visitedMid[n]);
      if (next === undefined) break;
      visitedMid[next] = 1;
      path.push(next);
      prev = cur;
      cur = next;
    }
    if (path.length > 6) chains.push({ pts: path.map(pt), closed: true });
  }

  return chains;
}

const chainLength = (pts: PxPoint[]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return l;
};

/** Remove espinhos (ramos curtos de bifurcação) e trechos degenerados. */
export function pruneChains(chains: Chain[], minLengthPx: number): Chain[] {
  return chains.filter((c) => c.pts.length >= 3 && chainLength(c.pts) >= minLengthPx);
}

/** Fecha vãos: extremidades próximas são coladas no mesmo ponto médio. */
export function snapChainEnds(chains: Chain[], tolPx: number): Chain[] {
  const ends: { c: number; i: number }[] = [];
  chains.forEach((c, ci) => {
    if (c.closed) return;
    ends.push({ c: ci, i: 0 }, { c: ci, i: c.pts.length - 1 });
  });
  const out = chains.map((c) => ({ ...c, pts: c.pts.slice() }));
  for (let a = 0; a < ends.length; a++) {
    for (let b = a + 1; b < ends.length; b++) {
      const ea = ends[a]!;
      const eb = ends[b]!;
      if (ea.c === eb.c) continue;
      const pa = out[ea.c]!.pts[ea.i]!;
      const pb = out[eb.c]!.pts[eb.i]!;
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > tolPx) continue;
      const m = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      out[ea.c]!.pts[ea.i] = m;
      out[eb.c]!.pts[eb.i] = m;
    }
  }
  return out;
}
