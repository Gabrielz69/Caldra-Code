/**
 * CALDRA CHAMFER — EDIÇÃO DIRETA DE COTAS NO CANVAS (SEÇÃO 14)
 *
 * Permite editar uma dimensão tocando diretamente sobre o seu valor no desenho:
 *  500 mm → toque → [ 750 mm ] → confirmação → geometria recalculada atomicamente.
 *  - Suporta entrada por teclado CAD ou ajuste por incremento (+ / -);
 *  - Aplica a mutação à geometria associativa através do Command System.
 */

import React, { useState } from "react";
import { Check, X, Minus, Plus, ArrowLeftRight } from "lucide-react";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { globalParametricStore } from "@/lib/lab2d/cadParametricVariables";
import { GeometricConstraintResolver } from "@/lib/lab2d/cadConstraintResolver";

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

  if (!open) return null;

  const handleStep = (delta: number) => {
    triggerHaptic("selection");
    const parsed = GeometricConstraintResolver.parseDimensionInput(valStr);
    const num = parsed ?? (globalParametricStore.evaluateExpression(valStr) || currentValue);
    const next = Math.max(0.1, num + delta);
    setValStr(String(parseFloat(next.toFixed(2))));
  };

  const handleConfirm = () => {
    const parsed = GeometricConstraintResolver.parseDimensionInput(valStr);
    const evaluated = parsed ?? globalParametricStore.evaluateExpression(valStr);
    if (typeof evaluated === "number" && !isNaN(evaluated) && evaluated > 0) {
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
    >
      <div className="flex items-center gap-1.5 p-1.5 bg-card/95 border-2 border-accent/80 shadow-2xl rounded-2xl backdrop-blur-xl text-foreground">
        <button
          type="button"
          onClick={() => handleStep(-10)}
          className="size-8 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center font-bold active:scale-95 transition-transform"
          title="-10 mm"
        >
          <Minus className="size-3.5" />
        </button>

        <div className="flex items-center px-1">
          <input
            type="text"
            value={valStr}
            onChange={(e) => setValStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            className="w-20 bg-transparent text-center font-mono font-bold text-sm text-foreground outline-none"
          />
          <span className="font-mono text-xs text-muted-foreground mr-1">mm</span>
        </div>

        <button
          type="button"
          onClick={() => handleStep(10)}
          className="size-8 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center font-bold active:scale-95 transition-transform"
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

        <div className="w-px h-5 bg-border mx-0.5" />

        <button
          type="button"
          onClick={handleConfirm}
          className="size-8 rounded-xl bg-accent text-accent-foreground flex items-center justify-center font-bold shadow-md hover:brightness-110 active:scale-95 transition-transform"
          title="Confirmar nova cota"
        >
          <Check className="size-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center active:scale-95 transition-transform"
          title="Cancelar"
        >
          <X className="size-4" />
        </button>
      </div>
      {label && (
        <div className="mt-1 text-center font-mono text-[9.5px] font-semibold text-slate-300 drop-shadow-md">
          {label}
        </div>
      )}
    </div>
  );
}
