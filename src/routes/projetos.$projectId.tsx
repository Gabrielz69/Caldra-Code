import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  Copy,
  GitBranch,
  Layers,
  MoreHorizontal,
  Pencil,
  PackageCheck,
  PenTool,
  Plus,
  Sliders,
  Trash2,
  Undo2,
} from "lucide-react";
import { ChamferProjectSettingsDialog } from "@/components/lab2d/ChamferProjectSettingsDialog";

import {
  addPart,
  assignPart,
  bumpPartRevision,
  derivedStatus,
  duplicatePart,
  markDelivered,
  partProgress,
  projectProgress,
  removePart,
  renamePart,
  setPartStatus,
  updatePart,
  updateProject,
  useProject,
  PART_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  type PartStatus,
  type ProjectPart,
} from "@/lib/projects/store";
import { formatDateTime, partTarget } from "@/lib/projects/links";
import { openPartInChamfer } from "@/lib/projects/chamfer";
import { findPart } from "@/lib/library/registry";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { AddPartDialog } from "@/components/projects/AddPartDialog";
import { AssemblyMode } from "@/components/projects/AssemblyMode";
import { AssemblyTree } from "@/components/projects/AssemblyTree";
import { ExplodedView } from "@/components/projects/ExplodedView";
import { FieldMode } from "@/components/projects/FieldMode";
import { BomPanel } from "@/components/projects/BomPanel";
import { FabricationPackage } from "@/components/projects/FabricationPackage";
import { ValidationPanel } from "@/components/projects/ValidationPanel";
import { CatalogRevisionPanel } from "@/components/projects/catalog/CatalogRevisionPanel";
import { CatalogProjectStudio } from "@/components/projects/catalog/CatalogProjectStudio";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projetos/$projectId")({
  validateSearch: (search: Record<string, unknown>): { peca?: string } =>
    typeof search["peca"] === "string" ? { peca: search["peca"] as string } : {},
  head: () => ({
    meta: [
      { title: "Projeto — CALDRA" },
      {
        name: "description",
        content: "Peças, materiais, quantidades e progresso de um serviço de caldeiraria.",
      },
      { property: "og:title", content: "Projeto — CALDRA" },
      {
        property: "og:description",
        content: "Acompanhe cada peça do serviço até a entrega.",
      },
    ],
  }),
  component: ProjectDetail,
});

const FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "andamento", label: "Em andamento" },
  { id: "finalizadas", label: "Finalizadas" },
  { id: "entregues", label: "Entregues" },
  { id: "rascunhos", label: "Rascunhos" },
] as const;

const SORTS = [
  { id: "sequencia", label: "Sequência" },
  { id: "nome", label: "Nome" },
  { id: "status", label: "Status" },
  { id: "alteracao", label: "Última alteração" },
  { id: "criacao", label: "Criação" },
] as const;

