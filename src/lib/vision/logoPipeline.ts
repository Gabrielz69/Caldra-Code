/**
 * logoPipeline — modo LOGO do CHAMFER VISION.
 *
 * Diferente do modo técnico (que procura LINE/ARC/CIRCLE), o modo logo
 * preserva as curvas orgânicas como curvas de Bézier reais (entidade `path`,
 * exportada como SPLINE no DXF). Isso dá fidelidade máxima com geometria
 * enxuta: nada de 800 microsegmentos nem de "C" virando polígono anguloso.
 *
 * Etapas: upscale → blur (JPG) → threshold → morfologia → traçado Potrace
 * → hierarquia externo/furo → reconhecimento seletivo de círculos → mm.
 */

import { uid, type Entity } from "@/lib/lab2d/core";
import { circleFromPath, mapPath } from "@/lib/lab2d/bezier";
import type { Vec2 } from "@/lib/geometry/types";
import {
  closeHoles,
  gaussianBlur,
  rasterize,
  resampleImageData,
  thresholdBinarize,
  type Binary,
} from "./imagePreprocessor";

import { maskForSwatch, quantize, type Swatch } from "./colorQuantizer";
import { DEFAULT_TRACE, tracePaths, type TraceOptions, type TracedPath } from "./logoTracer";
import type { Calibration } from "./scaleCalibrationService";

export type LogoOptions = TraceOptions & {
  /** Fator de ampliação antes de binarizar (2–4 dá o melhor contorno). */
  upscale: number;
  /** Raio do blur gaussiano — só útil em JPG (ruído de mosquito na borda). */
  blur: number;
  /** Limiar manual 0–255. */
  threshold: number;
  /** Inverte tinta/fundo. */
  invert: boolean;
  /** Passes de fechamento de microburacos. */
  closeHoles: number;
  /** Converte furos perfeitamente circulares em CIRCLE. */
  detectCircles: boolean;
  /** Vetorizar por cor: número de cores da paleta (1 = monocromático). */
  colors: number;
};

export const DEFAULT_LOGO: LogoOptions = {
  ...DEFAULT_TRACE,
  upscale: 3,
  blur: 0,
  threshold: 128,
  invert: false,
  closeHoles: 1,
  detectCircles: true,
  colors: 1,
};

export type LogoLayerResult = {
  /** Cor de origem quando a logo é multicolorida (null = monocromática). */
  swatch: Swatch | null;
  paths: TracedPath[];
};

export type LogoAnalysis = {
  layers: LogoLayerResult[];
  imagePx: { w: number; h: number };
  contentPx: { x: number; y: number; w: number; h: number };
  stats: { contours: number; holes: number; segments: number; curves: number };
  palette: Swatch[];
  /** Reconhecimento seletivo de círculos pedido na análise. */
  detectCircles: boolean;
};

