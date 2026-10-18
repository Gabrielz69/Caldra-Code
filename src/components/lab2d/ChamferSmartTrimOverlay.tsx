/**
 * CALDRA CHAMFER — OVERLAY E PRÉ-VISUALIZAÇÃO DE APARAR ATÉ ENCONTRO (SMART TRIM)
 *
 * Renderiza a pré-visualização contínua da operação de corte:
 *  - Linha limite (cutter boundary) destacada em ciano/azul técnico;
 *  - Segmento a ser aparado/removido destacado em linha tracejada vermelha;
 *  - Segmento mantido destacado em verde esmeralda sólido;
 *  - Ponto de encontro/interseção destacado com marcador preciso;
 *  - Barra de controle flutuante com alternância entre Encontro Real vs Projetado.
 */

import React from "react";
import type { SmartTrimPreview, TrimBoundaryMode } from "@/lib/lab2d/cadSmartTrim";
import { Scissors, Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";

interface ChamferSmartTrimOverlayProps {
  preview: SmartTrimPreview | null;
  mode: TrimBoundaryMode;
  onToggleMode: (m: TrimBoundaryMode) => void;
  onExit: () => void;
  viewK: number;
  isDark?: boolean;
}

export function ChamferSmartTrimSvgOverlay({
  preview,
  viewK,
}: {
  preview: SmartTrimPreview | null;
  viewK: number;
}) {
  const candidate = preview?.activeCandidate;
  if (!candidate) return null;

  return (
    <g className="pointer-events-none select-none">
      {/* Linha limite (cutter boundary) destacada em ciano brilhante */}
      {candidate.boundaryEntity && (
        <g opacity={0.65}>
          {/* Se a entidade limite for linha simples */}
          {candidate.boundaryEntity.type === "line" && (
            <line
              x1={candidate.boundaryEntity.x1}
              y1={candidate.boundaryEntity.y1}
              x2={candidate.boundaryEntity.x2}
              y2={candidate.boundaryEntity.y2}
              stroke="#06b6d4"
              strokeWidth={2.5 / viewK}
              strokeDasharray={`${6 / viewK},${3 / viewK}`}
            />
          )}
        </g>
      )}

      {/* Segmento mantido (verde brilhante) */}
      <line
        x1={candidate.keptSegment[0].x}
        y1={candidate.keptSegment[0].y}
        x2={candidate.keptSegment[1].x}
        y2={candidate.keptSegment[1].y}
        stroke="#10b981"
        strokeWidth={3 / viewK}
        strokeLinecap="round"
      />

      {/* Segmento a ser aparado (vermelho tracejado com destaque) */}
      <line
        x1={candidate.cutSegment[0].x}
        y1={candidate.cutSegment[0].y}
        x2={candidate.cutSegment[1].x}
        y2={candidate.cutSegment[1].y}
        stroke="#ef4444"
        strokeWidth={2.5 / viewK}
        strokeDasharray={`${4 / viewK},${3 / viewK}`}
        strokeLinecap="round"
        strokeOpacity={0.85}
      />

      {/* Marcador no Ponto de Encontro */}
      <circle
        cx={candidate.intersectionPoint.x}
        cy={candidate.intersectionPoint.y}
        r={5 / viewK}
        fill="#ef4444"
        fillOpacity={0.3}
        stroke="#ef4444"
        strokeWidth={1.5 / viewK}
      />
      <line
        x1={candidate.intersectionPoint.x - 4 / viewK}
        y1={candidate.intersectionPoint.y - 4 / viewK}
        x2={candidate.intersectionPoint.x + 4 / viewK}
        y2={candidate.intersectionPoint.y + 4 / viewK}
        stroke="#ffffff"
        strokeWidth={1.2 / viewK}
      />
      <line
        x1={candidate.intersectionPoint.x + 4 / viewK}
        y1={candidate.intersectionPoint.y - 4 / viewK}
        x2={candidate.intersectionPoint.x - 4 / viewK}
        y2={candidate.intersectionPoint.y + 4 / viewK}
        stroke="#ffffff"
        strokeWidth={1.2 / viewK}
      />

      {/* Ponto clicado */}
      <circle
        cx={preview.clickPoint.x}
        cy={preview.clickPoint.y}
        r={2.5 / viewK}
        fill="#f59e0b"
      />
    </g>
  );
}

export function ChamferSmartTrimControlBar({
  preview,
  mode,
  onToggleMode,
  onExit,
  isDark = true,
}: {
  preview: SmartTrimPreview | null;
  mode: TrimBoundaryMode;
  onToggleMode: (m: TrimBoundaryMode) => void;
  onExit: () => void;
  isDark?: boolean;
}) {
  const candidate = preview?.activeCandidate;

  return (
    <div
      role="region"
      aria-label="Controle de Aparar até Encontro"
      className={cn(
        "pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-2xl backdrop-blur-xl transition-all select-none",
        isDark
          ? "border-red-900/60 bg-slate-950/95 text-slate-100 shadow-black/80"
          : "border-slate-300 bg-white/95 text-slate-800 shadow-slate-400/50",
      )}
    >
      <div className="flex items-center gap-2 pr-2 border-r border-slate-700/60">
        <div className="flex size-7 items-center justify-center rounded-lg bg-red-600/20 text-red-500">
          <Scissors className="size-3.5 stroke-[2.5]" />
        </div>
        <div>
          <div className="font-mono text-[11px] font-bold text-red-500 uppercase tracking-wide">
            Aparar até Encontro
          </div>
          <div className="text-[9px] text-muted-foreground truncate max-w-[200px]">
            {candidate
              ? `Encontro detectado (${candidate.isProjected ? "Projetado" : "Real"})`
              : "Passe o cursor sobre a linha para pré-visualizar"}
          </div>
        </div>
      </div>

      {/* Alternador de Modo: Real vs Projetado */}
      <div className="flex items-center gap-1 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onToggleMode("real");
          }}
          className={cn(
            "px-2 py-1 rounded-lg border font-semibold transition-colors cursor-pointer",
            mode === "real"
              ? "border-red-500 bg-red-600/20 text-red-400"
              : isDark
                ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                : "border-slate-200 bg-slate-100 text-slate-600 hover:text-black",
          )}
          title="Apara apenas em cruzamentos físicos existentes"
        >
          Encontro Real
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onToggleMode("projected");
          }}
          className={cn(
            "px-2 py-1 rounded-lg border font-semibold transition-colors cursor-pointer",
            mode === "projected"
              ? "border-red-500 bg-red-600/20 text-red-400"
              : isDark
                ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                : "border-slate-200 bg-slate-100 text-slate-600 hover:text-black",
          )}
          title="Apara no prolongamento matemático das entidades"
        >
          <Sparkles className="size-3 inline mr-1 text-red-400" />
          Projetado
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          triggerHaptic("tap");
          onExit();
        }}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ml-1",
          isDark
            ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black",
        )}
        title="Concluir ferramenta (Esc)"
      >
        <Check className="size-3.5 text-emerald-400" />
        Concluir
      </button>
    </div>
  );
}

export function ChamferSmartTrimOverlay(props: ChamferSmartTrimOverlayProps) {
  return (
    <>
      <ChamferSmartTrimSvgOverlay preview={props.preview} viewK={props.viewK} />
      <ChamferSmartTrimControlBar
        preview={props.preview}
        mode={props.mode}
        onToggleMode={props.onToggleMode}
        onExit={props.onExit}
        isDark={props.isDark}
      />
    </>
  );
}
