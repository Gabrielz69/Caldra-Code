/**
 * PREÇOS — FONTE ÚNICA.
 *
 * Estas constantes alimentam o paywall web, o fallback em navegador e os
 * textos estáticos. Dentro da TWA o preço EXIBIDO vem sempre do Play
 * Billing (`queryProductDetails`), nunca daqui.
 */

import { PRODUCTS, type ProductId } from "./billing";

export type PlanKey = "monthly" | "yearly" | "lifetime";

export type PriceEntry = {
  key: PlanKey;
  /** Rótulo curto do ciclo. */
  label: string;
  usd: number;
  brl: number;
  /** Selo opcional (ex.: "2 meses grátis"). */
  badge?: string;
  note: string;
  /** Produto da Play; o vitalício não existe na loja. */
  product: ProductId | null;
};

export const PRICING: Record<PlanKey, PriceEntry> = {
  monthly: {
    key: "monthly",
    label: "Mensal",
    usd: 5,
    brl: 27.9,
    note: "por mês, cancela quando quiser",
    product: PRODUCTS.monthly,
  },
  yearly: {
    key: "yearly",
    label: "Anual",
    usd: 50,
    brl: 279.9,
    badge: "2 meses grátis",
    note: "equivale a US$ 4,17/mês",
    product: PRODUCTS.yearly,
  },
  lifetime: {
    key: "lifetime",
    label: "Vitalício",
    usd: 120,
    brl: 649.9,
    badge: "equivale a 2 anos",
    note: "pagamento único no site (Pix ou cartão) + código de ativação",
    product: null,
  },
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Moeda de vitrine: BRL por padrão, USD fora do Brasil. */
export function isBrl(): boolean {
  if (typeof navigator === "undefined") return true;
  const langs = [navigator.language, ...(navigator.languages ?? [])].join(" ").toLowerCase();
  return langs.includes("pt-br") || langs.includes("-br");
}

export function formatPrice(entry: PriceEntry, brl = isBrl()): string {
  return brl ? BRL.format(entry.brl) : USD.format(entry.usd);
}
