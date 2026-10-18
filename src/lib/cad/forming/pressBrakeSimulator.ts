// @ts-nocheck
/**
 * CALDRA CAD — PRESS BRAKE SIMULATOR & TONNAGE ENGINE (FASE 12)
 *
 * Motor analítico de simulação de prensagem, força de dobra e retorno elástico (springback).
 * Baseado em normas técnicas DIN 6935, VDI 3388 e dados empíricos de conformação a ar (Air Bending).
 */

import type {
  PressBrakeSimulationInput,
  PressBrakeSimulationResult,
  SheetMetalGrade,
} from "./types";

interface MaterialPhysics {
  name: string;
  tensileStrengthMpa: number; // Rm
  yieldStrengthMpa: number; // Re
  elasticModulusMpa: number; // E (Módulo de Young)
  springbackMultiplier: number;
}

const MATERIAL_DATABASE: Record<SheetMetalGrade, MaterialPhysics> = {
  A36: {
    name: "Aço Carbono Estrutural ASTM A36",
    tensileStrengthMpa: 420,
    yieldStrengthMpa: 250,
    elasticModulusMpa: 205000,
    springbackMultiplier: 1.0,
  },
  SAE1020: {
    name: "Aço Carbono Comercial SAE 1020",
    tensileStrengthMpa: 440,
    yieldStrengthMpa: 280,
    elasticModulusMpa: 205000,
    springbackMultiplier: 1.05,
  },
  INOX_304: {
    name: "Aço Inoxidável Austenítico AISI 304",
    tensileStrengthMpa: 620,
    yieldStrengthMpa: 290,
    elasticModulusMpa: 193000,
    springbackMultiplier: 1.65,
  },
  INOX_316: {
    name: "Aço Inoxidável Austenítico AISI 316",
    tensileStrengthMpa: 650,
    yieldStrengthMpa: 310,
    elasticModulusMpa: 193000,
    springbackMultiplier: 1.7,
  },
  ALU_5052: {
    name: "Alumínio Naval 5052-H32",
    tensileStrengthMpa: 230,
    yieldStrengthMpa: 190,
    elasticModulusMpa: 70000,
    springbackMultiplier: 1.35,
  },
  GALVANIZED: {
    name: "Chapa de Aço Galvanizada / Zincada",
    tensileStrengthMpa: 410,
    yieldStrengthMpa: 260,
    elasticModulusMpa: 205000,
    springbackMultiplier: 1.02,
  },
};

/** Matrizes comerciais padrão em oficina (aberturas V normalizadas em mm) */
const STANDARD_V_DIES = [4, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200];

export class PressBrakeSimulator {
  /**
   * Determina a abertura recomendada do canal V da matriz com base na espessura.
   */
  public static getRecommendedDieOpening(thicknessMm: number): number {
    const t = Math.max(0.5, thicknessMm);
    let targetRatio = 8;
    if (t < 3) {
      targetRatio = 6;
    } else if (t <= 6) {
      targetRatio = 8;
    } else if (t <= 10) {
      targetRatio = 10;
    } else {
      targetRatio = 12;
    }

    const idealV = t * targetRatio;
    // Seleciona a matriz normalizada comercial mais próxima
    let bestV = STANDARD_V_DIES[0];
    let minDiff = Math.abs(bestV - idealV);
    for (const v of STANDARD_V_DIES) {
      const diff = Math.abs(v - idealV);
      if (diff < minDiff) {
        minDiff = diff;
        bestV = v;
      }
    }
    return bestV;
  }

  /**
   * Alias para recommendVDie utilizado pelo motor DFM.
   */
  public static recommendVDie(thicknessMm: number): number {
    return this.getRecommendedDieOpening(thicknessMm);
  }

