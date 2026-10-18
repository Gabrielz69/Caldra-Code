/**
 * MOTORES DE CÁLCULO — CALDRA
 *
 * Cada geometria do catálogo tem um motor com:
 *  - campos de entrada (mm / un / graus),
 *  - validação,
 *  - cálculo real do desenvolvimento (planificação) em milímetros,
 *  - métricas, comprimentos verdadeiros e passos pedagógicos.
 *
 * Famílias de método:
 *  - Desenvolvimento direto (cilindros e cortes oblíquos),
 *  - Radial (cones, troncos, reduções),
 *  - Triangulação (transições quadrado/redondo e cones excêntricos),
 *  - Gomos (calotas esféricas e curvas segmentadas),
 *  - Divisão angular (flanges).
 */

import type { WireParams } from "@/lib/viz3d/wire";
import type {
  CalcStep,
  DevelopmentPattern,
  GeometryPiece,
  GeometryResult,
  MetricRow,
  Segment2,
  ValidationIssue,
  Vec2,
} from "./types";
import {
  SQUARE_TO_ROUND_DEFAULTS,
  calculateSquareToRound,
  validateSquareToRound,
  type SquareToRoundInput,
} from "./squareToRound";
import {
  branchDevelopments,
  branchIntersection,
  branchSteps,
  validateBranch,
  type BranchInput,
} from "./branch";
import { elbowModel, type ElbowInput } from "./elbowSegments";

export type EngineValues = Record<string, number>;

export type EngineField = {
  key: string;
  label: string;
  tag: string;
  unit?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Campo de escolha (o valor continua numérico). */
  options?: { value: number; label: string }[];
  /** Campo só aparece/valida quando a condição é verdadeira. */
  visibleIf?: (v: EngineValues) => boolean;
};

