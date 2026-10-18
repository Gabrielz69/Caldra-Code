/**
 * CALDRA CAD CORE — SHEET METAL: BEND (Seção 5 e 10)
 *
 * Cálculos analíticos de conformação de chapa metálica:
 * - Tolerância de dobra (Bend Allowance - BA)
 * - Dedução de dobra (Bend Deduction - BD)
 * - Recuo externo (Setback - OSSB)
 */

export interface BendCalculationInput {
  thickness: number;
  innerRadius: number;
  bendAngleDeg: number;
  kFactor: number;
}

export interface BendCalculationResult {
  bendAllowance: number;
  bendDeduction: number;
  outsideSetback: number;
  neutralRadius: number;
}

export class Bend {
  /**
   * Calcula parâmetros canônicos de dobra industrial
   */
  static calculate(input: BendCalculationInput): BendCalculationResult {
    const { thickness: T, innerRadius: R, bendAngleDeg: angleDeg, kFactor: K } = input;
    const angleRad = (angleDeg * Math.PI) / 180;

    // Raio da linha neutra
    const neutralRadius = R + K * T;

    // Tolerância de dobra (comprimento de arco no plano neutro)
    // BA = angleRad * (R + K * T)
    const bendAllowance = angleRad * neutralRadius;

    // Recuo externo (Outside Setback): OSSB = tan(A / 2) * (R + T)
    const outsideSetback = Math.tan(angleRad / 2) * (R + T);

    // Dedução de dobra (Bend Deduction): BD = 2 * OSSB - BA
    const bendDeduction = 2 * outsideSetback - bendAllowance;

    return {
      bendAllowance,
      bendDeduction,
      outsideSetback,
      neutralRadius,
    };
  }
}
