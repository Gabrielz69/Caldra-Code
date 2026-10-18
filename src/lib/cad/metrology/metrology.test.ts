// @ts-nocheck
/**
 * CALDRA CAD METROLOGY, GD&T & QUALITY INSPECTION — FASE 14
 *
 * Suíte de testes industriais para metrologia e controle de qualidade dimensional:
 * - Tolerâncias gerais lineares e angulares ISO 2768-1 e geométricas ISO 2768-2
 * - Posição Verdadeira (True Position) com modificador MMC e bônus de tolerância
 * - Avaliação de Perpendicularidade de abas de dobra em relação ao Datum base
 * - Geração automática de Plano de Inspeção FAI a partir de PartDocument
 * - Avaliação de medições reais, cálculo de conformidade e índices Cp / Cpk
 * - Exportação de Relatório FAI em CSV e Prancha Baloneada em SVG
 */

import { describe, it, expect } from "vitest";
import {
  getLinearTolerance,
  getAngularTolerance,
  getGeneralFlatnessTolerance,
  getGeneralPerpendicularityTolerance,
} from "./iso2768";
import { GdtEngine } from "./gdtEngine";
import { InspectionEngine } from "./inspectionEngine";
import { FaiReportExporter } from "./faiReportExporter";
import type { PartDocument } from "../kernel/types";

