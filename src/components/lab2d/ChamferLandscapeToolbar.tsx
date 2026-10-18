// @ts-nocheck
/**
 * CALDRA CHAMFER — TOOLBAR SUPERIOR LANDSCAPE (RIBBON CAD)
 *
 * Barra de ferramentas horizontal profissional acima do canvas:
 * 5 Grupos funcionais canônicos:
 *  1. DESENHAR: Linha, Polilinha, Círculo, Arco, Retângulo, Polígono, Elipse, Ponto.
 *  2. MODIFICAR: Mover, Copiar, Girar, Espelhar, Escalar, Offset, Aparar, Estender,
 *                Esticar, Filete, Chanfro, Quebrar, Unir, Explodir, Array.
 *  3. PRECISÃO: Snap (com pontos notáveis), Grade, Orto, Rastreamento, Coordenadas.
 *  4. COTAR: Linear, Horizontal, Vertical, Alinhada, Angular, Raio, Diâmetro,
 *            Comprimento de arco, Centro-a-centro, Coordenadas, Medir.
 *  5. CHAPA: Chapa (espessura/material), Dobra, Furo, Planificar, Flange, Alívio,
 *            Corte, Recorte, Unfold, Fold.
 */

import React, { useState } from "react";
import {
  Minus,
  PenLine,
  Circle as CircleIcon,
  Compass,
  Square,
  Hexagon,
  Egg,
  Dot,
  Move,
  Copy,
  RotateCw,
  FlipHorizontal,
  Maximize2,
  Minimize2,
  Scissors,
  CornerDownRight,
  Maximize,
  Sparkles,
  Split,
  Combine,
  Divide,
  Grid,
  Magnet,
  Crosshair,
  Compass as CompassIcon,
  Ruler,
  Layers,
  Box,
  FileCode2,
  Hammer,
  FoldHorizontal,
  ChevronDown,
  Check,
  Disc,
  Flame,
  ArrowRightLeft,
  CircleDot,
  AlignCenter,
} from "lucide-react";
import type { Tool } from "./Lab2DEditor";
import type { DimKind } from "@/lib/lab2d/dimensions";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";

export type RibbonTab = "desenhar" | "modificar" | "precisao" | "cotar" | "chapa";

interface ChamferLandscapeToolbarProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  tool: Tool;
  onPickTool: (tool: Tool) => void;
  // Modificadores
  hasSelection: boolean;
  selectedCount: number;
  offsetDist: number;
  setOffsetDist: (v: number) => void;
  filletR: number;
  setFilletR: (v: number) => void;
  onMoveSelection: () => void;
  onCopySelection: () => void;
  onRotateSelection: () => void;
  onMirrorSelection: () => void;
  onScaleSelection: () => void;
  onStretchSelection: () => void;
  onBreakSelection: () => void;
  onJoinSelection: () => void;
  onExplodeSelection: () => void;
  onDivideSelection?: () => void;
  onCenterSelection?: () => void;
  onArrayLinear: () => void;
  onArrayPolar: () => void;
  // Precisão
  snapOn: boolean;
  setSnapOn: (fn: (v: boolean) => boolean) => void;
  showGrid: boolean;
  setShowGrid: (fn: (v: boolean) => boolean) => void;
  grid: number;
  setGrid: (v: number) => void;
  orthoOn: boolean;
  setOrthoOn: (fn: (v: boolean) => boolean) => void;
  trackingOn: boolean;
  setTrackingOn: (fn: (v: boolean) => boolean) => void;
  cursor: { x: number; y: number };
  onApplyCoordinate: (x: number, y: number) => void;
  // Cotas
  dimKind: DimKind;
  onPickDimKind: (kind: DimKind) => void;
  // Chapa
  thickness: number;
  onThicknessChange: (t: number) => void;
  onConvertToBend: () => void;
  onAddHole: () => void;
  onPlanificar: () => void;
  onOpenFlanges: () => void;
  onApplyRelief: () => void;
  onConvertToCut: () => void;
  onConvertToRecorte: () => void;
  onUnfold: () => void;
  onFold: () => void;
}