export type Engine = {
  slug: string;
  method: string;
  fields: EngineField[];
  defaults: EngineValues;
  /** Parâmetros para as vistas técnicas e o sólido 3D. */
  wire: (v: EngineValues) => WireParams;
  /** Mapa campo → cota destacada nas vistas. */
  dimKey: (key: string) => keyof WireParams | null;
  validate: (v: EngineValues) => ValidationIssue[];
  calculate: (v: EngineValues) => GeometryResult;
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const d2 = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

function polygonArea(points: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

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

function pattern(
  outline: Vec2[],
  foldLines: Segment2[] = [],
  points: { id: string; p: Vec2 }[] = [],
): DevelopmentPattern {
  return { outline, foldLines, points, bounds: boundsOf(outline) };
}

/** Métricas comuns a todos os motores + massa. */
function finalize(args: {
  v: EngineValues;
  method: string;
  development: DevelopmentPattern;
  trueLengths: { id: string; length: number }[];
  metrics: MetricRow[];
  steps: CalcStep[];
  warnings?: string[];
  areaMm2?: number;
  pieces?: GeometryPiece[];
}): GeometryResult {
  const { v, development } = args;
  const areaMm2 = args.areaMm2 ?? polygonArea(development.outline);
  const thickness = v["thickness"] ?? 3;
  const density = v["density"] ?? 7.85;
  const massKg = (areaMm2 * thickness * density) / 1_000_000_000;
  const b = development.bounds;
  const perimeter = development.outline.reduce(
    (acc, p, i) => acc + d2(p, development.outline[(i + 1) % development.outline.length]!),
    0,
  );

  const metrics: MetricRow[] = [
    ...args.metrics,
    { label: "Largura da planificação", value: b.maxX - b.minX, unitMm: true },
    { label: "Altura da planificação", value: b.maxY - b.minY, unitMm: true },
    { label: "Contorno do desenvolvimento", value: perimeter, unitMm: true },
    { label: "Área desenvolvida", value: areaMm2 / 1_000_000, suffix: "m²" },
    { label: "Massa estimada", value: massKg, suffix: "kg" },
  ];

  const steps: CalcStep[] = [
    ...args.steps,
    {
      title: "De onde vem a massa?",
      given: `Área = ${(areaMm2 / 1_000_000).toFixed(4)} m², e = ${thickness} mm, ρ = ${density} kg/dm³`,
      formula: "m = A × e × ρ",
      substitution: `m = ${(areaMm2 / 1_000_000).toFixed(4)} × ${(thickness / 1000).toFixed(4)} × ${(density * 1000).toFixed(0)}`,
      result: `m = ${massKg.toFixed(2)} kg`,
      meaning:
        "Massa da chapa planificada, sem descontar recortes internos nem sobremetal de solda.",
    },
  ];

  return {
    metrics,
    trueLengths: args.trueLengths,
    development,
    steps,
    areaMm2,
    method: args.method,
    warnings: args.warnings ?? [
      "O desenvolvimento é da superfície média; descontos de dobra não estão aplicados.",
    ],
    ...(args.pieces ? { pieces: args.pieces } : {}),
  };
}

const common: EngineField[] = [];

function baseValidate(fields: EngineField[], v: EngineValues): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const f of fields) {
    if (f.visibleIf && !f.visibleIf(v)) continue;
    if (f.options) continue;
    const value = v[f.key] ?? 0;

    const min = f.min ?? 0.001;
    const max = f.max ?? Infinity;
    if (!Number.isFinite(value) || value < min)
      issues.push({ field: f.key, message: `${f.label} deve ser ≥ ${min}.` });
    else if (value > max) issues.push({ field: f.key, message: `${f.label} deve ser ≤ ${max}.` });
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Família A — cilindro / cortes oblíquos                              */
/* ------------------------------------------------------------------ */

/**
 * Desenvolvimento de um cilindro de diâmetro D, com curva de corte
 * superior f(θ) e inferior g(θ) (mm). x = R·θ (comprimento verdadeiro do arco).
 */
function cylinderDevelopment(
  D: number,
  n: number,
  top: (t: number) => number,
  bottom: (t: number) => number = () => 0,
) {
  const R = D / 2;
  const topPts: Vec2[] = [];
  const botPts: Vec2[] = [];
  const folds: Segment2[] = [];
  const trueLengths: { id: string; length: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU;
    const x = R * t;
    const yt = top(t);
    const yb = bottom(t);
    topPts.push({ x, y: yt });
    botPts.push({ x, y: yb });
    folds.push({ a: { x, y: yb }, b: { x, y: yt } });
    trueLengths.push({ id: `O${i}`, length: yt - yb });
  }
  const outline = [...botPts, ...topPts.slice().reverse()];
  return {
    development: pattern(
      outline,
      folds,
      topPts
        .filter((_, i) => i % Math.max(1, Math.round(n / 8)) === 0)
        .map((p, i) => ({
          id: `P${i}`,
          p,
        })),
    ),
    trueLengths,
    circumference: Math.PI * D,
  };
}

/* ------------------------------------------------------------------ */
/* Família B — radial (cone / tronco)                                  */
/* ------------------------------------------------------------------ */

function sectorDevelopment(Dbig: number, Dsmall: number, H: number, n: number) {
  const r1 = Dbig / 2;
  const r2 = Dsmall / 2;
  const slant = Math.hypot(r1 - r2, H);
  // Raio de desenvolvimento da base maior (ápice virtual).
  const Rbig = r1 === r2 ? Infinity : (slant * r1) / (r1 - r2);
  const Rsmall = Rbig === Infinity ? Infinity : Rbig - slant;

  if (!Number.isFinite(Rbig)) {
    // cilindro degenerado
    const dev = cylinderDevelopment(Dbig, n, () => H);
    return { ...dev, slant, Rbig, Rsmall, theta: 0 };
  }

  const theta = (TAU * r1) / Rbig; // ângulo do setor
  const outer: Vec2[] = [];
  const inner: Vec2[] = [];
  const folds: Segment2[] = [];
  const trueLengths: { id: string; length: number }[] = [];
  const start = -Math.PI / 2 - theta / 2;
  for (let i = 0; i <= n; i++) {
    const a = start + (theta * i) / n;
    const po = { x: Rbig * Math.cos(a), y: Rbig * Math.sin(a) };
    const pi = { x: Rsmall * Math.cos(a), y: Rsmall * Math.sin(a) };
    outer.push(po);
    inner.push(pi);
    folds.push({ a: pi, b: po });
    trueLengths.push({ id: `G${i}`, length: slant });
  }
  const outline = [...outer, ...inner.slice().reverse()];
  return {
    development: pattern(outline, folds, [
      { id: "A", p: outer[0]! },
      { id: "B", p: outer[outer.length - 1]! },
    ]),
    trueLengths,
    slant,
    Rbig,
    Rsmall,
    theta,
  };
}

/* ------------------------------------------------------------------ */
/* Motores                                                             */
/* ------------------------------------------------------------------ */

const F = {
  thickness: { key: "thickness", label: "Espessura", tag: "e", min: 0.1, max: 100 },
  density: { key: "density", label: "Densidade", tag: "ρ", unit: "kg/dm³", min: 0.5, max: 25 },
} satisfies Record<string, EngineField>;

function cylinderEngine(slug: string, labelD = "Diâmetro", labelH = "Altura"): Engine {
  const fields: EngineField[] = [
    { key: "d", label: labelD, tag: "ØD", min: 10, max: 5000 },
    { key: "h", label: labelH, tag: "H", min: 10, max: 6000 },
  ];
  return {
    slug,
    method: "Desenvolvimento direto — retângulo πD × H",
    fields,
    defaults: { d: 400, h: 600, divisions: 12, thickness: 3, density: 7.85 },
    wire: (v) => ({ d1: v["d"]!, d2: v["d"]!, h: v["h"]!, e: 0, seg: 32 }),
    dimKey: (k) => (k === "d" ? "d1" : k === "h" ? "h" : null),
    validate: (v) => baseValidate(fields, v),
    calculate: (v) => {
      const D = v["d"]!;
      const H = v["h"]!;
      const n = Math.max(4, Math.round(v["divisions"] ?? 12) * 2);
      const dev = cylinderDevelopment(D, n, () => H);
      return finalize({
        v,
        method: "Desenvolvimento direto — retângulo πD × H",
        development: dev.development,
        trueLengths: dev.trueLengths,
        metrics: [
          { label: "Perímetro", value: Math.PI * D, unitMm: true },
          { label: "Altura", value: H, unitMm: true },
          {
            label: "Volume interno",
            value: (Math.PI * D * D * H) / 4 / 1_000_000_000,
            suffix: "m³",
          },
        ],
        steps: [
          {
            title: "Como se planifica um cilindro?",
            given: `Ø = ${D} mm`,
            formula: "L = π × D",
            substitution: `L = 3,141592 × ${D}`,
            result: `L = ${(Math.PI * D).toFixed(2)} mm`,
            meaning:
              "A superfície lateral do cilindro é desenvolvível: abre-se como um retângulo cujo comprimento é a circunferência média.",
          },
          {
            title: "Qual é a altura do desenvolvimento?",
            given: `H = ${H} mm`,
            formula: "Altura do retângulo = H",
            substitution: `${H} mm`,
            result: `${H} mm`,
            meaning: "Não há inclinação: cada geratriz tem o mesmo comprimento verdadeiro.",
          },
        ],
      });
    },
  };
}

function radialEngine(
  slug: string,
  opts: { topZero?: boolean; labels?: [string, string, string] },
): Engine {
  const [l1, l2, l3] = opts.labels ?? ["Diâmetro maior", "Diâmetro menor", "Altura vertical"];
  const fields: EngineField[] = opts.topZero
    ? [
        { key: "d1", label: l1, tag: "ØD", min: 10, max: 5000 },
        { key: "h", label: l3, tag: "H", min: 10, max: 6000 },
      ]
    : [
        { key: "d1", label: l1, tag: "ØD", min: 10, max: 5000 },
        { key: "d2", label: l2, tag: "Ød", min: 1, max: 5000 },
        { key: "h", label: l3, tag: "H", min: 10, max: 6000 },
      ];
  return {
    slug,
    method: "Radial — setor circular por geratriz verdadeira",
    fields,
    defaults: { d1: 500, d2: 250, h: 420, divisions: 12, thickness: 3, density: 7.85 },
    wire: (v) => ({ d1: v["d1"]!, d2: opts.topZero ? 0 : v["d2"]!, h: v["h"]!, e: 0, seg: 32 }),
    dimKey: (k) => (k === "d1" ? "d1" : k === "d2" ? "d2" : k === "h" ? "h" : null),
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if (!opts.topZero && (v["d2"] ?? 0) >= (v["d1"] ?? 0))
        issues.push({ field: "d2", message: "O diâmetro menor deve ser inferior ao maior." });
      return issues;
    },
    calculate: (v) => {
      const D = v["d1"]!;
      const d = opts.topZero ? 0 : v["d2"]!;
      const H = v["h"]!;
      const n = Math.max(8, Math.round(v["divisions"] ?? 12) * 4);
      const s = sectorDevelopment(D, d, H, n);
      return finalize({
        v,
        method: "Radial — setor circular por geratriz verdadeira",
        development: s.development,
        trueLengths: s.trueLengths,
        metrics: [
          { label: "Perímetro maior", value: Math.PI * D, unitMm: true },
          { label: "Perímetro menor", value: Math.PI * d, unitMm: true },
          { label: "Geratriz verdadeira", value: s.slant, unitMm: true },
          { label: "Raio de traçado maior", value: s.Rbig, unitMm: true },
          { label: "Raio de traçado menor", value: s.Rsmall, unitMm: true },
          { label: "Ângulo do setor", value: (s.theta * 180) / Math.PI, suffix: "°" },
        ],
        steps: [
          {
            title: "Como se obtém a geratriz?",
            given: `Ø${D} → Ø${d}, H = ${H} mm`,
            formula: "g = √( ((D − d)/2)² + H² )",
            substitution: `g = √( ${((D - d) / 2).toFixed(1)}² + ${H}² )`,
            result: `g = ${s.slant.toFixed(2)} mm`,
            meaning:
              "A geratriz é o comprimento verdadeiro do lado inclinado — nunca use a altura vertical para traçar o setor.",
          },
          {
            title: "Onde fica o ápice do traçado?",
            given: `g = ${s.slant.toFixed(2)} mm`,
            formula: "R = g × D / (D − d)",
            substitution: `R = ${s.slant.toFixed(2)} × ${D} / ${(D - d).toFixed(1)}`,
            result: `R = ${s.Rbig.toFixed(2)} mm · r = ${s.Rsmall.toFixed(2)} mm`,
            meaning:
              "Os dois raios definem a coroa do desenvolvimento: o ápice virtual do cone é o centro do compasso.",
          },
          {
            title: "Qual é a abertura do setor?",
            given: `R = ${s.Rbig.toFixed(2)} mm`,
            formula: "α = 360° × (D/2) / R",
            substitution: `α = 360 × ${(D / 2).toFixed(1)} / ${s.Rbig.toFixed(2)}`,
            result: `α = ${((s.theta * 180) / Math.PI).toFixed(2)}°`,
            meaning:
              "O arco externo do setor tem exatamente o comprimento da circunferência da boca maior.",
          },
        ],
      });
    },
  };
}

/**
 * BOCA DE LOBO — MODELO PARAMÉTRICO ÚNICO.
 *
 * Um só modelo cobre todos os casos: o ângulo, os diâmetros, a
 * excentricidade e o comprimento são parâmetros livres. 30°, 45°, 60° e 90°
 * são valores, não modelos diferentes.
 *
 *  - Método "corte oblíquo": cilindro cortado por um plano (h₁ → h₂).
 *  - Método "boca em tubo": interseção real cilindro/cilindro, calculada
 *    geometricamente em `./branch` (nunca aproximada por desenho).
 */
function obliqueEngine(slug: string): Engine {
  const isBranch = (v: EngineValues) => Math.round(v["metodo"] ?? 1) === 1;
  const fields: EngineField[] = [
    {
      key: "metodo",
      label: "Método",
      tag: "M",
      options: [
        { value: 0, label: "Corte oblíquo" },
        { value: 1, label: "Boca em tubo" },
      ],
    },
    { key: "d", label: "Ø da derivação", tag: "Ød", min: 10, max: 3000 },
    {
      key: "h1",
      label: "Altura menor",
      tag: "h₁",
      min: 5,
      max: 6000,
      visibleIf: (v) => !isBranch(v),
    },
    {
      key: "h2",
      label: "Altura maior",
      tag: "h₂",
      min: 5,
      max: 6000,
      visibleIf: (v) => !isBranch(v),
    },
    { key: "dMain", label: "Ø tubo principal", tag: "ØD", min: 20, max: 4000, visibleIf: isBranch },
    {
      key: "ang",
      label: "Ângulo da derivação",
      tag: "α",
      unit: "°",
      min: 10,
      max: 90,
      visibleIf: isBranch,
    },
    {
      key: "offset",
      label: "Excentricidade",
      tag: "e",
      min: -2000,
      max: 2000,
      visibleIf: isBranch,
    },
    {
      key: "len",
      label: "Comprimento do ramal",
      tag: "L",
      min: 20,
      max: 8000,
      visibleIf: isBranch,
    },
  ];
  const toBranch = (v: EngineValues): BranchInput => ({
    mainDiameter: v["dMain"] ?? 500,
    branchDiameter: v["d"] ?? 250,
    angleDeg: v["ang"] ?? 90,
    offset: v["offset"] ?? 0,
    branchLength: v["len"] ?? 400,
    divisions: Math.max(8, Math.round(v["divisions"] ?? 12) * 2),
  });
  return {
    slug,
    method: "Boca de lobo — interseção cilindro/cilindro por ordenadas",
    fields,
    defaults: {
      metodo: 1,
      d: 250,
      h1: 200,
      h2: 520,
      dMain: 500,
      ang: 90,
      offset: 0,
      len: 400,
      divisions: 12,
      thickness: 3,
      density: 7.85,
    },
    wire: (v) =>
      isBranch(v)
        ? {
            d1: v["dMain"] ?? 500,
            d2: v["d"] ?? 250,
            h: v["len"] ?? 400,
            e: v["offset"] ?? 0,
            seg: 40,
            ang: v["ang"] ?? 90,
            mode: "branch",
          }
        : { d1: v["d"]!, d2: v["d"]!, h: v["h2"]!, e: 0, seg: 32, mode: "oblique" },
    dimKey: (k) =>
      k === "dMain"
        ? "d1"
        : k === "d"
          ? "d2"
          : k === "len" || k === "h2"
            ? "h"
            : k === "h1"
              ? "d2"
              : null,
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if (isBranch(v)) {
        for (const e of validateBranch(toBranch(v))) issues.push(e);
        const t = branchIntersection(toBranch(v));
        if ((v["len"] ?? 0) <= t.tMax)
          issues.push({
            field: "len",
            message: "O ramal precisa ser mais longo que a penetração.",
          });
      } else if ((v["h2"] ?? 0) <= (v["h1"] ?? 0)) {
        issues.push({ field: "h2", message: "A altura maior deve superar a altura menor." });
      }
      return issues;
    },
    calculate: (v) => {
      if (!isBranch(v)) {
        const D = v["d"]!;
        const h1 = v["h1"]!;
        const h2 = v["h2"]!;
        const n = Math.max(8, Math.round(v["divisions"] ?? 12) * 2);
        const mid = (h1 + h2) / 2;
        const amp = (h2 - h1) / 2;
        const dev = cylinderDevelopment(D, n, (t) => mid + amp * Math.cos(t));
        const angle = (Math.atan2(h2 - h1, D) * 180) / Math.PI;
        return finalize({
          v,
          method: "Corte oblíquo — desenvolvimento por ordenadas",
          development: dev.development,
          trueLengths: dev.trueLengths,
          metrics: [
            { label: "Perímetro", value: Math.PI * D, unitMm: true },
            { label: "Altura média", value: mid, unitMm: true },
            { label: "Inclinação do corte", value: angle, suffix: "°" },
            { label: "Ordenadas geradas", value: n, suffix: "un" },
          ],
          steps: [
            {
              title: "Por que ordenadas?",
              given: `${n} divisões do perímetro`,
              formula: "y(θ) = (h₁+h₂)/2 + ((h₂−h₁)/2)·cos θ",
              substitution: `y(θ) = ${mid.toFixed(1)} + ${amp.toFixed(1)}·cos θ`,
              result: `y varia de ${h1} a ${h2} mm`,
              meaning:
                "O plano inclinado corta o cilindro numa elipse; ao abrir a chapa ela vira uma senóide — cada ordenada é uma geratriz verdadeira.",
            },
            {
              title: "Qual é a inclinação real?",
              given: `Δh = ${(h2 - h1).toFixed(1)} mm, Ø = ${D} mm`,
              formula: "α = arctg(Δh / D)",
              substitution: `α = arctg(${(h2 - h1).toFixed(1)} / ${D})`,
              result: `α = ${angle.toFixed(2)}°`,
              meaning: "Ângulo do plano de corte em relação à seção reta do tubo.",
            },
          ],
        });
      }

      const input = toBranch(v);
      const model = branchIntersection(input);
      const dev = branchDevelopments(input, model);
      const pieces: GeometryPiece[] = [
        {
          code: "RAM",
          name: "Derivação (ramal)",
          quantity: 1,
          development: dev.branch,
          metrics: [
            { label: "Comprimento máximo", value: input.branchLength - model.tMin, unitMm: true },
            { label: "Comprimento mínimo", value: input.branchLength - model.tMax, unitMm: true },
          ],
        },
        {
          code: "FUR",
          name: "Furo no tubo principal",
          quantity: 1,
          development: dev.hole,
          metrics: [
            {
              label: "Largura do furo",
              value: dev.hole.bounds.maxX - dev.hole.bounds.minX,
              unitMm: true,
            },
          ],
        },
      ];
      return finalize({
        v,
        method: "Boca de lobo — interseção cilindro/cilindro por ordenadas",
        development: dev.branch,
        trueLengths: dev.trueLengths,
        pieces,
        metrics: [
          { label: "Perímetro da derivação", value: Math.PI * input.branchDiameter, unitMm: true },
          { label: "Penetração máxima", value: model.tMax, unitMm: true },
          { label: "Penetração mínima", value: model.tMin, unitMm: true },
          { label: "Altura útil mínima", value: input.branchLength - model.tMax, unitMm: true },
          { label: "Ângulo da derivação", value: input.angleDeg, suffix: "°" },
          { label: "Excentricidade", value: input.offset, unitMm: true },
        ],
        steps: branchSteps(input, model),
        warnings: [
          "A planificação do ramal é da superfície média; o furo do tubo é gabarito de traçado.",
        ],
      });
    },
  };
}

