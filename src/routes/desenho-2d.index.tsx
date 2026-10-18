import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, FolderOpen, FolderPlus, Pencil, Plus, Search, Sliders, Trash2 } from "lucide-react";
import { FeatureGate } from "@/components/chameleon/ui";
import { ChamferProjectSettingsDialog } from "@/components/lab2d/ChamferProjectSettingsDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/ui/haptics";
import { takeHandoff } from "@/lib/lab2d/handoff";
import {
  countEntities,
  deleteProject,
  duplicateProject,
  listProjects,
  newProject,
  renameProject,
  saveProject,
  type Project,
} from "@/lib/lab2d/projects";

export const Route = createFileRoute("/desenho-2d/")({
  head: () => ({
    meta: [
      { title: "Projetos CHAMFER — CALDRA" },
      {
        name: "description",
        content:
          "Explorador de projetos do CHAMFER: planos, autosave local e abertura direta na prancheta vetorial.",
      },
      { property: "og:title", content: "Projetos CHAMFER — CALDRA" },
      {
        property: "og:description",
        content: "Organize projetos e planos de caldeiraria antes de desenhar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplorerPage,
});

function ExplorerPage() {
  return (
    <FeatureGate
      feature="lab2d"
      title="CHAMFER"
      description="A prancheta vetorial faz parte do Modo Mestre."
    >
      <Explorer />
    </FeatureGate>
  );
}

function Explorer() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");

  /* Modais de interação sem dependência de window.prompt / window.confirm */
  const [createOpen, setCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleting, setDeleting] = useState<Project | null>(null);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);

  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    const handoff = takeHandoff();
    if (handoff) {
      const p = newProject(handoff.name, handoff.entities);
      saveProject(p);
      toast.success(`${handoff.name} recebido da Traçagem.`);
      void navigate({ to: "/desenho-2d/$projectId", params: { projectId: p.id } });
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [projects, query],
  );

  const openCreateDialog = () => {
    triggerHaptic("tap");
    setNewProjectName(`Projeto ${String(projects.length + 1).padStart(2, "0")}`);
    setCreateOpen(true);
  };

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    triggerHaptic("action");
    const name = newProjectName.trim() || `Projeto ${String(projects.length + 1).padStart(2, "0")}`;
    const p = newProject(name);
    saveProject(p);
    setCreateOpen(false);
    toast.success(`Projeto "${p.name}" criado.`);
    void navigate({ to: "/desenho-2d/$projectId", params: { projectId: p.id } });
  };

  const handleRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!renaming) return;
    triggerHaptic("action");
    const name = renameValue.trim();
    if (name) {
      renameProject(renaming.id, name);
      toast.success("Projeto renomeado.");
      refresh();
    }
    setRenaming(null);
  };

  const handleDelete = () => {
    if (!deleting) return;
    triggerHaptic("warning");
    deleteProject(deleting.id);
    toast.success("Projeto excluído.");
    setDeleting(null);
    refresh();
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Projetos CHAMFER</h1>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            Prancheta vetorial CAD · Planos e Peças
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              setGlobalSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-2xl border border-line bg-background/60 px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors cursor-pointer"
            title="Configurações gerais do CHAMFER (salvamento automático, unidades, visualização)"
          >
            <Sliders className="size-3.5 text-accent" /> Configurações
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="brand-gradient flex items-center gap-1.5 rounded-2xl px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-background uppercase shadow-sm transition-transform active:scale-95 touch-manipulation cursor-pointer"
          >
            <Plus className="size-3.5" /> Adicionar Projeto
          </button>
        </div>
      </header>

      <label className="metal flex items-center gap-2 rounded-2xl px-3 py-2.5">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar projeto no CHAMFER"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="metal flex flex-col items-center justify-center rounded-3xl p-10 text-center">
          <FolderPlus className="mb-3 size-10 text-accent/60" />
          {projects.length === 0 ? (
            <>
              <h2 className="font-display text-base font-semibold">Nenhum projeto no CHAMFER ainda</h2>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Crie um projeto para desenhar chapas, traçar peças em milímetros com snap magnético e exportar arquivos DXF para corte a laser/plasma.
              </p>
              <button
                type="button"
                onClick={openCreateDialog}
                className="brand-gradient mt-5 flex items-center gap-2 rounded-2xl px-5 py-2.5 font-mono text-xs tracking-wider text-background uppercase shadow-md transition-transform active:scale-95 touch-manipulation cursor-pointer"
              >
                <Plus className="size-4" /> Adicionar Primeiro Projeto
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-base font-semibold">Nenhum projeto encontrado</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhum projeto corresponde ao termo de busca "{query}".
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery("")}
                className="mt-4"
              >
                Limpar busca
              </Button>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id} className="metal group rounded-2xl p-3 transition-all hover:amber-ring">
              <button
                onClick={() =>
                  navigate({ to: "/desenho-2d/$projectId", params: { projectId: p.id } })
                }
                className="flex w-full items-center gap-3 text-left touch-manipulation cursor-pointer"
              >
                <FolderOpen className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block font-mono text-[10px] tracking-wider text-muted-foreground">
                    {p.plans.length} {p.plans.length === 1 ? "plano" : "planos"} · {countEntities(p)} objetos ·{" "}
                    {p.thickness ? `${p.thickness} mm · ` : ""}
                    {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                  </span>
                </span>
              </button>
              <div className="mt-2 flex justify-end gap-1">
                <Action
                  label="Configurações do Projeto"
                  icon={Sliders}
                  onClick={() => {
                    triggerHaptic("tap");
                    setSettingsProject(p);
                  }}
                />
                <Action
                  label="Renomear"
                  icon={Pencil}
                  onClick={() => {
                    triggerHaptic("tap");
                    setRenameValue(p.name);
                    setRenaming(p);
                  }}
                />
                <Action
                  label="Duplicar"
                  icon={Copy}
                  onClick={() => {
                    triggerHaptic("tap");
                    duplicateProject(p.id);
                    refresh();
                    toast.success("Projeto duplicado.");
                  }}
                />
                <Action
                  label="Excluir"
                  icon={Trash2}
                  onClick={() => {
                    triggerHaptic("warning");
                    setDeleting(p);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* DIALOG DE CRIAÇÃO DE NOVO PROJETO CHAMFER */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[min(92vw,420px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Novo Projeto CHAMFER</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label htmlFor="chamfer-proj-name" className="t-eyebrow text-muted-foreground">
                Nome do projeto
              </label>
              <input
                id="chamfer-proj-name"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Ex.: Tubulação Caldeira 01"
                className="w-full rounded-xl border border-line bg-background/60 px-3 py-2 text-sm outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/40"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                <Plus className="size-4" /> Criar Projeto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE RENOMEAR */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="w-[min(92vw,400px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Renomear Projeto</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRename} className="space-y-4 pt-1">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full rounded-xl border border-line bg-background/60 px-3 py-2 text-sm outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/40"
            />
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(null)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE EXCLUSÃO */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="w-[min(92vw,420px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Excluir Projeto?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Deseja realmente excluir "{deleting?.name}"? Esta ação removerá os planos e geometrias salvas deste projeto localmente.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
            >
              Excluir Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChamferProjectSettingsDialog
        open={globalSettingsOpen || !!settingsProject}
        onOpenChange={(v) => {
          if (!v) {
            setGlobalSettingsOpen(false);
            setSettingsProject(null);
          }
        }}
        projectId={settingsProject?.id}
        projectName={settingsProject?.name}
      />
    </section>
  );
}

function Action({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-xl text-muted-foreground transition-all hover:text-accent active:scale-90 touch-manipulation cursor-pointer"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
