/**
 * CALDRA CHAMFER — EVOLUÇÃO DO CAD CORE (FASE 1)
 * Tipos centrais da Fundação CAD Paramétrica baseada em B-Rep.
 */

import type { CadVector3D, CadBoundingBox, CadFace, CadEdge, CadVertex } from "../core/CadTopology";
import type { CadShape } from "../core/CadShape";
import type { CadTessellatedShape } from "../core/CadMesh";
import type { MassProperties } from "../core/CadKernel";
import type { CadFeatureType, CadFeatureParams } from "../features/CadFeatureModel";

// ==========================================
// UNIDADES E PRECISÃO
// ==========================================

export type CadLengthUnit = "mm" | "cm" | "m" | "in";
export type CadAngleUnit = "deg" | "rad";
export type CadMassUnit = "kg" | "g";

export interface CadDocumentUnits {
  length: CadLengthUnit;
  angle: CadAngleUnit;
  mass: CadMassUnit;
  precision: number; // Casas decimais (ex: 2, 4)
}

// ==========================================
// MATERIAIS
// ==========================================

export interface CadMaterial {
  id: string;
  name: string;
  density: number; // g/cm³ (ex: Aço = 7.85)
  yieldStrength?: number; // MPa
  ultimateStrength?: number; // MPa
  elasticModulus?: number; // GPa
  poissonRatio?: number;
  thermalExpansion?: number; // 1/K
  category?: "Aço Carbono" | "Aço Inox" | "Alumínio" | "Cobre" | "Outro";
  sheetMetalDefaults?: {
    kFactor: number;
    defaultThicknessMm: number;
    bendRadiusMm: number;
  };
}

// ==========================================
// PARÂMETROS E EXPRESSÕES
// ==========================================

export interface CadParameter {
  id: string;
  name: string;
  value: number;
  expression?: string; // Ex: "L / 2", "DIAMETER + 10", "sin(ALPHA) * 100"
  unit: CadLengthUnit | CadAngleUnit | "scalar";
  description?: string;
  isReadOnly?: boolean;
}

// ==========================================
// REFERÊNCIAS TOPOLÓGICAS E GEOMÉTRICAS
// ==========================================

export type CadReferenceKind =
  | "face"
  | "edge"
  | "vertex"
  | "axis"
  | "plane"
  | "sketch"
  | "body"
  | "feature";

export type CadDatumAxisType = "DATUM_X" | "DATUM_Y" | "DATUM_Z" | "CYLINDER_AXIS" | "EDGE_AXIS";
export type CadDatumPlaneType = "DATUM_XY" | "DATUM_XZ" | "DATUM_YZ" | "OFFSET_PLANE" | "FACE_PLANE";

export interface CadReference {
  id: string;
  kind: CadReferenceKind;
  targetId: string; // ID da feature, corpo ou sketch de origem
  fingerprint?: string; // Chave topológica invariante (CadTopologicalNaming)
  selector?: {
    normal?: CadVector3D;
    center?: CadVector3D;
    area?: number;
    surfaceType?: string;
    curveType?: string;
    length?: number;
    point?: CadVector3D;
    index?: number;
    planeType?: CadDatumPlaneType;
    axisType?: CadDatumAxisType;
    offset?: number;
  };
}

// ==========================================
// ESBOÇO (SKETCH) PARAMÉTRICO
// ==========================================

export interface CadSketchPoint {
  id: string;
  x: number;
  y: number;
  isFixed?: boolean;
}

export type CadSketchSegmentType = "line" | "arc" | "circle" | "bezier";

export interface CadSketchSegment {
  id: string;
  type: CadSketchSegmentType;
  p0Id: string;
  p1Id: string;
  centerId?: string; // Para arcos/círculos
  radius?: number;
  role?: "CORTE" | "MARCAÇÃO" | "DOBRA" | "CONSTRUÇÃO";
}

export interface CadSketchConstraint {
  id: string;
  type: "coincident" | "distance" | "horizontal" | "vertical" | "parallel" | "perpendicular" | "concentric" | "radius" | "angle";
  elementIds: string[];
  value?: number;
  expression?: string;
  isActive: boolean;
}

export interface CadSketch {
  id: string;
  name: string;
  planeRef: CadReference;
  origin: CadVector3D;
  normal: CadVector3D;
  xDir: CadVector3D;
  yDir: CadVector3D;
  points: CadSketchPoint[];
  segments: CadSketchSegment[];
  constraints: CadSketchConstraint[];
  isClosed: boolean;
  isVisible: boolean;
  featureDependencies: string[]; // Parâmetros ou referências externas
}

// ==========================================
// FEATURE GRAPH / HISTÓRICO PARAMÉTRICO
// ==========================================

export type CadFeatureState = "UP_TO_DATE" | "DIRTY" | "STALE" | "ERROR" | "SUPPRESSED";

export interface CadFeatureExecutionResult {
  bRepShape: CadShape | null;
  tessellation: CadTessellatedShape | null;
  massProperties?: MassProperties;
  rebuiltAt: number;
  executionTimeMs: number;
  errorMessage?: string;
}

export interface CadFeatureNode {
  id: string;
  name: string;
  type: CadFeatureType;
  order: number;
  state: CadFeatureState;
  isSuppressed: boolean;
  parameters: CadFeatureParams;
  references: CadReference[]; // Faces, arestas ou planos referenciados
  dependencies: string[]; // IDs de sketches, features anteriores ou parâmetros de que depende
  dependents: string[]; // IDs de features posteriores que dependem desta
  targetBodyId?: string;
  result?: CadFeatureExecutionResult;
}

// ==========================================
// CORPOS (BODIES) B-REP
// ==========================================

export type CadBodyType = "solid" | "sheet_metal" | "surface" | "wireframe";

export interface CadBody {
  id: string;
  name: string;
  type: CadBodyType;
  isVisible: boolean;
  color?: string;
  opacity?: number;
  bRepShape: CadShape | null; // Sólido analítico canônico B-Rep
  tessellationCache: CadTessellatedShape | null; // Cache de malha para Three.js / visualização
  massProperties?: MassProperties;
  boundingBox?: CadBoundingBox;
  featureIds: string[]; // Features ordenadas que geraram este corpo
}

// ==========================================
// METADADOS E PERSISTÊNCIA NATIVA
// ==========================================

export interface CadDocumentMetadata {
  format: "CALDRA_CHAMFER_CAD";
  schemaVersion: "1.0.0";
  title: string;
  author?: string;
  revision: string;
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface CadDocumentSerialized {
  metadata: CadDocumentMetadata;
  units: CadDocumentUnits;
  materials: {
    activeMaterialId: string;
    catalog: CadMaterial[];
  };
  parameters: CadParameter[];
  sketches: CadSketch[];
  features: Array<{
    id: string;
    name: string;
    type: CadFeatureType;
    order: number;
    isSuppressed: boolean;
    parameters: CadFeatureParams;
    references: CadReference[];
    dependencies: string[];
    targetBodyId?: string;
  }>;
  bodies: Array<{
    id: string;
    name: string;
    type: CadBodyType;
    isVisible: boolean;
    color?: string;
    opacity?: number;
    featureIds: string[];
  }>;
  // Snapshots opcionais para recarga instantânea
  bRepSnapshot?: {
    format: "BREP" | "STEP";
    data: string; // ASCII Brep ou STEP gerado pelo OCCT
  };
  tessellationSnapshot?: CadTessellatedShape;
}
