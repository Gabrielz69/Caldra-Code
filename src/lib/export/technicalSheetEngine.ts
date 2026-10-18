/**
 * CALDRA — MOTOR DE FOLHA TÉCNICA PARAMÉTRICA PARA TRAÇAGEM
 *
 * Gera a prancha técnica vetorial de fabricação em projeção ortográfica (1º Diedro),
 * perspectiva isométrica, vistas de detalhe e planificação, derivada 100% da geometria canônica.
 *
 * Baseado na referência estrutural da vista técnica da Escada Reta do CALDRA:
 * - Moldura e margem normativa ABNT NBR 10068 / ISO 5456
 * - Cabeçalho com identificação CALDRA, nome da peça e classificação canônica
 * - Vistas ortográficas com eixos de centro e cotas dimensionais associativas
 * - Perspectiva técnica isométrica da malha sólida 3D (wire.ts)
 * - Vistas de detalhe ampliado (DETALHE A) para regiões complexas/interseções
 * - Planificação (Flat Pattern) vetorial com geratrizes de dobra e contorno de corte
 * - Notas técnicas de fabricação derivadas dos dados reais
 * - Quadro técnico padronizado CALDRA (legenda / title block)
 */

import type { Vec2, Vec3 } from "@/lib/geometry/types";
import type { GeometryResult } from "@/lib/geometry/types";
import { buildWire, type WireModel, type WireParams } from "@/lib/viz3d/wire";
import { findGeometry } from "@/lib/geometry/catalog";
import { getEngine, type EngineValues } from "@/lib/geometry/engines";

export type PaperSize = "A4" | "A3";
export type SheetOrientation = "landscape" | "portrait";
export type SheetTheme = "white" | "blueprint";

export type LineStyle =
  | "visible"
  | "hidden"
  | "center"
  | "fold"
  | "dimension"
  | "extension"
  | "border";

export interface TechnicalLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: LineStyle;
  label?: string;
}

export interface TechnicalDimension {
  id: string;
  type: "horizontal" | "vertical" | "aligned" | "diameter" | "radius" | "angle";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dimPos: number; // posição da linha de cota em relação aos pontos
  valueText: string;
}

export interface TechnicalView {
  id: string;
  title: string;
  ox: number; // mm na folha
  oy: number;
  width: number;
  height: number;
  scale: number; // fator de escala aplicado
  lines: TechnicalLine[];
  dimensions: TechnicalDimension[];
  subtitles?: string[];
  isDetail?: boolean;
}

export interface TitleBlockField {
  col: number;
  row: number;
  title: string;
  value: string;
}

export interface TitleBlockData {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  fields: TitleBlockField[];
}

export interface SheetValidationItem {
  id: string;
  label: string;
  passed: boolean;
  message?: string;
}

export interface TechnicalSheetHeader {
  brand: string;
  pieceName: string;
  classification: string;
  method: string;
  standard: string;
}

export interface TechnicalSheetDocument {
  sheetW: number;
  sheetH: number;
  paperSize: PaperSize;
  orientation: SheetOrientation;
  theme: SheetTheme;
  scaleText: string;
  scaleDenom: number;
  margin: number;
  header: TechnicalSheetHeader;
  views: TechnicalView[];
  notes: string[];
  titleBlock: TitleBlockData;
  validation: {
    valid: boolean;
    checks: SheetValidationItem[];
  };
  modelName: string;
  modelSlug: string;
  dateStr: string;
  estimatedMassKg?: number;
}

export interface SheetOptions {
  paperSize?: PaperSize;
  orientation?: SheetOrientation;
  theme?: SheetTheme;
  projectName?: string;
  pieceName?: string;
  code?: string;
  revision?: string;
  material?: string;
  thickness?: number | string;
  quantity?: number | string;
  notes?: string;
}

/** Escalas normativas de engenharia ISO/ABNT */
const STANDARD_SCALES = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
const TAU = Math.PI * 2;

function selectScale(drawingSpan: number, availableSpan: number): number {
  if (drawingSpan <= 0 || availableSpan <= 0) return 1;
  const rawRatio = drawingSpan / availableSpan;
  if (rawRatio <= 1) return 1;
  for (const s of STANDARD_SCALES) {
    if (s >= rawRatio) return s;
  }
  return Math.ceil(rawRatio / 50) * 50;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.abs(n) >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
}

/**
 * Constrói o documento técnico completo a partir da geometria canônica e parâmetros reais.
 */
