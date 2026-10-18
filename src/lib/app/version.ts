/** Identidade de versão e histórico de lançamentos do CALDRA. */

export const APP_VERSION = "1.0.0";
export const APP_BUILD = "2026.09.05";
export const SUPPORT_EMAIL = "suporte@caldra.app";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-09-05",
    title: "Lançamento do laboratório completo",
    items: [
      "CHAMFER em tela cheia com paisagem obrigatória e modais contidos",
      "Moldura de trabalho 1500 × 3000 mm paramétrica com auto-fit da traçagem",
      "Centralizar peça e enquadrar área de trabalho no menu e na barra de status",
      "CHAMFER VISION: vetorização técnica, modo LOGO e modo TRAÇADO com progresso",
      "Design System CALDRA: tipografia, botões, carregamento e estados de erro",
      "Barra de estágio GEOMETRIA · PLANIFICAÇÃO · FABRICAÇÃO nos estúdios",
      "Fundo AURORA em shader WebGL com estilos Fluido, Suave e Estático",
      "Tema AMOLED com preto puro e elevação por bordas",
      "Calculadora impecável: peso, custo, materiais e QA interno 60/60",
      "Oficina: nesting em chapa, custo de fabricação, orçamento e ficha em PDF",
    ],
  },
];
