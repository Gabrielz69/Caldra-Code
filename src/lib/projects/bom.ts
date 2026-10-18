/**
 * BOM — LISTA DE MATERIAIS E DE CORTE DO PROJETO.
 *
 * Fonte única: as peças do projeto (`project.parts`). Cada peça é resolvida
 * pelo mesmo registro de modelos e pelos mesmos motores já usados na Traçagem
 * (engines paramétricas) e no CNC 2D (geradores vetoriais). Nada é duplicado:
 * aqui só derivamos medidas, área, massa e custo. Funções puras.
 */

import { bbox, type Entity } from "@/lib/lab2d/core";
import { defaultValues, getGenerator } from "@/lib/cnc2d/generators";
import { getEngine } from "@/lib/geometry/engines";
import { findPart } from "@/lib/library/registry";
import type { Material } from "@/lib/materials/types";
import type { NestPart } from "@/lib/nesting/nesting";
import type { Project, ProjectPart } from "./store";

export type BomLine = {
  instanceId: string;
  code: string;
  name: string;
  modelName: string;
  assembly: string;
  material: string;
  materialId?: string | undefined;
  thickness: number;
  quantity: number;
  /** Extensão do desenvolvimento (mm). 0 quando não foi possível calcular. */
  w: number;
  h: number;
  /** Área desenvolvida real (mm²) — base da massa. */
  areaMm2: number;
  massUnitKg: number;
  massTotalKg: number;
  costTotal: number;
  /** Falso quando faltam parâmetros ou o modelo não expõe desenvolvimento. */
  resolved: boolean;
};

export type BomGroup = {
  key: string;
  material: string;
  thickness: number;
  lines: BomLine[];
  quantity: number;
  areaM2: number;
  massKg: number;
  cost: number;
};

export type ProjectBom = {
  lines: BomLine[];
  groups: BomGroup[];
  totalMassKg: number;
  totalAreaM2: number;
  totalCost: number;
  /** Peças sem medida calculada (faltam parâmetros). */
  pending: number;
};

type Shape = { w: number; h: number; areaMm2: number } | null;

function shapeFromEntities(entities: Entity[]): Shape {
  const b = bbox(entities);
  if (!b) return null;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (!(w > 0) || !(h > 0)) return null;
  return { w, h, areaMm2: w * h };
}

/** Desenvolvimento da peça: motor paramétrico ou gerador vetorial. */
export function partShape(part: ProjectPart): Shape {
  if (part.catalogPart) {
    const { length: w, width: h } = part.catalogPart.dimensions;
    return w > 0 && h > 0 ? { w, h, areaMm2: w * h } : null;
  }
  const model = findPart(part.modelId);
  if (!model) return null;
  try {
    if (model.kind === "parametric" && model.engineSlug) {
      const engine = getEngine(model.engineSlug);
      if (!engine) return null;
      const values = { ...engine.defaults, ...part.parameters };
      if (engine.validate(values).length > 0) return null;
      const res = engine.calculate(values);
      const b = res.development.bounds;
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      if (!(w > 0) || !(h > 0)) return null;
      return { w, h, areaMm2: res.areaMm2 > 0 ? res.areaMm2 : w * h };
    }
    if (model.generator) {
      const gen = getGenerator(model.generator);
      if (!gen) return null;
      const values = { ...defaultValues(gen), ...part.parameters };
      return shapeFromEntities(gen.build(values));
    }
  } catch {
    return null;
  }
  return null;
}

function materialOf(part: ProjectPart, materials: Material[]): Material | undefined {
  if (part.materialId) {
    const byId = materials.find((m) => m.id === part.materialId);
    if (byId) return byId;
  }
  const name = (part.material ?? "").trim().toLowerCase();
  return materials.find((m) => m.name.toLowerCase() === name);
}

