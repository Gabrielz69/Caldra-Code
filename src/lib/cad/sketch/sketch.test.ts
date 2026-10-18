// @ts-nocheck
import { describe, it, expect } from "vitest";
import { evaluateParametricExpression, ConstraintSolver } from "./solver";
import { ParametricSketch } from "./parametricSketch";
import { extrudeSketchToSolid } from "../canonical";

describe("CALDRA CAD PARAMETRIC SKETCH & CONSTRAINTS — FASE 02", () => {
  it("TESTE 1: Avaliador seguro de expressões matemáticas paramétricas", () => {
    const params = {
      Altura: 200,
      Espessura: 4,
      Margem: 15,
    };

    expect(evaluateParametricExpression("Altura * 2", params)).toBe(400);
    expect(evaluateParametricExpression("Espessura * 1.5", params)).toBe(6);
    expect(evaluateParametricExpression("(Altura + Margem) / 2", params)).toBe(107.5);
    expect(evaluateParametricExpression("500", params)).toBe(500);
  });

  it("TESTE 2: Retângulo paramétrico com origem fixa é Totalmente Definido (DoF = 0)", () => {
    const sketch = ParametricSketch.createRectangle(100, 50, 0, 0, true);
    const result = sketch.solve();

    expect(result.converged).toBe(true);
    expect(result.status).toBe("fully_defined");
    expect(result.degreesOfFreedom).toBe(0);

    const [p0, p1, p2, p3] = sketch.points;
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(0);
    expect(p1.x).toBeCloseTo(100);
    expect(p1.y).toBeCloseTo(0);
    expect(p2.x).toBeCloseTo(100);
    expect(p2.y).toBeCloseTo(50);
    expect(p3.x).toBeCloseTo(0);
    expect(p3.y).toBeCloseTo(50);
  });

  it("TESTE 3: Alteração de parâmetro dimensional reconstrói a geometria dinamicamente", () => {
    const sketch = ParametricSketch.createRectangle(100, 50, 0, 0, true);

    sketch.setDimensionParameter("Largura", 250);
    sketch.setDimensionParameter("Altura", 120);

    const result = sketch.solve();
    expect(result.converged).toBe(true);

    const [p0, p1, p2, p3] = sketch.points;
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(0);
    expect(p1.x).toBeCloseTo(250);
    expect(p1.y).toBeCloseTo(0);
    expect(p2.x).toBeCloseTo(250);
    expect(p2.y).toBeCloseTo(120);
    expect(p3.x).toBeCloseTo(0);
    expect(p3.y).toBeCloseTo(120);

    const canonical = sketch.toCanonicalSketch();
    expect(canonical.area).toBeCloseTo(250 * 120, 0);
  });

  it("TESTE 4: Detecção de Esboço Subdefinido (DoF > 0)", () => {
    const sketch = new ParametricSketch(undefined, "Linha Solta");
    const p0 = sketch.addPoint(0, 0, true);
    const p1 = sketch.addPoint(50, 20);
    sketch.addLine(p0.id, p1.id);

    sketch.addConstraint("horizontal", [p0.id, p1.id]);
    const result = sketch.solve();

    expect(result.status).toBe("under_defined");
    expect(result.degreesOfFreedom).toBeGreaterThan(0);
    const [, pt1] = sketch.points;
    expect(pt1.y).toBeCloseTo(0);
  });

  it("TESTE 5: Integração Completa: Parametric Sketch → Canonical Model → Sólido 3D", () => {
    const sketch = ParametricSketch.createRectangle(120, 60, 0, 0, true);
    sketch.solve();

    const canonicalSketch = sketch.toCanonicalSketch();
    expect(canonicalSketch.area).toBeCloseTo(7200);

    const solid = extrudeSketchToSolid(canonicalSketch, 15, "Aço Inox", 7.93);
    expect(solid.volume).toBeCloseTo(120 * 60 * 15);
    expect(solid.vertices.length).toBe(8);
    expect(solid.faces.length).toBe(6);
    expect(solid.edges.length).toBe(12);
  });

  it("TESTE 6: Conversão para entidades nativas 2D do CHAMFER sem rasterização", () => {
    const sketch = ParametricSketch.createRectangle(80, 40);
    const entities = sketch.toLab2DEntities();

    expect(entities.length).toBe(4);
    expect(entities.every((e) => e.layer === "CORTE")).toBe(true);
    expect(entities.every((e) => e.type === "line")).toBe(true);
  });
});
