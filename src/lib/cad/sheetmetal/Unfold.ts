/**
 * CALDRA CAD CORE — SHEET METAL: UNFOLD (Seção 5 e 10)
 *
 * Desdobramento e planificação geométrica contínua (Flat Pattern).
 */

import { Bend } from "./Bend";
import { KFactor, type SheetMetalMaterialType } from "./KFactor";

export interface UnfoldBendSegment {
  id: string;
  angleDeg: number;
  innerRadius: number;
  length: number;
}

export interface UnfoldPlanResult {
  totalFlatLength: number;
  bendDeductions: number[];
  bendAllowances: number[];
}

export class Unfold {
  /**
   * Calcula o comprimento desdobrado de uma chapa com múltiplas dobras
   */
  static computeFlatPattern(
    flangeLengths: number[],
    bends: UnfoldBendSegment[],
    thickness: number,
    material: SheetMetalMaterialType = "carbon-steel"
  ): UnfoldPlanResult {
    const k = KFactor.getDefault(material, (bends[0]?.innerRadius ?? thickness) / thickness);
    const bendAllowances: number[] = [];
    const bendDeductions: number[] = [];

    let totalFlanges = flangeLengths.reduce((acc, l) => acc + l, 0);

    for (const b of bends) {
      const res = Bend.calculate({
        thickness,
        innerRadius: b.innerRadius,
        bendAngleDeg: b.angleDeg,
        kFactor: k,
      });
      bendAllowances.push(res.bendAllowance);
      bendDeductions.push(res.bendDeduction);
    }

    // Comprimento total planificado = soma das flanges - soma das deduções de dobra
    const totalDeductions = bendDeductions.reduce((acc, d) => acc + d, 0);
    const totalFlatLength = Math.max(0, totalFlanges - totalDeductions);

    return {
      totalFlatLength,
      bendDeductions,
      bendAllowances,
    };
  }
}
