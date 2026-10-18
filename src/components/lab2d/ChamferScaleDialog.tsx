/**
 * CALDRA CHAMFER — DIÁLOGO E PAINEL DA FERRAMENTA ESCALAR (CAD 2D)
 *
 * Permite redimensionar entidades selecionadas de 0.1× até 20×:
 *  - Fator numérico com digitação livre (ex: 1.25×, 1.5×, 2.75×, etc.);
 *  - Slider interativo contínuo (0.1× até 20×);
 *  - Atalhos diretos de presets: 0.5×, 1× (Original), 1.25×, 1.5×, 2× (Dobro), 2.75×, 5×, 10×, 20×;
 *  - Ponto-base selecionável: Centro da Seleção, Origem (0, 0), Canto Inferior Mín, Canto Superior Máx;
 *  - Exibição em tempo real das dimensões originais e resultantes (Largura × Altura em mm);
 *  - Posicionamento inteligente sem bloquear o centro da peça selecionada;
 *  - Totalmente acessível e confortável no desktop e mobile (arrasto, minimização e atalhos).
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Maximize2,
  Check,
  X,
  Move,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity } from "@/lib/lab2d/core";
import { boxOf, segmentsOf } from "@/lib/lab2d/core";

export type ScaleBasePointType = "center" | "origin" | "min" | "max";
export type ScaleDialogDock = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface ChamferScaleDialogProps {
  open: boolean;
  selectedEntities: Entity[];
  onConfirm: (factor: number, basePointType: ScaleBasePointType) => void;
  onCancel: () => void;
  isDark?: boolean;
  view?: { tx: number; ty: number; k: number };
}

export function ChamferScaleDialog({
  open,
  selectedEntities,
  onConfirm,
  onCancel,
  isDark = true,
  view,
}: ChamferScaleDialogProps) {
  const [factor, setFactor] = useState<number>(2.0);
  const [basePointType, setBasePointType] = useState<ScaleBasePointType>("center");

  // Calcula limites originais da seleção
  const bbox = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const e of selectedEntities) {
      const b = boxOf(e);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    const w = isFinite(maxX - minX) ? Math.max(0, maxX - minX) : 0;
    const h = isFinite(maxY - minY) ? Math.max(0, maxY - minY) : 0;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return { minX, maxX, minY, maxY, w, h, cx, cy };
  }, [selectedEntities]);

  const newW = bbox.w * factor;
  const newH = bbox.h * factor;

  const PRESETS = [0.5, 1.0, 1.25, 1.5, 2.0, 2.75, 5.0, 10.0, 20.0];

  // Análise de tela para evitar sobreposição sobre a geometria
  const screenBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const k = view?.k ?? 1;
    const tx = view?.tx ?? 0;
    const ty = view?.ty ?? 0;

    for (const e of selectedEntities) {
      for (const seg of segmentsOf(e)) {
        for (const pt of [seg[0], seg[1]]) {
          const sx = pt.x * k + tx;
          const sy = pt.y * k + ty;
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }
      }
    }

    if (!isFinite(minX)) {
      return { minX: 300, maxX: 600, minY: 200, maxY: 500 };
    }
    return { minX, maxX, minY, maxY };
  }, [selectedEntities, view]);

  const smartDock = useMemo<ScaleDialogDock>(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    const panelW = Math.min(360, vw - 32);
    const panelH = 300;

    const candidates: Record<ScaleDialogDock, { x1: number; x2: number; y1: number; y2: number }> = {
      "top-right": { x1: vw - panelW - 16, x2: vw - 16, y1: 60, y2: 60 + panelH },
      "top-left": { x1: 72, x2: 72 + panelW, y1: 60, y2: 60 + panelH },
      "bottom-right": { x1: vw - panelW - 16, x2: vw - 16, y1: vh - panelH - 60, y2: vh - 60 },
      "bottom-left": { x1: 72, x2: 72 + panelW, y1: vh - panelH - 60, y2: vh - 60 },
    };

    const calcOverlap = (rect: { x1: number; x2: number; y1: number; y2: number }) => {
      const ix1 = Math.max(rect.x1, screenBounds.minX);
      const ix2 = Math.min(rect.x2, screenBounds.maxX);
      const iy1 = Math.max(rect.y1, screenBounds.minY);
      const iy2 = Math.min(rect.y2, screenBounds.maxY);
      if (ix2 > ix1 && iy2 > iy1) {
        return (ix2 - ix1) * (iy2 - iy1);
      }
      return 0;
    };

    const order: ScaleDialogDock[] = ["top-right", "top-left", "bottom-right", "bottom-left"];
    let best = order[0]!;
    let minO = Infinity;
    for (const d of order) {
      const o = calcOverlap(candidates[d]);
      if (o < minO) {
        minO = o;
        best = d;
      }
    }
    return best;
  }, [screenBounds]);

  const [dock, setDock] = useState<ScaleDialogDock>(smartDock);
  const [minimized, setMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  useEffect(() => {
    setDock(smartDock);
    setDragOffset(null);
  }, [smartDock]);

  const cycleDock = () => {
    triggerHaptic("selection");
    setDragOffset(null);
    setDock((curr) => {
      if (curr === "top-right") return "top-left";
      if (curr === "top-left") return "bottom-right";
      if (curr === "bottom-right") return "bottom-left";
      return "top-right";
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: dragOffset?.x ?? 0,
      initY: dragOffset?.y ?? 0,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setDragOffset({
      x: dragStartRef.current.initX + dx,
      y: dragStartRef.current.initY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartRef.current) {
      dragStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const dockClasses: Record<ScaleDialogDock, string> = {
    "top-right": "top-14 sm:top-16 right-3 sm:right-6 md:right-16",
    "top-left": "top-14 sm:top-16 left-3 sm:left-16 md:left-20",
    "bottom-right": "bottom-14 sm:bottom-16 right-3 sm:right-6 md:right-16",
    "bottom-left": "bottom-14 sm:bottom-16 left-3 sm:left-16 md:left-20",
  };

  if (!open || selectedEntities.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="chamfer-scale-title"
      style={
        dragOffset
          ? {
              transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
            }
          : undefined
      }
      className={cn(
        "pointer-events-auto fixed z-50 flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl transition-shadow select-none",
        "w-[340px] sm:w-[370px] max-w-[calc(100vw-24px)]",
        dockClasses[dock],
        isDark
          ? "border-red-900/60 bg-slate-950/95 text-slate-100 shadow-black/80"
          : "border-slate-300 bg-white/95 text-slate-800 shadow-slate-400/50",
      )}
    >
      {/* CABEÇALHO */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          "flex items-center justify-between border-b px-3.5 py-2 cursor-grab active:cursor-grabbing",
          isDark ? "border-slate-800/80 bg-slate-900/80" : "border-slate-200 bg-slate-100/80",
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-red-600/20 text-red-500">
            <Maximize2 className="size-3.5 stroke-[2.5]" />
          </div>
          <div>
            <h2 id="chamfer-scale-title" className="text-[11px] font-bold uppercase tracking-wider text-red-500 leading-tight">
              Escalar Seleção
            </h2>
            <p className="text-[9px] text-muted-foreground leading-tight">
              {selectedEntities.length} forma(s) • Fator: {factor.toFixed(2)}×
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={cycleDock}
            title={`Mover para outro canto (atual: ${dock})`}
            className={cn(
              "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            <Move className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              setMinimized((m) => !m);
            }}
            title={minimized ? "Expandir" : "Minimizar"}
            className={cn(
              "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            {minimized ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              onCancel();
            }}
            title="Cancelar"
            className={cn(
              "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* CORPO DE AJUSTE */}
      {!minimized && (
        <div className="p-3 space-y-3 text-xs">
          {/* DIMENSÕES: ORIGINAL VS RESULTANTE */}
          <div
            className={cn(
              "rounded-xl border p-2 space-y-1.5 font-mono text-[10px]",
              isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50",
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground text-[9px] uppercase tracking-wider">
              <span>Dimensões</span>
              <span>L × A (mm)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Original:</span>
              <span className="font-semibold text-foreground">
                {bbox.w.toFixed(1)} × {bbox.h.toFixed(1)} mm
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-red-400 font-semibold">Nova ({factor.toFixed(2)}×):</span>
              <span className="font-bold text-red-500">
                {newW.toFixed(1)} × {newH.toFixed(1)} mm
              </span>
            </div>
          </div>

          {/* FATOR DE ESCALA NUMÉRICO E SLIDER */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Fator de Escala (0.1× a 20×)
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.05}
                  value={Number.isNaN(factor) ? "" : factor}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val)) {
                      setFactor(Math.max(0.1, Math.min(20, val)));
                    }
                  }}
                  className={cn(
                    "w-20 rounded-lg border px-2 py-0.5 text-right font-mono text-xs font-bold text-red-500 outline-none",
                    isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white",
                  )}
                />
                <span className="font-mono text-xs font-bold text-red-500">×</span>
              </div>
            </div>

            {/* Slider de 0.1 a 20 com ajuste fino */}
            <input
              type="range"
              min={0.1}
              max={20.0}
              step={0.05}
              value={factor}
              onChange={(e) => {
                setFactor(parseFloat(e.target.value));
              }}
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>

          {/* PRESETS RÁPIDOS */}
          <div className="space-y-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Atalhos de Escala
            </span>
            <div className="grid grid-cols-5 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setFactor(p);
                  }}
                  className={cn(
                    "py-1 px-1 rounded-lg border font-mono text-[9px] font-semibold transition-all cursor-pointer text-center",
                    Math.abs(factor - p) < 0.01
                      ? "border-red-500 bg-red-600/20 text-red-400 font-bold"
                      : isDark
                        ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {p}×
                </button>
              ))}
            </div>
          </div>

          {/* PONTO-BASE DE REFERÊNCIA */}
          <div className="space-y-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Ponto-Base de Escala
            </span>
            <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setBasePointType("center");
                }}
                className={cn(
                  "py-1 px-1.5 rounded-lg border text-left transition-colors cursor-pointer",
                  basePointType === "center"
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
              >
                Centro da Seleção
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setBasePointType("origin");
                }}
                className={cn(
                  "py-1 px-1.5 rounded-lg border text-left transition-colors cursor-pointer",
                  basePointType === "origin"
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
              >
                Origem (0, 0)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setBasePointType("min");
                }}
                className={cn(
                  "py-1 px-1.5 rounded-lg border text-left transition-colors cursor-pointer",
                  basePointType === "min"
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
              >
                Canto Inf. (Mín)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setBasePointType("max");
                }}
                className={cn(
                  "py-1 px-1.5 rounded-lg border text-left transition-colors cursor-pointer",
                  basePointType === "max"
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
              >
                Canto Sup. (Máx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-t",
          isDark ? "border-slate-800/80 bg-slate-950" : "border-slate-200 bg-slate-50",
        )}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic("tap");
            onCancel();
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer",
            isDark
              ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
        >
          <X className="size-3.5" />
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("action");
            onConfirm(factor, basePointType);
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-98 text-white text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
        >
          <Check className="size-4 stroke-[3]" />
          Aplicar ({factor.toFixed(2)}×)
        </button>
      </div>
    </div>
  );
}
