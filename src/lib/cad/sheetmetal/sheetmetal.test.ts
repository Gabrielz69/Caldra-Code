import { describe, it, expect } from "vitest";
import { SheetMetalEngine } from "./sheetMetalEngine";

describe("CALDRA CAD SHEET METAL CORE & BENDING — FASE 04", () => {
  it("TESTE 1: Cálculos analíticos exatos de BA, OSSB e BD (K-Factor)", () => {
    const angleDeg = 90;
    const radius = 3;
    const thickness = 3;
    const kFactor = 0.33;

    // Raio neutro: Rn = 3 + 0.33 × 3 = 3.99 mm
    const neutralRadius = SheetMetalEngine.computeNeutralRadius(radius, kFactor, thickness);
    expect(neutralRadius).toBeCloseTo(3.99, 2);

    // BA = (90 * π / 180) * 3.99 = 6.2674... mm
    const ba = SheetMetalEngine.computeBendAllowance(angleDeg, radius, kFactor, thickness);
    expect(ba).toBeCloseTo(6.267, 3);

    // OSSB = (3 + 3) * tan(45°) = 6.0 mm
    const ossb = SheetMetalEngine.computeOutsideSetback(angleDeg, radius, thickness);
    expect(ossb).toBeCloseTo(6.0, 3);

    // BD = 2 * 6.0 - 6.267 = 5.733 mm
    const bd = SheetMetalEngine.computeBendDeduction(angleDeg, radius, kFactor, thickness);
    expect(bd).toBeCloseTo(5.733, 3);
  });

  it("TESTE 2: Criação de Chapa Base e adição de Edge Flange (Aba)", () => {
    const part = SheetMetalEngine.createBaseSheet(100, 100, 3, 0.33, 3, "Aço Carbono", 7.85);

    expect(part.thickness).toBe(3);
    expect(part.baseWidth).toBe(100);
    expect(part.baseLength).toBe(100);
    expect(part.flanges.length).toBe(0);

    // Adiciona aba de 50 mm a 90° na aresta direita
    const flange = SheetMetalEngine.addEdgeFlange(part, "right", 50, 90);
    expect(part.flanges.length).toBe(1);
    expect(flange.length).toBe(50);
    expect(flange.angleDeg).toBe(90);
  });

  it("TESTE 3: Desdobramento (Unfold) e Dobra (Fold) preservando estado", () => {
    const part = SheetMetalEngine.createBaseSheet(120, 80, 2);
    SheetMetalEngine.addEdgeFlange(part, "top", 30, 90);

    expect(part.isUnfolded).toBe(false);

    SheetMetalEngine.unfold(part);
    expect(part.isUnfolded).toBe(true);

    SheetMetalEngine.fold(part);
    expect(part.isUnfolded).toBe(false);
  });

  it("TESTE 4: Geração analítica do Flat Pattern (Blank desdobrado)", () => {
    const part = SheetMetalEngine.createBaseSheet(100, 100, 3, 0.33, 3);
    SheetMetalEngine.addEdgeFlange(part, "right", 50, 90);

    const flat = SheetMetalEngine.generateFlatPattern(part);

    // Comprimento do Blank retificado: 100 + (50 - 5.733) = 144.267 mm
    expect(flat.blankWidth).toBeCloseTo(144.267, 2);
    expect(flat.blankLength).toBe(100);

    // Contorno externo retificado (4 linhas) + Linha de centro de dobra (1 linha)
    expect(flat.contourEntities.length).toBe(5);
    const cutLines = flat.contourEntities.filter((e) => e.layer === "CORTE");
    const bendLines = flat.contourEntities.filter((e) => e.layer === "DOBRA");
    expect(cutLines.length).toBe(4);
    expect(bendLines.length).toBe(1);

    // Massa em kg calculada
    expect(flat.weightKg).toBeGreaterThan(0);
  });

  it("TESTE 5: Validação DFM — detecção de furo excessivamente próximo da dobra", () => {
    const part = SheetMetalEngine.createBaseSheet(100, 100, 3, 0.33, 3);
    SheetMetalEngine.addEdgeFlange(part, "right", 40, 90);

    // Furo de 10mm localizado a 5mm da aresta da dobra (abaixo de 2T + R = 9mm)
    const dangerousHoles = [{ center: { x: 97, y: 50 }, diameter: 10 }];

    const report = SheetMetalEngine.validateDFM(part, dangerousHoles);
    expect(report.isValidForManufacturing).toBe(false);
    expect(report.issues.some((i) => i.code === "HOLE_TOO_CLOSE_TO_BEND")).toBe(true);
  });

  it("TESTE 6: Validação DFM — detecção de raio muito agudo com risco de trinca mecânica", () => {
    // Raio de 1.0 mm para chapa de 3.0 mm (R < 0.5 T)
    const part = SheetMetalEngine.createBaseSheet(100, 100, 3, 0.33, 1.0);

    const report = SheetMetalEngine.validateDFM(part);
    expect(report.metrics.riskOfCracking).toBe(true);
    expect(report.issues.some((i) => i.code === "SHARP_BEND_CRACK_RISK")).toBe(true);
  });
});
