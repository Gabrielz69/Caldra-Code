// @ts-nocheck
/**
 * CALDRA GEOMETRY CORE — CANONICAL MODEL & TOPOLOGY (FASE 01)
 *
 * Modelo geométrico canônico e representação de fronteira (B-Rep / Topologia).
 * Fonte única de verdade matemática:
 *   CANONICAL MODEL → 2D / 3D / SHEET METAL / FABRICATION
 */

import type { Entity } from "@/lib/lab2d/core";
import type { SolidInstance } from "@/lib/project-catalog/instances";

export type Vector2D = { x: number; y: number };
export type Vector3D = { x: number; y: number; z: number };

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
  size: Vector3D;
}

export type SurfaceType = "planar" | "cylindrical" | "conical" | "ruled" | "spline";
export type SemanticRole = "CUT" | "MARK" | "BEND" | "RECORTE";

export interface Vertex3D {
  id: string;
  point: Vector3D;
  edgeIds: string[];
}

export interface Edge3D {
  id: string;
  type: "line" | "arc" | "circle" | "spline";
  v0: string; // vertex ID início
  v1: string; // vertex ID fim
  length: number;
  faceIds: string[];
  curveData?: {
    center?: Vector3D;
    radius?: number;
    normal?: Vector3D;
    startAngle?: number;
    endAngle?: number;
  };
}

export interface Loop3D {
  id: string;
  edgeIds: string[];
  isOuter: boolean;
  normal: Vector3D;
  area: number;
}

export interface Face3D {
  id: string;
  surfaceType: SurfaceType;
  outerLoop: Loop3D;
  innerLoops: Loop3D[];
  normal: Vector3D;
  area: number;
  planeD: number; // Equação do plano: Ax + By + Cz + D = 0
  role: SemanticRole;
  sourceSketchId?: string;
  metadata?: Record<string, unknown>;
}

export interface Shell3D {
  id: string;
  faceIds: string[];
  isClosed: boolean;
  isManifold: boolean;
}

export interface SolidBody3D {
  id: string;
  name: string;
  type: "solid";
  shell: Shell3D;
  faces: Face3D[];
  edges: Edge3D[];
  vertices: Vertex3D[];
  volume: number;
  surfaceArea: number;
  bounds: BoundingBox3D;
  material: string;
  density: number; // g/cm³ (aço carbono padrão = 7.85)
  mass: number; // kg
}

export type Solid = SolidBody3D;
export type Face = Face3D;
export type Edge = Edge3D;
export type Vertex = Vertex3D;

export interface SheetMetalBendRef {
  id: string;
  edgeId: string;
  angleDeg: number;
  insideRadius: number;
  kFactor: number;
  bendAllowance: number;
  direction: "UP" | "DOWN";
}

export interface SheetMetalBody {
  id: string;
  name: string;
  type: "sheet_metal";
  solidBody: SolidBody3D;
  thickness: number;
  defaultBendRadius: number;
  defaultKFactor: number;
  fixedFaceId: string;
  bends: SheetMetalBendRef[];
  isUnfolded: boolean;
}

export interface SketchSegment2D {
  id: string;
  type: "line" | "arc" | "circle";
  p0: Vector2D;
  p1: Vector2D;
  center?: Vector2D;
  radius?: number;
  role: SemanticRole;
}

export interface Sketch2D {
  id: string;
  name: string;
  plane: "XY" | "XZ" | "YZ";
  origin: Vector3D;
  segments: SketchSegment2D[];
  isClosed: boolean;
  area: number;
}

export type Body = SolidBody3D | SheetMetalBody;

export interface CanonicalModel {
  id: string;
  name: string;
  version: number;
  units: "mm";
  sketches: Sketch2D[];
  bodies: Body[];
  activeBodyId?: string;
  metadata: {
    createdAt: number;
    updatedAt: number;
    author?: string;
  };
}

// -------------------------------------------------------------
// MATEMÁTICA VETORIAL AUXILIAR
// -------------------------------------------------------------

