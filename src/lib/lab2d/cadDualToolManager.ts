/**
 * CALDRA CHAMFER — GERENCIADOR DE FERRAMENTAS COMPOSTAS (DUAL TOOL MANAGER)
 *
 * Permite a execução simultânea e harmoniosa de uma Ferramenta Primária + Ferramenta Secundária:
 *  - LINE + DIMENSION: enquanto traça a linha, a cota acompanha e pode ter valor digitado imediatamente;
 *  - OFFSET + TRIM: gera o contorno paralelo e apara automaticamente no encontro;
 *  - MOVE + ALIGN: ao arrastar, calcula e sugere alinhamentos instantâneos com outras geometrias;
 *  - MOVE + MEASURE: exibe distâncias dinâmicas até as referências mais próximas;
 *  - COPY + ROTATE: duplica a entidade e já entra no modo de rotação com centro no ponto base;
 *  - FILLET + TRIM: arredonda cantos e remove as pontas excedentes num único gesto;
 *  - MIRROR + COPY: espelha preservando o original;
 *  - ARRAY + ALIGN: multiplica formas com alinhamento contínuo.
 *
 * Mantém Contexto Compartilhado, Snap Compartilhado e Preview Compartilhado sem conflito de eventos.
 */

import type { Tool } from "@/components/lab2d/Lab2DEditor";

export interface DualToolPreset {
  id: string;
  name: string;
  primary: Tool;
  secondary: Tool;
  description: string;
  icon?: string;
}

export const DUAL_TOOL_PRESETS: DualToolPreset[] = [
  {
    id: "line_dim",
    name: "Linha + Cotagem",
    primary: "line",
    secondary: "dim",
    description: "Desenha a linha com cota técnica associada em tempo real.",
  },
  {
    id: "offset_trim",
    name: "Offset + Aparar",
    primary: "offset",
    secondary: "smart_trim",
    description: "Gera contorno paralelo e apara automaticamente nos limites de corte.",
  },
  {
    id: "move_align",
    name: "Mover + Centralizar",
    primary: "select",
    secondary: "center",
    description: "Move com guias magnéticas de alinhamento e centralização automáticas.",
  },
  {
    id: "fillet_trim",
    name: "Filete + Trim",
    primary: "fillet",
    secondary: "trim",
    description: "Arredonda cantos aparando as sobras dos segmentos primitivos.",
  },
  {
    id: "arc_tangent",
    name: "Arco + Tangência",
    primary: "arc",
    secondary: "fillet",
    description: "Gera arco mantendo continuidade tangencial suave com a geometria adjacente.",
  },
];

export interface DualToolState {
  isActive: boolean;
  primaryTool: Tool;
  secondaryTool: Tool | null;
  pinnedSecondary: boolean;
  sharedData: Record<string, unknown>;
}

export class DualToolManager {
  private state: DualToolState = {
    isActive: false,
    primaryTool: "select",
    secondaryTool: null,
    pinnedSecondary: false,
    sharedData: {},
  };

  private listeners: ((state: DualToolState) => void)[] = [];

  constructor(initialPrimary: Tool = "select") {
    this.state.primaryTool = initialPrimary;
  }

  public getState(): DualToolState {
    return { ...this.state };
  }

  public subscribe(cb: (state: DualToolState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.getState()));
  }

  public setPrimary(tool: Tool) {
    this.state.primaryTool = tool;
    this.notify();
  }

  public setSecondary(tool: Tool | null) {
    this.state.secondaryTool = tool;
    this.state.isActive = tool !== null;
    this.notify();
  }

  public togglePinnedSecondary() {
    this.state.pinnedSecondary = !this.state.pinnedSecondary;
    this.notify();
  }

  public swapTools() {
    if (!this.state.secondaryTool) return;
    const temp = this.state.primaryTool;
    this.state.primaryTool = this.state.secondaryTool;
    this.state.secondaryTool = temp;
    this.notify();
  }

  public applyPreset(presetId: string): boolean {
    const preset = DUAL_TOOL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return false;
    this.state.primaryTool = preset.primary;
    this.state.secondaryTool = preset.secondary;
    this.state.isActive = true;
    this.notify();
    return true;
  }

  public clearSecondary() {
    this.state.secondaryTool = null;
    this.state.isActive = false;
    this.state.pinnedSecondary = false;
    this.state.sharedData = {};
    this.notify();
  }

  public setSharedData(key: string, value: unknown) {
    this.state.sharedData[key] = value;
    this.notify();
  }

  public getSharedData<T = unknown>(key: string): T | undefined {
    return this.state.sharedData[key] as T | undefined;
  }
}
