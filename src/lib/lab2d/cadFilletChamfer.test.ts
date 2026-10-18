import { describe, it, expect } from "vitest";
import {
  calculateFillet,
  calculateChamfer,
  findCornerAtPoint,
  findAllCornersInEntities,
  applyFilletToCorner,
  applyChamferToCorner,
} from "./cadFilletChamfer";
import type { Entity } from "./core";

describe("CAD 2D — FILETE E CHANFRO AVANÇADO", () => {
  it("calcula filete matematicamente correto em quina reta de 90°", () => {
    const corner = { x: 0, y: 0 };
    const farA = { x: 100, y: 0 };
    const farB = { x: 0, y: 100 };
    const res = calculateFillet(corner, farA, farB, 10);

    expect(res).not.toBeNull();
    if (!res) return;

    // Raio deve ser 10
    expect(res.radius).toBeCloseTo(10, 2);
    // Distância de tangência em 90° é R / tan(45°) = 10
    expect(res.tangentDist).toBeCloseTo(10, 2);
    expect(res.cutPointA.x).toBeCloseTo(10, 2);
    expect(res.cutPointA.y).toBeCloseTo(0, 2);
    expect(res.cutPointB.x).toBeCloseTo(0, 2);
    expect(res.cutPointB.y).toBeCloseTo(10, 2);

    // Centro do círculo deve ser (10, 10)
    expect(res.arcCenter.x).toBeCloseTo(10, 2);
    expect(res.arcCenter.y).toBeCloseTo(10, 2);
  });

  it("calcula chanfro simétrico e assimétrico corretamente", () => {
    const corner = { x: 0, y: 0 };
    const farA = { x: 100, y: 0 };
    const farB = { x: 0, y: 100 };
    const res = calculateChamfer(corner, farA, farB, 15, 20);

    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.distA).toBeCloseTo(15, 2);
    expect(res.distB).toBeCloseTo(20, 2);
    expect(res.cutPointA.x).toBeCloseTo(15, 2);
    expect(res.cutPointA.y).toBeCloseTo(0, 2);
    expect(res.cutPointB.x).toBeCloseTo(0, 2);
    expect(res.cutPointB.y).toBeCloseTo(20, 2);
  });

  it("detecta canto diretamente por 1 toque/clique sobre a quina", () => {
    const lineA: Entity = {
      id: "l1",
      layer: "CUT",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const lineB: Entity = {
      id: "l2",
      layer: "CUT",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 100,
    };

    const found = findCornerAtPoint({ x: 2, y: 1 }, [lineA, lineB], 10);
    expect(found).not.toBeNull();
    expect(found?.kind).toBe("lines");
    expect(found?.corner.x).toBeCloseTo(0, 1);
    expect(found?.corner.y).toBeCloseTo(0, 1);
  });

  it("aplica filete em 2 linhas atualizando a geometria e criando arco tangente sem duplicidade", () => {
    const lineA: Entity = {
      id: "l1",
      layer: "CUT",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const lineB: Entity = {
      id: "l2",
      layer: "CUT",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 100,
    };

    const corner = findCornerAtPoint({ x: 0, y: 0 }, [lineA, lineB], 5);
    expect(corner).not.toBeNull();
    if (!corner) return;

    const result = applyFilletToCorner(corner, 10, [lineA, lineB]);
    expect(result.success).toBe(true);
    expect(result.updatedEntities.length).toBe(3); // 2 linhas aparadas + 1 arco

    const updatedA = result.updatedEntities.find((e) => e.id === "l1") as Extract<
      Entity,
      { type: "line" }
    >;
    const updatedB = result.updatedEntities.find((e) => e.id === "l2") as Extract<
      Entity,
      { type: "line" }
    >;
    const arc = result.updatedEntities.find((e) => e.type === "arc") as Extract<
      Entity,
      { type: "arc" }
    >;

    expect(updatedA).toBeDefined();
    expect(updatedB).toBeDefined();
    expect(arc).toBeDefined();

    // Linha A agora começa em x1 = 10 e vai até 100
    expect(updatedA.x1).toBeCloseTo(10, 1);
    expect(updatedA.x2).toBeCloseTo(100, 1);

    // Linha B agora começa em y1 = 10 e vai até 100
    expect(updatedB.y1).toBeCloseTo(10, 1);
    expect(updatedB.y2).toBeCloseTo(100, 1);

    // Arco de raio 10
    expect(arc.r).toBeCloseTo(10, 1);
  });

  it("aplica chanfro em 2 linhas conectando os pontos de corte com uma nova linha", () => {
    const lineA: Entity = {
      id: "l1",
      layer: "CUT",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const lineB: Entity = {
      id: "l2",
      layer: "CUT",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 100,
    };

    const corner = findCornerAtPoint({ x: 0, y: 0 }, [lineA, lineB], 5);
    expect(corner).not.toBeNull();
    if (!corner) return;

    const result = applyChamferToCorner(corner, 15, 15, [lineA, lineB]);
    expect(result.success).toBe(true);
    expect(result.updatedEntities.length).toBe(3);

    const seg = result.updatedEntities.find(
      (e) => e.id !== "l1" && e.id !== "l2" && e.type === "line",
    ) as Extract<Entity, { type: "line" }>;
    expect(seg).toBeDefined();
    // Segmento do chanfro conecta (15, 0) a (0, 15)
    expect((seg.x1 === 15 && seg.y2 === 15) || (seg.x2 === 15 && seg.y1 === 15)).toBe(true);
  });

  it("detecta todos os 4 cantos de uma polilinha retangular fechada", () => {
    const poly: Entity = {
      id: "p1",
      layer: "CUT",
      type: "polyline",
      closed: true,
      pts: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
    };

    const corners = findAllCornersInEntities([poly]);
    expect(corners.length).toBe(4);
  });
});
