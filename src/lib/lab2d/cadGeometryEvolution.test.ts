import { describe, it, expect } from "vitest";
import {
  createSlotPolyline,
  create3PointRectangle,
  createCircle3Points,
  createArc3Points,
  parseCadCoordinate,
  computePolarTrackingSnap,
} from "./cadGeometryCore";
import {
  analyzeTopology,
  autoHealEntities,
} from "./cadTopologyDiagnostics";
import { execute2DBoolean } from "./cadBooleans2D";
import { CAD_PRESETS_CATALOG } from "./cadPresetsCatalog";
import { globalParametricStore } from "./cadParametricVariables";
import type { Entity } from "./core";

describe("CALDRA CHAMFER 2D — Núcleo Geométrico Avançado", () => {
  it("gera polilinha de rasgo oblongo (slot) paramétrico com 4 arcos/segmentos", () => {
    const slot = createSlotPolyline({ x: 100, y: 100 }, 80, 20, 0, "corte");
    expect(slot.type).toBe("polyline");
    expect(slot.closed).toBe(true);
    expect(slot.pts.length).toBeGreaterThanOrEqual(16);
  });

  it("cria retângulo alinhado e rotacionado por 3 pontos", () => {
    const rect = create3PointRectangle(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      "corte",
    );
    expect(rect.type).toBe("polyline");
    expect(rect.closed).toBe(true);
    expect(rect.pts.length).toBe(4);
    expect(rect.pts[0]).toEqual({ x: 0, y: 0 });
    expect(rect.pts[1]).toEqual({ x: 100, y: 0 });
  });

  it("calcula círculo por 3 pontos não-colineares", () => {
    const circ = createCircle3Points(
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: -10 },
      "recorte",
    );
    expect(circ).not.toBeNull();
    if (circ) {
      expect(circ.type).toBe("circle");
      expect(Math.abs(circ.cx)).toBeLessThan(1e-4);
      expect(Math.abs(circ.cy)).toBeLessThan(1e-4);
      expect(Math.abs(circ.r - 10)).toBeLessThan(1e-4);
    }
  });

  it("calcula arco por 3 pontos", () => {
    const arc = createArc3Points(
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
      "corte",
    );
    expect(arc).not.toBeNull();
    if (arc) {
      expect(arc.type).toBe("arc");
      expect(Math.abs(arc.r - 10)).toBeLessThan(1e-4);
    }
  });

  it("faz parse de coordenadas relativas e polares (@dx,dy e @dist<ang)", () => {
    const rel = parseCadCoordinate("@50,25", { x: 100, y: 100 });
    expect(rel).toEqual({ x: 150, y: 125 });

    const polar = parseCadCoordinate("@100<90", { x: 50, y: 50 });
    expect(polar).not.toBeNull();
    if (polar) {
      expect(Math.abs(polar.x - 50)).toBeLessThan(1e-4);
      expect(Math.abs(polar.y - 150)).toBeLessThan(1e-4);
    }
  });

  it("aplica atração magnética de rastreamento polar (polar tracking)", () => {
    const snapped = computePolarTrackingSnap(
      { x: 0, y: 0 },
      { x: 100, y: 1 },
      15,
      20,
      1,
    );
    expect(snapped).not.toBeNull();
    if (snapped) {
      expect(snapped.angleDeg).toBe(0);
      expect(Math.abs(snapped.snappedPoint.y)).toBeLessThan(1e-4);
    }
  });
});

describe("CALDRA CHAMFER 2D — Diagnóstico Topológico & Auto-Heal", () => {
  it("detecta contorno aberto e microfrestas em linhas desconectadas", () => {
    const lines: Entity[] = [
      { id: "l1", type: "line", layer: "corte", x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: "l2", type: "line", layer: "corte", x1: 100.1, y1: 0, x2: 100, y2: 100 }, // gap de 0.1mm
      { id: "l3", type: "line", layer: "corte", x1: 100, y1: 100, x2: 0, y2: 100 },
      { id: "l4", type: "line", layer: "corte", x1: 0, y1: 100, x2: 0, y2: 0 },
    ];

    const report = analyzeTopology(lines, 0.5);
    expect(report.isHealthy).toBe(false);
    expect(report.gapCount).toBeGreaterThan(0);
  });

  it("executa auto-heal e solda as frestas com tolerância especificada", () => {
    const lines: Entity[] = [
      { id: "l1", type: "line", layer: "corte", x1: 0, y1: 0, x2: 100, y2: 0 },
      { id: "l2", type: "line", layer: "corte", x1: 100.2, y1: 0, x2: 100, y2: 100 },
    ];

    const { healedEntities, fixedIssuesCount } = autoHealEntities(lines, 0.5);
    expect(fixedIssuesCount).toBeGreaterThan(0);
    expect(healedEntities.length).toBe(2);
  });
});

