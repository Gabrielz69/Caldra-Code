/**
 * CALDRA CHAMFER — HUD DE CONTROLE DE PLANO ISOMÉTRICO (ETAPA DESENHO ISOMÉTRICO 2D)
 *
 * Exibe o plano isométrico ativo (Superior, Esquerdo, Direito),
 * permite alternância rápida por toque (mobile-first) e atalho F5 / Ctrl+E,
 * exibe o mini-cubo isométrico vetorial indicando a face orientada,
 * e provê acesso rápido à ferramenta de construção guiada de peças.
 */

import React from "react";
import { Layers, Box, Compass, Sparkles, Check, ChevronRight } from "lucide-react";
import {
  type IsoPlane,
  ISO_PLANES,
} from "@/lib/lab2d/isometricEngine";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { cn } from "@/lib/utils";

interface ChamferIsoPlaneHUDProps {
  activePlane: IsoPlane;
  onSelectPlane: (plane: IsoPlane) => void;
  isoOrtho: boolean;
  onToggleIsoOrtho: () => void;
  onOpenPieceBuilder: () => void;
  onToggleIsoMode?: () => void;
  isDark?: boolean;
}

export function ChamferIsoPlaneHUD({
  activePlane,
  onSelectPlane,
  isoOrtho,
  onToggleIsoOrtho,
  onOpenPieceBuilder,
  onToggleIsoMode,
  isDark = true,
}: ChamferIsoPlaneHUDProps) {
  const currentConfig = ISO_PLANES[activePlane];

  return (
    <div
      className={cn(
        "fixed top-14 left-1/2 -translate-x-1/2 z-35 flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all select-none max-w-[96vw]",
        isDark
          ? "bg-slate-950/90 border-slate-800 text-slate-100 shadow-black/60"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/15",
      )}
    >
      {/* MINI CUBO ISOMÉTRICO VETORIAL INTERATIVO */}
      <div
        className="flex items-center gap-1.5 pr-2 border-r border-slate-700/60 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => {
          triggerHaptic("selection");
          AudioManager.play("ui_select");
          // Cicla plano no clique do cubo
          const nextPlane: IsoPlane =
            activePlane === "top" ? "left" : activePlane === "left" ? "right" : "top";
          onSelectPlane(nextPlane);
        }}
        title="Clique para alternar o plano isométrico ativo (Atalho: F5)"
      >
        <svg
          viewBox="0 0 32 32"
          className="w-6 h-6 shrink-0 drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Face Superior (Top) */}
          <polygon
            points="16,3 27,9.5 16,16 5,9.5"
            fill={activePlane === "top" ? "#38BDF8" : "#334155"}
            stroke={activePlane === "top" ? "#BAE6FD" : "#64748B"}
            strokeWidth="1.2"
          />
          {/* Face Esquerda (Left) */}
          <polygon
            points="5,9.5 16,16 16,29 5,22.5"
            fill={activePlane === "left" ? "#F59E0B" : "#1E293B"}
            stroke={activePlane === "left" ? "#FDE68A" : "#475569"}
            strokeWidth="1.2"
          />
          {/* Face Direita (Right) */}
          <polygon
            points="16,16 27,9.5 27,22.5 16,29"
            fill={activePlane === "right" ? "#EC4899" : "#0F172A"}
            stroke={activePlane === "right" ? "#FBCFE8" : "#334155"}
            strokeWidth="1.2"
          />
        </svg>

        <div className="flex flex-col text-left">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            Plano <span className="text-[8px] opacity-75 hidden sm:inline">(F5)</span>
          </span>
          <span
            className="font-bold text-xs leading-none"
            style={{ color: currentConfig.accentColor }}
          >
            {currentConfig.label}
          </span>
        </div>
      </div>

      {/* SELETOR DOS 3 PLANOS ISOMÉTRICOS (SUPERIOR, ESQUERDO, DIREITO) */}
      <div className="flex items-center gap-1">
        {(["top", "left", "right"] as const).map((planeId) => {
          const cfg = ISO_PLANES[planeId];
          const isSelected = activePlane === planeId;
          return (
            <button
              key={planeId}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_select");
                onSelectPlane(planeId);
              }}
              className={cn(
                "min-h-[36px] min-w-[36px] sm:px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1",
                isSelected
                  ? "bg-slate-800 text-white shadow-xs border border-slate-700 ring-1"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-800/40",
              )}
              style={
                isSelected
                  ? {
                      borderColor: cfg.accentColor,
                      boxShadow: `0 0 10px ${cfg.accentColor}33`,
                    }
                  : {}
              }
              title={`${cfg.name} — ${cfg.description}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isSelected ? cfg.accentColor : "transparent",
                  border: `1.5px solid ${cfg.accentColor}`,
                }}
              />
              <span className="hidden sm:inline text-[11px] font-medium tracking-tight">
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* SEPARADOR SUTIL */}
      <div className="h-5 w-px bg-slate-700/60 mx-0.5 shrink-0" />

      {/* BOTÃO ORTO ISOMÉTRICO (TRAVAR NOS EIXOS DO PLANO) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          AudioManager.play("ui_select");
          onToggleIsoOrtho();
        }}
        className={cn(
          "min-h-[36px] px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5",
          isoOrtho
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
            : "text-muted-foreground hover:text-foreground hover:bg-slate-800/40",
        )}
        title={
          isoOrtho
            ? "Orto Isométrico Ativo (Trava linhas nos eixos do plano ativo)"
            : "Orto Isométrico Desativado (Livre movimento)"
        }
      >
        <Compass className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Orto Iso</span>
      </button>

      {/* BOTÃO CONVERSÃO / PROJEÇÃO ISOMÉTRICA DA SELEÇÃO */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          AudioManager.play("ui_select");
          onOpenPieceBuilder();
        }}
        className="min-h-[36px] px-2.5 sm:px-3 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-400 hover:to-amber-400 text-black shadow-md active:scale-95 cursor-pointer"
        title="Converter Seleção: Transforma analiticamente as peças selecionadas para projeção isométrica"
      >
        <Sparkles className="w-3.5 h-3.5 fill-black" />
        <span className="font-bold tracking-tight">Converter Seleção</span>
      </button>
    </div>
  );
}
