/**
 * CALDRA CAD — GD&T ENGINE (GEOMETRIC DIMENSIONING & TOLERANCING) (FASE 14)
 *
 * Motor de avaliação e cálculo de tolerâncias geométricas segundo ASME Y14.5 e ISO 1101:
 * - Posição Verdadeira (True Position) com cálculo de zona cilíndrica e bônus MMC / LMC;
 * - Planicidade (Flatness) e Perpendicularidade (Perpendicularity);
 * - Construção e renderização técnica de Quadros de Controle de Elemento (Feature Control Frame).
 */

import type {
  GdtCharacteristic,
  GdtFeatureControlFrame,
  MaterialConditionModifier,
} from "./types";

export const GDT_SYMBOLS: Record<GdtCharacteristic, string> = {
  FLATNESS: "⏥",
  STRAIGHTNESS: "⎯",
  CIRCULARITY: "○",
  CYLINDRICITY: "⌭",
  PERPENDICULARITY: "⟂",
  PARALLELISM: "∥",
  ANGULARITY: "∠",
  TRUE_POSITION: "⌖",
  CONCENTRICITY: "◎",
  SYMMETRY: "⌯",
  PROFILE_OF_SURFACE: "⌒",
  PROFILE_OF_LINE: "◠",
  CIRCULAR_RUNOUT: "↗",
  TOTAL_RUNOUT: "⇗",
};

export interface TruePositionCalculationResult {
  deviationX: number;
  deviationY: number;
  actualPositionDiameter: number; // 2 * sqrt(dx^2 + dy^2)
  baseTolerance: number;
  bonusTolerance: number;
  totalAllowedTolerance: number;
  isConforming: boolean;
  margin: number; // positivo = aprovado com folga, negativo = reprovado
}

export class GdtEngine {
  /**
   * Calcula o desvio de Posição Verdadeira (True Position) diametral:
   * TP = 2 * sqrt((X_meas - X_nom)^2 + (Y_meas - Y_nom)^2)
   *
   * Se modificador MMC (Maximum Material Condition) for ativado:
   * Para furos (internal feature):
   *   Bonus = max(0, measuredDiameter - nominalDiameter + lowerTolerance)
   *   Tolerância total permitida = baseTolerance + Bonus
   */
  static calculateTruePosition(params: {
    nominalX: number;
    nominalY: number;
    measuredX: number;
    measuredY: number;
    baseTolerance: number;
    nominalDiameter?: number;
    measuredDiameter?: number;
    holeToleranceLower?: number; // Ex: -0.1
    modifier?: MaterialConditionModifier;
  }): TruePositionCalculationResult {
    const {
      nominalX,
      nominalY,
      measuredX,
      measuredY,
      baseTolerance,
      nominalDiameter,
      measuredDiameter,
      holeToleranceLower = 0,
      modifier = "RFS",
    } = params;

    const dx = measuredX - nominalX;
    const dy = measuredY - nominalY;
    const actualPositionDiameter = 2 * Math.hypot(dx, dy);

    let bonus = 0;
    if (
      modifier === "MMC" &&
      nominalDiameter !== undefined &&
      measuredDiameter !== undefined
    ) {
      // Para um furo, a condição de máximo material (MMC) ocorre quando o furo tem seu menor tamanho
      const mmcDiameter = nominalDiameter + holeToleranceLower;
      if (measuredDiameter > mmcDiameter) {
        bonus = Math.max(0, measuredDiameter - mmcDiameter);
      }
    }

    const totalAllowed = baseTolerance + bonus;
    const isConforming = actualPositionDiameter <= totalAllowed + 1e-6;
    const margin = totalAllowed - actualPositionDiameter;

    return {
      deviationX: dx,
      deviationY: dy,
      actualPositionDiameter: Number(actualPositionDiameter.toFixed(4)),
      baseTolerance,
      bonusTolerance: Number(bonus.toFixed(4)),
      totalAllowedTolerance: Number(totalAllowed.toFixed(4)),
      isConforming,
      margin: Number(margin.toFixed(4)),
    };
  }

  /**
   * Avalia a Perpendicularidade de uma aba dobrada em relação à base:
   * Converte o desvio angular (graus) no comprimento da aba para desvio linear (mm).
   */
  static evaluateFlangePerpendicularity(params: {
    nominalAngleDeg: number;
    measuredAngleDeg: number;
    flangeLength: number;
    perpendicularityTolerance: number;
  }): {
    angularDeviationDeg: number;
    linearDeviationMm: number;
    allowedToleranceMm: number;
    isConforming: boolean;
  } {
    const {
      nominalAngleDeg,
      measuredAngleDeg,
      flangeLength,
      perpendicularityTolerance,
    } = params;

    const devDeg = Math.abs(measuredAngleDeg - nominalAngleDeg);
    const devRad = (devDeg * Math.PI) / 180;
    // Desvio linear projetado no topo da aba: L * sin(theta)
    const linearDev = flangeLength * Math.sin(devRad);

    return {
      angularDeviationDeg: Number(devDeg.toFixed(2)),
      linearDeviationMm: Number(linearDev.toFixed(3)),
      allowedToleranceMm: perpendicularityTolerance,
      isConforming: linearDev <= perpendicularityTolerance + 1e-6,
    };
  }

  /**
   * Formata a string de um Quadro de Controle de Elemento (Feature Control Frame).
   * Ex: [ ⌖ | Ø 0.25 Ⓜ | A | B Ⓜ | C ]
   */
  static formatFeatureControlFrame(frame: GdtFeatureControlFrame): string {
    const sym = GDT_SYMBOLS[frame.characteristic] || frame.symbol;
    const dia = frame.isDiameterZone ? "Ø " : "";
    const mod =
      frame.materialModifier === "MMC"
        ? " Ⓜ"
        : frame.materialModifier === "LMC"
          ? " Ⓛ"
          : "";

    const datums = [
      frame.datums.primary + (frame.datums.primaryModifier === "MMC" ? " Ⓜ" : ""),
      frame.datums.secondary
        ? frame.datums.secondary +
          (frame.datums.secondaryModifier === "MMC" ? " Ⓜ" : "")
        : null,
      frame.datums.tertiary
        ? frame.datums.tertiary +
          (frame.datums.tertiaryModifier === "MMC" ? " Ⓜ" : "")
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return `[ ${sym} | ${dia}${frame.toleranceValue.toFixed(2)}${mod}${datums ? " | " + datums : ""} ]`;
  }
}
