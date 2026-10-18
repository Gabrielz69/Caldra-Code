/**
 * CALDRA CAD — FLAT PATTERN & FABRICATION BRIDGE (FASE 08) UNIT TESTS
 *
 * Valida a planificação automática a partir do sólido 3D na Árvore de Recursos,
 * exportação de DXF R12, código G CNC e cálculo de dobras.
 */

import { describe, it, expect } from "vitest";
import { CaldraFlatPatternBridge } from "./CaldraFlatPatternBridge";
import type { CadFeatureNode } from "../features/CadFeatureModel";

describe("CALDRA CAD — FASE 08 (Planificação & Fabricação)", () => {
  it("deve planificar Cone Truncado a partir da árvore de recursos 3D", () => {
    const features: CadFeatureNode[] = [
      {
        id: "f_cone",
        name: "Cone Truncado",
        type: "boilermaking_cone",
        parameters: { D: 120, d: 70, height: 100, thickness: 3 },
        dependencies: [],
        references: [],
        affectedEntityIds: [],
        state: "VALID",
        isSuppressed: false,
        timestamp: Date.now(),
      },
    ];

    const plan = CaldraFlatPatternBridge.generateFlatPatternFromFeatures(features);
    expect(plan).toBeDefined();
    expect(plan.partName).toContain("Cone Truncado");
    expect(plan.thickness).toBe(3);
    expect(plan.widthMm).toBeGreaterThan(50);
    expect(plan.heightMm).toBeGreaterThan(50);
    expect(plan.perimeterCutMm).toBeGreaterThan(100);

    // Deve conter DXF válido com linhas de corte e dobra
    expect(plan.dxfString).toContain("SECTION");
    expect(plan.dxfString).toContain("ENTITIES");
    expect(plan.dxfString).toContain("CORTE");

    // Deve conter G-Code CNC
    expect(plan.gcodeString).toContain("G21");
    expect(plan.gcodeString).toContain("M03");
    expect(plan.gcodeString).toContain("M05");
    expect(plan.gcodeString).toContain("M30");
  });

  it("deve planificar Transição Quadrado para Redondo com geratrizes de dobra", () => {
    const features: CadFeatureNode[] = [
      {
        id: "f_qtr",
        name: "Transição QtoR",
        type: "boilermaking_transition",
        parameters: { width: 120, length: 120, diameter: 80, height: 100, thickness: 4.75 },
        dependencies: [],
        references: [],
        affectedEntityIds: [],
        state: "VALID",
        isSuppressed: false,
        timestamp: Date.now(),
      },
    ];

    const plan = CaldraFlatPatternBridge.generateFlatPatternFromFeatures(features);
    expect(plan.partName).toContain("Quadrado para Redondo");
    expect(plan.thickness).toBe(4.75);
    expect(plan.bendCount).toBeGreaterThan(0);
    expect(plan.bendingInstructions.length).toBeGreaterThan(0);
    expect(plan.entities.some((e) => e.layer === "DOBRA")).toBe(true);
  });

  it("deve planificar Curva de Gomos (Cotovelo)", () => {
    const features: CadFeatureNode[] = [
      {
        id: "f_elbow",
        name: "Curva de Gomos",
        type: "boilermaking_elbow",
        parameters: { diameter: 80, radius: 120, angleDeg: 90, segments: 4, thickness: 3.17 },
        dependencies: [],
        references: [],
        affectedEntityIds: [],
        state: "VALID",
        isSuppressed: false,
        timestamp: Date.now(),
      },
    ];

    const plan = CaldraFlatPatternBridge.generateFlatPatternFromFeatures(features);
    expect(plan.partName).toContain("Cotovelo");
    expect(plan.widthMm).toBeGreaterThan(50);
  });
});
