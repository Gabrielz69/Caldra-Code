// @ts-nocheck
/**
 * CALDRA CAD — DRAFTING ENGINE (FASE 09)
 *
 * Gerador paramétrico de pranchas técnicas de fabricação:
 * - Vistas ortográficas em 1º diedro (ABNT / ISO) e 3º diedro (ANSI);
 * - Enquadramento e escalonamento automático (1:1, 1:2, 1:5, 1:10);
 * - Tabela de dobras analítica com cálculo de dedução e abertura de matriz em V;
 * - Bloco de título (legenda) industrial completo com cálculo automático de massa;
 * - Cotagem e anotações técnicas normalizadas.
 */

import { computeBounds, type SolidBody3D, type SheetMetalBody } from "../canonical";
import type { PartDocument } from "../kernel/types";
import { ProjectionEngine } from "./projectionEngine";
import type {
  SheetSize,
  TechnicalDrawingSheet,
  DrawingView,
  TitleBlock,
  BendTable,
  BendTableRow,
  BOMTableRow,
  ProjectionAngle,
} from "./types";
import { SheetMetalEngine } from "../sheetmetal/sheetMetalEngine";

export interface DraftingOptions {
  sheetSize?: SheetSize;
  projectionAngle?: ProjectionAngle;
  scale?: number;
  includeBendTable?: boolean;
  includeFlatPatternView?: boolean;
  author?: string;
  approver?: string;
  company?: string;
  notes?: string[];
}

export class DraftingEngine {
  /**
   * Dimensões em mm dos formatos padrão da folha.
   */
  static getSheetDimensions(size: SheetSize): { widthMm: number; heightMm: number } {
    switch (size) {
      case "A4_PORTRAIT":
        return { widthMm: 210, heightMm: 297 };
      case "A3_LANDSCAPE":
        return { widthMm: 420, heightMm: 297 };
      case "A2_LANDSCAPE":
        return { widthMm: 594, heightMm: 420 };
      case "A4_LANDSCAPE":
      default:
        return { widthMm: 297, heightMm: 210 };
    }
  }

  /**
   * Gera a prancha técnica completa a partir de um documento de peça do CALDRA.
   */
  static generateDrawing(doc: PartDocument, options: DraftingOptions = {}): TechnicalDrawingSheet {
    const size = options.sheetSize ?? "A4_LANDSCAPE";
    const { widthMm, heightMm } = this.getSheetDimensions(size);
    const marginMm = 10;
    const projection = options.projectionAngle ?? "FIRST_ANGLE";
    const author = options.author ?? "PROJETISTA CALDRA";
    const approver = options.approver ?? "ENG. MECÂNICA";
    const company = options.company ?? "CALDRA INDUSTRIAL CAD";

    // 1. Identifica corpo 3D ativo
    const solid = doc.activeSolid as (SolidBody3D | SheetMetalBody) | undefined;
    if (!solid) {
      throw new Error(
        `O documento "${doc.name}" não possui corpo 3D sólido para gerar prancha técnica.`,
      );
    }

    // 2. Calcula massa estimada da peça
    const solidBody = (solid as SheetMetalBody).solidBody || (solid as SolidBody3D);
    const volumeMm3 = solidBody.volume ?? (solid as SolidBody3D).volume ?? 1000;
    const density = doc.density || 7.85; // g/cm³ (aço padrão)
    const massKg = Math.round(((volumeMm3 * density) / 1_000_000) * 1000) / 1000;

    // 3. Determina escala ideal para a folha
    const autoScale = options.scale ?? this.calculateOptimalScale(solid, widthMm, heightMm);
    const scaleLabel =
      autoScale === 1
        ? "1:1"
        : autoScale < 1
          ? `1:${Math.round(1 / autoScale)}`
          : `${Math.round(autoScale)}:1`;

    // 4. Gera vistas ortográficas principais
    const views: DrawingView[] = [];

    const frontView = ProjectionEngine.generateView(solid, "FRONT", { scale: autoScale });
    const topView = ProjectionEngine.generateView(solid, "TOP", { scale: autoScale });
    const rightView = ProjectionEngine.generateView(solid, "RIGHT", { scale: autoScale });
    const isoView = ProjectionEngine.generateView(solid, "ISOMETRIC", {
      scale: autoScale * 0.75,
      autoDimensions: false,
    });

    // Posiciona as vistas na folha
    // Área útil da folha
    const usableW = widthMm - marginMm * 2 - 10;
    const usableH = heightMm - marginMm * 2 - 45; // 45mm reservados para carimbo e tabela

    // Em 1º diedro (ABNT / ISO):
    // Frontal: inferior esquerdo
    // Superior: acima da Frontal
    // Lateral: à direita da Frontal
    const frontOrigin = { x: marginMm + usableW * 0.25, y: marginMm + usableH * 0.35 };
    const topOrigin = { x: marginMm + usableW * 0.25, y: marginMm + usableH * 0.75 };
    const rightOrigin = { x: marginMm + usableW * 0.6, y: marginMm + usableH * 0.35 };
    const isoOrigin = { x: marginMm + usableW * 0.75, y: marginMm + usableH * 0.75 };

    this.translateView(frontView, frontOrigin);
    this.translateView(topView, topOrigin);
    this.translateView(rightView, rightOrigin);
    this.translateView(isoView, isoOrigin);

    views.push(frontView, topView, rightView, isoView);

    // 5. Tabela de dobras analítica (se for peça de chapa dobrada)
    let bendTable: BendTable | undefined;
    const bendFeatures = doc.featureTree.getFeatures().filter((f) => f.type === "bend");

    if (options.includeBendTable !== false && (bendFeatures.length > 0 || doc.flatPatternResult)) {
      const rows: BendTableRow[] = [];
      const t = doc.thickness;

      // Matriz em V recomendada para dobradeiras hidráulicas/CNC
      const vDie = t <= 3.0 ? Math.max(8, Math.round(t * 8)) : Math.round(t * 8);

      bendFeatures.forEach((feat, idx) => {
        const angleDeg = (feat.parameters.angleDeg as number) || 90;
        const radius = (feat.parameters.radiusMm as number) || doc.innerRadius || 2.0;
        const kFactor = (feat.parameters.kFactor as number) || doc.kFactor || 0.44;
        const bd = SheetMetalEngine.computeBendDeduction(angleDeg, radius, t, kFactor);

        rows.push({
          index: idx + 1,
          tag: `D${idx + 1}`,
          direction: angleDeg > 0 ? "UP" : "DOWN",
          angleDeg: Math.abs(angleDeg),
          insideRadiusMm: radius,
          bendDeductionMm: Math.round(bd * 100) / 100,
          kFactor,
          recommendedVDieMm: vDie,
        });
      });

      if (rows.length > 0) {
        bendTable = {
          title: "TABELA DE DOBRAS INDUSTRIAL",
          rows,
        };
      }
    }

    // 6. Lista de materiais / BOM básico
    const bomTable: BOMTableRow[] = [
      {
        item: 1,
        partNumber: doc.id.slice(0, 8).toUpperCase(),
        description: doc.name.toUpperCase(),
        material: doc.material,
        thicknessMm: doc.thickness,
        quantity: 1,
        massKg,
      },
    ];

    // 7. Bloco de Título Técnico Normalizado (Carimbo ABNT)
    const titleBlock: TitleBlock = {
      drawingNumber: `DWG-${doc.id.slice(0, 6).toUpperCase()}-R0`,
      title: doc.name.toUpperCase(),
      author,
      approver,
      company,
      date: new Date(doc.updatedAt || Date.now()).toLocaleDateString("pt-BR"),
      scale: scaleLabel,
      sheetNumber: "1 / 1",
      sheetSize: size,
      material: `${doc.material} (e=${doc.thickness}mm)`,
      thicknessMm: doc.thickness,
      estimatedMassKg: massKg,
      tolerance: "ISO 2768-m (MÉDIA)",
      projection,
    };

    const generalNotes = options.notes ?? [
      "1. DIMENSÕES EM MILÍMETROS (mm). NÃO ESCALAR ESTE DESENHO.",
      "2. TOLERÂNCIAS GERAIS CONFORME NORMA ISO 2768-m.",
      `3. MATERIAL CONFORME ESPECIFICADO: ${doc.material.toUpperCase()}, ESPESSURA ${doc.thickness} mm.`,
      "4. REMOVER REBARBAS E ARESTAS CORTANTES APÓS O CORTE CNC.",
      "5. LINHAS DE DOBRA DEVEM SER POSICIONADAS COM TOLERÂNCIA DE ±0.2 mm.",
    ];

    return {
      id: `sheet-${doc.id}`,
      title: `DESENHO TÉCNICO: ${doc.name}`,
      size,
      widthMm,
      heightMm,
      marginMm,
      projection,
      scale: autoScale,
      scaleLabel,
      titleBlock,
      views,
      bendTable,
      bomTable,
      generalNotes,
    };
  }

