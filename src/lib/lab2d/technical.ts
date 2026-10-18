/**
 * SISTEMA TÉCNICO DE CORES DO CALDRA — INDEPENDENTE DO TEMA DA INTERFACE.
 *
 * Estas cores representam a linguagem de fabricação (corte, dobra, marcação,
 * construção, referência e cotas) e NUNCA devem variar com o tema claro,
 * escuro, acento ou Modo Mestre. A interface possui seus próprios tokens.
 *
 * Proibido: drawingColor = theme.primaryColor
 */

export const CUT_COLOR = "#FFFFFF"; // branco técnico — linha principal de contorno e corte (ABNT NBR 16861:2020)
export const BEND_COLOR = "#EC4899"; // rosa técnico — dobra
export const MARK_COLOR = "#3B82F6"; // azul técnico — marcação
export const RECORTE_COLOR = "#F59E0B"; // âmbar técnico — recorte interno
export const CONSTRUCTION_COLOR = "#9AA4B0"; // cinza técnico claro — construção
export const REFERENCE_COLOR = "#6B7480"; // cinza discreto — referência
/**
 * COTAS — âmbar técnico, independente do tema e da cor primária.
 * ATENÇÃO: DIMENSION ≠ RECORTE. Compartilham a família cromática âmbar na
 * interface, mas são funções completamente diferentes no modelo interno.
 */
export const DIMENSION_COLOR = "#F59E0B"; // âmbar técnico — cotas ABNT
export const AXIS_COLOR = "#5A636E"; // cinza discreto — eixos
/** Destaques de interface — ciano de alto contraste para destacar sobre a linha branca. */
export const SELECTION_COLOR = "#38BDF8"; // destaque temporário de seleção/snap (ciano de alta visibilidade)
export const PREVIEW_COLOR = "#E2E8F0"; // destaque temporário de criação
export const WARNING_COLOR = "#FB7185"; // alertas de validação (não é camada)
/** Tinta única da folha exportada (PDF/PNG): sempre preto puro. */
export const SHEET_INK = "#000000";

export const ANOTACOES_COLOR = "#38BDF8"; // ciano técnico — anotações
export const AUXILIAR_COLOR = "#A855F7"; // roxo técnico — auxiliar

export type TechLayerId =
  | "corte"
  | "recorte"
  | "dobra"
  | "marcacao"
  | "construcao"
  | "referencia"
  | "cota"
  | "anotacoes"
  | "auxiliar";

/**
 * CAMADAS VISÍVEIS PARA O USUÁRIO NO CHAMFER.
 * Apenas estas quatro representam operações de fabricação escolhidas por quem
 * desenha. Construção, referência e cota continuam existindo internamente.
 */
export const USER_LAYER_IDS: TechLayerId[] = ["corte", "marcacao", "dobra", "recorte", "anotacoes", "auxiliar"];

export const isUserLayer = (layerId: string) => USER_LAYER_IDS.includes(layerId as TechLayerId);

/** Estilo técnico completo de cada camada (cor + traço + espessura relativa). */
export const TECHNICAL_STYLE: Record<
  TechLayerId,
  { color: string; dash: (s: number) => string | undefined; weight: number; order: number }
> = {
  construcao: {
    color: CONSTRUCTION_COLOR,
    dash: (s) => `${2 * s} ${2 * s}`,
    weight: 0.7,
    order: 0,
  },
  referencia: {
    color: REFERENCE_COLOR,
    dash: (s) => `${8 * s} ${2 * s} ${1.5 * s} ${2 * s}`,
    weight: 0.7,
    order: 1,
  },
  dobra: {
    color: BEND_COLOR,
    dash: (s) => `${7 * s} ${2.5 * s} ${1.5 * s} ${2.5 * s}`,
    weight: 1,
    order: 2,
  },
  marcacao: { color: MARK_COLOR, dash: (s) => `${4 * s} ${2.5 * s}`, weight: 1, order: 3 },
  recorte: { color: RECORTE_COLOR, dash: () => undefined, weight: 1.2, order: 4 },
  corte: { color: CUT_COLOR, dash: () => undefined, weight: 1.4, order: 5 },
  cota: { color: DIMENSION_COLOR, dash: () => undefined, weight: 0.8, order: 6 },
  anotacoes: { color: ANOTACOES_COLOR, dash: () => undefined, weight: 0.8, order: 7 },
  auxiliar: { color: AUXILIAR_COLOR, dash: (s) => `${3 * s} ${3 * s}`, weight: 0.7, order: 8 },
};

const FALLBACK = TECHNICAL_STYLE.corte;

/**
 * A cor técnica é FIXA: corte verde, marcação azul, dobra rosa e recorte
 * âmbar, em qualquer tema. Cor é representação visual; a camada é a operação.
 */
export const techStyle = (layerId: string) => TECHNICAL_STYLE[layerId as TechLayerId] ?? FALLBACK;

export const techColor = (layerId: string) => techStyle(layerId).color;

/** Ordem de pintura: construção → referência → dobra → marcação → recorte → corte → cotas. */
export const layerOrder = (layerId: string) => techStyle(layerId).order;

/** Modos de saída para fabricação. */
export type OutputMode = "completo" | "producao" | "corte" | "corte-marcacao";

export const MODE_LAYERS: Record<OutputMode, TechLayerId[] | null> = {
  completo: null,
  producao: ["corte", "recorte", "dobra", "marcacao"],
  corte: ["corte", "recorte"],
  "corte-marcacao": ["corte", "recorte", "marcacao"],
};

export function modeAllows(mode: OutputMode, layerId: string): boolean {
  const allowed = MODE_LAYERS[mode];
  return !allowed || allowed.includes(layerId as TechLayerId);
}