/** Derivação cilíndrica sobre tubo principal (tê, interseções, Y). */
function branchEngine(slug: string, withAngle: boolean): Engine {
  const fields: EngineField[] = [
    { key: "d1", label: "Ø tubo principal", tag: "ØD", min: 20, max: 4000 },
    { key: "d2", label: "Ø derivação", tag: "Ød", min: 10, max: 4000 },
    { key: "h", label: "Altura da derivação", tag: "H", min: 20, max: 6000 },
    ...(withAngle
      ? [{ key: "ang", label: "Ângulo do ramal", tag: "α", unit: "°", min: 15, max: 90 }]
      : []),
  ];
  return {
    slug,
    method: "Interseção — linha de penetração por ordenadas",
    fields,
    defaults: { d1: 500, d2: 250, h: 400, ang: 45, divisions: 12, thickness: 3, density: 7.85 },
    wire: (v) => ({ d1: v["d1"]!, d2: v["d2"]!, h: v["h"]!, e: 0, seg: 32 }),
    dimKey: (k) => (k === "d1" ? "d1" : k === "d2" ? "d2" : k === "h" ? "h" : null),
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if ((v["d2"] ?? 0) > (v["d1"] ?? 0))
        issues.push({ field: "d2", message: "A derivação não pode exceder o tubo principal." });
      return issues;
    },
    calculate: (v) => {
      const D = v["d1"]!;
      const d = v["d2"]!;
      const H = v["h"]!;
      const ang = withAngle ? (v["ang"] ?? 90) : 90;
      const R = D / 2;
      const r = d / 2;
      const k = 1 / Math.sin((ang * Math.PI) / 180);
      const n = Math.max(8, Math.round(v["divisions"] ?? 12) * 2);
      // Penetração: recuo da geratriz em função do ângulo polar do ramal.
      const cut = (t: number) => {
        const y = r * Math.sin(t);
        const inside = Math.max(R * R - y * y, 0);
        return (
          (R - Math.sqrt(inside)) * k +
          (withAngle ? (r * Math.cos(t)) / Math.tan((ang * Math.PI) / 180) : 0)
        );
      };
      const dev = cylinderDevelopment(d, n, (t) => H - cut(t));
      const maxCut = Math.max(...Array.from({ length: n + 1 }, (_, i) => cut((i / n) * TAU)));
      return finalize({
        v,
        method: "Interseção — linha de penetração por ordenadas",
        development: dev.development,
        trueLengths: dev.trueLengths,
        metrics: [
          { label: "Perímetro da derivação", value: Math.PI * d, unitMm: true },
          { label: "Recuo máximo (boca)", value: maxCut, unitMm: true },
          { label: "Altura útil mínima", value: H - maxCut, unitMm: true },
          { label: "Ângulo do ramal", value: ang, suffix: "°" },
        ],
        steps: [
          {
            title: "Como nasce a linha de penetração?",
            given: `ØD = ${D} mm, Ød = ${d} mm`,
            formula: "z(θ) = R − √(R² − (r·senθ)²)",
            substitution: `R = ${R.toFixed(1)} mm, r = ${r.toFixed(1)} mm`,
            result: `recuo máximo = ${maxCut.toFixed(2)} mm`,
            meaning:
              "Cada geratriz do ramal encontra a casca do tubo principal a uma altura diferente: essa curva é a boca de encaixe.",
          },
          {
            title: "O que muda com o ângulo?",
            given: `α = ${ang}°`,
            formula: "z' = z / sen α",
            substitution: `fator = 1 / sen ${ang}° = ${k.toFixed(3)}`,
            result: `${maxCut.toFixed(2)} mm de recuo`,
            meaning:
              "Quanto mais inclinado o ramal, mais alongada é a boca — o fator 1/senα estica as ordenadas.",
          },
        ],
      });
    },
  };
}