  /**
   * Executa a simulação completa de prensagem, cálculo de tonelagem e retorno elástico.
   */
  public static simulate(input: PressBrakeSimulationInput): PressBrakeSimulationResult {
    const matKey = input.material || "A36";
    const mat = MATERIAL_DATABASE[matKey] ?? MATERIAL_DATABASE.A36;
    const t = Math.max(0.2, input.thicknessMm);
    const L = Math.max(1, input.bendLengthMm);
    const targetAngle = Math.max(10, Math.min(175, input.targetAngleDeg ?? 90));

    const recommendedV = this.getRecommendedDieOpening(t);
    const v = input.dieOpeningVMm && input.dieOpeningVMm > 0 ? input.dieOpeningVMm : recommendedV;

    // Raio natural da conformação ao ar livre (Air Bending)
    // Para aço carbono ~ V/6, Inox ~ V/5.5, Alumínio ~ V/6.5
    let vRatio = 6.0;
    if (matKey.startsWith("INOX")) vRatio = 5.5;
    else if (matKey.startsWith("ALU")) vRatio = 6.5;

    const naturalInsideRadius = Number((v / vRatio).toFixed(2));
    const punchRadius =
      input.punchRadiusMm && input.punchRadiusMm > 0
        ? input.punchRadiusMm
        : Math.max(1.0, naturalInsideRadius);

    // Fórmula industrial de conformação a ar:
    // F (kN) = (1.42 * Rm * L * t²) / (1000 * V)
    // Conversão para toneladas métricas: Ton = F / 9.80665
    const cFactor = 1.42;
    const forcePerMeterKn = (cFactor * mat.tensileStrengthMpa * 1000 * Math.pow(t, 2)) / (1000 * v);
    const tonnagePerMeter = Number((forcePerMeterKn / 9.80665).toFixed(1));

    const totalForceKn = (cFactor * mat.tensileStrengthMpa * L * Math.pow(t, 2)) / (1000 * v);
    const totalTonnage = Number((totalForceKn / 9.80665).toFixed(2));

    // Comprimento mínimo de aba seguro (para não escorregar no canal da matriz)
    // b_min ≈ 0.7 * V
    const minFlangeLength = Number((0.7 * v).toFixed(1));

    // Retorno Elástico (Springback):
    // Δθ = θ * [ (Re * (rp + t/2)) / (E * t) ] * β
    const angleRad = (targetAngle * Math.PI) / 180;
    const neutralAxisRadius = punchRadius + t / 2;
    const springbackRad =
      angleRad *
      ((mat.yieldStrengthMpa * neutralAxisRadius) / (mat.elasticModulusMpa * t)) *
      mat.springbackMultiplier;

    let springbackDeg = (springbackRad * 180) / Math.PI;
    // Limites de segurança e consistência
    springbackDeg = Math.max(0.5, Math.min(15, springbackDeg));
    const springbackAngle = Number(springbackDeg.toFixed(2));

    // Sobredobra (Overbend): penetração necessária do punção para resultar no ângulo final após descarregamento
    const overbendAngle = Number((targetAngle - springbackAngle).toFixed(2));

    const warnings: string[] = [];
    if (v < 5 * t) {
      warnings.push(
        `Abertura V (${v} mm) muito estreita para chapa de ${t} mm. Risco de sobrecarga e marcas de vinco.`,
      );
    }
    if (punchRadius < 0.8 * t) {
      warnings.push(
        `Raio do punção (${punchRadius} mm) inferior a 0.8x espessura. Risco de fissuras na fibra externa do material.`,
      );
    }
    if (tonnagePerMeter > 100) {
      warnings.push(
        `Tonelagem elevada (${tonnagePerMeter} ton/m). Verifique a capacidade máxima por metro da prensa dobradeira.`,
      );
    }

    return {
      material: input.material,
      materialTensileStrengthMpa: mat.tensileStrengthMpa,
      materialYieldStrengthMpa: mat.yieldStrengthMpa,
      thicknessMm: t,
      bendLengthMm: L,
      dieOpeningVMm: v,
      recommendedDieOpeningVMm: recommendedV,
      punchRadiusMm: punchRadius,
      targetAngleDeg: targetAngle,
      tonnagePerMeterTonM: tonnagePerMeter,
      totalTonnageTon: totalTonnage,
      springbackAngleDeg: springbackAngle,
      overbendAngleDeg: overbendAngle,
      minFlangeLengthMm: minFlangeLength,
      naturalInsideRadiusMm: naturalInsideRadius,
      warnings,
    };
  }
}
