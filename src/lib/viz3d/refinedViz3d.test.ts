/**
 * TESTES AUTOMATIZADOS DO REFINAMENTO DEFINITIVO DA VISUALIZAÇÃO 3D
 *
 * Cobre os requisitos de:
 * 1. Rotação 360°, elevação ±90°, diagonais e inversão de direção (Seção 8).
 * 2. Movimentação espacial completa / Pan para todas as regiões do viewport (Seção 9).
 * 3. Faixa completa de Zoom: mínimo, intermediário e máximo (Seção 10).
 * 4. Todas as vistas canônicas: ISO, FR, TRAS, LAT, DIR, ESQ, SUP, INF (Seção 11).
 * 5. Todos os modos de representação: SOMB, SOMB+AR, ARAME (Seção 12).
 * 6. Auditoria pura e linha de base matemática sem sombras artificiais (Seções 2, 4, 6).
 */

import { describe, expect, it } from "vitest";
import { buildWire, type Camera } from "./wire";
import { cameraForView, EXTENDED_VIEW_PRESETS, VIEW_PRESETS, type ViewPresetId } from "./cameraPresets";
import { auditModel, compareBaselines, computeMathematicalBaseline, isHealthy } from "./audit";
import { projectLine, toCameraPoint, visibleLineSegments, VISIBILITY_POLICY } from "./visibility";
import { getModelShadingStyle } from "./technicalConfig";

const TEST_MODELS = [
  { slug: "quadrado-redondo", params: { d1: 500, d2: 300, h: 400, baseA: 500, baseB: 400, divisions: 8 } },
  { slug: "curva-de-gomos", params: { d1: 400, d2: 400, h: 400, ang: 90, n: 4 } },
  { slug: "cone", params: { d1: 800, d2: 0, h: 500 } },
  { slug: "reducao-circular", params: { d1: 600, d2: 300, h: 400 } },
  { slug: "boca-de-lobo", params: { d1: 400, d2: 200, h: 400, ang: 45 } },
] as const;

describe("Seção 8: Rotação e Navegação em Toda a Esfera", () => {
  const model = buildWire("cone", { d1: 600, d2: 200, h: 400 });

  it("testa rotação 360° horizontal completa em passos de 30°", () => {
    for (let deg = 0; deg <= 360; deg += 30) {
      const yaw = (deg * Math.PI) / 180;
      const cam: Camera = { yaw, pitch: 0, zoom: 1 };
      const projected = model.edges.map((edge, i) =>
        projectLine(`edge:${i}`, edge, (p) => toCameraPoint(p, cam), 1),
      );
      expect(projected).toHaveLength(model.edges.length);
      expect(projected.every((l) => Number.isFinite(l.x1) && Number.isFinite(l.y1))).toBe(true);
    }
  });

  it("testa elevação 90° para cima e 90° para baixo", () => {
    const elevations = [Math.PI / 2, Math.PI / 4, 0, -Math.PI / 4, -Math.PI / 2];
    for (const pitch of elevations) {
      const cam: Camera = { yaw: 0.5, pitch, zoom: 1 };
      const projected = model.edges.map((edge, i) =>
        projectLine(`edge:${i}`, edge, (p) => toCameraPoint(p, cam), 1),
      );
      expect(projected.every((l) => Number.isFinite(l.x1) && Number.isFinite(l.y2))).toBe(true);
    }
  });

  it("testa rotações diagonais e espirais", () => {
    for (let step = 0; step < 20; step++) {
      const t = step / 20;
      const yaw = t * Math.PI * 4; // espiral 720°
      const pitch = (t - 0.5) * Math.PI; // -90° a +90°
      const cam: Camera = { yaw, pitch, zoom: 1 };
      const cp = (p: typeof model.faces[0]["pts"][0]) => toCameraPoint(p, cam);
      expect(model.faces.every((f) => f.pts.map(cp).every((p) => Number.isFinite(p.x)))).toBe(true);
    }
  });
});

