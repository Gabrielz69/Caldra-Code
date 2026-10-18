/**
 * PAINEL PLANO DE CORTE — ordem, direção, ponto de partida, corte comum e grupos.
 * Toda alteração passa por `commit`, então undo/redo cobre tudo o que é feito aqui.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Boxes, Layers, Scissors, Trash2, Wand2 } from "lucide-react";

import type { Entity } from "@/lib/lab2d/core";
import {
  cutPaths,
  cutStats,
  isCutPath,
  moveCutBlock,
  moveCutPath,
  pathLength,
  reverseEntity,
  suggestSequence,
} from "@/lib/lab2d/cutPlan";
import {
  addToGroup,
  createGroup,
  dissolveGroup,
  membersOf,
  removeFromGroup,
  renameGroup,
  type GroupDef,
} from "@/lib/lab2d/groups";
import {
  DEFAULT_SHARE_TOL,
  applySharedCuts,
  detectSharedCuts,
  revalidateShared,
  type ShareCandidate,
  type ShareTol,
} from "@/lib/lab2d/sharedCut";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<Entity["type"], string> = {
  line: "Linha",
  polyline: "Polilinha",
  circle: "Círculo",
  arc: "Arco",
  path: "Curva",
  text: "Texto",
};

type Tab = "ordem" | "grupos";

export function CutPanel({
  entities,
  commit,
  selection,
  setSelection,
  groups,
  setGroups,
  onHighlight,
  onPickStart,
  startPicking,
}: {
  entities: Entity[];
  commit: (next: Entity[] | ((p: Entity[]) => Entity[])) => void;
  selection: string[];
  setSelection: (ids: string[]) => void;
  groups: GroupDef[];
  setGroups: (g: GroupDef[]) => void;
  onHighlight: (c: ShareCandidate | null) => void;
  onPickStart: () => void;
  startPicking: boolean;
}) {
  const [tab, setTab] = useState<Tab>("ordem");
  const [tol, setTol] = useState<ShareTol>(DEFAULT_SHARE_TOL);
  const [cands, setCands] = useState<ShareCandidate[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const cancelRef = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const paths = cutPaths(entities);
  const stats = cutStats(entities);

  useEffect(() => () => onHighlight(null), [onHighlight]);

  const groupOfId = (id: string) => entities.find((e) => e.id === id)?.group;

  const reverseSelected = () => {
    const ids = selection.length ? selection : [];
    if (!ids.length) {
      toast.info("Selecione um caminho para inverter.");
      return;
    }
    commit((list) => list.map((e) => (ids.includes(e.id) ? reverseEntity(e) : e)));
    toast.success("Direção invertida.");
  };

  const reverseAll = () => {
    if (!window.confirm("Inverter a direção de TODOS os caminhos de corte?")) return;
    commit((list) => list.map((e) => (isCutPath(e) ? reverseEntity(e) : e)));
    toast.success("Convenção do projeto invertida.");
  };

  const detect = useCallback(async () => {
    cancelRef.current = false;
    setProgress(0);
    setCands(null);
    const found = await detectSharedCuts(
      entities,
      tol,
      (r) => setProgress(r),
      () => cancelRef.current,
    );
    setProgress(null);
    setCands(found);
    if (!found.length) toast.info("Nenhum trecho comum encontrado com estas tolerâncias.");
  }, [entities, tol]);

  const confirm = (list: ShareCandidate[]) => {
    const res = applySharedCuts(entities, list);
    if (!res.applied) {
      toast.error("Trechos não puderam ser aplicados.");
      return;
    }
    commit(revalidateShared(res.entities, tol));
    setCands((c) => (c ? c.filter((x) => !list.includes(x)) : c));
    onHighlight(null);
    toast.success(
      `${res.applied} trecho(s) comum(ns) — economia de ${res.savedLength.toFixed(1)} mm de corte e ${res.savedPierces} perfuração(ões).`,
    );
  };

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const g = groupOfId(dragId);
    const block = g
      ? membersOf(entities, g)
          .filter(isCutPath)
          .map((e) => e.id)
      : [dragId];
    commit(moveCutBlock(entities, block, targetId));
    setDragId(null);
  };

  const num = (label: string, value: number, set: (n: number) => void, unit: string) => (
    <label className="flex items-center justify-between gap-1 py-0.5">
      <span className="font-mono text-[9px] text-muted-foreground uppercase">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(ev) =>
            Number.isFinite(Number(ev.target.value)) && set(Number(ev.target.value))
          }
          className="w-14 rounded-lg border border-line bg-background/40 px-1 py-0.5 text-right font-mono text-[10px] outline-none"
        />
        <span className="font-mono text-[8px] text-muted-foreground">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <TabBtn active={tab === "ordem"} onClick={() => setTab("ordem")} label="Ordem" />
        <TabBtn active={tab === "grupos"} onClick={() => setTab("grupos")} label="Grupos" />
      </div>

      {tab === "ordem" ? (
        <>
          <p className="font-mono text-[10px] text-muted-foreground">
            {stats.paths} caminhos · {stats.totalLength.toFixed(1)} mm · {stats.pierces} perfurações
          </p>

          <div className="flex flex-wrap gap-1">
            <SmallBtn label="Inverter" onClick={reverseSelected} icon={ArrowUp} />
            <SmallBtn label="Inverter tudo" onClick={reverseAll} icon={ArrowDown} />
            <SmallBtn
              label="Sugerir sequência"
              onClick={() => {
                commit(suggestSequence(entities));
                toast.success("Sequência sugerida — desfaça se preferir a sua.");
              }}
              icon={Wand2}
            />
            <SmallBtn
              label={startPicking ? "Clique no ponto…" : "Definir partida"}
              onClick={onPickStart}
              icon={Layers}
              active={startPicking}
            />
          </div>

          <ol className="max-h-52 space-y-0.5 overflow-y-auto">
            {paths.map((e, i) => {
              const g = e.group ? groups.find((x) => x.id === e.group) : null;
              return (
                <li
                  key={e.id}
                  draggable
                  onDragStart={() => setDragId(e.id)}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={() => drop(e.id)}
                  onClick={() => setSelection([e.id])}
                  className={cn(
                    "flex cursor-grab items-center gap-1 rounded-lg px-1 py-1 font-mono text-[10px]",
                    selection.includes(e.id) ? "bg-accent/15 text-accent" : "text-muted-foreground",
                  )}
                >
                  <span className="w-5 shrink-0 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {e.shared ? "Corte comum" : TYPE_LABEL[e.type]}
                    {e.invalid && " · INVÁLIDO"}
                    {g && ` · ${g.name}`}
                  </span>
                  <span className="shrink-0 tabular-nums">{pathLength(e).toFixed(1)}</span>
                  <button
                    aria-label="Subir"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      commit(moveCutPath(entities, e.id, -1));
                    }}
                    className="grid size-5 place-items-center hover:text-foreground"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    aria-label="Descer"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      commit(moveCutPath(entities, e.id, 1));
                    }}
                    className="grid size-5 place-items-center hover:text-foreground"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                </li>
              );
            })}
            {!paths.length && (
              <li className="font-mono text-[10px] text-muted-foreground">
                Nenhum caminho de corte.
              </li>
            )}
          </ol>

          <div className="border-t border-line pt-2">
            <p className="tick-label mb-1 text-muted-foreground">Corte comum</p>
            {num("Ângulo", tol.angleDeg, (n) => setTol({ ...tol, angleDeg: n }), "°")}
            {num("Afastam.", tol.gapMm, (n) => setTol({ ...tol, gapMm: n }), "mm")}
            {num("Mínimo", tol.minLenMm, (n) => setTol({ ...tol, minLenMm: n }), "mm")}
            <div className="mt-1 flex flex-wrap gap-1">
              <SmallBtn label="Detectar" onClick={detect} icon={Scissors} />
              {progress !== null && (
                <button
                  onClick={() => (cancelRef.current = true)}
                  className="rounded-lg border border-line px-1.5 py-1 font-mono text-[9px]"
                >
                  {Math.round(progress * 100)}% · cancelar
                </button>
              )}
              {cands && cands.length > 1 && (
                <SmallBtn label="Confirmar todos" onClick={() => confirm(cands)} icon={Scissors} />
              )}
            </div>
            {cands && (
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                {cands.map((c) => (
                  <li
                    key={c.id}
                    onMouseEnter={() => onHighlight(c)}
                    onMouseLeave={() => onHighlight(null)}
                    className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {c.kind === "arc" ? "Arco" : "Reta"} · {c.length.toFixed(1)} mm
                    </span>
                    <button
                      onClick={() => confirm([c])}
                      className="rounded-lg border border-line px-1.5 py-0.5 text-[9px] hover:text-accent"
                    >
                      Confirmar
                    </button>
                  </li>
                ))}
                {!cands.length && <li className="font-mono text-[10px]">Nada detectado.</li>}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            <SmallBtn
              label="Agrupar"
              icon={Boxes}
              onClick={() => {
                const res = createGroup(entities, selection, groups);
                if (!res) {
                  toast.info("Selecione 2 ou mais entidades.");
                  return;
                }
                commit(res.entities);
                setGroups(res.groups);
                toast.success("Grupo criado.");
              }}
            />
            <SmallBtn
              label="Adicionar"
              icon={Boxes}
              onClick={() => {
                const gid = selection.map(groupOfId).find(Boolean);
                if (!gid) {
                  toast.info("Selecione um membro de um grupo junto das novas peças.");
                  return;
                }
                commit(addToGroup(entities, selection, gid));
              }}
            />
            <SmallBtn
              label="Remover"
              icon={Trash2}
              onClick={() => {
                if (!selection.length) return;
                commit(removeFromGroup(entities, selection));
              }}
            />
          </div>
          <ul className="space-y-1">
            {groups.map((g) => {
              const members = membersOf(entities, g.id);
              return (
                <li key={g.id} className="rounded-lg border border-line px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      value={g.name}
                      onChange={(ev) => setGroups(renameGroup(groups, g.id, ev.target.value))}
                      aria-label="Nome do grupo"
                      className="min-w-0 flex-1 bg-transparent font-mono text-[10px] outline-none"
                    />
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {members.length}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button
                      onClick={() => setSelection(members.map((m) => m.id))}
                      className="rounded-lg border border-line px-1.5 py-0.5 font-mono text-[9px] hover:text-accent"
                    >
                      Selecionar
                    </button>
                    <button
                      onClick={() => {
                        const res = dissolveGroup(entities, groups, g.id);
                        commit(res.entities);
                        setGroups(res.groups);
                      }}
                      className="rounded-lg border border-line px-1.5 py-0.5 font-mono text-[9px] hover:text-accent"
                    >
                      Dissolver
                    </button>
                  </div>
                </li>
              );
            })}
            {!groups.length && (
              <li className="font-mono text-[10px] text-muted-foreground">Nenhum grupo.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-2 py-1 font-mono text-[9px] tracking-widest uppercase",
        active ? "bg-accent/15 text-accent" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SmallBtn({
  label,
  onClick,
  icon: Icon,
  active,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Boxes;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-line px-1.5 py-1 font-mono text-[9px]",
        active ? "text-accent" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}