/** Monta a lista de materiais do projeto. */
export function projectBom(project: Project, materials: Material[] = []): ProjectBom {
  const lines: BomLine[] = project.parts.map((part) => {
    const model = findPart(part.modelId);
    const shape = partShape(part);
    const mat = materialOf(part, materials);
    const density = mat?.density ?? 7850;
    const price = mat?.pricePerKg ?? 0;
    const areaMm2 = shape?.areaMm2 ?? 0;
    const massUnitKg = (areaMm2 * part.thickness * density) / 1e9;
    const quantity = Math.max(1, part.quantity);
    const assembly =
      project.subassemblies.find((s) => s.id === part.subassemblyId)?.name ??
      project.assemblies.find((a) => a.id === part.assemblyId)?.name ??
      "Sem conjunto";
    return {
      instanceId: part.instanceId,
      code: part.code,
      name: part.name,
      modelName: model?.name ?? "—",
      assembly,
      material: mat?.name ?? part.material,
      materialId: part.materialId,
      thickness: part.thickness,
      quantity,
      w: shape?.w ?? 0,
      h: shape?.h ?? 0,
      areaMm2,
      massUnitKg,
      massTotalKg: massUnitKg * quantity,
      costTotal: massUnitKg * quantity * price,
      resolved: !!shape,
    };
  });

  const map = new Map<string, BomGroup>();
  for (const l of lines) {
    const key = `${l.material}·${l.thickness}`;
    const g =
      map.get(key) ??
      ({
        key,
        material: l.material,
        thickness: l.thickness,
        lines: [],
        quantity: 0,
        areaM2: 0,
        massKg: 0,
        cost: 0,
      } satisfies BomGroup);
    g.lines.push(l);
    g.quantity += l.quantity;
    g.areaM2 += (l.areaMm2 * l.quantity) / 1e6;
    g.massKg += l.massTotalKg;
    g.cost += l.costTotal;
    map.set(key, g);
  }

  const groups = [...map.values()].sort(
    (a, b) => a.material.localeCompare(b.material, "pt-BR") || a.thickness - b.thickness,
  );

  return {
    lines,
    groups,
    totalMassKg: lines.reduce((s, l) => s + l.massTotalKg, 0),
    totalAreaM2: lines.reduce((s, l) => s + (l.areaMm2 * l.quantity) / 1e6, 0),
    totalCost: lines.reduce((s, l) => s + l.costTotal, 0),
    pending: lines.filter((l) => !l.resolved).length,
  };
}

/** Converte as linhas resolvidas em entradas de aninhamento. */
export function bomToNestParts(lines: BomLine[]): NestPart[] {
  return lines
    .filter((l) => l.resolved && l.w > 0 && l.h > 0)
    .map((l) => ({
      id: l.instanceId,
      name: `${l.code} · ${l.name}`,
      w: l.w,
      h: l.h,
      quantity: l.quantity,
      allowRotate: true,
    }));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV da lista de materiais (separador ";", padrão pt-BR). */
export function bomCsv(project: Project, bom: ProjectBom): string {
  const head = [
    "Codigo",
    "Peca",
    "Modelo",
    "Conjunto",
    "Material",
    "Espessura_mm",
    "Qtd",
    "Largura_mm",
    "Altura_mm",
    "Area_m2",
    "Massa_kg",
  ];
  const rows = bom.lines.map((l) =>
    [
      l.code,
      l.name,
      l.modelName,
      l.assembly,
      l.material,
      l.thickness.toFixed(2).replace(".", ","),
      l.quantity,
      l.w.toFixed(1).replace(".", ","),
      l.h.toFixed(1).replace(".", ","),
      ((l.areaMm2 * l.quantity) / 1e6).toFixed(3).replace(".", ","),
      l.massTotalKg.toFixed(2).replace(".", ","),
    ].map(csvCell),
  );
  return [
    `${csvCell(`Projeto: ${project.name} (${project.code ?? "—"}) REV ${project.revision}`)}`,
    head.join(";"),
    ...rows.map((r) => r.join(";")),
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL",
      bom.totalAreaM2.toFixed(3).replace(".", ","),
      bom.totalMassKg.toFixed(2).replace(".", ","),
    ].join(";"),
  ].join("\n");
}