export function buildTechnicalSheet(
  slug: string,
  values: EngineValues,
  result: GeometryResult | null,
  options: SheetOptions = {},
): TechnicalSheetDocument {
  const geomEntry = findGeometry(slug);
  const modelName = options.pieceName || geomEntry?.name || "Peça Caldeiraria";
  const modelSlug = slug.toUpperCase();
  const dateStr = new Date().toLocaleDateString("pt-BR");
  const material = options.material || "Aço Carbono ASTM A36";

  const thicknessNum =
    typeof options.thickness === "number"
      ? options.thickness
      : parseFloat(String(options.thickness || values["thickness"] || values["t"] || 3)) || 3;
  const thicknessVal = `${thicknessNum} mm`;
  const quantityVal = String(options.quantity || 1);
  const codeVal = options.code || `${modelSlug}-01`;
  const revVal = options.revision || "A";

  const paperSize: PaperSize = options.paperSize || "A4";
  const orientation: SheetOrientation = options.orientation || "landscape";
  const theme: SheetTheme = options.theme || "white";

  // Dimensões da folha em mm (ABNT NBR 10068)
  const dimsA4 = { landscape: { w: 297, h: 210 }, portrait: { w: 210, h: 297 } };
  const dimsA3 = { landscape: { w: 420, h: 297 }, portrait: { w: 297, h: 420 } };
  const sheetDims = paperSize === "A3" ? dimsA3[orientation] : dimsA4[orientation];
  const sheetW = sheetDims.w;
  const sheetH = sheetDims.h;

  const margin = 10; // 10mm de margem padrão
  const usableW = sheetW - margin * 2;

  // Quadro técnico padronizado (semelhante ao da Escada Reta)
  const titleBlockH = paperSize === "A3" ? 36 : 30;
  const titleBlockW = usableW;
  const titleBlockX = margin;
  const titleBlockY = sheetH - margin - titleBlockH;

  // Cabeçalho institucional no topo da folha
  const headerH = 14;
  const headerY = margin + 2;

  // Área útil de desenho para vistas
  const drawingAreaH = titleBlockY - margin - headerH - 12;
  const drawingAreaW = usableW;
  const drawingAreaY = margin + headerH + 4;

  // Cálculo da massa teórica (Aço: 7850 kg/m³ = 7.85e-6 kg/mm³)
  let estimatedMassKg: number | undefined = result?.massKg;
  if (!estimatedMassKg && result?.areaMm2) {
    estimatedMassKg = (result.areaMm2 * thicknessNum * 7.85) / 1_000_000;
  }

  // Cabeçalho da folha técnica
  const classification = geomEntry
    ? `${geomEntry.level.toUpperCase()} · ${geomEntry.method.toUpperCase()}`
    : "CALDEIRARIA · INDUSTRIAL";
  const header: TechnicalSheetHeader = {
    brand: "CALDRA",
    pieceName: modelName.toUpperCase(),
    classification,
    method: geomEntry?.method || "Geometria Paramétrica",
    standard: "PROJEÇÃO 1º DIEDRO · ABNT / ISO 5456",
  };

  // Extração paramétrica das dimensões primárias da geometria
  const d1 = values["bottomDiameter"] ?? values["d1"] ?? values["baseDiameter"] ?? values["diameter"] ?? values["baseA"] ?? 200;
  const d2 = values["topDiameter"] ?? values["d2"] ?? values["mainDiameter"] ?? values["baseB"] ?? values["d"] ?? 100;
  const height = values["height"] ?? values["h"] ?? values["branchHeight"] ?? 250;
  const radius = values["radius"] ?? values["r"] ?? values["bendRadius"] ?? 0;
  const angle = values["angle"] ?? values["bendAngle"] ?? 90;
  const gomos = values["segments"] ?? values["gomos"] ?? 0;
  const eccentricity = values["eccentricity"] ?? values["e"] ?? values["offsetX"] ?? 0;

  // Cálculo da escala de ajuste global
  const maxModelExtent = Math.max(d1, d2, height, radius * 2, 120);
  const targetScale = selectScale(maxModelExtent, drawingAreaW * 0.38);
  const scaleText = `1:${targetScale}`;
  const scaleFactor = 1 / targetScale;

  const views: TechnicalView[] = [];

  // =========================================================================
  // 1. VISTA FRONTAL (PROJEÇÃO ELEVAÇÃO PRINCIPAL)
  // =========================================================================
  const frontLines: TechnicalLine[] = [];
  const frontDims: TechnicalDimension[] = [];

  if (slug === "cone" || slug === "tronco-de-cone" || slug === "reducao-circular") {
    const rBottom = d1 / 2;
    const rTop = d2 / 2;
    const slant = Math.sqrt(Math.pow(rBottom - rTop, 2) + Math.pow(height, 2));

    frontLines.push({ x1: -rBottom, y1: height, x2: rBottom, y2: height, style: "visible" });
    frontLines.push({ x1: -rTop, y1: 0, x2: rTop, y2: 0, style: "visible" });
    frontLines.push({ x1: -rBottom, y1: height, x2: -rTop, y2: 0, style: "visible" });
    frontLines.push({ x1: rBottom, y1: height, x2: rTop, y2: 0, style: "visible" });
    frontLines.push({ x1: 0, y1: -12, x2: 0, y2: height + 12, style: "center" });

    frontDims.push({
      id: "front-d-bottom",
      type: "horizontal",
      x1: -rBottom,
      y1: height,
      x2: rBottom,
      y2: height,
      dimPos: height + 16,
      valueText: `Ø${fmt(d1)}`,
    });
    if (d2 > 0) {
      frontDims.push({
        id: "front-d-top",
        type: "horizontal",
        x1: -rTop,
        y1: 0,
        x2: rTop,
        y2: 0,
        dimPos: -16,
        valueText: `Ø${fmt(d2)}`,
      });
    }
    frontDims.push({
      id: "front-height",
      type: "vertical",
      x1: Math.max(rBottom, rTop),
      y1: height,
      x2: Math.max(rBottom, rTop),
      y2: 0,
      dimPos: Math.max(rBottom, rTop) + 16,
      valueText: `H=${fmt(height)}`,
    });
    frontDims.push({
      id: "front-slant",
      type: "aligned",
      x1: rBottom,
      y1: height,
      x2: rTop,
      y2: 0,
      dimPos: 12,
      valueText: `G=${fmt(slant)}`,
    });
  } else if (slug === "cone-excentrico") {
    const rBottom = d1 / 2;
    const rTop = d2 / 2;
    const topCenterX = eccentricity;

    frontLines.push({ x1: -rBottom, y1: height, x2: rBottom, y2: height, style: "visible" });
    frontLines.push({ x1: topCenterX - rTop, y1: 0, x2: topCenterX + rTop, y2: 0, style: "visible" });
    frontLines.push({ x1: -rBottom, y1: height, x2: topCenterX - rTop, y2: 0, style: "visible" });
    frontLines.push({ x1: rBottom, y1: height, x2: topCenterX + rTop, y2: 0, style: "visible" });
    frontLines.push({ x1: 0, y1: height - 10, x2: 0, y2: height + 12, style: "center" });
    frontLines.push({ x1: topCenterX, y1: -12, x2: topCenterX, y2: 12, style: "center" });

    frontDims.push({
      id: "front-d1",
      type: "horizontal",
      x1: -rBottom,
      y1: height,
      x2: rBottom,
      y2: height,
      dimPos: height + 16,
      valueText: `Ø${fmt(d1)}`,
    });
    frontDims.push({
      id: "front-d2",
      type: "horizontal",
      x1: topCenterX - rTop,
      y1: 0,
      x2: topCenterX + rTop,
      y2: 0,
      dimPos: -16,
      valueText: `Ø${fmt(d2)}`,
    });
    frontDims.push({
      id: "front-ecc",
      type: "horizontal",
      x1: 0,
      y1: 0,
      x2: topCenterX,
      y2: 0,
      dimPos: -28,
      valueText: `e=${fmt(eccentricity)}`,
    });
    frontDims.push({
      id: "front-h",
      type: "vertical",
      x1: rBottom + 10,
      y1: height,
      x2: rBottom + 10,
      y2: 0,
      dimPos: rBottom + 20,
      valueText: `H=${fmt(height)}`,
    });
  } else if (slug === "curva-de-gomos") {
    const R = radius || d1 * 1.5;
    const numGomos = Math.max(2, Math.round(gomos) || 4);
    const alphaRad = (angle * Math.PI) / 180;
    const rTube = d1 / 2;

    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a1 = (alphaRad * i) / steps;
      const a2 = (alphaRad * (i + 1)) / steps;
      frontLines.push({
        x1: R * Math.cos(a1),
        y1: -R * Math.sin(a1),
        x2: R * Math.cos(a2),
        y2: -R * Math.sin(a2),
        style: "center",
      });
      frontLines.push({
        x1: (R - rTube) * Math.cos(a1),
        y1: -(R - rTube) * Math.sin(a1),
        x2: (R - rTube) * Math.cos(a2),
        y2: -(R - rTube) * Math.sin(a2),
        style: "visible",
      });
      frontLines.push({
        x1: (R + rTube) * Math.cos(a1),
        y1: -(R + rTube) * Math.sin(a1),
        x2: (R + rTube) * Math.cos(a2),
        y2: -(R + rTube) * Math.sin(a2),
        style: "visible",
      });
    }

    // Seções oblíquas dos gomos
    const totalDivs = 2 * (numGomos - 1);
    for (let g = 0; g < numGomos; g++) {
      const divIdx = g === 0 ? 0 : g === numGomos - 1 ? totalDivs : 2 * g - 1;
      const ga = (alphaRad * divIdx) / totalDivs;
      const nx = Math.cos(ga);
      const ny = -Math.sin(ga);
      frontLines.push({
        x1: (R - rTube) * nx,
        y1: (R - rTube) * ny,
        x2: (R + rTube) * nx,
        y2: (R + rTube) * ny,
        style: "visible",
      });
    }

    frontDims.push({
      id: "curva-r",
      type: "aligned",
      x1: 0,
      y1: 0,
      x2: R,
      y2: 0,
      dimPos: 14,
      valueText: `R=${fmt(R)}`,
    });
    frontDims.push({
      id: "curva-d",
      type: "vertical",
      x1: R - rTube,
      y1: 0,
      x2: R + rTube,
      y2: 0,
      dimPos: -16,
      valueText: `Ø${fmt(d1)}`,
    });
  } else if (slug === "boca-de-lobo" || slug === "te") {
    const R1 = d1 / 2;
    const R2 = d2 / 2;
    const H = height;

    frontLines.push({ x1: -R1 * 2, y1: H, x2: R1 * 2, y2: H, style: "visible" });
    frontLines.push({ x1: -R1 * 2, y1: H + d1, x2: R1 * 2, y2: H + d1, style: "visible" });
    frontLines.push({ x1: -R1 * 2, y1: H, x2: -R1 * 2, y2: H + d1, style: "visible" });
    frontLines.push({ x1: R1 * 2, y1: H, x2: R1 * 2, y2: H + d1, style: "visible" });
    frontLines.push({ x1: -R1 * 2.3, y1: H + R1, x2: R1 * 2.3, y2: H + R1, style: "center" });

    frontLines.push({ x1: -R2, y1: 0, x2: R2, y2: 0, style: "visible" });
    frontLines.push({ x1: -R2, y1: 0, x2: -R2, y2: H + R1 * 0.35, style: "visible" });
    frontLines.push({ x1: R2, y1: 0, x2: R2, y2: H + R1 * 0.35, style: "visible" });
    frontLines.push({ x1: 0, y1: -12, x2: 0, y2: H + d1 + 8, style: "center" });

    const nPts = 16;
    for (let i = 0; i < nPts; i++) {
      const u1 = -R2 + (2 * R2 * i) / nPts;
      const u2 = -R2 + (2 * R2 * (i + 1)) / nPts;
      const v1 = H + Math.sqrt(Math.max(0, R1 * R1 - u1 * u1)) * 0.45;
      const v2 = H + Math.sqrt(Math.max(0, R1 * R1 - u2 * u2)) * 0.45;
      frontLines.push({ x1: u1, y1: v1, x2: u2, y2: v2, style: "visible" });
    }

    frontDims.push({
      id: "boca-d1",
      type: "vertical",
      x1: R1 * 2 + 10,
      y1: H,
      x2: R1 * 2 + 10,
      y2: H + d1,
      dimPos: R1 * 2 + 20,
      valueText: `Ø${fmt(d1)}`,
    });
    frontDims.push({
      id: "boca-d2",
      type: "horizontal",
      x1: -R2,
      y1: 0,
      x2: R2,
      y2: 0,
      dimPos: -16,
      valueText: `Ø${fmt(d2)}`,
    });
    frontDims.push({
      id: "boca-h",
      type: "vertical",
      x1: -R2 - 12,
      y1: H + R1,
      x2: -R2 - 12,
      y2: 0,
      dimPos: -R2 - 24,
      valueText: `H=${fmt(H)}`,
    });
  } else if (slug === "quadrado-redondo") {
    const baseA = values["baseA"] ?? 300;
    const topD = values["topDiameter"] ?? 150;
    const H = height;

    frontLines.push({ x1: -baseA / 2, y1: H, x2: baseA / 2, y2: H, style: "visible" });
    frontLines.push({ x1: -topD / 2, y1: 0, x2: topD / 2, y2: 0, style: "visible" });
    frontLines.push({ x1: -baseA / 2, y1: H, x2: -topD / 2, y2: 0, style: "visible" });
    frontLines.push({ x1: baseA / 2, y1: H, x2: topD / 2, y2: 0, style: "visible" });

    // Geratrizes intermediárias de dobra
    const nDiv = 3;
    for (let i = 1; i <= nDiv; i++) {
      const tx = -topD / 2 + (topD * i) / (nDiv + 1);
      frontLines.push({ x1: -baseA / 2, y1: H, x2: tx, y2: 0, style: "fold" });
      frontLines.push({ x1: baseA / 2, y1: H, x2: -tx, y2: 0, style: "fold" });
    }
    frontLines.push({ x1: 0, y1: -12, x2: 0, y2: H + 12, style: "center" });

    frontDims.push({
      id: "qr-base",
      type: "horizontal",
      x1: -baseA / 2,
      y1: H,
      x2: baseA / 2,
      y2: H,
      dimPos: H + 16,
      valueText: `A=${fmt(baseA)}`,
    });
    frontDims.push({
      id: "qr-top",
      type: "horizontal",
      x1: -topD / 2,
      y1: 0,
      x2: topD / 2,
      y2: 0,
      dimPos: -16,
      valueText: `Ø${fmt(topD)}`,
    });
    frontDims.push({
      id: "qr-h",
      type: "vertical",
      x1: baseA / 2 + 14,
      y1: H,
      x2: baseA / 2 + 14,
      y2: 0,
      dimPos: baseA / 2 + 24,
      valueText: `H=${fmt(H)}`,
    });
  } else {
    // Padrão Cilindro / Genérico
    const r = d1 / 2;
    frontLines.push({ x1: -r, y1: 0, x2: r, y2: 0, style: "visible" });
    frontLines.push({ x1: -r, y1: height, x2: r, y2: height, style: "visible" });
    frontLines.push({ x1: -r, y1: 0, x2: -r, y2: height, style: "visible" });
    frontLines.push({ x1: r, y1: 0, x2: r, y2: height, style: "visible" });
    frontLines.push({ x1: 0, y1: -12, x2: 0, y2: height + 12, style: "center" });

    frontDims.push({
      id: "cyl-d",
      type: "horizontal",
      x1: -r,
      y1: height,
      x2: r,
      y2: height,
      dimPos: height + 16,
      valueText: `Ø${fmt(d1)}`,
    });
    frontDims.push({
      id: "cyl-h",
      type: "vertical",
      x1: r + 10,
      y1: height,
      x2: r + 10,
      y2: 0,
      dimPos: r + 20,
      valueText: `H=${fmt(height)}`,
    });
  }

  // =========================================================================
  // 2. VISTA SUPERIOR (PROJEÇÃO EM PLANTA)
  // =========================================================================
  const topLines: TechnicalLine[] = [];
  const topDims: TechnicalDimension[] = [];

  const maxR = Math.max(d1, d2) / 2;
  const circleSteps = 24;
  for (let i = 0; i < circleSteps; i++) {
    const a1 = (TAU * i) / circleSteps;
    const a2 = (TAU * (i + 1)) / circleSteps;
    topLines.push({
      x1: (d1 / 2) * Math.cos(a1),
      y1: (d1 / 2) * Math.sin(a1),
      x2: (d1 / 2) * Math.cos(a2),
      y2: (d1 / 2) * Math.sin(a2),
      style: "visible",
    });
    if (d2 > 0 && d2 !== d1) {
      topLines.push({
        x1: (d2 / 2) * Math.cos(a1) + eccentricity,
        y1: (d2 / 2) * Math.sin(a1),
        x2: (d2 / 2) * Math.cos(a2) + eccentricity,
        y2: (d2 / 2) * Math.sin(a2),
        style: "visible",
      });
    }
  }
  topLines.push({ x1: -maxR * 1.25, y1: 0, x2: maxR * 1.25, y2: 0, style: "center" });
  topLines.push({ x1: 0, y1: -maxR * 1.25, x2: 0, y2: maxR * 1.25, style: "center" });

  if (slug === "quadrado-redondo") {
    const baseA = values["baseA"] ?? 300;
    const baseB = values["baseB"] ?? 300;
    topLines.push({ x1: -baseA / 2, y1: -baseB / 2, x2: baseA / 2, y2: -baseB / 2, style: "visible" });
    topLines.push({ x1: baseA / 2, y1: -baseB / 2, x2: baseA / 2, y2: baseB / 2, style: "visible" });
    topLines.push({ x1: baseA / 2, y1: baseB / 2, x2: -baseA / 2, y2: baseB / 2, style: "visible" });
    topLines.push({ x1: -baseA / 2, y1: baseB / 2, x2: -baseA / 2, y2: -baseB / 2, style: "visible" });

    // Geratrizes de transição dos 4 cantos para os 4 quadrantes
    const topR = (values["topDiameter"] ?? 150) / 2;
    for (let k = 0; k < 4; k++) {
      const cornerX = k === 0 || k === 3 ? -baseA / 2 : baseA / 2;
      const cornerY = k < 2 ? -baseB / 2 : baseB / 2;
      for (let s = 0; s <= 3; s++) {
        const ang = (Math.PI / 2) * k + (Math.PI / 6) * s;
        topLines.push({
          x1: cornerX,
          y1: cornerY,
          x2: topR * Math.cos(ang),
          y2: topR * Math.sin(ang),
          style: "fold",
        });
      }
    }

    topDims.push({
      id: "top-base-a",
      type: "horizontal",
      x1: -baseA / 2,
      y1: baseB / 2,
      x2: baseA / 2,
      y2: baseB / 2,
      dimPos: baseB / 2 + 14,
      valueText: `A=${fmt(baseA)}`,
    });
    topDims.push({
      id: "top-base-b",
      type: "vertical",
      x1: baseA / 2 + 10,
      y1: -baseB / 2,
      x2: baseA / 2 + 10,
      y2: baseB / 2,
      dimPos: baseA / 2 + 20,
      valueText: `B=${fmt(baseB)}`,
    });
  }

  // =========================================================================
  // 3. PERSPECTIVA TÉCNICA ISOMÉTRICA (DA MALHA SÓLIDA REAL wire.ts)
  // =========================================================================
  const isoLines: TechnicalLine[] = [];
  try {
    const wire = buildWire(slug, {
      d1,
      d2,
      h: height,
      r: radius,
      e: eccentricity,
      ang: angle,
      gomos,
      t: thicknessNum,
      seg: 28,
    } as WireParams);

    if (wire && wire.edges) {
      const cos30 = Math.cos(Math.PI / 6);
      const sin30 = Math.sin(Math.PI / 6);
      const bMin = wire.bounds.min;
      const bMax = wire.bounds.max;
      const cX = (bMin.x + bMax.x) / 2;
      const cY = (bMin.y + bMax.y) / 2;
      const cZ = (bMin.z + bMax.z) / 2;

      const step = Math.max(1, Math.floor(wire.edges.length / 220));
      for (let i = 0; i < wire.edges.length; i += step) {
        const edge = wire.edges[i];
        if (!edge) continue;
        const [p1, p2] = edge;
        const x1 = p1.x - cX;
        const y1 = p1.y - cY;
        const z1 = p1.z - cZ;
        const x2 = p2.x - cX;
        const y2 = p2.y - cY;
        const z2 = p2.z - cZ;

        const ix1 = (x1 - z1) * cos30;
        const iy1 = -y1 * 0.88 + (x1 + z1) * sin30 * 0.65;
        const ix2 = (x2 - z2) * cos30;
        const iy2 = -y2 * 0.88 + (x2 + z2) * sin30 * 0.65;

        isoLines.push({
          x1: ix1,
          y1: iy1,
          x2: ix2,
          y2: iy2,
          style: "visible",
        });
      }
    }
  } catch {
    // Fallback silencioso
  }

  // =========================================================================
  // 4. PLANIFICAÇÃO / DESENVOLVIMENTO (FLAT PATTERN REAL)
  // =========================================================================
  const devLines: TechnicalLine[] = [];
  const devDims: TechnicalDimension[] = [];

  if (result && result.development) {
    const dev = result.development;
    const pts = dev.outline;
    if (pts.length > 2) {
      const b = dev.bounds;
      const devW = Math.max(1, b.maxX - b.minX);
      const devH = Math.max(1, b.maxY - b.minY);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;

      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i]!;
        const p2 = pts[(i + 1) % pts.length]!;
        devLines.push({
          x1: p1.x - cx,
          y1: p1.y - cy,
          x2: p2.x - cx,
          y2: p2.y - cy,
          style: "visible",
        });
      }

      const foldStep = Math.max(1, Math.floor(dev.foldLines.length / 32));
      for (let f = 0; f < dev.foldLines.length; f += foldStep) {
        const fold = dev.foldLines[f];
        if (!fold) continue;
        devLines.push({
          x1: fold.a.x - cx,
          y1: fold.a.y - cy,
          x2: fold.b.x - cx,
          y2: fold.b.y - cy,
          style: "fold",
        });
      }

      devDims.push({
        id: "dev-w",
        type: "horizontal",
        x1: -devW / 2,
        y1: devH / 2,
        x2: devW / 2,
        y2: devH / 2,
        dimPos: devH / 2 + 14,
        valueText: `Largura chapa: ${fmt(devW)}`,
      });
      devDims.push({
        id: "dev-h",
        type: "vertical",
        x1: devW / 2 + 10,
        y1: devH / 2,
        x2: devW / 2 + 10,
        y2: -devH / 2,
        dimPos: devW / 2 + 20,
        valueText: `Comp: ${fmt(devH)}`,
      });
    }
  }

  // =========================================================================
  // 5. VISTA DE DETALHE TÉCNICO (DETALHE A) QUANDO APLICÁVEL
  // =========================================================================
  const detailLines: TechnicalLine[] = [];
  const detailDims: TechnicalDimension[] = [];
  let detailTitle = "";
  let detailSubtitle = "";

  if (slug === "boca-de-lobo" || slug === "te") {
    detailTitle = "DETALHE A — INTERSEÇÃO";
    detailSubtitle = "Encaixe canônico e bisel de solda";
    // Círculo de contorno do detalhe
    const dr = 24;
    for (let i = 0; i < 24; i++) {
      const a1 = (TAU * i) / 24;
      const a2 = (TAU * (i + 1)) / 24;
      detailLines.push({
        x1: dr * Math.cos(a1),
        y1: dr * Math.sin(a1),
        x2: dr * Math.cos(a2),
        y2: dr * Math.sin(a2),
        style: "border",
      });
    }
    // Raiz de solda e bisel de penetração
    detailLines.push({ x1: -16, y1: 8, x2: 16, y2: 8, style: "visible" });
    detailLines.push({ x1: -16, y1: 8 + thicknessNum, x2: 16, y2: 8 + thicknessNum, style: "visible" });
    detailLines.push({ x1: 0, y1: -18, x2: 0, y2: 8, style: "visible" });
    detailLines.push({ x1: thicknessNum, y1: -18, x2: thicknessNum, y2: 8, style: "visible" });
    detailLines.push({ x1: -2, y1: -20, x2: 10, y2: -20, style: "center" });

    detailDims.push({
      id: "det-gap",
      type: "aligned",
      x1: 0,
      y1: 8,
      x2: 0,
      y2: 8 - 1.5,
      dimPos: 6,
      valueText: "Fresta: 1.5mm",
    });
  } else if (slug === "curva-de-gomos") {
    detailTitle = "DETALHE A — EMENDA DE GOMO";
    detailSubtitle = "Bissetriz angular e folga de raiz";
    const dr = 24;
    for (let i = 0; i < 24; i++) {
      const a1 = (TAU * i) / 24;
      const a2 = (TAU * (i + 1)) / 24;
      detailLines.push({
        x1: dr * Math.cos(a1),
        y1: dr * Math.sin(a1),
        x2: dr * Math.cos(a2),
        y2: dr * Math.sin(a2),
        style: "border",
      });
    }
    const miterAng = angle / (2 * (Math.max(2, gomos) - 1));
    detailLines.push({ x1: -18, y1: 0, x2: 18, y2: 0, style: "center" });
    detailLines.push({ x1: -15, y1: -10, x2: 0, y2: 0, style: "visible" });
    detailLines.push({ x1: 15, y1: -10, x2: 0, y2: 0, style: "visible" });
    detailDims.push({
      id: "det-miter",
      type: "aligned",
      x1: -10,
      y1: -6,
      x2: 0,
      y2: 0,
      dimPos: 8,
      valueText: `Bissetriz: ${fmt(miterAng)}°`,
    });
  }

  // =========================================================================
  // 6. ENQUADRAMENTO E DISTRIBUIÇÃO DAS VISTAS NA FOLHA
  // =========================================================================
  const col1W = drawingAreaW * 0.47;
  const col2W = drawingAreaW * 0.49;
  const col2X = margin + col1W + drawingAreaW * 0.04;

  const row1H = drawingAreaH * 0.50;
  const row2H = drawingAreaH * 0.46;
  const row2Y = drawingAreaY + row1H + drawingAreaH * 0.04;

  // 1. Vista Frontal
  views.push({
    id: "front",
    title: "VISTA FRONTAL",
    ox: margin + col1W * 0.5,
    oy: drawingAreaY + row1H * 0.46,
    width: col1W,
    height: row1H,
    scale: scaleFactor,
    lines: frontLines,
    dimensions: frontDims,
    subtitles: [`ESCALA ${scaleText}`, "Elevação principal"],
  });

  // 2. Vista Superior
  views.push({
    id: "top",
    title: "VISTA SUPERIOR",
    ox: margin + col1W * 0.5,
    oy: row2Y + row2H * 0.46,
    width: col1W,
    height: row2H,
    scale: scaleFactor,
    lines: topLines,
    dimensions: topDims,
    subtitles: [`ESCALA ${scaleText}`, "Projeção 1º Diedro"],
  });

  // 3. Perspectiva Isométrica (3D)
  if (isoLines.length > 0) {
    views.push({
      id: "iso",
      title: "PERSPECTIVA TÉCNICA",
      ox: col2X + col2W * 0.5,
      oy: drawingAreaY + row1H * 0.46,
      width: col2W,
      height: row1H,
      scale: scaleFactor * 0.85,
      lines: isoLines,
      dimensions: [],
      subtitles: ["Isométrica 30° / 30°", "Geometria wireframe canônica"],
    });
  }

  // 4. Planificação (Flat Pattern)
  if (devLines.length > 0) {
    views.push({
      id: "development",
      title: "PLANIFICAÇÃO (FLAT PATTERN)",
      ox: col2X + (detailLines.length > 0 ? col2W * 0.38 : col2W * 0.5),
      oy: row2Y + row2H * 0.46,
      width: detailLines.length > 0 ? col2W * 0.72 : col2W,
      height: row2H,
      scale: scaleFactor * 0.70,
      lines: devLines,
      dimensions: devDims,
      subtitles: ["Contorno de corte e linhas de dobra", "Dimensões verdadeiras em mm"],
    });
  }

  // 5. Detalhe Ampliado (quando aplicável)
  if (detailLines.length > 0) {
    views.push({
      id: "detail-a",
      title: detailTitle,
      ox: col2X + col2W * 0.84,
      oy: row2Y + row2H * 0.46,
      width: col2W * 0.28,
      height: row2H,
      scale: 1.0,
      lines: detailLines,
      dimensions: detailDims,
      subtitles: ["ESCALA 1:1", detailSubtitle],
      isDetail: true,
    });
  }

  // =========================================================================
  // 7. NOTAS TÉCNICAS (DADOS REAIS DO MODELO)
  // =========================================================================
  const notes: string[] = [
    "1. Dimensões em milímetros (mm). Não escalar diretamente o desenho.",
    "2. Projeção ortográfica conforme norma ABNT NBR 10068 / ISO 5456 — 1º Diedro.",
    `3. Método de traçado: ${geomEntry?.method || "Geometria de caldeiraria industrial"}.`,
    `4. Material: ${material} · Espessura nominal: ${thicknessVal}.`,
  ];

  if (gomos > 0) {
    notes.push(`5. Curva segmentada composta por ${gomos} gomos com ângulo de deflexão de ${angle}°.`);
  }
  if (result?.areaMm2) {
    const areaM2 = (result.areaMm2 / 1_000_000).toFixed(3);
    notes.push(`6. Área desenvolvida da chapa: ${areaM2} m².`);
  }
  if (estimatedMassKg) {
    notes.push(`7. Massa teórica estimada (aço 7.85 kg/dm³): ${estimatedMassKg.toFixed(2)} kg.`);
  }
  if (result?.warnings && result.warnings.length > 0) {
    result.warnings.slice(0, 2).forEach((w, idx) => {
      notes.push(`${8 + idx}. ${w}`);
    });
  }
  notes.push("Zero Fresta: conferir folgas de montagem e abertura de raiz antes da soldagem final.");

  // =========================================================================
  // 8. QUADRO TÉCNICO (INSPIRADO NA ESCADA RETA / CALDRA)
  // =========================================================================
  const titleBlock: TitleBlockData = {
    bx: titleBlockX,
    by: titleBlockY,
    bw: titleBlockW,
    bh: titleBlockH,
    fields: [
      // Linha 0
      { col: 1, row: 0, title: "PROJETO", value: options.projectName || "CALDRA — Traçagem" },
      { col: 2, row: 0, title: "CÓDIGO", value: codeVal },
      { col: 3, row: 0, title: "REVISÃO", value: revVal },
      // Linha 1
      { col: 0, row: 1, title: "PEÇA", value: modelName },
      { col: 1, row: 1, title: "MATERIAL", value: material },
      { col: 2, row: 1, title: "ESPESSURA", value: thicknessVal },
      { col: 3, row: 1, title: "UNIDADE", value: "mm" },
      // Linha 2
      { col: 0, row: 2, title: "DATA", value: dateStr },
      { col: 1, row: 2, title: "QUANTIDADE", value: `${quantityVal} un` },
      { col: 2, row: 2, title: "MASSA EST.", value: estimatedMassKg ? `${estimatedMassKg.toFixed(2)} kg` : "—" },
      { col: 3, row: 2, title: "ESCALA", value: scaleText },
    ],
  };

  // =========================================================================
  // 9. LISTA DE VERIFICAÇÃO / VALIDAÇÃO PRÉ-EXPORTAÇÃO
  // =========================================================================
  const checks: SheetValidationItem[] = [
    {
      id: "views-present",
      label: "Vistas técnicas ortográficas presentes",
      passed: views.length >= 2,
    },
    {
      id: "dimensions-valid",
      label: "Cotagem dimensional associativa gerada",
      passed: frontDims.length > 0 || devDims.length > 0,
    },
    {
      id: "scale-valid",
      label: `Escala técnica normativa (${scaleText})`,
      passed: targetScale >= 1,
    },
    {
      id: "dev-pattern",
      label: "Planificação (Flat Pattern) vetorial",
      passed: devLines.length > 0,
    },
    {
      id: "title-block",
      label: "Quadro técnico e identificação completos",
      passed: !!modelName && !!codeVal,
    },
  ];

  return {
    sheetW,
    sheetH,
    paperSize,
    orientation,
    theme,
    scaleText,
    scaleDenom: targetScale,
    margin,
    header,
    views,
    notes,
    titleBlock,
    validation: {
      valid: checks.every((c) => c.passed),
      checks,
    },
    modelName,
    modelSlug,
    dateStr,
    estimatedMassKg,
  };
}
