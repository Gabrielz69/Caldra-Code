/**
 * Geradores vetoriais 2D para fabricação CNC.
 *
 * Cada gerador produz geometria REAL (entidades do CHAMFER em mm) a partir de
 * parâmetros — nunca imagem. A biblioteca apenas descreve; a matemática vive aqui.
 */

import { uid, type Entity } from "@/lib/lab2d/core";
import type { Vec2 } from "@/lib/geometry/types";

export type CncField = {
  key: string;
  label: string;
  def: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** Campo só aparece quando esta função devolve verdadeiro. */
  when?: (v: Record<string, number>) => boolean;
};

export type CncGenerator = {
  id: string;
  fields: CncField[];
  build: (v: Record<string, number>) => Entity[];
};

const P = (x: number, y: number): Vec2 => ({ x, y });

const poly = (pts: Vec2[], layer = "corte", closed = true): Entity => ({
  id: uid(),
  layer,
  type: "polyline",
  closed,
  pts,
});

const circle = (cx: number, cy: number, r: number, layer = "corte"): Entity => ({
  id: uid(),
  layer,
  type: "circle",
  cx,
  cy,
  r,
});

const arc = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  layer = "corte",
): Entity => ({
  id: uid(),
  layer,
  type: "arc",
  cx,
  cy,
  r,
  a0,
  a1,
});

const line = (a: Vec2, b: Vec2, layer: string): Entity => ({
  id: uid(),
  layer,
  type: "line",
  x1: a.x,
  y1: a.y,
  x2: b.x,
  y2: b.y,
});

/** Linhas de centro (marcação) de um furo. */
function centerMarks(cx: number, cy: number, r: number): Entity[] {
  const e = r + 4;
  return [
    line(P(cx - e, cy), P(cx + e, cy), "referencia"),
    line(P(cx, cy - e), P(cx, cy + e), "referencia"),
  ];
}

function rect(w: number, h: number, radius = 0): Entity {
  if (radius <= 0.01) return poly([P(0, 0), P(w, 0), P(w, h), P(0, h)]);
  const r = Math.min(radius, w / 2, h / 2);
  const pts: Vec2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (Math.PI / 2) * (i / 8);
      pts.push(P(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  };
  corner(w - r, h - r, 0);
  corner(r, h - r, Math.PI / 2);
  corner(r, r, Math.PI);
  corner(w - r, r, -Math.PI / 2);
  return poly(pts);
}

/** Furos igualmente espaçados num círculo de centros. */
function boltCircle(
  cx: number,
  cy: number,
  bc: number,
  n: number,
  d: number,
  startDeg = 0,
): Entity[] {
  const out: Entity[] = [];
  const r = d / 2;
  for (let i = 0; i < n; i++) {
    const a = (startDeg * Math.PI) / 180 + (2 * Math.PI * i) / n;
    const x = cx + (bc / 2) * Math.cos(a);
    const y = cy + (bc / 2) * Math.sin(a);
    out.push(circle(x, y, r));
    out.push(...centerMarks(x, y, r));
  }
  return out;
}

/** Rasgo oblongo horizontal (dois arcos + dois trechos retos). */
function oblong(cx: number, cy: number, len: number, w: number, angleDeg = 0): Entity[] {
  const r = w / 2;
  const a = Math.max(0, len / 2 - r);
  const rad = (angleDeg * Math.PI) / 180;
  const rot = (p: Vec2): Vec2 =>
    P(
      cx + (p.x * Math.cos(rad) - p.y * Math.sin(rad)),
      cy + (p.x * Math.sin(rad) + p.y * Math.cos(rad)),
    );
  const pts: Vec2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / 16;
    pts.push(rot(P(a + r * Math.cos(t), r * Math.sin(t))));
  }
  for (let i = 0; i <= 16; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / 16;
    pts.push(rot(P(-a + r * Math.cos(t), r * Math.sin(t))));
  }
  return [poly(pts)];
}

