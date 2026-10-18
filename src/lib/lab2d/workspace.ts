/**
 * WORKSPACE_FRAME — moldura técnica de trabalho do CHAMFER.
 *
 * É um objeto técnico especial, NÃO uma entidade de desenho: não entra no
 * modelo, não é selecionável, não é exportada em DXF/SVG/PDF/PNG. Serve como
 * referência visual da área útil (padrão 1500 × 3000 mm) e como alvo do
 * enquadramento automático das planificações vindas da Traçagem.
 */

import type { Box } from "./core";

export type WorkspaceFrame = {
  /** Largura interna útil, em mm. */
  w: number;
  /** Altura interna útil, em mm. */
  h: number;
  visible: boolean;
  /** Exibe 1500 mm / 3000 mm como dimensões de referência (nunca cotas da peça). */
  showDims: boolean;
};

export const DEFAULT_FRAME: WorkspaceFrame = { w: 1500, h: 3000, visible: true, showDims: true };

const KEY = "caldra.chamfer.frame.v1";
const MIN = 50;
const MAX = 100_000;

export const clampSide = (v: number, fallback: number) =>
  Number.isFinite(v) && v >= MIN ? Math.min(v, MAX) : fallback;

export function loadFrame(): WorkspaceFrame {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_FRAME;
    const p = JSON.parse(raw) as Partial<WorkspaceFrame>;
    return {
      w: clampSide(Number(p.w), DEFAULT_FRAME.w),
      h: clampSide(Number(p.h), DEFAULT_FRAME.h),
      visible: p.visible !== false,
      showDims: p.showDims !== false,
    };
  } catch {
    return DEFAULT_FRAME;
  }
}

export function saveFrame(f: WorkspaceFrame) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Caixa da área útil: canto superior esquerdo na origem (0,0) do desenho. */
export const frameBox = (f: WorkspaceFrame): Box => ({ minX: 0, minY: 0, maxX: f.w, maxY: f.h });

export const boxSize = (b: Box) => ({ w: b.maxX - b.minX, h: b.maxY - b.minY });

/** A geometria cabe fisicamente na área útil? (sem nenhuma escala) */
export function fitsInFrame(b: Box, f: WorkspaceFrame): boolean {
  const s = boxSize(b);
  return s.w <= f.w + 1e-6 && s.h <= f.h + 1e-6;
}

/** Deslocamento puro (sem escala) que centraliza a caixa dentro da moldura. */
export function centerOffset(b: Box, f: WorkspaceFrame): { dx: number; dy: number } {
  return {
    dx: f.w / 2 - (b.minX + b.maxX) / 2,
    dy: f.h / 2 - (b.minY + b.maxY) / 2,
  };
}

/** Área de trabalho mínima (arredondada para 50 mm) que acomoda a geometria. */
export function frameForBox(b: Box, f: WorkspaceFrame): WorkspaceFrame {
  const s = boxSize(b);
  const up = (v: number) => Math.ceil((v * 1.05) / 50) * 50;
  return {
    ...f,
    w: clampSide(Math.max(up(s.w), f.w), f.w),
    h: clampSide(Math.max(up(s.h), f.h), f.h),
  };
}
