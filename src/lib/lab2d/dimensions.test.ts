import { describe, expect, it } from "vitest";

import type { Entity } from "./core";
import { dimensionEntities, formatDimension, makeDimension, measureDimension } from "./dimensions";
import { roleOf } from "./roles";

const line = (id: string, x1: number, y1: number, x2: number, y2: number): Entity => ({
  id,
  layer: "corte",
  type: "line",
  x1,
  y1,
  x2,
  y2,
});

const circle = (id: string, cx: number, cy: number, r: number): Entity => ({
  id,
  layer: "corte",
  type: "circle",
  cx,
  cy,
  r,
});

const arc = (id: string, cx: number, cy: number, r: number, a0: number, a1: number): Entity => ({
  id,
  layer: "corte",
  type: "arc",
  cx,
  cy,
  r,
  a0,
  a1,
});

describe("cotagem associativa", () => {
  it("linha de 500 mm → cota 500 mm", () => {
    const e = [line("l1", 0, 0, 500, 0)];
    const d = makeDimension("linear", [
      { kind: "entity", id: "l1", anchor: "start" },
      { kind: "entity", id: "l1", anchor: "end" },
    ]);
    expect(measureDimension(d, e)!.value).toBeCloseTo(500, 6);
    expect(formatDimension(d, e)).toBe("500.00 mm");
  });

  it("círculo Ø100 → cota Ø100", () => {
    const e = [circle("c1", 10, 10, 50)];
    const d = makeDimension("diameter", [{ kind: "entity", id: "c1" }]);
    expect(measureDimension(d, e)!.value).toBeCloseTo(100, 6);
    expect(formatDimension(d, e)).toBe("Ø100.00 mm");
  });

  it("arco R250 → cota R250", () => {
    const e = [arc("a1", 0, 0, 250, 0, Math.PI / 2)];
    const d = makeDimension("radius", [{ kind: "entity", id: "a1" }]);
    expect(formatDimension(d, e)).toBe("R250.00 mm");
  });

  it("duas linhas a 45° → cota 45°", () => {
    const e = [line("l1", 0, 0, 100, 0), line("l2", 0, 0, 100, 100)];
    const d = makeDimension("angle", [
      { kind: "entity", id: "l1" },
      { kind: "entity", id: "l2" },
    ]);
    expect(measureDimension(d, e)!.value).toBeCloseTo(45, 6);
    expect(formatDimension(d, e)).toBe("45.0°");
  });

  it("três pontos → ângulo de 90°", () => {
    const d = makeDimension("angle", [
      { kind: "point", p: { x: 100, y: 0 } },
      { kind: "point", p: { x: 0, y: 0 } },
      { kind: "point", p: { x: 0, y: 100 } },
    ]);
    expect(measureDimension(d, [])!.value).toBeCloseTo(90, 6);
  });

  it("comprimento de arco R250 a 90° → 392.70 mm", () => {
    const e = [arc("a1", 0, 0, 250, 0, Math.PI / 2)];
    const d = makeDimension("arc-length", [{ kind: "entity", id: "a1" }]);
    expect(measureDimension(d, e)!.value).toBeCloseTo((250 * Math.PI) / 2, 6);
    expect(formatDimension(d, e)).toBe("L392.70 mm");
  });

  it("dois centros → distância, X e Y corretos", () => {
    const e = [circle("c1", 0, 0, 10), circle("c2", 300, 400, 10)];
    const refs = [
      { kind: "entity" as const, id: "c1" },
      { kind: "entity" as const, id: "c2" },
    ];
    expect(measureDimension(makeDimension("center-distance", refs), e)!.value).toBeCloseTo(500, 6);
    expect(measureDimension(makeDimension("center-dx", refs), e)!.value).toBeCloseTo(300, 6);
    expect(measureDimension(makeDimension("center-dy", refs), e)!.value).toBeCloseTo(400, 6);
  });

  it("ponto → coordenadas X/Y corretas", () => {
    const refs = [{ kind: "point" as const, p: { x: 125, y: 240.5 } }];
    expect(formatDimension(makeDimension("coord-x", refs), [])).toBe("X = 125.00 mm");
    expect(formatDimension(makeDimension("coord-y", refs), [])).toBe("Y = 240.50 mm");
  });

  it("alterar a geometria atualiza a cota automaticamente", () => {
    const d = makeDimension("linear", [
      { kind: "entity", id: "l1", anchor: "start" },
      { kind: "entity", id: "l1", anchor: "end" },
    ]);
    expect(measureDimension(d, [line("l1", 0, 0, 500, 0)])!.value).toBeCloseTo(500, 6);
    expect(measureDimension(d, [line("l1", 0, 0, 650, 0)])!.value).toBeCloseTo(650, 6);

    const dr = makeDimension("radius", [{ kind: "entity", id: "c1" }]);
    expect(measureDimension(dr, [circle("c1", 0, 0, 40)])!.value).toBeCloseTo(40, 6);
    expect(measureDimension(dr, [circle("c1", 0, 0, 75)])!.value).toBeCloseTo(75, 6);
  });

  it("editar a cota visualmente não altera a geometria", () => {
    const e = [line("l1", 0, 0, 500, 0)];
    const before = JSON.stringify(e);
    const d = makeDimension("linear", [
      { kind: "entity", id: "l1", anchor: "start" },
      { kind: "entity", id: "l1", anchor: "end" },
    ]);
    const edited = {
      ...d,
      offset: 90,
      style: {
        ...d.style,
        precision: 0,
        textSize: 20,
        arrowSize: 12,
        prefix: "≈",
        side: -1 as const,
      },
    };
    expect(formatDimension(edited, e)).toBe("≈500 mm");
    expect(measureDimension(edited, e)!.value).toBeCloseTo(500, 6);
    expect(JSON.stringify(e)).toBe(before);
  });

  it("precisão só arredonda na apresentação", () => {
    const e = [line("l1", 0, 0, 123.4567, 0)];
    const refs = [
      { kind: "entity" as const, id: "l1", anchor: "start" as const },
      { kind: "entity" as const, id: "l1", anchor: "end" as const },
    ];
    const base = makeDimension("linear", refs);
    expect(measureDimension(base, e)!.value).toBeCloseTo(123.4567, 6);
    expect(formatDimension({ ...base, style: { ...base.style, precision: 0 } }, e)).toBe("123 mm");
    expect(formatDimension({ ...base, style: { ...base.style, precision: 3 } }, e)).toBe(
      "123.457 mm",
    );
  });

  it("tolerância usa o símbolo ±", () => {
    const e = [line("l1", 0, 0, 200, 0)];
    const d = makeDimension(
      "linear",
      [
        { kind: "entity", id: "l1", anchor: "start" },
        { kind: "entity", id: "l1", anchor: "end" },
      ],
      20,
      { tolerance: { plus: 0.5, minus: 0.5 } },
    );
    expect(formatDimension(d, e)).toBe("200.00 mm ±0.50");
  });

  it("cotas viram entidades DIMENSION e nunca geometria de fabricação", () => {
    const e = [circle("c1", 0, 0, 50)];
    const out = dimensionEntities([makeDimension("diameter", [{ kind: "entity", id: "c1" }])], e);
    expect(out.length).toBeGreaterThan(0);
    for (const d of out) {
      expect(roleOf(d)).toBe("DIMENSION");
      expect(d.layer).toBe("cota");
    }
  });

  it("isocírculo projetado preserva diâmetro real exato de Ø24 mm", () => {
    const isoEllipse: Entity = {
      id: "iso1",
      layer: "recorte",
      type: "ellipse",
      cx: 100,
      cy: 100,
      rx: 12 * Math.sqrt(1.5),
      ry: 12 * Math.sqrt(0.5),
      rotation: 0,
      params: {
        isIso: true,
        isoPlane: "top",
        realRadius: 12,
        realDiameter: 24,
      },
    };
    const e = [isoEllipse];
    const dDia = makeDimension("diameter", [{ kind: "entity", id: "iso1" }]);
    const dRad = makeDimension("radius", [{ kind: "entity", id: "iso1" }]);

    expect(measureDimension(dDia, e)!.value).toBeCloseTo(24, 4);
    expect(formatDimension(dDia, e)).toBe("Ø24.00 mm");

    expect(measureDimension(dRad, e)!.value).toBeCloseTo(12, 4);
    expect(formatDimension(dRad, e)).toBe("R12.00 mm");
  });
});
