/**
 * MOTOR 3D PARAMÉTRICO DA TRAÇAGEM.
 *
 * PARÂMETROS → VALIDAÇÃO → MODELO PARAMÉTRICO → GEOMETRIA (malha + arestas)
 *
 * A matemática é a fonte de verdade: os parâmetros vêm dos mesmos valores
 * usados por cálculos, cotas, vista superior e planificação (ver
 * `src/lib/geometry/engines.ts`, que produz `WireParams` a partir das medidas
 * reais da peça). Aqui não existe cálculo paralelo "só para o visual": a
 * geometria 3D é derivada dos mesmos números, em milímetros de mundo.
 */

import { branchAxisLength, branchIntersection } from "@/lib/geometry/branch";
import { elbowModel } from "@/lib/geometry/elbowSegments";
import { buildModel as buildSquareToRoundModel } from "@/lib/geometry/squareToRound";
import type { Vec2, Vec3 } from "@/lib/geometry/types";
import { getModelShadingStyle } from "@/lib/viz3d/technicalConfig";

export type Edge = [Vec3, Vec3];
export type FaceKind = "outer" | "inner" | "rim" | "cap";
/**
 * Face da malha. `n` é a normal REAL em espaço de modelo, calculada uma única
 * vez em `finish()` — depois que posições e índices estão completos (Newell).
 * Nunca é derivada da projeção de tela, o que elimina manchas de iluminação.
 */
export type Face = {
  pts: Vec3[];
  kind: FaceKind;
  n?: Vec3 | undefined;
  /**
   * Grupo de casca (corpos que se cruzam, ex.: tubo principal = 0, ramal = 1).
   * Usado apenas como desempate de profundidade na apresentação; nunca altera
   * coordenadas. Omitido em peças de corpo único.
   */
  g?: number;
};
export type Bounds = { min: Vec3; max: Vec3 };

/**
 * CLASSIFICAÇÃO GLOBAL DE ENTIDADES 3D (CALDRA)
 *
 * Separa a malha matemática de renderização das arestas técnicas reais:
 * - REAL_BOUNDARY: Contornos livres, bordas de aberturas e bocas
 * - REAL_EDGE: Arestas vivas, cantos vivos com ângulo diedro real
 * - TRANSITION_GENERATOR: Geratrizes cardinais principais da geometria
 * - BEND_EDGE: Linhas de dobra física da chapa metálica
 * - JOINT: Juntas reais de corte/solda (ex: junções de gomos em curvas, costuras)
 * - INTERSECTION: Curva de interseção 3D calculada entre corpos penetrantes
 * - CONSTRUCTION: Linhas auxiliares de construção e layout
 * - REFERENCE: Eixos de centro e planos de referência
 * - TRIANGULATION_INTERNAL: Diagonais internas da malha matemática (ocultas em SOMB e SOMB+AR)
 * - DIMENSION: Linhas de cota
 * - SELECTION: Entidades destacadas temporariamente
 */
export type EntityKind =
  | "REAL_BOUNDARY"
  | "REAL_EDGE"
  | "TRANSITION_GENERATOR"
  | "BEND_EDGE"
  | "JOINT"
  | "INTERSECTION"
  | "CONSTRUCTION"
  | "REFERENCE"
  | "TRIANGULATION_INTERNAL"
  | "DIMENSION"
  | "SELECTION";

/**
 * Determina se a aresta é tecnicamente significativa para o modo SOMB+AR.
 * Diagonais de triangulação interna e linhas auxiliares de construção retornam false.
 */
export function isSignificantTechnicalEdge(kind: EntityKind): boolean {
  switch (kind) {
    case "REAL_BOUNDARY":
    case "REAL_EDGE":
    case "TRANSITION_GENERATOR":
    case "BEND_EDGE":
    case "JOINT":
    case "INTERSECTION":
      return true;
    case "TRIANGULATION_INTERNAL":
    case "CONSTRUCTION":
    case "REFERENCE":
    case "DIMENSION":
    case "SELECTION":
      return false;
  }
}

export type WireModel = {
  faces: Face[];
  edges: Edge[];
  /** linhas técnicas (eixo, referências) */
  refLines: Edge[];
  /** maior extensão do bounding box (mm) — usada para enquadramento */
  size: number;
  bounds: Bounds;
  slug?: string;
  shadingStyle?: "faceted" | "smooth" | "hybrid";
  /**
   * Vínculo 3D ↔ geometria canônica: marca arestas/faces geradas por uma
   * geratriz da superfície (ordinal `k` de `n` geratrizes espaçadas). Apenas
   * metadado — nunca altera a geometria. A conversão para GeometryRef acontece
   * em `viz3d/selection`, que conhece o desenvolvimento.
   */
  edgeTags?: readonly (WireTag | undefined)[] | undefined;
  faceTags?: readonly (WireTag | undefined)[] | undefined;
  /**
   * Classificação explícita de cada aresta de `edges`.
   * Permite que o renderer exiba apenas arestas significativas em SOMB+AR
   * e preserve as triangulações completas em ARAME.
   */
  edgeKinds?: readonly EntityKind[] | undefined;
};

