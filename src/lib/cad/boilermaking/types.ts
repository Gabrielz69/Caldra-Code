/**
 * CALDRA CAD — BOILERMAKING 3D & DEVELOPABLE SURFACES (FASE 05)
 *
 * Tipos e interfaces para caldeiraria pesada/leve, transições 3D desenvolvíveis,
 * cones concêntricos e excêntricos, curvas de gomos e derivações cilíndricas.
 */

import type { Solid, Vector3D } from "../canonical";
import type { Entity } from "@/lib/lab2d/core";

export type BoilermakingType = "cone" | "square_to_round" | "elbow" | "branch";

export interface TruncatedConeInput {
  D: number; // Diâmetro maior (base), mm
  d: number; // Diâmetro menor (topo), mm
  H: number; // Altura vertical, mm
  ex?: number; // Excentricidade no eixo X, mm
  ey?: number; // Excentricidade no eixo Y, mm
  thickness: number; // Espessura da chapa, mm
  material?: string;
  density?: number; // g/cm³ (aço = 7.85)
  divisions?: number; // Número de divisões angulares (geratrizes, ex: 24)
  splitCount?: 1 | 2 | 4; // Número de virolas/partes para corte
  weldGapMm?: number; // Folga para junta soldada, mm
}

export interface SquareToRoundInput {
  baseWidth: number; // Lado A da base retangular/quadrada, mm
  baseLength: number; // Lado B da base retangular/quadrada, mm
  topDiameter: number; // Diâmetro D do topo circular, mm
  height: number; // Altura vertical H, mm
  ex?: number; // Deslocamento X do centro do topo em relação à base, mm
  ey?: number; // Deslocamento Y do centro do topo em relação à base, mm
  thickness: number; // Espessura da chapa, mm
  material?: string;
  density?: number;
  divisionsPerCorner?: number; // Divisões por canto arredondado (padrão: 6)
  splitCount?: 1 | 2 | 4;
  weldGapMm?: number;
}

export interface SegmentedElbowInput {
  diameter: number; // Diâmetro da tubulação, mm
  bendRadius: number; // Raio de curvatura da linha de centro (R = 1.5D típica), mm
  totalAngleDeg: number; // Ângulo da curva (ex: 90°, 45°, 60°)
  segmentsCount: number; // Número total de gomos (ex: 4 = 2 meio-gomos + 2 gomos centrais)
  thickness: number;
  material?: string;
  density?: number;
  divisions?: number;
}

export interface CylindricalBranchInput {
  mainDiameter: number; // Diâmetro do tubo principal (Tronco), mm
  branchDiameter: number; // Diâmetro do tubo de derivação (Ramal), mm
  angleDeg: number; // Ângulo de interseção (ex: 90° para Tê, 45° para Y)
  offset?: number; // Deslocamento de centros (excentricidade), mm
  branchHeight: number; // Comprimento útil da boca de lobo, mm
  thickness: number;
  material?: string;
  density?: number;
  divisions?: number;
}

export interface TrueLengthLine {
  id: string;
  label: string;
  p1: Vector3D;
  p2: Vector3D;
  trueLengthMm: number;
}

export interface BendingInstruction {
  generatorIndex: number;
  positionMm: number;
  angleDeg: number; // Ângulo de dobra/prensa para conformação facetada
  chordLengthMm: number;
}

export interface BoilermakingFlatPattern {
  partIndex: number;
  partName: string;
  blankWidth: number; // Largura mínima envolvente de chapa, mm
  blankLength: number; // Comprimento mínimo envolvente de chapa, mm
  blankAreaMm2: number; // Área real de chapa líquida, mm²
  weightKg: number; // Massa em kg
  entities: Entity[]; // Contornos na camada CORTE e geratrizes na camada DOBRA/MARCAÇÃO
  bendingInstructions: BendingInstruction[];
}

export interface BoilermakingResult {
  type: BoilermakingType;
  body: Solid;
  flatPatterns: BoilermakingFlatPattern[];
  trueLengths: TrueLengthLine[];
  totalWeightKg: number;
  totalAreaMm2: number;
  weldSeamLengthMm: number;
  metadata: {
    divisions: number;
    splitCount: number;
    material: string;
    thickness: number;
  };
}
