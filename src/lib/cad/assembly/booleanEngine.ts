// @ts-nocheck
/**
 * CALDRA CAD — BOOLEAN CSG ENGINE (FASE 06)
 *
 * Motor de operações booleanas em corpos sólidos canônicos B-Rep:
 * - UNION: Combinação volumétrica de corpos
 * - SUBTRACT / DIFFERENCE: Corte, furações e penetrações
 * - INTERSECT: Volume compartilhado comum
 */

import type { Solid, Face, Edge, Vertex, Vector3D } from "../canonical";
import type { BooleanOpType } from "./types";

export class BooleanEngine {
  /**
   * Executa uma operação booleana entre o sólido alvo (target) e a ferramenta (tool).
   */
  static execute(target: Solid, tool: Solid, op: BooleanOpType): Solid {
    switch (op) {
      case "UNION":
        return this.union(target, tool);
      case "SUBTRACT":
        return this.subtract(target, tool);
      case "INTERSECT":
        return this.intersect(target, tool);
    }
  }

  static union(target: Solid, tool: Solid): Solid {
    const overlap = this.calculateBoundingBoxOverlap(target.boundingBox, tool.boundingBox);

    // Vértices combinados com IDs únicos
    const mergedVertices: Vertex[] = [...target.vertices];
    const toolVertexMap = new Map<string, string>();

    for (const v of tool.vertices) {
      const existing = mergedVertices.find(
        (mv) =>
          Math.hypot(mv.point.x - v.point.x, mv.point.y - v.point.y, mv.point.z - v.point.z) < 1e-4,
      );
      if (existing) {
        toolVertexMap.set(v.id, existing.id);
      } else {
        const newId = `v_u_${v.id}_${Date.now()}`;
        mergedVertices.push({ id: newId, point: { ...v.point } });
        toolVertexMap.set(v.id, newId);
      }
    }

    // Arestas combinadas
    const mergedEdges: Edge[] = [...target.edges];
    for (const e of tool.edges) {
      const sId = toolVertexMap.get(e.startVertexId) ?? e.startVertexId;
      const eId = toolVertexMap.get(e.endVertexId) ?? e.endVertexId;
      const exists = mergedEdges.some(
        (me) =>
          (me.startVertexId === sId && me.endVertexId === eId) ||
          (me.startVertexId === eId && me.endVertexId === sId),
      );
      if (!exists) {
        mergedEdges.push({
          id: `e_u_${e.id}_${Date.now()}`,
          type: e.type,
          startVertexId: sId,
          endVertexId: eId,
        });
      }
    }

    // Faces combinadas
    const mergedFaces: Face[] = [
      ...target.faces,
      ...tool.faces.map((f) => ({ ...f, id: `f_u_${f.id}` })),
    ];

    const combinedVolume = overlap
      ? target.volume + tool.volume - overlap.volume
      : target.volume + tool.volume;

    const minBox: Vector3D = {
      x: Math.min(target.boundingBox.min.x, tool.boundingBox.min.x),
      y: Math.min(target.boundingBox.min.y, tool.boundingBox.min.y),
      z: Math.min(target.boundingBox.min.z, tool.boundingBox.min.z),
    };
    const maxBox: Vector3D = {
      x: Math.max(target.boundingBox.max.x, tool.boundingBox.max.x),
      y: Math.max(target.boundingBox.max.y, tool.boundingBox.max.y),
      z: Math.max(target.boundingBox.max.z, tool.boundingBox.max.z),
    };

    return {
      id: `union_${target.id}_${tool.id}`,
      name: `${target.name} + ${tool.name}`,
      faces: mergedFaces,
      edges: mergedEdges,
      vertices: mergedVertices,
      isClosed: target.isClosed && tool.isClosed,
      volume: combinedVolume,
      boundingBox: { min: minBox, max: maxBox },
    };
  }

  static subtract(target: Solid, tool: Solid): Solid {
    const overlap = this.calculateBoundingBoxOverlap(target.boundingBox, tool.boundingBox);
    if (!overlap) {
      return { ...target, id: `sub_${target.id}_noop` };
    }

    // Subtração de volume
    const newVolume = Math.max(0, target.volume - overlap.volume);

    // Adiciona faces invertidas da ferramenta dentro do alvo para representar a cavidade
    const invertedToolFaces: Face[] = tool.faces.map((f) => ({
      ...f,
      id: `f_cavity_${f.id}`,
      normal: { x: -f.normal.x, y: -f.normal.y, z: -f.normal.z },
    }));

    return {
      id: `subtract_${target.id}_${tool.id}`,
      name: `${target.name} - ${tool.name}`,
      faces: [...target.faces, ...invertedToolFaces],
      edges: [...target.edges, ...tool.edges],
      vertices: [...target.vertices, ...tool.vertices],
      isClosed: target.isClosed,
      volume: newVolume,
      boundingBox: { ...target.boundingBox },
    };
  }

  static intersect(target: Solid, tool: Solid): Solid {
    const overlap = this.calculateBoundingBoxOverlap(target.boundingBox, tool.boundingBox);
    if (!overlap) {
      return {
        id: `empty_intersect_${Date.now()}`,
        name: `Interseção Vazia`,
        faces: [],
        edges: [],
        vertices: [],
        isClosed: true,
        volume: 0,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
      };
    }

    return {
      id: `intersect_${target.id}_${tool.id}`,
      name: `${target.name} ∩ ${tool.name}`,
      faces: [...target.faces, ...tool.faces],
      edges: [...target.edges, ...tool.edges],
      vertices: [...target.vertices, ...tool.vertices],
      isClosed: true,
      volume: overlap.volume,
      boundingBox: { min: overlap.min, max: overlap.max },
    };
  }

  /**
   * Calcula a sobreposição volumétrica entre duas caixas delimitadoras 3D (AABB).
   */
  static calculateBoundingBoxOverlap(
    boxA: { min: Vector3D; max: Vector3D },
    boxB: { min: Vector3D; max: Vector3D },
  ): { min: Vector3D; max: Vector3D; volume: number } | null {
    const minX = Math.max(boxA.min.x, boxB.min.x);
    const maxX = Math.min(boxA.max.x, boxB.max.x);
    const minY = Math.max(boxA.min.y, boxB.min.y);
    const maxY = Math.min(boxA.max.y, boxB.max.y);
    const minZ = Math.max(boxA.min.z, boxB.min.z);
    const maxZ = Math.min(boxA.max.z, boxB.max.z);

    if (maxX <= minX || maxY <= minY || maxZ <= minZ) {
      return null;
    }

    const volume = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      volume,
    };
  }
}
