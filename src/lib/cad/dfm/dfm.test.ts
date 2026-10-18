// @ts-nocheck
/**
 * CALDRA CAD DFM (DESIGN FOR MANUFACTURING) & FABRICABILITY AUDIT — FASE 13
 *
 * Suíte de testes industriais para validação de fabricabilidade:
 * - Distância furo-a-dobra e prevenção de ovalização plástica
 * - Distância furo-a-borda e prevenção de abaulamento/estufamento
 * - Razão diâmetro/espessura (d/t) em corte térmico CNC
 * - Comprimento mínimo de aba para matrizes V de dobradeira
 * - Pontes e istmos térmicos estreitos entre recortes
 * - Formação analítica de custos e tempo de ciclo de produção
 * - Exportação de parecer técnico DFM em CSV e DXF com camada DFM_ISSUES
 * - Integração direta com o núcleo ChamferKernel
 */

import { describe, it, expect } from "vitest";
import { DfmEngine, DEFAULT_DFM_CONFIG } from "./dfmEngine";
import { DfmCostEngine, DEFAULT_COST_RATES } from "./dfmCostEngine";
import { DfmReportExporter } from "./dfmReportExporter";
import { ChamferKernel } from "../kernel/chamferKernel";
import { PartDocument } from "../kernel/types";

