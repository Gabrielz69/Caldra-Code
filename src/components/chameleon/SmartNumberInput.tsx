import { useEffect, useState } from "react";
import { displayMm, parseLength } from "@/lib/units/parse";
import { cn } from "@/lib/utils";

/**
 * Campo numérico com entrada inteligente de unidades.
 * Aceita "12,7", "12.7", "1/2", "2 3/8", 5" — valor interno sempre em mm.
 */
export function SmartNumberInput({
  value,
  onChange,
  unit = "mm",
  invalid = false,
  className,
  inputRef,
  onFocus,
  onBlur,
  ariaLabel,
}: {
  value: number;
  onChange: (mm: number) => void;
  unit?: string;
  invalid?: boolean;
  className?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equiv, setEquiv] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const handle = (raw: string) => {
    setText(raw);
    if (raw.trim() === "" || raw.trim() === "-") {
      setError(null);
      setEquiv(null);
      return;
    }
    const parsed = parseLength(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      setEquiv(null);
      return;
    }
    setError(null);
    setEquiv(parsed.source === "inch" ? `= ${displayMm(parsed.mm)} mm` : null);
    onChange(parsed.mm);
  };

  return (
    <span className="block">
      <span
        className={cn(
          "flex items-center overflow-hidden rounded-lg border bg-background/50 transition-all duration-140 [transition-timing-function:var(--ease-natural)] touch-manipulation",
          invalid || error
            ? "border-destructive focus-within:ring-1 focus-within:ring-destructive/50"
            : "border-line focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40 focus-within:shadow-xs",
          className,
        )}
      >
        <input
          ref={inputRef}
          inputMode="text"
          aria-label={ariaLabel}
          value={text}
          onChange={(e) => handle(e.target.value)}
          onFocus={() => {
            setEditing(true);
            onFocus?.();
          }}
          onBlur={() => {
            setEditing(false);
            setEquiv(null);
            setError(null);
            setText(String(value));
            onBlur?.();
          }}
          className="w-full min-w-0 bg-transparent px-2.5 py-2.5 font-mono text-[15px] outline-none touch-manipulation"
        />
        <span className="border-l border-line px-2 font-mono text-[10px] text-muted-foreground">
          {unit}
        </span>
      </span>
      {equiv && <span className="mt-1 block font-mono text-[10px] text-accent">{equiv}</span>}
      {error && <span className="mt-1 block text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
