// @ts-nocheck
/**
 * CALDRA VISION — CANDIDATE GENERATOR & EVALUATOR
 *
 * Gera múltiplas hipóteses vetoriais (VectorCandidate) variando algoritmos
 * de binarização (Sauvola vs Otsu), tolerâncias adaptativas, prioridades geométricas
 * e avalia cada hipótese segundo critérios visuais, técnicos e de simplicidade.
 */

import {
  binarize,
  denoise,
  normalizeContrast,
  sauvolaBinarize,
  type Binary,
} from "../imagePreprocessor";
import { extractContours } from "../visionEngine";
import {
  recognizeContour,
  TOLERANCE_FACTOR,
  type Prim,
  type Tolerance,
} from "../geometryRecognizer";
import { fitContourHQ } from "../contourFitter";
import { VectorRasterizer } from "./vectorRasterizer";
import { VectorComparisonEngine } from "./vectorComparisonEngine";
import type { VectorCandidate, IterativeVisionOptions } from "./types";

export class CandidateGenerator {
  /**
   * Gera um conjunto diversificado de hipóteses vetoriais para uma imagem rasterizada.
   */
  static generateCandidates(
    pixels: ImageData,
    options: IterativeVisionOptions = {},
  ): { candidates: VectorCandidate[]; referenceBinary: Binary } {
    const width = pixels.width;
    const height = pixels.height;
    const diagonalPx = Math.hypot(width, height);
    const userTol: Tolerance = options.tolerance ?? "media";

    // 1. Gera a máscara binária de referência padrão (Sauvola adaptativo + normalização de contraste)
    const normalized = normalizeContrast(pixels);
    const referenceBinary = denoise(sauvolaBinarize(normalized), 1);

    const candidates: VectorCandidate[] = [];

    // Definição das configurações de cada hipótese
    const configs = [
      {
        id: "cand_sauvola_hq_norm",
        method: "Sauvola HQ + Mínimos Quadrados + Regularização",
        bin: referenceBinary,
        hq: true,
        preferCircles: true,
        regularize: true,
        tolerance: userTol,
      },
      {
        id: "cand_sauvola_circle_priority",
        method: "Sauvola Alta Sensibilidade + Foco em Círculos e Furos",
        bin: denoise(sauvolaBinarize(pixels, { k: 0.15 }), 0),
        hq: true,
        preferCircles: true,
        regularize: false,
        tolerance: "baixa" as Tolerance,
      },
      {
        id: "cand_otsu_global",
        method: "Otsu Global + Reconhecimento Técnico",
        bin: denoise(binarize(normalized, false), 1),
        hq: true,
        preferCircles: false,
        regularize: true,
        tolerance: userTol,
      },
      {
        id: "cand_denoised_smooth",
        method: "Filtro Anti-Ruído Avançado + Curvatura",
        bin: denoise(referenceBinary, 2),
        hq: false,
        preferCircles: true,
        regularize: true,
        tolerance: "alta" as Tolerance,
      },
    ];

    // Se o contraste geral for invertido (fundo escuro / linhas claras), adiciona hipótese invertida
    let darkPixels = 0;
    const sampleStep = Math.max(1, Math.floor(pixels.data.length / (4 * 5000)));
    for (let i = 0; i < pixels.data.length; i += 4 * sampleStep) {
      const lum = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
      if (lum < 100) darkPixels++;
    }
    const isDarkBackground = darkPixels / (pixels.data.length / (4 * sampleStep)) > 0.6;

    if (isDarkBackground) {
      configs.push({
        id: "cand_inverted_polar",
        method: "Inversão de Polaridade (Fundo Escuro)",
        bin: denoise(sauvolaBinarize(pixels, { invert: true }), 1),
        hq: true,
        preferCircles: true,
        regularize: true,
        tolerance: userTol,
      });
    }

    // Processa e avalia cada configuração
    for (const cfg of configs) {
      const minPixels = Math.max(10, Math.round((width * height) / 45000));
      const contours = extractContours(cfg.bin, { minPixels });
      const maxDevPx = Math.max(0.8, TOLERANCE_FACTOR[cfg.tolerance] * diagonalPx);

      const prims: Prim[] = [];
      for (const c of contours) {
        if (!cfg.hq) {
          prims.push(...recognizeContour(c, { tolerance: cfg.tolerance, diagonalPx }));
        } else {
          prims.push(
            ...fitContourHQ(c, {
              maxDevPx,
              diagonalPx,
              preferCircles: cfg.preferCircles,
              regularize: cfg.regularize,
            }),
          );
        }
      }

      // Avaliação da hipótese
      const candidate = this.evaluateCandidate(
        cfg.id,
        cfg.method,
        prims,
        referenceBinary.data,
        width,
        height,
      );
      candidates.push(candidate);
    }

    return { candidates, referenceBinary };
  }

  /**
   * Avalia uma hipótese calculando visualScore, geometricScore, complexityScore e finalScore.
   */
  static evaluateCandidate(
    id: string,
    method: string,
    prims: Prim[],
    referenceMask: Uint8Array,
    width: number,
    height: number,
  ): VectorCandidate {
    // 1. Rasteriza o candidato
    const raster = VectorRasterizer.rasterize(prims, width, height, 2);

    // 2. Compara com a referência original
    const comparison = VectorComparisonEngine.compare(referenceMask, raster, width, height);
    const visualScore = Math.min(1.0, comparison.iou * 1.25);

    // 3. Avalia validade técnica/geométrica
    let technicalCount = 0;
    let polylineCount = 0;
    for (const p of prims) {
      if (p.kind === "circle" || p.kind === "arc" || p.kind === "line") {
        technicalCount++;
      } else {
        polylineCount++;
      }
    }
    const totalPrims = Math.max(1, prims.length);
    const geometricScore = technicalCount / totalPrims;

    // 4. Penalidade de complexidade (favorece representação concisa e limpa)
    const complexityScore = 1 / (1 + totalPrims * 0.003);

    // 5. Score topológico (evita fragmentos isolados minúsculos)
    const topologyScore = 1 - Math.min(0.5, polylineCount * 0.05);

    // Score ponderado
    const finalScore =
      visualScore * 0.45 + geometricScore * 0.35 + topologyScore * 0.1 + complexityScore * 0.1;

    const confidence = Math.max(0.1, Math.min(1.0, visualScore * 0.6 + geometricScore * 0.4));

    return {
      id,
      method,
      scale: 1,
      parameters: {},
      prims,
      visualScore,
      geometricScore,
      topologyScore,
      complexityScore,
      finalScore,
      confidence,
    };
  }
}
