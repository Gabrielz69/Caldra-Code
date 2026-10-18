/**
 * POLÍTICAS DE VISIBILIDADE DO WIRE3D.
 *
 * Esta camada recebe somente projeções da geometria existente. Ela nunca move,
 * cria ou remove entidades canônicas. A segmentação existe exclusivamente para
 * desenhar a parte visível de uma linha quando a oclusão espacial é solicitada.
 */

import type { Vec3 } from "@/lib/geometry/types";
import {
  type Camera,
  type Edge,
  type EntityKind,
  type WireTag,
  isSignificantTechnicalEdge,
} from "./wire";

export type RenderCategory =
  | "surface"
  | "edge"
  | "technical"
  | "reference"
  | "dimension"
  | "selection";

export type VisibilityPolicy =
  | "surface-depth"
  | "real-occlusion"
  | "technical-persistent"
  | "overlay";

export const VISIBILITY_POLICY: Readonly<Record<RenderCategory, VisibilityPolicy>> = {
  surface: "surface-depth",
  edge: "technical-persistent",
  technical: "technical-persistent",
  reference: "technical-persistent",
  dimension: "overlay",
  selection: "overlay",
};

export type CameraPoint = Vec3;

export type ProjectedLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z1: number;
  z2: number;
};

export type ProjectedTriangle = {
  id: string;
  pts: readonly [CameraPoint, CameraPoint, CameraPoint];
  minDepth: number;
  maxDepth: number;
  centerDepth: number;
  priority: number;
  pass?: number; // 0: inner, 1: cap, 2: outer, 3: rim
  kind?: string;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
};

export function toCameraPoint(p: Vec3, cam: Camera): CameraPoint {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  return {
    x: x1,
    y: p.y * cp - z1 * sp,
    z: p.y * sp + z1 * cp,
  };
}

export function projectLine(
  id: string,
  edge: Edge,
  project: (p: Vec3) => CameraPoint,
  scale: number,
  panX: number = 0,
  panY: number = 0,
): ProjectedLine {
  const a = project(edge[0]);
  const b = project(edge[1]);
  return {
    id,
    x1: a.x * scale + panX,
    y1: -a.y * scale + panY,
    x2: b.x * scale + panX,
    y2: -b.y * scale + panY,
    z1: a.z,
    z2: b.z,
  };
}

/**
 * Painter estável e determinístico para superfícies SVG.
 * 1. Prioriza o passe topológico estrito (inner < cap < outer < rim).
 * 2. Intervalos de profundidade completamente separados são resolvidos estritamente.
 * 3. Intervalos sobrepostos usam centróide, prioridade de entidade e ID determinístico.
 */
export function compareSurfaceDepth(a: ProjectedTriangle, b: ProjectedTriangle): number {
  if (a.pass !== undefined && b.pass !== undefined && a.pass !== b.pass) {
    return a.pass - b.pass;
  }

  // Intervalos completamente disjuntos em Z (menor z = mais ao fundo = desenhado primeiro)
  const eps = 1e-4;
  if (a.maxDepth < b.minDepth - eps) return -1;
  if (b.maxDepth < a.minDepth - eps) return 1;

  return (
    a.minDepth - b.minDepth ||
    a.maxDepth - b.maxDepth ||
    a.centerDepth - b.centerDepth ||
    a.priority - b.priority ||
    a.id.localeCompare(b.id)
  );
}

const AREA_EPSILON = 1e-8;

function depthAtPoint(x: number, y: number, triangle: ProjectedTriangle): number | undefined {
  const [a, b, c] = triangle.pts;
  const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(den) <= AREA_EPSILON) return undefined;
  const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / den;
  const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / den;
  const wc = 1 - wa - wb;
  const epsilon = -1e-6;
  if (wa < epsilon || wb < epsilon || wc < epsilon) return undefined;
  return wa * a.z + wb * b.z + wc * c.z;
}

function interpolate(line: ProjectedLine, t: number): { x: number; y: number; z: number } {
  return {
    x: line.x1 + (line.x2 - line.x1) * t,
    y: line.y1 + (line.y2 - line.y1) * t,
    z: line.z1 + (line.z2 - line.z1) * t,
  };
}

function occludedAt(
  point: { x: number; y: number; z: number },
  triangles: readonly ProjectedTriangle[],
  depthEpsilon: number,
): boolean {
  for (const triangle of triangles) {
    if (triangle.maxDepth <= point.z + depthEpsilon) continue;
    // Bounding box rápido em tela 2D
    if (triangle.minX !== undefined && triangle.maxX !== undefined) {
      if (
        point.x < triangle.minX - 0.5 ||
        point.x > triangle.maxX + 0.5 ||
        point.y < triangle.minY! - 0.5 ||
        point.y > triangle.maxY! + 0.5
      ) {
        continue;
      }
    }
    const surfaceDepth = depthAtPoint(point.x, point.y, triangle);
    if (surfaceDepth !== undefined && surfaceDepth > point.z + depthEpsilon) return true;
  }
  return false;
}

/**
 * Segmentação adaptativa e limitada para oclusão de linhas.
 * No padrão técnico devolve exatamente um segmento sem degradação.
 * Em oclusão real, corta com precisão somente o trecho coberto por superfícies frontais.
 */
