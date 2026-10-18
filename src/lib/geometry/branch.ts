/**
 * BOCA DE LOBO — INTERSEÇÃO CILINDRO / CILINDRO (módulo puro)
 *
 * Um único modelo paramétrico. O ângulo, a excentricidade, os diâmetros, a
 * espessura e o comprimento são PARÂMETROS — não existem modelos separados
 * para 30°, 45°, 60° ou 90°.
 *
 * Sistema de referência (mm, mão direita)
 * ---------------------------------------
 *  - Tubo principal: eixo em X, raio R, superfície  y² + z² = R².
 *  - Derivação: eixo no plano XY, formando α com o eixo X, raio r,
 *    deslocada de `offset` na direção Z (excentricidade).
 *
 * Ponto da superfície da derivação (θ = ângulo polar da seção do ramal):
 *
 *   u  = (cos α, sen α, 0)                 eixo do ramal
 *   e₁ = (0, 0, 1)                         perpendicular horizontal
 *   e₂ = (−sen α, cos α, 0)                perpendicular no plano XY
 *   P(θ, t) = t·u + r·senθ·e₂ + (offset + r·cosθ)·e₁
 *
 * Impondo y² + z² = R² obtém-se o comprimento do eixo do ramal até a
 * penetração:
 *
 *   t(θ) = [ √(R² − (offset + r·cosθ)²) − r·senθ·cos α ] / sen α
 *
 * Toda a saída (curva 3D, planificação do ramal, furo no tubo, cotas e
 * pontos de traçado) deriva DESSA equação — nada é aproximado por desenho.
 */

import type { CalcStep, DevelopmentPattern, Segment2, Vec2, Vec3 } from "./types";

const TAU = Math.PI * 2;

export type BranchInput = {
  /** Diâmetro do tubo principal (mm). */
  mainDiameter: number;
  /** Diâmetro da derivação (mm). */
  branchDiameter: number;
  /** Ângulo entre o eixo do ramal e o eixo do tubo principal (graus, 15–90). */
  angleDeg: number;
  /** Excentricidade do eixo do ramal (mm), medida perpendicular ao plano do ângulo. */
  offset: number;
  /** Comprimento do ramal, do eixo do tubo principal à boca livre (mm). */
  branchLength: number;
  /** Divisões do perímetro (par, ≥ 8). */
  divisions: number;
};

export type BranchPoint = {
  /** Ângulo polar na seção do ramal (rad). */
  theta: number;
  /** Comprimento do eixo do ramal até a penetração (mm). */
  t: number;
  /** Ponto 3D da linha de interseção (mm). */
  p: Vec3;
};

export type BranchModel = {
  R: number;
  r: number;
  alpha: number;
  /** Linha de interseção fechada, em 3D. */
  curve: BranchPoint[];
  /** Menor e maior comprimento do eixo até a penetração. */
  tMin: number;
  tMax: number;
};

export type BranchDevelopments = {
  /** Planificação da derivação (chapa do ramal). */
  branch: DevelopmentPattern;
  /** Planificação do furo no tubo principal (gabarito de corte). */
  hole: DevelopmentPattern;
  trueLengths: { id: string; length: number }[];
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

function pattern(
  outline: Vec2[],
  foldLines: Segment2[],
  points: { id: string; p: Vec2 }[],
): DevelopmentPattern {
  return { outline, foldLines, points, bounds: boundsOf(outline) };
}

export function validateBranch(i: BranchInput): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  const R = i.mainDiameter / 2;
  const r = i.branchDiameter / 2;
  if (!(R > 0)) out.push({ field: "dMain", message: "Diâmetro do tubo principal inválido." });
  if (!(r > 0)) out.push({ field: "d", message: "Diâmetro da derivação inválido." });
  if (r > R) out.push({ field: "d", message: "A derivação não pode exceder o tubo principal." });
  if (Math.abs(i.offset) + r > R)
    out.push({ field: "offset", message: "Excentricidade grande demais: o ramal sai do tubo." });
  if (i.angleDeg < 10 || i.angleDeg > 90)
    out.push({ field: "ang", message: "O ângulo deve ficar entre 10° e 90°." });
  return out;
}

/** Comprimento do eixo do ramal até a penetração, para o ângulo polar θ. */
export function branchAxisLength(i: BranchInput, theta: number): number {
  const R = i.mainDiameter / 2;
  const r = i.branchDiameter / 2;
  const a = (i.angleDeg * Math.PI) / 180;
  const z = i.offset + r * Math.cos(theta);
  const inside = Math.max(R * R - z * z, 0);
  return (Math.sqrt(inside) - r * Math.sin(theta) * Math.cos(a)) / Math.sin(a);
}

