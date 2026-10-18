/**
 * CALDRA CAD — CAD KERNEL STATUS POPOVER (REESTRUTURAÇÃO 3D)
 *
 * Painel técnico contextual acionado pelo botão "CAD KERNEL" no cabeçalho do CHAMFER 3D.
 * Exibe o status operacional real do motor geométrico B-Rep (OpenCascade occt-wasm),
 * tolerâncias analíticas, formato de representação e telemetria de inicialização.
 */

import { useState, useEffect } from "react";
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Layers,
  Sparkles,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { getCadKernel } from "@/lib/cad/core";
import { cn } from "@/lib/utils";

interface CadKernelStatusPopoverProps {
  open: boolean;
  onClose: () => void;
  className?: string;
}

export function CadKernelStatusPopover({
  open,
  onClose,
  className,
}: CadKernelStatusPopoverProps) {
  const [status, setStatus] = useState<"ACTIVE" | "INITIALIZING" | "ERROR">("INITIALIZING");
  const [kernelVersion, setKernelVersion] = useState("OpenCascade 7.8 (WASM)");
  const [activeShapesCount, setActiveShapesCount] = useState(1);
  const [isReinitializing, setIsReinitializing] = useState(false);

  useEffect(() => {
    if (!open) return;

    try {
      const kernel = getCadKernel();
      if (kernel.isInitialized) {
        setStatus("ACTIVE");
        setKernelVersion("OpenCascade Technology (occt-wasm)");
      } else {
        setStatus("INITIALIZING");
        void kernel.init().then(() => {
          setStatus("ACTIVE");
        }).catch(() => {
          setStatus("ERROR");
        });
      }
    } catch {
      setStatus("ERROR");
    }
  }, [open]);

  const handleReinit = async () => {
    setIsReinitializing(true);
    try {
      const kernel = getCadKernel();
      await kernel.init();
      setStatus("ACTIVE");
    } catch {
      setStatus("ERROR");
    } finally {
      setIsReinitializing(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop transparente para clique fora */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          "absolute top-11 right-3 z-50 flex w-76 flex-col gap-2.5 rounded-xl border border-line bg-card/95 p-3.5 shadow-2xl backdrop-blur-md font-mono text-[10px] text-foreground animate-in fade-in zoom-in-95 duration-150",
          className,
        )}
      >
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-foreground">
            <Cpu className="size-4 text-accent" />
            <span>CAD KERNEL</span>
          </div>

          <div className="flex items-center gap-1.5">
            {status === "ACTIVE" ? (
              <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-400">
                <CheckCircle2 className="size-2.5" /> ATIVO
              </span>
            ) : status === "INITIALIZING" ? (
              <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-400">
                <Loader2 className="size-2.5 animate-spin" /> INICIALIZANDO
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[8.5px] font-bold text-destructive">
                <AlertCircle className="size-2.5" /> ERRO
              </span>
            )}
          </div>
        </div>

        {/* INFORMAÇÕES DE ARQUITETURA GEOMÉTRICA */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-line/60 bg-background/50 p-2 text-[9px]">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Motor Geométrico:</span>
            <span className="font-semibold text-foreground">OCCT (OpenCascade)</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Representação:</span>
            <span className="font-bold text-accent uppercase">B-Rep (Boundary Rep)</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Runtime:</span>
            <span className="font-semibold text-foreground">WebAssembly (occt-wasm)</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Tolerância Linear:</span>
            <span className="font-semibold text-foreground">0.001 mm</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Tolerância Angular:</span>
            <span className="font-semibold text-foreground">0.01 rad</span>
          </div>
        </div>

        {/* ESTRUTURA DO MODELO EM MEMÓRIA */}
        <div className="flex flex-col gap-1 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1 font-bold text-foreground">
            <Layers className="size-3 text-accent" /> MODELO PARAMÉTRICO
          </div>
          <p className="leading-tight text-[8.5px]">
            O CAD Core orquestra a topologia do sólido B-Rep, integrando as regras da caldeiraria e fabricação ao motor analítico.
          </p>
        </div>

        {/* AÇÕES DE DIAGNÓSTICO */}
        <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[8.5px]">
          <span className="text-muted-foreground truncate" title={kernelVersion}>
            {kernelVersion}
          </span>

          <button
            type="button"
            onClick={handleReinit}
            disabled={isReinitializing}
            className="flex items-center gap-1 rounded bg-muted/60 px-2 py-1 font-semibold text-foreground hover:bg-muted transition-colors"
            title="Recarregar Kernel OCCT"
          >
            <RotateCcw className={cn("size-2.5", isReinitializing && "animate-spin")} />
            Reiniciar
          </button>
        </div>
      </div>
    </>
  );
}
