/**
 * CALDRA — CATÁLOGO TÉCNICO ESTRUTURADO COSTA FERRO
 *
 * Banco de dados técnico estruturado em 3 camadas conectadas:
 *  - Camada A: Materiais Comerciais (Perfis, Tubos Quadrados/Retangulares/Redondos, Barras e Chapas)
 *  - Camada B: Componentes, Ferragens e Consumíveis de Montagem
 *  - Camada C: Operações, Regras de Corte e Limites de Fabricação
 *
 * Dados reais de massa linear (kg/m), espessuras de parede (mm), comprimentos comerciais (6000mm / 12000mm)
 * e áreas de chapa, com preços unitários editáveis e persistidos em localStorage.
 */

export type CostaFerroLayer = "A_MATERIAIS" | "B_FERRAGENS" | "C_OPERACOES";

export type CostaFerroMaterialCategory =
  | "TUBO_QUADRADO_METALON"
  | "TUBO_RETANGULAR_METALON"
  | "TUBO_REDONDO_INDUSTRIAL"
  | "TUBO_CONDUCAO_DIN_SCH"
  | "PERFIL_ESTRUTURAL"
  | "CANTONEIRA_BARRA"
  | "CHAPA_ACO";

export interface CostaFerroMaterialItem {
  id: string;
  layer: "A_MATERIAIS";
  category: CostaFerroMaterialCategory;
  subcategory: string;
  name: string;
  norm: string;
  dimensionsMm: string;
  widthMm: number;
  heightMm: number;
  diameterMm?: number;
  wallThicknessMm: number;
  commercialLengthMm?: number; // 6000 ou 12000 para barras/tubos
  sheetAreaMm?: { widthMm: number; lengthMm: number }; // para chapas
  linearWeightKgM?: number; // kg/m para tubos/perfis/barras
  areaWeightKgM2?: number; // kg/m² para chapas
  unitWeightKg: number; // peso total de 1 barra comercial (6m/12m) ou 1 chapa
  finish?: "Preto" | "Zincado / Galvanizado" | "Laminado" | "Decapado";
  origin: "Catálogo Costa Ferro" | "Personalizado";
  unitPriceBRL: number; // Preço por barra (ou por chapa)
  pricePerKgBRL: number; // Preço de referência por kg
}

export interface CostaFerroHardwareItem {
  id: string;
  layer: "B_FERRAGENS";
  category:
    | "ROLDANA_TRILHO"
    | "DOBRADICA_GONZO"
    | "FECHADURA_TRAVA"
    | "BASCULANTE_CABO"
    | "FIXACAO_ACABAMENTO"
    | "CONSUMIVEL_SOLDA_CORTE";
  name: string;
  specification: string;
  application: string;
  unit: "un" | "par" | "m" | "kg" | "kit" | "lata";
  unitWeightKg: number;
  unitPriceBRL: number;
  origin: "Catálogo Costa Ferro" | "Personalizado";
}

export interface CostaFerroOperationRule {
  id: string;
  layer: "C_OPERACOES";
  process: "CORTE_SERRA" | "CORTE_CNC_TERMICO" | "GUILHOTINA" | "DOBRA_PRENSA" | "SOLDAGEM_MIG_MMA";
  name: string;
  norm: string;
  kerfMm: number;
  minThicknessMm: number;
  maxThicknessMm: number;
  supportedAnglesDeg: number[];
  minBendRadiusFactor?: number;
  defaultHourlyRateBRL: number;
  notes: string;
}

const PRICE_OVERRIDES_KEY = "caldra.costaferro.price_overrides.v1";
const CUSTOM_ITEMS_KEY = "caldra.costaferro.custom_items.v1";

const DEFAULT_STEEL_PRICE_KG = 9.8; // R$/kg médio de referência editável
const DEFAULT_ZINC_PRICE_KG = 11.4;

function makeSquareTube(
  sideMm: number,
  wallMm: number,
  kgM: number,
  finish: "Preto" | "Zincado / Galvanizado" = "Preto",
  inchLabel?: string,
): CostaFerroMaterialItem {
  const barLen = 6000;
  const barWeight = +(kgM * (barLen / 1000)).toFixed(2);
  const priceKg = finish === "Preto" ? DEFAULT_STEEL_PRICE_KG : DEFAULT_ZINC_PRICE_KG;
  const wallStr = wallMm.toFixed(2).replace(".", ",");
  const suffix = finish === "Zincado / Galvanizado" ? " Zincado" : "";
  const inch = inchLabel ? ` [${inchLabel}]` : "";
  return {
    id: `cf-tq-${sideMm}x${sideMm}x${wallMm.toFixed(2)}${finish === "Preto" ? "" : "-zn"}`,
    layer: "A_MATERIAIS",
    category: "TUBO_QUADRADO_METALON",
    subcategory: `Metalon Quadrado ${sideMm}×${sideMm} mm`,
    name: `Tubo Metalon ${sideMm}×${sideMm}×${wallStr}mm${inch}${suffix}`,
    norm: "ABNT NBR 6591",
    dimensionsMm: `${sideMm}×${sideMm}×${wallStr} mm`,
    widthMm: sideMm,
    heightMm: sideMm,
    wallThicknessMm: wallMm,
    commercialLengthMm: barLen,
    linearWeightKgM: kgM,
    unitWeightKg: barWeight,
    finish,
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: priceKg,
    unitPriceBRL: +(barWeight * priceKg).toFixed(2),
  };
}

