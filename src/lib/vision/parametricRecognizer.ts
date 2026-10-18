/**
 * parametricRecognizer — VISION 2.0 / Etapa A1.
 *
 * Recebe as primitivas já reconhecidas (em pixels) e, SÓ QUANDO o encaixe é
 * excelente, propõe um template paramétrico editável. Módulo puro: nada de UI,
 * nada de estado. Na dúvida devolve `null` — é proibido propor errado.
 */

import { uid, type Entity } from "@/lib/lab2d/core";
import type { Prim } from "./geometryRecognizer";

export type ParametricKind = "chapa-perfurada" | "flange" | "anel";

export type ParamField = {
  key: string;
  label: string;
  value: number;
  unit: string;
  integer?: boolean;
  min?: number;
};

export type ParametricProposal = {
  kind: ParametricKind;
  title: string;
  /** Descrição curta do padrão reconhecido. */
  summary: string;
  fields: ParamField[];
  /** Desvio máximo do encaixe, em mm. */
  fitMm: number;
  /** Posições relativas dos furos (0..1) na chapa perfurada. */
  holes?: { fx: number; fy: number }[];
};

type Circle = { cx: number; cy: number; r: number };
type Seg = { x1: number; y1: number; x2: number; y2: number };

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Converte primitivas de px para mm, com origem no canto do conteúdo. */
function toMm(prims: Prim[], mmPerPx: number, origin: { x: number; y: number }) {
  const mx = (x: number) => (x - origin.x) * mmPerPx;
  const my = (y: number) => (y - origin.y) * mmPerPx;
  const circles: Circle[] = [];
  const segs: Seg[] = [];
  let others = 0;
  for (const p of prims) {
    if (p.kind === "circle") circles.push({ cx: mx(p.cx), cy: my(p.cy), r: p.r * mmPerPx });
    else if (p.kind === "line")
      segs.push({ x1: mx(p.x1), y1: my(p.y1), x2: mx(p.x2), y2: my(p.y2) });
    else if (p.kind === "polyline") {
      const pts = p.pts.map((q) => ({ x: mx(q.x), y: my(q.y) }));
      if (p.closed && pts.length >= 4 && pts.length <= 5) {
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]!;
          const b = pts[(i + 1) % pts.length]!;
          segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }
      } else others++;
    } else others++;
  }
  return { circles, segs, others };
}

