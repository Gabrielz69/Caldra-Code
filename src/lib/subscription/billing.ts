/**
 * CAMADA DE COMPRA — Play Billing (TWA) com degradação para navegador.
 *
 * O app roda empacotado (TWA/Capacitor) e também como web puro. A detecção
 * de ambiente é feita em tempo de execução: se o navegador expõe
 * `getDigitalGoodsService('play')`, usamos Play Billing; caso contrário
 * exibimos os planos e mandamos o usuário para o site externo, com o
 * caminho alternativo do CÓDIGO DE ATIVAÇÃO.
 *
 * Nada aqui grava plano: quem decide é o `entitlementService`.
 */

/** IDs cadastrados no Play Console. Constantes — nunca digitar solto na UI. */
export const PRODUCTS = {
  monthly: "caldra.pro.monthly",
  yearly: "caldra.pro.yearly",
} as const;

export type ProductId = (typeof PRODUCTS)[keyof typeof PRODUCTS];

/** Preços de vitrine vivem em `pricing.ts` — nunca aqui. */

/** Site externo onde a compra web e o Pix vitalício acontecem. */
export const WEB_CHECKOUT_URL = "https://caldra.app/planos";

const PLAY_SERVICE_URL = "https://play.google.com/billing";

type DigitalGoodsService = {
  getDetails: (
    ids: string[],
  ) => Promise<{ itemId: string; price: { value: string; currency: string } }[]>;
  listPurchases: () => Promise<{ itemId: string; purchaseToken: string }[]>;
  consume?: (token: string) => Promise<void>;
};

type PlayWindow = Window & {
  getDigitalGoodsService?: (url: string) => Promise<DigitalGoodsService>;
};

/** Verdadeiro apenas dentro da TWA publicada na Play. */
export function hasPlayBilling(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as PlayWindow).getDigitalGoodsService === "function"
  );
}

async function playService(): Promise<DigitalGoodsService | null> {
  const w = window as PlayWindow;
  if (!w.getDigitalGoodsService) return null;
  try {
    return await w.getDigitalGoodsService(PLAY_SERVICE_URL);
  } catch {
    return null;
  }
}

export type PlayPurchase = { productId: string; token: string };

/** Abre o fluxo de assinatura da Play. Fora da TWA devolve `null`. */
export async function buyWithPlay(productId: ProductId): Promise<PlayPurchase | null> {
  const service = await playService();
  if (!service || typeof PaymentRequest === "undefined") return null;

  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_SERVICE_URL, data: { sku: productId } }],
    { total: { label: "CALDRA PRO", amount: { currency: "BRL", value: "0" } } },
  );

  const response = await request.show();
  const details = response.details as { purchaseToken?: string };
  await response.complete("success");
  if (!details.purchaseToken) return null;
  return { productId, token: details.purchaseToken };
}

/** Compras já feitas nesta conta Google — base do RESTAURAR COMPRA. */
export async function listPlayPurchases(): Promise<PlayPurchase[]> {
  const service = await playService();
  if (!service) return [];
  try {
    const list = await service.listPurchases();
    return list.map((p) => ({ productId: p.itemId, token: p.purchaseToken }));
  } catch {
    return [];
  }
}

/**
 * Preço LOCAL REAL da Play (`queryProductDetails`). Dentro da TWA é ele que
 * aparece na tela — jamais um valor fixo no código. Fora da TWA devolve {}.
 */
export async function queryProductDetails(
  ids: ProductId[] = [PRODUCTS.monthly, PRODUCTS.yearly],
): Promise<Partial<Record<ProductId, string>>> {
  const service = await playService();
  if (!service) return {};
  try {
    const details = await service.getDetails(ids);
    const out: Partial<Record<ProductId, string>> = {};
    for (const d of details) {
      const value = Number(d.price.value);
      const formatted = Number.isFinite(value)
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: d.price.currency,
          }).format(value)
        : `${d.price.currency} ${d.price.value}`;
      out[d.itemId as ProductId] = formatted;
    }
    return out;
  } catch {
    return {};
  }
}
