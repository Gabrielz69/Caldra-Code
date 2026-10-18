import { describe, expect, it } from "vitest";
import {
  COMPARISON,
  FREE_PROJECT_LIMIT,
  PRO_PROJECT_LIMIT,
  getFeatureLimit,
  hasFeature,
  isFree,
  isPro,
  normalizePlan,
  planAllows,
  type Feature,
} from "./features";

const FREE_OK: Feature[] = [
  "calculator.scientific",
  "library.full",
  "geometry.basic",
  "components.library",
  "materials.custom",
  "export.png",
  "export.svg",
  "backup.import",
];

const FREE_BLOCKED: Feature[] = [
  "lab2d",
  "vision.import",
  "cnc2d.import",
  "export.dxf",
  "export.dxf.cnc",
  "export.pdf",
  "workshop.manage",
  "nesting",
  "cost.fabrication",
  "quote.pdf",
  "jobsheet",
  "cut.plan",
  "cloud.sync",
  "school.full",
  "geometry.advanced",
  "projects.unlimited",
  "aurora.animated",
  "accent.colors",
];

describe("CALDRA FREE", () => {
  it("libera calculadora, biblioteca, traçagem básica, modelos, PNG e SVG", () => {
    for (const f of FREE_OK) expect(planAllows("free", f), f).toBe(true);
  });

  it("bloqueia CHAMFER, VISION, CNC 2D, DXF, Oficina, fabricação e personalização PRO", () => {
    for (const f of FREE_BLOCKED) expect(planAllows("free", f), f).toBe(false);
  });

  it("limita a 5 projetos", () => {
    expect(getFeatureLimit("free", "projects")).toBe(5);
    expect(FREE_PROJECT_LIMIT).toBe(5);
    const existentes = 5;
    expect(existentes >= getFeatureLimit("free", "projects")).toBe(true);
    expect(4 >= getFeatureLimit("free", "projects")).toBe(false);
  });

  it("é reconhecido pelos helpers", () => {
    expect(isFree("free")).toBe(true);
    expect(isPro("free")).toBe(false);
  });
});

describe("CALDRA PRO", () => {
  it("libera tudo do Free e todo o resto", () => {
    for (const f of [...FREE_OK, ...FREE_BLOCKED]) expect(hasFeature("pro", f), f).toBe(true);
  });

  it("tem projetos ilimitados", () => {
    expect(getFeatureLimit("pro", "projects")).toBe(PRO_PROJECT_LIMIT);
    expect(Number.isFinite(getFeatureLimit("pro", "projects"))).toBe(false);
  });

  it("é reconhecido pelos helpers", () => {
    expect(isPro("pro")).toBe(true);
    expect(isFree("pro")).toBe(false);
  });
});

describe("migração de planos antigos", () => {
  it("mestre e oficina viram PRO; ausente vira FREE", () => {
    expect(normalizePlan("mestre")).toBe("pro");
    expect(normalizePlan("oficina")).toBe("pro");
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan("qualquer")).toBe("free");
  });
});

describe("tabela de comparação", () => {
  it("reflete os limites centrais", () => {
    const projetos = COMPARISON.find((r) => r.label === "Meus projetos");
    expect(projetos?.free).toBe(String(FREE_PROJECT_LIMIT));
    expect(projetos?.pro).toBe("Ilimitado");
    expect(COMPARISON.find((r) => r.label === "Cor de destaque")?.free).toBe("Azul");
    expect(COMPARISON.find((r) => r.label === "Estilo de fundo")?.free).toBe("Padrão");
  });
});
