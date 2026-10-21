/**
 * CALDRA CHAMFER — TOOLBAR VERTICAL CAD CANÔNICA (FASE UI/UX DEFINITIVA)
 *
 * Estrutura vertical compacta organizada por função / intenção:
 * 1. SELECIONAR: Ponteiro (V), Caixa de Seleção, Nós/Vértices, Pan (Mover Tela)
 * 2. CRIAR: Linha (L), Polilinha (P), Círculo (C), Arco (A), Retângulo (R),
 *           Polígono, Elipse, Ponto, Texto, Extrude (3D), Revolve (3D)
 * 3. MODIFICAR: Mover, Copiar, Girar, Espelhar, Escalar, Offset, Aparar (Trim),
 *               Estender, Filete, Chanfro, Booleana, Esticar, Quebrar, Unir, Explodir
 * 4. PRECISÃO: Coincidente, Paralelo, Perpendicular, Tangente, Fixar, Dimensão,
 *              Snap Geométrico, Grade, Orto
 * 5. MEDIR: Régua/Distância, Cota Linear, Horizontal, Vertical, Alinhada, Angular,
 *           Raio, Diâmetro, Coordenadas
 * 6. CHAPA: Flange, Dobra, Alívio, Desdobrar, Planificação, Espessura
 * 7. ESTRUTURAS: Perfil Estrutural, Corte em Ângulo, Solda
 * 8. DETALHES: Furo, Rosca, Padrão Linear (Array), Padrão Circular (Array Polar)
 */

import React, { useState, useRef, useEffect } from "react";
import {
  MousePointer2,
  Plus,
  Scissors,
  Crosshair,
  Ruler,
  Layers,
  Boxes,
  CircleDot,
  Minus,
  PenLine,
  Circle as CircleIcon,
  Compass,
  Square,
  Hexagon,
  Egg,
  Dot,
  Type,
  Box,
  RotateCw,
  Move,
  Copy,
  ClipboardList,
  FlipHorizontal,
  Maximize2,
  Minimize2,
  CornerDownRight,
  Maximize,
  Sparkles,
  Split,
  Combine,
  Divide,
  Grid,
  Magnet,
  Check,
  ChevronRight,
  Hammer,
  FoldHorizontal,
  ArrowRightLeft,
  X,
  Sliders,
  Disc,
  Flame,
  ShieldCheck,
  Pin,
  PinOff,
  AlignCenter,
  Search,
  FileText,
  Activity,
  Zap,
} from "lucide-react";
import type { Tool } from "./Lab2DEditor";
import type { DimKind } from "@/lib/lab2d/dimensions";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

export type CadCategory =
  | "none"
  | "selecionar"
  | "criar"
  | "modificar"
  | "precisao"
  | "medir"
  | "chapa"
  | "estruturas"
  | "detalhes";

interface ChamferCadToolbarProps {
  tool: Tool;
  onPickTool: (tool: Tool) => void;
  activeMode: "2d" | "3d" | "flanges";
  onModeChange: (mode: "2d" | "3d" | "flanges") => void;

  // Seleção e Modificação
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

  // Novos comandos e ferramentas profissionais
  onOpenQuickCommand?: () => void;
  onOpenTopologyHealth?: () => void;
  onOpenPresets?: () => void;
  onOpenTechnicalSheet?: () => void;
  onOpenVariables?: () => void;
  onOpenClipboard?: () => void;

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

  // Medição e Cotas
  dimKind: DimKind;
  onPickDimKind: (k: DimKind) => void;

  // Chapa Metálica
  thickness: number;
  onThicknessChange: (v: number) => void;
  onConvertToBend: () => void;
  onAddHole: () => void;
  onPlanificar: () => void;
  onOpenFlanges: () => void;
  onApplyRelief: () => void;
  onUnfold: () => void;
  onFold: () => void;

  // Modo Isométrico 2D
  drawingProjection?: "orthographic" | "isometric";
  onToggleDrawingProjection?: () => void;
  isoPlane?: "top" | "left" | "right";
  onSelectIsoPlane?: (plane: "top" | "left" | "right") => void;
  onOpenPieceBuilder?: () => void;

  activeLayer?: string;
  setActiveLayer?: (l: string) => void;

  className?: string;
  isDark?: boolean;
}

