import { describe, it, expect } from "vitest";
import { Bend } from "./Bend";
import { KFactor } from "./KFactor";
import { Unfold } from "./Unfold";
import { Relief } from "./Relief";
import { Flange } from "./Flange";
import { CadSelectionManager } from "../core/CadSelection";

describe("CALDRA CAD CORE — Sheet Metal Analytical Engine & Selection", () => {
  it("1. Cálculo de Dobra Analítica (Bend Allowance, Deduction, Setback)", () => {
    // Chapa de 2.0mm, raio interno 2.0mm, dobra de 90 graus, Fator K = 0.40
    const res = Bend.calculate({
      thickness: 2.0,
      innerRadius: 2.0,
      bendAngleDeg: 90,
      kFactor: 0.40,
    });

    // Raio neutro = 2.0 + 0.40 * 2.0 = 2.8 mm
    expect(res.neutralRadius).toBeCloseTo(2.8, 2);

    // BA = (PI / 2) * 2.8 ≈ 4.398 mm
    expect(res.bendAllowance).toBeCloseTo(4.398, 2);

    // OSSB = tan(45°) * (2.0 + 2.0) = 4.0 mm
    expect(res.outsideSetback).toBeCloseTo(4.0, 2);

    // BD = 2 * 4.0 - 4.398 ≈ 3.602 mm
    expect(res.bendDeduction).toBeCloseTo(3.602, 2);
  });

  it("2. Tabela de Fator K e conversão para Fator Y", () => {
    const kCarbon = KFactor.getDefault("carbon-steel", 1.0);
    expect(kCarbon).toBe(0.42);

    const kAlum = KFactor.getDefault("aluminum", 0.8);
    expect(kAlum).toBe(0.35);

    const yFactor = KFactor.toYFactor(0.4);
    expect(yFactor).toBeCloseTo(0.4 * (Math.PI / 2), 3);
  });

  it("3. Planificação geométrica contínua (Unfold / Flat Pattern)", () => {
    // Perfil U com abas de 30mm, base de 100mm, aba de 30mm (total nominal = 160mm)
    // 2 dobras de 90° em chapa de 2.0mm
    const plan = Unfold.computeFlatPattern(
      [30, 100, 30],
      [
        { id: "b1", angleDeg: 90, innerRadius: 2.0, length: 100 },
        { id: "b2", angleDeg: 90, innerRadius: 2.0, length: 100 },
      ],
      2.0,
      "carbon-steel"
    );

    expect(plan.bendDeductions.length).toBe(2);
    // Comprimento planificado deve ser menor que a soma direta das abas (160mm)
    expect(plan.totalFlatLength).toBeLessThan(160);
    expect(plan.totalFlatLength).toBeGreaterThan(150);
  });

  it("4. Alívios de dobra e canto (Relief)", () => {
    const relief = Relief.getRecommended(3.0, "rectangular");
    expect(relief.width).toBe(3.0);
    expect(relief.depth).toBe(4.5);
  });

  it("5. Definição paramétrica de flange", () => {
    const f = Flange.createDefault(1, 40, 90);
    expect(f.edgeIndex).toBe(1);
    expect(f.length).toBe(40);
    expect(f.angleDeg).toBe(90);
  });

  it("6. Gerenciador de Seleção Topológica (CadSelectionManager)", () => {
    const manager = new CadSelectionManager();

    manager.select({
      type: "face",
      shapeId: "s1",
      id: "f1",
      elementIndex: 0,
    });

    expect(manager.isSelected("f1")).toBe(true);
    expect(manager.getState().selected.length).toBe(1);

    // Multi-seleção
    manager.select(
      {
        type: "face",
        shapeId: "s1",
        id: "f2",
        elementIndex: 1,
      },
      true
    );
    expect(manager.getState().selected.length).toBe(2);

    // Toggle
    manager.toggle({
      type: "face",
      shapeId: "s1",
      id: "f1",
    });
    expect(manager.isSelected("f1")).toBe(false);
    expect(manager.getState().selected.length).toBe(1);

    // Filtro topológico: se filtrar apenas "vertex", itens de face são excluídos
    manager.setFilter(["vertex"]);
    expect(manager.getState().selected.length).toBe(0);
  });
});
