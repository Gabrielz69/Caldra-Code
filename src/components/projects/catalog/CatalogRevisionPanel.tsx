import { AlertTriangle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { findCatalogModel } from "@/lib/project-catalog/registry";
import {
  invalidateCatalogProject,
  regenerateCatalogProject,
  type Project,
} from "@/lib/projects/store";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
export function CatalogRevisionPanel({ project }: { project: Project }) {
  const source = project.catalogSource;
  const model = source ? findCatalogModel(source.modelSlug) : null;
  const initial = source?.pendingParameters ?? source?.parameters ?? {};
  const [values, setValues] = useState(initial);
  const result = useMemo(() => model?.generate?.(values), [model, values]);
  if (!source || !model?.generate) return null;
  const dirty = result?.fingerprint !== source.fingerprint;
  const stale = source.stale.length > 0;
  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          <span className="font-mono text-[10px] text-muted-foreground">
            REV {project.revision} · {source.snapshots.length} anterior(es)
          </span>
        }
      >
        Projeto paramétrico
      </SectionLabel>
      {(dirty || stale) && (
        <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-warn">
            <AlertTriangle className="size-4" />
            DERIVADOS DESATUALIZADOS
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            2D · 3D · BOM · lista de corte · CNC · documentação · montagem
          </p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {model.parameters.map((f) => (
          <label key={f.key} className="text-xs">
            <span className="text-muted-foreground">{f.label}</span>
            <div className="mt-1 flex items-center rounded-lg border border-line bg-background/50">
              <input
                type="number"
                value={values[f.key] ?? 0}
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                onChange={(e) => {
                  const next = { ...values, [f.key]: Number(e.target.value) };
                  setValues(next);
                  invalidateCatalogProject(project.id, next);
                }}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono outline-none"
              />
              <span className="pr-2 text-muted-foreground">{f.unit}</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="t-caption">A revisão atual permanece intacta até a regeneração explícita.</p>
        <Button
          disabled={!result || (!dirty && !stale)}
          onClick={() => result && regenerateCatalogProject(project.id, result)}
        >
          <RefreshCw />
          Regenerar derivados
        </Button>
      </div>
    </Panel>
  );
}
