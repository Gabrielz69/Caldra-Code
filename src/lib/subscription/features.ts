/**
 * MATRIZ CENTRAL DOS PLANOS — CALDRA FREE e CALDRA PRO.
 *
 * Esta é a ÚNICA fonte de verdade de acesso do aplicativo. Nenhuma tela
 * decide sozinha o que é Free ou Pro: tudo passa por `planAllows`,
 * `hasFeature`, `getFeatureLimit`, `isPro` e `isFree`.
 * PROIBIDO espalhar if/else de plano pelas telas.
 */

export type Plan = "free" | "pro";

/** Valores históricos do cache/servidor ("mestre", "oficina") viram PRO. */
export function normalizePlan(value: string | null | undefined): Plan {
  if (!value) return "free";
  const v = value.toLowerCase();
  return v === "pro" || v === "mestre" || v === "oficina" ? "pro" : "free";
}

export type Feature =
  | "geometry.basic"
  | "geometry.advanced"
  | "calc.explanation"
  | "planification.advanced"
  | "lab2d"
  | "export.dxf"
  | "export.dxf.cnc"
  | "export.pdf"
  | "export.png"
  | "export.svg"
  | "projects.unlimited"
  | "school.full"
  | "library.full"
  | "workshop.manage"
  | "backup.import"
  | "components.library"
  | "nesting"
  | "cost.fabrication"
  | "quote.pdf"
  | "jobsheet"
  | "cloud.sync"
  | "calculator.scientific"
  | "materials.custom"
  | "vision.import"
  | "cnc2d.import"
  | "cut.plan"
  | "aurora.animated"
  | "accent.colors";

/** true = liberado no FREE. O PRO libera absolutamente tudo. */
const FREE_MATRIX: Record<Feature, boolean> = {
  "geometry.basic": true,
  "geometry.advanced": false,
  "calc.explanation": false,
  "planification.advanced": false,
  lab2d: false,
  "export.dxf": false,
  "export.dxf.cnc": false,
  "export.pdf": false,
  "export.png": true,
  "export.svg": true,
  "projects.unlimited": false,
  "school.full": false,
  "library.full": true,
  "workshop.manage": false,
  "backup.import": true,
  "components.library": true,
  nesting: false,
  "cost.fabrication": false,
  "quote.pdf": false,
  jobsheet: false,
  "cloud.sync": false,
  "calculator.scientific": true,
  "materials.custom": true,
  "vision.import": false,
  "cnc2d.import": false,
  "cut.plan": false,
  "aurora.animated": false,
  "accent.colors": false,
};

/* ------------------------------------------------------------- limites */

export type FeatureLimit = "projects";

export const FREE_PROJECT_LIMIT = 5;
export const PRO_PROJECT_LIMIT = Infinity;

const LIMITS: Record<FeatureLimit, Record<Plan, number>> = {
  projects: { free: FREE_PROJECT_LIMIT, pro: PRO_PROJECT_LIMIT },
};

export function getFeatureLimit(plan: Plan, limit: FeatureLimit): number {
  return LIMITS[limit][plan];
}

export function planAllows(plan: Plan, feature: Feature): boolean {
  return plan === "pro" || FREE_MATRIX[feature];
}

export const hasFeature = planAllows;
export const isPro = (plan: Plan) => plan === "pro";
export const isFree = (plan: Plan) => plan === "free";

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "PRO",
};

/** CTA único em todo o aplicativo. */
export const PRO_CTA = "Conhecer o PRO";

/**
 * Convite específico por funcionalidade. O paywall contextual NUNCA mostra
 * texto genérico: o usuário precisa saber exatamente o que ganha ali.
 */
