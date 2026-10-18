import { describe, it, expect } from "vitest";
import { CadSemanticIntentEngine } from "./cadSemanticIntent";

describe("CadSemanticIntentEngine — Tarefas-Âncora e Interpretação Geométrica", () => {
  it("Tarefa 1: Gera chapa 500 x 300 com quatro furos Ø12 a 25 mm das bordas", () => {
    const plan = CadSemanticIntentEngine.parseIntent(
      "Crie uma chapa de 500 x 300 com quatro furos Ø12 a 25 mm das bordas"
    );
    expect(plan).not.toBeNull();
    expect(plan?.generatedEntities.length).toBe(5); // 1 retangulo + 4 furos

    // Verifica que o primeiro é a chapa
    const plate = plan!.generatedEntities[0];
    expect(plate.type).toBe("polyline");

    // Verifica os 4 furos circulares
    const circles = plan!.generatedEntities.slice(1);
    expect(circles.every((c) => c.type === "circle")).toBe(true);
    expect(circles[0]).toMatchObject({ cx: 25, cy: 25, r: 6 });
    expect(circles[2]).toMatchObject({ cx: 475, cy: 275, r: 6 });
  });

  it("Tarefa 2: Gera suporte com raios, rasgo e simetria", () => {
    const plan = CadSemanticIntentEngine.parseIntent("Suporte com rasgo oblongo");
    expect(plan).not.toBeNull();
    expect(plan?.generatedEntities.some((e) => e.type === "polyline")).toBe(true);
    // Deve incluir o rasgo (slot)
    const slot = plan!.generatedEntities.find((e) => e.type === "polyline" && e.pts.length > 4);
    expect(slot).toBeDefined();
  });

  it("Tarefa 3: Gera flange com PCD e 8 furos", () => {
    const plan = CadSemanticIntentEngine.parseIntent("Flange com PCD 320 e 8 furos");
    expect(plan).not.toBeNull();
    const circles = plan!.generatedEntities.filter((e) => e.type === "circle");
    // 1 externo + 1 interno + 1 PCD + 8 furos = 11 círculos
    expect(circles.length).toBe(11);
  });

  it("Tarefa 4: Desenvolvimento de cone truncado", () => {
    const plan = CadSemanticIntentEngine.parseIntent("Desenvolvimento de cone truncado");
    expect(plan).not.toBeNull();
    const arcs = plan!.generatedEntities.filter((e) => e.type === "arc");
    expect(arcs.length).toBe(2);
    const folds = plan!.generatedEntities.filter((e) => e.layer === "dobra");
    expect(folds.length).toBeGreaterThan(0);
  });

  it("Tarefa 5: Transição quadrado-redondo", () => {
    const plan = CadSemanticIntentEngine.parseIntent("Transição quadrado-redondo");
    expect(plan).not.toBeNull();
    const foldGenerators = plan!.generatedEntities.filter((e) => e.layer === "dobra");
    expect(foldGenerators.length).toBe(4);
  });
});
