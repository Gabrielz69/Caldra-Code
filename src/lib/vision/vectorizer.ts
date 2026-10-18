/**
 * vectorizer — orquestra a pipeline e converte primitivas (px) em entidades
 * do MODELO INTERNO do CHAMFER (mm). Não existe modelo paralelo.
 */

import { uid, type Entity } from "@/lib/lab2d/core";
import {
  binarize,
  denoise,
  normalizeContrast,
  rasterize,
  sauvolaBinarize,
  type PreprocessOptions,
} from "./imagePreprocessor";
import { extractContours } from "./visionEngine";
import {
  recognizeContour,
  TOLERANCE_FACTOR,
  type Prim,
  type Tolerance,
} from "./geometryRecognizer";
import { fitContourHQ } from "./contourFitter";
import type { Calibration } from "./scaleCalibrationService";

import { VectorizationOrchestrator } from "./iterative";

import type { IterationRecord, IterativeAuditLog, ComparisonMetrics } from "./iterative";

export type VisionStats = {
  lines: number;
  circles: number;
  arcs: number;
  polylines: number;
  contours: number;
  holes: number;
};

export type VisionAnalysis = {
  prims: Prim[];
  stats: VisionStats;
  /** Tamanho da imagem analisada, em px. */
  imagePx: { w: number; h: number };
  /** Extensão da geometria detectada, em px. */
  contentPx: { x: number; y: number; w: number; h: number };
  tolerancePx: number;
  iterations?: IterationRecord[];
  auditLog?: IterativeAuditLog;
  bestScore?: number;
  comparison?: ComparisonMetrics;
};

export type AnalyzeOptions = PreprocessOptions & {
  tolerance: Tolerance;
  /** Intensidade da remoção de ruído (0 = desligada). */
  noise?: number;
  /** Reconhecimento por cantos + ajuste por mínimos quadrados (padrão: ligado). */
  hq?: boolean;
  /** Limiar local de Sauvola em vez do global de Otsu. */
  adaptive?: boolean;
  /** Normaliza o contraste antes do limiar. */
  normalize?: boolean;
  /** Ortogonaliza/fecha dentro da tolerância (padrão: ligado). */
  regularize?: boolean;
  /** Ativa o motor CALDRA Vision de vetorização iterativa autocorretiva (padrão: ligado). */
  iterativeAutoCorrect?: boolean;
  maxIterations?: number;
  convergenceThreshold?: number;
};

/** ETAPA COMPLETA: imagem → primitivas geométricas (ainda em pixels). */
export function analyzeImage(img: HTMLImageElement, opt: AnalyzeOptions): VisionAnalysis {
  const { pixels } = rasterize(img, opt);
  return analyzeRaster(pixels, opt);
}

/** Mesma análise a partir de pixels já rasterizados — usada no Web Worker. */
export function analyzeRaster(
  input: ImageData,
  opt: AnalyzeOptions,
  onProgress?: (stage: string, pct: number) => void,
): VisionAnalysis {
  // Se a vetorização iterativa autocorretiva estiver habilitada (padrão), roda o Orchestrator
  if (opt.iterativeAutoCorrect !== false) {
    return VectorizationOrchestrator.run(
      input,
      {
        tolerance: opt.tolerance,
        maxIterations: opt.maxIterations ?? 4,
        convergenceThreshold: opt.convergenceThreshold ?? 0.94,
      },
      onProgress,
    );
  }

  const width = input.width;
  const height = input.height;
  onProgress?.("Binarizando", 10);
  const pixels = opt.normalize ? normalizeContrast(input) : input;
  const bin = denoise(
    opt.adaptive
      ? sauvolaBinarize(pixels, { invert: opt.invert ?? false })
      : binarize(pixels, opt.invert),
    opt.noise ?? 1,
  );
  const diagonalPx = Math.hypot(width, height);
  const minPixels = Math.max(12, Math.round((width * height) / 40000) * ((opt.noise ?? 1) ? 2 : 1));
  onProgress?.("Extraindo contornos", 40);
  const contours = extractContours(bin, { minPixels });

  onProgress?.("Reconhecendo geometria", 70);
  const maxDevPx = Math.max(0.8, TOLERANCE_FACTOR[opt.tolerance] * diagonalPx);
  const prims: Prim[] = [];
  for (const c of contours) {
    if (opt.hq === false)
      prims.push(...recognizeContour(c, { tolerance: opt.tolerance, diagonalPx }));
    else
      prims.push(
        ...fitContourHQ(c, {
          maxDevPx,
          diagonalPx,
          preferCircles: true,
          regularize: opt.regularize !== false,
        }),
      );
  }

  const stats: VisionStats = {
    lines: prims.filter((p) => p.kind === "line").length,
    circles: prims.filter((p) => p.kind === "circle").length,
    arcs: prims.filter((p) => p.kind === "arc").length,
    polylines: prims.filter((p) => p.kind === "polyline").length,
    contours: contours.filter((c) => !c.hole).length,
    holes: contours.filter((c) => c.hole).length,
  };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
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

  onProgress?.("Finalizando", 95);
  return {
    prims,
    stats,
    imagePx: { w: width, h: height },
    contentPx: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    tolerancePx: maxDevPx,
  };
}

/** Converte primitivas em entidades do CHAMFER, já em milímetros. */
export function toEntities(analysis: VisionAnalysis, cal: Calibration, layer = "corte"): Entity[] {
  const s = cal.mmPerPx;
  const ox = analysis.contentPx.x;
  const oy = analysis.contentPx.y;
  const mx = (x: number) => (x - ox) * s;
  const my = (y: number) => (y - oy) * s;

  const out: Entity[] = [];
  for (const p of analysis.prims) {
    if (p.kind === "line")
      out.push({
        id: uid(),
        layer,
        type: "line",
        x1: mx(p.x1),
        y1: my(p.y1),
        x2: mx(p.x2),
        y2: my(p.y2),
      });
    else if (p.kind === "circle")
      out.push({ id: uid(), layer, type: "circle", cx: mx(p.cx), cy: my(p.cy), r: p.r * s });
    else if (p.kind === "arc")
      out.push({
        id: uid(),
        layer,
        type: "arc",
        cx: mx(p.cx),
        cy: my(p.cy),
        r: p.r * s,
        a0: p.a0,
        a1: p.a1,
      });
    else
      out.push({
        id: uid(),
        layer,
        type: "polyline",
        closed: p.closed,
        pts: p.pts.map((q) => ({ x: mx(q.x), y: my(q.y) })),
      });
  }
  return out;
}
