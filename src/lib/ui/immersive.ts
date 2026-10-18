/**
 * immersive — tela cheia + orientação paisagem para o CHAMFER.
 * Sempre degradado com elegância: se o lock falhar (iOS/Safari, permissão
 * negada), devolvemos `needsRotate` para a UI pedir a rotação manual.
 * Nunca bloqueia o app: há sempre caminho de saída.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type OrientationLock = ScreenOrientation & {
  lock?: (o: string) => Promise<void>;
  unlock?: () => void;
};

function isPhone() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return coarse && Math.min(window.innerWidth, window.innerHeight) < 820;
}

function isPortrait() {
  if (typeof window === "undefined") return false;
  return window.innerHeight > window.innerWidth;
}

async function enterFullscreen(el: HTMLElement) {
  try {
    if (!document.fullscreenElement && el.requestFullscreen)
      await el.requestFullscreen({ navigationUI: "hide" });
  } catch {
    /* sem fullscreen: seguimos assim mesmo */
  }
}

async function exitFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch {
    /* ignorado */
  }
}

async function lockLandscape() {
  const so = (typeof screen !== "undefined" ? screen.orientation : undefined) as
    OrientationLock | undefined;
  if (!so?.lock) return false;
  try {
    await so.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

function unlockOrientation() {
  const so = (typeof screen !== "undefined" ? screen.orientation : undefined) as
    OrientationLock | undefined;
  try {
    so?.unlock?.();
  } catch {
    /* ignorado */
  }
}

/**
 * Ativa modo imersivo enquanto `enabled`. Retorna se ainda falta girar o
 * aparelho e uma função para pedir o modo imersivo num gesto do usuário.
 */
export function useImmersiveLandscape(enabled: boolean) {
  const [portrait, setPortrait] = useState(false);
  const [phone, setPhone] = useState(false);

  const sync = useCallback(() => {
    setPhone(isPhone());
    setPortrait(isPortrait());
  }, []);

  const request = useCallback(async () => {
    if (!enabled) return;
    await enterFullscreen(document.documentElement);
    await lockLandscape();
    sync();
  }, [enabled, sync]);

  useEffect(() => {
    if (!enabled) return;
    sync();
    void request();

    const onResize = () => sync();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      unlockOrientation();
      void exitFullscreen();
    };
  }, [enabled, request, sync]);

  return {
    /** celular ainda em retrato: mostrar overlay "gire o celular" */
    needsRotate: enabled && phone && portrait,
    /** pedir tela cheia/paisagem novamente a partir de um toque */
    request,
    /** sair do modo imersivo (usado pelo botão SAIR) */
    release: useCallback(async () => {
      unlockOrientation();
      await exitFullscreen();
    }, []),
  };
}

/* ---- sinal global: o editor CHAMFER está realmente montado? ---- */
let immersiveOn = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Marca o modo imersivo enquanto o componente estiver montado. */
export function useDeclareImmersive(active: boolean) {
  useEffect(() => {
    if (!active) return;
    immersiveOn = true;
    emit();
    return () => {
      immersiveOn = false;
      emit();
    };
  }, [active]);
}

/** O shell escuta este sinal para esconder navegação e cabeçalho. */
export function useImmersiveActive() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => immersiveOn,
    () => false,
  );
}
