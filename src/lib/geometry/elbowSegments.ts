/**
 * CURVA DE GOMOS — DECOMPOSIÇÃO EM PEÇAS REAIS (módulo puro)
 *
 * Um único modelo paramétrico: diâmetro, raio, ângulo total, quantidade de
 * gomos e espessura. A quantidade de gomos é PARÂMETRO.
 *
 * Convenção preservada do motor de cálculo existente:
 *
 *   β = α / (2·(n−1) + 2) = α / (2n)        meio-ângulo de corte
 *
 * Com essa convenção existem n juntas soldadas e n+1 peças físicas:
 * duas pontas (meio gomo, comprimento R·tgβ no eixo) e n−1 gomos
 * intermediários (comprimento 2·R·tgβ). Quantidade de gomos ≠ quantidade de
 * peças físicas — cada peça é uma entidade com código, posição e geometria.
 */

import type { DevelopmentPattern, Segment2, Vec2, Vec3 } from "./types";

const TAU = Math.PI * 2;

export type ElbowInput = {
  /** Diâmetro do tubo (mm). */
  diameter: number;
  /** Raio da curva na linha de centro (mm). */
  radius: number;
  /** Ângulo total da curva (graus). */
  angleDeg: number;
  /** Quantidade de gomos (parâmetro). */
  gores: number;
  /** Divisões do perímetro. */
  divisions: number;
};

export type ElbowSegment = {
  /** Índice da peça física (0 = primeira ponta). */
  index: number;
  /** Código da peça, ex.: "G1". */
  code: string;
  name: string;
  /** Peça de ponta (meio gomo) ou gomo inteiro. */
  kind: "ponta" | "gomo";
  /** Meio-ângulo de corte em cada extremidade (rad); 0 = corte reto. */
  cut: { start: number; end: number };
  /** Comprimento na linha de centro (mm). */
  centerLength: number;
  /** Geratriz máxima e mínima (mm). */
  maxLength: number;
  minLength: number;
  /** Eixo da peça montada (mm), na linha de centro da curva. */
  axis: { from: Vec3; to: Vec3 };
  /** Direção do eixo, em graus a partir do início da curva. */
  rotationDeg: number;
  /** Planificação da peça. */
  development: DevelopmentPattern;
  trueLengths: { id: string; length: number }[];
};

export type ElbowModel = {
  /** Meio-ângulo de corte (rad). */
  beta: number;
  /** Peças físicas (2 pontas + n−1 gomos). */
  segments: ElbowSegment[];
  /** Linha de centro da curva (polilinha das juntas). */
  centerline: Vec3[];
  /** Comprimento desenvolvido total na linha de centro (mm). */
  developedLength: number;
};

function boundsOf(pts: Vec2[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** Desenvolvimento de um cilindro cortado nas duas pontas. */
function goreDevelopment(
  D: number,
  n: number,
  top: (t: number) => number,
  bottom: (t: number) => number,
) {
  const r = D / 2;
  const topPts: Vec2[] = [];
  const botPts: Vec2[] = [];
  const folds: Segment2[] = [];
  const trueLengths: { id: string; length: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const x = r * t;
    const yt = top(t);
    const yb = bottom(t);
    topPts.push({ x, y: yt });
    botPts.push({ x, y: yb });
    folds.push({ a: { x, y: yb }, b: { x, y: yt } });
    trueLengths.push({ id: `O${i}`, length: yt - yb });
  }
  const outline = [...botPts, ...topPts.slice().reverse()];
  const step = Math.max(1, Math.round(n / 8));
  const development: DevelopmentPattern = {
    outline,
    foldLines: folds,
    points: topPts.filter((_, i) => i % step === 0).map((p, i) => ({ id: `P${i}`, p })),
    bounds: boundsOf(outline),
  };
  return { development, trueLengths };
}

export function elbowModel(i: ElbowInput): ElbowModel {
  const D = i.diameter;
  const r = D / 2;
  const R = i.radius;
  const g = Math.max(2, Math.round(i.gores));
  const n = Math.max(8, Math.round(i.divisions));
  const total = (i.angleDeg * Math.PI) / 180;
  const beta = total / (2 * (g - 1) + 2);
  const tb = Math.tan(beta);
  const Lend = R * tb;
  const Lmid = 2 * R * tb;

  /* Linha de centro: arco de raio R percorrido em g juntas de 2β. */
  const centerline: Vec3[] = [];
  const pieces = g + 1;
  let pos: Vec3 = { x: 0, y: 0, z: 0 };
  let dir = 0;
  centerline.push(pos);
  const segments: ElbowSegment[] = [];
  for (let k = 0; k < pieces; k++) {
    const isStart = k === 0;
    const isEnd = k === pieces - 1;
    const kind: "ponta" | "gomo" = isStart || isEnd ? "ponta" : "gomo";
    const len = kind === "ponta" ? Lend : Lmid;
    const from = pos;
    const to: Vec3 = { x: pos.x + len * Math.cos(dir), y: pos.y + len * Math.sin(dir), z: 0 };

    const cutStart = isStart ? 0 : beta;
    const cutEnd = isEnd ? 0 : beta;
    const topF = (t: number) => len / 2 + (cutEnd ? r * Math.cos(t) * Math.tan(cutEnd) : 0);
    const botF = (t: number) => -len / 2 - (cutStart ? r * Math.cos(t) * Math.tan(cutStart) : 0);
    const dev = goreDevelopment(D, n, topF, botF);
    const lens = dev.trueLengths.map((l) => l.length);

    segments.push({
      index: k,
      code: `G${k + 1}`,
      name: kind === "ponta" ? `Ponta ${isStart ? "A" : "B"}` : `Gomo ${k}`,
      kind,
      cut: { start: cutStart, end: cutEnd },
      centerLength: len,
      maxLength: Math.max(...lens),
      minLength: Math.min(...lens),
      axis: { from, to },
      rotationDeg: (dir * 180) / Math.PI,
      development: dev.development,
      trueLengths: dev.trueLengths,
    });

    pos = to;
    centerline.push(pos);
    dir += 2 * beta;
  }

  const developedLength = segments.reduce((s, x) => s + x.centerLength, 0);
  return { beta, segments, centerline, developedLength };
}

/** Agrupamento para lista de corte: peças iguais somam quantidade. */
export function elbowCutList(model: ElbowModel) {
  const ends = model.segments.filter((s) => s.kind === "ponta");
  const mids = model.segments.filter((s) => s.kind === "gomo");
  const rows: { code: string; name: string; quantity: number; centerLength: number }[] = [];
  if (ends.length)
    rows.push({
      code: "PT",
      name: "Ponta (meio gomo)",
      quantity: ends.length,
      centerLength: ends[0]!.centerLength,
    });
  if (mids.length)
    rows.push({
      code: "GM",
      name: "Gomo intermediário",
      quantity: mids.length,
      centerLength: mids[0]!.centerLength,
    });
  return rows;
}
