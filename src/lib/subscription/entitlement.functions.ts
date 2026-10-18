/**
 * ENTITLEMENT — SERVIDOR É A FONTE DE VERDADE.
 *
 * O cliente nunca decide o plano. Ele envia o purchaseToken; o servidor
 * consulta o Google Play, grava o estado e devolve o direito resolvido.
 * Resposta INCONCLUSIVA (sem credencial, rede, 5xx) nunca rebaixa ninguém.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EntitlementSnapshot = {
  plan: "free" | "pro";
  source: string;
  status: string;
  productId: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  lastVerifiedAt: string | null;
  environment: string;
};

export type SyncOutcome =
  { state: "sync_ok"; entitlement: EntitlementSnapshot } | { state: "sync_failed"; reason: string };

type EntitlementRow = {
  plan?: string;
  source?: string;
  status?: string;
  product_id?: string | null;
  expires_at?: string | null;
  auto_renew?: boolean;
  last_verified_at?: string | null;
  environment?: string;
  ok?: boolean;
};

function toSnapshot(row: EntitlementRow): EntitlementSnapshot {
  return {
    plan: row.plan === "pro" ? "pro" : "free",
    source: row.source ?? "none",
    status: row.status ?? "NONE",
    productId: row.product_id ?? null,
    expiresAt: row.expires_at ?? null,
    autoRenew: Boolean(row.auto_renew),
    lastVerifiedAt: row.last_verified_at ?? null,
    environment: row.environment ?? "test",
  };
}

/** Lê o direito atual resolvido pelo banco. */
export const syncEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncOutcome> => {
    const { data, error } = await context.supabase.rpc("resolve_entitlement");
    if (error || !data) return { state: "sync_failed", reason: "backend_indisponivel" };
    const row = data as EntitlementRow;
    if (row.ok === false) return { state: "sync_failed", reason: "sem_sessao" };
    return { state: "sync_ok", entitlement: toSnapshot(row) };
  });

/**
 * Valida uma compra no Google Play e grava o entitlement.
 * Nunca libera PRO só porque o cliente disse que comprou.
 */
export const verifyPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purchaseToken: string; productId: string }) => {
    const token = String(input?.purchaseToken ?? "").trim();
    const product = String(input?.productId ?? "").trim();
    if (!token || !product) throw new Error("Compra inválida.");
    return { purchaseToken: token, productId: product };
  })
  .handler(async ({ data, context }): Promise<SyncOutcome> => {
    const { verifyWithPlay } = await import("./play.server");
    const check = await verifyWithPlay(data.purchaseToken);

    if (!check.conclusive) {
      /* Sem resposta conclusiva: registra pendência e MANTÉM o direito atual. */
      await context.supabase.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "google_play",
          product_id: data.productId,
          purchase_token: data.purchaseToken,
          status: "PENDING",
          entitlement: "FREE",
          environment: "test",
        },
        { onConflict: "provider,purchase_token" },
      );
      return { state: "sync_failed", reason: check.reason };
    }

    await context.supabase.from("subscriptions").upsert(
      {
        user_id: context.userId,
        provider: "google_play",
        product_id: check.productId || data.productId,
        purchase_token: data.purchaseToken,
        linked_purchase_token: check.linkedPurchaseToken,
        status: check.status,
        entitlement: check.entitlement,
        start_at: check.startAt,
        expires_at: check.expiresAt,
        auto_renew: check.autoRenew,
        last_verified_at: new Date().toISOString(),
        environment: check.environment,
      },
      { onConflict: "provider,purchase_token" },
    );

    const { data: resolved, error } = await context.supabase.rpc("resolve_entitlement");
    if (error || !resolved) return { state: "sync_failed", reason: "backend_indisponivel" };
    return { state: "sync_ok", entitlement: toSnapshot(resolved as EntitlementRow) };
  });

/**
 * RESTAURAR COMPRAS — revalida no Play todos os tokens já ligados à conta.
 * A assinatura pertence à conta, não ao aparelho.
 */
export const restorePurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tokens?: { purchaseToken: string; productId: string }[] } | undefined) => ({
      tokens: (input?.tokens ?? []).filter((t) => t?.purchaseToken && t?.productId).slice(0, 20),
    }),
  )
  .handler(async ({ data, context }): Promise<SyncOutcome> => {
    const { verifyWithPlay } = await import("./play.server");

    const { data: existing } = await context.supabase
      .from("subscriptions")
      .select("purchase_token, product_id")
      .eq("user_id", context.userId);

    const candidates = new Map<string, string>();
    for (const row of existing ?? []) {
      if (row.purchase_token) candidates.set(row.purchase_token, row.product_id);
    }
    for (const t of data.tokens) candidates.set(t.purchaseToken, t.productId);

    for (const [token, productId] of candidates) {
      const check = await verifyWithPlay(token);
      if (!check.conclusive) continue; // inconclusivo nunca rebaixa
      await context.supabase.from("subscriptions").upsert(
        {
          user_id: context.userId,
          provider: "google_play",
          product_id: check.productId || productId,
          purchase_token: token,
          linked_purchase_token: check.linkedPurchaseToken,
          status: check.status,
          entitlement: check.entitlement,
          start_at: check.startAt,
          expires_at: check.expiresAt,
          auto_renew: check.autoRenew,
          last_verified_at: new Date().toISOString(),
          environment: check.environment,
        },
        { onConflict: "provider,purchase_token" },
      );
    }

    const { data: resolved, error } = await context.supabase.rpc("resolve_entitlement");
    if (error || !resolved) return { state: "sync_failed", reason: "backend_indisponivel" };
    return { state: "sync_ok", entitlement: toSnapshot(resolved as EntitlementRow) };
  });
