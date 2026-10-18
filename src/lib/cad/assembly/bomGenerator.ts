// @ts-nocheck
/**
 * CALDRA CAD — HIERARCHICAL BOM & WELDMENT GENERATOR (FASE 06)
 *
 * Gerador automático de Lista Técnica de Materiais (BOM - Bill of Materials),
 * cálculo analítico de Centro de Gravidade (CG) e estimativa de juntas soldadas.
 */

import type { Vector3D } from "../canonical";
import type { ComponentInstance, BOMItem, AssemblyReport, WeldJoint } from "./types";
import { InterferenceEngine } from "./interferenceEngine";

export class BOMGenerator {
  /**
   * Gera o relatório consolidado de montagem mecânica, incluindo BOM e centro de gravidade.
   */
  static generateReport(
    assemblyName: string,
    components: ComponentInstance[],
    matesCount = 0,
    dofRemaining = 0,
    weldJoints: WeldJoint[] = [],
  ): AssemblyReport {
    const bomMap = new Map<string, BOMItem>();

    let totalMassKg = 0;
    let sumMX = 0;
    let sumMY = 0;
    let sumMZ = 0;

    components.forEach((comp) => {
      const box = comp.solid.boundingBox;
      const dimX = Math.round(box.max.x - box.min.x);
      const dimY = Math.round(box.max.y - box.min.y);
      const dimZ = Math.round(box.max.z - box.min.z);
      const dims = `${dimX} × ${dimY} × ${dimZ} mm`;

      const compMass =
        comp.massKg > 0 ? comp.massKg : Math.max(0.1, (comp.solid.volume * comp.density) / 1e6);
      totalMassKg += compMass;

      // Posição central do componente no espaço global
      const cx = (box.min.x + box.max.x) * 0.5 + comp.position.x;
      const cy = (box.min.y + box.max.y) * 0.5 + comp.position.y;
      const cz = (box.min.z + box.max.z) * 0.5 + comp.position.z;

      sumMX += compMass * cx;
      sumMY += compMass * cy;
      sumMZ += compMass * cz;

      const existing = bomMap.get(comp.partCode);
      if (existing) {
        existing.quantity += 1;
        existing.totalMassKg = Number((existing.unitMassKg * existing.quantity).toFixed(3));
      } else {
        bomMap.set(comp.partCode, {
          itemNumber: bomMap.size + 1,
          partCode: comp.partCode,
          name: comp.name,
          quantity: 1,
          material: comp.material,
          dimensionsEnvelope: dims,
          unitMassKg: Number(compMass.toFixed(3)),
          totalMassKg: Number(compMass.toFixed(3)),
        });
      }
    });

    const centerOfMass: Vector3D =
      totalMassKg > 0
        ? {
            x: Number((sumMX / totalMassKg).toFixed(2)),
            y: Number((sumMY / totalMassKg).toFixed(2)),
            z: Number((sumMZ / totalMassKg).toFixed(2)),
          }
        : { x: 0, y: 0, z: 0 };

    const interferences = InterferenceEngine.checkInterferences(components);

    return {
      assemblyName,
      totalComponents: components.length,
      uniquePartsCount: bomMap.size,
      totalMassKg: Number(totalMassKg.toFixed(3)),
      centerOfMass,
      matesCount,
      dofRemaining,
      interferences,
      bom: Array.from(bomMap.values()),
      weldJoints,
    };
  }
}
