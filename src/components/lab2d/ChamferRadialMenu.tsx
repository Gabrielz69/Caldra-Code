/**
 * CALDRA CHAMFER — MENU RADIAL TOTALMENTE REMOVIDO
 * O Menu Radial / Circular (PieMenu / ContextWheel) foi permanentemente desativado em conformidade com as diretrizes do CHAMFER CAD.
 * O toque longo no vazio abre a Área de Transferência do CAD.
 * O toque longo sobre formas geométricas serve exclusivamente para destravar o movimento após 320ms.
 */

import React from "react";
import type { Entity } from "@/lib/lab2d/core";

export interface RadialMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
  accent?: boolean;
}

export interface ChamferRadialMenuProps {
  open?: boolean;
  onClose?: () => void;
  position?: { x: number; y: number };
  selectedEntities?: Entity[];
  onAction?: (actionId: string) => void;
  isDark?: boolean;
}

export function ChamferRadialMenu(_props: ChamferRadialMenuProps) {
  return null;
}
