/**
 * CHAMFER — MODO PROJETO (Fase 5).
 *
 * Liga uma PEÇA do dossiê a um projeto do CHAMFER, sem duplicar motores:
 * a geometria inicial vem das mesmas engines paramétricas / geradores CNC 2D
 * já usados na Traçagem e na BOM. Depois de criado, o desenho é editável no
 * CHAMFER e permanece vinculado à peça (ida e volta pelo dossiê).
 */

import { getGenerator, defaultValues } from "@/lib/cnc2d/generators";
import { getEngine } from "@/lib/geometry/engines";
import { findPart } from "@/lib/library/registry";
import type { Entity } from "@/lib/lab2d/core";
import { developmentToEntities } from "@/lib/lab2d/handoff";
import {
  getProject as getLabProject,
  listProjects as listLabProjects,
  newProject as newLabProject,
  saveProject as saveLabProject,
} from "@/lib/lab2d/projects";
import { listProjects, updatePart, type Project, type ProjectPart } from "./store";

/** Geometria inicial da peça (mm), ou null quando faltam parâmetros. */
export function partEntities(part: ProjectPart): Entity[] | null {
  if (part.catalogPart?.fabricable && part.catalogPart.entities.length) {
    return structuredClone(part.catalogPart.entities);
  }
  const model = findPart(part.modelId);
  if (!model) return null;
  try {
    if (model.kind === "parametric" && model.engineSlug) {
      const engine = getEngine(model.engineSlug);
      if (!engine) return null;
      const values = { ...engine.defaults, ...part.parameters };
      if (engine.validate(values).length > 0) return null;
      const entities = developmentToEntities(engine.calculate(values).development);
      return entities.length ? entities : null;
    }
    if (model.generator) {
      const gen = getGenerator(model.generator);
      if (!gen) return null;
      const entities = gen.build({ ...defaultValues(gen), ...part.parameters });
      return entities.length ? entities : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type ChamferLink = { projectId: string; instanceId: string };

/** Dossiê/peça vinculados a um projeto do CHAMFER (para o cabeçalho do editor). */
export function findChamferLink(labProjectId: string): ChamferLink | null {
  for (const project of listProjects()) {
    const part = project.parts.find((p) => p.chamferProjectId === labProjectId);
    if (part) return { projectId: project.id, instanceId: part.instanceId };
  }
  return null;
}

/**
 * Abre (ou cria) o desenho CHAMFER da peça e devolve o id do projeto do editor.
 * Reaproveita o desenho existente — nunca sobrescreve o que já foi editado.
 */
export function openPartInChamfer(project: Project, part: ProjectPart): string {
  const existing = part.chamferProjectId ? getLabProject(part.chamferProjectId) : null;
  if (existing) return existing.id;

  const name = `${part.code || part.name} · ${project.code ?? project.name}`;
  const byName = listLabProjects().find((p) => p.name === name);
  const lab = byName ?? newLabProject(name, partEntities(part) ?? []);
  if (!byName) saveLabProject(lab);

  updatePart(
    project.id,
    part.instanceId,
    { chamferProjectId: lab.id },
    `${part.name}: desenho aberto no CHAMFER`,
  );
  return lab.id;
}
