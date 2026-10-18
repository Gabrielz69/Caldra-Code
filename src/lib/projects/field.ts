/**
 * CAMPO / OBRA — Fase 12.
 *
 * Registro local (offline-first) do que acontece no local da instalação:
 *  - peças marcadas como INSTALADAS (com data e responsável);
 *  - OCORRÊNCIAS de campo (texto, foto opcional, peça relacionada).
 *
 * É deliberadamente LOCAL ao aparelho, como o checklist de montagem: não altera
 * o status de fabricação da peça no dossiê e não duplica nenhum motor.
 */

import { useSyncExternalStore } from "react";
import type { Project } from "./store";

export type FieldInstall = { at: number; by?: string | undefined };

export type FieldOccurrence = {
  id: string;
  at: number;
  /** peça relacionada (opcional: ocorrência geral da obra). */
  instanceId?: string | undefined;
  text: string;
  /** foto reduzida (dataURL jpeg) — opcional. */
  photo?: string | undefined;
  by?: string | undefined;
  resolved: boolean;
};

export type FieldRecord = {
  installed: Record<string, FieldInstall>;
  occurrences: FieldOccurrence[];
};

const KEY = "caldra.field.v1";
const EMPTY: FieldRecord = { installed: {}, occurrences: [] };

type State = Record<string, FieldRecord>;

let state: State = {};
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed && typeof parsed === "object") state = parsed;
    }
  } catch {
    state = {};
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento cheio ou indisponível — o estado em memória continua válido */
  }
  listeners.forEach((l) => l());
}

function recordOf(projectId: string): FieldRecord {
  load();
  return state[projectId] ?? EMPTY;
}

function write(projectId: string, next: FieldRecord) {
  state = { ...state, [projectId]: next };
  persist();
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

export function setInstalled(
  projectId: string,
  instanceId: string,
  installed: boolean,
  by?: string,
) {
  const rec = recordOf(projectId);
  const next = { ...rec.installed };
  if (installed) next[instanceId] = { at: Date.now(), by };
  else delete next[instanceId];
  write(projectId, { ...rec, installed: next });
}

export function toggleInstalled(projectId: string, instanceId: string, by?: string) {
  const rec = recordOf(projectId);
  setInstalled(projectId, instanceId, !rec.installed[instanceId], by);
}

export function addOccurrence(
  projectId: string,
  data: {
    text: string;
    instanceId?: string | undefined;
    photo?: string | undefined;
    by?: string | undefined;
  },
) {
  const rec = recordOf(projectId);
  const occ: FieldOccurrence = {
    id: `occ_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    text: data.text.trim(),
    instanceId: data.instanceId,
    photo: data.photo,
    by: data.by,
    resolved: false,
  };
  write(projectId, { ...rec, occurrences: [occ, ...rec.occurrences] });
  return occ;
}

export function toggleOccurrence(projectId: string, id: string) {
  const rec = recordOf(projectId);
  write(projectId, {
    ...rec,
    occurrences: rec.occurrences.map((o) => (o.id === id ? { ...o, resolved: !o.resolved } : o)),
  });
}

export function removeOccurrence(projectId: string, id: string) {
  const rec = recordOf(projectId);
  write(projectId, { ...rec, occurrences: rec.occurrences.filter((o) => o.id !== id) });
}

export function resetField(projectId: string) {
  write(projectId, { installed: {}, occurrences: [] });
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

export function useFieldRecord(projectId: string): FieldRecord {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => recordOf(projectId),
    () => EMPTY,
  );
}

export type FieldSummary = {
  total: number;
  installed: number;
  pending: number;
  pct: number;
  open: number;
};

/** Resumo de campo — função pura sobre o dossiê + registro local. */
export function fieldSummary(project: Project, rec: FieldRecord): FieldSummary {
  const total = project.parts.length;
  const installed = project.parts.filter((p) => !!rec.installed[p.instanceId]).length;
  const open = rec.occurrences.filter((o) => !o.resolved).length;
  return {
    total,
    installed,
    pending: Math.max(0, total - installed),
    pct: total ? Math.round((installed / total) * 100) : 0,
    open,
  };
}

/* ------------------------------------------------------------------ */
/* Foto — redução para caber no armazenamento local                    */
/* ------------------------------------------------------------------ */

/** Lê um arquivo de imagem e devolve um dataURL jpeg reduzido (máx. 900 px). */
export async function readPhoto(file: File, max = 900, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Falha ao ler a imagem"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Imagem inválida"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, max / Math.max(img.width, img.height) || 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
