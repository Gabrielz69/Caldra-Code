/**
 * CALDRA CAD — WELDMENTS & STRUCTURAL FRAMING (FASE 10) UNIT TESTS
 *
 * Valida a criação de perfis estruturais (Viga W/I, Tubo Metalon, Cantoneira L),
 * quadros soldados, lista de corte (Cut-List de Serralheria) e integração com a Árvore de Recursos.
 */

import { describe, it, expect } from "vitest";
import { CaldraWeldmentBridge } from "./CaldraWeldmentBridge";
import { CadFeatureTree } from "../features/CadFeatureTree";
import { getCadKernel } from "../core";

describe("CALDRA CAD — FASE 10 (Weldments & Estruturas Metálicas Soldadas)", () => {
  it("deve carregar perfis estruturais do catálogo industrial normalizado", () => {
    const all = CaldraWeldmentBridge.getAvailableProfiles();
    expect(all.length).toBeGreaterThan(10);

    const iBeams = CaldraWeldmentBridge.getProfilesByType("I_BEAM");
    expect(iBeams.length).toBeGreaterThan(0);
    expect(iBeams[0].designation).toContain("W");

    const rectTubes = CaldraWeldmentBridge.getProfilesByType("RECT_TUBE");
    expect(rectTubes.length).toBeGreaterThan(0);
  });

  it("deve gerar Lista de Corte (Cut-List) de serralheria com cálculo de massa e barras de 6m", () => {
    const report = CaldraWeldmentBridge.generateCutList([
      {
        id: "f_beam1",
        name: "Tubo Metalon 80x40x3",
        type: "weldment_beam",
        parameters: {
          profileDesignation: "Tubo 80x40x3.00",
          profileType: "RECT_TUBE",
          lengthMm: 1200,
          widthMm: 80,
          heightMm: 40,
          thicknessMm: 3,
          linearMassKgM: 5.35,
          miterLeftDeg: 45,
          miterRightDeg: 45,
        },
        dependencies: [],
        references: [],
        affectedEntityIds: [],
        state: "VALID",
        isSuppressed: false,
        timestamp: Date.now(),
      },
    ]);

    expect(report).toBeDefined();
    expect(report.cutList.length).toBe(1);
    expect(report.cutList[0].lengthMm).toBe(1200);
    expect(report.cutList[0].miterLeftDeg).toBe(45);
    expect(report.totalMassKg).toBeGreaterThan(5);
    expect(report.commercialBars6mNeeded).toBe(1);
    expect(report.csvString).toContain("ITEM;PERFIL");
    expect(report.csvString).toContain("45°");
  });

  it("deve gerar sólido 3D B-Rep para Viga W e Tubo Metalon no OCCT Kernel", async () => {
    const kernel = getCadKernel();
    await kernel.init();

    // 1. Tubo Retangular Oco
    const tubeShape = await CaldraWeldmentBridge.createStructuralBeam({
      profileDesignation: "Metalon 50x30x2",
      profileType: "RECT_TUBE",
      lengthMm: 300,
      widthMm: 50,
      heightMm: 30,
      thicknessMm: 2,
      linearMassKgM: 2.38,
    });
    expect(tubeShape).toBeDefined();
    const tubeMass = await kernel.getMassProperties(tubeShape);
    expect(tubeMass.volume).toBeGreaterThan(0);

    // 2. Viga I / W
    const beamShape = await CaldraWeldmentBridge.createStructuralBeam({
      profileDesignation: "W150x13",
      profileType: "I_BEAM",
      lengthMm: 250,
      widthMm: 100,
      heightMm: 148,
      thicknessMm: 4.9,
      linearMassKgM: 13.0,
    });
    expect(beamShape).toBeDefined();
    const beamMass = await kernel.getMassProperties(beamShape);
    expect(beamMass.volume).toBeGreaterThan(0);
  });

  it("deve integrar membro estrutural à Árvore Paramétrica DAG", async () => {
    const tree = new CadFeatureTree();
    await tree.addFeature({
      name: "Coluna W150x13",
      type: "weldment_beam",
      parameters: {
        profileDesignation: "W150x13",
        profileType: "I_BEAM",
        lengthMm: 400,
        widthMm: 100,
        heightMm: 148,
        thicknessMm: 4.9,
        linearMassKgM: 13.0,
      },
    });

    const res = await tree.rebuild();
    expect(res.success).toBe(true);
    expect(res.activeShape).toBeDefined();
    expect(res.features[0].state).toBe("VALID");
  });
});
