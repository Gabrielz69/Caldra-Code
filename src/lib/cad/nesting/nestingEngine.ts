// @ts-nocheck
/**
 * CALDRA CAD — INDUSTRIAL MULTI-SHEET NESTING ENGINE (FASE 11)
 *
 * Motor analítico de aninhamento 2D de blanks industriais, rotação por grão/veio,
 * consolidação por espessura/material, detecção de corte comum (common-line cutting),
 * aproveitamento de retalhos (remnants) e métricas de fabricação de chapas.
 */

import type {
  NestingBlank,
  NestingOptions,
  NestingSheetStock,
  NestingJobResult,
  NestedSheet,
  PlacedBlank,
  CommonLineCut,
  SheetRemnant,
} from "./types";

const DENSITY_MAP: Record<string, number> = {
  carbon_steel: 7.85e-6, // kg/mm³
  stainless: 8.0e-6,
  aluminum: 2.7e-6,
  copper: 8.96e-6,
  brass: 8.5e-6,
};

function resolveDensity(material: string): number {
  const norm = material.toLowerCase();
  if (
    norm.includes("inox") ||
    norm.includes("stainless") ||
    norm.includes("304") ||
    norm.includes("316")
  ) {
    return DENSITY_MAP.stainless;
  }
  if (norm.includes("alu") || norm.includes("5052") || norm.includes("6061")) {
    return DENSITY_MAP.aluminum;
  }
  if (norm.includes("cobr") || norm.includes("copper")) {
    return DENSITY_MAP.copper;
  }
  if (norm.includes("lat") || norm.includes("brass")) {
    return DENSITY_MAP.brass;
  }
  return DENSITY_MAP.carbon_steel;
}

interface Shelf {
  y: number;
  height: number;
  cursorX: number;
  blanks: PlacedBlank[];
}

export class NestingEngine {
  /**
   * Executa o aninhamento industrial de múltiplos blanks sobre chapas comerciais.
   */
  static runNesting(blanks: NestingBlank[], options?: Partial<NestingOptions>): NestingJobResult {
    const opts: NestingOptions = {
      partSpacingMm: options?.partSpacingMm ?? 5,
      kerfMm: options?.kerfMm ?? 1.5,
      allowRotation: options?.allowRotation ?? true,
      enableCommonLineCut: options?.enableCommonLineCut ?? false,
      minRemnantAreaMm2: options?.minRemnantAreaMm2 ?? 60000, // 200x300mm
      algorithm: options?.algorithm ?? "MAX_RECTS",
      sheetStock: options?.sheetStock,
    };

    // Agrupar blanks por [material, espessura]
    const groupedBlanks = new Map<string, NestingBlank[]>();
    for (const b of blanks) {
      const key = `${b.material.trim().toLowerCase()}__${b.thickness}`;
      if (!groupedBlanks.has(key)) {
        groupedBlanks.set(key, []);
      }
      groupedBlanks.get(key)!.push(b);
    }

    const allSheets: NestedSheet[] = [];
    const unplacedList: { name: string; quantity: number; reason: string }[] = [];
    let sheetGlobalIndex = 1;

    for (const [, group] of groupedBlanks) {
      const sample = group[0];
      const stock: NestingSheetStock = opts.sheetStock ?? {
        id: `STD_${sample.material}_${sample.thickness}mm`,
        name: `Chapa Comercial ${sample.material} # ${sample.thickness}mm (3000x1500)`,
        width: 3000,
        height: 1500,
        thickness: sample.thickness,
        material: sample.material,
        borderMarginMm: 10,
        clampMarginMm: 0,
      };

      const groupResult = this.nestSingleGroup(group, stock, opts, sheetGlobalIndex);
      allSheets.push(...groupResult.sheets);
      unplacedList.push(...groupResult.unplaced);
      sheetGlobalIndex += groupResult.sheets.length;
    }

    // Totais e métricas globais
    let totalBlanksRequested = 0;
    for (const b of blanks) totalBlanksRequested += b.quantity;

    let totalBlanksPlaced = 0;
    let totalSheetWeightKg = 0;
    let totalPartsWeightKg = 0;
    let totalScrapWeightKg = 0;
    let totalAreaUsedMm2 = 0;
    let totalSheetAreaMm2 = 0;
    let totalCommonLineSavedLengthMm = 0;
    const allRemnants: SheetRemnant[] = [];

    for (const sheet of allSheets) {
      totalBlanksPlaced += sheet.placements.length;
      totalSheetWeightKg += sheet.totalSheetWeightKg;
      totalPartsWeightKg += sheet.totalPartWeightKg;
      totalScrapWeightKg += sheet.scrapWeightKg;
      totalAreaUsedMm2 += sheet.usedAreaMm2;
      totalSheetAreaMm2 += sheet.totalSheetAreaMm2;
      allRemnants.push(...sheet.remnants);
      for (const cl of sheet.commonLines) {
        totalCommonLineSavedLengthMm += cl.lengthMm;
      }
    }

    const globalEfficiency =
      totalSheetAreaMm2 > 0 ? (totalAreaUsedMm2 / totalSheetAreaMm2) * 100 : 0;

    return {
      id: `NEST_${Date.now()}`,
      createdAt: new Date().toISOString(),
      totalBlanksRequested,
      totalBlanksPlaced,
      unplacedBlanks: unplacedList,
      sheets: allSheets,
      globalEfficiencyPercent: Number(globalEfficiency.toFixed(2)),
      totalSheetWeightKg: Number(totalSheetWeightKg.toFixed(2)),
      totalPartsWeightKg: Number(totalPartsWeightKg.toFixed(2)),
      totalScrapWeightKg: Number(totalScrapWeightKg.toFixed(2)),
      totalCommonLineSavedLengthMm: Number(totalCommonLineSavedLengthMm.toFixed(1)),
      totalRemnantsGenerated: allRemnants,
    };
  }

