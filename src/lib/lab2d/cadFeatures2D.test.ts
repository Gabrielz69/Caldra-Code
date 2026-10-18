import { describe, it, expect } from "vitest";
import type { Entity } from "./core";
import {
  extractEntitySmartReferences,
  extractIntersections,
  findSmartSnap,
  getGeometricCenter,
} from "./cadReferenceSnaps";
import { centerShapes, type CenterOptions } from "./cadCenterShapes";
import { computeSmartTrimForLine, computeSmartTrim } from "./cadSmartTrim";

describe("1. PONTOS DE REFERÊNCIA INTELIGENTES (SMART OSNAP)", () => {
  it("extrai extremidades e ponto médio de uma linha", () => {
    const line: Entity = {
      id: "l1",
      layer: "0",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const refs = extractEntitySmartReferences(line);
    const kinds = refs.map((r) => r.kind);
    expect(kinds).toContain("end");
    expect(kinds).toContain("mid");

    const mid = refs.find((r) => r.kind === "mid");
    expect(mid?.p).toEqual({ x: 50, y: 0 });
  });

  it("reconhece centro, 4 quadrantes canônicos e geratrizes de um círculo", () => {
    const circle: Entity = {
      id: "c1",
      layer: "0",
      type: "circle",
      cx: 100,
      cy: 100,
      r: 50,
    };
    const refs = extractEntitySmartReferences(circle, null, 12);
    expect(refs.some((r) => r.kind === "center")).toBe(true);

    const quadrants = refs.filter((r) => r.kind === "quadrant");
    expect(quadrants.length).toBe(4);

    const geratrizes = refs.filter((r) => r.kind === "geratriz");
    expect(geratrizes.length).toBeGreaterThan(0);
  });

  it("calcula o centroide geométrico exato de polígono fechado", () => {
    const rectPoly: Entity = {
      id: "p1",
      layer: "0",
      type: "polyline",
      pts: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
      closed: true,
    };
    const center = getGeometricCenter(rectPoly);
    expect(center.x).toBeCloseTo(50, 4);
    expect(center.y).toBeCloseTo(25, 4);
  });

  it("detecta interseções reais e captura snap com aproximação magnética", () => {
    const l1: Entity = { id: "l1", layer: "0", type: "line", x1: 0, y1: 50, x2: 100, y2: 50 };
    const l2: Entity = { id: "l2", layer: "0", type: "line", x1: 50, y1: 0, x2: 50, y2: 100 };

    const inters = extractIntersections([l1, l2]);
    expect(inters.length).toBe(1);
    expect(inters[0].p.x).toBeCloseTo(50, 4);
    expect(inters[0].p.y).toBeCloseTo(50, 4);

    const snap = findSmartSnap({ x: 51, y: 49 }, [l1, l2], 5);
    expect(snap).not.toBeNull();
    expect(snap?.kind).toBe("intersection");
  });
});

describe("2. CENTRALIZAR FORMAS (CAD 2D)", () => {
  const lineA: Entity = { id: "a", layer: "0", type: "line", x1: 0, y1: 0, x2: 20, y2: 0 };
  const lineB: Entity = { id: "b", layer: "0", type: "line", x1: 80, y1: 100, x2: 100, y2: 100 };

  it("centraliza em bloco mantendo distâncias relativas intactas", () => {
    const opts: CenterOptions = {
      axis: "both",
      method: "centroid",
      grouping: "block",
      targetPoint: { x: 0, y: 0 },
    };
    const res = centerShapes([lineA, lineB], [lineA, lineB], opts);
    expect(res.transformed.length).toBe(2);

    // O vetor de deslocamento foi aplicado a ambas as entidades
    const dx = res.shiftVector.x;
    const dy = res.shiftVector.y;
    const tA = res.transformed[0] as Extract<Entity, { type: "line" }>;
    expect(tA.x1).toBeCloseTo(lineA.x1 + dx, 4);
    expect(tA.y1).toBeCloseTo(lineA.y1 + dy, 4);
  });

  it("centraliza apenas horizontalmente quando especificado", () => {
    const opts: CenterOptions = {
      axis: "horizontal",
      method: "centroid",
      grouping: "block",
      targetPoint: { x: 0, y: 0 },
    };
    const res = centerShapes([lineA, lineB], [lineA, lineB], opts);
    expect(res.shiftVector.y).toBe(0);
  });

  it("centraliza individualmente fazendo todas convergirem para o centro", () => {
    const opts: CenterOptions = {
      axis: "both",
      method: "centroid",
      grouping: "individual",
      targetPoint: { x: 50, y: 50 },
    };
    const res = centerShapes([lineA, lineB], [lineA, lineB], opts);
    const tA = res.transformed[0] as Extract<Entity, { type: "line" }>;
    const tB = res.transformed[1] as Extract<Entity, { type: "line" }>;

    // O centro de cada forma vira (50, 50)
    expect((tA.x1 + tA.x2) / 2).toBeCloseTo(50, 4);
    expect((tA.y1 + tA.y2) / 2).toBeCloseTo(50, 4);
    expect((tB.x1 + tB.x2) / 2).toBeCloseTo(50, 4);
    expect((tB.y1 + tB.y2) / 2).toBeCloseTo(50, 4);
  });
});

describe("3. APARAR ATÉ O ENCONTRO (SMART AUTO-TRIM)", () => {
  it("encontra a linha limite e apara o segmento clicado até a interseção", () => {
    // Linha horizontal de (0,0) a (100,0)
    const targetLine: Extract<Entity, { type: "line" }> = {
      id: "target",
      layer: "0",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    // Linha vertical de corte cruzando em X=40
    const cutter: Entity = {
      id: "cutter",
      layer: "0",
      type: "line",
      x1: 40,
      y1: -20,
      x2: 40,
      y2: 20,
    };

    // Usuário clica no lado direito em (80, 0) -> deve aparar de 40 a 100, mantendo de 0 a 40
    const previewRight = computeSmartTrimForLine(targetLine, [targetLine, cutter], { x: 80, y: 0 });
    expect(previewRight.activeCandidate).not.toBeNull();
    const candRight = previewRight.activeCandidate!;
    expect(candRight.intersectionPoint.x).toBeCloseTo(40, 4);
    expect(candRight.keptSegment[0]).toEqual({ x: 0, y: 0 });
    expect(candRight.keptSegment[1]).toEqual({ x: 40, y: 0 });
    expect(candRight.cutSegment[0]).toEqual({ x: 40, y: 0 });
    expect(candRight.cutSegment[1]).toEqual({ x: 100, y: 0 });

    // Usuário clica no lado esquerdo em (10, 0) -> deve aparar de 0 a 40, mantendo de 40 a 100
    const previewLeft = computeSmartTrimForLine(targetLine, [targetLine, cutter], { x: 10, y: 0 });
    const candLeft = previewLeft.activeCandidate!;
    expect(candLeft.keptSegment[0]).toEqual({ x: 40, y: 0 });
    expect(candLeft.keptSegment[1]).toEqual({ x: 100, y: 0 });
    expect(candLeft.cutSegment[0]).toEqual({ x: 0, y: 0 });
    expect(candLeft.cutSegment[1]).toEqual({ x: 40, y: 0 });
  });

  it("suporta encontro projetado (prolongamento matemático de limites coplanares)", () => {
    const targetLine: Extract<Entity, { type: "line" }> = {
      id: "target",
      layer: "0",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    // Linha limite não toca fisicamente em Y, mas seu prolongamento cruzaria em X=60
    const cutterShort: Entity = {
      id: "cutterShort",
      layer: "0",
      type: "line",
      x1: 60,
      y1: 10,
      x2: 60,
      y2: 50,
    };

    // No modo real, não deve haver candidato
    const previewReal = computeSmartTrimForLine(targetLine, [targetLine, cutterShort], { x: 90, y: 0 }, "real");
    expect(previewReal.activeCandidate).toBeNull();

    // No modo projetado, deve reconhecer o prolongamento em X=60
    const previewProj = computeSmartTrimForLine(targetLine, [targetLine, cutterShort], { x: 90, y: 0 }, "projected");
    expect(previewProj.activeCandidate).not.toBeNull();
    expect(previewProj.activeCandidate?.intersectionPoint.x).toBeCloseTo(60, 4);
    expect(previewProj.activeCandidate?.isProjected).toBe(true);
  });
});
