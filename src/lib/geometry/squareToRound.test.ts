import { describe, expect, it } from "vitest";
import type { GeometryPiece } from "./types";
import { buildWire } from "@/lib/viz3d/wire";
import {
  SQUARE_TO_ROUND_DEFAULTS,
  buildModel,
  calculateSquareToRound,
  squareToRoundSeams,
  type SquareToRoundInput,
} from "./squareToRound";

const cases: SquareToRoundInput[] = [
  SQUARE_TO_ROUND_DEFAULTS,
  { ...SQUARE_TO_ROUND_DEFAULTS, baseA: 600, baseB: 350 },
  { ...SQUARE_TO_ROUND_DEFAULTS, height: 280, topDiameter: 220 },
  { ...SQUARE_TO_ROUND_DEFAULTS, height: 760, topDiameter: 500, divisions: 12 },
];

describe("transição quadrado para redondo canônica", () => {
  it.each(cases)("mantém base, boca, divisões e geratrizes: %#", (input) => {
    const canonical = buildModel(input);
    const result = calculateSquareToRound(input);
    const wire = buildWire("quadrado-redondo", {
      d1: Math.max(input.baseA, input.baseB),
      d2: input.topDiameter,
      h: input.height,
      e: input.offsetX,
      t: input.thickness,
      seg: input.divisions * 4,
      baseA: input.baseA,
      baseB: input.baseB,
      offsetY: input.offsetY,
      divisions: input.divisions,
    });

    expect(canonical.corners).toHaveLength(4);
    expect(canonical.circle).toHaveLength(input.divisions * 4);
    expect(result.trueLengths).toHaveLength(input.divisions * 4 + 1);
    expect(result.development.foldLines).toHaveLength(input.divisions * 4 + 5);
    const expectedWidth =
      Math.max(input.baseA / 2, input.offsetX + input.topDiameter / 2) -
      Math.min(-input.baseA / 2, input.offsetX - input.topDiameter / 2);
    const expectedDepth =
      Math.max(input.baseB / 2, input.offsetY + input.topDiameter / 2) -
      Math.min(-input.baseB / 2, input.offsetY - input.topDiameter / 2);
    expect(wire.bounds.max.x - wire.bounds.min.x).toBeCloseTo(expectedWidth, 6);
    expect(wire.bounds.max.z - wire.bounds.min.z).toBeCloseTo(expectedDepth, 6);
    expect(wire.bounds.max.y - wire.bounds.min.y).toBeCloseTo(input.height, 6);
    expect(wire.edges.length).toBe(input.divisions * 4 + 4 + input.divisions * 4 + 4);
  });

  it("preserva as excentricidades da boca circular", () => {
    const input = { ...SQUARE_TO_ROUND_DEFAULTS, offsetX: 55, offsetY: -35 };
    const model = buildModel(input);
    const center = model.circle.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );
    expect(center.x / model.circle.length).toBeCloseTo(input.offsetX, 8);
    expect(center.y / model.circle.length).toBeCloseTo(input.offsetY, 8);
  });
});
describe("estratégia de fabricação", () => {
  it("modo peça única não decompõe", () => {
    const r = calculateSquareToRound({ ...SQUARE_TO_ROUND_DEFAULTS, strategy: "single" });
    expect(r.pieces).toBeUndefined();
    expect(r.joints).toBeUndefined();
  });

  it.each(cases)("modo 2 partes + solda gera 2 peças e 2 emendas: %#", (base) => {
    const input: SquareToRoundInput = { ...base, strategy: "two-weld" };
    const single = calculateSquareToRound({ ...base, strategy: "single" });
    const split = calculateSquareToRound(input);

    expect(split.pieces).toHaveLength(2);
    expect(split.joints).toHaveLength(2);
    expect(split.joints?.every((j) => j.kind === "weld")).toBe(true);

    // a geometria do conjunto é a MESMA: comprimentos verdadeiros idênticos
    expect(split.trueLengths).toEqual(single.trueLengths);

    // a soma das áreas das metades reproduz a área da peça inteira
    const areaOf = (p: GeometryPiece) => polygonAreaForTest(p.development.outline);
    const sum = split.pieces?.reduce((s, p) => s + areaOf(p), 0) ?? 0;
    expect(sum).toBeCloseTo(single.areaMm2, 3);
    expect(split.pieces?.map((p) => p.code)).toEqual(["Q-R-001-A", "Q-R-001-B"]);
    const seams = squareToRoundSeams(buildModel(input));
    expect(seams[0].a).toEqual({ x: 0, y: input.baseB / 2, z: 0 });
    expect(seams[1].a).toEqual({ x: 0, y: -input.baseB / 2, z: 0 });
  });

  it("3D recebe a estratégia sem alterar o envelope do conjunto", () => {
    const p = {
      d1: 500,
      d2: SQUARE_TO_ROUND_DEFAULTS.topDiameter,
      h: SQUARE_TO_ROUND_DEFAULTS.height,
      e: 0,
      t: SQUARE_TO_ROUND_DEFAULTS.thickness,
      seg: SQUARE_TO_ROUND_DEFAULTS.divisions * 4,
      baseA: SQUARE_TO_ROUND_DEFAULTS.baseA,
      baseB: SQUARE_TO_ROUND_DEFAULTS.baseB,
      offsetY: 0,
      divisions: SQUARE_TO_ROUND_DEFAULTS.divisions,
    };
    const a = buildWire("quadrado-redondo", { ...p, strategy: "single" });
    const b = buildWire("quadrado-redondo", { ...p, strategy: "two-weld" });
    expect(b.bounds).toEqual(a.bounds);
    expect(b.faces.length).toBe(a.faces.length);
    // as costuras J1/J2 aparecem como linhas de referência adicionais
    expect(b.refLines.length).toBe(a.refLines.length + 2);
  });
});

function polygonAreaForTest(points: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}
