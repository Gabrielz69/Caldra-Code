/**
 * CALDRA CHAMFER — MOTOR DE REFERÊNCIAS GEOMÉTRICAS (GeometricReferenceEngine)
 *
 * Núcleo unificado de identificação, classificação e resolução de referências:
 *  - Pontos Notáveis (Extremidades, Cantos, Centros, Pontos Médios, Interseções, Quadrantes);
 *  - Bordas e Segmentos de Contorno (Direção, Vetor Normal, Comprimento, Rótulo Semântico);
 *  - Projeção ortogonal exata sobre bordas retas ou inclinadas;
 *  - Detecção e amarração sem dependência de pixels da tela.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, type Entity, segmentsOf } from "./core";
import {
  extractEntitySmartReferences,
  extractIntersections,
  findSmartSnap,
  type SmartReferencePoint,
  type SmartSnapKind,
} from "./cadReferenceSnaps";

const RAD2DEG = 180 / Math.PI;

export interface EdgeReference {
  id: string;
  entityId: string;
  segmentIndex: number;
  p1: Vec2;
  p2: Vec2;
  length: number;
  angleRad: number;
  angleDeg: number;
  dir: Vec2;        // Vetor diretor unitário de p1 para p2
  normal: Vec2;     // Vetor normal unitário ortogonal (-dir.y, dir.x)
  midpoint: Vec2;
  label: string;
}

export interface EdgeProjection {
  projected: Vec2;
  clamped: Vec2;
  u: number;        // Coordenada ao longo da borda a partir de p1 (mm)
  v: number;        // Afastamento perpendicular em relação à borda (mm, sinal positivo conforme normal)
  isWithinSegment: boolean;
  distanceToSegment: number;
}

export interface CornerReference {
  id: string;
  p: Vec2;
  edgeA: EdgeReference;
  edgeB: EdgeReference;
  angleDeg: number;
  bisector: Vec2;
  label: string;
}

export class GeometricReferenceEngine {
  /**
   * Extrai todas as bordas lineares do modelo matemático das entidades.
   */
  static extractEdges(entities: Entity[]): EdgeReference[] {
    const edges: EdgeReference[] = [];

    for (const ent of entities) {
      if (ent.type === "hatch" || ent.type === "text" || ent.type === "point") continue;

      const segs = segmentsOf(ent);
      segs.forEach((seg, idx) => {
        const [p1, p2] = seg;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.hypot(dx, dy);
        if (length < 1e-4) return;

        const dir: Vec2 = { x: dx / length, y: dy / length };
        // Normal à esquerda no sentido do vetor diretor (-dir.y, dir.x)
        const normal: Vec2 = { x: -dir.y, y: dir.x };
        const midpoint: Vec2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        let angleRad = Math.atan2(dy, dx);
        if (angleRad < 0) angleRad += 2 * Math.PI;
        const angleDeg = (angleRad * RAD2DEG) % 360;

        // Rótulo semântico baseado na orientação
        let label = "Borda";
        const isHoriz = Math.abs(dy) < 1e-3 || Math.abs(Math.sin(angleRad)) < 0.05;
        const isVert = Math.abs(dx) < 1e-3 || Math.abs(Math.cos(angleRad)) < 0.05;

        if (isHoriz) {
          label = p1.y > 0 ? "Borda Horizontal Superior" : "Borda Horizontal";
        } else if (isVert) {
          label = p1.x > 0 ? "Borda Vertical Direita" : "Borda Vertical";
        } else {
          label = `Borda Inclinada ${angleDeg.toFixed(1)}°`;
        }

        edges.push({
          id: `edge_${ent.id}_${idx}`,
          entityId: ent.id,
          segmentIndex: idx,
          p1,
          p2,
          length,
          angleRad,
          angleDeg,
          dir,
          normal,
          midpoint,
          label,
        });
      });
    }

    return edges;
  }

  /**
   * Projeta um ponto qualquer sobre uma borda calculando u (ao longo) e v (perpendicular).
   */
  static projectPointOnEdge(p: Vec2, edge: EdgeReference): EdgeProjection {
    const dx = p.x - edge.p1.x;
    const dy = p.y - edge.p1.y;

    // Componente paralela ao longo da borda
    const u = dx * edge.dir.x + dy * edge.dir.y;
    // Componente perpendicular à borda
    const v = dx * edge.normal.x + dy * edge.normal.y;

    const projected: Vec2 = {
      x: edge.p1.x + u * edge.dir.x,
      y: edge.p1.y + u * edge.dir.y,
    };

    const isWithinSegment = u >= -1e-4 && u <= edge.length + 1e-4;

    // Ponto mais próximo contido no segmento
    const clampedU = Math.max(0, Math.min(edge.length, u));
    const clamped: Vec2 = {
      x: edge.p1.x + clampedU * edge.dir.x,
      y: edge.p1.y + clampedU * edge.dir.y,
    };

    const distanceToSegment = dist(p, clamped);

    return {
      projected,
      clamped,
      u,
      v,
      isWithinSegment,
      distanceToSegment,
    };
  }

  /**
   * Encontra a borda mais próxima sob o cursor dentro da tolerância em mm.
   */
  static findNearestEdge(
    cursor: Vec2,
    edges: EdgeReference[],
    toleranceMm = 15,
  ): { edge: EdgeReference; projection: EdgeProjection } | null {
    let best: { edge: EdgeReference; projection: EdgeProjection } | null = null;
    let minDistance = Infinity;

    for (const edge of edges) {
      const proj = GeometricReferenceEngine.projectPointOnEdge(cursor, edge);
      if (proj.distanceToSegment <= toleranceMm && proj.distanceToSegment < minDistance) {
        minDistance = proj.distanceToSegment;
        best = { edge, projection: proj };
      }
    }

    return best;
  }

  /**
   * Encontra cantos formados pela junção de duas bordas consecutivas.
   */
  static findCorners(edges: EdgeReference[], toleranceMm = 1.0): CornerReference[] {
    const corners: CornerReference[] = [];
    const n = edges.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = edges[i]!;
        const b = edges[j]!;

        const pairs: [Vec2, Vec2][] = [
          [a.p1, b.p1],
          [a.p1, b.p2],
          [a.p2, b.p1],
          [a.p2, b.p2],
        ];

        for (const [ptA, ptB] of pairs) {
          if (dist(ptA, ptB) <= toleranceMm) {
            const meetingPt: Vec2 = {
              x: (ptA.x + ptB.x) / 2,
              y: (ptA.y + ptB.y) / 2,
            };

            // Ângulo entre vetores saindo do canto
            const dirA = ptA === a.p1 ? a.dir : { x: -a.dir.x, y: -a.dir.y };
            const dirB = ptB === b.p1 ? b.dir : { x: -b.dir.x, y: -b.dir.y };

            const dot = Math.max(-1, Math.min(1, dirA.x * dirB.x + dirA.y * dirB.y));
            const angleDeg = Math.acos(dot) * RAD2DEG;

            const bisectorDir: Vec2 = {
              x: dirA.x + dirB.x,
              y: dirA.y + dirB.y,
            };
            const bLen = Math.hypot(bisectorDir.x, bisectorDir.y) || 1;
            const bisector: Vec2 = { x: bisectorDir.x / bLen, y: bisectorDir.y / bLen };

            corners.push({
              id: `corner_${a.id}_${b.id}`,
              p: meetingPt,
              edgeA: a,
              edgeB: b,
              angleDeg,
              bisector,
              label: Math.abs(angleDeg - 90) < 1 ? "Canto 90° (Esquadro)" : `Canto ${angleDeg.toFixed(1)}°`,
            });
            break;
          }
        }
      }
    }

    return corners;
  }

  /**
   * Localiza ponto de snap inteligente integrando cadReferenceSnaps.
   */
  static findSnap(
    cursor: Vec2,
    entities: Entity[],
    tolMm: number,
    activeStartPoint: Vec2 | null = null,
  ): SmartReferencePoint | null {
    return findSmartSnap(cursor, entities, tolMm, activeStartPoint);
  }

  /**
   * Extrai todos os pontos característicos de todas as entidades.
   */
  static extractAllReferencePoints(
    entities: Entity[],
    activeStartPoint: Vec2 | null = null,
  ): SmartReferencePoint[] {
    const list: SmartReferencePoint[] = [];
    for (const ent of entities) {
      list.push(...extractEntitySmartReferences(ent, activeStartPoint, 12));
    }
    list.push(...extractIntersections(entities, false));
    return list;
  }
}