/** Geratriz ordinal k de n igualmente espaçadas ao redor da seção. */
export type GeratrizTag = { k: number; n: number };

/** Aro de boca (perímetro real) — a mesma entidade do contorno do desenvolvimento. */
export type RimTag = { rim: "base" | "top" };

/** Marca de entidade canônica carregada por aresta/face do wireframe. */
export type WireTag = GeratrizTag | RimTag;

export type WireParams = {
  /** diâmetro / lado maior (base) */
  d1: number;
  /** diâmetro / lado menor (topo) */
  d2: number;
  /** altura */
  h: number;
  /** excentricidade / offset */
  e?: number;
  /** número de divisões da revolução */
  seg?: number;
  /** espessura da chapa (mm) */
  t?: number;
  /** ângulo paramétrico (graus) — derivação, curva de gomos */
  ang?: number;
  /** quantidade paramétrica (gomos) */
  n?: number;
  /** variante do modelo paramétrico */
  mode?: string;
  /** lados independentes da base retangular (Quadrado → Redondo) */
  baseA?: number;
  baseB?: number;
  /** segunda excentricidade no plano da base */
  offsetY?: number;
  /** divisões reais por quadrante usadas pela triangulação */
  divisions?: number;
  /** estratégia de fabricação (Quadrado → Redondo): "single" | "two-weld" */
  strategy?: string;
};

export const DEFAULT_PARAMS: WireParams = {
  d1: 800,
  d2: 400,
  h: 500,
  e: 0,
  seg: 48,
  t: 6,
};

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/* ------------------------------------------------------------------ */
/* 1. VALIDAÇÃO — nunca gerar NaN / Infinity / malha quebrada          */
/* ------------------------------------------------------------------ */

export type ParamIssue = { field: keyof WireParams; message: string };

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

export function validateParameters(p: WireParams): ParamIssue[] {
  const out: ParamIssue[] = [];
  if (!Number.isFinite(p.d1) || p.d1 <= 0)
    out.push({ field: "d1", message: "Diâmetro maior inválido." });
  if (!Number.isFinite(p.d2) || p.d2 < 0)
    out.push({ field: "d2", message: "Diâmetro menor inválido." });
  if (!Number.isFinite(p.h) || p.h <= 0) out.push({ field: "h", message: "Altura inválida." });
  return out;
}

/** Parâmetros saneados: finitos, dentro de limites plausíveis de caldeiraria. */
export function normalizeParameters(p: WireParams): Required<WireParams> {
  const d1 = Math.min(20000, Math.max(1, num(p.d1, DEFAULT_PARAMS.d1)));
  const d2 = Math.min(20000, Math.max(0, num(p.d2, DEFAULT_PARAMS.d2)));
  const h = Math.min(20000, Math.max(1, num(p.h, DEFAULT_PARAMS.h)));
  const e = Math.max(-10000, Math.min(10000, num(p.e, 0)));
  const seg = Math.round(Math.min(72, Math.max(8, num(p.seg, 40))));
  const maxT = Math.max(0.4, Math.min(d1, d2 || d1, h) * 0.08);
  const t = Math.min(maxT, Math.max(0.4, num(p.t, Math.max(2, d1 * 0.008))));
  const ang = Math.min(180, Math.max(1, num(p.ang, 90)));
  const n = Math.round(Math.min(24, Math.max(2, num(p.n, 4))));
  const baseA = Math.min(20000, Math.max(1, num(p.baseA, d1)));
  const baseB = Math.min(20000, Math.max(1, num(p.baseB, d1)));
  const offsetY = Math.max(-10000, Math.min(10000, num(p.offsetY, 0)));
  const divisions = Math.round(Math.min(24, Math.max(3, num(p.divisions, seg / 4))));
  return {
    d1,
    d2,
    h,
    e,
    seg: seg % 4 === 0 ? seg : seg + (4 - (seg % 4)),
    t,
    ang,
    n,
    mode: typeof p.mode === "string" ? p.mode : "",
    baseA,
    baseB,
    offsetY,
    divisions,
    strategy: p.strategy === "two-weld" ? "two-weld" : "single",
  };
}

/* ------------------------------------------------------------------ */
/* 2. PRIMITIVAS DE PERFIL                                             */
/* ------------------------------------------------------------------ */

function ring(r: number, y: number, seg: number, cx = 0, cz = 0): Vec3[] {
  const rr = Math.max(r, 0.001);
  return Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return v(cx + rr * Math.cos(a), y, cz + rr * Math.sin(a));
  });
}

function squareLoop(side: number, y: number, seg: number): Vec3[] {
  const s = Math.max(side, 0.001) / 2;
  const corners: Vec2[] = [
    { x: -s, y: -s },
    { x: s, y: -s },
    { x: s, y: s },
    { x: -s, y: s },
  ];
  const per = Math.max(1, Math.round(seg / 4));
  const out: Vec3[] = [];
  for (let c = 0; c < 4; c++) {
    const a = corners[c]!;
    const b = corners[(c + 1) % 4]!;
    for (let k = 0; k < per; k++) {
      const u = k / per;
      out.push(v(a.x + (b.x - a.x) * u, y, a.y + (b.y - a.y) * u));
    }
  }
  return out;
}

