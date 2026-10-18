/**
 * AURORA CALDRA 2.0 — fundo do aplicativo em três estilos.
 *
 *  FLUIDO   → shader WebGL (domain warping sobre FBM), contexto ÚNICO
 *             compartilhado por todo o app (`auroraEngine`).
 *  SUAVE    → blobs CSS (transform/opacity), pausados em background.
 *  ESTÁTICO → um frame congelado do estilo escolhido.
 *
 * `mode="auto"` → animado só no PRO, sem prefers-reduced-motion e com a
 * aba visível. `mode="always"` (paywall) anima em qualquer plano.
 * `active={false}` (rota sem Aurora) pausa sem desmontar — a animação
 * continua contínua ao navegar.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { auroraEngine } from "@/lib/aurora/auroraEngine";
import { startAutonomousField } from "@/lib/aurora/autonomousFieldEngine";
import { useAIProcessing } from "@/lib/ai/aiProcessingContext";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

/** Detecta se a superfície atual é escura (dark / amoled) ou clara. */
function useDarkSurface() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useAmoledSurface() {
  const [amoled, setAmoled] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setAmoled(el.classList.contains("amoled"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return amoled;
}

export function AuroraBackground({
  mode = "auto",
  active = true,
  className,
}: {
  mode?: "auto" | "always";
  active?: boolean;
  className?: string;
}) {
  const { auroraStyle } = useSettings();
  const { isMestre } = useFeatureAccess();
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deltaRef = useRef<HTMLDivElement>(null);
  const betaRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const gamaRef = useRef<HTMLDivElement>(null);
  const epsilonRef = useRef<HTMLDivElement>(null);

  const [glOk, setGlOk] = useState(true);
  const darkSurface = useDarkSurface();
  const amoledSurface = useAmoledSurface();

  /* FLUIDO ativa o shader tanto no tema escuro quanto no tema claro com paleta adaptada. */
  const shaderStyle = auroraStyle === "fluido";
  const wantsShader = shaderStyle && glOk;
  /* FLUIDO e FLUID AURORA animam continuamente para entregar a experiência viva */
  const allowed = mode === "always" || isMestre || auroraStyle === "fluido" || auroraStyle === "suave";
  const animated = allowed && active && pageVisible && !reduced;

  /* Modo Oficina / alto contraste recuam a amplitude do fundo. */
  const amp =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("oficina") ||
      document.documentElement.classList.contains("high-contrast"))
      ? 0.6
      : 1;

  /* Empresta o container ao canvas compartilhado no estilo FLUIDO. */
  useEffect(() => {
    if (!shaderStyle) return;
    const engine = auroraEngine();
    const host = hostRef.current;
    if (!engine || !host) return;
    if (!engine.supported()) {
      setGlOk(false);
      return;
    }
    const release = engine.acquire(host, animated, amp, darkSurface, amoledSurface);
    const off = engine.onStatus((ok) => {
      setGlOk(ok);
    });
    return () => {
      off();
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderStyle]);

  useEffect(() => {
    if (!shaderStyle) return;
    const engine = auroraEngine();
    const host = hostRef.current;
    if (!engine || !host) return;
    engine.update(host, animated, amp, darkSurface, amoledSurface);
  }, [shaderStyle, animated, amp, darkSurface, amoledSurface]);

  const { isProcessing } = useAIProcessing();
  const engineRef = useRef<ReturnType<typeof startAutonomousField> | null>(null);

  /* Motor Autônomo de Massas de Luz Vivas (Organic Light Field) — Persistente, sem reset */
  useEffect(() => {
    if (wantsShader || auroraStyle !== "suave") return;
    const controller = startAutonomousField(
      {
        container: containerRef.current,
        delta: deltaRef.current,
        beta: betaRef.current,
        alpha: alphaRef.current,
        gama: gamaRef.current,
        epsilon: epsilonRef.current,
      },
      {
        isAnimated: animated,
        isProcessing,
      }
    );
    engineRef.current = controller;
    return () => {
      controller.stop();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsShader, auroraStyle]);

  /* Atualização suave de parâmetros sem interromper a navegação contínua das massas */
  useEffect(() => {
    engineRef.current?.update({
      isAnimated: animated,
      isProcessing,
    });
  }, [animated, isProcessing]);

  /* PADRÃO: nenhuma camada — o fundo sólido do tema aparece. */
  if (auroraStyle === "padrao") return null;

  return (
    <div
      aria-hidden
      className={cn("aurora-root pointer-events-none absolute inset-0 overflow-hidden", className)}
      data-animated={animated ? "on" : "off"}
      data-active={active ? "on" : "off"}
      data-style={wantsShader ? "fluido" : "suave"}
      data-processing={isProcessing ? "active" : "idle"}
    >
      <div ref={hostRef} className="aurora-gl absolute inset-0" />
      {!wantsShader && (
        <div
          ref={containerRef}
          className="aurora-css organic-field-container absolute inset-0"
          data-processing={isProcessing ? "active" : "idle"}
        >
          {/* Fundo base escuro e fosco (#04060A → #070B13 → #0C1424) */}
          <div className="organic-field-base absolute inset-0" />

          {/* Iluminação ambiente permanente (anti-flicker garantido) */}
          <div className="organic-field-ambient absolute inset-0" />

          {/* Crista e ondas de energia luminosa superior ativas em modo de processamento */}
          <div className="ai-processing-crest absolute inset-x-0 top-0 h-[46vh] pointer-events-none" />
          <div className="ai-processing-waves absolute inset-0 pointer-events-none" />

          {/* 1. ENTIDADE DELTA — O Oceano Abissal (profundidade atmosférica constante) */}
          <div ref={deltaRef} className="organic-mass mass-delta">
            <div className="mass-body body-delta">
              <div className="mass-inner inner-delta" />
              <div className="mass-core core-delta" />
            </div>
          </div>

          {/* 2. ENTIDADE BETA — A Nebulosa Violeta (dança de aproximação e fusão com Alfa) */}
          <div ref={betaRef} className="organic-mass mass-beta">
            <div className="mass-body body-beta">
              <div className="mass-inner inner-beta" />
              <div className="mass-core core-beta-1" />
              <div className="mass-core core-beta-2" />
            </div>
          </div>

          {/* 3. ENTIDADE ALFA — O Coração Ciano-Azul (cruza do noroeste para o centro e funde com Beta) */}
          <div ref={alphaRef} className="organic-mass mass-alpha">
            <div className="mass-body body-alpha">
              <div className="mass-inner inner-alpha" />
              <div className="mass-core core-alpha-1" />
              <div className="mass-core core-alpha-2" />
            </div>
          </div>

          {/* 4. ENTIDADE GAMA — O Véu Carmesim/Rosa (cruza a faixa sul, interage com Beta) */}
          <div ref={gamaRef} className="organic-mass mass-gama">
            <div className="mass-body body-gama">
              <div className="mass-inner inner-gama" />
              <div className="mass-core core-gama-1" />
              <div className="mass-core core-gama-2" />
            </div>
          </div>

          {/* 5. ENTIDADE ÉPSILON — A Centelha Dourada/Celeste (centelha ágil em voo livre) */}
          <div ref={epsilonRef} className="organic-mass mass-epsilon">
            <div className="mass-body body-epsilon">
              <div className="mass-inner inner-epsilon" />
              <div className="mass-core core-epsilon" />
            </div>
          </div>

          {/* Vinheta cinematográfica preservando contraste e legibilidade impecável */}
          <div className="organic-field-vignette absolute inset-0 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
