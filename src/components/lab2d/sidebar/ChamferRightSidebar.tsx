/**
 * CALDRA CHAMFER — JANELA LATERAL DIREITA REESTRUTURADA (CHAMFER 2D)
 *
 * Reúne de forma integrada e compacta:
 * - ABA 1: PROPRIEDADES (Inspetor CAD contextual com editor numérico compacto)
 * - ABA 2: CAMADAS (Gestão completa de camadas, visibilidade, bloqueio, cores técnicas)
 * - ABA 3: CORTE (Material, Processo, Parâmetros e Preparação CNC)
 * - ABA 4: COTAS (Gestão de cotagem associativa)
 *
 * Responsividade & Canvas Priority:
 * - Permite expandir/recolher a qualquer momento.
 * - Ao recolher, o canvas recupera automaticamente todo o espaço.
 * - No mobile landscape, mantém proporções compactas sem sobrepor a peça.
 */

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Layers,
  Scissors,
  Ruler,
  ChevronRight,
  ChevronLeft,
  X,
  Maximize2,
  Minimize2,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity, Layer } from "@/lib/lab2d/core";
import type { Dimension, DimKind } from "@/lib/lab2d/dimensions";
import type { ShareCandidate } from "@/lib/lab2d/sharedCut";
import { ChamferPropertiesTab } from "./ChamferPropertiesTab";
import { ChamferLayersTab } from "./ChamferLayersTab";
import { ChamferCutTab } from "./ChamferCutTab";

export type ChamferSidebarTab = "propriedades" | "camadas" | "corte" | "cotas";

interface ChamferRightSidebarProps {
  open: boolean;
  onToggleOpen: () => void;
  activeTab: ChamferSidebarTab;
  onTabChange: (tab: ChamferSidebarTab) => void;
  // Geometria e Seleção
  entities: Entity[];
  selection: string[];
  setSelection: (ids: string[]) => void;
  commit: (updater: Entity[] | ((prev: Entity[]) => Entity[])) => void;
  // Camadas
  layers: Layer[];
  setLayers: (layers: Layer[] | ((prev: Layer[]) => Layer[])) => void;
  activeLayer: string;
  setActiveLayer: (layerId: string) => void;
  // Propriedades do Projeto
  thickness: number;
  onThicknessChange: (th: number) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  material: string;
  onMaterialChange: (mat: string) => void;
  kFactor?: number;
  onKFactorChange?: (k: number) => void;
  bendRadius?: number;
  onBendRadiusChange?: (r: number) => void;
  finish?: string;
  onFinishChange?: (f: string) => void;
  // Cotas
  dims?: Dimension[];
  onDimsChange?: (dims: Dimension[]) => void;
  dimKind?: DimKind;
  onDimKindChange?: (k: DimKind) => void;
  dimSel?: string | null;
  onDimSelect?: (id: string | null) => void;
  renderCotas?: () => React.ReactNode;
  onDivideEntity?: (e: Entity) => void;
  // Callbacks de corte
  onHighlightCut?: (cand: ShareCandidate | null) => void;
  isDark?: boolean;
  className?: string;
}