/** Interpolação entre dois contornos de mesma contagem (transições regradas). */
function blend(a: Vec3[], b: Vec3[], u: number, y: number): Vec3[] {
  return a.map((p, i) => {
    const q = b[i]!;
    return v(p.x + (q.x - p.x) * u, y, p.z + (q.z - p.z) * u);
  });
}

function centroid(loop: Vec3[]): Vec3 {
  const c = loop.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y, z: s.z + p.z }), v(0, 0, 0));
  const n = Math.max(1, loop.length);
  return v(c.x / n, c.y / n, c.z / n);
}

/** Contorno interno: deslocamento do contorno externo em direção ao eixo. */
function offsetLoop(loop: Vec3[], t: number): Vec3[] {
  const c = centroid(loop);
  return loop.map((p) => {
    const dx = c.x - p.x;
    const dz = c.z - p.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return p;
    const k = Math.min(t / len, 0.9);
    return v(p.x + dx * k, p.y, p.z + dz * k);
  });
}

/* ------------------------------------------------------------------ */
/* 3. GERAÇÃO DE MALHA                                                 */
/* ------------------------------------------------------------------ */

type ShellOpts = {
  /** espessura da parede (mm) */
  t: number;
  /** fecha a primeira seção (tampa cheia) */
  capStart?: boolean;
  /** fecha a última seção (tampa cheia) */
  capEnd?: boolean;
  /** a cada quantas divisões desenhar uma geratriz */
  gen?: number;
  /** grupo de casca (corpos que se cruzam) */
  g?: number;
  /** Função predicado indicando se o loop s (1 .. length-2) é uma junta real/gomo */
  isJointLoop?: (s: number) => boolean;
  /** Se todas as geratrizes desenhadas devem ser tratadas como geratrizes de transição */
  allGeneratorsAreTransition?: boolean;
};

export type Geo = {
  faces: Face[];
  edges: Edge[];
  edgeTags?: (WireTag | undefined)[] | undefined;
  faceTags?: (WireTag | undefined)[] | undefined;
  edgeKinds?: (EntityKind | undefined)[] | undefined;
};

export const EMPTY_GEO: Geo = { faces: [], edges: [] };

/** Marca todas as faces de uma parte com o grupo de casca informado. */
function tag(geo: Geo, g: number): Geo {
  for (const f of geo.faces) f.g = g;
  return geo;
}

/**
 * RECORTE REAL DE ABERTURA entre dois corpos que se cruzam.
 * Remove do corpo cortado as faces INTEIRAMENTE dentro do volume do corpo
 * penetrante (nenhum vértice é movido — a malha canônica é preservada) e
 * suprime as arestas que cruzariam o vão. A linha de interseção real, quando
 * fornecida, é adicionada como aresta do contorno do furo com identidade INTERSECTION.
 */
function cutOpening(geo: Geo, inside: (p: Vec3) => boolean, curve?: Vec3[]): Geo {
  const mid = (a: Vec3, b: Vec3): Vec3 => v((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const keepF = geo.faces.map((f, i) => ({ f, i })).filter(({ f }) => !f.pts.every(inside));
  const keepE = geo.edges.map((e, i) => ({ e, i })).filter(({ e }) => !inside(mid(e[0], e[1])));
  const faces = keepF.map(({ f }) => f);
  const edges = keepE.map(({ e }) => e);
  const faceTags = geo.faceTags ? keepF.map(({ i }) => geo.faceTags![i]) : undefined;
  const edgeTags = geo.edgeTags ? keepE.map(({ i }) => geo.edgeTags![i]) : undefined;
  const edgeKinds = geo.edgeKinds ? keepE.map(({ i }) => geo.edgeKinds![i]) : undefined;
  if (curve && curve.length > 1) {
    for (let i = 0; i < curve.length - 1; i++) {
      edges.push([curve[i]!, curve[i + 1]!]);
      edgeTags?.push(undefined);
      edgeKinds?.push("INTERSECTION");
    }
  }
  return { faces, edges, edgeTags, faceTags, edgeKinds };
}

function merge(parts: Geo[]): Geo {
  const faces = parts.flatMap((p) => p.faces);
  const edges = parts.flatMap((p) => p.edges);
  const hasET = parts.some((p) => p.edgeTags);
  const hasFT = parts.some((p) => p.faceTags);
  const hasEK = parts.some((p) => p.edgeKinds);
  return {
    faces,
    edges,
    edgeTags: hasET
      ? parts.flatMap(
          (p) => p.edgeTags ?? Array<WireTag | undefined>(p.edges.length).fill(undefined),
        )
      : undefined,
    faceTags: hasFT
      ? parts.flatMap(
          (p) => p.faceTags ?? Array<WireTag | undefined>(p.faces.length).fill(undefined),
        )
      : undefined,
    edgeKinds: hasEK
      ? parts.flatMap(
          (p) => p.edgeKinds ?? Array<EntityKind | undefined>(p.edges.length).fill("REAL_EDGE"),
        )
      : undefined,
  };
}

function loopEdges(pts: Vec3[]): Edge[] {
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]!] as Edge);
}

