import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Feedback de instrumento técnico — Parte 3.
 *
 * Mostra em que etapa do trabalho o usuário está: GEOMETRIA (entrada e
 * verificação), PLANIFICAÇÃO (traçado/desenvolvimento) e FABRICAÇÃO
 * (material e saída). Não altera o cálculo: apenas traduz a aba ativa em
 * estado do instrumento e permite pular direto para a primeira aba de cada
 * estágio.
 */

export type StageId = "geometria" | "planificacao" | "fabricacao";

export const STAGES: { id: StageId; label: string; hint: string; tabs: string[] }[] = [
  {
    id: "geometria",
    label: "Geometria",
    hint: "Medidas e verificação",
    tabs: ["3D", "Dimensões", "Cálculos", "Conferência"],
  },
  {
    id: "planificacao",
    label: "Planificação",
    hint: "Traçado e desenvolvimento",
    tabs: ["Traçado", "Desenvolvimento"],
  },
  {
    id: "fabricacao",
    label: "Fabricação",
    hint: "Material e saída",
    tabs: ["Material", "Exportação"],
  },
];

export const stageOfTab = (tab: string): StageId =>
  STAGES.find((s) => s.tabs.includes(tab))?.id ?? "geometria";

export function StageBar({
  tab,
  tabs,
  onJump,
  className,
}: {
  /** Aba ativa no estúdio. */
  tab: string;
  /** Abas realmente disponíveis (variam por modo e por geometria). */
  tabs: readonly string[];
  onJump: (tab: string) => void;
  className?: string;
}) {
  const active = stageOfTab(tab);
  const index = STAGES.findIndex((s) => s.id === active);

  return (
    <div
      className={cn("mb-3 flex items-stretch gap-1.5", className)}
      aria-label="Etapa do trabalho"
    >
      {STAGES.map((stage, i) => {
        const target = stage.tabs.find((t) => tabs.includes(t));
        const done = i < index;
        const current = i === index;
        return (
          <button
            key={stage.id}
            type="button"
            disabled={!target}
            aria-current={current ? "step" : undefined}
            onClick={() => target && onJump(target)}
            className={cn(
              "group relative min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-left transition-colors",
              current
                ? "border-accent/35 bg-accent/10"
                : done
                  ? "border-line bg-secondary/40"
                  : "border-line/70 bg-transparent",
              !target && "opacity-40",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1 font-mono text-[9px] tracking-[0.18em] uppercase",
                current ? "text-accent" : done ? "text-foreground/80" : "text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="size-2.5" />
              ) : (
                <span className="tabular-nums">{i + 1}</span>
              )}
              <span className="truncate">{stage.label}</span>
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {stage.hint}
            </span>
            <span
              className={cn(
                "mt-1.5 block h-px w-full transition-colors",
                current ? "bg-accent/60" : done ? "bg-foreground/25" : "bg-line",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
