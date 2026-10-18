// @ts-nocheck
/**
 * CALDRA CAD FORMING TOOLS, ADVANCED SHEET METAL & PRESS BRAKE SIMULATION — FASE 12
 *
 * Suíte de testes analíticos e de integração para:
 *  - Bainhas industriais (Closed, Open, Teardrop, Rolled Hem)
 *  - Degraus de encaixe (Jog / Joggle Flanges)
 *  - Nervuras de reforço em dobra (Sheet Metal Gusset)
 *  - Venezianas de respiro e aeração (Louvers)
 *  - Estampos, repuxos e escareados (Embosses, Countersinks)
 *  - Simulação de tonelagem de prensa dobradeira e retorno elástico (Springback)
 *  - Integração com o ChamferKernel e exportação técnica
 */

import { describe, it, expect } from "vitest";
import {
  HemEngine,
  FormingEngine,
  PressBrakeSimulator,
  type SheetMetalHemDef,
  type SheetMetalJogDef,
  type SheetMetalGussetDef,
  type SheetMetalLouverDef,
  type SheetMetalEmbossDef,
} from "./index";
import { ChamferKernel } from "../kernel/chamferKernel";

describe("CALDRA CAD FORMING TOOLS & PRESS BRAKE SIMULATION — FASE 12", () => {
  it("TESTE 1: HemEngine calcula analiticamente os 4 tipos normalizados de bainha", () => {
    // 1. Bainha Fechada (Closed Hem) — t = 2mm, L = 15mm
    const closedHem: SheetMetalHemDef = {
      id: "hem_closed_1",
      edgeId: "edge_top",
      type: "CLOSED",
      lengthMm: 15,
      side: "TOP",
      thicknessMm: 2,
    };
    const resClosed = HemEngine.calculateHem(closedHem);
    expect(resClosed.developedLengthMm).toBeLessThan(15); // Desconto de dobra esmagada
    expect(resClosed.bendDeductionMm).toBeGreaterThan(0.5);
    expect(resClosed.bendLines[0].angleDeg).toBe(180);
    expect(resClosed.bendLines[0].direction).toBe("UP");

    // 2. Bainha Aberta (Open Hem) — com folga interna gap = 3mm
    const openHem: SheetMetalHemDef = {
      id: "hem_open_1",
      edgeId: "edge_right",
      type: "OPEN",
      lengthMm: 15,
      gapMm: 3,
      side: "BOTTOM",
      thicknessMm: 2,
    };
    const resOpen = HemEngine.calculateHem(openHem);
    expect(resOpen.neutralRadiusMm).toBeCloseTo(1.5 + 0.45 * 2, 1);
    expect(resOpen.bendLines[0].direction).toBe("DOWN");

    // 3. Bainha Gota d'Água (Teardrop Hem) — raio interno = 3mm
    const teardropHem: SheetMetalHemDef = {
      id: "hem_tear_1",
      edgeId: "edge_left",
      type: "TEARDROP",
      lengthMm: 15,
      radiusMm: 3,
      side: "TOP",
      thicknessMm: 2,
    };
    const resTear = HemEngine.calculateHem(teardropHem);
    expect(resTear.developedLengthMm).toBeGreaterThan(15); // Adiciona o arco da gota

    // 4. Bainha Enrolada (Rolled Hem) — rotação de 270°
    const rolledHem: SheetMetalHemDef = {
      id: "hem_roll_1",
      edgeId: "edge_bottom",
      type: "ROLLED",
      lengthMm: 10,
      radiusMm: 4,
      rollAngleDeg: 270,
      side: "TOP",
      thicknessMm: 1.5,
    };
    const resRoll = HemEngine.calculateHem(rolledHem);
    expect(resRoll.developedLengthMm).toBeGreaterThan(18);
    expect(resRoll.bendLines[0].angleDeg).toBe(270);
  });

  it("TESTE 2: HemEngine calcula degraus de sobreposição (Jog / Joggle Flange) com dobras opostas", () => {
    const jog: SheetMetalJogDef = {
      id: "jog_flange_1",
      edgeId: "edge_lap",
      offsetMm: 3.0, // Degrau para encaixe faceado de chapa de 3mm
      angleDeg: 45,
      bendRadiusMm: 2.0,
      flangeLengthMm: 25,
      thicknessMm: 3.0,
    };

    const resJog = HemEngine.calculateJog(jog);

    // Diagonal da rampa: offset / sin(45°) = 3 / 0.7071 ≈ 4.24 mm
    expect(resJog.webLengthMm).toBeCloseTo(4.24, 1);
    expect(resJog.bendLines).toHaveLength(2);
    // Dobra 1 é UP, Dobra 2 é DOWN
    expect(resJog.bendLines[0].direction).toBe("UP");
    expect(resJog.bendLines[1].direction).toBe("DOWN");
    expect(resJog.bendLineSpacingMm).toBeGreaterThan(2);
    expect(resJog.totalDevelopedLengthMm).toBeGreaterThan(25);
  });

  it("TESTE 3: FormingEngine gera geometria de nervuras de dobra (Gussets) com anotações de punção", () => {
    const gusset: SheetMetalGussetDef = {
      id: "gusset_center",
      bendLineId: "bend_01",
      type: "ROUNDED",
      normalizedPosition: 0.5, // Exatamente no centro da dobra
      depthMm: 18,
      widthMm: 8,
      thicknessMm: 2.5,
      punchRadiusMm: 3.0,
    };

    const bendStart = { x: 0, y: 100 };
    const bendEnd = { x: 200, y: 100 };

    const ann = FormingEngine.processGusset(gusset, bendStart, bendEnd);

    expect(ann.toolType).toBe("GUSSET");
    expect(ann.center2D).toEqual({ x: 100, y: 100 });
    expect(ann.toolingCode).toContain("PUNCH_GUSSET_ROUNDED");
    expect(ann.entities.length).toBeGreaterThanOrEqual(5); // Linha central + 4 arestas do punção
    expect(ann.entities.every((e) => e.role === "MARK")).toBe(true);
  });

  it("TESTE 4: FormingEngine gera venezianas de respiro (Louvers) com separação de corte e repuxo", () => {
    const louver: SheetMetalLouverDef = {
      id: "louver_vent_1",
      position: { x: 50, y: 60 },
      rotationDeg: 0,
      lengthMm: 120,
      heightMm: 8,
      depthMm: 6,
      cutSide: "RIGHT",
      formingRadiusMm: 4,
    };

    const ann = FormingEngine.processLouver(louver);

    expect(ann.toolType).toBe("LOUVER");
    expect(ann.center2D).toEqual({ x: 50, y: 60 });
    // Deve conter uma entidade CUT (fresta cisalhada) e entidades MARK (cúpula repuxada)
    const cutEntity = ann.entities.find((e) => e.role === "CUT");
    const markEntities = ann.entities.filter((e) => e.role === "MARK");

    expect(cutEntity).toBeDefined();
    expect(markEntities.length).toBe(2);
    expect(ann.toolingCode).toBe("PUNCH_LOUVER_L120_H8");
  });

  it("TESTE 5: FormingEngine gera estampos (Embosses) circulares com e sem furação passante", () => {
    // 1. Estampo circular fechado para rigidez
    const solidEmboss: SheetMetalEmbossDef = {
      id: "emboss_solid",
      position: { x: 80, y: 80 },
      shape: "CIRCULAR",
      diameterMm: 30,
      depthMm: 4,
      draftAngleDeg: 15,
      isPierced: false,
    };
    const annSolid = FormingEngine.processEmboss(solidEmboss);
    expect(annSolid.entities).toHaveLength(1);
    expect(annSolid.entities[0].role).toBe("MARK");

    // 2. Estampo com furo passante (Extruded Hole / Countersink)
    const piercedEmboss: SheetMetalEmbossDef = {
      id: "emboss_pierced",
      position: { x: 150, y: 80 },
      shape: "COUNTERSINK",
      diameterMm: 24,
      depthMm: 3.5,
      draftAngleDeg: 90,
      isPierced: true,
      holeDiameterMm: 8.5,
    };
    const annPierced = FormingEngine.processEmboss(piercedEmboss);
    expect(annPierced.entities).toHaveLength(2);
    expect(annPierced.entities.some((e) => e.role === "MARK")).toBe(true);
    expect(annPierced.entities.some((e) => e.role === "CUT")).toBe(true);
  });

  it("TESTE 6: PressBrakeSimulator calcula força de dobra, matriz ideal e retorno elástico (springback)", () => {
    // Simulação 1: Aço Carbono ASTM A36, t = 4mm, L = 2000mm, dobra 90°
    const simA36 = PressBrakeSimulator.simulate({
      material: "A36",
      thicknessMm: 4.0,
      bendLengthMm: 2000,
      targetAngleDeg: 90,
    });

    expect(simA36.material).toBe("A36");
    expect(simA36.dieOpeningVMm).toBe(32); // 8 * 4mm = 32mm
    expect(simA36.tonnagePerMeterTonM).toBeGreaterThan(15);
    expect(simA36.totalTonnageTon).toBeGreaterThan(30);
    expect(simA36.springbackAngleDeg).toBeGreaterThanOrEqual(0.5);
    expect(simA36.overbendAngleDeg).toBeLessThanOrEqual(90); // Sobredobra necessária
    expect(simA36.minFlangeLengthMm).toBeCloseTo(0.7 * 32, 1);

    // Simulação 2: Inox 304 tem maior tensão de ruptura e maior retorno elástico
    const simInox = PressBrakeSimulator.simulate({
      material: "INOX_304",
      thicknessMm: 4.0,
      bendLengthMm: 2000,
      targetAngleDeg: 90,
    });

    expect(simInox.totalTonnageTon).toBeGreaterThan(simA36.totalTonnageTon);
    expect(simInox.springbackAngleDeg).toBeGreaterThanOrEqual(simA36.springbackAngleDeg);
  });

  it("TESTE 7: Integração completa com ChamferKernel para adição de estamparia e simulação de prensa", () => {
    const doc = ChamferKernel.createDocument("Gabinete Industrial Caldra", 2.0, "Aço Carbono A36");

    // Adiciona nervura de dobra
    ChamferKernel.addGusset(doc, {
      id: "gusset_1",
      bendLineId: "b1",
      type: "FLAT",
      normalizedPosition: 0.5,
      depthMm: 15,
      widthMm: 10,
      thicknessMm: 2.0,
      punchRadiusMm: 2.0,
    });

    // Adiciona veneziana de respiro
    ChamferKernel.addLouver(doc, {
      id: "louver_1",
      position: { x: 100, y: 150 },
      rotationDeg: 0,
      lengthMm: 100,
      heightMm: 7,
      depthMm: 5,
      cutSide: "LEFT",
      formingRadiusMm: 3,
    });

    // Adiciona bainha
    ChamferKernel.addHem(doc, {
      id: "hem_1",
      edgeId: "e_top",
      type: "CLOSED",
      lengthMm: 12,
      side: "TOP",
      thicknessMm: 2.0,
    });

    // Executa a simulação da prensa dobradeira
    const sim = ChamferKernel.simulatePressBrake(doc, {
      bendLengthMm: 1500,
      targetAngleDeg: 90,
    });

    expect(doc.gussets).toHaveLength(1);
    expect(doc.louvers).toHaveLength(1);
    expect(doc.hems).toHaveLength(1);
    expect(doc.formingResult).toBeDefined();
    expect(doc.formingResult?.formingToolCount).toBe(2); // 1 gusset + 1 louver
    expect(doc.pressBrakeSimulation).toBeDefined();
    expect(sim.totalTonnageTon).toBeGreaterThan(10);
    expect(sim.springbackAngleDeg).toBeGreaterThanOrEqual(0.5);
  });
});
