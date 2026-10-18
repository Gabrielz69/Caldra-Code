/**
 * VISTAS PADRÃO DO 3D TÉCNICO.
 *
 * Apenas ORIENTAÇÃO DE CÂMERA — nenhuma alteração de geometria canônica,
 * projeção, material ou ordenação. Zoom 1 equivale ao enquadramento
 * automático calculado a partir do bounding box real da peça (fit).
 */

import type { Camera } from "@/lib/viz3d/wire";

export type ViewPresetId =
  | "iso"
  | "front"
  | "side"
  | "top"
  | "back"
  | "bottom"
  | "left"
  | "right";

export type ViewPreset = {
  id: ViewPresetId;
  /** rótulo curto da barra técnica */
  label: string;
  /** descrição acessível */
  title: string;
  camera: Camera;
};

/** Ordem padrão na barra básica: isométrica primeiro (padrão do estúdio). */
export const VIEW_PRESETS: readonly ViewPreset[] = [
  { id: "iso", label: "ISO", title: "Vista isométrica", camera: { yaw: 0.7, pitch: 0.4, zoom: 1 } },
  { id: "front", label: "FR", title: "Vista frontal", camera: { yaw: 0, pitch: 0, zoom: 1 } },
  {
    id: "side",
    label: "LAT",
    title: "Vista lateral (direita)",
    camera: { yaw: Math.PI / 2, pitch: 0, zoom: 1 },
  },
  {
    id: "top",
    label: "SUP",
    title: "Vista superior",
    camera: { yaw: 0, pitch: Math.PI / 2, zoom: 1 },
  },
] as const;

/** Vistas técnicas completas: ISO, FR, TRAS, LAT, DIR, ESQ, SUP, INF */
export const EXTENDED_VIEW_PRESETS: readonly ViewPreset[] = [
  { id: "iso", label: "ISO", title: "Vista isométrica", camera: { yaw: 0.7, pitch: 0.4, zoom: 1, panX: 0, panY: 0 } },
  { id: "front", label: "FR", title: "Vista frontal", camera: { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 } },
  { id: "back", label: "TRAS", title: "Vista posterior", camera: { yaw: Math.PI, pitch: 0, zoom: 1, panX: 0, panY: 0 } },
  { id: "side", label: "LAT", title: "Vista lateral", camera: { yaw: Math.PI / 2, pitch: 0, zoom: 1, panX: 0, panY: 0 } },
  { id: "right", label: "DIR", title: "Vista lateral direita", camera: { yaw: Math.PI / 2, pitch: 0, zoom: 1, panX: 0, panY: 0 } },
  { id: "left", label: "ESQ", title: "Vista lateral esquerda", camera: { yaw: -Math.PI / 2, pitch: 0, zoom: 1, panX: 0, panY: 0 } },
  { id: "top", label: "SUP", title: "Vista superior", camera: { yaw: 0, pitch: Math.PI / 2, zoom: 1, panX: 0, panY: 0 } },
  { id: "bottom", label: "INF", title: "Vista inferior", camera: { yaw: 0, pitch: -Math.PI / 2, zoom: 1, panX: 0, panY: 0 } },
] as const;

export const DEFAULT_VIEW: ViewPresetId = "iso";

export function cameraForView(id: ViewPresetId): Camera {
  const preset =
    EXTENDED_VIEW_PRESETS.find((v) => v.id === id) ??
    VIEW_PRESETS.find((v) => v.id === id) ??
    VIEW_PRESETS[0]!;
  return { ...preset.camera, panX: 0, panY: 0, zoom: 1 };
}

/** Modos de aresta: só apresentação; as entidades continuam as mesmas. */
export type EdgeMode = "shaded" | "shaded-edges" | "wireframe";

export const EDGE_MODES: readonly { id: EdgeMode; label: string; title: string }[] = [
  { id: "shaded", label: "SOMB", title: "Somente superfícies sombreadas" },
  { id: "shaded-edges", label: "SOMB+AR", title: "Superfícies com arestas técnicas" },
  { id: "wireframe", label: "ARAME", title: "Somente arestas (aramado)" },
] as const;
