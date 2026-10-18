/**
 * CALDRA CAD — DRAFTING & DETALHAMENTO TÉCNICO (FASE 09) UNIT TESTS
 *
 * Valida a geração paramétrica de pranchas técnicas industriais ABNT/ISO,
 * projeções ortográficas 2D a partir do sólido 3D B-Rep e exportação SVG/DXF.
 */

import { describe, it, expect } from "vitest";
import { CaldraDraftingBridge } from "./CaldraDraftingBridge";
import type { CadFeatureNode } from "../features/CadFeatureModel";

describe("CALDRA CAD — FASE 09 (Drafting & Detalhamento Técnico 2D Industrial)", () => {
  it("deve gerar prancha técnica A4 Paisagem com vistas ortográficas e carimbo ABNT", () => {
    const features: CadFeatureNode[] = [
      {
        id: "f_base",
        name: "Caixa Estrutural",
        type: "base_box",
        parameters: { width: 120, length: 80, height: 40, centered: true },
        dependencies: [],
        references: [],
        affectedEntityIds: [],
        state: "VALID",
        isSuppressed: false,
        timestamp: Date.now(),
      },
    ];

    const massProps = {
      volume: 384000,
      mass: 3.014,
      surfaceArea: 35200,
      centerOfMass: { x: 0, y: 0, z: 0 },
    };

    const res = CaldraDraftingBridge.generateDrawingSheet(features, massProps, {
      sheetSize: "A4_LANDSCAPE",
      author: "ENG. GABRIEL",
      company: "CALDRA METALÚRGICA",
    });

    expect(res).toBeDefined();
    expect(res.sheet.widthMm).toBe(297);
    expect(res.sheet.heightMm).toBe(210);

    // Deve conter no mínimo 3 vistas (Frontal, Lateral/Superior, Isométrica)
    expect(res.sheet.views.length).toBeGreaterThanOrEqual(3);
    expect(res.sheet.views.some((v) => v.type === "FRONT")).toBe(true);
    expect(res.sheet.views.some((v) => v.type === "ISOMETRIC")).toBe(true);

    // Carimbo preenchido
    expect(res.sheet.titleBlock.title).toBe("Caixa Estrutural");
    expect(res.sheet.titleBlock.company).toBe("CALDRA METALÚRGICA");
    expect(res.sheet.titleBlock.estimatedMassKg).toBe(3.014);

    // SVG técnico válido
    expect(res.svgString).toContain("<svg");
    expect(res.svgString).toContain("viewBox");
    expect(res.svgString).toContain("VISTA FRONTAL");
    expect(res.svgString).toContain("CALDRA METALÚRGICA");

    // DXF industrial válido com layers
    expect(res.dxfString).toContain("SECTION");
    expect(res.dxfString).toContain("ENTITIES");
    expect(res.dxfString).toContain("0_MOLDURA");
    expect(res.dxfString).toContain("0_LEGENDA");
    expect(res.dxfString).toContain("1_ARESTAS_VISIVEIS");
  });

  it("deve gerar prancha técnica para modelo de caldeiraria (Cone Truncado)", () => {
    const features: CadFeatureNode[] = [
      {
        id: "f_cone",
        name: "Cone Truncado de Redução Ø150×Ø80 mm",
        type: "boilermaking_cone",
        parameters: { D: 150, d: 80, height: 120, thickness: 3 },
        dependencies: [],
        references: [],
        affectedEntityIds: [],
        state: "VALID",
        isSuppressed: false,
        timestamp: Date.now(),
      },
    ];

    const res = CaldraDraftingBridge.generateDrawingSheet(features, null, {
      sheetSize: "A3_LANDSCAPE",
    });

    expect(res.sheet.widthMm).toBe(420);
    expect(res.sheet.heightMm).toBe(297);
    expect(res.sheet.titleBlock.title).toContain("Cone Truncado");
    expect(res.svgString).toContain("<svg");
  });
});