export const FEATURE_PITCH: Record<Feature, { title: string; benefit: string }> = {
  "geometry.basic": { title: "Traçagem", benefit: "Disponível em todos os planos." },
  "geometry.advanced": {
    title: "Traçagem avançada",
    benefit:
      "Transições, curvas gomadas e derivações completas, com planificação pronta para a chapa.",
  },
  "calc.explanation": {
    title: "Cálculo passo a passo",
    benefit: "Veja cada fórmula com os seus números — confira o traçado antes de cortar.",
  },
  "planification.advanced": {
    title: "Planificação avançada",
    benefit: "Desenvolvimento completo com cotas de conferência para riscar direto na chapa.",
  },
  lab2d: {
    title: "CHAMFER",
    benefit: "Edite, prepare e organize suas peças para fabricação. Disponível no CALDRA Pro.",
  },
  "export.dxf": {
    title: "DXF Técnico",
    benefit: "Arquivo vetorial técnico com camadas e cotas preservadas.",
  },
  "export.dxf.cnc": {
    title: "DXF Laser CNC",
    benefit:
      "Prepare sua geometria para o fluxo CNC, com CUT, MARK, BEND e RECORTE nos canais certos.",
  },
  "export.pdf": {
    title: "PDF técnico",
    benefit: "Folha técnica em alta definição para imprimir e levar ao chão de fábrica.",
  },
  "export.png": { title: "Exportar PNG", benefit: "Disponível em todos os planos." },
  "export.svg": { title: "Exportar SVG", benefit: "Disponível em todos os planos." },
  "projects.unlimited": {
    title: "Projetos ilimitados",
    benefit: `No Free você guarda ${FREE_PROJECT_LIMIT} projetos. Tenha projetos ilimitados no CALDRA Pro.`,
  },
  "school.full": {
    title: "Estudos avançados",
    benefit: "Todas as aulas de traçagem, do risco ao acabamento, com cálculo passo a passo.",
  },
  "library.full": {
    title: "Biblioteca completa",
    benefit: "Disponível em todos os planos.",
  },
  "workshop.manage": {
    title: "Oficina",
    benefit: "Encaixe na chapa, custo, orçamento e ficha de produção em um lugar só.",
  },
  "backup.import": { title: "Backup", benefit: "Disponível em todos os planos." },
  "components.library": {
    title: "Meus Modelos",
    benefit: "Disponível em todos os planos.",
  },
  nesting: {
    title: "Nesting modo CHAPA",
    benefit:
      "Encaixe as peças na chapa comercial, veja o aproveitamento real e quantas chapas comprar.",
  },
  "cost.fabrication": {
    title: "Custos de fabricação",
    benefit: "Corte, perfurações, dobras, solda, mão de obra e setup somados ao custo do material.",
  },
  "quote.pdf": {
    title: "Orçamento em PDF",
    benefit: "Proposta pronta para o cliente, com margem, desconto, impostos e validade.",
  },
  jobsheet: {
    title: "Ficha de produção",
    benefit: "Folha de bancada com cotas de conferência e QR de rastreio da peça.",
  },
  "cloud.sync": {
    title: "Nuvem e versões",
    benefit: "Seus projetos em todos os aparelhos, com histórico de versões para voltar atrás.",
  },
  "calculator.scientific": {
    title: "Calculadora científica",
    benefit: "Disponível em todos os planos.",
  },
  "materials.custom": {
    title: "Meus materiais",
    benefit: "Disponível em todos os planos.",
  },
  "vision.import": {
    title: "CHAMFER VISION",
    benefit: "Transforme foto, desenho ou logo em geometria vetorial pronta para editar e cortar.",
  },
  "cnc2d.import": {
    title: "CNC 2D",
    benefit: "Importação CNC 2D e o Catálogo CNC 2D CALDRA, com preview real antes de editar.",
  },
  "cut.plan": {
    title: "Plano de corte",
    benefit:
      "Ordem de execução, sentido de corte, corte comum e entradas/saídas definidas por você.",
  },
  "aurora.animated": {
    title: "Estilo de fundo Fluido e Suave",
    benefit: "O fundo vivo do CALDRA. No Free o estilo Padrão segue disponível.",
  },
  "accent.colors": {
    title: "Cores de destaque",
    benefit:
      "Personalize o CALDRA com todas as cores de destaque. No Free o Azul segue disponível.",
  },
};

/* --------------------------------------------------- tela de comparação */

export type ComparisonRow = { label: string; free: string | boolean; pro: string | boolean };

export const PLAN_PITCH = {
  free: {
    title: "CALDRA FREE",
    subtitle: "O essencial para trabalhar no dia a dia.",
    line: "Comece a traçar, calcular e aprender.",
  },
  pro: {
    title: "CALDRA PRO",
    subtitle: "O laboratório completo: da medida ao arquivo que a máquina corta.",
    line: "Projete, fabrique e leve seu trabalho até o CNC.",
  },
} as const;

export const COMPARISON: ComparisonRow[] = [
  { label: "Calculadora completa", free: true, pro: true },
  { label: "Biblioteca completa", free: true, pro: true },
  { label: "Traçagem básica", free: true, pro: true },
  { label: "Traçagem avançada", free: false, pro: true },
  { label: "Meus Modelos", free: true, pro: true },
  { label: "Meus projetos", free: String(FREE_PROJECT_LIMIT), pro: "Ilimitado" },
  { label: "CHAMFER", free: false, pro: true },
  { label: "CHAMFER VISION", free: false, pro: true },
  { label: "Importação CNC 2D", free: false, pro: true },
  { label: "Catálogo CNC 2D", free: false, pro: true },
  { label: "DXF Técnico", free: false, pro: true },
  { label: "DXF Laser CNC", free: false, pro: true },
  { label: "PNG", free: true, pro: true },
  { label: "SVG", free: true, pro: true },
  { label: "PDF técnico", free: false, pro: true },
  { label: "Plano de corte", free: false, pro: true },
  { label: "Nesting", free: false, pro: true },
  { label: "Custos de fabricação", free: false, pro: true },
  { label: "Orçamento", free: false, pro: true },
  { label: "Ficha de produção", free: false, pro: true },
  { label: "Oficina", free: false, pro: true },
  { label: "Estudos básicos", free: true, pro: true },
  { label: "Estudos avançados", free: false, pro: true },
  { label: "Nuvem", free: false, pro: true },
  { label: "Versões", free: false, pro: true },
  { label: "Temas", free: "Todos", pro: "Todos" },
  { label: "Cor de destaque", free: "Azul", pro: "Todas" },
  { label: "Estilo de fundo", free: "Padrão", pro: "Todos" },
  { label: "Idiomas", free: "3", pro: "3" },
];

/** Código de desbloqueio do protótipo, mantido para contas antigas. */
export const PROTOTYPE_MASTER_CODE = "DESPERTAR";
