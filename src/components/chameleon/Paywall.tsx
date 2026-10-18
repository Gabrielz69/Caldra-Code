/**
 * PAYWALL ÚNICO — todo caminho para o PRO passa por este componente.
 * Ele aparece de duas formas:
 *   • `PaywallDialog` — gate suave disparado por uma funcionalidade específica.
 *   • Rota /pro — a mesma vitrine em página inteira.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ExternalLink, Lock, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { COMPARISON, FEATURE_PITCH, PLAN_LABEL, PLAN_PITCH } from "@/lib/subscription/features";
import {
  PRODUCTS,
  WEB_CHECKOUT_URL,
  hasPlayBilling,
  queryProductDetails,
  type ProductId,
} from "@/lib/subscription/billing";
import { PRICING, formatPrice, isBrl } from "@/lib/subscription/pricing";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { Panel, SectionLabel } from "./ui";
import { AuroraBackground } from "./Aurora";

/** Comparativo oficial: lido da matriz central, nunca escrito à mão na tela. */
function Cell({ value, pro }: { value: string | boolean; pro?: boolean }) {
  if (value === true)
    return <Check className={cn("size-3.5", pro ? "text-pro" : "text-muted-foreground")} />;
  if (value === false) return <Minus className="size-3.5 text-muted-foreground/40" />;
  return (
    <span className={cn("font-mono text-[10px]", pro ? "text-pro" : "text-muted-foreground")}>
      {value}
    </span>
  );
}

function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-line bg-foreground/[0.03] px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        <span>Recurso</span>
        <span className="w-14 text-center">Free</span>
        <span className="w-14 text-center text-pro">Pro</span>
      </div>
      {COMPARISON.map((row, idx) => (
        <div
          key={`${row.label}-${idx}`}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-line/60 px-3 py-2 text-[13px] last:border-0"
        >
          <span>{row.label}</span>
          <span className="grid w-14 place-items-center">
            <Cell value={row.free} />
          </span>
          <span className="grid w-14 place-items-center">
            <Cell value={row.pro} pro />
          </span>
        </div>
      ))}
    </div>
  );
}

function PlanHeads() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-line p-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          {PLAN_PITCH.free.title}
        </p>
        <p className="mt-1 text-[13px]">{PLAN_PITCH.free.subtitle}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{PLAN_PITCH.free.line}</p>
      </div>
      <div className="pro-surface rounded-xl p-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-pro uppercase">
          {PLAN_PITCH.pro.title}
        </p>
        <p className="mt-1 text-[13px]">{PLAN_PITCH.pro.subtitle}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{PLAN_PITCH.pro.line}</p>
      </div>
    </div>
  );
}

