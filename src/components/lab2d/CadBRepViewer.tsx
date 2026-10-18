/**
 * CALDRA CHAMFER — 3D CAD CORE AMBIENTE DEFINITIVO (REPRODUÇÃO DA IMAGEM 1 & ADAPTAÇÃO ESTRUTURAL)
 *
 * Arquitetura Definitiva de 3 Níveis:
 * NÍVEL 1 — SEMPRE VISÍVEL:
 *   - Header com vistas principais ISO/FR/LAT/SUP centralizadas (sem o nome da peça no centro)
 *   - Viewport 3D com modelo real (Cone, Quadrado->Redondo, Curva, Boca de Lobo, etc. — PROIBIDO CONE PADRÃO)
 *   - Barra de Vistas e Modos (ISO, FR, LAT, SUP | SOMB, SOMB+AR, ARAME + Enquadrar)
 *   - Grid 3D de chão adaptativo (Tema Escuro: #051833 e grid branco; Tema Claro: grid escuro)
 *   - Barra de Status inferior persistente
 *
 * NÍVEL 2 — ACESSO RÁPIDO:
 *   - Manipulação Rápida (Gizmo, Mover, Girar, Undo, Redo, Fullscreen)
 *   - Ações Principais no Chão do Viewport (Planificar, Prancha 2D, Estruturas, CNC/DXF)
 *
 * NÍVEL 3 — CONTEXTUAL / SMART FLYOUT:
 *   - Barra Lateral Esquerda com categorias e flyouts sem sobreposição da peça
 *   - Painel Contextual Direito (Parâmetros com mini-diagrama esquemático dinâmico, Inspeção B-Rep, Filtro)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Undo2,
  Redo2,
  Move,
  RotateCw,
  Maximize2,
  Minimize2,
  Box,
  Compass,
  FileText,
  Boxes,
  Scissors,
  Layers,
  Wrench,
  Ruler,
  Download,
  Settings,
  X,
  Check,
  Flame,
  HelpCircle,
  Sliders,
  Eye,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Crosshair,
  RefreshCw,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CadViewCube } from "./CadViewCube";
import { ThreeBRepRenderer, type CadGizmoMode } from "@/lib/cad/renderer/ThreeBRepRenderer";
import { getCadKernel } from "@/lib/cad/core";
import { CadFeatureTree } from "@/lib/cad/features/CadFeatureTree";
import { CadBRepEditor } from "@/lib/cad/core/CadBRepEditor";
import type { CadFeatureNode, CadFeatureType } from "@/lib/cad/features/CadFeatureModel";
import type { CadShape } from "@/lib/cad/core/CadShape";
import type { CadTessellatedShape } from "@/lib/cad/core/CadMesh";
import type { MassProperties } from "@/lib/cad/core/CadKernel";
import type {
  CadSelectedEntity,
  CadSelectionType,
  CadMeasurementResult,
} from "@/lib/cad/core/CadSelection";
import type { EdgeMode, ViewPresetId } from "@/lib/viz3d/cameraPresets";
import { CaldraBoilermakingDialog } from "@/components/lab2d/CaldraBoilermakingDialog";
import { CaldraFlatPatternDialog } from "@/components/lab2d/CaldraFlatPatternDialog";
import { CaldraDraftingDialog } from "@/components/lab2d/CaldraDraftingDialog";
import { CaldraWeldmentDialog } from "@/components/lab2d/CaldraWeldmentDialog";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AudioManager } from "@/lib/audio/AudioManager";
import { AudioQuickControl } from "@/components/audio/AudioQuickControl";

export interface CadBRepViewerProps {
  className?: string;
  initialModelType?: string;
  initialModelTitle?: string;
  initialParams?: Record<string, any>;
  initialWidth?: number;
  initialLength?: number;
  initialThickness?: number;
  activeViewPreset?: ViewPresetId;
  onViewPresetChange?: (preset: ViewPresetId) => void;
  // Integração com o Workspace CAD CHAMFER
  onBack?: () => void;
  onToggleMode?: (mode: "2d" | "3d") => void;
  documentTitle?: string;
  onTitleChange?: (newTitle: string) => void;
  onSave?: () => void;
  isSaved?: boolean;
}

type LeftCategory =
  | "none"
  | "criar"
  | "modificar"
  | "detalhes"
  | "chapa"
  | "estruturas"
  | "medir"
  | "exportar";

type RightPanelTab = "parametros" | "inspecao" | "filtro";

export function CadBRepViewer({
  className,
  initialModelType = "boilermaking_cone",
  initialModelTitle = "Cone",
  initialParams,
  initialWidth = 200,
  initialLength = 200,
  initialThickness = 3,
  activeViewPreset = "iso",
  onViewPresetChange,
  onBack,
  onToggleMode,
  documentTitle,
  onTitleChange,
  onSave,
  isSaved = true,
}: CadBRepViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ThreeBRepRenderer | null>(null);
  const { settings } = useSettings();

  // Detecta tema escuro ou claro (Seção 24 & 25)
  const isDarkTheme = useMemo(() => {
    return (
      settings?.theme === "dark" ||
      settings?.theme === "amoled" ||
      (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
    );
  }, [settings?.theme]);

  // Modelo Ativo (PROIBIDO CONE PADRÃO)
  const [modelType, setModelType] = useState<string>(initialModelType);
  const [modelTitle, setModelTitle] = useState<string>(initialModelTitle);

  // Parâmetros Dinâmicos
  const [paramA, setParamA] = useState<number>(initialParams?.width || initialParams?.D || initialWidth);
  const [paramB, setParamB] = useState<number>(initialParams?.length || initialParams?.d || initialLength);
  const [paramC, setParamC] = useState<number>(initialParams?.height || initialParams?.H || 100);
  const [paramD, setParamD] = useState<number>(initialParams?.diameter || 120);
  const [thickness, setThickness] = useState<number>(initialThickness);
  const [material, setMaterial] = useState<string>("Aço Carbono");

  // Opções Paramétricas
  const [optHole, setOptHole] = useState(false);
  const [optFillet, setOptFillet] = useState(false);
  const [optChamfer, setOptChamfer] = useState(false);

  // Motor da Árvore de Recursos e Editor B-Rep
  const treeRef = useRef<CadFeatureTree>(new CadFeatureTree());
  const editorRef = useRef<CadBRepEditor>(new CadBRepEditor(treeRef.current));
  const [featuresList, setFeaturesList] = useState<readonly CadFeatureNode[]>([]);

  // Histórico de Edição B-Rep
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Estados de Manipulação e Vistas
  const [viewPreset, setViewPreset] = useState<ViewPresetId>(activeViewPreset);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>("shaded-edges");
  const [gizmoMode, setGizmoMode] = useState<CadGizmoMode>("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraRotation, setCameraRotation] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const [isOrtho, setIsOrtho] = useState(false);

  // Seleção e Metrologia
  const [selectionType, setSelectionType] = useState<CadSelectionType>("face");
  const [selectedEntity, setSelectedEntity] = useState<CadSelectedEntity | null>(null);
  const [multiSelection, setMultiSelection] = useState<CadSelectedEntity[]>([]);
  const [measurement, setMeasurement] = useState<CadMeasurementResult | null>(null);

  // Painéis Flutuantes
  const [activeLeftCat, setActiveLeftCat] = useState<LeftCategory>("none");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightPanelTab>("parametros");

  // Estado do Kernel e Geometria Ativa
  const [loading, setLoading] = useState(true);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [activeShape, setActiveShape] = useState<CadShape | null>(null);
  const [massProps, setMassProps] = useState<MassProperties | null>(null);
  const [tessData, setTessData] = useState<CadTessellatedShape | null>(null);

  // Diálogos Especializados
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [flatPatternDialogOpen, setFlatPatternDialogOpen] = useState(false);
  const [draftingDialogOpen, setDraftingDialogOpen] = useState(false);
  const [weldmentDialogOpen, setWeldmentDialogOpen] = useState(false);

  // Sincroniza viewPreset com o Stage pai
  useEffect(() => {
    setViewPreset(activeViewPreset);
  }, [activeViewPreset]);

  const handleViewPresetChange = (preset: ViewPresetId) => {
    setViewPreset(preset);
    onViewPresetChange?.(preset);
  };

  // Atualiza flags de histórico
  const refreshHistoryFlags = useCallback(() => {
    setCanUndo(editorRef.current.canUndo());
    setCanRedo(editorRef.current.canRedo());
  }, []);

  // Som de inicialização do CAD CORE 3D ao abrir o módulo (Seção 6)
  useEffect(() => {
    AudioManager.play("cad_core_init");
  }, []);

  // Reconstrução via Feature Tree
  const rebuildFromTree = useCallback(async () => {
    setLoading(true);
    setConversionError(null);
    AudioManager.play("kernel_loading");
    try {
      const res = await treeRef.current.rebuild();
      if (res.success && res.activeShape && res.tessellation) {
        setActiveShape(res.activeShape);
        setTessData(res.tessellation);
        setMassProps(res.massProperties);
        rendererRef.current?.setShape(res.tessellation);
        rendererRef.current?.fitView(false);
        AudioManager.play("kernel_success");
      } else {
        const errorMsg = res.errors?.join("; ") || (res as unknown as { error?: string })?.error || "Falha na geração do sólido B-Rep.";
        throw new Error(errorMsg);
      }
      setFeaturesList(treeRef.current.getFeatures());
      refreshHistoryFlags();
    } catch (err: unknown) {
      console.error("[CadBRepViewer] Erro ao reconstruir árvore:", err);
      AudioManager.play("kernel_error");
      // NUNCA substituir silenciosamente por Cone (Seção 22)
      setConversionError((err as Error)?.message || "Não foi possível converter este modelo para CAD 3D.");
    } finally {
      setLoading(false);
    }
  }, [refreshHistoryFlags]);

  // Inicialização do ThreeBRepRenderer
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new ThreeBRepRenderer({
      container: containerRef.current,
      gizmoMode,
      onSelect: (entity, multi) => {
        setSelectedEntity(entity);
        setMultiSelection(Array.isArray(multi) ? multi : entity ? [entity] : []);
        if (entity) {
          if (entity.type === "face") {
            AudioManager.play("cad_select_face");
          } else if (entity.type === "edge") {
            AudioManager.play("cad_select_edge");
          } else if (entity.type === "vertex") {
            AudioManager.play("cad_select_vertex");
          }
        }
      },
      onMeasure: (meas) => {
        setMeasurement(meas);
        if (meas) {
          AudioManager.play("cad_measure");
        }
      },
      onCameraRotate: (rot) => {
        setCameraRotation(rot);
      },
    });

    // Aplica o tema imediatamente
    renderer.setTheme(isDarkTheme ? "dark" : "light");

    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [gizmoMode, isDarkTheme]);

  // Sincroniza tema quando alterado pelo usuário (Seção 24 & 25)
  useEffect(() => {
    rendererRef.current?.setTheme(isDarkTheme ? "dark" : "light");
  }, [isDarkTheme]);

  // Sincroniza modo de visualização e arestas
  useEffect(() => {
    rendererRef.current?.setEdgeMode(edgeMode);
  }, [edgeMode]);

  useEffect(() => {
    if (rendererRef.current) {
      if (typeof rendererRef.current.setView === "function") {
        rendererRef.current.setView(viewPreset);
      } else if (typeof rendererRef.current.setViewPreset === "function") {
        rendererRef.current.setViewPreset(viewPreset);
      }
    }
  }, [viewPreset]);

  useEffect(() => {
    rendererRef.current?.setSelectionType(selectionType);
  }, [selectionType]);

  useEffect(() => {
    rendererRef.current?.setGizmoMode(gizmoMode);
  }, [gizmoMode]);

  // Constrói o Sólido B-Rep com base no Tipo Real da Peça (PROIBIDO CONE PADRÃO)
  const applyParametersAndRebuild = useCallback(async () => {
    const tree = treeRef.current;
    tree.dispose();

    try {
      switch (modelType) {
        // 0. Chapa Extrudada / Geometria 2D Sketch
        case "extrude_sketch":
          tree.addFeature({
            name: modelTitle && modelTitle !== "Cone" ? modelTitle : "Chapa Planificada",
            type: "extrude_sketch",
            parameters: {
              depth: thickness,
              width: paramA || 200,
              length: paramB || 200,
              material,
            },
          });
          break;

        // 1. Transição Quadrado para Redondo
        case "boilermaking_transition":
          tree.addFeature({
            name: "Transição Quadrado-Redondo",
            type: "boilermaking_transition",
            parameters: {
              width: paramA,
              length: paramB,
              diameter: paramD,
              height: paramC,
              thickness,
              material,
            },
          });
          break;

        // 2. Curva de Gomos / Cotovelo Segmentado
        case "boilermaking_elbow":
          tree.addFeature({
            name: "Curva de Gomos",
            type: "boilermaking_elbow",
            parameters: {
              diameter: paramA,
              radius: paramB,
              angleDeg: 90,
              segments: 4,
              thickness,
              material,
            },
          });
          break;

        // 3. Boca de Lobo / Derivação Cilíndrica
        case "boilermaking_branch":
          tree.addFeature({
            name: "Boca de Lobo / Tê",
            type: "boilermaking_branch",
            parameters: {
              mainDiameter: paramA,
              branchDiameter: paramB,
              mainLength: Math.max(300, paramA * 2),
              branchHeight: paramC,
              thickness,
              material,
            },
          });
          break;

        // 4. Chapéu Chinês / Coifa
        case "boilermaking_hood":
          tree.addFeature({
            name: "Chapéu Chinês",
            type: "boilermaking_hood",
            parameters: {
              baseDiameter: paramA,
              topDiameter: paramB,
              height: paramC,
              thickness,
              material,
            },
          });
          break;

        // 5. Cilindro Industrial
        case "base_cylinder":
          tree.addFeature({
            name: "Cilindro Industrial",
            type: "base_cylinder",
            parameters: {
              radius: paramA / 2,
              height: paramC,
              thickness,
              material,
            },
          });
          break;

        // 6. Cone Truncado
        case "boilermaking_cone":
        default:
          tree.addFeature({
            name: "Cone Truncado Base",
            type: "boilermaking_cone",
            parameters: {
              D: paramA,
              d: Math.max(2, Math.abs(paramB - paramA) < 1 ? paramA * 0.5 : paramB),
              height: paramC,
              thickness,
              material,
            },
          });
          break;
      }

      // Adições Paramétricas (Furos, Filetes, Chanfros)
      if (optHole) {
        tree.addFeature({
          name: "Furo Central Ø25 mm",
          type: "hole_cut",
          parameters: {
            diameter: 25,
            depth: paramC + 40,
            isThrough: true,
            position: { x: 0, y: 0, z: -paramC / 2 },
          },
        });
      }

      if (optFillet) {
        tree.addFeature({
          name: "Filete R4 mm",
          type: "fillet",
          parameters: { radius: 4, edgeIndices: [0] },
        });
      }

      if (optChamfer) {
        tree.addFeature({
          name: "Chanfro 3 mm",
          type: "chamfer",
          parameters: { distance: 3, edgeIndices: [1] },
        });
      }

      await rebuildFromTree();
      toast.success(`Modelo "${modelTitle}" reconstruído em B-Rep.`);
    } catch (err: unknown) {
      console.error("[CadBRepViewer] Erro na criação da geometria:", err);
      setConversionError((err as Error)?.message || "Não foi possível converter este modelo para CAD 3D.");
    }
  }, [
    modelType,
    modelTitle,
    paramA,
    paramB,
    paramC,
    paramD,
    thickness,
    material,
    optHole,
    optFillet,
    optChamfer,
    rebuildFromTree,
  ]);

  // Carrega a primeira geometria ao montar
  useEffect(() => {
    void applyParametersAndRebuild();
  }, [applyParametersAndRebuild]);

  // Ações de Undo / Redo
  const handleUndo = async () => {
    AudioManager.play("cad_undo");
    const res = await editorRef.current.undo();
    if (res) await rebuildFromTree();
  };

  const handleRedo = async () => {
    AudioManager.play("cad_redo");
    const res = await editorRef.current.redo();
    if (res) await rebuildFromTree();
  };

  // Enquadrar no modelo / Restaurar vista (Fit to Model) (Seção 14 - Reset)
  const handleFitToModel = () => {
    AudioManager.play("cad_reset");
    if (rendererRef.current) {
      if (typeof rendererRef.current.fitView === "function") {
        rendererRef.current.fitView();
      } else if (typeof rendererRef.current.fitToModel === "function") {
        rendererRef.current.fitToModel();
      }
    }
    toast.info("Enquadramento 3D centralizado na peça.");
  };

  const handleToggleOrtho = () => {
    const next = !isOrtho;
    setIsOrtho(next);
    rendererRef.current?.setCameraProjection(next);
    toast.info(next ? "Câmera Ortográfica (CAD)" : "Câmera em Perspectiva");
  };

  return (
    <div
      className={cn(
        "relative size-full overflow-hidden select-none transition-colors",
        isDarkTheme ? "bg-[#051833]" : "bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0]",
        className,
      )}
    >
      {/* 3D WEBGL CANVAS VIEWPORT */}
      <div ref={containerRef} className="size-full absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* ESTADO DE ERRO TÉCNICO (SEÇÃO 22: NUNCA FALLBACK SILENCIOSO PARA CONE) */}
      {conversionError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xs p-6">
          <div className="max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-2xl text-center font-mono">
            <AlertTriangle className="size-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Não foi possível converter este modelo para CAD 3D
            </h3>
            <p className="mt-2 text-xs text-slate-600">{conversionError}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => applyParametersAndRebuild()}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COTAS TÉCNICAS SOBREPOSTAS AO VIEWPORT (DINÂMICAS POR MODELO)            */}
      {/* ========================================================================= */}
      {!conversionError && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* COTA VERTICAL DE ALTURA */}
          <div className="absolute left-[33%] top-[38%] -translate-y-1/2 flex items-center gap-0.5 font-mono text-[9px] font-bold text-slate-800">
            <div className="flex flex-col items-center">
              <div className="h-28 w-px bg-slate-400 relative">
                <span className="absolute -top-1 -left-1 text-[6.5px] text-slate-600">▲</span>
                <span className="absolute -bottom-1 -left-1 text-[6.5px] text-slate-600">▼</span>
                <div className="absolute top-0 right-0 w-5 h-px bg-slate-400" />
                <div className="absolute bottom-0 right-0 w-5 h-px bg-slate-400" />
              </div>
            </div>
            <span className="bg-white/90 px-1 py-0.2 rounded shadow-2xs -rotate-90 origin-center text-[9px] text-slate-800 font-bold whitespace-nowrap">
              {paramC.toFixed(0)} mm
            </span>
          </div>

          {/* COTA HORIZONTAL DA BASE */}
          <div className="absolute left-[48%] bottom-[20%] -translate-x-1/2 flex flex-col items-center font-mono text-[9px] font-bold text-slate-800">
            <div className="w-36 h-px bg-slate-400 relative">
              <span className="absolute -left-1 -top-1.5 text-[6.5px] text-slate-600">◀</span>
              <span className="absolute -right-1 -top-1.5 text-[6.5px] text-slate-600">▶</span>
              <div className="absolute left-0 bottom-0 h-3.5 w-px bg-slate-400" />
              <div className="absolute right-0 bottom-0 h-3.5 w-px bg-slate-400" />
            </div>
            <span className="mt-0.5 bg-white/90 px-1 py-0.2 rounded shadow-2xs text-[9px] text-slate-800 font-bold">
              {modelType === "boilermaking_transition"
                ? `${paramA.toFixed(0)} × ${paramB.toFixed(0)} mm`
                : `Ø ${paramA.toFixed(0)} mm`}
            </span>
          </div>

          {/* BÚSSOLA DE COORDENADAS 3D DISCRETA (SEÇÃO 31) */}
          <div className="absolute top-2.5 right-[335px] pointer-events-none flex flex-col items-center">
            <div className="relative size-6 flex items-center justify-center">
              <div className="size-3.5 border border-slate-300 bg-white/60 rounded-xs shadow-2xs opacity-80" />
              <span className="absolute -top-2 text-[8px] font-bold text-blue-600 font-mono">Z</span>
              <span className="absolute -right-2 text-[8px] font-bold text-red-600 font-mono">X</span>
              <span className="absolute -top-0.5 right-3 text-[8px] font-bold text-emerald-600 font-mono">Y</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BARRA DE VISTAS, REPRESENTAÇÃO E NAVEGAÇÃO 3D (COMPACTA, PADRÃO CAD)  */}
      {/* ========================================================================= */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-auto">
        <div className="flex h-[36px] items-center gap-0.5 rounded-xl border border-slate-700/80 bg-slate-900/90 p-0.5 shadow-xl backdrop-blur-md">
          {/* VISTAS RÁPIDAS: ISO | FR | LAT | SUP */}
          {(
            [
              { id: "iso", label: "ISO" },
              { id: "front", label: "FR" },
              { id: "right", label: "LAT" },
              { id: "top", label: "SUP" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleViewPresetChange(v.id)}
              className={cn(
                "flex h-[26px] items-center gap-1 rounded-lg px-2 font-mono text-[10px] font-bold uppercase transition-all",
                viewPreset === v.id
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-slate-800",
              )}
              title={`Vista ${v.label}`}
            >
              <Box className="size-3" /> {v.label}
            </button>
          ))}

          <span className="h-3.5 w-px bg-slate-700 mx-1" />

          {/* REPRESENTAÇÃO TÉCNICA: SOMB | SOMB + AR | ARAME */}
          {(
            [
              { id: "shaded", label: "SOMB" },
              { id: "shaded-edges", label: "SOMB+AR" },
              { id: "wireframe", label: "ARAME" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setEdgeMode(m.id)}
              className={cn(
                "flex h-[26px] items-center gap-1 rounded-lg px-2 font-mono text-[10px] font-bold uppercase transition-all",
                edgeMode === m.id
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-slate-800",
              )}
              title={`Modo de renderização: ${m.label}`}
            >
              {m.label}
            </button>
          ))}

          <span className="h-3.5 w-px bg-slate-700 mx-1" />

          {/* PROJEÇÃO: PERSPECTIVA / ORTOGRÁFICO */}
          <button
            type="button"
            onClick={handleToggleOrtho}
            className={cn(
              "flex h-[26px] items-center gap-1 rounded-lg px-2 font-mono text-[10px] font-bold uppercase transition-all",
              isOrtho
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white hover:bg-slate-800",
            )}
            title={isOrtho ? "Câmera Ortográfica (clique para Perspectiva)" : "Câmera em Perspectiva (clique para Ortográfica)"}
          >
            {isOrtho ? "ORTO" : "PERSP"}
          </button>

          <span className="h-3.5 w-px bg-slate-700 mx-1" />

          {/* CONTROLES DE NAVEGAÇÃO: ZOOM +, ZOOM -, GIRAR, ENQUADRAR */}
          <button
            type="button"
            onClick={() => rendererRef.current?.zoomIn()}
            className="flex size-[26px] items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Aproximar Zoom (Zoom In)"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => rendererRef.current?.zoomOut()}
            className="flex size-[26px] items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Afastar Zoom (Zoom Out)"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => rendererRef.current?.orbitCamera(0.25, 0)}
            className="flex size-[26px] items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Rotacionar Câmera (Orbit)"
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitToModel}
            className="flex size-[26px] items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Enquadrar Modelo Centralizado (Fit to Model)"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOPO DIREITO: FERRAMENTAS DE MANIPULAÇÃO & VIEW CUBE                   */}
      {/* ========================================================================= */}
      <div className={cn(
        "absolute top-2.5 z-20 flex items-center gap-2 pointer-events-auto transition-all",
        rightPanelOpen ? "right-[335px]" : "right-3",
      )}>
        {/* BARRA DE MANIPULAÇÃO & HISTÓRICO */}
        <div className="flex h-[36px] items-center gap-0.5 rounded-xl border border-slate-700/80 bg-slate-900/90 p-0.5 shadow-xl backdrop-blur-md font-mono text-[10px] font-bold">
          <button
            type="button"
            onClick={() => {
              AudioManager.play("cad_gizmo");
              setGizmoMode((m) => (m === "off" ? "translate" : "off"));
            }}
            className={cn(
              "flex h-[26px] items-center gap-1 rounded-lg px-2 uppercase transition-colors",
              gizmoMode !== "off"
                ? "bg-red-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
            )}
            title="Alternar manipulador 3D (Gizmo)"
          >
            <Crosshair className="size-3" /> GIZMO {gizmoMode !== "off" ? "ON" : "▾"}
          </button>

          <span className="h-3.5 w-px bg-slate-700 mx-0.5" />

          {/* UNDO / REDO */}
          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            className={cn(
              "flex size-[26px] items-center justify-center rounded-lg transition-colors",
              canUndo ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "text-slate-600 cursor-not-allowed",
            )}
            title="Desfazer alteração (Undo)"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={handleRedo}
            className={cn(
              "flex size-[26px] items-center justify-center rounded-lg transition-colors",
              canRedo ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "text-slate-600 cursor-not-allowed",
            )}
            title="Refazer alteração (Redo)"
          >
            <Redo2 className="size-3.5" />
          </button>

          <span className="h-3.5 w-px bg-slate-700 mx-0.5" />

          {/* ÁUDIO & FULLSCREEN */}
          <AudioQuickControl />

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="flex size-[26px] items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="Alternar tela cheia"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>

        {/* VIEW CUBE CAD INTERATIVO COMPACTO */}
        <CadViewCube
          activePreset={viewPreset}
          onSelectPreset={handleViewPresetChange}
          cameraRotation={cameraRotation}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA LATERAL ESQUERDA (LARGURA 180-200px, COMPACTA)                   */}
      {/* ========================================================================= */}
      <div className="absolute top-2 left-2.5 z-20 flex flex-col gap-1 w-[180px] pointer-events-auto">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-1 shadow-lg backdrop-blur-xs flex flex-col gap-0.5">
          {/* CATEGORIA 1: CRIAR */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "criar" ? "none" : "criar";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all shadow-2xs",
              activeLeftCat === "criar"
                ? "bg-[#dc2626] text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Box className="size-3.5" /> CRIAR
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "criar" && "rotate-180")} />
          </button>

          {/* CATEGORIA 2: MODIFICAR */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "modificar" ? "none" : "modificar";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all",
              activeLeftCat === "modificar"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Scissors className="size-3.5" /> MODIFICAR
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "modificar" && "rotate-180")} />
          </button>

          {/* CATEGORIA 3: DETALHES */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "detalhes" ? "none" : "detalhes";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all",
              activeLeftCat === "detalhes"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Settings className="size-3.5" /> DETALHES
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "detalhes" && "rotate-180")} />
          </button>

          {/* CATEGORIA 4: CHAPA */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "chapa" ? "none" : "chapa";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all",
              activeLeftCat === "chapa"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5" /> CHAPA
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "chapa" && "rotate-180")} />
          </button>

          {/* CATEGORIA 5: ESTRUTURAS */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "estruturas" ? "none" : "estruturas";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all",
              activeLeftCat === "estruturas"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Boxes className="size-3.5" /> ESTRUTURAS
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "estruturas" && "rotate-180")} />
          </button>

          {/* CATEGORIA 6: MEDIR */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "medir" ? "none" : "medir";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all",
              activeLeftCat === "medir"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Ruler className="size-3.5" /> MEDIR
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "medir" && "rotate-180")} />
          </button>

          {/* CATEGORIA 7: EXPORTAR */}
          <button
            type="button"
            onClick={() => {
              setActiveLeftCat((c) => {
                const next = c === "exportar" ? "none" : "exportar";
                AudioManager.play(next === "none" ? "ui_toggle_close" : "ui_toggle_open");
                return next;
              });
            }}
            className={cn(
              "flex h-[32px] w-full items-center justify-between rounded-xl px-2 font-mono text-[10px] font-bold uppercase transition-all",
              activeLeftCat === "exportar"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Download className="size-3.5" /> EXPORTAR
            </div>
            <ChevronDown className={cn("size-3.5 transition-transform", activeLeftCat === "exportar" && "rotate-180")} />
          </button>
        </div>

        {/* SUBPAINEL FLYOUT ADJACENTE (NÃO COBRE A PEÇA) */}
        {activeLeftCat !== "none" && (
          <div className="absolute left-[184px] top-0 w-38 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-xs flex flex-col gap-0.5 font-mono text-[9.5px]">
            <div className="flex items-center justify-between pb-0.5 border-b border-slate-100 font-bold text-slate-800 uppercase">
              <span>{activeLeftCat}</span>
              <button
                type="button"
                onClick={() => {
                  setActiveLeftCat("none");
                  AudioManager.play("ui_toggle_close");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-3" />
              </button>
            </div>

            {activeLeftCat === "criar" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModelType("boilermaking_cone");
                    setModelTitle("Cone Truncado");
                    setParamA(200);
                    setParamB(2);
                    setParamC(100);
                  }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Flame className="size-3" /> Cone Truncado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModelType("boilermaking_transition");
                    setModelTitle("Quadrado para Redondo");
                    setParamA(200);
                    setParamB(200);
                    setParamD(120);
                    setParamC(150);
                  }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Layers className="size-3" /> Quadrado → Redondo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModelType("boilermaking_elbow");
                    setModelTitle("Curva de Gomos");
                    setParamA(150);
                    setParamB(225);
                    setParamC(90);
                  }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Box className="size-3" /> Curva de Gomos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModelType("boilermaking_branch");
                    setModelTitle("Boca de Lobo");
                    setParamA(200);
                    setParamB(150);
                    setParamC(180);
                  }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Crosshair className="size-3" /> Boca de Lobo / Tê
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModelType("base_cylinder");
                    setModelTitle("Cilindro Industrial");
                    setParamA(160);
                    setParamC(220);
                  }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Box className="size-3" /> Cilindro / Tubo
                </button>
              </>
            )}

            {activeLeftCat === "modificar" && (
              <>
                <button
                  type="button"
                  onClick={() => setGizmoMode("translate")}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Move className="size-3" /> Mover / Transladar
                </button>
                <button
                  type="button"
                  onClick={() => setOptHole((h) => !h)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Crosshair className="size-3" /> Furo Passante
                </button>
                <button
                  type="button"
                  onClick={() => setOptFillet((f) => !f)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Scissors className="size-3" /> Filete nas Arestas
                </button>
                <button
                  type="button"
                  onClick={() => setOptChamfer((c) => !c)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Scissors className="size-3" /> Chanfro 45°
                </button>
              </>
            )}

            {activeLeftCat === "chapa" && (
              <>
                <button
                  type="button"
                  onClick={() => setFlatPatternDialogOpen(true)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-red-600 font-bold hover:bg-red-50"
                >
                  <Compass className="size-3" /> Planificar Sólido
                </button>
                <button
                  type="button"
                  onClick={() => setDraftingDialogOpen(true)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <FileText className="size-3" /> Prancha 2D ABNT
                </button>
              </>
            )}

            {activeLeftCat === "estruturas" && (
              <>
                <button
                  type="button"
                  onClick={() => setWeldmentDialogOpen(true)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600 font-bold"
                >
                  <Boxes className="size-3" /> Perfis & Cut-List
                </button>
              </>
            )}

            {activeLeftCat === "medir" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRightTab("inspecao");
                    setRightPanelOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Ruler className="size-3" /> Metrologia B-Rep
                </button>
              </>
            )}

            {activeLeftCat === "exportar" && (
              <>
                <button
                  type="button"
                  onClick={() => setFlatPatternDialogOpen(true)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Download className="size-3" /> DXF / Código G
                </button>
                <button
                  type="button"
                  onClick={() => setDraftingDialogOpen(true)}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"
                >
                  <Download className="size-3" /> Prancha Técnica DXF
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. PAINEL CONTEXTUAL DIREITO (LARGURA 320px, COMPACTO)                    */}
      {/* ========================================================================= */}
      {rightPanelOpen && (
        <div className="absolute top-14 right-3 z-20 w-[320px] rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-xl backdrop-blur-xs flex flex-col gap-2 font-mono text-[10px] text-slate-800 pointer-events-auto">
          {/* ABAS DO PAINEL */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRightTab("parametros")}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase transition-colors text-[9.5px]",
                  rightTab === "parametros"
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <Sliders className="size-3 text-red-600" /> PARÂMETROS
              </button>

              <button
                type="button"
                onClick={() => setRightTab("inspecao")}
                className={cn(
                  "rounded-full px-2 py-0.5 font-bold uppercase transition-colors text-[9.5px]",
                  rightTab === "inspecao"
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                INSPEÇÃO
              </button>

              <button
                type="button"
                onClick={() => setRightTab("filtro")}
                className={cn(
                  "rounded-full px-2 py-0.5 font-bold uppercase transition-colors text-[9.5px]",
                  rightTab === "filtro"
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                FILTRO
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRightPanelOpen(false)}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Fechar painel"
            >
              <X className="size-3" />
            </button>
          </div>

          {/* ABA 1: PARÂMETROS COM MINI-DIAGRAMA TÉCNICO VETORIAL DINÂMICO */}
          {rightTab === "parametros" && (
            <div className="flex flex-col gap-2">
              {/* NOME DA PEÇA */}
              <div className="flex items-center gap-1.5 font-bold text-slate-900 uppercase text-[12px]">
                <Box className="size-3.5 text-red-600" /> {modelTitle.toUpperCase()}
              </div>

              {/* INPUTS + DIAGRAMA ESQUEMÁTICO ESPECÍFICO DA PEÇA */}
              <div className="grid grid-cols-2 gap-2 items-center">
                {/* COLUNA ESQUERDA: INPUTS NUMÉRICOS */}
                <div className="flex flex-col gap-1">
                  {modelType === "boilermaking_transition" ? (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          BASE (X)
                        </label>
                        <div className="flex h-[28px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 mt-0.5">
                          <input
                            type="number"
                            value={paramA}
                            onChange={(e) => setParamA(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-[11px]"
                          />
                          <span className="text-[8.5px] text-slate-400">mm</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          DIÂMETRO (Ø)
                        </label>
                        <div className="flex h-[28px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 mt-0.5">
                          <input
                            type="number"
                            value={paramD}
                            onChange={(e) => setParamD(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-[11px]"
                          />
                          <span className="text-[8.5px] text-slate-400">mm</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          ALTURA (Z)
                        </label>
                        <div className="flex h-[28px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 mt-0.5">
                          <input
                            type="number"
                            value={paramC}
                            onChange={(e) => setParamC(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-[11px]"
                          />
                          <span className="text-[8.5px] text-slate-400">mm</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          DIÂMETRO BASE (X)
                        </label>
                        <div className="flex h-[28px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 mt-0.5">
                          <input
                            type="number"
                            value={paramA}
                            onChange={(e) => setParamA(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-[11px]"
                          />
                          <span className="text-[8.5px] text-slate-400">mm</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          ALTURA (Z)
                        </label>
                        <div className="flex h-[28px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 mt-0.5">
                          <input
                            type="number"
                            value={paramC}
                            onChange={(e) => setParamC(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-[11px]"
                          />
                          <span className="text-[8.5px] text-slate-400">mm</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          ESPESSURA
                        </label>
                        <div className="flex h-[28px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 mt-0.5">
                          <input
                            type="number"
                            value={thickness}
                            onChange={(e) => setThickness(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-[11px]"
                          />
                          <span className="text-[8.5px] text-slate-400">mm</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* COLUNA DIREITA: MINI-DIAGRAMA TÉCNICO VETORIAL ESPECÍFICO */}
                <div className="flex items-center justify-center p-1 border border-slate-100 bg-slate-50/70 rounded-xl h-full">
                  {modelType === "boilermaking_transition" ? (
                    <svg viewBox="0 0 100 80" className="w-full h-18">
                      {/* Diagrama Quadrado -> Redondo */}
                      <line x1="12" y1="15" x2="12" y2="60" stroke="#94a3b8" strokeWidth="0.75" />
                      <text x="6" y="38" fontSize="6" fill="#475569" fontWeight="bold" textAnchor="end">H</text>
                      <polygon points="35,18 65,18 85,60 15,60" fill="#fee2e2" stroke="#dc2626" strokeWidth="0.8" />
                      <ellipse cx="50" cy="18" rx="15" ry="3.5" fill="#fecaca" stroke="#dc2626" strokeWidth="0.75" />
                      <line x1="15" y1="70" x2="85" y2="70" stroke="#94a3b8" strokeWidth="0.75" />
                      <text x="50" y="76" fontSize="6" fill="#475569" fontWeight="bold" textAnchor="middle">A</text>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 100 80" className="w-full h-18">
                      {/* Cota Z lateral */}
                      <line x1="12" y1="10" x2="12" y2="60" stroke="#94a3b8" strokeWidth="0.75" />
                      <line x1="8" y1="10" x2="16" y2="10" stroke="#94a3b8" strokeWidth="0.75" />
                      <line x1="8" y1="60" x2="16" y2="60" stroke="#94a3b8" strokeWidth="0.75" />
                      <text x="6" y="36" fontSize="6" fill="#475569" fontWeight="bold" textAnchor="end">Z</text>

                      {/* Sombra / Preenchimento do Cone */}
                      <polygon points="55,10 25,60 85,60" fill="#fee2e2" stroke="#dc2626" strokeWidth="0.8" />
                      <ellipse cx="55" cy="60" rx="30" ry="5.5" fill="#fecaca" stroke="#dc2626" strokeWidth="0.8" />
                      <path d="M 25 60 A 30 5.5 0 0 1 85 60" fill="none" stroke="#dc2626" strokeWidth="0.75" strokeDasharray="2,2" />

                      {/* Cota X inferior */}
                      <line x1="25" y1="70" x2="85" y2="70" stroke="#94a3b8" strokeWidth="0.75" />
                      <line x1="25" y1="65" x2="25" y2="73" stroke="#94a3b8" strokeWidth="0.75" />
                      <line x1="85" y1="65" x2="85" y2="73" stroke="#94a3b8" strokeWidth="0.75" />
                      <text x="55" y="77" fontSize="6" fill="#475569" fontWeight="bold" textAnchor="middle">X</text>
                    </svg>
                  )}
                </div>
              </div>

              {/* OPÇÕES E MATERIAL */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    OPÇÕES
                  </span>
                  <label className="flex items-center gap-1 text-[8.5px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optHole}
                      onChange={(e) => setOptHole(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 size-2.5"
                    />
                    FURO CENTRAL
                  </label>
                  <label className="flex items-center gap-1 text-[8.5px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optFillet}
                      onChange={(e) => setOptFillet(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 size-2.5"
                    />
                    FILETE ARESTAS
                  </label>
                  <label className="flex items-center gap-1 text-[8.5px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optChamfer}
                      onChange={(e) => setOptChamfer(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 size-2.5"
                    />
                    CHANFRO
                  </label>
                </div>

                {/* MATERIAL */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                    MATERIAL
                  </span>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full h-[28px] rounded-lg border border-slate-200 bg-slate-50 px-1.5 font-mono text-[9.5px] font-bold text-slate-900 outline-none"
                  >
                    <option value="Aço Carbono">Aço Carbono</option>
                    <option value="Inox 304">Inox 304</option>
                    <option value="Alumínio 5052">Alumínio 5052</option>
                  </select>
                </div>
              </div>

              {/* BOTÃO PRINCIPAL APLICAR (VERMELHO SÓLIDO CALDRA — 34px) */}
              <button
                type="button"
                onClick={applyParametersAndRebuild}
                className="mt-0.5 flex h-[34px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#dc2626] font-mono text-[10.5px] font-bold tracking-wider text-white shadow-xs hover:bg-[#b91c1c] active:scale-[0.99] transition-all uppercase"
              >
                <Settings className="size-3.5" /> APLICAR
              </button>
            </div>
          )}

          {/* ABA 2: INSPEÇÃO B-REP */}
          {rightTab === "inspecao" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-bold text-slate-900 text-[10.5px]">INSPEÇÃO B-REP</span>
                <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">
                  <span className="size-1 rounded-full bg-emerald-500" /> OCCT VALID
                </span>
              </div>

              <div className="flex flex-col gap-1 text-[9.5px] text-slate-600">
                <div>Dimensões: <strong className="text-slate-900">{paramA.toFixed(0)} × {paramB.toFixed(0)} × {paramC.toFixed(0)} mm</strong></div>
                <div>Volume: <strong className="text-slate-900">{massProps ? massProps.volume.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "30.000"} mm³</strong></div>
                <div>Massa Est.: <strong className="text-red-600">{massProps ? massProps.mass.toFixed(3) : "9.030"} kg</strong></div>
                <div>Área Total: <strong className="text-slate-900">{massProps ? massProps.surfaceArea.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "21.200"} mm²</strong></div>
                <div>Topologia: <strong className="text-slate-900">{tessData?.faces.length ?? 3} faces, {tessData?.edges.length ?? 6} arestas</strong></div>
              </div>
            </div>
          )}

          {/* ABA 3: FILTRO DE SELEÇÃO */}
          {rightTab === "filtro" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                FILTRO DE ENTIDADE
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(["face", "edge", "vertex"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectionType(t)}
                    className={cn(
                      "rounded-lg border px-1 py-1 text-center font-bold uppercase transition-colors text-[9px]",
                      selectionType === t
                        ? "border-red-200 bg-red-50 text-red-600 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {t === "face" ? "FACE" : t === "edge" ? "ARESTA" : "VÉRTICE"}
                  </button>
                ))}
              </div>

              {selectedEntity ? (
                <div className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-[9px]">
                  <div className="font-bold text-slate-800">
                    {selectedEntity.type.toUpperCase()} #{selectedEntity.index}
                  </div>
                  <div className="text-slate-500">
                    Posição: ({selectedEntity.point?.x.toFixed(1)}, {selectedEntity.point?.y.toFixed(1)}, {selectedEntity.point?.z.toFixed(1)})
                  </div>
                </div>
              ) : (
                <div className="mt-0.5 rounded-lg border border-dashed border-slate-200 p-1.5 text-center text-[9px] text-slate-400">
                  Clique na peça para selecionar uma {selectionType}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. AÇÕES PRINCIPAIS (APARECEM NO CHÃO DO VIEWPORT — 36px)                 */}
      {/* ========================================================================= */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-slate-200/90 bg-white p-0.5 shadow-lg backdrop-blur-xs pointer-events-auto">
        {/* PLANIFICAR */}
        <button
          type="button"
          onClick={() => {
            AudioManager.play("planify_sequence");
            setFlatPatternDialogOpen(true);
          }}
          className="flex h-[36px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 font-mono text-[10px] font-bold text-red-600 shadow-2xs hover:bg-red-100 transition-colors uppercase"
          title="Planificar sólido 3D"
        >
          <Compass className="size-3.5 text-red-600" /> PLANIFICAR
        </button>

        {/* PRANCHA 2D */}
        <button
          type="button"
          onClick={() => setDraftingDialogOpen(true)}
          className="flex h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 font-mono text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors uppercase"
          title="Desenho técnico 2D ABNT com vistas ortográficas e carimbo"
        >
          <FileText className="size-3.5 text-slate-600" /> PRANCHA 2D
        </button>

        {/* ESTRUTURAS */}
        <button
          type="button"
          onClick={() => setWeldmentDialogOpen(true)}
          className="flex h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 font-mono text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors uppercase"
          title="Estruturas metálicas, perfis industriais e lista de corte"
        >
          <Boxes className="size-3.5 text-slate-600" /> ESTRUTURAS
        </button>

        {/* CNC / DXF */}
        <button
          type="button"
          onClick={() => setFlatPatternDialogOpen(true)}
          className="flex h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 font-mono text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors uppercase"
          title="Exportar código G CNC e DXF para máquinas de corte"
        >
          <Crosshair className="size-3.5 text-slate-600" /> CNC / DXF
        </button>
      </div>

      {/* ========================================================================= */}
      {/* DIÁLOGOS DE PROCESSAMENTO REAL                                            */}
      {/* ========================================================================= */}
      <CaldraBoilermakingDialog
        open={templatesDialogOpen}
        onClose={() => setTemplatesDialogOpen(false)}
        tree={treeRef.current}
        onRebuild={rebuildFromTree}
      />

      <CaldraFlatPatternDialog
        open={flatPatternDialogOpen}
        onClose={() => setFlatPatternDialogOpen(false)}
        features={featuresList}
        fallbackDimensions={{ width: paramA, length: paramB, thickness }}
      />

      <CaldraDraftingDialog
        open={draftingDialogOpen}
        onClose={() => setDraftingDialogOpen(false)}
        features={featuresList}
        massProps={massProps}
        dimensions={{ width: paramA, length: paramB, height: paramC }}
      />

      <CaldraWeldmentDialog
        open={weldmentDialogOpen}
        onClose={() => setWeldmentDialogOpen(false)}
        tree={treeRef.current}
        onRebuild={rebuildFromTree}
      />
    </div>
  );
}
