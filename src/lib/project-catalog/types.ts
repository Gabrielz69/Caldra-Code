import type { Entity } from "@/lib/lab2d/core";
import type { Vec3 } from "@/lib/geometry/types";

export type CatalogCategory =
  | "estruturas"
  | "escadas"
  | "plataformas"
  | "suportes"
  | "tubulacoes"
  | "caldeiraria"
  | "cnc"
  | "outros";
export type Complexity = "básico" | "intermediário" | "avançado";
export type DerivedKind = "2d" | "3d" | "bom" | "corte" | "cnc" | "documentacao" | "montagem";
export type ProjectParameter = {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
};
export type CanonicalBox = { min: Vec3; max: Vec3 };
export type CanonicalPart = {
  key: string;
  codeSuffix: string;
  name: string;
  quantity: number;
  material: string;
  thickness: number;
  role: string;
  assemblyKey: string;
  subassemblyKey?: string;
  stage: number;
  process: string;
  dimensions: { length: number; width: number; height: number };
  box: CanonicalBox;
  entities: Entity[];
  fabricable: boolean;
};
export type CanonicalAssembly = { key: string; name: string; code: string; order: number };
export type CanonicalSubassembly = {
  key: string;
  assemblyKey: string;
  name: string;
  code: string;
  order: number;
};
export type CanonicalStep = { key: string; title: string; detail: string; partKeys: string[] };
export type CanonicalDrawing = {
  width: number;
  height: number;
  entities: Entity[];
  dimensions: {
    label: string;
    value: number;
    a: { x: number; y: number };
    b: { x: number; y: number };
  }[];
};
export type CanonicalProject = {
  modelSlug: string;
  modelName: string;
  schemaVersion: 1;
  parameters: Record<string, number>;
  fingerprint: string;
  bounds: CanonicalBox;
  drawing: CanonicalDrawing;
  parts: CanonicalPart[];
  assemblies: CanonicalAssembly[];
  subassemblies: CanonicalSubassembly[];
  steps: CanonicalStep[];
  metrics: { label: string; value: number; unit: string }[];
  warnings: string[];
};
export type CatalogModel = {
  slug: string;
  name: string;
  category: CatalogCategory;
  description: string;
  complexity: Complexity;
  componentCount: string;
  applications: string[];
  materials: string[];
  type: string;
  parameters: ProjectParameter[];
  defaults: Record<string, number>;
  status: "pronto" | "em-breve";
  generate?: (values: Record<string, number>) => CanonicalProject;
};
