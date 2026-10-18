// @ts-nocheck
/**
 * CALDRA CAD DRAFTING & TECHNICAL DRAWINGS — FASE 09
 *
 * Testes analíticos e de conformidade do motor de detalhamento técnico 2D,
 * projeções ortográficas, visibilidade de arestas, tabela de dobra e exportadores.
 */

import { describe, it, expect } from "vitest";
import { ChamferKernel } from "../kernel/chamferKernel";
import { ProjectionEngine } from "./projectionEngine";
import { DraftingEngine } from "./draftingEngine";
import { DrawingExporter } from "./drawingExporter";
import { extrudeSketchToSolid, createRectangleSketch } from "../canonical";

describe("CALDRA CAD DRAFTING & TECHNICAL DRAWINGS — FASE 09", () => {
  it("TESTE 1: ProjectionEngine projeta vistas ortográficas e calcula visibilidade de arestas", () => {
    // Cria um paralelepípedo 100 x 50 x 20 mm
    const sketch = createRectangleSketch(100, 50);
    const solid = extrudeSketchToSolid(sketch, 20);

    // 1. Vista Frontal (XZ)
    const frontView = ProjectionEngine.generateView(solid, "FRONT", { scale: 1.0 });
    expect(frontView.type).toBe("FRONT");
    expect(frontView.lines.length).toBeGreaterThan(0);
    expect(frontView.lines.some((l) => l.type === "VISIBLE")).toBe(true);

    // Extensão na vista frontal deve ser 100 x 20 mm
    const wFront = frontView.boundingBox.maxX - frontView.boundingBox.minX;
    const hFront = frontView.boundingBox.maxY - frontView.boundingBox.minY;
    expect(wFront).toBeCloseTo(100, 1);
    expect(hFront).toBeCloseTo(20, 1);

    // Cotagem automática presente
    expect(frontView.dimensions.length).toBeGreaterThanOrEqual(2);
    expect(frontView.dimensions.some((d) => d.type === "LINEAR_HORIZ" && d.value === 100)).toBe(
      true,
    );
    expect(frontView.dimensions.some((d) => d.type === "LINEAR_VERT" && d.value === 20)).toBe(true);

    // 2. Vista Superior (XY)
    const topView = ProjectionEngine.generateView(solid, "TOP", { scale: 1.0 });
    expect(topView.type).toBe("TOP");
    const wTop = topView.boundingBox.maxX - topView.boundingBox.minX;
    const hTop = topView.boundingBox.maxY - topView.boundingBox.minY;
    expect(wTop).toBeCloseTo(100, 1);
    expect(hTop).toBeCloseTo(50, 1);

    // 3. Perspectiva Isométrica
    const isoView = ProjectionEngine.generateView(solid, "ISOMETRIC", { scale: 1.0 });
    expect(isoView.type).toBe("ISOMETRIC");
    expect(isoView.lines.length).toBeGreaterThan(0);
  });

  it("TESTE 2: DraftingEngine gera prancha técnica completa com Carimbo ABNT e cálculo de massa", () => {
    let doc = ChamferKernel.createDocument("Caixa de Proteção", 3.0, "AÇO CARBONO ASTM A36", 0.44);
    doc = ChamferKernel.extrudeBasePlate(doc, 200, 150);

    const sheet = DraftingEngine.generateDrawing(doc, {
      sheetSize: "A4_LANDSCAPE",
      author: "CARLOS CALDEIREIRO",
      company: "CALDRA INDÚSTRIA METALÚRGICA",
    });

    expect(sheet.size).toBe("A4_LANDSCAPE");
    expect(sheet.widthMm).toBe(297);
    expect(sheet.heightMm).toBe(210);
    expect(sheet.views.length).toBe(4); // Front, Top, Right, Isometric

    // Validação do Carimbo / Bloco de Título
    const tb = sheet.titleBlock;
    expect(tb.title).toBe("CAIXA DE PROTEÇÃO");
    expect(tb.author).toBe("CARLOS CALDEIREIRO");
    expect(tb.company).toBe("CALDRA INDÚSTRIA METALÚRGICA");
    expect(tb.thicknessMm).toBe(3.0);
    expect(tb.material).toContain("AÇO CARBONO");

    // Cálculo exato da massa estimada:
    // Volume = 200 x 150 x 3 = 90.000 mm³
    // Densidade aço = 7.85 g/cm³ -> 90.000 * 7.85 / 1.000.000 = 0.7065 kg
    expect(tb.estimatedMassKg).toBeCloseTo(0.707, 2);

    // Notas de fabricação normalizadas presentes
    expect(sheet.generalNotes.length).toBeGreaterThanOrEqual(3);
    expect(sheet.generalNotes.some((n) => n.includes("ISO 2768-m"))).toBe(true);
  });

  it("TESTE 3: Geração automática de Tabela de Dobras e Dedução com V-Die", () => {
    let doc = ChamferKernel.createDocument("Perfil L Dobrado", 2.0, "AÇO INOX 304", 0.44);
    doc = ChamferKernel.extrudeBasePlate(doc, 100, 100);
    doc = ChamferKernel.addBend(doc, "edge-1", 90, 2.0, 50);

    const sheet = DraftingEngine.generateDrawing(doc, {
      sheetSize: "A3_LANDSCAPE",
      includeBendTable: true,
    });

    expect(sheet.bendTable).toBeDefined();
    expect(sheet.bendTable?.rows.length).toBe(1);

    const row = sheet.bendTable!.rows[0];
    expect(row.tag).toBe("D1");
    expect(row.direction).toBe("UP");
    expect(row.angleDeg).toBe(90);
    expect(row.insideRadiusMm).toBe(2.0);
    expect(row.bendDeductionMm).toBeGreaterThan(0);
    // Para espessura 2.0 mm, matriz recomendada V = 16 mm (8 x T)
    expect(row.recommendedVDieMm).toBe(16);
  });

  it("TESTE 4: DrawingExporter exporta Prancha Técnica para SVG vetorial e DXF AutoCAD", () => {
    let doc = ChamferKernel.createDocument("Suporte Angular", 2.5, "ALUMÍNIO 5052", 0.44);
    doc = ChamferKernel.extrudeBasePlate(doc, 120, 80);
    doc = ChamferKernel.addBend(doc, "edge-top", 90, 2.5, 40);

    const sheet = ChamferKernel.generateTechnicalDrawing(doc, {
      sheetSize: "A4_LANDSCAPE",
    });

    expect(doc.activeState).toBe("2D_DRAWING");
    expect(doc.technicalDrawing).toBeDefined();

    // 1. Exportação SVG
    const svg = DrawingExporter.exportToSVG(sheet);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('viewBox="0 0 297 210"');
    expect(svg).toContain("MOLDURA DA FOLHA");
    expect(svg).toContain("BLOCO DE TÍTULO / CARIMBO ABNT");
    expect(svg).toContain("TABELA DE DOBRAS");
    expect(svg).toContain("SUPORTE ANGULAR");

    // 2. Exportação DXF
    const dxf = DrawingExporter.exportToDXF(sheet);
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("TABLES");
    expect(dxf).toContain("0_MOLDURA");
    expect(dxf).toContain("1_ARESTAS_VISIVEIS");
    expect(dxf).toContain("5_TABELA_DOBRAS");
    expect(dxf).toContain("EOF");
  });
});
