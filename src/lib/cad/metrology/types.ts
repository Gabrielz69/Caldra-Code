/**
 * CALDRA CAD — METROLOGIA INDUSTRIAL, GD&T & INSPEÇÃO DE QUALIDADE (FASE 14)
 *
 * Tipos e estruturas para controle de qualidade dimensional, toleranciamento
 * geométrico (GD&T conforme ASME Y14.5 / ISO 1101), tolerâncias gerais
 * (ISO 2768-1 / ISO 2768-2), apalpamento CMM e Relatório FAI (First Article Inspection).
 */

export type GdtCharacteristic =
  // Forma
  | "FLATNESS" // Planicidade ⏥
  | "STRAIGHTNESS" // Retilineidade ⎯
  | "CIRCULARITY" // Circularidade ○
  | "CYLINDRICITY" // Cilindricidade ⌭
  // Orientação
  | "PERPENDICULARITY" // Perpendicularidade ⟂
  | "PARALLELISM" // Paralelismo ∥
  | "ANGULARITY" // Angularidade ∠
  // Localização
  | "TRUE_POSITION" // Posição Verdadeira ⌖
  | "CONCENTRICITY" // Concentricidade ◎
  | "SYMMETRY" // Simetria ⌯
  // Perfil
  | "PROFILE_OF_SURFACE" // Perfil de Superfície ⌒
  | "PROFILE_OF_LINE" // Perfil de Linha ◠
  // Batimento
  | "CIRCULAR_RUNOUT" // Batimento Circular ↗
  | "TOTAL_RUNOUT"; // Batimento Total ⇗

export type MaterialConditionModifier =
  | "RFS" // Regardless of Feature Size (padrão)
  | "MMC" // Maximum Material Condition Ⓜ
  | "LMC"; // Least Material Condition Ⓛ

export type ToleranceClass =
  | "ISO_2768_F" // Fina
  | "ISO_2768_M" // Média (padrão para chaparia e caldeiraria fina)
  | "ISO_2768_C" // Grosseira (padrão para caldeiraria pesada e estruturas)
  | "ISO_2768_V"; // Muito grosseira

export type InspectionInstrument =
  | "CALIPER" // Paquímetro digital
  | "MICROMETER" // Micrômetro
  | "HEIGHT_GAUGE" // Traçador de altura
  | "PROTRACTOR" // Goniômetro / transferidor de ângulo
  | "CMM_PROBE" // Máquina de Medir por Coordenadas (CMM)
  | "LASER_SCANNER" // Scanner 3D / Braço articulado
  | "TAPE_MEASURE" // Trena calibrada
  | "GO_NOGO_GAUGE"; // Calibre passa / não-passa

export type InspectionPointType =
  | "LINEAR_DIMENSION"
  | "HOLE_DIAMETER"
  | "HOLE_POSITION_X"
  | "HOLE_POSITION_Y"
  | "BEND_ANGLE"
  | "FLANGE_LENGTH"
  | "SHEET_THICKNESS"
  | "OVERALL_WIDTH"
  | "OVERALL_LENGTH"
  | "GDT_POSITION"
  | "GDT_FLATNESS"
  | "GDT_PERPENDICULARITY";

export interface GdtDatumReference {
  primary: string; // Ex: "A"
  secondary?: string; // Ex: "B"
  tertiary?: string; // Ex: "C"
  primaryModifier?: MaterialConditionModifier;
  secondaryModifier?: MaterialConditionModifier;
  tertiaryModifier?: MaterialConditionModifier;
}

export interface GdtFeatureControlFrame {
  id: string;
  characteristic: GdtCharacteristic;
  symbol: string;
  toleranceValue: number;
  isDiameterZone: boolean;
  materialModifier: MaterialConditionModifier;
  datums: GdtDatumReference;
  appliedToFeatureId: string;
  description: string;
}

export interface InspectionPoint {
  id: string;
  balloonNumber: number; // #1, #2, #3 para o mapa baloneado
  type: InspectionPointType;
  label: string;
  featureRefId?: string;
  nominal: number;
  upperTol: number; // Ex: +0.20
  lowerTol: number; // Ex: -0.20
  measured?: number;
  deviation?: number;
  status: "PENDING" | "PASS" | "WARNING" | "FAIL";
  instrument: InspectionInstrument;
  gdtFrame?: GdtFeatureControlFrame;
  coordinates: {
    x: number;
    y: number;
    z?: number;
  };
  notes?: string;
}

export interface ProcessCapabilityIndices {
  mean: number;
  stdDev: number;
  cp: number;
  cpk: number;
  totalSamples: number;
}

export interface FirstArticleInspectionReport {
  id: string;
  partId: string;
  partName: string;
  revision: string;
  inspectorName: string;
  date: string;
  machineId?: string;
  material: string;
  thickness: number;
  toleranceClass: ToleranceClass;
  points: InspectionPoint[];
  gdtFrames: GdtFeatureControlFrame[];
  summary: {
    totalDimensions: number;
    passed: number;
    warnings: number;
    failed: number;
    pending: number;
    conformanceRate: number; // porcentagem (ex: 95.5%)
    overallVerdict: "APPROVED" | "CONDITIONALLY_APPROVED" | "REJECTED" | "INCOMPLETE";
  };
  capability?: ProcessCapabilityIndices;
}
