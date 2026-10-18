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
import { Activity, ChevronRight, Maximize2, Move, Rotate3d, Spline } from "lucide-react";
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

  const presetsToRender = showExtendedViews ? EXTENDED_VIEW_PRESETS : VIEW_PRESETS;

  return (
    <div className="grid-bg-fine relative size-full">
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
        className="size-full text-foreground/80"
      />

      {/* Controles de Vista, Arestas e Ferramentas Técnicas */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 max-w-[calc(100%-120px)]">
        {/* Barra de Vistas */}
        <div
          className="flex flex-wrap items-center gap-0.5 rounded-md border border-line bg-background/85 p-0.5 shadow-sm backdrop-blur"
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
                "h-6 min-w-7 px-1.5 font-mono text-[9px] uppercase shadow-none",
                view === preset.id && "bg-accent/15 text-accent font-semibold",
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
            className="h-6 px-1 font-mono text-[9px] text-muted-foreground hover:text-accent shadow-none"
          >
            {showExtendedViews ? "–" : "+"}
          </Button>
        </div>

        {/* Barra de Modos de Aresta e Ferramentas */}
        <div className="flex flex-wrap items-center gap-1">
          <div
            className="flex rounded-md border border-line bg-background/85 p-0.5 shadow-sm backdrop-blur"
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
                  "h-6 px-1.5 font-mono text-[9px] uppercase shadow-none",
                  edgeMode === item.id && "bg-accent/15 text-accent font-semibold",
                )}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {/* Ferramentas de Interação: Girar / Mover / Centralizar */}
          <div
            className="flex rounded-md border border-line bg-background/85 p-0.5 shadow-sm backdrop-blur"
            role="group"
            aria-label="Navegação espacial"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Girar modelo (Órbita 3D)"
              aria-pressed={interactionMode === "orbit"}
              onClick={() => setInteractionMode("orbit")}
              className={cn(
                "h-6 px-1.5 font-mono text-[9px] uppercase shadow-none gap-1",
                interactionMode === "orbit" && "bg-accent/15 text-accent font-semibold",
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
                "h-6 px-1.5 font-mono text-[9px] uppercase shadow-none gap-1",
                interactionMode === "pan" && "bg-accent/15 text-accent font-semibold",
              )}
            >
              <Move className="size-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Centralizar e reenquadrar modelo (Fit)"
              onClick={() => setViewNonce((n) => n + 1)}
              className="h-6 px-1.5 font-mono text-[9px] uppercase shadow-none text-muted-foreground hover:text-accent"
            >
              <Maximize2 className="size-3" />
            </Button>
          </div>

          {/* Central de Diagnóstico */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Abrir Central de Diagnóstico e Auditoria 3D"
            onClick={() => setShowDiagnostic(true)}
            className="h-6 px-2 rounded-md border border-line bg-background/85 font-mono text-[9px] text-muted-foreground hover:text-accent uppercase shadow-none gap-1"
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

      <div className="absolute inset-x-4 bottom-3 flex items-center gap-3">
        <span className="font-mono text-[9px] text-muted-foreground uppercase">3D</span>
        <input
          type="range"
          min={0}
          max={100}
          value={unfold * 100}
          onChange={(e) => onUnfold(Number(e.target.value) / 100)}
          aria-label="Abrir peça"
          className="h-1 flex-1 accent-[var(--accent)]"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onPlanificar}
          className="h-7 px-2 font-mono text-[9px] text-accent uppercase shadow-none"
        >
          Planificar
        </Button>
      </div>
    </div>
  );
}
