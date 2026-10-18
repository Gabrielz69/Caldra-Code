/**
 * REFERÊNCIAS ESTÁVEIS DE GEOMETRIA.
 *
 * Toda entidade do desenvolvimento calculado ganha um identificador estável
 * (`outline:3`, `fold:7`, `point:A`, `dim:h`). Nada aqui calcula geometria:
 * são apenas ponteiros para o que o motor paramétrico já produziu.
 */

import type { DevelopmentPattern } from "./types";

export type GeometryRef = string;

export const outlineRef = (i: number): GeometryRef => `outline:${i}`;
export const foldRef = (i: number): GeometryRef => `fold:${i}`;
export const pointRef = (id: string): GeometryRef => `point:${id}`;
export const dimRef = (field: string): GeometryRef => `dim:${field}`;

export type RefKind = "outline" | "fold" | "point" | "dim";

export function refKind(ref: GeometryRef): RefKind | null {
  const kind = ref.split(":")[0];
  return kind === "outline" || kind === "fold" || kind === "point" || kind === "dim" ? kind : null;
}

export function refId(ref: GeometryRef): string {
  return ref.slice(ref.indexOf(":") + 1);
}

/** Todas as referências existentes num desenvolvimento. */
export function developmentRefs(dev: DevelopmentPattern): GeometryRef[] {
  return [
    ...dev.outline.map((_, i) => outlineRef(i)),
    ...dev.foldLines.map((_, i) => foldRef(i)),
    ...dev.points.map((p) => pointRef(p.id)),
  ];
}

/** A referência aponta para uma entidade real? Cotas são sempre válidas. */
export function refExists(dev: DevelopmentPattern, ref: GeometryRef): boolean {
  const kind = refKind(ref);
  const id = refId(ref);
  if (kind === "dim") return id.length > 0;
  if (kind === "outline") {
    const i = Number(id);
    return Number.isInteger(i) && i >= 0 && i < dev.outline.length;
  }
  if (kind === "fold") {
    const i = Number(id);
    return Number.isInteger(i) && i >= 0 && i < dev.foldLines.length;
  }
  if (kind === "point") return dev.points.some((p) => p.id === id);
  return false;
}

/** Nível de destaque temporário. Nunca substitui a cor técnica da entidade. */
export type HighlightLevel = "normal" | "focus" | "isolated";

export type HighlightState = {
  refs: GeometryRef[];
  level: HighlightLevel;
  /** Intensidade extra para baixa acuidade visual (1 = padrão). */
  intensity?: number;
  /** Rótulo textual — o destaque nunca depende só de cor. */
  label?: string;
};

export const NO_HIGHLIGHT: HighlightState = { refs: [], level: "normal" };

/**
 * Vínculo CAMPO → COTA → ENTIDADE.
 * O campo aponta para a sua cota e para as entidades geométricas associadas.
 */
export function fieldRefs(
  field: string,
  dev: DevelopmentPattern | null | undefined,
  extra: GeometryRef[] = [],
): GeometryRef[] {
  const refs: GeometryRef[] = [dimRef(field)];
  for (const r of extra) if (!refs.includes(r) && (!dev || refExists(dev, r))) refs.push(r);
  return refs;
}

/** O destaque está ativo para esta entidade? */
export function isHighlighted(state: HighlightState, ref: GeometryRef): boolean {
  return state.level !== "normal" && state.refs.includes(ref);
}

/** Opacidade das entidades NÃO destacadas — atenua, nunca destrói. */
export function dimFactor(state: HighlightState): number {
  if (state.level === "isolated") return 0.18;
  if (state.level === "focus") return 0.5;
  return 1;
}

/**
 * Entidades associadas a uma cota do desenho (h, d1, d2, e...).
 * Mapa de LEITURA: não cria geometria, apenas escolhe o que destacar.
 */
export function refsForDim(
  dim: string | null | undefined,
  dev: DevelopmentPattern | null | undefined,
): GeometryRef[] {
  if (!dev) return [];
  const folds = dev.foldLines.map((_, i) => foldRef(i));
  const pts = dev.points;
  if (dim === "h" || dim === "e") return folds;
  if (dim === "d1" || dim === "d2") {
    if (!pts.length) return folds;
    const ys = pts.map((p) => p.p.y);
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const half = pts.filter((p) => (dim === "d1" ? p.p.y <= mid : p.p.y > mid));
    return (half.length ? half : pts).map((p) => pointRef(p.id));
  }
  return dev.outline.map((_, i) => outlineRef(i));
}

/** Etapa da Traçagem Guiada correspondente à cota em foco. */
export function stepForDim(dim: string | null | undefined): string {
  if (dim === "h" || dim === "e") return "geratrizes";
  if (dim === "d1" || dim === "d2") return "divisao";
  return "referencia";
}
