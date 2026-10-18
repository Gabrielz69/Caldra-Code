/**
 * CALDRA CAD — CNC MANUFACTURING & POST-PROCESSOR TYPES (FASE 07)
 *
 * Estruturas para geração de percursos de corte (CAM), sequenciamento inteligente,
 * entrada/saída (Lead-in/Lead-out), micro-juntas (Tabs) e pós-processamento G-Code ISO/CypCut.
 */

export type CuttingTechnology = "LASER" | "PLASMA" | "WATERJET" | "OXYFUEL";

export type GCodeDialect = "STANDARD_ISO" | "FANUC" | "MACH3" | "CYPCUT" | "LINUXCNC";

export type LeadType = "LINE" | "ARC" | "LINE_ARC" | "NONE";

export interface CuttingParameters {
  technology: CuttingTechnology;
  material: string;
  thicknessMm: number;
  kerfWidthMm: number; // Largura do feixe (sangria)
  feedrateMmMin: number; // Velocidade de avanço de corte (mm/min)
  rapidSpeedMmMin: number; // Velocidade de translação em vazio G00 (mm/min)
  pierceTimeSec: number; // Tempo de furação inicial (dwell)
  gasPressureBar?: number;
  laserPowerWatts?: number;
}

export interface LeadParams {
  type: LeadType;
  lengthMm: number;
  angleDeg: number;
  radiusMm?: number;
}

export interface MicroJoint {
  id: string;
  position: { x: number; y: number };
  widthMm: number; // Largura da micro-ponte (ex: 0.8 mm)
  contourId: string;
}

export interface ToolpathSegment {
  type: "RAPID" | "CUT_LINEAR" | "CUT_CIRCULAR" | "PIERCE" | "LEAD_IN" | "LEAD_OUT" | "TAB";
  start: { x: number; y: number };
  end: { x: number; y: number };
  center?: { x: number; y: number };
  isClockwise?: boolean;
  feedrate: number;
  beamOn: boolean;
}

export interface CutContour {
  id: string;
  isOuter: boolean; // False = furo interno; True = contorno externo
  piercePoint: { x: number; y: number };
  leadInSegments: ToolpathSegment[];
  cutSegments: ToolpathSegment[];
  leadOutSegments: ToolpathSegment[];
  lengthMm: number;
  microJoints: MicroJoint[];
}

export interface ToolpathResult {
  contours: CutContour[];
  totalCutLengthMm: number;
  totalRapidLengthMm: number;
  pierceCount: number;
  estimatedCutTimeSec: number;
  estimatedRapidTimeSec: number;
  estimatedPierceTimeSec: number;
  totalCycleTimeSec: number;
}

export interface GCodeOptions {
  programName?: string;
  partName?: string;
  dialect?: GCodeDialect;
  includeComments?: boolean;
  useAbsoluteCoordinates?: boolean;
  zClearanceMm?: number;
  zCutMm?: number;
}
