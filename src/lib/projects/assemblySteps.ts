/**
 * MODO MONTAGEM — roteiro de montagem derivado da estrutura do dossiê.
 *
 * A sequência sai da MESMA árvore CONJUNTO → SUBCONJUNTO → PEÇA já existente:
 * subconjuntos primeiro, depois a integração no conjunto, por fim a conferência
 * geral. A conclusão de cada passo é local ao aparelho (checklist de oficina) e
 * não altera o status de fabricação das peças.
 */

import { useSyncExternalStore } from "react";
import type { Project } from "./store";

export type AssemblyStep = {
  id: string;
  index: number;
  kind: "subconjunto" | "conjunto" | "integracao" | "final";
  title: string;
  detail: string;
  /** peças envolvidas (para abrir direto do passo). */
  parts: { instanceId: string; code: string; name: string; quantity: number }[];
};

/** Roteiro determinístico de montagem. Função pura. */
export function assemblySteps(project: Project): AssemblyStep[] {
  if (project.catalogSource?.steps.length) {
    const byKey = new Map(project.parts.map((p) => [p.catalogPart?.key, p]));
    return project.catalogSource.steps.map((step, index) => ({
      id: `catalog_${step.key}`,
      index: index + 1,
      kind: index === project.catalogSource!.steps.length - 1 ? "final" : "conjunto",
      title: step.title,
      detail: step.detail,
      parts: step.partKeys.flatMap((key) => {
        const p = byKey.get(key);
        return p
          ? [
              {
                instanceId: p.instanceId,
                code: p.code,
                name: p.name,
                quantity: Math.max(1, p.quantity),
              },
            ]
          : [];
      }),
    }));
  }
  const steps: AssemblyStep[] = [];
  const push = (s: Omit<AssemblyStep, "index">) => steps.push({ ...s, index: steps.length + 1 });
  const mapParts = (list: Project["parts"]) =>
    list.map((p) => ({
      instanceId: p.instanceId,
      code: p.code,
      name: p.name,
      quantity: Math.max(1, p.quantity),
    }));

  for (const asm of project.assemblies) {
    const subs = project.subassemblies.filter((s) => s.assemblyId === asm.id);
    for (const sub of subs) {
      const sp = project.parts.filter((p) => p.subassemblyId === sub.id);
      if (!sp.length) continue;
      push({
        id: `sub_${sub.id}`,
        kind: "subconjunto",
        title: `Montar ${sub.name}`,
        detail: `${asm.name} · ${sp.length} peça(s): posicionar, ponteia e conferir esquadro antes de soldar.`,
        parts: mapParts(sp),
      });
    }
    const direct = project.parts.filter((p) => p.assemblyId === asm.id && !p.subassemblyId);
    if (direct.length) {
      push({
        id: `asm_${asm.id}`,
        kind: "conjunto",
        title: `Montar ${asm.name}`,
        detail: `${direct.length} peça(s) diretas: seguir a ordem de posição e conferir alinhamento.`,
        parts: mapParts(direct),
      });
    }
    if (subs.length && (direct.length || subs.length > 1)) {
      push({
        id: `int_${asm.id}`,
        kind: "integracao",
        title: `Integrar subconjuntos em ${asm.name}`,
        detail: "Unir os subconjuntos ao conjunto, conferir prumo, nível e diagonais.",
        parts: [],
      });
    }
  }

  const loose = project.parts.filter((p) => !p.assemblyId && !p.subassemblyId);
  if (loose.length) {
    push({
      id: "avulsas",
      kind: "conjunto",
      title: "Peças avulsas",
      detail: `${loose.length} peça(s) sem conjunto: definir posição antes da montagem final.`,
      parts: mapParts(loose),
    });
  }

  if (steps.length) {
    push({
      id: "final",
      kind: "final",
      title: "Conferência final e acabamento",
      detail: "Conferir medidas gerais, soldas, furação de fixação e identificação das peças.",
      parts: [],
    });
  }
  return steps;
}

/* ------------------------------------------------------------------ */
/* Progresso local do checklist                                        */
/* ------------------------------------------------------------------ */

const KEY = "caldra.assembly.progress.v1";

type Done = Record<string, string[]>;

let state: Done = {};
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Done;
  } catch {
    state = {};
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}

const EMPTY: string[] = [];

function snapshot(projectId: string): string[] {
  load();
  return state[projectId] ?? EMPTY;
}

export function toggleAssemblyStep(projectId: string, stepId: string) {
  load();
  const current = state[projectId] ?? [];
  state = {
    ...state,
    [projectId]: current.includes(stepId)
      ? current.filter((s) => s !== stepId)
      : [...current, stepId],
  };
  persist();
}

export function resetAssemblyProgress(projectId: string) {
  load();
  state = { ...state, [projectId]: [] };
  persist();
}

export function useAssemblyProgress(projectId: string): string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot(projectId),
    () => EMPTY,
  );
}
