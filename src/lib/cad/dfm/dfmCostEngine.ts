// @ts-nocheck
/**
 * CALDRA CAD — DFM FABRICATION COST & QUOTATION ENGINE (FASE 13)
 *
 * Motor analítico de cálculo de tempos de máquina e custos industriais:
 * - Matéria-prima bruta (peso e sucata)
 * - Corte térmico CNC (tempo de avanço laser/plasma + custo de furações/pierces)
 * - Conformação em prensa dobradeira (tempo de curso + setups)
 * - Custo direto e formação de preço de venda (BDI / margem de contribuição)
 */

import { FabricationCostBreakdown, FabricationCostRates } from "./types";
import { PartDocument } from "../kernel/types";

export const DEFAULT_COST_RATES: FabricationCostRates = {
  materialCostPerKg: 9.8, // R$/kg Aço A36 comercial
  cuttingMachineHourlyRate: 260.0, // R$/hora CNC Laser de Fibra
  pierceCostUnit: 0.18, // R$ por furo inicial (gás O2/N2 + desgaste óptico)
  pressBrakeHourlyRate: 190.0, // R$/hora Prensa Dobradeira CNC
  pressBrakeSetupCost: 40.0, // R$ setup de matriz e batentes
  cuttingSpeedMmMin: 2800.0, // 2.8 m/min avanço de corte
  secondsPerBendStroke: 18.0, // 18 segundos por golpe/posicionamento
  marginMultiplier: 1.35, // 35% de margem sobre custo direto
};

export class DfmCostEngine {
  /**
   * Calcula a formação de custos detalhada e tempo de fabricação
   */
  public static calculate(
    doc: PartDocument,
    ratesOverride?: Partial<FabricationCostRates>,
  ): FabricationCostBreakdown {
    const rates: FabricationCostRates = { ...DEFAULT_COST_RATES, ...ratesOverride };

    const thickness = doc.sheetMetal?.thickness ?? 2.0;
    const material = doc.sheetMetal?.material ?? "Aço Carbono A36";

    // 1. Densidade volumétrica (kg/m³)
    const density = this.getMaterialDensity(material);

    // 2. Dimensões do blank planificado
    const flatW = doc.sheetMetal?.flatPattern?.width ?? 300;
    const flatH = doc.sheetMetal?.flatPattern?.height ?? 200;
    const areaM2 = (flatW * flatH) / 1_000_000;
    const volumeM3 = areaM2 * (thickness / 1000);
    const partWeightKg = volumeM3 * density;

    // Custo de Matéria-Prima
    const materialCost = partWeightKg * rates.materialCostPerKg;

    // 3. Perímetro total de corte (contorno externo + rasgos e furos internos)
    let cutLengthMm = 2 * (flatW + flatH); // Contorno do blank externo
    let pierceCount = 1; // 1 entrada no contorno externo

    // Furos e laços internos
    if (doc.sheetMetal?.flatPattern?.innerLoops) {
      for (const loop of doc.sheetMetal.flatPattern.innerLoops) {
        pierceCount++;
        if (loop.type === "CIRCLE") {
          cutLengthMm += 2 * Math.PI * loop.radius;
        } else {
          cutLengthMm += 2 * (loop.width + loop.height);
        }
      }
    }

    // Tempo e Custo de Corte
    const cutTimeMinutes = cutLengthMm / rates.cuttingSpeedMmMin;
    const cuttingCost = (cutTimeMinutes / 60) * rates.cuttingMachineHourlyRate;
    const piercingCost = pierceCount * rates.pierceCostUnit;

    // 4. Dobras e Prensa Dobradeira
    const bendCount = doc.sheetMetal?.bends?.length ?? 0;
    const bendingTimeMinutes = (bendCount * rates.secondsPerBendStroke) / 60;
    const bendingCost = (bendingTimeMinutes / 60) * rates.pressBrakeHourlyRate;
    const setupCost = bendCount > 0 ? rates.pressBrakeSetupCost : 0;

    // 5. Consolidação de Tempos e Custos
    const totalCycleTimeMinutes = cutTimeMinutes + bendingTimeMinutes;
    const directCost = materialCost + cuttingCost + piercingCost + bendingCost + setupCost;
    const suggestedSellingPrice = directCost * rates.marginMultiplier;

    return {
      partWeightKg: Number(partWeightKg.toFixed(2)),
      materialCost: Number(materialCost.toFixed(2)),
      cutLengthMm: Number(cutLengthMm.toFixed(1)),
      cutTimeMinutes: Number(cutTimeMinutes.toFixed(2)),
      cuttingCost: Number(cuttingCost.toFixed(2)),
      pierceCount,
      piercingCost: Number(piercingCost.toFixed(2)),
      bendCount,
      bendingTimeMinutes: Number(bendingTimeMinutes.toFixed(2)),
      bendingCost: Number(bendingCost.toFixed(2)),
      setupCost: Number(setupCost.toFixed(2)),
      totalCycleTimeMinutes: Number(totalCycleTimeMinutes.toFixed(2)),
      directCost: Number(directCost.toFixed(2)),
      suggestedSellingPrice: Number(suggestedSellingPrice.toFixed(2)),
      currency: "BRL",
    };
  }

  private static getMaterialDensity(materialName: string): number {
    const lower = materialName.toLowerCase();
    if (lower.includes("inox") || lower.includes("stainless")) return 8000;
    if (lower.includes("alum") || lower.includes("alu")) return 2700;
    if (lower.includes("cobre") || lower.includes("copper")) return 8900;
    if (lower.includes("latão") || lower.includes("brass")) return 8500;
    return 7850; // Aço Carbono Padrão A36 / SAE 1020
  }
}
