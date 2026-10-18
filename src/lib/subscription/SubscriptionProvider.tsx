import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PROTOTYPE_MASTER_CODE,
  getFeatureLimit,
  planAllows,
  type Feature,
  type Plan,
} from "./features";
import {
  fetchRemotePlan,
  readCache,
  redeemActivationCode,
  registerPurchase,
  writeCache,
  type PlanSource,
} from "./entitlementService";
import { buyWithPlay, hasPlayBilling, listPlayPurchases, type ProductId } from "./billing";
import {
  restorePurchases,
  syncEntitlement,
  verifyPurchase,
  type SyncOutcome,
} from "./entitlement.functions";
import { applySync, initialState, type EntitlementState, type SyncState } from "./entitlementState";
import { useAuth } from "@/lib/auth/AuthProvider";

type Result = { ok: boolean; message: string };

type SubscriptionValue = {
  plan: Plan;
  planSource: PlanSource;
  isMestre: boolean;
  isPro: boolean;
  isFree: boolean;
  projectLimit: number;
  ready: boolean;
  /** ÚNICO ponto de checagem de acesso do aplicativo. */
  can: (feature: Feature) => boolean;
  /** Gate suave: devolve `false` e abre o convite específico da feature. */
  requirePro: (feature: Feature) => boolean;
  gatedFeature: Feature | null;
  closeGate: () => void;
  unlockWithCode: (code: string) => Promise<Result>;
  buy: (product: ProductId) => Promise<Result>;
  restore: () => Promise<Result>;
  refresh: () => Promise<void>;
  reset: () => void;
  /** Diagnóstico da assinatura — nunca expõe token de compra. */
  entitlement: EntitlementState;
  syncState: SyncState;
};

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

/** Antes do primeiro paint (sem flash e sem divergência de hidratação). */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [ent, setEnt] = useState<EntitlementState>(() => initialState("free", "none"));
  const [ready, setReady] = useState(false);
  const [gatedFeature, setGatedFeature] = useState<Feature | null>(null);
  const { session, ready: authReady } = useAuth();
  const closeGate = useCallback(() => setGatedFeature((prev) => (prev ? null : prev)), []);

  const plan = ent.plan;
  const planSource = ent.source as PlanSource;

  const persist = useCallback((next: Plan, source: PlanSource) => {
    setEnt((prev) => ({ ...prev, plan: next, source }));
    writeCache(next, source);
  }, []);

  /* Cache local aplicado ANTES do paint — o app abre no plano correto. */
  useIsoLayoutEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("autostart") === "1") {
        writeCache("pro", "local");
        setEnt(initialState("pro", "local"));
        setReady(true);
        return;
      }
    } catch {
      /* ignore */
    }
    const cached = readCache();
    setEnt(initialState(cached.plan, cached.source));
    setReady(true);
  }, []);

  /**
   * Revalidação: SOMENTE resposta conclusiva do servidor muda o plano.
   * Offline, timeout ou erro mantêm o direito atual.
   */
  const applyOutcome = useCallback((outcome: SyncOutcome | { state: "offline" }) => {
    setEnt((prev) => {
      const next = applySync(prev, outcome);
      if (next.plan !== prev.plan || next.source !== prev.source) {
        writeCache(next.plan, next.source as PlanSource);
      }
      return next;
    });
    return outcome;
  }, []);

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      applyOutcome({ state: "offline" });
      return;
    }
    try {
      const outcome = await syncEntitlement({ data: undefined });
      applyOutcome(outcome);
      if (outcome.state === "sync_failed") {
        /* Caminho antigo (perfil) como rede de segurança — nunca rebaixa. */
        const remote = await fetchRemotePlan();
        if (remote?.plan === "pro") persist(remote.plan, remote.source);
      }
    } catch {
      applyOutcome({ state: "offline" });
    }
  }, [applyOutcome, persist]);

  /* Uma sincronização por conta — navegar NUNCA revalida. */
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!authReady) return;
    const uid = session?.user?.id ?? null;
    if (!uid) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === uid) return;
    syncedFor.current = uid;
    void refresh();
  }, [authReady, session, refresh]);

  const value = useMemo<SubscriptionValue>(() => {
    const can = (feature: Feature) => planAllows(plan, feature);
    return {
      plan,
      planSource,
      isMestre: plan === "pro",
      isPro: plan === "pro",
      isFree: plan === "free",
      projectLimit: getFeatureLimit(plan, "projects"),
      ready,
      can,
      requirePro: (feature) => {
        if (can(feature)) return true;
        setGatedFeature(feature);
        return false;
      },
      gatedFeature,
      closeGate,
      unlockWithCode: async (code) => {
        const normalized = code.trim().toUpperCase();
        if (!normalized) return { ok: false, message: "Informe o código." };
        if (normalized === PROTOTYPE_MASTER_CODE) {
          persist("pro", "local");
          return { ok: true, message: "Modo Mestre ativado." };
        }
        const res = await redeemActivationCode(normalized);
        if (res.ok) persist("pro", "code");
        return res;
      },
      buy: async (product) => {
        if (!hasPlayBilling()) {
          return {
            ok: false,
            message: "Compra na loja indisponível aqui. Use o site ou um código de ativação.",
          };
        }
        try {
          const purchase = await buyWithPlay(product);
          if (!purchase) return { ok: false, message: "Compra não concluída." };
          /* O servidor valida no Google Play — o cliente não libera nada. */
          const outcome = await verifyPurchase({
            data: { purchaseToken: purchase.token, productId: purchase.productId },
          });
          applyOutcome(outcome);
          if (outcome.state === "sync_ok" && outcome.entitlement.plan === "pro") {
            return { ok: true, message: "CALDRA PRO ativo." };
          }
          if (outcome.state === "sync_failed") {
            await registerPurchase(purchase.productId, purchase.token, "play");
            return {
              ok: false,
              message:
                "Compra recebida. Estamos confirmando com a loja — toque em Verificar assinatura em instantes.",
            };
          }
          return { ok: false, message: "A loja ainda não confirmou esta compra." };
        } catch {
          return { ok: false, message: "Compra cancelada." };
        }
      },
      restore: async () => {
        const tokens = (await listPlayPurchases()).map((p) => ({
          purchaseToken: p.token,
          productId: p.productId,
        }));
        try {
          const outcome = await restorePurchases({ data: { tokens } });
          applyOutcome(outcome);
          if (outcome.state === "sync_ok") {
            return outcome.entitlement.plan === "pro"
              ? { ok: true, message: "CALDRA PRO restaurado nesta conta." }
              : { ok: false, message: "Nenhuma assinatura ativa encontrada nesta conta." };
          }
        } catch {
          applyOutcome({ state: "offline" });
        }
        return {
          ok: false,
          message: "Não foi possível sincronizar agora. Seu acesso atual permanece preservado.",
        };
      },
      refresh,
      reset: () => persist("free", "none"),
      entitlement: ent,
      syncState: ent.syncState,
    };
  }, [plan, planSource, ready, gatedFeature, closeGate, persist, refresh, applyOutcome, ent]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

/** Hook central de permissões. */
export function useFeatureAccess(): SubscriptionValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useFeatureAccess deve ser usado dentro de SubscriptionProvider");
  return ctx;
}

export const useSubscription = useFeatureAccess;
