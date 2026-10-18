import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";

export type AIProcessingContextValue = {
  isProcessing: boolean;
  isContinuous: boolean;
  statusText?: string;
  startProcessing: (statusText?: string) => () => void;
  stopProcessing: () => void;
  triggerProcessing: (durationMs?: number, statusText?: string) => void;
  setProcessing: (active: boolean, statusText?: string) => void;
  toggleContinuous: (statusText?: string) => void;
  setContinuous: (active: boolean, statusText?: string) => void;
};

const AIProcessingContext = createContext<AIProcessingContextValue | null>(null);

export function AIProcessingProvider({ children }: { children: ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [statusText, setStatusText] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopProcessing = useCallback(() => {
    clearTimer();
    setIsContinuous(false);
    setIsProcessing(false);
    setStatusText(undefined);
  }, [clearTimer]);

  const setProcessing = useCallback((active: boolean, text?: string) => {
    clearTimer();
    setIsContinuous(false);
    setIsProcessing(active);
    setStatusText(active ? (text ?? "Em Processamento") : undefined);
  }, [clearTimer]);

  const toggleContinuous = useCallback((text?: string) => {
    clearTimer();
    setIsContinuous((prev) => {
      const next = !prev;
      setIsProcessing(next);
      setStatusText(next ? (text ?? "Modo Contínuo Ativo") : undefined);
      return next;
    });
  }, [clearTimer]);

  const setContinuous = useCallback((active: boolean, text?: string) => {
    clearTimer();
    setIsContinuous(active);
    setIsProcessing(active);
    setStatusText(active ? (text ?? "Modo Contínuo Ativo") : undefined);
  }, [clearTimer]);

  const startProcessing = useCallback((text?: string) => {
    clearTimer();
    setIsContinuous(false);
    setIsProcessing(true);
    setStatusText(text);
    return () => {
      clearTimer();
      setIsContinuous(false);
      setIsProcessing(false);
      setStatusText(undefined);
    };
  }, [clearTimer]);

  const triggerProcessing = useCallback((durationMs = 8000, text?: string) => {
    clearTimer();
    setIsContinuous(false);
    setIsProcessing(true);
    setStatusText(text ?? "Calculando Traçado & Malha IA");
    timerRef.current = setTimeout(() => {
      setIsContinuous(false);
      setIsProcessing(false);
      setStatusText(undefined);
      timerRef.current = null;
    }, durationMs);
    return () => clearTimer();
  }, [clearTimer]);

  const value = useMemo(
    () => ({
      isProcessing,
      isContinuous,
      statusText,
      startProcessing,
      stopProcessing,
      triggerProcessing,
      setProcessing,
      toggleContinuous,
      setContinuous,
    }),
    [
      isProcessing,
      isContinuous,
      statusText,
      startProcessing,
      stopProcessing,
      triggerProcessing,
      setProcessing,
      toggleContinuous,
      setContinuous,
    ]
  );

  return (
    <AIProcessingContext.Provider value={value}>
      {children}
    </AIProcessingContext.Provider>
  );
}

export function useAIProcessing(): AIProcessingContextValue {
  const ctx = useContext(AIProcessingContext);
  if (!ctx) {
    return {
      isProcessing: false,
      statusText: undefined,
      startProcessing: () => () => {},
      stopProcessing: () => {},
      triggerProcessing: () => {},
      setProcessing: () => {},
    };
  }
  return ctx;
}
