/**
 * CALDRA CHAMFER — SISTEMA DE REFERÊNCIAS TOPOLÓGICAS E GEOMÉTRICAS
 *
 * Viabiliza referências estáveis e persistentes a:
 * - face
 * - aresta
 * - vértice
 * - eixo
 * - plano
 * - sketch
 * - corpo
 *
 * Utiliza o fingerprinting de CadTopologicalNaming para resolver entidades
 * mesmo após transformações, reordenação de índices ou operações booleanas.
 */

import type {
  CadVector3D,
  CadFace,
  CadEdge,
  CadVertex,
} from "../core/CadTopology";
import type { CadShape } from "../core/CadShape";
import { CadTopologicalNaming } from "../core/CadTopologicalNaming";
import type {
  CadReference,
  CadReferenceKind,
  CadDatumPlaneType,
  CadDatumAxisType,
} from "./types";

export class CadReferenceManager {
  /**
   * Cria uma referência canônica para uma Face do B-Rep
   */
  public static createFaceReference(
    targetId: string,
    face: CadFace,
    customId?: string,
  ): CadReference {
    const fingerprint =
      face.fingerprint ??
      CadTopologicalNaming.computeFaceFingerprint({
        surfaceType: face.surfaceType,
        normal: face.normal,
        centerOfMass: face.centerOfMass,
        area: face.area,
      });

    return {
      id: customId ?? `ref_face_${Math.random().toString(36).substring(2, 8)}`,
      kind: "face",
      targetId,
      fingerprint,
      selector: {
        normal: { ...face.normal },
        center: { ...face.centerOfMass },
        area: face.area,
        surfaceType: face.surfaceType,
        index: face.index,
      },
    };
  }

  /**
   * Cria uma referência canônica para uma Aresta do B-Rep
   */
  public static createEdgeReference(
    targetId: string,
    edge: CadEdge,
    midpoint?: CadVector3D,
    customId?: string,
  ): CadReference {
    const mid = midpoint ?? { x: 0, y: 0, z: 0 };
    const fingerprint =
      edge.fingerprint ??
      CadTopologicalNaming.computeEdgeFingerprint({
        curveType: edge.curveType,
        length: edge.length,
        midpoint: mid,
      });

    return {
      id: customId ?? `ref_edge_${Math.random().toString(36).substring(2, 8)}`,
      kind: "edge",
      targetId,
      fingerprint,
      selector: {
        curveType: edge.curveType,
        length: edge.length,
        center: mid,
        index: edge.index,
      },
    };
  }

  /**
   * Cria uma referência canônica para um Vértice do B-Rep
   */
  public static createVertexReference(
    targetId: string,
    vertex: CadVertex,
    customId?: string,
  ): CadReference {
    const fingerprint =
      vertex.fingerprint ??
      CadTopologicalNaming.computeVertexFingerprint({
        point: vertex.point,
      });

    return {
      id: customId ?? `ref_vertex_${Math.random().toString(36).substring(2, 8)}`,
      kind: "vertex",
      targetId,
      fingerprint,
      selector: {
        point: { ...vertex.point },
        index: vertex.index,
      },
    };
  }

  /**
   * Cria uma referência canônica para um Plano Datum ou de Referência
   */
  public static createPlaneReference(
    planeType: CadDatumPlaneType,
    options?: {
      targetId?: string;
      origin?: CadVector3D;
      normal?: CadVector3D;
      offset?: number;
      customId?: string;
    },
  ): CadReference {
    let origin: CadVector3D = { x: 0, y: 0, z: 0 };
    let normal: CadVector3D = { x: 0, y: 0, z: 1 };

    if (planeType === "DATUM_XY") {
      normal = { x: 0, y: 0, z: 1 };
    } else if (planeType === "DATUM_XZ") {
      normal = { x: 0, y: 1, z: 0 };
    } else if (planeType === "DATUM_YZ") {
      normal = { x: 1, y: 0, z: 0 };
    } else if (options?.normal) {
      normal = { ...options.normal };
    }

    if (options?.origin) origin = { ...options.origin };

    return {
      id: options?.customId ?? `ref_plane_${planeType.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`,
      kind: "plane",
      targetId: options?.targetId ?? "root_datum",
      selector: {
        planeType,
        center: origin,
        normal,
        offset: options?.offset ?? 0,
      },
    };
  }

  /**
   * Cria uma referência canônica para um Eixo Datum
   */
  public static createAxisReference(
    axisType: CadDatumAxisType,
    options?: {
      targetId?: string;
      origin?: CadVector3D;
      direction?: CadVector3D;
      customId?: string;
    },
  ): CadReference {
    let origin: CadVector3D = { x: 0, y: 0, z: 0 };
    let direction: CadVector3D = { x: 1, y: 0, z: 0 };

    if (axisType === "DATUM_X") {
      direction = { x: 1, y: 0, z: 0 };
    } else if (axisType === "DATUM_Y") {
      direction = { x: 0, y: 1, z: 0 };
    } else if (axisType === "DATUM_Z") {
      direction = { x: 0, y: 0, z: 1 };
    } else if (options?.direction) {
      direction = { ...options.direction };
    }

    if (options?.origin) origin = { ...options.origin };

    return {
      id: options?.customId ?? `ref_axis_${axisType.toLowerCase()}_${Math.random().toString(36).substring(2, 6)}`,
      kind: "axis",
      targetId: options?.targetId ?? "root_datum",
      selector: {
        axisType,
        center: origin,
        normal: direction,
      },
    };
  }

