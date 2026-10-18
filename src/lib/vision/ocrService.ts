/**
 * ocrService — VISION 2.0 / Etapa A2.
 *
 * OCR técnico 100% no navegador (Tesseract.js carregado sob demanda).
 * O serviço apenas PROPÕE: nada é aplicado ao desenho sem confirmação.
 */

import { parseLength } from "@/lib/units/parse";

export type OcrKind = "diametro" | "raio" | "angulo" | "rosca" | "polegada" | "medida";

export type OcrCandidate = {
  id: string;
  /** Texto reconhecido, já limpo. */
  text: string;
  kind: OcrKind;
  /** Valor em mm quando aplicável (ângulo e rosca ficam nulos). */
  mm: number | null;
  /** Confiança do reconhecimento, 0–100. */
  confidence: number;
  /** Caixa em fração da imagem (0..1) — independe da escala de exibição. */
  box: { x: number; y: number; w: number; h: number };
  approved: boolean;
};

const LABEL: Record<OcrKind, string> = {
  diametro: "Diâmetro",
  raio: "Raio",
  angulo: "Ângulo",
  rosca: "Rosca",
  polegada: "Polegada",
  medida: "Medida",
};

export const ocrKindLabel = (k: OcrKind) => LABEL[k];

/** Normaliza confusões clássicas do OCR em contexto numérico. */
function cleanToken(raw: string) {
  return raw
    .replace(/[|]/g, "1")
    .replace(/[”″]/g, '"')
    .replace(/[Øø⌀0O]\s*(?=\d)/g, "Ø")
    .replace(/\s+/g, " ")
    .trim();
}

/** Interpreta um token do OCR como cota técnica — ou devolve `null`. */
export function classifyToken(
  raw: string,
): { kind: OcrKind; mm: number | null; text: string } | null {
  const t = cleanToken(raw);
  if (!t || !/\d/.test(t)) return null;

  const rosca = t.match(/^M\s?(\d+(?:[.,]\d+)?)(?:\s?[x×]\s?\d+(?:[.,]\d+)?)?$/i);
  if (rosca)
    return { kind: "rosca", mm: Number(rosca[1]!.replace(",", ".")), text: t.toUpperCase() };

  const ang = t.match(/^(\d+(?:[.,]\d+)?)\s?[°ºo]$/i);
  if (ang) {
    const v = Number(ang[1]!.replace(",", "."));
    return v >= 0 && v <= 360 ? { kind: "angulo", mm: null, text: `${v}°` } : null;
  }

  const dia = t.match(/^[Øø⌀]\s?(\d+(?:[.,]\d+)?)$/);
  if (dia) return { kind: "diametro", mm: Number(dia[1]!.replace(",", ".")), text: t };

  const rad = t.match(/^R\s?(\d+(?:[.,]\d+)?)$/i);
  if (rad) return { kind: "raio", mm: Number(rad[1]!.replace(",", ".")), text: t.toUpperCase() };

  if (/["]|(\d\s+\d+\/\d+)|^\d+\/\d+/.test(t)) {
    const p = parseLength(t);
    if (p.ok && p.source === "inch") return { kind: "polegada", mm: p.mm, text: t };
  }

  const plain = t.match(/^(\d+(?:[.,]\d+)?)(?:\s?mm)?$/i);
  if (plain) {
    const v = Number(plain[1]!.replace(",", "."));
    // números de 1 dígito quase sempre são ruído de traço/legenda
    if (v >= 3 && v <= 100000) return { kind: "medida", mm: v, text: `${plain[1]}` };
  }
  return null;
}

type Word = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrProgress = (stage: string, pct: number) => void;

/**
 * Roda o OCR sobre a imagem e devolve apenas os candidatos com padrão técnico.
 * `minConfidence` corta ruído; a revisão final é sempre do usuário.
 */
export async function detectDimensions(
  source: string | HTMLImageElement | HTMLCanvasElement,
  opt: { minConfidence?: number; onProgress?: OcrProgress } = {},
): Promise<OcrCandidate[]> {
  const min = opt.minConfidence ?? 45;
  opt.onProgress?.("Carregando OCR", 8);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text")
        opt.onProgress?.("Lendo cotas", 20 + Math.round((m.progress ?? 0) * 75));
    },
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.,/"°ºØøRMx× ',
    });
    opt.onProgress?.("Lendo cotas", 20);
    const { data } = await worker.recognize(source, {}, { blocks: true });
    const page = data as unknown as { words?: Word[]; imageWidth?: number; imageHeight?: number };
    const words: Word[] = (page.words ?? []).filter(Boolean);
    const w = page.imageWidth || 1;
    const h = page.imageHeight || 1;
    const out: OcrCandidate[] = [];
    for (const word of words) {
      if (!word?.text || word.confidence < min) continue;
      const hit = classifyToken(word.text);
      if (!hit) continue;
      const b = word.bbox;
      out.push({
        id: Math.random().toString(36).slice(2, 9),
        text: hit.text,
        kind: hit.kind,
        mm: hit.mm,
        confidence: Math.round(word.confidence),
        box: { x: b.x0 / w, y: b.y0 / h, w: (b.x1 - b.x0) / w, h: (b.y1 - b.y0) / h },
        approved: false,
      });
    }
    opt.onProgress?.("Concluído", 100);
    return out.sort((a, b) => b.confidence - a.confidence);
  } finally {
    await worker.terminate();
  }
}
