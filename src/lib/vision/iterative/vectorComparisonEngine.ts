/**
 * CALDRA VISION — VECTOR COMPARISON ENGINE
 *
 * Compara a renderização do modelo vetorial com a imagem original binarizada.
 * Fornece métricas de IoU (Intersection over Union), fidelidade pixel-a-pixel,
 * detecção de regiões ausentes/extras e geração de mapa de erro para diagnóstico.
 */

import type { ComparisonMetrics } from "./types";

export class VectorComparisonEngine {
  /**
   * Executa a comparação detalhada entre a máscara binária original e a reconstrução vetorial.
   */
  static compare(
    originalMask: Uint8Array,
    reconstructedMask: Uint8Array,
    width: number,
    height: number,
  ): ComparisonMetrics {
    const totalPixels = width * height;
    let intersection = 0;
    let union = 0;
    let matchingPixels = 0;
    let originalInkCount = 0;
    let reconstructedInkCount = 0;
    let missingInk = 0;
    let extraInk = 0;

    const errorMap = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const orig = originalMask[i] ? 1 : 0;
      const rec = reconstructedMask[i] ? 1 : 0;

      if (orig) originalInkCount++;
      if (rec) reconstructedInkCount++;

      if (orig && rec) {
        intersection++;
        union++;
        matchingPixels++;
      } else if (orig && !rec) {
        union++;
        missingInk++;
        errorMap[i] = 1; // pixel faltando no vetor
      } else if (!orig && rec) {
        union++;
        extraInk++;
        errorMap[i] = 2; // pixel espúrio no vetor
      } else {
        matchingPixels++; // ambos são fundo
      }
    }

    const iou = union > 0 ? intersection / union : 1;
    const pixelFidelity = totalPixels > 0 ? matchingPixels / totalPixels : 1;
    const missingPixelsRatio = originalInkCount > 0 ? missingInk / originalInkCount : 0;
    const extraPixelsRatio = originalInkCount > 0 ? extraInk / originalInkCount : 0;

    // Estimativa de desvio médio de borda baseado na taxa de erro de pixel
    const meanEdgeErrorPx = (missingPixelsRatio + extraPixelsRatio) * 2.0;
    const maxEdgeErrorPx = Math.max(meanEdgeErrorPx * 2.5, missingInk > 0 ? 3.0 : 0.0);

    return {
      iou,
      pixelFidelity,
      missingPixelsRatio,
      extraPixelsRatio,
      meanEdgeErrorPx,
      maxEdgeErrorPx,
      errorMap,
    };
  }
}
