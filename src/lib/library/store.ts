/**
 * Atalhos da biblioteca: FAVORITOS, RECENTES e MEUS MODELOS.
 *
 * Guardam apenas REFERÊNCIAS (`id` do registro) — nunca cópias da peça.
 * Persistência local, sem rastreamento: só o necessário para a experiência.
 */

import { useSyncExternalStore } from "react";
import type { PartModel } from "./registry";
import { findPart } from "./registry";

const KEY = "caldra.library.v1";
const MAX_RECENT = 12;

export type CustomModel = {
  /** id único do modelo do usuário. */
  id: string;
  /** referência ao modelo base do registro. */
  baseId: string;
  name: string;
  values?: Record<string, number>;
  modelFamily: "parametric" | "vector";
  manufacturingStrategy?: string;
  schemaVersion: 2;
  createdAt: number;
  updatedAt: number;
};

type State = {
  favorites: string[];
  recents: string[];
  custom: CustomModel[];
};

const EMPTY: State = { favorites: [], recents: [], custom: [] };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): State {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      state = {
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        recents: Array.isArray(parsed.recents) ? parsed.recents : [],
        custom: Array.isArray(parsed.custom)
          ? (parsed.custom.map((item) => ({
              ...item,
              modelFamily:
                item.modelFamily ??
                (String(item.baseId).startsWith("cnc.") ? "vector" : "parametric"),
              schemaVersion: 2,
              updatedAt: item.updatedAt ?? item.createdAt ?? Date.now(),
            })) as CustomModel[])
          : [],
      };
    }
  } catch {
    state = EMPTY;
  }
  return state;
}

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot(): State {
  return typeof window === "undefined" ? EMPTY : load();
}

export function useLibraryState(): State {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function toggleFavorite(id: string) {
  const s = load();
  const has = s.favorites.includes(id);
  commit({ ...s, favorites: has ? s.favorites.filter((f) => f !== id) : [id, ...s.favorites] });
}

export function markRecent(id: string) {
  if (typeof window === "undefined") return;
  const s = load();
  commit({ ...s, recents: [id, ...s.recents.filter((r) => r !== id)].slice(0, MAX_RECENT) });
}

export function saveCustom(
  model: Omit<CustomModel, "id" | "createdAt" | "updatedAt" | "schemaVersion">,
) {
  const s = load();
  const item: CustomModel = {
    ...model,
    id: `my.${Math.random().toString(36).slice(2, 9)}`,
    schemaVersion: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  commit({ ...s, custom: [item, ...s.custom] });
  return item;
}

export function updateCustom(id: string, patch: Pick<CustomModel, "name" | "values">) {
  const s = load();
  commit({
    ...s,
    custom: s.custom.map((item) =>
      item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item,
    ),
  });
}

export function getCustom(id: string): CustomModel | undefined {
  return load().custom.find((item) => item.id === id);
}

export function removeCustom(id: string) {
  const s = load();
  commit({ ...s, custom: s.custom.filter((c) => c.id !== id) });
}

/** Resolve um modelo do usuário para o modelo-base do registro. */
export function baseOf(custom: CustomModel): PartModel | undefined {
  return findPart(custom.baseId);
}
