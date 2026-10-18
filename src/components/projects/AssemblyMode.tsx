import { useMemo } from "react";
import { Check, ListChecks, RotateCcw } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import {
  assemblySteps,
  resetAssemblyProgress,
  toggleAssemblyStep,
  useAssemblyProgress,
} from "@/lib/projects/assemblySteps";
import type { Project } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

/** Modo Montagem: roteiro passo a passo com marcação na bancada. */
export function AssemblyMode({
  project,
  onOpenPart,
}: {
  project: Project;
  onOpenPart?: (instanceId: string) => void;
}) {
  const steps = useMemo(() => assemblySteps(project), [project]);
  const done = useAssemblyProgress(project.id);

  if (!steps.length) return null;

  const completed = steps.filter((s) => done.includes(s.id)).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          <button
            onClick={() => resetAssemblyProgress(project.id)}
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase hover:text-accent"
          >
            <RotateCcw className="size-3.5" /> Reiniciar
          </button>
        }
      >
        Modo montagem
      </SectionLabel>

      <div className="mb-3 flex items-center gap-3">
        <ListChecks className="size-4 text-accent" />
        <div className="h-1 flex-1 overflow-hidden rounded bg-border">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {completed}/{steps.length} · {pct}%
        </span>
      </div>

      <ol className="space-y-1.5">
        {steps.map((step) => {
          const checked = done.includes(step.id);
          return (
            <li
              key={step.id}
              className={cn(
                "rounded-lg border border-line bg-background/40 px-3 py-2.5",
                checked && "border-accent/40 bg-accent/5",
              )}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleAssemblyStep(project.id, step.id)}
                  aria-label={`Concluir passo ${step.index}`}
                  aria-pressed={checked}
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
                    checked ? "border-accent bg-accent/20 text-accent" : "border-line",
                  )}
                >
                  {checked ? (
                    <Check className="size-3" />
                  ) : (
                    <span className="font-mono text-[9px] text-muted-foreground">{step.index}</span>
                  )}
                </button>
                <div className="min-w-0">
                  <p className={cn("text-[13px]", checked && "text-muted-foreground line-through")}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                  {step.parts.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {step.parts.map((p) => (
                        <button
                          key={p.instanceId}
                          type="button"
                          onClick={() => onOpenPart?.(p.instanceId)}
                          className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase hover:border-accent/40 hover:text-accent"
                        >
                          {p.code}
                          {p.quantity > 1 ? ` ×${p.quantity}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
