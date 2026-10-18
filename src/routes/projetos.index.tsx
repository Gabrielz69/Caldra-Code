import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProjectCatalog } from "@/components/projects/catalog/ProjectCatalog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, FolderKanban, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createProject,
  deleteProject,
  derivedStatus,
  duplicateProject,
  projectProgress,
  PROJECT_STATUS_LABEL,
  renameProject,
  useProjects,
  type Project,
} from "@/lib/projects/store";
import { formatDateTime } from "@/lib/projects/links";
import { FREE_PROJECT_LIMIT } from "@/lib/subscription/features";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { Panel } from "@/components/chameleon/ui";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projetos/")({
  head: () => ({
    meta: [
      { title: "Catálogo de Projetos — CALDRA" },
      {
        name: "description",
        content:
          "Escolha modelos paramétricos de caldeiraria ou acompanhe seus dossiês de fabricação.",
      },
      { property: "og:title", content: "Catálogo de Projetos — CALDRA" },
      {
        property: "og:description",
        content: "Cada projeto é um pacote de fabricação: peças, materiais, quantidades e entrega.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Projetos,
});

function Thumb({ seed }: { seed: number }) {
  const r = 12 + (seed % 3) * 4;
  return (
    <svg viewBox="0 0 56 56" className="size-full text-muted-foreground" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="6" y="6" width="44" height="44" rx="3" opacity=".35" />
        <circle cx="28" cy="28" r={r} />
        <circle cx="28" cy="28" r={r / 2.4} opacity=".6" />
        <path d="M6 28 H50 M28 6 V50" stroke="var(--accent)" strokeWidth=".5" opacity=".5" />
      </g>
    </svg>
  );
}

function Projetos() {
  const { isMestre, requirePro, projectLimit } = useFeatureAccess();
  const navigate = useNavigate();
  const projects = useProjects();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"catalogo" | "meus">("catalogo");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) =>
      [p.name, p.client, p.description, p.code ?? ""].some((f) => f.toLowerCase().includes(term)),
    );
  }, [projects, q]);

  const open = (id: string) => navigate({ to: "/projetos/$projectId", params: { projectId: id } });

  const startNew = () => {
    if (projects.length >= projectLimit) {
      requirePro("projects.unlimited");
      return;
    }
    setCreating(true);
  };

  return (
    <div className="space-y-5">
      <NavigationAreaHeader
        badgeText="GESTÃO DE OFICINA & ENGENHARIA"
        badgeColor="text-sky-500"
        indicatorColor="bg-sky-500"
        secondaryBadge={
          <span className="rounded bg-sky-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-sky-500 border border-sky-500/30">
            {isMestre ? "PRO · ILIMITADO" : `FREE · ATÉ ${projectLimit} PROJETOS`}
          </span>
        }
        title="Projetos"
        description="Modelos paramétricos de caldeiraria e acompanhamento de dossiês de fabricação."
        actions={
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 font-mono text-xs font-bold text-black shadow-md hover:bg-amber-400 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            <span>Novo Projeto</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 rounded-lg border border-line bg-background/40 p-1">
        <Button
          variant={tab === "catalogo" ? "default" : "ghost"}
          onClick={() => setTab("catalogo")}
        >
          Catálogo
        </Button>
        <Button variant={tab === "meus" ? "default" : "ghost"} onClick={() => setTab("meus")}>
          Meus projetos ({projects.length})
        </Button>
      </div>

      {tab === "catalogo" && <ProjectCatalog />}

      {tab === "meus" && projects.length > 3 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, cliente ou descrição..."
          className="w-full rounded-xl border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        />
      )}

      {tab === "meus" && (
        <div className="space-y-2">
          {list.map((p, i) => {
            const pct = projectProgress(p);
            const status = derivedStatus(p);
            return (
              <Panel key={p.id} className="metal overflow-hidden rounded-2xl">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3">
                  <button
                    onClick={() => open(p.id)}
                    aria-label={`Abrir ${p.name}`}
                    className="hairline size-12 shrink-0 rounded-xl p-1 transition-all duration-500 hover:bg-accent/8"
                  >
                    <Thumb seed={i} />
                  </button>
                  <button onClick={() => open(p.id)} className="min-w-0 text-left">
                    <span className="tick-label">
                      Projeto {String(i + 1).padStart(2, "0")} · {PROJECT_STATUS_LABEL[status]}
                    </span>
                    <p className="truncate font-display text-[15px] font-medium">{p.name}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {p.parts.length} peças
                      {p.client ? ` · ${p.client}` : ""} · {formatDateTime(p.updatedAt)}
                    </p>
                    <div className="mt-2 h-px w-full max-w-xs overflow-hidden bg-border">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[11px] text-accent">{pct}%</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label={`Ações de ${p.name}`}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-accent"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={() => open(p.id)}>
                          <FolderKanban className="size-3.5" /> Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setRenameValue(p.name);
                            setRenaming(p);
                          }}
                        >
                          <Pencil className="size-3.5" /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            const copy = duplicateProject(p.id);
                            if (copy) {
                              setRenameValue(copy.name);
                              setRenaming(copy);
                              toast.success("Projeto duplicado");
                            }
                          }}
                        >
                          <Copy className="size-3.5" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setDeleting(p)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Panel>
            );
          })}

          {!list.length && (
            <Panel className="p-8 text-center">
              <p className="t-subtitle">
                {projects.length ? "Nenhum projeto encontrado." : "Nenhum projeto ainda."}
              </p>
              <p className="t-caption mt-1">
                Crie um projeto para reunir todas as peças de um cliente, obra ou ordem de
                fabricação.
              </p>
              <button
                onClick={startNew}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent/12 px-4 py-2 font-mono text-[11px] tracking-wider text-accent uppercase ring-1 ring-accent/25"
              >
                <Plus className="size-3.5" /> Novo projeto
              </button>
            </Panel>
          )}

          {projects.length >= projectLimit && (
            <Panel className="flex items-center gap-3 p-4">
              <p className="text-[12px] text-muted-foreground">
                Você atingiu o limite de {FREE_PROJECT_LIMIT} projetos do plano Free.{" "}
                <button
                  onClick={() => requirePro("projects.unlimited")}
                  className="text-accent underline"
                >
                  Ir para o PRO
                </button>{" "}
                — tenha projetos ilimitados no CALDRA Pro.
              </p>
            </Panel>
          )}
        </div>
      )}

      <NewProjectDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(input) => {
          const p = createProject(input);
          setCreating(false);
          open(p.id);
        }}
      />

      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent className="w-[min(90vw,420px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Renomear projeto</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming) renameProject(renaming.id, renameValue);
              setRenaming(null);
            }}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="rounded-xl border border-line px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-accent/15 px-4 py-2 text-sm font-semibold text-accent ring-1 ring-accent/30"
              >
                Salvar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="w-[min(90vw,440px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Excluir projeto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Você está prestes a excluir <strong>“{deleting?.name}”</strong>.
          </p>
          <p className="t-caption">
            O projeto contém {deleting?.parts.length ?? 0} peças. Esta ação não poderá ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setDeleting(null)}
              className="rounded-xl border border-line px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (deleting) deleteProject(deleting.id);
                setDeleting(null);
                toast.success("Projeto excluído");
              }}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold",
                "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
              )}
            >
              Excluir projeto
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
