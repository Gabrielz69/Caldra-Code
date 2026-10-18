// @ts-nocheck
import { describe, expect, it } from "vitest";
import type { Entity } from "@/lib/lab2d/core";
import {
  detectSheetMetalProfile,
  detectAllSheetMetalParts,
  generateSheetMetalMesh,
  buildSheetMetalSolidInstances,
  buildAllSheetMetalSolidInstances,
  generateFlatPatternEntities,
} from "./chamferSheetMetal3D";

describe("Caldra Sheet Metal 3D & Fold Engine", () => {
  it("detects an open profile (L-Bracket) and calculates bend angles and allowance", () => {
    // Perfil L: 100mm horizontal + 50mm vertical (dobra de 90°)
    const entities: Entity[] = [
      { id: "l1", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, layer: "corte" },
      { id: "l2", type: "line", x1: 100, y1: 0, x2: 100, y2: 50, layer: "corte" },
    ];

    const result = detectSheetMetalProfile(entities, 2.0, {
      width: 150,
      radius: 2.0,
      kFactor: 0.33,
    });

    expect(result.type).toBe("open-profile");
    expect(result.thickness).toBe(2.0);
    expect(result.width).toBe(150);
    expect(result.bends.length).toBe(1);

    const bend = result.bends[0]!;
    expect(bend.angleDeg).toBeCloseTo(90, 1);
    expect(bend.insideRadius).toBe(2.0);
    expect(bend.bendAllowance).toBeCloseTo((Math.PI / 2) * (2.0 + 0.33 * 2.0), 2);
  });

  it("detects a U-channel profile with two 90-degree bends", () => {
    // Perfil U: Flange 40mm, Alma 100mm, Flange 40mm
    const entities: Entity[] = [
      { id: "u1", type: "line", x1: 0, y1: 40, x2: 0, y2: 0, layer: "corte" },
      { id: "u2", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, layer: "corte" },
      { id: "u3", type: "line", x1: 100, y1: 0, x2: 100, y2: 40, layer: "corte" },
    ];

    const result = detectSheetMetalProfile(entities, 3.0, {
      width: 120,
      radius: 3.0,
      kFactor: 0.4,
    });

    expect(result.type).toBe("open-profile");
    expect(result.bends.length).toBe(2);
    expect(result.bends[0]!.angleDeg).toBeCloseTo(90, 1);
    expect(result.bends[1]!.angleDeg).toBeCloseTo(90, 1);
    expect(result.developedLength).toBeGreaterThan(100);
  });

  it("reconstructs 3D sheet metal from a flat blank with bend lines (Face Base + Flanges)", () => {
    // Blank 200x120mm com dobra a 50mm
    const entities: Entity[] = [
      {
        id: "contour_1",
        type: "polyline",
        pts: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 200, y: 120 },
          { x: 0, y: 120 },
        ],
        closed: true,
        layer: "corte",
      },
      {
        id: "bend_line_1",
        type: "line",
        x1: 50,
        y1: 0,
        x2: 50,
        y2: 120,
        layer: "dobra",
      },
    ];

    const parts = detectAllSheetMetalParts(entities, 2.0);
    expect(parts.length).toBe(1);

    const part = parts[0]!;
    expect(part.type).toBe("blank-with-bends");
    expect(part.bends.length).toBe(1);
    expect(part.bends[0]!.angleDeg).toBe(90);
    expect(part.flangeRegions).toBeDefined();
    expect(part.flangeRegions!.length).toBeGreaterThanOrEqual(2);

    // Gera malha 3D e confere vértices
    const mesh = generateSheetMetalMesh(part, 1.0);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices?.length).toBeGreaterThan(0);
  });

  it("reconstructs multiple independent parts (Assembly) with distinct IDs and codes", () => {
    // Duas peças no mesmo canvas 2D
    const entities: Entity[] = [
      // Peça 1: Blank com dobra em X=0..100
      {
        id: "part1_corte",
        type: "polyline",
        pts: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ],
        closed: true,
        layer: "corte",
      },
      { id: "part1_bend", type: "line", x1: 30, y1: 0, x2: 30, y2: 80, layer: "dobra" },

      // Peça 2: Blank plano em X=150..250
      {
        id: "part2_corte",
        type: "polyline",
        pts: [
          { x: 150, y: 0 },
          { x: 250, y: 0 },
          { x: 250, y: 80 },
          { x: 150, y: 80 },
        ],
        closed: true,
        layer: "corte",
      },
    ];

    const parts = detectAllSheetMetalParts(entities, 2.0);
    expect(parts.length).toBe(2);

    expect(parts[0]!.code).toBe("CH01");
    expect(parts[1]!.code).toBe("CH02");

    const instances = buildAllSheetMetalSolidInstances(parts, 100);
    expect(instances.length).toBe(2);
    expect(instances[0]!.id).toBe("part1_corte");
    expect(instances[1]!.id).toBe("part2_corte");
  });

  it("generates continuous 3D solid mesh for foldProgress from 0 to 1", () => {
    const entities: Entity[] = [
      { id: "l1", type: "line", x1: 0, y1: 0, x2: 80, y2: 0, layer: "corte" },
      { id: "l2", type: "line", x1: 80, y1: 0, x2: 80, y2: 60, layer: "corte" },
    ];

    const result = detectSheetMetalProfile(entities, 2.0, { width: 100 });

    const meshFolded = generateSheetMetalMesh(result, 1.0);
    expect(meshFolded.positions.length).toBeGreaterThan(0);
    expect(meshFolded.indices?.length).toBeGreaterThan(0);

    const meshUnfolded = generateSheetMetalMesh(result, 0.0);
    expect(meshUnfolded.positions.length).toBe(meshFolded.positions.length);

    const meshHalf = generateSheetMetalMesh(result, 0.5);
    expect(meshHalf.positions.length).toBe(meshFolded.positions.length);
  });

  it("builds solid instances compatible with Model3DViewer", () => {
    const entities: Entity[] = [
      { id: "l1", type: "line", x1: 0, y1: 0, x2: 120, y2: 0, layer: "corte" },
      { id: "l2", type: "line", x1: 120, y1: 0, x2: 120, y2: 40, layer: "corte" },
    ];

    const profile = detectSheetMetalProfile(entities, 2.0);
    const instances = buildSheetMetalSolidInstances(profile, 1.0);

    expect(instances.length).toBe(1);
    expect(instances[0]!.customMesh).toBeDefined();
    expect(instances[0]!.material).toBe("aco");
  });

  it("generates real 2D Flat Pattern entities with CORTE and DOBRA layers", () => {
    const entities: Entity[] = [
      { id: "l1", type: "line", x1: 0, y1: 0, x2: 100, y2: 0, layer: "corte" },
      { id: "l2", type: "line", x1: 100, y1: 0, x2: 100, y2: 50, layer: "corte" },
    ];

    const profile = detectSheetMetalProfile(entities, 2.0, { width: 100 });
    const flatEntities = generateFlatPatternEntities(profile);

    const corteLines = flatEntities.filter((e) => e.layer === "corte");
    const dobraLines = flatEntities.filter((e) => e.layer === "dobra");

    expect(corteLines.length).toBe(4);
    expect(dobraLines.length).toBe(1);
  });
});
