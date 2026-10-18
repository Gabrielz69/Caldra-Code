/**
 * COPILOTO DE ERRO — funções puras.
 *
 * Converte problemas de validação em mensagens acionáveis, com uma
 * correção aplicável em um toque quando ela existe.
 */

import type { Engine, EngineValues } from "./engines";
import type { ValidationIssue } from "./types";

export type Diagnosis = {
  field: string;
  message: string;
  /** Correção aplicável com um toque. */
  fix?: { label: string; values: EngineValues };
};

const DIAM_PAIRS: Record<string, [string, string]> = {
  "tronco-de-cone": ["d1", "d2"],
  "reducao-circular": ["d1", "d2"],
  chamines: ["d1", "d2"],
  "cone-excentrico": ["d1", "d2"],
  te: ["d1", "d2"],
  interseccoes: ["d1", "d2"],
  y: ["d1", "d2"],
};

export function diagnose(
  engine: Engine,
  values: EngineValues,
  issues: ValidationIssue[],
): Diagnosis[] {
  return issues.map((issue) => {
    const field = engine.fields.find((f) => f.key === issue.field);
    const pair = DIAM_PAIRS[engine.slug];

    /* Ø menor > Ø maior → trocar valores */
    if (pair && (issue.field === pair[1] || issue.field === pair[0])) {
      const [big, small] = pair;
      const a = values[big] ?? 0;
      const b = values[small] ?? 0;
      if (b >= a && b > 0 && a > 0) {
        return {
          field: issue.field,
          message: "Ø menor não pode ser maior que Ø maior.",
          fix: { label: "Trocar valores", values: { ...values, [big]: b, [small]: a } },
        };
      }
    }

    /* Curva de gomos: raio incompatível com o tubo */
    if (engine.slug === "curva-de-gomos" && issue.field === "r") {
      const d = values["d"] ?? 0;
      return {
        field: issue.field,
        message: `Raio de curva impossível: precisa ser maior que o raio do tubo (${(d / 2).toFixed(2)} mm).`,
        fix: { label: `Usar R = ${d.toFixed(2)} mm`, values: { ...values, r: d } },
      };
    }

    /* Corte oblíquo: altura maior deve superar a menor */
    if (engine.slug === "boca-de-lobo" && issue.field === "h2") {
      const h1 = values["h1"] ?? 0;
      const h2 = values["h2"] ?? 0;
      return {
        field: issue.field,
        message: `A altura maior deve superar a menor (h₁ = ${h1.toFixed(2)} mm).`,
        fix: { label: "Trocar valores", values: { ...values, h1: h2, h2: h1 } },
      };
    }

    /* Limite físico de campo → sugerir o valor válido mais próximo */
    if (field) {
      const value = values[field.key] ?? 0;
      const min = field.min ?? 0.001;
      const max = field.max ?? Infinity;
      const isAngle = field.unit === "°";
      if (!Number.isFinite(value) || value < min) {
        return {
          field: issue.field,
          message: isAngle
            ? `Ângulo fora da faixa. O mínimo permitido é ${min}°.`
            : `${field.label} abaixo do limite físico. O mínimo permitido é ${min} ${field.unit ?? "mm"}.`,
          fix: { label: `Corrigir para ${min}`, values: { ...values, [field.key]: min } },
        };
      }
      if (value > max) {
        return {
          field: issue.field,
          message: isAngle
            ? `Ângulo fora da faixa. O máximo permitido é ${max}°.`
            : `${field.label} acima do limite físico. O máximo permitido é ${max} ${field.unit ?? "mm"}.`,
          fix: { label: `Corrigir para ${max}`, values: { ...values, [field.key]: max } },
        };
      }
    }

    return { field: issue.field, message: issue.message };
  });
}
