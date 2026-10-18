// @ts-nocheck
/**
 * CALDRA CAD MULTI-SHEET INDUSTRIAL NESTING & REMNANT OPTIMIZATION — FASE 11
 *
 * Suíte de testes unitários e de integração validando aninhamento de múltiplos blanks,
 * restrição de direção de grão, detecção de corte comum, geração de retalhos úteis
 * e exportação de DXF de chapa inteira compatível com CypCut.
 */

import { describe, it, expect } from "vitest";
import {
  NestingEngine,
  NestingDxfExporter,
  type NestingBlank,
  type NestingSheetStock,
} from "./index";
import { ChamferKernel } from "../kernel/chamferKernel";

describe("CALDRA CAD MULTI-SHEET INDUSTRIAL NESTING & REMNANT OPTIMIZATION — FASE 11", () => {
  const stockPlate3000x1500: NestingSheetStock = {
    id: "CHAPA_A36_3000x1500_3MM",
    name: "Chapa Aço A36 3000x1500 # 3.0mm",
    width: 3000,
    height: 1500,
    thickness: 3.0,
    material: "Aço Carbono A36",
    borderMarginMm: 15,
  };

  it("TESTE 1: NestingEngine aninha múltiplos blanks industriais e calcula aproveitamento e peso", () => {
    const blanks: NestingBlank[] = [
      {
        id: "BASE_01",
        name: "Base Inferior",
        width: 600,
        height: 400,
        quantity: 4,
        thickness: 3.0,
        material: "Aço Carbono A36",
      },
      {
        id: "LATERAL_01",
        name: "Lateral Esquerda",
        width: 500,
        height: 250,
        quantity: 6,
        thickness: 3.0,
        material: "Aço Carbono A36",
      },
      {
        id: "TAMPA_01",
        name: "Tampa Superior",
        width: 300,
        height: 200,
        quantity: 5,
        thickness: 3.0,
        material: "Aço Carbono A36",
      },
    ];

    const result = NestingEngine.runNesting(blanks, {
      sheetStock: stockPlate3000x1500,
      partSpacingMm: 5,
      allowRotation: true,
    });

    expect(result.sheets.length).toBeGreaterThanOrEqual(1);
    expect(result.totalBlanksPlaced).toBe(4 + 6 + 5);
    expect(result.unplacedBlanks.length).toBe(0);

    const sheet1 = result.sheets[0];
    expect(sheet1.placements.length).toBe(15);
    expect(sheet1.efficiencyPercent).toBeGreaterThan(30); // ~2.01 m² em chapa de 4.5 m²
    expect(sheet1.totalSheetWeightKg).toBeCloseTo(3000 * 1500 * 3.0 * 7.85e-6, 1); // ~105.97 kg
    expect(sheet1.totalPartWeightKg).toBeGreaterThan(30);
    expect(sheet1.estimatedCutTimeMinutes).toBeGreaterThan(0);
  });

  it("TESTE 2: Respeita rigorosamente a restrição de veio / grão de laminação (Grain Direction)", () => {
    const blanks: NestingBlank[] = [
      {
        id: "PAINEL_GRAIN",
        name: "Painel com Grão",
        width: 800,
        height: 300,
        quantity: 2,
        thickness: 3.0,
        material: "Aço Carbono A36",
        grainDirection: "HORIZONTAL", // Não pode girar
      },
      {
        id: "PAINEL_LIVRE",
        name: "Painel Livre",
        width: 800,
        height: 300,
        quantity: 2,
        thickness: 3.0,
        material: "Aço Carbono A36",
        grainDirection: "NONE", // Pode girar se benéfico
      },
    ];

    const result = NestingEngine.runNesting(blanks, {
      sheetStock: stockPlate3000x1500,
      allowRotation: true,
    });

    const sheet = result.sheets[0];
    const grainPlacements = sheet.placements.filter((p) => p.blankId === "PAINEL_GRAIN");
    expect(grainPlacements.length).toBe(2);
    // Todos com restrição de grão devem ter rotated = false
    for (const p of grainPlacements) {
      expect(p.rotated).toBe(false);
      expect(p.width).toBe(800);
      expect(p.height).toBe(300);
    }
  });

  it("TESTE 3: Detecção de corte comum (Common-Line Cutting) elimina arestas duplicadas e poupa tempo", () => {
    // 4 painéis idênticos colocados em grade com espaçamento zero para corte comum
    const blanks: NestingBlank[] = [
      {
        id: "MOD_01",
        name: "Módulo Repetitivo",
        width: 400,
        height: 300,
        quantity: 4,
        thickness: 3.0,
        material: "Aço Carbono A36",
      },
    ];

    const result = NestingEngine.runNesting(blanks, {
      sheetStock: stockPlate3000x1500,
      enableCommonLineCut: true,
      allowRotation: false,
    });

    const sheet = result.sheets[0];
    expect(sheet.commonLines.length).toBeGreaterThan(0);
    expect(result.totalCommonLineSavedLengthMm).toBeGreaterThan(0);
    // Pelo menos 2 peças devem ter a flag hasCommonLineCut
    const commonLineParts = sheet.placements.filter((p) => p.hasCommonLineCut);
    expect(commonLineParts.length).toBeGreaterThanOrEqual(2);
  });

  it("TESTE 4: Identificação automática de retalhos aproveitáveis (Remnants) com cálculo de peso", () => {
    // Poucas peças ocupando apenas o início da chapa 3000x1500
    const blanks: NestingBlank[] = [
      {
        id: "PECA_PEQUENA",
        name: "Peça Teste",
        width: 500,
        height: 400,
        quantity: 2,
        thickness: 3.0,
        material: "Aço Carbono A36",
      },
    ];

    const result = NestingEngine.runNesting(blanks, {
      sheetStock: stockPlate3000x1500,
      minRemnantAreaMm2: 50000,
    });

    const sheet = result.sheets[0];
    expect(sheet.remnants.length).toBeGreaterThan(0);

    const bottomRemnant = sheet.remnants.find((r) => r.id.startsWith("REM_B"));
    expect(bottomRemnant).toBeDefined();
    if (bottomRemnant) {
      expect(bottomRemnant.width).toBe(
        stockPlate3000x1500.width - stockPlate3000x1500.borderMarginMm * 2,
      );
      expect(bottomRemnant.height).toBeGreaterThan(500); // Sobra vertical expressiva
      expect(bottomRemnant.weightKg).toBeGreaterThan(20);
    }
  });

  it("TESTE 5: NestingDxfExporter exporta layout completo em DXF com layers industriais e relatório CSV", () => {
    const blanks: NestingBlank[] = [
      {
        id: "PAINEL_CNC",
        name: "Painel Frontal",
        width: 700,
        height: 500,
        quantity: 2,
        thickness: 3.0,
        material: "Aço Carbono A36",
        internalHoles: [{ x: 50, y: 50, width: 80, height: 80, type: "CIRCLE" }],
      },
    ];

    const result = NestingEngine.runNesting(blanks, {
      sheetStock: stockPlate3000x1500,
    });

    const sheet = result.sheets[0];
    const dxf = NestingDxfExporter.exportSheetToDxf(sheet);

    // Validações do DXF
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("0_BORDA_CHAPA");
    expect(dxf).toContain("1_CORTE_EXTERNO");
    expect(dxf).toContain("2_FUROS_INTERNOS");
    expect(dxf).toContain("5_IDENTIFICACAO");
    expect(dxf).toContain("Painel Frontal");
    expect(dxf).toContain("EOF");

    // Validação do Relatório CSV
    const csv = NestingDxfExporter.generateReportCsv(result);
    expect(csv).toContain("RELATÓRIO INDUSTRIAL DE ANINHAMENTO");
    expect(csv).toContain("Aço Carbono A36");
    expect(csv).toContain("EFICIENCIA");
  });

  it("TESTE 6: Integração direta com ChamferKernel para cálculo de nesting do documento", () => {
    const doc = ChamferKernel.createDocument("Gabinete Industrial", 2.0, "Aço Carbono A36");
    expect(doc.activeState).toBe("3D_FOLDED");

    // Adiciona outros blanks ao lote e aninha
    const extraBlanks: NestingBlank[] = [
      {
        id: "FLANGE_SUPORTE",
        name: "Flange de Fixação",
        width: 250,
        height: 120,
        quantity: 4,
        thickness: 2.0,
        material: "Aço Carbono A36",
      },
    ];

    const job = ChamferKernel.generateNesting(doc, extraBlanks);
    expect(doc.activeState).toBe("NESTING");
    expect(doc.nestingJob).toBeDefined();
    expect(job.totalBlanksPlaced).toBeGreaterThanOrEqual(5);

    const dxf = ChamferKernel.exportNestingDxf(doc, 1);
    expect(dxf).toContain("1_CORTE_EXTERNO");
    expect(dxf).toContain("Gabinete Industrial");
  });
});
