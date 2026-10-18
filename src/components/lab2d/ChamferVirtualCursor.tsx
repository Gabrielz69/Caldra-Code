/**
 * CALDRA CHAMFER — CURSOR AUXILIAR REMOVIDO
 * O cursor circular com ponteiro foi permanentemente desativado em conformidade com as diretrizes do CHAMFER CAD.
 * Apenas a Bolha Quadrada de Zoom (ChamferPrecisionLoupeOverlay) permanece ativa.
 */

import React from "react";
import type { Vec2 } from "@/lib/geometry/types";
import type { Snap } from "@/lib/lab2d/core";
import type { IsoPlane } from "@/lib/lab2d/isometricEngine";

export interface ChamferVirtualCursorProps {
  visible?: boolean;
  screenPos?: Vec2;
  cadPos?: Vec2;
  activeSnap?: Snap | null;
  basePoint?: Vec2 | null;
  fingerOffsetEnabled?: boolean;
  fingerOffsetY?: number;
  drawingProjection?: "orthographic" | "isometric";
  isoPlane?: IsoPlane;
}

export function ChamferVirtualCursor(_props: ChamferVirtualCursorProps) {
  return null;
}
