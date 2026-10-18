import { describe, expect, it } from "vitest";
import { elbowCutList, elbowModel, type ElbowInput } from "./elbowSegments";

const base: ElbowInput = { diameter: 300, radius: 450, angleDeg: 90, gores: 4, divisions: 24 };

describe("curva de gomos — decomposição em peças", () => {
  it("β segue a convenção do motor: α / (2(n−1)+2)", () => {
    const m = elbowModel(base);
    expect((m.beta * 180) / Math.PI).toBeCloseTo(90 / 8, 9);
  });

  it("gomos são parâmetro: n juntas e n+1 peças físicas", () => {
    for (const g of [2, 3, 5, 8]) {
      const m = elbowModel({ ...base, gores: g });
      expect(m.segments).toHaveLength(g + 1);
      expect(m.segments.filter((s) => s.kind === "ponta")).toHaveLength(2);
      expect(m.segments.filter((s) => s.kind === "gomo")).toHaveLength(g - 1);
    }
  });

  it("a soma das deflexões fecha o ângulo total", () => {
    for (const ang of [45, 90, 180]) {
      const m = elbowModel({ ...base, angleDeg: ang });
      const joints = m.segments.length - 1;
      const last = m.segments[m.segments.length - 1]!;
      // primeira peça alinhada com a entrada, última alinhada com a saída
      expect(m.segments[0]!.rotationDeg).toBeCloseTo(0, 9);
      expect(last.rotationDeg).toBeCloseTo(ang, 6);
      expect(joints * ((2 * m.beta * 180) / Math.PI)).toBeCloseTo(ang, 6);
    }
  });

  it("ponta mede metade do gomo intermediário na linha de centro", () => {
    const m = elbowModel(base);
    const end = m.segments[0]!;
    const mid = m.segments[1]!;
    expect(mid.centerLength).toBeCloseTo(end.centerLength * 2, 9);
  });

  it("cada peça tem geometria, código e posição própria", () => {
    const m = elbowModel(base);
    const codes = new Set(m.segments.map((s) => s.code));
    expect(codes.size).toBe(m.segments.length);
    for (const s of m.segments) {
      expect(s.development.outline.length).toBeGreaterThan(8);
      expect(s.maxLength).toBeGreaterThan(s.minLength - 1e-9);
      const len = Math.hypot(s.axis.to.x - s.axis.from.x, s.axis.to.y - s.axis.from.y);
      expect(len).toBeCloseTo(s.centerLength, 6);
    }
  });

  it("a planificação tem largura igual ao perímetro do tubo", () => {
    const m = elbowModel(base);
    for (const s of m.segments) {
      const b = s.development.bounds;
      expect(b.maxX - b.minX).toBeCloseTo(Math.PI * base.diameter, 4);
    }
  });

  it("a lista de corte agrupa peças iguais", () => {
    const rows = elbowCutList(elbowModel({ ...base, gores: 5 }));
    expect(rows.find((r) => r.code === "PT")!.quantity).toBe(2);
    expect(rows.find((r) => r.code === "GM")!.quantity).toBe(4);
  });
});
