import { describe, expect, it } from "vitest";
import { getEngine } from "@/lib/geometry/engines";
import { buildTraceSequence, validateSequence } from "./steps";
import { developmentRefs, refExists, refsForDim, stepForDim } from "@/lib/geometry/refs";

const MODELS = [
  "quadrado-redondo",
  "cone",
  "tronco-de-cone",
  "reducao-circular",
  "curva-de-gomos",
  "boca-de-lobo",
];

function compute(slug: string) {
  const engine = getEngine(slug);
  if (!engine) return null;
  if (engine.validate(engine.defaults).length) return null;
  return engine.calculate(engine.defaults);
}

describe("Traçagem Guiada", () => {
  for (const slug of MODELS) {
    const result = compute(slug);
    if (!result) continue;

    it(`${slug}: gera sequência determinística terminando em desenvolvimento concluído`, () => {
      const a = buildTraceSequence(slug, result);
      const b = buildTraceSequence(slug, result);
      expect(a).toEqual(b);
      expect(a.length).toBeGreaterThanOrEqual(4);
      expect(a.map((s) => s.order)).toEqual(a.map((_, i) => i + 1));
      expect(a.at(-1)?.id).toBe("concluido");
      expect(a[0]?.id).toBe("referencia");
    });

    it(`${slug}: nenhum passo aponta para geometria inexistente`, () => {
      const steps = buildTraceSequence(slug, result);
      expect(validateSequence(result, steps)).toEqual([]);
      const known = new Set(developmentRefs(result.development));
      for (const step of steps)
        for (const ref of step.geometryRefs) expect(known.has(ref)).toBe(true);
    });

    it(`${slug}: cada passo traz instrução, ferramenta e conferência`, () => {
      for (const step of buildTraceSequence(slug, result)) {
        expect(step.instruction.length).toBeGreaterThan(10);
        expect(step.validation.length).toBeGreaterThan(10);
        expect(step.tool).toBeTruthy();
      }
    });
  }

  it("alterar parâmetros regenera a sequência com novas medidas", () => {
    const engine = getEngine("cone");
    if (!engine) return;
    const base = engine.calculate(engine.defaults);
    const changed = engine.calculate({
      ...engine.defaults,
      h: (engine.defaults["h"] ?? 200) * 1.5,
    });
    const a = buildTraceSequence("cone", base);
    const b = buildTraceSequence("cone", changed);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("Vínculo parâmetro ↔ cota ↔ entidade", () => {
  const result = compute("quadrado-redondo");

  it("toda referência de uma cota existe no desenvolvimento", () => {
    if (!result) return;
    for (const dim of ["h", "d1", "d2", "e", null]) {
      for (const ref of refsForDim(dim, result.development)) {
        expect(refExists(result.development, ref)).toBe(true);
      }
    }
  });

  it("cada cota aponta para uma etapa existente da traçagem", () => {
    if (!result) return;
    const ids = new Set(buildTraceSequence("quadrado-redondo", result).map((s) => s.id));
    for (const dim of ["h", "d1", "d2", "e", null]) expect(ids.has(stepForDim(dim))).toBe(true);
  });
});
