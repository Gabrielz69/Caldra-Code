/**
 * TRANSIÇÃO QUADRADO → REDONDO
 * Método: triangulação (radial line / triangulation development).
 *
 * Modelo geométrico
 * -----------------
 * Base retangular A × B no plano z = 0, centrada na origem.
 * Topo circular de diâmetro D no plano z = H, centro deslocado (ox, oy).
 *
 * A superfície é composta por:
 *  - 4 triângulos planos (um por lado da base), e
 *  - 4 setores cônicos oblíquos, cada um com ápice em um vértice da base
 *    e diretriz em um quarto da circunferência do topo.
 *
 * Cada setor cônico é aproximado por `n` triângulos (prática padrão de
 * caldeiraria). O desenvolvimento é obtido encadeando os triângulos no plano
 * preservando os comprimentos verdadeiros das arestas em 3D.
 *
 * Todas as unidades internas são milímetros.
 */

import type {
  GeometryPiece,
  CalcStep,
  DevelopmentPattern,
  GeometryResult,
  Segment2,
  ValidationIssue,
  Vec2,
  Vec3,
} from "./types";

export type SquareToRoundInput = {
  /** Lado A da base (mm) — eixo X. */
  baseA: number;
  /** Lado B da base (mm) — eixo Y. */
  baseB: number;
  /** Diâmetro do topo (mm). */
  topDiameter: number;
  /** Altura vertical entre planos (mm). */
  height: number;
  /** Excentricidade do topo em X (mm). */
  offsetX: number;
  /** Excentricidade do topo em Y (mm). */
  offsetY: number;
  /** Divisões por quadrante do círculo (12 = 48 no total). */
  divisions: number;
  /** Espessura da chapa (mm). */
  thickness: number;
  /** Densidade do material (kg/dm³). */
  density: number;
  /**
   * Estratégia de fabricação — parâmetro do MESMO modelo geométrico.
   * A geometria final do conjunto é idêntica nos dois modos; o que muda é a
   * decomposição fabricável (uma peça ou duas metades unidas por solda).
   */
  strategy: "single" | "two-weld";
};

export const SQUARE_TO_ROUND_DEFAULTS: SquareToRoundInput = {
  baseA: 400,
  baseB: 400,
  topDiameter: 300,
  height: 500,
  offsetX: 0,
  offsetY: 0,
  divisions: 6,
  thickness: 3,
  density: 7.85,
  strategy: "single",
};

export function validateSquareToRound(i: SquareToRoundInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!(i.baseA > 0)) issues.push({ field: "baseA", message: "Lado A deve ser maior que zero." });
  if (!(i.baseB > 0)) issues.push({ field: "baseB", message: "Lado B deve ser maior que zero." });
  if (!(i.topDiameter > 0))
    issues.push({ field: "topDiameter", message: "Diâmetro deve ser maior que zero." });
  if (!(i.height > 0)) issues.push({ field: "height", message: "Altura deve ser maior que zero." });
  if (!(i.divisions >= 3 && i.divisions <= 24))
    issues.push({ field: "divisions", message: "Use entre 3 e 24 divisões por quadrante." });
  if (!(i.thickness > 0))
    issues.push({ field: "thickness", message: "Espessura deve ser maior que zero." });
  const r = i.topDiameter / 2;
  if (Math.abs(i.offsetX) + r > i.baseA / 2 + r * 2)
    issues.push({ field: "offsetX", message: "Excentricidade em X fora do intervalo utilizável." });
  if (Math.abs(i.offsetY) + r > i.baseB / 2 + r * 2)
    issues.push({ field: "offsetY", message: "Excentricidade em Y fora do intervalo utilizável." });
  return issues;
}

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dist2 = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Terceiro vértice de um triângulo no plano, conhecidos dois vértices (p, q)
 * e as distâncias verdadeiras até o ponto procurado (dp, dq).
 * `side` define de que lado da reta pq o ponto é posicionado.
 */
function triangulatePoint(p: Vec2, q: Vec2, dp: number, dq: number, side: 1 | -1): Vec2 {
  const d = dist2(p, q);
  if (d === 0) return { x: p.x + dp, y: p.y };
  const a = (dp * dp - dq * dq + d * d) / (2 * d);
  const hSq = dp * dp - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;
  const ux = (q.x - p.x) / d;
  const uy = (q.y - p.y) / d;
  const mx = p.x + a * ux;
  const my = p.y + a * uy;
  return { x: mx + side * h * uy, y: my - side * h * ux };
}

