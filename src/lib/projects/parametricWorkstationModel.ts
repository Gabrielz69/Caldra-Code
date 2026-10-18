/**
 * CALDRA — MODELO CENTRAL DE PROJETO PARAMÉTRICO (FONTE ÚNICA DE VERDADE)
 *
 * Arquitetura reativa unificada para os dois modos de operação do CALDRA:
 *  1. MODO PEÇA INDIVIDUAL (Caldeiraria, Corte Térmico CNC, Dobra e Usinagem)
 *  2. MODO ESTRUTURA E MONTAGEM (Serralheria, Portões, Grades, Bancadas, Escadas e Estruturas)
 *
 * Qualquer alteração em uma medida (ex: mudar um portão de 6000mm para 5400mm),
 * no perfil comercial do Catálogo Costa Ferro ou no tipo de encaixe (90° vs 45°)
 * recalcula instantaneamente:
 *  - Geometria Vetorial 2D/2.5D para o CHAMFER CAD;
 *  - Dossiê Técnico Multi-Vistas ABNT (Frontal, Superior, Lateral, Isométrica + Cotas + Balões);
 *  - Lista de Corte Detalhada + Plano de Aproveitamento Linear em Barras de 6000mm (1D Nesting);
 *  - Lista de Materiais Consolidada (BOM Comercial: Barras, Chapas, Ferragens e Consumíveis);
 *  - Orçamento Comercial Completo (Materiais, Mão de Obra, Custos de Oficina, Margem e PDF).
 */

import { uid, boxOf, type Entity } from "@/lib/lab2d/core";
import type { Dimension } from "@/lib/lab2d/dimensions";
import {
  findCostaFerroMaterial,
  getAllCostaFerroHardware,
  getAllCostaFerroMaterials,
  type CostaFerroMaterialItem,
} from "@/lib/library/costaFerroCatalog";

export type OperationMode = "ESTRUTURA_MONTAGEM" | "PECA_INDIVIDUAL";

export type StructureTemplateId =
  | "portao-correr"
  | "portao-basculante"
  | "grade-industrial"
  | "bancada-industrial"
  | "escada-reta-industrial"
  | "canvas-estrutura";

export type PartTemplateId =
  | "flange-industrial"
  | "chapa-base-nervurada"
  | "reducao-quadrado-redondo"
  | "suporte-dobrado-u"
  | "canvas-custom";

export type CornerJointType = "MEIA_ESQUADRIA_45" | "TOPO_90";
export type GateInfillType = "GRADE_TUBULAR" | "CHAPA_LAMBRIL" | "MISTO_LAMBRIL_GRADE";

export interface ParametricProjectModel {
  id: string;
  projectName: string;
  clientName: string;
  projectCode: string;
  drafterName: string;
  revision: string;
  mode: OperationMode;
  structureTemplate: StructureTemplateId;
  partTemplate: PartTemplateId;

  // Parâmetros Geométricos Principais (mm)
  widthMm: number; // Largura / Comprimento principal (ex: 5400mm ou 6000mm num portão)
  heightMm: number; // Altura total (ex: 2100mm)
  depthMm: number; // Profundidade / Abas (ex: 800mm numa bancada)
  clearanceMm: number; // Folga de montagem/vão (ex: 15mm)

  // Parâmetros de Estrutura / Serralheria
  frameProfileId: string; // Perfil principal do quadro (Costa Ferro)
  secondaryProfileId: string; // Perfil de travessas / grade / montantes (Costa Ferro)
  columnProfileId: string; // Perfil de colunas / batente / trilho (Costa Ferro)
  infillSheetId: string; // Chapa de fechamento ou tampo (Costa Ferro)
  cornerJoint: CornerJointType; // 45° ou 90°
  infillType: GateInfillType;
  gridSpacingMm: number; // Espaçamento entre montantes da grade (ex: 110mm)
  midRailsCount: number; // Quantidade de travessas intermediárias
  lowerSheetHeightMm: number; // Altura do fechamento inferior no modo misto (ex: 900mm)

  // Parâmetros de Peça Individual (Caldeiraria / Corte)
  partSheetId: string; // Chapa escolhida no catálogo Costa Ferro
  outerDiameterMm: number; // Ex: Flange Ø externo
  innerDiameterMm: number; // Ex: Flange Ø interno
  boltCircleDiameterMm: number; // Ø furação (PCD)
  holesCount: number; // Nº de furos
  holeDiameterMm: number; // Ø de cada furo
  bendAngleDeg: number; // Ângulo de dobra
  bendFlangeMm: number; // Aba de dobra
  quantity: number; // Quantidade de peças ou estruturas iguais

  // Parâmetros de Corte e Orçamento
  sawKerfMm: number; // Perda de serra por corte (padrão 3mm)
  chargeFullBars: boolean; // Cobrar barras comerciais inteiras de 6000mm ou apenas peso líquido + perda
  wasteMarginPct: number; // Margem de perda quando por peso líquido (ex: 12%)
  laborHoursCutWeld: number; // Horas estimadas de corte + soldagem + montagem
  laborHourlyRateBRL: number; // Valor hora de oficina (R$/h)
  paintingAreaRateBRL: number; // Pintura / tratamento superficial (R$/m²)
  installationBRL: number; // Frete e instalação em obra (R$)
  overheadTaxPct: number; // Impostos / Custos fixos (%)
  profitMarginPct: number; // Margem de lucro desejada (%)

  // Checkboxes de Ferragens e Complementos (Catálogo Costa Ferro)
  hardwareOptions?: {
    includeRoldanas?: boolean;
    includeFechadura?: boolean;
    includeDobradicas?: boolean;
    includeParafusosParabolt?: boolean;
    includePrimerTinta?: boolean;
  };
}

export interface CutListPiece {
  id: string;
  tag: string; // Ex: P01, P02...
  name: string;
  role: string;
  profileId: string;
  profileName: string;
  dimensionsDesc: string;
  quantity: number;
  unitLengthMm: number;
  cutAngleLeftDeg: number; // 90 ou 45
  cutAngleRightDeg: number; // 90 ou 45
  linearWeightKgM: number;
  unitWeightKg: number;
  totalWeightKg: number;
  notes: string;
}

export interface BarCutAllocation {
  tag: string;
  name: string;
  lengthMm: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
}

export interface SingleBarNesting {
  barNumber: number;
  barLengthMm: number;
  cuts: BarCutAllocation[];
  usedLengthMm: number;
  kerfLossMm: number;
  offcutMm: number; // Sobra / retalho em mm
  utilizationPct: number;
}

export interface ProfileBarNestingPlan {
  profileId: string;
  profileName: string;
  barCommercialLengthMm: number;
  linearWeightKgM: number;
  barUnitPriceBRL: number;
  totalPiecesCount: number;
  totalNetLengthMm: number;
  barsRequired: number;
  overallUtilizationPct: number;
  totalOffcutMm: number;
  bars: SingleBarNesting[];
}

export interface SheetCutPiece {
  id: string;
  tag: string;
  name: string;
  sheetId: string;
  sheetName: string;
  thicknessMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  netAreaM2: number;
  cutPerimeterM: number;
  holesCount: number;
  bendsCount: number;
  unitWeightKg: number;
  totalWeightKg: number;
  process: string;
}

export interface BomLineItem {
  id: string;
  code: string;
  category: "BARRA_6M" | "CHAPA_COMERCIAL" | "FERRAGEM_ACESSORIO" | "CONSUMIVEL";
  description: string;
  specification: string;
  origin: string;
  quantity: number;
  unit: string;
  totalWeightKg: number;
  unitPriceBRL: number;
  subtotalBRL: number;
}

export interface BudgetBreakdown {
  profilesCostBRL: number;
  sheetsCostBRL: number;
  hardwareCostBRL: number;
  consumablesCostBRL: number;
  totalMaterialsBRL: number;
  laborCostBRL: number;
  paintingCostBRL: number;
  cncCuttingCostBRL: number;
  installationCostBRL: number;
  totalProductionCostBRL: number;
  directCostBRL: number;
  taxesAndOverheadBRL: number;
  profitAmountBRL: number;
  finalClientPriceBRL: number;
  pricePerKgBRL: number;
  pricePerM2BRL: number;
}

export interface DerivedProjectDossier {
  model: ParametricProjectModel;
  cutList: CutListPiece[];
  barNestingPlans: ProfileBarNestingPlan[];
  sheetPieces: SheetCutPiece[];
  bom: BomLineItem[];
  budget: BudgetBreakdown;
  totalWeightKg: number;
  totalSurfaceAreaM2: number;
  totalBars6mCount: number;
  totalSheetsCount: number;
  cadEntities: Entity[]; // Geometria 2D principal em escala 1:1 para o CHAMFER
  cadDimensions: Dimension[];
  multiViewSvg: string; // Prancha técnica ABNT multi-vistas pronta para impressão/PDF
  multiViewEntities: Entity[]; // Prancha técnica multi-vistas como entidades vetoriais do CHAMFER
  darkTechnicalBoardSvg: string; // Quadro técnico escuro de alta definição com cotas mm/cm e isométrica
}

export const DEFAULT_PROJECT_MODEL: ParametricProjectModel = {
  id: "caldra-proj-default",
  projectName: "Portão de Correr Industrial 5400×2100mm",
  clientName: "Cliente Oficina / Obra Industrial",
  projectCode: "CAL-SER-001",
  drafterName: "Eng. / Serralheiro CALDRA",
  revision: "R01",
  mode: "ESTRUTURA_MONTAGEM",
  structureTemplate: "portao-correr",
  partTemplate: "flange-industrial",

  widthMm: 5400,
  heightMm: 2100,
  depthMm: 800,
  clearanceMm: 15,

  frameProfileId: "cf-tr-60x40x2.00", // Metalon 60x40x2,00mm
  secondaryProfileId: "cf-tq-20x20x1.20", // Metalon 20x20x1,20mm (Grade)
  columnProfileId: "cf-tr-80x40x2.00", // Metalon 80x40x2,00mm (Travessa/Batente)
  infillSheetId: "cf-ch-lambril-20-0.90", // Chapa Lambril #20
  cornerJoint: "MEIA_ESQUADRIA_45",
  infillType: "MISTO_LAMBRIL_GRADE",
  gridSpacingMm: 115,
  midRailsCount: 1,
  lowerSheetHeightMm: 850,

  partSheetId: "cf-ch-gr-14-6.35", // Chapa 1/4" (6,35mm)
  outerDiameterMm: 320,
  innerDiameterMm: 168.3,
  boltCircleDiameterMm: 270,
  holesCount: 8,
  holeDiameterMm: 22,
  bendAngleDeg: 90,
  bendFlangeMm: 120,
  quantity: 1,

  sawKerfMm: 3,
  chargeFullBars: true,
  wasteMarginPct: 12,
  laborHoursCutWeld: 16,
  laborHourlyRateBRL: 95,
  paintingAreaRateBRL: 42,
  installationBRL: 450,
  overheadTaxPct: 8,
  profitMarginPct: 30,
  hardwareOptions: {
    includeRoldanas: true,
    includeFechadura: true,
    includeDobradicas: true,
    includeParafusosParabolt: true,
    includePrimerTinta: true,
  },
};

/**
 * Algoritmo de Otimização de Corte Linear 1D (First-Fit Decreasing com Perda de Serra)
 */