/** Curva de gomos (mitered elbow). Retorna o gomo intermediário. */
function elbowEngine(slug: string): Engine {
  const fields: EngineField[] = [
    { key: "d", label: "Diâmetro do tubo", tag: "ØD", min: 20, max: 3000 },
    { key: "r", label: "Raio da curva", tag: "R", min: 20, max: 8000 },
    { key: "ang", label: "Ângulo total", tag: "α", unit: "°", min: 15, max: 180 },
    { key: "gomos", label: "Nº de gomos", tag: "n", unit: "un", min: 2, max: 12, integer: true },
  ];
  return {
    slug,
    method: "Seções oblíquas — gomos por ordenadas",
    fields,
    defaults: { d: 300, r: 450, ang: 90, gomos: 4, divisions: 12, thickness: 3, density: 7.85 },
    wire: (v) => ({
      d1: v["r"]!,
      d2: v["d"]!,
      h: v["r"]!,
      e: 0,
      seg: 32,
      ang: v["ang"] ?? 90,
      n: Math.round(v["gomos"] ?? 4),
      mode: "elbow",
    }),
    dimKey: (k) => (k === "r" ? "d1" : k === "d" ? "d2" : null),
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if ((v["r"] ?? 0) < (v["d"] ?? 0) / 2)
        issues.push({ field: "r", message: "O raio da curva deve ser maior que o raio do tubo." });
      return issues;
    },
    calculate: (v) => {
      const D = v["d"]!;
      const R = v["r"]!;
      const ang = v["ang"]!;
      const g = Math.round(v["gomos"]!);
      const n = Math.max(8, Math.round(v["divisions"] ?? 12) * 2);
      const total = (ang * Math.PI) / 180;
      const beta = total / (2 * (g - 1) + 2); // meio-ângulo de cada junta
      const tb = Math.tan(beta);
      const Lmid = 2 * R * tb; // comprimento médio do gomo intermediário
      const r = D / 2;
      const dev = cylinderDevelopment(
        D,
        n,
        (t) => Lmid / 2 + r * Math.cos(t) * tb,
        (t) => -Lmid / 2 - r * Math.cos(t) * tb,
      );
      const lMax = Lmid + 2 * r * tb;
      const lMin = Lmid - 2 * r * tb;
      /* Peças reais da curva: 2 pontas + (n−1) gomos, cada uma com geometria. */
      const elbowInput: ElbowInput = {
        diameter: D,
        radius: R,
        angleDeg: ang,
        gores: g,
        divisions: n,
      };
      const em = elbowModel(elbowInput);
      const pieces: GeometryPiece[] = em.segments.map((s) => ({
        code: s.code,
        name: s.name,
        quantity: 1,
        development: s.development,
        metrics: [
          { label: "Comprimento na linha de centro", value: s.centerLength, unitMm: true },
          { label: "Geratriz máxima", value: s.maxLength, unitMm: true },
          { label: "Geratriz mínima", value: s.minLength, unitMm: true },
          { label: "Direção do eixo", value: s.rotationDeg, suffix: "°" },
        ],
      }));
      return finalize({
        v,
        method: "Seções oblíquas — gomos por ordenadas",
        development: dev.development,
        trueLengths: dev.trueLengths,
        pieces,
        metrics: [
          { label: "Perímetro", value: Math.PI * D, unitMm: true },
          { label: "Ângulo por junta", value: (2 * beta * 180) / Math.PI, suffix: "°" },
          { label: "Comprimento médio do gomo", value: Lmid, unitMm: true },
          { label: "Geratriz máxima", value: lMax, unitMm: true },
          { label: "Geratriz mínima", value: lMin, unitMm: true },
          { label: "Gomos", value: g, suffix: "un" },
          { label: "Peças da curva", value: em.segments.length, suffix: "un" },
        ],

        steps: [
          {
            title: "Como se divide o ângulo?",
            given: `α = ${ang}°, ${g} gomos`,
            formula: "β = α / (2·(n−1) + 2)",
            substitution: `β = ${ang} / ${2 * (g - 1) + 2}`,
            result: `β = ${((beta * 180) / Math.PI).toFixed(2)}°`,
            meaning:
              "As duas pontas valem meio gomo cada; β é o meio-ângulo de corte em cada junta soldada.",
          },
          {
            title: "Qual é o comprimento do gomo?",
            given: `R = ${R} mm, β = ${((beta * 180) / Math.PI).toFixed(2)}°`,
            formula: "L = 2 · R · tg β",
            substitution: `L = 2 × ${R} × ${tb.toFixed(4)}`,
            result: `L = ${Lmid.toFixed(2)} mm`,
            meaning: "Comprimento na linha de centro; as geratrizes variam ±r·tgβ ao redor dele.",
          },
        ],
        warnings: [
          "O desenvolvimento mostrado é o gomo intermediário; os gomos das pontas têm metade do corte.",
        ],
      });
    },
  };
}

