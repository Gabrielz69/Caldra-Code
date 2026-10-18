/**
 * CALDRA VISION — ITERATIVE SELF-CORRECTING VECTORIZATION TYPES
 *
 * Estruturas para geração de hipóteses, consenso geométrico,
 * comparação com imagem original, otimização iterativa e controle de convergência.
 */

import type { Prim, Tolerance } from "../geometryRecognizer";
import type { VisionStats } from "../vectorizer";

export interface VectorCandidate {
  id: string;
  method: string;
  scale: number;
  parameters: Record<string, unknown>;
  prims: Prim[];
  visualScore: number; // 0..1 (fidelidade aos pixels da imagem)
  geometricScore: number; // 0..1 (validade técnica: retas, círculos perfeitos, ortogonalidade)
  topologyScore: number; // 0..1 (ausência de gaps espúrios, fechamento)
  complexityScore: number; // 0..1 (penalidade para fragmentação/microsegmentos)
  finalScore: number; // 0..1 (score ponderado global)
  confidence: number; // 0..1
}

export interface IterativeVisionOptions {
  tolerance?: Tolerance;
  maxIterations?: number; // padrão: 5
  convergenceThreshold?: number; // padrão: 0.95
  minimumImprovement?: number; // padrão: 0.005
  geometryTolerance?: number; // px (padrão: 1.5)
  angularToleranceDeg?: number; // graus (padrão: 2.0°)
  coincidenceTolerance?: number; // px para snap de extremidades (padrão: 3.0)
  enableBacktracking?: boolean; // padrão: true
  debug?: boolean;
}

export interface IterationRecord {
  iteration: number;
  candidateCount: number;
  score: number;
  visualScore: number;
  geometricScore: number;
  complexityScore: number;
  improvement: number;
  reason: string;
}

export interface ComparisonMetrics {
  iou: number; // Intersection over Union (0..1)
  pixelFidelity: number; // Percentual de pixels coincidentes (0..1)
  missingPixelsRatio: number; // Pixels na imagem não cobertos pelo vetor
  extraPixelsRatio: number; // Pixels no vetor não presentes na imagem
  meanEdgeErrorPx: number; // Erro médio de borda em px
  maxEdgeErrorPx: number; // Erro máximo de borda em px
  errorMap?: Uint8Array; // Mapa binário de divergências (1 = erro, 0 = coincidente)
}

export interface IterativeAuditLog {
  engineVersion: string;
  methodsExecuted: string[];
  iterationsCount: number;
  bestIteration: number;
  convergenceReason: string;
  entitiesFused: number;
  entitiesDiscarded: number;
  durationMs: number;
}

export interface IterativeAnalysisResult {
  prims: Prim[];
  stats: VisionStats;
  imagePx: { w: number; h: number };
  contentPx: { x: number; y: number; w: number; h: number };
  tolerancePx: number;
  globalConfidence: number;
  bestScore: number;
  iterations: IterationRecord[];
  auditLog: IterativeAuditLog;
  comparison?: ComparisonMetrics;
}
