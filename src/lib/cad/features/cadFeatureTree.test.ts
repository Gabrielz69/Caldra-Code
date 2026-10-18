/**
 * CALDRA CAD CORE — FEATURE TREE TEST SUITE (FASE 05)
 *
 * Testes unitários automatizados cobrindo a modelagem paramétrica via Árvore de Recursos (DAG):
 * - Criação sequencial de operações paramétricas
 * - Supressão temporária de nós (isSuppressed)
 * - Rollback de histórico (navegação temporal)
 * - Rebuild determinístico ao alterar parâmetros
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getCadKernel } from "../core";
import { CadFeatureTree } from "./CadFeatureTree";

describe("CALDRA CAD CORE — FASE 05 (Árvore de Recursos & Rebuild Paramétrico)", () => {
  beforeAll(async () => {
    const kernel = getCadKernel();
    await kernel.init();
  });

  it("deve criar uma Árvore de Recursos sequencial (Caixa -> Furo -> Filete -> Chanfro)", async () => {
    const tree = new CadFeatureTree();

    // 1. Caixa Base 100 × 100 × 50 mm
    tree.addFeature({
      name: "Caixa Base",
      type: "base_box",
      parameters: { width: 100, length: 100, height: 50, centered: true },
    });

    // 2. Filete R3 mm
    tree.addFeature({
      name: "Filete",
      type: "fillet",
      parameters: { radius: 3, edgeIndices: [0] },
    });

    // 3. Furo Central Cilíndrico Ø20 mm
    tree.addFeature({
      name: "Furo Ø20 mm",
      type: "hole_cut",
      parameters: { diameter: 20, depth: 60, isThrough: true, position: { x: 0, y: 0, z: -25 } },
    });

    expect(tree.getFeatures().length).toBe(3);

    // Executa o Rebuild
    const res = await tree.rebuild();
    expect(res.success).toBe(true);
    expect(res.activeShape).toBeDefined();
    expect(res.massProperties).toBeDefined();
    expect(res.tessellation).toBeDefined();

    // Volume da caixa maciça = 100 * 100 * 50 = 500.000 mm³
    // O furo Ø20 mm retira aprox. π * 10² * 50 ≈ 15.708 mm³
    const volFinal = res.massProperties!.volume;
    expect(volFinal).toBeLessThan(500000);
    expect(volFinal).toBeGreaterThan(450000);

    tree.dispose();
  });

  it("deve suprimir (suppress) um recurso e regenerar o modelo sem a operação", async () => {
    const tree = new CadFeatureTree();

    // 1. Caixa Base 100 × 100 × 50 mm
    tree.addFeature({
      name: "Caixa Base",
      type: "base_box",
      parameters: { width: 100, length: 100, height: 50, centered: true },
    });

    // 2. Furo Central
    const hole = tree.addFeature({
      name: "Furo Ø20 mm",
      type: "hole_cut",
      parameters: { diameter: 20, depth: 60, isThrough: true, position: { x: 0, y: 0, z: -25 } },
    });

    // Avalia com o furo ativo
    const resWithHole = await tree.rebuild();
    const volWithHole = resWithHole.massProperties!.volume;

    // Suprime o furo
    tree.setFeatureSuppression(hole.id, true);
    expect(tree.getFeature(hole.id)!.isSuppressed).toBe(true);

    // Rebuild sem o furo -> deve restaurar o volume maciço completo (500.000 mm³)
    const resSuppressed = await tree.rebuild();
    expect(resSuppressed.success).toBe(true);
    expect(resSuppressed.massProperties!.volume).toBeCloseTo(500000, -1);
    expect(resSuppressed.massProperties!.volume).toBeGreaterThan(volWithHole);

    // Reativa o furo
    tree.setFeatureSuppression(hole.id, false);
    const resRestored = await tree.rebuild();
    expect(resRestored.massProperties!.volume).toBeCloseTo(volWithHole, -1);

    tree.dispose();
  });

  it("deve executar Rollback de histórico e avaliar o modelo até o passo selecionado", async () => {
    const tree = new CadFeatureTree();

    // Passo 0: Caixa 100 × 100 × 50 mm
    tree.addFeature({
      name: "Caixa Base",
      type: "base_box",
      parameters: { width: 100, length: 100, height: 50, centered: true },
    });

    // Passo 1: Furo Central
    tree.addFeature({
      name: "Furo",
      type: "hole_cut",
      parameters: { diameter: 30, depth: 60, isThrough: true, position: { x: 0, y: 0, z: -25 } },
    });

    // Rollback para o Passo 0 (apenas Caixa Base)
    tree.setRollbackIndex(0);
    const resRollback0 = await tree.rebuild();
    expect(resRollback0.success).toBe(true);
    expect(resRollback0.massProperties!.volume).toBeCloseTo(500000, -1);

    // Retorna ao Fim (Passo 1 com Furo)
    tree.setRollbackIndex(-1);
    const resFinal = await tree.rebuild();
    expect(resFinal.success).toBe(true);
    expect(resFinal.massProperties!.volume).toBeLessThan(500000);

    tree.dispose();
  });

  it("deve atualizar parâmetros e propagar o rebuild determinístico", async () => {
    const tree = new CadFeatureTree();

    const box = tree.addFeature({
      name: "Caixa Base",
      type: "base_box",
      parameters: { width: 100, length: 100, height: 50, centered: true },
    });

    const res1 = await tree.rebuild();
    expect(res1.massProperties!.volume).toBeCloseTo(500000, -1);

    // Altera largura X para 150 mm (150 * 100 * 50 = 750.000 mm³)
    tree.updateFeature(box.id, { width: 150 });
    const res2 = await tree.rebuild();
    expect(res2.success).toBe(true);
    expect(res2.massProperties!.volume).toBeCloseTo(750000, -1);

    tree.dispose();
  });

  it("deve reconstruir graciosamente se um HoleCut for adicionado sem caixa base inicial", async () => {
    const tree = new CadFeatureTree();

    // Adiciona furo diretamente como primeiro nó
    tree.addFeature({
      name: "Furo Sem Caixa",
      type: "hole_cut",
      parameters: { diameter: 20, depth: 30, isThrough: true, position: { x: 0, y: 0, z: 0 } },
    });

    const res = await tree.rebuild();
    expect(res.success).toBe(true);
    expect(res.activeShape).toBeDefined();
    expect(res.massProperties).toBeDefined();

    tree.dispose();
  });

  it("deve integrar modelo paramétrico de caldeiraria CALDRA diretamente na Árvore de Recursos (DAG)", async () => {
    const tree = new CadFeatureTree();

    // 1. Cria transição Quadrado para Redondo como base da árvore
    tree.addFeature({
      name: "Transição QtoR CALDRA",
      type: "boilermaking_transition",
      parameters: {
        width: 100,
        length: 100,
        diameter: 60,
        height: 80,
        thickness: 3,
      },
    });

    const res = await tree.rebuild();
    expect(res.success).toBe(true);
    expect(res.activeShape).toBeDefined();
    expect(res.massProperties!.volume).toBeGreaterThan(5000);
    expect(res.tessellation!.mesh.indices.length).toBeGreaterThan(0);

    tree.dispose();
  });
});
