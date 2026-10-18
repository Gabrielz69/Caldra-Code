/**
 * CHAPAS COMERCIAIS — catálogo por região.
 * Todas as medidas em milímetros (unidade interna do app).
 */

export type StockSheet = { id: string; label: string; w: number; h: number };

export const SHEETS_METRIC: StockSheet[] = [
  { id: "2000x1000", label: "2000 × 1000", w: 2000, h: 1000 },
  { id: "2440x1220", label: "2440 × 1220", w: 2440, h: 1220 },
  { id: "2500x1250", label: "2500 × 1250", w: 2500, h: 1250 },
  { id: "3000x1500", label: "3000 × 1500", w: 3000, h: 1500 },
  { id: "6000x1500", label: "6000 × 1500", w: 6000, h: 1500 },
  { id: "6000x2000", label: "6000 × 2000", w: 6000, h: 2000 },
];

/** Chapas em polegadas convertidas para mm (4×8, 4×10, 5×10 ft). */
export const SHEETS_IMPERIAL: StockSheet[] = [
  { id: "48x96", label: '48" × 96"', w: 2438.4, h: 1219.2 },
  { id: "48x120", label: '48" × 120"', w: 3048, h: 1219.2 },
  { id: "60x120", label: '60" × 120"', w: 3048, h: 1524 },
];

export const DEFAULT_SHEET_ID = "3000x1500";