describe("CALDRA CAD DFM & FABRICABILITY AUDIT — FASE 13", () => {
  it("TESTE 1: Auditoria DFM detecta furo na zona plástica da dobra (HOLE_TOO_CLOSE_TO_BEND)", () => {
    // Chapa t = 3mm, dobra no X=100 (linha de dobra Y de 0 a 200).
    // Raio de dobra r = 3mm.
    // Limite seguro: r + 2.0*t = 3 + 6 = 9mm.
    // Furo Ø10mm (raio 5mm) com centro no X=105 -> dist ao centro da dobra = 5mm -> aresta do furo a 0mm da dobra (cruza a dobra!)
    const doc: PartDocument = {
      id: "DOC_TEST_01",
      name: "Suporte Dobrado com Furo Crítico",
      thickness: 3.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 3.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "3D_FOLDED",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 3.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 3.0,
        bends: [
          {
            id: "DOBRA_1",
            start: { x: 100, y: 0 },
            end: { x: 100, y: 200 },
            angle: 90,
          },
        ],
        flatPattern: {
          width: 200,
          height: 200,
          innerLoops: [
            {
              type: "CIRCLE",
              center: { x: 105, y: 50 },
              radius: 5.0, // Ø10mm
            },
          ],
        },
      },
    };

    const audit = DfmEngine.audit(doc);

    expect(audit.summary.isApproved).toBe(false);
    expect(audit.summary.errorCount).toBeGreaterThanOrEqual(1);

    const bendIssue = audit.issues.find((i) => i.ruleId === "HOLE_TOO_CLOSE_TO_BEND");
    expect(bendIssue).toBeDefined();
    expect(bendIssue?.severity).toBe("ERROR");
    expect(bendIssue?.suggestedFix).toContain("Aumentar a distância da furação");
  });

  it("TESTE 2: Auditoria DFM detecta furo próximo à borda externa da chapa (HOLE_TOO_CLOSE_TO_EDGE)", () => {
    // Chapa t = 4mm.
    // Furo Ø10mm no centro (x=6, y=50) em chapa de 0 a 300mm.
    // Aresta do furo a 6 - 5 = 1mm da borda esquerda (x=0).
    // Limite seguro: 1.5 * t = 6mm.
    const doc: PartDocument = {
      id: "DOC_TEST_02",
      name: "Chapa Furo na Borda",
      thickness: 4.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 4.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "2D_FLAT",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 4.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 4.0,
        bends: [],
        flatPattern: {
          width: 300,
          height: 200,
          innerLoops: [
            {
              type: "CIRCLE",
              center: { x: 6, y: 100 },
              radius: 5.0,
            },
          ],
        },
      },
    };

    const audit = DfmEngine.audit(doc);

    const edgeIssue = audit.issues.find((i) => i.ruleId === "HOLE_TOO_CLOSE_TO_EDGE");
    expect(edgeIssue).toBeDefined();
    expect(edgeIssue?.measuredValue).toBeLessThan(edgeIssue?.thresholdValue!);
    expect(edgeIssue?.title).toContain("Borda");
  });

  it("TESTE 3: Auditoria DFM detecta diâmetro de furo térmico menor que a espessura da chapa (MIN_HOLE_DIAMETER_SMALL)", () => {
    // Chapa t = 6mm. Furo de Ø3mm (raio 1.5mm).
    // Razão d/t = 3 / 6 = 0.5 < 1.0.
    const doc: PartDocument = {
      id: "DOC_TEST_03",
      name: "Chapa Grossa com Microfuro",
      thickness: 6.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 6.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "2D_FLAT",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 6.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 6.0,
        bends: [],
        flatPattern: {
          width: 200,
          height: 200,
          innerLoops: [
            {
              type: "CIRCLE",
              center: { x: 100, y: 100 },
              radius: 1.5, // Ø3mm
            },
          ],
        },
      },
    };

    const audit = DfmEngine.audit(doc);
    const diameterIssue = audit.issues.find((i) => i.ruleId === "MIN_HOLE_DIAMETER_SMALL");

    expect(diameterIssue).toBeDefined();
    expect(diameterIssue?.measuredValue).toBe(3);
    expect(diameterIssue?.thresholdValue).toBe(6);
  });

  it("TESTE 4: Auditoria DFM detecta aba de dobra menor que o apoio na matriz V (MIN_FLANGE_LENGTH_TOO_SHORT)", () => {
    // Chapa t = 3mm -> Matriz recomendada V = 24mm (ou 20mm).
    // Apoio mínimo de aba: 0.7 * V = 14mm a 16.8mm.
    // Se a aba tem apenas 8mm, a peça escorrega para dentro da matriz!
    const doc: PartDocument = {
      id: "DOC_TEST_04",
      name: "Perfil Aba Curta",
      thickness: 3.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 3.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "3D_FOLDED",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 3.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 3.0,
        bends: [
          {
            id: "DOBRA_ABA_CURTA",
            start: { x: 0, y: 8 },
            end: { x: 200, y: 8 },
            angle: 90,
            flangeLength: 8.0, // Aba de apenas 8mm
          },
        ],
        flatPattern: {
          width: 200,
          height: 100,
          innerLoops: [],
        },
      },
    };

    const audit = DfmEngine.audit(doc);
    const flangeIssue = audit.issues.find((i) => i.ruleId === "MIN_FLANGE_LENGTH_TOO_SHORT");

    expect(flangeIssue).toBeDefined();
    expect(flangeIssue?.severity).toBe("ERROR");
    expect(flangeIssue?.measuredValue).toBe(8);
  });

  it("TESTE 5: Auditoria DFM detecta ponte térmica estreita entre furações (NARROW_WEB_THERMAL_RISK)", () => {
    // Chapa t = 2mm.
    // Dois furos Ø20mm (raio 10mm).
    // Centro H1 = (100, 100), Centro H2 = (121.5, 100).
    // Distância entre centros = 21.5mm.
    // Espessura da ponte metálica = 21.5 - (10 + 10) = 1.5mm.
    // Limite seguro: max(t, 3.0mm) = 3.0mm.
    const doc: PartDocument = {
      id: "DOC_TEST_05",
      name: "Chapa Furos Colados",
      thickness: 2.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 2.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "2D_FLAT",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 2.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 2.0,
        bends: [],
        flatPattern: {
          width: 300,
          height: 300,
          innerLoops: [
            { type: "CIRCLE", center: { x: 100, y: 100 }, radius: 10 },
            { type: "CIRCLE", center: { x: 121.5, y: 100 }, radius: 10 },
          ],
        },
      },
    };

    const audit = DfmEngine.audit(doc);
    const webIssue = audit.issues.find((i) => i.ruleId === "NARROW_WEB_THERMAL_RISK");

    expect(webIssue).toBeDefined();
    expect(webIssue?.measuredValue).toBeCloseTo(1.5, 1);
    expect(webIssue?.thresholdValue).toBe(3.0);
  });

  it("TESTE 6: DfmCostEngine calcula tempos de máquina, custos de corte, pierces, dobras e preço de venda sugerido", () => {
    // Peça: Blank 500x400 mm, t = 3mm, Aço A36 (7850 kg/m³).
    // 2 furos internos Ø20mm + 2 dobras.
    const doc: PartDocument = {
      id: "DOC_TEST_06",
      name: "Tampa Superior Dobrada",
      thickness: 3.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 3.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "3D_FOLDED",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 3.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 3.0,
        bends: [
          { id: "B1", start: { x: 0, y: 50 }, end: { x: 500, y: 50 }, angle: 90 },
          { id: "B2", start: { x: 0, y: 350 }, end: { x: 500, y: 350 }, angle: 90 },
        ],
        flatPattern: {
          width: 500,
          height: 400,
          innerLoops: [
            { type: "CIRCLE", center: { x: 100, y: 200 }, radius: 10 },
            { type: "CIRCLE", center: { x: 400, y: 200 }, radius: 10 },
          ],
        },
      },
    };

    const cost = DfmCostEngine.calculate(doc);

    expect(cost.partWeightKg).toBeGreaterThan(4.0); // ~4.71 kg
    expect(cost.materialCost).toBeGreaterThan(35.0);
    expect(cost.pierceCount).toBe(3); // 1 contorno externo + 2 furos
    expect(cost.bendCount).toBe(2);
    expect(cost.directCost).toBeGreaterThan(cost.materialCost);
    expect(cost.suggestedSellingPrice).toBeGreaterThan(cost.directCost);
    expect(cost.suggestedSellingPrice).toBeCloseTo(
      cost.directCost * DEFAULT_COST_RATES.marginMultiplier,
      1,
    );
  });

  it("TESTE 7: DfmReportExporter gera relatório CSV completo e arquivo DXF com camada DFM_ISSUES", () => {
    const doc: PartDocument = {
      id: "DOC_TEST_07",
      name: "Base Caixa Industrial",
      thickness: 2.0,
      material: "Aço Carbono A36",
      density: 7.85,
      kFactor: 0.44,
      innerRadius: 2.0,
      featureTree: null as any,
      canonicalModel: null as any,
      activeState: "2D_FLAT",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sheetMetal: {
        thickness: 2.0,
        material: "Aço Carbono A36",
        defaultBendRadius: 2.0,
        bends: [{ id: "DOBRA_1", start: { x: 50, y: 0 }, end: { x: 50, y: 150 }, angle: 90 }],
        flatPattern: {
          width: 250,
          height: 150,
          innerLoops: [
            { type: "CIRCLE", center: { x: 53, y: 75 }, radius: 4 }, // Furo muito colado na dobra X=50!
          ],
        },
      },
    };

    const audit = DfmEngine.audit(doc);
    const cost = DfmCostEngine.calculate(doc);
    const report = {
      partName: doc.name,
      audit,
      cost,
      generatedAt: new Date().toISOString(),
    };

    // CSV
    const csv = DfmReportExporter.generateCsv(report);
    expect(csv).toContain("CALDRA CAD — RELATÓRIO DE FABRICABILIDADE DFM");
    expect(csv).toContain("HOLE_TOO_CLOSE_TO_BEND");
    expect(csv).toContain("CUSTO DIRETO TOTAL");
    expect(csv).toContain("PREÇO DE VENDA SUGERIDO");

    // DXF com Layer DFM_ISSUES
    const dxf = DfmReportExporter.generateDxfWithDfmLayer(doc, audit);
    expect(dxf).toContain("DFM_ISSUES");
    expect(dxf).toContain("HOLE_TOO_CLOSE_TO_BEND");
  });

  it("TESTE 8: Integração direta com ChamferKernel (auditDfm, exportDfmReportCsv, exportDfmDxf)", () => {
    const doc = ChamferKernel.createDocument({
      name: "Gabinete CNC",
      thickness: 2.5,
      material: "Aço Carbono A36",
    });

    // Executa auditoria DFM via Kernel
    const report = ChamferKernel.auditDfm(doc);

    expect(report).toBeDefined();
    expect(report.partName).toBe("Gabinete CNC");
    expect(report.audit.summary.score).toBeGreaterThanOrEqual(0);
    expect(doc.dfmReport).toBe(report);

    // Exportação CSV
    const csv = ChamferKernel.exportDfmReportCsv(doc);
    expect(csv).toContain("Gabinete CNC");
    expect(csv).toContain("FORMAÇÃO ANALÍTICA DE CUSTOS");

    // Exportação DXF
    const dxf = ChamferKernel.exportDfmDxf(doc);
    expect(dxf).toContain("DFM_ISSUES");
  });
});
