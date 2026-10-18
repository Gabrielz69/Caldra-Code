/**
 * CALDRA CHAMFER — DUAL TOOL HUD & CONTROLE DE FERRAMENTAS COMPOSTAS (ETAPA 18)
 *
 * Painel flutuante compacto que sinaliza e comanda a Ferramenta Composta ativa:
 *  - Exibe a Ferramenta Principal + Ferramenta Auxiliar
 *  - Botão de Inversão (Swap)
 *  - Botão de Fixação (Pin Secondary)
 *  - Seletor rápido de composições clássicas (Line+Dim, Offset+Trim, Move+Align)
 */

import React from "react";
import {
  ArrowLeftRight,
  Pin,
  PinOff,
  X,
  Zap,
  Sparkles,
  Scissors,
  Ruler,
  AlignCenter,
  Minus,
} from "lucide-react";
import type { Tool } from "./Lab2DEditor";
import {
  DUAL_TOOL_PRESETS,
  type DualToolPreset,
} from "@/lib/lab2d/cadDualToolManager";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

interface ChamferDualToolHUDProps {
  primaryTool: Tool;
  secondaryTool: Tool | null;
  pinned: boolean;
  onSwap: () => void;
  onTogglePin: () => void;
  onClear: () => void;
  onSelectPreset: (presetId: string) => void;
}

export function ChamferDualToolHUD({
  primaryTool,
  secondaryTool,
  pinned,
  onSwap,
  onTogglePin,
  onClear,
  onSelectPreset,
}: ChamferDualToolHUDProps) {
  if (!secondaryTool) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 bg-card/95 border border-accent/40 backdrop-blur-xl px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent pr-1 border-r border-border/60">
        <Zap className="w-3.5 h-3.5 fill-accent" />
        <span className="hidden sm:inline font-mono uppercase text-[10px] tracking-wider">
          Dual Tool
        </span>
      </div>

      {/* Primary Badge */}
      <span className="px-2 py-0.5 rounded-md bg-accent/20 border border-accent/40 text-[11px] font-bold text-accent capitalize">
        1º {primaryTool}
      </span>

      <span className="text-muted-foreground text-xs">+</span>

      {/* Secondary Badge */}
      <span className="px-2 py-0.5 rounded-md bg-secondary border border-border text-[11px] font-bold text-foreground capitalize">
        2º {secondaryTool}
      </span>

      {/* Swap Button */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          AudioManager.play("ui_select");
          onSwap();
        }}
        title="Alternar Primária / Secundária"
        className="w-6 h-6 rounded-full hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftRight className="w-3 h-3" />
      </button>

      {/* Pin Button */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          onTogglePin();
        }}
        title={pinned ? "Desafixar ferramenta secundária" : "Fixar ferramenta secundária"}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          pinned ? "bg-accent/20 text-accent" : "hover:bg-muted/80 text-muted-foreground"
        }`}
      >
        {pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
      </button>

      {/* Close / Unset Secondary */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          onClear();
        }}
        title="Encerrar Ferramenta Composta"
        className="w-6 h-6 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