const GENERATORS: Record<string, CncGenerator> = {
  "chapa-retangular": {
    id: "chapa-retangular",
    fields: [
      { key: "w", label: "Largura", def: 400, min: 1, max: 6000 },
      { key: "h", label: "Altura", def: 250, min: 1, max: 6000 },
      { key: "r", label: "Raio de canto", def: 0, min: 0, max: 500 },
    ],
    build: (v: Record<"w" | "h" | "r", number>) => [rect(v.w, v.h, v.r)],
  },
  "chapa-circular": {
    id: "chapa-circular",
    fields: [
      { key: "d", label: "Diâmetro", def: 300, min: 1, max: 6000 },
      { key: "dInt", label: "Furo central", def: 0, min: 0, max: 5900 },
    ],
    build: (v: Record<"d" | "dInt", number>) => {
      const r = v.d / 2;
      const out = [circle(r, r, r), ...centerMarks(r, r, r)];
      if (v.dInt > 0.5) out.push(circle(r, r, v.dInt / 2));
      return out;
    },
  },
  "chapa-triangular": {
    id: "chapa-triangular",
    fields: [
      { key: "b", label: "Base", def: 300, min: 1, max: 6000 },
      { key: "h", label: "Altura", def: 260, min: 1, max: 6000 },
    ],
    build: (v: Record<"b" | "h", number>) => [poly([P(0, 0), P(v.b, 0), P(v.b / 2, v.h)])],
  },
  "chapa-poligonal": {
    id: "chapa-poligonal",
    fields: [
      { key: "n", label: "Lados", def: 6, min: 3, max: 24, step: 1, suffix: "" },
      { key: "d", label: "Ø circunscrito", def: 300, min: 1, max: 6000 },
    ],
    build: (v: Record<"n" | "d", number>) => {
      const n = Math.round(v.n);
      const r = v.d / 2;
      const pts: Vec2[] = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        pts.push(P(r + r * Math.cos(a), r + r * Math.sin(a)));
      }
      return [poly(pts)];
    },
  },
  "furo-simples": {
    id: "furo-simples",
    fields: [{ key: "d", label: "Ø do furo", def: 20, min: 0.5, max: 2000 }],
    build: (v: Record<"d", number>) => {
      const r = v.d / 2;
      return [circle(r, r, r), ...centerMarks(r, r, r)];
    },
  },
  "matriz-furos": {
    id: "matriz-furos",
    fields: [
      { key: "w", label: "Largura da chapa", def: 400, min: 10, max: 6000 },
      { key: "h", label: "Altura da chapa", def: 300, min: 10, max: 6000 },
      { key: "cols", label: "Colunas", def: 4, min: 1, max: 60, step: 1, suffix: "" },
      { key: "rows", label: "Linhas", def: 3, min: 1, max: 60, step: 1, suffix: "" },
      { key: "d", label: "Ø do furo", def: 18, min: 0.5, max: 500 },
      { key: "borda", label: "Margem", def: 40, min: 1, max: 2000 },
    ],
    build: (v: Record<"w" | "h" | "cols" | "rows" | "d" | "borda", number>) => {
      const out: Entity[] = [rect(v.w, v.h)];
      const cols = Math.round(v.cols);
      const rows = Math.round(v.rows);
      const ux = cols > 1 ? (v.w - 2 * v.borda) / (cols - 1) : 0;
      const uy = rows > 1 ? (v.h - 2 * v.borda) / (rows - 1) : 0;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const x = cols > 1 ? v.borda + ux * i : v.w / 2;
          const y = rows > 1 ? v.borda + uy * j : v.h / 2;
          out.push(circle(x, y, v.d / 2), ...centerMarks(x, y, v.d / 2));
        }
      return out;
    },
  },
  "furacao-circular": {
    id: "furacao-circular",
    fields: [
      { key: "bc", label: "Ø círculo de furos", def: 300, min: 5, max: 6000 },
      { key: "n", label: "Nº de furos", def: 8, min: 1, max: 200, step: 1, suffix: "" },
      { key: "d", label: "Ø do furo", def: 18, min: 0.5, max: 500 },
      { key: "start", label: "Ângulo inicial", def: 0, min: -360, max: 360, suffix: "°" },
    ],
    build: (v: Record<"bc" | "n" | "d" | "start", number>) => {
      const c = v.bc / 2 + v.d;
      return [
        circle(c, c, v.bc / 2, "referencia"),
        ...boltCircle(c, c, v.bc, Math.round(v.n), v.d, v.start),
      ];
    },
  },
  "rasgo-oblongo": {
    id: "rasgo-oblongo",
    fields: [
      { key: "len", label: "Comprimento total", def: 120, min: 2, max: 4000 },
      { key: "w", label: "Largura", def: 20, min: 1, max: 2000 },
      { key: "ang", label: "Ângulo", def: 0, min: -180, max: 180, suffix: "°" },
    ],
    build: (v: Record<"len" | "w" | "ang", number>) =>
      oblong(v.len / 2, v.w / 2 + 5, v.len, Math.min(v.w, v.len), v.ang),
  },
  slot: {
    id: "slot",
    fields: [
      { key: "w", label: "Largura da chapa", def: 300, min: 10, max: 6000 },
      { key: "h", label: "Altura da chapa", def: 160, min: 10, max: 6000 },
      { key: "len", label: "Comprimento do slot", def: 160, min: 2, max: 6000 },
      { key: "sw", label: "Largura do slot", def: 24, min: 1, max: 2000 },
    ],
    build: (v: Record<"w" | "h" | "len" | "sw", number>) => [
      rect(v.w, v.h),
      ...oblong(v.w / 2, v.h / 2, Math.min(v.len, v.w - 10), v.sw),
    ],
  },
  "suporte-l": {
    id: "suporte-l",
    fields: [
      { key: "a", label: "Aba A", def: 200, min: 10, max: 4000 },
      { key: "b", label: "Aba B", def: 140, min: 10, max: 4000 },
      { key: "t", label: "Largura da aba", def: 60, min: 5, max: 2000 },
      { key: "d", label: "Ø dos furos", def: 12, min: 0, max: 400 },
    ],
    build: (v: Record<"a" | "b" | "t" | "d", number>) => {
      const out: Entity[] = [
        poly([P(0, 0), P(v.a, 0), P(v.a, v.t), P(v.t, v.t), P(v.t, v.b), P(0, v.b)]),
      ];
      if (v.d > 0.5) {
        const h1 = P(v.a - v.t / 2, v.t / 2);
        const h2 = P(v.t / 2, v.b - v.t / 2);
        for (const h of [h1, h2])
          out.push(circle(h.x, h.y, v.d / 2), ...centerMarks(h.x, h.y, v.d / 2));
      }
      return out;
    },
  },
  "suporte-u": {
    id: "suporte-u",
    fields: [
      { key: "w", label: "Largura total", def: 240, min: 20, max: 4000 },
      { key: "h", label: "Altura das abas", def: 120, min: 10, max: 4000 },
      { key: "t", label: "Largura da aba", def: 50, min: 5, max: 2000 },
    ],
    build: (v: Record<"w" | "h" | "t", number>) => [
      poly([
        P(0, 0),
        P(v.w, 0),
        P(v.w, v.h),
        P(v.w - v.t, v.h),
        P(v.w - v.t, v.t),
        P(v.t, v.t),
        P(v.t, v.h),
        P(0, v.h),
      ]),
    ],
  },
  esquadro: {
    id: "esquadro",
    fields: [
      { key: "a", label: "Cateto A", def: 200, min: 10, max: 4000 },
      { key: "b", label: "Cateto B", def: 200, min: 10, max: 4000 },
      { key: "r", label: "Alívio no vértice", def: 20, min: 0, max: 500 },
    ],
    build: (v: Record<"a" | "b" | "r", number>) => {
      const out: Entity[] = [poly([P(0, 0), P(v.a, 0), P(0, v.b)])];
      if (v.r > 0.5) out.push(arc(v.r * 1.6, v.r * 1.6, v.r, 0, Math.PI * 2));
      return out;
    },
  },
  "base-furada": {
    id: "base-furada",
    fields: [
      { key: "w", label: "Largura", def: 260, min: 20, max: 4000 },
      { key: "h", label: "Profundidade", def: 180, min: 20, max: 4000 },
      { key: "d", label: "Ø dos furos", def: 16, min: 1, max: 400 },
      { key: "borda", label: "Distância da borda", def: 30, min: 2, max: 1000 },
      { key: "r", label: "Raio de canto", def: 15, min: 0, max: 500 },
    ],
    build: (v: Record<"w" | "h" | "d" | "borda" | "r", number>) => {
      const out: Entity[] = [rect(v.w, v.h, v.r)];
      const pts = [
        P(v.borda, v.borda),
        P(v.w - v.borda, v.borda),
        P(v.w - v.borda, v.h - v.borda),
        P(v.borda, v.h - v.borda),
      ];
      for (const p of pts) out.push(circle(p.x, p.y, v.d / 2), ...centerMarks(p.x, p.y, v.d / 2));
      return out;
    },
  },
  "flange-circular-cnc": {
    id: "flange-circular-cnc",
    fields: [
      { key: "de", label: "Ø externo", def: 500, min: 10, max: 6000 },
      { key: "di", label: "Ø interno", def: 300, min: 0, max: 5900 },
      { key: "bc", label: "Ø círculo de furos", def: 420, min: 0, max: 5900 },
      { key: "n", label: "Nº de furos", def: 8, min: 0, max: 200, step: 1, suffix: "" },
      { key: "d", label: "Ø do furo", def: 22, min: 1, max: 500, when: (v) => (v["n"] ?? 0) > 0 },
      { key: "start", label: "Ângulo inicial", def: 22.5, min: -360, max: 360, suffix: "°" },
    ],
    build: (v: Record<"de" | "di" | "bc" | "n" | "d" | "start", number>) => {
      const c = v.de / 2;
      const out: Entity[] = [circle(c, c, v.de / 2), ...centerMarks(c, c, v.de / 2)];
      if (v.di > 0.5) out.push(circle(c, c, v.di / 2));
      if (v.n >= 1 && v.bc > 0.5) {
        out.push(circle(c, c, v.bc / 2, "referencia"));
        out.push(...boltCircle(c, c, v.bc, Math.round(v.n), v.d, v.start));
      }
      return out;
    },
  },
  "flange-retangular-cnc": {
    id: "flange-retangular-cnc",
    fields: [
      { key: "w", label: "Largura", def: 400, min: 20, max: 6000 },
      { key: "h", label: "Altura", def: 300, min: 20, max: 6000 },
      { key: "di", label: "Ø da passagem", def: 200, min: 0, max: 5900 },
      { key: "d", label: "Ø dos furos", def: 18, min: 0, max: 400 },
      { key: "borda", label: "Distância da borda", def: 30, min: 2, max: 1000 },
      { key: "r", label: "Raio de canto", def: 12, min: 0, max: 500 },
    ],
    build: (v: Record<"w" | "h" | "di" | "d" | "borda" | "r", number>) => {
      const out: Entity[] = [rect(v.w, v.h, v.r)];
      if (v.di > 0.5)
        out.push(circle(v.w / 2, v.h / 2, v.di / 2), ...centerMarks(v.w / 2, v.h / 2, v.di / 2));
      if (v.d > 0.5)
        for (const p of [
          P(v.borda, v.borda),
          P(v.w - v.borda, v.borda),
          P(v.w - v.borda, v.h - v.borda),
          P(v.borda, v.h - v.borda),
        ])
          out.push(circle(p.x, p.y, v.d / 2), ...centerMarks(p.x, p.y, v.d / 2));
      return out;
    },
  },
  "flange-oval": {
    id: "flange-oval",
    fields: [
      { key: "len", label: "Comprimento", def: 420, min: 20, max: 6000 },
      { key: "w", label: "Largura", def: 220, min: 10, max: 6000 },
      { key: "di", label: "Ø da passagem", def: 140, min: 0, max: 5900 },
      { key: "d", label: "Ø dos furos", def: 18, min: 0, max: 400 },
      { key: "ec", label: "Entre centros dos furos", def: 320, min: 0, max: 6000 },
    ],
    build: (v: Record<"len" | "w" | "di" | "d" | "ec", number>) => {
      const cx = v.len / 2;
      const cy = v.w / 2;
      const out = oblong(cx, cy, v.len, v.w);
      if (v.di > 0.5) out.push(circle(cx, cy, v.di / 2), ...centerMarks(cx, cy, v.di / 2));
      if (v.d > 0.5 && v.ec > 0.5)
        for (const x of [cx - v.ec / 2, cx + v.ec / 2])
          out.push(circle(x, cy, v.d / 2), ...centerMarks(x, cy, v.d / 2));
      return out;
    },
  },
};

export function getGenerator(id: string): CncGenerator | null {
  return GENERATORS[id] ?? null;
}

export function defaultValues(g: CncGenerator): Record<string, number> {
  return Object.fromEntries(g.fields.map((f) => [f.key, f.def]));
}

export function visibleFields(g: CncGenerator, v: Record<string, number>): CncField[] {
  return g.fields.filter((f) => !f.when || f.when(v));
}
