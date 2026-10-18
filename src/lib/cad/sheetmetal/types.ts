/**
 * CALDRA CAD — SHEET METAL CORE TYPES (FASE 04)
 *
 * Estruturas para modelagem, desdobramento (unfold/fold), planificação (flat pattern)
 * e validação DFM (Design for Manufacturing) de chapas metálicas.
 */

import type { Vector2D, Vector3D } from "../canonical";
import type { Entity } from "@/lib/lab2d/core";

export type FlangeMaterialPosition = "INSIDE" | "OUTSIDE" | "BEND_CENTER";
export type ReliefType = "RECTANGULAR" | "CIRCULAR" | "TEAR";
export type BendDirection = "UP" | "DOWN";

export interface SheetMetalFlangeDef {
  id: string;
  edgeId: string;
  length: number; // Comprimento da aba (mm)
  angleDeg: number; // Ângulo de dobra relativo à chapa base (ex: 90°)
  insideRadius: number; // Raio interno de conformação (mm)
  materialPosition: FlangeMaterialPosition;
  reliefType?: ReliefType;
  reliefWidth?: number;
  reliefDepth?: number;
}

export interface SheetMetalBendLine {
  id: string;
  flangeId: string;
  startPoint: Vector2D;
  endPoint: Vector2D;
  angleDeg: number;
  insideRadius: number;
  direction: BendDirection;
  kFactor: number;
  bendAllowance: number;
  bendDeduction: number;
  outsideSetback: number;
  neutralRadius: number;
}

export interface FlatPatternResult {
  blankWidth: number; // Largura do Blank retificado (mm)
  blankLength: number; // Comprimento do Blank retificado (mm)
  blankArea: number; // Área real da chapa planificada (mm²)
  weightKg: number; // Massa física (kg)
  thickness: number; // Espessura da chapa (mm)
  material: string; // Material cadastrado
  contourEntities: Entity[]; // Contornos externos e furos na camada CORTE
  bendLines: SheetMetalBendLine[]; // Linhas de centro de dobra
  tangentLines: { startPoint: Vector2D; endPoint: Vector2D; type: "START" | "END" }[];
  isInterferenceFree: boolean;
}

export interface DFMValidationIssue {
  code: string;
  severity: "error" | "warning";
  featureId?: string;
  message: string;
  recommendation?: string;
}

export interface DFMValidationReport {
  isValidForManufacturing: boolean;
  issues: DFMValidationIssue[];
  metrics: {
    minHoleToBendDistance: number;
    recommendedMinHoleDistance: number;
    minFlangeLength: number;
    recommendedMinFlangeLength: number;
    riskOfCracking: boolean;
  };
}
