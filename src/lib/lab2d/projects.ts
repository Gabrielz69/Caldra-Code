/**
 * Armazenamento local de projetos e planos do Laboratório 2D.
 * Funciona offline; o autosave grava a cada alteração relevante.
 */

import { DEFAULT_LAYERS, uid, type Entity, type Layer } from "./core";
import type { GroupDef } from "./groups";
import type { Dimension } from "./dimensions";
import { techColor } from "./technical";

const KEY = "caldra.lab2d.projects";
const LEGACY_KEY = "chameleon.lab2d.projects";

export type Plan = {
  id: string;
  name: string;
  entities: Entity[];
  visible: boolean;
  locked: boolean;
  /** Grupos do plano (Fase 2A) — a pertinência mora na entidade. */
  groups?: GroupDef[];
  /** Cotas associativas do plano — informação, nunca geometria de fabricação. */
  dims?: Dimension[];
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  plans: Plan[];
  lastPlanId: string;
  layers: Layer[];
  /** Espessura da chapa (mm) — usada pela vista 3D e pela fabricação. */
  thickness?: number;
};

export const DEFAULT_PLAN_THICKNESS = 3;

export const planLabel = (i: number) => `P${String(i + 1).padStart(2, "0")}`;

export function emptyPlan(index = 0): Plan {
  return {
    id: uid(),
    name: planLabel(index),
    entities: [],
    visible: true,
    locked: false,
    groups: [],
  };
}

export function sanitizeProject(p: Project): Project {
  const seenPlanIds = new Set<string>();
  const plans = (p.plans && p.plans.length > 0 ? p.plans : [emptyPlan(0)]).map((pl, idx) => {
    let planId = pl.id;
    if (!planId || planId === "draft" || planId.startsWith("draft-") || seenPlanIds.has(planId)) {
      planId = uid();
    }
    seenPlanIds.add(planId);

    const seenEntIds = new Set<string>();
    const entities = (pl.entities ?? []).map((ent) => {
      let entId = ent.id;
      if (!entId || entId === "draft" || entId.startsWith("draft-") || seenEntIds.has(entId)) {
        entId = uid();
      }
      seenEntIds.add(entId);
      return ent.id === entId ? ent : { ...ent, id: entId };
    });

    return {
      ...pl,
      id: planId,
      name: pl.name || planLabel(idx),
      entities,
    };
  });

  return {
    ...p,
    id: !p.id || p.id === "draft" || p.id.startsWith("draft-") ? uid() : p.id,
    plans,
    lastPlanId: plans.some((x) => x.id === p.lastPlanId) ? p.lastPlanId : plans[0]!.id,
    layers: (p.layers ?? DEFAULT_LAYERS).map((l) => ({ ...l, color: techColor(l.id) })),
  };
}

export function newProject(name: string, entities: Entity[] = []): Project {
  const plan = emptyPlan(0);
  const seenEntIds = new Set<string>();
  plan.entities = entities.map((ent) => {
    let entId = ent.id;
    if (!entId || entId === "draft" || entId.startsWith("draft-") || seenEntIds.has(entId)) {
      entId = uid();
    }
    seenEntIds.add(entId);
    return ent.id === entId ? ent : { ...ent, id: entId };
  });
  return {
    id: uid(),
    name: name.trim() || "Projeto",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    plans: [plan],
    lastPlanId: plan.id,
    layers: DEFAULT_LAYERS,
  };
}

export function listProjects(): Project[] {
  try {
    let raw = window.localStorage.getItem(KEY);
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_KEY);
      if (raw) {
        try {
          window.localStorage.setItem(KEY, raw);
        } catch {
          /* armazenamento indisponível */
        }
      }
    }
    if (!raw) return [];
    const list = JSON.parse(raw) as Project[];
    if (!Array.isArray(list)) return [];
    return list
      .map(sanitizeProject)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeAll(list: Project[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* armazenamento indisponível */
  }
}

export function getProject(id: string): Project | null {
  return listProjects().find((p) => p.id === id) ?? null;
}

export function saveProject(project: Project) {
  const list = listProjects().filter((p) => p.id !== project.id);
  writeAll([{ ...project, updatedAt: Date.now() }, ...list]);
}

export function deleteProject(id: string) {
  writeAll(listProjects().filter((p) => p.id !== id));
}

export function duplicateProject(id: string): Project | null {
  const src = getProject(id);
  if (!src) return null;
  const copy: Project = {
    ...structuredClone(src),
    id: uid(),
    name: `${src.name} (cópia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  copy.plans = copy.plans.map((p) => ({ ...p, id: uid() }));
  copy.lastPlanId = copy.plans[0]?.id ?? "";
  saveProject(copy);
  return copy;
}

export function renameProject(id: string, name: string) {
  const p = getProject(id);
  if (!p) return;
  saveProject({ ...p, name: name.trim() || p.name });
}

export const countEntities = (p: Project) =>
  p.plans.reduce((acc, pl) => acc + pl.entities.length, 0);
