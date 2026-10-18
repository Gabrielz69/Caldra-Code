import { describe, it, expect } from "vitest";
import type { Entity } from "./core";
import { GeometricReferenceEngine } from "./cadGeometricReferences";
import { CoordinateFrameManager, type TemporaryOrigin } from "./cadCoordinateFrames";
import { DynamicDimensionInteraction } from "./cadDynamicDimensions";
import { GeometricConstraintResolver } from "./cadConstraintResolver";

describe("CALDRA CHAMFER — GeometricReferenceEngine", () => {
  const samplePlate: Entity = {
    id: "plate-1",
    layer: "corte",
    type: "polyline",
    closed: true,
    pts: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ],
  };

  it("deve extrair todas as 4 bordas com comprimento, direção e normal corretos", () => {
    const edges = GeometricReferenceEngine.extractEdges([samplePlate]);
    expect(edges).toHaveLength(4);

    const bottomEdge = edges[0]!;
    expect(bottomEdge.length).toBeCloseTo(200);
    expect(bottomEdge.dir.x).toBeCloseTo(1);
    expect(bottomEdge.dir.y).toBeCloseTo(0);
    // Normal ortogonal (-dir.y, dir.x) = (0, 1)
    expect(bottomEdge.normal.x).toBeCloseTo(0);
    expect(bottomEdge.normal.y).toBeCloseTo(1);

    const rightEdge = edges[1]!;
    expect(rightEdge.length).toBeCloseTo(100);
    expect(rightEdge.dir.x).toBeCloseTo(0);
    expect(rightEdge.dir.y).toBeCloseTo(1);
  });

  it("deve projetar ponto sobre borda calculando u (longitudinal) e v (afastamento normal)", () => {
    const edges = GeometricReferenceEngine.extractEdges([samplePlate]);
    const bottomEdge = edges[0]!; // (0,0) -> (200,0)

    const queryPoint = { x: 40, y: 25 };
    const proj = GeometricReferenceEngine.projectPointOnEdge(queryPoint, bottomEdge);

    expect(proj.u).toBeCloseTo(40);
    expect(proj.v).toBeCloseTo(25);
    expect(proj.isWithinSegment).toBe(true);
    expect(proj.projected.x).toBeCloseTo(40);
    expect(proj.projected.y).toBeCloseTo(0);
  });

  it("deve identificar os 4 cantos de 90 graus da chapa", () => {
    const edges = GeometricReferenceEngine.extractEdges([samplePlate]);
    const corners = GeometricReferenceEngine.findCorners(edges);
    expect(corners.length).toBeGreaterThanOrEqual(4);
    for (const c of corners) {
      expect(c.angleDeg).toBeCloseTo(90, 0);
    }
  });
});

describe("CALDRA CHAMFER — CoordinateFrameManager", () => {
  const refOrigin: TemporaryOrigin = {
    id: "ref-corner",
    p: { x: 500, y: 300 },
    label: "Canto de Referência",
    kind: "end",
    timestamp: Date.now(),
  };

  it("deve converter entre coordenadas globais e relativas à REF 0,0 bidirecionalmente", () => {
    const worldPt = { x: 540, y: 325 };
    const rel = CoordinateFrameManager.worldToRelative(worldPt, refOrigin);
    expect(rel.x).toBeCloseTo(40);
    expect(rel.y).toBeCloseTo(25);

    const restoredWorld = CoordinateFrameManager.relativeToWorld(rel, refOrigin);
    expect(restoredWorld.x).toBeCloseTo(540);
    expect(restoredWorld.y).toBeCloseTo(325);
  });

  it("deve formatar texto de delta relativo com precisão e sinais", () => {
    const worldPt = { x: 540.5, y: 285.2 };
    const fmt = CoordinateFrameManager.formatRelative(worldPt, refOrigin, 1);
    expect(fmt.dxStr).toBe("+40.5 mm");
    expect(fmt.dyStr).toBe("-14.8 mm");
    expect(fmt.text).toBe("ΔX: +40.5 mm | ΔY: -14.8 mm");
  });

  it("deve converter entre global e UV local de borda", () => {
    const edge = {
      id: "edge-test",
      entityId: "e1",
      segmentIndex: 0,
      p1: { x: 100, y: 100 },
      p2: { x: 300, y: 100 },
      length: 200,
      angleRad: 0,
      angleDeg: 0,
      dir: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      midpoint: { x: 200, y: 100 },
      label: "Borda Teste",
    };

    const uv = CoordinateFrameManager.worldToUV({ x: 140, y: 135 }, edge);
    expect(uv.u).toBeCloseTo(40);
    expect(uv.v).toBeCloseTo(35);

    const world = CoordinateFrameManager.uvToWorld(40, 35, edge);
    expect(world.x).toBeCloseTo(140);
    expect(world.y).toBeCloseTo(135);
  });
});

