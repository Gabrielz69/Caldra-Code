/**
 * MASSA E CUSTO — funções puras.
 * Toda entrada em mm; densidade em kg/m³; resultado em kg / R$.
 * Nenhum arredondamento intermediário.
 */

/** kg/dm³ (legado dos motores) → kg/m³. */
export const toKgM3 = (kgDm3: number) => kgDm3 * 1000;
/** kg/m³ → kg/dm³. */
export const toKgDm3 = (kgM3: number) => kgM3 / 1000;

/** Massa de uma chapa plana desenvolvida. */
export function plateMassKg(areaMm2: number, thicknessMm: number, densityKgM3: number): number {
  return areaMm2 * 1e-6 * (thicknessMm * 1e-3) * densityKgM3;
}

/** Massa de tubo pelo diâmetro médio (Ø externo − espessura). */
export function tubeMassKg(
  outerDiameterMm: number,
  thicknessMm: number,
  lengthMm: number,
  densityKgM3: number,
): number {
  const meanD = outerDiameterMm - thicknessMm;
  const areaMm2 = Math.PI * meanD * lengthMm;
  return plateMassKg(areaMm2, thicknessMm, densityKgM3);
}

/** Custo de MATERIAL apenas: peso × R$/kg × quantidade × (1 + perda%). */
export function materialCostBRL(args: {
  massKg: number;
  pricePerKg: number;
  quantity: number;
  lossPct: number;
}): number {
  return args.massKg * args.pricePerKg * args.quantity * (1 + args.lossPct / 100);
}

/** kg com 3 casas; acima de 1000 kg exibe em toneladas. */
export function formatMass(kg: number): string {
  if (Math.abs(kg) >= 1000)
    return `${(kg / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
