import { describe, expect, it } from "vitest";
import { buildWire } from "./wire";
import type { Vec3 } from "@/lib/geometry/types";

const P = { d1: 400, d2: 200, h: 500, ang: 60, e: 0, seg: 48, t: 6 };

function insideBranchFactory(p: typeof P) {
  const a = (p.ang * Math.PI) / 180;
  const rb = p.d2 / 2;
  const ax = Math.cos(a);
  const ay = Math.sin(a);
  return (q: Vec3) => {
    const s = q.x * ax + q.y * ay;
    if (s < -p.t) return false;
    const px = q.x - s * ax;
    const py = q.y - s * ay;
    return Math.hypot(px, py, q.z - (p.e ?? 0)) < rb - p.t * 0.25;
  };
}

describe("boca-de-lobo: furo real no tubo principal", () => {
  const model = buildWire("boca-de-lobo", { ...P, mode: "branch" });
  const inside = insideBranchFactory(P);

  it("nenhuma face do tubo principal está inteiramente dentro do volume do ramal", () => {
    const viol = model.faces.filter((f) => f.g === 0 && f.pts.every(inside));
    expect(viol).toEqual([]);
  });

  it("a linha de interseção real vira aresta do contorno do furo", () => {
    // seg + 1 pontos → seg arestas de contorno adicionadas ao modelo
    const onSurface = model.edges.filter(([a, b]) => {
      const r = (q: Vec3) => Math.hypot(q.y, q.z);
      return Math.abs(r(a) - P.d1 / 2) < 1 && Math.abs(r(b) - P.d1 / 2) < 1 && inside(a) === false;
    });
    expect(onSurface.length).toBeGreaterThanOrEqual(P.seg);
  });

  it("o ramal permanece íntegro (grupo 1 presente)", () => {
    expect(model.faces.some((f) => f.g === 1)).toBe(true);
    expect(model.faces.some((f) => f.g === 0)).toBe(true);
  });

  it("sem NaN/Infinity após o recorte", () => {
    for (const f of model.faces)
      for (const q of f.pts) {
        expect(Number.isFinite(q.x)).toBe(true);
        expect(Number.isFinite(q.y)).toBe(true);
        expect(Number.isFinite(q.z)).toBe(true);
      }
  });
});

describe("tê: furo real no tubo principal", () => {
  const model = buildWire("te", P);
  it("nenhuma face do tubo principal inteiramente dentro do volume do ramal", () => {
    const rb = P.d2 / 2;
    const viol = model.faces.filter(
      (f) => f.g === 0 && f.pts.every((q) => q.z > -P.t && Math.hypot(q.x, q.y) < rb - P.t * 0.25),
    );
    expect(viol).toEqual([]);
  });
});
