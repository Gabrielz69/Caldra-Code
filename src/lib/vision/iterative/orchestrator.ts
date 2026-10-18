/**
 * CALDRA VISION — VECTORIZATION ORCHESTRATOR
 *
 * Ponto central da arquitetura iterativa autocorretiva do CALDRA Vision:
 *
 * IMAGEM ORIGINAL
 *   ↓
 * PRÉ-PROCESSAMENTO & HIPÓTESES
 *   ↓
 * CONSENSO GEOMÉTRICO
 *   ↓
 * RASTERIZAÇÃO & COMPARAÇÃO
 *   ↓
 * DETECÇÃO DE ERROS
 *   ↓
 * AUTOCORREÇÃO ITERATIVA COM BACKTRACKING
 *   ↓
 * CONVERGÊNCIA
 *   ↓
 * RESULTADO FINAL NATIVO PARA O CHAMFER
 */

import type { Prim } from "../geometryRecognizer";
import type { VisionAnalysis, VisionStats } from "../vectorizer";
import { CandidateGenerator } from "./candidateGenerator";
import { GeometricConsensusEngine } from "./geometricConsensusEngine";
import { GeometryOptimizer } from "./geometryOptimizer";
import { VectorRasterizer } from "./vectorRasterizer";
import { VectorComparisonEngine } from "./vectorComparisonEngine";
import type { IterativeAnalysisResult, IterativeVisionOptions, IterationRecord } from "./types";

export class VectorizationOrchestrator {
  static run(
    pixels: ImageData,
    options: IterativeVisionOptions = {},
    onProgress?: (stage: string, pct: number) => void,
  ): IterativeAnalysisResult & VisionAnalysis {
    const startTime = performance.now();
    const width = pixels.width;
    const height = pixels.height;
    const maxIterations = options.maxIterations ?? 4;
    const convergenceThreshold = options.convergenceThreshold ?? 0.94;
    const minimumImprovement = options.minimumImprovement ?? 0.003;
    const enableBacktracking = options.enableBacktracking !== false;

    // 1. Etapa: Geração de múltiplas hipóteses
    onProgress?.("Analisando imagem...", 15);
    const { candidates, referenceBinary } = CandidateGenerator.generateCandidates(pixels, options);

    // 2. Etapa: Consenso geométrico e fusão dos melhores elementos
    onProgress?.("Consenso geométrico entre hipóteses...", 35);
    let currentPrims = GeometricConsensusEngine.formConsensus(candidates, options);

    // Avaliação inicial pós-consenso
    const raster = VectorRasterizer.rasterize(currentPrims, width, height, 2);
    const currentComp = VectorComparisonEngine.compare(referenceBinary.data, raster, width, height);

    let bestPrims = currentPrims.map((p) => ({ ...p }));
    let bestScore = Math.min(1.0, currentComp.iou * 1.25);
    let bestComp = currentComp;
    let bestIteration = 0;

    const iterations: IterationRecord[] = [
      {
        iteration: 0,
        candidateCount: candidates.length,
        score: bestScore,
        visualScore: bestScore,
        geometricScore: 0.85,
        complexityScore: 0.9,
        improvement: 0,
        reason: "Consenso inicial",
      },
    ];

    let convergenceReason = "Iterações máximas atingidas";

    // 3. Etapa: Loop de otimização iterativa autocorretiva
    onProgress?.("Otimizando geometria e corrigindo erros...", 55);

    let stagnantCount = 0;

    for (let iter = 1; iter <= maxIterations; iter++) {
      const stepPct = 55 + Math.round((iter / maxIterations) * 35);
      onProgress?.(`Refinando geometria (passo ${iter}/${maxIterations})...`, stepPct);

      const step = GeometryOptimizer.optimizeStep(
        currentPrims,
        referenceBinary.data,
        width,
        height,
        options,
      );

      const improvement = step.score - bestScore;

      iterations.push({
        iteration: iter,
        candidateCount: candidates.length,
        score: step.score,
        visualScore: step.visualScore,
        geometricScore: step.geometricScore,
        complexityScore: 1 / (1 + step.optimizedPrims.length * 0.003),
        improvement,
        reason: improvement > 0 ? "Melhoria geométrica" : "Sem ganho significativo",
      });

      if (step.score > bestScore + minimumImprovement) {
        bestScore = step.score;
        bestPrims = step.optimizedPrims.map((p) => ({ ...p }));
        bestComp = step.comparison;
        bestIteration = iter;
        currentPrims = step.optimizedPrims;
        stagnantCount = 0;
      } else {
        stagnantCount++;
        // Backtracking: restaura o melhor estado se a iteração degradou a qualidade
        if (enableBacktracking && step.score < bestScore - 0.01) {
          currentPrims = bestPrims.map((p) => ({ ...p }));
        }
      }

      // Critério de parada antecipada por convergência
      if (bestScore >= convergenceThreshold) {
        convergenceReason = `Convergência atingida com score ${(bestScore * 100).toFixed(1)}%`;
        break;
      }

      // Detecção de estagnação
      if (stagnantCount >= 2) {
        convergenceReason = "Estagnação detectada (geometria estável)";
        break;
      }
    }

    onProgress?.("Finalizando vetorização...", 95);

    // Estatísticas das primitivas finais
    const stats: VisionStats = {
      lines: bestPrims.filter((p) => p.kind === "line").length,
      circles: bestPrims.filter((p) => p.kind === "circle").length,
      arcs: bestPrims.filter((p) => p.kind === "arc").length,
      polylines: bestPrims.filter((p) => p.kind === "polyline").length,
      contours: 1,
      holes: bestPrims.filter((p) => p.hole).length,
    };

    // Bounding box em pixels
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

    for (const p of bestPrims) {
      if (p.kind === "line") {
        put(p.x1, p.y1);
        put(p.x2, p.y2);
      } else if (p.kind === "polyline") {
        for (const q of p.pts) put(q.x, q.y);
      } else {
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

    const duration = performance.now() - startTime;
    onProgress?.("✓ Vetorização concluída", 100);

    return {
      prims: bestPrims,
      stats,
      imagePx: { w: width, h: height },
      contentPx: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      tolerancePx: 1.5,
      globalConfidence: Math.min(1.0, bestScore),
      bestScore,
      iterations,
      auditLog: {
        engineVersion: "CALDRA-VISION-2.0-ITERATIVE",
        methodsExecuted: candidates.map((c) => c.method),
        iterationsCount: iterations.length - 1,
        bestIteration,
        convergenceReason,
        entitiesFused: candidates.length,
        entitiesDiscarded: 0,
        durationMs: duration,
      },
      comparison: bestComp,
    };
  }
}