  /**
   * Desloca todos os elementos de uma vista para uma nova posição de origem na folha.
   */
  private static translateView(view: DrawingView, targetOrigin: { x: number; y: number }): void {
    const curCenterX = (view.boundingBox.minX + view.boundingBox.maxX) / 2;
    const curCenterY = (view.boundingBox.minY + view.boundingBox.maxY) / 2;
    const dx = targetOrigin.x - curCenterX;
    const dy = targetOrigin.y - curCenterY;

    view.origin = targetOrigin;
    view.boundingBox.minX += dx;
    view.boundingBox.maxX += dx;
    view.boundingBox.minY += dy;
    view.boundingBox.maxY += dy;

    for (const line of view.lines) {
      line.start.x += dx;
      line.start.y += dy;
      line.end.x += dx;
      line.end.y += dy;
    }

    for (const arc of view.arcs) {
      arc.center.x += dx;
      arc.center.y += dy;
    }

    for (const dim of view.dimensions) {
      dim.p1.x += dx;
      dim.p1.y += dy;
      dim.p2.x += dx;
      dim.p2.y += dy;
      dim.textPos.x += dx;
      dim.textPos.y += dy;
    }

    for (const ann of view.annotations) {
      ann.pos.x += dx;
      ann.pos.y += dy;
    }
  }

  /**
   * Determina a escala normalizada ideal (1:1, 1:2, 1:5, 1:10) para caber na folha.
   */
  private static calculateOptimalScale(
    solid: SolidBody3D | SheetMetalBody,
    sheetW: number,
    sheetH: number,
  ): number {
    const solidBody = (solid as SheetMetalBody).solidBody || (solid as SolidBody3D);
    const bounds = solidBody.bounds || computeBounds(solidBody.vertices || []);
    const partW = Math.max(10, bounds.maxX - bounds.minX);
    const partH = Math.max(10, bounds.maxY - bounds.minY);
    const partD = Math.max(10, bounds.maxZ - bounds.minZ);

    const maxDim = Math.max(partW, partH, partD);
    const availableSpace = Math.min(sheetW, sheetH) * 0.35; // Espaço disponível para a maior vista

    if (maxDim <= availableSpace * 0.5) return 2.0; // 2:1 ampliação
    if (maxDim <= availableSpace) return 1.0; // 1:1 tamanho real
    if (maxDim <= availableSpace * 2) return 0.5; // 1:2 redução
    if (maxDim <= availableSpace * 5) return 0.2; // 1:5 redução
    return 0.1; // 1:10 redução
  }
}
