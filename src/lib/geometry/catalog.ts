import type { Feature } from "@/lib/subscription/features";

export type GeometryStatus = "pronto" | "em-desenvolvimento";
export type GeometryLevel = "Básico" | "Intermediário" | "Avançado";

export type GeometryEntry = {
  slug: string;
  name: string;
  short: string;
  level: GeometryLevel;
  status: GeometryStatus;
  feature: Feature;
  /** Caminho SVG esquemático (viewBox 0 0 48 48). */
  icon: string;
  method: string;
};

export const GEOMETRIES: GeometryEntry[] = [
  {
    slug: "quadrado-redondo",
    name: "Quadrado → Redondo",
    short: "Transição por triangulação com geratrizes verdadeiras.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.basic",
    method: "Triangulação",
    icon: "M8 40h32L34 14a10 10 0 0 0-20 0Z M14 14a10 10 0 0 1 20 0",
  },
  {
    slug: "cilindro",
    name: "Cilindro",
    short: "Corpo cilíndrico e desenvolvimento retangular.",
    level: "Básico",
    status: "pronto",
    feature: "geometry.basic",
    method: "Desenvolvimento direto",
    icon: "M14 12h20v24H14z M14 12a10 4 0 0 0 20 0 M14 36a10 4 0 0 0 20 0",
  },
  {
    slug: "cone",
    name: "Cone",
    short: "Cone reto: setor circular pela geratriz.",
    level: "Básico",
    status: "pronto",
    feature: "geometry.basic",
    method: "Radial",
    icon: "M24 8 40 40H8Z",
  },
  {
    slug: "tronco-de-cone",
    name: "Tronco de Cone",
    short: "Redução concêntrica pelo método radial.",
    level: "Intermediário",
    status: "pronto",
    feature: "geometry.basic",
    method: "Radial",
    icon: "M16 12h16l8 28H8Z",
  },
  {
    slug: "cone-excentrico",
    name: "Cone Excêntrico",
    short: "Redução descentralizada por triangulação.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Triangulação",
    icon: "M14 12h14l12 28H8Z",
  },
  {
    slug: "boca-de-lobo",
    name: "Boca de Lobo",
    short: "Derivação inclinada em tubo cilíndrico.",
    level: "Intermediário",
    status: "pronto",
    feature: "geometry.basic",
    method: "Interseção",
    icon: "M12 40V16h24v24 M12 22c8 8 16 8 24 0",
  },
  {
    slug: "te",
    name: "Tê",
    short: "Interseção ortogonal entre tubos.",
    level: "Intermediário",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Interseção",
    icon: "M8 28h32 M20 28V8h8v20",
  },
  {
    slug: "y",
    name: "Y",
    short: "Bifurcação simétrica de dutos.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Interseção",
    icon: "M24 40V24 M24 24 12 10 M24 24 36 10",
  },
  {
    slug: "reducao-circular",
    name: "Redução Circular",
    short: "Redução entre dois diâmetros.",
    level: "Básico",
    status: "pronto",
    feature: "geometry.basic",
    method: "Radial",
    icon: "M14 40h20l-4-32h-12Z",
  },
  {
    slug: "redondo-quadrado",
    name: "Redondo → Quadrado",
    short: "Transição invertida por triangulação.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Triangulação",
    icon: "M14 8h20l6 32H8Z",
  },
  {
    slug: "curva-de-gomos",
    name: "Curva de Gomos",
    short: "Curva segmentada em gomos soldados.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Seções oblíquas",
    icon: "M10 40a30 30 0 0 1 30-30 M10 40h8 M40 10v8",
  },
  {
    slug: "transicoes",
    name: "Transições",
    short: "Transições genéricas entre seções.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Triangulação",
    icon: "M10 40h28L30 12H18Z",
  },
  {
    slug: "dutos",
    name: "Dutos",
    short: "Trechos retos e conexões de dutos.",
    level: "Intermediário",
    status: "pronto",
    feature: "geometry.basic",
    method: "Composição",
    icon: "M8 18h32v12H8z M18 18v12 M30 18v12",
  },
  {
    slug: "flanges",
    name: "Flanges",
    short: "Furação e traçagem de flanges.",
    level: "Intermediário",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Divisão angular",
    icon: "M24 6a18 18 0 1 0 0 36 18 18 0 1 0 0-36 M24 16a8 8 0 1 0 0 16 8 8 0 1 0 0-16",
  },
  {
    slug: "tampas",
    name: "Tampas",
    short: "Tampas planas e conformadas.",
    level: "Básico",
    status: "pronto",
    feature: "geometry.basic",
    method: "Direto",
    icon: "M8 32h32 M8 32a16 12 0 0 1 32 0",
  },
  {
    slug: "calotas",
    name: "Calotas",
    short: "Calota esférica em gomos e disco.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Gomos",
    icon: "M8 34a16 16 0 0 1 32 0Z M24 18v16",
  },
  {
    slug: "chamines",
    name: "Chaminés",
    short: "Composição de virolas e transições.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Composição",
    icon: "M16 42V12h16v30 M12 12h24",
  },
  {
    slug: "interseccoes",
    name: "Interseções",
    short: "Linhas de penetração entre sólidos.",
    level: "Avançado",
    status: "pronto",
    feature: "geometry.advanced",
    method: "Interseção",
    icon: "M8 32h32 M16 32V12h16v20 M16 20c8 6 8 6 16 0",
  },
];

export function findGeometry(slug: string) {
  return GEOMETRIES.find((g) => g.slug === slug);
}
