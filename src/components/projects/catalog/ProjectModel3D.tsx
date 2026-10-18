/**
 * PAINEL 3D DO PROJETO — controles CAD sobre o motor Three.js.
 * O painel não calcula geometria: consome as instâncias canônicas.
 */

import { Box, Crosshair, Expand, Focus, Layers, Maximize2, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SolidInstance } from "@/lib/project-catalog/instances";
import { cn } from "@/lib/utils";
import { Model3DViewer, type ViewKey } from "./Model3DViewer";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "iso", label: "ISO" },
  { key: "frontal", label: "Frontal" },
  { key: "traseira", label: "Traseira" },
  { key: "superior", label: "Superior" },
  { key: "inferior", label: "Inferior" },
  { key: "esquerda", label: "Esquerda" },
  { key: "direita", label: "Direita" },
];

export function ProjectModel3D({
  instances,
  selectedId,
  onSelect,
  hidden,
  exploded = false,
  perspective = false,
  className,
}: {
  instances: SolidInstance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hidden: Set<string>;
  exploded?: boolean;
  /** Perspectiva técnica: apresentação limpa do conjunto, sem explosão. */
  perspective?: boolean;
  className?: string;
}) {
  const [view, setView] = useState<ViewKey>("iso");
  const [viewNonce, setViewNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [ortho, setOrtho] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [ghost, setGhost] = useState(false);
  const [explode, setExplode] = useState(exploded ? 0.6 : 0);
  const [clean, setClean] = useState(false);

  useEffect(() => {
    setExplode(exploded ? 0.6 : 0);
  }, [exploded]);

  useEffect(() => {
    if (!perspective) return;
    setOrtho(true);
    setIsolate(false);
    setGhost(false);
    setExplode(0);
    setView("iso");
    setViewNonce((n) => n + 1);
  }, [perspective]);

  const shell = clean
    ? "fixed inset-0 z-[80] bg-background"
    : cn(
        "relative h-[380px] rounded-xl border border-line bg-background/60 lg:h-[460px]",
        className,
      );

  return (
    <div className={shell}>
      <Model3DViewer
        instances={instances}
        selectedId={selectedId}
        onSelect={onSelect}
        explode={explode}
        hidden={hidden}
        isolate={isolate}
        ghost={ghost}
        ortho={ortho}
        view={view}
        viewNonce={viewNonce}
        fitNonce={fitNonce}
      />

      <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap gap-1">
        <div className="pointer-events-auto flex flex-wrap gap-1 rounded-lg border border-line bg-background/80 p-1 backdrop-blur">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setView(v.key);
                setViewNonce((n) => n + 1);
              }}
              className={cn(
                "rounded px-2 py-1 font-mono text-[10px] uppercase",
                view === v.key ? "bg-accent/20 text-accent" : "text-muted-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-1 rounded-lg border border-line bg-background/80 p-1 backdrop-blur">
          <Button
            size="icon"
            variant={ortho ? "default" : "ghost"}
            aria-label="Câmera ortográfica"
            onClick={() => setOrtho((o) => !o)}
          >
            <Box />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Enquadrar modelo"
            onClick={() => setFitNonce((n) => n + 1)}
          >
            <Maximize2 />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Reiniciar vista"
            onClick={() => {
              setView("iso");
              setViewNonce((n) => n + 1);
              setExplode(0);
              setIsolate(false);
              setGhost(false);
              onSelect(null);
            }}
          >
            <RotateCcw />
          </Button>
          <Button
            size="icon"
            variant={isolate ? "default" : "ghost"}
            aria-label="Isolar peça selecionada"
            onClick={() => setIsolate((v) => !v)}
          >
            <Focus />
          </Button>
          <Button
            size="icon"
            variant={ghost ? "default" : "ghost"}
            aria-label="Transparência do contexto"
            onClick={() => setGhost((v) => !v)}
          >
            <Layers />
          </Button>
          <Button
            size="icon"
            variant={clean ? "default" : "ghost"}
            aria-label="Modo apresentação"
            onClick={() => setClean((v) => !v)}
          >
            {clean ? <X /> : <Expand />}
          </Button>
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-2 flex items-center gap-2 rounded-lg border border-line bg-background/80 px-2 py-1 backdrop-blur">
        <Crosshair className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[9px] uppercase text-muted-foreground">Explodir</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(explode * 100)}
          aria-label="Vista explodida"
          onChange={(e) => setExplode(Number(e.target.value) / 100)}
          className="h-1 flex-1 accent-[var(--accent)]"
        />
        <span className="font-mono text-[9px] text-muted-foreground">X Y Z</span>
      </div>
    </div>
  );
}
