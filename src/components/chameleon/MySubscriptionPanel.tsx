import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { STATUS_LABEL, syncMessage } from "@/lib/subscription/entitlementState";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

const PRODUCT_LABEL: Record<string, string> = {
  "caldra.pro.monthly": "CALDRA PRO mensal",
  "caldra.pro.yearly": "CALDRA PRO anual",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

/**
 * MINHA ASSINATURA — diagnóstico simples. O botão de verificação apenas
 * pede uma nova checagem ao servidor: ele nunca concede PRO sozinho.
 * O token de compra JAMAIS aparece aqui.
 */
export function MySubscriptionPanel() {
  const { isPro, entitlement, refresh, restore } = useFeatureAccess();
  const [busy, setBusy] = useState<"verify" | "restore" | null>(null);
  const snap = entitlement.snapshot;

  const verify = async () => {
    setBusy("verify");
    await refresh();
    setBusy(null);
    toast.message("Verificação solicitada", { description: syncMessage(entitlement) });
  };

  const doRestore = async () => {
    setBusy("restore");
    const res = await restore();
    setBusy(null);
    if (res.ok) {
      toast.success(res.message);
    } else {
      toast.message(res.message);
    }
  };

  return (
    <Panel className="space-y-3 p-4">
      <SectionLabel action={<ShieldCheck className="size-4 text-pro" />}>
        Minha assinatura
      </SectionLabel>

      <dl className="grid gap-1.5 text-[13px] sm:grid-cols-2">
        <Row label="Acesso" value={isPro ? "CALDRA PRO" : "CALDRA FREE"} />
        <Row
          label="Plano"
          value={snap?.productId ? (PRODUCT_LABEL[snap.productId] ?? snap.productId) : "—"}
        />
        <Row label="Status" value={STATUS_LABEL[snap?.status ?? "NONE"] ?? "—"} />
        <Row label="Válido até" value={formatDate(snap?.expiresAt ?? null)} />
        <Row label="Renovação automática" value={snap ? (snap.autoRenew ? "Sim" : "Não") : "—"} />
        <Row label="Última sincronização" value={formatTime(entitlement.lastSyncAt)} />
      </dl>

      <p className="text-[12px] text-muted-foreground">{syncMessage(entitlement)}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={doRestore}
          disabled={busy !== null}
          className="rounded-xl border border-border px-3 py-2 font-mono text-[11px] tracking-wider uppercase disabled:opacity-50"
        >
          Restaurar compras
        </button>
        <button
          type="button"
          onClick={verify}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-xl border border-accent/50 px-3 py-2 font-mono text-[11px] tracking-wider text-accent uppercase disabled:opacity-50"
        >
          <RefreshCw className={busy === "verify" ? "size-3.5 animate-spin" : "size-3.5"} />
          Verificar assinatura
        </button>
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg border border-line bg-background/40 px-2.5 py-1.5">
      <dt className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-right text-[12px]">{value}</dd>
    </div>
  );
}