export function compute1DBarNesting(
  pieces: CutListPiece[],
  kerfMm = 3,
): ProfileBarNestingPlan[] {
  const byProfile = new Map<string, CutListPiece[]>();
  for (const p of pieces) {
    const list = byProfile.get(p.profileId) ?? [];
    list.push(p);
    byProfile.set(p.profileId, list);
  }

  const plans: ProfileBarNestingPlan[] = [];

  for (const [profileId, group] of byProfile.entries()) {
    const mat = findCostaFerroMaterial(profileId);
    const barLen = mat?.commercialLengthMm ?? 6000;
    const linearKgM = mat?.linearWeightKgM ?? group[0]?.linearWeightKgM ?? 2.0;
    const barPrice = mat?.unitPriceBRL ?? +(linearKgM * 6 * 9.8).toFixed(2);
    const profileName = mat?.name ?? group[0]?.profileName ?? profileId;

    // Expande todas as unidades individuais e ordena da maior para a menor (FFD)
    // Se uma peça exceder 6000mm, divide em tramo de 6000mm + emenda soldada
    const expanded: BarCutAllocation[] = [];
    for (const item of group) {
      for (let i = 0; i < item.quantity; i++) {
        let rem = Math.round(item.unitLengthMm);
        let segIdx = 1;
        while (rem > barLen) {
          expanded.push({
            tag: `${item.tag}.${segIdx}`,
            name: `${item.name} (Seg. ${segIdx})`,
            lengthMm: barLen,
            leftAngleDeg: segIdx === 1 ? item.cutAngleLeftDeg : 90,
            rightAngleDeg: 90,
          });
          rem -= barLen;
          segIdx++;
        }
        if (rem > 0) {
          expanded.push({
            tag: segIdx > 1 ? `${item.tag}.${segIdx}` : item.tag,
            name: segIdx > 1 ? `${item.name} (Comp.)` : item.name,
            lengthMm: rem,
            leftAngleDeg: segIdx > 1 ? 90 : item.cutAngleLeftDeg,
            rightAngleDeg: item.cutAngleRightDeg,
          });
        }
      }
    }

    expanded.sort((a, b) => b.lengthMm - a.lengthMm);

    const bars: SingleBarNesting[] = [];

    for (const cut of expanded) {
      let placed = false;
      for (const bar of bars) {
        const neededKerf = bar.cuts.length > 0 ? kerfMm : 0;
        if (bar.usedLengthMm + bar.kerfLossMm + neededKerf + cut.lengthMm <= barLen) {
          bar.cuts.push(cut);
          bar.usedLengthMm += cut.lengthMm;
          bar.kerfLossMm += neededKerf;
          bar.offcutMm = Math.max(0, barLen - bar.usedLengthMm - bar.kerfLossMm);
          bar.utilizationPct = +((bar.usedLengthMm / barLen) * 100).toFixed(1);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const used = cut.lengthMm;
        const offcut = Math.max(0, barLen - used);
        bars.push({
          barNumber: bars.length + 1,
          barLengthMm: barLen,
          cuts: [cut],
          usedLengthMm: used,
          kerfLossMm: 0,
          offcutMm: offcut,
          utilizationPct: +((used / barLen) * 100).toFixed(1),
        });
      }
    }

    const totalNetMm = expanded.reduce((s, c) => s + c.lengthMm, 0);
    const totalAvailableMm = Math.max(1, bars.length * barLen);
    const totalOffcutMm = bars.reduce((s, b) => s + b.offcutMm, 0);

    plans.push({
      profileId,
      profileName,
      barCommercialLengthMm: barLen,
      linearWeightKgM: linearKgM,
      barUnitPriceBRL: barPrice,
      totalPiecesCount: expanded.length,
      totalNetLengthMm: totalNetMm,
      barsRequired: bars.length,
      overallUtilizationPct: +((totalNetMm / totalAvailableMm) * 100).toFixed(1),
      totalOffcutMm,
      bars,
    });
  }

  return plans;
}

/**
 * FUNÇÃO PRINCIPAL DE DERIVAÇÃO EM TEMPO REAL (FONTE ÚNICA DE VERDADE)
 */
export function deriveProjectDossier(
  model: ParametricProjectModel,
  canvasEntities: Entity[] = [],
): DerivedProjectDossier {
  const allMaterials = getAllCostaFerroMaterials();
  const allHardware = getAllCostaFerroHardware();

  const getMat = (id: string, fallbackCat?: string): CostaFerroMaterialItem => {
    return (
      allMaterials.find((m) => m.id === id) ??
      allMaterials.find((m) => m.category === fallbackCat) ??
      allMaterials[0]!
    );
  };

  const frameMat = getMat(model.frameProfileId, "TUBO_RETANGULAR_METALON");
  const secMat = getMat(model.secondaryProfileId, "TUBO_QUADRADO_METALON");
  const colMat = getMat(model.columnProfileId, "TUBO_RETANGULAR_METALON");
  const infillSheet = getMat(model.infillSheetId, "CHAPA_ACO");
  const partSheet = getMat(model.partSheetId, "CHAPA_ACO");

  const mult = Math.max(1, Math.round(model.quantity || 1));
  const cutList: CutListPiece[] = [];
  const sheetPieces: SheetCutPiece[] = [];
  const cadEntities: Entity[] = [];
  const cadDimensions: Dimension[] = [];

  const W = Math.max(200, model.widthMm);
  const H = Math.max(200, model.heightMm);
  const D = Math.max(100, model.depthMm);
  const jointAngle = model.cornerJoint === "MEIA_ESQUADRIA_45" ? 45 : 90;
  const fw = Math.max(20, frameMat.heightMm || 50);

  let tagCounter = 1;
  const nextTag = () => `P${String(tagCounter++).padStart(2, "0")}`;

  const addProfilePiece = (
    name: string,
    role: string,
    mat: CostaFerroMaterialItem,
    qtyPerUnit: number,
    lengthMm: number,
    angL: number,
    angR: number,
    notes: string,
  ) => {
    const totalQty = qtyPerUnit * mult;
    const len = Math.max(20, Math.round(lengthMm));
    const kgM = mat.linearWeightKgM ?? 1.5;
    const unitKg = +((len / 1000) * kgM).toFixed(2);
    cutList.push({
      id: uid(),
      tag: nextTag(),
      name,
      role,
      profileId: mat.id,
      profileName: mat.name,
      dimensionsDesc: mat.dimensionsMm,
      quantity: totalQty,
      unitLengthMm: len,
      cutAngleLeftDeg: angL,
      cutAngleRightDeg: angR,
      linearWeightKgM: kgM,
      unitWeightKg: unitKg,
      totalWeightKg: +(unitKg * totalQty).toFixed(2),
      notes,
    });
  };

  const addSheetPiece = (
    name: string,
    mat: CostaFerroMaterialItem,
    wMm: number,
    hMm: number,
    qtyPerUnit: number,
    holesCount: number,
    bendsCount: number,
    process: string,
    customAreaMm2?: number,
    customPerimMm?: number,
  ) => {
    const totalQty = qtyPerUnit * mult;
    const areaM2 = customAreaMm2 ? customAreaMm2 / 1e6 : (wMm * hMm) / 1e6;
    const kgM2 = mat.areaWeightKgM2 ?? mat.wallThicknessMm * 7.85;
    const unitKg = +(areaM2 * kgM2).toFixed(2);
    const perimM = customPerimMm ? customPerimMm / 1000 : (2 * (wMm + hMm)) / 1000;
    sheetPieces.push({
      id: uid(),
      tag: nextTag(),
      name,
      sheetId: mat.id,
      sheetName: mat.name,
      thicknessMm: mat.wallThicknessMm,
      widthMm: Math.round(wMm),
      heightMm: Math.round(hMm),
      quantity: totalQty,
      netAreaM2: +(areaM2 * totalQty).toFixed(3),
      cutPerimeterM: +(perimM * totalQty).toFixed(2),
      holesCount: holesCount * totalQty,
      bendsCount: bendsCount * totalQty,
      unitWeightKg: unitKg,
      totalWeightKg: +(unitKg * totalQty).toFixed(2),
      process,
    });
  };

  /* =========================================================================
   * CONSTRUÇÃO DO MODELO: MODO 1 (ESTRUTURA E MONTAGEM) vs MODO 2 (PEÇA)
   * ========================================================================= */
  if (model.mode === "ESTRUTURA_MONTAGEM") {
    if (model.structureTemplate === "portao-correr" || model.structureTemplate === "portao-basculante") {
      const isBasculante = model.structureTemplate === "portao-basculante";
      const leafH = H - model.clearanceMm;
      const innerW = Math.max(100, W - 2 * fw);
      const innerH = Math.max(100, leafH - 2 * fw);

      // 1. Longarinas Horizontais (Superior e Inferior)
      addProfilePiece(
        "Travessa Horizontal Principal (Sup./Inf.)",
        "Quadro Principal",
        frameMat,
        2,
        W,
        jointAngle,
        jointAngle,
        model.cornerJoint === "MEIA_ESQUADRIA_45"
          ? "Corte meia-esquadria 45° nas duas pontas"
          : "Corte reto 90° (topo sobre montantes)",
      );

      // 2. Montantes Verticais Laterais
      const vertLen = model.cornerJoint === "MEIA_ESQUADRIA_45" ? leafH : leafH - 2 * fw;
      addProfilePiece(
        "Montante Vertical Lateral da Folha",
        "Quadro Principal",
        frameMat,
        2,
        vertLen,
        jointAngle,
        jointAngle,
        "Fechamento lateral do quadro estrutural",
      );

      // 3. Travessa Intermediária / Reforço Central
      if (model.midRailsCount > 0) {
        addProfilePiece(
          "Travessa Intermediária de Travamento",
          "Reforço Estrutural",
          frameMat,
          model.midRailsCount,
          innerW,
          90,
          90,
          `Encaixe interno a ${Math.round( model.lowerSheetHeightMm || innerH / 2 )} mm da base`,
        );
      }

      // 4. Montante Central de Reforço (para portões > 3200mm)
      const centralPosts = W > 3200 ? 1 : 0;
      if (centralPosts > 0) {
        addProfilePiece(
          "Montante Central Divisor de Vão",
          "Reforço Estrutural",
          frameMat,
          centralPosts,
          innerH,
          90,
          90,
          "Evita flecha em vãos acima de 3,2m",
        );
      }

      // 5. Fechamento: Grade Tubular, Chapa Lambril ou Misto
      if (model.infillType === "GRADE_TUBULAR") {
        const spacing = Math.max(60, model.gridSpacingMm || 115);
        const barsCount = Math.max(2, Math.floor(innerW / spacing) - 1);
        addProfilePiece(
          "Montante Vertical da Grade (Palito)",
          "Gradeamento",
          secMat,
          barsCount,
          innerH,
          90,
          90,
          `Espaçamento regular a cada ${spacing} mm`,
        );
      } else if (model.infillType === "CHAPA_LAMBRIL") {
        addSheetPiece(
          "Painel de Fechamento em Chapa Lambril Frisada",
          infillSheet,
          innerW,
          innerH,
          1,
          0,
          2,
          "Corte Guilhotina + Ponteamento MIG",
        );
      } else {
        // Misto: Chapa Lambril na parte inferior + Grade Tubular na parte superior
        const lowH = Math.min(innerH - 200, Math.max(300, model.lowerSheetHeightMm || 850));
        const upH = Math.max(150, innerH - lowH - fw);
        addSheetPiece(
          "Saia Inferior em Chapa Lambril Frisada",
          infillSheet,
          innerW,
          lowH,
          1,
          0,
          0,
          "Corte Guilhotina + Solda MIG",
        );
        const spacing = Math.max(60, model.gridSpacingMm || 115);
        const barsCount = Math.max(2, Math.floor(innerW / spacing) - 1);
        addProfilePiece(
          "Montante Superior da Grade",
          "Gradeamento Superior",
          secMat,
          barsCount,
          upH,
          90,
          90,
          `Grade superior acima da travessa (${spacing} mm passo)`,
        );
      }

      // 6. Trilho / Coluna de Batente ou Caixa Basculante
      if (isBasculante) {
        addProfilePiece(
          "Coluna / Caixa Lateral de Contrapeso",
          "Mecanismo Basculante",
          colMat,
          2,
          H + 150,
          90,
          90,
          "Colunas laterais de guia e alojamento do contrapeso",
        );
        addProfilePiece(
          "Braço Articulado Estabilizador",
          "Mecanismo Basculante",
          frameMat,
          2,
          Math.round(H * 0.55),
          90,
          90,
          "Braços de acionamento da folha",
        );
      } else {
        addProfilePiece(
          "Coluna de Batente e Guia Superior",
          "Sustentação / Batente",
          colMat,
          2,
          H + 100,
          90,
          90,
          "Pórtico de guia e batente de fechamento",
        );
      }

      // Geração das Entidades CAD 2D (Vista Frontal da Folha em escala 1:1)
      // Quadro externo e interno
      cadEntities.push(
        {
          id: uid(),
          layer: "corte",
          type: "polyline",
          closed: true,
          pts: [
            { x: 0, y: 0 },
            { x: W, y: 0 },
            { x: W, y: leafH },
            { x: 0, y: leafH },
          ],
        },
        {
          id: uid(),
          layer: "corte",
          type: "polyline",
          closed: true,
          pts: [
            { x: fw, y: fw },
            { x: W - fw, y: fw },
            { x: W - fw, y: leafH - fw },
            { x: fw, y: leafH - fw },
          ],
        },
      );
      // Linhas de meia-esquadria 45° nos 4 cantos se selecionado
      if (model.cornerJoint === "MEIA_ESQUADRIA_45") {
        cadEntities.push(
          { id: uid(), layer: "dobra", type: "line", x1: 0, y1: 0, x2: fw, y2: fw },
          { id: uid(), layer: "dobra", type: "line", x1: W, y1: 0, x2: W - fw, y2: fw },
          { id: uid(), layer: "dobra", type: "line", x1: W, y1: leafH, x2: W - fw, y2: leafH - fw },
          { id: uid(), layer: "dobra", type: "line", x1: 0, y1: leafH, x2: fw, y2: leafH - fw },
        );
      }
      // Travessa intermediária
      const midY = model.infillType === "MISTO_LAMBRIL_GRADE"
        ? fw + Math.min(innerH - 200, Math.max(300, model.lowerSheetHeightMm || 850))
        : leafH / 2;
      if (model.midRailsCount > 0 || model.infillType === "MISTO_LAMBRIL_GRADE") {
        cadEntities.push(
          { id: uid(), layer: "corte", type: "line", x1: fw, y1: midY, x2: W - fw, y2: midY },
          { id: uid(), layer: "corte", type: "line", x1: fw, y1: midY + fw, x2: W - fw, y2: midY + fw },
        );
      }
      // Grade vertical
      if (model.infillType !== "CHAPA_LAMBRIL") {
        const spacing = Math.max(60, model.gridSpacingMm || 115);
        const startY = model.infillType === "MISTO_LAMBRIL_GRADE" ? midY + fw : fw;
        const endY = leafH - fw;
        for (let x = fw + spacing; x < W - fw - 20; x += spacing) {
          cadEntities.push({
            id: uid(),
            layer: "gravacao",
            type: "line",
            x1: x,
            y1: startY,
            x2: x,
            y2: endY,
          });
        }
      }
    } else if (model.structureTemplate === "grade-industrial") {
      const innerW = Math.max(100, W - 2 * fw);
      const innerH = Math.max(100, H - 2 * fw);
      addProfilePiece("Longarina Horizontal (Sup./Inf.)", "Quadro da Grade", frameMat, 2, W, jointAngle, jointAngle, "Quadro perimetral");
      addProfilePiece("Montante Lateral da Grade", "Quadro da Grade", frameMat, 2, H, jointAngle, jointAngle, "Laterais de chumbamento");
      const spacing = Math.max(60, model.gridSpacingMm || 110);
      const barsCount = Math.max(2, Math.floor(innerW / spacing) - 1);
      addProfilePiece("Montante Vertical Interno", "Gradeamento", secMat, barsCount, innerH, 90, 90, `Passo ${spacing} mm`);

      cadEntities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: [
          { x: 0, y: 0 },
          { x: W, y: 0 },
          { x: W, y: H },
          { x: 0, y: H },
        ],
      });
      for (let x = fw + spacing; x < W - fw; x += spacing) {
        cadEntities.push({ id: uid(), layer: "gravacao", type: "line", x1: x, y1: fw, x2: x, y2: H - fw });
      }
    } else if (model.structureTemplate === "bancada-industrial") {
      // Bancada de oficina pesada: Comprimento W, Altura H, Profundidade D
      const legsCount = W > 2200 ? 6 : 4;
      addProfilePiece("Pé / Coluna Vertical da Bancada", "Estrutura Principal", colMat, legsCount, H - 10, 90, 90, "Pés de sustentação");
      addProfilePiece("Longarina Longitudinal (Sup./Inf.)", "Quadro do Tampo e Prateleira", frameMat, 4, W - 2 * fw, 90, 90, "Longarinas frontais e traseiras");
      addProfilePiece("Travessa Transversal de Apoio", "Reforço de Tampo", frameMat, legsCount, D - 2 * fw, 90, 90, "Travamento transversal");
      addSheetPiece("Tampo Superior de Bancada Industrial", partSheet, W, D, 1, 4, 1, "Corte Plasma/Guilhotina + Dobra Frontal");
      addSheetPiece("Prateleira Inferior de Ferramentas", infillSheet, W - 2 * fw, D - 2 * fw, 1, 0, 0, "Corte Guilhotina");

      cadEntities.push(
        {
          id: uid(),
          layer: "corte",
          type: "polyline",
          closed: true,
          pts: [
            { x: 0, y: H - 40 },
            { x: W, y: H - 40 },
            { x: W, y: H },
            { x: 0, y: H },
          ],
        },
        { id: uid(), layer: "corte", type: "line", x1: 20, y1: 0, x2: 20, y2: H - 40 },
        { id: uid(), layer: "corte", type: "line", x1: W - 20, y1: 0, x2: W - 20, y2: H - 40 },
        { id: uid(), layer: "dobra", type: "line", x1: 20, y1: 220, x2: W - 20, y2: 220 },
      );
    } else if (model.structureTemplate === "escada-reta-industrial") {
      // Escada Reta: W = projeção horizontal, H = desnível vertical, D = largura útil do degrau
      const stringerLen = Math.round(Math.hypot(W, H));
      const stepsCount = Math.max(3, Math.round(H / 185));
      addProfilePiece("Longarina Inclinada da Escada", "Longarinas", frameMat, 2, stringerLen, 45, 45, `Inclinação ${Math.round((Math.atan2(H, W) * 180) / Math.PI)}°`);
      addProfilePiece("Coluna do Guarda-Corpo", "Guarda-Corpo NBR", secMat, 6, 1100, 90, 90, "Montantes verticais de proteção");
      addProfilePiece("Corrimão Superior e Intermediário", "Guarda-Corpo NBR", secMat, 4, stringerLen, 45, 45, "Duplo guarda-corpo lateral");
      addSheetPiece("Degrau Antiderrapante Dobrado", infillSheet, D, 280, stepsCount, 4, 2, "Corte + Dobra Frontal 35mm");
      addSheetPiece("Sapata de Ancoragem (Base e Topo)", partSheet, 200, 150, 4, 4, 0, "Corte Plasma + Furação Ø14mm");

      cadEntities.push(
        { id: uid(), layer: "corte", type: "line", x1: 0, y1: 0, x2: W, y2: H },
        { id: uid(), layer: "corte", type: "line", x1: 0, y1: 150, x2: W, y2: H + 150 },
      );
      for (let i = 1; i <= stepsCount; i++) {
        const t = i / (stepsCount + 1);
        const sx = W * t;
        const sy = H * t;
        cadEntities.push({ id: uid(), layer: "dobra", type: "line", x1: sx - 120, y1: sy + 75, x2: sx + 120, y2: sy + 75 });
      }
    } else if (model.structureTemplate === "canvas-estrutura" && canvasEntities.length > 0) {
      // Deriva barras diretamente das linhas e polilinhas desenhadas no CHAMFER CAD!
      let idx = 1;
      for (const ent of canvasEntities) {
        if (ent.type === "line") {
          const len = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1);
          if (len >= 15) {
            addProfilePiece(`Barra Traçada no CAD #${idx++}`, "Geometria CHAMFER", frameMat, 1, len, jointAngle, jointAngle, `Camada: ${ent.layer}`);
          }
        } else if (ent.type === "polyline" && ent.pts.length >= 2) {
          for (let i = 0; i < ent.pts.length - 1; i++) {
            const len = Math.hypot(ent.pts[i + 1]!.x - ent.pts[i]!.x, ent.pts[i + 1]!.y - ent.pts[i]!.y);
            if (len >= 15) {
              addProfilePiece(`Segmento de Quadro CAD #${idx++}`, "Polilinha CHAMFER", frameMat, 1, len, jointAngle, jointAngle, `Vértices ${i + 1}-${i + 2}`);
            }
          }
          if (ent.closed && ent.pts.length > 2) {
            const first = ent.pts[0]!;
            const last = ent.pts[ent.pts.length - 1]!;
            const len = Math.hypot(first.x - last.x, first.y - last.y);
            if (len >= 15) {
              addProfilePiece(`Fechamento de Quadro CAD #${idx++}`, "Polilinha CHAMFER", frameMat, 1, len, jointAngle, jointAngle, "Fechamento poligonal");
            }
          }
        }
      }
      cadEntities.push(...canvasEntities);
    }
  } else {
    /* =========================================================================
     * MODO 2: PEÇA INDIVIDUAL (CALDEIRARIA, CORTE E USINAGEM)
     * ========================================================================= */
    if (model.partTemplate === "flange-industrial") {
      const od = Math.max(80, model.outerDiameterMm);
      const id = Math.max(20, Math.min(od - 30, model.innerDiameterMm));
      const pcd = Math.max(id + 15, Math.min(od - 15, model.boltCircleDiameterMm));
      const nHoles = Math.max(2, Math.round(model.holesCount));
      const holeD = Math.max(6, model.holeDiameterMm);

      const netAreaMm2 =
        Math.PI * ((od / 2) ** 2 - (id / 2) ** 2) - nHoles * Math.PI * (holeD / 2) ** 2;
      const perimMm = Math.PI * od + Math.PI * id + nHoles * Math.PI * holeD;

      addSheetPiece(
        `Flange Industrial Ø${od}×Ø${id}mm (${nHoles} furos Ø${holeD}mm)`,
        partSheet,
        od,
        od,
        1,
        nHoles + 1,
        0,
        "Corte CNC Laser / Plasma HD + Usinagem de Face",
        Math.max(1000, netAreaMm2),
        perimMm,
      );

      // Geometria CAD 2D
      const cx = od / 2;
      const cy = od / 2;
      cadEntities.push(
        { id: uid(), layer: "corte", type: "circle", cx, cy, r: od / 2 },
        { id: uid(), layer: "corte", type: "circle", cx, cy, r: id / 2 },
        { id: uid(), layer: "eixo", type: "circle", cx, cy, r: pcd / 2 },
      );
      for (let i = 0; i < nHoles; i++) {
        const ang = (i * 2 * Math.PI) / nHoles;
        cadEntities.push({
          id: uid(),
          layer: "corte",
          type: "circle",
          cx: cx + (pcd / 2) * Math.cos(ang),
          cy: cy + (pcd / 2) * Math.sin(ang),
          r: holeD / 2,
        });
      }
    } else if (model.partTemplate === "chapa-base-nervurada") {
      const holeD = Math.max(8, model.holeDiameterMm);
      const offset = Math.min(45, W * 0.15, H * 0.15);
      addSheetPiece(
        `Chapa de Base Furada ${W}×${H}×${partSheet.wallThicknessMm}mm`,
        partSheet,
        W,
        H,
        1,
        4,
        0,
        "Corte Plasma/Laser CNC + 4 Furos de Chumbador",
      );
      addSheetPiece(
        `Nervura de Enrijecimento (Gusset) ${Math.round(W * 0.3)}×${Math.round(H * 0.35)}mm`,
        partSheet,
        Math.round(W * 0.3),
        Math.round(H * 0.35),
        4,
        0,
        0,
        "Corte Chanfrado 45° + Solda em Ângulo",
      );

      cadEntities.push(
        {
          id: uid(),
          layer: "corte",
          type: "polyline",
          closed: true,
          pts: [
            { x: 0, y: 0 },
            { x: W, y: 0 },
            { x: W, y: H },
            { x: 0, y: H },
          ],
        },
        { id: uid(), layer: "corte", type: "circle", cx: offset, cy: offset, r: holeD / 2 },
        { id: uid(), layer: "corte", type: "circle", cx: W - offset, cy: offset, r: holeD / 2 },
        { id: uid(), layer: "corte", type: "circle", cx: W - offset, cy: H - offset, r: holeD / 2 },
        { id: uid(), layer: "corte", type: "circle", cx: offset, cy: H - offset, r: holeD / 2 },
      );
    } else if (model.partTemplate === "reducao-quadrado-redondo") {
      // Transição Quadrado (W x D) para Redondo (outerDiameterMm) com altura H
      const dRound = Math.max(60, model.outerDiameterMm);
      const trueHeight = Math.round(Math.hypot(H, (W - dRound) / 2));
      const blankW = Math.round(W * 1.45 + dRound * 0.6);
      const blankH = Math.round(trueHeight * 1.15);
      addSheetPiece(
        `Meia-Planificação Transição Quadrado ${W}×${D} p/ Redondo Ø${dRound}mm`,
        partSheet,
        blankW,
        blankH,
        2,
        0,
        8,
        "Traçagem por Triangulação + Corte CNC + Dobradeira (8 vincos por metade)",
      );

      cadEntities.push(
        {
          id: uid(),
          layer: "corte",
          type: "polyline",
          closed: true,
          pts: [
            { x: 0, y: 0 },
            { x: W, y: 0 },
            { x: W / 2 + dRound / 2, y: trueHeight },
            { x: W / 2 - dRound / 2, y: trueHeight },
          ],
        },
        { id: uid(), layer: "dobra", type: "line", x1: 0, y1: 0, x2: W / 2 - dRound / 2, y2: trueHeight },
        { id: uid(), layer: "dobra", type: "line", x1: W, y1: 0, x2: W / 2 + dRound / 2, y2: trueHeight },
        { id: uid(), layer: "dobra", type: "line", x1: W / 2, y1: 0, x2: W / 2 - dRound / 4, y2: trueHeight },
        { id: uid(), layer: "dobra", type: "line", x1: W / 2, y1: 0, x2: W / 2 + dRound / 4, y2: trueHeight },
      );
    } else if (model.partTemplate === "suporte-dobrado-u") {
      // Perfil / Suporte Dobrado em U com compensação de dobra (Bend Allowance)
      const flange = Math.max(30, model.bendFlangeMm);
      const t = partSheet.wallThicknessMm;
      const ba = 2 * ((Math.PI / 2) * (t * 1.2 + 0.4 * t));
      const flatLength = Math.round(W + 2 * flange - ba);
      addSheetPiece(
        `Suporte Dobrado em U (Desenvolvido ${flatLength}×${H}mm · 2 dobras 90°)`,
        partSheet,
        flatLength,
        H,
        1,
        model.holesCount,
        2,
        `Corte CNC + Prensa Dobradeira (Fator K=0,40 · Raio Int. ${(t * 1.2).toFixed(1)}mm)`,
      );

      cadEntities.push(
        {
          id: uid(),
          layer: "corte",
          type: "polyline",
          closed: true,
          pts: [
            { x: 0, y: 0 },
            { x: flatLength, y: 0 },
            { x: flatLength, y: H },
            { x: 0, y: H },
          ],
        },
        { id: uid(), layer: "dobra", type: "line", x1: flange, y1: 0, x2: flange, y2: H },
        { id: uid(), layer: "dobra", type: "line", x1: flatLength - flange, y1: 0, x2: flatLength - flange, y2: H },
      );
    } else if (model.partTemplate === "canvas-custom" && canvasEntities.length > 0) {
      // Analisa entidades reais do Canvas do CHAMFER
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let perimMm = 0;
      let holes = 0;
      let bends = 0;
      for (const e of canvasEntities) {
        const b = boxOf(e);
        minX = Math.min(minX, b.minX);
        maxX = Math.max(maxX, b.maxX);
        minY = Math.min(minY, b.minY);
        maxY = Math.max(maxY, b.maxY);
        if (e.layer === "dobra") bends++;
        if (e.type === "circle") {
          holes++;
          perimMm += 2 * Math.PI * e.r;
        } else if (e.type === "line") {
          perimMm += Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
        } else if (e.type === "polyline") {
          for (let i = 0; i < e.pts.length - 1; i++) {
            perimMm += Math.hypot(e.pts[i + 1]!.x - e.pts[i]!.x, e.pts[i + 1]!.y - e.pts[i]!.y);
          }
          if (e.closed && e.pts.length > 2) {
            perimMm += Math.hypot(e.pts[0]!.x - e.pts[e.pts.length - 1]!.x, e.pts[0]!.y - e.pts[e.pts.length - 1]!.y);
          }
        }
      }
      const bw = Number.isFinite(maxX - minX) ? Math.max(50, maxX - minX) : W;
      const bh = Number.isFinite(maxY - minY) ? Math.max(50, maxY - minY) : H;
      addSheetPiece(
        `Peça Customizada CHAMFER (${Math.round(bw)}×${Math.round(bh)}mm)`,
        partSheet,
        bw,
        bh,
        1,
        Math.max(0, holes - 1),
        bends,
        "Corte CNC Direto do Desenho CHAMFER",
        bw * bh,
        Math.max(200, perimMm),
      );
      cadEntities.push(...canvasEntities);
    }
  }

  /* =========================================================================
   * CÁLCULO DO PLANO DE CORTE 1D (BARRAS DE 6000mm) E RESUMO DE CHAPAS
   * ========================================================================= */
  const barNestingPlans = compute1DBarNesting(cutList, model.sawKerfMm || 3);

  /* =========================================================================
   * CONSOLIDAÇÃO DA LISTA DE MATERIAIS (BOM COMERCIAL — CAMADAS A + B)
   * ========================================================================= */
  const bom: BomLineItem[] = [];
  let profilesCostBRL = 0;
  let sheetsCostBRL = 0;
  let hardwareCostBRL = 0;
  let consumablesCostBRL = 0;

  // 1. Barras de 6000mm do Plano de Corte
  for (const plan of barNestingPlans) {
    const mat = findCostaFerroMaterial(plan.profileId);
    const barWeight = (plan.barCommercialLengthMm / 1000) * plan.linearWeightKgM;
    const netWeight = (plan.totalNetLengthMm / 1000) * plan.linearWeightKgM;
    const effectiveCost = model.chargeFullBars
      ? plan.barsRequired * plan.barUnitPriceBRL
      : netWeight * (1 + model.wasteMarginPct / 100) * (mat?.pricePerKgBRL ?? 9.8);

    profilesCostBRL += effectiveCost;
    bom.push({
      id: `bom-bar-${plan.profileId}`,
      code: plan.profileId.toUpperCase(),
      category: "BARRA_6M",
      description: plan.profileName,
      specification: `Barra comercial ${plan.barCommercialLengthMm}mm · Aproveitamento ${plan.overallUtilizationPct}%`,
      origin: mat?.origin ?? "Catálogo Costa Ferro",
      quantity: plan.barsRequired,
      unit: "barra 6m",
      totalWeightKg: +(model.chargeFullBars ? plan.barsRequired * barWeight : netWeight).toFixed(2),
      unitPriceBRL: +plan.barUnitPriceBRL.toFixed(2),
      subtotalBRL: +effectiveCost.toFixed(2),
    });
  }

  // 2. Chapas Comerciais
  const sheetGroups = new Map<string, SheetCutPiece[]>();
  for (const sp of sheetPieces) {
    const arr = sheetGroups.get(sp.sheetId) ?? [];
    arr.push(sp);
    sheetGroups.set(sp.sheetId, arr);
  }
  let totalSheetsCount = 0;
  for (const [sheetId, list] of sheetGroups.entries()) {
    const mat = findCostaFerroMaterial(sheetId) ?? partSheet;
    const sheetAreaM2 = mat.sheetAreaMm
      ? (mat.sheetAreaMm.widthMm * mat.sheetAreaMm.lengthMm) / 1e6
      : 3.6;
    const netAreaSum = list.reduce((s, x) => s + x.netAreaM2, 0);
    const netWeightSum = list.reduce((s, x) => s + x.totalWeightKg, 0);
    const sheetsNeeded = Math.max(1, Math.ceil((netAreaSum * 1.12) / sheetAreaM2));
    totalSheetsCount += sheetsNeeded;

    const cost = model.chargeFullBars
      ? sheetsNeeded * mat.unitPriceBRL
      : netWeightSum * (1 + model.wasteMarginPct / 100) * mat.pricePerKgBRL;
    sheetsCostBRL += cost;

    bom.push({
      id: `bom-sheet-${sheetId}`,
      code: sheetId.toUpperCase(),
      category: "CHAPA_COMERCIAL",
      description: mat.name,
      specification: `Área líquida ${netAreaSum.toFixed(2)} m² (${list.reduce((s, x) => s + x.quantity, 0)} peça(s))`,
      origin: mat.origin,
      quantity: sheetsNeeded,
      unit: "chapa",
      totalWeightKg: +netWeightSum.toFixed(2),
      unitPriceBRL: +mat.unitPriceBRL.toFixed(2),
      subtotalBRL: +cost.toFixed(2),
    });
  }

  // 3. Ferragens e Acessórios (Camada B) conforme o template e hardwareOptions
  const hwOpt = model.hardwareOptions ?? {
    includeRoldanas: true,
    includeFechadura: true,
    includeDobradicas: true,
    includeParafusosParabolt: true,
    includePrimerTinta: true,
  };

  if (model.mode === "ESTRUTURA_MONTAGEM") {
    if (model.structureTemplate === "portao-correr") {
      const roldana = allHardware.find((h) => h.id === (W > 4500 ? "cf-hw-roldana-v-4pol" : "cf-hw-roldana-v-3pol"));
      const guia = allHardware.find((h) => h.id === "cf-hw-guia-sup-4rolos");
      const fechadura = allHardware.find((h) => h.id === "cf-hw-fechadura-portao");
      const items: { hw?: typeof roldana; qty: number }[] = [];
      if (hwOpt.includeRoldanas !== false) {
        if (roldana) items.push({ hw: roldana, qty: 2 * mult });
        if (guia) items.push({ hw: guia, qty: 1 * mult });
      }
      if (hwOpt.includeFechadura !== false && fechadura) {
        items.push({ hw: fechadura, qty: 1 * mult });
      }
      if (hwOpt.includeDobradicas) {
        const gonzo = allHardware.find((h) => h.id === "cf-hw-gonzo-34");
        if (gonzo) items.push({ hw: gonzo, qty: 1 * mult });
      }
      for (const { hw, qty } of items) {
        if (!hw) continue;
        const sub = qty * hw.unitPriceBRL;
        hardwareCostBRL += sub;
        bom.push({
          id: `bom-hw-${hw.id}`,
          code: hw.id.toUpperCase(),
          category: "FERRAGEM_ACESSORIO",
          description: hw.name,
          specification: hw.specification,
          origin: hw.origin,
          quantity: qty,
          unit: hw.unit,
          totalWeightKg: +(qty * hw.unitWeightKg).toFixed(2),
          unitPriceBRL: hw.unitPriceBRL,
          subtotalBRL: +sub.toFixed(2),
        });
      }
    } else if (model.structureTemplate === "portao-basculante") {
      const kitBasc = allHardware.find((h) => h.id === "cf-hw-kit-basculante");
      const fechadura = allHardware.find((h) => h.id === "cf-hw-fechadura-portao");
      const items: { hw?: typeof kitBasc; qty: number }[] = [];
      if (hwOpt.includeRoldanas !== false && kitBasc) {
        items.push({ hw: kitBasc, qty: 1 * mult });
      }
      if (hwOpt.includeFechadura !== false && fechadura) {
        items.push({ hw: fechadura, qty: 1 * mult });
      }
      for (const { hw, qty } of items) {
        if (!hw) continue;
        const sub = qty * hw.unitPriceBRL;
        hardwareCostBRL += sub;
        bom.push({
          id: `bom-hw-${hw.id}`,
          code: hw.id.toUpperCase(),
          category: "FERRAGEM_ACESSORIO",
          description: hw.name,
          specification: hw.specification,
          origin: hw.origin,
          quantity: qty,
          unit: hw.unit,
          totalWeightKg: +(qty * hw.unitWeightKg).toFixed(2),
          unitPriceBRL: hw.unitPriceBRL,
          subtotalBRL: +sub.toFixed(2),
        });
      }
    } else {
      if (hwOpt.includeParafusosParabolt !== false) {
        const parabolt = allHardware.find((h) => h.id === "cf-hw-parabolt-38");
        if (parabolt) {
          const qty = 8 * mult;
          const sub = qty * parabolt.unitPriceBRL;
          hardwareCostBRL += sub;
          bom.push({
            id: `bom-hw-${parabolt.id}`,
            code: parabolt.id.toUpperCase(),
            category: "FERRAGEM_ACESSORIO",
            description: parabolt.name,
            specification: parabolt.specification,
            origin: parabolt.origin,
            quantity: qty,
            unit: parabolt.unit,
            totalWeightKg: +(qty * parabolt.unitWeightKg).toFixed(2),
            unitPriceBRL: parabolt.unitPriceBRL,
            subtotalBRL: +sub.toFixed(2),
          });
        }
      }
      if (hwOpt.includeDobradicas) {
        const gonzo = allHardware.find((h) => h.id === "cf-hw-gonzo-34");
        if (gonzo) {
          const qty = 2 * mult;
          const sub = qty * gonzo.unitPriceBRL;
          hardwareCostBRL += sub;
          bom.push({
            id: `bom-hw-${gonzo.id}`,
            code: gonzo.id.toUpperCase(),
            category: "FERRAGEM_ACESSORIO",
            description: gonzo.name,
            specification: gonzo.specification,
            origin: gonzo.origin,
            quantity: qty,
            unit: gonzo.unit,
            totalWeightKg: +(qty * gonzo.unitWeightKg).toFixed(2),
            unitPriceBRL: gonzo.unitPriceBRL,
            subtotalBRL: +sub.toFixed(2),
          });
        }
      }
    }
  }

  // Consumíveis e Tratamento Proporcional (Solda MIG, Discos, Fundo Primer/Tinta)
  if (hwOpt.includePrimerTinta !== false) {
    const consHw = allHardware.find((h) => h.id === "cf-hw-consumivel-solda");
    if (consHw) {
      const totalWeightPrelim =
        cutList.reduce((s, c) => s + c.totalWeightKg, 0) +
        sheetPieces.reduce((s, c) => s + c.totalWeightKg, 0);
      const factor = Math.max(0.5, +(totalWeightPrelim / 120).toFixed(1));
      const sub = +(factor * consHw.unitPriceBRL).toFixed(2);
      consumablesCostBRL += sub;
      bom.push({
        id: "bom-consumiveis",
        code: "CF-CONS-01",
        category: "CONSUMIVEL",
        description: consHw.name,
        specification: consHw.specification,
        origin: consHw.origin,
        quantity: factor,
        unit: "kit",
        totalWeightKg: +(factor * consHw.unitWeightKg).toFixed(2),
        unitPriceBRL: consHw.unitPriceBRL,
        subtotalBRL: sub,
      });
    }
  }

  /* =========================================================================
   * TOTAIS FÍSICOS E ORÇAMENTO COMERCIAL
   * ========================================================================= */
  const totalWeightKg = +(
    cutList.reduce((s, c) => s + c.totalWeightKg, 0) +
    sheetPieces.reduce((s, c) => s + c.totalWeightKg, 0)
  ).toFixed(2);

  const totalBars6mCount = barNestingPlans.reduce((s, p) => s + p.barsRequired, 0);
  const totalSurfaceAreaM2 = +(
    (W * H * 2) / 1e6 * (model.mode === "ESTRUTURA_MONTAGEM" ? 0.65 : 0.4) * mult
  ).toFixed(2);

  const totalMaterialsBRL = +(
    profilesCostBRL +
    sheetsCostBRL +
    hardwareCostBRL +
    consumablesCostBRL
  ).toFixed(2);

  const laborCostBRL = +(model.laborHoursCutWeld * model.laborHourlyRateBRL * mult).toFixed(2);
  const paintingCostBRL = +(totalSurfaceAreaM2 * model.paintingAreaRateBRL).toFixed(2);
  const totalCutPerimM = sheetPieces.reduce((s, p) => s + p.cutPerimeterM, 0);
  const cncCuttingCostBRL = +(totalCutPerimM * 14.5).toFixed(2);
  const installationCostBRL = +(model.installationBRL * mult).toFixed(2);

  const totalProductionCostBRL = +(
    laborCostBRL +
    paintingCostBRL +
    cncCuttingCostBRL +
    installationCostBRL
  ).toFixed(2);

  const directCostBRL = +(totalMaterialsBRL + totalProductionCostBRL).toFixed(2);
  const taxesAndOverheadBRL = +(directCostBRL * (model.overheadTaxPct / 100)).toFixed(2);
  const costWithTax = directCostBRL + taxesAndOverheadBRL;
  const profitAmountBRL = +(costWithTax * (model.profitMarginPct / 100)).toFixed(2);
  const finalClientPriceBRL = +(costWithTax + profitAmountBRL).toFixed(2);

  const budget: BudgetBreakdown = {
    profilesCostBRL: +profilesCostBRL.toFixed(2),
    sheetsCostBRL: +sheetsCostBRL.toFixed(2),
    hardwareCostBRL: +hardwareCostBRL.toFixed(2),
    consumablesCostBRL: +consumablesCostBRL.toFixed(2),
    totalMaterialsBRL,
    laborCostBRL,
    paintingCostBRL,
    cncCuttingCostBRL,
    installationCostBRL,
    totalProductionCostBRL,
    directCostBRL,
    taxesAndOverheadBRL,
    profitAmountBRL,
    finalClientPriceBRL,
    pricePerKgBRL: totalWeightKg > 0 ? +(finalClientPriceBRL / totalWeightKg).toFixed(2) : 0,
    pricePerM2BRL:
      (W * H) / 1e6 > 0 ? +(finalClientPriceBRL / (((W * H) / 1e6) * mult)).toFixed(2) : 0,
  };

  /* =========================================================================
   * GERAÇÃO DO DOSSIÊ MULTI-VISTAS ABNT (SVG + ENTIDADES CHAMFER)
   * ========================================================================= */
  const { svg: multiViewSvg, entities: multiViewEntities } = buildMultiViewAbntSheet(
    model,
    cutList,
    sheetPieces,
    totalWeightKg,
    totalBars6mCount,
  );

  const darkTechnicalBoardSvg = buildDarkCadTechnicalBoardSvg(
    model,
    cutList,
    sheetPieces,
    totalWeightKg,
    totalBars6mCount,
  );

  return {
    model,
    cutList,
    barNestingPlans,
    sheetPieces,
    bom,
    budget,
    totalWeightKg,
    totalSurfaceAreaM2,
    totalBars6mCount,
    totalSheetsCount,
    cadEntities,
    cadDimensions,
    multiViewSvg,
    multiViewEntities,
    darkTechnicalBoardSvg,
  };
}

