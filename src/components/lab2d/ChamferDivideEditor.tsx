/**
 * CALDRA CHAMFER — EDITOR COMPACTO DA FERRAMENTA DIVIDIR
 *
 * Interface compacta de alta precisão para dividir peças/contornos em N partes iguais:
 * - DIVIDIR EM [ N ] PARTES
 * - Controles táteis + e −
 * - Digitação direta com validação (2 a 50 partes inteiras)
 * - Atalhos rápidos para divisões canônicas (2, 3, 4, 5, 8, 12)
 * - Métricas técnicas calculadas em tempo real (comprimento/dimensão resultante)
 * - Suporte a fatiamento de chapa (Comprimento ↔ / Largura ↕) e perímetro
 * - Card MÓVEL com suporte a arrastar livremente pela tela (touch e mouse)
 * - TOTALMENTE ADAPTADO PARA MODO PAISAGEM: rodapé com CONFIRMAR e CANCELAR
 *   permanece SEMPRE FIXO (STICKY) no rodapé do card, 100% visível sem cortes.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Divide,
  Minus,
  Plus,
  Check,
  X,
  Scissors,
  GripHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity } from "@/lib/lab2d/core";
import {
  getDivideSummary,
  type DivideOptions,
  type DivideSummary,
} from "@/lib/lab2d/cadDivide";

interface ChamferDivideEditorProps {
  open: boolean;
  selectedEntity: Entity | null;
  parts: number;
  onPartsChange: (n: number) => void;
  options: DivideOptions;
  onOptionsChange: (opts: DivideOptions) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDark?: boolean;
  className?: string;
}

export function ChamferDivideEditor({
  open,
  selectedEntity,
  parts,
  onPartsChange,
  options,
  onOptionsChange,
  onConfirm,
  onCancel,
  isDark = true,
  className,
}: ChamferDivideEditorProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localInput, setLocalInput] = useState<string>(String(parts));

  // Posição arrastável do card móvel
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Detecção de orientação paisagem ou altura reduzida (< 560px)
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined"
      ? window.innerWidth > window.innerHeight || window.innerHeight < 560
      : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight || window.innerHeight < 560);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sincroniza valor do input quando parts muda externamente
  useEffect(() => {
    setLocalInput(String(parts));
  }, [parts]);

  // Foca no input quando o editor é aberto
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.select();
      }, 100);
    }
  }, [open]);

  // Atalhos de teclado globais quando o editor está ativo
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open || !selectedEntity) return null;

  const summary: DivideSummary = getDivideSummary(selectedEntity, parts, options);

  const handleStep = (delta: number) => {
    triggerHaptic("selection");
    const next = Math.max(2, Math.min(50, parts + delta));
    onPartsChange(next);
    setLocalInput(String(next));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setLocalInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 2 && parsed <= 50) {
      onPartsChange(parsed);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(localInput, 10);
    if (isNaN(parsed) || parsed < 2) {
      onPartsChange(2);
      setLocalInput("2");
    } else if (parsed > 50) {
      onPartsChange(50);
      setLocalInput("50");
    } else {
      onPartsChange(parsed);
      setLocalInput(String(parsed));
    }
  };

  const handlePreset = (presetVal: number) => {
    triggerHaptic("selection");
    onPartsChange(presetVal);
    setLocalInput(String(presetVal));
  };

  // Funções de arraste livre (Card Móvel)
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore pointer capture error */
    }

    const cardRect = cardRef.current?.getBoundingClientRect();
    const curX = position ? position.x : cardRect ? cardRect.left : 16;
    const curY = position ? position.y : cardRect ? cardRect.top : 48;

    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: curX,
      initY: curY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const cardWidth = cardRef.current?.offsetWidth ?? 380;
    const cardHeight = cardRef.current?.offsetHeight ?? 280;
    const maxX = Math.max(8, window.innerWidth - cardWidth - 8);
    const maxY = Math.max(8, window.innerHeight - cardHeight - 8);

    const nextX = Math.max(8, Math.min(maxX, dragRef.current.initX + dx));
    const nextY = Math.max(8, Math.min(maxY, dragRef.current.initY + dy));
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore pointer release error */
      }
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby="chamfer-divide-title"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: "auto",
              bottom: "auto",
            }
          : undefined
      }
      className={cn(
        "pointer-events-auto fixed z-50 flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl transition-shadow select-none overflow-hidden",
        isLandscape
          ? "w-[490px] sm:w-[530px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] top-3 right-3 sm:right-6 md:top-4"
          : "w-80 sm:w-96 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-24px)] top-12 right-3 sm:right-6 md:top-14",
        isDark
          ? "border-red-900/50 bg-slate-950/95 text-slate-100 shadow-black/80"
          : "border-slate-300 bg-white/95 text-slate-800 shadow-slate-400/50",
        className,
      )}
    >
      {/* ============================================================ */}
      {/* 1. CABEÇALHO COM ALÇA DE ARRASTE (SHRINK-0 SEMPRE VISÍVEL)   */}
      {/* ============================================================ */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          "flex shrink-0 items-center justify-between border-b px-3.5 py-2 cursor-grab active:cursor-grabbing",
          isDark ? "border-slate-800/80 bg-slate-900/80" : "border-slate-200 bg-slate-100/90",
        )}
        title="Arraste para mover o editor pela tela"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="text-slate-400">
            <GripHorizontal className="size-4" />
          </div>
          <div className="flex size-6 items-center justify-center rounded-md bg-red-600/20 text-red-500">
            <Divide className="size-3.5 stroke-[2.5]" />
          </div>
          <div>
            <h2 id="chamfer-divide-title" className="text-[11px] font-bold uppercase tracking-wider text-red-500 leading-tight">
              Dividir Geometria
            </h2>
            <p className="text-[9px] text-muted-foreground leading-tight truncate max-w-[240px]">
              {summary.typeLabel} • {summary.totalMeasure}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("tap");
            onCancel();
          }}
          title="Cancelar (Esc)"
          aria-label="Cancelar divisão"
          className={cn(
            "flex size-6.5 items-center justify-center rounded-lg transition-colors cursor-pointer",
            isDark
              ? "text-slate-400 hover:bg-slate-800 hover:text-white"
              : "text-slate-600 hover:bg-slate-200 hover:text-black",
          )}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ============================================================ */}
      {/* 2. CORPO DO EDITOR COM SCROLL INTERNO QUANDO NECESSÁRIO     */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLandscape ? (
          /* -------- MODO PAISAGEM: 2 COLUNAS COMPACTAS LADO A LADO -------- */
          <div className="p-3 grid grid-cols-2 gap-3 items-start">
            {/* COLUNA 1: DIVIDIR EM [ N ] PARTES + PRESETS */}
            <div className="flex flex-col space-y-2">
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl p-2.5 border",
                  isDark ? "border-slate-800/80 bg-slate-900/40" : "border-slate-200 bg-slate-50",
                )}
              >
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1.5">
                  Dividir em
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={parts <= 2}
                    onClick={() => handleStep(-1)}
                    aria-label="Diminuir partes"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border font-bold transition-all cursor-pointer",
                      parts <= 2
                        ? "opacity-35 cursor-not-allowed border-transparent"
                        : isDark
                          ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-red-500 hover:bg-slate-800 active:scale-95"
                          : "border-slate-300 bg-slate-100 text-slate-800 hover:border-red-500 hover:bg-slate-200 active:scale-95",
                    )}
                  >
                    <Minus className="size-4" />
                  </button>

                  <div
                    className={cn(
                      "relative flex h-10 w-20 items-center justify-center rounded-lg border px-1 shadow-inner",
                      isDark
                        ? "border-red-500/50 bg-slate-900/90 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30"
                        : "border-red-500/50 bg-slate-50 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30",
                    )}
                  >
                    <input
                      ref={inputRef}
                      type="number"
                      min={2}
                      max={50}
                      step={1}
                      value={localInput}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      className="w-full text-center font-mono text-xl font-black text-red-500 outline-none bg-transparent"
                      aria-label="Número de partes"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={parts >= 50}
                    onClick={() => handleStep(1)}
                    aria-label="Aumentar partes"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border font-bold transition-all cursor-pointer",
                      parts >= 50
                        ? "opacity-35 cursor-not-allowed border-transparent"
                        : isDark
                          ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-red-500 hover:bg-slate-800 active:scale-95"
                          : "border-slate-300 bg-slate-100 text-slate-800 hover:border-red-500 hover:bg-slate-200 active:scale-95",
                    )}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                <span className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase mt-1">
                  Partes iguais (2 a 50)
                </span>
              </div>

              {/* PRESETS RÁPIDOS */}
              <div className="flex items-center justify-center gap-1">
                {[2, 3, 4, 5, 8, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePreset(num)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer",
                      parts === num
                        ? "bg-red-600 text-white font-bold shadow-sm"
                        : isDark
                          ? "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300",
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* COLUNA 2: MÉTRICA RESULTANTE + OPÇÕES DE CHAPA */}
            <div className="flex flex-col space-y-2">
              {/* DIMENSÃO POR PARTE */}
              <div
                className={cn(
                  "rounded-xl border px-3 py-2 text-center text-xs space-y-0.5",
                  isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">
                  Dimensão Resultante por Parte
                </div>
                <div className="font-mono font-bold text-emerald-400 text-xs truncate">
                  {summary.partMeasure}
                </div>
              </div>

              {/* OPÇÕES ADICIONAIS PARA RETÂNGULO / CHAPA */}
              {summary.isRectangle && (
                <div
                  className={cn(
                    "rounded-xl border p-2 space-y-1.5 text-xs",
                    isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                    <Scissors className="size-3 text-red-400" />
                    <span>Modo de Corte da Chapa:</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        onOptionsChange({ ...options, rectMode: "plate" });
                      }}
                      className={cn(
                        "py-1 px-1 rounded-md text-center text-[10px] font-medium transition-all cursor-pointer border",
                        options.rectMode !== "perimeter"
                          ? "border-red-500/60 bg-red-600/20 text-red-400 font-semibold"
                          : isDark
                            ? "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800"
                            : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      Fatiar Chapa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        onOptionsChange({ ...options, rectMode: "perimeter" });
                      }}
                      className={cn(
                        "py-1 px-1 rounded-md text-center text-[10px] font-medium transition-all cursor-pointer border",
                        options.rectMode === "perimeter"
                          ? "border-red-500/60 bg-red-600/20 text-red-400 font-semibold"
                          : isDark
                            ? "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800"
                            : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      Perímetro
                    </button>
                  </div>

                  {options.rectMode !== "perimeter" && (
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[9px] text-muted-foreground">Eixo:</span>
                      <div className="flex items-center gap-1 font-mono text-[9px]">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("selection");
                            onOptionsChange({ ...options, rectAxis: "x" });
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                            options.rectAxis === "x" || (!options.rectAxis && summary.defaultAxis === "x")
                              ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                              : isDark
                                ? "border-slate-800 text-slate-400 hover:text-white"
                                : "border-slate-300 text-slate-700 hover:text-black",
                          )}
                        >
                          Comp. ↔
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("selection");
                            onOptionsChange({ ...options, rectAxis: "y" });
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded border transition-colors cursor-pointer",
                            options.rectAxis === "y" || (!options.rectAxis && summary.defaultAxis === "y")
                              ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                              : isDark
                                ? "border-slate-800 text-slate-400 hover:text-white"
                                : "border-slate-300 text-slate-700 hover:text-black",
                          )}
                        >
                          Larg. ↕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* -------- MODO RETRATO: FLUXO VERTICAL ORGANIZADO -------- */
          <div className="p-4 space-y-3">
            {/* BLOCO CENTRAL: DIVIDIR EM [ N ] PARTES */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Dividir em
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={parts <= 2}
                  onClick={() => handleStep(-1)}
                  aria-label="Diminuir partes"
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border font-bold transition-all cursor-pointer",
                    parts <= 2
                      ? "opacity-35 cursor-not-allowed border-transparent"
                      : isDark
                        ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-red-500 hover:bg-slate-800 active:scale-95"
                        : "border-slate-300 bg-slate-100 text-slate-800 hover:border-red-500 hover:bg-slate-200 active:scale-95",
                  )}
                >
                  <Minus className="size-5" />
                </button>

                <div
                  className={cn(
                    "relative flex h-13 min-w-[96px] items-center justify-center rounded-xl border px-2 shadow-inner transition-colors",
                    isDark
                      ? "border-red-500/50 bg-slate-900/90 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30"
                      : "border-red-500/50 bg-slate-50 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30",
                  )}
                >
                  <input
                    ref={inputRef}
                    type="number"
                    min={2}
                    max={50}
                    step={1}
                    value={localInput}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="w-full text-center font-mono text-2xl font-black text-red-500 outline-none bg-transparent"
                    aria-label="Número de partes"
                  />
                </div>

                <button
                  type="button"
                  disabled={parts >= 50}
                  onClick={() => handleStep(1)}
                  aria-label="Aumentar partes"
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border font-bold transition-all cursor-pointer",
                    parts >= 50
                      ? "opacity-35 cursor-not-allowed border-transparent"
                      : isDark
                        ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-red-500 hover:bg-slate-800 active:scale-95"
                        : "border-slate-300 bg-slate-100 text-slate-800 hover:border-red-500 hover:bg-slate-200 active:scale-95",
                  )}
                >
                  <Plus className="size-5" />
                </button>
              </div>

              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Partes iguais (2 a 50)
              </span>
            </div>

            {/* PRESETS RÁPIDOS */}
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              {[2, 3, 4, 5, 8, 12].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePreset(num)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer",
                    parts === num
                      ? "bg-red-600 text-white font-bold shadow-sm"
                      : isDark
                        ? "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300",
                  )}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* FEEDBACK DE MÉTRICA GEOMÉTRICA */}
            <div
              className={cn(
                "rounded-xl border p-2.5 text-center text-xs space-y-1",
                isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50",
              )}
            >
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">
                Dimensão por Parte
              </div>
              <div className="font-mono font-semibold text-emerald-400 text-xs">
                {summary.partMeasure}
              </div>
            </div>

            {/* OPÇÕES ADICIONAIS PARA RETÂNGULO / CHAPA */}
            {summary.isRectangle && (
              <div
                className={cn(
                  "rounded-xl border p-2.5 space-y-2 text-xs",
                  isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Scissors className="size-3.5 text-red-400" />
                    Modo de Divisão da Chapa:
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      onOptionsChange({ ...options, rectMode: "plate" });
                    }}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border",
                      options.rectMode !== "perimeter"
                        ? "border-red-500/60 bg-red-600/20 text-red-400 font-semibold"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800",
                    )}
                  >
                    Fatiar Chapa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      onOptionsChange({ ...options, rectMode: "perimeter" });
                    }}
                    className={cn(
                      "py-1.5 px-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer border",
                      options.rectMode === "perimeter"
                        ? "border-red-500/60 bg-red-600/20 text-red-400 font-semibold"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800",
                    )}
                  >
                    Perímetro
                  </button>
                </div>

                {options.rectMode !== "perimeter" && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">Direção do corte:</span>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          onOptionsChange({ ...options, rectAxis: "x" });
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded border transition-colors cursor-pointer",
                          options.rectAxis === "x" || (!options.rectAxis && summary.defaultAxis === "x")
                            ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                            : "border-slate-800 text-slate-400 hover:text-white",
                        )}
                      >
                        Comprimento ↔
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          onOptionsChange({ ...options, rectAxis: "y" });
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded border transition-colors cursor-pointer",
                          options.rectAxis === "y" || (!options.rectAxis && summary.defaultAxis === "y")
                            ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                            : "border-slate-800 text-slate-400 hover:text-white",
                        )}
                      >
                        Largura ↕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. RODAPÉ FIXO (STICKY SHRINK-0) — 100% GARANTIDO VISÍVEL    */}
      {/* NUNCA É CORTADO OU OCULTO EM PAISAGEM NEM EM RETRATO!       */}
      {/* ============================================================ */}
      <div
        className={cn(
          "shrink-0 flex items-center gap-2 px-3 py-2.5 border-t z-10",
          isDark
            ? "border-slate-800/90 bg-slate-950/95"
            : "border-slate-200/90 bg-slate-50/95",
        )}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic("tap");
            onCancel();
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-98",
            isDark
              ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black",
          )}
        >
          <X className="size-4" />
          <span>Cancelar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("action");
            onConfirm();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 active:scale-98 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
        >
          <Check className="size-4 stroke-[3]" />
          <span>Confirmar ({parts})</span>
        </button>
      </div>
    </div>
  );
}
