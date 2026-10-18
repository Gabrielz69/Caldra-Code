/**
 * ESTÚDIO DO PROJETO DE CATÁLOGO DENTRO DO DOSSIÊ.
 *
 * Reconstrói o resultado canônico a partir dos parâmetros já gravados no
 * dossiê (mesma engine do catálogo) e oferece 2D, 3D, explodida, árvore,
 * propriedades e o envio real ao CHAMFER.
 */

import { PenTool } from "lucide-react";
import { useMemo, useState } from "react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { Button } from "@/components/ui/button";
import { buildInstances } from "@/lib/project-catalog/instances";
import { findCatalogModel } from "@/lib/project-catalog/registry";
import type { Project } from "@/lib/projects/store";
import { cn } from "@/lib/utils";
import { ProjectModel3D } from "./ProjectModel3D";
import { ProjectTreePanel } from "./ProjectTreePanel";
import { SendToChamferDialog } from "./SendToChamferDialog";
import { TechnicalDrawing2D } from "./TechnicalDrawing2D";

type Tab = "3d" | "explodida" | "perspectiva" | "2d";

export function CatalogProjectStudio({ project }: { project: Project }) {
  const [tab, setTab] = useState<Tab>("3d");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [chamfer, setChamfer] = useState(false);

  const result = useMemo(() => {
    const src = project.catalogSource;
    if (!src) return null;
    const model = findCatalogModel(src.modelSlug);
    try {
      return model?.generate?.(src.parameters) ?? null;
    } catch {
      return null;
    }
  }, [project]);

  const instances = useMemo(() => (result ? buildInstances(result) : []), [result]);
  if (!result) return null;

  return (
    <Panel className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Modelo do projeto</SectionLabel>
        <Button size="sm" variant="outline" onClick={() => setChamfer(true)}>
          <PenTool /> Adicionar ao CHAMFER
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(["3d", "explodida", "perspectiva", "2d"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider",
              tab === t ? "bg-accent/15 text-accent" : "text-muted-foreground",
            )}
          >
            {t === "2d"
              ? "2D Técnico"
              : t === "3d"
                ? "Vista 3D"
                : t === "perspectiva"
                  ? "Perspectiva técnica"
                  : "Explodida"}
          </button>
        ))}
      </div>
      {tab === "2d" ? (
        <TechnicalDrawing2D
          result={result}
          instances={instances}
          selectedId={selectedId}
          onSelect={setSelectedId}
          meta={{
            projectName: project.name,
            ...(project.code ? { code: project.code } : {}),
            revision: project.revision,
            ...(project.notes ? { notes: project.notes.slice(0, 28) } : {}),
          }}
        />
      ) : (
        <ProjectModel3D
          instances={instances}
          selectedId={selectedId}
          onSelect={setSelectedId}
          hidden={hidden}
          exploded={tab === "explodida"}
          perspective={tab === "perspectiva"}
        />
      )}
      <ProjectTreePanel
        result={result}
        instances={instances}
        selectedId={selectedId}
        onSelect={setSelectedId}
        hidden={hidden}
        onToggleHidden={(key) =>
          setHidden((h) => {
            const n = new Set(h);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
          })
        }
      />
      <SendToChamferDialog
        result={result}
        open={chamfer}
        onOpenChange={setChamfer}
        existingProjectId={project.id}
      />
    </Panel>
  );
}