function makeRectTube(
  wMm: number,
  hMm: number,
  wallMm: number,
  kgM: number,
  finish: "Preto" | "Zincado / Galvanizado" = "Preto",
): CostaFerroMaterialItem {
  const barLen = 6000;
  const barWeight = +(kgM * (barLen / 1000)).toFixed(2);
  const priceKg = finish === "Preto" ? DEFAULT_STEEL_PRICE_KG : DEFAULT_ZINC_PRICE_KG;
  const wallStr = wallMm.toFixed(2).replace(".", ",");
  return {
    id: `cf-tr-${hMm}x${wMm}x${wallMm.toFixed(2)}`,
    layer: "A_MATERIAIS",
    category: "TUBO_RETANGULAR_METALON",
    subcategory: `Metalon Retangular ${hMm}×${wMm} mm`,
    name: `Tubo Metalon ${hMm}×${wMm}×${wallStr}mm`,
    norm: "ABNT NBR 6591",
    dimensionsMm: `${hMm}×${wMm}×${wallStr} mm`,
    widthMm: wMm,
    heightMm: hMm,
    wallThicknessMm: wallMm,
    commercialLengthMm: barLen,
    linearWeightKgM: kgM,
    unitWeightKg: barWeight,
    finish,
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: priceKg,
    unitPriceBRL: +(barWeight * priceKg).toFixed(2),
  };
}

function makeRoundTube(
  inchNominal: string,
  diamMm: number,
  wallMm: number,
  kgM: number,
  category: "TUBO_REDONDO_INDUSTRIAL" | "TUBO_CONDUCAO_DIN_SCH" = "TUBO_REDONDO_INDUSTRIAL",
  norm = "ABNT NBR 6591",
  sub = "Tubo Redondo Industrial",
): CostaFerroMaterialItem {
  const barLen = 6000;
  const barWeight = +(kgM * (barLen / 1000)).toFixed(2);
  const priceKg = category === "TUBO_CONDUCAO_DIN_SCH" ? 11.2 : DEFAULT_STEEL_PRICE_KG;
  const wallStr = wallMm.toFixed(2).replace(".", ",");
  const diamStr = diamMm.toFixed(2).replace(".", ",");
  return {
    id: `cf-tred-${diamMm.toFixed(1)}-${wallMm.toFixed(2)}-${norm.replace(/\s+/g, "").toLowerCase()}`,
    layer: "A_MATERIAIS",
    category,
    subcategory: sub,
    name: `Tubo Redondo ${inchNominal} (${diamStr}mm) × ${wallStr}mm`,
    norm,
    dimensionsMm: `Ø ${diamStr} × ${wallStr} mm`,
    widthMm: diamMm,
    heightMm: diamMm,
    diameterMm: diamMm,
    wallThicknessMm: wallMm,
    commercialLengthMm: barLen,
    linearWeightKgM: kgM,
    unitWeightKg: barWeight,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: priceKg,
    unitPriceBRL: +(barWeight * priceKg).toFixed(2),
  };
}

/**
 * 3.1 a 3.5 — BANCO NATIVO DE MATERIAIS COMERCIAIS (CATÁLOGO COSTA FERRO)
 */
