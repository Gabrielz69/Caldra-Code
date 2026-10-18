/**
 * REGISTRO ÚNICO DE MODELOS DA BIBLIOTECA (TRAÇAGEM).
 *
 * Fonte única de verdade sobre "o que existe" na biblioteca: caldeiraria,
 * tubulações e CNC 2D. Um modelo pode aparecer em várias listas (todas,
 * família, recentes, favoritos) — sempre pela mesma referência (`id`).
 *
 * PROIBIDO: duplicar matemática. Modelos paramétricos apontam para o
 * `engineSlug` já existente (ParametricGeometryEngine / engines.ts);
 * modelos vetoriais apontam para um gerador de `@/lib/cnc2d/generators`.
 */

import { GEOMETRIES } from "@/lib/geometry/catalog";
import type { Feature } from "@/lib/subscription/features";

export type PartCategory = "caldeiraria" | "tubulacoes" | "cnc2d";

export type Capability = "3d" | "top-view" | "planification" | "2d" | "chamfer" | "cnc";

export type PartModel = {
  id: string;
  name: string;
  category: PartCategory;
  /** Família dentro da categoria (2º e último nível de navegação). */
  family: string;
  kind: "parametric" | "vector";
  /** Modelo paramétrico: slug da engine existente (`/tracagem/$slug`). */
  engineSlug?: string;
  /** Modelo vetorial: id do gerador CNC 2D. */
  generator?: string;
  summary: string;
  /** Linhas curtas exibidas no card (ex.: "800 → 400", "H 500 mm"). */
  specs: string[];
  tags: string[];
  capabilities: Capability[];
  feature: Feature;
  level?: string;
  /** Preview no card: modelo 3D da engine ou vetor 2D do gerador. */
  preview: { mode: "wire3d"; slug: string } | { mode: "vector"; generator: string };
};

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  caldeiraria: "Caldeiraria",
  tubulacoes: "Tubulações",
  cnc2d: "CNC 2D",
};

/* ------------------------------------------------------------------ */
/* Caldeiraria — deriva do catálogo existente (não remove nada)        */
/* ------------------------------------------------------------------ */

type CaldMeta = { family: string; tags: string[]; specs?: string[] };

const CALD: Record<string, CaldMeta> = {
  "quadrado-redondo": {
    family: "Transições",
    tags: ["transição", "quadrado", "redondo", "triangulação"],
  },
  transicoes: { family: "Transições", tags: ["transição", "retangular", "especial"] },
  "redondo-quadrado": { family: "Transições", tags: ["transição", "redondo", "quadrado"] },
  cone: { family: "Cones", tags: ["cone", "radial", "setor"] },
  "tronco-de-cone": { family: "Cones", tags: ["cone", "tronco", "redução", "concêntrica"] },
  "cone-excentrico": { family: "Cones", tags: ["cone", "excêntrico", "oblíquo", "redução"] },
  cilindro: { family: "Cilíndricas", tags: ["cilindro", "virola", "tubo", "anel"] },
  dutos: { family: "Cilíndricas", tags: ["duto", "trecho", "tubo"] },
  chamines: { family: "Cilíndricas", tags: ["chaminé", "virola", "composição"] },
  "curva-de-gomos": { family: "Curvas", tags: ["curva", "gomos", "joelho", "cotovelo"] },
  "boca-de-lobo": { family: "Interseções", tags: ["boca de lobo", "derivação", "oblíqua"] },
  te: { family: "Interseções", tags: ["tê", "derivação", "interseção"] },
  y: { family: "Interseções", tags: ["y", "bifurcação", "ramificação"] },
  interseccoes: { family: "Interseções", tags: ["interseção", "penetração"] },
  flanges: { family: "Flanges", tags: ["flange", "furação", "furos"] },
  "reducao-circular": { family: "Cones", tags: ["redução", "circular", "concêntrica"] },
  tampas: { family: "Flanges", tags: ["tampa", "fundo"] },
  calotas: { family: "Flanges", tags: ["calota", "gomos", "esférica"] },
};

const CALD_CAPS: Capability[] = ["3d", "top-view", "planification", "chamfer"];

const caldeiraria: PartModel[] = GEOMETRIES.map((g) => {
  const meta = CALD[g.slug] ?? { family: "Transições", tags: [] };
  return {
    id: `cald.${g.slug}`,
    name: g.name,
    category: "caldeiraria" as const,
    family: meta.family,
    kind: "parametric" as const,
    engineSlug: g.slug,
    summary: g.short,
    specs: [g.method],
    tags: [g.name.toLowerCase(), g.method.toLowerCase(), ...meta.tags],
    capabilities: CALD_CAPS,
    feature: g.feature,
    level: g.level,
    preview: { mode: "wire3d" as const, slug: g.slug },
  };
});

