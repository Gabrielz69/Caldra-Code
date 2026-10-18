/**
 * CALDRA CAD CORE — TOPOLOGICAL NAMING & FINGERPRINTING (FASE 04)
 *
 * Solução arquitetural para o "Topological Naming Problem".
 * O OpenCascade regenera ou reordena handles e índices após operações booleanas.
 * Este módulo atribui assinaturas invariantes a faces, arestas e vértices
 * com base na geometria analítica intrínseca, viabilizando persistência
 * determinística de referências em árvores paramétricas (FeatureTree).
 */

import type { CadVector3D } from "./CadTopology";

export interface FaceFingerprintData {
  surfaceType: string;
  normal: CadVector3D;
  centerOfMass: CadVector3D;
  area: number;
}

export interface EdgeFingerprintData {
  curveType: string;
  length: number;
  midpoint: CadVector3D;
  direction?: CadVector3D;
}

export interface VertexFingerprintData {
  point: CadVector3D;
}

export class CadTopologicalNaming {
  /**
   * Gera uma chave determinística para uma face CAD.
   * Tolerância geométrica arredondada para evitar oscilações numéricas de ponto flutuante.
   */
  static computeFaceFingerprint(data: FaceFingerprintData): string {
    const nx = Math.abs(data.normal.x) < 1e-4 ? 0 : data.normal.x.toFixed(2);
    const ny = Math.abs(data.normal.y) < 1e-4 ? 0 : data.normal.y.toFixed(2);
    const nz = Math.abs(data.normal.z) < 1e-4 ? 0 : data.normal.z.toFixed(2);

    const cx = data.centerOfMass.x.toFixed(1);
    const cy = data.centerOfMass.y.toFixed(1);
    const cz = data.centerOfMass.z.toFixed(1);

    const areaNorm = Math.round(data.area);

    return `face_${data.surfaceType}_n[${nx},${ny},${nz}]_c[${cx},${cy},${cz}]_a${areaNorm}`;
  }

  /**
   * Gera uma chave determinística para uma aresta CAD.
   */
  static computeEdgeFingerprint(data: EdgeFingerprintData): string {
    const len = data.length.toFixed(1);
    const mx = data.midpoint.x.toFixed(1);
    const my = data.midpoint.y.toFixed(1);
    const mz = data.midpoint.z.toFixed(1);

    let dirStr = "";
    if (data.direction) {
      const dx = Math.abs(data.direction.x) < 1e-3 ? 0 : Math.abs(data.direction.x).toFixed(2);
      const dy = Math.abs(data.direction.y) < 1e-3 ? 0 : Math.abs(data.direction.y).toFixed(2);
      const dz = Math.abs(data.direction.z) < 1e-3 ? 0 : Math.abs(data.direction.z).toFixed(2);
      dirStr = `_d[${dx},${dy},${dz}]`;
    }

    return `edge_${data.curveType}_l${len}_m[${mx},${my},${mz}]${dirStr}`;
  }

  /**
   * Gera uma chave determinística para um vértice CAD.
   */
  static computeVertexFingerprint(data: VertexFingerprintData): string {
    const px = data.point.x.toFixed(2);
    const py = data.point.y.toFixed(2);
    const pz = data.point.z.toFixed(2);
    return `vertex_p[${px},${py},${pz}]`;
  }

  /**
   * Calcula a distância euclidiana analítica entre dois pontos tridimensionais.
   */
  static pointDistance(p1: CadVector3D, p2: CadVector3D): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
  }

  /**
   * Classifica a orientação espacial de um vetor normal em planos canônicos.
   */
  static classifyNormal(normal: CadVector3D): "TOP" | "BOTTOM" | "FRONT" | "BACK" | "LEFT" | "RIGHT" | "INCLINED" {
    const eps = 0.05;
    if (Math.abs(normal.z - 1) < eps) return "FRONT";
    if (Math.abs(normal.z + 1) < eps) return "BACK";
    if (Math.abs(normal.y - 1) < eps) return "TOP";
    if (Math.abs(normal.y + 1) < eps) return "BOTTOM";
    if (Math.abs(normal.x - 1) < eps) return "RIGHT";
    if (Math.abs(normal.x + 1) < eps) return "LEFT";
    return "INCLINED";
  }
}