function boundsOf(layers: LogoLayerResult[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const put = (p: Vec2) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const l of layers)
    for (const t of l.paths) {
      put(t.start);
      for (const s of t.segs) {
        put(s.p);
        if (!s.line) {
          put(s.c1);
          put(s.c2);
        }
      }
    }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** IMAGEM → contornos de Bézier (ainda em pixels da imagem ampliada). */
export function analyzeLogo(img: HTMLImageElement, opt: LogoOptions): LogoAnalysis {
  const scale = Math.max(1, Math.min(4, opt.upscale));
  const raster = rasterize(img, { maxSize: Math.round(Math.max(img.width, img.height) * scale) });
  return analyzeLogoRaster(raster.pixels, opt);
}

/**
 * Traçado a partir de pixels já ampliados — usado no Web Worker.
 * Com `multiScale`, traça em 1×, 2× e 4× (reamostrando o raster recebido) e
 * escolhe o resultado mais suave/fiel por métrica objetiva.
 */
export function analyzeLogoRaster(
  input: ImageData,
  opt: LogoOptions,
  onProgress?: (stage: string, pct: number) => void,
  multiScale = false,
): LogoAnalysis {
  const run = (source: ImageData): LogoAnalysis => {
    const pixels = opt.blur > 0 ? gaussianBlur(source, opt.blur) : source;

    const prep = (bin: Binary) => (opt.closeHoles > 0 ? closeHoles(bin, opt.closeHoles) : bin);
    const trace = (bin: Binary) => tracePaths(prep(bin), opt);

    const layers: LogoLayerResult[] = [];
    let palette: Swatch[] = [];

    if (opt.colors > 1) {
      palette = quantize(pixels, opt.colors);
      palette.forEach((sw, i) => {
        const paths = trace(maskForSwatch(pixels, palette, i));
        if (paths.length) layers.push({ swatch: sw, paths });
      });
    } else {
      layers.push({
        swatch: null,
        paths: trace(thresholdBinarize(pixels, opt.threshold, opt.invert)),
      });
    }
    return finish(layers, palette, source.width, source.height, opt);
  };

  onProgress?.("Traçando contornos", 35);
  if (!multiScale) return run(input);

  // MULTI-ESCALA: mesma imagem em 1×, 2× e 4× → melhor pontuação vence
  const candidates: LogoAnalysis[] = [];
  const factors = [0.25, 0.5, 1];
  factors.forEach((f, i) => {
    onProgress?.(`Traçando ${f * 4}×`, 30 + i * 20);
    try {
      candidates.push(run(resampleImageData(input, f)));
    } catch {
      /* escala descartada */
    }
  });
  const scored = candidates
    .filter((c) => c.stats.contours + c.stats.holes > 0)
    .map((c) => {
      const smooth = c.stats.segments ? c.stats.curves / c.stats.segments : 0;
      const perContour = c.stats.segments / Math.max(1, c.stats.contours + c.stats.holes);
      return { c, score: smooth * 100 - Math.abs(perContour - 14) };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.c ?? run(input);
}

function finish(
  layers: LogoLayerResult[],
  palette: Swatch[],
  width: number,
  height: number,
  opt: LogoOptions,
): LogoAnalysis {
  let segments = 0;
  let holes = 0;
  let contours = 0;
  for (const l of layers)
    for (const t of l.paths) {
      segments += t.segs.length;
      if (t.hole) holes++;
      else contours++;
    }

  return {
    layers,
    imagePx: { w: width, h: height },
    contentPx: boundsOf(layers),
    stats: {
      contours,
      holes,
      segments,
      curves: layers.reduce(
        (n, l) => n + l.paths.reduce((m, t) => m + t.segs.filter((s) => !s.line).length, 0),
        0,
      ),
    },
    palette,
    detectCircles: opt.detectCircles,
  };
}

/**
 * Contornos → entidades do modelo interno, já em milímetros.
 * Curvas continuam curvas (`path`); só furos perfeitamente circulares
 * viram CIRCLE — o caso do furo de fixação e do olho do personagem.
 */
export function logoToEntities(
  analysis: LogoAnalysis,
  cal: Calibration,
  layer = "corte",
  layerForSwatch?: (sw: Swatch, index: number) => string,
): Entity[] {
  const s = cal.mmPerPx;
  const ox = analysis.contentPx.x;
  const oy = analysis.contentPx.y;
  const to = (p: Vec2): Vec2 => ({ x: (p.x - ox) * s, y: (p.y - oy) * s });

  const out: Entity[] = [];
  analysis.layers.forEach((l, li) => {
    const target = l.swatch && layerForSwatch ? layerForSwatch(l.swatch, li) : layer;
    // ids estáveis por índice para preservar a hierarquia externo → furo
    const ids = l.paths.map(() => uid());
    l.paths.forEach((t, i) => {
      const m = mapPath(t.start, t.segs, to);
      if (analysis.detectCircles) {
        // tolerância proporcional ao próprio contorno: 2% do raio médio
        const pts = [m.start, ...m.segs.map((g) => g.p)];
        const rx = (Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x))) / 2;
        const ry = (Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y))) / 2;
        const c = circleFromPath(m.start, m.segs, Math.max(0.02, ((rx + ry) / 2) * 0.04));
        if (c) {
          out.push({ id: ids[i]!, layer: target, type: "circle", cx: c.cx, cy: c.cy, r: c.r });
          return;
        }
      }
      out.push({
        id: ids[i]!,
        layer: target,
        type: "path",
        start: m.start,
        segs: m.segs,
        closed: true,
        hole: t.hole,
        ...(t.parent !== null && ids[t.parent] ? { parent: ids[t.parent]! } : {}),
      });
    });
  });
  return out;
}
