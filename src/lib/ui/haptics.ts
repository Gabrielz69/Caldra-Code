/**
 * CALDRA Motion & Touch System — Feedback Háptico e Microinterações
 *
 * Provê resposta física sutil para dispositivos touch compatíveis.
 * Respeita preferências de redução de movimento e não bloqueia a UI.
 */

export type HapticPattern = "tap" | "selection" | "toggle" | "action" | "success" | "warning" | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,            // Toque ultraleve em botões comuns
  selection: 12,     // Seleção de ferramenta, aba ou modo
  toggle: [8, 30, 8],// Alternância de chave/toggle
  action: 14,        // Disparo de ação de cálculo/traçagem
  success: [10, 40, 15], // Conclusão positiva
  warning: [15, 50, 15], // Alerta sutil
  error: [20, 60, 25],   // Bloqueio ou erro
};

let hapticsAvailable: boolean | null = null;

function canHaptic(): boolean {
  if (hapticsAvailable !== null) return hapticsAvailable;
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    hapticsAvailable = false;
    return false;
  }
  
  // Respeita prefers-reduced-motion
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hapticsAvailable = false;
    return false;
  }

  // Verifica se o dispositivo suporta vibração e possui tela de toque primária
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  hapticsAvailable = Boolean(hasTouch && typeof navigator.vibrate === "function");
  return hapticsAvailable;
}

/**
 * Dispara um pulso háptico não bloqueante se suportado.
 */
export function triggerHaptic(type: HapticPattern = "tap"): void {
  try {
    if (!canHaptic()) return;
    const pattern = PATTERNS[type];
    navigator.vibrate(pattern);
  } catch {
    // Falha silenciosa sem interferir na interação
  }
}
