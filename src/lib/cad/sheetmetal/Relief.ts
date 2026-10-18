/**
 * CALDRA CAD CORE — SHEET METAL: RELIEF (Seção 5 e 10)
 *
 * Alívios de dobra e canto para conformação sem rasgos ou deformações de estiramento:
 * - Retangular
 * - Redondo / Cilíndrico
 * - Rasgo (Tear / Slot)
 */

export type ReliefType = "rectangular" | "round" | "tear";

export interface CornerReliefDefinition {
  type: ReliefType;
  width: number;
  depth: number;
}

export class Relief {
  /**
   * Calcula dimensões recomendadas de alívio conforme espessura da chapa
   */
  static getRecommended(thickness: number, type: ReliefType = "rectangular"): CornerReliefDefinition {
    const minDim = Math.max(1.0, thickness);
    return {
      type,
      width: minDim,
      depth: minDim * 1.5,
    };
  }
}
