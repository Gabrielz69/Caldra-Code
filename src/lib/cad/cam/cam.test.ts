// @ts-nocheck
import { describe, it, expect } from "vitest";
import type { Entity } from "@/lib/lab2d/core";
import { CAMEngine } from "./camEngine";
import { GCodePostProcessor } from "./gcodePostProcessor";
import type { CuttingParameters } from "./types";

describe("CALDRA CAD CNC MANUFACTURING & POST-PROCESSOR — FASE 07", () => {
  const laserParams: CuttingParameters = {
    technology: "LASER",
    material: "Aço Carbono SAE 1020",
    thicknessMm: 3.0,
    kerfWidthMm: 0.2,
    feedrateMmMin: 4000,
    rapidSpeedMmMin: 25000,
    pierceTimeSec: 0.25,
    gasPressureBar: 12,
    laserPowerWatts: 3000,
  };

  // Placa retangular 200 × 100 mm com 2 furos circulares Ø20 mm
  const plateWithHoles: Entity[] = [
    // Furo 1: Centro (50, 50), Raio 10
    { id: "hole1", type: "circle", cx: 50, cy: 50, r: 10, layer: "CORTE" },
    // Furo 2: Centro (150, 50), Raio 10
    { id: "hole2", type: "circle", cx: 150, cy: 50, r: 10, layer: "CORTE" },
    // Contorno Externo: 4 arestas lineares
    { id: "edge1", type: "line", x1: 0, y1: 0, x2: 200, y2: 0, layer: "CORTE" },
    { id: "edge2", type: "line", x1: 200, y1: 0, x2: 200, y2: 100, layer: "CORTE" },
    { id: "edge3", type: "line", x1: 200, y1: 100, x2: 0, y2: 100, layer: "CORTE" },
    { id: "edge4", type: "line", x1: 0, y1: 100, x2: 0, y2: 0, layer: "CORTE" },
  ];

  it("TESTE 1: CAMEngine sequencia furos internos antes do contorno externo", () => {
    const toolpath = CAMEngine.generateToolpath(plateWithHoles, laserParams);

    expect(toolpath.contours.length).toBe(3); // 2 furos + 1 contorno externo
    expect(toolpath.pierceCount).toBe(3);

    // Regra estrita: Os 2 primeiros contornos devem ser furos internos
    expect(toolpath.contours[0].isOuter).toBe(false);
    expect(toolpath.contours[1].isOuter).toBe(false);
    // O último contorno deve ser o perímetro externo da chapa
    expect(toolpath.contours[2].isOuter).toBe(true);
  });

  it("TESTE 2: Geração automática de Lead-in e inserção de Micro-juntas (Tabs)", () => {
    const toolpath = CAMEngine.generateToolpath(plateWithHoles, laserParams, {
      leadParams: { type: "LINE", lengthMm: 3.0, angleDeg: 45 },
      microJointsCount: 2,
      microJointWidthMm: 1.0,
    });

    const outerContour = toolpath.contours[2];
    expect(outerContour.leadInSegments.length).toBeGreaterThan(0);
    // Ponto de perfuração deve ser fora do início da aresta útil
    expect(outerContour.piercePoint.x).toBeLessThan(0);

    // Micro-juntas adicionadas para evitar tombamento
    expect(outerContour.microJoints.length).toBe(2);
    expect(outerContour.microJoints[0].widthMm).toBe(1.0);
  });

  it("TESTE 3: Estimativa de tempos de ciclo CNC (corte + vazio + perfuração)", () => {
    const toolpath = CAMEngine.generateToolpath(plateWithHoles, laserParams);

    expect(toolpath.totalCutLengthMm).toBeGreaterThan(600); // 200+100+200+100 + 2*pi*20 ≈ 725mm
    expect(toolpath.totalRapidLengthMm).toBeGreaterThan(0);

    // Tempos em segundos
    expect(toolpath.estimatedCutTimeSec).toBeGreaterThan(0);
    expect(toolpath.estimatedRapidTimeSec).toBeGreaterThan(0);
    expect(toolpath.estimatedPierceTimeSec).toBeCloseTo(3 * 0.25, 2);
    expect(toolpath.totalCycleTimeSec).toBeCloseTo(
      toolpath.estimatedCutTimeSec +
        toolpath.estimatedRapidTimeSec +
        toolpath.estimatedPierceTimeSec,
      1,
    );
  });

  it("TESTE 4: GCodePostProcessor gera código ISO determinístico com comandos M03/M05", () => {
    const toolpath = CAMEngine.generateToolpath(plateWithHoles, laserParams);
    const gcode = GCodePostProcessor.generateGCode(toolpath, laserParams, {
      programName: "PLACA_TESTE_CNC",
      partName: "PLACA-BASE-01",
      dialect: "CYPCUT",
    });

    expect(gcode).toContain("PROGRAMA: PLACA_TESTE_CNC");
    expect(gcode).toContain("G21 (Modo Milimetros)");
    expect(gcode).toContain("G90 (Coordenadas Absolutas)");
    expect(gcode).toContain("M08 (Gas de assistencia LIGADO)");
    expect(gcode).toContain("M03 (Feixe/Tocha LIGADO)");
    expect(gcode).toContain("G04 P0.25 (Dwell perfuracao)");
    expect(gcode).toContain("M05 (Feixe/Tocha DESLIGADO)");
    expect(gcode).toContain("M30 (Fim de Programa)");

    // Deve conter interpolação circular G02 ou G03 para os furos
    expect(gcode).toMatch(/G0[23] X.* Y.* I.* J.*/);
  });
});
