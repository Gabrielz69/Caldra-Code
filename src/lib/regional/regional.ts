/**
 * REGIONAL — moeda, formato numérico e catálogo de chapas por país.
 * A unidade INTERNA continua sempre milímetro; isto é apresentação.
 */

import { SHEETS_IMPERIAL, SHEETS_METRIC, type StockSheet } from "@/lib/nesting/sheets";

export type RegionId = "br" | "pt" | "us" | "eu";

export type Region = {
  id: RegionId;
  label: string;
  locale: string;
  currency: string;
  /** Sistema preferido para exibir medidas. */
  system: "metric" | "imperial";
  sheets: StockSheet[];
  /** Alíquota padrão de imposto sobre o orçamento (%). */
  taxPct: number;
  taxLabel: string;
};

export const REGIONS: Record<RegionId, Region> = {
  br: {
    id: "br",
    label: "Brasil",
    locale: "pt-BR",
    currency: "BRL",
    system: "metric",
    sheets: SHEETS_METRIC,
    taxPct: 0,
    taxLabel: "Impostos",
  },
  pt: {
    id: "pt",
    label: "Portugal",
    locale: "pt-PT",
    currency: "EUR",
    system: "metric",
    sheets: SHEETS_METRIC,
    taxPct: 23,
    taxLabel: "IVA",
  },
  us: {
    id: "us",
    label: "Estados Unidos",
    locale: "en-US",
    currency: "USD",
    system: "imperial",
    sheets: SHEETS_IMPERIAL,
    taxPct: 0,
    taxLabel: "Sales tax",
  },
  eu: {
    id: "eu",
    label: "Europa",
    locale: "de-DE",
    currency: "EUR",
    system: "metric",
    sheets: SHEETS_METRIC,
    taxPct: 21,
    taxLabel: "VAT",
  },
};

export const DEFAULT_REGION: RegionId = "br";

export const regionOf = (id: string | null | undefined): Region =>
  REGIONS[(id as RegionId) ?? DEFAULT_REGION] ?? REGIONS[DEFAULT_REGION];

/** Formata dinheiro na moeda da região. */
export function formatMoney(value: number, region: Region): string {
  return value.toLocaleString(region.locale, { style: "currency", currency: region.currency });
}

/** Formata um comprimento em mm respeitando o sistema regional. */
export function formatLength(mm: number, region: Region, digits = 2): string {
  if (region.system === "imperial") {
    const inches = mm / 25.4;
    return `${inches.toLocaleString(region.locale, { maximumFractionDigits: digits })} in`;
  }
  return `${mm.toLocaleString(region.locale, { maximumFractionDigits: digits })} mm`;
}

/** Formata massa em kg/t (ou lb no sistema imperial). */
export function formatWeight(kg: number, region: Region): string {
  if (region.system === "imperial") {
    const lb = kg * 2.2046226218;
    return `${lb.toLocaleString(region.locale, { maximumFractionDigits: 2 })} lb`;
  }
  if (Math.abs(kg) >= 1000)
    return `${(kg / 1000).toLocaleString(region.locale, { maximumFractionDigits: 3 })} t`;
  return `${kg.toLocaleString(region.locale, { maximumFractionDigits: 3 })} kg`;
}