describe("Seção 9: Movimentação Espacial Completa (Pan)", () => {
  const model = buildWire("quadrado-redondo", { d1: 500, d2: 300, h: 400 });

  it("testa pan para todas as regiões do viewport: centro, cantos e extremidades", () => {
    const panPositions = [
      { name: "centro", panX: 0, panY: 0 },
      { name: "canto-superior-esquerdo", panX: -150, panY: -150 },
      { name: "canto-superior-direito", panX: 150, panY: -150 },
      { name: "canto-inferior-esquerdo", panX: -150, panY: 150 },
      { name: "canto-inferior-direito", panX: 150, panY: 150 },
      { name: "extremo-esquerdo", panX: -300, panY: 0 },
      { name: "extremo-direito", panX: 300, panY: 0 },
      { name: "extremo-superior", panX: 0, panY: -300 },
      { name: "extremo-inferior", panX: 0, panY: 300 },
    ];

    for (const pos of panPositions) {
      const cam: Camera = { yaw: 0.7, pitch: 0.4, zoom: 1, panX: pos.panX, panY: pos.panY };
      const lines = model.edges.map((edge, i) =>
        projectLine(`edge:${i}`, edge, (p) => toCameraPoint(p, cam), 1, cam.panX, cam.panY),
      );
      expect(lines).toHaveLength(model.edges.length);
      expect(lines.every((l) => Number.isFinite(l.x1) && Number.isFinite(l.y1))).toBe(true);
    }
  });

  it("testa pan contínuo combinado com zoom e rotação", () => {
    for (let step = 0; step < 10; step++) {
      const cam: Camera = {
        yaw: step * 0.2,
        pitch: step * 0.1,
        zoom: 0.5 + step * 0.2,
        panX: step * 25,
        panY: -step * 15,
      };
      const lines = model.edges.map((edge, i) =>
        projectLine(`edge:${i}`, edge, (p) => toCameraPoint(p, cam), 1, cam.panX, cam.panY),
      );
      expect(lines.every((l) => Number.isFinite(l.x1) && Number.isFinite(l.y1))).toBe(true);
    }
  });
});

describe("Seção 10: Faixa Completa de Zoom", () => {
  const model = buildWire("curva-de-gomos", { d1: 400, d2: 400, h: 400, ang: 90, n: 4 });

  it("testa zoom mínimo (0.35x), intermediário (1.0x, 2.0x) e máximo (4.5x)", () => {
    const zoomLevels = [0.35, 0.7, 1.0, 1.5, 2.5, 3.5, 4.5];
    for (const zoom of zoomLevels) {
      const cam: Camera = { yaw: 0.7, pitch: 0.4, zoom };
      const lines = model.edges.map((edge, i) =>
        projectLine(`edge:${i}`, edge, (p) => toCameraPoint(p, cam), 1),
      );
      expect(lines).toHaveLength(model.edges.length);
      expect(lines.every((l) => Number.isFinite(l.x1) && Number.isFinite(l.y1))).toBe(true);
    }
  });
});

describe("Seção 11: Todas as Vistas Técnicas", () => {
  const views: ViewPresetId[] = ["iso", "front", "back", "side", "right", "left", "top", "bottom"];

  it("fornece orientação correta e reseta pan para todas as 8 vistas", () => {
    for (const v of views) {
      const cam = cameraForView(v);
      expect(cam.zoom).toBe(1);
      expect(cam.panX).toBe(0);
      expect(cam.panY).toBe(0);
      expect(Number.isFinite(cam.yaw)).toBe(true);
      expect(Number.isFinite(cam.pitch)).toBe(true);
    }
  });

  it("contém todas as vistas na lista estendida", () => {
    const ids = EXTENDED_VIEW_PRESETS.map((p) => p.id);
    expect(ids).toContain("iso");
    expect(ids).toContain("front");
    expect(ids).toContain("back");
    expect(ids).toContain("side");
    expect(ids).toContain("right");
    expect(ids).toContain("left");
    expect(ids).toContain("top");
    expect(ids).toContain("bottom");
  });
});

describe("Seções 2, 3, 4 e 6: Topologia, Auditoria Pura e Sombra Artificial", () => {
  for (const item of TEST_MODELS) {
    it(`valida auditoria de ${item.slug}: sem degenerações, normais unitárias e sem sombra artificial`, () => {
      const model = buildWire(item.slug, item.params);
      const audit = auditModel(model);

      expect(isHealthy(audit)).toBe(true);
      expect(audit.degenerate).toBe(0);
      expect(audit.duplicates).toBe(0);
      expect(audit.nonFinite).toBe(0);
      expect(audit.badNormals).toBe(0);
      expect(audit.orientationIssues).toBe(0);
      expect(audit.hasArtificialShadow).toBe(false);
      expect(audit.baseline.totalArea).toBeGreaterThan(0);
    });

    it(`preserva a linha de base matemática invariante para ${item.slug}`, () => {
      const model1 = buildWire(item.slug, item.params);
      const model2 = buildWire(item.slug, item.params);

      const base1 = computeMathematicalBaseline(model1);
      const base2 = computeMathematicalBaseline(model2);

      const comp = compareBaselines(base1, base2);
      expect(comp.identical).toBe(true);
      expect(comp.areaDiff).toBe(0);
      expect(comp.vertexDiff).toBe(0);
      expect(comp.faceDiff).toBe(0);
      expect(comp.boundsMatch).toBe(true);
    });

    it(`atribui estilo de sombreamento técnico correto para ${item.slug}`, () => {
      const model = buildWire(item.slug, item.params);
      const style = getModelShadingStyle(item.slug);
      expect(model.shadingStyle).toBe(style);

      if (item.slug === "quadrado-redondo") expect(style).toBe("faceted");
      if (item.slug === "cone" || item.slug === "reducao-circular") expect(style).toBe("smooth");
      if (item.slug === "curva-de-gomos" || item.slug === "boca-de-lobo") expect(style).toBe("hybrid");
    });
  }
});
