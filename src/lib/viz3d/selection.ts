/**
 * SELEÇÃO 3D ↔ REFERÊNCIA CANÔNICA (Fase F).
 *
 * Módulo puro: converte as marcas de geratriz do WireModel (`edgeTags` /
 * `faceTags`, apenas metadado) em `GeometryRef` estáveis do desenvolvimento,
 * e resolve hit-test de aresta/face em coordenadas de tela.
 *
 * Regra de correspondência: a geratriz k de n igualmente espaçadas coincide
 * com a dobra k·(folds/n) do desenvolvimento SOMENTE quando folds é múltiplo
 * exato de n. Caso contrário a aresta é "não mapeável" e a seleção cai em
 * fallback silencioso (null) — nunca destaca a entidade errada.
 */

import { foldRef, outlineRef, refId, refKind, type GeometryRef } from "@/lib/geometry/refs";
import type { GeratrizTag, WireModel, WireTag } from "./wire";
import type { ProjectedLine, ProjectedTriangle } from "./visibility";

/**
 * Converte uma marca de geratriz em ref de dobra, ou null se não mapeável.
 * O desenvolvimento fecha a chapa repetindo a geratriz 0 como emenda final,
 * portanto `foldCount` pode ser divisões ou divisões+1 — ambos exatos.
 */
export function refFromTag(tag: GeratrizTag | undefined, foldCount: number): GeometryRef | null {
  if (!tag || tag.n <= 0 || foldCount <= 0) return null;
  const divs =
    foldCount % tag.n === 0 ? foldCount : (foldCount - 1) % tag.n === 0 ? foldCount - 1 : 0;
  if (!divs) return null;
  const step = divs / tag.n;
  const k = ((tag.k % tag.n) + tag.n) % tag.n;
  return foldRef((k * step) % foldCount);
}

/**
 * Converte qualquer marca de entidade em ref canônica:
 * geratriz → dobra; aro de boca → contorno (0 = base, 1 = topo).
 */
export function refFromWireTag(tag: WireTag | undefined, foldCount: number): GeometryRef | null {
  if (!tag) return null;
  if ("rim" in tag) return outlineRef(tag.rim === "base" ? 0 : 1);
  return refFromTag(tag, foldCount);
}

/** Ref da aresta 3D `index`, dado o desenvolvimento (foldLines) atual. */
export function edgeRefAt(
  model: Pick<WireModel, "edgeTags">,
  foldCount: number,
  index: number,
): GeometryRef | null {
  return refFromWireTag(model.edgeTags?.[index], foldCount);
}

/** Ref da face 3D `index` (índice = prioridade estável da face). */
export function faceRefAt(
  model: Pick<WireModel, "faceTags">,
  foldCount: number,
  index: number,
): GeometryRef | null {
  return refFromWireTag(model.faceTags?.[index], foldCount);
}

/** Índice estável da entidade a partir do ID projetado ("edge:12" ou "edge:12:0-3"). */
export function entityIndexOf(id: string): number {
  const m = /:(\d+)/.exec(id);
  return m ? Number(m[1]) : -1;
}

/** Distância ponto–segmento em coordenadas de tela. */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Aresta mais próxima do ponto (x, y) dentro da tolerância `tol`.
 * Retorna o índice estável da aresta, ou null. Desempate: menor índice.
 */
export function pickEdgeIndex(
  lines: readonly ProjectedLine[],
  x: number,
  y: number,
  tol: number,
): number | null {
  let best: number | null = null;
  let bestDist = tol;
  for (const line of lines) {
    const d = pointToSegmentDistance(x, y, line.x1, line.y1, line.x2, line.y2);
    if (d > bestDist) continue;
    const index = entityIndexOf(line.id);
    if (index < 0) continue;
    if (d < bestDist || best === null || index < best) {
      best = index;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Face mais à frente sob o ponto (x, y): percorre os triângulos na ordem de
 * desenho e devolve a prioridade (índice da face) do último que o contém.
 */
export function pickFaceIndex(
  tris: readonly ProjectedTriangle[],
  x: number,
  y: number,
): number | null {
  for (let i = tris.length - 1; i >= 0; i--) {
    const [a, b, c] = tris[i]!.pts;
    if (pointInTriangle(x, y, a.x, a.y, b.x, b.y, c.x, c.y)) return tris[i]!.priority;
  }
  return null;
}

export function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
  const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(hasNeg && hasPos);
}

/** Rótulo textual da referência — o destaque nunca depende só de cor. */
export function refLabel(ref: GeometryRef): string {
  const kind = refKind(ref);
  const id = refId(ref);
  const num = Number(id);
  const ordinal = Number.isFinite(num) ? num + 1 : id;
  switch (kind) {
    case "fold":
      return `Geratriz ${ordinal}`;
    case "outline":
      return `Contorno ${ordinal}`;
    case "point":
      return `Ponto ${Number.isFinite(num) ? String.fromCharCode(65 + (num % 26)) : id}`;
    case "dim":
      return `Cota ${id}`;
    default:
      return ref;
  }
}
