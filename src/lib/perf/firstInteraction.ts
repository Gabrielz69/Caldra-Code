/**
 * Instrumentação de latência da PRIMEIRA interação — apenas em desenvolvimento.
 *
 * Mede, sem interferir no comportamento: primeira renderização, primeiro
 * toque, início/fim do handler e a primeira atualização visual depois dele.
 * Em produção a função é um no-op e nada é registrado.
 */

export function measureFirstInteraction(): () => void {
  if (!import.meta.env.DEV || typeof window === "undefined") return () => {};

  const mark = (name: string) => {
    try {
      performance.mark(name);
    } catch {
      /* API indisponível */
    }
  };

  mark("FIRST_APP_RENDER");
  let done = false;

  const onPointer = () => {
    if (done) return;
    done = true;
    mark("FIRST_INTERACTION");
    const start = performance.now();
    /* Fim do handler: microtask após a fila de eventos do clique. */
    queueMicrotask(() => {
      const handlerEnd = performance.now();
      requestAnimationFrame(() => {
        const painted = performance.now();
        console.info(
          `[CALDRA perf] primeira interação → handler ${Math.round(handlerEnd - start)}ms · pintura ${Math.round(painted - start)}ms`,
        );
      });
    });
  };

  window.addEventListener("pointerdown", onPointer, { passive: true, capture: true });
  return () => window.removeEventListener("pointerdown", onPointer, { capture: true });
}

export const CORE_ROUTES = [
  "/projetar",
  "/produzir",
  "/aprenda",
  "/perfil",
  "/tracagem",
  "/escola",
  "/projetos",
] as const;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Executa em fatias ociosas; nunca concorre com a interação do usuário. */
export function onIdle(task: () => void, timeout = 2000): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as IdleWindow;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(task, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, timeout);
  return () => window.clearTimeout(id);
}

/** Conexão econômica/lenta: não gastamos dados do usuário com prefetch. */
export function prefetchAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return conn.effectiveType !== "slow-2g" && conn.effectiveType !== "2g";
}
