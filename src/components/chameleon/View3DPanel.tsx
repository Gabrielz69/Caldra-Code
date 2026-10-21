/**
 * VISUALIZAÇÃO 3D COMO CAMADA, NÃO COMO ETAPA.
 *
 * O 3D deixou de ser uma aba do fluxo (Geometria → Planificação → Fabricação)
 * e virou uma alternância dentro da própria área de resultado: a mesma peça,
 * vista em 2D ou em 3D. O modelo só é carregado quando o 3D é ligado.
 */

import { Component, useEffect, useState, type ReactNode } from "react";
import type { WireModel } from "@/lib/viz3d/wire";
import type { GeometryRef } from "@/lib/geometry/refs";
import {
  DEFAULT_VIEW,
  EDGE_MODES,
  EXTENDED_VIEW_PRESETS,
  VIEW_PRESETS,
  type EdgeMode,
  type ViewPresetId,
} from "@/lib/viz3d/cameraPresets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Rotate3d,
  RotateCcw,
  Spline,
} from "lucide-react";
import { Viz3DDiagnosticModal } from "./Viz3DDiagnosticModal";
import { Wire3D } from "./Wire3D";

/** Sincronização de seleção 3D ↔ geometria canônica (Fase F). */
export type SelectionSync = {
  refForEdge?: ((index: number) => GeometryRef | null) | undefined;
  refForFace?: ((index: number) => GeometryRef | null) | undefined;
  highlightRef?: GeometryRef | readonly GeometryRef[] | null | undefined;
  onSelectRef?: ((ref: GeometryRef | null) => void) | undefined;
};

export type VisualizationMode = "2d" | "3d";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean; error: Error | null };