export const COSTA_FERRO_MATERIALS: CostaFerroMaterialItem[] = [
  // =========================================================================
  // 3.1. TUBOS QUADRADOS INDUSTRIAIS — METALON (NBR 6591 — Barras de 6000mm)
  // =========================================================================
  // 15x15 mm
  makeSquareTube(15, 0.9, 0.41),
  makeSquareTube(15, 1.06, 0.48),
  makeSquareTube(15, 1.2, 0.54),
  makeSquareTube(15, 1.5, 0.67),

  // 20x20 mm (Preto)
  makeSquareTube(20, 0.9, 0.56),
  makeSquareTube(20, 1.06, 0.66),
  makeSquareTube(20, 1.2, 0.74),
  makeSquareTube(20, 1.5, 0.91),
  makeSquareTube(20, 1.9, 1.13),
  makeSquareTube(20, 2.0, 1.19),
  // 20x20 mm (Versão Zincada)
  makeSquareTube(20, 0.8, 0.5, "Zincado / Galvanizado"),
  makeSquareTube(20, 0.95, 0.59, "Zincado / Galvanizado"),
  makeSquareTube(20, 1.25, 0.77, "Zincado / Galvanizado"),
  makeSquareTube(20, 1.55, 0.94, "Zincado / Galvanizado"),
  makeSquareTube(20, 1.95, 1.16, "Zincado / Galvanizado"),

  // 25x25 mm
  makeSquareTube(25, 0.9, 0.71),
  makeSquareTube(25, 1.2, 0.93),
  makeSquareTube(25, 1.5, 1.15),
  makeSquareTube(25, 2.0, 1.51),
  makeSquareTube(25, 2.65, 1.96),
  makeSquareTube(25, 3.0, 2.19),

  // 30x30 mm
  makeSquareTube(30, 0.9, 0.85),
  makeSquareTube(30, 1.2, 1.12),
  makeSquareTube(30, 1.5, 1.39),
  makeSquareTube(30, 2.0, 1.83),
  makeSquareTube(30, 2.65, 2.39),
  makeSquareTube(30, 3.0, 2.67),
  makeSquareTube(30, 3.75, 3.27),

  // 40x40 mm
  makeSquareTube(40, 1.2, 1.51),
  makeSquareTube(40, 1.5, 1.88),
  makeSquareTube(40, 2.0, 2.48),
  makeSquareTube(40, 2.65, 3.24),
  makeSquareTube(40, 3.0, 3.64),
  makeSquareTube(40, 4.75, 5.56, "Preto", '3/16"'),

  // 50x50 mm
  makeSquareTube(50, 1.2, 1.9),
  makeSquareTube(50, 1.5, 2.36),
  makeSquareTube(50, 2.0, 3.12),
  makeSquareTube(50, 2.65, 4.1),
  makeSquareTube(50, 3.0, 4.61),
  makeSquareTube(50, 4.75, 7.09, "Preto", '3/16"'),
  makeSquareTube(50, 6.35, 9.22, "Preto", '1/4"'),

  // 60x60 mm
  makeSquareTube(60, 1.5, 2.85),
  makeSquareTube(60, 2.0, 3.77),
  makeSquareTube(60, 3.0, 5.58),
  makeSquareTube(60, 4.75, 8.62, "Preto", '3/16"'),
  makeSquareTube(60, 6.35, 11.27, "Preto", '1/4"'),

  // 80x80 mm
  makeSquareTube(80, 1.5, 3.81),
  makeSquareTube(80, 2.0, 5.06),
  makeSquareTube(80, 3.0, 7.51),
  makeSquareTube(80, 4.75, 11.68, "Preto", '3/16"'),
  makeSquareTube(80, 6.35, 15.36, "Preto", '1/4"'),

  // 100x100 mm
  makeSquareTube(100, 2.0, 6.35),
  makeSquareTube(100, 3.0, 9.45),
  makeSquareTube(100, 4.75, 14.75, "Preto", '3/16"'),
  makeSquareTube(100, 6.35, 19.46, "Preto", '1/4"'),

  // =========================================================================
  // 3.2. TUBOS RETANGULARES INDUSTRIAIS — METALON (NBR 6591 — Barras 6000mm)
  // =========================================================================
  // 20x30 mm (30x20)
  makeRectTube(20, 30, 0.9, 0.71),
  makeRectTube(20, 30, 1.2, 0.93),
  makeRectTube(20, 30, 1.5, 1.15),
  makeRectTube(20, 30, 2.0, 1.51),
  makeRectTube(20, 30, 3.0, 2.19),

  // 20x40 mm (40x20)
  makeRectTube(20, 40, 0.9, 0.85),
  makeRectTube(20, 40, 1.2, 1.12),
  makeRectTube(20, 40, 1.5, 1.39),
  makeRectTube(20, 40, 2.0, 1.83),
  makeRectTube(20, 40, 3.0, 2.67),

  // 20x50 mm (50x20)
  makeRectTube(20, 50, 1.2, 1.32),
  makeRectTube(20, 50, 1.5, 1.64),
  makeRectTube(20, 50, 2.0, 2.16),
  makeRectTube(20, 50, 3.0, 3.16),

  // 30x40 mm (40x30)
  makeRectTube(30, 40, 1.2, 1.32),
  makeRectTube(30, 40, 1.5, 1.64),
  makeRectTube(30, 40, 2.0, 2.16),
  makeRectTube(30, 40, 3.0, 3.16),

  // 30x50 mm (50x30)
  makeRectTube(30, 50, 1.2, 1.51),
  makeRectTube(30, 50, 1.5, 1.88),
  makeRectTube(30, 50, 2.0, 2.48),
  makeRectTube(30, 50, 2.65, 3.24),
  makeRectTube(30, 50, 3.0, 3.64),
  makeRectTube(30, 50, 4.75, 5.56),

  // 30x70 mm (70x30)
  makeRectTube(30, 70, 1.2, 1.9),
  makeRectTube(30, 70, 1.5, 2.36),
  makeRectTube(30, 70, 2.0, 3.12),
  makeRectTube(30, 70, 3.0, 4.61),
  makeRectTube(30, 70, 4.75, 7.09),

  // 40x60 mm (60x40)
  makeRectTube(40, 60, 1.2, 1.9),
  makeRectTube(40, 60, 1.5, 2.36),
  makeRectTube(40, 60, 2.0, 3.12),
  makeRectTube(40, 60, 3.0, 4.61),
  makeRectTube(40, 60, 4.75, 7.09),

  // 40x80 mm (80x40)
  makeRectTube(40, 80, 1.2, 2.29),
  makeRectTube(40, 80, 1.5, 2.85),
  makeRectTube(40, 80, 2.0, 3.77),
  makeRectTube(40, 80, 3.0, 5.58),
  makeRectTube(40, 80, 4.75, 8.62),

  // 40x100 mm (100x40)
  makeRectTube(40, 100, 1.5, 3.33),
  makeRectTube(40, 100, 2.0, 4.41),
  makeRectTube(40, 100, 3.0, 6.55),
  makeRectTube(40, 100, 4.75, 10.15),

  // 50x100 mm (100x50)
  makeRectTube(50, 100, 1.5, 3.57),
  makeRectTube(50, 100, 2.0, 4.74),
  makeRectTube(50, 100, 3.0, 7.03),
  makeRectTube(50, 100, 4.75, 10.92),
  makeRectTube(50, 100, 6.35, 14.34),

  // 60x100 mm (100x60)
  makeRectTube(60, 100, 2.0, 5.06),
  makeRectTube(60, 100, 3.0, 7.51),
  makeRectTube(60, 100, 4.75, 11.68),

  // 50x150 mm (150x50) e 100x150 mm (150x100)
  makeRectTube(50, 150, 2.65, 8.37),
  makeRectTube(50, 150, 3.0, 9.45),
  makeRectTube(50, 150, 4.75, 14.75),
  makeRectTube(100, 150, 3.0, 11.87),
  makeRectTube(100, 150, 4.75, 18.58),
  makeRectTube(100, 150, 6.35, 24.58),

  // =========================================================================
  // 3.3. TUBOS REDONDOS INDUSTRIAIS (NBR 6591), CONDUÇÃO (DIN 2440) E SCHEDULE
  // =========================================================================
  // 1/2" (12,70mm)
  makeRoundTube('1/2"', 12.7, 0.9, 0.27),
  makeRoundTube('1/2"', 12.7, 1.2, 0.35),
  makeRoundTube('1/2"', 12.7, 1.5, 0.43),
  // 3/4" (19,05mm)
  makeRoundTube('3/4"', 19.05, 0.9, 0.41),
  makeRoundTube('3/4"', 19.05, 1.2, 0.54),
  makeRoundTube('3/4"', 19.05, 1.5, 0.67),
  makeRoundTube('3/4"', 19.05, 2.0, 0.87),
  // 7/8" (22,23mm)
  makeRoundTube('7/8"', 22.23, 1.2, 0.64),
  makeRoundTube('7/8"', 22.23, 1.5, 0.79),
  makeRoundTube('7/8"', 22.23, 2.0, 1.03),
  // 1" (25,40mm)
  makeRoundTube('1"', 25.4, 1.2, 0.74),
  makeRoundTube('1"', 25.4, 1.5, 0.91),
  makeRoundTube('1"', 25.4, 2.0, 1.19),
  makeRoundTube('1"', 25.4, 2.65, 1.53),
  makeRoundTube('1"', 25.4, 3.0, 1.71),
  // 1.1/4" (31,75mm)
  makeRoundTube('1.1/4"', 31.75, 1.2, 0.93),
  makeRoundTube('1.1/4"', 31.75, 1.5, 1.15),
  makeRoundTube('1.1/4"', 31.75, 2.0, 1.51),
  makeRoundTube('1.1/4"', 31.75, 2.65, 1.96),
  makeRoundTube('1.1/4"', 31.75, 3.0, 2.19),
  // 1.1/2" (38,10mm)
  makeRoundTube('1.1/2"', 38.1, 1.2, 1.12),
  makeRoundTube('1.1/2"', 38.1, 1.5, 1.39),
  makeRoundTube('1.1/2"', 38.1, 2.0, 1.83),
  makeRoundTube('1.1/2"', 38.1, 3.0, 2.67),
  makeRoundTube('1.1/2"', 38.1, 4.75, 4.02),
  // 2" (50,80mm)
  makeRoundTube('2"', 50.8, 1.5, 1.88),
  makeRoundTube('2"', 50.8, 2.0, 2.48),
  makeRoundTube('2"', 50.8, 3.0, 3.64),
  makeRoundTube('2"', 50.8, 4.75, 5.56),
  // 2.1/2" (63,50mm), 3" (76,20mm), 4" (101,60mm), 5" (127,00mm), 6" (152,40mm)
  makeRoundTube('2.1/2"', 63.5, 2.0, 3.12),
  makeRoundTube('2.1/2"', 63.5, 3.0, 4.61),
  makeRoundTube('2.1/2"', 63.5, 4.75, 7.09),
  makeRoundTube('3"', 76.2, 2.0, 3.77),
  makeRoundTube('3"', 76.2, 3.0, 5.58),
  makeRoundTube('3"', 76.2, 4.75, 8.62),
  makeRoundTube('4"', 101.6, 3.0, 7.51),
  makeRoundTube('4"', 101.6, 4.75, 11.68),
  makeRoundTube('5"', 127.0, 4.75, 14.75),
  makeRoundTube('6"', 152.4, 4.75, 17.81),
  makeRoundTube('6"', 152.4, 6.35, 23.56),

  // Tubo Condução DIN 2440 / NBR 5580 e Tubo Caldeiraria Schedule 40 (ASTM A106 / A53)
  makeRoundTube('1" DIN', 33.7, 2.65, 2.01, "TUBO_CONDUCAO_DIN_SCH", "NBR 5580 / DIN 2440", "Tubo Condução DIN 2440"),
  makeRoundTube('1.1/4" DIN', 42.4, 2.65, 2.58, "TUBO_CONDUCAO_DIN_SCH", "NBR 5580 / DIN 2440", "Tubo Condução DIN 2440"),
  makeRoundTube('1.1/2" DIN', 48.3, 3.0, 3.33, "TUBO_CONDUCAO_DIN_SCH", "NBR 5580 / DIN 2440", "Tubo Condução DIN 2440"),
  makeRoundTube('2" DIN', 60.3, 3.35, 4.67, "TUBO_CONDUCAO_DIN_SCH", "NBR 5580 / DIN 2440", "Tubo Condução DIN 2440"),
  makeRoundTube('2" Sch40', 60.3, 3.91, 5.44, "TUBO_CONDUCAO_DIN_SCH", "ASTM A106 / Sch 40", "Tubo Schedule 40"),
  makeRoundTube('3" Sch40', 88.9, 5.49, 11.29, "TUBO_CONDUCAO_DIN_SCH", "ASTM A106 / Sch 40", "Tubo Schedule 40"),
  makeRoundTube('4" Sch40', 114.3, 6.02, 16.07, "TUBO_CONDUCAO_DIN_SCH", "ASTM A106 / Sch 40", "Tubo Schedule 40"),
  makeRoundTube('6" Sch40', 168.3, 7.11, 28.26, "TUBO_CONDUCAO_DIN_SCH", "ASTM A106 / Sch 40", "Tubo Schedule 40"),
  makeRoundTube('8" Sch40', 219.1, 8.18, 42.55, "TUBO_CONDUCAO_DIN_SCH", "ASTM A106 / Sch 40", "Tubo Schedule 40"),

  // =========================================================================
  // 3.4. PERFIS ESTRUTURAIS (U SIMPLES, U ENRIJECIDO, VIGAS W, CANTONEIRAS, BARRAS)
  // =========================================================================
  {
    id: "cf-pu-50x25x2.00",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Perfil U Dobrado Simples",
    name: "Perfil U Simples 50×25×2,00mm",
    norm: "ABNT NBR 6355",
    dimensionsMm: "50×25×2,00 mm",
    widthMm: 25,
    heightMm: 50,
    wallThicknessMm: 2.0,
    commercialLengthMm: 6000,
    linearWeightKgM: 1.48,
    unitWeightKg: 8.88,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.6,
    unitPriceBRL: 85.25,
  },
  {
    id: "cf-pu-75x40x3.00",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Perfil U Dobrado Simples",
    name: "Perfil U Simples 75×40×3,00mm",
    norm: "ABNT NBR 6355",
    dimensionsMm: "75×40×3,00 mm",
    widthMm: 40,
    heightMm: 75,
    wallThicknessMm: 3.0,
    commercialLengthMm: 6000,
    linearWeightKgM: 3.42,
    unitWeightKg: 20.52,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.6,
    unitPriceBRL: 196.99,
  },
  {
    id: "cf-pu-100x50x3.00",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Perfil U Dobrado Simples",
    name: "Perfil U Simples 100×50×3,00mm",
    norm: "ABNT NBR 6355",
    dimensionsMm: "100×50×3,00 mm",
    widthMm: 50,
    heightMm: 100,
    wallThicknessMm: 3.0,
    commercialLengthMm: 6000,
    linearWeightKgM: 4.59,
    unitWeightKg: 27.54,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.6,
    unitPriceBRL: 264.38,
  },
  {
    id: "cf-pu-150x50x4.75",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Perfil U Dobrado Simples",
    name: 'Perfil U Simples 150×50×4,75mm [3/16"]',
    norm: "ABNT NBR 6355",
    dimensionsMm: "150×50×4,75 mm",
    widthMm: 50,
    heightMm: 150,
    wallThicknessMm: 4.75,
    commercialLengthMm: 6000,
    linearWeightKgM: 9.02,
    unitWeightKg: 54.12,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.6,
    unitPriceBRL: 519.55,
  },
  {
    id: "cf-pue-100x40x17x2.00",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Perfil U Enrijecido",
    name: "Perfil U Enrijecido 100×40×17×2,00mm",
    norm: "ABNT NBR 6355",
    dimensionsMm: "100×40×17×2,00 mm",
    widthMm: 40,
    heightMm: 100,
    wallThicknessMm: 2.0,
    commercialLengthMm: 6000,
    linearWeightKgM: 3.17,
    unitWeightKg: 19.02,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.8,
    unitPriceBRL: 186.4,
  },
  {
    id: "cf-pue-150x60x20x3.00",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Perfil U Enrijecido",
    name: "Perfil U Enrijecido 150×60×20×3,00mm",
    norm: "ABNT NBR 6355",
    dimensionsMm: "150×60×20×3,00 mm",
    widthMm: 60,
    heightMm: 150,
    wallThicknessMm: 3.0,
    commercialLengthMm: 6000,
    linearWeightKgM: 6.96,
    unitWeightKg: 41.76,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.8,
    unitPriceBRL: 409.25,
  },
  {
    id: "cf-vw-150x13.0",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Viga W / I Laminada",
    name: "Perfil Viga W 150×13,0 kg/m (6m)",
    norm: "ASTM A572 Gr.50",
    dimensionsMm: "148×100×4,9 mm",
    widthMm: 100,
    heightMm: 148,
    wallThicknessMm: 4.9,
    commercialLengthMm: 6000,
    linearWeightKgM: 13.0,
    unitWeightKg: 78.0,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 10.9,
    unitPriceBRL: 850.2,
  },
  {
    id: "cf-vw-200x15.0",
    layer: "A_MATERIAIS",
    category: "PERFIL_ESTRUTURAL",
    subcategory: "Viga W / I Laminada",
    name: "Perfil Viga W 200×15,0 kg/m (6m)",
    norm: "ASTM A572 Gr.50",
    dimensionsMm: "200×100×5,2 mm",
    widthMm: 100,
    heightMm: 200,
    wallThicknessMm: 5.2,
    commercialLengthMm: 6000,
    linearWeightKgM: 15.0,
    unitWeightKg: 90.0,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 10.9,
    unitPriceBRL: 981.0,
  },

  // Cantoneiras e Barras Comerciais
  {
    id: "cf-cant-19x3.18",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Cantoneira de Abas Iguais",
    name: 'Cantoneira 3/4" × 1/8" (19,05×3,18mm)',
    norm: "ASTM A36",
    dimensionsMm: "19,05×19,05×3,18 mm",
    widthMm: 19.05,
    heightMm: 19.05,
    wallThicknessMm: 3.18,
    commercialLengthMm: 6000,
    linearWeightKgM: 0.88,
    unitWeightKg: 5.28,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 50.16,
  },
  {
    id: "cf-cant-25x3.18",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Cantoneira de Abas Iguais",
    name: 'Cantoneira 1" × 1/8" (25,40×3,18mm)',
    norm: "ASTM A36",
    dimensionsMm: "25,40×25,40×3,18 mm",
    widthMm: 25.4,
    heightMm: 25.4,
    wallThicknessMm: 3.18,
    commercialLengthMm: 6000,
    linearWeightKgM: 1.19,
    unitWeightKg: 7.14,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 67.83,
  },
  {
    id: "cf-cant-31x3.18",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Cantoneira de Abas Iguais",
    name: 'Cantoneira 1.1/4" × 1/8" (31,75×3,18mm)',
    norm: "ASTM A36",
    dimensionsMm: "31,75×31,75×3,18 mm",
    widthMm: 31.75,
    heightMm: 31.75,
    wallThicknessMm: 3.18,
    commercialLengthMm: 6000,
    linearWeightKgM: 1.5,
    unitWeightKg: 9.0,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 85.5,
  },
  {
    id: "cf-cant-38x4.76",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Cantoneira de Abas Iguais",
    name: 'Cantoneira 1.1/2" × 3/16" (38,10×4,76mm)',
    norm: "ASTM A36",
    dimensionsMm: "38,10×38,10×4,76 mm",
    widthMm: 38.1,
    heightMm: 38.1,
    wallThicknessMm: 4.76,
    commercialLengthMm: 6000,
    linearWeightKgM: 2.68,
    unitWeightKg: 16.08,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 152.76,
  },
  {
    id: "cf-cant-50x4.76",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Cantoneira de Abas Iguais",
    name: 'Cantoneira 2" × 3/16" (50,80×4,76mm)',
    norm: "ASTM A36",
    dimensionsMm: "50,80×50,80×4,76 mm",
    widthMm: 50.8,
    heightMm: 50.8,
    wallThicknessMm: 4.76,
    commercialLengthMm: 6000,
    linearWeightKgM: 3.63,
    unitWeightKg: 21.78,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 206.91,
  },
  {
    id: "cf-bc-25x4.76",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Barra Chata Laminada",
    name: 'Barra Chata 1" × 3/16" (25,40×4,76mm)',
    norm: "ASTM A36 / SAE 1020",
    dimensionsMm: "25,40×4,76 mm",
    widthMm: 25.4,
    heightMm: 4.76,
    wallThicknessMm: 4.76,
    commercialLengthMm: 6000,
    linearWeightKgM: 0.95,
    unitWeightKg: 5.7,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.4,
    unitPriceBRL: 53.58,
  },
  {
    id: "cf-bc-38x6.35",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Barra Chata Laminada",
    name: 'Barra Chata 1.1/2" × 1/4" (38,10×6,35mm)',
    norm: "ASTM A36 / SAE 1020",
    dimensionsMm: "38,10×6,35 mm",
    widthMm: 38.1,
    heightMm: 6.35,
    wallThicknessMm: 6.35,
    commercialLengthMm: 6000,
    linearWeightKgM: 1.9,
    unitWeightKg: 11.4,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.4,
    unitPriceBRL: 107.16,
  },
  {
    id: "cf-br-12.7",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Barra Redonda Maciça",
    name: 'Barra Redonda Maciça 1/2" (12,70mm)',
    norm: "SAE 1020 / ASTM A36",
    dimensionsMm: "Ø 12,70 mm",
    widthMm: 12.7,
    heightMm: 12.7,
    diameterMm: 12.7,
    wallThicknessMm: 12.7,
    commercialLengthMm: 6000,
    linearWeightKgM: 0.99,
    unitWeightKg: 5.94,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 56.43,
  },
  {
    id: "cf-br-15.88",
    layer: "A_MATERIAIS",
    category: "CANTONEIRA_BARRA",
    subcategory: "Barra Redonda Maciça",
    name: 'Barra Redonda Maciça 5/8" (15,88mm)',
    norm: "SAE 1020 / ASTM A36",
    dimensionsMm: "Ø 15,88 mm",
    widthMm: 15.88,
    heightMm: 15.88,
    diameterMm: 15.88,
    wallThicknessMm: 15.88,
    commercialLengthMm: 6000,
    linearWeightKgM: 1.55,
    unitWeightKg: 9.3,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 88.35,
  },

  // =========================================================================
  // 3.5. CHAPAS COMERCIAIS (FINAS, GROSSAS, XADREZ, GALVANIZADAS, LAMBRIL)
  // =========================================================================
  {
    id: "cf-ch-ff-18-1.20",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Fina a Frio / Lambril",
    name: "Chapa Fina a Frio #18 (1,20mm) — 3000×1200mm",
    norm: "SAE 1008/1010",
    dimensionsMm: "3000×1200×1,20 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 1.2,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 9.42,
    unitWeightKg: 33.91,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.9,
    unitPriceBRL: 335.7,
  },
  {
    id: "cf-ch-lambril-20-0.90",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Frisada / Lambril / Búzios",
    name: "Chapa Lambril Frisada #20 (0,90mm) — 3000×1200mm",
    norm: "SAE 1008 (Fechamento de Portão)",
    dimensionsMm: "3000×1200×0,90 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 0.9,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 7.6,
    unitWeightKg: 27.36,
    finish: "Zincado / Galvanizado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 11.5,
    unitPriceBRL: 314.64,
  },
  {
    id: "cf-ch-fq-14-2.00",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Fina a Quente",
    name: "Chapa Fina a Quente #14 (2,00mm) — 3000×1200mm",
    norm: "SAE 1010 / ASTM A36",
    dimensionsMm: "3000×1200×2,00 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 2.0,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 15.7,
    unitWeightKg: 56.52,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.5,
    unitPriceBRL: 536.94,
  },
  {
    id: "cf-ch-fq-11-3.00",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Fina a Quente",
    name: 'Chapa Fina a Quente #11 [1/8"] (3,00mm) — 3000×1200mm',
    norm: "ASTM A36",
    dimensionsMm: "3000×1200×3,00 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 3.0,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 23.55,
    unitWeightKg: 84.78,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.4,
    unitPriceBRL: 796.93,
  },
  {
    id: "cf-ch-fq-316-4.75",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Fina a Quente / Grossa",
    name: 'Chapa Aço Carbono 3/16" (4,75mm) — 3000×1200mm',
    norm: "ASTM A36",
    dimensionsMm: "3000×1200×4,75 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 4.75,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 37.29,
    unitWeightKg: 134.24,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.3,
    unitPriceBRL: 1248.43,
  },
  {
    id: "cf-ch-gr-14-6.35",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Grossa Estrutural",
    name: 'Chapa Grossa 1/4" (6,35mm) — 3000×1500mm',
    norm: "ASTM A36",
    dimensionsMm: "3000×1500×6,35 mm",
    widthMm: 1500,
    heightMm: 3000,
    wallThicknessMm: 6.35,
    sheetAreaMm: { widthMm: 1500, lengthMm: 3000 },
    areaWeightKgM2: 49.85,
    unitWeightKg: 224.33,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.2,
    unitPriceBRL: 2063.84,
  },
  {
    id: "cf-ch-gr-38-9.53",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Grossa Estrutural",
    name: 'Chapa Grossa 3/8" (9,53mm) — 3000×1500mm',
    norm: "ASTM A36",
    dimensionsMm: "3000×1500×9,53 mm",
    widthMm: 1500,
    heightMm: 3000,
    wallThicknessMm: 9.53,
    sheetAreaMm: { widthMm: 1500, lengthMm: 3000 },
    areaWeightKgM2: 74.81,
    unitWeightKg: 336.65,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.2,
    unitPriceBRL: 3097.18,
  },
  {
    id: "cf-ch-gr-12-12.7",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Grossa Estrutural",
    name: 'Chapa Grossa 1/2" (12,70mm) — 3000×1500mm',
    norm: "ASTM A36",
    dimensionsMm: "3000×1500×12,70 mm",
    widthMm: 1500,
    heightMm: 3000,
    wallThicknessMm: 12.7,
    sheetAreaMm: { widthMm: 1500, lengthMm: 3000 },
    areaWeightKgM2: 99.7,
    unitWeightKg: 448.65,
    finish: "Preto",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 9.2,
    unitPriceBRL: 4127.58,
  },
  {
    id: "cf-ch-xadrez-3.00",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Xadrez / Piso Antiderrapante",
    name: 'Chapa Xadrez Piso 1/8" (3,00mm) — 3000×1200mm',
    norm: "ASTM A36 Piso",
    dimensionsMm: "3000×1200×3,00 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 3.0,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 26.2,
    unitWeightKg: 94.32,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 10.4,
    unitPriceBRL: 980.93,
  },
  {
    id: "cf-ch-xadrez-4.75",
    layer: "A_MATERIAIS",
    category: "CHAPA_ACO",
    subcategory: "Chapa Xadrez / Piso Antiderrapante",
    name: 'Chapa Xadrez Piso 3/16" (4,75mm) — 3000×1200mm',
    norm: "ASTM A36 Piso",
    dimensionsMm: "3000×1200×4,75 mm",
    widthMm: 1200,
    heightMm: 3000,
    wallThicknessMm: 4.75,
    sheetAreaMm: { widthMm: 1200, lengthMm: 3000 },
    areaWeightKgM2: 39.8,
    unitWeightKg: 143.28,
    finish: "Laminado",
    origin: "Catálogo Costa Ferro",
    pricePerKgBRL: 10.4,
    unitPriceBRL: 1490.11,
  },
];

