/**
 * CALDRA CAD — DRAFTING & TECHNICAL DRAWING TYPES (FASE 09)
 *
 * Especificação formal de pranchas técnicas paramétricas,
 * geração de vistas ortográficas (1º diedro ABNT / ISO e 3º diedro ANSI),
 * cotagem inteligente, tabelas de dobra automáticas e bloco de título industrial.
 */

export type SheetSize = "A4_LANDSCAPE" | "A4_PORTRAIT" | "A3_LANDSCAPE" | "A2_LANDSCAPE";

export type ViewType =
  "FRONT" | "TOP" | "RIGHT" | "LEFT" | "ISOMETRIC" | "FLAT_PATTERN" | "SECTION";

export type ProjectionAngle = "FIRST_ANGLE" | "THIRD_ANGLE";

export type DrawingLineType =
  | "VISIBLE" // Aresta visível contínua (0.50 mm)
  | "HIDDEN" // Aresta oculta tracejada (0.25 mm)
  | "CENTER" // Linha de centro / simetria traço-ponto (0.25 mm)
  | "BEND_UP" // Linha de dobra para cima traço-ponto (0.35 mm magenta)
  | "BEND_DOWN" // Linha de dobra para baixo traço-dois pontos (0.35 mm cyan)
  | "DIMENSION" // Linha de cota contínua fina (0.25 mm)
  | "EXTENSION" // Linha de extensão de cota (0.25 mm)
  | "LEADER" // Linha de chamada com seta (0.25 mm)
  | "BORDER" // Moldura da folha (0.70 mm)
  | "GRID"; // Malha de referência da folha

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingLine {
  start: DrawingPoint;
  end: DrawingPoint;
  type: DrawingLineType;
  label?: string;
}

export interface DrawingArc {
  center: DrawingPoint;
  radius: number;
  startAngleRad: number;
  endAngleRad: number;
  type: DrawingLineType;
}

export type DimensionType =
  "LINEAR_HORIZ" | "LINEAR_VERT" | "ALIGNED" | "DIAMETER" | "RADIUS" | "ANGULAR";

export interface DrawingDimension {
  id: string;
  type: DimensionType;
  value: number;
  formattedText: string;
  p1: DrawingPoint;
  p2: DrawingPoint;
  textPos: DrawingPoint;
  leaderStart?: DrawingPoint;
  tolerance?: string;
  suffix?: string;
}

export interface DrawingAnnotation {
  text: string;
  pos: DrawingPoint;
  fontSizePt: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

export interface DrawingView {
  id: string;
  type: ViewType;
  name: string;
  scale: number; // ex: 1 = 1:1, 0.5 = 1:2
  origin: DrawingPoint; // Posição do centro da vista na folha em mm
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  lines: DrawingLine[];
  arcs: DrawingArc[];
  dimensions: DrawingDimension[];
  annotations: DrawingAnnotation[];
}

export interface BendTableRow {
  index: number;
  tag: string; // "D1", "D2", etc.
  direction: "UP" | "DOWN";
  angleDeg: number;
  insideRadiusMm: number;
  bendDeductionMm: number;
  kFactor: number;
  recommendedVDieMm: number;
  flangeLengthMm?: number;
}

export interface BendTable {
  title: string;
  rows: BendTableRow[];
}

export interface BOMTableRow {
  item: number;
  partNumber: string;
  description: string;
  material: string;
  thicknessMm: number;
  quantity: number;
  massKg: number;
}

export interface TitleBlock {
  drawingNumber: string;
  title: string;
  author: string;
  approver: string;
  company: string;
  date: string;
  scale: string;
  sheetNumber: string;
  sheetSize: SheetSize;
  material: string;
  thicknessMm: number;
  estimatedMassKg: number;
  tolerance: string;
  projection: ProjectionAngle;
}

export interface TechnicalDrawingSheet {
  id: string;
  title: string;
  size: SheetSize;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  projection: ProjectionAngle;
  scale: number; // Escala global principal da prancha
  scaleLabel: string;
  titleBlock: TitleBlock;
  views: DrawingView[];
  bendTable?: BendTable;
  bomTable?: BOMTableRow[];
  generalNotes: string[];
}
