import { describe, expect, it } from "vitest";
import { getEngine } from "@/lib/geometry/engines";
import { SQUARE_TO_ROUND_DEFAULTS, calculateSquareToRound } from "@/lib/geometry/squareToRound";
import { refExists, refKind } from "@/lib/geometry/refs";
import { buildWire } from "./wire";
import {
  edgeRefAt,
  entityIndexOf,
  faceRefAt,
  pickEdgeIndex,
  pickFaceIndex,
  pointInTriangle,
  pointToSegmentDistance,
  refFromTag,
  refLabel,
} from "./selection";
import type { ProjectedLine, ProjectedTriangle } from "./visibility";

describe("refFromTag — correspondência exata geratriz ↔ dobra", () => {
  it("mapeia quando as dobras são múltiplo exato das geratrizes", () => {
    // 8 geratrizes, 48 dobras → passo 6: k=2 → fold:12
    expect(refFromTag({ k: 2, n: 8 }, 48)).toBe("fold:12");
    expect(refFromTag({ k: 0, n: 8 }, 48)).toBe("fold:0");
  });

  it("aceita a emenda de fechamento (divisões + 1)", () => {
    // 25 dobras = 24 divisões + emenda final; 8 geratrizes → passo 3
    expect(refFromTag({ k: 2, n: 8 }, 25)).toBe("fold:6");
  });

  it("normaliza ordinais fora da faixa", () => {
    expect(refFromTag({ k: 8, n: 8 }, 48)).toBe("fold:0");
  });

  it("recusa (fallback silencioso) quando a divisão não é exata", () => {
    expect(refFromTag({ k: 1, n: 8 }, 47)).toBeNull();
    expect(refFromTag({ k: 1, n: 8 }, 26)).toBeNull();
    expect(refFromTag({ k: 1, n: 0 }, 48)).toBeNull();
    expect(refFromTag(undefined, 48)).toBeNull();
    expect(refFromTag({ k: 1, n: 8 }, 0)).toBeNull();
  });
});

describe("hit-test em coordenadas de tela", () => {
  const line = (id: string, x1: number, y1: number, x2: number, y2: number): ProjectedLine => ({
    id,
    x1,
    y1,
    x2,
    y2,
    z1: 0,
    z2: 0,
  });

  it("distância ponto–segmento", () => {
    expect(pointToSegmentDistance(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(pointToSegmentDistance(-4, 0, 0, 0, 10, 0)).toBeCloseTo(4);
  });

  it("escolhe a aresta mais próxima dentro da tolerância", () => {
    const lines = [line("edge:2", 0, 0, 10, 0), line("edge:5", 0, 8, 10, 8)];
    expect(pickEdgeIndex(lines, 5, 1.5, 4)).toBe(2);
    expect(pickEdgeIndex(lines, 5, 7, 4)).toBe(5);
    expect(pickEdgeIndex(lines, 5, 20, 4)).toBeNull();
  });

  it("reconhece IDs de segmentos subdivididos (edge:12:0-3)", () => {
    expect(entityIndexOf("edge:12:0-3")).toBe(12);
    expect(entityIndexOf("edge:3")).toBe(3);
  });

  it("ponto em triângulo e face mais à frente (ordem de desenho)", () => {
    expect(pointInTriangle(1, 1, 0, 0, 4, 0, 0, 4)).toBe(true);
    expect(pointInTriangle(5, 5, 0, 0, 4, 0, 0, 4)).toBe(false);
    const tri = (id: string, priority: number): ProjectedTriangle => ({
      id,
      pts: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 0, y: 10, z: 0 },
      ],
      minDepth: 0,
      maxDepth: 0,
      centerDepth: 0,
      priority,
    });
    // o último desenhado (mais à frente) vence
    expect(pickFaceIndex([tri("face:1:0", 1), tri("face:7:0", 7)], 2, 2)).toBe(7);
    expect(pickFaceIndex([tri("face:1:0", 1)], 20, 20)).toBeNull();
  });
});

describe("rótulo textual (destaque nunca depende só de cor)", () => {
  it("nomeia cada tipo de referência", () => {
    expect(refLabel("fold:7")).toBe("Geratriz 8");
    expect(refLabel("outline:2")).toBe("Contorno 3");
    expect(refLabel("point:0")).toBe("Ponto A");
    expect(refLabel("dim:h")).toContain("Cota");
  });
});

describe("integração: modelos × desenvolvimentos dos motores", () => {
  const SLUGS = ["cilindro", "cone", "tronco-de-cone", "curva-de-gomos", "boca-de-lobo"];

  for (const slug of SLUGS) {
    it(`${slug}: toda ref mapeada existe no desenvolvimento`, () => {
      const engine = getEngine(slug);
      expect(engine).toBeTruthy();
      const model = buildWire(slug, engine!.wire({ ...engine!.defaults }));
      const dev = engine!.calculate({ ...engine!.defaults }).development;
      const folds = dev.foldLines.length;
      let mapped = 0;
      model.edges.forEach((_, i) => {
        const ref = edgeRefAt(model, folds, i);
        if (!ref) return;
        mapped++;
        // geratriz → dobra; aro de boca → contorno (base/topo)
        expect(["fold", "outline"]).toContain(refKind(ref));
        expect(refExists(dev, ref)).toBe(true);
      });
      model.faces.forEach((_, i) => {
        const ref = faceRefAt(model, folds, i);
        if (!ref) return;
        expect(refExists(dev, ref)).toBe(true);
      });
      expect(model.edgeTags?.length ?? 0).toBe(model.edges.length);
      // cilindro/cone/curva têm correspondência exata comprovável
      if (slug !== "boca-de-lobo" && slug !== "tronco-de-cone") expect(mapped).toBeGreaterThan(0);
    });
  }

  it("quadrado-redondo: geratrizes da malha facetada são marcadas", () => {
    const model = buildWire("quadrado-redondo", {
      d1: Math.max(SQUARE_TO_ROUND_DEFAULTS.baseA, SQUARE_TO_ROUND_DEFAULTS.baseB),
      d2: SQUARE_TO_ROUND_DEFAULTS.topDiameter,
      h: SQUARE_TO_ROUND_DEFAULTS.height,
      e: SQUARE_TO_ROUND_DEFAULTS.offsetX,
      t: SQUARE_TO_ROUND_DEFAULTS.thickness,
      seg: SQUARE_TO_ROUND_DEFAULTS.divisions * 4,
      baseA: SQUARE_TO_ROUND_DEFAULTS.baseA,
      baseB: SQUARE_TO_ROUND_DEFAULTS.baseB,
      offsetY: SQUARE_TO_ROUND_DEFAULTS.offsetY,
      divisions: SQUARE_TO_ROUND_DEFAULTS.divisions,
    });
    const dev = calculateSquareToRound({ ...SQUARE_TO_ROUND_DEFAULTS }).development;
    const folds = dev.foldLines.length;
    expect(model.edgeTags?.some((t) => t !== undefined)).toBe(true);
    model.edges.forEach((_, i) => {
      const ref = edgeRefAt(model, folds, i);
      if (ref) expect(refExists(dev, ref)).toBe(true);
    });
  });
});
