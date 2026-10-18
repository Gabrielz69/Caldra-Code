/**
 * BACKUP .cal — exportação e importação de tudo o que é local.
 *
 * Esquema VERSIONADO: cada arquivo carrega `schema`, para que versões futuras
 * do app saibam migrar em vez de recusar. Nada de rede: o arquivo é gerado e
 * lido inteiramente no aparelho do usuário.
 *
 * Conteúdo: projetos do CHAMFER, materiais, preferências e perfil.
 * Fora do backup: plano/assinatura (mora na conta, nunca em arquivo) e fotos
 * de outras origens.
 */

import { listProjects, saveProject, type Project } from "@/lib/lab2d/projects";
import { loadMaterials, saveMaterial } from "@/lib/materials/store";
import type { Material } from "@/lib/materials/types";
import { APP_VERSION } from "@/lib/app/version";

export const BACKUP_SCHEMA = 1;

const SETTINGS_KEY = "caldra.settings";
const PROFILE_KEY = "caldra.profile.v1";

export type BackupFile = {
  kind: "caldra.backup";
  schema: number;
  appVersion: string;
  createdAt: number;
  projects: Project[];
  materials: Material[];
  settings: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
};

export type BackupSummary = {
  projects: number;
  materials: number;
  settings: boolean;
  profile: boolean;
  createdAt: number;
  appVersion: string;
};

export type ImportMode = "substituir" | "mesclar";

function readJson(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function buildBackup(): Promise<BackupFile> {
  const materials = await loadMaterials().catch(() => [] as Material[]);
  return {
    kind: "caldra.backup",
    schema: BACKUP_SCHEMA,
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    projects: listProjects(),
    materials,
    settings: readJson(SETTINGS_KEY),
    profile: readJson(PROFILE_KEY),
  };
}

export const backupFileName = (d = new Date()) =>
  `caldra-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}.cal`;

/** Gera o arquivo e dispara o download no navegador. */
export async function downloadBackup(): Promise<BackupSummary> {
  const data = await buildBackup();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(new Date(data.createdAt));
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return summarize(data);
}

export function summarize(b: BackupFile): BackupSummary {
  return {
    projects: b.projects.length,
    materials: b.materials.length,
    settings: !!b.settings,
    profile: !!b.profile,
    createdAt: b.createdAt,
    appVersion: b.appVersion,
  };
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; message: string };

/** Aceita o arquivo só quando ele é reconhecível e de um esquema suportado. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: "Arquivo ilegível. Escolha um backup .cal do CALDRA." };
  }
  const b = raw as Partial<BackupFile>;
  if (!b || b.kind !== "caldra.backup") {
    return { ok: false, message: "Este arquivo não é um backup do CALDRA." };
  }
  const schema = Number(b.schema);
  if (!Number.isFinite(schema) || schema < 1) {
    return { ok: false, message: "Backup sem versão reconhecida." };
  }
  if (schema > BACKUP_SCHEMA) {
    return {
      ok: false,
      message: "Este backup vem de uma versão mais nova do app. Atualize antes de importar.",
    };
  }
  return {
    ok: true,
    backup: {
      kind: "caldra.backup",
      schema,
      appVersion: String(b.appVersion ?? "?"),
      createdAt: Number(b.createdAt) || Date.now(),
      projects: Array.isArray(b.projects) ? (b.projects as Project[]) : [],
      materials: Array.isArray(b.materials) ? (b.materials as Material[]) : [],
      settings: (b.settings as Record<string, unknown> | null) ?? null,
      profile: (b.profile as Record<string, unknown> | null) ?? null,
    },
  };
}

const PROJECTS_KEY = "caldra.lab2d.projects";

/**
 * Aplica o backup.
 * - `substituir`: o conteúdo do aparelho passa a ser exatamente o do arquivo.
 * - `mesclar`: mantém o que existe; em conflito de id vence o mais recente.
 */
export async function applyBackup(b: BackupFile, mode: ImportMode): Promise<BackupSummary> {
  if (mode === "substituir") {
    try {
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(b.projects));
    } catch {
      /* armazenamento indisponível */
    }
  } else {
    const current = new Map(listProjects().map((p) => [p.id, p]));
    for (const p of b.projects) {
      const old = current.get(p.id);
      if (!old || (p.updatedAt ?? 0) >= (old.updatedAt ?? 0)) saveProject(p);
    }
  }

  for (const m of b.materials) {
    try {
      await saveMaterial(m);
    } catch {
      /* material inválido: segue com os demais */
    }
  }

  if (b.settings) {
    const base = mode === "mesclar" ? (readJson(SETTINGS_KEY) ?? {}) : {};
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...base, ...b.settings }));
    } catch {
      /* ignore */
    }
  }
  if (b.profile) {
    const base = mode === "mesclar" ? (readJson(PROFILE_KEY) ?? {}) : {};
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...base, ...b.profile }));
    } catch {
      /* ignore */
    }
  }

  return summarize(b);
}