/** Calota esférica em gomos (gores). */
function domeEngine(slug: string): Engine {
  const fields: EngineField[] = [
    { key: "d", label: "Diâmetro da base", tag: "ØD", min: 50, max: 6000 },
    { key: "h", label: "Altura da calota", tag: "H", min: 10, max: 3000 },
    { key: "gomos", label: "Nº de gomos", tag: "n", unit: "un", min: 3, max: 24, integer: true },
  ];
  return {
    slug,
    method: "Gomos — desenvolvimento por meridianos",
    fields,
    defaults: { d: 800, h: 250, gomos: 8, divisions: 12, thickness: 4, density: 7.85 },
    wire: (v) => ({ d1: v["d"]!, d2: v["d"]! * 0.2, h: v["h"]!, e: 0, seg: 32 }),
    dimKey: (k) => (k === "d" ? "d1" : k === "h" ? "h" : null),
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if ((v["h"] ?? 0) > (v["d"] ?? 0) / 2)
        issues.push({
          field: "h",
          message: "A altura não pode exceder o raio da base (semiesfera).",
        });
      return issues;
    },
    calculate: (v) => {
      const D = v["d"]!;
      const H = v["h"]!;
      const g = Math.round(v["gomos"]!);
      const a = D / 2;
      const Rs = (a * a + H * H) / (2 * H); // raio da esfera
      const phiMax = Math.asin(Math.min(a / Rs, 1));
      const n = Math.max(8, Math.round(v["divisions"] ?? 12));
      const left: Vec2[] = [];
      const right: Vec2[] = [];
      const folds: Segment2[] = [];
      const trueLengths: { id: string; length: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const phi = (phiMax * i) / n;
        const s = Rs * phi; // arco meridiano (comprimento verdadeiro)
        const w = (Math.PI * Rs * Math.sin(phi)) / g; // meia largura do gomo
        right.push({ x: w, y: s });
        left.push({ x: -w, y: s });
        folds.push({ a: { x: -w, y: s }, b: { x: w, y: s } });
        trueLengths.push({ id: `M${i}`, length: 2 * w });
      }
      const outline = [...right, ...left.slice().reverse()];
      const arcLen = Rs * phiMax;
      return finalize({
        v,
        method: "Gomos — desenvolvimento por meridianos",
        development: pattern(outline, folds, [
          { id: "Polo", p: { x: 0, y: 0 } },
          { id: "Base", p: { x: 0, y: arcLen } },
        ]),
        trueLengths,
        metrics: [
          { label: "Raio da esfera", value: Rs, unitMm: true },
          { label: "Arco meridiano", value: arcLen, unitMm: true },
          { label: "Largura máxima do gomo", value: (2 * Math.PI * a) / g, unitMm: true },
          { label: "Ângulo do casquete", value: (phiMax * 180) / Math.PI, suffix: "°" },
          { label: "Gomos", value: g, suffix: "un" },
          { label: "Área da calota (real)", value: (TAU * Rs * H) / 1_000_000, suffix: "m²" },
        ],
        steps: [
          {
            title: "Qual é o raio da esfera?",
            given: `Ø base = ${D} mm, H = ${H} mm`,
            formula: "R = (a² + H²) / (2H)",
            substitution: `R = (${a.toFixed(1)}² + ${H}²) / (2 × ${H})`,
            result: `R = ${Rs.toFixed(2)} mm`,
            meaning: "A calota é um trecho de esfera; esse raio comanda todo o traçado.",
          },
          {
            title: "Como se abre o gomo?",
            given: `${g} gomos`,
            formula: "largura(φ) = 2π·R·senφ / n",
            substitution: `largura(máx) = 2π × ${a.toFixed(1)} / ${g}`,
            result: `${((TAU * a) / g).toFixed(2)} mm`,
            meaning:
              "A esfera não é desenvolvível: dividimos em gomos estreitos, cuja largura acompanha o paralelo e o comprimento segue o meridiano.",
          },
        ],
        warnings: [
          "A área somada dos gomos é aproximada; use conformação por calandra/prensa para o ajuste final.",
        ],
      });
    },
  };
}

