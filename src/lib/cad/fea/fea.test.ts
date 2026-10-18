// @ts-nocheck
/**
 * CALDRA CAD FEA (FINITE ELEMENT ANALYSIS) & STRUCTURAL INTEGRITY — FASE 15
 *
 * Suíte de testes industriais para análise estrutural por elementos finitos:
 * - Propriedades elásticas de ligas metálicas (Aço A36, Inox 304, Hardox 450, Al 6061)
 * - Discretização geométrica em malhas triangulares 2D CST (Constant Strain Triangles)
 * - Solução matricial da rigidez global [K]{u} = {F} sob tração e flexão
 * - Cálculo de tensões de Von Mises, tensões principais e deformações
 * - Fator de segurança (FOS) e verificação de flechas NBR 8800 (L/300)
 * - Identificação de pontos críticos de concentração de tensão (Hotspots)
 * - Exportação de Memorial de Cálculo em CSV e Mapa de Calor em SVG
 */

import { describe, it, expect } from "vitest";
import { getFeaMaterial, FEA_MATERIALS } from "./materials";
import { FeaMesher } from "./mesher";
import { FeaEngine } from "./feaEngine";
import { FeaReportExporter } from "./feaReportExporter";
import type { PartDocument } from "../kernel/types";
import { FeatureTree } from "../features/featureTree";

