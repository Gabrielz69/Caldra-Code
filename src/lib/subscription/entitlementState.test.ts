import { describe, expect, it } from "vitest";
import { applySync, initialState, syncMessage, type EntitlementState } from "./entitlementState";
import type { EntitlementSnapshot } from "./entitlement.functions";

const snap = (over: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot => ({
  plan: "pro",
  source: "play",
  status: "ACTIVE",
  productId: "caldra.pro.yearly",
  expiresAt: "2030-01-01T00:00:00.000Z",
  autoRenew: true,
  lastVerifiedAt: "2026-01-01T00:00:00.000Z",
  environment: "production",
  ...over,
});

const pro: EntitlementState = {
  plan: "pro",
  source: "play",
  syncState: "sync_ok",
  lastSyncAt: "2026-01-01T00:00:00.000Z",
  snapshot: snap(),
};

describe("direito de acesso — servidor é a fonte de verdade", () => {
  it("compra válida libera PRO", () => {
    const next = applySync(initialState("free", "none"), { state: "sync_ok", entitlement: snap() });
    expect(next.plan).toBe("pro");
    expect(next.syncState).toBe("sync_ok");
  });

  it("compra inválida mantém FREE", () => {
    const next = applySync(initialState("free", "none"), {
      state: "sync_ok",
      entitlement: snap({ plan: "free", status: "EXPIRED", source: "none" }),
    });
    expect(next.plan).toBe("free");
  });

  it("renovação atualiza a validade", () => {
    const next = applySync(pro, {
      state: "sync_ok",
      entitlement: snap({ expiresAt: "2031-06-01T00:00:00.000Z" }),
    });
    expect(next.snapshot?.expiresAt).toBe("2031-06-01T00:00:00.000Z");
    expect(next.plan).toBe("pro");
  });

  it("cancelamento, carência e suspensão preservam o acesso enquanto válidos", () => {
    for (const status of ["CANCELED", "IN_GRACE_PERIOD", "ON_HOLD", "PAUSED"]) {
      const next = applySync(pro, { state: "sync_ok", entitlement: snap({ status }) });
      expect(next.plan, status).toBe("pro");
      expect(next.snapshot?.status).toBe(status);
    }
  });

  it("expiração conclusiva rebaixa para FREE", () => {
    const next = applySync(pro, {
      state: "sync_ok",
      entitlement: snap({ plan: "free", status: "EXPIRED", source: "none" }),
    });
    expect(next.plan).toBe("free");
  });

  it("falha temporária de rede NÃO remove PRO válido", () => {
    const failed = applySync(pro, { state: "sync_failed", reason: "backend_indisponivel" });
    expect(failed.plan).toBe("pro");
    expect(failed.syncState).toBe("sync_failed");

    const offline = applySync(pro, { state: "offline" });
    expect(offline.plan).toBe("pro");
    expect(offline.syncState).toBe("offline");
    expect(offline.snapshot).toEqual(pro.snapshot);
  });

  it("falhas repetidas nunca acumulam rebaixamento", () => {
    let state = pro;
    for (let i = 0; i < 20; i++)
      state = applySync(state, { state: "sync_failed", reason: "network" });
    expect(state.plan).toBe("pro");
  });

  it("logout/login e troca de dispositivo preservam o direito da conta", () => {
    const fresh = initialState("free", "none"); // aparelho novo, sem cache
    const next = applySync(fresh, { state: "sync_ok", entitlement: snap() });
    expect(next.plan).toBe("pro");
  });

  it("mensagem de falha tranquiliza sem prometer nada", () => {
    expect(syncMessage(applySync(pro, { state: "sync_failed", reason: "network" }))).toContain(
      "permanece preservado",
    );
    expect(syncMessage(applySync(pro, { state: "offline" }))).toContain("Sem conexão");
  });
});
