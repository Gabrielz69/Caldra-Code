// @ts-nocheck
/**
 * CALDRA CAD — INTERFERENCE & COLLISION ENGINE (FASE 06)
 *
 * Analisador tridimensional de colisões e interferências entre componentes de uma montagem.
 * Detecta penetrações volumétricas indesejadas vs contatos tangenciais nominais (zero clearance).
 */

import type { Vector3D } from "../canonical";
import type { ComponentInstance, InterferenceIssue } from "./types";

export class InterferenceEngine {
  /**
   * Executa a varredura de interferência entre todos os pares de componentes da montagem.
   */
  static checkInterferences(components: ComponentInstance[]): InterferenceIssue[] {
    const issues: InterferenceIssue[] = [];

    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const compA = components[i];
        const compB = components[j];

        // Caixas delimitadoras globais (world AABB)
        const boxA = this.getWorldBoundingBox(compA);
        const boxB = this.getWorldBoundingBox(compB);

        const overlap = this.calculateOverlap(boxA, boxB);
        if (overlap) {
          const penetrationDepth = Math.min(
            overlap.max.x - overlap.min.x,
            overlap.max.y - overlap.min.y,
            overlap.max.z - overlap.min.z,
          );

          // Classifica como interferência crítica se a profundidade for superior à tolerância de contato (0.05 mm)
          const isCritical = penetrationDepth > 0.05;

          issues.push({
            id: `int_${compA.id}_${compB.id}`,
            componentAId: compA.id,
            componentAName: compA.name,
            componentBId: compB.id,
            componentBName: compB.name,
            overlapVolumeMm3: overlap.volume,
            penetrationDepthMm: penetrationDepth,
            isCritical,
            overlapBox: {
              min: overlap.min,
              max: overlap.max,
            },
          });
        }
      }
    }

    return issues;
  }

  private static getWorldBoundingBox(comp: ComponentInstance): { min: Vector3D; max: Vector3D } {
    const local = comp.solid.boundingBox;
    return {
      min: {
        x: local.min.x + comp.position.x,
        y: local.min.y + comp.position.y,
        z: local.min.z + comp.position.z,
      },
      max: {
        x: local.max.x + comp.position.x,
        y: local.max.y + comp.position.y,
        z: local.max.z + comp.position.z,
      },
    };
  }

  private static calculateOverlap(
    boxA: { min: Vector3D; max: Vector3D },
    boxB: { min: Vector3D; max: Vector3D },
  ): { min: Vector3D; max: Vector3D; volume: number } | null {
    const minX = Math.max(boxA.min.x, boxB.min.x);
    const maxX = Math.min(boxA.max.x, boxB.max.x);
    const minY = Math.max(boxA.min.y, boxB.min.y);
    const maxY = Math.min(boxA.max.y, boxB.max.y);
    const minZ = Math.max(boxA.min.z, boxB.min.z);
    const maxZ = Math.min(boxA.max.z, boxB.max.z);

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;

    if (dx <= 0 || dy <= 0 || dz <= 0) {
      return null;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      volume: dx * dy * dz,
    };
  }
}