/**
 * CAMADA B — COMPONENTES, FERRAGENS E CONSUMÍVEIS DE MONTAGEM
 */
export const COSTA_FERRO_HARDWARE: CostaFerroHardwareItem[] = [
  {
    id: "cf-hw-roldana-v-3pol",
    layer: "B_FERRAGENS",
    category: "ROLDANA_TRILHO",
    name: 'Roldana Aço Usinado 3" Canal V c/ Rolamento Blindado',
    specification: 'Ø 75mm · Canal V 90° · Caixa embutir',
    application: "Portões de correr até 400 kg",
    unit: "un",
    unitWeightKg: 0.85,
    unitPriceBRL: 38.9,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-roldana-v-4pol",
    layer: "B_FERRAGENS",
    category: "ROLDANA_TRILHO",
    name: 'Roldana Aço Usinado 4" Canal V Duplo Rolamento',
    specification: 'Ø 100mm · Canal V 90° · Carga pesada',
    application: "Portões industriais de correr até 800 kg",
    unit: "un",
    unitWeightKg: 1.45,
    unitPriceBRL: 64.5,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-guia-sup-4rolos",
    layer: "B_FERRAGENS",
    category: "ROLDANA_TRILHO",
    name: "Guia Superior Regulável com 4 Rolos de Nylon",
    specification: "Chapa 4,75mm zincada · Rolos Ø 35mm",
    application: "Estabilização superior de portão de correr",
    unit: "un",
    unitWeightKg: 1.1,
    unitPriceBRL: 45.0,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-kit-basculante",
    layer: "B_FERRAGENS",
    category: "BASCULANTE_CABO",
    name: "Kit Ferragens Portão Basculante (Roldanas + Cabos de Aço + Castanhas)",
    specification: 'Cabo aço 3/16" 6x19 + 2 Roldanas Nylon Ø 120mm + Pinos',
    application: "Mecanismo de suspensão de portão basculante",
    unit: "kit",
    unitWeightKg: 3.4,
    unitPriceBRL: 168.0,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-gonzo-34",
    layer: "B_FERRAGENS",
    category: "DOBRADICA_GONZO",
    name: 'Gonzo Usinado Aço 3/4" com Aba para Solda (Par)',
    specification: "Ø 19,05mm · Pino maciço torneado",
    application: "Portões de abrir, grades e tampas pesadas",
    unit: "par",
    unitWeightKg: 0.52,
    unitPriceBRL: 26.0,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-fechadura-portao",
    layer: "B_FERRAGENS",
    category: "FECHADURA_TRAVA",
    name: "Fechadura Bico de Papagaio / Elétrica Sobrepor para Portão",
    specification: "Cilindro duplo · Caixa em aço carbono",
    application: "Travamento de portões de correr e abrir",
    unit: "un",
    unitWeightKg: 1.2,
    unitPriceBRL: 118.0,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-parabolt-38",
    layer: "B_FERRAGENS",
    category: "FIXACAO_ACABAMENTO",
    name: 'Chumbador Mecânico Parabolt 3/8" × 3.1/2"',
    specification: "Aço zincado · Expansão por torque",
    application: "Fixação de bases, escadas, grades e trilhos em concreto",
    unit: "un",
    unitWeightKg: 0.09,
    unitPriceBRL: 6.8,
    origin: "Catálogo Costa Ferro",
  },
  {
    id: "cf-hw-consumivel-solda",
    layer: "B_FERRAGENS",
    category: "CONSUMIVEL_SOLDA_CORTE",
    name: "Kit Consumíveis (Arame MIG ER70S-6 + Discos Corte/Flap + Fundo Anticorrosivo)",
    specification: "Cálculo proporcional por projeto de serralheria/caldeiraria",
    application: "Soldagem, desbaste e proteção de base",
    unit: "kit",
    unitWeightKg: 2.5,
    unitPriceBRL: 145.0,
    origin: "Catálogo Costa Ferro",
  },
];

