/**
 * centerlinePipeline — MODO TRAÇADO do CHAMFER VISION.
 *
 * Foto de traçado à mão → linhas CENTRAIS (nunca dois contornos paralelos)
 * → primitivas reais (LINE / ARC / CIRCLE / POLYLINE) em pixels.
 * A conversão para mm continua a cargo do `toEntities` da Entrega 1.
 */

import { gaussianBlur, rasterize, type PreprocessOptions } from "./imagePreprocessor";
import {
  adaptiveBinarize,
  pruneChains,
  snapChainEnds,
  thinZhangSuen,
  traceSkeleton,
  type Chain,
} from "./skeletonizer";
import { recognizeContour, type Prim, type Tolerance } from "./geometryRecognizer";
import type { PxPoint } from "./visionEngine";
import type { VisionAnalysis } from "./vectorizer";

export type CenterlineOptions = PreprocessOptions & {
  brightness: number;
  contrast: number;
  /** Constante do limiar adaptativo. */
  bias: number;
  /** Comprimento mínimo de um traço, em % da diagonal. */
  minBranchPct: number;
  /** Tolerância de fechamento de vãos, em % da diagonal. */
  gapPct: number;
  tolerance: Tolerance;
  blur: number;
  invert: boolean;
};

export const DEFAULT_CENTERLINE: CenterlineOptions = {
  brightness: 0,
  contrast: 20,
  bias: 10,
  minBranchPct: 1.5,
  gapPct: 1,
  tolerance: "media",
  blur: 1,
  invert: false,
  maxSize: 1100,
};

export type CenterlineStats = {
  strokes: number;
  lines: number;
  arcs: number;
  circles: number;
  polylines: number;
};

export type CenterlineAnalysis = VisionAnalysis & { centerline: CenterlineStats };

/** Suavização por média móvel — tira o degrau de pixel do esqueleto. */
function smooth(pts: PxPoint[], closed: boolean, radius = 2): PxPoint[] {
  if (pts.length < 5) return pts;
  const n = pts.length;
  const out: PxPoint[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    let k = 0;
    for (let d = -radius; d <= radius; d++) {
      let j = i + d;
      if (closed) j = (j + n) % n;
      else if (j < 0 || j >= n) continue;
      sx += pts[j]!.x;
      sy += pts[j]!.y;
      k++;
    }
    out.push({ x: sx / k, y: sy / k });
  }
  if (!closed) {
    out[0] = pts[0]!;
    out[n - 1] = pts[n - 1]!;
  }
  return out;
}

export function analyzeCenterline(
  img: HTMLImageElement,
  opt: CenterlineOptions,
): CenterlineAnalysis {
  const { pixels } = rasterize(img, opt);
  return analyzeCenterlineRaster(pixels, opt);
}

/** Mesma análise a partir de pixels já rasterizados — usada no Web Worker. */
export function analyzeCenterlineRaster(
  input: ImageData,
  opt: CenterlineOptions,
  onProgress?: (stage: string, pct: number) => void,
): CenterlineAnalysis {
  const width = input.width;
  const height = input.height;
  onProgress?.("Binarizando", 12);
  const pixels = opt.blur > 0 ? gaussianBlur(input, opt.blur) : input;
  const bin = adaptiveBinarize(pixels, {
    brightness: opt.brightness,
    contrast: opt.contrast,
    bias: opt.bias,
    invert: opt.invert,
  });
  onProgress?.("Esqueletizando", 45);

  const skel = thinZhangSuen(bin);
  const diagonalPx = Math.hypot(width, height);
  const raw = traceSkeleton(skel);
  const pruned = pruneChains(raw, (opt.minBranchPct / 100) * diagonalPx);
  const chains: Chain[] = snapChainEnds(pruned, (opt.gapPct / 100) * diagonalPx);

  onProgress?.("Reconhecendo geometria", 75);
  const prims: Prim[] = [];

  for (const c of chains) {
    const pts = smooth(c.pts, c.closed);
    prims.push(
      ...recognizeContour(
        { pts, hole: false, closed: c.closed, area: 0 },
        { tolerance: opt.tolerance, diagonalPx, preferCircles: c.closed },
      ),
    );
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const put = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of prims) {
    if (p.kind === "line") {
      put(p.x1, p.y1);
      put(p.x2, p.y2);
    } else if (p.kind === "polyline") for (const q of p.pts) put(q.x, q.y);
    else {
      put(p.cx - p.r, p.cy - p.r);
      put(p.cx + p.r, p.cy + p.r);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = width;
    maxY = height;
  }

  return {
    prims,
    stats: {
      lines: prims.filter((p) => p.kind === "line").length,
      circles: prims.filter((p) => p.kind === "circle").length,
      arcs: prims.filter((p) => p.kind === "arc").length,
      polylines: prims.filter((p) => p.kind === "polyline").length,
      contours: chains.length,
      holes: 0,
    },
    centerline: {
      strokes: chains.length,
      lines: prims.filter((p) => p.kind === "line").length,
      arcs: prims.filter((p) => p.kind === "arc").length,
      circles: prims.filter((p) => p.kind === "circle").length,
      polylines: prims.filter((p) => p.kind === "polyline").length,
    },
    imagePx: { w: width, h: height },
    contentPx: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    tolerancePx: Math.max(0.8, diagonalPx * 0.006),
  };
}
