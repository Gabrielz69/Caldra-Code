/**
 * MÁQUINA DE ESTADOS DO DIREITO DE ACESSO.
 *
 * Regra inegociável: SOMENTE uma resposta conclusiva do servidor muda o
 * plano. Falha de rede, timeout, resposta vazia ou app offline mantêm o
 * último direito conhecido — nunca rebaixam uma assinatura válida.
 */

import type { Plan } from "./features";
import type { EntitlementSnapshot, SyncOutcome } from "./entitlement.functions";

export type SyncState = "idle" | "sync_ok" | "sync_failed" | "offline";

export type EntitlementState = {
  plan: Plan;
  source: string;
  syncState: SyncState;
  lastSyncAt: string | null;
  snapshot: EntitlementSnapshot | null;
};

export type SyncInput = SyncOutcome | { state: "offline" };

export function initialState(plan: Plan, source: string): EntitlementState {
  return { plan, source, syncState: "idle", lastSyncAt: null, snapshot: null };
}

/** Aplica o resultado de uma sincronização ao estado atual. */
export function applySync(
  current: EntitlementState,
  input: SyncInput,
  now = new Date(),
): EntitlementState {
  if (input.state === "offline") return { ...current, syncState: "offline" };
  if (input.state === "sync_failed") return { ...current, syncState: "sync_failed" };

  const e = input.entitlement;
  return {
    plan: e.plan,
    source: e.source,
    syncState: "sync_ok",
    lastSyncAt: now.toISOString(),
    snapshot: e,
  };
}

/** Mensagem honesta para o usuário, sem jargão e sem token de compra. */
export function syncMessage(state: EntitlementState): string {
  if (state.syncState === "sync_ok") return "Assinatura verificada agora.";
  if (state.syncState === "offline")
    return "Sem conexão agora. Seu acesso atual permanece preservado enquanto a assinatura estiver válida.";
  if (state.syncState === "sync_failed")
    return "Não foi possível sincronizar agora. Seu acesso atual permanece preservado enquanto a assinatura estiver válida.";
  return "Ainda não sincronizado nesta sessão.";
}

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  CANCELED: "Cancelada (válida até o fim do período)",
  IN_GRACE_PERIOD: "Pagamento em atraso (acesso mantido)",
  ON_HOLD: "Suspensa pela loja",
  PAUSED: "Pausada",
  EXPIRED: "Expirada",
  PENDING: "Pendente de confirmação",
  NONE: "Sem assinatura ativa",
};
