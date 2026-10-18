/**
 * MEUS MATERIAIS — persistência local offline-first (IndexedDB).
 * Sem rede, sem dependências. Fallback em memória quando IndexedDB
 * não está disponível (SSR ou navegador restrito).
 */

import { BUILTIN_MATERIALS, type Material } from "./types";

const DB_NAME = "caldra-materials";
const STORE = "materials";
const VERSION = 1;

let memory: Material[] | null = null;

function hasIDB() {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function mergeBuiltins(rows: Material[]): Material[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const b of BUILTIN_MATERIALS) if (!byId.has(b.id)) byId.set(b.id, { ...b });
  return [...byId.values()].sort(
    (a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name),
  );
}

export async function loadMaterials(): Promise<Material[]> {
  if (!hasIDB()) {
    memory = memory ?? BUILTIN_MATERIALS.map((m) => ({ ...m }));
    return mergeBuiltins(memory);
  }
  try {
    const rows =
      (await tx<Material[]>("readonly", (s) => s.getAll() as IDBRequest<Material[]>)) ?? [];
    const merged = mergeBuiltins(rows);
    if (rows.length === 0) for (const m of merged) await saveMaterial(m);
    return merged;
  } catch {
    memory = memory ?? BUILTIN_MATERIALS.map((m) => ({ ...m }));
    return mergeBuiltins(memory);
  }
}

export async function saveMaterial(material: Material): Promise<void> {
  if (!hasIDB()) {
    memory = memory ?? BUILTIN_MATERIALS.map((m) => ({ ...m }));
    const i = memory.findIndex((m) => m.id === material.id);
    if (i >= 0) memory[i] = material;
    else memory.push(material);
    return;
  }
  try {
    await tx("readwrite", (s) => s.put(material) as IDBRequest<IDBValidKey>);
  } catch {
    /* offline-first: falha silenciosa mantém o estado em memória */
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  if (id.startsWith("builtin:")) return; // padrões não são removíveis
  if (!hasIDB()) {
    memory = (memory ?? []).filter((m) => m.id !== id);
    return;
  }
  try {
    await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  } catch {
    /* ignora */
  }
}

export function newMaterial(): Material {
  return {
    id: `mat:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: "Novo material",
    density: 7850,
    pricePerKg: 10,
    thicknesses: [3],
    note: "",
    builtIn: false,
    hidden: false,
  };
}