/**
 * Casca de parede fina a partir de uma sequência de contornos.
 * Gera superfície externa, superfície interna, bordas (rim) das aberturas,
 * tampas quando pedidas, e as arestas técnicas devidamente classificadas.
 */
function shell(loops: Vec3[][], o: ShellOpts): Geo {
  const valid = loops.filter((l) => l.length >= 3);
  if (valid.length < 2) return EMPTY_GEO;
  const inner = valid.map((l) => offsetLoop(l, o.t));
  const faces: Face[] = [];
  const edges: Edge[] = [];
  const faceTags: (WireTag | undefined)[] = [];
  const edgeTags: (WireTag | undefined)[] = [];
  const edgeKinds: (EntityKind | undefined)[] = [];
  const n = valid[0]!.length;
  const gen = Math.max(1, o.gen ?? Math.round(n / 8));
  /* geratrizes traçadas: i = 0, gen, 2·gen … → ordinal k = i/gen de G */
  const G = Math.ceil(n / gen);
  const faceTag = (i: number): GeratrizTag => ({ k: Math.round(i / gen) % G, n: G });

  for (let s = 0; s < valid.length - 1; s++) {
    const a = valid[s]!;
    const b = valid[s + 1]!;
    const ai = inner[s]!;
    const bi = inner[s + 1]!;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push({ pts: [a[i]!, a[j]!, b[j]!, b[i]!], kind: "outer" });
      faceTags.push(faceTag(i));
      faces.push({ pts: [bi[i]!, bi[j]!, ai[j]!, ai[i]!], kind: "inner" });
      faceTags.push(faceTag(i));
    }
  }

  // arestas: contornos extremos (REAL_BOUNDARY)
  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  edges.push(...loopEdges(first));
  edgeTags.push(...Array<WireTag | undefined>(n).fill({ rim: "base" }));
  edgeKinds.push(...Array<EntityKind>(n).fill("REAL_BOUNDARY"));

  edges.push(...loopEdges(last));
  edgeTags.push(...Array<WireTag | undefined>(n).fill({ rim: "top" }));
  edgeKinds.push(...Array<EntityKind>(n).fill("REAL_BOUNDARY"));

  if (!o.capStart) {
    edges.push(...loopEdges(inner[0]!));
    edgeTags.push(...Array<WireTag | undefined>(n).fill(undefined));
    edgeKinds.push(...Array<EntityKind>(n).fill("REAL_BOUNDARY"));
  }
  if (!o.capEnd) {
    edges.push(...loopEdges(inner[inner.length - 1]!));
    edgeTags.push(...Array<WireTag | undefined>(n).fill(undefined));
    edgeKinds.push(...Array<EntityKind>(n).fill("REAL_BOUNDARY"));
  }

  // Juntas de corte/solda entre gomos intermediários (JOINT)
  if (o.isJointLoop) {
    for (let s = 1; s < valid.length - 1; s++) {
      if (o.isJointLoop(s)) {
        edges.push(...loopEdges(valid[s]!));
        edgeTags.push(...Array<WireTag | undefined>(n).fill(undefined));
        edgeKinds.push(...Array<EntityKind>(n).fill("JOINT"));
      }
    }
  }

  // Geratrizes longitudinais:
  // Cardinais principais (0, n/4, n/2, 3n/4) são TRANSITION_GENERATOR
  // Demais subdivisões de malha são TRIANGULATION_INTERNAL (ocultas em SOMB+AR)
  const q1 = Math.round(n / 4);
  const q2 = Math.round(n / 2);
  const q3 = Math.round((3 * n) / 4);
  for (let i = 0; i < n; i += gen) {
    const isCardinal =
      o.allGeneratorsAreTransition ||
      i === 0 ||
      Math.abs(i - q1) <= 1 ||
      Math.abs(i - q2) <= 1 ||
      Math.abs(i - q3) <= 1;
    const kind: EntityKind = isCardinal ? "TRANSITION_GENERATOR" : "TRIANGULATION_INTERNAL";
    const t0: GeratrizTag = { k: i / gen, n: G };
    for (let s = 0; s < valid.length - 1; s++) {
      edges.push([valid[s]![i]!, valid[s + 1]![i]!]);
      edgeTags.push(t0);
      edgeKinds.push(kind);
    }
  }

  // bordas das aberturas (espessura visível)
  const rim = (out: Vec3[], inn: Vec3[]) => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push({ pts: [out[i]!, out[j]!, inn[j]!, inn[i]!], kind: "rim" });
      faceTags.push(undefined);
    }
  };
  if (o.capStart) {
    faces.push({ pts: first, kind: "cap" });
    faceTags.push(undefined);
  } else rim(first, inner[0]!);
  if (o.capEnd) {
    faces.push({ pts: last, kind: "cap" });
    faceTags.push(undefined);
  } else rim(last, inner[inner.length - 1]!);

  return { faces, edges, edgeTags, faceTags, edgeKinds };
}

