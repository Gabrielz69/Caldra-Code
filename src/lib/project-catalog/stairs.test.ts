import { describe, expect, it } from "vitest";
import { generateStraightStair, STAIR_DEFAULTS } from "./stairs";

describe("Escada Reta — fonte canônica", () => {
  it("mantém 2D, 3D, peças, BOM e montagem coerentes", () => {
    const r = generateStraightStair(STAIR_DEFAULTS);
    expect(r.drawing.width).toBe(r.bounds.max.x - r.bounds.min.x);
    expect(r.bounds.max.y).toBe(STAIR_DEFAULTS.height);
    expect(r.parts.find((p) => p.key === "tread")?.quantity).toBe(STAIR_DEFAULTS.steps);
    expect(r.steps.flatMap((s) => s.partKeys)).toContain("tread");
    expect(r.parts.every((p) => p.dimensions.length > 0 && p.quantity > 0)).toBe(true);
  });
  it("propaga alteração crítica a todos os derivados", () => {
    const a = generateStraightStair(STAIR_DEFAULTS);
    const b = generateStraightStair({
      ...STAIR_DEFAULTS,
      width: 1200,
      height: 3600,
      length: 5000,
      steps: 18,
    });
    expect(b.fingerprint).not.toBe(a.fingerprint);
    expect(b.bounds.max.z).toBe(1200);
    expect(b.bounds.max.y).toBe(3600);
    expect(b.drawing.width).toBe(5000);
    expect(b.parts.find((p) => p.key === "tread")?.quantity).toBe(18);
    expect(b.parts.find((p) => p.key === "tread")?.dimensions.length).toBe(1200);
    expect(b.metrics.find((m) => m.label === "Espelho")?.value).toBe(200);
  });
  it("entrega vetores reais para peças de chapa", () => {
    const r = generateStraightStair(STAIR_DEFAULTS);
    const base = r.parts.find((p) => p.key === "base");
    expect(base?.fabricable).toBe(true);
    expect(base?.entities.filter((e) => e.type === "circle")).toHaveLength(4);
    expect(base?.entities.some((e) => e.type === "polyline")).toBe(true);
  });
});
