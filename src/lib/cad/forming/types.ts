/**
 * CALDRA CAD — FORMING TOOLS, ADVANCED SHEET METAL & PRESS BRAKE SIMULATION (FASE 12)
 *
 * Estruturas para modelagem paramétrica de conformação e estamparia em chapas metálicas:
 *  - Nervuras de reforço em dobras (Sheet Metal Gussets)
 *  - Venezianas de respiro e ventilação (Louvers)
 *  - Estampos, rebaixos e repuxos (Embosses, Countersinks e Extruded Flanges)
 *  - Bainhas industriais (Closed, Open, Teardrop e Rolled Hems)
 *  - Degraus de encaixe (Jog / Joggle Flanges)
 *  - Simulação analítica de força de dobra (Press Brake Tonnage) e retorno elástico (Springback)
 */

import type { Vector2D, Vector3D } from "../canonical";
import type { Entity } from "@/lib/lab2d/core";

export type GussetType = "FLAT" | "ROUNDED";

export interface SheetMetalGussetDef {
  id: string;
  name?: string;
  bendLineId: string;
  type: GussetType;
  /** Posição relativa ao longo da linha de dobra (0.0 = início, 0.5 = centro, 1.0 = fim) */
  normalizedPosition: number;
  /** Profundidade/alcance do repuxo nas faces adjacentes da dobra em mm (ex: 20 mm) */
  depthMm: number;
  /** Largura da base do punção de conformação em mm (ex: 10 mm) */
  widthMm: number;
  /** Espessura nominal da chapa em mm */
  thicknessMm: number;
  /** Raio da ponta do punção em mm */
  punchRadiusMm: number;
  /** Ângulo de saída das paredes laterais do repuxo em graus (ex: 10°) */
  draftAngleDeg?: number;
}

export type LouverCutSide = "LEFT" | "RIGHT";

export interface SheetMetalLouverDef {
  id: string;
  name?: string;
  /** Posição 2D de ancoragem central na face da chapa (mm) */
  position: Vector2D;
  /** Ângulo de rotação da fresta da veneziana em graus (0° = horizontal) */
  rotationDeg: number;
  /** Comprimento total da aleta em mm (ex: 120 mm) */
  lengthMm: number;
  /** Altura máxima do respiro / deformação externa em mm (ex: 8 mm) */
  heightMm: number;
  /** Profundidade da cavidade interna em mm (ex: 6 mm) */
  depthMm: number;
  /** Lado em que o metal é cisalhado/aberto */
  cutSide: LouverCutSide;
  /** Raio de concordância no arredondamento traseiro da cúpula em mm */
  formingRadiusMm: number;
}

export type EmbossShape = "CIRCULAR" | "RECTANGULAR" | "OBROUND" | "COUNTERSINK";

export interface SheetMetalEmbossDef {
  id: string;
  name?: string;
  position: Vector2D;
  shape: EmbossShape;
  /** Diâmetro para formas circulares ou escareados (mm) */
  diameterMm?: number;
  /** Largura para retangulares ou oblongos (mm) */
  widthMm?: number;
  /** Comprimento para retangulares ou oblongos (mm) */
  lengthMm?: number;
  /** Profundidade do estampo/repuxo em mm (positivo = face externa, negativo = interna) */
  depthMm: number;
  /** Ângulo de abertura/escareamento (ex: 90° em countersink ou 10° em repuxo) */
  draftAngleDeg: number;
  /** Raio de concordância de canto em mm */
  filletRadiusMm?: number;
  /** Se o fundo do repuxo possui furo passante */
  isPierced: boolean;
  /** Diâmetro do furo passante central em mm (quando isPierced = true) */
  holeDiameterMm?: number;
}

export type HemType = "CLOSED" | "OPEN" | "TEARDROP" | "ROLLED";

export interface SheetMetalHemDef {
  id: string;
  name?: string;
  /** Aresta de origem da chapa na qual a bainha será gerada */
  edgeId: string;
  type: HemType;
  /** Comprimento da aba de retorno da bainha em mm (ex: 12 mm) */
  lengthMm: number;
  /** Folga interna entre as faces da chapa em mm (para OPEN hem, ex: 2 mm) */
  gapMm?: number;
  /** Raio de curvatura interno em mm (para TEARDROP ou ROLLED hem) */
  radiusMm?: number;
  /** Ângulo total de enrolamento em graus (para ROLLED hem, ex: 270° ou 360°) */
  rollAngleDeg?: number;
  /** Lado do enrolamento em relação ao vetor normal da chapa */
  side: "TOP" | "BOTTOM";
  /** Espessura da chapa em mm */
  thicknessMm: number;
}

export interface SheetMetalJogDef {
  id: string;
  name?: string;
  edgeId: string;
  /** Altura do degrau em Z em mm (ex: 3 mm) */
  offsetMm: number;
  /** Ângulo da rampa de transição em graus (normalmente 90° ou 45°) */
  angleDeg: number;
  /** Raio interno de conformação em mm */
  bendRadiusMm: number;
  /** Comprimento da aba prolongada após o degrau em mm */
  flangeLengthMm: number;
  /** Espessura da chapa em mm */
  thicknessMm: number;
}

export interface FormingFlatPatternAnnotation {
  id: string;
  toolType: "GUSSET" | "LOUVER" | "EMBOSS" | "HEM" | "JOG";
  name: string;
  center2D: Vector2D;
  /** Entidades vetoriais para visualização e CAM CNC */
  entities: Entity[];
  /** Metadados de usinagem e punção */
  toolingCode: string;
  notes: string;
}

export type SheetMetalGrade =
  "A36" | "SAE1020" | "INOX_304" | "INOX_316" | "ALU_5052" | "GALVANIZED";

export interface PressBrakeSimulationInput {
  material: SheetMetalGrade;
  thicknessMm: number;
  bendLengthMm: number;
  /** Abertura do canal V da matriz inferior (mm). Se omitida, calculada por norma técnica */
  dieOpeningVMm?: number;
  /** Raio da ponta do punção superior (mm) */
  punchRadiusMm?: number;
  /** Ângulo de dobra final desejado na peça em graus (ex: 90°) */
  targetAngleDeg: number;
  /** Quantidade de dobras do lote */
  bendCount?: number;
}

export interface PressBrakeSimulationResult {
  material: SheetMetalGrade;
  materialTensileStrengthMpa: number; // Tensão de ruptura Rm (MPa)
  materialYieldStrengthMpa: number; // Limite de escoamento Re (MPa)
  thicknessMm: number;
  bendLengthMm: number;
  dieOpeningVMm: number; // V utilizado
  recommendedDieOpeningVMm: number; // V ideal por norma
  punchRadiusMm: number;
  targetAngleDeg: number;
  /** Força de dobra estimada por metro de chapa (ton/m) */
  tonnagePerMeterTonM: number;
  /** Força de dobra total calculada para o comprimento real (toneladas métricas) */
  totalTonnageTon: number;
  /** Retorno elástico previsto do material (Springback em graus) */
  springbackAngleDeg: number;
  /** Ângulo de descida real do punção na prensa para compensar o retorno elástico */
  overbendAngleDeg: number;
  /** Comprimento mínimo de aba para não cair dentro da abertura do V da matriz (mm) */
  minFlangeLengthMm: number;
  /** Raio interno de dobra natural obtido por conformação no ar (Air Bending) em mm */
  naturalInsideRadiusMm: number;
  /** Recomendações e avisos de segurança da ferramenta */
  warnings: string[];
}