/**
 * Gerador da Prancha Técnica Multi-Vistas (1º Diedro ABNT NBR 10067 + Perspectiva Isométrica + Carimbo)
 */
function buildMultiViewAbntSheet(
  model: ParametricProjectModel,
  cutList: CutListPiece[],
  sheetPieces: SheetCutPiece[],
  totalWeightKg: number,
  totalBars6mCount: number,
): { svg: string; entities: Entity[] } {
  // Folha A3 Normalizada (420 x 297 mm) em coordenadas de folha
  const SW = 420;
  const SH = 297;
  const entities: Entity[] = [];

  // Margem ABNT (Esquerda 25mm para arquivamento, demais 7mm)
  const mL = 25;
  const mR = 7;
  const mT = 7;
  const mB = 7;
  const innerW = SW - mL - mR; // 388
  const innerH = SH - mT - mB; // 283

  entities.push(
    {
      id: uid(),
      layer: "auxiliar",
      type: "polyline",
      closed: true,
      pts: [
        { x: 0, y: 0 },
        { x: SW, y: 0 },
        { x: SW, y: SH },
        { x: 0, y: SH },
      ],
    },
    {
      id: uid(),
      layer: "corte",
      type: "polyline",
      closed: true,
      pts: [
        { x: mL, y: mB },
        { x: SW - mR, y: mB },
        { x: SW - mR, y: SH - mT },
        { x: mL, y: SH - mT },
      ],
    },
  );

  const W = Math.max(100, model.widthMm);
  const H = Math.max(100, model.heightMm);
  const D = Math.max(40, model.mode === "ESTRUTURA_MONTAGEM" ? 80 : model.depthMm);

  // Escala automática para caber as 4 vistas na prancha A3
  const maxDim = Math.max(W, H * 1.4);
  const scaleFactor = 135 / maxDim;
  const ratioLabel =
    scaleFactor >= 0.9 ? "1:1" : `1:${Math.max(2, Math.round(1 / scaleFactor))}`;

  const fW = Math.max(55, Math.min(145, W * scaleFactor));
  const fH = Math.max(40, Math.min(95, H * scaleFactor));
  const fD = Math.max(12, Math.min(35, D * scaleFactor));

  // Coordenadas em SVG (Y para baixo, topo = 0)
  // 1. Vista Frontal (Superior Esquerda)
  const vxFront = 48;
  const vyFront = 34;

  // 2. Vista Lateral Esquerda (À direita da Frontal - 1º Diedro ABNT)
  const vxSide = vxFront + fW + 26;
  const vySide = vyFront;

  // 3. Vista Superior / Planta (Abaixo da Frontal - 1º Diedro ABNT)
  const vxTop = vxFront;
  const vyTop = vyFront + fH + 28;

  // 4. Vista Isométrica 2.5D (Canto Superior Direito)
  const vxIso = 290;
  const vyIso = 45;

  // Elementos internos da vista frontal conforme modo
  const frontInnerLines: string[] = [];
  if (model.mode === "ESTRUTURA_MONTAGEM") {
    const b = 3.5;
    frontInnerLines.push(
      `<rect x="${vxFront + b}" y="${vyFront + b}" width="${fW - 2 * b}" height="${fH - 2 * b}" fill="none" stroke="#0F172A" stroke-width="0.6" />`,
    );
    if (model.cornerJoint === "MEIA_ESQUADRIA_45") {
      frontInnerLines.push(
        `<line x1="${vxFront}" y1="${vyFront}" x2="${vxFront + b}" y2="${vyFront + b}" stroke="#0F172A" stroke-width="0.5" />`,
        `<line x1="${vxFront + fW}" y1="${vyFront}" x2="${vxFront + fW - b}" y2="${vyFront + b}" stroke="#0F172A" stroke-width="0.5" />`,
        `<line x1="${vxFront + fW}" y1="${vyFront + fH}" x2="${vxFront + fW - b}" y2="${vyFront + fH - b}" stroke="#0F172A" stroke-width="0.5" />`,
        `<line x1="${vxFront}" y1="${vyFront + fH}" x2="${vxFront + b}" y2="${vyFront + fH - b}" stroke="#0F172A" stroke-width="0.5" />`,
      );
    }
    const midY = vyFront + fH * 0.58;
    frontInnerLines.push(
      `<line x1="${vxFront + b}" y1="${midY}" x2="${vxFront + fW - b}" y2="${midY}" stroke="#0F172A" stroke-width="0.7" />`,
      `<line x1="${vxFront + b}" y1="${midY + b * 0.8}" x2="${vxFront + fW - b}" y2="${midY + b * 0.8}" stroke="#0F172A" stroke-width="0.7" />`,
    );
    // Grade vertical
    const nBars = 14;
    const stepX = (fW - 2 * b) / nBars;
    const endGridY = model.infillType === "MISTO_LAMBRIL_GRADE" ? midY : vyFront + fH - b;
    for (let i = 1; i < nBars; i++) {
      const gx = vxFront + b + i * stepX;
      frontInnerLines.push(
        `<line x1="${gx.toFixed(1)}" y1="${vyFront + b}" x2="${gx.toFixed(1)}" y2="${endGridY.toFixed(1)}" stroke="#334155" stroke-width="0.4" />`,
      );
    }
    if (model.infillType !== "GRADE_TUBULAR") {
      // Hachura de chapa lambril frisada
      const startLambrilY = model.infillType === "MISTO_LAMBRIL_GRADE" ? midY + b : vyFront + b;
      for (let ly = startLambrilY + 4; ly < vyFront + fH - b; ly += 4.5) {
        frontInnerLines.push(
          `<line x1="${vxFront + b}" y1="${ly.toFixed(1)}" x2="${vxFront + fW - b}" y2="${ly.toFixed(1)}" stroke="#64748B" stroke-width="0.3" stroke-dasharray="3 1.5" />`,
        );
      }
    }
  } else {
    // Modo Peça Individual (ex: Flange ou Chapa Furada)
    const cx = vxFront + fW / 2;
    const cy = vyFront + fH / 2;
    const rOut = Math.min(fW, fH) * 0.44;
    const rIn = rOut * 0.48;
    const rPcd = rOut * 0.76;
    frontInnerLines.push(
      `<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="none" stroke="#0F172A" stroke-width="0.9" />`,
      `<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="none" stroke="#0F172A" stroke-width="0.8" />`,
      `<circle cx="${cx}" cy="${cy}" r="${rPcd}" fill="none" stroke="#DC2626" stroke-width="0.4" stroke-dasharray="4 2 1 2" />`,
    );
    const holes = Math.max(4, model.holesCount || 8);
    for (let i = 0; i < holes; i++) {
      const a = (i * 2 * Math.PI) / holes;
      frontInnerLines.push(
        `<circle cx="${(cx + rPcd * Math.cos(a)).toFixed(1)}" cy="${(cy + rPcd * Math.sin(a)).toFixed(1)}" r="2.6" fill="none" stroke="#0F172A" stroke-width="0.6" />`,
      );
    }
  }

  // Projeção Isométrica 2.5D (Caixa / Estrutura 30°)
  const isoW = fW * 0.55;
  const isoH = fH * 0.55;
  const isoDx = isoW * 0.866;
  const isoDy = -isoW * 0.35;
  const p0 = { x: vxIso, y: vyIso + isoH };
  const p1 = { x: vxIso + isoDx, y: vyIso + isoH + isoDy };
  const p2 = { x: vxIso + isoDx, y: vyIso + isoDy };
  const p3 = { x: vxIso, y: vyIso };
  const depthDx = 9;
  const depthDy = 5;

  // Linhas da tabela de corte resumida na prancha
  const topCutRows = cutList.slice(0, 6);
  const tableRowsSvg = topCutRows
    .map(
      (c, i) => `
      <g transform="translate(240, ${172 + i * 6.5})">
        <rect x="0" y="0" width="173" height="6.5" fill="${i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"}" stroke="#94A3B8" stroke-width="0.3" />
        <text x="3" y="4.6" font-family="monospace" font-size="3.2" font-weight="bold" fill="#0F172A">${c.tag}</text>
        <text x="16" y="4.6" font-family="sans-serif" font-size="3.1" fill="#1E293B">${c.name.slice(0, 28)}</text>
        <text x="86" y="4.6" font-family="monospace" font-size="3.0" fill="#334155">${c.dimensionsDesc.slice(0, 18)}</text>
        <text x="128" y="4.6" font-family="monospace" font-size="3.2" font-weight="bold" fill="#0F172A">${c.quantity}x</text>
        <text x="142" y="4.6" font-family="monospace" font-size="3.2" font-weight="bold" fill="#0F172A">${c.unitLengthMm}mm</text>
        <text x="162" y="4.6" font-family="monospace" font-size="2.9" fill="#475569">${c.cutAngleLeftDeg}°/${c.cutAngleRightDeg}°</text>
      </g>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="100%" height="100%">
    <rect x="0" y="0" width="${SW}" height="${SH}" fill="#FFFFFF" />
    <!-- Margem ABNT A3 -->
    <rect x="${mL}" y="${mT}" width="${innerW}" height="${innerH}" fill="none" stroke="#0F172A" stroke-width="0.9" />
    <rect x="${mL + 2}" y="${mT + 2}" width="${innerW - 4}" height="${innerH - 4}" fill="none" stroke="#0F172A" stroke-width="0.35" />

    <!-- Cabeçalho Superior da Prancha -->
    <text x="${mL + 6}" y="${mT + 8}" font-family="monospace" font-size="4.2" font-weight="bold" fill="#0F172A">
      DOSSIÊ TÉCNICO DE FABRICAÇÃO MULTI-VISTAS (1º DIEDRO ABNT NBR 10067) — CATÁLOGO COSTA FERRO
    </text>
    <line x1="${mL + 2}" y1="${mT + 11}" x2="${SW - mR - 2}" y2="${mT + 11}" stroke="#CBD5E1" stroke-width="0.4" />

    <!-- ================================================================= -->
    <!-- 1. VISTA FRONTAL (ELEVAÇÃO PRINCIPAL)                             -->
    <!-- ================================================================= -->
    <text x="${vxFront}" y="${vyFront - 4}" font-family="monospace" font-size="3.8" font-weight="bold" fill="#0F172A">
      1. VISTA FRONTAL (ELEVAÇÃO) — ESCALA ${ratioLabel}
    </text>
    <rect x="${vxFront}" y="${vyFront}" width="${fW}" height="${fH}" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.0" />
    ${frontInnerLines.join("\n")}

    <!-- Cota Horizontal Superior (Largura Total W) -->
    <line x1="${vxFront}" y1="${vyFront}" x2="${vxFront}" y2="${vyFront - 12}" stroke="#0284C7" stroke-width="0.4" />
    <line x1="${vxFront + fW}" y1="${vyFront}" x2="${vxFront + fW}" y2="${vyFront - 12}" stroke="#0284C7" stroke-width="0.4" />
    <line x1="${vxFront}" y1="${vyFront - 9}" x2="${vxFront + fW}" y2="${vyFront - 9}" stroke="#0284C7" stroke-width="0.6" />
    <text x="${vxFront + fW / 2}" y="${vyFront - 10.5}" font-family="monospace" font-size="4.0" font-weight="bold" fill="#0369A1" text-anchor="middle">
      ${W} mm
    </text>

    <!-- Cota Vertical Esquerda (Altura Total H) -->
    <line x1="${vxFront}" y1="${vyFront}" x2="${vxFront - 12}" y2="${vyFront}" stroke="#0284C7" stroke-width="0.4" />
    <line x1="${vxFront}" y1="${vyFront + fH}" x2="${vxFront - 12}" y2="${vyFront + fH}" stroke="#0284C7" stroke-width="0.4" />
    <line x1="${vxFront - 9}" y1="${vyFront}" x2="${vxFront - 9}" y2="${vyFront + fH}" stroke="#0284C7" stroke-width="0.6" />
    <text x="${vxFront - 11}" y="${vyFront + fH / 2}" font-family="monospace" font-size="4.0" font-weight="bold" fill="#0369A1" text-anchor="middle" transform="rotate(-90 ${vxFront - 11} ${vyFront + fH / 2})">
      ${H} mm
    </text>

    <!-- Balões de Referência de Peças (Callouts P01, P02, P03) -->
    <line x1="${vxFront + 12}" y1="${vyFront + 2}" x2="${vxFront + 22}" y2="${vyFront - 14}" stroke="#DC2626" stroke-width="0.5" />
    <circle cx="${vxFront + 24}" cy="${vyFront - 15}" r="4.2" fill="#FEF2F2" stroke="#DC2626" stroke-width="0.6" />
    <text x="${vxFront + 24}" y="${vyFront - 13.7}" font-family="monospace" font-size="3.1" font-weight="bold" fill="#DC2626" text-anchor="middle">P01</text>

    <line x1="${vxFront + fW}" y1="${vyFront + fH * 0.35}" x2="${vxFront + fW + 10}" y2="${vyFront + fH * 0.25}" stroke="#DC2626" stroke-width="0.5" />
    <circle cx="${vxFront + fW + 13}" cy="${vyFront + fH * 0.23}" r="4.2" fill="#FEF2F2" stroke="#DC2626" stroke-width="0.6" />
    <text x="${vxFront + fW + 13}" y="${vyFront + fH * 0.23 + 1.2}" font-family="monospace" font-size="3.1" font-weight="bold" fill="#DC2626" text-anchor="middle">P02</text>

    <!-- ================================================================= -->
    <!-- 2. VISTA LATERAL ESQUERDA (PERFIL / CORTE A-A)                    -->
    <!-- ================================================================= -->
    <text x="${vxSide}" y="${vySide - 4}" font-family="monospace" font-size="3.6" font-weight="bold" fill="#0F172A">
      2. VISTA LATERAL
    </text>
    <rect x="${vxSide}" y="${vySide}" width="${fD}" height="${fH}" fill="#F1F5F9" stroke="#0F172A" stroke-width="0.9" />
    <line x1="${vxSide + fD / 2}" y1="${vySide - 4}" x2="${vxSide + fD / 2}" y2="${vySide + fH + 4}" stroke="#DC2626" stroke-width="0.35" stroke-dasharray="5 2 1 2" />
    <text x="${vxSide + fD / 2}" y="${vySide + fH + 10}" font-family="monospace" font-size="3.3" fill="#0369A1" text-anchor="middle">
      Esp./Prof. ${D}mm
    </text>

    <!-- ================================================================= -->
    <!-- 3. VISTA SUPERIOR (PLANTA EM 1º DIEDRO)                           -->
    <!-- ================================================================= -->
    <text x="${vxTop}" y="${vyTop - 4}" font-family="monospace" font-size="3.6" font-weight="bold" fill="#0F172A">
      3. VISTA SUPERIOR (PLANTA DE MONTAGEM)
    </text>
    <rect x="${vxTop}" y="${vyTop}" width="${fW}" height="${fD}" fill="#F1F5F9" stroke="#0F172A" stroke-width="0.9" />
    <line x1="${vxTop - 5}" y1="${vyTop + fD / 2}" x2="${vxTop + fW + 5}" y2="${vyTop + fD / 2}" stroke="#DC2626" stroke-width="0.35" stroke-dasharray="6 2 1 2" />

    <!-- ================================================================= -->
    <!-- 4. PERSPECTIVA ISOMÉTRICA 2.5D DE MONTAGEM                        -->
    <!-- ================================================================= -->
    <text x="${vxIso}" y="${vyIso - 22}" font-family="monospace" font-size="3.8" font-weight="bold" fill="#0F172A">
      4. PERSPECTIVA ISOMÉTRICA 2.5D
    </text>
    <polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="#E2E8F0" stroke="#0F172A" stroke-width="0.85" />
    <polygon points="${p3.x},${p3.y} ${p2.x},${p2.y} ${p2.x - depthDx},${p2.y - depthDy} ${p3.x - depthDx},${p3.y - depthDy}" fill="#CBD5E1" stroke="#0F172A" stroke-width="0.65" />
    <polygon points="${p0.x},${p0.y} ${p3.x},${p3.y} ${p3.x - depthDx},${p3.y - depthDy} ${p0.x - depthDx},${p0.y - depthDy}" fill="#94A3B8" stroke="#0F172A" stroke-width="0.65" />
    <line x1="${(p0.x + p3.x) / 2}" y1="${(p0.y + p3.y) / 2}" x2="${(p1.x + p2.x) / 2}" y2="${(p1.y + p2.y) / 2}" stroke="#0F172A" stroke-width="0.6" />

    <!-- ================================================================= -->
    <!-- 5. TABELA DE CORTE E MATERIAIS NA PRANCHA                         -->
    <!-- ================================================================= -->
    <g transform="translate(240, 164)">
      <rect x="0" y="0" width="173" height="8" fill="#0F172A" />
      <text x="3" y="5.4" font-family="monospace" font-size="3.3" font-weight="bold" fill="#FFFFFF">TAG</text>
      <text x="16" y="5.4" font-family="monospace" font-size="3.3" font-weight="bold" fill="#FFFFFF">DESCRIÇÃO DA PEÇA</text>
      <text x="86" y="5.4" font-family="monospace" font-size="3.3" font-weight="bold" fill="#FFFFFF">PERFIL / DIMENSÃO</text>
      <text x="128" y="5.4" font-family="monospace" font-size="3.3" font-weight="bold" fill="#FFFFFF">QTD</text>
      <text x="142" y="5.4" font-family="monospace" font-size="3.3" font-weight="bold" fill="#FFFFFF">COMPR.</text>
      <text x="162" y="5.4" font-family="monospace" font-size="3.3" font-weight="bold" fill="#FFFFFF">PONTA</text>
    </g>
    ${tableRowsSvg}

    <!-- ================================================================= -->
    <!-- 6. CARIMBO TÉCNICO NORMALIZADO ABNT NBR 10582                     -->
    <!-- ================================================================= -->
    <g transform="translate(240, 232)">
      <rect x="0" y="0" width="173" height="58" fill="#FFFFFF" stroke="#0F172A" stroke-width="0.9" />
      <line x1="0" y1="14" x2="173" y2="14" stroke="#0F172A" stroke-width="0.5" />
      <line x1="0" y1="28" x2="173" y2="28" stroke="#0F172A" stroke-width="0.5" />
      <line x1="0" y1="43" x2="173" y2="43" stroke="#0F172A" stroke-width="0.5" />
      <line x1="115" y1="0" x2="115" y2="58" stroke="#0F172A" stroke-width="0.5" />
      <line x1="58" y1="28" x2="58" y2="58" stroke="#0F172A" stroke-width="0.5" />

      <text x="4" y="4.5" font-family="monospace" font-size="2.6" fill="#64748B">TÍTULO DO PROJETO / ESTRUTURA</text>
      <text x="4" y="10.8" font-family="sans-serif" font-size="4.4" font-weight="bold" fill="#0F172A">${model.projectName.slice(0, 38)}</text>

      <text x="118" y="4.5" font-family="monospace" font-size="2.6" fill="#64748B">CÓDIGO / REVISÃO</text>
      <text x="118" y="10.8" font-family="monospace" font-size="4.2" font-weight="bold" fill="#0F172A">${model.projectCode} · ${model.revision}</text>

      <text x="4" y="18.5" font-family="monospace" font-size="2.6" fill="#64748B">CLIENTE / OBRA</text>
      <text x="4" y="24.8" font-family="sans-serif" font-size="3.8" font-weight="bold" fill="#1E293B">${model.clientName.slice(0, 38)}</text>

      <text x="118" y="18.5" font-family="monospace" font-size="2.6" fill="#64748B">ORIGEM DE MATERIAIS</text>
      <text x="118" y="24.8" font-family="monospace" font-size="3.4" font-weight="bold" fill="#0284C7">CATÁLOGO COSTA FERRO</text>

      <text x="4" y="32.5" font-family="monospace" font-size="2.6" fill="#64748B">MASSA TOTAL CALCULADA</text>
      <text x="4" y="39.5" font-family="monospace" font-size="4.4" font-weight="bold" fill="#0F172A">${totalWeightKg.toFixed(2)} kg</text>

      <text x="61" y="32.5" font-family="monospace" font-size="2.6" fill="#64748B">BARRAS 6M / CHAPAS</text>
      <text x="61" y="39.5" font-family="monospace" font-size="3.8" font-weight="bold" fill="#0F172A">${totalBars6mCount} br · ${sheetPieces.length} ch</text>

      <text x="118" y="32.5" font-family="monospace" font-size="2.6" fill="#64748B">ESCALA / UNIDADE</text>
      <text x="118" y="39.5" font-family="monospace" font-size="3.8" font-weight="bold" fill="#0F172A">${ratioLabel} · mm (1º Diedro)</text>

      <text x="4" y="47.5" font-family="monospace" font-size="2.6" fill="#64748B">RESPONSÁVEL / PROJETISTA</text>
      <text x="4" y="54.2" font-family="monospace" font-size="3.4" fill="#0F172A">${model.drafterName.slice(0, 22)}</text>

      <text x="61" y="47.5" font-family="monospace" font-size="2.6" fill="#64748B">ENCAIXE / PROCESSO</text>
      <text x="61" y="54.2" font-family="monospace" font-size="3.2" fill="#0F172A">${model.cornerJoint === "MEIA_ESQUADRIA_45" ? "Meia-Esquadria 45°" : "Corte Reto 90°"}</text>

      <text x="118" y="47.5" font-family="monospace" font-size="2.6" fill="#64748B">SISTEMA CAD</text>
      <text x="118" y="54.2" font-family="monospace" font-size="3.6" font-weight="bold" fill="#0F172A">CALDRA · CHAMFER</text>
    </g>
  </svg>`;

  return { svg, entities };
}

/**
 * Renderizador do Quadro Técnico com Fundo Escuro (CAD Blueprint)
 * Exibe Vista Frontal e Vista Lateral cotadas lado a lado em mm e cm,
 * miniatura sólida da vista isométrica 2.5D e legenda técnica ABNT.
 */
export function buildDarkCadTechnicalBoardSvg(
  model: ParametricProjectModel,
  cutList: CutListPiece[],
  sheetPieces: SheetCutPiece[],
  totalWeightKg: number,
  totalBars6mCount: number,
): string {
  const BW = 960;
  const BH = 540;

  const W = Math.max(100, model.widthMm);
  const H = Math.max(100, model.heightMm);
  const D = Math.max(40, model.mode === "ESTRUTURA_MONTAGEM" ? 80 : model.depthMm);

  const wCm = (W / 10).toFixed(0);
  const hCm = (H / 10).toFixed(0);
  const dCm = (D / 10).toFixed(0);

  // Escala proporcional no canvas escuro
  const maxDim = Math.max(W, H * 1.35);
  const scale = 230 / maxDim;
  const ratioLabel =
    scale >= 0.9 ? "1:1" : `1:${Math.max(2, Math.round(1 / scale))}`;

  const fW = Math.max(90, Math.min(340, W * scale));
  const fH = Math.max(70, Math.min(220, H * scale));
  const fD = Math.max(24, Math.min(80, D * scale));

  // Coordenadas da Vista Frontal (Esquerda)
  const vxFront = 75;
  const vyFront = 105;

  // Coordenadas da Vista Lateral (Lado a Lado com a Frontal)
  const vxSide = vxFront + fW + 55;
  const vySide = vyFront;

  // Linhas internas da vista frontal
  const frontInnerLines: string[] = [];
  if (model.mode === "ESTRUTURA_MONTAGEM") {
    const b = 6;
    frontInnerLines.push(
      `<rect x="${vxFront + b}" y="${vyFront + b}" width="${fW - 2 * b}" height="${fH - 2 * b}" fill="none" stroke="#F8FAFC" stroke-width="1.2" />`,
    );
    if (model.cornerJoint === "MEIA_ESQUADRIA_45") {
      frontInnerLines.push(
        `<line x1="${vxFront}" y1="${vyFront}" x2="${vxFront + b}" y2="${vyFront + b}" stroke="#38BDF8" stroke-width="1.2" />`,
        `<line x1="${vxFront + fW}" y1="${vyFront}" x2="${vxFront + fW - b}" y2="${vyFront + b}" stroke="#38BDF8" stroke-width="1.2" />`,
        `<line x1="${vxFront + fW}" y1="${vyFront + fH}" x2="${vxFront + fW - b}" y2="${vyFront + fH - b}" stroke="#38BDF8" stroke-width="1.2" />`,
        `<line x1="${vxFront}" y1="${vyFront + fH}" x2="${vxFront + b}" y2="${vyFront + fH - b}" stroke="#38BDF8" stroke-width="1.2" />`,
      );
    }
    const midY = vyFront + fH * 0.58;
    frontInnerLines.push(
      `<line x1="${vxFront + b}" y1="${midY}" x2="${vxFront + fW - b}" y2="${midY}" stroke="#F8FAFC" stroke-width="1.4" />`,
      `<line x1="${vxFront + b}" y1="${midY + b * 0.8}" x2="${vxFront + fW - b}" y2="${midY + b * 0.8}" stroke="#F8FAFC" stroke-width="1.4" />`,
    );
    // Grade vertical em branco nítido
    const nBars = 12;
    const stepX = (fW - 2 * b) / nBars;
    const endGridY = model.infillType === "MISTO_LAMBRIL_GRADE" ? midY : vyFront + fH - b;
    for (let i = 1; i < nBars; i++) {
      const gx = vxFront + b + i * stepX;
      frontInnerLines.push(
        `<line x1="${gx.toFixed(1)}" y1="${vyFront + b}" x2="${gx.toFixed(1)}" y2="${endGridY.toFixed(1)}" stroke="#94A3B8" stroke-width="1.0" />`,
      );
    }
    if (model.infillType !== "GRADE_TUBULAR") {
      const startLambrilY = model.infillType === "MISTO_LAMBRIL_GRADE" ? midY + b : vyFront + b;
      for (let ly = startLambrilY + 8; ly < vyFront + fH - b; ly += 9) {
        frontInnerLines.push(
          `<line x1="${vxFront + b}" y1="${ly.toFixed(1)}" x2="${vxFront + fW - b}" y2="${ly.toFixed(1)}" stroke="#64748B" stroke-width="0.8" stroke-dasharray="6 3" />`,
        );
      }
    }
  } else {
    // Modo Peça Individual
    const cx = vxFront + fW / 2;
    const cy = vyFront + fH / 2;
    const rOut = Math.min(fW, fH) * 0.44;
    const rIn = rOut * 0.48;
    const rPcd = rOut * 0.76;
    frontInnerLines.push(
      `<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="none" stroke="#FFFFFF" stroke-width="2.0" />`,
      `<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="none" stroke="#FFFFFF" stroke-width="1.8" />`,
      `<circle cx="${cx}" cy="${cy}" r="${rPcd}" fill="none" stroke="#EF4444" stroke-width="1.0" stroke-dasharray="8 4 2 4" />`,
    );
    const holes = Math.max(4, model.holesCount || 8);
    for (let i = 0; i < holes; i++) {
      const a = (i * 2 * Math.PI) / holes;
      frontInnerLines.push(
        `<circle cx="${(cx + rPcd * Math.cos(a)).toFixed(1)}" cy="${(cy + rPcd * Math.sin(a)).toFixed(1)}" r="6" fill="#1E293B" stroke="#FFFFFF" stroke-width="1.4" />`,
      );
    }
  }

  // Miniatura da Vista Isométrica 2.5D (Canto Superior Direito)
  const vxIso = 740;
  const vyIso = 70;
  const isoW = 120;
  const isoH = 80;
  const isoDx = isoW * 0.866 * 0.65;
  const isoDy = -isoW * 0.35 * 0.65;
  const depthDx = 22;
  const depthDy = 12;

  const p0 = { x: vxIso, y: vyIso + isoH };
  const p1 = { x: vxIso + isoDx, y: vyIso + isoH + isoDy };
  const p2 = { x: vxIso + isoDx, y: vyIso + isoDy };
  const p3 = { x: vxIso, y: vyIso };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" width="100%" height="100%" style="border-radius:12px;background:#070B14;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace">
    <defs>
      <pattern id="darkCadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#131F37" stroke-width="0.7" />
      </pattern>
      <marker id="arrowCyanStart" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
        <path d="M 6 0 L 0 3 L 6 6 Z" fill="#38BDF8" />
      </marker>
      <marker id="arrowCyanEnd" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
        <path d="M 0 0 L 6 3 L 0 6 Z" fill="#38BDF8" />
      </marker>
    </defs>

    <!-- Fundo Escuro com Grid CAD Blueprint -->
    <rect width="${BW}" height="${BH}" fill="#070B14" />
    <rect width="${BW}" height="${BH}" fill="url(#darkCadGrid)" />

    <!-- Moldura Técnica Perimetral -->
    <rect x="16" y="16" width="${BW - 32}" height="${BH - 32}" fill="none" stroke="#0284C7" stroke-width="1.8" rx="8" />
    <rect x="22" y="22" width="${BW - 44}" height="${BH - 44}" fill="none" stroke="#1E3A5F" stroke-width="0.8" rx="6" />

    <!-- Título do Quadro Técnico Superior -->
    <g transform="translate(36, 46)">
      <text x="0" y="0" font-size="14" font-weight="bold" fill="#38BDF8" letter-spacing="1">
        CALDRA CAD · QUADRO TÉCNICO MULTI-VISTAS (ABNT 1º DIEDRO)
      </text>
      <text x="0" y="16" font-size="10.5" fill="#94A3B8">
        Projeto: ${model.projectName} · Base: Catálogo Costa Ferro · Projeção Ortogonal Cotada
      </text>
    </g>

    <!-- =================================================================== -->
    <!-- 1. VISTA FRONTAL COTADA (LADO A LADO)                               -->
    <!-- =================================================================== -->
    <g>
      <text x="${vxFront}" y="${vyFront - 38}" font-size="12" font-weight="bold" fill="#F8FAFC">
        1. VISTA FRONTAL (ELEVAÇÃO PRINCIPAL)
      </text>
      <text x="${vxFront}" y="${vyFront - 24}" font-size="10" fill="#38BDF8">
        Escala ${ratioLabel} · Encaixe: ${model.cornerJoint === "MEIA_ESQUADRIA_45" ? "Meia-Esquadria 45°" : "Corte Reto 90°"}
      </text>

      <!-- Geometria Frontal em Linhas Brancas Nítidas -->
      <rect x="${vxFront}" y="${vyFront}" width="${fW}" height="${fH}" fill="#0F172A" stroke="#FFFFFF" stroke-width="2.2" />
      ${frontInnerLines.join("\n")}

      <!-- COTA HORIZONTAL SUPERIOR (LARGURA TOTAL W em mm e cm) -->
      <line x1="${vxFront}" y1="${vyFront}" x2="${vxFront}" y2="${vyFront - 20}" stroke="#0284C7" stroke-width="0.8" />
      <line x1="${vxFront + fW}" y1="${vyFront}" x2="${vxFront + fW}" y2="${vyFront - 20}" stroke="#0284C7" stroke-width="0.8" />
      <line x1="${vxFront + 4}" y1="${vyFront - 15}" x2="${vxFront + fW - 4}" y2="${vyFront - 15}" stroke="#38BDF8" stroke-width="1.4" marker-start="url(#arrowCyanStart)" marker-end="url(#arrowCyanEnd)" />
      <text x="${vxFront + fW / 2}" y="${vyFront - 18}" font-size="11" font-weight="bold" fill="#38BDF8" text-anchor="middle">
        ${W} mm (${wCm} cm)
      </text>

      <!-- COTA VERTICAL ESQUERDA (ALTURA TOTAL H em mm e cm) -->
      <line x1="${vxFront}" y1="${vyFront}" x2="${vxFront - 24}" y2="${vyFront}" stroke="#0284C7" stroke-width="0.8" />
      <line x1="${vxFront}" y1="${vyFront + fH}" x2="${vxFront - 24}" y2="${vyFront + fH}" stroke="#0284C7" stroke-width="0.8" />
      <line x1="${vxFront - 18}" y1="${vyFront + 4}" x2="${vxFront - 18}" y2="${vyFront + fH - 4}" stroke="#38BDF8" stroke-width="1.4" marker-start="url(#arrowCyanStart)" marker-end="url(#arrowCyanEnd)" />
      <text x="${vxFront - 22}" y="${vyFront + fH / 2}" font-size="11" font-weight="bold" fill="#38BDF8" text-anchor="middle" transform="rotate(-90 ${vxFront - 22} ${vyFront + fH / 2})">
        ${H} mm (${hCm} cm)
      </text>
    </g>

    <!-- =================================================================== -->
    <!-- 2. VISTA LATERAL COTADA (LADO A LADO)                               -->
    <!-- =================================================================== -->
    <g>
      <text x="${vxSide}" y="${vySide - 38}" font-size="12" font-weight="bold" fill="#F8FAFC">
        2. VISTA LATERAL (PERFIL)
      </text>
      <text x="${vxSide}" y="${vySide - 24}" font-size="10" fill="#38BDF8">
        Profundidade / Batente
      </text>

      <!-- Geometria Lateral em Linhas Brancas Nítidas -->
      <rect x="${vxSide}" y="${vySide}" width="${fD}" height="${fH}" fill="#0F172A" stroke="#FFFFFF" stroke-width="2.2" />
      <line x1="${vxSide + fD / 2}" y1="${vySide - 8}" x2="${vxSide + fD / 2}" y2="${vySide + fH + 8}" stroke="#EF4444" stroke-width="0.8" stroke-dasharray="8 4 2 4" />

      <!-- Cota Horizontal da Lateral (Profundidade D em mm e cm) -->
      <line x1="${vxSide}" y1="${vySide + fH}" x2="${vxSide}" y2="${vySide + fH + 22}" stroke="#0284C7" stroke-width="0.8" />
      <line x1="${vxSide + fD}" y1="${vySide + fH}" x2="${vxSide + fD}" y2="${vySide + fH + 22}" stroke="#0284C7" stroke-width="0.8" />
      <line x1="${vxSide + 4}" y1="${vySide + fH + 16}" x2="${vxSide + fD - 4}" y2="${vySide + fH + 16}" stroke="#38BDF8" stroke-width="1.4" marker-start="url(#arrowCyanStart)" marker-end="url(#arrowCyanEnd)" />
      <text x="${vxSide + fD / 2}" y="${vySide + fH + 30}" font-size="10.5" font-weight="bold" fill="#38BDF8" text-anchor="middle">
        ${D} mm (${dCm} cm)
      </text>
    </g>

    <!-- =================================================================== -->
    <!-- 3. MINIATURA DA VISTA ISOMÉTRICA SÓLIDA 2.5D                        -->
    <!-- =================================================================== -->
    <g>
      <rect x="700" y="46" width="224" height="175" fill="#0D1527" stroke="#1E3A5F" stroke-width="1" rx="8" />
      <text x="712" y="66" font-size="11" font-weight="bold" fill="#38BDF8">
        3. PERSPECTIVA ISOMÉTRICA 2.5D
      </text>
      <text x="712" y="80" font-size="9.5" fill="#94A3B8">
        Projeção Axial 30° com Oclusão Sólida
      </text>

      <!-- Miniatura Sólida 2.5D -->
      <polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="#1E293B" stroke="#FFFFFF" stroke-width="1.8" />
      <polygon points="${p3.x},${p3.y} ${p2.x},${p2.y} ${p2.x - depthDx},${p2.y - depthDy} ${p3.x - depthDx},${p3.y - depthDy}" fill="#334155" stroke="#FFFFFF" stroke-width="1.4" />
      <polygon points="${p0.x},${p0.y} ${p3.x},${p3.y} ${p3.x - depthDx},${p3.y - depthDy} ${p0.x - depthDx},${p0.y - depthDy}" fill="#475569" stroke="#FFFFFF" stroke-width="1.4" />
      <line x1="${(p0.x + p3.x) / 2}" y1="${(p0.y + p3.y) / 2}" x2="${(p1.x + p2.x) / 2}" y2="${(p1.y + p2.y) / 2}" stroke="#38BDF8" stroke-width="1.4" />
    </g>

    <!-- =================================================================== -->
    <!-- 4. LEGENDA TÉCNICA ABNT (CANTO INFERIOR DIREITO)                    -->
    <!-- =================================================================== -->
    <g transform="translate(560, 360)">
      <rect x="0" y="0" width="364" height="144" fill="#0D1527" stroke="#38BDF8" stroke-width="1.4" rx="8" />
      <line x1="0" y1="36" x2="364" y2="36" stroke="#1E3A5F" stroke-width="1" />
      <line x1="0" y1="72" x2="364" y2="72" stroke="#1E3A5F" stroke-width="1" />
      <line x1="0" y1="108" x2="364" y2="108" stroke="#1E3A5F" stroke-width="1" />
      <line x1="220" y1="36" x2="220" y2="144" stroke="#1E3A5F" stroke-width="1" />

      <!-- Linha 1: Título e Código -->
      <text x="12" y="16" font-size="9" fill="#94A3B8">TÍTULO DA ESTRUTURA / PEÇA</text>
      <text x="12" y="29" font-size="12" font-weight="bold" fill="#F8FAFC">${model.projectName.slice(0, 36)}</text>
      <text x="232" y="16" font-size="9" fill="#94A3B8">CÓDIGO / REV.</text>
      <text x="232" y="29" font-size="12" font-weight="bold" fill="#38BDF8">${model.projectCode} · ${model.revision}</text>

      <!-- Linha 2: Cliente e Escala -->
      <text x="12" y="50" font-size="9" fill="#94A3B8">CLIENTE / OBRA</text>
      <text x="12" y="64" font-size="11" font-weight="bold" fill="#E2E8F0">${model.clientName.slice(0, 28)}</text>
      <text x="232" y="50" font-size="9" fill="#94A3B8">ESCALA / PROJEÇÃO</text>
      <text x="232" y="64" font-size="11" font-weight="bold" fill="#F8FAFC">${ratioLabel} · 1º Diedro</text>

      <!-- Linha 3: Massa Total e Barras -->
      <text x="12" y="86" font-size="9" fill="#94A3B8">MASSA TOTAL CALCULADA</text>
      <text x="12" y="100" font-size="12" font-weight="bold" fill="#38BDF8">${totalWeightKg.toFixed(2)} kg</text>
      <text x="232" y="86" font-size="9" fill="#94A3B8">BARRAS 6M / CHAPAS</text>
      <text x="232" y="100" font-size="11" font-weight="bold" fill="#F8FAFC">${totalBars6mCount} brs · ${sheetPieces.length} chs</text>

      <!-- Linha 4: Data e Origem Costa Ferro -->
      <text x="12" y="122" font-size="9" fill="#94A3B8">DATA DE EMISSÃO</text>
      <text x="12" y="135" font-size="10.5" fill="#E2E8F0">${new Date().toLocaleDateString("pt-BR")}</text>
      <text x="232" y="122" font-size="9" fill="#94A3B8">BASE TÉCNICA</text>
      <text x="232" y="135" font-size="11" font-weight="bold" fill="#38BDF8">Catálogo Costa Ferro</text>
    </g>
  </svg>`;
}

