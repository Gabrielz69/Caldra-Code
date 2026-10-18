import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { deleteMaterial as dbDelete, loadMaterials, newMaterial, saveMaterial } from "./store";
import { DEFAULT_LOSS_PCT, DEFAULT_MATERIAL_ID, DEFAULT_THICKNESS, type Material } from "./types";

type Ctx = {
  materials: Material[];
  visible: Material[];
  ready: boolean;
  get: (id: string) => Material | undefined;
  upsert: (m: Material) => void;
  remove: (id: string) => void;
  create: () => Material;
  defaultMaterialId: string;
  defaultThickness: number;
  lossPct: number;
  setLossPct: (n: number) => void;
};

const MaterialsContext = createContext<Ctx | null>(null);

export function MaterialsProvider({ children }: { children: React.ReactNode }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [ready, setReady] = useState(false);
  const [lossPct, setLossPct] = useState(DEFAULT_LOSS_PCT);

  useEffect(() => {
    let alive = true;
    loadMaterials().then((rows) => {
      if (!alive) return;
      setMaterials(rows);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const upsert = useCallback((m: Material) => {
    setMaterials((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i < 0) return [...prev, m];
      const next = [...prev];
      next[i] = m;
      return next;
    });
    void saveMaterial(m);
  }, []);

  const remove = useCallback((id: string) => {
    if (id.startsWith("builtin:")) return;
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    void dbDelete(id);
  }, []);

  const create = useCallback(() => {
    const m = newMaterial();
    upsert(m);
    return m;
  }, [upsert]);

  const value = useMemo<Ctx>(
    () => ({
      materials,
      visible: materials.filter((m) => !m.hidden),
      ready,
      get: (id) => materials.find((m) => m.id === id),
      upsert,
      remove,
      create,
      defaultMaterialId: DEFAULT_MATERIAL_ID,
      defaultThickness: DEFAULT_THICKNESS,
      lossPct,
      setLossPct,
    }),
    [materials, ready, upsert, remove, create, lossPct],
  );

  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>;
}

export function useMaterials(): Ctx {
  const ctx = useContext(MaterialsContext);
  if (!ctx) throw new Error("useMaterials deve ser usado dentro de MaterialsProvider.");
  return ctx;
}