export function boundsOf(faces: Face[]): Bounds {
  const min = v(Infinity, Infinity, Infinity);
  const max = v(-Infinity, -Infinity, -Infinity);
  for (const f of faces)
    for (const p of f.pts) {
      min.x = Math.min(min.x, p.x);
      min.y = Math.min(min.y, p.y);
      min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x);
      max.y = Math.max(max.y, p.y);
      max.z = Math.max(max.z, p.z);
    }
  if (!Number.isFinite(min.x)) return { min: v(-1, -1, -1), max: v(1, 1, 1) };
  return { min, max };
}

/**
 * Normais da malha (equivalente a `computeVertexNormals`): executado UMA vez,
 * depois que todas as faces de todas as partes já estão definidas. Newell
 * suporta polígonos não triangulares e faces levemente não planares.
 */
export function computeFaceNormals(faces: Face[]): void {
  for (const f of faces) {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    const pts = f.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      nx += (a.y - b.y) * (a.z + b.z);
      ny += (a.z - b.z) * (a.x + b.x);
      nz += (a.x - b.x) * (a.y + b.y);
    }
    const len = Math.hypot(nx, ny, nz);
    f.n = len > 1e-9 ? v(nx / len, ny / len, nz / len) : undefined;
  }
}

export function finish(geo: Geo, refLines: Edge[] = []): WireModel {
  // Rejeita faces degeneradas (<3 pontos ou área praticamente nula) em vez de atribuir normais artificiais
  geo.faces = geo.faces.filter((f) => {
    if (!f.pts || f.pts.length < 3) return false;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < f.pts.length; i++) {
      const a = f.pts[i]!;
      const b = f.pts[(i + 1) % f.pts.length]!;
      nx += (a.y - b.y) * (a.z + b.z);
      ny += (a.z - b.z) * (a.x + b.x);
      nz += (a.x - b.x) * (a.y + b.y);
    }
    return Math.hypot(nx, ny, nz) > 1e-9;
  });

  // 1. malha completa → 2. normais → 3. bounding box (nesta ordem, sempre)
  computeFaceNormals(geo.faces);
  const bounds = boundsOf(geo.faces);
  const size =
    Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    ) || 1;

  const edgeKinds: EntityKind[] = geo.edges.map((_, idx) => {
    if (geo.edgeKinds && geo.edgeKinds[idx]) return geo.edgeKinds[idx]!;
    const tag = geo.edgeTags ? geo.edgeTags[idx] : undefined;
    if (tag && "rim" in tag) return "REAL_BOUNDARY";
    if (tag && "k" in tag) {
      const gTag = tag as GeratrizTag;
      const isCardinal = gTag.k % Math.max(1, Math.round(gTag.n / 4)) === 0;
      return isCardinal ? "TRANSITION_GENERATOR" : "TRIANGULATION_INTERNAL";
    }
    return "REAL_EDGE";
  });

  return {
    faces: geo.faces,
    edges: geo.edges,
    refLines,
    size,
    bounds,
    edgeTags: geo.edgeTags,
    faceTags: geo.faceTags,
    edgeKinds,
  };
}

/** Eixo da peça + linha de base: referências geométricas reais. */
function axisLines(b: Bounds): Edge[] {
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const pad = (b.max.y - b.min.y) * 0.12;
  return [[v(cx, b.min.y - pad, cz), v(cx, b.max.y + pad, cz)]];
}

/* ------------------------------------------------------------------ */
/* 4. MODELOS PARAMÉTRICOS                                             */
/* ------------------------------------------------------------------ */

/** Sequência de contornos de um tronco (base → topo), com excentricidade. */
function frustumLoops(r1: number, r2: number, h: number, seg: number, ex: number, steps = 2) {
  const y0 = -h / 2;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    return ring(r1 + (r2 - r1) * u, y0 + h * u, seg, ex * u, 0);
  });
}

