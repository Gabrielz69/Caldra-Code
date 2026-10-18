/**
 * INVALIDAÇÃO DE DERIVADOS.
 *
 * Alterar espessura, raio, ângulo, Fator K ou método de desenvolvimento
 * desatualiza os produtos derivados. A regeneração é explícita: nada aqui
 * recalcula sozinho, apenas informa o que deixou de valer.
 */

import type { Bend, FabricationConfig } from "./types";

export type Derivative = "2d" | "3d" | "planificacao" | "chamfer" | "cnc" | "documentos" | "bom";

export const ALL_DERIVATIVES: readonly Derivative[] = [
  "2d",
  "3d",
  "planificacao",
  "chamfer",
  "cnc",
  "documentos",
  "bom",
] as const;

export const DERIVATIVE_LABELS: Record<Derivative, string> = {
  "2d": "Desenho 2D",
  "3d": "Visualização 3D",
  planificacao: "Planificação",
  chamfer: "CHAMFER",
  cnc: "CNC",
  documentos: "Documentos",
  bom: "Lista de material e corte",
};

export type FabricationSnapshot = {
  config: FabricationConfig;
  bends: Bend[];
};

export type FabricationChange =
  "thickness" | "method" | "kFactor" | "angle" | "insideRadius" | "bendSet";

function bendKey(b: Bend): string {
  return `${b.angleDeg}|${b.insideRadius}|${b.kFactor ?? "-"}`;
}

/** O que mudou entre duas revisões de fabricação. */
export function diffFabrication(
  prev: FabricationSnapshot,
  next: FabricationSnapshot,
): FabricationChange[] {
  const changes = new Set<FabricationChange>();
  if (prev.config.thickness !== next.config.thickness) changes.add("thickness");
  if (prev.config.method !== next.config.method) changes.add("method");
  if (prev.config.defaultKFactor !== next.config.defaultKFactor) changes.add("kFactor");

  const prevById = new Map(prev.bends.map((b) => [b.bendId, b]));
  const nextById = new Map(next.bends.map((b) => [b.bendId, b]));
  if (prev.bends.length !== next.bends.length) changes.add("bendSet");

  for (const [id, nb] of nextById) {
    const pb = prevById.get(id);
    if (!pb) {
      changes.add("bendSet");
      continue;
    }
    if (pb.angleDeg !== nb.angleDeg) changes.add("angle");
    if (pb.insideRadius !== nb.insideRadius) changes.add("insideRadius");
    if (pb.kFactor !== nb.kFactor) changes.add("kFactor");
    if (bendKey(pb) !== bendKey(nb)) changes.add("bendSet");
  }
  for (const id of prevById.keys()) if (!nextById.has(id)) changes.add("bendSet");

  return [...changes];
}

/** Derivados desatualizados por uma mudança de fabricação. */
export function staleDerivatives(changes: FabricationChange[]): Derivative[] {
  if (changes.length === 0) return [];
  return [...ALL_DERIVATIVES];
}