/* ------------------------------------------------------------------ */
/* Tubulações — mesma engine, leitura orientada a tubo                 */
/* ------------------------------------------------------------------ */

type TubeDef = {
  id: string;
  name: string;
  family: string;
  slug: string;
  summary: string;
  specs: string[];
  tags: string[];
  feature?: Feature;
};

const TUBES: TubeDef[] = [
  {
    id: "tub.tubo-reto",
    name: "Tubo Reto",
    family: "Tubos",
    slug: "cilindro",
    summary: "Trecho reto: desenvolvimento retangular pelo perímetro.",
    specs: ["Ø externo · comprimento"],
    tags: ["tubo", "reto", "virola", "dn", "nps"],
  },
  {
    id: "tub.desenvolvimento",
    name: "Desenvolvimento de Tubo",
    family: "Tubos",
    slug: "dutos",
    summary: "Trecho de duto com perímetro e emendas.",
    specs: ["Perímetro médio"],
    tags: ["duto", "desenvolvimento", "tubo"],
  },
  {
    id: "tub.curva-gomos",
    name: "Curva de Gomos",
    family: "Curvas",
    slug: "curva-de-gomos",
    summary: "Uma família: ângulo total e quantidade de gomos são parâmetros.",
    specs: ["Ângulo livre · n gomos"],
    tags: [
      "curva",
      "gomos",
      "joelho",
      "cotovelo",
      "1 gomo",
      "2 gomos",
      "3 gomos",
      "4 gomos",
      "5 gomos",
      "múltiplos",
      "raio",
    ],
  },
  {
    id: "tub.boca-de-lobo",
    name: "Boca de Lobo",
    family: "Interseções",
    slug: "boca-de-lobo",
    summary: "Corte oblíquo ou derivação em tubo: o método é escolhido pelos parâmetros.",
    specs: ["Ângulo livre · tubo × tubo"],
    tags: [
      "boca de lobo",
      "derivação",
      "interseção",
      "corte",
      "angular",
      "oblíquo",
      "30°",
      "45°",
      "60°",
      "90°",
    ],
  },

  {
    id: "tub.tubo-tubo",
    name: "Tubo × Tubo",
    family: "Interseções",
    slug: "te",
    summary: "Interseção ortogonal entre tubos de mesmo eixo.",
    specs: ["90°"],
    tags: ["tê", "tubo", "interseção", "ortogonal"],
  },
  {
    id: "tub.derivacao",
    name: "Derivação Angular",
    family: "Interseções",
    slug: "interseccoes",
    summary: "Penetração com ângulo livre entre tubos.",
    specs: ["Ângulo livre"],
    tags: ["derivação", "penetração", "ângulo"],
  },
  {
    id: "tub.ramificacao",
    name: "Ramificação Y",
    family: "Interseções",
    slug: "y",
    summary: "Bifurcação simétrica de dutos.",
    specs: ["Bifurcação"],
    tags: ["y", "ramificação", "bifurcação"],
  },
  {
    id: "tub.reducao-concentrica",
    name: "Redução Concêntrica",
    family: "Reduções",
    slug: "reducao-circular",
    summary: "Redução entre dois diâmetros pelo método radial.",
    specs: ["Ø maior → Ø menor"],
    tags: ["redução", "concêntrica", "circular"],
  },
  {
    id: "tub.reducao-excentrica",
    name: "Redução Excêntrica",
    family: "Reduções",
    slug: "cone-excentrico",
    summary: "Redução descentralizada por triangulação.",
    specs: ["Eixos deslocados"],
    tags: ["redução", "excêntrica", "descentralizada"],
    feature: "geometry.advanced",
  },
  {
    id: "tub.circular-retangular",
    name: "Circular → Retangular",
    family: "Reduções",
    slug: "redondo-quadrado",
    summary: "Transição de seção circular para retangular.",
    specs: ["Triangulação"],
    tags: ["transição", "circular", "retangular"],
    feature: "geometry.advanced",
  },
  {
    id: "tub.flange",
    name: "Flange de Tubulação",
    family: "Conexões",
    slug: "flanges",
    summary: "Furação e traçagem de flange para tubo.",
    specs: ["Furação angular"],
    tags: ["flange", "conexão", "furos", "dn", "nps"],
    feature: "geometry.advanced",
  },
  {
    id: "tub.tampa",
    name: "Tampa / Fundo",
    family: "Conexões",
    slug: "tampas",
    summary: "Tampa plana ou conformada para extremidade.",
    specs: ["Ø externo"],
    tags: ["tampa", "fundo", "conexão"],
  },
  {
    id: "tub.calota",
    name: "Calota",
    family: "Conexões",
    slug: "calotas",
    summary: "Calota esférica em gomos e disco central.",
    specs: ["Gomos + disco"],
    tags: ["calota", "esférica", "gomos"],
    feature: "geometry.advanced",
  },
  {
    id: "tub.pescoco",
    name: "Pescoço / Virola",
    family: "Conexões",
    slug: "cilindro",
    summary: "Virola curta de ligação entre conexões.",
    specs: ["Ø × altura"],
    tags: ["pescoço", "virola", "anel", "conexão"],
  },
];

