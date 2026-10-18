/**
 * ENTRADA INTELIGENTE DE UNIDADES — módulo puro.
 *
 * A unidade interna do sistema é sempre o MILÍMETRO. A polegada existe
 * apenas como interface de entrada.
 *
 * Aceita:
 *   "12,7" | "12.7"        → 12,7 mm
 *   "1/2"  | "1/2\""       → 12,70 mm
 *   "2 3/8"                → 60,33 mm
 *   "23/8"                 → 73,03 mm  (fração imprópria)
 *   "5\"" | "5 in"         → 127 mm
 */

export const MM_PER_INCH = 25.4;

export type ParsedLength =
  | { ok: true; mm: number; inch: number | null; source: "mm" | "inch" }
  | { ok: false; error: string };

const clean = (raw: string) =>
  raw
    .trim()
    .replace(/["”″]/g, " in ")
    .replace(/\bpol\b|\bpolegadas?\b|\binches\b|\binch\b/gi, " in ")
    .replace(/\s+/g, " ")
    .trim();

function toNumber(token: string): number | null {
  const n = Number(token.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Converte texto livre em milímetros. Nunca arredonda o valor retornado. */
export function parseLength(raw: string): ParsedLength {
  if (raw == null) return { ok: false, error: "Valor vazio." };
  let s = clean(String(raw));
  if (!s) return { ok: false, error: "Digite um valor." };

  let isInch = false;
  if (/\bin\b/i.test(s)) {
    isInch = true;
    s = s
      .replace(/\bin\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (/\bmm\b/i.test(s)) {
    s = s
      .replace(/\bmm\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!s) return { ok: false, error: "Digite um valor." };

  // fração (com ou sem parte inteira)
  // fração (parte inteira exige espaço: "2 3/8" = 60,33 mm; "23/8" = 73,03 mm)
  const frac = s.match(/^(?:(-?\d+(?:[.,]\d+)?)\s+)?(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (frac) {
    const whole = frac[1] ? toNumber(frac[1]) : 0;
    const num = toNumber(frac[2]!);
    const den = toNumber(frac[3]!);
    if (whole === null || num === null || den === null)
      return { ok: false, error: "Fração inválida. Use por exemplo 2 3/8." };
    if (den === 0) return { ok: false, error: "Denominador não pode ser zero." };
    const sign = whole < 0 ? -1 : 1;
    const inch = sign * (Math.abs(whole) + num / den);
    return { ok: true, mm: inch * MM_PER_INCH, inch, source: "inch" };
  }

  if (s.includes("/")) return { ok: false, error: "Fração inválida. Use por exemplo 2 3/8." };

  const value = toNumber(s);
  if (value === null) return { ok: false, error: "Valor numérico inválido." };

  return isInch
    ? { ok: true, mm: value * MM_PER_INCH, inch: value, source: "inch" }
    : { ok: true, mm: value, inch: null, source: "mm" };
}

/** true quando o texto digitado representa entrada em polegada. */
export function looksLikeInch(raw: string): boolean {
  const p = parseLength(raw);
  return p.ok && p.source === "inch";
}

/** Arredonda apenas para EXIBIÇÃO. Nunca use em etapas intermediárias. */
export function displayMm(mm: number, decimals = 2): string {
  return mm.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
