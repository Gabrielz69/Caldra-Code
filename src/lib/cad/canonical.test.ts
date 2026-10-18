// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  createRectangleSketch,
  extrudeSketchToSolid,
  convertToSheetMetal,
  canonicalToLab2DEntities,
  canonicalToSolidInstances,
} from "./canonical";
import { GeometryValidator, SheetMetalValidator } from "./validator";

describe("CALDRA CAD CANONICAL GEOMETRY CORE — FASE 01", () => {
  it("TESTE 1: Sketch 100 × 50 mm, Extrusão 10 mm resulta em sólido B-Rep válido", () => {
    const sketch = createRectangleSketch(100, 50);
    expect(sketch.isClosed).toBe(true);
    expect(sketch.area).toBe(5000);
    expect(sketch.segments.length).toBe(4);

    const solid = extrudeSketchToSolid(sketch, 10, "Aço Carbono", 7.85);

    // Verificação de topologia poliédrica básica
    expect(solid.vertices.length).toBe(8); // 8 vértices
    expect(solid.edges.length).toBe(12); // 12 arestas
    expect(solid.faces.length).toBe(6); // 6 faces (topo, base, 4 laterais)

    // Euler characteristic V - E + F = 2
    const euler = solid.vertices.length - solid.edges.length + solid.faces.length;
    expect(euler).toBe(2);

    // Propriedades físicas exatas
    expect(solid.volume).toBe(50000); // 100 × 50 × 10 = 50.000 mm³
    // Área superficial: 2×(100×50) + 2×(100×10) + 2×(50×10) = 10000 + 2000 + 1000 = 13000 mm²
    expect(solid.surfaceArea).toBe(13000);

    // Validação formal de geometria
    const validation = GeometryValidator.validateSolid(solid);
    expect(validation.isValid).toBe(true);
    expect(validation.status).toBe("PASS");
    expect(validation.issues.length).toBe(0);
  });

  it("TESTE 2: Sheet Metal Body com espessura 3mm, raio 3mm e K=0.33", () => {
    const sketch = createRectangleSketch(100, 100);
    const solid = extrudeSketchToSolid(sketch, 3);
    const sheetMetal = convertToSheetMetal(solid, "face_bottom", 3, 3, 0.33);

    expect(sheetMetal.thickness).toBe(3);
    expect(sheetMetal.defaultBendRadius).toBe(3);
    expect(sheetMetal.defaultKFactor).toBe(0.33);
    expect(sheetMetal.fixedFaceId).toBe("face_bottom");

    const smValidation = SheetMetalValidator.validate(sheetMetal);
    expect(smValidation.isValid).toBe(true);
    expect(smValidation.status).toBe("PASS");
  });

  it("TESTE 3: Detecção de anomalias geométricas e espessura inválida", () => {
    const sketch = createRectangleSketch(50, 50);
    const solid = extrudeSketchToSolid(sketch, 2);

    // Força espessura inválida zero
    const invalidSm = convertToSheetMetal(solid, "face_bottom", 0, 1, 0.33);
    const valResult = SheetMetalValidator.validate(invalidSm);

    expect(valResult.isValid).toBe(false);
    expect(valResult.status).toBe("ERROR");
    expect(valResult.issues.some((i) => i.code === "INVALID_THICKNESS")).toBe(true);
  });

  it("TESTE 4: Detecção de face fixa inexistente no corpo", () => {
    const sketch = createRectangleSketch(40, 40);
    const solid = extrudeSketchToSolid(sketch, 5);

    expect(() => {
      convertToSheetMetal(solid, "face_fantasma_inexistente", 5);
    }).toThrow("Face fixa com id 'face_fantasma_inexistente' não foi encontrada");
  });

  it("TESTE 5: Projeção direta para entidades 2D do CHAMFER (vetorial real, não raster)", () => {
    const sketch = createRectangleSketch(200, 150);
    const solid = extrudeSketchToSolid(sketch, 6.35);

    const entities = canonicalToLab2DEntities(solid);
    expect(entities.length).toBe(4);
    expect(entities.every((e) => e.type === "line")).toBe(true);
    expect(entities.every((e) => e.layer === "CORTE")).toBe(true);
  });

  it("TESTE 6: Projeção de instâncias sólidas para o motor 3D do CALDRA sem recálculo", () => {
    const sketch = createRectangleSketch(300, 100);
    const solid = extrudeSketchToSolid(sketch, 12);
    const instances = canonicalToSolidInstances(solid);

    expect(instances.length).toBe(1);
    expect(instances[0].instances[0].dimensions.w).toBe(300);
    expect(instances[0].instances[0].dimensions.h).toBe(100);
    expect(instances[0].instances[0].dimensions.d).toBe(12);
  });
});
