import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { buildWire, DEFAULT_PARAMS, type WireModel } from "@/lib/viz3d/wire";
import { Wire3D } from "@/components/chameleon/Wire3D";

export interface PillarScene {
  id: "crie" | "calcule" | "orce" | "fabrique" | "aprimore";
  number: string;
  badge: string;
  modelSlug: string;
  modelLabel: string;
  title: string;
  tagline: string;
  description: string;
  actionLabel: string;
  actionHint: string;
  route?: string;
  modalAction?: "new-project" | "tools";
}

export const PILLAR_SCENES: PillarScene[] = [
  {
    id: "crie",
    number: "01 / 05",
    badge: "GEOMETRIA & CAD",
    modelSlug: "quadrado-redondo",
    modelLabel: "Quadrado → Redondo",
    title: "CRIE",
    tagline: "Da ideia à geometria.",
    description: "Modelagem paramétrica, wireframe e geração de sólidos para caldeiraria pesada.",
    actionLabel: "Criar novo projeto",
    actionHint: "Abrir prancheta",
    modalAction: "new-project",
  },
  {
    id: "calcule",
    number: "02 / 05",
    badge: "DIMENSIONAMENTO",
    modelSlug: "tronco-de-cone",
    modelLabel: "Redução Cônica",
    title: "CALCULE",
    tagline: "Precisão em cada medida.",
    description: "Cotas automáticas, diâmetros, espessuras de chapa e ângulos de concordância.",
    actionLabel: "Abrir bancada técnica",
    actionHint: "Calcular parâmetros",
    modalAction: "tools",
  },
  {
    id: "orce",
    number: "03 / 05",
    badge: "ENGENHARIA DE CUSTOS",
    modelSlug: "curva-de-gomos",
    modelLabel: "Curva de Gomos",
    title: "ORCE",
    tagline: "Do material ao preço de venda.",
    description: "Consumo de chapas em kg, tempo de calandragem, soldagem e margem comercial.",
    actionLabel: "Ver orçamentos",
    actionHint: "Gerar proposta",
    route: "/orcamentos",
  },
  {
    id: "fabrique",
    number: "04 / 05",
    badge: "PLANIFICAÇÃO & CORTE",
    modelSlug: "boca-de-lobo",
    modelLabel: "Boca de Lobo 90°",
    title: "FABRIQUE",
    tagline: "Do modelo à planificação.",
    description: "Desenvolvimento de chapa plana, geratrizes de traçagem e linhas de dobra reais.",
    actionLabel: "Abrir traçagens",
    actionHint: "Planificar peça",
    route: "/tracagem",
  },
  {
    id: "aprimore",
    number: "05 / 05",
    badge: "CONHECIMENTO TÉCNICO",
    modelSlug: "cone-excentrico",
    modelLabel: "Cone Excêntrico",
    title: "APRIMORE",
    tagline: "Evolua na caldeiraria e na traçagem.",
    description: "Métodos de triangulação, curvas de gomos e normas técnicas industriais.",
    actionLabel: "Acessar especialização",
    actionHint: "Estudar traçado",
    route: "/escola",
  },
];

const AUTOPLAY_INTERVAL = 5500;
const AUTO_TRANSITION_MS = 480;

// Cache global em memória de malhas 3D para transições instantâneas a 60/120fps
const WIRE_CACHE = new Map<string, WireModel>();
function getCachedWire(slug: string): WireModel {
  let model = WIRE_CACHE.get(slug);
  if (!model) {
    model = buildWire(slug, { ...DEFAULT_PARAMS, seg: 40 });
    WIRE_CACHE.set(slug, model);
  }
  return model;
}

interface TransitionState {
  fromIndex: number;
  toIndex: number;
  direction: 1 | -1;
  progress: number;
}

interface WorkshopCarouselProps {
  onNewProject: () => void;
  onOpenTools: () => void;
  className?: string;
}

