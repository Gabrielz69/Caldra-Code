import type { Entity } from "@/lib/lab2d/core";
import { generateStraightStair, STAIR_DEFAULTS } from "./stairs";
import type { CanonicalBox, CanonicalPart, CanonicalProject, CatalogModel } from "./types";

const round = (n: number) => Math.round(n * 1000) / 1000;
const box = (x: number, y: number, z: number, l: number, h: number, w: number): CanonicalBox => ({
  min: { x, y, z },
  max: { x: x + l, y: y + h, z: z + w },
});
const rect = (id: string, w: number, h: number, x = 0, y = 0, layer = "corte"): Entity => ({
  id: `cat_${id}`,
  layer,
  type: "polyline",
  closed: true,
  pts: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

const GATE_DEFAULTS = {
  width: 5400,
  height: 2100,
  frameProfileHeight: 60,
  frameProfileWidth: 40,
  frameWall: 2.0,
  gridProfileSize: 20,
  gridSpacing: 115,
  lowerSheetHeight: 850,
};

function generateSlidingGate(raw: Record<string, number>): CanonicalProject {
  const v = { ...GATE_DEFAULTS, ...raw };
  const W = Math.max(1500, v.width);
  const H = Math.max(1200, v.height);
  const fh = Math.max(30, v.frameProfileHeight);
  const fw = Math.max(20, v.frameProfileWidth);
  const wall = Math.max(1.2, v.frameWall);
  const gridSz = Math.max(15, v.gridProfileSize);
  const spacing = Math.max(70, v.gridSpacing);
  const lowH = Math.min(H - 300, Math.max(300, v.lowerSheetHeight));

  const innerW = W - 2 * fh;
  const upperGridH = Math.max(200, H - 2 * fh - lowH - fh);
  const barsCount = Math.max(4, Math.floor(innerW / spacing) - 1);

  const parts: CanonicalPart[] = [
    {
      key: "travessa-horiz",
      codeSuffix: "QD-001",
      name: `Travessa Horizontal Metalon ${fh}×${fw}×${wall}mm (45°/45°)`,
      quantity: 2,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: wall,
      role: "Quadro Principal",
      assemblyKey: "quadro",
      stage: 1,
      process: "Corte Serra 45° + Solda MIG",
      dimensions: { length: W, width: fh, height: fw },
      box: box(0, 0, 0, W, fh, fw),
      entities: [rect("th", W, fh)],
      fabricable: false,
    },
    {
      key: "montante-vert",
      codeSuffix: "QD-002",
      name: `Montante Vertical Lateral Metalon ${fh}×${fw}×${wall}mm`,
      quantity: 2,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: wall,
      role: "Quadro Principal",
      assemblyKey: "quadro",
      stage: 1,
      process: "Corte Serra 45° + Solda MIG",
      dimensions: { length: H, width: fh, height: fw },
      box: box(0, 0, 0, fh, H, fw),
      entities: [rect("mv", H, fh)],
      fabricable: false,
    },
    {
      key: "travessa-central",
      codeSuffix: "QD-003",
      name: `Travessa Central Divisora Metalon ${fh}×${fw}×${wall}mm`,
      quantity: 1,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: wall,
      role: "Travamento Central",
      assemblyKey: "quadro",
      stage: 1,
      process: "Corte Serra 90° + Solda MIG",
      dimensions: { length: innerW, width: fh, height: fw },
      box: box(fh, lowH, 0, innerW, fh, fw),
      entities: [rect("tc", innerW, fh)],
      fabricable: false,
    },
    {
      key: "grade-vertical",
      codeSuffix: "GRD-001",
      name: `Palito Vertical da Grade Metalon ${gridSz}×${gridSz}×1,20mm`,
      quantity: barsCount,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: 1.2,
      role: "Gradeamento Superior",
      assemblyKey: "fechamento",
      stage: 2,
      process: "Corte Serra 90° + Ponteamento",
      dimensions: { length: upperGridH, width: gridSz, height: gridSz },
      box: box(fh + spacing, lowH + fh, 0, gridSz, upperGridH, gridSz),
      entities: [rect("gv", upperGridH, gridSz)],
      fabricable: false,
    },
    {
      key: "saia-lambril",
      codeSuffix: "CHP-001",
      name: "Saia Inferior em Chapa Lambril Frisada #20 (0,90mm)",
      quantity: 1,
      material: "Chapa Lambril Costa Ferro",
      thickness: 0.9,
      role: "Fechamento Inferior",
      assemblyKey: "fechamento",
      stage: 2,
      process: "Corte Guilhotina",
      dimensions: { length: innerW, width: lowH, height: 0.9 },
      box: box(fh, fh, 0, innerW, lowH, 10),
      entities: [rect("lambril", innerW, lowH)],
      fabricable: true,
    },
  ];

  const drawingEntities: Entity[] = [
    rect("frame_out", W, H, 0, 0, "corte"),
    rect("frame_in", innerW, H - 2 * fh, fh, fh, "corte"),
    rect("mid_rail", innerW, fh, fh, fh + lowH, "corte"),
  ];

  return {
    modelSlug: "portao-correr",
    modelName: "Portão de Correr em Metalon & Lambril (Costa Ferro)",
    schemaVersion: 1,
    parameters: v,
    fingerprint: Object.entries(v).map(([k, val]) => `${k}:${val}`).join("|"),
    bounds: box(0, 0, 0, W, H, fw),
    drawing: {
      width: W,
      height: H,
      entities: drawingEntities,
      dimensions: [
        { label: "Largura Total", value: W, a: { x: 0, y: -120 }, b: { x: W, y: -120 } },
        { label: "Altura Total", value: H, a: { x: W + 120, y: 0 }, b: { x: W + 120, y: H } },
      ],
    },
    parts,
    assemblies: [
      { key: "quadro", name: "Quadro Estrutural em Metalon", code: "QDR", order: 0 },
      { key: "fechamento", name: "Gradeamento & Chapa Lambril", code: "FEC", order: 1 },
    ],
    subassemblies: [],
    steps: [
      {
        key: "corte",
        title: "Corte de Barras de 6000mm",
        detail: "Cortar longarinas e montantes em meia-esquadria 45° conforme plano de aproveitamento.",
        partKeys: ["travessa-horiz", "montante-vert", "travessa-central"],
      },
      {
        key: "montagem",
        title: "Esquadrejamento, Grade e Lambril",
        detail: "Pontear quadro na bancada em nível, distribuir montantes da grade e fixar saia lambril.",
        partKeys: ["grade-vertical", "saia-lambril"],
      },
    ],
    metrics: [
      { label: "Vão Livre", value: W, unit: "mm" },
      { label: "Altura da Folha", value: H, unit: "mm" },
      { label: "Montantes de Grade", value: barsCount, unit: "un" },
      { label: "Barras 6m Estimadas", value: Math.ceil((2 * W + 2 * H + innerW + barsCount * upperGridH) / 5800), unit: "br" },
    ],
    warnings: [
      "Conferir nível do trilho inferior e folga de 15mm antes do corte final das colunas de batente.",
    ],
  };
}

const PLATFORM_DEFAULTS = {
  width: 2400,
  length: 3600,
  height: 2600,
  beamHeight: 150,
  columnSize: 100,
  plateThickness: 4.75,
};

function generateIndustrialPlatform(raw: Record<string, number>): CanonicalProject {
  const v = { ...PLATFORM_DEFAULTS, ...raw };
  const W = Math.max(1000, v.width);
  const L = Math.max(1200, v.length);
  const H = Math.max(1000, v.height);
  const bh = Math.max(100, v.beamHeight);
  const col = Math.max(60, v.columnSize);
  const pt = Math.max(3, v.plateThickness);

  const parts: CanonicalPart[] = [
    {
      key: "colunas",
      codeSuffix: "COL-001",
      name: `Coluna Tubo Metalon ${col}×${col}×4,75mm`,
      quantity: 4,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: 4.75,
      role: "Sustentação Vertical",
      assemblyKey: "estrutura",
      stage: 1,
      process: "Corte Serra 90°",
      dimensions: { length: H, width: col, height: col },
      box: box(0, 0, 0, col, H, col),
      entities: [rect("col", H, col)],
      fabricable: false,
    },
    {
      key: "viga-long",
      codeSuffix: "VIG-001",
      name: `Viga Principal Perfil U Enrijecido ${bh}×60×3,00mm`,
      quantity: 2,
      material: "Perfil U Costa Ferro",
      thickness: 3.0,
      role: "Quadro Principal",
      assemblyKey: "estrutura",
      stage: 1,
      process: "Corte Serra 90° + Solda",
      dimensions: { length: L, width: bh, height: 60 },
      box: box(0, H - bh, 0, L, bh, 60),
      entities: [rect("vl", L, bh)],
      fabricable: false,
    },
    {
      key: "viga-transv",
      codeSuffix: "VIG-002",
      name: `Travessa Secundária Perfil U ${bh}×50×3,00mm`,
      quantity: 5,
      material: "Perfil U Costa Ferro",
      thickness: 3.0,
      role: "Apoio de Piso",
      assemblyKey: "estrutura",
      stage: 1,
      process: "Corte Serra 90°",
      dimensions: { length: W, width: bh, height: 50 },
      box: box(0, H - bh, 0, 50, bh, W),
      entities: [rect("vt", W, bh)],
      fabricable: false,
    },
    {
      key: "piso-xadrez",
      codeSuffix: "PIS-001",
      name: `Piso em Chapa Xadrez Antiderrapante ${pt}mm`,
      quantity: 2,
      material: "Chapa Xadrez Costa Ferro",
      thickness: pt,
      role: "Piso Industrial",
      assemblyKey: "piso",
      stage: 2,
      process: "Corte Plasma / Guilhotina",
      dimensions: { length: L / 2, width: W, height: pt },
      box: box(0, H, 0, L, pt, W),
      entities: [rect("px", L / 2, W)],
      fabricable: true,
    },
  ];

  return {
    modelSlug: "plataforma-industrial",
    modelName: "Plataforma / Mezanino Industrial",
    schemaVersion: 1,
    parameters: v,
    fingerprint: Object.entries(v).map(([k, val]) => `${k}:${val}`).join("|"),
    bounds: box(0, 0, 0, L, H + 1100, W),
    drawing: {
      width: L,
      height: H,
      entities: [rect("plat_top", L, W, 0, 0, "corte")],
      dimensions: [
        { label: "Comprimento", value: L, a: { x: 0, y: -120 }, b: { x: L, y: -120 } },
        { label: "Elevação", value: H, a: { x: L + 120, y: 0 }, b: { x: L + 120, y: H } },
      ],
    },
    parts,
    assemblies: [
      { key: "estrutura", name: "Pórtico e Vigamento", code: "EST", order: 0 },
      { key: "piso", name: "Piso em Chapa Xadrez", code: "PIS", order: 1 },
    ],
    subassemblies: [],
    steps: [
      {
        key: "portico",
        title: "Montagem de Colunas e Vigas Principais",
        detail: "Fixar sapatas das 4 colunas e nivelar vigas principais e secundárias.",
        partKeys: ["colunas", "viga-long", "viga-transv"],
      },
      {
        key: "piso",
        title: "Assentamento do Piso Xadrez",
        detail: "Posicionar e pontear chapas xadrez sobre o barroteamento.",
        partKeys: ["piso-xadrez"],
      },
    ],
    metrics: [
      { label: "Área Útil", value: round((L * W) / 1e6), unit: "m²" },
      { label: "Altura Livre", value: H - bh, unit: "mm" },
    ],
    warnings: ["Validar carga por m² e chumbadores químicos antes da montagem."],
  };
}

const SUPPORT_DEFAULTS = {
  baseWidth: 250,
  baseLength: 250,
  columnHeight: 850,
  armLength: 600,
  pipeDiameter: 114.3,
  plateThickness: 9.53,
};

function generatePipeSupport(raw: Record<string, number>): CanonicalProject {
  const v = { ...SUPPORT_DEFAULTS, ...raw };
  const bw = Math.max(150, v.baseWidth);
  const bl = Math.max(150, v.baseLength);
  const ch = Math.max(300, v.columnHeight);
  const arm = Math.max(200, v.armLength);
  const pt = Math.max(4.75, v.plateThickness);

  const parts: CanonicalPart[] = [
    {
      key: "chapa-base",
      codeSuffix: "SUP-001",
      name: `Chapa de Base Furada ${bl}×${bw}×${pt}mm`,
      quantity: 1,
      material: "Chapa Grossa ASTM A36 (Costa Ferro)",
      thickness: pt,
      role: "Base de Chumbamento",
      assemblyKey: "base",
      stage: 1,
      process: "Corte CNC Plasma + 4 Furos Ø16mm",
      dimensions: { length: bl, width: bw, height: pt },
      box: box(0, 0, 0, bl, pt, bw),
      entities: [rect("sb", bl, bw)],
      fabricable: true,
    },
    {
      key: "coluna-tubo",
      codeSuffix: "SUP-002",
      name: "Coluna em Metalon 80×80×4,75mm",
      quantity: 1,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: 4.75,
      role: "Coluna Principal",
      assemblyKey: "estrutura",
      stage: 1,
      process: "Corte Serra 90°",
      dimensions: { length: ch, width: 80, height: 80 },
      box: box(bl / 2 - 40, pt, bw / 2 - 40, 80, ch, 80),
      entities: [rect("sc", ch, 80)],
      fabricable: false,
    },
    {
      key: "braco-mensula",
      codeSuffix: "SUP-003",
      name: "Braço em Mão Francesa Metalon 80×40×3,00mm",
      quantity: 1,
      material: "Metalon NBR 6591 (Costa Ferro)",
      thickness: 3.0,
      role: "Apoio da Tubulação",
      assemblyKey: "estrutura",
      stage: 2,
      process: "Corte Serra + Solda",
      dimensions: { length: arm, width: 80, height: 40 },
      box: box(bl / 2, ch - 80, bw / 2 - 20, arm, 80, 40),
      entities: [rect("sa", arm, 80)],
      fabricable: false,
    },
    {
      key: "nervura-gusset",
      codeSuffix: "SUP-004",
      name: `Nervuras de Reforço (Gussets) 120×120×${pt}mm`,
      quantity: 4,
      material: "Chapa Grossa ASTM A36 (Costa Ferro)",
      thickness: pt,
      role: "Enrijecimento",
      assemblyKey: "base",
      stage: 2,
      process: "Corte Plasma Chanfrado",
      dimensions: { length: 120, width: 120, height: pt },
      box: box(bl / 2 - 60, pt, bw / 2 - 5, 120, 120, pt),
      entities: [rect("sg", 120, 120)],
      fabricable: true,
    },
  ];

  return {
    modelSlug: "suporte-tubulacao",
    modelName: "Suporte Industrial de Tubulação",
    schemaVersion: 1,
    parameters: v,
    fingerprint: Object.entries(v).map(([k, val]) => `${k}:${val}`).join("|"),
    bounds: box(0, 0, 0, bl + arm, ch, bw),
    drawing: {
      width: bl + arm,
      height: ch,
      entities: [rect("sup_base", bl, bw, 0, 0, "corte")],
      dimensions: [
        { label: "Altura Coluna", value: ch, a: { x: -80, y: 0 }, b: { x: -80, y: ch } },
        { label: "Balanço", value: arm, a: { x: 0, y: ch + 80 }, b: { x: arm, y: ch + 80 } },
      ],
    },
    parts,
    assemblies: [
      { key: "base", name: "Base e Nervuras", code: "BAS", order: 0 },
      { key: "estrutura", name: "Coluna e Mão Francesa", code: "EST", order: 1 },
    ],
    subassemblies: [],
    steps: [
      {
        key: "solda-base",
        title: "Soldagem da Coluna e Nervuras na Base",
        detail: "Garantir esquadro de 90° entre coluna e chapa de base com 4 nervuras.",
        partKeys: ["chapa-base", "coluna-tubo", "nervura-gusset"],
      },
      {
        key: "solda-braco",
        title: "Montagem do Braço e Berço da Tubulação",
        detail: "Soldar braço horizontal e berço para tubo.",
        partKeys: ["braco-mensula"],
      },
    ],
    metrics: [
      { label: "Altura Total", value: ch + pt, unit: "mm" },
      { label: "Balanço Útil", value: arm, unit: "mm" },
    ],
    warnings: ["Executar solda em ângulo contínua nas nervuras de base."],
  };
}

export const PROJECT_CATALOG: CatalogModel[] = [
  {
    slug: "portao-correr",
    name: "Portão de Correr em Metalon & Lambril (Costa Ferro)",
    category: "estruturas",
    description:
      "Portão de correr paramétrico de até 6 metros ou mais com perfis reais do Catálogo Costa Ferro, meia-esquadria 45°, grade superior e saia em chapa lambril.",
    complexity: "intermediário",
    componentCount: "5 grupos de corte + ferragens",
    applications: ["serralheria", "industrial", "residencial"],
    materials: ["Metalon NBR 6591", "Chapa Lambril #20"],
    type: "Serralheria e Estrutura Soldada",
    status: "pronto",
    defaults: GATE_DEFAULTS,
    generate: generateSlidingGate,
    parameters: [
      { key: "width", label: "Largura do portão (Vão)", unit: "mm", min: 1500, max: 9000, step: 50 },
      { key: "height", label: "Altura total", unit: "mm", min: 1200, max: 3500, step: 50 },
      { key: "frameProfileHeight", label: "Altura perfil quadro", unit: "mm", min: 30, max: 100 },
      { key: "frameProfileWidth", label: "Largura perfil quadro", unit: "mm", min: 20, max: 80 },
      { key: "frameWall", label: "Parede do metalon", unit: "mm", min: 1.2, max: 4.75, step: 0.3 },
      { key: "gridSpacing", label: "Espaçamento da grade", unit: "mm", min: 70, max: 200 },
      { key: "lowerSheetHeight", label: "Altura saia chapa lambril", unit: "mm", min: 300, max: 1500 },
    ],
  },
  {
    slug: "escada-reta",
    name: "Escada Reta Industrial",
    category: "escadas",
    description:
      "Escada metálica paramétrica com longarinas, degraus, travessas, guarda-corpo e fixações.",
    complexity: "avançado",
    componentCount: "6 tipos de peça",
    applications: ["acesso industrial", "mezanino", "manutenção"],
    materials: ["Aço carbono Costa Ferro"],
    type: "Estrutura em perfis e chapas",
    status: "pronto",
    defaults: STAIR_DEFAULTS,
    generate: generateStraightStair,
    parameters: [
      { key: "width", label: "Largura útil", unit: "mm", min: 500, max: 2400 },
      { key: "height", label: "Altura total", unit: "mm", min: 500, max: 8000 },
      { key: "length", label: "Comprimento horizontal", unit: "mm", min: 800, max: 12000 },
      {
        key: "steps",
        label: "Quantidade de degraus",
        unit: "un",
        min: 3,
        max: 40,
        step: 1,
        integer: true,
      },
      { key: "treadDepth", label: "Profundidade do piso", unit: "mm", min: 120, max: 450 },
      { key: "stringerHeight", label: "Altura da longarina", unit: "mm", min: 80, max: 500 },
      { key: "stringerThickness", label: "Espessura da longarina", unit: "mm", min: 3, max: 30 },
      { key: "treadThickness", label: "Espessura do degrau", unit: "mm", min: 2, max: 20 },
      { key: "profileWidth", label: "Perfil do guarda-corpo", unit: "mm", min: 25, max: 120 },
      { key: "handrailHeight", label: "Altura do guarda-corpo", unit: "mm", min: 700, max: 1400 },
    ],
  },
  {
    slug: "plataforma-industrial",
    name: "Plataforma / Mezanino Industrial",
    category: "plataformas",
    description:
      "Plataforma modular com colunas em Metalon pesado, vigas em Perfil U Enrijecido e piso em chapa xadrez antiderrapante.",
    complexity: "avançado",
    componentCount: "4 grupos estruturais",
    applications: ["manutenção", "acesso industrial", "mezanino"],
    materials: ["Metalon NBR 6591", "Perfil U", "Chapa Xadrez"],
    type: "Estrutura em perfis e chapas",
    status: "pronto",
    defaults: PLATFORM_DEFAULTS,
    generate: generateIndustrialPlatform,
    parameters: [
      { key: "width", label: "Largura da plataforma", unit: "mm", min: 1000, max: 6000, step: 100 },
      { key: "length", label: "Comprimento total", unit: "mm", min: 1200, max: 12000, step: 100 },
      { key: "height", label: "Altura do piso", unit: "mm", min: 1000, max: 6000, step: 100 },
      { key: "beamHeight", label: "Altura da viga U", unit: "mm", min: 100, max: 300 },
      { key: "columnSize", label: "Tubo da coluna", unit: "mm", min: 60, max: 150 },
      { key: "plateThickness", label: "Espessura piso xadrez", unit: "mm", min: 3, max: 9.53 },
    ],
  },
  {
    slug: "suporte-tubulacao",
    name: "Suporte Industrial de Tubulação",
    category: "suportes",
    description:
      "Suporte paramétrico com chapa de base furada, nervuras de reforço (gussets), coluna tubular e braço em mão francesa.",
    complexity: "intermediário",
    componentCount: "4 tipos de peça",
    applications: ["tubulação", "caldeiraria", "utilidades"],
    materials: ["Chapa Grossa ASTM A36", "Metalon NBR 6591"],
    type: "Suporte industrial soldado",
    status: "pronto",
    defaults: SUPPORT_DEFAULTS,
    generate: generatePipeSupport,
    parameters: [
      { key: "baseWidth", label: "Largura da base", unit: "mm", min: 150, max: 600 },
      { key: "baseLength", label: "Comprimento da base", unit: "mm", min: 150, max: 600 },
      { key: "columnHeight", label: "Altura da coluna", unit: "mm", min: 300, max: 3000 },
      { key: "armLength", label: "Balanço do braço", unit: "mm", min: 200, max: 1800 },
      { key: "pipeDiameter", label: "Diâmetro do tubo apoiado", unit: "mm", min: 25.4, max: 323.8 },
      { key: "plateThickness", label: "Espessura da chapa base", unit: "mm", min: 4.75, max: 19.05 },
    ],
  },
];

export const findCatalogModel = (slug: string) =>
  PROJECT_CATALOG.find((m) => m.slug === slug) ?? null;