export type SquareToRoundModel = {
  corners: Vec3[];
  arcPoints: Vec3[][]; // por quadrante, inclui extremos
  circle: Vec3[]; // todos os pontos do topo, em ordem
  /** Faces reais da superfície média, em ordem de fabricação. */
  faces: { id: string; piece: "A" | "B"; points: [Vec3, Vec3, Vec3] }[];
  /** Geratrizes reais usadas tanto no 3D quanto na triangulação plana. */
  generatrices: { id: string; piece: "A" | "B"; a: Vec3; b: Vec3 }[];
};

/** Metades separadas pelo plano que cruza os centros das faces 0 e 2. */
const pieceOf = (quadrant: number): "A" | "B" => (quadrant === 1 || quadrant === 2 ? "A" : "B");

export function squareToRoundSeams(
  model: Pick<SquareToRoundModel, "corners" | "arcPoints">,
): [{ a: Vec3; b: Vec3 }, { a: Vec3; b: Vec3 }] {
  const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  });
  return [
    { a: midpoint(model.corners[0]!, model.corners[1]!), b: model.arcPoints[0]!.at(-1)! },
    { a: midpoint(model.corners[2]!, model.corners[3]!), b: model.arcPoints[2]!.at(-1)! },
  ];
}

export function buildModel(i: SquareToRoundInput): SquareToRoundModel {
  const a = i.baseA / 2;
  const b = i.baseB / 2;
  const r = i.topDiameter / 2;
  const corners: Vec3[] = [
    { x: a, y: b, z: 0 },
    { x: -a, y: b, z: 0 },
    { x: -a, y: -b, z: 0 },
    { x: a, y: -b, z: 0 },
  ];
  const arcPoints: Vec3[][] = [];
  const circle: Vec3[] = [];
  for (let k = 0; k < 4; k++) {
    const start = (k * Math.PI) / 2;
    const quadrant: Vec3[] = [];
    for (let j = 0; j <= i.divisions; j++) {
      const t = start + ((Math.PI / 2) * j) / i.divisions;
      const p = {
        x: i.offsetX + r * Math.cos(t),
        y: i.offsetY + r * Math.sin(t),
        z: i.height,
      };
      quadrant.push(p);
      if (j < i.divisions) circle.push(p);
    }
    arcPoints.push(quadrant);
  }
  const faces: SquareToRoundModel["faces"] = [];
  const generatrices: SquareToRoundModel["generatrices"] = [];
  for (let k = 0; k < 4; k++) {
    const corner = corners[k];
    const nextCorner = corners[(k + 1) % 4];
    const quadrant = arcPoints[k];
    if (!corner || !nextCorner || !quadrant) continue;
    for (let j = 0; j < i.divisions; j++) {
      const startPoint = quadrant[j];
      const endPoint = quadrant[j + 1];
      if (!startPoint || !endPoint) continue;
      faces.push({ id: `Q${k}-T${j}`, piece: pieceOf(k), points: [corner, startPoint, endPoint] });
      generatrices.push({
        id: `V${k}-P${k * i.divisions + j}`,
        piece: pieceOf(k),
        a: corner,
        b: startPoint,
      });
    }
    const endPoint = quadrant[i.divisions];
    if (!endPoint) continue;
    generatrices.push({
      id: `V${k}-P${(k + 1) * i.divisions}`,
      piece: pieceOf(k),
      a: corner,
      b: endPoint,
    });
    if (k === 0 || k === 2) {
      const middle = { x: (corner.x + nextCorner.x) / 2, y: (corner.y + nextCorner.y) / 2, z: 0 };
      const firstPiece: "A" | "B" = k === 0 ? "B" : "A";
      const secondPiece: "A" | "B" = k === 0 ? "A" : "B";
      faces.push({ id: `Q${k}-BASE-1`, piece: firstPiece, points: [corner, endPoint, middle] });
      faces.push({
        id: `Q${k}-BASE-2`,
        piece: secondPiece,
        points: [middle, endPoint, nextCorner],
      });
    } else {
      faces.push({ id: `Q${k}-BASE`, piece: pieceOf(k), points: [corner, endPoint, nextCorner] });
    }
  }
  return { corners, arcPoints, circle, faces, generatrices };
}

export { buildModel as buildSquareToRoundModel };

