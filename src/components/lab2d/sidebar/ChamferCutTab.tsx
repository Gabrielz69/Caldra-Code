/**
 * CALDRA CHAMFER — ABA CORTE (MÓDULO COMPLETO DE FABRICAÇÃO E CNC)
 *
 * Estruturada nos 4 grupos industriais especificados:
 * 1. MATERIAL: Material, Espessura real, Acabamento
 * 2. PROCESSO: Corte (Verde), Marcação (Azul), Dobra (Rosa), Recorte (Âmbar)
 * 3. PARÂMETROS: Folga/Kerf, Tolerâncias dimensionais, Compensação de raio
 * 4. PREPARAÇÃO: Sequência de corte, Prioridade, Sentido, Estatísticas CNC reais
 */

import React, { useState, useMemo } from "react";
import {
  Scissors,
  Flame,
  Gauge,
  Check,
  RotateCcw,
  Sparkles,
  Wand2,
  Sliders,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ArrowRightLeft,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity } from "@/lib/lab2d/core";
import {
  CUT_COLOR,
  MARK_COLOR,
  BEND_COLOR,
  RECORTE_COLOR,
  techColor,
} from "@/lib/lab2d/technical";
import {
  cutPaths,
  cutStats,
  isCutPath,
  reverseEntity,
  suggestSequence,
  pathLength,
} from "@/lib/lab2d/cutPlan";
import {
  DEFAULT_SHARE_TOL,
  applySharedCuts,
  detectSharedCuts,
  type ShareCandidate,
  type ShareTol,
} from "@/lib/lab2d/sharedCut";
import { ChamferCompactNumericEditor } from "@/components/lab2d/mobileEdit/ChamferCompactNumericEditor";
import type { NumericPropertyDef } from "@/components/lab2d/mobileEdit/types";

interface ChamferCutTabProps {
  entities: Entity[];
  commit: (updater: Entity[] | ((prev: Entity[]) => Entity[])) => void;
  selection: string[];
  setSelection: (ids: string[]) => void;
  thickness: number;
  onThicknessChange: (th: number) => void;
  material: string;
  onMaterialChange: (m: string) => void;
  finish?: string;
  onFinishChange?: (f: string) => void;
  kerf?: number;
  onKerfChange?: (k: number) => void;
  tolerance?: number;
  onToleranceChange?: (t: number) => void;
  compensation?: "center" | "left" | "right";
  onCompensationChange?: (c: "center" | "left" | "right") => void;
  onHighlightCut?: (c: ShareCandidate | null) => void;
  isDark?: boolean;
}

