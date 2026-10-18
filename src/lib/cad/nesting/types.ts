/**
 * CALDRA CAD — MULTI-SHEET INDUSTRIAL NESTING & REMNANT OPTIMIZATION (FASE 11)
 *
 * Estruturas analíticas para aninhamento de múltiplos blanks, restrição de grão/veio,
 * detecção de corte em linha comum (common-line cutting), cálculo de retalhos (remnants)
 * e aproveitamento de chapas comerciais de caldeiraria e estamparia.
 */

export type GrainDirection = "NONE" | "HORIZONTAL" | "VERTICAL";

export interface NestingInternalHole {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "RECT" | "CIRCLE";
}

export interface NestingBlank {
  id: string;
  name: string;
  width: number; // Largura útil do blank (mm)
  height: number; // Comprimento útil do blank (mm)
  quantity: number; // Quantidade de peças demandadas
  thickness: number; // Espessura T (mm)
  material: string; // Ex: "Aço Carbono A36", "Inox 304"
  grainDirection?: GrainDirection; // Restrição de direção de laminação
  internalHoles?: NestingInternalHole[];
}

export interface NestingSheetStock {
  id: string;
  name: string;
  width: number; // Dimensão X da chapa (mm)
  height: number; // Dimensão Y da chapa (mm)
  thickness: number; // Espessura T (mm)
  material: string;
  borderMarginMm: number; // Margem perimetral de segurança (mm)
  clampMarginMm?: number; // Margem de garras de tração da máquina CNC (mm)
  isRemnant?: boolean; // Se é uma sobra de chapa reaproveitada
}

export interface NestingOptions {
  sheetStock?: NestingSheetStock;
  partSpacingMm: number; // Espaçamento entre peças (mm)
  kerfMm: number; // Largura do feixe de corte (mm)
  allowRotation: boolean; // Permitir rotações (0°, 90°, etc)
  enableCommonLineCut: boolean; // Agrupar arestas colineares com corte comum
  minRemnantAreaMm2?: number; // Área mínima para considerar retalho útil (mm²)
  algorithm?: "MAX_RECTS" | "GUILLOTINE" | "SHELF";
}

export interface PlacedBlank {
  blankId: string;
  name: string;
  instanceIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  thickness: number;
  material: string;
  hasCommonLineCut?: boolean;
  commonLineNeighbors?: string[];
  internalHoles?: NestingInternalHole[];
}

export interface CommonLineCut {
  id: string;
  partAId: string;
  partBId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lengthMm: number;
}

export interface SheetRemnant {
  id: string;
  sheetIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  areaMm2: number;
  weightKg: number;
  material: string;
  thickness: number;
}

export interface NestedSheet {
  sheetIndex: number;
  stock: NestingSheetStock;
  placements: PlacedBlank[];
  commonLines: CommonLineCut[];
  remnants: SheetRemnant[];
  usedAreaMm2: number;
  totalSheetAreaMm2: number;
  efficiencyPercent: number; // Aproveitamento percentual (0 a 100)
  scrapPercent: number; // Sucata percentual (0 a 100)
  totalPartWeightKg: number;
  totalSheetWeightKg: number;
  scrapWeightKg: number;
  estimatedCutTimeMinutes: number;
  pierceCount: number;
}

export interface NestingJobResult {
  id: string;
  createdAt: string;
  totalBlanksRequested: number;
  totalBlanksPlaced: number;
  unplacedBlanks: { name: string; quantity: number; reason: string }[];
  sheets: NestedSheet[];
  globalEfficiencyPercent: number;
  totalSheetWeightKg: number;
  totalPartsWeightKg: number;
  totalScrapWeightKg: number;
  totalCommonLineSavedLengthMm: number;
  totalRemnantsGenerated: SheetRemnant[];
}