function polygonArea(points: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

type DevelopedPart = {
  outlineTop: Vec2[];
  outlineBottom: Vec2[];
  foldLines: Segment2[];
  trueLengths: { id: string; length: number }[];
};

/**
 * Desenvolve os quadrantes [from..to] por encadeamento de triângulos,
 * com costura no início do intervalo. Extrai a rotina original (0..3) para
 * que o modo "2 partes + solda" desenvolva [0,1] e [2,3] separadamente,
 * sem alterar a matemática nem a geometria 3D do conjunto.
 */
function developRange(
  model: ReturnType<typeof buildModel>,
  n: number,
  from: number,
  to: number,
): DevelopedPart {
  const { corners, arcPoints } = model;
  const outlineTop: Vec2[] = [];
  const outlineBottom: Vec2[] = [];
  const foldLines: Segment2[] = [];
  const trueLengths: { id: string; length: number }[] = [];

  let cornerPos: Vec2 = { x: 0, y: 0 };
  const firstArc = arcPoints[from]![0]!;
  const l0 = dist3(corners[from]!, firstArc);
  let arcPos: Vec2 = { x: 0, y: l0 };
  outlineBottom.push(cornerPos);
  outlineTop.push(arcPos);
  trueLengths.push({ id: `V${from}-P${from * n}`, length: l0 });
  foldLines.push({ a: cornerPos, b: arcPos });

  for (let k = from; k <= to; k++) {
    const corner3 = corners[k]!;
    const quad = arcPoints[k]!;
    for (let j = 0; j < n; j++) {
      const chord = dist3(quad[j]!, quad[j + 1]!);
      const nextLen = dist3(corner3, quad[j + 1]!);
      const next = triangulatePoint(arcPos, cornerPos, chord, nextLen, 1);
      outlineTop.push(next);
      foldLines.push({ a: cornerPos, b: next });
      trueLengths.push({ id: `V${k}-P${k * n + j + 1}`, length: nextLen });
      arcPos = next;
    }
    const nextCorner3 = corners[(k + 1) % 4]!;
    const baseEdge = dist3(corner3, nextCorner3);
    const diag = dist3(nextCorner3, quad[n]!);
    const nextCorner = triangulatePoint(cornerPos, arcPos, baseEdge, diag, -1);
    outlineBottom.push(nextCorner);
    foldLines.push({ a: nextCorner, b: arcPos });
    cornerPos = nextCorner;
  }

  return { outlineTop, outlineBottom, foldLines, trueLengths };
}

/** Desenvolve uma metade entre centros de faces opostas, sem transformar a costura em dobra. */
function developHalf(model: SquareToRoundModel, n: number, seamFace: 0 | 2): DevelopedPart {
  const { corners, arcPoints } = model;
  const seams = squareToRoundSeams(model);
  const seamStart = seamFace === 0 ? seams[0] : seams[1];
  const seamEnd = seamFace === 0 ? seams[1] : seams[0];
  const firstQuadrant = (seamFace + 1) % 4;
  const outlineTop: Vec2[] = [];
  const outlineBottom: Vec2[] = [];
  const foldLines: Segment2[] = [];
  const trueLengths: { id: string; length: number }[] = [];

  let bottomPos: Vec2 = { x: 0, y: 0 };
  let topPos: Vec2 = { x: 0, y: dist3(seamStart.a, seamStart.b) };
  outlineBottom.push(bottomPos);
  outlineTop.push(topPos);

  const firstCorner3 = corners[firstQuadrant]!;
  bottomPos = triangulatePoint(
    bottomPos,
    topPos,
    dist3(seamStart.a, firstCorner3),
    dist3(firstCorner3, seamStart.b),
    -1,
  );
  outlineBottom.push(bottomPos);
  foldLines.push({ a: bottomPos, b: topPos });

  for (let step = 0; step < 2; step++) {
    const k = (firstQuadrant + step) % 4;
    const corner3 = corners[k]!;
    const quad = arcPoints[k]!;
    for (let j = 0; j < n; j++) {
      const nextLen = dist3(corner3, quad[j + 1]!);
      const next = triangulatePoint(topPos, bottomPos, dist3(quad[j]!, quad[j + 1]!), nextLen, 1);
      outlineTop.push(next);
      foldLines.push({ a: bottomPos, b: next });
      trueLengths.push({ id: `V${k}-P${k * n + j + 1}`, length: nextLen });
      topPos = next;
    }
    if (step === 0) {
      const nextCorner3 = corners[(k + 1) % 4]!;
      const nextBottom = triangulatePoint(
        bottomPos,
        topPos,
        dist3(corner3, nextCorner3),
        dist3(nextCorner3, quad[n]!),
        -1,
      );
      outlineBottom.push(nextBottom);
      foldLines.push({ a: nextBottom, b: topPos });
      bottomPos = nextBottom;
    }
  }

  const lastCorner3 = corners[(firstQuadrant + 1) % 4]!;
  const endMid = triangulatePoint(
    bottomPos,
    topPos,
    dist3(lastCorner3, seamEnd.a),
    dist3(seamEnd.a, seamEnd.b),
    -1,
  );
  outlineBottom.push(endMid);
  return { outlineTop, outlineBottom, foldLines, trueLengths };
}

/** Converte o encadeamento em padrão de desenvolvimento com bounds e pontos V. */
function patternOf(part: DevelopedPart, vertexPrefix: string): DevelopmentPattern {
  const outline: Vec2[] = [...part.outlineTop, ...part.outlineBottom.slice().reverse()];
  const minX = Math.min(...outline.map((p) => p.x));
  const maxX = Math.max(...outline.map((p) => p.x));
  const minY = Math.min(...outline.map((p) => p.y));
  const maxY = Math.max(...outline.map((p) => p.y));
  return {
    outline,
    foldLines: part.foldLines,
    points: part.outlineBottom.map((p, idx) => ({ id: `${vertexPrefix}${idx}`, p })),
    bounds: { minX, minY, maxX, maxY },
  };
}

function partPerimeter(outline: Vec2[]): number {
  return outline.reduce((acc, p, idx) => acc + dist2(p, outline[(idx + 1) % outline.length]!), 0);
}

export function calculateSquareToRound(input: SquareToRoundInput): GeometryResult {
  const issues = validateSquareToRound(input);
  if (issues.length) throw new Error(issues[0]!.message);

  const model = buildModel(input);
  const { corners, arcPoints } = model;
  const n = input.divisions;

  // ---- desenvolvimento por encadeamento de triângulos ----
  const part = developRange(model, input.divisions, 0, 3);
  const { trueLengths } = part;

  const development = patternOf(part, "V");

  const outline = development.outline;
  const areaMm2 = polygonArea(outline);
  const volumeDm3 = (areaMm2 * input.thickness) / 1_000_000;
  const massKg = volumeDm3 * input.density;

  const topPerimeter = Math.PI * input.topDiameter;
  const basePerimeter = 2 * (input.baseA + input.baseB);
  const developedPerimeter = partPerimeter(outline);

  const metrics = [
    { label: "Perímetro da base", value: basePerimeter, unitMm: true },
    { label: "Perímetro do topo", value: topPerimeter, unitMm: true },
    { label: "Altura vertical", value: input.height, unitMm: true },
    {
      label: "Geratriz mínima",
      value: Math.min(...trueLengths.map((t) => t.length)),
      unitMm: true,
    },
    {
      label: "Geratriz máxima",
      value: Math.max(...trueLengths.map((t) => t.length)),
      unitMm: true,
    },
    { label: "Contorno do desenvolvimento", value: developedPerimeter, unitMm: true },
    {
      label: "Largura da planificação",
      value: development.bounds.maxX - development.bounds.minX,
      unitMm: true,
    },
    {
      label: "Altura da planificação",
      value: development.bounds.maxY - development.bounds.minY,
      unitMm: true,
    },
    { label: "Área desenvolvida", value: areaMm2 / 1_000_000, suffix: "m²" },
    { label: "Massa estimada", value: massKg, suffix: "kg" },
    { label: "Triângulos gerados", value: 4 * (input.divisions + 1), suffix: "un" },
  ];

  const r = input.topDiameter / 2;
  const gMax = Math.max(...trueLengths.map((t) => t.length));
  const steps: CalcStep[] = [
    {
      title: "De onde vem o perímetro do topo?",
      given: `Ø = ${input.topDiameter} mm`,
      formula: "C = π × D",
      substitution: `C = 3,141592 × ${input.topDiameter}`,
      result: `C = ${topPerimeter.toFixed(2)} mm`,
      meaning:
        "É o comprimento real da circunferência superior. No desenvolvimento ela aparece como a soma das cordas dos triângulos — por isso mais divisões aproximam melhor o arco.",
    },
    {
      title: "Como foi calculada a geratriz?",
      given: `Vértice da base (${(input.baseA / 2).toFixed(1)}; ${(input.baseB / 2).toFixed(1)}; 0) e ponto do topo em z = ${input.height} mm`,
      formula: "L = √(Δx² + Δy² + Δz²)",
      substitution: `L = √(Δx² + Δy² + ${input.height}²)`,
      result: `L(máx) = ${gMax.toFixed(2)} mm`,
      meaning:
        "A geratriz é o comprimento verdadeiro no espaço entre o vértice da base e cada ponto da circunferência. A projeção em planta nunca é o valor real: é preciso compor com a altura.",
    },
    {
      title: "Qual é o ponto de referência?",
      given: `Base ${input.baseA} × ${input.baseB} mm centrada na origem; topo Ø${input.topDiameter} com excentricidade (${input.offsetX}; ${input.offsetY}) mm`,
      formula: "P(θ) = (ox + R·cosθ ; oy + R·senθ ; H)",
      substitution: `R = ${r.toFixed(2)} mm, H = ${input.height} mm`,
      result: "Origem no centro da base; costura no vértice V0.",
      meaning:
        "Fixar a origem no centro da base mantém as quatro faces simétricas quando não há excentricidade e torna previsível o traçado na chapa.",
    },
    {
      title: "Qual método de desenvolvimento está sendo utilizado?",
      given: `${input.divisions} divisões por quadrante (${input.divisions * 4} no total)`,
      formula: "Triangulação: superfície = 4 planos + 4 setores cônicos",
      substitution: `Triângulos = 4 × (${input.divisions} + 1) = ${4 * (input.divisions + 1)}`,
      result: "Cada triângulo é rebatido no plano preservando seus três lados verdadeiros.",
      meaning:
        "Como o setor cônico oblíquo não é desenvolvível por rotação simples, a triangulação é o método correto: cada faixa é planificada pelos comprimentos verdadeiros, encadeada a partir da costura.",
    },
    {
      title: "De onde vem a massa?",
      given: `Área = ${(areaMm2 / 1_000_000).toFixed(4)} m², e = ${input.thickness} mm, ρ = ${input.density} kg/dm³`,
      formula: "m = A × e × ρ",
      substitution: `m = ${(areaMm2 / 1_000_000).toFixed(4)} × ${(input.thickness / 1000).toFixed(4)} × ${(input.density * 1000).toFixed(0)}`,
      result: `m = ${massKg.toFixed(2)} kg`,
      meaning:
        "Massa do desenvolvimento planificado, sem descontar recortes nem considerar sobremetal de solda.",
    },
  ];

  // ---- estratégia de fabricação: decomposição do MESMO modelo ----
  const strategy = input.strategy ?? "single";
  let pieces: GeometryResult["pieces"];
  let joints: GeometryResult["joints"];
  if (strategy === "two-weld") {
    const devA = patternOf(developHalf(model, n, 0), "A");
    const devB = patternOf(developHalf(model, n, 2), "B");
    const seams = squareToRoundSeams(model);
    const mkPiece = (code: string, name: string, dev: DevelopmentPattern): GeometryPiece => {
      const area = polygonArea(dev.outline);
      const volDm3 = (area * input.thickness) / 1_000_000;
      return {
        code,
        name,
        quantity: 1,
        development: dev,
        metrics: [
          { label: "Área desenvolvida", value: area / 1_000_000, suffix: "m²" },
          { label: "Massa estimada", value: volDm3 * input.density, suffix: "kg" },
          { label: "Perímetro de corte", value: partPerimeter(dev.outline), unitMm: true },
        ],
      };
    };
    pieces = [
      mkPiece("Q-R-001-A", "Parte A — centros das faces opostas", devA),
      mkPiece("Q-R-001-B", "Parte B — centros das faces opostas", devB),
    ];
    joints = [
      {
        id: "J1",
        kind: "weld",
        label: "Emenda soldada J1 — centro da face superior",
        position: `Centro da face superior até a boca: ${dist3(seams[0].a, seams[0].b).toFixed(2)} mm.`,
        between: ["Q-R-001-B", "Q-R-001-A"],
      },
      {
        id: "J2",
        kind: "weld",
        label: "Emenda soldada J2 — centro da face inferior",
        position: `Centro da face inferior até a boca: ${dist3(seams[1].a, seams[1].b).toFixed(2)} mm.`,
        between: ["Q-R-001-A", "Q-R-001-B"],
      },
    ];
  }

  return {
    metrics,
    trueLengths,
    development,
    pieces,
    joints,
    steps,
    areaMm2,
    method:
      strategy === "two-weld"
        ? "Triangulação — comprimentos verdadeiros · 2 partes + solda"
        : "Triangulação — comprimentos verdadeiros",
    warnings: [
      "O arco do topo é aproximado por cordas. Aumente as divisões para reduzir o erro.",
      "O desenvolvimento é da superfície média; descontos de dobra e espessura não estão aplicados.",
    ],
  };
}
