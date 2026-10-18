/**
 * pipeline — ponto único de execução do CHAMFER VISION.
 *
 * Recebe PIXELS já rasterizados (a rasterização depende de canvas/DOM e fica
 * na thread principal) e roda binarização → traçado → reconhecimento →
 * normalização. Roda igual dentro do Web Worker e como fallback síncrono.
 */

import { analyzeRaster, type AnalyzeOptions, type VisionAnalysis } from "./vectorizer";
import {
  analyzeCenterlineRaster,
  type CenterlineAnalysis,
  type CenterlineOptions,
} from "./centerlinePipeline";
import { analyzeLogoRaster, type LogoAnalysis, type LogoOptions } from "./logoPipeline";

export type VisionProgress = { stage: string; pct: number };

export type VisionRequest =
  | { mode: "tecnico"; pixels: ImageData; opt: AnalyzeOptions }
  | { mode: "tracado"; pixels: ImageData; opt: CenterlineOptions }
  | { mode: "logo"; pixels: ImageData; opt: LogoOptions; multiScale?: boolean };

export type VisionResult =
  | { mode: "tecnico"; analysis: VisionAnalysis }
  | { mode: "tracado"; analysis: CenterlineAnalysis }
  | { mode: "logo"; analysis: LogoAnalysis };

export function runVisionPipeline(
  req: VisionRequest,
  onProgress?: (p: VisionProgress) => void,
): VisionResult {
  const report = (stage: string, pct: number) => onProgress?.({ stage, pct });
  report("Preparando imagem", 5);
  if (req.mode === "logo") {
    const analysis = analyzeLogoRaster(req.pixels, req.opt, report, req.multiScale);
    report("Concluído", 100);
    return { mode: "logo", analysis };
  }
  if (req.mode === "tracado") {
    const analysis = analyzeCenterlineRaster(req.pixels, req.opt, report);
    report("Concluído", 100);
    return { mode: "tracado", analysis };
  }
  const analysis = analyzeRaster(req.pixels, req.opt, report);
  report("Concluído", 100);
  return { mode: "tecnico", analysis };
}