const STATUS_STYLE: Partial<Record<PartStatus, string>> = {
  calculada: "bg-accent/10 text-accent",
  rascunho: "bg-warn/10 text-warn",
  exportada: "bg-accent2/10 text-accent2",
  finalizada: "bg-accent/15 text-accent",
  entregue: "bg-accent/15 text-accent",
};

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { peca } = Route.useSearch();
  const project = useProject(projectId);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todas");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("sequencia");
  const [renaming, setRenaming] = useState<ProjectPart | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [removing, setRemoving] = useState<ProjectPart | null>(null);
  const [chamferSettingsOpen, setChamferSettingsOpen] = useState(false);

  const parts = useMemo(() => project?.parts ?? [], [project?.parts]);
  const visible = useMemo(() => {
    const filtered = parts.filter((p) => {
      if (filter === "todas") return true;
      if (filter === "finalizadas") return p.status === "finalizada";
      if (filter === "entregues") return p.status === "entregue";
      if (filter === "rascunhos") return p.status === "rascunho";
      return p.status !== "finalizada" && p.status !== "entregue" && p.status !== "rascunho";
    });
    const arr = [...filtered];
    if (sort === "nome") arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "status") arr.sort((a, b) => a.status.localeCompare(b.status));
    if (sort === "alteracao") arr.sort((a, b) => b.updatedAt - a.updatedAt);
    if (sort === "criacao") arr.sort((a, b) => a.createdAt - b.createdAt);
    return arr;
  }, [parts, filter, sort]);

  if (!project) {
    return (
      <Panel className="p-8 text-center">
        <p className="t-subtitle">Projeto não encontrado.</p>
        <Link to="/projetos" className="t-caption mt-2 inline-block text-accent underline">
          Voltar aos projetos
        </Link>
      </Panel>
    );
  }

  const pct = projectProgress(project);
  const status = derivedStatus(project);

  const openPart = (part: ProjectPart) => {
    if (part.catalogPart) {
      const labId = openPartInChamfer(project, part);
      navigate({ to: "/desenho-2d/$projectId", params: { projectId: labId } });
      return;
    }
    const target = partTarget(part.modelId);
    if (!target) {
      toast.error("Modelo desta peça não está disponível.");
      return;
    }
    if (target.kind === "parametric") {
      navigate({
        to: "/tracagem/$slug",
        params: { slug: target.slug },
        search: { projeto: project.id, peca: part.instanceId },
      });
    } else {
      navigate({
        to: "/tracagem/cnc/$id",
        params: { id: target.id },
        search: { projeto: project.id, peca: part.instanceId },
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/projetos"
          aria-label="Voltar aos projetos"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-accent"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <p className="t-eyebrow">Projetos / {project.name}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight lg:text-3xl">
            {project.name}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChamferSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 font-mono text-[10px] tracking-wider uppercase hover:border-accent hover:text-accent transition-colors"
              title="Configurações do CHAMFER para este projeto (salvamento, unidades, preferências)"
            >
              <Sliders className="size-3.5 text-accent" /> Configurações
            </button>
            <button
              onClick={() => markDelivered(project.id, !project.delivered)}
              className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 font-mono text-[10px] tracking-wider uppercase"
            >
              <PackageCheck className="size-3.5" />
              {project.delivered ? "Desfazer entrega" : "Marcar entregue"}
            </button>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-xl bg-accent/12 px-3 py-2 font-mono text-[10px] tracking-wider text-accent uppercase ring-1 ring-accent/25 transition-colors hover:bg-accent/20"
            >
              <Plus className="size-3.5" /> Peça
            </button>
          </div>
        </div>
      </div>

      <Panel className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Código" value={`${project.code ?? "—"} · REV ${project.revision}`} />
        <Info label="Cliente" value={project.client || "—"} />
        <Info label="Última modificação" value={formatDateTime(project.updatedAt)} />
        <Info label="Status" value={`${PROJECT_STATUS_LABEL[status]} · ${pct}%`} />
        {project.description && (
          <p className="t-caption sm:col-span-2 lg:col-span-4">{project.description}</p>
        )}
        <div className="h-px w-full overflow-hidden bg-border sm:col-span-2 lg:col-span-4">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </Panel>

      <CatalogRevisionPanel project={project} />

      <CatalogProjectStudio project={project} />

      <AssemblyTree project={project} onOpenPart={openPart} />

      <ExplodedView
        project={project}
        onOpenPart={(instanceId) => {
          const part = project.parts.find((p) => p.instanceId === instanceId);
          if (part) openPart(part);
        }}
      />

      <AssemblyMode
        project={project}
        onOpenPart={(instanceId) => {
          const part = project.parts.find((p) => p.instanceId === instanceId);
          if (part) openPart(part);
        }}
      />

      <FieldMode
        project={project}
        highlight={peca}
        onOpenPart={(instanceId) => {
          const part = project.parts.find((p) => p.instanceId === instanceId);
          if (part) openPart(part);
        }}
      />

      <BomPanel project={project} />

      <FabricationPackage project={project} />

      <ValidationPanel
        project={project}
        onOpenPart={(instanceId) => {
          const part = project.parts.find((p) => p.instanceId === instanceId);
          if (part) openPart(part);
        }}
      />

      <Panel className="p-4">
        <SectionLabel
          action={
            <button
              onClick={() => setAdding(true)}
              aria-label="Adicionar peça"
              className="grid size-7 place-items-center rounded-lg text-accent ring-1 ring-accent/25"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          Peças
        </SectionLabel>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase",
                filter === f.id
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-line text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Ordenar peças"
            className="ml-auto rounded-lg border border-line bg-background/60 px-2 py-1 font-mono text-[10px] tracking-wider uppercase"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="font-mono text-[10px] text-muted-foreground uppercase">
                <tr>
                  <th className="py-1.5 pr-3 font-normal">Peça</th>
                  <th className="py-1.5 pr-3 font-normal">Modelo</th>
                  <th className="py-1.5 pr-3 font-normal">Material</th>
                  <th className="py-1.5 pr-3 font-normal">Qtd</th>
                  <th className="py-1.5 pr-3 font-normal">Status</th>
                  <th className="py-1.5 font-normal" />
                </tr>
              </thead>
              <tbody>
                {visible.map((piece) => {
                  const model = findPart(piece.modelId);
                  const done = piece.status === "finalizada" || piece.status === "entregue";
                  return (
                    <tr
                      key={piece.instanceId}
                      className={cn(
                        "border-t border-line",
                        peca === piece.instanceId && "bg-accent/8 ring-1 ring-accent/30",
                      )}
                    >
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => openPart(piece)}
                          className="text-left hover:text-accent"
                        >
                          {piece.name}
                        </button>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {piece.code} · REV {piece.revision} ·{" "}
                          {project.assemblies.find((a) => a.id === piece.assemblyId)?.name ??
                            "sem conjunto"}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {partProgress(piece)}% · {formatDateTime(piece.updatedAt)}
                        </p>
                      </td>

                      <td className="py-2 pr-3 text-muted-foreground">{model?.name ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {piece.material} · {piece.thickness} mm
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        <input
                          type="number"
                          min={1}
                          value={piece.quantity}
                          onChange={(e) =>
                            updatePart(
                              project.id,
                              piece.instanceId,
                              { quantity: Math.max(1, Number(e.target.value) || 1) },
                              `${piece.name}: quantidade alterada`,
                            )
                          }
                          aria-label={`Quantidade de ${piece.name}`}
                          className="w-14 rounded border border-line bg-background/60 px-1.5 py-0.5 text-right font-mono text-[11px]"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[9px] uppercase",
                            STATUS_STYLE[piece.status] ?? "bg-foreground/10 text-muted-foreground",
                          )}
                        >
                          {PART_STATUS_LABEL[piece.status]}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              aria-label={`Ações de ${piece.name}`}
                              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-accent"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onSelect={() => openPart(piece)}>
                              <Pencil className="size-3.5" /> Abrir peça
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameValue(piece.name);
                                setRenaming(piece);
                              }}
                            >
                              <Pencil className="size-3.5" /> Renomear
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                const labId = openPartInChamfer(project, piece);
                                navigate({
                                  to: "/desenho-2d/$projectId",
                                  params: { projectId: labId },
                                });
                              }}
                            >
                              <PenTool className="size-3.5" /> Abrir no CHAMFER
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => duplicatePart(project.id, piece.instanceId)}
                            >
                              <Copy className="size-3.5" /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Layers className="size-3.5" /> Conjunto
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-52">
                                <DropdownMenuItem
                                  onSelect={() => assignPart(project.id, piece.instanceId)}
                                >
                                  Sem conjunto
                                </DropdownMenuItem>
                                {project.assemblies.map((asm) => (
                                  <DropdownMenuItem
                                    key={asm.id}
                                    onSelect={() =>
                                      assignPart(project.id, piece.instanceId, asm.id)
                                    }
                                  >
                                    {asm.name}
                                  </DropdownMenuItem>
                                ))}
                                {project.subassemblies.map((sub) => (
                                  <DropdownMenuItem
                                    key={sub.id}
                                    onSelect={() =>
                                      assignPart(
                                        project.id,
                                        piece.instanceId,
                                        sub.assemblyId,
                                        sub.id,
                                      )
                                    }
                                  >
                                    ↳ {sub.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                              onSelect={() => bumpPartRevision(project.id, piece.instanceId)}
                            >
                              <GitBranch className="size-3.5" /> Registrar nova revisão
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {done ? (
                              <DropdownMenuItem
                                onSelect={() =>
                                  setPartStatus(project.id, piece.instanceId, "calculada")
                                }
                              >
                                <Undo2 className="size-3.5" /> Desfazer finalização
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() =>
                                  setPartStatus(project.id, piece.instanceId, "finalizada")
                                }
                              >
                                <Check className="size-3.5" /> Finalizar peça
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={() =>
                                setPartStatus(project.id, piece.instanceId, "entregue")
                              }
                            >
                              <PackageCheck className="size-3.5" /> Marcar entregue
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setRemoving(piece)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" /> Remover do projeto
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="t-subtitle">
              Nenhuma peça {filter !== "todas" ? "neste filtro" : "ainda"}.
            </p>
            <p className="t-caption mt-1">
              Toque em + para escolher um modelo da Traçagem e adicioná-lo a este serviço.
            </p>
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <SectionLabel>Observações</SectionLabel>
        <textarea
          defaultValue={project.notes}
          onBlur={(e) =>
            e.target.value !== project.notes &&
            updateProject(project.id, { notes: e.target.value }, "Observações atualizadas")
          }
          placeholder="Anotações do serviço, combinações com o cliente, pendências..."
          className="min-h-20 w-full resize-y rounded-lg border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        />
      </Panel>

      {project.history.length > 0 && (
        <Panel className="p-4">
          <SectionLabel>Histórico</SectionLabel>
          <ul className="space-y-1.5">
            {project.history.slice(0, 12).map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex gap-3 text-[12px]">
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {formatDateTime(h.at)}
                </span>
                <span className="text-muted-foreground">{h.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AddPartDialog
        open={adding}
        onOpenChange={setAdding}
        onPick={(model) => {
          const part = addPart(project.id, { modelId: model.id });
          setAdding(false);
          if (part) openPart(part);
        }}
      />

      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent className="w-[min(90vw,420px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Renomear peça</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming) renamePart(project.id, renaming.instanceId, renameValue);
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

      <Dialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent className="w-[min(90vw,440px)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Remover peça?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">“{removing?.name}”</p>
          <p className="t-caption">
            Esta peça será removida deste projeto. O modelo continua disponível na biblioteca.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setRemoving(null)}
              className="rounded-xl border border-line px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (removing) removePart(project.id, removing.instanceId);
                setRemoving(null);
              }}
              className="rounded-xl bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive ring-1 ring-destructive/30"
            >
              Remover
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ChamferProjectSettingsDialog
        open={chamferSettingsOpen}
        onOpenChange={setChamferSettingsOpen}
        projectId={project.id}
        projectName={project.name}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="t-eyebrow">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}
