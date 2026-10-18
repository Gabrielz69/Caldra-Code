/**
 * CALDRA CAD CORE — PARAMETRIC FEATURE TREE MODEL (FASE 05)
 *
 * Modelo de dados determinístico da árvore de recursos (Feature Tree / DAG).
 * Cada recurso armazena parâmetros semânticos, referências persistentes,
 * estado de integridade e cache do sólido B-Rep gerado no OCCT.
 */

import type { CadShape } from "../core/CadShape";
import type { CadTessellatedShape } from "../core/CadMesh";
import type { MassProperties } from "../core/CadKernel";

export type CadFeatureState = "VALID" | "DIRTY" | "STALE" | "ERROR" | "SUPPRESSED";

export type CadFeatureType =
  | "base_box"
  | "base_cylinder"
  | "extrude_sketch"
  | "hole_cut"
  | "fillet"
  | "chamfer"
  | "boolean_cut"
  | "boolean_union"
  | "boolean_intersection"
  | "transform"
  | "boilermaking_cone"
  | "boilermaking_transition"
  | "boilermaking_elbow"
  | "boilermaking_branch"
  | "boilermaking_hood"
  | "weldment_beam"
  | "weldment_frame";

export interface WeldmentBeamParams {
  profileDesignation: string;
  profileType: "I_BEAM" | "U_CHANNEL" | "L_ANGLE" | "RECT_TUBE" | "ROUND_TUBE" | "FLAT_BAR";
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  linearMassKgM: number;
  miterLeftDeg?: number;
  miterRightDeg?: number;
}

export interface WeldmentFrameParams {
  frameName: string;
  profileDesignation: string;
  frameWidthMm: number;
  frameLengthMm: number;
  frameHeightMm?: number;
  cornerTreatment: "MITER" | "BUTT_1" | "BUTT_2";
  totalMassKg?: number;
}

export interface BoilermakingConeParams {
  D: number;
  d: number;
  height: number;
  thickness: number;
  ex?: number;
  ey?: number;
  material?: string;
}

export interface BoilermakingTransitionParams {
  width: number;
  length: number;
  diameter: number;
  height: number;
  thickness: number;
  ex?: number;
  ey?: number;
  material?: string;
}

export interface BoilermakingElbowParams {
  diameter: number;
  radius: number;
  angleDeg: number;
  segments: number;
  thickness: number;
  material?: string;
}

export interface BoilermakingBranchParams {
  mainDiameter: number;
  branchDiameter: number;
  mainLength: number;
  branchHeight: number;
  thickness: number;
  material?: string;
}

export interface BoilermakingHoodParams {
  baseDiameter: number;
  topDiameter: number;
  height: number;
  thickness: number;
  material?: string;
}

export interface BaseBoxParams {
  width: number; // Dimensão X (mm)
  length: number; // Dimensão Y (mm)
  height: number; // Dimensão Z (mm)
  centered: boolean;
}

export interface BaseCylinderParams {
  radius: number; // mm
  height: number; // mm
  centered: boolean;
}

export interface ExtrudeSketchParams {
  depth: number; // mm
  symmetric: boolean;
  operation: "new_body" | "union" | "cut";
  sketchProfile?: {
    points: { x: number; y: number }[];
  };
}

export interface HoleCutParams {
  diameter: number; // mm
  depth: number; // mm (ou passante se depth >= espessura)
  isThrough: boolean;
  position: { x: number; y: number; z?: number };
  targetFaceIndex?: number;
  targetFaceFingerprint?: string;
}

export interface FilletParams {
  radius: number; // mm
  edgeIndices: number[];
  edgeFingerprints?: string[];
}

export interface ChamferParams {
  distance: number; // mm
  edgeIndices: number[];
  edgeFingerprints?: string[];
}

export interface TransformParams {
  dx: number;
  dy: number;
  dz: number;
  rx?: number; // rad
  ry?: number;
  rz?: number;
}

export type CadFeatureParams =
  | BaseBoxParams
  | BaseCylinderParams
  | ExtrudeSketchParams
  | HoleCutParams
  | FilletParams
  | ChamferParams
  | TransformParams
  | Record<string, unknown>;

export interface CadFeatureNode {
  id: string;
  name: string;
  type: CadFeatureType;
  order: number;
  state: CadFeatureState;
  isSuppressed: boolean;
  parameters: CadFeatureParams;

  // Dependências na árvore DAG
  dependencies: string[]; // IDs de features das quais esta depende
  references: string[]; // Fingerprints ou referências topológicas

  // Cache intermediário do resultado avaliado pelo Kernel OCCT
  cachedShape?: CadShape;
  cachedTessellation?: CadTessellatedShape;
  cachedMass?: MassProperties;
  errorMessage?: string;
}

export interface CadTreeRebuildResult {
  success: boolean;
  activeShape: CadShape | null;
  tessellation: CadTessellatedShape | null;
  massProperties: MassProperties | null;
  features: CadFeatureNode[];
  rebuiltCount: number;
  cachedCount: number;
  durationMs: number;
  error?: string;
}