/**
 * CAMADA C — OPERAÇÕES, REGRAS DE CORTE E LIMITES DE FABRICAÇÃO
 */
export const COSTA_FERRO_OPERATIONS: CostaFerroOperationRule[] = [
  {
    id: "cf-op-serra-fita-policorte",
    layer: "C_OPERACOES",
    process: "CORTE_SERRA",
    name: "Corte de Barras e Tubos em Serra de Fita / Policorte",
    norm: "ABNT NBR 6118 / Tolerância ISO 2768-m",
    kerfMm: 3.0,
    minThicknessMm: 0.8,
    maxThicknessMm: 100.0,
    supportedAnglesDeg: [90, 45, 30, 60],
    defaultHourlyRateBRL: 95.0,
    notes: "Perda padrão de disco/lâmina (kerf) de 3,0 mm por corte. Suporta corte reto 90° e meia-esquadria 45°.",
  },
  {
    id: "cf-op-corte-cnc-plasma-laser",
    layer: "C_OPERACOES",
    process: "CORTE_CNC_TERMICO",
    name: "Corte Térmico CNC (Laser Fibra / Plasma HD)",
    norm: "ISO 9013",
    kerfMm: 2.2,
    minThicknessMm: 0.9,
    maxThicknessMm: 38.1,
    supportedAnglesDeg: [90],
    defaultHourlyRateBRL: 180.0,
    notes: "Furos com diâmetro mínimo ≥ 1,0× espessura no Laser e ≥ 1,5× espessura no Plasma.",
  },
  {
    id: "cf-op-guilhotina",
    layer: "C_OPERACOES",
    process: "GUILHOTINA",
    name: "Corte Retilíneo em Guilhotina Hidráulica",
    norm: "DIN 6930",
    kerfMm: 0.5,
    minThicknessMm: 0.8,
    maxThicknessMm: 12.7,
    supportedAnglesDeg: [90],
    defaultHourlyRateBRL: 110.0,
    notes: "Ideal para tiras, flanges quadrados, chapas de base e degraus sem recortes internos.",
  },
  {
    id: "cf-op-dobra-cnc",
    layer: "C_OPERACOES",
    process: "DOBRA_PRENSA",
    name: "Conformação e Dobra em Prensa Dobradeira CNC",
    norm: "DIN 6935 (Fator K = 0,40)",
    kerfMm: 0,
    minThicknessMm: 0.8,
    maxThicknessMm: 12.7,
    supportedAnglesDeg: [90, 45, 135],
    minBendRadiusFactor: 1.2,
    defaultHourlyRateBRL: 140.0,
    notes: "Raio interno mínimo recomendado Ri = 1,2 × espessura (Aço Carbono). Aba mínima = 6 × espessura.",
  },
  {
    id: "cf-op-soldagem-montagem",
    layer: "C_OPERACOES",
    process: "SOLDAGEM_MIG_MMA",
    name: "Ponteamento, Soldagem MIG/MAG (GMAW) e Acabamento de Bancada",
    norm: "AWS D1.1 / AWS D1.3",
    kerfMm: 0,
    minThicknessMm: 0.9,
    maxThicknessMm: 50.0,
    supportedAnglesDeg: [90, 45],
    defaultHourlyRateBRL: 115.0,
    notes: "Para paredes ≤ 1,20mm em Metalon, utilizar solda MIG ponto-a-ponto com baixa amperagem para evitar furos.",
  },
];