describe("CALDRA CHAMFER 2D — Operações Booleanas 2D", () => {
  it("executa união booleana entre retângulos", () => {
    const r1: Entity = {
      id: "r1",
      type: "polyline",
      layer: "corte",
      closed: true,
      pts: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }],
    };
    const r2: Entity = {
      id: "r2",
      type: "polyline",
      layer: "corte",
      closed: true,
      pts: [{ x: 25, y: 0 }, { x: 75, y: 0 }, { x: 75, y: 50 }, { x: 25, y: 50 }],
    };

    const res = execute2DBoolean(r1, r2, "union");
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
  });
});

describe("CALDRA CHAMFER 2D — Catálogo de Presets Industriais com Vista 2D", () => {
  it("possui todos os presets de caldeiraria e mecânica cadastrados", () => {
    expect(CAD_PRESETS_CATALOG.length).toBeGreaterThanOrEqual(8);
    const ids = CAD_PRESETS_CATALOG.map((p) => p.id);
    expect(ids).toContain("circular_flange");
    expect(ids).toContain("mounting_base");
    expect(ids).toContain("metalon_tube");
    expect(ids).toContain("slot_perforated_plate");
    expect(ids).toContain("curved_elbow_segment");
    expect(ids).toContain("square_to_round_transition");
    expect(ids).toContain("branch_pipe_lateral");
    expect(ids).toContain("conical_reducer");
  });

  it("gera Gomo de Curva Planificado com contorno e geratrizes de traçagem", () => {
    const elbow = CAD_PRESETS_CATALOG.find((p) => p.id === "curved_elbow_segment")!;
    const entities = elbow.generate({ diameter: 300, bendRadius: 450, totalAngle: 90, segments: 4, divisions: 12 }, { x: 0, y: 0 });
    expect(entities.length).toBeGreaterThan(5);

    const corte = entities.filter((e) => e.layer === "corte");
    const marcacao = entities.filter((e) => e.layer === "marcacao");
    expect(corte.length).toBe(1);
    expect(marcacao.length).toBeGreaterThan(0);
  });

  it("gera Transição Quadrado-Redondo Planificada com linhas de dobra", () => {
    const sq2rd = CAD_PRESETS_CATALOG.find((p) => p.id === "square_to_round_transition")!;
    const entities = sq2rd.generate({ squareSide: 300, roundDia: 200, height: 250, bendsPerCorner: 4 }, { x: 0, y: 0 });

    const dobra = entities.filter((e) => e.layer === "dobra");
    const corte = entities.filter((e) => e.layer === "corte");
    expect(corte.length).toBe(1);
    expect(dobra.length).toBeGreaterThan(0);
  });

  it("gera Boca de Lobo / Derivação Planificada", () => {
    const branch = CAD_PRESETS_CATALOG.find((p) => p.id === "branch_pipe_lateral")!;
    const entities = branch.generate({ mainDia: 300, branchDia: 200, branchLength: 250, divisions: 16 }, { x: 0, y: 0 });
    const corte = entities.filter((e) => e.layer === "corte");
    expect(corte.length).toBe(1);
  });

  it("gera Redução Cônica Planificada em setor circular", () => {
    const cone = CAD_PRESETS_CATALOG.find((p) => p.id === "conical_reducer")!;
    const entities = cone.generate({ largeDia: 400, smallDia: 200, height: 300 }, { x: 0, y: 0 });
    const corte = entities.filter((e) => e.layer === "corte");
    expect(corte.length).toBe(1);
  });
});

describe("CALDRA CHAMFER 2D — Variáveis Paramétricas", () => {
  it("define e avalia variáveis e expressões relacionais", () => {
    globalParametricStore.setVariable("LARGURA", "500");
    globalParametricStore.setVariable("ALTURA", "300");
    globalParametricStore.setVariable("MARGEM", "LARGURA / 10");

    expect(globalParametricStore.getValue("LARGURA")).toBe(500);
    expect(globalParametricStore.getValue("ALTURA")).toBe(300);
    expect(globalParametricStore.getValue("MARGEM")).toBe(50);
  });
});
