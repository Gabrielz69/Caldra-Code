import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, ShieldCheck, Trash2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { PLAN_LABEL } from "@/lib/subscription/features";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Conta — CALDRA" },
      {
        name: "description",
        content:
          "Entre na sua conta CALDRA para levar o plano PRO entre aparelhos, ativar códigos e gerenciar seus dados.",
      },
      { property: "og:title", content: "Conta — CALDRA" },
      { property: "og:description", content: "Sessão, plano e exclusão de conta no CALDRA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContaPage,
});

function ContaPage() {
  const { user, ready, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const { plan, refresh, reset } = useFeatureAccess();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "entrar" ? await signIn(email, password) : await signUp(email, password, name);
    setBusy(false);
    if (res.ok) {
      toast.success(res.message);
      void refresh();
    } else {
      toast.error(res.message);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_my_account");
    setBusy(false);
    if (error) {
      toast.error("Não foi possível excluir agora. Tente novamente.");
      return;
    }
    await signOut();
    reset();
    toast.success("Conta e dados excluídos.");
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="font-mono text-sm text-muted-foreground animate-pulse">Carregando sessão…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 sm:px-6 pt-16 pb-[calc(7.5rem+env(safe-area-inset-bottom,24px))]">
      <header className="space-y-1.5">
        <Link
          to="/perfil"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-500 hover:underline mb-1"
        >
          <ArrowLeft className="size-3.5" />
          <span>Voltar para Perfil e Conta</span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">Gerenciamento de Conta</h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          A conta é opcional — o CALDRA funciona 100% offline. O login serve para sincronizar seu plano
          e projetos entre dispositivos.
        </p>
      </header>

      {user ? (
        <>
          <Panel className="space-y-3.5 p-4 sm:p-5 rounded-2xl border border-border/80" glow>
            <SectionLabel action={<ShieldCheck className="size-4 text-emerald-500" />}>
              Sessão Autenticada
            </SectionLabel>
            
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                E-mail Vinculado
              </span>
              <p className="font-mono text-sm font-semibold text-foreground">{user.email}</p>
              <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] font-mono">
                <span className="text-muted-foreground">Plano Atual:</span>
                <span className="font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  {PLAN_LABEL[plan]}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 font-mono text-xs font-semibold text-destructive hover:bg-destructive/20 active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="size-4" />
              <span>Encerrar Sessão</span>
            </button>
          </Panel>

          <Panel className="space-y-3 p-4 sm:p-5 rounded-2xl border border-border/80">
            <SectionLabel action={<Trash2 className="size-4 text-destructive" />}>
              Excluir Conta
            </SectionLabel>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Remove permanentemente sua conta e o vínculo do plano. Projetos salvos na memória local
              deste aparelho são mantidos no navegador.
            </p>
            {confirmDelete ? (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeAccount()}
                  className="flex-1 h-12 rounded-xl border border-destructive bg-destructive/20 font-mono text-xs font-bold text-destructive hover:bg-destructive/30 uppercase disabled:opacity-50 cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="h-12 rounded-xl border border-border px-4 font-mono text-xs font-medium text-foreground hover:bg-muted active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full h-12 rounded-xl border border-border/80 hover:border-destructive/50 font-mono text-xs text-muted-foreground hover:text-destructive active:scale-95 transition-all cursor-pointer"
              >
                Excluir minha conta
              </button>
            )}
          </Panel>
        </>
      ) : (
        <Panel className="space-y-4 p-4 sm:p-5 rounded-2xl border border-border/80" glow>
          {/* Seletor de modo Entrar / Criar */}
          <div className="flex gap-1 rounded-xl border border-border/80 bg-background/50 p-1">
            {(["entrar", "criar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "flex-1 h-10 rounded-lg font-mono text-xs font-semibold uppercase transition-all cursor-pointer " +
                  (mode === m
                    ? "bg-amber-500 text-black shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {m === "entrar" ? "Entrar" : "Criar Conta"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={async () => {
              const res = await signInWithGoogle();
              if (!res.ok) toast.error(res.message);
            }}
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/60 hover:bg-muted font-display text-sm font-semibold text-foreground transition-all cursor-pointer active:scale-98"
          >
            <span>Continuar com Google</span>
          </button>

          <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
            <span className="flex-1 h-px bg-border/60" />
            <span>ou com e-mail</span>
            <span className="flex-1 h-px bg-border/60" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "criar" && (
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Seu Nome
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do caldeireiro / empresa"
                  className="w-full h-12 rounded-xl border border-border/80 bg-background/50 px-4 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                autoComplete="email"
                className="w-full h-12 rounded-xl border border-border/80 bg-background/50 px-4 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                className="w-full h-12 rounded-xl border border-border/80 bg-background/50 px-4 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 inline-flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 font-display text-sm font-bold text-black transition-all cursor-pointer disabled:opacity-50 shadow-md"
            >
              {busy ? "Processando…" : mode === "entrar" ? "Entrar na Conta" : "Criar Minha Conta"}
            </button>
          </form>
        </Panel>
      )}
    </div>
  );
}
