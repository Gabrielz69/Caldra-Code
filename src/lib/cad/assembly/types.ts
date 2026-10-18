/**
 * CALDRA CAD — MULTIBODY & ASSEMBLIES TYPES (FASE 06)
 *
 * Estruturas para corpos múltiplos (Multibody), operações booleanas CSG (União, Subtração, Interseção),
 * relações mecânicas de posicionamento (Mates), detecção de interferência e lista técnica de materiais (BOM).
 */

import type { Solid, Vector3D } from "../canonical";

export type BooleanOpType = "UNION" | "SUBTRACT" | "INTERSECT";

export interface SolidBody {
  id: string;
  name: string;
  solid: Solid;
  material: string;
  density: number; // g/cm³
  color?: string;
  isVisible: boolean;
}

export type MateType =
  "COINCIDENT" | "PARALLEL" | "PERPENDICULAR" | "CONCENTRIC" | "DISTANCE" | "ANGLE";

export type MateStatus = "SATISFIED" | "OVER_CONSTRAINED" | "CONFLICT" | "UNRESOLVED";

export interface AssemblyMate {
  id: string;
  name: string;
  type: MateType;
  targetComponentId: string;
  targetEntityId?: string; // face ou eixo de apoio
  referenceComponentId: string;
  referenceEntityId?: string;
  offsetMm?: number; // Para mates de DISTANCE
  angleDeg?: number; // Para mates de ANGLE
  isAligned?: boolean; // Sentido dos vetores normais (alinhados vs anti-alinhados)
  isSuppressed?: boolean;
  status: MateStatus;
}

export interface ComponentInstance {
  id: string;
  name: string;
  partCode: string;
  solid: Solid;
  position: Vector3D; // Deslocamento global [x, y, z]
  rotation: Vector3D; // Rotação de Euler [rx, ry, rz] em graus
  isGrounded: boolean; // Base estática da montagem (graus de liberdade travados)
  material: string;
  density: number; // g/cm³
  massKg: number;
}

export interface InterferenceIssue {
  id: string;
  componentAId: string;
  componentAName: string;
  componentBId: string;
  componentBName: string;
  overlapVolumeMm3: number;
  penetrationDepthMm: number;
  isCritical: boolean; // True se sobreposição volumétrica > 0.05 mm
  overlapBox: {
    min: Vector3D;
    max: Vector3D;
  };
}

export interface WeldJoint {
  id: string;
  componentAId: string;
  componentBId: string;
  type: "fillet" | "butt" | "corner";
  legSizeMm: number;
  lengthMm: number;
  electrode: string;
}

export interface BOMItem {
  itemNumber: number;
  partCode: string;
  name: string;
  quantity: number;
  material: string;
  dimensionsEnvelope: string;
  unitMassKg: number;
  totalMassKg: number;
}

export interface AssemblyReport {
  assemblyName: string;
  totalComponents: number;
  uniquePartsCount: number;
  totalMassKg: number;
  centerOfMass: Vector3D;
  matesCount: number;
  dofRemaining: number; // Graus de liberdade restantes
  interferences: InterferenceIssue[];
  bom: BOMItem[];
  weldJoints: WeldJoint[];
}