export function ChamferRightSidebar({
  open,
  onToggleOpen,
  activeTab,
  onTabChange,
  entities,
  selection,
  setSelection,
  commit,
  layers,
  setLayers,
  activeLayer,
  setActiveLayer,
  thickness,
  onThicknessChange,
  projectName,
  onProjectNameChange,
  material,
  onMaterialChange,
  kFactor,
  onKFactorChange,
  bendRadius,
  onBendRadiusChange,
  finish,
  onFinishChange,
  dims = [],
  onDimsChange,
  dimKind = "linear",
  onDimKindChange,
  dimSel = null,
  onDimSelect,
  renderCotas,
  onDivideEntity,
  onHighlightCut,
  isDark = true,
  className,
}: ChamferRightSidebarProps) {
  // Se a barra estiver fechada / recolhida, exibe o mini-dock lateral
  if (!open) {
    return (
      <aside
        className={cn(
          "relative z-30 flex flex-col items-center justify-start border-l bg-slate-950/90 py-2 select-none shadow-md backdrop-blur-md transition-all w-9 shrink-0",
          isDark ? "border-slate-800 text-slate-400" : "border-slate-200 bg-white/90 text-slate-600"
        )}
      >
        {/* Botão de Expandir Painel */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onToggleOpen();
          }}
          title="Expandir Janela Lateral Direita (Propriedades / Camadas / Corte)"
          aria-label="Expandir Janela Lateral"
          className="mb-3 flex size-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:border-red-500 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Abas Rápidas no Mini-Dock */}
        <div className="flex flex-col gap-2">
          {/* PROPRIEDADES */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onTabChange("propriedades");
              onToggleOpen();
            }}
            title="Propriedades CAD"
            className={cn(
              "flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer",
              activeTab === "propriedades"
                ? "bg-red-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Sliders className="size-3.5" />
          </button>

          {/* CAMADAS */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onTabChange("camadas");
              onToggleOpen();
            }}
            title="Camadas Técnicas"
            className={cn(
              "flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer",
              activeTab === "camadas"
                ? "bg-red-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Layers className="size-3.5" />
          </button>

          {/* CORTE */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onTabChange("corte");
              onToggleOpen();
            }}
            title="Plano de Corte e Fabricação"
            className={cn(
              "flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer",
              activeTab === "corte"
                ? "bg-red-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Scissors className="size-3.5" />
          </button>

          {/* COTAS */}
          {dims.length > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onTabChange("cotas");
                onToggleOpen();
              }}
              title="Cotas"
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer",
                activeTab === "cotas"
                  ? "bg-red-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Ruler className="size-3.5" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // -------------------------------------------------------------------------
  // JANELA LATERAL DIREITA COMPACTA EXPANDIDA
  // -------------------------------------------------------------------------
  return (
    <aside
      className={cn(
        "relative z-30 flex w-[265px] sm:w-[285px] shrink-0 flex-col overflow-hidden border-l select-none shadow-xl backdrop-blur-md transition-all",
        isDark
          ? "border-slate-800 bg-slate-950/95 text-slate-100"
          : "border-slate-200 bg-white/95 text-slate-800",
        className
      )}
    >
      {/* ---------------------------------------------------- */}
      {/* CABEÇALHO COM ABAS (PROPRIEDADES, CAMADAS, CORTE)    */}
      {/* ---------------------------------------------------- */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-800/80 px-2 bg-slate-900/60">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* ABA PROPRIEDADES */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onTabChange("propriedades");
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
              activeTab === "propriedades"
                ? "bg-red-600 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Sliders className="size-3" />
            <span>PROPRIEDADES</span>
          </button>

          {/* ABA CAMADAS */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onTabChange("camadas");
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
              activeTab === "camadas"
                ? "bg-red-600 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Layers className="size-3" />
            <span>CAMADAS</span>
          </button>

          {/* ABA CORTE */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onTabChange("corte");
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
              activeTab === "corte"
                ? "bg-red-600 text-white shadow-xs"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Scissors className="size-3" />
            <span>CORTE</span>
          </button>

          {/* ABA COTAS (quando disponível) */}
          {renderCotas && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onTabChange("cotas");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer",
                activeTab === "cotas"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <Ruler className="size-3" />
              <span>COTAS</span>
            </button>
          )}
        </div>

        {/* Botão de Recolher Janela */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onToggleOpen();
          }}
          title="Recolher janela lateral (recuperar espaço do canvas)"
          aria-label="Recolher janela lateral"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer ml-1"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CONTEÚDO SCROLLÁVEL DA ABA ATIVA                     */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2.5 scrollbar-thin">
        {activeTab === "propriedades" && (
          <ChamferPropertiesTab
            entities={entities}
            selection={selection}
            setSelection={setSelection}
            layers={layers}
            thickness={thickness}
            onThicknessChange={onThicknessChange}
            onUpdateEntity={(updated) => {
              commit((list) => list.map((x) => (x.id === updated.id ? updated : x)));
            }}
            onDeleteEntity={(id) => {
              commit((list) => list.filter((x) => x.id !== id));
            }}
            onDuplicateEntity={(ent) => {
              commit((list) => [...list, ent]);
            }}
            onDivideEntity={onDivideEntity}
            projectName={projectName}
            onProjectNameChange={onProjectNameChange}
            material={material}
            onMaterialChange={onMaterialChange}
            kFactor={kFactor}
            onKFactorChange={onKFactorChange}
            bendRadius={bendRadius}
            onBendRadiusChange={onBendRadiusChange}
            isDark={isDark}
          />
        )}

        {activeTab === "camadas" && (
          <ChamferLayersTab
            layers={layers}
            setLayers={setLayers}
            activeLayer={activeLayer}
            setActiveLayer={setActiveLayer}
            entities={entities}
            setSelection={setSelection}
            commit={commit}
            isDark={isDark}
          />
        )}

        {activeTab === "corte" && (
          <ChamferCutTab
            entities={entities}
            commit={commit}
            selection={selection}
            setSelection={setSelection}
            thickness={thickness}
            onThicknessChange={onThicknessChange}
            material={material}
            onMaterialChange={onMaterialChange}
            finish={finish}
            onFinishChange={onFinishChange}
            onHighlightCut={onHighlightCut}
            isDark={isDark}
          />
        )}

        {activeTab === "cotas" && (
          <div className="p-1">
            {renderCotas?.()}
          </div>
        )}
      </div>
    </aside>
  );
}
