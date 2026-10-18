import { describe, it, expect } from "vitest";
import { ParametricVariableStore } from "./cadParametricVariables";

describe("ParametricVariableStore — Avaliação Numérica e Expressões", () => {
  it("avalia números decimais com vírgula e ponto", () => {
    const store = new ParametricVariableStore();
    expect(store.evaluateExpression("12.5")).toBe(12.5);
    expect(store.evaluateExpression("12,5")).toBe(12.5);
    expect(store.evaluateExpression("10,5 + 4,5")).toBe(15);
  });

  it("converte unidades industriais (mm, in, cm, m)", () => {
    const store = new ParametricVariableStore();
    expect(store.evaluateExpression("500 mm")).toBe(500);
    expect(store.evaluateExpression("1 in")).toBeCloseTo(25.4, 3);
    expect(store.evaluateExpression("1,5 in")).toBeCloseTo(38.1, 3);
    expect(store.evaluateExpression("20 cm")).toBe(200);
    expect(store.evaluateExpression("1.2 m")).toBe(1200);
  });

  it("avalia funções matemáticas avançadas (sqrt, sin, cos, min, max, if)", () => {
    const store = new ParametricVariableStore();
    expect(store.evaluateExpression("sqrt(16)")).toBe(4);
    expect(store.evaluateExpression("min(100, 50)")).toBe(50);
    expect(store.evaluateExpression("max(10, 25)")).toBe(25);
    expect(store.evaluateExpression("round(14.7)")).toBe(15);
    expect(store.evaluateExpression("if(10 > 5, 200, 100)")).toBe(200);
  });

  it("resolve dependências de variáveis no grafo", () => {
    const store = new ParametricVariableStore();
    store.setVariable("LARGURA", "500");
    store.setVariable("MARGEM", "25");
    store.setVariable("COMPRIMENTO_UTIL", "LARGURA - 2 * MARGEM");
    expect(store.getValue("COMPRIMENTO_UTIL")).toBe(450);

    // Atualiza LARGURA e confere propagação (Tarefa 7 do documento mestre)
    store.setVariable("LARGURA", "800");
    expect(store.getValue("COMPRIMENTO_UTIL")).toBe(750);
  });
});
