/**
 * CALDRA CHAMFER — DIÁLOGO E PAINEL DA FERRAMENTA CENTRALIZAR FORMAS (CAD 2D)
 *
 * Interface compacta e precisa para centralização e alinhamento geométrico:
 *  - Eixos: Horizontal ↔, Vertical ↕, Ambos (X+Y) ⊕;
 *  - Método: Centro Geométrico Real (Centroide) vs Bounding Box;
 *  - Modo de Distribuição: Em Bloco (preserva posições relativas) vs Individual;
 *  - Referência: Centro do Conjunto vs Origem (0, 0) vs Peça Mestre.
 *  - Posicionamento inteligente: não obstrui o centro nem a geometria da peça selecionada.
 *    Prioriza posições laterais e superiores, com reposicionamento automático para a área
 *    de menor sobreposição e suporte total a toque e arrasto no desktop e mobile.
 */

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Boxes,
  Compass,
  Check,
  X,
  Layers,
  Move,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { CenterAxis, CenterMethod, CenterGrouping, CenterOptions } from "@/lib/lab2d/cadCenterShapes";
import type { Entity, Vec2 } from "@/lib/lab2d/core";
import { segmentsOf } from "@/lib/lab2d/core";

export type CenterDialogDock = "top-right" | "top-left" | "bottom-right" | "bottom-left";

interface ChamferCenterDialogProps {
  open: boolean;
  selectedEntities: Entity[];
  allEntities: Entity[];
  options: CenterOptions;
  onOptionsChange: (opts: CenterOptions) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDark?: boolean;
  view?: { tx: number; ty: number; k: number };
}