export function vec3Dist(a: Vector3D, b: Vector3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

export function vec3Sub(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Add(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Cross(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3Dot(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Norm(v: Vector3D): Vector3D {
  const l = Math.hypot(v.x, v.y, v.z);
  if (l < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function computeBounds(vertices: Vertex3D[]): BoundingBox3D {
  if (vertices.length === 0) {
    const zero = { x: 0, y: 0, z: 0 };
    return { min: zero, max: zero, size: zero };
  }
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const v of vertices) {
    if (v.point.x < minX) minX = v.point.x;
    if (v.point.y < minY) minY = v.point.y;
    if (v.point.z < minZ) minZ = v.point.z;
    if (v.point.x > maxX) maxX = v.point.x;
    if (v.point.y > maxY) maxY = v.point.y;
    if (v.point.z > maxZ) maxZ = v.point.z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

// -------------------------------------------------------------
// CONSTRUTOR CANÔNICO: SKETCH RETANGULAR
// -------------------------------------------------------------

export function createRectangleSketch(
  width: number,
  height: number,
  origin: Vector2D = { x: 0, y: 0 },
  name = "Sketch 01",
): Sketch2D {
  const p0: Vector2D = { x: origin.x, y: origin.y };
  const p1: Vector2D = { x: origin.x + width, y: origin.y };
  const p2: Vector2D = { x: origin.x + width, y: origin.y + height };
  const p3: Vector2D = { x: origin.x, y: origin.y + height };

  const segments: SketchSegment2D[] = [
    { id: "seg_0", type: "line", p0, p1, role: "CUT" },
    { id: "seg_1", type: "line", p0: p1, p1: p2, role: "CUT" },
    { id: "seg_2", type: "line", p0: p2, p1: p3, role: "CUT" },
    { id: "seg_3", type: "line", p0: p3, p1: p0, role: "CUT" },
  ];

  return {
    id: `sketch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    plane: "XY",
    origin: { x: origin.x, y: origin.y, z: 0 },
    segments,
    isClosed: true,
    area: Math.abs(width * height),
  };
}

// -------------------------------------------------------------
// OPERAÇÃO CANÔNICA: EXTRUSÃO 3D DE SKETCH
// Gera B-Rep topológico completo com vértices, arestas e faces orientadas.
// -------------------------------------------------------------

export function extrudeSketchToSolid(
  sketch: Sketch2D,
  depth: number,
  material = "Aço Carbono",
  density = 7.85, // g/cm³
): SolidBody3D {
  if (!sketch.isClosed || sketch.segments.length < 3) {
    throw new Error("Não é possível extrudar um perfil aberto ou com menos de 3 segmentos.");
  }

  const n = sketch.segments.length;
  const vertices: Vertex3D[] = [];
  const edges: Edge3D[] = [];
  const faces: Face3D[] = [];

  // 1. Vértices da base inferior (Z = 0)
  for (let i = 0; i < n; i++) {
    const p = sketch.segments[i].p0;
    vertices.push({
      id: `v_b_${i}`,
      point: { x: p.x, y: p.y, z: 0 },
      edgeIds: [],
    });
  }

  // 2. Vértices do topo superior (Z = depth)
  for (let i = 0; i < n; i++) {
    const p = sketch.segments[i].p0;
    vertices.push({
      id: `v_t_${i}`,
      point: { x: p.x, y: p.y, z: depth },
      edgeIds: [],
    });
  }

  // 3. Arestas da base (Z = 0)
  const bottomEdgeIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const edgeId = `e_b_${i}`;
    bottomEdgeIds.push(edgeId);
    const len = vec3Dist(vertices[i].point, vertices[next].point);
    edges.push({
      id: edgeId,
      type: "line",
      v0: vertices[i].id,
      v1: vertices[next].id,
      length: len,
      faceIds: [],
    });
    vertices[i].edgeIds.push(edgeId);
    vertices[next].edgeIds.push(edgeId);
  }

  // 4. Arestas do topo (Z = depth)
  const topEdgeIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const edgeId = `e_t_${i}`;
    topEdgeIds.push(edgeId);
    const len = vec3Dist(vertices[n + i].point, vertices[n + next].point);
    edges.push({
      id: edgeId,
      type: "line",
      v0: vertices[n + i].id,
      v1: vertices[n + next].id,
      length: len,
      faceIds: [],
    });
    vertices[n + i].edgeIds.push(edgeId);
    vertices[n + next].edgeIds.push(edgeId);
  }

  // 5. Arestas verticais colunas
  const vertEdgeIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const edgeId = `e_v_${i}`;
    vertEdgeIds.push(edgeId);
    const len = depth;
    edges.push({
      id: edgeId,
      type: "line",
      v0: vertices[i].id,
      v1: vertices[n + i].id,
      length: len,
      faceIds: [],
    });
    vertices[i].edgeIds.push(edgeId);
    vertices[n + i].edgeIds.push(edgeId);
  }

  // 6. Face Inferior (Normal apontando para -Z)
  const bottomLoop: Loop3D = {
    id: "loop_bottom",
    edgeIds: [...bottomEdgeIds],
    isOuter: true,
    normal: { x: 0, y: 0, z: -1 },
    area: sketch.area,
  };
  const bottomFace: Face3D = {
    id: "face_bottom",
    surfaceType: "planar",
    outerLoop: bottomLoop,
    innerLoops: [],
    normal: { x: 0, y: 0, z: -1 },
    area: sketch.area,
    planeD: 0,
    role: "CUT",
    sourceSketchId: sketch.id,
  };
  faces.push(bottomFace);
  bottomEdgeIds.forEach((eid) => {
    edges.find((e) => e.id === eid)?.faceIds.push(bottomFace.id);
  });

  // 7. Face Superior (Normal apontando para +Z)
  const topLoop: Loop3D = {
    id: "loop_top",
    edgeIds: [...topEdgeIds],
    isOuter: true,
    normal: { x: 0, y: 0, z: 1 },
    area: sketch.area,
  };
  const topFace: Face3D = {
    id: "face_top",
    surfaceType: "planar",
    outerLoop: topLoop,
    innerLoops: [],
    normal: { x: 0, y: 0, z: 1 },
    area: sketch.area,
    planeD: -depth,
    role: "CUT",
    sourceSketchId: sketch.id,
  };
  faces.push(topFace);
  topEdgeIds.forEach((eid) => {
    edges.find((e) => e.id === eid)?.faceIds.push(topFace.id);
  });

  // 8. Faces Laterais
  let lateralAreaTotal = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const sideEdgeIds = [bottomEdgeIds[i], vertEdgeIds[next], topEdgeIds[i], vertEdgeIds[i]];

    const p0 = vertices[i].point;
    const pNext = vertices[next].point;
    const dx = pNext.x - p0.x;
    const dy = pNext.y - p0.y;
    const edgeLen = Math.hypot(dx, dy);
    const sideArea = edgeLen * depth;
    lateralAreaTotal += sideArea;

    // Normal lateral (rotacionada 90 graus no plano XY para fora)
    const norm = vec3Norm({ x: dy, y: -dx, z: 0 });

    const sideLoop: Loop3D = {
      id: `loop_side_${i}`,
      edgeIds: sideEdgeIds,
      isOuter: true,
      normal: norm,
      area: sideArea,
    };

    const sideFace: Face3D = {
      id: `face_side_${i}`,
      surfaceType: "planar",
      outerLoop: sideLoop,
      innerLoops: [],
      normal: norm,
      area: sideArea,
      planeD: -(norm.x * p0.x + norm.y * p0.y),
      role: "CUT",
    };

    faces.push(sideFace);
    sideEdgeIds.forEach((eid) => {
      const edge = edges.find((e) => e.id === eid);
      if (edge && !edge.faceIds.includes(sideFace.id)) {
        edge.faceIds.push(sideFace.id);
      }
    });
  }

  const bounds = computeBounds(vertices);
  const volume = sketch.area * depth;
  const totalSurfaceArea = 2 * sketch.area + lateralAreaTotal;
  // Volume em mm³ para cm³ (÷ 1000) × densidade em g/cm³ ÷ 1000 = massa em kg
  const massKg = (volume / 1000) * density * 0.001;

  const shell: Shell3D = {
    id: `shell_${sketch.id}`,
    faceIds: faces.map((f) => f.id),
    isClosed: true,
    isManifold: true,
  };

  return {
    id: `solid_${sketch.id}`,
    name: `Corpo Sólido (${sketch.name})`,
    type: "solid",
    shell,
    faces,
    edges,
    vertices,
    volume,
    surfaceArea: totalSurfaceArea,
    bounds,
    material,
    density,
    mass: massKg,
  };
}

// -------------------------------------------------------------
// OPERAÇÃO CANÔNICA: CONVERTER EM CHAPA METÁLICA (SHEET METAL)
// -------------------------------------------------------------

export function convertToSheetMetal(
  solid: SolidBody3D,
  fixedFaceId: string,
  thickness: number,
  bendRadius?: number,
  kFactor = 0.33,
): SheetMetalBody {
  const fixedFace = solid.faces.find((f) => f.id === fixedFaceId);
  if (!fixedFace) {
    throw new Error(`Face fixa com id '${fixedFaceId}' não foi encontrada no sólido.`);
  }

  const radius = bendRadius ?? thickness;

  return {
    id: `sm_${solid.id}`,
    name: `Chapa Metálica (${solid.name})`,
    type: "sheet_metal",
    solidBody: solid,
    thickness,
    defaultBendRadius: radius,
    defaultKFactor: kFactor,
    fixedFaceId,
    bends: [],
    isUnfolded: false,
  };
}

// -------------------------------------------------------------
// ADAPTADORES & PROJEÇÕES
// -------------------------------------------------------------

/**
 * Converte o modelo canônico para o formato de visualização 3D do CALDRA (SolidInstance).
 * Não duplica cálculos; consome a topologia canônica.
 */
export function canonicalToSolidInstances(body: Body): SolidInstance[] {
  const solid = body.type === "sheet_metal" ? body.solidBody : body;
  const instances: SolidInstance[] = [];

  // Transforma as faces planas em polígonos 3D renderizáveis
  for (const face of solid.faces) {
    if (face.id === "face_bottom" || face.id === "face_top") {
      continue;
    }
  }

  // Gera a instância do bloco sólido completo a partir do bounding box e loops
  instances.push({
    id: solid.id,
    partCode: solid.name,
    partName: solid.name,
    color: "#e2e8f0",
    wireColor: "#0f172a",
    material: "aco",
    instances: [
      {
        id: `${solid.id}_inst`,
        partId: solid.id,
        position: [
          (solid.bounds.min.x + solid.bounds.max.x) / 2,
          (solid.bounds.min.y + solid.bounds.max.y) / 2,
          (solid.bounds.min.z + solid.bounds.max.z) / 2,
        ],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        geometryType: "box",
        dimensions: {
          w: solid.bounds.size.x,
          h: solid.bounds.size.y,
          d: solid.bounds.size.z,
          t: body.type === "sheet_metal" ? body.thickness : solid.bounds.size.z,
        },
      },
    ],
  });

  return instances;
}

/**
 * Projeta a face 2D de contorno do sólido de volta para entidades nativas do CHAMFER 2D.
 */
export function canonicalToLab2DEntities(body: Body): Entity[] {
  const solid = body.type === "sheet_metal" ? body.solidBody : body;
  const entities: Entity[] = [];

  // Pega as arestas da base (Z=0) como contorno 2D nativo
  const baseEdges = solid.edges.filter((e) => e.faceIds.includes("face_bottom"));

  for (const edge of baseEdges) {
    const v0 = solid.vertices.find((v) => v.id === edge.v0);
    const v1 = solid.vertices.find((v) => v.id === edge.v1);
    if (!v0 || !v1) continue;

    entities.push({
      id: edge.id,
      type: "line",
      x1: v0.point.x,
      y1: v0.point.y,
      x2: v1.point.x,
      y2: v1.point.y,
      layer: "CORTE",
    });
  }

  return entities;
}