export function PaywallBody({ onDone }: { onDone?: () => void }) {
  const { buy, restore, unlockWithCode, plan } = useFeatureAccess();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const playAvailable = hasPlayBilling();
  /** Dentro da TWA o preço exibido vem do Play Billing, nunca das constantes. */
  const [playPrices, setPlayPrices] = useState<Partial<Record<ProductId, string>>>({});
  const brl = isBrl();

  useEffect(() => {
    if (!playAvailable) return;
    let alive = true;
    void queryProductDetails().then((p) => {
      if (alive) setPlayPrices(p);
    });
    return () => {
      alive = false;
    };
  }, [playAvailable]);

  const priceOf = (key: "monthly" | "yearly" | "lifetime") => {
    const entry = PRICING[key];
    if (entry.product && playPrices[entry.product]) return playPrices[entry.product]!;
    return formatPrice(entry, brl);
  };

  const run = async (key: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      toast.success(res.message);
      onDone?.();
    } else {
      toast.error(res.message);
    }
  };

  if (plan !== "free") {
    return (
      <div className="space-y-3">
        <PlanHeads />
        <p className="text-sm text-muted-foreground">
          Você já está no <span className="text-pro">CALDRA {PLAN_LABEL[plan]}</span>. Tudo
          liberado.
        </p>
        <ComparisonTable />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-display text-lg leading-snug">
        Da medida ao corte em <span className="text-accent">2 minutos</span>.
      </p>

      <PlanHeads />
      <ComparisonTable />

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          disabled={busy !== null}
          onClick={() =>
            playAvailable
              ? run("m", () => buy(PRODUCTS.monthly))
              : window.open(WEB_CHECKOUT_URL, "_blank", "noopener")
          }
          className="rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-pro/60 disabled:opacity-50"
        >
          <span className="block font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {PRICING.monthly.label}
          </span>
          <span className="font-display text-lg font-semibold">{priceOf("monthly")}</span>
          <span className="block text-[11px] text-muted-foreground">{PRICING.monthly.note}</span>
        </button>

        <button
          disabled={busy !== null}
          onClick={() =>
            playAvailable
              ? run("y", () => buy(PRODUCTS.yearly))
              : window.open(WEB_CHECKOUT_URL, "_blank", "noopener")
          }
          className="pro-surface rounded-xl px-4 py-3 text-left disabled:opacity-50"
        >
          <span className="block font-mono text-[10px] tracking-[0.18em] text-pro uppercase">
            {PRICING.yearly.label} · {PRICING.yearly.badge}
          </span>
          <span className="font-display text-lg font-semibold">{priceOf("yearly")}</span>
          <span className="block text-[11px] text-muted-foreground">{PRICING.yearly.note}</span>
        </button>
      </div>

      {!playAvailable && (
        <button
          onClick={() => window.open(WEB_CHECKOUT_URL, "_blank", "noopener")}
          className="w-full rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-pro/60"
        >
          <span className="block font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {PRICING.lifetime.label} · {PRICING.lifetime.badge}
          </span>
          <span className="font-display text-lg font-semibold">{priceOf("lifetime")}</span>
          <span className="block text-[11px] text-muted-foreground">{PRICING.lifetime.note}</span>
        </button>
      )}

      {!playAvailable && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ExternalLink className="size-3" />
          Fora do aplicativo da loja a compra é concluída no site e liberada por código.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowCode((v) => !v)}
          className="rounded-xl border border-line px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase"
        >
          Já tenho plano
        </button>
        <button
          disabled={busy !== null}
          onClick={() => run("r", restore)}
          className="rounded-xl border border-line px-3 py-2 font-mono text-[11px] tracking-[0.16em] uppercase disabled:opacity-50"
        >
          Restaurar compra
        </button>
      </div>

      {showCode && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("c", () => unlockWithCode(code));
          }}
          className="space-y-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CALDRA-XXXXX-XXXXX-XXXXX"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-xl border border-line bg-background/50 px-3 py-2.5 font-mono text-sm tracking-[0.18em] uppercase outline-none focus:border-accent"
          />
          {!user && (
            <p className="text-[11px] text-muted-foreground">
              O código fica preso à sua conta.{" "}
              <Link to="/conta" className="text-accent underline">
                Entrar agora
              </Link>
              .
            </p>
          )}
          <button
            type="submit"
            disabled={busy !== null}
            className="pro-gradient w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Ativar código
          </button>
        </form>
      )}
    </div>
  );
}

/** Gate suave: abre com o convite da funcionalidade tocada. */
export function PaywallDialog() {
  const { gatedFeature, closeGate } = useFeatureAccess();
  const pitch = gatedFeature ? FEATURE_PITCH[gatedFeature] : null;

  return (
    <Dialog open={gatedFeature !== null} onOpenChange={(o) => !o && closeGate()}>
      <DialogContent
        viewport
        overlayClassName="bg-background/75 backdrop-blur-none"
        className="isolate max-h-[calc(100dvh-1rem)] max-w-lg overflow-y-auto overscroll-contain p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Lock className="size-4 text-pro" />
            {pitch?.title ?? "CALDRA PRO"}
          </DialogTitle>
        </DialogHeader>
        {pitch && <p className="text-sm text-muted-foreground">{pitch.benefit}</p>}
        <PaywallBody onDone={closeGate} />
      </DialogContent>
    </Dialog>
  );
}

/** Cartão de vitrine usado na rota /pro. */
export function PaywallPanel({ className }: { className?: string }) {
  return (
    <Panel className={cn("relative space-y-4 overflow-hidden p-4", className)} glow>
      <AuroraBackground mode="always" className="-z-10" />
      <SectionLabel className="text-pro">CALDRA PRO</SectionLabel>
      <PaywallBody />
    </Panel>
  );
}