export function ChamferCenterDialog({
  open,
  selectedEntities,
  options,
  onOptionsChange,
  onConfirm,
  onCancel,
  isDark = true,
  view,
}: ChamferCenterDialogProps) {
  const count = selectedEntities.length;

  // Calcula a envoltória da seleção em coordenadas de tela (pixels)
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
      return { minX: 300, maxX: 600, minY: 200, maxY: 500, cx: 450, cy: 350 };
    }
    return {
      minX,
      maxX,
      minY,
      maxY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }, [selectedEntities, view]);

  // Escolhe a ancoragem com menor sobreposição sobre a geometria
  const smartDock = useMemo<CenterDialogDock>(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    const panelW = Math.min(350, vw - 32);
    const panelH = 260;

    // Regiões candidatas em pixels de viewport
    const candidates: Record<CenterDialogDock, { x1: number; x2: number; y1: number; y2: number }> = {
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

    // Ordem de preferência: superior lateral primeiro
    const order: CenterDialogDock[] = ["top-right", "top-left", "bottom-right", "bottom-left"];
    let bestDock = order[0]!;
    let minOverlap = Infinity;

    for (const d of order) {
      const overlap = calcOverlap(candidates[d]);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestDock = d;
      }
    }

    return bestDock;
  }, [screenBounds]);

  const [dock, setDock] = useState<CenterDialogDock>(smartDock);
  const [minimized, setMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Sincroniza smartDock quando o diálogo abre ou seleção muda
  useEffect(() => {
    if (!open) return;
    setDock((prev) => (prev === smartDock ? prev : smartDock));
    setDragOffset((prev) => (prev === null ? prev : null));
  }, [open, smartDock]);

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
    if ((e.target as HTMLElement).closest("button")) return;
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

  const setAxis = (axis: CenterAxis) => {
    triggerHaptic("selection");
    onOptionsChange({ ...options, axis });
  };

  const setMethod = (method: CenterMethod) => {
    triggerHaptic("selection");
    onOptionsChange({ ...options, method });
  };

  const setGrouping = (grouping: CenterGrouping) => {
    triggerHaptic("selection");
    onOptionsChange({ ...options, grouping });
  };

  // Posicionamento responsivo sem invadir o centro da área de desenho
  const dockClasses: Record<CenterDialogDock, string> = {
    "top-right": "top-14 sm:top-16 right-3 sm:right-5 md:right-16",
    "top-left": "top-14 sm:top-16 left-3 sm:left-16 md:left-20",
    "bottom-right": "bottom-14 sm:bottom-16 right-3 sm:right-5 md:right-16",
    "bottom-left": "bottom-14 sm:bottom-16 left-3 sm:left-16 md:left-20",
  };

  if (!open || count < 2) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="chamfer-center-title"
      style={
        dragOffset
          ? {
              transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
            }
          : undefined
      }
      className={cn(
        "pointer-events-auto fixed z-50 flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl transition-shadow select-none",
        "w-[330px] sm:w-[360px] max-w-[calc(100vw-24px)]",
        dockClasses[dock],
        isDark
          ? "border-red-900/60 bg-slate-950/95 text-slate-100 shadow-black/80"
          : "border-slate-300 bg-white/95 text-slate-800 shadow-slate-400/50",
      )}
    >
      {/* CABEÇALHO COMPACTO E ARRASTÁVEL */}
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
            <AlignCenter className="size-3.5 stroke-[2.5]" />
          </div>
          <div>
            <h2 id="chamfer-center-title" className="text-[11px] font-bold uppercase tracking-wider text-red-500 leading-tight">
              Centralizar Formas
            </h2>
            <p className="text-[9px] text-muted-foreground leading-tight">
              {count} formas selecionadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Botão de alternar quadrante */}
          <button
            type="button"
            onClick={cycleDock}
            title={`Mover para outro canto (atual: ${dock})`}
            className={cn(
              "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800",
              isDark ? "hover:bg-slate-800" : "hover:bg-slate-200 text-slate-600",
            )}
          >
            <Move className="size-3" />
          </button>

          {/* Botão de minimizar/expandir */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              setMinimized((m) => !m);
            }}
            title={minimized ? "Expandir opções" : "Minimizar painel"}
            className={cn(
              "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            {minimized ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>

          {/* Botão de fechar */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              onCancel();
            }}
            title="Fechar"
            className={cn(
              "flex size-6 items-center justify-center rounded-lg transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-200",
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* CORPO DE OPÇÕES */}
      {!minimized && (
        <div className="p-3 space-y-2.5 text-xs">
          {/* 1. SELETOR DE EIXO DE ALINHAMENTO */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Eixo de Centralização
            </span>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setAxis("both")}
                className={cn(
                  "flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border font-mono text-[10px] font-semibold transition-all cursor-pointer",
                  options.axis === "both"
                    ? "border-red-500/60 bg-red-600/20 text-red-400 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                <AlignCenter className="size-3 text-red-400" />
                Ambos (X+Y)
              </button>
              <button
                type="button"
                onClick={() => setAxis("horizontal")}
                className={cn(
                  "flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border font-mono text-[10px] font-semibold transition-all cursor-pointer",
                  options.axis === "horizontal"
                    ? "border-red-500/60 bg-red-600/20 text-red-400 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                <AlignHorizontalJustifyCenter className="size-3 text-red-400" />
                Horizontal ↔
              </button>
              <button
                type="button"
                onClick={() => setAxis("vertical")}
                className={cn(
                  "flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border font-mono text-[10px] font-semibold transition-all cursor-pointer",
                  options.axis === "vertical"
                    ? "border-red-500/60 bg-red-600/20 text-red-400 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                <AlignVerticalJustifyCenter className="size-3 text-red-400" />
                Vertical ↕
              </button>
            </div>
          </div>

          {/* 2. REFERÊNCIA GEOMÉTRICA (CENTROIDE VS BOUNDING BOX) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                Cálculo do Centro
              </span>
              <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                <button
                  type="button"
                  onClick={() => setMethod("centroid")}
                  className={cn(
                    "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                    options.method === "centroid"
                      ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                      : isDark
                        ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                        : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                  title="Centro geométrico real / Centroide"
                >
                  Centroide
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("bbox")}
                  className={cn(
                    "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                    options.method === "bbox"
                      ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                      : isDark
                        ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                        : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                  title="Centro dos limites extremos (Bounding Box)"
                >
                  Limites (Box)
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                Distribuição
              </span>
              <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                <button
                  type="button"
                  onClick={() => setGrouping("block")}
                  className={cn(
                    "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                    options.grouping === "block"
                      ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                      : isDark
                        ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                        : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                  title="Move o conjunto mantendo as distâncias relativas entre peças"
                >
                  Em Bloco
                </button>
                <button
                  type="button"
                  onClick={() => setGrouping("individual")}
                  className={cn(
                    "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                    options.grouping === "individual"
                      ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                      : isDark
                        ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                        : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                  title="Alinha cada forma individualmente ao mesmo centro"
                >
                  Individual
                </button>
              </div>
            </div>
          </div>

          {/* 3. ALVO / REFERÊNCIA DO ALINHAMENTO */}
          <div className="space-y-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Referência de Destino
            </span>
            <div className="grid grid-cols-3 gap-1 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  onOptionsChange({ ...options, referenceEntityId: null, targetPoint: null });
                }}
                className={cn(
                  "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                  !options.referenceEntityId && !options.targetPoint
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
                title="Centraliza em relação ao centro comum do conjunto"
              >
                Conjunto
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  onOptionsChange({ ...options, referenceEntityId: null, targetPoint: { x: 0, y: 0 } });
                }}
                className={cn(
                  "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                  options.targetPoint && options.targetPoint.x === 0 && options.targetPoint.y === 0
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
                title="Centraliza na Origem do CAD (0, 0)"
              >
                Origem (0,0)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  const firstId = selectedEntities[0]?.id ?? null;
                  onOptionsChange({ ...options, referenceEntityId: firstId, targetPoint: null });
                }}
                className={cn(
                  "py-1 px-1 rounded-md border text-center transition-colors cursor-pointer",
                  options.referenceEntityId
                    ? "border-red-500 bg-red-500/20 text-red-300 font-bold"
                    : isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                )}
                title="Centraliza a seleção em relação à primeira entidade de referência"
              >
                Peça Mestre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ COM CONFIRMAR E CANCELAR */}
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
            onConfirm();
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-98 text-white text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
        >
          <Check className="size-4 stroke-[3]" />
          Confirmar
        </button>
      </div>
    </div>
  );
}
