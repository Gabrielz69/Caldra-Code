/**
 * CALDRA CHAMFER — EDIÇÃO DIRETA DE COTAS NO CANVAS (SEÇÃO 14)
 *
 * Permite editar uma dimensão tocando diretamente sobre o seu valor no desenho:
 *  500 mm → toque → [ 750 mm ] → confirmação → geometria recalculada atomicamente.
 *  - Suporta entrada por teclado CAD ou ajuste por incremento (+ / -);
 *  - Suporta vírgula e ponto decimal, unidades (mm, cm, m) e expressões;
 *  - Botão de confirmação azul (✓) que aplica imediatamente a medida ao modelo.
 */

import React, { useState, useEffect } from "react";
import { Check, X, Minus, Plus, ArrowLeftRight } from "lucide-react";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { globalParametricStore } from "@/lib/lab2d/cadParametricVariables";
import { DimensionInteractionEngine } from "@/lib/lab2d/cadDimensionInteractionEngine";

interface ChamferDirectDimensionEditorProps {
  open: boolean;
  onClose: () => void;
  screenPos: { x: number; y: number };
  currentValue: number;
  label: string;
  onConfirm: (newValue: number) => void;
  allowInvert?: boolean;
  onInvertSide?: () => void;
}

export function ChamferDirectDimensionEditor({
  open,
  onClose,
  screenPos,
  currentValue,
  label,
  onConfirm,
  allowInvert = false,
  onInvertSide,
}: ChamferDirectDimensionEditorProps) {
  const [valStr, setValStr] = useState<string>(String(currentValue));

  useEffect(() => {
    if (open) {
      setValStr(String(currentValue));
    }
  }, [open, currentValue]);

  if (!open) return null;

  const handleStep = (delta: number) => {
    triggerHaptic("selection");
    const parsed = DimensionInteractionEngine.parseInput(valStr);
    const num = parsed ?? (globalParametricStore.evaluateExpression(valStr.replace(/,/g, ".")) || currentValue);
    const next = Math.max(0.1, num + delta);
    setValStr(String(parseFloat(next.toFixed(2))));
  };

  const handleConfirm = () => {
    const raw = valStr.trim();
    const parsed = DimensionInteractionEngine.parseInput(raw);
    const evaluated =
      parsed ??
      globalParametricStore.evaluateExpression(raw.replace(/,/g, ".")) ??
      (Number.isFinite(parseFloat(raw.replace(",", "."))) ? parseFloat(raw.replace(",", ".")) : null);

    if (typeof evaluated === "number" && !isNaN(evaluated) && Number.isFinite(evaluated)) {
      triggerHaptic("success");
      AudioManager.play("ui_select");
      onConfirm(evaluated);
      onClose();
    }
  };

  // Posicionamento inteligente para não sair da tela
  const posX = Math.max(80, Math.min(window.innerWidth - 120, screenPos.x));
  const posY = Math.max(60, Math.min(window.innerHeight - 80, screenPos.y));

  return (
    <div
      className="fixed z-50 transform -translate-x-1/2 -translate-y-1/2 select-none animate-in zoom-in-95 duration-100"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 p-1.5 bg-[#0B1017]/95 border-2 border-sky-500/80 shadow-[0_10px_35px_rgba(0,0,0,0.85)] rounded-2xl backdrop-blur-xl text-foreground">
        <button
          type="button"
          onClick={() => handleStep(-10)}
          className="size-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold active:scale-95 transition-transform"
          title="-10 mm"
        >
          <Minus className="size-3.5" />
        </button>

        <div className="flex items-center px-1">
          <input
            type="text"
            inputMode="decimal"
            value={valStr}
            onChange={(e) => setValStr(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            className="w-20 bg-transparent text-center font-mono font-bold text-sm text-sky-400 outline-none"
          />
          <span className="font-mono text-xs text-slate-400 mr-1">mm</span>
        </div>

        <button
          type="button"
          onClick={() => handleStep(10)}
          className="size-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold active:scale-95 transition-transform"
          title="+10 mm"
        >
          <Plus className="size-3.5" />
        </button>

        {allowInvert && onInvertSide && (
          <button
            type="button"
            onClick={onInvertSide}
            className="size-8 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center font-bold active:scale-95 transition-transform"
            title="Inverter Lado do Afastamento"
          >
            <ArrowLeftRight className="size-3.5" />
          </button>
        )}

        <div className="w-px h-5 bg-slate-800 mx-0.5" />

        {/* Botão de confirmação azul (✓) destacado */}
        <button
          type="button"
          onClick={handleConfirm}
          className="size-8 rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center font-bold shadow-md shadow-sky-600/40 hover:brightness-110 active:scale-95 transition-transform cursor-pointer"
          title="Confirmar medida (✓)"
        >
          <Check className="size-4 stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          title="Cancelar"
        >
          <X className="size-4" />
        </button>
      </div>
      {label && (
        <div className="mt-1 text-center font-mono text-[9.5px] font-semibold text-sky-300 drop-shadow-md">
          {label}
        </div>
      )}
    </div>
  );
}
