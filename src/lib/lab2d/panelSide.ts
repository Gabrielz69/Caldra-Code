/**
 * PANEL POSITION MANAGER — fonte ÚNICA de verdade do lado do painel.
 *
 * Causa-raiz do bug anterior: o lado era calculado dentro de um `useMemo`
 * que lia `getBoundingClientRect()` e dependia de `view`. Cada pan/zoom
 * remedia → troca de lado → o painel muda o layout → a área do canvas muda
 * → nova medida → nova troca. Loop clássico de layout thrashing.
 *
 * Correção: MEDIR → CALCULAR → FIXAR → RENDERIZAR.
 *   - a decisão acontece UMA vez por evento significativo (abertura, nova
 *     seleção, mudança de tipo de seleção, resize/rotação real do viewport);
 *   - nunca durante pan, zoom ou drag;
 *   - com margem de segurança (histerese) para não trocar por poucos pixels;
 *   - a posição atual JAMAIS entra no cálculo da própria posição.
 */

import { useEffect, useRef, useState } from "react";

export type PanelSide = "left" | "right";

export type PanelMeasure = {
  /** Largura da área do canvas em px. */
  width: number;
  /** Centro X do objeto selecionado em px de tela (null = sem seleção). */
  centerX: number | null;
};

/** Zona morta: só troca de lado quando o objeto passa claramente do limite. */
const TO_LEFT = 0.66;
const TO_RIGHT = 0.34;
/** Resize só é "significativo" acima deste delta. */
const RESIZE_EPS = 64;
const RESIZE_DEBOUNCE = 180;

export function usePanelSide(
  open: boolean,
  /** Assinatura do contexto: muda APENAS em evento significativo. */
  signature: string,
  measure: () => PanelMeasure,
): PanelSide {
  const [side, setSide] = useState<PanelSide>("right");
  const sideRef = useRef<PanelSide>("right");
  const measureRef = useRef(measure);
  const lastWidth = useRef(0);
  const wasOpen = useRef(false);
  measureRef.current = measure;

  const decide = useRef((reason: "context" | "viewport") => {
    const m = measureRef.current();
    if (!m.width) return;
    if (reason === "viewport" && Math.abs(m.width - lastWidth.current) < RESIZE_EPS) return;
    lastWidth.current = m.width;
    if (m.centerX === null) return; // sem seleção: mantém o lado atual (lock)
    const ratio = m.centerX / m.width;
    const current = sideRef.current;
    // histerese: só sai do lado atual quando realmente falta espaço
    const next: PanelSide =
      current === "right"
        ? ratio > TO_LEFT
          ? "left"
          : "right"
        : ratio < TO_RIGHT
          ? "right"
          : "left";
    if (next === current) return;
    sideRef.current = next;
    setSide(next);
  });

  /* evento significativo: abertura / nova seleção / mudança de tipo */
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    // uma única medição após o layout estar pronto, sem encadear re-medições
    const id = requestAnimationFrame(() => decide.current("context"));
    return () => cancelAnimationFrame(id);
  }, [open, signature]);

  /* resize / rotação — com debounce e limiar, nunca por frame */
  useEffect(() => {
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => decide.current("viewport"), RESIZE_DEBOUNCE);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return side;
}
