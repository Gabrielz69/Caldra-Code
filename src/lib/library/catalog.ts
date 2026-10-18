export type LibraryCategory =
  | "Tubos"
  | "Chapas"
  | "Perfis"
  | "Materiais"
  | "Soldagem"
  | "Dobra"
  | "Normas"
  | "Conversões"
  | "Fórmulas";

export type LibraryItem = {
  id: string;
  category: LibraryCategory;
  title: string;
  detail: string;
  data: { label: string; value: string }[];
  premium: boolean;
};

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  "Tubos",
  "Chapas",
  "Perfis",
  "Materiais",
  "Soldagem",
  "Dobra",
  "Normas",
  "Conversões",
  "Fórmulas",
];

export const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: "tubo-4",
    category: "Tubos",
    title: 'Tubo 4" NPS · Sch 40',
    detail: "Diâmetro externo e espessura conforme série comercial.",
    data: [
      { label: "Ø externo", value: "114,3 mm" },
      { label: "Espessura", value: "6,02 mm" },
      { label: "Ø interno", value: "102,26 mm" },
      { label: "Massa linear", value: "16,07 kg/m" },
    ],
    premium: false,
  },
  {
    id: "tubo-6",
    category: "Tubos",
    title: 'Tubo 6" NPS · Sch 40',
    detail: "Série comercial usada em dutos de processo.",
    data: [
      { label: "Ø externo", value: "168,3 mm" },
      { label: "Espessura", value: "7,11 mm" },
      { label: "Ø interno", value: "154,08 mm" },
      { label: "Massa linear", value: "28,26 kg/m" },
    ],
    premium: true,
  },
  {
    id: "chapa-padrao",
    category: "Chapas",
    title: "Chapas comerciais",
    detail: "Formatos usuais de fornecimento no Brasil.",
    data: [
      { label: "Formato 1.2×3m", value: "1200 × 3000 mm" },
      { label: "Formato 1.5×3m", value: "1500 × 3000 mm" },
      { label: "Formato 2×6m", value: "2000 × 6000 mm" },
      { label: "Espessuras", value: "1,2 a 25,4 mm" },
    ],
    premium: false,
  },
  {
    id: "perfil-u",
    category: "Perfis",
    title: "Perfil U laminado",
    detail: "Referência para estruturas de suporte.",
    data: [
      { label: "U 100 × 50", value: "10,6 kg/m" },
      { label: "U 150 × 50", value: "18,6 kg/m" },
      { label: "U 200 × 75", value: "25,3 kg/m" },
    ],
    premium: true,
  },
  {
    id: "densidades",
    category: "Materiais",
    title: "Densidades",
    detail: "Massa específica para cálculo de peso.",
    data: [
      { label: "Aço carbono", value: "7,85 kg/dm³" },
      { label: "Inox 304", value: "7,93 kg/dm³" },
      { label: "Alumínio", value: "2,70 kg/dm³" },
      { label: "Cobre", value: "8,96 kg/dm³" },
    ],
    premium: false,
  },
  {
    id: "eletrodos",
    category: "Soldagem",
    title: "Eletrodos revestidos",
    detail: "Classificação AWS e aplicação típica.",
    data: [
      { label: "E6013", value: "Uso geral, chapa fina" },
      { label: "E7018", value: "Baixo hidrogênio, estrutural" },
      { label: "E308L-16", value: "Inox austenítico" },
    ],
    premium: true,
  },
  {
    id: "raio-minimo",
    category: "Dobra",
    title: "Raio mínimo de dobra",
    detail: "Relação com a espessura por material.",
    data: [
      { label: "Aço carbono", value: "1,0 × e" },
      { label: "Inox 304", value: "1,5 × e" },
      { label: "Alumínio", value: "2,0 × e" },
    ],
    premium: false,
  },
  {
    id: "normas",
    category: "Normas",
    title: "Referências normativas",
    detail: "Normas frequentes em fabricação metálica.",
    data: [
      { label: "ABNT NBR 8800", value: "Estruturas de aço" },
      { label: "ASME B16.5", value: "Flanges e conexões" },
      { label: "AWS D1.1", value: "Soldagem estrutural" },
    ],
    premium: true,
  },
  {
    id: "conversoes",
    category: "Conversões",
    title: "Conversões usuais",
    detail: "Unidades de comprimento, massa e pressão.",
    data: [
      { label: "1 pol", value: "25,4 mm" },
      { label: "1 pé", value: "304,8 mm" },
      { label: "1 lb", value: "0,4536 kg" },
      { label: "1 bar", value: "14,504 psi" },
    ],
    premium: false,
  },
  {
    id: "formulas",
    category: "Fórmulas",
    title: "Fórmulas de traçagem",
    detail: "Referência rápida de desenvolvimento.",
    data: [
      { label: "Circunferência", value: "C = π × D" },
      { label: "Corda", value: "c = 2R·sen(180°/n)" },
      { label: "Setor do cone", value: "θ = 360°·R/g" },
      { label: "Comprimento verdadeiro", value: "L = √(Δx²+Δy²+Δz²)" },
      { label: "Bend allowance", value: "BA = (π/180)·α·(Ri + K·e)" },
    ],
    premium: false,
  },
];
