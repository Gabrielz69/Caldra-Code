import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildWire, DEFAULT_PARAMS, type WireModel } from "@/lib/viz3d/wire";
import { Wire3D } from "./Wire3D";
import { cn } from "@/lib/utils";

export interface CarouselPieceInfo {
  slug: string;
  name: string;
  category: string;
  index: number;
  total: number;
}

interface CarouselPiece {
  slug: string;
  name: string;
  category: string;
}

const PIECES: CarouselPiece[] = [
  { slug: "quadrado-redondo", name: "Quadrado → Redondo", category: "Transição Paramétrica" },
  { slug: "cilindro", name: "Cilindro", category: "Caldeiraria Cilíndrica" },
  { slug: "cone", name: "Cone Reto", category: "Desenvolvimento Cônico" },
  { slug: "tronco-de-cone", name: "Tronco de Cone", category: "Transição Cônica" },
  { slug: "cone-excentrico", name: "Cone Excêntrico", category: "Traçado Oblíquo" },
  { slug: "boca-de-lobo", name: "Boca de Lobo", category: "Interseção de Tubos" },
  { slug: "y", name: "Bifurcação em Y", category: "Derivação Simétrica" },
  { slug: "reducao-circular", name: "Redução Concêntrica", category: "Ductos e Tubulações" },
  { slug: "curva-de-gomos", name: "Curva de Gomos", category: "Segmentos Angulares" },
  { slug: "flanges", name: "Flange Furação", category: "Chapa e Furação" },
];

const AUTOPLAY_INTERVAL = 5200;
const AUTO_TRANSITION_MS = 500;

// Cache persistente de malhas 3D
const WIRE_CACHE = new Map<string, WireModel>();
function getCachedWire(slug: string): WireModel {
  let model = WIRE_CACHE.get(slug);
  if (!model) {
    model = buildWire(slug, { ...DEFAULT_PARAMS, seg: 44 });
    WIRE_CACHE.set(slug, model);
  }
  return model;
}

interface TransitionState {
  fromIndex: number;
  toIndex: number;
  direction: 1 | -1;
  progress: number; // 0 a 1
}

/**
 * Carrossel 3D interativo de modelos da tela inicial (CALDRA).
 * Suporte a swipe contínuo e fluido com física tridimensional, troca automática e controles manuais.
 */
