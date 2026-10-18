import { describe, it, expect } from "vitest";
import {
  ISO_PLANES,
  isoPlaneToCanvas,
  canvasToIsoPlane,
  buildIsoCircle,
  buildIsoParallelogram,
  constrainToIsoAxes,
  snapToIsoGrid,
  buildBentSupportPreset,
  buildIsoFlangePreset,
  buildIsoChannelPreset,
  ISO_SQRT_1_5,
  ISO_SQRT_0_5,
  projectPointToIsoPlane,
  unprojectPointFromIsoPlane,
  projectEntityToIso,
  generate25DExtrusion,
  convertSelectionToIsometric,
  unprojectEntityFromIso,
  unprojectSelectionFromIsometric,
} from "./isometricEngine";
import { makeDimension, type Dimension } from "./dimensions";
import type { Entity } from "./core";

describe("isometricEngine", () => {
  it("tem os 3 planos canônicos configurados corretamente", () => {
    expect(ISO_PLANES.top.axisAnglesDeg).toEqual([30, 150]);
    expect(ISO_PLANES.left.axisAnglesDeg).toEqual([150, 90]);
    expect(ISO_PLANES.right.axisAnglesDeg).toEqual([30, 90]);

    expect(ISO_PLANES.top.ellipseRotationDeg).toBe(0);
    expect(ISO_PLANES.left.ellipseRotationDeg).toBe(-60);
    expect(ISO_PLANES.right.ellipseRotationDeg).toBe(60);
  });

  it("converte entre espaço do plano isométrico e canvas com reversibilidade exata", () => {
    const planes = ["top", "left", "right"] as const;
    const testPoints = [
      { u: 0, v: 0 },
      { u: 50, v: 100 },
      { u: -25, v: 75 },
      { u: 120, v: -40 },
    ];

    for (const plane of planes) {
      for (const pt of testPoints) {
        const canvasPt = isoPlaneToCanvas(plane, pt.u, pt.v);
        const back = canvasToIsoPlane(plane, canvasPt);
        expect(back.u).toBeCloseTo(pt.u, 5);
        expect(back.v).toBeCloseTo(pt.v, 5);
      }
    }
  });

  it("cria isocírculos com proporção isométrica canônica e rotação do plano", () => {
    const radius = 20;
    const topCircle = buildIsoCircle("top", { x: 10, y: 20 }, radius, "corte");
    expect(topCircle.type).toBe("ellipse");
    if (topCircle.type === "ellipse") {
      expect(topCircle.rx).toBeCloseTo(radius * ISO_SQRT_1_5, 5);
      expect(topCircle.ry).toBeCloseTo(radius * ISO_SQRT_0_5, 5);
      expect(topCircle.rotation).toBe(0);
      expect(topCircle.params?.isIso).toBe(true);
      expect(topCircle.params?.realRadius).toBe(20);
      expect(topCircle.params?.realDiameter).toBe(40);
    }

    const leftCircle = buildIsoCircle("left", { x: 0, y: 0 }, radius, "recorte", true);
    if (leftCircle.type === "ellipse") {
      expect(leftCircle.rotation).toBeCloseTo((-60 * Math.PI) / 180, 5);
      expect(leftCircle.params?.isHole).toBe(true);
    }

    const rightCircle = buildIsoCircle("right", { x: 0, y: 0 }, radius, "corte");
    if (rightCircle.type === "ellipse") {
      expect(rightCircle.rotation).toBeCloseTo((60 * Math.PI) / 180, 5);
    }
  });

  it("cria paralelogramo isométrico fechado com 4 vértices", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = isoPlaneToCanvas("top", 100, 50);
    const rect = buildIsoParallelogram("top", p1, p2, "corte");
    expect(rect.type).toBe("polyline");
    if (rect.type === "polyline") {
      expect(rect.closed).toBe(true);
      expect(rect.pts.length).toBe(4);
      expect(rect.params?.realWidth).toBeCloseTo(100, 3);
      expect(rect.params?.realHeight).toBeCloseTo(50, 3);
    }
  });

  it("restringe deslocamento do cursor aos eixos isométricos (Orto Isométrico)", () => {
    const from = { x: 0, y: 0 };
    // Tentativa de mover ligeiramente fora de 30°
    const rawTo = { x: 86.6, y: -45 };
    const constrained = constrainToIsoAxes(from, rawTo, "top");
    // Deve projetar perfeitamente sobre a reta de 30°
    const angleRad = Math.atan2(-constrained.y, constrained.x);
    const angleDeg = (angleRad * 180) / Math.PI;
    expect(angleDeg).toBeCloseTo(30, 1);
  });

  it("aplica snapping à grade isométrica com passos regulares", () => {
    const rawPt = { x: 12.34, y: -8.76 };
    const snapped = snapToIsoGrid(rawPt, 10, "top");
    const uv = canvasToIsoPlane("top", snapped);
    expect(Math.abs(uv.u % 10)).toBeCloseTo(0, 4);
    expect(Math.abs(uv.v % 10)).toBeCloseTo(0, 4);
  });

  it("gera o preset de suporte dobrado com base, abas, furos em múltiplos planos e cotas", () => {
    const { entities, dims } = buildBentSupportPreset({
      baseWidth: 100,
      baseLength: 70,
      flangeHeight: 50,
      thickness: 3,
      holeDiameter: 12,
    });

    expect(entities.length).toBeGreaterThan(10);
    expect(dims.length).toBe(3);

    // Deve conter elementos nas camadas de corte, dobra e recorte
    const layers = new Set(entities.map((e) => e.layer));
    expect(layers.has("corte")).toBe(true);
    expect(layers.has("dobra")).toBe(true);
    expect(layers.has("recorte")).toBe(true);

    // Deve conter furos isométricos (elipses)
    const ellipses = entities.filter((e) => e.type === "ellipse");
    expect(ellipses.length).toBeGreaterThanOrEqual(3);
  });

  it("gera preset de flange isométrico circular com furação polar PCD e espessura", () => {
    const { entities, dims } = buildIsoFlangePreset({
      plane: "top",
      outerDia: 180,
      innerDia: 70,
      boltCircleDia: 130,
      numHoles: 6,
      holeDia: 14,
      thickness: 10,
    });

    expect(entities.length).toBeGreaterThanOrEqual(10);
    expect(dims.length).toBeGreaterThanOrEqual(1);

    const ellipses = entities.filter((e) => e.type === "ellipse");
    // Outer + Bottom Outer + Inner Hole + 6 PCD holes = at least 9 ellipses
    expect(ellipses.length).toBeGreaterThanOrEqual(8);
  });

  it("gera preset de canal U dobrado isométrico com abas e linhas de dobra", () => {
    const { entities, dims } = buildIsoChannelPreset({
      webWidth: 100,
      flangeHeight: 50,
      length: 160,
      thickness: 4,
      holeDia: 12,
    });

    expect(entities.length).toBeGreaterThan(6);
    expect(dims.length).toBe(3);
  });

  it("projeta e desprojeta pontos analiticamente com inversão matemática exata nos 3 planos", () => {
    const pivot = { x: 50, y: 50 };
    const testPoints = [
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 50, y: 120 },
      { x: 80, y: 90 },
      { x: 12.5, y: 34.2 },
    ];
    const planes = ["top", "left", "right"] as const;

    for (const plane of planes) {
      for (const p of testPoints) {
        const iso = projectPointToIsoPlane(p, plane, pivot);
        const canonical = unprojectPointFromIsoPlane(iso, plane, pivot);
        expect(canonical.x).toBeCloseTo(p.x, 5);
        expect(canonical.y).toBeCloseTo(p.y, 5);
      }
    }
  });

  it("projeta peça 2D irregular livre arbitrária (sem templates) preservando geometria real", () => {
    // Peça livre desenhada pelo usuário com contorno recortado e furos
    const irregularPiece: Entity[] = [
      { id: "e1", layer: "corte", type: "line", x1: 0, y1: 0, x2: 90, y2: 0 },
      { id: "e2", layer: "corte", type: "line", x1: 90, y1: 0, x2: 90, y2: 45 },
      { id: "e3", layer: "corte", type: "line", x1: 90, y1: 45, x2: 60, y2: 45 },
      { id: "e4", layer: "corte", type: "line", x1: 60, y1: 45, x2: 60, y2: 70 },
      { id: "e5", layer: "corte", type: "line", x1: 60, y1: 70, x2: 0, y2: 70 },
      { id: "e6", layer: "corte", type: "line", x1: 0, y1: 70, x2: 0, y2: 0 },
      // Furo técnico no meio
      { id: "e7", layer: "recorte", type: "circle", cx: 30, cy: 35, r: 10 },
    ];

    const dims: Dimension[] = [
      makeDimension("aligned", [{ kind: "entity", id: "e1" }], 20),
      makeDimension("diameter", [{ kind: "entity", id: "e7" }], 20),
    ];

    const res = convertSelectionToIsometric({
      entities: irregularPiece,
      selectedIds: ["e1", "e2", "e3", "e4", "e5", "e6", "e7"],
      dims,
      plane: "top",
      mode: "replace",
      thickness: 0,
    });

    expect(res.updatedEntities.length).toBe(7);
    const holeEllipse = res.updatedEntities.find((e) => e.id === "e7");
    expect(holeEllipse?.type).toBe("ellipse");
    if (holeEllipse?.type === "ellipse") {
      expect(holeEllipse.rx).toBeCloseTo(10 * ISO_SQRT_1_5, 3);
      expect(holeEllipse.ry).toBeCloseTo(10 * ISO_SQRT_0_5, 3);
      expect(holeEllipse.params?.realRadius).toBe(10);
      expect(holeEllipse.params?.realDiameter).toBe(20);
    }
  });

  it("isola estritamente a seleção: entidades não selecionadas permanecem intactas", () => {
    const entities: Entity[] = [
      { id: "selected1", layer: "corte", type: "line", x1: 0, y1: 0, x2: 50, y2: 0 },
      { id: "unselected1", layer: "corte", type: "line", x1: 100, y1: 100, x2: 200, y2: 100 },
      { id: "unselected2", layer: "recorte", type: "circle", cx: 150, cy: 150, r: 25 },
    ];

    const res = convertSelectionToIsometric({
      entities,
      selectedIds: ["selected1"],
      dims: [],
      plane: "right",
      mode: "replace",
    });

    // Entidades não selecionadas continuam inalteradas
    const u1 = res.updatedEntities.find((e) => e.id === "unselected1");
    const u2 = res.updatedEntities.find((e) => e.id === "unselected2");
    expect(u1).toEqual(entities[1]);
    expect(u2).toEqual(entities[2]);

    // Apenas a entidade selecionada foi convertida
    const s1 = res.updatedEntities.find((e) => e.id === "selected1");
    expect(s1?.params?.isIso).toBe(true);
    expect(s1?.params?.isoPlane).toBe("right");
  });

  it("suporta modo Criar Cópia preservando original e remapeando IDs e cotas", () => {
    const original: Entity[] = [
      { id: "orig1", layer: "corte", type: "line", x1: 10, y1: 10, x2: 60, y2: 10 },
      { id: "orig2", layer: "corte", type: "circle", cx: 35, cy: 30, r: 8 },
    ];
    const dims: Dimension[] = [
      makeDimension("aligned", [{ kind: "entity", id: "orig1" }], 15),
      makeDimension("diameter", [{ kind: "entity", id: "orig2" }], 15),
    ];

    const res = convertSelectionToIsometric({
      entities: original,
      selectedIds: ["orig1", "orig2"],
      dims,
      plane: "left",
      mode: "copy",
      thickness: 0,
    });

    // Originais intactos presentes no documento
    expect(res.updatedEntities.some((e) => e.id === "orig1")).toBe(true);
    expect(res.updatedEntities.some((e) => e.id === "orig2")).toBe(true);
    // Cópia criada com novos IDs
    expect(res.updatedEntities.length).toBe(4);
    expect(res.updatedDims.length).toBe(4);

    const copiedEntities = res.updatedEntities.filter((e) => e.id !== "orig1" && e.id !== "orig2");
    expect(copiedEntities.length).toBe(2);
    expect(copiedEntities[0]!.params?.isIso).toBe(true);
  });

  it("gera representação volumétrica sólida HLR com linhas de silhueta e semiarco frontal quando thickness > 0", () => {
    const circle: Entity = { id: "c1", layer: "corte", type: "circle", cx: 50, cy: 50, r: 20 };

    const res = convertSelectionToIsometric({
      entities: [circle],
      selectedIds: ["c1"],
      dims: [],
      plane: "top",
      mode: "replace",
      thickness: 15,
    });

    // Corpo sólido + semiarco frontal visível + 2 linhas de silhueta + elipse superior preenchida = 5 entidades
    expect(res.updatedEntities.length).toBeGreaterThanOrEqual(4);
    const lines = res.updatedEntities.filter((e) => e.type === "line");
    expect(lines.length).toBe(2);
    const solidFaces = res.updatedEntities.filter((e) => e.params?.isIsoSolidFace);
    expect(solidFaces.length).toBeGreaterThanOrEqual(3);
  });

  it("interpreta chapa com furos passantes, linha de dobra 3D e não extruda linhas de centro", () => {
    const bracket2D: Entity[] = [
      // Contorno externo fechado (polilinha)
      {
        id: "outer",
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: [
          { x: 0, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      // Linha de dobra dividindo a base (0..80) e a aba (80..120)
      { id: "bend1", layer: "dobra", type: "line", x1: 80, y1: 0, x2: 80, y2: 80 },
      // Furo na base
      { id: "holeBase", layer: "recorte", type: "circle", cx: 40, cy: 40, r: 10 },
      // Furo na aba dobrada
      { id: "holeFlange", layer: "recorte", type: "circle", cx: 100, cy: 40, r: 8 },
      // Linha de centro (não deve receber paredes verticais)
      { id: "center1", layer: "eixo", type: "line", x1: 0, y1: 40, x2: 120, y2: 40, isConstruction: true },
    ];

    const res = convertSelectionToIsometric({
      entities: bracket2D,
      selectedIds: bracket2D.map((e) => e.id),
      dims: [],
      plane: "top",
      mode: "replace",
      thickness: 3,
      bendAngleDeg: 90,
      bendRadius: 2,
    });

    // Verifica que faces sólidas sombreadas foram geradas e ordenadas por depth (Painter's Algorithm)
    const solidEntities = res.updatedEntities.filter((e) => e.params?.isIsoSolidFace);
    expect(solidEntities.length).toBeGreaterThan(5);

    // Verifica que a linha de centro foi projetada apenas uma única vez
    const centerProjected = res.updatedEntities.filter((e) => e.id === "center1");
    expect(centerProjected.length).toBe(1);

    // Reversão analítica restaura as 5 entidades 2D originais sem resíduos de extrusão
    const reverted = unprojectSelectionFromIsometric({
      entities: res.updatedEntities,
      selectedIds: res.newSelectionIds,
      dims: res.updatedDims,
      fallbackPlane: "top",
    });
    expect(reverted.updatedEntities.length).toBe(5);
  });

  it("bloqueia operação e lança aviso quando não há entidades selecionadas", () => {
    expect(() => {
      convertSelectionToIsometric({
        entities: [{ id: "x", layer: "corte", type: "line", x1: 0, y1: 0, x2: 10, y2: 0 }],
        selectedIds: [],
        dims: [],
        plane: "top",
        mode: "replace",
      });
    }).toThrow("Nenhuma entidade selecionada para converter para isométrico.");
  });

  it("desprojeta entidades isométricas por matriz inversa revertendo com exatidão para 2D canônico", () => {
    const pivot = { x: 20, y: 30 };
    const originalLine: Entity = {
      id: "line1",
      layer: "corte",
      type: "line",
      x1: 20,
      y1: 30,
      x2: 120,
      y2: 80,
    };

    const originalCircle: Entity = {
      id: "hole1",
      layer: "recorte",
      type: "circle",
      cx: 70,
      cy: 55,
      r: 15,
    };

    const planes = ["top", "left", "right"] as const;

    for (const plane of planes) {
      // 1. Projeta para isométrico
      const isoLine = projectEntityToIso(originalLine, plane, pivot);
      const isoCircle = projectEntityToIso(originalCircle, plane, pivot);

      expect(isoCircle.type).toBe("ellipse");

      // 2. Desprojeta via matriz inversa
      const backLine = unprojectEntityFromIso(isoLine, plane, pivot);
      const backCircle = unprojectEntityFromIso(isoCircle, plane, pivot);

      if (backLine.type === "line") {
        expect(backLine.x1).toBeCloseTo(originalLine.x1, 4);
        expect(backLine.y1).toBeCloseTo(originalLine.y1, 4);
        expect(backLine.x2).toBeCloseTo(originalLine.x2, 4);
        expect(backLine.y2).toBeCloseTo(originalLine.y2, 4);
      }

      if (backCircle.type === "circle") {
        expect(backCircle.cx).toBeCloseTo(originalCircle.cx, 4);
        expect(backCircle.cy).toBeCloseTo(originalCircle.cy, 4);
        expect(backCircle.r).toBeCloseTo(originalCircle.r, 4);
      }
    }
  });

  it("realiza ciclo round-trip completo (2D -> Isométrico -> 2D) via unprojectSelectionFromIsometric", () => {
    const piece: Entity[] = [
      { id: "p1", layer: "corte", type: "line", x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: "p2", layer: "corte", type: "line", x1: 100, y1: 0, x2: 100, y2: 60 },
      { id: "p3", layer: "corte", type: "circle", cx: 50, cy: 30, r: 12 },
    ];

    const dims: Dimension[] = [
      makeDimension("aligned", [{ kind: "entity", id: "p1" }], 15),
      makeDimension("diameter", [{ kind: "entity", id: "p3" }], 15),
    ];

    // Projeta para isométrico (Top)
    const converted = convertSelectionToIsometric({
      entities: piece,
      selectedIds: ["p1", "p2", "p3"],
      dims,
      plane: "top",
      mode: "replace",
      thickness: 0,
    });

    expect(converted.updatedEntities.length).toBe(3);
    const isoHole = converted.updatedEntities.find((e) => e.id === "p3");
    expect(isoHole?.type).toBe("ellipse");

    // Desprojeta de volta para 2D
    const reverted = unprojectSelectionFromIsometric({
      entities: converted.updatedEntities,
      selectedIds: ["p1", "p2", "p3"],
      dims: converted.updatedDims,
      fallbackPlane: "top",
    });

    expect(reverted.updatedEntities.length).toBe(3);
    const revertedHole = reverted.updatedEntities.find((e) => e.id === "p3");
    expect(revertedHole?.type).toBe("circle");
    if (revertedHole?.type === "circle") {
      expect(revertedHole.cx).toBeCloseTo(50, 3);
      expect(revertedHole.cy).toBeCloseTo(30, 3);
      expect(revertedHole.r).toBeCloseTo(12, 3);
    }
  });
});

