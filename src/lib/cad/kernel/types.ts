// @ts-nocheck
/**
 * CALDRA CAD — UNIFIED KERNEL TYPES (FASE 08)
 *
 * Tipos centrais do documento paramétrico do CAD CHAMFER,
 * orquestrando a árvore de recursos, geometria canônica B-Rep,
 * desdobramento de chapa metálica, caldeiraria e fabricação CAM/CNC.
 */

import type { CanonicalModel, Solid } from "../canonical";
import type { FeatureTree } from "../features/featureTree";
import type { FlatPatternResult } from "../sheetmetal/types";
import type { ToolpathResult, MachineConfig } from "../cam/types";
import type { TechnicalDrawingSheet } from "../drafting/types";
import type { StructuralMember, StructuralFrameReport } from "../weldments/types";
import type { NestingJobResult } from "../nesting/types";
import type {
  SheetMetalGussetDef,
  SheetMetalLouverDef,
  SheetMetalEmbossDef,
  SheetMetalHemDef,
  SheetMetalJogDef,
  PressBrakeSimulationResult,
  FormingEngineResult,
} from "../forming/types";
import type { Entity } from "@/lib/lab2d/core";
import type { DfmFullReport } from "../dfm/types";
import type { FirstArticleInspectionReport } from "../metrology/types";
import type { FeaAnalysisResult } from "../fea/types";

export type CADViewState =
  | "2D_SKETCH"
  | "3D_FOLDED"
  | "2D_FLAT"
  | "CAM_TOOLPATH"
  | "2D_DRAWING"
  | "WELDMENTS"
  | "NESTING"
  | "FORMING"
  | "DFM"
  | "METROLOGY"
  | "FEA";

export interface ParametricFlangeDef {
  id: string;
  name: string;
  edgeId?: "top" | "bottom" | "left" | "right";
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  angleDeg: number;
  insideRadius: number;
  flangeLength: number;
  direction: "UP" | "DOWN";
  kFactor: number;
  bendAllowance: number;
  bendDeduction: number;
  outsideSetback: number;
}

export interface BoilermakingFeatureDef {
  type: "cone" | "square_to_round" | "elbow" | "branch";
  name: string;
  params: Record<string, unknown>;
}

export interface PartDocument {
  id: string;
  name: string;
  header?: { name?: string };
  thickness: number;
  material: string;
  density: number; // g/cm³ (default: 7.85)
  kFactor: number; // default: 0.44
  innerRadius: number;
  featureTree: FeatureTree;
  canonicalModel: CanonicalModel;
  activeState: CADViewState;
  foldProgress?: number; // 0 = totalmente dobrado 3D, 1 = totalmente planificado 2D
  flanges?: ParametricFlangeDef[];
  boilermakingFeature?: BoilermakingFeatureDef;
  baseWidth?: number;
  baseLength?: number;
  activeSolid?: Solid;
  solid?: Solid;
  sheetMetal?: Record<string, unknown>;
  forming?: Record<string, unknown>;
  flatPatternResult?: FlatPatternResult;
  camResult?: ToolpathResult;
  gcode?: string;
  technicalDrawing?: TechnicalDrawingSheet;
  structuralMembers?: StructuralMember[];
  structuralReport?: StructuralFrameReport;
  nestingJob?: NestingJobResult;
  gussets?: SheetMetalGussetDef[];
  louvers?: SheetMetalLouverDef[];
  embosses?: SheetMetalEmbossDef[];
  hems?: SheetMetalHemDef[];
  jogs?: SheetMetalJogDef[];
  pressBrakeSimulation?: PressBrakeSimulationResult;
  formingResult?: FormingEngineResult;
  dfmReport?: DfmFullReport;
  metrologyReport?: FirstArticleInspectionReport;
  feaReport?: FeaAnalysisResult;
  entities2D: Entity[]; // Entidades no plano para o canvas do CHAMFER
  createdAt: number;
  updatedAt: number;
}

export interface RebuildKernelOptions {
  autoSolveConstraints?: boolean;
  generateFlatPattern?: boolean;
  generateCamToolpath?: boolean;
  machineConfig?: MachineConfig;
}
