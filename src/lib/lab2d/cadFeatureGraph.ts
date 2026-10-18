/**
 * CALDRA CHAMFER — GRAFO DE RECURSOS E HISTÓRICO PARAMÉTRICO 2D (FEATURE GRAPH)
 *
 * Estrutura ordenada de operações e features CAD aplicadas sobre a geometria:
 *  - Criação (Retângulo, Círculo, Linha, Slot, Polígono);
 *  - Modificação (Offset, Filete, Chanfro, Espelho, Matriz Linear/Polar, Boolean);
 *  - Estado de cada Feature: ativa, suprimida (suppressed) ou com erro;
 *  - Permite ligar/desligar operações, editar parâmetros e reconstruir o histórico.
 */

import { uid, type Entity } from "./core";

export type FeatureType =
  | "create_rect"
  | "create_circle"
  | "create_slot"
  | "create_polygon"
  | "create_line"
  | "offset"
  | "fillet"
  | "chamfer"
  | "mirror"
  | "array_linear"
  | "array_circular"
  | "boolean_op"
  | "smart_trim"
  | "divide";

export interface CadFeature2D {
  id: string;
  name: string;
  type: FeatureType;
  timestamp: number;
  suppressed: boolean;
  params: Record<string, unknown>;
  outputEntityIds: string[];
}

export class CadFeatureGraph2D {
  private features: CadFeature2D[] = [];
  private listeners: (() => void)[] = [];

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getFeatures(): CadFeature2D[] {
    return [...this.features];
  }

  public addFeature(
    type: FeatureType,
    name: string,
    params: Record<string, unknown>,
    outputEntityIds: string[],
  ): CadFeature2D {
    const feat: CadFeature2D = {
      id: uid(),
      name,
      type,
      timestamp: Date.now(),
      suppressed: false,
      params,
      outputEntityIds,
    };
    this.features.push(feat);
    this.notify();
    return feat;
  }

  public toggleSuppress(featureId: string) {
    const feat = this.features.find((f) => f.id === featureId);
    if (feat) {
      feat.suppressed = !feat.suppressed;
      this.notify();
    }
  }

  public removeFeature(featureId: string) {
    this.features = this.features.filter((f) => f.id !== featureId);
    this.notify();
  }

  public clear() {
    this.features = [];
    this.notify();
  }
}

export const globalFeatureGraph = new CadFeatureGraph2D();