/** Protege a aplicação contra crashes em tempo de renderização 3D */
export class View3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("View3D caught render error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="grid size-full place-items-center p-4 text-center">
          <div className="max-w-xs space-y-2 rounded-lg border border-line bg-card/95 p-4 shadow-sm backdrop-blur">
            <p className="font-mono text-xs font-semibold text-destructive">
              Visualização 3D indisponível
            </p>
            <p className="text-[11px] text-muted-foreground">
              Ocorreu uma falha no cálculo ou renderização da malha 3D.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={this.handleRetry}
              className="h-7 font-mono text-[10px] uppercase text-accent"
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Área principal única da Traçagem. O 3D é montado somente no primeiro uso e
 * depois permanece vivo, preservando câmera, zoom e orientação ao voltar ao 2D.
 */
export function VisualizationViewport({
  mode,
  onModeChange,
  model,
  unfold,
  onUnfold,
  onPlanificar,
  allow3d = true,
  selection,
  showGeneratrices,
  onToggleGeneratrices,
  children,
}: {
  mode: VisualizationMode;
  onModeChange: (mode: VisualizationMode) => void;
  model: WireModel;
  unfold: number;
  onUnfold: (value: number) => void;
  onPlanificar: () => void;
  allow3d?: boolean;
  selection?: SelectionSync | undefined;
  showGeneratrices?: boolean;
  onToggleGeneratrices?: () => void;
  children: ReactNode;
}) {
  const [mounted3d, setMounted3d] = useState(mode === "3d");

  useEffect(() => {
    if (mode === "3d") setMounted3d(true);
  }, [mode]);

  const activeMode: VisualizationMode = allow3d ? mode : "2d";

  return (
    <div className="grid-bg relative h-[300px] overflow-hidden rounded-xl border border-line bg-background/40 lg:h-[420px]">
      <div className={cn("size-full", activeMode !== "2d" && "invisible absolute inset-0")}>
        {children}
      </div>
      {mounted3d && allow3d && (
        <div className={cn("size-full", activeMode !== "3d" && "invisible absolute inset-0")}>
          <View3DErrorBoundary>
            <View3DPanel
              model={model}
              unfold={unfold}
              onUnfold={onUnfold}
              onPlanificar={onPlanificar}
              selection={selection}
            />
          </View3DErrorBoundary>
        </div>
      )}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        {activeMode === "2d" && onToggleGeneratrices && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Exibir ou ocultar geratrizes interativas na representação 2D"
            aria-pressed={showGeneratrices}
            onClick={onToggleGeneratrices}
            className={cn(
              "h-7 rounded-md border border-line bg-background/85 px-2 font-mono text-[10px] uppercase shadow-sm backdrop-blur transition-colors gap-1",
              showGeneratrices
                ? "border-accent/40 bg-accent/15 text-accent font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Spline className="size-3" />
            GERATRIZES
          </Button>
        )}
        {allow3d && (
          <div
            className="flex rounded-md border border-line bg-background/85 p-0.5 shadow-sm backdrop-blur"
            role="group"
            aria-label="Modo de visualização"
          >
            {(["2d", "3d"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={activeMode === item}
                onClick={() => onModeChange(item)}
                className={cn(
                  "h-7 min-w-11 px-2 font-mono text-[10px] uppercase shadow-none",
                  activeMode === item && "bg-accent/15 text-accent font-semibold",
                )}
              >
                {item.toUpperCase()}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function View3DPanel({
  model,
  unfold,
  onUnfold,
  onPlanificar,
  selection,
}: {
  model: WireModel;
  unfold: number;
  onUnfold: (v: number) => void;
  onPlanificar: () => void;
  selection?: SelectionSync | undefined;
}) {
  const [view, setView] = useState<ViewPresetId>(DEFAULT_VIEW);
  const [viewNonce, setViewNonce] = useState(0);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>("shaded-edges");
  const [interactionMode, setInteractionMode] = useState<"orbit" | "pan">("orbit");
  const [showExtendedViews, setShowExtendedViews] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const presetsToRender = showExtendedViews ? EXTENDED_VIEW_PRESETS : VIEW_PRESETS;

  return (
    <div
      className={cn(
        "grid-bg-fine relative overflow-hidden bg-gradient-to-b from-[#090B0F] to-[#050608]",
        isExpanded
          ? "fixed inset-3 z-50 rounded-2xl border border-zinc-700/90 shadow-2xl"
          : "size-full",
      )}
    >
      {/* Grade pontilhada técnica + luz radial superior-esquerda */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(#38bdf8 0.75px, transparent 0.75px), radial-gradient(#f59e0b 0.5px, transparent 0.5px)",
          backgroundSize: "20px 20px, 40px 40px",
          backgroundPosition: "0 0, 10px 10px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 26% 22%, rgba(148, 163, 184, 0.14) 0%, rgba(15, 23, 42, 0.04) 48%, transparent 75%)",
        }}
      />

      <Wire3D
        interactive
        mode={interactionMode}
        unfold={unfold}
        model={model}
        view={view}
        viewNonce={viewNonce}
        edgeMode={edgeMode}
        refForEdge={selection?.refForEdge}
        refForFace={selection?.refForFace}
        highlightRef={selection?.highlightRef}
        onSelectRef={selection?.onSelectRef}
        className="relative z-10 size-full text-foreground/80"
      />

      {/* Controles de Vista, Arestas e Ferramentas Técnicas */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5 max-w-[calc(100%-120px)]">
        {/* Barra de Vistas */}
        <div
          className="flex flex-wrap items-center gap-0.5 rounded-md border border-zinc-800/90 bg-zinc-950/85 p-0.5 shadow-sm backdrop-blur"
          role="group"
          aria-label="Vistas padrão da câmera"
        >
          {presetsToRender.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="ghost"
              title={preset.title}
              aria-pressed={view === preset.id}
              onClick={() => {
                setView(preset.id);
                setViewNonce((n) => n + 1);
              }}
              className={cn(
                "h-6 min-w-7 px-1.5 font-mono text-[9px] uppercase shadow-none text-zinc-300",
                view === preset.id && "bg-amber-500/20 text-amber-400 font-semibold",
              )}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title={showExtendedViews ? "Menos vistas" : "Todas as vistas (ISO, FR, TRAS, LAT, DIR, ESQ, SUP, INF)"}
            onClick={() => setShowExtendedViews((v) => !v)}
            className="h-6 px-1 font-mono text-[9px] text-zinc-400 hover:text-amber-400 shadow-none"
          >
            {showExtendedViews ? "–" : "+"}
          </Button>
        </div>

        {/* Barra de Modos de Aresta e Ferramentas */}
        <div className="flex flex-wrap items-center gap-1">
          <div
            className="flex rounded-md border border-zinc-800/90 bg-zinc-950/85 p-0.5 shadow-sm backdrop-blur"
            role="group"
            aria-label="Modo de aresta técnica"
          >
            {EDGE_MODES.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="ghost"
                title={item.title}
                aria-pressed={edgeMode === item.id}
                onClick={() => setEdgeMode(item.id)}
                className={cn(
                  "h-6 px-1.5 font-mono text-[9px] uppercase shadow-none text-zinc-300",
                  edgeMode === item.id && "bg-amber-500/20 text-amber-400 font-semibold",
                )}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {/* Ferramentas de Interação: Girar / Mover */}
          <div
            className="flex rounded-md border border-zinc-800/90 bg-zinc-950/85 p-0.5 shadow-sm backdrop-blur"
            role="group"
            aria-label="Navegação espacial"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Girar modelo (Órbita 3D 360°)"
              aria-pressed={interactionMode === "orbit"}
              onClick={() => setInteractionMode("orbit")}
              className={cn(
                "h-6 px-1.5 font-mono text-[9px] uppercase shadow-none gap-1 text-zinc-300",
                interactionMode === "orbit" && "bg-amber-500/20 text-amber-400 font-semibold",
              )}
            >
              <Rotate3d className="size-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Mover modelo (Pan espacial)"
              aria-pressed={interactionMode === "pan"}
              onClick={() => setInteractionMode("pan")}
              className={cn(
                "h-6 px-1.5 font-mono text-[9px] uppercase shadow-none gap-1 text-zinc-300",
                interactionMode === "pan" && "bg-amber-500/20 text-amber-400 font-semibold",
              )}
            >
              <Move className="size-3" />
            </Button>
          </div>

          {/* Central de Diagnóstico */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Abrir Central de Diagnóstico e Auditoria 3D"
            onClick={() => setShowDiagnostic(true)}
            className="h-6 px-2 rounded-md border border-zinc-800/90 bg-zinc-950/85 font-mono text-[9px] text-zinc-300 hover:text-amber-400 uppercase shadow-none gap-1"
          >
            <Activity className="size-3" />
            DIAG
          </Button>
        </div>
      </div>

      <Viz3DDiagnosticModal
        model={model}
        isOpen={showDiagnostic}
        onClose={() => setShowDiagnostic(false)}
      />

      {/* Controle de Planificação (inferior esquerdo) */}
      <div className="absolute left-3 right-32 bottom-2.5 z-20 flex items-center gap-2.5">
        <span className="font-mono text-[9px] text-zinc-400 uppercase">360°</span>
        <input
          type="range"
          min={0}
          max={100}
          value={unfold * 100}
          onChange={(e) => onUnfold(Number(e.target.value) / 100)}
          aria-label="Abrir peça"
          className="h-1 flex-1 accent-amber-400"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onPlanificar}
          className="h-6 px-2 font-mono text-[9px] text-amber-400 hover:text-amber-300 uppercase shadow-none"
        >
          Planificar
        </Button>
      </div>

      {/* Barra de Ferramentas Flutuante (Bottom-Right do Visor: 3 botões circulares escuros com ícones dourados/brancos) */}
      <div
        className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5"
        role="group"
        aria-label="Controles flutuantes do visor 3D"
      >
        <button
          type="button"
          onClick={() => {
            setView(DEFAULT_VIEW);
            setViewNonce((n) => n + 1);
          }}
          className="flex size-8 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/90 text-amber-400 shadow-lg backdrop-blur-md transition-all hover:border-amber-500/50 hover:bg-zinc-800 active:scale-95 cursor-pointer"
          title="Resetar Rotação / Vista Padrão"
          aria-label="Resetar Rotação / Vista Padrão"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            setEdgeMode((m) => (m === "shaded-edges" ? "wireframe" : "shaded-edges"))
          }
          className={cn(
            "flex size-8 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer",
            edgeMode === "shaded-edges"
              ? "border-amber-500/50 bg-zinc-900/90 text-amber-400 hover:bg-zinc-800"
              : "border-zinc-700/80 bg-zinc-900/90 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800",
          )}
          title="Alternar Modo de Camadas / Wireframe vs. Sólido"
          aria-label="Alternar Modo de Camadas / Wireframe vs. Sólido"
        >
          <Layers className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className={cn(
            "flex size-8 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer",
            isExpanded
              ? "border-amber-500/50 bg-zinc-900/90 text-amber-400 hover:bg-zinc-800"
              : "border-zinc-700/80 bg-zinc-900/90 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800",
          )}
          title={isExpanded ? "Recolher Tela Cheia" : "Tela Cheia / Expandir"}
          aria-label={isExpanded ? "Recolher Tela Cheia" : "Tela Cheia / Expandir"}
        >
          {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
