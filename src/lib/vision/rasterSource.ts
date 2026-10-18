/**
 * rasterSource — rasterização na thread principal (depende de canvas/DOM).
 * O resultado é enviado ao Web Worker, que roda o resto da pipeline.
 */

import { rasterize } from "./imagePreprocessor";
import type { AnalyzeOptions } from "./vectorizer";
import type { CenterlineOptions } from "./centerlinePipeline";
import type { LogoOptions } from "./logoPipeline";

export function rasterForTecnico(img: HTMLImageElement, opt: AnalyzeOptions): ImageData {
  return rasterize(img, opt).pixels;
}

export function rasterForTracado(img: HTMLImageElement, opt: CenterlineOptions): ImageData {
  return rasterize(img, opt).pixels;
}

/** No modo LOGO a ampliação acontece aqui; multi-escala reamostra no worker. */
export function rasterForLogo(
  img: HTMLImageElement,
  opt: LogoOptions,
  multiScale: boolean,
): ImageData {
  const scale = multiScale ? 4 : Math.max(1, Math.min(4, opt.upscale));
  return rasterize(img, {
    maxSize: Math.round(Math.max(img.naturalWidth, img.naturalHeight) * scale),
  }).pixels;
}

/** Amostra pequena para o relatório pré-flight (rápida e suficiente). */
export function rasterForProfile(img: HTMLImageElement, rotationDeg = 0): ImageData {
  return rasterize(img, { maxSize: 900, rotationDeg }).pixels;
}
