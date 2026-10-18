/**
 * CALDRA CAD — DFM (DESIGN FOR MANUFACTURING) & FABRICABILITY TYPES (FASE 13)
 *
 * Tipagem e regras de auditoria industrial de fabricabilidade para:
 * - Chapas metálicas (Sheet Metal)
 * - Furações e distâncias de segurança em relação a dobras e bordas
 * - Alívios de canto e geometrias críticas de corte térmico
 * - Capacidades de prensas dobradeiras e ferramentas
 * - Estimativa analítica de custos e tempo de ciclo de produção
 */

export type DfmSeverity = "ERROR" | "WARNING" | "INFO";

export type DfmRuleId =
  | "HOLE_TOO_CLOSE_TO_BEND" // Furo na zona plástica da dobra (provoca ovalização)
  | "HOLE_TOO_CLOSE_TO_EDGE" // Furo muito próximo à borda (risco de estufamento perimetral)
  | "MIN_HOLE_DIAMETER_SMALL" // Diâmetro de furo menor que a espessura (d < t)
  | "MIN_FLANGE_LENGTH_TOO_SHORT" // Aba de dobra menor que o apoio na matriz V
  | "NARROW_WEB_THERMAL_RISK" // Istmo estreito entre cortes com risco de empenamento térmico
  | "MISSING_CORNER_RELIEF" // Canto interno de dobra a 90° sem alívio de rasgo
  | "SLOT_NEAR_BEND" // Rasgo oblongo paralelo ou oblíquo muito próximo à dobra
  | "TONNAGE_LIMIT_EXCEEDED" // Tonelagem necessária excede capacidade da prensa
  | "SPRINGBACK_HIGH_ALERT"; // Ângulo de retorno elástico acentuado requer calibração especial

export interface DfmPoint {
  x: number;
  y: number;
  z?: number;
}

export interface DfmIssue {
  id: string;
  ruleId: DfmRuleId;
  severity: DfmSeverity;
  title: string;
  description: string;
  location: DfmPoint;
  measuredValue: number;
  thresholdValue: number;
  unit: string;
  suggestedFix: string;
  affectedEntityId?: string;
}

export interface DfmRuleConfig {
  /** Distância mínima de furo ao centro da dobra (em múltiplos de espessura t + raio r). Padrão = 2.0 */
  holeToBendFactor: number;
  /** Distância mínima de furo à borda livre (em múltiplos de espessura t). Padrão = 1.5 */
  holeToEdgeFactor: number;
  /** Razão mínima diâmetro/espessura (d/t). Padrão = 1.0 para laser / 1.5 para plasma */
  minHoleDiameterFactor: number;
  /** Comprimento mínimo de aba em relação à matriz V (fator * V). Padrão = 0.7 */
  minFlangeToVFactor: number;
  /** Largura mínima de istmo térmico entre cortes (em mm). Padrão = espessura t ou 3.0mm */
  minNarrowWebMm: number;
  /** Capacidade máxima da prensa dobradeira disponível (em toneladas métricas). Padrão = 160 ton */
  maxPressBrakeTonnage: number;
}

export interface DfmAuditSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  score: number; // 0 a 100 (100 = 100% fabricável sem restrições)
  isApproved: boolean; // true se errorCount === 0
}

export interface DfmAuditResult {
  partName: string;
  material: string;
  thickness: number;
  summary: DfmAuditSummary;
  issues: DfmIssue[];
  auditedAt: string;
}

export interface FabricationCostRates {
  /** Preço do material por kg (R$/kg). Padrão A36 ~ 9.50 */
  materialCostPerKg: number;
  /** Custo horário da máquina de corte laser/plasma (R$/h). Padrão ~ 280.00 */
  cuttingMachineHourlyRate: number;
  /** Custo unitário por furo/pierce térmico (R$/pierce). Padrão ~ 0.15 */
  pierceCostUnit: number;
  /** Custo horário da prensa dobradeira (R$/h). Padrão ~ 180.00 */
  pressBrakeHourlyRate: number;
  /** Custo de setup por lote de dobra (R$). Padrão ~ 45.00 */
  pressBrakeSetupCost: number;
  /** Velocidade média de corte da máquina (mm/min). Padrão ~ 2500 */
  cuttingSpeedMmMin: number;
  /** Tempo médio por golpe de dobra (segundos). Padrão ~ 15s */
  secondsPerBendStroke: number;
  /** Margem de lucro / BDI comercial (fator multiplicador, ex.: 1.35 = 35%) */
  marginMultiplier: number;
}

export interface FabricationCostBreakdown {
  partWeightKg: number;
  materialCost: number;
  cutLengthMm: number;
  cutTimeMinutes: number;
  cuttingCost: number;
  pierceCount: number;
  piercingCost: number;
  bendCount: number;
  bendingTimeMinutes: number;
  bendingCost: number;
  setupCost: number;
  totalCycleTimeMinutes: number;
  directCost: number;
  suggestedSellingPrice: number;
  currency: string;
}

export interface DfmFullReport {
  partName: string;
  audit: DfmAuditResult;
  cost: FabricationCostBreakdown;
  generatedAt: string;
}
