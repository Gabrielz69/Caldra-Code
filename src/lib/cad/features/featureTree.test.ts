// @ts-nocheck
import { describe, it, expect } from "vitest";
import { FeatureTree } from "./featureTree";

describe("CALDRA CAD FEATURE TREE & REBUILD ENGINE — FASE 03", () => {
  it("TESTE 1: Inicialização com planos de referência padrão (XY, XZ, YZ)", () => {
    const tree = new FeatureTree("Projeto Base");
    expect(tree.features.length).toBe(3);
    expect(tree.features[0].name).toBe("Plano Frontal (XY)");
    expect(tree.features[1].name).toBe("Plano Superior (XZ)");
    expect(tree.features[2].name).toBe("Plano Lateral (YZ)");
  });

  it("TESTE 2: Adição ordenada de Sketch e Extrusão e Rebuild canônico", () => {
    const tree = new FeatureTree("Caixa Metálica");

    // Adiciona Sketch 01 (100 × 50 mm)
    const sketchFeat = tree.addFeature({
      name: "Sketch 01",
      type: "sketch",
      parameters: { width: 100, height: 50 },
      references: [tree.features[0].id], // Referência ao Plano Frontal
    });

    // Adiciona Extrusão 01 (10 mm) dependente do Sketch 01
    const extrudeFeat = tree.addFeature({
      name: "Extrusão 01",
      type: "extrude",
      parameters: { depth: 10, material: "Aço Carbono", density: 7.85 },
      dependencies: [sketchFeat.id],
      references: [sketchFeat.id],
    });

    expect(tree.features.length).toBe(5);

    // Executa Rebuild inicial
    const report = tree.rebuild();
    expect(report.success).toBe(true);
    expect(sketchFeat.state).toBe("VALID");
    expect(extrudeFeat.state).toBe("VALID");

    // Verifica corpo sólido gerado no modelo canônico
    expect(tree.model.bodies.length).toBe(1);
    const body = tree.model.bodies[0];
    expect(body.type).toBe("solid");
    if (body.type === "solid") {
      expect(body.volume).toBe(50000);
      expect(body.faces.length).toBe(6);
    }
  });

  it("TESTE 3: Detecção de 'DERIVADOS DESATUALIZADOS' ao alterar parâmetro de Sketch", () => {
    const tree = new FeatureTree("Perfil Chapa");

    const sketchFeat = tree.addFeature({
      name: "Sketch 01",
      type: "sketch",
      parameters: { width: 80, height: 40 },
    });

    const extrudeFeat = tree.addFeature({
      name: "Extrusão 01",
      type: "extrude",
      parameters: { depth: 3 },
      dependencies: [sketchFeat.id],
    });

    const sheetFeat = tree.addFeature({
      name: "Chapa 01",
      type: "convert_sheet_metal",
      parameters: { thickness: 3, kFactor: 0.33 },
      dependencies: [extrudeFeat.id],
    });

    tree.rebuild();
    expect(sketchFeat.state).toBe("VALID");
    expect(extrudeFeat.state).toBe("VALID");
    expect(sheetFeat.state).toBe("VALID");

    // Altera a largura do Sketch 01 de 80 para 160 mm
    const alerts = tree.updateFeatureParameters(sketchFeat.id, { width: 160 });

    // Sketch deve ficar DIRTY
    expect(sketchFeat.state).toBe("DIRTY");

    // Extrusão e Chapa devem ser marcados como STALE
    expect(extrudeFeat.state).toBe("STALE");
    expect(sheetFeat.state).toBe("STALE");

    // Deve alertar os domínios downstream afetados
    expect(alerts.length).toBe(2);
    expect(alerts[0].affectedDomains).toContain("2D");
    expect(alerts[0].affectedDomains).toContain("3D");
    expect(alerts[0].affectedDomains).toContain("planificação");
    expect(alerts[0].affectedDomains).toContain("CNC");
    expect(alerts[0].affectedDomains).toContain("BOM");
  });

  it("TESTE 4: Rebuild após alteração atualiza o sólido com as novas dimensões analíticas", () => {
    const tree = new FeatureTree("Flange");

    const sketch = tree.addFeature({
      name: "Sketch 01",
      type: "sketch",
      parameters: { width: 100, height: 100 },
    });

    tree.addFeature({
      name: "Extrusão 01",
      type: "extrude",
      parameters: { depth: 5 },
      dependencies: [sketch.id],
    });

    tree.rebuild();
    expect(tree.model.bodies[0].type === "solid" && tree.model.bodies[0].volume).toBe(50000);

    // Altera dimensões para 200 × 100 × 5
    tree.updateFeatureParameters(sketch.id, { width: 200 });
    const rebuildRes = tree.rebuild();

    expect(rebuildRes.success).toBe(true);
    expect(tree.model.bodies[0].type === "solid" && tree.model.bodies[0].volume).toBe(100000);
  });

  it("TESTE 5: Supressão de recurso (isSuppressed) desativa sua contribuição no modelo", () => {
    const tree = new FeatureTree("Teste Supressão");

    const sketch = tree.addFeature({
      name: "Sketch 01",
      type: "sketch",
      parameters: { width: 50, height: 50 },
    });

    const extrude = tree.addFeature({
      name: "Extrusão 01",
      type: "extrude",
      parameters: { depth: 4 },
      dependencies: [sketch.id],
    });

    tree.setFeatureSuppressed(extrude.id, true);
    expect(extrude.state).toBe("SUPPRESSED");
    expect(extrude.isSuppressed).toBe(true);

    const report = tree.rebuild();
    expect(report.success).toBe(true);
    // Como a extrusão foi suprimida, nenhum corpo deve ser gerado
    expect(tree.model.bodies.length).toBe(0);
  });

  it("TESTE 6: Interrupção técnica com estado ERROR se a referência geométrica faltar", () => {
    const tree = new FeatureTree("Erro Referência");

    // Adiciona extrusão diretamente sem nenhum sketch
    const orphanExtrude = tree.addFeature({
      name: "Extrusão Órfã",
      type: "extrude",
      parameters: { depth: 10 },
      references: ["id_inexistente_que_nao_existe"],
      dependencies: ["id_inexistente_que_nao_existe"],
    });

    const report = tree.rebuild();
    expect(report.success).toBe(false);
    expect(orphanExtrude.state).toBe("ERROR");
    expect(orphanExtrude.errors.length).toBeGreaterThan(0);
  });
});
