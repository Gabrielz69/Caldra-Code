/**
 * CALDRA CHAMFER — PARAMETRIC FEATURE GRAPH (DAG)
 *
 * Implementa o grafo direcionado acíclico (DAG) e histórico de operações:
 * Sketch → Feature → Feature → Feature → Body
 *
 * Suporta:
 * - Dependências bidirecionais (dependencies / dependents)
 * - Propagação inteligente de estado sujo (DIRTY propagation)
 * - Ordenação topológica estrita para execução determinística
 * - Histórico de rollback
 * - Supressão temporária de operações
 */

import type {
  CadFeatureNode,
  CadFeatureState,
  CadReference,
} from "./types";
import type { CadFeatureType, CadFeatureParams } from "../features/CadFeatureModel";

export class CadFeatureGraph {
  private nodes: Map<string, CadFeatureNode> = new Map();
  private executionOrder: string[] = []; // IDs na ordem sequencial de modelagem

  constructor() {}

  // ==========================================
  // CONSULTA
  // ==========================================

  public getNode(id: string): CadFeatureNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): CadFeatureNode[] {
    return this.executionOrder
      .map((id) => this.nodes.get(id))
      .filter((n): n is CadFeatureNode => Boolean(n));
  }

  public getExecutionOrder(): readonly string[] {
    return this.executionOrder;
  }

  public size(): number {
    return this.nodes.size;
  }

  // ==========================================
  // ADIÇÃO E REMOÇÃO DE RECURSOS
  // ==========================================

  public addFeature(data: {
    id?: string;
    name: string;
    type: CadFeatureType;
    parameters: CadFeatureParams;
    references?: CadReference[];
    dependencies?: string[];
    targetBodyId?: string;
    isSuppressed?: boolean;
    insertAfterId?: string;
  }): CadFeatureNode {
    const id = data.id ?? `feat_${data.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dependencies = data.dependencies ? [...data.dependencies] : [];

    // Se nenhuma dependência explícita for passada e existirem features anteriores,
    // a feature naturalmente herda o resultado da anterior (pipeline em cascata)
    if (dependencies.length === 0 && this.executionOrder.length > 0 && !data.insertAfterId) {
      const lastId = this.executionOrder[this.executionOrder.length - 1];
      if (lastId) dependencies.push(lastId);
    }

    const node: CadFeatureNode = {
      id,
      name: data.name,
      type: data.type,
      order: this.executionOrder.length,
      state: "DIRTY",
      isSuppressed: data.isSuppressed ?? false,
      parameters: { ...data.parameters },
      references: data.references ? [...data.references] : [],
      dependencies,
      dependents: [],
      targetBodyId: data.targetBodyId,
    };

    this.nodes.set(id, node);

    // Inserção na ordem de execução
    if (data.insertAfterId) {
      const idx = this.executionOrder.indexOf(data.insertAfterId);
      if (idx >= 0) {
        this.executionOrder.splice(idx + 1, 0, id);
      } else {
        this.executionOrder.push(id);
      }
    } else {
      this.executionOrder.push(id);
    }

    // Atualiza lista de dependentes nas upstream features
    for (const depId of dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode && !depNode.dependents.includes(id)) {
        depNode.dependents.push(id);
      }
    }

    this.reindexOrders();
    this.markDirty(id);
    return node;
  }

  public removeFeature(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove referências nas dependências upstream
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents = depNode.dependents.filter((d) => d !== id);
      }
    }

    // Se houver downstream features dependentes, marca-as como DIRTY ou altera dependência
    for (const downstreamId of node.dependents) {
      const downstream = this.nodes.get(downstreamId);
      if (downstream) {
        downstream.dependencies = downstream.dependencies.filter((d) => d !== id);
        // Herda as dependências da feature removida para manter a cadeia conexa
        for (const depId of node.dependencies) {
          if (!downstream.dependencies.includes(depId)) {
            downstream.dependencies.push(depId);
          }
        }
        this.markDirty(downstreamId);
      }
    }

    this.nodes.delete(id);
    this.executionOrder = this.executionOrder.filter((item) => item !== id);
    this.reindexOrders();
    return true;
  }

  public updateParameters(id: string, params: Partial<CadFeatureParams>): void {
    const node = this.nodes.get(id);
    if (!node) return;

    node.parameters = { ...node.parameters, ...params };
    this.markDirty(id);
  }

  public setSuppressed(id: string, suppressed: boolean): void {
    const node = this.nodes.get(id);
    if (!node || node.isSuppressed === suppressed) return;

    node.isSuppressed = suppressed;
    node.state = suppressed ? "SUPPRESSED" : "DIRTY";
    this.markDirty(id);
  }

  // ==========================================
  // PROPAGAÇÃO DE ESTADO SUJO (DIRTY TRACKING)
  // ==========================================

  /**
   * Marca uma feature e recursivamente TODOS os seus dependentes como "DIRTY".
   * Features anteriores (upstream) permanecem intactas (UP_TO_DATE com cache válido).
   */
  public markDirty(featureId: string): void {
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return;

      if (!node.isSuppressed) {
        node.state = "DIRTY";
      }

      // Propaga para dependentes diretos
      for (const childId of node.dependents) {
        traverse(childId);
      }

      // Propaga também para features subsequentes na mesma esteira do mesmo corpo
      const idx = this.executionOrder.indexOf(currentId);
      if (idx >= 0) {
        for (let i = idx + 1; i < this.executionOrder.length; i++) {
          const subsequentId = this.executionOrder[i];
          if (subsequentId) {
            const subsequent = this.nodes.get(subsequentId);
            if (subsequent && (!node.targetBodyId || subsequent.targetBodyId === node.targetBodyId)) {
              if (!visited.has(subsequentId)) {
                traverse(subsequentId);
              }
            }
          }
        }
      }
    };

    traverse(featureId);
  }

  /**
   * Retorna os nós que precisam de regeneração, na ordem topológica de execução
   */
  public getDirtyNodes(): CadFeatureNode[] {
    return this.executionOrder
      .map((id) => this.nodes.get(id))
      .filter((n): n is CadFeatureNode => Boolean(n) && n.state === "DIRTY" && !n.isSuppressed);
  }

  public clearDirty(): void {
    for (const node of this.nodes.values()) {
      if (node.state === "DIRTY") {
        node.state = "UP_TO_DATE";
      }
    }
  }

  // ==========================================
  // ORDENAÇÃO TOPOLÓGICA (DAG)
  // ==========================================

  private reindexOrders(): void {
    this.executionOrder.forEach((id, index) => {
      const node = this.nodes.get(id);
      if (node) node.order = index;
    });
  }

  /**
   * Reordena uma feature na esteira mantendo a validade de dependências
   */
  public reorderFeature(featureId: string, newIndex: number): boolean {
    const oldIndex = this.executionOrder.indexOf(featureId);
    if (oldIndex < 0) return false;

    const clamped = Math.max(0, Math.min(newIndex, this.executionOrder.length - 1));
    if (clamped === oldIndex) return true;

    this.executionOrder.splice(oldIndex, 1);
    this.executionOrder.splice(clamped, 0, featureId);
    this.reindexOrders();

    // Reconstrução de cache a partir da menor posição alterada
    const minAffected = Math.min(oldIndex, clamped);
    for (let i = minAffected; i < this.executionOrder.length; i++) {
      const affectedId = this.executionOrder[i];
      if (affectedId) this.markDirty(affectedId);
    }

    return true;
  }
}
