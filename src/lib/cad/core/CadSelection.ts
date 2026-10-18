/**
 * CALDRA CAD CORE — TOPOLOGICAL SELECTION & INSPECTION TYPES (FASE 04)
 *
 * Estruturas para seleção determinística de entidades CAD 3D:
 * Solid, Face, Edge, Vertex.
 * IDs e fingerprints estáveis desacoplados de índices voláteis de triangulação.
 */

import type { CadVector3D } from "./CadTopology";

export type CadSelectionType = "solid" | "face" | "edge" | "vertex";

export interface CadSelectedEntity {
  id: string;
  type: CadSelectionType;
  index: number;
  handle?: number;
  fingerprint?: string;

  // Propriedades geométricas de metrologia
  area?: number; // mm² (se Face)
  length?: number; // mm (se Aresta)
  surfaceType?: string; // plane, cylinder, cone, etc.
  curveType?: string; // line, circle, etc.
  point?: CadVector3D; // Ponto de contato ou vértice XYZ
  centerOfMass?: CadVector3D; // Centro geométrico da entidade
  normal?: CadVector3D; // Normal na face
  adjacentFaceIndices?: number[];
  connectedEdgeIndices?: number[];

  metadata?: Record<string, unknown>;
}

export interface CadMeasurementResult {
  distance: number; // mm (distância euclidiana mínima analítica calculada pelo kernel)
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  entityA: CadSelectedEntity;
  entityB: CadSelectedEntity;
  type: "face-face" | "edge-edge" | "vertex-vertex" | "vertex-face" | "edge-face" | "generic";
}

export interface CadSelectionState {
  type: CadSelectionType | null;
  selectedEntity: CadSelectedEntity | null;
  multiSelection: CadSelectedEntity[];
  measurement: CadMeasurementResult | null;
}

export const INITIAL_CAD_SELECTION: CadSelectionState = {
  type: null,
  selectedEntity: null,
  multiSelection: [],
  measurement: null,
};

export class CadSelectionManager {
  private selected: CadSelectedEntity[] = [];
  private hovered: CadSelectedEntity | null = null;
  private activeFilters: CadSelectionType[] = [];

  public select(
    entity: Partial<CadSelectedEntity> & { id: string; type?: CadSelectionType; shapeId?: string; elementIndex?: number },
    multi = false,
  ): void {
    const fullEntity: CadSelectedEntity = {
      id: entity.id,
      type: entity.type || "face",
      index: entity.elementIndex ?? entity.index ?? 0,
      ...entity,
    };

    if (this.activeFilters.length > 0 && !this.activeFilters.includes(fullEntity.type)) {
      return;
    }

    if (!multi) {
      this.selected = [fullEntity];
    } else {
      const idx = this.selected.findIndex((s) => s.id === entity.id);
      if (idx === -1) {
        this.selected.push(fullEntity);
      }
    }
  }

  public toggle(
    entity: Partial<CadSelectedEntity> & { id: string; type?: CadSelectionType; shapeId?: string },
  ): void {
    const idx = this.selected.findIndex((s) => s.id === entity.id);
    if (idx !== -1) {
      this.selected.splice(idx, 1);
    } else {
      this.select(entity, true);
    }
  }

  public isSelected(id: string): boolean {
    return this.selected.some((s) => s.id === id);
  }

  public setFilter(types: CadSelectionType[]): void {
    this.activeFilters = types;
    if (types.length > 0) {
      this.selected = this.selected.filter((s) => types.includes(s.type));
    }
  }

  public setHovered(entity: CadSelectedEntity | null): void {
    this.hovered = entity;
  }

  public clear(): void {
    this.selected = [];
    this.hovered = null;
  }

  public getState(): { selected: CadSelectedEntity[]; hovered: CadSelectedEntity | null } {
    return {
      selected: [...this.selected],
      hovered: this.hovered,
    };
  }
}

