import { useNavigate } from "@tanstack/react-router";
import { Calculator, PenTool, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { Button } from "@/components/ui/button";
import { buildInstances } from "@/lib/project-catalog/instances";
import { markRecent } from "@/lib/project-catalog/preferences";
import type { CatalogModel } from "@/lib/project-catalog/types";
import { createCatalogProject } from "@/lib/projects/store";
import { cn } from "@/lib/utils";
import { ProjectBreakdown } from "./ProjectBreakdown";
import { ProjectModel3D } from "./ProjectModel3D";
import { ProjectTreePanel } from "./ProjectTreePanel";
import { SendToChamferDialog } from "./SendToChamferDialog";
import { TechnicalDrawing2D } from "./TechnicalDrawing2D";

type Tab = "2d" | "3d" | "explodida" | "perspectiva" | "detalhes";
const TABS: { key: Tab; label: string }[] = [
  { key: "2d", label: "2D Técnico" },
  { key: "3d", label: "Vista 3D" },
  { key: "explodida", label: "Explodida" },
  { key: "perspectiva", label: "Perspectiva técnica" },
  { key: "detalhes", label: "Detalhes" },
];

export function ProjectConfigurator({ model }: { model: CatalogModel }) {
  const nav = useNavigate();
  const [values, setValues] = useState(model.defaults);
  const [generated, setGenerated] = useState(false);
  const [tab, setTab] = useState<Tab>("3d");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [chamfer, setChamfer] = useState(false);

  const result = useMemo(() => model.generate?.(values), [model, values]);
  const instances = useMemo(() => (result ? buildInstances(result) : []), [result]);
  const errors = model.parameters.filter(
    (f) => !Number.isFinite(values[f.key]) || values[f.key]! < f.min || values[f.key]! > f.max,
  );
  const selectedPartKey = instances.find((i) => i.id === selectedId)?.partKey ?? null;

  const selectPart = (key: string) =>
    setSelectedId(instances.find((i) => i.partKey === key)?.id ?? null);
  const toggleHidden = (key: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const save = () => {
    if (!result) return;
    const project = createCatalogProject(result);
    markRecent(model.slug);
    toast.success("Projeto criado em Meus projetos");
    nav({ to: "/projetos/$projectId", params: { projectId: project.id } });
  };

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SectionLabel>Parâmetros do projeto</SectionLabel>
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
                    setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }));
                    setSelectedId(null);
                  }}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono outline-none"
                />
                <span className="pr-2 text-muted-foreground">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>
        <Button
          className="mt-4"
          disabled={errors.length > 0 || !result}
          onClick={() => setGenerated(true)}
        >
          <Calculator />
          Calcular projeto
        </Button>
        {errors.length > 0 && (
          <p className="mt-2 text-xs text-destructive">
            Revise os parâmetros fora dos limites técnicos.
          </p>
        )}
      </Panel>

      {generated && result && (
        <>
          <Panel className="p-3">
            <div className="mb-3 flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider",
                    tab === t.key ? "bg-accent/15 text-accent" : "text-muted-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "2d" && (
              <TechnicalDrawing2D
                result={result}
                instances={instances}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
            {(tab === "3d" || tab === "explodida" || tab === "perspectiva") && (
              <ProjectModel3D
                key="viewer"
                instances={instances}
                selectedId={selectedId}
                onSelect={setSelectedId}
                hidden={hidden}
                exploded={tab === "explodida"}
                perspective={tab === "perspectiva"}
              />
            )}
            {tab === "detalhes" && (
              <ProjectBreakdown
                result={result}
                selectedPartKey={selectedPartKey}
                onSelectPart={selectPart}
              />
            )}
          </Panel>

          <Panel className="p-4">
            <SectionLabel>Árvore do projeto e propriedades</SectionLabel>
            <ProjectTreePanel
              result={result}
              instances={instances}
              selectedId={selectedId}
              onSelect={setSelectedId}
              hidden={hidden}
              onToggleHidden={toggleHidden}
            />
          </Panel>

          <Panel className="p-4">
            <SectionLabel>Resumo e decomposição</SectionLabel>
            <ProjectBreakdown
              result={result}
              selectedPartKey={selectedPartKey}
              onSelectPart={selectPart}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={save}>
                <Save />
                Criar meu projeto
              </Button>
              <Button variant="outline" onClick={() => setChamfer(true)}>
                <PenTool />
                Adicionar ao CHAMFER
              </Button>
            </div>
          </Panel>

          <SendToChamferDialog result={result} open={chamfer} onOpenChange={setChamfer} />
        </>
      )}
    </div>
  );
}