/** Retângulo ortogonal formado por 4 arestas, dentro da tolerância. */
function fitRectangle(segs: Seg[], tolMm: number) {
  if (segs.length < 4 || segs.length > 5) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of segs) {
    const dx = Math.abs(s.x2 - s.x1);
    const dy = Math.abs(s.y2 - s.y1);
    // cada aresta precisa ser praticamente horizontal ou vertical
    if (Math.min(dx, dy) > tolMm) return null;
    minX = Math.min(minX, s.x1, s.x2);
    maxX = Math.max(maxX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return null;
  // toda aresta precisa encostar numa das quatro bordas
  let dev = 0;
  for (const s of segs) {
    const onV = Math.min(Math.abs(s.x1 - minX), Math.abs(s.x1 - maxX));
    const onH = Math.min(Math.abs(s.y1 - minY), Math.abs(s.y1 - maxY));
    dev = Math.max(dev, Math.min(onV, onH));
  }
  if (dev > tolMm) return null;
  return { x: minX, y: minY, w, h, dev };
}

/** Todos os raios iguais dentro da tolerância? */
function sameRadius(circles: Circle[], tolMm: number) {
  const avg = circles.reduce((a, c) => a + c.r, 0) / circles.length;
  const dev = Math.max(...circles.map((c) => Math.abs(c.r - avg)));
  return dev <= tolMm ? { r: avg, dev } : null;
}

/**
 * Analisa a geometria vetorizada e propõe uma parametrização — ou nada.
 * `tolMm` é a mesma tolerância exibida ao usuário.
 */
export function proposeParametric(
  prims: Prim[],
  mmPerPx: number,
  origin: { x: number; y: number },
  tolMm: number,
): ParametricProposal | null {
  if (!prims.length || !Number.isFinite(mmPerPx) || mmPerPx <= 0) return null;
  const { circles, segs, others } = toMm(prims, mmPerPx, origin);
  if (others > 0) return null; // qualquer forma livre derruba a proposta

  /* ---------------- ANEL / FLANGE LISA ---------------- */
  if (circles.length === 2 && !segs.length) {
    const [a, b] = [...circles].sort((p, q) => q.r - p.r) as [Circle, Circle];
    const off = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    if (off <= tolMm && b.r < a.r) {
      return {
        kind: "anel",
        title: "Anel / flange lisa",
        summary: "Dois círculos concêntricos.",
        fitMm: round1(off),
        fields: [
          { key: "de", label: "Ø externo", value: round1(a.r * 2), unit: "mm", min: 1 },
          { key: "di", label: "Ø interno", value: round1(b.r * 2), unit: "mm", min: 0.1 },
        ],
      };
    }
    return null;
  }

  /* ---------------- FLANGE COM FURAÇÃO ---------------- */
  if (!segs.length && circles.length >= 4) {
    const sorted = [...circles].sort((p, q) => q.r - p.r);
    const outer = sorted[0]!;
    let rest = sorted.slice(1);
    // furo central opcional
    const centerHole = rest.find((c) => Math.hypot(c.cx - outer.cx, c.cy - outer.cy) <= tolMm);
    if (centerHole) rest = rest.filter((c) => c !== centerHole);
    if (rest.length >= 3) {
      const same = sameRadius(rest, tolMm);
      if (same) {
        const radii = rest.map((c) => Math.hypot(c.cx - outer.cx, c.cy - outer.cy));
        const bolt = radii.reduce((a, v) => a + v, 0) / radii.length;
        const dev = Math.max(...radii.map((v) => Math.abs(v - bolt)), same.dev);
        if (bolt > same.r && bolt < outer.r && dev <= tolMm) {
          const first = rest
            .map((c) => (Math.atan2(c.cy - outer.cy, c.cx - outer.cx) * 180) / Math.PI)
            .sort((x, y) => x - y)[0]!;
          return {
            kind: "flange",
            title: "Flange furada",
            summary: `${rest.length} furos numa circunferência de furação.`,
            fitMm: round1(dev),
            fields: [
              { key: "de", label: "Ø externo", value: round1(outer.r * 2), unit: "mm", min: 1 },
              {
                key: "di",
                label: "Ø interno (furo central)",
                value: centerHole ? round1(centerHole.r * 2) : 0,
                unit: "mm",
                min: 0,
              },
              {
                key: "dc",
                label: "Ø da circunferência de furação",
                value: round1(bolt * 2),
                unit: "mm",
                min: 1,
              },
              {
                key: "n",
                label: "Nº de furos",
                value: rest.length,
                unit: "un",
                integer: true,
                min: 2,
              },
              { key: "df", label: "Ø do furo", value: round1(same.r * 2), unit: "mm", min: 0.1 },
              { key: "ang", label: "Ângulo do 1º furo", value: round1(first), unit: "°" },
            ],
          };
        }
      }
    }
    return null;
  }

  /* ---------------- CHAPA PERFURADA ---------------- */
  const rect = fitRectangle(segs, tolMm);
  if (rect && circles.length >= 1) {
    const inside = circles.every(
      (c) =>
        c.cx - c.r >= rect.x - tolMm &&
        c.cx + c.r <= rect.x + rect.w + tolMm &&
        c.cy - c.r >= rect.y - tolMm &&
        c.cy + c.r <= rect.y + rect.h + tolMm,
    );
    const same = sameRadius(circles, tolMm);
    if (inside && same) {
      return {
        kind: "chapa-perfurada",
        title: "Chapa perfurada",
        summary: `Retângulo com ${circles.length} furo(s) de mesmo diâmetro.`,
        fitMm: round1(Math.max(rect.dev, same.dev)),
        holes: circles.map((c) => ({
          fx: (c.cx - rect.x) / rect.w,
          fy: (c.cy - rect.y) / rect.h,
        })),
        fields: [
          { key: "w", label: "Largura", value: round1(rect.w), unit: "mm", min: 1 },
          { key: "h", label: "Altura", value: round1(rect.h), unit: "mm", min: 1 },
          {
            key: "n",
            label: "Nº de furos",
            value: circles.length,
            unit: "un",
            integer: true,
            min: 0,
          },
          { key: "df", label: "Ø do furo", value: round1(same.r * 2), unit: "mm", min: 0.1 },
        ],
      };
    }
  }

  return null;
}

/** Valores atuais do template (chave → número). */
export type ParamValues = Record<string, number>;

export function proposalValues(p: ParametricProposal): ParamValues {
  const v: ParamValues = {};
  for (const f of p.fields) v[f.key] = f.value;
  return v;
}

/**
 * Gera a geometria do template a partir dos parâmetros — mesma função usada no
 * preview e na criação, para que preview e resultado nunca divirjam.
 */
export function buildParametric(p: ParametricProposal, v: ParamValues, layer = "corte"): Entity[] {
  const out: Entity[] = [];
  const num = (k: string, fallback = 0) => {
    const n = v[k];
    return Number.isFinite(n) ? (n as number) : fallback;
  };

  if (p.kind === "anel") {
    const de = num("de");
    const di = num("di");
    const c = de / 2;
    if (de > 0) out.push({ id: uid(), layer, type: "circle", cx: c, cy: c, r: de / 2 });
    if (di > 0 && di < de) out.push({ id: uid(), layer, type: "circle", cx: c, cy: c, r: di / 2 });
    return out;
  }

  if (p.kind === "flange") {
    const de = num("de");
    const di = num("di");
    const dc = num("dc");
    const n = Math.max(0, Math.round(num("n")));
    const df = num("df");
    const a0 = (num("ang") * Math.PI) / 180;
    const c = de / 2;
    if (de > 0) out.push({ id: uid(), layer, type: "circle", cx: c, cy: c, r: de / 2 });
    if (di > 0) out.push({ id: uid(), layer, type: "circle", cx: c, cy: c, r: di / 2 });
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 2 * Math.PI) / n;
      out.push({
        id: uid(),
        layer,
        type: "circle",
        cx: c + (dc / 2) * Math.cos(a),
        cy: c + (dc / 2) * Math.sin(a),
        r: df / 2,
      });
    }
    return out;
  }

  const w = num("w");
  const h = num("h");
  const df = num("df");
  const n = Math.max(0, Math.round(num("n")));
  out.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
  });
  const holes = p.holes ?? [];
  for (let i = 0; i < n; i++) {
    const rel = holes[i] ?? { fx: (i + 1) / (n + 1), fy: 0.5 };
    out.push({ id: uid(), layer, type: "circle", cx: rel.fx * w, cy: rel.fy * h, r: df / 2 });
  }
  return out;
}

/** Extensão do template, para desenhar o preview. */
export function parametricBounds(entities: Entity[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of entities) {
    if (e.type === "circle") {
      minX = Math.min(minX, e.cx - e.r);
      maxX = Math.max(maxX, e.cx + e.r);
      minY = Math.min(minY, e.cy - e.r);
      maxY = Math.max(maxY, e.cy + e.r);
    } else if (e.type === "polyline") {
      for (const p of e.pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: Math.max(1e-6, maxX - minX), h: Math.max(1e-6, maxY - minY) };
}
