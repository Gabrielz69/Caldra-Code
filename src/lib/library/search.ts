/**
 * Busca inteligente da biblioteca.
 *
 * Pesquisa nome, sinônimos, família, categoria, capacidades e números
 * relevantes ("flange 500", "curva 3 gomos", "redução 800 para 500").
 */

import { CATEGORY_LABEL, type PartModel } from "./registry";

const ACC = /[\u0300-\u036f]/g;

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(ACC, "").trim();

const SYNONYMS: Record<string, string[]> = {
  joelho: ["curva", "gomos"],
  cotovelo: ["curva", "gomos"],
  reducao: ["tronco de cone", "reducao"],
  bolt: ["furacao circular"],
  "furo circular": ["furacao circular"],
  duto: ["tubo", "duto"],
  placa: ["chapa"],
  chapa: ["chapa", "retangulo"],
  disco: ["circulo"],
  luva: ["virola", "tubo"],
};

function haystack(p: PartModel) {
  return norm(
    [
      p.name,
      p.summary,
      p.family,
      CATEGORY_LABEL[p.category],
      p.specs.join(" "),
      p.tags.join(" "),
    ].join(" "),
  );
}

const CACHE = new WeakMap<PartModel, string>();
function hay(p: PartModel) {
  let v = CACHE.get(p);
  if (!v) {
    v = haystack(p);
    CACHE.set(p, v);
  }
  return v;
}

export function scorePart(p: PartModel, query: string): number {
  const q = norm(query);
  if (!q) return 1;
  const name = norm(p.name);
  const h = hay(p);
  let score = 0;

  const tokens = q.split(/\s+/).filter(Boolean);
  for (const raw of tokens) {
    const t = raw.replace(/^ø/, "");
    const expanded = [t, ...(SYNONYMS[t] ?? [])];
    const hit = expanded.some((e) => h.includes(e));
    if (hit) {
      score += name.startsWith(t) ? 6 : name.includes(t) ? 4 : 2;
      continue;
    }
    // número solto: aceita quando aparece em qualquer especificação/nome
    if (/^\d+([.,]\d+)?$/.test(t) && h.includes(t)) {
      score += 3;
      continue;
    }
    if (["para", "de", "com", "x", "×"].includes(t)) continue;
    return 0;
  }
  if (name === q) score += 10;
  return score;
}

export function searchParts(parts: PartModel[], query: string): PartModel[] {
  if (!query.trim()) return parts;
  return parts
    .map((p) => ({ p, s: scorePart(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
