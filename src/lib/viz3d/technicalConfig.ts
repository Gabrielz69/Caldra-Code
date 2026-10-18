/**
 * CALDRA — CONFIGURAÇÃO CENTRALIZADA DE VISUALIZAÇÃO TÉCNICA 3D
 *
 * Fonte única da verdade para parâmetros de iluminação, materiais,
 * modos de sombreamento por modelo, visibilidade de arestas e controle de LOD.
 * Nenhuma alteração aqui afeta as coordenadas canônicas ou a matemática dos modelos.
 */

import type { Vec3 } from "@/lib/geometry/types";

/** Iluminação técnica uniforme baseada em vetores no espaço de câmera */
export const TECHNICAL_LIGHTING = {
  /** Luz principal (key light) suavemente elevada e à esquerda */
  keyLight: { x: -0.38, y: 0.66, z: 0.65 } as Vec3,
  /** Luz de preenchimento (fill light) para preservar leitura em faces opostas */
  fillLight: { x: 0.62, y: -0.12, z: 0.42 } as Vec3,
  /** Iluminação ambiente mínima para legibilidade técnica */
  ambientFloor: 0.05,
  /** Coeficiente de reflexo especular discreto (metal semiacetinado) */
  specularGain: 0.25,
  /** Expoente de brilho para metal acetinado */
  specularExponent: 16,
  /** Ganho de luz de contorno (rim light) sutil para silhueta */
  rimGain: 0.12,
} as const;

/** Estilo de sombreamento técnico por tipo de modelo de Traçagem */
export type ShadingModelStyle = "faceted" | "smooth" | "hybrid";

export const MODEL_SHADING_STYLES: Record<string, ShadingModelStyle> = {
  /** Quadrado → Redondo: faces triangulares planas (facetadas) */
  "quadrado-redondo": "faceted",
  "transicoes": "faceted",
  "flanges": "faceted",

  /** Cones e reduções: geratrizes suaves contínuas */
  "cone": "smooth",
  "tronco-de-cone": "smooth",
  "reducao-circular": "smooth",
  "cone-excentrico": "smooth",
  "cilindro": "smooth",
  "dutos": "smooth",

  /** Curva de gomos: híbrido (suave nos setores cilíndricos, vincos explícitos nas emendas) */
  "curva-de-gomos": "hybrid",
  "curvas": "hybrid",

  /** Boca de lobo: híbrido (suave nos tubos, vinco nítido na curva de interseção real) */
  "boca-de-lobo": "hybrid",
  "te": "hybrid",
  "y": "hybrid",
  "interseccoes": "hybrid",
};

/** Retorna o estilo de sombreamento para o slug do modelo */
export function getModelShadingStyle(slug: string): ShadingModelStyle {
  return MODEL_SHADING_STYLES[slug] ?? "faceted";
}

/** Configurações de passes de renderização técnica */
export const TECHNICAL_PASSES = {
  /** Ordem estrita de passes para eliminar efeito fantasma */
  order: [
    "inner",      // 1. Superfícies internas observáveis (fundo da cavidade)
    "cap",        // 2. Tampas ou fundos fechados
    "outer",      // 3. Superfície externa frontal
    "rim",        // 4. Bordas e lips de espessura nas aberturas
    "edge",       // 5. Linhas técnicas de dobra/geratrizes reais
    "reference",  // 6. Eixos e referências técnicas
    "selection",  // 7. Realces e anotações de seleção
  ] as const,

  /** Diretriz de sombra de contato: completamente eliminada da visualização normal */
  hasContactShadow: false,
  /** Tolerância para oclusão de profundidade (normalizada pelo tamanho da peça) */
  depthEpsilonRatio: 1e-4,
} as const;

/** Parâmetros de apresentação de arestas e linhas técnicas */
export const TECHNICAL_EDGES = {
  /** Espessura base de arestas visíveis */
  strokeWidth: 0.6,
  /** Espessura de arestas em destaque de seleção */
  selectionStrokeWidth: 1.5,
  /** Espessura de linhas de referência (eixos) */
  referenceStrokeWidth: 0.5,
  /** Padrão pontilhado-traço da linha de centro */
  referenceDashArray: "4 3 1 3",
  /** Limite de ângulo diedro para junções explícitas no modo híbrido (graus) */
  creaseAngleDeg: 12,
} as const;
