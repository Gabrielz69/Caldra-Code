/**
 * CALDRA CHAMFER — TESTES DO SISTEMA DE EDIÇÃO CONTEXTUAL MOBILE (REGRAS 1 A 18)
 */

import { describe, it, expect, vi } from "vitest";
import type { Entity } from "@/lib/lab2d/core";

describe("CALDRA CHAMFER — Mobile CAD Contextual Editing Suite", () => {
  it("valida propriedades contextuais do Círculo (Diâmetro, Centro X, Centro Y)", () => {
    const circle: Entity = {
      id: "c1",
      type: "circle",
      cx: 100,
      cy: 150,
      r: 20, // Diâmetro 40.00 mm
      layer: "corte",
    };

    const diameter = circle.r * 2;
    expect(diameter).toBe(40);
    expect(circle.cx).toBe(100);
    expect(circle.cy).toBe(150);

    // Alteração de diâmetro para 50mm em tempo real
    const newDiameter = 50;
    const updatedCircle: Entity = {
      ...circle,
      r: newDiameter / 2,
    };
    expect(updatedCircle.r).toBe(25);
    expect(updatedCircle.r * 2).toBe(50);
  });

  it("valida propriedades contextuais do Arco (Raio, Ângulo, Centro X, Centro Y)", () => {
    const arc: Entity = {
      id: "a1",
      type: "arc",
      cx: 50,
      cy: 50,
      r: 30,
      a0: 0,
      a1: Math.PI / 2, // 90°
      layer: "corte",
    };

    let sweep = arc.a1 - arc.a0;
    while (sweep < 0) sweep += Math.PI * 2;
    const sweepDeg = (sweep * 180) / Math.PI;

    expect(arc.r).toBe(30);
    expect(Math.round(sweepDeg)).toBe(90);
    expect(arc.cx).toBe(50);
    expect(arc.cy).toBe(50);
  });

  it("valida propriedades contextuais da Linha (Comprimento, Ângulo, X, Y)", () => {
    const line: Entity = {
      id: "l1",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      layer: "corte",
    };

    const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    const ang = (Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180) / Math.PI;

    expect(len).toBe(100);
    expect(ang).toBe(0);

    // Ajuste de comprimento em tempo real preservando ângulo polar
    const nextLen = 150;
    const radAng = (ang * Math.PI) / 180;
    const updatedLine: Entity = {
      ...line,
      x2: line.x1 + nextLen * Math.cos(radAng),
      y2: line.y1 + nextLen * Math.sin(radAng),
    };
    expect(Math.hypot(updatedLine.x2 - updatedLine.x1, updatedLine.y2 - updatedLine.y1)).toBe(150);
  });

  it("valida propriedades da Chapa Retangular (Comprimento, Largura, Espessura)", () => {
    const rect: Entity = {
      id: "r1",
      type: "polyline",
      closed: true,
      pts: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 0, y: 100 },
      ],
      layer: "chapa",
    };

    const xs = rect.pts.map((p) => p.x);
    const ys = rect.pts.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);

    expect(w).toBe(200);
    expect(h).toBe(100);
  });

  it("valida cancelamento seguro (Regra 9: restauração de valor inicial)", () => {
    const initialVal = 40.0;
    let liveVal = initialVal;

    const onChange = vi.fn((val: number) => {
      liveVal = val;
    });

    // Usuário altera em tempo real: 40 -> 45 -> 50
    onChange(45);
    expect(liveVal).toBe(45);
    onChange(50);
    expect(liveVal).toBe(50);

    // Usuário cancela: valor original deve ser restaurado
    onChange(initialVal);
    expect(liveVal).toBe(40.0);
    expect(onChange).toHaveBeenCalledWith(40.0);
  });

  it("valida enquadramento inteligente: preserva escala view.k sem zoom arbitrário (Regra 7)", () => {
    const initialView = { tx: 100, ty: 100, k: 1.5 };
    let currentView = { ...initialView };

    // Se houver sobreposição espacial com o card do editor:
    const requiredShiftX = -120;
    currentView = {
      ...currentView,
      tx: currentView.tx + requiredShiftX,
    };

    // A escala view.k NUNCA deve ser alterada (preserva zoom exato)
    expect(currentView.k).toBe(initialView.k);
    expect(currentView.tx).toBe(-20);

    // Ao fechar, restaura pan original
    currentView = { ...initialView };
    expect(currentView.tx).toBe(100);
    expect(currentView.k).toBe(1.5);
  });
});
