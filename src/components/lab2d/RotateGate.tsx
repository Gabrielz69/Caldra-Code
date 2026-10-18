import { RotateCw, X } from "lucide-react";

/**
 * Overlay "GIRE O CELULAR" — aparece quando o CHAMFER não conseguiu travar
 * a orientação em paisagem. Nunca prende o usuário: há sempre saída e a
 * opção de continuar em retrato.
 */
export function RotateGate({
  onRetry,
  onContinue,
  onExit,
}: {
  onRetry: () => void;
  onContinue: () => void;
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-background/95 px-6 backdrop-blur-xl">
      <button
        onClick={onExit}
        aria-label="Sair do CHAMFER"
        className="metal absolute top-4 left-4 grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative grid size-28 place-items-center">
          <span className="absolute inset-0 rounded-3xl border border-line" />
          <RotateCw className="size-10 animate-spin text-accent [animation-duration:2.6s]" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-xl font-semibold tracking-tight">Gire o dispositivo</p>
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            CHAMFER opera exclusivamente em modo paisagem (Landscape)
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={onRetry}
            className="rounded-xl border border-red-500/50 bg-red-600 px-4 py-2 font-mono text-[10px] font-bold tracking-[0.18em] text-white uppercase shadow-md hover:bg-red-500"
          >
            Girar Tela
          </button>
          <button
            onClick={onExit}
            className="rounded-xl border border-line px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
