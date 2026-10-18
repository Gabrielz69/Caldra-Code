import { describe, expect, it } from "vitest";
import {
  branchAxisLength,
  branchDevelopments,
  branchIntersection,
  validateBranch,
  type BranchInput,
} from "./branch";

const base: BranchInput = {
  mainDiameter: 500,
  branchDiameter: 250,
  angleDeg: 90,
  offset: 0,
  branchLength: 400,
  divisions: 48,
};

describe("boca de lobo — interseção cilindro/cilindro", () => {
  it("a 90° o recuo máximo vale R − √(R² − r²)", () => {
    const m = branchIntersection(base);
    const R = 250;
    const r = 125;
    expect(m.tMax).toBeCloseTo(R, 6);
    expect(m.tMin).toBeCloseTo(Math.sqrt(R * R - r * r), 6);
  });

  it("todos os pontos da curva pertencem à casca do tubo principal", () => {
    for (const ang of [30, 45, 60, 90]) {
      const m = branchIntersection({ ...base, angleDeg: ang });
      for (const c of m.curve) {
        expect(Math.hypot(c.p.y, c.p.z)).toBeCloseTo(m.R, 6);
      }
    }
  });

  it("ângulo menor alonga a boca (mais material removido)", () => {
    const a90 = branchIntersection({ ...base, angleDeg: 90 });
    const a45 = branchIntersection({ ...base, angleDeg: 45 });
    expect(a45.tMax - a45.tMin).toBeGreaterThan(a90.tMax - a90.tMin);
  });

  it("excentricidade desloca a curva sem sair do tubo", () => {
    const m = branchIntersection({ ...base, offset: 60 });
    for (const c of m.curve) expect(Math.hypot(c.p.y, c.p.z)).toBeCloseTo(m.R, 6);
  });

  it("a planificação do ramal tem largura igual ao perímetro", () => {
    const dev = branchDevelopments(base);
    const b = dev.branch.bounds;
    expect(b.maxX - b.minX).toBeCloseTo(Math.PI * base.branchDiameter, 4);
    expect(b.maxY).toBeCloseTo(base.branchLength - branchIntersection(base).tMin, 6);
  });

  it("cada ordenada da planificação é o comprimento verdadeiro da geratriz", () => {
    const dev = branchDevelopments(base);
    dev.trueLengths.forEach((l, k) => {
      const theta = (k / 48) * Math.PI * 2;
      expect(l.length).toBeCloseTo(base.branchLength - branchAxisLength(base, theta), 6);
    });
  });

  it("recusa derivação maior que o tubo e excentricidade impossível", () => {
    expect(validateBranch({ ...base, branchDiameter: 600 }).length).toBeGreaterThan(0);
    expect(validateBranch({ ...base, offset: 200 }).length).toBeGreaterThan(0);
    expect(validateBranch(base)).toHaveLength(0);
  });
});
