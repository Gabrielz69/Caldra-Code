import { findPart } from "@/lib/library/registry";

/** Resolve para qual tela de Traçagem uma peça de projeto abre. */
export type PartTarget = { kind: "parametric"; slug: string } | { kind: "cnc"; id: string } | null;

export function partTarget(modelId: string): PartTarget {
  const model = findPart(modelId);
  if (!model) return null;
  if (model.kind === "vector" && model.id.startsWith("cnc.")) {
    return { kind: "cnc", id: model.id.slice(4) };
  }
  if (model.engineSlug) return { kind: "parametric", slug: model.engineSlug };
  return null;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("pt-BR")} · ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
