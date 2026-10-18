/**
 * CALDRA CAD CORE — TOPOLOGY TYPES (B-Rep)
 *
 * Representação de Fronteira (Boundary Representation - B-Rep) canônica e agnóstica do CAD CORE.
 * Define a hierarquia topológica pura:
 *   Solid → Shell → Face → Loop/Wire → Edge → Vertex
 */

export interface CadVector3D {
  x: number;
  y: number;
  z: number;
}

export interface CadBoundingBox {
  min: CadVector3D;
  max: CadVector3D;
  size: CadVector3D;
}

export type CadSurfaceType =
  | "plane"
  | "cylinder"
  | "cone"
  | "sphere"
  | "torus"
  | "bezier"
  | "bspline"
  | "revolution"
  | "extrusion"
  | "other";

export type CadCurveType =
  | "line"
  | "circle"
  | "ellipse"
  | "parabola"
  | "hyperbola"
  | "bezier"
  | "bspline"
  | "other";

export interface CadVertex {
  id: string;
  index: number;
  handle?: number;
  fingerprint?: string;
  point: CadVector3D;
  edgeIds: string[];
}

export interface CadEdge {
  id: string;
  index: number;
  handle?: number;
  fingerprint?: string;
  curveType: CadCurveType;
  v0: string; // ID do vértice inicial
  v1: string; // ID do vértice final
  length: number;
  faceIds: string[];
  isSeam?: boolean;
  isDegenerate?: boolean;
}

export interface CadLoop {
  id: string;
  edgeIds: string[];
  isOuter: boolean;
}

export interface CadFace {
  id: string;
  index: number;
  handle?: number;
  fingerprint?: string;
  surfaceType: CadSurfaceType;
  outerLoop?: CadLoop;
  innerLoops?: CadLoop[];
  area: number;
  normal: CadVector3D;
  centerOfMass: CadVector3D;
  edgeIds: string[];
}

export interface CadShell {
  id: string;
  faceIds: string[];
  isClosed: boolean;
}

export interface CadSolid {
  id: string;
  name: string;
  shells: CadShell[];
  faces: CadFace[];
  edges: CadEdge[];
  vertices: CadVertex[];
  volume: number;
  surfaceArea: number;
  bounds: CadBoundingBox;
  centerOfMass: CadVector3D;
}
