import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Hand,
} from "lucide-react";
import type { GeometryResult } from "@/lib/geometry/types";
import { buildTraceSequence, TOOL_LABEL, type TraceStep } from "@/lib/tracagem/steps";
import type { HighlightState } from "@/lib/geometry/refs";
import { formatNumber, useSettings } from "@/lib/settings/SettingsProvider";
import { cn } from "@/lib/utils";
import { DevelopmentView } from "./DevelopmentView";
import { BenchTools } from "./BenchTools";
import { TraceAnimationStage } from "./TraceAnimationStage";
import { buildTraceActions, resolveTraceAction, sampleTraceAction } from "@/lib/tracagem/animation";
import type { GeometryRef } from "@/lib/geometry/refs";
import { Button } from "./ds";
import { triggerHaptic } from "@/lib/ui/haptics";

type Props = {
  slug: string;
  result: GeometryResult;
  /** Etapa sugerida por um parâmetro em foco (vínculo parâmetro ↔ traçagem). */
  focusStepId?: string | null;
};

/**
 * TRAÇAGEM GUIADA — mostra, passo a passo, como riscar o desenvolvimento
 * direto na chapa. Consome a MESMA geometria do resultado, 2D, 3D e CHAMFER.
 */
export function TracagemPanel({ slug, result, focusStepId }: Props) {
  const { precision } = useSettings();
  const steps = useMemo<TraceStep[]>(() => buildTraceSequence(slug, result), [slug, result]);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [intensity, setIntensity] = useState(1);
  const [actionIndex, setActionIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [mode, setMode] = useState<"watch" | "step" | "with-me">("step");
  const [practiceMessage, setPracticeMessage] = useState<string | null>(null);
  const lastFrame = useRef<number | null>(null);

  /* Geometria mudou → sequência regenerada e leitura reiniciada. */
  useEffect(() => {
    setIndex(0);
    setActionIndex(0);
    setProgress(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!focusStepId) return;
    const i = steps.findIndex((s) => s.id === focusStepId);
    if (i >= 0) {
      setIndex(i);
      setActionIndex(0);
      setProgress(0);
      setPlaying(false);
    }
  }, [focusStepId, steps]);

  const step = steps[Math.min(index, steps.length - 1)]!;
  const actions = useMemo(
    () => buildTraceActions(step, result.development),
    [step, result.development],
  );
  const traceAction = actions[Math.min(actionIndex, actions.length - 1)]!;
  const resolvedAction = useMemo(
    () => resolveTraceAction(result.development, step, traceAction),
    [result.development, step, traceAction],
  );
  const frame = useMemo(
    () => sampleTraceAction(resolvedAction, progress),
    [resolvedAction, progress],
  );

  const completedRefs = useMemo<GeometryRef[]>(() => {
    if (showAll)
      return result.development.outline
        .map((_, i) => `outline:${i}`)
        .concat(
          result.development.foldLines.map((_, i) => `fold:${i}`),
          result.development.points.map((p) => `point:${p.id}`),
        );
    const refs = steps.slice(0, index).flatMap((item) => item.geometryRefs);
    refs.push(...actions.slice(0, actionIndex).flatMap((item) => item.geometryRefs));
    if (progress >= 1) refs.push(...traceAction.geometryRefs);
    return [...new Set(refs)];
  }, [
    showAll,
    result.development,
    steps,
    index,
    actions,
    actionIndex,
    progress,
    traceAction.geometryRefs,
  ]);

  const resetStep = useCallback(() => {
    setActionIndex(0);
    setProgress(0);
    setPracticeMessage(null);
    lastFrame.current = null;
  }, []);

  const moveToStep = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(steps.length - 1, next)));
      resetStep();
    },
    [resetStep, steps.length],
  );

  const advance = useCallback(() => {
    if (progress < 1) {
      setProgress(1);
      return;
    }
    if (actionIndex < actions.length - 1) {
      setActionIndex((value) => value + 1);
      setProgress(0);
      setPracticeMessage(null);
      return;
    }
    if (index < steps.length - 1) {
      setIndex((value) => value + 1);
      setActionIndex(0);
      setProgress(0);
      setPracticeMessage(null);
    } else {
      setPlaying(false);
    }
  }, [progress, actionIndex, actions.length, index, steps.length]);

  useEffect(() => {
    if (!playing || showAll || mode === "with-me") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const previous = lastFrame.current ?? now;
      lastFrame.current = now;
      setProgress((value) =>
        Math.min(1, value + ((now - previous) * speed) / Math.max(resolvedAction.duration, 1)),
      );
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      lastFrame.current = null;
    };
  }, [playing, showAll, mode, speed, resolvedAction.duration]);

  useEffect(() => {
    if (!playing || progress < 1 || mode !== "watch") return;
    const timeout = window.setTimeout(advance, 520 / speed);
    return () => window.clearTimeout(timeout);
  }, [playing, progress, mode, speed, advance]);

  const highlight: HighlightState = showAll
    ? { refs: [], level: "normal" }
    : {
        refs: step.geometryRefs,
        level: "isolated",
        intensity,
        label: `${step.order}. ${step.title}`,
      };

  return (
    <div className="space-y-3">
      <div className="grid-bg-fine relative overflow-hidden rounded-xl border border-line bg-background/40 p-3">
        <div className="h-[300px] lg:h-[420px]">
          {showAll ? (
            <DevelopmentView pattern={result.development} highlight={highlight} />
          ) : (
            <TraceAnimationStage
              pattern={result.development}
              frame={frame}
              completedRefs={completedRefs}
              showAll={false}
              stepLabel={`Passo ${step.order}/${steps.length} · ${step.title}`}
              {...(mode === "with-me"
                ? {
                    onTarget: (point) => {
                      const target = resolvedAction.startPoint;
                      const tolerance =
                        Math.max(
                          result.development.bounds.maxX - result.development.bounds.minX,
                          result.development.bounds.maxY - result.development.bounds.minY,
                        ) * 0.08;
                      if (
                        target &&
                        Math.hypot(point.x - target.x, point.y - target.y) <= tolerance
                      ) {
                        setPracticeMessage("Perfeito. Execute a ação indicada.");
                        setProgress(1);
                      } else setPracticeMessage("Toque no ponto destacado para continuar.");
                    },
                  }
                : {})}
            />
          )}
        </div>
        <span className="absolute top-2 left-3 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
          Chapa · vista superior · mm
        </span>
      </div>

      {/* CONTROLES */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Ctrl onClick={() => moveToStep(index - 1)} disabled={index === 0}>
          <ChevronLeft className="size-3.5" /> Anterior
        </Ctrl>
        <Ctrl
          onClick={mode === "step" ? advance : () => moveToStep(index + 1)}
          disabled={index >= steps.length - 1 && actionIndex >= actions.length - 1 && progress >= 1}
        >
          Próximo <ChevronRight className="size-3.5" />
        </Ctrl>
        <Ctrl onClick={resetStep}>
          <RotateCcw className="size-3.5" /> Repetir etapa
        </Ctrl>
        <Ctrl onClick={() => setShowAll((v) => !v)} active={showAll}>
          <Layers className="size-3.5" /> Mostrar tudo
        </Ctrl>
        <Ctrl onClick={() => setHideText((v) => !v)} active={hideText}>
          {hideText ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} Instruções
        </Ctrl>
        <Ctrl onClick={() => setPlaying((v) => !v)} active={playing}>
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{" "}
          {playing ? "Pausar" : "Continuar"}
        </Ctrl>
        <Button
          size="sm"
          variant="primary"
          icon={Play}
          onClick={() => {
            setMode("watch");
            setShowAll(false);
            setIndex(0);
            resetStep();
            setPlaying(true);
          }}
        >
          Ver como fazer
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={Hand}
          onClick={() => {
            setMode("with-me");
            setShowAll(false);
            setPlaying(false);
            resetStep();
          }}
        >
          Faça comigo
        </Button>
        <div
          className="flex h-8 overflow-hidden rounded-lg border border-line"
          aria-label="Velocidade"
        >
          {([0.5, 1, 2] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setSpeed(value);
              }}
              className={cn(
                "min-w-10 px-2 font-mono text-[10px] touch-manipulation cursor-pointer transition-all duration-140 active:scale-95",
                speed === value ? "bg-accent/15 text-accent font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}×
            </button>
          ))}
        </div>
        <Ctrl
          onClick={() => {
            setMode("step");
            setPlaying(false);
          }}
          active={mode === "step"}
        >
          Passo a passo
        </Ctrl>
        <label className="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          Destaque
          <input
            type="range"
            min={1}
            max={3}
            step={0.5}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="h-1 w-20 accent-[var(--accent)]"
            aria-label="Intensidade do destaque"
          />
        </label>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3 rounded-lg border border-line bg-background/50 px-3 py-2 font-mono text-[10px]">
        <span className="text-foreground">
          Ação {actionIndex + 1}/{actions.length} · {traceAction.instruction}
        </span>
        <span className="shrink-0 text-success">{Math.round(progress * 100)}%</span>
      </div>
      {mode === "with-me" && (
        <p className="rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 text-[12px] text-foreground">
          {practiceMessage ?? traceAction.instruction}
        </p>
      )}

      {index === steps.length - 1 && progress >= 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-success/30 py-3">
          <span className="font-mono text-[11px] tracking-wider text-success">
            ✓ Desenvolvimento concluído
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setShowAll(true)}>
              Desenvolvimento final
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAll(false);
                setIndex(0);
                resetStep();
              }}
            >
              Como foi construído
            </Button>
          </div>
        </div>
      )}

      {/* PASSOS */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => moveToStep(i)}
            aria-current={i === index}
            className={cn(
              "shrink-0 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
              i === index
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-line text-muted-foreground hover:text-foreground",
            )}
          >
            {s.order}. {s.title}
          </button>
        ))}
      </div>

      {!hideText && (
        <div className="fade-up rounded-xl border border-accent/25 bg-accent/[0.05] p-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
            Passo {step.order} de {steps.length} · {TOOL_LABEL[step.tool]}
          </p>
          <p className="mt-1 text-sm font-medium">{step.title}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{step.instruction}</p>

          {step.measurements.length > 0 && (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {step.measurements.map((m) => (
                <div
                  key={`${m.label}-${m.value}`}
                  className="rounded-lg border border-line bg-background/50 px-2.5 py-1.5"
                >
                  <p className="font-mono text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="font-mono text-[12px]">
                    {formatNumber(m.value, m.unit === "un" ? 0 : precision)}{" "}
                    <span className="text-muted-foreground">{m.unit}</span>
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground/80">{m.origin}</p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            <span className="text-accent">Conferência:</span> {step.validation}
          </p>
        </div>
      )}

      <BenchTools tool={step.tool} />
    </div>
  );
}

function Ctrl({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const handleClick = () => {
    triggerHaptic(active ? "tap" : "selection");
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase touch-manipulation select-none cursor-pointer",
        "transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-[0.97]",
        "disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed",
        active
          ? "border-accent/60 bg-accent/15 text-accent shadow-xs"
          : "border-line text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