/* ============================================================================
 * FUNÇÕES DE ACESSO, PREÇOS EDITÁVEIS E CADASTRO DE ITENS PERSONALIZADOS
 * ============================================================================ */

export function loadPriceOverrides(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PRICE_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function savePriceOverride(itemId: string, newPriceBRL: number): void {
  if (typeof window === "undefined") return;
  try {
    const map = loadPriceOverrides();
    map[itemId] = Math.max(0, +newPriceBRL.toFixed(2));
    window.localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function loadCustomMaterials(): CostaFerroMaterialItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_ITEMS_KEY);
    return raw ? (JSON.parse(raw) as CostaFerroMaterialItem[]) : [];
  } catch {
    return [];
  }
}

export function addCustomCostaFerroMaterial(
  item: Omit<CostaFerroMaterialItem, "id" | "layer" | "origin">,
): CostaFerroMaterialItem {
  const created: CostaFerroMaterialItem = {
    ...item,
    id: `cf-custom-${Date.now()}`,
    layer: "A_MATERIAIS",
    origin: "Personalizado",
  };
  if (typeof window !== "undefined") {
    try {
      const existing = loadCustomMaterials();
      window.localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify([created, ...existing]));
    } catch {
      // ignore
    }
  }
  return created;
}

export function getAllCostaFerroMaterials(): CostaFerroMaterialItem[] {
  const overrides = loadPriceOverrides();
  const custom = loadCustomMaterials();
  const all = [...custom, ...COSTA_FERRO_MATERIALS];
  return all.map((item) => {
    const override = overrides[item.id];
    if (typeof override === "number" && override > 0) {
      return {
        ...item,
        unitPriceBRL: override,
        pricePerKgBRL: item.unitWeightKg > 0 ? +(override / item.unitWeightKg).toFixed(2) : item.pricePerKgBRL,
      };
    }
    return item;
  });
}

export function getAllCostaFerroHardware(): CostaFerroHardwareItem[] {
  const overrides = loadPriceOverrides();
  return COSTA_FERRO_HARDWARE.map((item) => {
    const override = overrides[item.id];
    return typeof override === "number" && override > 0
      ? { ...item, unitPriceBRL: override }
      : item;
  });
}

export function findCostaFerroMaterial(idOrName: string): CostaFerroMaterialItem | undefined {
  const all = getAllCostaFerroMaterials();
  return (
    all.find((m) => m.id === idOrName) ??
    all.find((m) => m.name.toLowerCase() === idOrName.toLowerCase())
  );
}
