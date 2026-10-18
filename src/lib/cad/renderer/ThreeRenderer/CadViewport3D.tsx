/**
 * CALDRA CAD CORE — CAD VIEWPORT 3D (REACT COMPONENT)
 *
 * Viewport profissional integrado de modelagem sólida B-Rep:
 * - Alternador de modos: SOMB (padrão) | SOMB+AR | ARAME
 * - Câmeras canônicas industriais: ISO | FRONTAL | LATERAL | SUPERIOR
 * - HUD de metrologia física: Volume, Área de chapa, Caixa delimitadora
 * - Inspeção de faces e vértices via seleção interativa
 * - Botões de intercâmbio de dados: Exportar STEP e STL
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Box,
  Layers,
  RotateCcw,
  Download,
  Info,
  Maximize2,
  Check,
  Cpu,
} from "lucide-react";
import {
  ThreeCadRenderer,
  type CadEdgeMode,
  type CadCameraPreset,
} from "./ThreeCadRenderer";
import type { CadShape } from "../../core/CadShape";
import type { CadMesh, CadBoundingBox, CadMassProperties } from "../../core/CadTopology";
import { type CadSelectedEntity, CadSelectionManager } from "../../core/CadSelection";
import type { CadKernel } from "../../core/CadKernel";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";

export interface CadViewport3DProps {
  kernel: CadKernel;
  shape: CadShape | null;
  className?: string;
  viewPreset?: CadCameraPreset;
  viewNonce?: number;
  edgeMode?: CadEdgeMode;
  hideTopBar?: boolean;
  onExportStep?: () => void;
  onExportStl?: () => void;
}

export function CadViewport3D({
  kernel,
  shape,
  className,
  viewPreset: propViewPreset,
  viewNonce,
  edgeMode: propEdgeMode,
  hideTopBar = false,
  onExportStep,
  onExportStl,
}: CadViewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ThreeCadRenderer | null>(null);
  const [rendererInstance, setRendererInstance] = useState<ThreeCadRenderer | null>(null);
  const [selectionManager] = useState(() => new CadSelectionManager());

  const [edgeMode, setEdgeMode] = useState<CadEdgeMode>(propEdgeMode ?? "shaded");
  const [selectedEntity, setSelectedEntity] = useState<CadSelectedEntity | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<CadSelectedEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // Sincronização externa de Preset de Câmera (ISO, FR, SUP, LAT)
  useEffect(() => {
    if (propViewPreset && rendererInstance) {
      rendererInstance.setView(propViewPreset);
    }
  }, [propViewPreset, viewNonce, rendererInstance]);

  // Sincronização externa de Modo de Aresta (SOMB, SOMB+AR, ARAME)
  useEffect(() => {
    if (propEdgeMode && rendererInstance) {
      setEdgeMode(propEdgeMode);
      rendererInstance.setEdgeMode(propEdgeMode);
    }
  }, [propEdgeMode, rendererInstance]);

  const [massProps, setMassProps] = useState<CadMassProperties | null>(null);
  const [bbox, setBbox] = useState<CadBoundingBox | null>(null);
  const [mesh, setMesh] = useState<CadMesh | null>(null);

  // Inicializa o ThreeCadRenderer no elemento DOM
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new ThreeCadRenderer(containerRef.current, {
      edgeMode,
      onHover: (entity) => {
        selectionManager.setHovered(entity);
        setHoveredEntity(entity);
      },
      onSelect: (entity, multi) => {
        if (entity) {
          selectionManager.select(entity, multi);
          setSelectedEntity(entity);
        } else {
          selectionManager.clear();
          setSelectedEntity(null);
        }
      },
    });

    rendererRef.current = renderer;
    setRendererInstance(renderer);

    if (typeof window !== "undefined") {
      (window as any).__CALDRA_CAD3D_DIAGNOSTIC__ = () => {
        const diag = renderer.getDiagnosticState();
        console.info("[CALDRA CAD3D DIAGNOSTIC]", diag);
        return diag;
      };
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__CALDRA_CAD3D_DIAGNOSTIC__;
      }
      renderer.dispose();
      rendererRef.current = null;
      setRendererInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza malha e métricas quando a forma ativa muda
  useEffect(() => {
    if (!shape || !kernel || !rendererInstance) return;

    let active = true;
    setIsLoading(true);

    (async () => {
      try {
        const [cadMesh, bounds, props] = await Promise.all([
          kernel.tessellate(shape, { linearDeflection: 0.1, angularDeflection: 0.5 }),
          kernel.getBoundingBox(shape).catch(() => null),
          kernel.getMassProperties(shape).catch(() => null),
        ]);

        if (!active) return;
        setMesh(cadMesh);
        setBbox(bounds);
        setMassProps(props);

        rendererInstance.setMesh(shape.id, cadMesh);
        rendererInstance.fitToView();
      } catch (err) {
        console.error("Erro ao tesselar sólido para o Viewport:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [shape, kernel, rendererInstance]);

  const handleEdgeModeChange = (mode: CadEdgeMode) => {
    triggerHaptic("selection");
    setEdgeMode(mode);
    rendererRef.current?.setEdgeMode(mode);
  };

  const handleCameraPreset = (preset: CadCameraPreset) => {
    triggerHaptic("selection");
    rendererRef.current?.setView(preset);
  };

  const handleFit = () => {
    triggerHaptic("selection");
    rendererRef.current?.fitToView();
  };

  const handleDownloadStep = async () => {
    if (!shape || !kernel) return;
    triggerHaptic("confirm");
    try {
      const stepContent = await kernel.exportStep(shape);
      const blob = new Blob([stepContent], { type: "application/step" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shape.name || "modelo_caldra"}.step`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Falha ao exportar STEP:", err);
    }
  };

  const handleDownloadStl = async () => {
    if (!shape || !kernel) return;
    triggerHaptic("confirm");
    try {
      const stl = await kernel.exportStl(shape, false);
      const blob = new Blob([stl as string], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shape.name || "modelo_caldra"}.stl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Falha ao exportar STL:", err);
    }
  };

  return (
    <div className={cn("relative flex h-full w-full flex-col overflow-hidden bg-[#0c111d] select-none", className)}>
      {/* 1. Barra de Controles Superior */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Modos de Aresta Técnica */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0f172a]/90 p-1 backdrop-blur pointer-events-auto shadow-lg">
          <button
            type="button"
            onClick={() => handleEdgeModeChange("shaded")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase rounded transition-colors",
              edgeMode === "shaded"
                ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40"
                : "text-slate-400 hover:text-slate-200"
            )}
            title="SOMB: Superfície sombreada com bordas brancas puras"
          >
            SOMB
          </button>
          <button
            type="button"
            onClick={() => handleEdgeModeChange("shaded-edges")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase rounded transition-colors",
              edgeMode === "shaded-edges"
                ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40"
                : "text-slate-400 hover:text-slate-200"
            )}
            title="SOMB+AR: Superfície com bordas e geratrizes técnicas"
          >
            SOMB+AR
          </button>
          <button
            type="button"
            onClick={() => handleEdgeModeChange("wireframe")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase rounded transition-colors",
              edgeMode === "wireframe"
                ? "bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40"
                : "text-slate-400 hover:text-slate-200"
            )}
            title="ARAME: Estrutura esquelética translúcida"
          >
            ARAME
          </button>
        </div>

        {/* Câmeras Técnicas & Reenquadrar */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0f172a]/90 p-1 backdrop-blur pointer-events-auto shadow-lg">
          {(["iso", "front", "top", "side"] as CadCameraPreset[]).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => handleCameraPreset(view)}
              className="px-2 py-1 text-[10px] font-mono uppercase text-slate-400 hover:text-slate-100 transition-colors"
            >
              {view === "iso" ? "ISO" : view === "front" ? "FR" : view === "top" ? "SUP" : "LAT"}
            </button>
          ))}
          <div className="h-3 w-px bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={handleFit}
            className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
            title="Reenquadrar Câmera (Fit)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Metrologia e Exportação */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0f172a]/90 p-1 backdrop-blur pointer-events-auto shadow-lg">
          <button
            type="button"
            onClick={() => setShowMetadata(!showMetadata)}
            className={cn(
              "p-1.5 rounded transition-colors",
              showMetadata ? "bg-sky-500/20 text-sky-400" : "text-slate-400 hover:text-slate-100"
            )}
            title="Propriedades Físicas e B-Rep"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <div className="h-3 w-px bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={handleDownloadStep}
            className="px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
            title="Exportar Geometria Sólida STEP (AP203/AP214)"
          >
            <Download className="h-3 w-3" /> STEP
          </button>
          <button
            type="button"
            onClick={handleDownloadStl}
            className="px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1"
            title="Exportar Malha de Triângulos STL"
          >
            <Download className="h-3 w-3" /> STL
          </button>
        </div>
      </div>

      {/* 2. Container Three.js */}
      <div ref={containerRef} className="relative h-full w-full cursor-grab active:cursor-grabbing" />

      {/* 3. Indicador de Carregamento */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0c111d]/60 backdrop-blur-xs pointer-events-none z-30">
          <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-[#0f172a]/90 px-4 py-2 text-xs font-mono text-sky-300 shadow-xl">
            <Cpu className="h-4 w-4 animate-spin text-sky-400" />
            Tesselando modelo B-Rep...
          </div>
        </div>
      )}

      {/* 4. HUD Inferior com Informações de Seleção ou Sólido */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
        {selectedEntity ? (
          <div className="rounded-lg border border-sky-500/40 bg-[#0f172a]/95 px-3 py-2 text-xs font-mono text-slate-200 shadow-xl backdrop-blur max-w-xs">
            <div className="text-[10px] text-sky-400 uppercase tracking-wider font-bold mb-1">
              Face B-Rep Selecionada ({selectedEntity.id})
            </div>
            {selectedEntity.point && (
              <div className="text-[10px] text-slate-400">
                Ponto: X {selectedEntity.point.x.toFixed(1)} | Y {selectedEntity.point.y.toFixed(1)} | Z {selectedEntity.point.z.toFixed(1)} mm
              </div>
            )}
            {selectedEntity.normal && (
              <div className="text-[10px] text-slate-400">
                Normal: [{selectedEntity.normal.x.toFixed(2)}, {selectedEntity.normal.y.toFixed(2)}, {selectedEntity.normal.z.toFixed(2)}]
              </div>
            )}
          </div>
        ) : hoveredEntity ? (
          <div className="rounded-md border border-slate-800 bg-[#0f172a]/80 px-2 py-1 text-[10px] font-mono text-slate-400 backdrop-blur">
            Hover: {hoveredEntity.id}
          </div>
        ) : null}
      </div>

      {/* 5. Painel Flutuante de Metrologia e Propriedades */}
      {showMetadata && (
        <div className="absolute top-14 right-3 z-20 w-64 rounded-xl border border-slate-800 bg-[#0f172a]/95 p-3.5 text-xs font-mono text-slate-300 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <span className="font-semibold text-sky-400 text-[11px] uppercase tracking-wide">
              Propriedades CAD
            </span>
            <span className="text-[10px] text-slate-500">OCCT Kernel</span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <div className="text-slate-400 text-[10px]">Nome do Sólido:</div>
              <div className="font-medium text-slate-100 truncate">{shape?.name ?? "N/A"}</div>
            </div>

            {massProps && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume:</span>
                  <span className="text-slate-100">{(massProps.volume / 1000).toFixed(2)} cm³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Área Externa:</span>
                  <span className="text-slate-100">{(massProps.surfaceArea / 100).toFixed(1)} cm²</span>
                </div>
              </>
            )}

            {bbox && (
              <div className="pt-1.5 border-t border-slate-800/80">
                <div className="text-slate-400 text-[10px] mb-1">Dimensões Envolventes:</div>
                <div className="text-[10px] text-slate-300">
                  X: {bbox.size.x.toFixed(1)} mm <br />
                  Y: {bbox.size.y.toFixed(1)} mm <br />
                  Z: {bbox.size.z.toFixed(1)} mm
                </div>
              </div>
            )}

            {mesh && (
              <div className="pt-1.5 border-t border-slate-800/80 flex justify-between text-[10px] text-slate-400">
                <span>Triângulos: {mesh.indices.length / 3}</span>
                <span>Faces B-Rep: {mesh.faceCount ?? "N/A"}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