export function ChamferCadToolbar({
  tool,
  onPickTool,
  activeMode,
  onModeChange,
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
  onOpenQuickCommand,
  onOpenTopologyHealth,
  onOpenPresets,
  onOpenTechnicalSheet,
  onOpenVariables,
  onOpenClipboard,
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
  dimKind,
  onPickDimKind,
  thickness,
  onThicknessChange,
  onConvertToBend,
  onAddHole,
  onPlanificar,
  onOpenFlanges,
  onApplyRelief,
  onUnfold,
  onFold,
  activeLayer = "corte",
  setActiveLayer,
  drawingProjection = "orthographic",
  onToggleDrawingProjection,
  isoPlane = "top",
  onSelectIsoPlane,
  onOpenPieceBuilder,
  className,
  isDark = true,
}: ChamferCadToolbarProps) {
  const [openCat, setOpenCat] = useState<CadCategory>("none");
  const [isPinned, setIsPinned] = useState(false);
  const [lastUsedTool, setLastUsedTool] = useState<Record<CadCategory, string>>({
    selecionar: "select",
    criar: "line",
    modificar: "offset",
    precisao: "snap",
    medir: "measure",
    chapa: "flanges",
    estruturas: "profile",
    detalhes: "hole",
    none: "",
  });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Controle de Swipe Vertical com o Dedo (arraste suave e contínuo)
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const isPointerDown = useRef(false);
  const isDragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDown.current = true;
    isDragging.current = false;
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainerRef.current?.scrollTop || 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;
    const dy = e.clientY - dragStartY.current;
    if (Math.abs(dy) > 4) {
      isDragging.current = true;
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = dragStartScrollTop.current - dy;
    }
  };

  const handlePointerUp = () => {
    isPointerDown.current = false;
    setTimeout(() => {
      isDragging.current = false;
    }, 60);
  };

  const getFlyoutPosition = (cat: CadCategory): React.CSSProperties => {
    if (cat === "estruturas" || cat === "detalhes" || cat === "chapa") {
      return { bottom: "4px" };
    }
    if (cat === "selecionar" || cat === "criar") {
      return { top: "4px" };
    }
    return { top: "18%" };
  };

  // Fecha flyout ao clicar fora (se não estiver fixado)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!isPinned && toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenCat("none");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPinned]);

  const handleToggleCat = (cat: CadCategory) => {
    triggerHaptic("tap");
    setOpenCat((prev) => {
      const next = prev === cat ? "none" : cat;
      AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
      return next;
    });
  };

  const handleSelectTool = (t: Tool, catId?: CadCategory) => {
    triggerHaptic("selection");
    onPickTool(t);
    if (catId) {
      setLastUsedTool((prev) => ({ ...prev, [catId]: t }));
    }
    if (!isPinned) {
      setOpenCat("none");
    }
  };

  // Identifica categoria da ferramenta ativa
  const isCatActive = (cat: CadCategory): boolean => {
    switch (cat) {
      case "selecionar":
        return tool === "select" || tool === "node" || tool === "pan";
      case "criar":
        return (
          tool === "line" ||
          tool === "polyline" ||
          tool === "circle" ||
          tool === "arc" ||
          tool === "rect" ||
          tool === "rrect" ||
          tool === "polygon" ||
          tool === "ellipse" ||
          tool === "point" ||
          tool === "text"
        );
      case "modificar":
        return (
          tool === "offset" ||
          tool === "trim" ||
          tool === "extend" ||
          tool === "fillet" ||
          tool === "chamfer" ||
          tool === "divide"
        );
      case "precisao":
        return snapOn || orthoOn;
      case "medir":
        return tool === "measure" || tool === "dim";
      case "chapa":
        return activeMode === "flanges";
      default:
        return false;
    }
  };

  // 8 Categorias Canônicas
  const categories = [
    {
      id: "selecionar" as const,
      label: "Selecionar",
      short: "SEL",
      icon: MousePointer2,
      desc: "Seleção, vértices e navegação",
    },
    {
      id: "criar" as const,
      label: "Criar",
      short: "CRI",
      icon: Plus,
      desc: "Linha, círculo, arco, retângulo, 3D",
    },
    {
      id: "modificar" as const,
      label: "Modificar",
      short: "MOD",
      icon: Scissors,
      desc: "Área de Transferência, mover, girar, aparar, espelhar, offset",
    },
    {
      id: "precisao" as const,
      label: "Precisão",
      short: "PRE",
      icon: Crosshair,
      desc: "Snap, restrições, orto e grade",
    },
    {
      id: "medir" as const,
      label: "Medir",
      short: "MED",
      icon: Ruler,
      desc: "Régua, cotas lineares, ângulos e raios",
    },
    {
      id: "chapa" as const,
      label: "Chapa",
      short: "CHP",
      icon: Layers,
      desc: "Flange, dobras, alívios e planificação",
    },
    {
      id: "estruturas" as const,
      label: "Estruturas",
      short: "EST",
      icon: Boxes,
      desc: "Perfis, esquadrias e soldas",
    },
    {
      id: "detalhes" as const,
      label: "Detalhes",
      short: "DET",
      icon: CircleDot,
      desc: "Furos, roscas e padrões linear/circular",
    },
  ];

  const activeCategoryData = categories.find((c) => c.id === openCat);

  return (
    <aside
      ref={toolbarRef}
      aria-label="Barra de ferramentas CAD"
      className={cn(
        "relative flex h-full max-h-full w-12 shrink-0 flex-col items-center rounded-2xl border p-1 shadow-xl backdrop-blur-md select-none z-40",
        isDark
          ? "border-slate-800/80 bg-slate-950/90 text-slate-300"
          : "border-slate-200 bg-white/95 text-slate-700 shadow-md",
        className,
      )}
    >
      {/* 8 BOTÕES PRINCIPAIS DE FUNÇÃO — ROLÁVEL POR SWIPE VERTICAL / TOUCH / POINTER */}
      <div
        ref={scrollContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex-1 w-full overflow-y-auto overscroll-contain touch-pan-y scrollbar-none py-1 flex flex-col items-center gap-1.5"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          const active = isCatActive(cat.id);
          const isOpen = openCat === cat.id;

          return (
            <div key={cat.id} className="relative w-full shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  if (isDragging.current) {
                    e.stopPropagation();
                    return;
                  }
                  handleToggleCat(cat.id);
                }}
                title={`${cat.label} — ${cat.desc}`}
                aria-label={cat.label}
                className={cn(
                  "group relative flex size-9 w-full flex-col items-center justify-center rounded-xl transition-all",
                  isOpen
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30 scale-[1.02]"
                    : active
                      ? isDark
                        ? "border border-red-500/40 bg-red-950/50 text-red-400 shadow-xs"
                        : "border border-red-300 bg-red-50 text-red-600 font-bold shadow-xs"
                      : isDark
                        ? "text-slate-400 hover:border-slate-700/60 hover:bg-slate-900/80 hover:text-slate-100"
                        : "text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="size-4 transition-transform group-hover:scale-110" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider mt-0.5 leading-none uppercase">
                  {cat.short}
                </span>

                {/* Indicador de ferramenta ativa no grupo */}
                {active && !isOpen && (
                  <span className="absolute top-1 right-1 size-1.5 rounded-full bg-red-500 shadow-xs animate-pulse" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* SELETOR RÁPIDO DE CAMADA ATIVA (CORTE, DOBRA, RECORTE, MARCAÇÃO) */}
      {setActiveLayer && (
        <div className="w-full pt-1 border-t border-slate-800/80 flex flex-col items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              const order = ["corte", "dobra", "recorte", "marcacao"];
              const curIdx = order.indexOf(activeLayer ?? "corte");
              const next = order[(curIdx + 1) % order.length] ?? "corte";
              setActiveLayer(next);
            }}
            title={`Camada ativa: ${activeLayer}. Toque para alternar (Corte, Dobra, Recorte, Marcação).`}
            aria-label={`Camada ativa: ${activeLayer}`}
            className={cn(
              "group relative flex size-9 w-full flex-col items-center justify-center rounded-xl transition-all border",
              isDark
                ? "border-slate-800 bg-slate-900/90 hover:border-slate-700 hover:bg-slate-800"
                : "border-slate-200 bg-slate-100 hover:border-slate-300 hover:bg-slate-200",
            )}
          >
            <span
              className="size-3 rounded-full border border-slate-500/50 shadow-2xs transition-transform group-hover:scale-110"
              style={{
                backgroundColor:
                  activeLayer === "dobra"
                    ? "#EC4899"
                    : activeLayer === "recorte"
                    ? "#F59E0B"
                    : activeLayer === "marcacao"
                    ? "#3B82F6"
                    : "#FFFFFF",
              }}
            />
            <span className="text-[7px] font-mono font-bold tracking-wider mt-0.5 leading-none uppercase text-slate-400 group-hover:text-white">
              {activeLayer === "dobra"
                ? "DOB"
                : activeLayer === "recorte"
                ? "REC"
                : activeLayer === "marcacao"
                ? "MAR"
                : "COR"}
            </span>
          </button>
        </div>
      )}

      {/* FLYOUT CONTEXTUAL FLUTUANTE ANCORADO, SEGURO CONTRA CORTES NA VIEWPORT */}
      {openCat !== "none" && activeCategoryData && (
        <div
          className={cn(
            "absolute left-full ml-2 z-50 w-64 rounded-2xl border p-2 shadow-2xl backdrop-blur-lg animate-in fade-in zoom-in-95 duration-150 overflow-y-auto",
            isDark
              ? "border-slate-800 bg-slate-950/95 text-slate-200"
              : "border-slate-200 bg-white/95 text-slate-800 shadow-2xl",
          )}
          style={{
            ...getFlyoutPosition(openCat),
            maxHeight: "calc(100% - 8px)",
          }}
        >
          {/* CABEÇALHO DO FLYOUT */}
          <div
            className={cn(
              "flex items-center justify-between border-b pb-1.5 mb-1.5",
              isDark ? "border-slate-800/80" : "border-slate-200",
            )}
          >
            <div className="flex items-center gap-1.5">
              <activeCategoryData.icon className="size-3.5 text-red-500" />
              <span
                className={cn(
                  "font-mono text-xs font-bold uppercase tracking-wide",
                  isDark ? "text-slate-100" : "text-slate-800",
                )}
              >
                {activeCategoryData.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  setIsPinned((p) => !p);
                }}
                className={cn(
                  "size-5 rounded-md grid place-items-center transition-colors",
                  isPinned
                    ? "bg-red-600 text-white shadow-xs"
                    : isDark
                      ? "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )}
                title={
                  isPinned
                    ? "Menu fixado (clique para recolher automaticamente)"
                    : "Fixar menu aberto"
                }
              >
                {isPinned ? <Pin className="size-3" /> : <PinOff className="size-3" />}
              </button>
              <button
                type="button"
                onClick={() => setOpenCat("none")}
                className={cn(
                  "size-5 rounded-md grid place-items-center transition-colors",
                  isDark
                    ? "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )}
                title="Fechar menu"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* 1. GRUPO: SELECIONAR */}
          {openCat === "selecionar" && (
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <FlyoutItem
                      label="Selecionar / Ponteiro"
                      keyLabel="V"
                      icon={MousePointer2}
                      active={tool === "select"}
                      onClick={() => handleSelectTool("select", "selecionar")}
                      desc="Clique em entidade ou arraste para caixa de seleção"
                    />
                    <FlyoutItem
                      label="Editar Nós / Vértices"
                      keyLabel="N"
                      icon={MousePointer2}
                      active={tool === "node"}
                      onClick={() => handleSelectTool("node", "selecionar")}
                      desc="Manipular pontos de controle e vértices"
                    />
                    <FlyoutItem
                      label="Mover Tela (Pan)"
                      keyLabel="H"
                      icon={Move}
                      active={tool === "pan"}
                      onClick={() => handleSelectTool("pan", "selecionar")}
                      desc="Arrastar prancheta sem mover geometrias"
                    />
                  </div>
                )}

                {/* 2. GRUPO: CRIAR */}
                {openCat === "criar" && (
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <FlyoutItem
                      label="Linha"
                      keyLabel="L"
                      icon={Minus}
                      active={tool === "line"}
                      onClick={() => handleSelectTool("line", "criar")}
                      desc="Segmento de reta entre dois pontos"
                    />
                    <FlyoutItem
                      label="Polilinha"
                      keyLabel="P"
                      icon={PenLine}
                      active={tool === "polyline"}
                      onClick={() => handleSelectTool("polyline", "criar")}
                      desc="Cadeia contínua de segmentos unidos"
                    />
                    <FlyoutItem
                      label="Círculo"
                      keyLabel="C"
                      icon={CircleIcon}
                      active={tool === "circle"}
                      onClick={() => handleSelectTool("circle", "criar")}
                      desc="Centro e raio ou diâmetro"
                    />
                    <FlyoutItem
                      label="Arco 3 Pontos"
                      keyLabel="A"
                      icon={Compass}
                      active={tool === "arc"}
                      onClick={() => handleSelectTool("arc", "criar")}
                      desc="Início, meio e fim de curvatura"
                    />
                    <FlyoutItem
                      label="Retângulo"
                      keyLabel="R"
                      icon={Square}
                      active={tool === "rect"}
                      onClick={() => handleSelectTool("rect", "criar")}
                      desc="Dois cantos opostos em milímetros"
                    />
                    <FlyoutItem
                      label="Polígono Regular"
                      icon={Hexagon}
                      active={tool === "polygon"}
                      onClick={() => handleSelectTool("polygon", "criar")}
                      desc="Polígono com N lados iguais"
                    />
                    <FlyoutItem
                      label="Elipse"
                      icon={Egg}
                      active={tool === "ellipse"}
                      onClick={() => handleSelectTool("ellipse", "criar")}
                      desc="Eixos maior e menor"
                    />
                    <FlyoutItem
                      label="Ponto de Apoio"
                      icon={Dot}
                      active={tool === "point"}
                      onClick={() => handleSelectTool("point", "criar")}
                      desc="Referência de coordenadas CAD"
                    />
                    <FlyoutItem
                      label="Texto Técnico"
                      keyLabel="X"
                      icon={Type}
                      active={tool === "text"}
                      onClick={() => handleSelectTool("text", "criar")}
                      desc="Gravação a laser ou marcação técnica"
                    />
                    <FlyoutItem
                      label="Rasgo Oblongo (Slot)"
                      keyLabel="SL"
                      icon={Minus}
                      active={tool === "slot"}
                      onClick={() => handleSelectTool("slot", "criar")}
                      desc="Rasgo oblongo com centros e raio"
                    />
                    {onOpenPresets && (
                      <FlyoutItem
                        label="Presets Paramétricos"
                        icon={Boxes}
                        onClick={() => {
                          onOpenPresets();
                          setOpenCat("none");
                        }}
                        desc="Flanges DIN/ANSI, bases e tubos"
                      />
                    )}
                    {onOpenTechnicalSheet && (
                      <FlyoutItem
                        label="Folha e Legenda Técnica"
                        icon={FileText}
                        onClick={() => {
                          onOpenTechnicalSheet();
                          setOpenCat("none");
                        }}
                        desc="Prancha A4/A3/A2 com carimbo CALDRA"
                      />
                    )}
                    {onOpenPieceBuilder && (
                      <FlyoutItem
                        label="Projeção Isométrica (Converter)"
                        icon={Sparkles}
                        onClick={() => {
                          onOpenPieceBuilder();
                          setOpenCat("none");
                        }}
                        desc="Transforma a seleção ativa do documento para perspectiva isométrica analítica 2D/2.5D"
                      />
                    )}

                    <div className="my-1 h-px bg-slate-800" />

                    <FlyoutItem
                      label="Extrude 3D"
                      icon={Box}
                      onClick={() => {
                        triggerHaptic("selection");
                        onModeChange("3d");
                        setOpenCat("none");
                      }}
                      badge="3D"
                      desc="Gerar sólido tridimensional por extrusão"
                    />
                    <FlyoutItem
                      label="Revolve 3D"
                      icon={RotateCw}
                      onClick={() => {
                        triggerHaptic("selection");
                        onModeChange("3d");
                        setOpenCat("none");
                      }}
                      badge="3D"
                      desc="Revolução de perfil em torno de um eixo"
                    />
                  </div>
                )}

                {/* 3. GRUPO: MODIFICAR */}
                {openCat === "modificar" && (
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <FlyoutItem
                      label="Área de Transferência"
                      keyLabel="CLIP"
                      icon={ClipboardList}
                      onClick={() => {
                        onOpenClipboard?.();
                        setOpenCat("none");
                      }}
                      desc="Painel global: formas copiadas, itens fixados (📌) e colar"
                    />
                    <FlyoutItem
                      label="Mover"
                      keyLabel="M"
                      icon={Move}
                      disabled={!hasSelection}
                      onClick={() => {
                        onMoveSelection();
                        setOpenCat("none");
                      }}
                      desc="Transladar elementos selecionados"
                    />
                    <FlyoutItem
                      label="Copiar"
                      keyLabel="CO"
                      icon={Copy}
                      disabled={!hasSelection}
                      onClick={() => {
                        onCopySelection();
                        setOpenCat("none");
                      }}
                      desc="Copiar seleção para a Área de Transferência (Ctrl+C)"
                    />
                    <FlyoutItem
                      label="Girar"
                      keyLabel="RO"
                      icon={RotateCw}
                      disabled={!hasSelection}
                      onClick={() => {
                        onRotateSelection();
                        setOpenCat("none");
                      }}
                      desc="Rotacionar em torno do centro geométrico"
                    />
                    <FlyoutItem
                      label="Espelhar"
                      keyLabel="MI"
                      icon={FlipHorizontal}
                      disabled={!hasSelection}
                      onClick={() => {
                        onMirrorSelection();
                        setOpenCat("none");
                      }}
                      desc="Refletir sobre o eixo central"
                    />
                    <FlyoutItem
                      label="Escalar"
                      keyLabel="SC"
                      icon={Maximize2}
                      disabled={!hasSelection}
                      onClick={() => {
                        onScaleSelection();
                        setOpenCat("none");
                      }}
                      desc="Ampliar ou reduzir proporcionalmente"
                    />

                    <div className="my-1 h-px bg-slate-800" />

                    <FlyoutItem
                      label="Offset (Deslocamento)"
                      keyLabel="O"
                      icon={CornerDownRight}
                      active={tool === "offset"}
                      onClick={() => handleSelectTool("offset", "modificar")}
                      desc={`Distância: ${offsetDist} mm`}
                    />
                    <FlyoutItem
                      label="Aparar (Trim)"
                      keyLabel="TR"
                      icon={Scissors}
                      active={tool === "trim"}
                      onClick={() => handleSelectTool("trim", "modificar")}
                      desc="Cortar linha em interseção com outra"
                    />
                    <FlyoutItem
                      label="Aparar até Encontro"
                      keyLabel="ATE"
                      icon={Scissors}
                      active={tool === "smart_trim"}
                      onClick={() => handleSelectTool("smart_trim", "modificar")}
                      desc="Aparar direto até a primeira interseção limite"
                    />
                    <FlyoutItem
                      label="Centralizar Formas"
                      keyLabel="CTR"
                      icon={AlignCenter}
                      active={tool === "center"}
                      disabled={!hasSelection}
                      onClick={() => {
                        if (onCenterSelection) {
                          onCenterSelection();
                          setOpenCat("none");
                        } else {
                          handleSelectTool("center", "modificar");
                        }
                      }}
                      desc="Centralizar seleção por centro geométrico ou limites"
                    />
                    <FlyoutItem
                      label="Estender (Extend)"
                      keyLabel="EX"
                      icon={Maximize}
                      active={tool === "extend"}
                      onClick={() => handleSelectTool("extend", "modificar")}
                      desc="Prolongar linha até o próximo limite"
                    />
                    <FlyoutItem
                      label="Filete (Arredondamento)"
                      keyLabel="F"
                      icon={Sparkles}
                      active={tool === "fillet"}
                      onClick={() => handleSelectTool("fillet", "modificar")}
                      desc={`Raio: R${filletR} mm`}
                    />
                    <FlyoutItem
                      label="Chanfro Angular"
                      keyLabel="CHA"
                      icon={Sparkles}
                      active={tool === "chamfer"}
                      onClick={() => handleSelectTool("chamfer", "modificar")}
                      desc="Corte chanfrado em quinas vivas"
                    />
                    <FlyoutItem
                      label="Dividir em Partes"
                      keyLabel="DIV"
                      icon={Divide}
                      active={tool === "divide"}
                      onClick={() => {
                        if (onDivideSelection && hasSelection) {
                          onDivideSelection();
                          setOpenCat("none");
                        } else {
                          handleSelectTool("divide", "modificar");
                        }
                      }}
                      desc="Dividir peça ou contorno em N partes iguais"
                    />

                    <div className="my-1 h-px bg-slate-800" />

                    <FlyoutItem
                      label="Unir (Join)"
                      icon={Combine}
                      disabled={!hasSelection}
                      onClick={() => {
                        onJoinSelection();
                        setOpenCat("none");
                      }}
                      desc="Fundir segmentos contíguos em polilinha"
                    />
                    <FlyoutItem
                      label="Quebrar (Break)"
                      icon={Split}
                      disabled={!hasSelection}
                      onClick={() => {
                        onBreakSelection();
                        setOpenCat("none");
                      }}
                      desc="Partir entidade em um ponto"
                    />
                    <FlyoutItem
                      label="Explodir (Explode)"
                      icon={Split}
                      disabled={!hasSelection}
                      onClick={() => {
                        onExplodeSelection();
                        setOpenCat("none");
                      }}
                      desc="Desmembrar polilinha ou bloco"
                    />

                    <div className="my-1 h-px bg-slate-800" />

                    {onOpenTopologyHealth && (
                      <FlyoutItem
                        label="Topologia & Auto-Heal"
                        icon={Activity}
                        onClick={() => {
                          onOpenTopologyHealth();
                          setOpenCat("none");
                        }}
                        desc="Diagnóstico de frestas, aberturas e duplicatas"
                      />
                    )}
                    {onOpenVariables && (
                      <FlyoutItem
                        label="Tabela de Variáveis"
                        icon={Sliders}
                        onClick={() => {
                          onOpenVariables();
                          setOpenCat("none");
                        }}
                        desc="Fórmulas e dimensões paramétricas do projeto"
                      />
                    )}
                    {onOpenQuickCommand && (
                      <FlyoutItem
                        label="Comando Rápido"
                        keyLabel="Q"
                        icon={Search}
                        onClick={() => {
                          onOpenQuickCommand();
                          setOpenCat("none");
                        }}
                        desc="Busca instantânea de comandos e operações"
                      />
                    )}
                  </div>
                )}

                {/* 4. GRUPO: PRECISÃO / RESTRIÇÕES */}
                {openCat === "precisao" && (
                  <div className="flex flex-col gap-1 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setSnapOn((s) => !s);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors",
                        snapOn ? "bg-red-950/60 border border-red-500/40 text-red-300" : "bg-slate-900 text-slate-400 hover:text-slate-200",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Magnet className="size-4" />
                        <span>Snap Geométrico</span>
                      </div>
                      <span className="font-bold">{snapOn ? "LIGADO" : "DESLIGADO"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setOrthoOn((o) => !o);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors",
                        orthoOn ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300" : "bg-slate-900 text-slate-400 hover:text-slate-200",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Crosshair className="size-4" />
                        <span>Modo Orto (0°/90°)</span>
                      </div>
                      <span className="font-bold">{orthoOn ? "LIGADO" : "DESLIGADO"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        setShowGrid((g) => !g);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors",
                        showGrid ? "bg-red-950/60 border border-red-500/40 text-red-300" : "bg-slate-900 text-slate-400 hover:text-slate-200",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Grid className="size-4" />
                        <span>Grade Espacial ({grid} mm)</span>
                      </div>
                      <span className="font-bold">{showGrid ? "LIGADO" : "DESLIGADO"}</span>
                    </button>

                    {onToggleDrawingProjection && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("selection");
                          onToggleDrawingProjection();
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors",
                          drawingProjection === "isometric"
                            ? "bg-red-950/60 border border-red-500/40 text-red-300"
                            : "bg-slate-900 text-slate-400 hover:text-slate-200",
                        )}
                        title="Alternar entre Desenho Ortogonal 2D e Isométrico 2D"
                      >
                        <div className="flex items-center gap-2">
                          <Box className="size-4" />
                          <span>Modo Isométrico 2D</span>
                        </div>
                        <span className="font-bold">
                          {drawingProjection === "isometric" ? "ATIVO" : "DESLIGADO"}
                        </span>
                      </button>
                    )}

                    {drawingProjection === "isometric" && onSelectIsoPlane && (
                      <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] text-muted-foreground font-semibold px-1">
                          Plano Isométrico (F5):
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(["top", "left", "right"] as const).map((pId) => (
                            <button
                              key={pId}
                              type="button"
                              onClick={() => {
                                triggerHaptic("selection");
                                onSelectIsoPlane(pId);
                              }}
                              className={cn(
                                "py-1 rounded-lg text-[10px] font-bold uppercase transition-colors text-center",
                                isoPlane === pId
                                  ? "bg-red-600 text-white shadow-xs"
                                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                              )}
                            >
                              {pId === "top" ? "Superior" : pId === "left" ? "Esquerdo" : "Direito"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-800 pt-2 mt-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                        Restrições Geométricas
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <span className="rounded-lg bg-slate-900/80 px-2 py-1 text-slate-300">Coincidente</span>
                        <span className="rounded-lg bg-slate-900/80 px-2 py-1 text-slate-300">Paralelo</span>
                        <span className="rounded-lg bg-slate-900/80 px-2 py-1 text-slate-300">Perpendicular</span>
                        <span className="rounded-lg bg-slate-900/80 px-2 py-1 text-slate-300">Tangente</span>
                        <span className="rounded-lg bg-slate-900/80 px-2 py-1 text-slate-300">Horizontal</span>
                        <span className="rounded-lg bg-slate-900/80 px-2 py-1 text-slate-300">Fixar Ponto</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. GRUPO: MEDIR */}
                {openCat === "medir" && (
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <FlyoutItem
                      label="Régua / Distância Livre"
                      keyLabel="D"
                      icon={Ruler}
                      active={tool === "measure"}
                      onClick={() => handleSelectTool("measure", "medir")}
                      desc="Medir distância e ângulo entre dois cliques"
                    />

                    <div className="my-1 h-px bg-slate-800" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 py-0.5">
                      Cotas Técnicas
                    </p>

                    <FlyoutItem
                      label="Cota Alinhada"
                      icon={Ruler}
                      active={tool === "dim" && dimKind === "aligned"}
                      onClick={() => {
                        onPickDimKind("aligned");
                        handleSelectTool("dim", "medir");
                      }}
                      desc="Dimensão paralela à entidade"
                    />
                    <FlyoutItem
                      label="Cota Horizontal"
                      icon={Ruler}
                      active={tool === "dim" && dimKind === "horizontal"}
                      onClick={() => {
                        onPickDimKind("horizontal");
                        handleSelectTool("dim", "medir");
                      }}
                      desc="Projeção no eixo X"
                    />
                    <FlyoutItem
                      label="Cota Vertical"
                      icon={Ruler}
                      active={tool === "dim" && dimKind === "vertical"}
                      onClick={() => {
                        onPickDimKind("vertical");
                        handleSelectTool("dim", "medir");
                      }}
                      desc="Projeção no eixo Y"
                    />
                    <FlyoutItem
                      label="Cota de Raio (R)"
                      icon={CircleDot}
                      active={tool === "dim" && dimKind === "radius"}
                      onClick={() => {
                        onPickDimKind("radius");
                        handleSelectTool("dim", "medir");
                      }}
                      desc="Raio de arco ou círculo"
                    />
                    <FlyoutItem
                      label="Cota de Diâmetro (Ø)"
                      icon={Disc}
                      active={tool === "dim" && dimKind === "diameter"}
                      onClick={() => {
                        onPickDimKind("diameter");
                        handleSelectTool("dim", "medir");
                      }}
                      desc="Diâmetro de furos e círculos"
                    />
                    <FlyoutItem
                      label="Cota Angular (°)"
                      icon={Compass}
                      active={tool === "dim" && dimKind === "angle"}
                      onClick={() => {
                        onPickDimKind("angle");
                        handleSelectTool("dim", "medir");
                      }}
                      desc="Ângulo entre duas retas"
                    />
                  </div>
                )}

                {/* 6. GRUPO: CHAPA METÁLICA */}
                {openCat === "chapa" && (
                  <div className="flex flex-col gap-1 font-mono text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-slate-900/90 p-2 border border-slate-800">
                      <span className="text-[11px] text-slate-300 font-bold">Espessura:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={0.1}
                          min={0.2}
                          max={30}
                          value={thickness}
                          onChange={(e) => onThicknessChange(Number(e.target.value) || 1)}
                          className="w-14 rounded-lg bg-slate-800 px-1.5 py-0.5 text-center font-bold text-red-400 outline-none"
                        />
                        <span className="text-slate-400 text-[10px]">mm</span>
                      </div>
                    </div>

                    <FlyoutItem
                      label="Modelar Flanges (Abas)"
                      icon={Layers}
                      onClick={() => {
                        onOpenFlanges();
                        setOpenCat("none");
                      }}
                      desc="Adicionar abas e dobras na borda"
                    />
                    <FlyoutItem
                      label="Converter para Linha de Dobra"
                      icon={FoldHorizontal}
                      onClick={() => {
                        onConvertToBend();
                        setOpenCat("none");
                      }}
                      desc="Transforma seleção em vinco/dobra"
                    />
                    <FlyoutItem
                      label="Aplicar Alívio de Canto"
                      icon={Sparkles}
                      onClick={() => {
                        onApplyRelief();
                        setOpenCat("none");
                      }}
                      desc="Alívio circular/retangular para prensagem"
                    />
                    <FlyoutItem
                      label="Planificação (Flat Pattern)"
                      icon={ArrowRightLeft}
                      onClick={() => {
                        onPlanificar();
                        setOpenCat("none");
                      }}
                      desc="Desenvolvimento de chapa para corte CNC"
                    />
                    <FlyoutItem
                      label="Desdobrar (Unfold)"
                      icon={FoldHorizontal}
                      onClick={() => {
                        onUnfold();
                        setOpenCat("none");
                      }}
                      desc="Visualizar peça aberta"
                    />
                    <FlyoutItem
                      label="Dobrar (Fold)"
                      icon={Layers}
                      onClick={() => {
                        onFold();
                        setOpenCat("none");
                      }}
                      desc="Recolher peça em 3D"
                    />
                  </div>
                )}

                {/* 7. GRUPO: ESTRUTURAS / TUBOS */}
                {openCat === "estruturas" && (
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <FlyoutItem
                      label="Perfil Estrutural (Viga / Tubo)"
                      icon={Boxes}
                      onClick={() => {
                        triggerHaptic("tap");
                        setOpenCat("none");
                      }}
                      desc="Tubos redondos, quadrados, vigas I/U"
                    />
                    <FlyoutItem
                      label="Corte em Ângulo (45° / Esquadria)"
                      icon={Scissors}
                      onClick={() => {
                        triggerHaptic("tap");
                        setOpenCat("none");
                      }}
                      desc="Bisel e junta em esquadria para soldagem"
                    />
                    <FlyoutItem
                      label="Símbolo de Solda Industrial"
                      icon={Flame}
                      onClick={() => {
                        triggerHaptic("tap");
                        setOpenCat("none");
                      }}
                      desc="Chanfro em V, cordão contínuo ou intermitente"
                    />
                  </div>
                )}

                {/* 8. GRUPO: DETALHES */}
                {openCat === "detalhes" && (
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <FlyoutItem
                      label="Furo Industrial (Ø)"
                      icon={CircleDot}
                      onClick={() => {
                        onAddHole();
                        setOpenCat("none");
                      }}
                      desc="Furo passante, cego ou escareado"
                    />
                    <FlyoutItem
                      label="Rosca Técnica (M)"
                      icon={Sliders}
                      onClick={() => {
                        triggerHaptic("tap");
                        setOpenCat("none");
                      }}
                      desc="Especificação de rosca métrica"
                    />
                    <FlyoutItem
                      label="Padrão Linear (Array)"
                      icon={Copy}
                      onClick={() => {
                        onArrayLinear();
                        setOpenCat("none");
                      }}
                      desc="Repetição de furos em linha X/Y"
                    />
                    <FlyoutItem
                      label="Padrão Circular (Array Polar)"
                      icon={RotateCw}
                      onClick={() => {
                        onArrayPolar();
                        setOpenCat("none");
                      }}
                      desc="Furação distribuída em flange circular (PCD)"
                    />
                  </div>
                )}
        </div>
      )}
    </aside>
  );
}

function FlyoutItem({
  label,
  keyLabel,
  icon: Icon,
  active,
  disabled,
  badge,
  onClick,
  desc,
  isDark: propIsDark,
}: {
  label: string;
  keyLabel?: string;
  icon: typeof Minus;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
  desc?: string;
  isDark?: boolean;
}) {
  const isDark =
    propIsDark ??
    (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col rounded-xl px-2.5 py-1.5 text-left transition-colors",
        disabled
          ? "opacity-35 cursor-not-allowed text-slate-400"
          : active
            ? isDark
              ? "border border-red-500/40 bg-red-950/70 text-red-300 shadow-xs"
              : "border border-red-300 bg-red-50 text-red-600 shadow-xs font-semibold"
            : isDark
              ? "text-slate-300 hover:bg-slate-900 hover:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "size-3.5",
              active
                ? "text-red-500"
                : isDark
                  ? "text-slate-400 group-hover:text-red-400"
                  : "text-slate-500 group-hover:text-red-600",
            )}
          />
          <span className="font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span
              className={cn(
                "rounded px-1 py-0.2 text-[8px] font-bold uppercase",
                isDark ? "bg-red-600/30 text-red-400" : "bg-red-100 text-red-600",
              )}
            >
              {badge}
            </span>
          )}
          {keyLabel && (
            <kbd
              className={cn(
                "rounded border px-1.5 py-0.2 text-[9px] font-bold",
                isDark
                  ? "border-slate-700 bg-slate-800/80 text-slate-400"
                  : "border-slate-300 bg-slate-100 text-slate-600",
              )}
            >
              {keyLabel}
            </kbd>
          )}
        </div>
      </div>
      {desc && (
        <span
          className={cn(
            "mt-0.5 text-[9px] line-clamp-1",
            isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {desc}
        </span>
      )}
    </button>
  );
}