function createMockPartDocument(overrides?: Partial<PartDocument>): PartDocument {
  return {
    id: "PART-FEA-TEST-001",
    name: "Chapa Suporte Estrutural",
    thickness: 4.75, // Chapa de 3/16" (~4.75mm)
    material: "ASTM A36",
    density: 7.85,
    kFactor: 0.44,
    innerRadius: 5.0,
    baseWidth: 150,
    baseLength: 400,
    featureTree: new FeatureTree(),
    canonicalModel: {
      schemaVersion: 1,
      name: "Chapa Suporte",
      units: "mm",
      solids: [],
    },
    activeState: "FEA",
    entities2D: [
      { id: "e1", type: "line", x1: 0, y1: 0, x2: 400, y2: 0, layer: "corte" },
      { id: "e2", type: "line", x1: 400, y1: 0, x2: 400, y2: 150, layer: "corte" },
      { id: "e3", type: "line", x1: 400, y1: 150, x2: 0, y2: 150, layer: "corte" },
      { id: "e4", type: "line", x1: 0, y1: 150, x2: 0, y2: 0, layer: "corte" },
      // Furo central para testar concentração de tensão
      { id: "e5", type: "circle", cx: 200, cy: 75, r: 25, layer: "corte" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("CALDRA CAD ANÁLISE ESTRUTURAL FEA / CAE — FASE 15", () => {
  it("TESTE 1: Banco de dados de materiais retorna propriedades elásticas corretas", () => {
    const a36 = getFeaMaterial("ASTM A36");
    expect(a36.youngsModulus).toBe(200000); // 200 GPa
    expect(a36.yieldStrength).toBe(250); // 250 MPa
    expect(a36.poissonsRatio).toBe(0.26);

    const inox = getFeaMaterial("Inox 304");
    expect(inox.id).toBe("AISI_304");
    expect(inox.youngsModulus).toBe(193000);
    expect(inox.yieldStrength).toBe(205);

    const hardox = getFeaMaterial("Hardox 450");
    expect(hardox.id).toBe("HARDOX_450");
    expect(hardox.yieldStrength).toBe(1200);

    const al = getFeaMaterial("Aluminio 6061");
    expect(al.id).toBe("AL_6061_T6");
    expect(al.youngsModulus).toBe(68900);
  });

  it("TESTE 2: Geração de malha 2D CST respeita dimensões e contornos de furos", () => {
    const doc = createMockPartDocument();
    const mesh = FeaMesher.generateMesh(doc, { meshRefinement: "MEDIUM" });

    expect(mesh.numNodes).toBeGreaterThan(30);
    expect(mesh.numElements).toBeGreaterThan(40);
    expect(mesh.boundingBox.maxX).toBe(400);
    expect(mesh.boundingBox.maxY).toBe(150);

    // Garante que todos os elementos têm área positiva e nós válidos
    for (const elem of mesh.elements) {
      expect(elem.area).toBeGreaterThan(0);
      expect(elem.nodeIds.length).toBe(3);
      expect(elem.thickness).toBe(4.75);
    }

    // Nenhum nó deve estar no centro exato do furo (200, 75)
    for (const node of mesh.nodes) {
      const distToHole = Math.sqrt((node.x - 200) ** 2 + (node.y - 75) ** 2);
      expect(distToHole).toBeGreaterThan(15);
    }
  });

  it("TESTE 3: Solução FEA sob flexão em balanço calcula deflexão e tensões de Von Mises", () => {
    const doc = createMockPartDocument();
    const result = FeaEngine.solve(doc, {
      loadCase: "CANTILEVER_BENDING",
      appliedForceN: 3000, // 3.0 kN
    });

    expect(result.id).toContain("FEA-");
    expect(result.material.id).toBe("ASTM_A36");
    expect(result.maxDeflectionMm).toBeGreaterThan(0);
    expect(result.maxVonMisesMPa).toBeGreaterThan(0);
    expect(result.minFactorOfSafety).toBeGreaterThan(0);

    // O nó engastado (em x ~ 0) deve ter deslocamento zero
    const restrainedNodes = result.mesh.nodes.filter((n) => n.isRestrained);
    expect(restrainedNodes.length).toBeGreaterThan(0);
    for (const n of restrainedNodes) {
      expect(Math.abs(n.u || 0)).toBeLessThan(1e-4);
      expect(Math.abs(n.v || 0)).toBeLessThan(1e-4);
    }

    // O nó de deflexão máxima deve estar na extremidade livre (x ~ 400)
    const maxNode = result.mesh.nodes.find((n) => n.id === result.maxDeflectionNodeId);
    expect(maxNode).toBeDefined();
    expect(maxNode!.x).toBeGreaterThan(350);
  });

  it("TESTE 4: Solução FEA sob tração axial pura gera tensão uniforme e FOS coerente", () => {
    const doc = createMockPartDocument();
    const forceN = 50000; // 50 kN de tração
    const result = FeaEngine.solve(doc, {
      loadCase: "TENSION",
      appliedForceN: forceN,
    });

    // Em tração com chapa de 150x4.75 mm = 712.5 mm²
    // Tensão nominal média σ = F / A ≈ 50000 / 712.5 ≈ 70.1 MPa
    // Próximo ao furo há concentração de tensão (Kt ~ 2 a 3) -> ~ 140 a 210 MPa
    expect(result.avgVonMisesMPa).toBeGreaterThan(20);
    expect(result.maxVonMisesMPa).toBeGreaterThan(60);

    // Tensão de escoamento fy = 250 MPa -> FOS esperado entre 1.0 e 4.0
    expect(result.minFactorOfSafety).toBeGreaterThan(0.8);
    expect(result.minFactorOfSafety).toBeLessThan(5.0);
  });

  it("TESTE 5: Verificação de limites de segurança e norma NBR 8800 (L/300)", () => {
    const doc = createMockPartDocument();

    // 1. Caso Seguro (carga baixa de 500 N)
    const safeResult = FeaEngine.solve(doc, {
      appliedForceN: 500,
    });
    expect(safeResult.status).toBe("SAFE");
    expect(safeResult.minFactorOfSafety).toBeGreaterThanOrEqual(1.5);
    expect(safeResult.deflectionPassed).toBe(true);

    // 2. Caso de Sobrecarga Severa (carga excessiva de 120 kN) -> Falha Estrutural
    const failureResult = FeaEngine.solve(doc, {
      appliedForceN: 120000,
    });
    expect(failureResult.status).toBe("CRITICAL_FAILURE");
    expect(failureResult.minFactorOfSafety).toBeLessThan(1.0);
    expect(failureResult.summaryMessage).toContain("FALHA ESTRUTURAL");
  });

  it("TESTE 6: Detecção automática de Hotspots (concentração de tensões)", () => {
    const doc = createMockPartDocument();
    const result = FeaEngine.solve(doc, { appliedForceN: 4000 });

    expect(result.hotspots.length).toBeGreaterThan(0);
    expect(result.hotspots.length).toBeLessThanOrEqual(3);

    const primaryHotspot = result.hotspots[0];
    expect(primaryHotspot.vonMisesMPa).toBeGreaterThan(0);
    expect(primaryHotspot.description).toContain("Pico de tensão");
  });

  it("TESTE 7: Exportação de Memorial de Cálculo em CSV com conformidade", () => {
    const doc = createMockPartDocument();
    const result = FeaEngine.solve(doc);
    const csv = FeaReportExporter.exportToCSV(result);

    expect(csv).toContain("CALDRA CAD — MEMORIAL DE CÁLCULO ESTRUTURAL (FEA / CAE)");
    expect(csv).toContain("ASTM A36");
    expect(csv).toContain("Fator de Segurança Mínimo (FOS)");
    expect(csv).toContain("Tensão Máxima de Von Mises (MPa)");
    expect(csv).toContain("PONTOS CRÍTICOS / CONCENTRAÇÃO DE TENSÃO (HOTSPOTS)");
    expect(csv).toContain("ELEMENTOS DA MALHA E TENSÕES");
  });

  it("TESTE 8: Exportação de Mapa de Calor de Tensões em SVG vetorial", () => {
    const doc = createMockPartDocument();
    const result = FeaEngine.solve(doc);
    const svg = FeaReportExporter.exportToStressHeatmapSVG(result, 800, 500);

    expect(svg).toContain("<svg");
    expect(svg).toContain("CALDRA CAD — ANÁLISE ESTRUTURAL FEA");
    expect(svg).toContain('id="elements"');
    expect(svg).toContain('id="legend"');
    expect(svg).toContain('id="summary"');
    expect(svg).toContain("Von Mises (MPa)");
    expect(svg).toContain("</svg>");
  });
});
