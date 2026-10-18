import { useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EngineField, EngineValues } from "@/lib/geometry/engines";
import type { GeometryResult } from "@/lib/geometry/types";
import { conferenceRows } from "@/lib/geometry/conference";
import { developmentNotes, fabricationTips, fieldMeaning } from "@/lib/education/learn";
import { formatNumber } from "@/lib/settings/SettingsProvider";
import { cn } from "@/lib/utils";

const STEPS = ["Parâmetros", "Cálculo", "Desenvolvimento", "Fabricação"] as const;

/**
 * APRENDER — modo pedagógico guiado com os VALORES REAIS do usuário.
 * Nenhum número é recalculado aqui: tudo vem do resultado dos motores puros.
 */
export function LearnDialog({
  open,
  onOpenChange,
  slug,
  name,
  fields,
  values,
  result,
  precision = 2,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  name: string;
  fields: EngineField[];
  values: EngineValues;
  result: GeometryResult;
  precision?: number;
}) {
  const [step, setStep] = useState(0);
  const rows = useMemo(() => conferenceRows(slug, values, result), [slug, values, result]);
  const devNotes = developmentNotes(slug);
  const tips = fabricationTips(slug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg flex-col overflow-y-auto border-0 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <GraduationCap className="size-5 text-accent" /> Aprender — {name}
          </DialogTitle>
        </DialogHeader>

        {/* progresso */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 rounded-lg px-1 py-1.5 font-mono text-[9px] tracking-wider uppercase transition-colors",
                i === step
                  ? "bg-accent/12 text-accent ring-1 ring-accent/20"
                  : i < step
                    ? "text-accent/70"
                    : "text-muted-foreground",
              )}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="brand-gradient h-full transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div key={step} className="fade-up space-y-2.5">
          {step === 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                O que cada medida que você digitou representa na peça.
              </p>
              {fields.map((f) => (
                <div key={f.key} className="rounded-xl border border-line bg-background/40 p-3">
                  <p className="flex items-center justify-between text-[12px] font-medium">
                    <span>{f.label}</span>
                    <span className="font-mono text-accent">
                      {formatNumber(values[f.key] ?? 0, f.integer ? 0 : precision)} {f.unit ?? "mm"}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {fieldMeaning(f.key) ?? `Entrada ${f.tag} do método ${result.method}.`}
                  </p>
                </div>
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs text-muted-foreground">
                Cada fórmula com os seus números substituídos — mesmos valores do resultado.
              </p>
              {result.steps.map((s) => (
                <div key={s.title} className="rounded-xl border border-line bg-background/40 p-3">
                  <p className="text-[12px] font-medium">{s.title}</p>
                  <div className="mt-2 space-y-1 font-mono text-[11px]">
                    <Line k="Dado" v={s.given} />
                    <Line k="Fórmula" v={s.formula} />
                    <Line k="Subst." v={s.substitution} muted />
                    <Line k="Resultado" v={s.result} accent />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{s.meaning}</p>
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-muted-foreground">
                Como o traçado é construído na chapa — método {result.method}.
              </p>
              {devNotes.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Conteúdo de desenvolvimento desta peça em breve.
                </p>
              )}
              {devNotes.map((n) => (
                <div key={n.title} className="rounded-xl border border-line bg-background/40 p-3">
                  <p className="text-[12px] font-medium">{n.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{n.body}</p>
                </div>
              ))}
              {rows.length > 0 && (
                <div className="rounded-xl border border-accent/25 bg-accent/8 p-3">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
                    Conferência do traçado
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px]">
                    {rows.map((r, idx) => (
                      <div key={`${r.label}-${idx}`} className="flex justify-between gap-2">
                        <span className="truncate text-muted-foreground">{r.label}</span>
                        <span>
                          {formatNumber(r.value, r.suffix === "°" ? 2 : precision)}{" "}
                          {r.suffix ?? "mm"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {tips.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Dicas de fabricação desta peça em breve.
                </p>
              ) : (
                tips.map((t) => (
                  <div key={t.title} className="rounded-xl border border-line bg-background/40 p-3">
                    <p className="text-[12px] font-medium">{t.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t.body}</p>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary disabled:opacity-40"
          >
            Voltar
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="brand-gradient flex-1 rounded-xl py-2.5 font-display text-sm font-semibold text-background"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={() => onOpenChange(false)}
              className="brand-gradient flex-1 rounded-xl py-2.5 font-display text-sm font-semibold text-background"
            >
              Concluir
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Line({
  k,
  v,
  muted,
  accent,
}: {
  k: string;
  v: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-muted-foreground">{k}</span>
      <span className={cn(accent && "text-accent", muted && "text-foreground/70")}>{v}</span>
    </div>
  );
}
