// @ts-nocheck
import { cn } from "@/lib/utils";

/**
 * LOGO CALDRA — GEOMETRIA CANÔNICA (ORIGINAL DA FOTO)
 *
 * Estrutura geométrica idêntica à referência:
 * - Corpo principal "C" em ângulo e chanfros de 45°
 * - Pastilha/paralelogramo interno em 45° ajustado ao tema e cor de destaque
 * - Adaptação dinâmica para modo escuro (aço claro / branco) e claro (grafite escuro)
 * - Compatível com temas de acento (âmbar, azul elétrico original, carmesim)
 */
export function CaldraLogo({
  className,
  size = 36,
  animated = false,
  glow = false,
}: {
  className?: string;
  size?: number | string;
  animated?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative inline-grid shrink-0 place-items-center select-none transition-transform duration-300 hover:scale-105",
        className,
      )}
      style={{
        width: typeof size === "number" ? `${size}px` : size,
        height: typeof size === "number" ? `${size}px` : size,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full overflow-visible drop-shadow-sm"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="caldra-sheen-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="caldra-accent-grad" x1="39" y1="47.5" x2="75" y2="61.5" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent, #3B82F6)" />
            <stop offset="100%" stopColor="color-mix(in oklab, var(--accent, #3B82F6) 80%, #000)" />
          </linearGradient>
        </defs>

        {/* CORPO PRINCIPAL EM 'C' CHANFRADO (Adaptação ao tema: Branco/Aço no escuro, Grafite no claro) */}
        <path
          d="M 38 18 L 82 18 L 66.5 33.5 L 50 33.5 L 33.5 50 L 50 66.5 L 82 66.5 L 66.5 82 L 38 82 L 18 62 L 18 38 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-zinc-800 dark:text-[#EDEDF2] transition-colors duration-300"
        />

        {/* Reflexo sutil de profundidade especular */}
        <path
          d="M 38 18 L 82 18 L 66.5 33.5 L 50 33.5 L 33.5 50 L 50 66.5 L 82 66.5 L 66.5 82 L 38 82 L 18 62 L 18 38 Z"
          fill="url(#caldra-sheen-grad)"
          stroke="transparent"
          strokeWidth="0"
          className="pointer-events-none"
        />

        {/* PASTILHA INTERNA EM PARALELOGRAMO (Cor de Destaque dinâmica do aplicativo: Azul elétrico, Âmbar, etc.) */}
        <path
          d="M 43 42.5 L 60 42.5 L 75.5 58 L 58.5 58 Z"
          fill="url(#caldra-accent-grad)"
          stroke="var(--accent, #007AFF)"
          strokeWidth="3.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className={cn(
            "transition-colors duration-300 origin-center",
            (animated || glow) && "animate-[caldra-accent-pulse_3s_ease-in-out_infinite]",
          )}
          style={{
            filter: glow || animated ? "drop-shadow(0 0 6px var(--accent, #007AFF))" : undefined,
          }}
        />
      </svg>
    </div>
  );
}

/** Marca abstrata do CALDRA compatível com o design system existente. */
export function CaldraMark({ className }: { className?: string }) {
  return <CaldraLogo className={className} size="100%" animated glow />;
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0 leading-tight">
      <CaldraLogo size={compact ? 24 : 32} animated glow />
      <div className="min-w-0">
        <p className="font-display text-[15px] font-bold tracking-wider whitespace-nowrap bg-gradient-to-r from-foreground via-foreground to-accent bg-clip-text text-transparent">
          CALDRA
        </p>
        {!compact && (
          <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
            Traçado & Planificação Zero Fresta
          </p>
        )}
      </div>
    </div>
  );
}
