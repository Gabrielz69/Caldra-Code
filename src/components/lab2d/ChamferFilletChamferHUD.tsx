/**
 * CALDRA CHAMFER — HUD FLUTUANTE PARA FILETE E CHANFRO (CAD 2D)
 *
 * Exibe controle numérico direto, presets rápidos e comandos para aplicação
 * no canto clicado diretamente ou em múltiplos cantos da seleção.
 */

import React from "react";
import { Sparkles, Minus, Check, X, Layers, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";

export interface ChamferFilletChamferHUDProps {
  tool: "fillet" | "chamfer";
  value: number;
  onChangeValue: (v: number) => void;
  selectionCornersCount: number;
  onApplySelectionCorners: () => void;
  onClose: () => void;
  isDark?: boolean;
}

export function ChamferFilletChamferHUD({
  tool,
  value,
  onChangeValue,
  selectionCornersCount,
  onApplySelectionCorners,
  onClose,
  isDark = true,
}: ChamferFilletChamferHUDProps) {
  const isFillet = tool === "fillet";
  const PRESETS = [2, 5, 10, 15, 20, 30, 50];

  return (
    <div
      role="toolbar"
      aria-label={isFillet ? "Controle do Filete" : "Controle do Chanfro"}
      className={cn(
        "pointer-events-auto fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-1.5 shadow-xl backdrop-blur-xl transition-all select-none",
        "max-w-[calc(100vw-32px)] text-xs",
        isDark
          ? "border-red-900/50 bg-slate-950/90 text-slate-100 shadow-black/60"
          : "border-slate-300 bg-white/95 text-slate-800 shadow-slate-300/50",
      )}
    >
      {/* IDENTIFICADOR DA FERRAMENTA */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700/50 font-semibold text-red-500">
        {isFillet ? <Sparkles className="size-3.5" /> : <Minus className="size-3.5 stroke-[3]" />}
        <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
          {isFillet ? "Filete" : "Chanfro"}
        </span>
      </div>

      {/* INPUT NUMÉRICO DIRETO */}
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase">
          {isFillet ? "Raio:" : "Dist:"}
        </span>
        <div className="flex items-center gap-0.5">
          <input
            type="number"
            min={0.5}
            max={500}
            step={0.5}
            value={Number.isNaN(value) ? "" : value}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val) && val > 0) {
                onChangeValue(val);
              }
            }}
            className={cn(
              "w-14 rounded-lg border px-1.5 py-0.5 text-center font-mono text-xs font-bold text-red-500 outline-none",
              isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white",
            )}
          />
          <span className="font-mono text-[10px] text-muted-foreground">mm</span>
        </div>
      </div>

      {/* PRESETS RÁPIDOS */}
      <div className="hidden sm:flex items-center gap-1 pl-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onChangeValue(p);
            }}
            className={cn(
              "px-1.5 py-0.5 rounded-md border font-mono text-[10px] font-medium transition-colors cursor-pointer",
              Math.abs(value - p) < 0.01
                ? "border-red-500 bg-red-600/20 text-red-400 font-bold"
                : isDark
                  ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  : "border-slate-200 bg-slate-100 text-slate-600 hover:text-black",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* APLICAR NA SELEÇÃO SE HOUVER CANTOS IDENTIFICADOS */}
      {selectionCornersCount > 0 && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic("action");
            onApplySelectionCorners();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-mono text-[10px] font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
        >
          <CornerDownRight className="size-3" />
          <span>Aplicar nos {selectionCornersCount} cantos</span>
        </button>
      )}

      {/* DICA COMPACTA */}
      <span className="hidden md:inline font-mono text-[9px] text-muted-foreground pl-1 border-l border-slate-700/50">
        Toque no canto diretamente ou selecione 2 linhas
      </span>

      {/* FECHAR / CONCLUIR */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("tap");
          onClose();
        }}
        title="Concluir e voltar à seleção"
        className={cn(
          "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer ml-1",
          isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-200",
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
