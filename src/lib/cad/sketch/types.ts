/**
 * CALDRA CAD — PARAMETRIC SKETCH & CONSTRAINTS TYPES (FASE 02)
 *
 * Estruturas para o núcleo de esboços paramétricos, restrições geométricas,
 * parâmetros dimensionais e cálculo de graus de liberdade (DoF).
 */

export type ConstraintType =
  | "horizontal"
  | "vertical"
  | "coincident"
  | "distance"
  | "length"
  | "perpendicular"
  | "parallel"
  | "tangent"
  | "concentric"
  | "collinear"
  | "equal"
  | "midpoint"
  | "fixed"
  | "radius"
  | "diameter"
  | "angle";

export type SketchStatus =
  | "under_defined" // Subdefinido: graus de liberdade > 0
  | "fully_defined" // Totalmente definido: graus de liberdade = 0
  | "over_defined" // Sobredefinido: restrições conflitantes ou redundantes
  | "invalid"; // Geometria degenerada ou insolúvel

export interface SketchPoint {
  id: string;
  x: number;
  y: number;
  isFixed?: boolean;
}

export type SketchSegmentType = "line" | "arc" | "circle" | "slot";
export type CadRole = "CUT" | "MARK" | "BEND" | "RECORTE" | "CORTE" | "MARCAÇÃO" | "DOBRA";

export interface SketchSegment {
  id: string;
  type: SketchSegmentType;
  p0Id: string;
  p1Id: string;
  centerId?: string;
  radius?: number;
  isConstruction?: boolean;
  role: CadRole;
}

export interface GeometricConstraint {
  id: string;
  type: ConstraintType;
  pointIds: string[];
  segmentIds?: string[];
  value?: number;
  expression?: string;
  isActive: boolean;
}

export interface DimensionParameter {
  id: string;
  name: string;
  value: number;
  unit: "mm" | "deg";
  expression?: string;
  dependencies?: string[];
  min?: number;
  max?: number;
  label?: string;
}

export interface SolveResult {
  converged: boolean;
  iterations: number;
  maxResidual: number;
  degreesOfFreedom: number;
  status: SketchStatus;
  conflictingConstraints: string[];
}