describe("CALDRA CHAMFER — GeometricConstraintResolver", () => {
  it("deve analisar medidas flexíveis com vírgula, ponto, unidades e expressões", () => {
    expect(GeometricConstraintResolver.parseDimensionInput("40")).toBe(40);
    expect(GeometricConstraintResolver.parseDimensionInput("40.5")).toBe(40.5);
    expect(GeometricConstraintResolver.parseDimensionInput("40,5")).toBe(40.5);
    expect(GeometricConstraintResolver.parseDimensionInput("40,5 mm")).toBe(40.5);
    expect(GeometricConstraintResolver.parseDimensionInput("4 cm")).toBe(40);
    expect(GeometricConstraintResolver.parseDimensionInput("100 / 2")).toBe(50);
    expect(GeometricConstraintResolver.parseDimensionInput("35 + 15")).toBe(50);
  });

  it("deve criar linha paralela de corte, marcação (MAR) e dobra (DOBRA) por afastamento", () => {
    const edge = {
      id: "edge-test",
      entityId: "e1",
      segmentIndex: 0,
      p1: { x: 0, y: 0 },
      p2: { x: 500, y: 0 },
      length: 500,
      angleRad: 0,
      angleDeg: 0,
      dir: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      midpoint: { x: 250, y: 0 },
      label: "Borda Base",
    };

    // Linha de marcação com afastamento de 40mm
    const markLine = GeometricConstraintResolver.createMarkingOrBendLine(edge, 40, 1, "marcacao");
    expect(markLine.type).toBe("line");
    expect(markLine.layer).toBe("marcacao");
    if (markLine.type === "line") {
      expect(markLine.y1).toBeCloseTo(40);
      expect(markLine.y2).toBeCloseTo(40);
      expect(markLine.x1).toBeCloseTo(0);
      expect(markLine.x2).toBeCloseTo(500);
    }

    // Linha de dobra com afastamento de 40mm e ângulo de 90°
    const bendLine = GeometricConstraintResolver.createMarkingOrBendLine(edge, 40, -1, "dobra", 90);
    expect(bendLine.layer).toBe("dobra");
    if (bendLine.type === "line") {
      expect(bendLine.y1).toBeCloseTo(-40);
      expect(bendLine.y2).toBeCloseTo(-40);
      expect(bendLine.params?.role).toBe("BEND_LINE");
    }
  });

  it("deve posicionar furo por coordenadas relativas a um canto de referência", () => {
    const corner = { x: 100, y: 200 };
    const hole = GeometricConstraintResolver.positionHoleAtCorner(corner, 50, 40, 12, "corte");

    expect(hole.type).toBe("circle");
    if (hole.type === "circle") {
      expect(hole.cx).toBeCloseTo(150);
      expect(hole.cy).toBeCloseTo(240);
      expect(hole.r).toBeCloseTo(6);
      expect(hole.params?.diameter).toBe(12);
    }
  });
});

describe("CALDRA CHAMFER — DynamicDimensionInteraction", () => {
  it("deve gerar cotas vivas de afastamento a partir de uma borda ativa", () => {
    const edge = {
      id: "edge-test",
      entityId: "e1",
      segmentIndex: 0,
      p1: { x: 0, y: 0 },
      p2: { x: 200, y: 0 },
      length: 200,
      angleRad: 0,
      angleDeg: 0,
      dir: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      midpoint: { x: 100, y: 0 },
      label: "Borda Inferior",
    };

    const dims = DynamicDimensionInteraction.generateEdgeOffsetDimensions({ x: 40, y: 35 }, edge, 1);
    expect(dims.length).toBeGreaterThanOrEqual(1);

    const offsetDim = dims.find((d) => d.kind === "offset");
    expect(offsetDim).toBeDefined();
    expect(offsetDim?.value).toBeCloseTo(35);
    expect(offsetDim?.isEditable).toBe(true);
  });
});