export function ChamferLandscapeToolbar({
  activeTab,
  onTabChange,
  tool,
  onPickTool,
  hasSelection,
  selectedCount,
  offsetDist,
  setOffsetDist,
  filletR,
  setFilletR,
  onMoveSelection,
  onCopySelection,
  onRotateSelection,
  onMirrorSelection,
  onScaleSelection,
  onStretchSelection,
  onBreakSelection,
  onJoinSelection,
  onExplodeSelection,
  onDivideSelection,
  onCenterSelection,
  onArrayLinear,
  onArrayPolar,
  snapOn,
  setSnapOn,
  showGrid,
  setShowGrid,
  grid,
  setGrid,
  orthoOn,
  setOrthoOn,
  trackingOn,
  setTrackingOn,
  cursor,
  onApplyCoordinate,
  dimKind,
  onPickDimKind,
  thickness,
  onThicknessChange,
  onConvertToBend,
  onAddHole,
  onPlanificar,
  onOpenFlanges,
  onApplyRelief,
  onConvertToCut,
  onConvertToRecorte,
  onUnfold,
  onFold,
}: ChamferLandscapeToolbarProps) {
  const [snapMenuOpen, setSnapMenuOpen] = useState(false);
  const [arrayMenuOpen, setArrayMenuOpen] = useState(false);
  const [chapaMenuOpen, setChapaMenuOpen] = useState(false);
  const [coordInputX, setCoordInputX] = useState("");
  const [coordInputY, setCoordInputY] = useState("");

  const handleCoordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(coordInputX);
    const y = parseFloat(coordInputY);
    if (!isNaN(x) && !isNaN(y)) {
      onApplyCoordinate(x, y);
      setCoordInputX("");
      setCoordInputY("");
    }
  };

  return (
    <nav
      aria-label="Barra de ferramentas CAD"
      className="flex shrink-0 flex-col border-b border-line bg-card/60 backdrop-blur-md transition-all select-none"
    >
      {/* 1. LINHA DE ABAS PRINCIPAIS DO RIBBON */}
      <div className="flex h-8 items-center justify-between border-b border-line/60 px-2.5">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "desenhar", label: "DESENHAR" },
              { id: "modificar", label: "MODIFICAR" },
              { id: "precisao", label: "PRECISÃO" },
              { id: "cotar", label: "COTAR" },
              { id: "chapa", label: "CHAPA" },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  onTabChange(tab.id);
                }}
                className={cn(
                  "relative flex h-7 items-center px-3 font-mono text-[10px] font-bold tracking-wider uppercase transition-colors",
                  isActive
                    ? "text-accent after:absolute after:bottom-0 after:left-1 after:right-1 after:h-[2px] after:bg-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* INDICADOR RÁPIDO DO MODO E SELEÇÃO */}
        <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground">
          {hasSelection && (
            <span className="flex items-center gap-1 text-accent font-semibold">
              <Check className="size-3" /> {selectedCount} selecionado(s)
            </span>
          )}
          <span className="hidden sm:inline">
            COORDS: X {cursor.x.toFixed(1)} · Y {cursor.y.toFixed(1)} mm
          </span>
        </div>
      </div>

      {/* 2. CONTEÚDO DA ABA ATIVA */}
      <div className="flex min-h-10 items-center gap-1.5 overflow-x-auto px-2 py-1 scrollbar-none">
        {/* ============================================================== */}
        {/* ABA: DESENHAR */}
        {/* ============================================================== */}
        {activeTab === "desenhar" && (
          <div className="flex items-center gap-1">
            <RibbonBtn
              active={tool === "line"}
              onClick={() => onPickTool("line")}
              icon={Minus}
              label="Linha"
              shortcut="L"
            />
            <RibbonBtn
              active={tool === "polyline"}
              onClick={() => onPickTool("polyline")}
              icon={PenLine}
              label="Polilinha"
              shortcut="P"
            />
            <RibbonBtn
              active={tool === "circle"}
              onClick={() => onPickTool("circle")}
              icon={CircleIcon}
              label="Círculo"
              shortcut="C"
            />
            <RibbonBtn
              active={tool === "arc"}
              onClick={() => onPickTool("arc")}
              icon={Compass}
              label="Arco"
              shortcut="A"
            />
            <RibbonBtn
              active={tool === "rect"}
              onClick={() => onPickTool("rect")}
              icon={Square}
              label="Retângulo"
              shortcut="R"
            />
            <RibbonBtn
              active={tool === "polygon"}
              onClick={() => onPickTool("polygon")}
              icon={Hexagon}
              label="Polígono"
              shortcut="G"
            />
            <RibbonBtn
              active={tool === "ellipse"}
              onClick={() => onPickTool("ellipse")}
              icon={Egg}
              label="Elipse"
            />
            <RibbonBtn
              active={tool === "point"}
              onClick={() => onPickTool("point")}
              icon={Dot}
              label="Ponto"
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: MODIFICAR */}
        {/* ============================================================== */}
        {activeTab === "modificar" && (
          <div className="flex items-center gap-1">
            <RibbonBtn
              disabled={!hasSelection}
              onClick={onMoveSelection}
              icon={Move}
              label="Mover"
              title="Move seleção por translação ou vetor"
            />
            <RibbonBtn
              disabled={!hasSelection}
              onClick={onCopySelection}
              icon={Copy}
              label="Copiar"
              title="Copia as entidades selecionadas para a Área de Transferência (Ctrl+C)"
            />
            <RibbonBtn
              disabled={!hasSelection}
              onClick={onRotateSelection}
              icon={RotateCw}
              label="Girar 90°"
              title="Gira seleção em 90° em torno do centro"
            />
            <RibbonBtn
              disabled={!hasSelection}
              onClick={onMirrorSelection}
              icon={FlipHorizontal}
              label="Espelhar"
              title="Espelha seleção pelo eixo central"
            />
            <RibbonBtn
              disabled={!hasSelection}
              onClick={onScaleSelection}
              icon={Maximize2}
              label="Escalar"
              title="Escala proporcional da seleção"
            />

            <div className="mx-1 h-5 w-px bg-line" />

            {/* OFFSET */}
            <div className="flex items-center gap-1 rounded-md border border-line bg-background/50 px-1.5 py-0.5">
              <RibbonBtn
                active={tool === "offset"}
                onClick={() => onPickTool("offset")}
                icon={CircleDot}
                label="Offset"
                shortcut="O"
              />
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={offsetDist}
                onChange={(e) => setOffsetDist(Math.max(0.1, Number(e.target.value) || 1))}
                aria-label="Distância de offset em milímetros"
                className="w-12 rounded bg-background px-1 text-center font-mono text-[10px] text-accent outline-none"
              />
              <span className="font-mono text-[9px] text-muted-foreground">mm</span>
            </div>

            {/* APARAR / ESTENDER */}
            <RibbonBtn
              active={tool === "trim"}
              onClick={() => onPickTool("trim")}
              icon={Scissors}
              label="Aparar"
              shortcut="TR"
            />
            <RibbonBtn
              active={tool === "smart_trim"}
              onClick={() => onPickTool("smart_trim")}
              icon={Scissors}
              label="Aparar Encontro"
              title="Apara automaticamente no primeiro limite ou encontro geométrico"
            />
            <RibbonBtn
              active={tool === "extend"}
              onClick={() => onPickTool("extend")}
              icon={CornerDownRight}
              label="Estender"
              shortcut="EX"
            />
            <RibbonBtn
              onClick={onStretchSelection}
              icon={Maximize}
              label="Esticar"
              title="Estica vértices das entidades selecionadas"
            />

            <div className="mx-1 h-5 w-px bg-line" />

            {/* FILETE / CHANFRO */}
            <div className="flex items-center gap-1 rounded-md border border-line bg-background/50 px-1.5 py-0.5">
              <RibbonBtn
                active={tool === "fillet"}
                onClick={() => onPickTool("fillet")}
                icon={Sparkles}
                label="Filete"
                shortcut="F"
              />
              <RibbonBtn
                active={tool === "chamfer"}
                onClick={() => onPickTool("chamfer")}
                icon={Minus}
                label="Chanfro"
              />
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={filletR}
                onChange={(e) => setFilletR(Math.max(0.5, Number(e.target.value) || 1))}
                aria-label="Raio ou distância do filete e chanfro"
                className="w-12 rounded bg-background px-1 text-center font-mono text-[10px] text-accent outline-none"
              />
              <span className="font-mono text-[9px] text-muted-foreground">mm</span>
            </div>

            <div className="mx-1 h-5 w-px bg-line" />

            {/* QUEBRAR / UNIR / EXPLODIR */}
            <RibbonBtn
              onClick={onBreakSelection}
              icon={Split}
              label="Quebrar"
              title="Quebra a entidade no ponto indicado"
            />
            <RibbonBtn
              disabled={!hasSelection || selectedCount < 2}
              onClick={onJoinSelection}
              icon={Combine}
              label="Unir"
              title="Une linhas contíguas em uma única polilinha"
            />
            <RibbonBtn
              disabled={!hasSelection}
              onClick={onExplodeSelection}
              icon={Grid}
              label="Explodir"
              title="Explode polilinha ou retângulo em linhas avulsas"
            />
            <RibbonBtn
              active={tool === "divide"}
              onClick={() => {
                if (onDivideSelection && hasSelection) {
                  onDivideSelection();
                } else {
                  onPickTool("divide");
                }
              }}
              icon={Divide}
              label="Dividir"
              title="Divide peça ou contorno em N partes iguais (2 a 50)"
            />
            <RibbonBtn
              active={tool === "center"}
              disabled={!hasSelection || selectedCount < 2}
              onClick={() => {
                if (onCenterSelection) {
                  onCenterSelection();
                } else {
                  onPickTool("center");
                }
              }}
              icon={AlignCenter}
              label="Centralizar"
              title="Centraliza formas geometricamente (centroide ou bounding box)"
            />

            {/* ARRAY */}
            <div className="relative">
              <RibbonBtn
                disabled={!hasSelection}
                onClick={() => setArrayMenuOpen((v) => !v)}
                icon={Grid}
                label="Array"
                chevron
              />
              {arrayMenuOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-36 rounded-md border border-line bg-popover p-1 shadow-lg backdrop-blur">
                  <button
                    type="button"
                    onClick={() => {
                      onArrayLinear();
                      setArrayMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <Grid className="size-3" /> Linear (3×3)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onArrayPolar();
                      setArrayMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <CircleDot className="size-3" /> Polar (6x 360°)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: PRECISÃO */}
        {/* ============================================================== */}
        {activeTab === "precisao" && (
          <div className="flex items-center gap-2">
            {/* SNAP */}
            <div className="relative flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSnapOn((s) => !s)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 font-mono text-[10px] font-semibold uppercase transition-colors border",
                  snapOn
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : "border-line bg-background/50 text-muted-foreground hover:text-foreground",
                )}
              >
                <Magnet className="size-3.5" />
                SNAP: {snapOn ? "ATIVO" : "DESL."}
              </button>
              <button
                type="button"
                onClick={() => setSnapMenuOpen((v) => !v)}
                className="flex h-7 items-center rounded-md border border-line bg-background/50 px-1 text-muted-foreground hover:text-foreground"
                aria-label="Opções de pontos notáveis de Snap"
              >
                <ChevronDown className="size-3" />
              </button>

              {snapMenuOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-44 rounded-md border border-line bg-popover p-2 font-mono text-[10px] shadow-lg backdrop-blur">
                  <p className="mb-1.5 text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Pontos de Captura
                  </p>
                  <div className="space-y-1 text-foreground/80">
                    <div className="flex items-center gap-1.5 text-accent">
                      <Check className="size-3" /> Extremidade (End)
                    </div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Check className="size-3" /> Meio (Midpoint)
                    </div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Check className="size-3" /> Centro (Circle/Arc)
                    </div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Check className="size-3" /> Interseção (Cross)
                    </div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Check className="size-3" /> Perpendicular
                    </div>
                    <div className="flex items-center gap-1.5 text-accent">
                      <Check className="size-3" /> Quadrante / Origem
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GRADE */}
            <div className="flex items-center gap-1 rounded-md border border-line bg-background/50 px-2 py-0.5">
              <button
                type="button"
                onClick={() => setShowGrid((g) => !g)}
                className={cn(
                  "font-mono text-[10px] font-semibold uppercase transition-colors",
                  showGrid ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                GRADE: {showGrid ? "ON" : "OFF"}
              </button>
              <div className="mx-1 h-3.5 w-px bg-line" />
              {[1, 5, 10, 25, 50].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setGrid(step)}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[9px] transition-colors",
                    grid === step
                      ? "bg-accent/20 font-bold text-accent"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {step}
                </button>
              ))}
              <span className="font-mono text-[9px] text-muted-foreground">mm</span>
            </div>

            {/* ORTO */}
            <button
              type="button"
              onClick={() => setOrthoOn((o) => !o)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 font-mono text-[10px] font-semibold uppercase transition-colors border",
                orthoOn
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-line bg-background/50 text-muted-foreground hover:text-foreground",
              )}
              title="Restringe desenho a direções ortogonais (0°, 90°, 180°, 270°)"
            >
              <Crosshair className="size-3.5" />
              ORTO: {orthoOn ? "LIGADO" : "DESL."}
            </button>

            {/* RASTREAMENTO */}
            <button
              type="button"
              onClick={() => setTrackingOn((t) => !t)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 font-mono text-[10px] font-semibold uppercase transition-colors border",
                trackingOn
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                  : "border-line bg-background/50 text-muted-foreground hover:text-foreground",
              )}
              title="Exibe linhas de referência temporárias para alinhamento"
            >
              <CompassIcon className="size-3.5" />
              RASTREAMENTO: {trackingOn ? "ON" : "OFF"}
            </button>

            {/* ENTRADA DE COORDENADAS */}
            <form onSubmit={handleCoordSubmit} className="flex items-center gap-1">
              <label className="font-mono text-[9px] text-muted-foreground">X:</label>
              <input
                type="number"
                step="any"
                placeholder={cursor.x.toFixed(1)}
                value={coordInputX}
                onChange={(e) => setCoordInputX(e.target.value)}
                aria-label="Coordenada X"
                className="w-14 rounded border border-line bg-background px-1 py-0.5 text-center font-mono text-[9px] text-accent outline-none"
              />
              <label className="font-mono text-[9px] text-muted-foreground">Y:</label>
              <input
                type="number"
                step="any"
                placeholder={cursor.y.toFixed(1)}
                value={coordInputY}
                onChange={(e) => setCoordInputY(e.target.value)}
                aria-label="Coordenada Y"
                className="w-14 rounded border border-line bg-background px-1 py-0.5 text-center font-mono text-[9px] text-accent outline-none"
              />
              <button
                type="submit"
                className="rounded border border-line bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent hover:bg-accent/10"
              >
                Ir
              </button>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: COTAR */}
        {/* ============================================================== */}
        {activeTab === "cotar" && (
          <div className="flex items-center gap-1">
            <RibbonBtn
              active={tool === "dim" && dimKind === "linear"}
              onClick={() => onPickDimKind("linear")}
              icon={Ruler}
              label="Linear"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "horizontal"}
              onClick={() => onPickDimKind("horizontal")}
              icon={Minus}
              label="Horizontal"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "vertical"}
              onClick={() => onPickDimKind("vertical")}
              icon={Minus}
              className="rotate-90"
              label="Vertical"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "aligned"}
              onClick={() => onPickDimKind("aligned")}
              icon={Ruler}
              label="Alinhada"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "angle"}
              onClick={() => onPickDimKind("angle")}
              icon={Compass}
              label="Angular"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "radius"}
              onClick={() => onPickDimKind("radius")}
              icon={CircleDot}
              label="Raio"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "diameter"}
              onClick={() => onPickDimKind("diameter")}
              icon={Disc}
              label="Diâmetro"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "arc-length"}
              onClick={() => onPickDimKind("arc-length")}
              icon={Compass}
              label="Comp. Arco"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "center-distance"}
              onClick={() => onPickDimKind("center-distance")}
              icon={ArrowRightLeft}
              label="Centro-a-Centro"
            />
            <RibbonBtn
              active={tool === "dim" && dimKind === "coord-x"}
              onClick={() => onPickDimKind("coord-x")}
              icon={Crosshair}
              label="Coordenadas"
            />
            <div className="mx-1 h-5 w-px bg-line" />
            <RibbonBtn
              active={tool === "measure"}
              onClick={() => onPickTool("measure")}
              icon={Ruler}
              label="Medir"
              shortcut="M"
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: CHAPA */}
        {/* ============================================================== */}
        {activeTab === "chapa" && (
          <div className="flex items-center gap-1.5">
            {/* SELETOR DE ESPESSURA */}
            <div className="flex items-center gap-1.5 rounded-md border border-line bg-background/50 px-2 py-0.5">
              <Box className="size-3.5 text-accent" />
              <span className="font-mono text-[9px] font-bold text-muted-foreground uppercase">
                Chapa:
              </span>
              <select
                value={thickness}
                onChange={(e) => onThicknessChange(Number(e.target.value))}
                aria-label="Espessura da chapa"
                className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent outline-none"
              >
                {[0.8, 1.0, 1.2, 1.5, 2.0, 2.65, 3.0, 4.75, 6.35, 8.0, 9.5, 12.7].map((gauge) => (
                  <option key={gauge} value={gauge}>
                    {gauge} mm
                  </option>
                ))}
              </select>
            </div>

            <RibbonBtn
              onClick={onConvertToBend}
              icon={FoldHorizontal}
              label="Dobra"
              title="Transforma linha selecionada em linha de dobra"
            />
            <RibbonBtn
              onClick={onAddHole}
              icon={Disc}
              label="Furo"
              title="Insere furo circular calibrado na chapa"
            />
            <RibbonBtn
              onClick={onPlanificar}
              icon={FileCode2}
              label="Planificar"
              title="Gera Flat Pattern real da peça"
            />

            {/* EXPANSÃO CHAPA (FLANGE, ALÍVIO, CORTE, RECORTE, UNFOLD, FOLD) */}
            <div className="relative">
              <RibbonBtn
                onClick={() => setChapaMenuOpen((v) => !v)}
                icon={Hammer}
                label="Mais Chapa"
                chevron
              />

              {chapaMenuOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-44 rounded-md border border-line bg-popover p-1 shadow-lg backdrop-blur">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFlanges();
                      setChapaMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <Hammer className="size-3 text-accent" /> Flange de Aresta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyRelief();
                      setChapaMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <Scissors className="size-3" /> Alívio de Canto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onConvertToCut();
                      setChapaMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <Flame className="size-3 text-amber-500" /> Camada de Corte
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onConvertToRecorte();
                      setChapaMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <Scissors className="size-3 text-rose-500" /> Camada de Recorte
                  </button>
                  <div className="my-1 h-px bg-line" />
                  <button
                    type="button"
                    onClick={() => {
                      onUnfold();
                      setChapaMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <FileCode2 className="size-3" /> Desdobrar (Unfold)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onFold();
                      setChapaMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-[10px] hover:bg-accent/15 hover:text-accent"
                  >
                    <Box className="size-3" /> Dobrar 100% (Fold)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function RibbonBtn({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
  shortcut,
  title,
  chevron,
  className,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  title?: string;
  chevron?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        triggerHaptic("tap");
        onClick();
      }}
      title={title ?? label}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 font-mono text-[10px] transition-colors border",
        active
          ? "border-accent/40 bg-accent/20 text-accent font-semibold shadow-xs"
          : "border-transparent bg-background/40 text-muted-foreground hover:bg-background/80 hover:text-foreground",
        disabled && "opacity-35 pointer-events-none",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span>{label}</span>
      {shortcut && <span className="text-[8px] opacity-60">[{shortcut}]</span>}
      {chevron && <ChevronDown className="size-3 opacity-60 ml-0.5" />}
    </button>
  );
}
