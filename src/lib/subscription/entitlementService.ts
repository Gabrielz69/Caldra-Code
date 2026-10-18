/**
 * ENTITLEMENT — FONTE ÚNICA DE VERDADE DO PLANO.
 *
 * Nenhuma tela decide sozinha se algo está liberado. Toda checagem passa
 * por `planAllows` alimentado pelo plano resolvido aqui.
 *
 * Ordem de resolução:
 *   1. Perfil remoto (`profiles.plan`) — manda quando há sessão.
 *   2. Cache local — mantém o app utilizável offline.
 *
 * O cache nunca "promove" ninguém contra o remoto: se o servidor responde
 * `free` para a conta logada, o cache é corrigido para `free`.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizePlan, type Plan } from "./features";

const CACHE_KEY = "caldra.plan";
const LEGACY_CACHE_KEY = "chameleon.plan";
const SOURCE_KEY = "caldra.plan.source";

export type PlanSource = "none" | "code" | "play" | "manual" | "local";

/** O banco fala 'free' | 'pro'; valores antigos ('mestre'/'oficina') viram PRO. */
const fromRemote = (remote: string): Plan => normalizePlan(remote);

export function readCache(): { plan: Plan; source: PlanSource } {
  try {
    const plan = window.localStorage.getItem(CACHE_KEY) ?? window.localStorage.getItem(LEGACY_CACHE_KEY);
    const source = window.localStorage.getItem(SOURCE_KEY) as PlanSource | null;
    if (normalizePlan(plan) === "pro") return { plan: "pro", source: source ?? "local" };
  } catch {
    /* armazenamento indisponível */
  }
  return { plan: "free", source: "none" };
}

export function writeCache(plan: Plan, source: PlanSource) {
  try {
    window.localStorage.setItem(CACHE_KEY, plan);
    window.localStorage.setItem(SOURCE_KEY, source);
  } catch {
    /* armazenamento indisponível */
  }
}

/** Revalida o plano contra o servidor. Sem sessão ou sem rede devolve `null`. */
export async function fetchRemotePlan(): Promise<{ plan: Plan; source: PlanSource } | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("plan, plan_source, plan_expires_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data) return null;

  const expired = data.plan_expires_at
    ? new Date(data.plan_expires_at).getTime() < Date.now()
    : false;
  const plan = expired ? "free" : fromRemote(data.plan);
  return { plan, source: (data.plan_source as PlanSource) ?? "none" };
}

export type RedeemResult = { ok: boolean; message: string };

/** Resgata um código de ativação. A atomicidade mora na função do banco. */
export async function redeemActivationCode(code: string): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();
  if (!/^CALDRA-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(normalized)) {
    return { ok: false, message: "Formato inválido. Use CALDRA-XXXXX-XXXXX-XXXXX." };
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre na sua conta para ativar o código." };

  const { data, error } = await supabase.rpc("redeem_activation_code", { _code: normalized });
  if (error) return { ok: false, message: "Não foi possível validar agora. Tente novamente." };

  const res = data as { ok: boolean; reason?: string };
  if (res.ok) return { ok: true, message: "Código aceito. CALDRA PRO liberado." };
  if (res.reason === "ja_usado") return { ok: false, message: "Este código já foi utilizado." };
  if (res.reason === "sem_sessao")
    return { ok: false, message: "Entre na sua conta para ativar o código." };
  return { ok: false, message: "Código inválido. Confira os caracteres." };
}

/** Registra uma compra confirmada e promove o perfil a PRO. */
export async function registerPurchase(
  productId: string,
  token: string | null,
  store: "play" | "web",
): Promise<RedeemResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre na sua conta para vincular a compra." };

  await supabase.from("purchases").upsert(
    {
      user_id: auth.user.id,
      store,
      product_id: productId,
      purchase_token: token,
      status: "ativa",
    },
    { onConflict: "purchase_token", ignoreDuplicates: false },
  );

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: auth.user.id, plan: "pro", plan_source: store === "play" ? "play" : "manual" });

  if (error)
    return {
      ok: false,
      message: "Compra registrada, mas o plano não sincronizou. Toque em restaurar.",
    };
  return { ok: true, message: "CALDRA PRO ativo." };
}