const tubulacoes: PartModel[] = TUBES.map((t) => ({
  id: t.id,
  name: t.name,
  category: "tubulacoes",
  family: t.family,
  kind: "parametric",
  engineSlug: t.slug,
  summary: t.summary,
  specs: t.specs,
  tags: [t.name.toLowerCase(), ...t.tags],
  capabilities: CALD_CAPS,
  feature: t.feature ?? "geometry.basic",
  preview: { mode: "wire3d", slug: t.slug },
}));

/* ------------------------------------------------------------------ */
/* CNC 2D — geometria vetorial real                                    */
/* ------------------------------------------------------------------ */

type CncDef = {
  id: string;
  name: string;
  family: string;
  generator: string;
  summary: string;
  specs: string[];
  tags: string[];
  feature?: Feature;
};

const CNC: CncDef[] = [
  {
    id: "cnc.retangulo",
    name: "Retângulo",
    family: "Chapas",
    generator: "chapa-retangular",
    summary: "Chapa retangular com raio de canto opcional.",
    specs: ["400 × 250 mm"],
    tags: ["chapa", "retângulo", "placa"],
  },
  {
    id: "cnc.circulo",
    name: "Círculo",
    family: "Chapas",
    generator: "chapa-circular",
    summary: "Disco com furo central opcional.",
    specs: ["Ø300 mm"],
    tags: ["chapa", "círculo", "disco", "anel"],
  },
  {
    id: "cnc.triangulo",
    name: "Triângulo",
    family: "Chapas",
    generator: "chapa-triangular",
    summary: "Chapa triangular por base e altura.",
    specs: ["Base × altura"],
    tags: ["chapa", "triângulo"],
  },
  {
    id: "cnc.poligono",
    name: "Polígono",
    family: "Chapas",
    generator: "chapa-poligonal",
    summary: "Polígono regular de 3 a 24 lados.",
    specs: ["n lados · Ø circunscrito"],
    tags: ["chapa", "polígono", "hexágono", "octógono"],
  },
  {
    id: "cnc.furo",
    name: "Furo Simples",
    family: "Furos",
    generator: "furo-simples",
    summary: "Furo com linhas de centro para marcação.",
    specs: ["Ø20 mm"],
    tags: ["furo", "broca"],
  },
  {
    id: "cnc.matriz-furos",
    name: "Matriz de Furos",
    family: "Furos",
    generator: "matriz-furos",
    summary: "Malha retangular de furos numa chapa.",
    specs: ["Colunas × linhas"],
    tags: ["furos", "matriz", "malha", "furação retangular"],
  },
  {
    id: "cnc.furacao-circular",
    name: "Furação Circular",
    family: "Furos",
    generator: "furacao-circular",
    summary: "Furos igualmente espaçados num círculo de centros.",
    specs: ["8 furos · BC 300"],
    tags: ["furação", "circular", "bolt circle", "furos"],
  },
  {
    id: "cnc.rasgo-oblongo",
    name: "Rasgo Oblongo",
    family: "Rasgos",
    generator: "rasgo-oblongo",
    summary: "Oblongo com extremidades em arco, em qualquer ângulo.",
    specs: ["120 × 20 mm"],
    tags: ["rasgo", "oblongo", "slot"],
  },
  {
    id: "cnc.slot",
    name: "Slot em Chapa",
    family: "Rasgos",
    generator: "slot",
    summary: "Chapa com rasgo central passante.",
    specs: ["Chapa + rasgo"],
    tags: ["slot", "rasgo", "chapa"],
  },
  {
    id: "cnc.suporte-l",
    name: "Suporte L",
    family: "Suportes",
    generator: "suporte-l",
    summary: "Cantoneira em L com furos de fixação.",
    specs: ["2 furos"],
    tags: ["suporte", "l", "cantoneira", "furos"],
  },
  {
    id: "cnc.suporte-u",
    name: "Suporte U",
    family: "Suportes",
    generator: "suporte-u",
    summary: "Perfil U planificado para dobra.",
    specs: ["Abas simétricas"],
    tags: ["suporte", "u", "perfil"],
  },
  {
    id: "cnc.esquadro",
    name: "Esquadro",
    family: "Suportes",
    generator: "esquadro",
    summary: "Esquadro triangular com alívio no vértice.",
    specs: ["Catetos livres"],
    tags: ["esquadro", "reforço", "gusset"],
  },
  {
    id: "cnc.base",
    name: "Base Furada",
    family: "Suportes",
    generator: "base-furada",
    summary: "Base com quatro furos e cantos arredondados.",
    specs: ["4 furos"],
    tags: ["base", "suporte", "chumbador", "4 furos"],
  },
  {
    id: "cnc.flange-circular",
    name: "Flange Circular",
    family: "Flanges CNC",
    generator: "flange-circular-cnc",
    summary: "Flange com passagem central e círculo de furos.",
    specs: ["Ø500 · 8 furos"],
    tags: ["flange", "circular", "furos", "ø500"],
  },
  {
    id: "cnc.flange-retangular",
    name: "Flange Retangular",
    family: "Flanges CNC",
    generator: "flange-retangular-cnc",
    summary: "Flange de chapa com passagem circular.",
    specs: ["400 × 300 mm"],
    tags: ["flange", "retangular", "furos"],
    feature: "geometry.advanced",
  },
  {
    id: "cnc.flange-oval",
    name: "Flange Oval",
    family: "Flanges CNC",
    generator: "flange-oval",
    summary: "Flange oblonga com dois furos de aperto.",
    specs: ["420 × 220 mm"],
    tags: ["flange", "oval", "oblonga"],
    feature: "geometry.advanced",
  },
];

