/**
 * CUSTO DE FABRICAÇÃO — funções puras.
 *
 * Separado do custo de MATERIAL (`src/lib/geometry/mass.ts`). Aqui entram
 * corte, perfurações, dobras, solda, acabamento, mão de obra e setup.
 * Todos os valores em R$ (ou moeda regional) e todas as medidas em mm.
 */

export type MachineRates = {
  /** R$ por metro linear de corte, por faixa de espessura. */
  cutPerMeter: number;
  /** R$ por perfuração (pierce). */
  pierce: number;
  /** R$ por dobra. */
  bendPerBend: number;
  /** R$ por metro de solda. */
  weldPerMeter: number;
  /** R$ por hora de mão de obra. */
  laborPerHour: number;
  /** Preparação da máquina/programa, cobrada uma vez por lote. */
  setup: number;
};

export const DEFAULT_RATES: MachineRates = {
  cutPerMeter: 18,
  pierce: 0.9,
  bendPerBend: 4.5,
  weldPerMeter: 65,
  laborPerHour: 85,
  setup: 60,
};

/**
 * Fator de espessura sobre o corte: chapa grossa exige mais tempo.
 * Referência 3 mm = 1,0.
 */
export function thicknessFactor(thicknessMm: number): number {
  if (thicknessMm <= 0) return 1;
  return Math.max(0.6, Math.pow(thicknessMm / 3, 0.85));
}

export type FabricationInput = {
  /** Comprimento total de corte em mm (uma peça). */
  cutLengthMm: number;
  /** Número de perfurações (uma peça). */
  pierces: number;
  /** Número de dobras (uma peça). */
  bends: number;
  /** Comprimento de solda em mm (uma peça). */
  weldLengthMm: number;
  /** Horas de mão de obra por peça (montagem, acabamento). */
  laborHours: number;
  thicknessMm: number;
  quantity: number;
  rates: MachineRates;
  /** Setup cobrado uma vez pelo lote inteiro. */
  includeSetup: boolean;
};

export type FabricationBreakdown = {
  cut: number;
  pierce: number;
  bend: number;
  weld: number;
  labor: number;
  setup: number;
  /** Soma de tudo (lote inteiro). */
  total: number;
  /** Custo de fabricação por peça, sem o setup. */
  perPiece: number;
};

export function fabricationCost(i: FabricationInput): FabricationBreakdown {
  const qty = Math.max(0, i.quantity);
  const f = thicknessFactor(i.thicknessMm);

  const cut = (i.cutLengthMm / 1000) * i.rates.cutPerMeter * f * qty;
  const pierce = i.pierces * i.rates.pierce * f * qty;
  const bend = i.bends * i.rates.bendPerBend * f * qty;
  const weld = (i.weldLengthMm / 1000) * i.rates.weldPerMeter * qty;
  const labor = i.laborHours * i.rates.laborPerHour * qty;
  const setup = i.includeSetup ? i.rates.setup : 0;
  const total = cut + pierce + bend + weld + labor + setup;

  return {
    cut,
    pierce,
    bend,
    weld,
    labor,
    setup,
    total,
    perPiece: qty > 0 ? (total - setup) / qty : 0,
  };
}

/** Tempo estimado de corte em minutos (velocidade em mm/min por espessura). */
export function cutTimeMinutes(
  cutLengthMm: number,
  thicknessMm: number,
  baseSpeedMmMin = 3500,
): number {
  const speed = baseSpeedMmMin / thicknessFactor(thicknessMm);
  return speed > 0 ? cutLengthMm / speed : 0;
}