  /**
   * Cria uma referência para um Sketch ou Corpo
   */
  public static createEntityReference(
    kind: "sketch" | "body" | "feature",
    targetId: string,
    customId?: string,
  ): CadReference {
    return {
      id: customId ?? `ref_${kind}_${targetId}`,
      kind,
      targetId,
    };
  }

  // ==========================================
  // RESOLUÇÃO DE REFERÊNCIAS SOBRE B-REP
  // ==========================================

  /**
   * Resolve uma referência de Face contra um sólido B-Rep canônico
   */
  public static resolveFace(shape: CadShape, ref: CadReference): CadFace | null {
    if (ref.kind !== "face" || !shape.faces || shape.faces.length === 0) {
      return null;
    }

    // 1. Tentar casamento exato por fingerprint invariante
    if (ref.fingerprint) {
      const match = shape.faces.find((f) => f.fingerprint === ref.fingerprint);
      if (match) return match;
    }

    // 2. Tentar por proximidade geométrica (Normal + Centro de Massa + Área)
    if (ref.selector) {
      const targetNormal = ref.selector.normal;
      const targetCenter = ref.selector.center;
      const targetArea = ref.selector.area;
      const targetType = ref.selector.surfaceType;

      let bestFace: CadFace | null = null;
      let minScore = Infinity;

      for (const face of shape.faces) {
        if (targetType && face.surfaceType !== targetType) continue;

        let score = 0;
        if (targetNormal && face.normal) {
          const dot =
            targetNormal.x * face.normal.x +
            targetNormal.y * face.normal.y +
            targetNormal.z * face.normal.z;
          score += (1 - dot) * 100; // Penaliza desvios angulares
        }

        if (targetCenter && face.centerOfMass) {
          const dist = CadTopologicalNaming.pointDistance(targetCenter, face.centerOfMass);
          score += dist;
        }

        if (targetArea !== undefined && face.area !== undefined) {
          const areaDiff = Math.abs(targetArea - face.area) / Math.max(1, targetArea);
          score += areaDiff * 10;
        }

        if (score < minScore) {
          minScore = score;
          bestFace = face;
        }
      }

      // Tolerância para casamento geométrico aceitável
      if (bestFace && minScore < 15.0) {
        return bestFace;
      }

      // 3. Fallback: índice ordinal se dentro dos limites
      if (
        ref.selector.index !== undefined &&
        ref.selector.index >= 0 &&
        ref.selector.index < shape.faces.length
      ) {
        return shape.faces[ref.selector.index] ?? null;
      }
    }

    return null;
  }

  /**
   * Resolve uma referência de Aresta contra um sólido B-Rep canônico
   */
  public static resolveEdge(shape: CadShape, ref: CadReference): CadEdge | null {
    if (ref.kind !== "edge" || !shape.edges || shape.edges.length === 0) {
      return null;
    }

    if (ref.fingerprint) {
      const match = shape.edges.find((e) => e.fingerprint === ref.fingerprint);
      if (match) return match;
    }

    if (ref.selector) {
      const targetCurve = ref.selector.curveType;
      const targetLength = ref.selector.length;

      let bestEdge: CadEdge | null = null;
      let minDiff = Infinity;

      for (const edge of shape.edges) {
        if (targetCurve && edge.curveType !== targetCurve) continue;

        let diff = 0;
        if (targetLength !== undefined) {
          diff += Math.abs(edge.length - targetLength);
        }

        if (diff < minDiff) {
          minDiff = diff;
          bestEdge = edge;
        }
      }

      if (bestEdge && minDiff < 5.0) {
        return bestEdge;
      }

      if (
        ref.selector.index !== undefined &&
        ref.selector.index >= 0 &&
        ref.selector.index < shape.edges.length
      ) {
        return shape.edges[ref.selector.index] ?? null;
      }
    }

    return null;
  }

  /**
   * Resolve uma referência de Vértice contra um sólido B-Rep canônico
   */
  public static resolveVertex(shape: CadShape, ref: CadReference): CadVertex | null {
    if (ref.kind !== "vertex" || !shape.vertices || shape.vertices.length === 0) {
      return null;
    }

    if (ref.fingerprint) {
      const match = shape.vertices.find((v) => v.fingerprint === ref.fingerprint);
      if (match) return match;
    }

    if (ref.selector?.point) {
      const targetPoint = ref.selector.point;
      let bestVertex: CadVertex | null = null;
      let minDist = Infinity;

      for (const vertex of shape.vertices) {
        const dist = CadTopologicalNaming.pointDistance(targetPoint, vertex.point);
        if (dist < minDist) {
          minDist = dist;
          bestVertex = vertex;
        }
      }

      if (bestVertex && minDist < 2.0) {
        return bestVertex;
      }
    }

    return null;
  }

  /**
   * Extrai o plano espacial (origem + normal) a partir de uma referência de plano ou face
   */
  public static resolvePlaneDefinition(
    ref: CadReference,
    activeShape?: CadShape | null,
  ): { origin: CadVector3D; normal: CadVector3D } {
    if (ref.kind === "plane") {
      const origin = ref.selector?.center ?? { x: 0, y: 0, z: 0 };
      const normal = ref.selector?.normal ?? { x: 0, y: 0, z: 1 };
      const offset = ref.selector?.offset ?? 0;

      return {
        origin: {
          x: origin.x + normal.x * offset,
          y: origin.y + normal.y * offset,
          z: origin.z + normal.z * offset,
        },
        normal,
      };
    }

    if (ref.kind === "face" && activeShape) {
      const face = this.resolveFace(activeShape, ref);
      if (face) {
        return {
          origin: face.centerOfMass,
          normal: face.normal,
        };
      }
    }

    // Default XY
    return { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } };
  }
}