/** Flange anelar com furação. */
function flangeEngine(slug: string): Engine {
  const fields: EngineField[] = [
    { key: "de", label: "Ø externo", tag: "ØE", min: 40, max: 4000 },
    { key: "di", label: "Ø interno", tag: "ØI", min: 10, max: 4000 },
    { key: "bc", label: "Ø do espelho de furos", tag: "ØF", min: 20, max: 4000 },
    { key: "furos", label: "Nº de furos", tag: "n", unit: "un", min: 2, max: 48, integer: true },
    { key: "dfuro", label: "Ø do furo", tag: "Øf", min: 2, max: 200 },
  ];
  return {
    slug,
    method: "Divisão angular — coroa circular com furação",
    fields,
    defaults: {
      de: 400,
      di: 220,
      bc: 320,
      furos: 8,
      dfuro: 18,
      divisions: 12,
      thickness: 10,
      density: 7.85,
    },
    wire: (v) => ({ d1: v["de"]!, d2: v["di"]!, h: Math.max(v["de"]! * 0.08, 10), e: 0, seg: 32 }),
    dimKey: (k) => (k === "de" ? "d1" : k === "di" ? "d2" : null),
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if ((v["di"] ?? 0) >= (v["de"] ?? 0))
        issues.push({ field: "di", message: "O Ø interno deve ser menor que o externo." });
      if ((v["bc"] ?? 0) >= (v["de"] ?? 0) || (v["bc"] ?? 0) <= (v["di"] ?? 0))
        issues.push({
          field: "bc",
          message: "O espelho de furos deve ficar entre Ø interno e externo.",
        });
      return issues;
    },
    calculate: (v) => {
      const De = v["de"]!;
      const Di = v["di"]!;
      const bc = v["bc"]!;
      const nf = Math.round(v["furos"]!);
      const df = v["dfuro"]!;
      const n = 96;
      const outer: Vec2[] = Array.from({ length: n }, (_, i) => {
        const t = (i / n) * TAU;
        return { x: (De / 2) * Math.cos(t), y: (De / 2) * Math.sin(t) };
      });
      const folds: Segment2[] = [];
      const points: { id: string; p: Vec2 }[] = [];
      for (let i = 0; i < nf; i++) {
        const t = (i / nf) * TAU;
        const p = { x: (bc / 2) * Math.cos(t), y: (bc / 2) * Math.sin(t) };
        points.push({ id: `F${i + 1}`, p });
        folds.push({ a: { x: 0, y: 0 }, b: p });
      }
      // furo central como linha de referência
      for (let i = 0; i < n; i += 4) {
        const t = (i / n) * TAU;
        const t2 = ((i + 4) / n) * TAU;
        folds.push({
          a: { x: (Di / 2) * Math.cos(t), y: (Di / 2) * Math.sin(t) },
          b: { x: (Di / 2) * Math.cos(t2), y: (Di / 2) * Math.sin(t2) },
        });
      }
      const area = (Math.PI / 4) * (De * De - Di * Di) - nf * (Math.PI / 4) * df * df;
      const step = 360 / nf;
      const chord = 2 * (bc / 2) * Math.sin(Math.PI / nf);
      return finalize({
        v,
        method: "Divisão angular — coroa circular com furação",
        development: pattern(outer, folds, points),
        trueLengths: points.map((p, i) => ({ id: `Furo ${i + 1}`, length: bc / 2 })),
        areaMm2: area,
        metrics: [
          { label: "Passo angular", value: step, suffix: "°" },
          { label: "Corda entre furos", value: chord, unitMm: true },
          { label: "Espelho de furos", value: bc, unitMm: true },
          { label: "Largura da coroa", value: (De - Di) / 2, unitMm: true },
          { label: "Furos", value: nf, suffix: "un" },
        ],
        steps: [
          {
            title: "Como dividir a furação?",
            given: `${nf} furos`,
            formula: "passo = 360° / n",
            substitution: `passo = 360 / ${nf}`,
            result: `${step.toFixed(2)}°`,
            meaning: "Divisão angular exata evita acúmulo de erro na marcação com compasso.",
          },
          {
            title: "Qual é a corda de marcação?",
            given: `ØF = ${bc} mm`,
            formula: "c = 2 · (ØF/2) · sen(180°/n)",
            substitution: `c = ${bc} × sen(${(180 / nf).toFixed(2)}°)`,
            result: `c = ${chord.toFixed(2)} mm`,
            meaning: "Medida direta de trena entre centros consecutivos — conferência de campo.",
          },
        ],
      });
    },
  };
}

