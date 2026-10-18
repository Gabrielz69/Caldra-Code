import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { validateProject, type IssueLevel } from "@/lib/projects/validation";
import type { Project } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

const LEVELS: { id: IssueLevel; label: string; icon: typeof Info; tone: string }[] = [
  { id: "erro", label: "Impedimentos", icon: XCircle, tone: "text-destructive" },
  { id: "alerta", label: "Atenção", icon: AlertTriangle, tone: "text-accent" },
  { id: "info", label: "Observações", icon: Info, tone: "text-muted-foreground" },
];

/** Conferência de fabricação do dossiê: impedimentos, alertas e observações. */
export function ValidationPanel({
  project,
  onOpenPart,
}: {
  project: Project;
  onOpenPart?: (instanceId: string) => void;
}) {
  const { materials } = useMaterials();
  const result = useMemo(() => validateProject(project, materials), [project, materials]);
  const [filter, setFilter] = useState<IssueLevel | "todos">("todos");

  if (project.parts.length === 0) return null;

  const visible =
    filter === "todos" ? result.issues : result.issues.filter((i) => i.level === filter);

  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          result.ready ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-accent uppercase">
              <ShieldCheck className="size-3.5" /> Liberado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-destructive uppercase">
              <XCircle className="size-3.5" /> {result.errors} impedimento(s)
            </span>
          )
        }
      >
        Conferência de fabricação
      </SectionLabel>

      <div className="flex flex-wrap gap-1.5">
        {[
          { id: "todos" as const, label: `Tudo (${result.issues.length})` },
          { id: "erro" as const, label: `Impedimentos (${result.errors})` },
          { id: "alerta" as const, label: `Atenção (${result.warnings})` },
          { id: "info" as const, label: `Observações (${result.infos})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider uppercase",
              filter === t.id
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {result.issues.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-accent" />
          Nenhum problema encontrado: as peças estão prontas para corte.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {visible.map((issue) => {
            const meta = LEVELS.find((l) => l.id === issue.level)!;
            const Icon = meta.icon;
            const clickable = !!issue.instanceId && !!onOpenPart;
            return (
              <li key={issue.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onOpenPart(issue.instanceId!)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border border-line bg-background/40 px-3 py-2.5 text-left",
                    clickable && "hover:border-accent/40",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} />
                  <span className="min-w-0">
                    <span className="block text-[13px]">{issue.title}</span>
                    <span className="block text-xs text-muted-foreground">{issue.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
