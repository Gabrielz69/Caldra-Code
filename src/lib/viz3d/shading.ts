/**
 * CONFIGURAÇÃO CENTRAL DE SOMBREAMENTO DO 3D — Fase D.
 *
 * Fonte única de luz e material do visualizador técnico. Nenhum valor aqui
 * altera geometria: apenas como a malha canônica é iluminada na tela.
 */

import type { Vec3 } from "@/lib/geometry/types";

/** Luz principal (direção normalizada no espaço de câmera). */
export const KEY_LIGHT: Vec3 = { x: -0.38, y: 0.66, z: 0.65 };

/** Luz de preenchimento (suaviza sombras duras). */
export const FILL_LIGHT: Vec3 = { x: 0.62, y: -0.12, z: 0.42 };

export type FaceMaterial = {
  /** cor base (sombra) */
  base: string;
  /** cor de realce (luz) */
  hi: string;
  /** ganho do difuso */
  gain: number;
  /** componente ambiente */
  amb: number;
};

/**
 * Materiais por papel técnico da face. As cores são tokens do tema
 * (--solid-*) para que claro/escuro/AMOLED continuem coerentes.
 */
export const FACE_MATERIALS: Record<string, FaceMaterial> = {
  outer: { base: "var(--solid-lo)", hi: "var(--solid-hi)", gain: 1.05, amb: 0.04 },
  inner: { base: "var(--solid-in)", hi: "var(--solid-lo)", gain: 0.8, amb: 0.1 },
  rim: { base: "var(--solid-lo)", hi: "var(--solid-rim)", gain: 1.1, amb: 0.2 },
  cap: { base: "var(--solid-lo)", hi: "var(--solid-hi)", gain: 0.95, amb: 0.08 },
};
