import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { CaldraMark } from "./Logo";

export function MasterModeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { unlockWithCode, isMestre, reset } = useFeatureAccess();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await unlockWithCode(code);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError(null);
    setActivating(true);
    toast.success("Modo Mestre ativado.", {
      description: "Laboratório completo desbloqueado.",
    });
    setTimeout(() => {
      setActivating(false);
      setCode("");
      onOpenChange(false);
    }, 1100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-sm overflow-hidden border-0 p-0">
        <div className="relative p-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {activating && (
              <div
                className="pro-gradient absolute inset-y-0 w-1/3 opacity-40 blur-2xl"
                style={{ animation: "caldra-sweep 1s ease-in-out" }}
              />
            )}
          </div>
          <DialogHeader className="relative space-y-3">
            <CaldraMark className="size-11" />
            <DialogTitle className="font-display text-xl">MODO MESTRE</DialogTitle>
            <p className="text-sm text-muted-foreground">Desbloqueie o laboratório completo.</p>
          </DialogHeader>

          {isMestre ? (
            <div className="relative mt-5 space-y-4">
              <div className="pro-surface rounded-xl p-3">
                <p className="font-mono text-[11px] tracking-wider text-pro uppercase">
                  Ativo nesta sessão
                </p>
                <p className="mt-1 text-sm">
                  Todos os recursos Mestre estão liberados neste dispositivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  reset();
                  toast("Modo Mestre desativado.");
                }}
                className="w-full rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary"
              >
                Desativar Modo Mestre
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="relative mt-5 space-y-3">
              <label className="block">
                <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Digite seu código de acesso
                </span>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                  placeholder="••••••••"
                  aria-invalid={!!error}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-3 font-mono text-base tracking-[0.2em] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                />
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={activating}
                className="brand-gradient w-full rounded-xl py-3 font-display text-sm font-semibold tracking-wide text-background transition-transform active:scale-[0.99] disabled:opacity-70"
              >
                {activating ? "ATIVANDO…" : "DESBLOQUEAR"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Protótipo: o desbloqueio é local e será substituído por conta e assinatura.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
