/**
 * visionEngine — etapa 2 da pipeline CHAMFER VISION.
 *
 * Extrai contornos (em pixels) a partir da máscara binária. Contornos externos
 * vêm dos componentes de tinta; contornos internos (furos) vêm dos componentes
 * de fundo totalmente cercados por tinta.
 */

import type { Binary } from "./imagePreprocessor";

export type PxPoint = { x: number; y: number };

export type Contour = {
  pts: PxPoint[];
  /** Verdadeiro quando o contorno delimita um furo (fundo cercado por tinta). */
  hole: boolean;
  closed: boolean;
  /** Área absoluta em px² (fórmula do shoelace). */
  area: number;
};

const NB8: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function labelComponents(mask: Uint8Array, w: number, h: number, target: 0 | 1) {
  const labels = new Int32Array(mask.length).fill(-1);
  const comps: { id: number; pixels: number; touchesBorder: boolean; seed: number }[] = [];
  const stack: number[] = [];
  let id = 0;
  for (let s = 0; s < mask.length; s++) {
    if (mask[s] !== target || labels[s] !== -1) continue;
    labels[s] = id;
    stack.length = 0;
    stack.push(s);
    let pixels = 0;
    let touchesBorder = false;
    let seed = s;
    while (stack.length) {
      const i = stack.pop()!;
      pixels++;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      if (y < seed / w || (Math.floor(seed / w) === y && x < seed % w)) seed = i;
      const push = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const j = ny * w + nx;
        if (mask[j] === target && labels[j] === -1) {
          labels[j] = id;
          stack.push(j);
        }
      };
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    comps.push({ id, pixels, touchesBorder, seed });
    id++;
  }
  return { labels, comps };
}

/** Moore-neighbor tracing a partir do pixel inicial do componente. */
function traceBorder(
  labels: Int32Array,
  w: number,
  h: number,
  compId: number,
  start: number,
): PxPoint[] {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === compId;

  const sx = start % w;
  const sy = (start - sx) / w;
  const pts: PxPoint[] = [{ x: sx, y: sy }];
  let cx = sx;
  let cy = sy;
  let dir = 0;
  const maxSteps = w * h * 4;
  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8; // volta um passo e varre no sentido horário
      const [dx, dy] = NB8[d]!;
      const nx = cx + dx;
      const ny = cy + dy;
      if (inside(nx, ny)) {
        cx = nx;
        cy = ny;
        dir = d;
        pts.push({ x: cx, y: cy });
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
  }
  return pts;
}

export function polygonArea(pts: PxPoint[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export type ExtractOptions = {
  /** Descarta componentes menores que este número de pixels. */
  minPixels?: number;
  /** Descarta contornos com menos que este número de pontos. */
  minPoints?: number;
};

/** Extrai contornos externos e furos da máscara binária. */
export function extractContours(bin: Binary, opt: ExtractOptions = {}): Contour[] {
  const { data, width: w, height: h } = bin;
  const minPixels = opt.minPixels ?? 24;
  const minPoints = opt.minPoints ?? 12;
  const out: Contour[] = [];

  const ink = labelComponents(data, w, h, 1);
  for (const c of ink.comps) {
    if (c.pixels < minPixels) continue;
    const pts = traceBorder(ink.labels, w, h, c.id, c.seed);
    if (pts.length < minPoints) continue;
    out.push({ pts, hole: false, closed: true, area: polygonArea(pts) });
  }

  const bg = labelComponents(data, w, h, 0);
  for (const c of bg.comps) {
    if (c.touchesBorder || c.pixels < minPixels) continue;
    const pts = traceBorder(bg.labels, w, h, c.id, c.seed);
    if (pts.length < minPoints) continue;
    const area = polygonArea(pts);
    // Um traço fino gera contorno externo E interno quase idênticos: o interno
    // é a outra margem da MESMA linha, não um furo. Descartamos esse caso.
    const parent = out.filter((o) => !o.hole && o.area > area).sort((a, b) => a.area - b.area)[0];
    if (parent && area / parent.area > 0.55) continue;
    out.push({ pts, hole: true, closed: true, area });
  }

  return out.sort((a, b) => b.area - a.area);
}