  /**
   * Aninhamento determinístico para um grupo específico de mesma espessura e material.
   */
  private static nestSingleGroup(
    blanks: NestingBlank[],
    stock: NestingSheetStock,
    opts: NestingOptions,
    startSheetIndex: number,
  ): { sheets: NestedSheet[]; unplaced: { name: string; quantity: number; reason: string }[] } {
    const margin = stock.borderMarginMm;
    const usableW = stock.width - margin * 2;
    const usableH = stock.height - margin * 2;
    const spacing = opts.enableCommonLineCut ? 0 : opts.partSpacingMm;

    // Desmembrar quantidades individuais e ordenar decrescente
    const queue: { blank: NestingBlank; instanceIndex: number }[] = [];
    const unplaced: { name: string; quantity: number; reason: string }[] = [];

    for (const b of blanks) {
      const fitsDirect = b.width <= usableW && b.height <= usableH;
      const canRotate = this.canRotateBlank(b, opts.allowRotation);
      const fitsRotated = canRotate && b.height <= usableW && b.width <= usableH;

      if (!fitsDirect && !fitsRotated) {
        unplaced.push({
          name: b.name,
          quantity: b.quantity,
          reason: `Dimensões (${b.width}x${b.height}mm) excedem a área útil da chapa (${usableW}x${usableH}mm)`,
        });
        continue;
      }

      for (let i = 1; i <= Math.max(1, Math.round(b.quantity)); i++) {
        queue.push({ blank: b, instanceIndex: i });
      }
    }

    // Ordenação BFD (Best Fit Decreasing) por área e maior lado
    queue.sort((a, b) => {
      const areaA = a.blank.width * a.blank.height;
      const areaB = b.blank.width * b.blank.height;
      if (Math.abs(areaB - areaA) > 1e-4) return areaB - areaA;
      return Math.max(b.blank.width, b.blank.height) - Math.max(a.blank.width, a.blank.height);
    });

    const sheets: NestedSheet[] = [];
    const shelvesPerSheet: Shelf[][] = [];

    const createSheet = (): number => {
      const sheetIndex = startSheetIndex + sheets.length;
      sheets.push({
        sheetIndex,
        stock,
        placements: [],
        commonLines: [],
        remnants: [],
        usedAreaMm2: 0,
        totalSheetAreaMm2: stock.width * stock.height,
        efficiencyPercent: 0,
        scrapPercent: 100,
        totalPartWeightKg: 0,
        totalSheetWeightKg: 0,
        scrapWeightKg: 0,
        estimatedCutTimeMinutes: 0,
        pierceCount: 0,
      });
      shelvesPerSheet.push([]);
      return sheets.length - 1;
    };

    for (const item of queue) {
      const b = item.blank;
      const canRotate = this.canRotateBlank(b, opts.allowRotation);
      let placed = false;

      for (let s = 0; s < sheets.length && !placed; s++) {
        placed = this.tryPlaceInSheet(
          s,
          sheets,
          shelvesPerSheet,
          item,
          canRotate,
          margin,
          usableW,
          usableH,
          spacing,
        );
      }

      if (!placed) {
        const newSheetIdx = createSheet();
        placed = this.tryPlaceInSheet(
          newSheetIdx,
          sheets,
          shelvesPerSheet,
          item,
          canRotate,
          margin,
          usableW,
          usableH,
          spacing,
        );
        if (!placed) {
          unplaced.push({
            name: b.name,
            quantity: 1,
            reason: "Não foi possível alocar no espaço útil",
          });
        }
      }
    }

    // Processamento pós-aninhamento para cada chapa
    const density = resolveDensity(stock.material);
    const sheetVolumeMm3 = stock.width * stock.height * stock.thickness;
    const sheetWeightKg = sheetVolumeMm3 * density;

    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      const shelves = shelvesPerSheet[s];

      // Detecção de corte comum se habilitado
      if (opts.enableCommonLineCut) {
        sheet.commonLines = this.detectCommonLines(sheet.placements);
      }

      // Detecção de retalho aproveitável (Remnant)
      sheet.remnants = this.extractRemnants(
        sheet,
        shelves,
        stock,
        margin,
        opts.minRemnantAreaMm2 ?? 60000,
        density,
      );

      // Métricas e massa
      let partsArea = 0;
      let totalPerimeter = 0;
      let totalPierces = 0;

      for (const p of sheet.placements) {
        partsArea += p.width * p.height;
        totalPerimeter += 2 * (p.width + p.height);
        totalPierces += 1 + (p.internalHoles?.length ?? 0);
      }

      // Descontar linhas comuns do perímetro e furações
      let savedLength = 0;
      for (const cl of sheet.commonLines) {
        savedLength += cl.lengthMm;
      }
      const actualCutPerimeterMm = Math.max(0, totalPerimeter - savedLength);
      const actualPierces = Math.max(1, totalPierces - sheet.commonLines.length);

      const partsWeightKg = partsArea * stock.thickness * density;
      const efficiency = (partsArea / (stock.width * stock.height)) * 100;
      const scrapWeight = Math.max(0, sheetWeightKg - partsWeightKg);

      // Velocidade estimada laser: ~2500 mm/min, pierce: ~1.2s (0.02 min)
      const cutTimeMinutes = actualCutPerimeterMm / 2500 + actualPierces * 0.02;

      sheet.usedAreaMm2 = partsArea;
      sheet.efficiencyPercent = Number(efficiency.toFixed(2));
      sheet.scrapPercent = Number((100 - efficiency).toFixed(2));
      sheet.totalPartWeightKg = Number(partsWeightKg.toFixed(2));
      sheet.totalSheetWeightKg = Number(sheetWeightKg.toFixed(2));
      sheet.scrapWeightKg = Number(scrapWeight.toFixed(2));
      sheet.estimatedCutTimeMinutes = Number(cutTimeMinutes.toFixed(1));
      sheet.pierceCount = actualPierces;
    }