export function visibleLineSegments(
  line: ProjectedLine,
  policy: VisibilityPolicy,
  triangles: readonly ProjectedTriangle[],
  depthEpsilon: number,
): ProjectedLine[] {
  if (policy !== "real-occlusion") return [line];

  const screenLength = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  const depthTravel = Math.abs(line.z2 - line.z1);
  const count = Math.max(1, Math.min(32, Math.ceil(Math.max(screenLength / 7, depthTravel / 24))));
  const visible = Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / count;
    return !occludedAt(interpolate(line, t), triangles, depthEpsilon);
  });

  const out: ProjectedLine[] = [];
  let start = -1;
  for (let index = 0; index <= count; index++) {
    if (index < count && visible[index]) {
      if (start < 0) start = index;
      continue;
    }
    if (start < 0) continue;
    const a = interpolate(line, start / count);
    const b = interpolate(line, index / count);
    out.push({
      id: `${line.id}:${start}-${index}`,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      z1: a.z,
      z2: b.z,
    });
    start = -1;
  }
  return out;
}

const KIND_PRIORITY: Record<EntityKind, number> = {
  INTERSECTION: 10,
  JOINT: 9,
  BEND_EDGE: 8,
  REAL_BOUNDARY: 7,
  REAL_EDGE: 6,
  TRANSITION_GENERATOR: 5,
  TRIANGULATION_INTERNAL: 4,
  CONSTRUCTION: 3,
  REFERENCE: 2,
  DIMENSION: 1,
  SELECTION: 0,
};

/**
 * Filtra as arestas do modelo de acordo com o modo de visualização 3D:
 * - "shaded" (SOMB): Nenhuma aresta (apenas superfícies sombreadas limpas)
 * - "shaded-edges" (SOMB+AR): Apenas arestas reais e tecnicamente significativas
 * - "wireframe" (ARAME): Estrutura completa, incluindo triangulação interna
 */
export function filterEdgesForMode(
  edges: readonly Edge[],
  kinds: readonly EntityKind[] | undefined,
  tags: readonly (WireTag | undefined)[] | undefined,
  edgeMode: "shaded" | "shaded-edges" | "wireframe",
): {
  edges: Edge[];
  kinds: EntityKind[];
  tags: (WireTag | undefined)[];
  originalIndices: number[];
} {
  if (edgeMode === "shaded") {
    return { edges: [], kinds: [], tags: [], originalIndices: [] };
  }

  const outEdges: Edge[] = [];
  const outKinds: EntityKind[] = [];
  const outTags: (WireTag | undefined)[] = [];
  const originalIndices: number[] = [];

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    const k: EntityKind = kinds && kinds[i] ? kinds[i]! : "REAL_EDGE";
    const tag = tags ? tags[i] : undefined;

    if (edgeMode === "shaded-edges") {
      if (!isSignificantTechnicalEdge(k)) continue;
    }

    outEdges.push(e);
    outKinds.push(k);
    outTags.push(tag);
    originalIndices.push(i);
  }

  return { edges: outEdges, kinds: outKinds, tags: outTags, originalIndices };
}

/**
 * Deduplica arestas coincidentes ou quase coincidentes na camada de apresentação (Seção 14).
 * Preserva a entidade com maior relevância técnica (ex: INTERSECTION > JOINT > REAL_BOUNDARY).
 */
export function deduplicateEdges(
  edges: readonly Edge[],
  kinds?: readonly EntityKind[],
  tags?: readonly (WireTag | undefined)[],
  originalIndices?: readonly number[],
  tolerance = 0.5,
): {
  edges: Edge[];
  kinds: EntityKind[];
  tags: (WireTag | undefined)[];
  originalIndices: number[];
} {
  const map = new Map<
    string,
    { edge: Edge; kind: EntityKind; tag: WireTag | undefined; originalIndex: number }
  >();

  const quant = (p: Vec3) =>
    `${Math.round(p.x / tolerance)}_${Math.round(p.y / tolerance)}_${Math.round(p.z / tolerance)}`;

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    const k: EntityKind = kinds && kinds[i] ? kinds[i]! : "REAL_EDGE";
    const t = tags ? tags[i] : undefined;
    const origIdx = originalIndices ? originalIndices[i]! : i;

    const kA = quant(e[0]);
    const kB = quant(e[1]);
    if (kA === kB) continue; // segmento degenerado de comprimento zero

    const key = kA < kB ? `${kA}:${kB}` : `${kB}:${kA}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { edge: e, kind: k, tag: t, originalIndex: origIdx });
    } else {
      // Se a nova aresta tem maior prioridade técnica, substitui a classificação
      const currentPrio = KIND_PRIORITY[existing.kind] ?? 0;
      const newPrio = KIND_PRIORITY[k] ?? 0;
      if (newPrio > currentPrio) {
        map.set(key, { edge: e, kind: k, tag: t ?? existing.tag, originalIndex: origIdx });
      }
    }
  }

  const outEdges: Edge[] = [];
  const outKinds: EntityKind[] = [];
  const outTags: (WireTag | undefined)[] = [];
  const outIndices: number[] = [];

  for (const item of map.values()) {
    outEdges.push(item.edge);
    outKinds.push(item.kind);
    outTags.push(item.tag);
    outIndices.push(item.originalIndex);
  }

  return { edges: outEdges, kinds: outKinds, tags: outTags, originalIndices: outIndices };
}