/** Constrói a geometria 3D real da peça a partir dos parâmetros. */
export function buildWire(slug: string, raw: WireParams): WireModel {
  const p = normalizeParameters(raw);
  const { seg, t } = p;
  const h = p.h;
  const r1 = p.d1 / 2;
  const r2 = p.d2 / 2;
  const y0 = -h / 2;
  const y1 = h / 2;


  const withAxis = (geo: Geo, extraRefs: Edge[] = []) => {
    const m = finish(geo);
    return {
      ...m,
      slug,
      shadingStyle: getModelShadingStyle(slug),
      refLines: [...axisLines(m.bounds), ...extraRefs],
    };
  };

  switch (slug) {
    case "cilindro":
    case "dutos":
      return withAxis(shell(frustumLoops(r1, r1, h, seg, 0, 2), { t }));

    case "cone": {
      // ápice modelado com raio mínimo: evita triângulos degenerados
      const tip = Math.max(r1 * 0.012, t * 0.6);
      return withAxis(shell(frustumLoops(r1, tip, h, seg, 0, 3), { t }));
    }

    case "tronco-de-cone":
    case "reducao-circular":
    case "chamines":
      return withAxis(shell(frustumLoops(r1, r2, h, seg, 0, 2), { t }));

    case "cone-excentrico":
      return withAxis(shell(frustumLoops(r1, r2, h, seg, r1 - r2, 3), { t }));

    case "quadrado-redondo":
    case "transicoes": {
      const canonical = buildSquareToRoundModel({
        baseA: p.baseA,
        baseB: p.baseB,
        topDiameter: p.d2,
        height: p.h,
        offsetX: p.e,
        offsetY: p.offsetY,
        divisions: p.divisions,
        thickness: p.t,
        density: 7.85,
        strategy: p.strategy === "two-weld" ? "two-weld" : "single",
      });
      const cv = (q: Vec3) => v(q.x, q.z - p.h / 2, q.y);
      const inset = (q: Vec3) => {
        if (q.z === 0) {
          const x = Math.sign(q.x) * Math.max(0, Math.abs(q.x) - p.t);
          const z = Math.sign(q.y) * Math.max(0, Math.abs(q.y) - p.t);
          return v(x, -p.h / 2, z);
        }
        const dx = q.x - p.e;
        const dz = q.y - p.offsetY;
        const radius = Math.hypot(dx, dz);
        const ratio = radius > 0 ? Math.max(0, radius - p.t) / radius : 1;
        return v(p.e + dx * ratio, p.h / 2, p.offsetY + dz * ratio);
      };
      const faces: Face[] = [];
      const edges: Edge[] = [];
      const edgeTags: (WireTag | undefined)[] = [];
      const edgeKinds: EntityKind[] = [];
      const genN = canonical.generatrices.length;
      for (const face of canonical.faces) {
        const outer = face.points.map(cv);
        const inner = face.points.map((q) => inset(q));
        faces.push({ pts: outer, kind: "outer" });
        faces.push({ pts: inner.slice().reverse(), kind: "inner" });
      }

      // 1. Geratrizes: as que dividem as faces planas dos cantos curvos (as 4 dobras principais dos cantos)
      // são BEND_EDGE. As internas de subdivisão do quadrante são TRIANGULATION_INTERNAL.
      const divisionsPerQuadrant = p.divisions ?? 6;
      canonical.generatrices.forEach((line, i) => {
        edges.push([cv(line.a), cv(line.b)]);
        edgeTags.push({ k: i, n: genN });
        // O início e fim de cada quadrante (onde a face plana triangular toca o setor de transição curva)
        // é a linha de dobra física (BEND_EDGE). Os raios internos são triangulação matemática (TRIANGULATION_INTERNAL).
        const mod = i % (divisionsPerQuadrant + 1);
        const isBend = mod === 0 || mod === divisionsPerQuadrant;
        edgeKinds.push(isBend ? "BEND_EDGE" : "TRIANGULATION_INTERNAL");
      });

      // 2. Base retangular: 4 arestas externas (REAL_BOUNDARY)
      for (let k = 0; k < canonical.corners.length; k++) {
        const a = canonical.corners[k];
        const b = canonical.corners[(k + 1) % canonical.corners.length];
        if (!a || !b) continue;
        const ao = cv(a);
        const bo = cv(b);
        faces.push({ pts: [ao, bo, inset(b), inset(a)], kind: "rim" });
        edges.push([ao, bo]);
        edgeTags.push({ rim: "base" });
        edgeKinds.push("REAL_BOUNDARY");
      }

      // 3. Topo circular: aro superior (REAL_BOUNDARY)
      for (let k = 0; k < canonical.circle.length; k++) {
        const a = canonical.circle[k];
        const b = canonical.circle[(k + 1) % canonical.circle.length];
        if (!a || !b) continue;
        const ao = cv(a);
        const bo = cv(b);
        faces.push({ pts: [ao, bo, inset(b), inset(a)], kind: "rim" });
        edges.push([ao, bo]);
        edgeTags.push({ rim: "top" });
        edgeKinds.push("REAL_BOUNDARY");
      }

      // Emendas soldadas (modo 2 partes + solda): posição real das costuras J1/J2.
      const seamRefs: Edge[] = [];
      if (p.strategy === "two-weld") {
        const midpoint = (
          a: (typeof canonical.corners)[number],
          b: (typeof canonical.corners)[number],
        ) => ({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          z: 0,
        });
        const s1: Edge = [
          cv(midpoint(canonical.corners[0]!, canonical.corners[1]!)),
          cv(canonical.arcPoints[0]!.at(-1)!),
        ];
        const s2: Edge = [
          cv(midpoint(canonical.corners[2]!, canonical.corners[3]!)),
          cv(canonical.arcPoints[2]!.at(-1)!),
        ];
        seamRefs.push(s1, s2);
        edges.push(s1, s2);
        edgeTags.push(undefined, undefined);
        edgeKinds.push("JOINT", "JOINT");
      }

      return withAxis({ faces, edges, edgeTags, edgeKinds }, seamRefs);
    }

    case "redondo-quadrado": {
      const steps = 8;
      const ci = ring(r1, y0, seg);
      const sq = squareLoop(p.d2, y1, seg);
      const loops = Array.from({ length: steps + 1 }, (_, i) => {
        const u = i / steps;
        return blend(ci, sq, u, y0 + h * u);
      });
      return withAxis(shell(loops, { t }));
    }

    case "boca-de-lobo": {
      if (p.mode === "branch") {
        /*
         * Boca de lobo real: tubo principal (eixo X) + derivação inclinada,
         * cortada exatamente pela linha de interseção calculada em
         * `geometry/branch` — a mesma equação da planificação.
         */
        const input = {
          mainDiameter: p.d1,
          branchDiameter: p.d2,
          angleDeg: p.ang,
          offset: p.e,
          branchLength: Math.max(p.h, p.d1 * 0.6),
          divisions: seg,
        };
        const R = p.d1 / 2;
        const rb = p.d2 / 2;
        const a = (p.ang * Math.PI) / 180;
        const half = Math.max(p.d1 * 0.9, rb * 3);
        const mainLoops = [-half, -half / 2, 0, half / 2, half].map((x) =>
          Array.from({ length: seg }, (_, i) => {
            const φ = (i / seg) * Math.PI * 2;
            return v(x, R * Math.cos(φ), R * Math.sin(φ));
          }),
        );
        const main = tag(shell(mainLoops, { t }), 0);

        const steps = 5;
        const branchLoops = Array.from({ length: steps + 1 }, (_, s) => {
          const u = s / steps;
          return Array.from({ length: seg }, (_, i) => {
            const θ = (i / seg) * Math.PI * 2;
            const t0 = branchAxisLength(input, θ);
            const tt = t0 + (input.branchLength - t0) * u;
            return v(
              tt * Math.cos(a) - rb * Math.sin(θ) * Math.sin(a),
              tt * Math.sin(a) + rb * Math.sin(θ) * Math.cos(a),
              p.e + rb * Math.cos(θ),
            );
          });
        });
        const branch = tag(shell(branchLoops, { t }), 1);

        /*
         * FURO REAL no tubo principal: a linha de interseção calculada em
         * `geometry/branch` (a mesma da planificação do furo) define o volume
         * do ramal; as faces do tubo inteiramente dentro dele são removidas
         * e a curva vira o contorno da abertura. Nenhum vértice é movido.
         */
        const bm = branchIntersection(input);
        const ax = Math.cos(a);
        const ay = Math.sin(a);
        const insideBranch = (q: Vec3) => {
          const s = q.x * ax + q.y * ay;
          if (s < -t) return false;
          const px = q.x - s * ax;
          const py = q.y - s * ay;
          return Math.hypot(px, py, q.z - p.e) < rb - t * 0.25;
        };
        const cutMain = cutOpening(
          main,
          insideBranch,
          bm.curve.map((c) => c.p),
        );
        return withAxis(merge([cutMain, branch]));
      }
      // cilindro cortado por plano inclinado: altura varia com z
      const steps = 6;
      const base = ring(r1, y0, seg);
      const top = base.map((q) => v(q.x, y0 + h * (0.4 + 0.6 * ((q.z / r1 + 1) / 2)), q.z));
      const loops = Array.from({ length: steps + 1 }, (_, i) => {
        const u = i / steps;
        return base.map((q, k) => v(q.x, q.y + (top[k]!.y - q.y) * u, q.z));
      });
      return withAxis(shell(loops, { t }));
    }

    case "te":
    case "interseccoes": {
      const main = tag(shell(frustumLoops(r1, r1, h, seg, 0, 2), { t }), 0);
      const armLen = r1 + h * 0.45;
      const branch = tag(
        shell(
          Array.from({ length: 5 }, (_, i) => {
            const z = r1 * 0.2 + (armLen - r1 * 0.2) * (i / 4);
            return ring(r2, 0, seg).map((q) => v(q.x, q.z, z));
          }),
          { t },
        ),
        1,
      );
      // Furo real no tubo: interseção analítica cilindro ⊥ cilindro.
      const curve: Vec3[] = Array.from({ length: seg + 1 }, (_, i) => {
        const θ = (i / seg) * Math.PI * 2;
        const x = r2 * Math.sin(θ);
        return v(x, r2 * Math.cos(θ), Math.sqrt(Math.max(r1 * r1 - x * x, 0)));
      });
      const cutMain = cutOpening(
        main,
        (q) => q.z > -t && Math.hypot(q.x, q.y) < r2 - t * 0.25,
        curve,
      );
      return withAxis(merge([cutMain, branch]));
    }

    case "y": {
      const half = h / 2;
      const trunk = shell(
        Array.from({ length: 4 }, (_, i) => ring(r1, y0 + (half * i) / 3, seg)),
        { t },
      );
      const arm = (dir: number) =>
        shell(
          Array.from({ length: 5 }, (_, i) => {
            const u = i / 4;
            return ring(r1 + (r2 - r1) * u, half * u, seg, dir * r1 * 0.8 * u, 0).map((q) =>
              v(q.x, q.y, q.z),
            );
          }),
          { t },
        );
      return withAxis(merge([trunk, arm(-1), arm(1)]));
    }

    case "curva-de-gomos": {
      /*
       * Curva de gomos real: a linha de centro e os planos de corte vêm de
       * `geometry/elbowSegments` — as mesmas peças da planificação.
       * O ângulo total e a quantidade de gomos são parâmetros.
       */
      const model = elbowModel({
        diameter: p.d2,
        radius: p.d1,
        angleDeg: p.ang,
        gores: p.n,
        divisions: seg,
      });
      const rb = p.d2 / 2;
      const beta = model.beta;
      const k = 1 / Math.max(Math.cos(beta), 0.15);
      const loops: Vec3[][] = [];
      model.centerline.forEach((c, j) => {
        const prev = model.segments[j - 1];
        const next = model.segments[j];
        const dirs = [prev?.rotationDeg, next?.rotationDeg].filter(
          (x) => x !== undefined,
        ) as number[];
        const φm = ((dirs.reduce((s, x) => s + x, 0) / dirs.length) * Math.PI) / 180;
        const mitred = dirs.length === 2;
        const ax = mitred ? k : 1;
        loops.push(
          Array.from({ length: seg }, (_, i) => {
            const θ = (i / seg) * Math.PI * 2;
            const s = rb * ax * Math.sin(θ);
            return v(c.x - s * Math.sin(φm), c.y + s * Math.cos(φm), rb * Math.cos(θ));
          }),
        );
      });
      // Loops intermediários são as juntas de corte/solda entre os gomos: JOINT
      return withAxis(shell(loops, { t, isJointLoop: (s) => s > 0 && s < loops.length - 1 }));
    }

    case "flanges": {
      const thick = Math.max(h * 0.12, t * 2);
      const disc = shell([ring(r1, -thick / 2, seg), ring(r1, thick / 2, seg)], {
        t: Math.max(r1 - r2, t),
      });
      const holes = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const c = (r1 + r2) / 2;
        const rr = Math.max(r1 * 0.07, 2);
        return shell(
          [
            ring(rr, -thick / 2, 12, c * Math.cos(a), c * Math.sin(a)),
            ring(rr, thick / 2, 12, c * Math.cos(a), c * Math.sin(a)),
          ],
          { t: rr * 0.9 },
        );
      });
      return withAxis(merge([disc, ...holes]));
    }

    case "tampas": {
      const lip = Math.max(h * 0.18, t * 3);
      return withAxis(shell([ring(r1, y0, seg), ring(r1, y0 + lip, seg)], { t, capStart: true }));
    }

    case "calotas": {
      const layers = 8;
      const loops = Array.from({ length: layers + 1 }, (_, i) => {
        const a = ((i / layers) * Math.PI) / 2;
        return ring(Math.max(r1 * Math.cos(a), r1 * 0.02), y0 + h * Math.sin(a), seg);
      });
      return withAxis(shell(loops, { t }));
    }

    default:
      return withAxis(shell(frustumLoops(r1, r2, h, seg, 0, 2), { t }));
  }
}

