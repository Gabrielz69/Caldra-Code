// @ts-nocheck
import { describe, it, expect } from "vitest";
import { ProfileCatalog } from "./profileCatalog";
import { StructuralEngine } from "./structuralEngine";
import { ChamferKernel } from "../kernel/chamferKernel";
import type { StructuralWeld } from "./types";

describe("CALDRA CAD WELDMENTS & STRUCTURAL FRAMING — FASE 10", () => {
  it("TESTE 1: ProfileCatalog retorna perfis normalizados (W, U, L, Tubos) e calcula propriedades", () => {
    const all = ProfileCatalog.getAll();
    expect(all.length).toBeGreaterThanOrEqual(10);

    const w150 = ProfileCatalog.get("W150x13.0");
    expect(w150).toBeDefined();
    expect(w150?.type).toBe("I_BEAM");
    expect(w150?.linearMassKgM).toBe(13.0);
    expect(w150?.heightMm).toBe(148);

    const tubo80 = ProfileCatalog.get("Tubo 80x40x3.0");
    expect(tubo80).toBeDefined();
    expect(tubo80?.type).toBe("RECT_TUBE");
    expect(tubo80?.linearMassKgM).toBeCloseTo(5.22, 1);

    // Perfil customizado
    const custom = ProfileCatalog.createCustomRectTube(60, 60, 3.0);
    expect(custom.linearMassKgM).toBeGreaterThan(0);
    expect(custom.areaCm2).toBeGreaterThan(0);
  });

  it("TESTE 2: StructuralEngine cria membro estrutural 3D ao longo de vetor diretor", () => {
    const perfil = ProfileCatalog.get("Tubo 80x40x3.0")!;
    const member = StructuralEngine.createMember({
      profile: perfil,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 0, y: 0, z: 2500 },
      name: "Coluna 01",
    });

    expect(member.lengthMm).toBe(2500);
    expect(member.cutAngleStartDeg).toBe(90);
    expect(member.cutAngleEndDeg).toBe(90);
    expect(member.solid).toBeDefined();
    expect(member.solid?.bounds).toBeDefined();
    expect(member.solid?.volume).toBeGreaterThan(0);
  });

  it("TESTE 3: Tratamento de cantos por esquadria (Miter) e topo (Butt)", () => {
    const perfil = ProfileCatalog.get("Tubo 40x40x2.0")!;

    // Dois tubos que se encontram em um canto a 90°
    const memberA = StructuralEngine.createMember({
      profile: perfil,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1000, y: 0, z: 0 },
      name: "Longarina A",
    });

    const memberB = StructuralEngine.createMember({
      profile: perfil,
      startPoint: { x: 1000, y: 0, z: 0 },
      endPoint: { x: 1000, y: 800, z: 0 },
      name: "Travessa B",
    });

    // 1. Corte de esquadria 45°
    const miterResult = StructuralEngine.applyCornerTreatment(memberA, memberB, "MITER");
    expect(miterResult.memberA.cutAngleEndDeg).toBeCloseTo(45, 0.5);
    expect(miterResult.memberB.cutAngleStartDeg).toBeCloseTo(45, 0.5);

    // 2. Encontro de topo BUTT_1 com folga de solda 2mm
    const buttResult = StructuralEngine.applyCornerTreatment(memberA, memberB, "BUTT_1", 2.0);
    expect(buttResult.memberA.cutAngleEndDeg).toBe(90);
    expect(buttResult.memberB.cutAngleStartDeg).toBe(90);
    // Membro B deve ter sido encurtado pela largura do tubo A (40mm) + gap (2mm) = 42mm
    expect(buttResult.memberB.lengthMm).toBeCloseTo(800 - 42, 1);
  });

  it("TESTE 4: Geração de Lista de Corte (Cut List), Otimização de Barras 1D e Consumo de Solda", () => {
    const perfil = ProfileCatalog.get("W150x13.0")!;

    const m1 = StructuralEngine.createMember({
      profile: perfil,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 2000, y: 0, z: 0 },
    });
    const m2 = StructuralEngine.createMember({
      profile: perfil,
      startPoint: { x: 0, y: 1000, z: 0 },
      endPoint: { x: 2000, y: 1000, z: 0 },
    });
    const m3 = StructuralEngine.createMember({
      profile: perfil,
      startPoint: { x: 0, y: 2000, z: 0 },
      endPoint: { x: 3000, y: 2000, z: 0 },
    });

    const report = StructuralEngine.generateCutList("Pórtico Industrial", [m1, m2, m3], 6.0);

    expect(report.totalMembersCount).toBe(3);
    expect(report.totalLengthMeters).toBeCloseTo(7.0, 1);
    expect(report.totalMassKg).toBeCloseTo(7.0 * 13.0, 1);
    expect(report.cutList.length).toBe(2); // 2 barras de 2000mm e 1 barra de 3000mm

    // Otimização de barras de 6 metros
    expect(report.rawStockBarsNeeded.length).toBe(1);
    // 2000 + 2000 = 4000 (cabe na barra 1), 3000 (vai para barra 2) -> 2 barras de 6m
    expect(report.rawStockBarsNeeded[0].barsCount).toBe(2);

    // Cálculo de solda
    const weld: StructuralWeld = {
      id: "weld_01",
      type: "FILLET",
      legSizeMm: 6.0,
      throatSizeMm: 4.24,
      lengthMm: 1200,
      weldProcess: "MIG_MAG",
      materialYieldKgM: 0.28,
      totalConsumableKg: 0.35,
    };
    const weldSummary = StructuralEngine.calculateWeldConsumables([weld]);
    expect(weldSummary.totalLengthMeters).toBe(1.2);
    expect(weldSummary.totalConsumableKg).toBeGreaterThan(0.1);
  });

  it("TESTE 5: Integração completa no ChamferKernel com gerenciamento de Perfis e Cut List", () => {
    const doc = ChamferKernel.createDocument({
      name: "Mesa de Solda Estrutural",
      thickness: 6.35,
    });

    const perfil = ProfileCatalog.get("Tubo 80x40x3.0")!;

    const m1 = ChamferKernel.addStructuralMember(doc, {
      profile: perfil,
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1500, y: 0, z: 0 },
      name: "Longarina Superior",
    });

    const m2 = ChamferKernel.addStructuralMember(doc, {
      profile: perfil,
      startPoint: { x: 1500, y: 0, z: 0 },
      endPoint: { x: 1500, y: 800, z: 0 },
      name: "Travessa Direita",
    });

    expect(doc.structuralMembers?.length).toBe(2);
    expect(doc.activeState).toBe("WELDMENTS");

    // Aplica corte de esquadria 45°
    ChamferKernel.applyCornerTreatment(doc, m1.id, m2.id, "MITER");
    expect(doc.structuralMembers?.[0].cutAngleEndDeg).toBeCloseTo(45, 0.5);

    // Gera Cut List
    const report = ChamferKernel.generateWeldmentCutList(doc, 6.0);
    expect(report.totalMembersCount).toBe(2);
    expect(report.cutList.length).toBeGreaterThan(0);
    expect(doc.structuralReport).toBeDefined();
  });
});
