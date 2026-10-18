/**
 * MATEMÁTICA DE DOBRA — método Fator K.
 *
 *   BA = θ × (R + K × T)          (θ em radianos)
 *   OSSB = (R + T) × tan(θ / 2)
 *   BD = 2 × OSSB − BA
 *
 * Nada é assumido: sem espessura válida, sem K informado ou com método não
 * suportado, a dobra não é resolvida e o motivo é devolvido.
 */

import {
  isMethodSupported,
  type Bend,
  type BendIssue,
  type BendState,
  type FabricationConfig,
} from "./types";

const DEG = Math.PI / 180;

export function resolveKFactor(bend: Bend, config: FabricationConfig): number | undefined {
  const own = bend.kFactor;
  if (typeof own === "number" && Number.isFinite(own)) return own;
  const def = config.defaultKFactor;
  if (typeof def === "number" && Number.isFinite(def)) return def;
  return undefined;
}

export function neutralRadius(insideRadius: number, kFactor: number, thickness: number): number {
  return insideRadius + kFactor * thickness;
}

export function bendAllowance(
  angleDeg: number,
  insideRadius: number,
  kFactor: number,
  thickness: number,
): number {
  return angleDeg * DEG * neutralRadius(insideRadius, kFactor, thickness);
}

export function outsideSetback(angleDeg: number, insideRadius: number, thickness: number): number {
  return (insideRadius + thickness) * Math.tan((angleDeg * DEG) / 2);
}

export function bendDeduction(
  angleDeg: number,
  insideRadius: number,
  kFactor: number,
  thickness: number,
): number {
  return (
    2 * outsideSetback(angleDeg, insideRadius, thickness) -
    bendAllowance(angleDeg, insideRadius, kFactor, thickness)
  );
}

export type BendResolution = { states: BendState[]; issues: BendIssue[] };

export function resolveBends(bends: Bend[], config: FabricationConfig): BendResolution {
  const states: BendState[] = [];
  const issues: BendIssue[] = [];

  for (const bend of bends) {
    if (!isMethodSupported(config.method) || config.method === "geometric") {
      issues.push({
        bendId: bend.bendId,
        reason: "unsupported-method",
        message: "Método de desenvolvimento sem compensação de dobra suportada.",
      });
      continue;
    }
    const t = config.thickness;
    if (!Number.isFinite(t) || t <= 0) {
      issues.push({
        bendId: bend.bendId,
        reason: "missing-thickness",
        message: "Espessura da chapa não informada.",
      });
      continue;
    }
    if (
      !Number.isFinite(bend.angleDeg) ||
      bend.angleDeg <= 0 ||
      bend.angleDeg >= 180 ||
      !Number.isFinite(bend.insideRadius) ||
      bend.insideRadius < 0
    ) {
      issues.push({
        bendId: bend.bendId,
        reason: "invalid-parameters",
        message: "Ângulo ou raio interno inválido.",
      });
      continue;
    }
    const k = resolveKFactor(bend, config);
    if (k === undefined) {
      issues.push({
        bendId: bend.bendId,
        reason: "missing-k",
        message: "Fator K não informado para esta dobra nem para o projeto.",
      });
      continue;
    }

    states.push({
      bendId: bend.bendId,
      angleDeg: bend.angleDeg,
      insideRadius: bend.insideRadius,
      thickness: t,
      kFactor: k,
      neutralAxisOffset: k * t,
      neutralRadius: neutralRadius(bend.insideRadius, k, t),
      bendAllowance: bendAllowance(bend.angleDeg, bend.insideRadius, k, t),
      bendDeduction: bendDeduction(bend.angleDeg, bend.insideRadius, k, t),
      method: config.method,
    });
  }

  return { states, issues };
}

/**
 * Comprimento desenvolvido de uma peça dobrada:
 * soma dos trechos retos (flanges) + allowance de cada dobra.
 * Peça sem dobra devolve a soma dos trechos — planificação puramente geométrica.
 */
export function developedLength(flanges: number[], states: BendState[]): number {
  const flat = flanges.reduce((acc, f) => acc + (Number.isFinite(f) ? f : 0), 0);
  return flat + states.reduce((acc, s) => acc + s.bendAllowance, 0);
}