/** Tampa plana com aba (virola de encaixe). */
function capEngine(slug: string): Engine {
  const fields: EngineField[] = [
    { key: "d", label: "Diâmetro da tampa", tag: "ØD", min: 30, max: 5000 },
    { key: "aba", label: "Altura da aba", tag: "a", min: 0, max: 500 },
  ];
  return {
    slug,
    method: "Direto — disco com aba desenvolvida",
    fields,
    defaults: { d: 600, aba: 40, divisions: 12, thickness: 4, density: 7.85 },
    wire: (v) => ({ d1: v["d"]!, d2: v["d"]!, h: Math.max(v["aba"]!, 8), e: 0, seg: 32 }),
    dimKey: (k) => (k === "d" ? "d1" : k === "aba" ? "h" : null),
    validate: (v) => baseValidate(fields, v),
    calculate: (v) => {
      const D = v["d"]!;
      const aba = v["aba"]!;
      const Rdisc = D / 2 + aba;
      const n = 96;
      const outline = Array.from({ length: n }, (_, i) => {
        const t = (i / n) * TAU;
        return { x: Rdisc * Math.cos(t), y: Rdisc * Math.sin(t) };
      });
      const folds: Segment2[] = [];
      for (let i = 0; i < n; i += 2) {
        const t = (i / n) * TAU;
        const t2 = ((i + 2) / n) * TAU;
        folds.push({
          a: { x: (D / 2) * Math.cos(t), y: (D / 2) * Math.sin(t) },
          b: { x: (D / 2) * Math.cos(t2), y: (D / 2) * Math.sin(t2) },
        });
      }
      return finalize({
        v,
        method: "Direto — disco com aba desenvolvida",
        development: pattern(outline, folds, [{ id: "C", p: { x: 0, y: 0 } }]),
        trueLengths: [
          { id: "Raio do disco", length: Rdisc },
          { id: "Aba", length: aba },
        ],
        metrics: [
          { label: "Ø do disco de corte", value: 2 * Rdisc, unitMm: true },
          { label: "Perímetro de dobra", value: Math.PI * D, unitMm: true },
          { label: "Altura da aba", value: aba, unitMm: true },
        ],
        steps: [
          {
            title: "Qual é o disco a cortar?",
            given: `Ø tampa = ${D} mm, aba = ${aba} mm`,
            formula: "Ø corte = Ø + 2·aba",
            substitution: `Ø corte = ${D} + 2 × ${aba}`,
            result: `Ø corte = ${(2 * Rdisc).toFixed(2)} mm`,
            meaning:
              "A aba é dobrada a 90°; o desenvolvimento pela linha média já embute o comprimento dobrado.",
          },
        ],
      });
    },
  };
}

/** Transições por triangulação apoiadas no motor quadrado → redondo. */
function triangulationEngine(slug: string, inverted: boolean): Engine {
  const fields: EngineField[] = [
    {
      key: "baseA",
      label: inverted ? "Lado A do topo" : "Lado A da base",
      tag: "A",
      min: 10,
      max: 5000,
    },
    {
      key: "baseB",
      label: inverted ? "Lado B do topo" : "Lado B da base",
      tag: "B",
      min: 10,
      max: 5000,
    },
    {
      key: "topDiameter",
      label: inverted ? "Ø da base" : "Ø do topo",
      tag: "ØD",
      min: 10,
      max: 5000,
    },
    { key: "height", label: "Altura vertical", tag: "H", min: 10, max: 6000 },
    { key: "offsetX", label: "Excentricidade X", tag: "ex", min: -3000, max: 3000 },
    { key: "offsetY", label: "Excentricidade Y", tag: "ey", min: -3000, max: 3000 },
  ];
  return {
    slug,
    method: "Triangulação — comprimentos verdadeiros",
    fields,
    defaults: { ...SQUARE_TO_ROUND_DEFAULTS } as unknown as EngineValues,
    wire: (v) => ({
      d1: Math.max(v["baseA"]!, v["baseB"]!),
      d2: v["topDiameter"]!,
      h: v["height"]!,
      e: v["offsetX"] ?? 0,
      seg: 32,
    }),
    dimKey: (k) =>
      k === "baseA" || k === "baseB"
        ? "d1"
        : k === "topDiameter"
          ? "d2"
          : k === "height"
            ? "h"
            : k === "offsetX" || k === "offsetY"
              ? "e"
              : null,
    validate: (v) => validateSquareToRound(v as unknown as SquareToRoundInput),
    calculate: (v) => calculateSquareToRound(v as unknown as SquareToRoundInput),
  };
}

