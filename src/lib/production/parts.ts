/**
 * PEÇAS DE PRODUÇÃO — extrai medidas reais dos planos do CHAMFER.
 * Funções puras: entram entidades, saem números em mm.
 */

import { bbox, type Entity } from "@/lib/lab2d/core";
import { cutPaths, pathLength } from "@/lib/lab2d/cutPlan";
import type { Project } from "@/lib/lab2d/projects";

export type ProductionPart = {
  id: string;
  name: string;
  /** Extensão real (mm). */
  w: number;
  h: number;
  /** Área do retângulo envolvente (mm²) — base conservadora do peso. */
  areaMm2: number;
  cutLengthMm: number;
  pierces: number;
  bends: number;
  quantity: number;
  allowRotate: boolean;
};

export function partFromEntities(id: string, name: string, entities: Entity[]): ProductionPart {
  const b = bbox(entities);
  const w = b ? b.maxX - b.minX : 0;
  const h = b ? b.maxY - b.minY : 0;
  const paths = cutPaths(entities);
  return {
    id,
    name,
    w,
    h,
    areaMm2: w * h,
    cutLengthMm: paths.reduce((a, e) => a + pathLength(e), 0),
    pierces: paths.length,
    bends: entities.filter((e) => e.layer === "dobra").length,
    quantity: 1,
    allowRotate: true,
  };
}

/** Um plano do projeto = uma peça de produção. Planos vazios são ignorados. */
export function partsFromProject(project: Project): ProductionPart[] {
  return project.plans
    .filter((p) => p.entities.length > 0)
    .map((p) =>
      partFromEntities(`${project.id}:${p.id}`, `${project.name} · ${p.name}`, p.entities),
    );
}

export const emptyPart = (name: string): ProductionPart => ({
  id: Math.random().toString(36).slice(2, 9),
  name,
  w: 500,
  h: 300,
  areaMm2: 150000,
  cutLengthMm: 1600,
  pierces: 1,
  bends: 0,
  quantity: 1,
  allowRotate: true,
});
