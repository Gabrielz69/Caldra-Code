export type Material = {
  id: string;
  name: string;
  /** Densidade em kg/m³ (ex.: aço carbono = 7850). */
  density: number;
  /** Preço em R$/kg. */
  pricePerKg: number;
  /** Espessuras comerciais em mm. */
  thicknesses: number[];
  note: string;
  /** Padrão de fábrica: editável e ocultável, nunca removível. */
  builtIn: boolean;
  hidden: boolean;
};

/** Espessuras comerciais padrão (mm). */
export const DEFAULT_THICKNESSES = [1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 4.75, 6.0, 8.0, 10.0, 12.0];

export const BUILTIN_MATERIALS: Material[] = [
  { name: "Aço Carbono", density: 7850, pricePerKg: 9.5 },
  { name: "Inox 304", density: 7900, pricePerKg: 42 },
  { name: "Alumínio", density: 2700, pricePerKg: 38 },
  { name: "Galvanizado", density: 7850, pricePerKg: 12 },
  { name: "Latão", density: 8500, pricePerKg: 55 },
].map((m) => ({
  id: `builtin:${m.name.toLowerCase().replace(/\s+/g, "-")}`,
  name: m.name,
  density: m.density,
  pricePerKg: m.pricePerKg,
  thicknesses: [...DEFAULT_THICKNESSES],
  note: "",
  builtIn: true,
  hidden: false,
}));

export const DEFAULT_MATERIAL_ID = BUILTIN_MATERIALS[0]!.id;
export const DEFAULT_THICKNESS = 3;
export const DEFAULT_LOSS_PCT = 10;
