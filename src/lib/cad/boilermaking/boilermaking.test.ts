// @ts-nocheck
import { describe, it, expect } from "vitest";
import { BoilermakingEngine } from "./boilermakingEngine";

describe("CALDRA CAD BOILERMAKING 3D & DEVELOPABLE SURFACES — FASE 05", () => {
  it("TESTE 1: Cone Truncado gera B-Rep 3D e planificação analítica de virolas", () => {
    const cone = BoilermakingEngine.generateTruncatedCone({
      D: 200,
      d: 100,
      H: 150,
      thickness: 4.75, // 3/16"
      material: "Aço Carbono ASTM A36",
      density: 7.85,
      divisions: 24,
      splitCount: 2,
    });

    expect(cone.type).toBe("cone");
    expect(cone.body.isClosed).toBe(true);
    expect(cone.body.volume).toBeGreaterThan(0);
    expect(cone.flatPatterns.length).toBe(2); // 2 virolas
    expect(cone.flatPatterns[0].partName).toContain("Virola 1/2");

    // Slant height = sqrt(150^2 + 50^2) = sqrt(22500 + 2500) = sqrt(25000) ≈ 158.11 mm
    expect(cone.trueLengths[0].trueLengthMm).toBeCloseTo(158.11, 1);

    // Contornos na camada CORTE e geratrizes na camada DOBRA
    const entities = cone.flatPatterns[0].entities;
    const cutLines = entities.filter((e) => e.layer === "CORTE");
    const foldLines = entities.filter((e) => e.layer === "DOBRA");

    expect(cutLines.length).toBeGreaterThan(10);
    expect(foldLines.length).toBeGreaterThan(5);
    expect(cone.totalWeightKg).toBeGreaterThan(0);
  });

  it("TESTE 2: Transição Quadrado para Redondo com triangulação e geratrizes de prensa", () => {
    const transition = BoilermakingEngine.generateSquareToRound({
      baseWidth: 200,
      baseLength: 200,
      topDiameter: 120,
      height: 180,
      thickness: 3.17, // 1/8"
      divisionsPerCorner: 4,
      splitCount: 2,
    });

    expect(transition.type).toBe("square_to_round");
    expect(transition.body.vertices.length).toBeGreaterThan(16);
    expect(transition.trueLengths.length).toBeGreaterThan(16);

    // True length de canto para geratriz
    const tl0 = transition.trueLengths[0];
    expect(tl0.trueLengthMm).toBeGreaterThan(180); // Deve ser maior que a altura H

    // Instruções de dobra para conformação
    const p1 = transition.flatPatterns[0];
    expect(p1.bendingInstructions.length).toBeGreaterThan(0);
    expect(p1.bendingInstructions[0].angleDeg).toBeGreaterThan(0);
  });

  it("TESTE 3: Curva de Gomos calcula ângulos de esquadria e planificação sinusoidal", () => {
    const elbow = BoilermakingEngine.generateSegmentedElbow({
      diameter: 100,
      bendRadius: 150, // 1.5D
      totalAngleDeg: 90,
      segmentsCount: 4, // 2 meios-gomos + 2 gomos centrais -> 3 juntas soldadas
      thickness: 2.0,
      divisions: 24,
    });

    expect(elbow.type).toBe("elbow");
    // Miter angle por junta = 90 / (2 * 3) = 15°
    expect(elbow.flatPatterns.length).toBe(1);
    const p = elbow.flatPatterns[0];

    // Largura do blank deve ser igual ao perímetro pi * D = 314.159 mm
    expect(p.blankWidth).toBeCloseTo(Math.PI * 100, 1);

    // Deve conter geratrizes de marcação para calandragem
    const markLines = p.entities.filter((e) => e.layer === "MARCAÇÃO");
    expect(markLines.length).toBeGreaterThan(20);
  });

  it("TESTE 4: Derivação Cilíndrica (Boca de Lobo) calcula penetração e contorno de corte", () => {
    const branch = BoilermakingEngine.generateCylindricalBranch({
      mainDiameter: 200,
      branchDiameter: 100,
      angleDeg: 90,
      branchHeight: 250,
      thickness: 4.75,
      divisions: 24,
    });

    expect(branch.type).toBe("branch");
    expect(branch.flatPatterns.length).toBe(1);

    const fp = branch.flatPatterns[0];
    expect(fp.blankWidth).toBeCloseTo(Math.PI * 100, 1);

    // Contorno de corte da boca de lobo
    const cuts = fp.entities.filter((e) => e.layer === "CORTE");
    expect(cuts.length).toBeGreaterThan(20);
    expect(branch.weldSeamLengthMm).toBeGreaterThan(Math.PI * 100);
  });

  it("TESTE 5: Validação técnica — rejeita dimensões impossíveis ou incoerentes", () => {
    // d >= D em cone
    expect(() =>
      BoilermakingEngine.generateTruncatedCone({
        D: 100,
        d: 150,
        H: 100,
        thickness: 2,
      }),
    ).toThrow();

    // Diâmetro de derivação maior que o tronco
    expect(() =>
      BoilermakingEngine.generateCylindricalBranch({
        mainDiameter: 100,
        branchDiameter: 150,
        angleDeg: 90,
        branchHeight: 200,
        thickness: 2,
      }),
    ).toThrow();
  });
});