    return { sheets, unplaced };
  }

  /**
   * Tenta posicionar uma peça em prateleiras existentes ou abrir nova prateleira.
   */
  private static tryPlaceInSheet(
    sheetIndex: number,
    sheets: NestedSheet[],
    shelvesPerSheet: Shelf[][],
    item: { blank: NestingBlank; instanceIndex: number },
    canRotate: boolean,
    margin: number,
    usableW: number,
    usableH: number,
    spacing: number,
  ): boolean {
    const sheet = sheets[sheetIndex];
    const shelves = shelvesPerSheet[sheetIndex];
    const b = item.blank;

    const variants: { w: number; h: number; rotated: boolean }[] = [
      { w: b.width, h: b.height, rotated: false },
    ];
    if (canRotate && Math.abs(b.width - b.height) > 1e-4) {
      variants.push({ w: b.height, h: b.width, rotated: true });
    }

    // 1. Procurar melhor prateleira existente (menor folga vertical)
    let bestShelf: { shelf: Shelf; variant: (typeof variants)[0]; wasteY: number } | null = null;
    for (const shelf of shelves) {
      for (const v of variants) {
        const reqX = shelf.cursorX + (shelf.blanks.length > 0 ? spacing : 0) + v.w;
        if (reqX > margin + usableW + 1e-4) continue;
        if (v.h > shelf.height + 1e-4) continue;
        const wasteY = shelf.height - v.h;
        if (!bestShelf || wasteY < bestShelf.wasteY) {
          bestShelf = { shelf, variant: v, wasteY };
        }
      }
    }

    if (bestShelf) {
      const { shelf, variant } = bestShelf;
      const x = shelf.cursorX + (shelf.blanks.length > 0 ? spacing : 0);
      const placed: PlacedBlank = {
        blankId: b.id,
        name: b.name,
        instanceIndex: item.instanceIndex,
        x,
        y: shelf.y,
        width: variant.w,
        height: variant.h,
        rotated: variant.rotated,
        thickness: b.thickness,
        material: b.material,
        internalHoles: b.internalHoles,
      };
      shelf.cursorX = x + variant.w;
      shelf.blanks.push(placed);
      sheet.placements.push(placed);
      return true;
    }

    // 2. Se não couber em nenhuma existente, abrir nova prateleira abaixo
    let currentY = margin;
    for (const s of shelves) {
      currentY = Math.max(currentY, s.y + s.height + spacing);
    }

    for (const v of variants) {
      if (currentY + v.h <= margin + usableH + 1e-4 && v.w <= usableW + 1e-4) {
        const newShelf: Shelf = {
          y: currentY,
          height: v.h,
          cursorX: margin + v.w,
          blanks: [],
        };
        const placed: PlacedBlank = {
          blankId: b.id,
          name: b.name,
          instanceIndex: item.instanceIndex,
          x: margin,
          y: currentY,
          width: v.w,
          height: v.h,
          rotated: v.rotated,
          thickness: b.thickness,
          material: b.material,
          internalHoles: b.internalHoles,
        };
        newShelf.blanks.push(placed);
        shelves.push(newShelf);
        sheet.placements.push(placed);
        return true;
      }
    }

    return false;
  }

  /**
   * Verifica se a peça pode ser girada baseado na direção do grão / laminação.
   */
  private static canRotateBlank(blank: NestingBlank, globalAllowRotate: boolean): boolean {
    if (!globalAllowRotate) return false;
    if (blank.grainDirection === "HORIZONTAL" || blank.grainDirection === "VERTICAL") {
      return false;
    }
    return true;
  }

  /**
   * Detecta arestas colineares contíguas entre blanks para habilitar Common-Line Cutting.
   */
  private static detectCommonLines(placements: PlacedBlank[]): CommonLineCut[] {
    const cuts: CommonLineCut[] = [];
    const TOL = 0.5;

    for (let i = 0; i < placements.length; i++) {
      const a = placements[i];
      for (let j = i + 1; j < placements.length; j++) {
        const b = placements[j];

        // 1. Contato vertical: Lado direito de A toca lado esquerdo de B
        if (Math.abs(a.x + a.width - b.x) < TOL) {
          const overlapStartY = Math.max(a.y, b.y);
          const overlapEndY = Math.min(a.y + a.height, b.y + b.height);
          const overlapLen = overlapEndY - overlapStartY;
          if (overlapLen > 5) {
            cuts.push({
              id: `CLC_V_${a.blankId}_${b.blankId}`,
              partAId: `${a.blankId}#${a.instanceIndex}`,
              partBId: `${b.blankId}#${b.instanceIndex}`,
              startX: a.x + a.width,
              startY: overlapStartY,
              endX: a.x + a.width,
              endY: overlapEndY,
              lengthMm: overlapLen,
            });
            a.hasCommonLineCut = true;
            b.hasCommonLineCut = true;
          }
        }

        // 2. Contato horizontal: Lado superior de A toca lado inferior de B
        if (Math.abs(a.y + a.height - b.y) < TOL) {
          const overlapStartX = Math.max(a.x, b.x);
          const overlapEndX = Math.min(a.x + a.width, b.x + b.width);
          const overlapLen = overlapEndX - overlapStartX;
          if (overlapLen > 5) {
            cuts.push({
              id: `CLC_H_${a.blankId}_${b.blankId}`,
              partAId: `${a.blankId}#${a.instanceIndex}`,
              partBId: `${b.blankId}#${b.instanceIndex}`,
              startX: overlapStartX,
              startY: a.y + a.height,
              endX: overlapEndX,
              endY: a.y + a.height,
              lengthMm: overlapLen,
            });
            a.hasCommonLineCut = true;
            b.hasCommonLineCut = true;
          }
        }
      }
    }

    return cuts;
  }

  /**
   * Extrai e registra retalhos aproveitáveis (Remnants) da chapa.
   */
  private static extractRemnants(
    sheet: NestedSheet,
    shelves: Shelf[],
    stock: NestingSheetStock,
    margin: number,
    minAreaMm2: number,
    density: number,
  ): SheetRemnant[] {
    const remnants: SheetRemnant[] = [];
    if (shelves.length === 0) return remnants;

    // Calcular altura total utilizada
    let maxUsedY = margin;
    for (const s of shelves) {
      maxUsedY = Math.max(maxUsedY, s.y + s.height);
    }

    // Sobra inferior / final da chapa (toda a largura por altura restante)
    const remnantBottomH = stock.height - maxUsedY - margin;
    const remnantBottomW = stock.width - margin * 2;
    const bottomArea = remnantBottomW * remnantBottomH;

    if (remnantBottomH > 100 && bottomArea >= minAreaMm2) {
      const weight = bottomArea * stock.thickness * density;
      remnants.push({
        id: `REM_B_${sheet.sheetIndex}`,
        sheetIndex: sheet.sheetIndex,
        x: margin,
        y: maxUsedY + margin / 2,
        width: remnantBottomW,
        height: remnantBottomH,
        areaMm2: bottomArea,
        weightKg: Number(weight.toFixed(2)),
        material: stock.material,
        thickness: stock.thickness,
      });
    }

    // Sobra lateral da última prateleira caso sobre espaço expressivo
    const lastShelf = shelves[shelves.length - 1];
    if (lastShelf) {
      const remnantSideW = stock.width - lastShelf.cursorX - margin;
      const remnantSideH = lastShelf.height;
      const sideArea = remnantSideW * remnantSideH;
      if (remnantSideW > 200 && sideArea >= minAreaMm2) {
        const weight = sideArea * stock.thickness * density;
        remnants.push({
          id: `REM_S_${sheet.sheetIndex}`,
          sheetIndex: sheet.sheetIndex,
          x: lastShelf.cursorX + margin / 2,
          y: lastShelf.y,
          width: remnantSideW,
          height: remnantSideH,
          areaMm2: sideArea,
          weightKg: Number(weight.toFixed(2)),
          material: stock.material,
          thickness: stock.thickness,
        });
      }
    }

    return remnants;
  }
}
