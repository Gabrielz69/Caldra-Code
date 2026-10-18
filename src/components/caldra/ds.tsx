/**
 * DESIGN SYSTEM CALDRA — primitivas compartilhadas.
 *
 * Tipografia, botões com todos os estados, carregadores e telas de erro.
 * Nenhuma cor literal: tudo vem dos tokens em `src/styles.css`.
 */

import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";

/* ───────────────────────── tipografia ───────────────────────── */

type TextProps = { className?: string; children: React.ReactNode };

export const Display = ({ className, children }: TextProps) => (
  <h1 className={cn("t-display", className)}>{children}</h1>
);

export const Title = ({ className, children }: TextProps) => (
  <h2 className={cn("t-title", className)}>{children}</h2>
);

export const Subtitle = ({ className, children }: TextProps) => (
  <h3 className={cn("t-subtitle", className)}>{children}</h3>
);

export const Body = ({ className, children }: TextProps) => (
  <p className={cn("t-body", className)}>{children}</p>
);

export const Caption = ({ className, children }: TextProps) => (
  <p className={cn("t-caption", className)}>{children}</p>
);

export const Eyebrow = ({ className, children }: TextProps) => (
  <span className={cn("t-eyebrow", className)}>{children}</span>
);

/* ───────────────────────── botão ───────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "brand-gradient text-background hover:brightness-110",
  secondary: "metal text-foreground hover:amber-ring",
  ghost: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
  danger: "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(variant === "danger" ? "warning" : "tap");
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-medium touch-manipulation select-none cursor-pointer",
        "transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-[0.97] active:brightness-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {loading ? (
        <span className="ds-spinner size-3.5 shrink-0" aria-hidden />
      ) : (
        Icon && <Icon className="size-4 shrink-0" />
      )}
      {children}
    </button>
  );
}

/* ───────────────────────── carregamento ───────────────────────── */

export const Spinner = ({ className }: { className?: string }) => (
  <span role="status" aria-label="Carregando" className={cn("ds-spinner size-5", className)} />
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("ds-skeleton h-4 w-full", className)} />
);

export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-16 rounded-2xl", i % 2 && "opacity-80")} />
      ))}
    </div>
  );
}

export function LoadingState({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <Spinner />
      <Eyebrow>{label}</Eyebrow>
    </div>
  );
}

/* ───────────────────────── erro ───────────────────────── */

export function ErrorState({
  title = "Algo não saiu como esperado",
  hint,
  onRetry,
  retryLabel = "Tentar de novo",
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center"
    >
      <div className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-4" />
      </div>
      <Subtitle>{title}</Subtitle>
      {hint && <Caption className="max-w-sm">{hint}</Caption>}
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry} className="mt-1">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1 font-mono text-[11px] tracking-wide text-destructive">
      {children}
    </p>
  );
}
