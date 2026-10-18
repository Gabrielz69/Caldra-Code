import type { GeometryResult } from "@/lib/geometry/types";
import { DEFAULT_LAYERS } from "@/lib/lab2d/core";
import { developmentToEntities, piecesToEntities } from "@/lib/lab2d/handoff";
import { downloadSheetPng, renderSheet, type SheetMeta, type SheetPlan } from "./renderSheet";

export function tracagemSheetPlan(result: GeometryResult, meta: SheetMeta): SheetPlan {
  const entities = result.pieces?.length
    ? piecesToEntities(result.pieces)
    : developmentToEntities(result.development);
  return renderSheet(entities, DEFAULT_LAYERS, meta, { dimensions: true, technicalColors: true });
}

export async function downloadTracagemPng(result: GeometryResult, meta: SheetMeta) {
  await downloadSheetPng(tracagemSheetPlan(result, meta));
}