export function WorkshopCarousel({
  onNewProject,
  onOpenTools,
  className,
}: WorkshopCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [transition, setTransition] = useState<TransitionState | null>(null);

  // Arraste por gesto manual (touch/mouse pointer)
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isFinishingSwipe, setIsFinishingSwipe] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const dragInfoRef = useRef<{
    startX: number;
    startTime: number;
    width: number;
    pointerId: number;
  } | null>(null);
  const hasMovedRef = useRef(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pré-aquecimento de todas as malhas 3D
  useEffect(() => {
    PILLAR_SCENES.forEach((scene) => getCachedWire(scene.modelSlug));
  }, []);

  // Preferência de movimento reduzido
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Observador de visibilidade (pausa se fora da tela)
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsVisible(entry?.isIntersecting ?? true);
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Gatilho de transição cinemática 3D entre pilares
  const triggerTransition = useCallback(
    (targetIndex: number, direction: 1 | -1, playFeedback = true) => {
      if (busyRef.current || targetIndex === activeIndex) return;
      busyRef.current = true;

      if (playFeedback) {
        triggerHaptic("selection");
        AudioManager.play("ui_tick");
      }

      setTransition({
        fromIndex: activeIndex,
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
        setActiveIndex(targetIndex);
        setTransition(null);
        busyRef.current = false;
      }, AUTO_TRANSITION_MS + 20);
    },
    [activeIndex]
  );

  const goNext = useCallback(() => {
    const next = (activeIndex + 1) % PILLAR_SCENES.length;
    triggerTransition(next, 1);
  }, [activeIndex, triggerTransition]);

  const goPrev = useCallback(() => {
    const prev = (activeIndex - 1 + PILLAR_SCENES.length) % PILLAR_SCENES.length;
    triggerTransition(prev, -1);
  }, [activeIndex, triggerTransition]);

  // Avanço automático com pausa sob interação
  useEffect(() => {
    if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    if (
      isPaused ||
      isHovered ||
      dragOffset !== null ||
      transition !== null ||
      prefersReducedMotion ||
      !isVisible
    ) {
      return;
    }

    autoplayTimerRef.current = setInterval(() => {
      goNext();
    }, AUTOPLAY_INTERVAL);

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, [isPaused, isHovered, dragOffset, transition, prefersReducedMotion, isVisible, goNext]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, []);

  // Navegação manual por ponteiro / swipe touch
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busyRef.current || !stageRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    const width = stageRef.current.clientWidth || 320;
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
    if (Math.abs(deltaX) > 6) {
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
    const velocity = Math.abs(deltaX) / Math.max(1, deltaTime);
    dragInfoRef.current = null;

    const isSwipe = Math.abs(currentOffset) > 0.14 || (velocity > 0.3 && Math.abs(deltaX) > 15);

    if (isSwipe && Math.abs(currentOffset) > 0.01) {
      const dir: 1 | -1 = currentOffset < 0 ? 1 : -1;
      const targetIdx =
        dir === 1
          ? (activeIndex + 1) % PILLAR_SCENES.length
          : (activeIndex - 1 + PILLAR_SCENES.length) % PILLAR_SCENES.length;

      setIsFinishingSwipe(true);
      setDragOffset(dir === 1 ? -1 : 1);
      triggerHaptic("selection");
      AudioManager.play("ui_tick");

      setTimeout(() => {
        setActiveIndex(targetIdx);
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

  // Teclado acessível
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  const currentScene = PILLAR_SCENES[activeIndex];
  const activeModel = useMemo(() => getCachedWire(currentScene.modelSlug), [currentScene.modelSlug]);

  // Modelagem Dual-Buffer para interpolação da transição cinemática 3D
  let outgoingScene: PillarScene | null = null;
  let outgoingModel: WireModel | null = null;
  let incomingScene: PillarScene | null = null;
  let incomingModel: WireModel | null = null;
  let animDir: 1 | -1 = 1;
  let animRatio = 0;

  if (transition) {
    outgoingScene = PILLAR_SCENES[transition.fromIndex]!;
    outgoingModel = getCachedWire(outgoingScene.modelSlug);
    incomingScene = PILLAR_SCENES[transition.toIndex]!;
    incomingModel = getCachedWire(incomingScene.modelSlug);
    animDir = transition.direction;
    animRatio = transition.progress;
  } else if (dragOffset !== null && dragOffset !== 0) {
    outgoingScene = currentScene;
    outgoingModel = activeModel;
    animDir = dragOffset < 0 ? 1 : -1;
    const targetIdx =
      animDir === 1
        ? (activeIndex + 1) % PILLAR_SCENES.length
        : (activeIndex - 1 + PILLAR_SCENES.length) % PILLAR_SCENES.length;
    incomingScene = PILLAR_SCENES[targetIdx]!;
    incomingModel = getCachedWire(incomingScene.modelSlug);
    animRatio = Math.abs(dragOffset);
  }

  // Efeito de física 3D do cartão que sai (translate3d, scale, rotação Y e desfoque óptico)
  const outgoingStyle = outgoingScene
    ? {
        transform: `translate3d(${-animDir * animRatio * 82}%, 0, ${-animRatio * 85}px) scale(${1 - animRatio * 0.2}) rotateY(${animDir * animRatio * 26}deg)`,
        opacity: Math.max(0, 1 - animRatio * 1.1),
        filter: `blur(${animRatio * 3.5}px)`,
        transition: isFinishingSwipe
          ? "transform 290ms cubic-bezier(0.16, 1, 0.3, 1), opacity 290ms ease-out, filter 290ms ease-out"
          : transition
            ? `transform ${AUTO_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${AUTO_TRANSITION_MS}ms ease-out, filter ${AUTO_TRANSITION_MS}ms ease-out`
            : "none",
      }
    : undefined;

  // Efeito de física 3D do cartão que entra (aproximação tridimensional, rotação Y e clareamento)
  const incomingStyle = incomingScene
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

  // Ação ao acionar o pilar ativo
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("tap");
    AudioManager.play("ui_pop");

    if (currentScene.modalAction === "new-project") {
      onNewProject();
    } else if (currentScene.modalAction === "tools") {
      onOpenTools();
    } else if (currentScene.route) {
      window.location.hash = currentScene.route;
    }
  };

  return (
    <section
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Pilares da Oficina Digital CALDRA"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "caldra-hero group/hero relative overflow-hidden rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 shadow-lg transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
        className
      )}
    >
      {/* Grade técnica sutil de fundo blueprint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.055]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* ÁREA SUPERIOR: Indicador "01 / 05", Badge do Pilar, Identificador 3D e Botão Pausar/Play */}
      <div className="relative z-10 flex items-center justify-between border-b border-border/30 pb-1.5 sm:pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] sm:text-xs font-bold tracking-wider text-amber-500">
            {currentScene.number}
          </span>
          <span className="h-2.5 w-px bg-border/60" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur-xs">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            {currentScene.badge}
          </span>
          <span className="hidden xs:inline-flex items-center gap-1 rounded-md border border-line/40 bg-foreground/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/80">
            <Box className="size-2.5 text-amber-500/80" />
            {currentScene.modelLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? "Retomar avanço automático" : "Pausar avanço automático"}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/80 hover:text-foreground hover:bg-background/40 transition-colors"
            title={isPaused ? "Pausado (clique para retomar)" : "Em reprodução (clique para pausar)"}
          >
            {isPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL: PALCO 3D COM CINEMÁTICA E ROTAÇÃO 360° CONTÍNUA */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (hasMovedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            hasMovedRef.current = false;
          }
        }}
        role="button"
        tabIndex={-1}
        title={`Modelo 360°: ${currentScene.modelLabel} — Toque para: ${currentScene.actionLabel}`}
        className="relative my-1 flex h-[98px] sm:h-[114px] md:h-[124px] w-full items-center justify-center overflow-hidden rounded-xl cursor-grab active:cursor-grabbing select-none touch-pan-y"
        style={{ perspective: "1100px" }}
      >
        {/* Luz ambiente volumétrica de fundo (holograma técnico âmbar) */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 rounded-full transition-all duration-700",
            "bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.18)_0%,rgba(245,158,11,0.04)_50%,transparent_75%)]",
            (transition || dragOffset !== null) && "scale-110 opacity-100",
          )}
        />

        {/* Palco 3D Dual-Buffer com física tridimensional */}
        <div
          className="relative size-full pointer-events-none flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          {outgoingScene && outgoingModel && (
            <div
              key={`outgoing-${outgoingScene.id}`}
              className="absolute inset-0 size-full flex items-center justify-center will-change-transform"
              style={outgoingStyle}
            >
              <Wire3D
                model={outgoingModel}
                edgeMode="shaded"
                showRefLines={false}
                autoSpin={dragOffset === null}
                className="size-full max-h-[96px] sm:max-h-[112px] md:max-h-[122px] text-foreground/85 drop-shadow-sm select-none"
              />
            </div>
          )}

          {incomingScene && incomingModel ? (
            <div
              key={`incoming-${incomingScene.id}`}
              className="absolute inset-0 size-full flex items-center justify-center will-change-transform"
              style={incomingStyle}
            >
              <Wire3D
                model={incomingModel}
                edgeMode="shaded"
                showRefLines={false}
                autoSpin={dragOffset === null}
                className="size-full max-h-[96px] sm:max-h-[112px] md:max-h-[122px] text-foreground/85 drop-shadow-sm select-none"
              />
            </div>
          ) : (
            !outgoingScene && (
              <div
                key={`static-${currentScene.id}`}
                className="size-full flex items-center justify-center transition-transform duration-500 ease-out"
              >
                <Wire3D
                  model={activeModel}
                  edgeMode="shaded"
                  showRefLines={false}
                  autoSpin={!prefersReducedMotion}
                  className="size-full max-h-[96px] sm:max-h-[112px] md:max-h-[122px] text-foreground/85 drop-shadow-sm select-none"
                />
              </div>
            )
          )}
        </div>

        {/* Controles de Navegação Rápida (Setas sutis no hover do card) */}
        <div className="pointer-events-none absolute inset-y-0 inset-x-0.5 z-20 flex items-center justify-between opacity-0 group-hover/hero:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            aria-label="Pilar anterior"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goPrev();
            }}
            className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground/75 backdrop-blur-md transition-transform hover:scale-110 hover:border-amber-500 hover:text-amber-500 active:scale-95 shadow-sm"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Próximo pilar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goNext();
            }}
            className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground/75 backdrop-blur-md transition-transform hover:scale-110 hover:border-amber-500 hover:text-amber-500 active:scale-95 shadow-sm"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ÁREA INFERIOR: Título, Descrição, Indicadores e Botão de Ação */}
      <div className="relative z-10 flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs sm:text-sm font-black tracking-tight text-[#FF3B30]">
                {currentScene.title}
              </span>
              <span className="text-muted-foreground/40 font-mono text-[10px]">•</span>
              <span className="font-display text-xs sm:text-sm font-semibold text-foreground truncate">
                {currentScene.tagline}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground line-clamp-1 leading-normal">
              {currentScene.description}
            </p>
          </div>

          {/* Botão de Ação Rápida */}
          <button
            type="button"
            onClick={handleActionClick}
            aria-label={`${currentScene.actionLabel} (${currentScene.actionHint})`}
            className="group/btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all shadow-xs cursor-pointer touch-manipulation"
          >
            <span className="font-mono text-[10px] sm:text-xs">{currentScene.actionHint}</span>
            <ArrowRight className="size-3 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
          </button>
        </div>

        {/* Linha dos Indicadores Interativos das 5 Etapas com progresso */}
        <div className="flex items-center justify-between border-t border-border/30 pt-1.5">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Etapas da oficina">
            {PILLAR_SCENES.map((scene, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={scene.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Etapa ${idx + 1}: ${scene.title} (${scene.modelLabel})`}
                  onClick={() => triggerTransition(idx, idx > activeIndex ? 1 : -1)}
                  className={cn(
                    "relative h-1.5 rounded-full transition-all duration-300 cursor-pointer touch-manipulation",
                    isActive
                      ? "w-6 bg-gradient-to-r from-red-500 to-amber-500 shadow-xs"
                      : "w-1.5 bg-border hover:bg-muted-foreground/40"
                  )}
                />
              );
            })}
          </div>

          <span className="font-mono text-[9px] text-muted-foreground/75 uppercase tracking-widest hidden sm:inline">
            Rotação 360° • Deslize para navegar
          </span>
        </div>
      </div>
    </section>
  );
}
