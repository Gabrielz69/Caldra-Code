import { describe, expect, it } from "vitest";
import {
  bendAllowance,
  bendDeduction,
  developedLength,
  neutralRadius,
  resolveBends,
  resolveKFactor,
} from "./bend";
import { diffFabrication, staleDerivatives } from "./derivatives";
import { isMethodSupported, type Bend, type FabricationConfig } from "./types";

const cfg = (over: Partial<FabricationConfig> = {}): FabricationConfig => ({
  thickness: 6.35,
  method: "k-factor",
  defaultKFactor: 0.33,
  ...over,
});

/** projeto sem Fator K informado */
const cfgNoK = (): FabricationConfig => ({ thickness: 6.35, method: "k-factor" });

const bend = (over: Partial<Bend> = {}): Bend => ({
  bendId: "B1",
  angleDeg: 90,
  insideRadius: 8,
  ...over,
});

describe("métodos", () => {
  it("expõe apenas métodos com motor validado", () => {
    expect(isMethodSupported("geometric")).toBe(true);
    expect(isMethodSupported("k-factor")).toBe(true);
    expect(isMethodSupported("y-factor")).toBe(false);
    expect(isMethodSupported("shop-table")).toBe(false);
  });
});

describe("fator K", () => {
  it("usa o K da dobra quando existir, senão o do projeto", () => {
    expect(resolveKFactor(bend(), cfg())).toBe(0.33);
    expect(resolveKFactor(bend({ kFactor: 0.3 }), cfg())).toBe(0.3);
    expect(resolveKFactor(bend(), cfgNoK())).toBeUndefined();
  });

  it("linha neutra em R + K × T", () => {
    expect(neutralRadius(8, 0.33, 6.35)).toBeCloseTo(10.0955, 4);
  });

  it("BA = θ × (R + K × T)", () => {
    expect(bendAllowance(90, 8, 0.33, 6.35)).toBeCloseTo((Math.PI / 2) * 10.0955, 4);
  });

  it("BD = 2 × OSSB − BA", () => {
    const ossb = (8 + 6.35) * Math.tan(Math.PI / 4);
    expect(bendDeduction(90, 8, 0.33, 6.35)).toBeCloseTo(
      2 * ossb - bendAllowance(90, 8, 0.33, 6.35),
      4,
    );
  });
});

describe("resolução de dobras", () => {
  it("peça sem dobra não produz estado nem problema", () => {
    const r = resolveBends([], cfg());
    expect(r.states).toHaveLength(0);
    expect(r.issues).toHaveLength(0);
    expect(developedLength([100, 50], r.states)).toBe(150);
  });

  it("uma dobra produz estado técnico completo", () => {
    const [s] = resolveBends([bend()], cfg()).states;
    expect(s).toBeDefined();
    expect(s!.kFactor).toBe(0.33);
    expect(s!.neutralAxisOffset).toBeCloseTo(0.33 * 6.35, 6);
    expect(s!.method).toBe("k-factor");
  });

  it("múltiplas dobras somam allowance no desenvolvimento", () => {
    const { states } = resolveBends(
      [bend(), bend({ bendId: "B2", kFactor: 0.3 }), bend({ bendId: "B3", angleDeg: 45 })],
      cfg(),
    );
    expect(states).toHaveLength(3);
    expect(states[1]!.kFactor).toBe(0.3);
    const total = developedLength([100, 80, 60, 40], states);
    expect(total).toBeGreaterThan(280);
  });

  it("mudar K, raio ou ângulo altera linha neutra e desenvolvimento", () => {
    const base = resolveBends([bend()], cfg()).states[0]!;
    const k40 = resolveBends([bend()], cfg({ defaultKFactor: 0.4 })).states[0]!;
    const r12 = resolveBends([bend({ insideRadius: 12 })], cfg()).states[0]!;
    const a45 = resolveBends([bend({ angleDeg: 45 })], cfg()).states[0]!;
    expect(k40.neutralRadius).toBeGreaterThan(base.neutralRadius);
    expect(k40.bendAllowance).toBeGreaterThan(base.bendAllowance);
    expect(r12.bendAllowance).toBeGreaterThan(base.bendAllowance);
    expect(a45.bendAllowance).toBeLessThan(base.bendAllowance);
  });

  it("não inventa valores quando faltam dados", () => {
    expect(resolveBends([bend()], cfg({ thickness: 0 })).issues[0]!.reason).toBe(
      "missing-thickness",
    );
    expect(resolveBends([bend()], cfgNoK()).issues[0]!.reason).toBe("missing-k");
    expect(resolveBends([bend()], cfg({ method: "geometric" })).issues[0]!.reason).toBe(
      "unsupported-method",
    );
    expect(resolveBends([bend({ angleDeg: 0 })], cfg()).issues[0]!.reason).toBe(
      "invalid-parameters",
    );
  });
});

describe("derivados", () => {
  it("mudanças de fabricação desatualizam os derivados", () => {
    const prev = { config: cfg(), bends: [bend()] };
    const changes = diffFabrication(prev, {
      config: cfg({ defaultKFactor: 0.4 }),
      bends: [bend()],
    });
    expect(changes).toContain("kFactor");
    expect(staleDerivatives(changes)).toContain("chamfer");
  });

  it("sem mudança, nada é invalidado", () => {
    const snap = { config: cfg(), bends: [bend()] };
    expect(diffFabrication(snap, { config: cfg(), bends: [bend()] })).toHaveLength(0);
    expect(staleDerivatives([])).toHaveLength(0);
  });

  it("detecta mudança de espessura, ângulo e raio", () => {
    const prev = { config: cfg(), bends: [bend()] };
    expect(diffFabrication(prev, { config: cfg({ thickness: 8 }), bends: [bend()] })).toContain(
      "thickness",
    );
    expect(diffFabrication(prev, { config: cfg(), bends: [bend({ angleDeg: 60 })] })).toContain(
      "angle",
    );
    expect(diffFabrication(prev, { config: cfg(), bends: [bend({ insideRadius: 10 })] })).toContain(
      "insideRadius",
    );
  });
});