/** Linha de interseção real (curva 3D fechada). */
export function branchIntersection(i: BranchInput): BranchModel {
  const R = i.mainDiameter / 2;
  const r = i.branchDiameter / 2;
  const a = (i.angleDeg * Math.PI) / 180;
  const n = Math.max(8, Math.round(i.divisions));
  const curve: BranchPoint[] = [];
  for (let k = 0; k <= n; k++) {
    const theta = (k / n) * TAU;
    const t = branchAxisLength(i, theta);
    const p: Vec3 = {
      x: t * Math.cos(a) - r * Math.sin(theta) * Math.sin(a),
      y: t * Math.sin(a) + r * Math.sin(theta) * Math.cos(a),
      z: i.offset + r * Math.cos(theta),
    };
    curve.push({ theta, t, p });
  }
  const ts = curve.map((c) => c.t);
  return { R, r, alpha: a, curve, tMin: Math.min(...ts), tMax: Math.max(...ts) };
}

/** Planificações derivadas da MESMA curva de interseção. */
export function branchDevelopments(
  i: BranchInput,
  model = branchIntersection(i),
): BranchDevelopments {
  const { R, r, curve } = model;
  const L = i.branchLength;

  /* --- chapa do ramal: x = r·θ, altura = L − t(θ) --------------------- */
  const top: Vec2[] = [];
  const bottom: Vec2[] = [];
  const folds: Segment2[] = [];
  const trueLengths: { id: string; length: number }[] = [];
  curve.forEach((c, k) => {
    const x = r * c.theta;
    const y = L - c.t;
    top.push({ x, y });
    bottom.push({ x, y: 0 });
    folds.push({ a: { x, y: 0 }, b: { x, y } });
    trueLengths.push({ id: `O${k}`, length: y });
  });
  const step = Math.max(1, Math.round(curve.length / 8));
  const branch = pattern(
    [...bottom, ...top.slice().reverse()],
    folds,
    top.filter((_, k) => k % step === 0).map((p, k) => ({ id: `P${k}`, p })),
  );

  /* --- furo no tubo principal: desenrolado (u = R·φ, v = x) ----------- */
  const holePts: Vec2[] = curve.map((c) => ({
    x: c.p.x,
    y: R * Math.atan2(c.p.z, c.p.y),
  }));
  const hole = pattern(
    holePts,
    [],
    holePts.filter((_, k) => k % step === 0).map((p, k) => ({ id: `F${k}`, p })),
  );

  return { branch, hole, trueLengths };
}

/** Pontos de traçado (ordenadas) prontos para a régua do caldeireiro. */
export function branchOrdinates(i: BranchInput, model = branchIntersection(i)) {
  return model.curve.map((c, k) => ({
    id: `O${k}`,
    angleDeg: (c.theta * 180) / Math.PI,
    arc: model.r * c.theta,
    length: i.branchLength - c.t,
  }));
}

export function branchSteps(i: BranchInput, model = branchIntersection(i)): CalcStep[] {
  const aDeg = i.angleDeg;
  return [
    {
      title: "Onde o ramal encontra o tubo?",
      given: `ØD = ${i.mainDiameter} mm, Ød = ${i.branchDiameter} mm, α = ${aDeg}°`,
      formula: "t(θ) = [√(R² − (e + r·cosθ)²) − r·senθ·cos α] / sen α",
      substitution: `R = ${model.R.toFixed(1)} mm, r = ${model.r.toFixed(1)} mm, e = ${i.offset} mm`,
      result: `t varia de ${model.tMin.toFixed(2)} a ${model.tMax.toFixed(2)} mm`,
      meaning:
        "Cada geratriz do ramal encontra a casca do tubo numa altura diferente. Essa curva é a boca de encaixe — é ela que se recorta na chapa.",
    },
    {
      title: "Como a boca vira planificação?",
      given: `${model.curve.length - 1} ordenadas`,
      formula: "x = r·θ   |   y = L − t(θ)",
      substitution: `L = ${i.branchLength} mm`,
      result: `altura mínima ${(i.branchLength - model.tMax).toFixed(2)} mm`,
      meaning:
        "Abrindo o cilindro do ramal, o perímetro vira a base reta e as alturas verdadeiras formam a curva da boca.",
    },
    {
      title: "E o furo no tubo principal?",
      given: `R = ${model.R.toFixed(1)} mm`,
      formula: "u = R·φ   |   v = x",
      substitution: "φ = arctg(z / y) na seção do tubo",
      result: "gabarito do furo em verdadeira grandeza",
      meaning:
        "A mesma curva, vista pelo tubo principal e desenrolada, dá o furo a recortar antes de soldar.",
    },
  ];
}