export function PieceCarousel({
  className,
  onPieceChange,
  showInternalFooter = false,
}: {
  className?: string;
  onPieceChange?: (info: CarouselPieceInfo) => void;
  showInternalFooter?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transition, setTransition] = useState<TransitionState | null>(null);

  // Estado do swipe/arraste manual
  // dragOffset: fração -1 .. 1 da largura do elemento
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isFinishingSwipe, setIsFinishingSwipe] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const dragInfoRef = useRef<{
    startX: number;
    startTime: number;
    width: number;
    pointerId: number;
  } | null>(null);
  const hasMovedRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pré-aquecimento das malhas em memória
  useEffect(() => {
    PIECES.forEach((p) => getCachedWire(p.slug));
  }, []);

  const onPieceChangeRef = useRef(onPieceChange);
  onPieceChangeRef.current = onPieceChange;

  // Notifica o componente pai sobre o modelo ativo
  useEffect(() => {
    if (onPieceChangeRef.current) {
      const p = PIECES[currentIndex]!;
      onPieceChangeRef.current({
        slug: p.slug,
        name: p.name,
        category: p.category,
        index: currentIndex,
        total: PIECES.length,
      });
    }
  }, [currentIndex]);

  const triggerTransition = useCallback(
    (targetIndex: number, direction: 1 | -1) => {
      if (busyRef.current || targetIndex === currentIndex) return;
      busyRef.current = true;

      const targetPiece = PIECES[targetIndex]!;
      onPieceChange?.({
        slug: targetPiece.slug,
        name: targetPiece.name,
        category: targetPiece.category,
        index: targetIndex,
        total: PIECES.length,
      });

      setTransition({
        fromIndex: currentIndex,
        toIndex: targetIndex,
        direction,
        progress: 0,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransition((prev) => (prev ? { ...prev, progress: 1 } : null));
        });
      });

      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        setCurrentIndex(targetIndex);
        setTransition(null);
        busyRef.current = false;
      }, AUTO_TRANSITION_MS + 30);
    },
    [currentIndex, onPieceChange],
  );

  const goNext = useCallback(() => {
    const next = (currentIndex + 1) % PIECES.length;
    triggerTransition(next, 1);
  }, [currentIndex, triggerTransition]);

  const goPrev = useCallback(() => {
    const prev = (currentIndex - 1 + PIECES.length) % PIECES.length;
    triggerTransition(prev, -1);
  }, [currentIndex, triggerTransition]);

  // Autoplay (pausa durante arraste, transição ou hover)
  useEffect(() => {
    if (isHovered || dragOffset !== null || transition !== null || busyRef.current) return;
    const timer = setInterval(() => {
      goNext();
    }, AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [goNext, isHovered, dragOffset, transition]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // --- Handlers de Swipe e Arraste por Pointer Events ---
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busyRef.current || !containerRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    const width = containerRef.current.clientWidth || 300;
    dragInfoRef.current = {
      startX: e.clientX,
      startTime: Date.now(),
      width,
      pointerId: e.pointerId,
    };
    hasMovedRef.current = false;
    setIsFinishingSwipe(false);
    setDragOffset(0);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragInfoRef.current) return;
    const deltaX = e.clientX - dragInfoRef.current.startX;
    if (Math.abs(deltaX) > 5) {
      hasMovedRef.current = true;
    }
    const rawRatio = deltaX / dragInfoRef.current.width;
    const clamped = Math.max(-0.95, Math.min(0.95, rawRatio));
    setDragOffset(clamped);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragInfoRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(dragInfoRef.current.pointerId);
    } catch {
      // safe fallback
    }

    const currentOffset = dragOffset ?? 0;
    const deltaX = e.clientX - dragInfoRef.current.startX;
    const deltaTime = Date.now() - dragInfoRef.current.startTime;
    const velocity = Math.abs(deltaX) / Math.max(1, deltaTime); // px/ms
    dragInfoRef.current = null;

    const isSwipe = Math.abs(currentOffset) > 0.14 || (velocity > 0.3 && Math.abs(deltaX) > 15);

    if (isSwipe && Math.abs(currentOffset) > 0.01) {
      const dir: 1 | -1 = currentOffset < 0 ? 1 : -1;
      const targetIdx =
        dir === 1
          ? (currentIndex + 1) % PIECES.length
          : (currentIndex - 1 + PIECES.length) % PIECES.length;

      setIsFinishingSwipe(true);
      setDragOffset(dir === 1 ? -1 : 1);

      const targetPiece = PIECES[targetIdx]!;
      onPieceChange?.({
        slug: targetPiece.slug,
        name: targetPiece.name,
        category: targetPiece.category,
        index: targetIdx,
        total: PIECES.length,
      });

      setTimeout(() => {
        setCurrentIndex(targetIdx);
        setDragOffset(null);
        setIsFinishingSwipe(false);
      }, 290);
    } else {
      setIsFinishingSwipe(true);
      setDragOffset(0);
      setTimeout(() => {
        setDragOffset(null);
        setIsFinishingSwipe(false);
      }, 240);
    }
  };

  const activePiece = PIECES[currentIndex]!;
  const activeModel = useMemo(() => getCachedWire(activePiece.slug), [activePiece.slug]);

  let outgoingPiece: CarouselPiece | null = null;
  let outgoingModel: WireModel | null = null;
  let incomingPiece: CarouselPiece | null = null;
  let incomingModel: WireModel | null = null;
  let animDir: 1 | -1 = 1;
  let animRatio = 0;

  if (transition) {
    outgoingPiece = PIECES[transition.fromIndex]!;
    outgoingModel = getCachedWire(outgoingPiece.slug);
    incomingPiece = PIECES[transition.toIndex]!;
    incomingModel = getCachedWire(incomingPiece.slug);
    animDir = transition.direction;
    animRatio = transition.progress;
  } else if (dragOffset !== null && dragOffset !== 0) {
    outgoingPiece = activePiece;
    outgoingModel = activeModel;
    animDir = dragOffset < 0 ? 1 : -1;
    const targetIdx =
      animDir === 1
        ? (currentIndex + 1) % PIECES.length
        : (currentIndex - 1 + PIECES.length) % PIECES.length;
    incomingPiece = PIECES[targetIdx]!;
    incomingModel = getCachedWire(incomingPiece.slug);
    animRatio = Math.abs(dragOffset);
  }

  const outgoingStyle = outgoingPiece
    ? {
        transform: `translate3d(${-animDir * animRatio * 82}%, 0, ${-animRatio * 85}px) scale(${1 - animRatio * 0.2}) rotateY(${animDir * animRatio * 26}deg)`,
        opacity: Math.max(0, 1 - animRatio * 1.1),
        filter: `blur(${animRatio * 3.5}px)`,
        transition: isFinishingSwipe
          ? "transform 290ms cubic-bezier(0.16, 1, 0.3, 1), opacity 290ms ease-out, filter 290ms ease-out"
          : transition
            ? `transform ${AUTO_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${AUTO_TRANSITION_MS} ease-out, filter ${AUTO_TRANSITION_MS}ms ease-out`
            : "none",
      }
    : undefined;

  const incomingStyle = incomingPiece
    ? {
        transform: `translate3d(${animDir * (1 - animRatio) * 82}%, 0, ${-(1 - animRatio) * 85}px) scale(${0.8 + animRatio * 0.2}) rotateY(${-animDir * (1 - animRatio) * 26}deg)`,
        opacity: Math.min(1, animRatio * 1.15),
        filter: `blur(${(1 - animRatio) * 3.5}px)`,
        transition: isFinishingSwipe
          ? "transform 290ms cubic-bezier(0.16, 1, 0.3, 1), opacity 290ms ease-out, filter 290ms ease-out"
          : transition
            ? `transform ${AUTO_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${AUTO_TRANSITION_MS}ms ease-out, filter ${AUTO_TRANSITION_MS}ms ease-out`
            : "none",
      }
    : undefined;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (hasMovedRef.current) {
          e.preventDefault();
          e.stopPropagation();
          hasMovedRef.current = false;
        }
      }}
      className={cn(
        "group/carousel relative overflow-hidden select-none touch-pan-y cursor-grab active:cursor-grabbing",
        className,
      )}
      style={{ perspective: "1100px" }}
    >
      {/* Luz ambiente volumétrica de fundo (holograma técnico) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-full transition-all duration-700",
          "bg-[radial-gradient(circle_at_65%_55%,rgba(245,158,11,0.18)_0%,rgba(245,158,11,0.04)_45%,transparent_75%)]",
          (transition || dragOffset !== null) && "scale-110 opacity-100",
        )}
      />

      {/* Palco 3D com Renderização Dual-Buffer */}
      <div
        className="relative size-full pointer-events-none translate-x-4 sm:translate-x-12"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {outgoingPiece && outgoingModel && (
          <div
            key={`outgoing-${outgoingPiece.slug}`}
            className="absolute inset-0 size-full will-change-transform"
            style={outgoingStyle}
          >
            <Wire3D
              model={outgoingModel}
              edgeMode="shaded"
              showRefLines={false}
              autoSpin={dragOffset === null}
              className="size-full text-foreground/85 drop-shadow-sm"
            />
          </div>
        )}

        {incomingPiece && incomingModel ? (
          <div
            key={`incoming-${incomingPiece.slug}`}
            className="absolute inset-0 size-full will-change-transform"
            style={incomingStyle}
          >
            <Wire3D
              model={incomingModel}
              edgeMode="shaded"
              showRefLines={false}
              autoSpin={dragOffset === null}
              className="size-full text-foreground/85 drop-shadow-sm"
            />
          </div>
        ) : (
          !outgoingPiece && (
            <div
              key={`static-${activePiece.slug}`}
              className="size-full transition-transform duration-500 ease-out"
            >
              <Wire3D
                model={activeModel}
                edgeMode="shaded"
                showRefLines={false}
                autoSpin
                className="size-full text-foreground/85 drop-shadow-sm"
              />
            </div>
          )
        )}
      </div>

      {/* Controles de Navegação Rápida (Setas sutis no hover do card) */}
      <div className="pointer-events-none absolute inset-y-0 inset-x-1 z-20 flex items-center justify-between opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300">
        <button
          type="button"
          aria-label="Modelo anterior"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goPrev();
          }}
          className="pointer-events-auto flex size-7 items-center justify-center rounded-full border border-line/60 bg-background/80 text-foreground/75 backdrop-blur-md transition-transform hover:scale-110 hover:border-accent hover:text-accent active:scale-95 shadow-md"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Próximo modelo"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            goNext();
          }}
          className="pointer-events-auto flex size-7 items-center justify-center rounded-full border border-line/60 bg-background/80 text-foreground/75 backdrop-blur-md transition-transform hover:scale-110 hover:border-accent hover:text-accent active:scale-95 shadow-md"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Indicadores de Paginação / Linhas de Progresso Interativas */}
      <div className="pointer-events-auto absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-background/60 px-2 py-1 backdrop-blur-md border border-line/40 shadow-xs">
        {PIECES.map((p, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={p.slug}
              type="button"
              aria-label={`Ir para modelo ${p.name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (idx === currentIndex) return;
                triggerTransition(idx, idx > currentIndex ? 1 : -1);
              }}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                isActive
                  ? "w-3.5 bg-accent shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  : "w-1 bg-foreground/25 hover:bg-foreground/50 hover:w-2",
              )}
            />
          );
        })}
      </div>

      {/* Rodapé interno opcional */}
      {showInternalFooter && (
        <div className="pointer-events-none absolute bottom-2 inset-x-3 z-20 flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden h-3.5">
              <div
                key={`cat-${currentIndex}`}
                className="animate-in fade-in slide-in-from-bottom-1 duration-300 font-mono text-[8px] tracking-[0.16em] text-accent/90 uppercase truncate"
              >
                {activePiece.category}
              </div>
            </div>
            <div className="overflow-hidden h-4">
              <div
                key={`name-${currentIndex}`}
                className="animate-in fade-in slide-in-from-bottom-2 duration-350 font-mono text-[10px] font-semibold tracking-[0.14em] text-foreground/90 uppercase truncate"
              >
                {activePiece.name}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