/** Cone excêntrico por triangulação real entre dois círculos. */
function eccentricConeEngine(slug: string): Engine {
  const fields: EngineField[] = [
    { key: "d1", label: "Ø da base", tag: "ØD", min: 20, max: 5000 },
    { key: "d2", label: "Ø do topo", tag: "Ød", min: 5, max: 5000 },
    { key: "h", label: "Altura vertical", tag: "H", min: 10, max: 6000 },
    { key: "e", label: "Excentricidade", tag: "ex", min: 0, max: 3000 },
  ];
  return {
    slug,
    method: "Triangulação — geratrizes verdadeiras entre círculos",
    fields,
    defaults: { d1: 500, d2: 250, h: 400, e: 100, divisions: 12, thickness: 3, density: 7.85 },
    wire: (v) => ({ d1: v["d1"]!, d2: v["d2"]!, h: v["h"]!, e: v["e"]!, seg: 32 }),
    dimKey: (k) =>
      k === "d1" ? "d1" : k === "d2" ? "d2" : k === "h" ? "h" : k === "e" ? "e" : null,
    validate: (v) => {
      const issues = baseValidate(fields, v);
      if ((v["d2"] ?? 0) >= (v["d1"] ?? 0))
        issues.push({ field: "d2", message: "O Ø do topo deve ser menor que o da base." });
      return issues;
    },
    calculate: (v) => {
      const R = v["d1"]! / 2;
      const r = v["d2"]! / 2;
      const H = v["h"]!;
      const e = v["e"]!;
      const n = Math.max(8, Math.round(v["divisions"] ?? 12) * 2);

      const base = Array.from({ length: n + 1 }, (_, i) => {
        const t = -Math.PI + (i / n) * TAU;
        return { x: R * Math.cos(t), y: R * Math.sin(t), z: 0 };
      });
      const top = Array.from({ length: n + 1 }, (_, i) => {
        const t = -Math.PI + (i / n) * TAU;
        return { x: e + r * Math.cos(t), y: r * Math.sin(t), z: H };
      });
      const L3 = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
        Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

      const trueLengths: { id: string; length: number }[] = [];
      const bottomPts: Vec2[] = [];
      const topPts: Vec2[] = [];
      const folds: Segment2[] = [];

      let pb: Vec2 = { x: 0, y: 0 };
      let pt: Vec2 = { x: 0, y: L3(base[0]!, top[0]!) };
      bottomPts.push(pb);
      topPts.push(pt);
      trueLengths.push({ id: "G0", length: pt.y });
      folds.push({ a: pb, b: pt });

      const tri = (p: Vec2, q: Vec2, dp: number, dq: number, side: 1 | -1): Vec2 => {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d === 0) return { x: p.x + dp, y: p.y };
        const a = (dp * dp - dq * dq + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(dp * dp - a * a, 0));
        const ux = (q.x - p.x) / d;
        const uy = (q.y - p.y) / d;
        const mx = p.x + a * ux;
        const my = p.y + a * uy;
        return { x: mx + side * h * uy, y: my - side * h * ux };
      };

      for (let i = 0; i < n; i++) {
        const chordB = L3(base[i]!, base[i + 1]!);
        const diag = L3(base[i + 1]!, top[i]!);
        const nb = tri(pb, pt, chordB, diag, -1);
        bottomPts.push(nb);
        folds.push({ a: nb, b: pt });

        const chordT = L3(top[i]!, top[i + 1]!);
        const gen = L3(base[i + 1]!, top[i + 1]!);
        const nt = tri(pt, nb, chordT, gen, 1);
        topPts.push(nt);
        folds.push({ a: nb, b: nt });
        trueLengths.push({ id: `G${i + 1}`, length: gen });
        pb = nb;
        pt = nt;
      }

      const outline = [...bottomPts, ...topPts.slice().reverse()];
      const lens = trueLengths.map((t) => t.length);
      return finalize({
        v,
        method: "Triangulação — geratrizes verdadeiras entre círculos",
        development: pattern(
          outline,
          folds,
          bottomPts.filter((_, i) => i % 4 === 0).map((p, i) => ({ id: `B${i * 4}`, p })),
        ),
        trueLengths,
        metrics: [
          { label: "Perímetro da base", value: TAU * R, unitMm: true },
          { label: "Perímetro do topo", value: TAU * r, unitMm: true },
          { label: "Geratriz mínima", value: Math.min(...lens), unitMm: true },
          { label: "Geratriz máxima", value: Math.max(...lens), unitMm: true },
          { label: "Excentricidade", value: e, unitMm: true },
          { label: "Triângulos gerados", value: 2 * n, suffix: "un" },
        ],
        steps: [
          {
            title: "Por que não é radial?",
            given: `excentricidade = ${e} mm`,
            formula: "Cone oblíquo → sem ápice único no plano",
            substitution: "cada geratriz tem comprimento diferente",
            result: `de ${Math.min(...lens).toFixed(2)} a ${Math.max(...lens).toFixed(2)} mm`,
            meaning:
              "Com os círculos descentrados o sólido é oblíquo: só a triangulação preserva os comprimentos verdadeiros.",
          },
          {
            title: "Como se encadeia o traçado?",
            given: `${n} divisões do perímetro`,
            formula: "L = √(Δx² + Δy² + Δz²)",
            substitution: `H = ${H} mm`,
            result: `${2 * n} triângulos rebatidos`,
            meaning:
              "Cada par de pontos consecutivos forma dois triângulos (geratriz e diagonal) rebatidos lado a lado a partir da costura.",
          },
        ],
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Registro por slug                                                   */
/* ------------------------------------------------------------------ */

const ENGINES: Record<string, Engine> = {
  cilindro: cylinderEngine("cilindro"),
  dutos: cylinderEngine("dutos", "Diâmetro do duto", "Comprimento do trecho"),
  cone: radialEngine("cone", {
    topZero: true,
    labels: ["Diâmetro da base", "", "Altura vertical"],
  }),
  "tronco-de-cone": radialEngine("tronco-de-cone", {}),
  "reducao-circular": radialEngine("reducao-circular", {}),
  chamines: radialEngine("chamines", {
    labels: ["Ø da virola inferior", "Ø da virola superior", "Altura do trecho"],
  }),
  "cone-excentrico": eccentricConeEngine("cone-excentrico"),
  "boca-de-lobo": obliqueEngine("boca-de-lobo"),
  te: branchEngine("te", false),
  interseccoes: branchEngine("interseccoes", true),
  y: branchEngine("y", true),
  "curva-de-gomos": elbowEngine("curva-de-gomos"),
  calotas: domeEngine("calotas"),
  flanges: flangeEngine("flanges"),
  tampas: capEngine("tampas"),
  "redondo-quadrado": triangulationEngine("redondo-quadrado", true),
  transicoes: triangulationEngine("transicoes", false),
};

export function getEngine(slug: string): Engine | null {
  return ENGINES[slug] ?? null;
}

export { common };
