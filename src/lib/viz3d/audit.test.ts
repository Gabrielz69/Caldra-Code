import { describe, expect, it } from "vitest";
import { auditModel, isHealthy } from "./audit";
import { buildWire } from "./wire";

const MODELS = [
  { mode: "cone", params: { d1: 800, d2: 0, h: 500, mode: "cone" } },
  {
    mode: "curva-de-gomos",
    params: { d1: 400, d2: 400, h: 400, ang: 90, n: 4, mode: "curva-de-gomos" },
  },
  { mode: "quadrado-redondo", params: { d1: 500, d2: 300, h: 400, mode: "quadrado-redondo" } },
  { mode: "boca-de-lobo", params: { d1: 400, d2: 200, h: 400, ang: 45, mode: "boca-de-lobo" } },
  { mode: "reducao-circular", params: { d1: 600, d2: 300, h: 400, mode: "reducao-circular" } },
] as const;

describe("auditoria da malha 3D", () => {
  for (const m of MODELS) {
    it(`${m.mode} gera malha saudável`, () => {
      const audit = auditModel(buildWire(m.mode, m.params));
      expect(audit.faces).toBeGreaterThan(0);
      expect(audit.nonFinite).toBe(0);
      expect(audit.degenerate).toBe(0);
      expect(audit.duplicates).toBe(0);
      expect(audit.badNormals).toBe(0);
      expect(isHealthy(audit)).toBe(true);
      expect(audit.size).toBeGreaterThan(0);
    });
  }

  it("a auditoria é determinística para os mesmos parâmetros", () => {
    const a = auditModel(buildWire("reducao-circular", { d1: 600, d2: 300, h: 400 }));
    const b = auditModel(buildWire("reducao-circular", { d1: 600, d2: 300, h: 400 }));
    expect(a).toEqual(b);
  });
});
