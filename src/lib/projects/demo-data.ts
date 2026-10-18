/** Dados demonstrativos do protótipo. Substituíveis por Lovable Cloud depois. */

export type DemoPiece = {
  id: string;
  name: string;
  geometry: string;
  dimensions: string;
  material: string;
  thickness: number;
  quantity: number;
  status: "calculada" | "rascunho" | "exportada";
};

export type DemoProject = {
  id: string;
  name: string;
  client: string;
  date: string;
  notes: string;
  progress: number;
  pieces: DemoPiece[];
  demo: true;
};

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "chamine-industrial",
    name: "Chaminé Industrial",
    client: "Metalúrgica Serra Azul",
    date: "2026-08-12",
    notes: "Dados demonstrativos. Virolas em aço carbono, solda de topo.",
    progress: 82,
    demo: true,
    pieces: [
      {
        id: "p1",
        name: "Cone de transição",
        geometry: "Tronco de Cone",
        dimensions: "Ø700 → Ø400 · h 600",
        material: "Aço carbono",
        thickness: 4,
        quantity: 1,
        status: "calculada",
      },
      {
        id: "p2",
        name: "Flange de base",
        geometry: "Flange",
        dimensions: "Ø820 · 12 furos Ø18",
        material: "Aço carbono",
        thickness: 12,
        quantity: 2,
        status: "rascunho",
      },
      {
        id: "p3",
        name: "Duto reto",
        geometry: "Cilindro",
        dimensions: "Ø400 · 1500",
        material: "Aço carbono",
        thickness: 3,
        quantity: 3,
        status: "exportada",
      },
    ],
  },
  {
    id: "vao-duto-linha-b",
    name: "Vão de Duto — Linha B",
    client: "Usina Vale Verde",
    date: "2026-08-22",
    notes: "Dados demonstrativos. Aguardando confirmação de espessura.",
    progress: 45,
    demo: true,
    pieces: [
      {
        id: "p4",
        name: "Tê de derivação",
        geometry: "Tê",
        dimensions: "Ø400 × Ø250",
        material: "Inox 304",
        thickness: 3,
        quantity: 1,
        status: "rascunho",
      },
      {
        id: "p5",
        name: "Transição quadrado-redondo",
        geometry: "Quadrado → Redondo",
        dimensions: "400×400 → Ø300 · h 500",
        material: "Inox 304",
        thickness: 3,
        quantity: 2,
        status: "calculada",
      },
    ],
  },
];

export const DEMO_HISTORY = [
  { id: "h1", label: "Boca de Lobo Ø400", when: "há 2 h", geometry: "boca-de-lobo" },
  { id: "h2", label: "Cone Ø700 → Ø400", when: "ontem", geometry: "tronco-de-cone" },
  { id: "h3", label: "Curva 90° · 4 gomos", when: "há 3 dias", geometry: "curva-de-gomos" },
  { id: "h4", label: "Quadrado 400 → Ø300", when: "há 5 dias", geometry: "quadrado-redondo" },
];

export const MATERIALS = [
  { name: "Aço carbono", density: 7.85 },
  { name: "Inox 304", density: 7.93 },
  { name: "Alumínio", density: 2.7 },
  { name: "Cobre", density: 8.96 },
];
