import type { DevelopmentPattern } from "@/lib/geometry/types";
import { uid, type Entity } from "./core";

const KEY = "caldra.lab2d.handoff";
const LEGACY_KEY = "chameleon.lab2d.handoff";

export type Handoff = { name: string; entities: Entity[] };

/** Converte um desenvolvimento calculado na Traçagem em entidades editáveis. */
export function developmentToEntities(dev: DevelopmentPattern): Entity[] {
  const out: Entity[] = [
    {
      id: uid(),
      layer: "corte",
      type: "polyline",
      closed: true,
      pts: dev.outline.map((p) => ({ x: p.x, y: p.y })),
    },
  ];
  for (const f of dev.foldLines)
    out.push({
      id: uid(),
      layer: "dobra",
      type: "line",
      x1: f.a.x,
      y1: f.a.y,
      x2: f.b.x,
      y2: f.b.y,
    });
  return out;
}

export function sendToLab2D(payload: Handoff) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage indisponível */
  }
}

export function takeHandoff(): Handoff | null {
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
    return JSON.parse(raw) as Handoff;
  } catch {
    return null;
  }
}

/**
 * Envia várias peças (gomos de uma curva, ramal + furo) lado a lado,
 * preservando a geometria vetorial real — nunca imagem.
 */
export function piecesToEntities(
  pieces: { code: string; development: DevelopmentPattern }[],
  gap = 40,
): Entity[] {
  const out: Entity[] = [];
  let cursor = 0;
  for (const piece of pieces) {
    const b = piece.development.bounds;
    const dx = cursor - b.minX;
    for (const e of developmentToEntities(piece.development)) {
      if (e.type === "polyline")
        out.push({ ...e, pts: e.pts.map((p) => ({ x: p.x + dx, y: p.y })) });
      else if (e.type === "line") out.push({ ...e, x1: e.x1 + dx, x2: e.x2 + dx });
      else out.push(e);
    }
    cursor += b.maxX - b.minX + gap;
  }
  return out;
}