export function ChamferCutTab({
  entities,
  commit,
  selection,
  setSelection,
  thickness,
  onThicknessChange,
  material,
  onMaterialChange,
  finish = "Decapado e Oleado",
  onFinishChange,
  kerf = 0.2,
  onKerfChange,
  tolerance = 0.1,
  onToleranceChange,
  compensation = "center",
  onCompensationChange,
  onHighlightCut,
  isDark = true,
}: ChamferCutTabProps) {
  // Propriedade numérica em edição
  const [activeNumericProp, setActiveNumericProp] = useState<NumericPropertyDef | null>(null);

  // Seções colapsáveis
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Estatísticas reais de corte
  const paths = useMemo(() => cutPaths(entities), [entities]);
  const stats = useMemo(() => cutStats(entities), [entities]);

  // Tempo estimado de corte (baseado em velocidade média industrial: 2500 mm/min para chapa fina)
  const cutTimeSeconds = useMemo(() => {
    const speedMmPerMin = 2500;
    const piercingTimeSeconds = stats.paths * 0.8;
    const travelTimeSeconds = (stats.totalMm / speedMmPerMin) * 60;
    return Math.round(piercingTimeSeconds + travelTimeSeconds);
  }, [stats]);

  // Converter entidades selecionadas para um processo específico
  const assignProcessToSelection = (targetLayer: "corte" | "marcacao" | "dobra" | "recorte") => {
    if (selection.length === 0) return;
    triggerHaptic("heavy");
    commit((list) =>
      list.map((e) => (selection.includes(e.id) ? { ...e, layer: targetLayer } : e))
    );
  };

  // Inverter sentido das entidades selecionadas
  const handleReverseSelection = () => {
    if (selection.length === 0) return;
    triggerHaptic("selection");
    commit((list) =>
      list.map((e) => (selection.includes(e.id) ? reverseEntity(e) : e))
    );
  };

  // Otimizar sequência de corte CNC (furos primeiro, contorno por último)
  const handleOptimizeSequence = () => {
    triggerHaptic("heavy");
    const ordered = suggestSequence(entities);
    commit(ordered);
  };

  /**
   * Componente de Campo Numérico integrado ao ChamferCompactNumericEditor
   */
  const renderNumericField = (def: NumericPropertyDef) => {
    const isEditing = activeNumericProp?.key === def.key;

    return (
      <div key={def.key} className="relative py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {def.symbol && (
              <span className="font-mono text-red-500 font-bold text-xs shrink-0">
                {def.symbol}
              </span>
            )}
            <span className="font-mono text-[10px] text-slate-400 truncate">
              {def.label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveNumericProp(isEditing ? null : def);
            }}
            title={`Editar ${def.label}`}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-semibold transition-all cursor-pointer shadow-2xs",
              isEditing
                ? "border-red-500 bg-red-600 text-white shadow-red-900/30 ring-1 ring-red-400"
                : "border-slate-800 bg-slate-900/90 text-slate-200 hover:border-slate-700 hover:bg-slate-800"
            )}
          >
            <span>{def.value.toFixed(def.decimals ?? 2)}</span>
            {def.unit && (
              <span className="text-[9px] text-slate-400 font-normal">
                {def.unit}
              </span>
            )}
          </button>
        </div>

        {/* Popover do Editor Compacto */}
        {isEditing && (
          <div className="absolute right-0 top-full mt-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <ChamferCompactNumericEditor
              property={def}
              onChange={(newVal) => {
                if (def.key === "thickness") onThicknessChange(newVal);
                if (def.key === "kerf" && onKerfChange) onKerfChange(newVal);
                if (def.key === "tolerance" && onToleranceChange) onToleranceChange(newVal);
              }}
              onConfirm={(finalVal) => {
                if (def.key === "thickness") onThicknessChange(finalVal);
                if (def.key === "kerf" && onKerfChange) onKerfChange(finalVal);
                if (def.key === "tolerance" && onToleranceChange) onToleranceChange(finalVal);
                setActiveNumericProp(null);
              }}
              onCancel={() => setActiveNumericProp(null)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2.5 text-slate-200 select-none pb-4">
      {/* Cabeçalho da Aba Corte */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-red-600/15 text-red-500 border border-red-500/25">
            <Scissors className="size-4" />
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold text-white leading-tight">
              Plano de Fabricação & CNC
            </h4>
            <span className="font-mono text-[9px] text-slate-400">
              {paths.length} caminhos de usinagem
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. GRUPO MATERIAL                                                     */}
      {/* ===================================================================== */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
        <div
          onClick={() => toggleSection("material")}
          className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
        >
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
            1. Material & Chapa
          </span>
          {collapsedSections.material ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>

        {!collapsedSections.material && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400">Material Base</label>
              <select
                value={material}
                onChange={(e) => onMaterialChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-sans text-xs text-white outline-none focus:border-red-500"
              >
                <option value="Aço carbono (1020)">Aço Carbono (SAE 1020)</option>
                <option value="Aço carbono (A36)">Aço Estrutural (ASTM A36)</option>
                <option value="Aço inoxidável (304)">Aço Inox (AISI 304)</option>
                <option value="Alumínio (5052-H32)">Alumínio Naval (5052-H32)</option>
                <option value="Aço corten">Aço Corten / Resistente</option>
              </select>
            </div>

            {renderNumericField({
              key: "thickness",
              label: "Espessura da Chapa",
              symbol: "e",
              value: thickness,
              unit: "mm",
              min: 0.5,
              max: 50,
              defaultStep: 0.5,
              stepOptions: [0.1, 0.5, 1, 2],
            })}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400">Acabamento Superficial</label>
              <select
                value={finish}
                onChange={(e) => onFinishChange?.(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-sans text-xs text-white outline-none focus:border-red-500"
              >
                <option value="Bruto Laminado">Bruto Laminado (Natural)</option>
                <option value="Decapado e Oleado">Decapado e Oleado (Clean)</option>
                <option value="Escovado (Scotch-Brite)">Escovado (Scotch-Brite)</option>
                <option value="Jateado com Granalla">Jateado com Granalha</option>
                <option value="Pintura Eletrostática">Pintura Eletrostática Pó</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. GRUPO PROCESSO (CORES TÉCNICAS CANÔNICAS DO CHAMFER)              */}
      {/* ===================================================================== */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
        <div
          onClick={() => toggleSection("processo")}
          className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
              2. Processo de Fabricação
            </span>
          </div>
          {collapsedSections.processo ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>

        {!collapsedSections.processo && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[9px] text-slate-400">
              {selection.length > 0
                ? `Aplicar processo às ${selection.length} entidades selecionadas:`
                : "Selecione entidades no canvas para atribuir o processo:"}
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {/* CORTE (BRANCO TÉCNICO ABNT) */}
              <button
                type="button"
                disabled={selection.length === 0}
                onClick={() => assignProcessToSelection("corte")}
                className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/60 p-2 text-left hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <span className="size-2.5 rounded-full bg-white shrink-0 border border-slate-400 shadow-2xs" />
                <div>
                  <div className="font-sans text-xs font-bold text-white">Corte</div>
                  <div className="font-mono text-[8px] text-slate-300">Contorno externo (Branco)</div>
                </div>
              </button>

              {/* MARCAÇÃO (AZUL) */}
              <button
                type="button"
                disabled={selection.length === 0}
                onClick={() => assignProcessToSelection("marcacao")}
                className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/30 p-2 text-left hover:bg-blue-950/60 disabled:opacity-40 transition-colors"
              >
                <span className="size-2.5 rounded-full bg-[#3B82F6] shrink-0" />
                <div>
                  <div className="font-sans text-xs font-bold text-blue-400">Marcação</div>
                  <div className="font-mono text-[8px] text-blue-500/70">Gravação rasa</div>
                </div>
              </button>

              {/* DOBRA (ROSA) */}
              <button
                type="button"
                disabled={selection.length === 0}
                onClick={() => assignProcessToSelection("dobra")}
                className="flex items-center gap-2 rounded-xl border border-pink-500/40 bg-pink-950/30 p-2 text-left hover:bg-pink-950/60 disabled:opacity-40 transition-colors"
              >
                <span className="size-2.5 rounded-full bg-[#EC4899] shrink-0" />
                <div>
                  <div className="font-sans text-xs font-bold text-pink-400">Dobra</div>
                  <div className="font-mono text-[8px] text-pink-500/70">Linha de vinco</div>
                </div>
              </button>

              {/* RECORTE (ÂMBAR) */}
              <button
                type="button"
                disabled={selection.length === 0}
                onClick={() => assignProcessToSelection("recorte")}
                className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 p-2 text-left hover:bg-amber-950/60 disabled:opacity-40 transition-colors"
              >
                <span className="size-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                <div>
                  <div className="font-sans text-xs font-bold text-amber-400">Recorte</div>
                  <div className="font-mono text-[8px] text-amber-500/70">Alívio e furos</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 3. GRUPO PARÂMETROS DE CORTE                                          */}
      {/* ===================================================================== */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
        <div
          onClick={() => toggleSection("parametros")}
          className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
        >
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
            3. Parâmetros de Usinagem
          </span>
          {collapsedSections.parametros ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>

        {!collapsedSections.parametros && (
          <div className="flex flex-col gap-1.5">
            {renderNumericField({
              key: "kerf",
              label: "Folga do Feixe (Kerf)",
              symbol: "K",
              value: kerf,
              unit: "mm",
              min: 0.05,
              max: 3.0,
              decimals: 2,
              defaultStep: 0.05,
              stepOptions: [0.05, 0.1, 0.2, 0.5],
            })}

            {renderNumericField({
              key: "tolerance",
              label: "Tolerância de Corte",
              symbol: "±",
              value: tolerance,
              unit: "mm",
              min: 0.01,
              max: 2.0,
              decimals: 2,
              defaultStep: 0.05,
              stepOptions: [0.01, 0.05, 0.1, 0.2],
            })}

            {/* Compensação de Raio */}
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="font-mono text-[10px] text-slate-400">Compensação de Raio</span>
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                {(["left", "center", "right"] as const).map((comp) => (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => onCompensationChange?.(comp)}
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[9px] font-semibold transition-colors",
                      compensation === comp
                        ? "bg-red-600 text-white"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {comp === "left" ? "G41 (Esq)" : comp === "right" ? "G42 (Dir)" : "Centro"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 4. GRUPO PREPARAÇÃO PARA CNC                                         */}
      {/* ===================================================================== */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
        <div
          onClick={() => toggleSection("cnc")}
          className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
        >
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
            4. Preparação & Sequência CNC
          </span>
          {collapsedSections.cnc ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>

        {!collapsedSections.cnc && (
          <div className="flex flex-col gap-2">
            {/* Métricas Reais do Plano de Corte */}
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 flex flex-col">
                <span className="text-slate-400 text-[9px]">Percurso de Corte</span>
                <span className="font-bold text-white text-xs">{(stats.totalMm / 1000).toFixed(2)} m</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 flex flex-col">
                <span className="text-slate-400 text-[9px]">Perfurações (Pierces)</span>
                <span className="font-bold text-white text-xs">{stats.paths} pontos</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 flex flex-col">
                <span className="text-slate-400 text-[9px]">Tempo Estimado</span>
                <span className="font-bold text-red-400 text-xs">~{cutTimeSeconds}s</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 flex flex-col">
                <span className="text-slate-400 text-[9px]">Área de Chapa</span>
                <span className="font-bold text-white text-xs">{(stats.areaMm2 / 1e6).toFixed(3)} m²</span>
              </div>
            </div>

            {/* Ações de Otimização e Sentido */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={handleOptimizeSequence}
                title="Otimizar ordem (furos internos primeiro, contorno externo por último)"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 py-1.5 font-mono text-[10px] font-bold text-slate-200 hover:border-red-500 hover:bg-slate-800 transition-colors"
              >
                <Wand2 className="size-3.5 text-red-400" />
                <span>Otimizar Sequência CNC</span>
              </button>

              {selection.length > 0 && (
                <button
                  type="button"
                  onClick={handleReverseSelection}
                  title="Inverter direção de avanço do percurso selecionado"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 py-1.5 font-mono text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowRightLeft className="size-3.5 text-slate-400" />
                  <span>Inverter Sentido (Horário ↔ Anti-horário)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
