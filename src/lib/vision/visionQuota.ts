/**
 * COTA DIÁRIA DO CHAMFER VISION (plano Free).
 *
 * Regra: 3 vetorizações por DIA no modo TÉCNICO. O dia é o dia civil do
 * fuso America/Sao_Paulo — vira à meia-noite de Brasília, não do aparelho.
 *
 * Contagem autoritativa no servidor (`usage_vectorizations`). Sem rede,
 * conta localmente por aparelho com a mesma regra de dia; ao reconectar,
 * prevalece o MAIOR valor do dia (as RPCs fazem o `GREATEST`). Assim o
 * limite não é burlável por reinstalação enquanto houver conexão.
 */

import { supabase } from "@/integrations/supabase/client";

export const FREE_DAILY_VECTORIZATIONS = 3;

const KEY = "caldra.vision.daily";
/** Chaves do antigo contador VITALÍCIO — removidas na primeira leitura. */
const LEGACY_KEYS = ["caldra.vision.uses", "chameleon.vision.uses", "caldra.vision.lifetime"];

export type VisionUsage = { day: string; count: number };

/** Dia civil em America/Sao_Paulo, no formato YYYY-MM-DD. */
export function spDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function dropLegacy() {
  try {
    for (const k of LEGACY_KEYS) window.localStorage.removeItem(k);
  } catch {
    /* armazenamento indisponível */
  }
}

export function readLocal(): VisionUsage {
  dropLegacy();
  const today = spDay();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisionUsage>;
      if (parsed.day === today && typeof parsed.count === "number")
        return { day: today, count: Math.max(0, Math.floor(parsed.count)) };
    }
  } catch {
    /* armazenamento indisponível */
  }
  return { day: today, count: 0 };
}

export function writeLocal(usage: VisionUsage) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(usage));
  } catch {
    /* armazenamento indisponível */
  }
}

type RpcResult = { ok: boolean; count?: number; reason?: string };

async function callRpc(fn: "sync_vectorizations" | "consume_vectorization", local: number) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.rpc(fn, { _local: local });
  if (error) return null;
  const res = data as unknown as RpcResult;
  if (!res?.ok || typeof res.count !== "number") return null;
  return res.count;
}

/** Sincroniza com o servidor; devolve o contador do dia já reconciliado. */
export async function syncUsage(): Promise<VisionUsage> {
  const local = readLocal();
  try {
    const remote = await callRpc("sync_vectorizations", local.count);
    if (remote === null) return local;
    const merged = { day: local.day, count: Math.max(local.count, remote) };
    writeLocal(merged);
    return merged;
  } catch {
    return local;
  }
}

/** Consome uma vetorização. Devolve o contador do dia após o consumo. */
export async function consumeUsage(): Promise<VisionUsage> {
  const local = readLocal();
  try {
    const remote = await callRpc("consume_vectorization", local.count);
    if (remote !== null) {
      const merged = { day: local.day, count: remote };
      writeLocal(merged);
      return merged;
    }
  } catch {
    /* offline: cai para o contador do aparelho */
  }
  const offline = { day: local.day, count: local.count + 1 };
  writeLocal(offline);
  return offline;
}