/* ------------------------------------------------------------------ */
/* 5. CÂMERA (apresentação — nunca altera a geometria)                 */
/* ------------------------------------------------------------------ */

export type Camera = {
  yaw: number;
  pitch: number;
  zoom: number;
  panX?: number;
  panY?: number;
};

/** Projeção ortográfica com rotação yaw/pitch e translação pan. Retorna coordenadas de tela. */
export function project(pt: Vec3, cam: Camera, scale: number): Vec2 & { depth: number } {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const x1 = pt.x * cy - pt.z * sy;
  const z1 = pt.x * sy + pt.z * cy;
  const y1 = pt.y * cp - z1 * sp;
  const z2 = pt.y * sp + z1 * cp;
  const k = scale * cam.zoom;
  return {
    x: x1 * k + (cam.panX ?? 0),
    y: -y1 * k + (cam.panY ?? 0),
    depth: z2,
  };
}

/**
 * Enquadramento automático: raio necessário para conter a peça em qualquer
 * ângulo de rotação (bounding sphere do bounding box real).
 */
export function fitRadius(b: Bounds): number {
  const cx = (b.min.x + b.max.x) / 2;
  const cy = (b.min.y + b.max.y) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const rx = Math.max(b.max.x - cx, cx - b.min.x);
  const ry = Math.max(b.max.y - cy, cy - b.min.y);
  const rz = Math.max(b.max.z - cz, cz - b.min.z);
  return Math.max(Math.hypot(rx, rz), ry, 0.001);
}

/** Centro geométrico real da peça (usado como alvo da câmera). */
export function centerOf(b: Bounds): Vec3 {
  return v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
}