const cnc2d: PartModel[] = CNC.map((c) => ({
  id: c.id,
  name: c.name,
  category: "cnc2d",
  family: c.family,
  kind: "vector",
  generator: c.generator,
  summary: c.summary,
  specs: c.specs,
  tags: [c.name.toLowerCase(), ...c.tags],
  capabilities: ["2d", "chamfer", "cnc"],
  feature: c.feature ?? "geometry.basic",
  preview: { mode: "vector", generator: c.generator },
}));

export const PART_REGISTRY: PartModel[] = [...caldeiraria, ...tubulacoes, ...cnc2d];

const BY_ID = new Map(PART_REGISTRY.map((p) => [p.id, p]));

/**
 * COMPATIBILIDADE — ids antigos (um modelo por variação) apontam para a
 * família paramétrica, preservando a configuração histórica em `values`.
 * Favoritos, recentes, "meus modelos" e links antigos continuam válidos.
 */
export const PART_ALIASES: Record<string, { id: string; values?: Record<string, number> }> = {
  "tub.curva-1": { id: "tub.curva-gomos", values: { gomos: 2 } },
  "tub.curva-2": { id: "tub.curva-gomos", values: { gomos: 2 } },
  "tub.curva-3": { id: "tub.curva-gomos", values: { gomos: 3 } },
  "tub.curva-4": { id: "tub.curva-gomos", values: { gomos: 4 } },
  "tub.curva-n": { id: "tub.curva-gomos", values: { gomos: 5 } },
  "tub.curva-multiplos": { id: "tub.curva-gomos", values: { gomos: 5 } },
  "tub.corte-angular": { id: "tub.boca-de-lobo", values: { metodo: 0 } },
};

/** Resolve o id atual de um modelo, aceitando ids antigos. */
export function resolvePartId(id: string): string {
  return PART_ALIASES[id]?.id ?? id;
}

/** Parâmetros históricos associados a um id antigo (ex.: 3 gomos). */
export function aliasValues(id: string): Record<string, number> | undefined {
  return PART_ALIASES[id]?.values;
}

export function findPart(id: string): PartModel | undefined {
  return BY_ID.get(id) ?? BY_ID.get(resolvePartId(id));
}

export const FAMILIES: Record<PartCategory, string[]> = {
  caldeiraria: ["Transições", "Cones", "Cilíndricas", "Curvas", "Interseções", "Flanges"],
  tubulacoes: ["Tubos", "Curvas", "Interseções", "Reduções", "Conexões"],
  cnc2d: ["Chapas", "Furos", "Rasgos", "Suportes", "Flanges CNC"],
};

export const CAPABILITY_LABEL: Record<Capability, string> = {
  "3d": "3D",
  "top-view": "VISTA",
  planification: "PLANIF.",
  "2d": "2D",
  chamfer: "CHAMFER",
  cnc: "CNC",
};

/** Destino de abertura do modelo — a biblioteca não decide fluxo, só encaminha. */
export function partHref(
  p: PartModel,
  originalId?: string,
): { to: string; params?: Record<string, string>; search?: Record<string, string> } {
  if (p.kind === "vector")
    return { to: "/tracagem/cnc/$id", params: { id: p.id.replace("cnc.", "") } };
  const preset = originalId ? aliasValues(originalId) : undefined;
  const search = preset
    ? {
        preset: Object.entries(preset)
          .map(([k, v]) => `${k}:${v}`)
          .join(","),
      }
    : undefined;
  return {
    to: "/tracagem/$slug",
    params: { slug: p.engineSlug! },
    ...(search ? { search } : {}),
  };
}
