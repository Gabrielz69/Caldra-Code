/**
 * CALDRA CAD — CAD B-REP EDITOR (FASE 06) UNIT TESTS
 *
 * Valida os comandos de edição B-Rep, modificação determinística via Gizmo (push/pull),
 * aplicação de filetes/chanfros/furos e integridade da pilha de Undo/Redo.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CadFeatureTree } from "../features/CadFeatureTree";
import { CadBRepEditor } from "./CadBRepEditor";

describe("CALDRA CAD B-REP — FASE 06 (Editor & Comandos B-Rep)", () => {
  let tree: CadFeatureTree;
  let editor: CadBRepEditor;

  beforeEach(async () => {
    tree = new CadFeatureTree();
    tree.addFeature({
      name: "Caixa Base",
      type: "base_box",
      parameters: { width: 100, length: 100, height: 50, centered: true },
    });
    await tree.rebuild();
    editor = new CadBRepEditor(tree);
  });

  it("deve permitir edição 3D direta (push-pull de 50 mm para 70 mm) e reconstruir a geometria", async () => {
    const resInitial = await tree.rebuild();
    expect(resInitial.massProperties!.volume).toBeCloseTo(500000, -1);

    // Arrasta a face superior (+Z) em +20 mm (50 mm -> 70 mm)
    const success = await editor.applyFacePushPull(
      0,
      { x: 0, y: 0, z: 20 },
      { x: 0, y: 0, z: 1 },
    );

    expect(success).toBe(true);
    const resAfter = await tree.rebuild();
    // Volume esperado: 100 * 100 * 70 = 700.000 mm³
    expect(resAfter.massProperties!.volume).toBeCloseTo(700000, -1);
  });

  it("deve aplicar operação de furo paramétrico no modelo", async () => {
    const success = await editor.addHole(20, 60, { x: 0, y: 0, z: 0 }, true);
    expect(success).toBe(true);

    const res = await tree.rebuild();
    expect(res.success).toBe(true);
    // Volume final deve ser menor devido à remoção de material
    expect(res.massProperties!.volume).toBeLessThan(500000);
  });

  it("deve suportar Desfazer (Undo) e Refazer (Redo) de comandos B-Rep", async () => {
    // 1. Modifica altura: 50 -> 70 mm
    await editor.applyFacePushPull(0, { x: 0, y: 0, z: 20 }, { x: 0, y: 0, z: 1 });
    let res = await tree.rebuild();
    expect(res.massProperties!.volume).toBeCloseTo(700000, -1);

    // 2. Executa Undo -> Deve retornar para 500.000 mm³
    expect(editor.canUndo()).toBe(true);
    await editor.undo();
    res = await tree.rebuild();
    expect(res.massProperties!.volume).toBeCloseTo(500000, -1);

    // 3. Executa Redo -> Deve voltar para 700.000 mm³
    expect(editor.canRedo()).toBe(true);
    await editor.redo();
    res = await tree.rebuild();
    expect(res.massProperties!.volume).toBeCloseTo(700000, -1);
  });

  it("deve aplicar alteração de espessura de chapa (caldeiraria)", async () => {
    const success = await editor.setSheetThickness(6.35); // Chapa 1/4"
    expect(success).toBe(true);

    const res = await tree.rebuild();
    // Volume: 100 * 100 * 6.35 = 63.500 mm³
    expect(res.massProperties!.volume).toBeCloseTo(63500, -1);
  });
});