describe("CALDRA CAD METROLOGIA, GD&T & CONTROLE DE QUALIDADE — FASE 14", () => {
  it("TESTE 1: Tolerâncias gerais ISO 2768-1 retornam valores normatizados", () => {
    // 150mm na classe Média (ISO_2768_M) deve ser ±0.5mm
    const tol150 = getLinearTolerance(150, "ISO_2768_M");
    expect(tol150.val).toBe(0.5);
    expect(tol150.upper).toBe(0.5);
    expect(tol150.lower).toBe(-0.5);

    // 25mm na classe Fina (ISO_2768_F) deve ser ±0.1mm
    const tol25Fine = getLinearTolerance(25, "ISO_2768_F");
    expect(tol25Fine.val).toBe(0.1);

    // 500mm na classe Grosseira (ISO_2768_C) para caldeiraria pesada deve ser ±2.0mm
    const tol500Coarse = getLinearTolerance(500, "ISO_2768_C");
    expect(tol500Coarse.val).toBe(2.0);

    // Ângulo com lado curto de 40mm na classe Média deve ser ±0.5°
    const angTol = getAngularTolerance(40, "ISO_2768_M");
    expect(angTol.valDeg).toBe(0.5);
  });

  it("TESTE 2: Tolerâncias geométricas gerais ISO 2768-2 (Planicidade e Perpendicularidade)", () => {
    // Diagonal de 250mm -> Planicidade geral Classe K = 0.4mm
    expect(getGeneralFlatnessTolerance(250)).toBe(0.4);

    // Comprimento de 80mm -> Perpendicularidade geral Classe K = 0.2mm
    expect(getGeneralPerpendicularityTolerance(80)).toBe(0.2);
  });

  it("TESTE 3: Cálculo de GD&T Posição Verdadeira (True Position) com MMC", () => {
    // Furo nominal em X=50, Y=50.
    // Medido em X=50.05, Y=50.08.
    // Base tolerance: Ø0.25mm
    // Nominal dia: 10mm, medido dia: 10.15mm (bônus MMC de 0.15mm!)
    const result = GdtEngine.calculateTruePosition({
      nominalX: 50,
      nominalY: 50,
      measuredX: 50.05,
      measuredY: 50.08,
      baseTolerance: 0.25,
      nominalDiameter: 10,
      measuredDiameter: 10.15,
      holeToleranceLower: 0,
      modifier: "MMC",
    });

    // dx = 0.05, dy = 0.08 -> hypot = ~0.0943 -> actualPositionDia = 2 * hypot = ~0.1887mm
    expect(result.actualPositionDiameter).toBeCloseTo(0.1887, 2);
    expect(result.bonusTolerance).toBeCloseTo(0.15, 2);
    expect(result.totalAllowedTolerance).toBeCloseTo(0.40, 2);
    expect(result.isConforming).toBe(true);
    expect(result.margin).toBeGreaterThan(0);
  });

  it("TESTE 4: Detecção de não-conformidade em GD&T Posição Verdadeira sem MMC (RFS)", () => {
    // Desvio grande: X=50.20, Y=50.20 -> hypot = 0.2828 -> TP = 0.5656mm > 0.20mm (reprovado!)
    const result = GdtEngine.calculateTruePosition({
      nominalX: 50,
      nominalY: 50,
      measuredX: 50.20,
      measuredY: 50.20,
      baseTolerance: 0.20,
      modifier: "RFS",
    });

    expect(result.isConforming).toBe(false);
    expect(result.margin).toBeLessThan(0);
  });

  it("TESTE 5: Avaliação de GD&T Perpendicularidade de Aba Dobrada", () => {
    // Aba de 60mm de comprimento, dobrada a 91° (desvio angular = 1°)
    // Linear deviation = 60 * sin(1°) = ~1.047mm
    // Tolerância permitida = 0.8mm -> não-conforme
    const result = GdtEngine.evaluateFlangePerpendicularity({
      nominalAngleDeg: 90,
      measuredAngleDeg: 91,
      flangeLength: 60,
      perpendicularityTolerance: 0.8,
    });

    expect(result.angularDeviationDeg).toBe(1.0);
    expect(result.linearDeviationMm).toBeCloseTo(1.047, 2);
    expect(result.isConforming).toBe(false);

    // Se desvio for apenas 0.3°: 60 * sin(0.3°) = ~0.314mm <= 0.8mm -> conforme
    const conforming = GdtEngine.evaluateFlangePerpendicularity({
      nominalAngleDeg: 90,
      measuredAngleDeg: 90.3,
      flangeLength: 60,
      perpendicularityTolerance: 0.8,
    });
    expect(conforming.isConforming).toBe(true);
  });

  it("TESTE 6: Geração automática de Plano de Inspeção FAI a partir de PartDocument", () => {
    const doc: PartDocument = {
      id: "DOC_METROLOGY_01",
      name: "Chapa de Fixação com Furos e Dobra",
      thickness: 3.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 3.0,
      baseWidth: 150,
      baseLength: 200,
      activeState: "2D_FLAT",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        flatPattern: {
          innerLoops: [
            { id: "HOLE_01", cx: 40, cy: 50, diameter: 12 },
            { id: "HOLE_02", cx: 110, cy: 50, diameter: 12 },
          ],
        },
        bends: [
          {
            id: "BEND_01",
            start: { x: 0, y: 150 },
            end: { x: 150, y: 150 },
            angle: 90,
          },
        ],
      },
    };

    const plan = InspectionEngine.generateInspectionPlan(doc, {
      toleranceClass: "ISO_2768_M",
      inspectorName: "Carlos Andrade (QA)",
      generateGdt: true,
    });

    expect(plan.partId).toBe("DOC_METROLOGY_01");
    expect(plan.inspectorName).toBe("Carlos Andrade (QA)");
    expect(plan.points.length).toBeGreaterThanOrEqual(8);

    // Balão #1 deve ser a espessura da chapa
    expect(plan.points[0]?.type).toBe("SHEET_THICKNESS");
    expect(plan.points[0]?.nominal).toBe(3.0);
    expect(plan.points[0]?.balloonNumber).toBe(1);

    // Deve conter GD&T True Position para os furos
    const gdtPoints = plan.points.filter((p) => p.type === "GDT_POSITION");
    expect(gdtPoints.length).toBe(2);
    expect(plan.gdtFrames.length).toBeGreaterThanOrEqual(2);
  });

  it("TESTE 7: Avaliação de medições reais, conformidade e índices Cp / Cpk", () => {
    const doc: PartDocument = {
      id: "DOC_METROLOGY_02",
      name: "Suporte Angular",
      thickness: 2.0,
      baseWidth: 100,
      baseLength: 100,
      sheetMetal: {
        flatPattern: {
          innerLoops: [{ id: "H1", cx: 50, cy: 50, diameter: 10 }],
        },
      },
    } as any;

    const plan = InspectionEngine.generateInspectionPlan(doc);

    // Simula medições perfeitas / dentro da tolerância
    const measurements: Record<string, number> = {};
    plan.points.forEach((pt) => {
      measurements[pt.id] = pt.nominal + (pt.type === "GDT_POSITION" ? 0.08 : 0.05);
    });

    const evaluated = InspectionEngine.evaluateMeasurements(plan, measurements);

    expect(evaluated.summary.passed).toBeGreaterThan(0);
    expect(evaluated.summary.failed).toBe(0);
    expect(evaluated.summary.overallVerdict).toBe("APPROVED");
    expect(evaluated.capability).toBeDefined();
    expect(evaluated.capability?.cp).toBeGreaterThan(0);
  });

  it("TESTE 8: Exportação de Relatório FAI em CSV e Prancha Baloneada em SVG", () => {
    const doc: PartDocument = {
      id: "DOC_METROLOGY_03",
      name: "Flange de Tubulação",
      thickness: 4.75,
      baseWidth: 180,
      baseLength: 180,
      sheetMetal: {
        flatPattern: {
          innerLoops: [{ id: "H1", cx: 90, cy: 90, diameter: 50 }],
        },
      },
    } as any;

    const plan = InspectionEngine.generateInspectionPlan(doc);
    const csv = FaiReportExporter.exportToCSV(plan);
    expect(csv).toContain("RELATORIO DE INSPECÃO DE PRIMEIRO ARTIGO (FAI / PPAP)");
    expect(csv).toContain("Flange de Tubulação");
    expect(csv).toContain("Balão (#)");

    const svg = FaiReportExporter.exportToInspectionSVG(plan);
    expect(svg).toContain("<svg");
    expect(svg).toContain("CALDRA METROLOGY &amp; QUALITY ASSURANCE");
    expect(svg).toContain("DATUM A");
    expect(svg).toContain("Balão #1");
  });
});
