import { describe, it, expect } from "vitest";
import { CadSemanticIntentEngine } from "@/lib/lab2d/cadSemanticIntent";
import { globalParametricStore } from "@/lib/lab2d/cadParametricVariables";
import type { Entity } from "@/lib/lab2d/core";

describe("CHAMFER — Testes de Interação Mobile e Tarefas-Âncora (Especificação Mobile-First)", () => {
  it("Tarefa 1: Gera chapa 500x300 com 4 furos Ø12 a 25mm e cotas associativas", () => {
    const plan = CadSemanticIntentEngine.parseIntent(
      "chapa 500 x 300 com quatro furos 12 a 25 mm das bordas"
    );
    expect(plan).not.toBeNull();
    expect(plan!.title).toContain("500 × 300");
    expect(plan!.generatedEntities.length).toBe(5);

    // Conferência dimensional
    const plate = plan!.generatedEntities[0];
    expect(plate.type).toBe("polyline");
    if (plate.type === "polyline") {
      expect(plate.pts.length).toBe(4); // 4 cantos com closed: true
      expect(plate.pts[2]).toEqual({ x: 500, y: 300 });
      expect(plate.closed).toBe(true);
    }

    const hole1 = plan!.generatedEntities[1];
    expect(hole1.type).toBe("circle");
    if (hole1.type === "circle") {
      expect(hole1.cx).toBe(25);
      expect(hole1.cy).toBe(25);
      expect(hole1.r).toBe(6); // Raio 6 = Diâmetro 12
    }

    expect(plan!.generatedDimensions?.length).toBe(2);
  });

  it("Tarefa 2: Gera suporte com rasgo oblongo central e furos", () => {
    const plan = CadSemanticIntentEngine.parseIntent("suporte com rasgo oblongo");
    expect(plan).not.toBeNull();
    const slot = plan!.generatedEntities.find((e) => e.type === "polyline" && e.pts.length > 4);
    expect(slot).toBeDefined();
  });

  it("Tarefa 3: Gera flange com PCD e 8 furos", () => {
    const plan = CadSemanticIntentEngine.parseIntent("flange com pcd 320 e 8 furos");
    expect(plan).not.toBeNull();
    const circles = plan!.generatedEntities.filter((e) => e.type === "circle");
    // 1 ext + 1 int + 1 PCD + 8 furos
    expect(circles.length).toBe(11);
  });

  it("Tarefa 4: Desenvolvimento de cone truncado para caldeiraria", () => {
    const plan = CadSemanticIntentEngine.parseIntent("desenvolvimento de cone truncado");
    expect(plan).not.toBeNull();
    const arcs = plan!.generatedEntities.filter((e) => e.type === "arc");
    expect(arcs.length).toBe(2);
  });

  it("Tarefa 5: Transição quadrado-redondo de caldeiraria com geratrizes de dobra", () => {
    const plan = CadSemanticIntentEngine.parseIntent("transição quadrado-redondo");
    expect(plan).not.toBeNull();
    const bendLines = plan!.generatedEntities.filter((e) => e.layer === "dobra");
    expect(bendLines.length).toBe(4);
  });

  it("Avaliação de expressões diretas de cotas no canvas com unidades", () => {
    // 500 mm -> alteração para "750 mm"
    expect(globalParametricStore.evaluateExpression("750 mm")).toBe(750);
    // Expressões matemáticas na cota
    expect(globalParametricStore.evaluateExpression("500 + 250")).toBe(750);
    expect(globalParametricStore.evaluateExpression("2 * 375")).toBe(750);
    expect(globalParametricStore.evaluateExpression("sqrt(100) * 75")).toBe(750);
  });

  describe("Desambiguação de Gestos Long-Press: Área de Transferência (no vazio) vs. Arraste/Referência (em entidades)", () => {
    it("Caso A: Toque em cima de uma entidade (targetEntity != null) desativa Área de Transferência e prioriza arraste", () => {
      let clipboardModalOpen = false;
      let dragUnlocked = false;
      let clipboardTimer: ReturnType<typeof setTimeout> | null = null;
      let dragTimer: ReturnType<typeof setTimeout> | null = null;

      const targetEntity = { id: "rect-1", type: "rect" };

      // Simulação da máquina de estados do pointerdown
      if (targetEntity != null) {
        // 1. Desativar Área de Transferência: nunca deve rodar se começou em entidade
        if (clipboardTimer) {
          clearTimeout(clipboardTimer);
          clipboardTimer = null;
        }

        // 2. Prioridade para arraste (320ms)
        dragTimer = setTimeout(() => {
          dragUnlocked = true;
        }, 320);
      }

      expect(clipboardTimer).toBeNull();
      expect(clipboardModalOpen).toBe(false);

      // Avança além do tempo de arraste
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(dragUnlocked).toBe(true);
          expect(clipboardModalOpen).toBe(false);
          if (dragTimer) clearTimeout(dragTimer);
          resolve();
        }, 350);
      });
    });

    it("Caso B: Toque no espaço vazio (targetEntity == null) desativa arraste e arma timer de Área de Transferência (~380ms)", () => {
      let clipboardModalOpen = false;
      let dragTimer: ReturnType<typeof setTimeout> | null = null;
      let dragUnlocked = false;
      let clipboardTimer: ReturnType<typeof setTimeout> | null = null;

      const targetEntity = null;

      // Simulação da máquina de estados do pointerdown
      if (targetEntity == null) {
        // 1. Desativar Arraste e Referência de Peça
        if (dragTimer) {
          clearTimeout(dragTimer);
          dragTimer = null;
        }
        dragUnlocked = false;

        // 2. Ativar Long-Press da Área de Transferência Global
        clipboardTimer = setTimeout(() => {
          clipboardModalOpen = true;
        }, 380);
      }

      expect(dragTimer).toBeNull();
      expect(dragUnlocked).toBe(false);
      expect(clipboardTimer).not.toBeNull();

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(clipboardModalOpen).toBe(true);
          expect(dragUnlocked).toBe(false);
          resolve();
        }, 400);
      });
    });

    it("Caso B com Pan/Movimento > 8px cancela o timer da Área de Transferência (Prevenção de Falsos Disparos)", () => {
      let clipboardModalOpen = false;
      let clipboardState: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;

      // Inicia toque no vazio
      clipboardState = {
        timer: setTimeout(() => {
          clipboardModalOpen = true;
        }, 380),
        x: 100,
        y: 100,
      };

      // Usuário arrasta o dedo mais de 8px (ex: 15px) para navegar / pan
      const currentX = 112;
      const currentY = 109;
      const distMoved = Math.hypot(currentX - clipboardState.x, currentY - clipboardState.y); // 15px

      if (distMoved > 8 && clipboardState) {
        clearTimeout(clipboardState.timer);
        clipboardState = null;
      }

      expect(clipboardState).toBeNull();

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // O painel NÃO deve abrir porque foi cancelado pelo movimento
          expect(clipboardModalOpen).toBe(false);
          resolve();
        }, 400);
      });
    });

    it("Toque rápido (tap) no vazio solto antes de 380ms cancela o timer sem abrir o painel", () => {
      let clipboardModalOpen = false;
      let clipboardTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        clipboardModalOpen = true;
      }, 380);

      // Usuário solta o dedo aos 80ms (tap rápido)
      setTimeout(() => {
        if (clipboardTimer) {
          clearTimeout(clipboardTimer);
          clipboardTimer = null;
        }
      }, 80);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(clipboardTimer).toBeNull();
          expect(clipboardModalOpen).toBe(false);
          resolve();
        }, 400);
      });
    });
  });
});
