import { describe, it, expect } from "vitest";
import { ChamferKernel } from "./chamferKernel";
import { ChamferBridge } from "./chamferBridge";
import type { Entity } from "@/lib/lab2d/core";

describe("CALDRA CAD UNIFIED KERNEL & CHAMFER BRIDGE — FASE 08", () => {
  it("TESTE 1: ChamferBridge infere restrições geométricas automáticas de entidades 2D", () => {
    const rawEntities: Entity[] = [
      // Linha horizontal de (0,0) a (100,0)
      { id: "l1", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, layer: "CORTE" },
      // Linha vertical de (100,0) a (100,50)
      { id: "l2", type: "line", x1: 100, y1: 0, x2: 100, y2: 50, layer: "CORTE" },
      // Furo circular de raio 10 no centro (50, 25)
      { id: "c1", type: "circle", cx: 50, cy: 25, r: 10, layer: "CORTE" },
    ];

    const { sketch, autoConstraints } = ChamferBridge.entitiesToSketch(rawEntities, "Esboço Teste");

    expect(sketch.elements.length).toBe(3);
    // Deve inferir HORIZONTAL na l1
    expect(autoConstraints.some((c) => c.type === "HORIZONTAL")).toBe(true);
    // Deve inferir VERTICAL na l2
    expect(autoConstraints.some((c) => c.type === "VERTICAL")).toBe(true);
    // Deve inferir COINCIDENT entre o final de l1 e início de l2
    expect(autoConstraints.some((c) => c.type === "COINCIDENT")).toBe(true);
    // Deve inferir RADIUS no círculo
    expect(autoConstraints.some((c) => c.type === "RADIUS" && c.value === 10)).toBe(true);

    // Conversão de volta para entidades vetoriais
    const reconverted = ChamferBridge.sketchToEntities(sketch);
    expect(reconverted.length).toBe(3);
  });

  it("TESTE 2: Fluxo Paramétrico Completo: Criar Doc → Extrudar → Dobrar → Planificar", () => {
    let doc = ChamferKernel.createDocument(
      "Peça Chapa Dobrada L",
      3.0,
      "Aço Carbono SAE 1020",
      0.44,
    );

    expect(doc.thickness).toBe(3.0);
    expect(doc.activeState).toBe("3D_FOLDED");

    // 1. Extrusão da chapa base
    doc = ChamferKernel.extrudeBasePlate(doc, 100, 100);
    expect(doc.activeSolid).toBeDefined();
    expect(doc.activeSolid?.volume).toBe(100 * 100 * 3.0);
    expect(doc.canonicalModel.bodies.length).toBe(1);

    // 2. Adição de dobra a 90°
    doc = ChamferKernel.addBend(doc, {
      angleDeg: 90,
      flangeLengthMm: 50,
      bendLinePositionMm: 50,
    });
    expect(doc.featureTree.getFeatures().some((f) => f.type === "bend")).toBe(true);

    // 3. Desdobrar (Unfold) para Flat Pattern 2D
    doc = ChamferKernel.unfold(doc);
    expect(doc.activeState).toBe("2D_FLAT");
    expect(doc.flatPatternResult).toBeDefined();
    expect(doc.entities2D.length).toBeGreaterThan(0);

    // Deve conter camadas CORTE e DOBRA
    expect(doc.entities2D.some((e) => e.layer === "CORTE")).toBe(true);
    expect(doc.entities2D.some((e) => e.layer === "DOBRA")).toBe(true);

    // 4. Dobrar de volta (Fold)
    doc = ChamferKernel.fold(doc);
    expect(doc.activeState).toBe("3D_FOLDED");
  });

  it("TESTE 3: Geração de Percurso CNC e Código G a partir do Modelo Paramétrico", () => {
    let doc = ChamferKernel.createDocument("Gabarito de Corte CNC", 2.0);
    doc = ChamferKernel.extrudeBasePlate(doc, 150, 150);

    // Gera CAM
    doc = ChamferKernel.generateCAM(doc);

    expect(doc.activeState).toBe("CAM_TOOLPATH");
    expect(doc.camResult).toBeDefined();
    expect(doc.gcode).toBeDefined();
    expect(doc.gcode).toContain("G21");
    expect(doc.gcode).toContain("M03");
    expect(doc.gcode).toContain("M05");
    expect(doc.gcode).toContain("M30");
  });

  it("TESTE 4: Reconstrução Paramétrica (Rebuild) propaga alterações", () => {
    let doc = ChamferKernel.createDocument("Suporte Industrial", 2.5);
    doc = ChamferKernel.extrudeBasePlate(doc, 80, 80);

    const { report } = ChamferKernel.rebuild(doc, {
      generateFlatPattern: true,
      generateCamToolpath: true,
    });

    expect(report.success).toBe(true);
    expect(doc.flatPatternResult).toBeDefined();
    expect(doc.gcode).toBeDefined();
  });
});
