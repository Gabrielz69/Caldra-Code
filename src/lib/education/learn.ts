/**
 * learn — conteúdo pedagógico do modo APRENDER (Fase 4 / Etapa B).
 *
 * Só DADOS: significados de parâmetros, notas de desenvolvimento e dicas de
 * fabricação por família de peça. Nenhum cálculo mora aqui — os números vêm
 * sempre dos motores puros da Fase 1.
 */

export type LearnNote = { title: string; body: string };

/** Significado geométrico das entradas mais comuns dos motores. */
const FIELD_MEANING: Record<string, string> = {
  d: "Diâmetro da seção circular, medido de fora a fora na linha média da chapa.",
  d1: "Diâmetro maior — a boca larga da peça.",
  d2: "Diâmetro menor — a boca estreita da peça.",
  di: "Diâmetro interno.",
  de: "Diâmetro externo.",
  h: "Altura vertical entre as duas bocas, medida no eixo (não é a geratriz).",
  e: "Excentricidade: quanto o eixo da boca menor sai do centro da boca maior.",
  thickness: "Espessura da chapa. Entra no peso e na correção da linha neutra.",
  density: "Densidade do material em kg/dm³ — define o peso do desenvolvimento.",
  divisions:
    "Número de divisões do traçado. Mais divisões = contorno mais fiel e mais riscos na chapa.",
  a: "Lado A da seção quadrada/retangular.",
  b: "Lado B da seção quadrada/retangular.",
  l: "Comprimento reto do trecho.",
  angle: "Ângulo do corte ou da mudança de direção, em graus.",
  r: "Raio de curvatura medido na linha de centro do tubo.",
  n: "Quantidade de elementos (gomos, furos ou segmentos).",
  segments: "Quantidade de gomos que compõem a curva.",
  holes: "Quantidade de furos distribuídos na circunferência de furação.",
};

export function fieldMeaning(key: string): string | null {
  return FIELD_MEANING[key] ?? null;
}

/** Como o traçado é construído, por família de peça. */
const DEVELOPMENT: Record<string, LearnNote[]> = {
  radial: [
    {
      title: "Setor circular",
      body: "O tronco de cone abre num setor: risca-se o raio externo, depois o raio interno com o mesmo centro, e fecha-se com o ângulo do setor. A corda serve para conferir a abertura sem transferidor.",
    },
    {
      title: "Geratriz",
      body: "A geratriz é a distância verdadeira na superfície do cone. Ela vira o raio do setor — nunca use a altura no lugar dela.",
    },
  ],
  direto: [
    {
      title: "Desenvolvimento direto",
      body: "A superfície do cilindro abre num retângulo: a base é a circunferência da linha média e a altura é o comprimento. Cortes oblíquos viram ordenadas medidas a partir da base.",
    },
    {
      title: "Ordenadas",
      body: "Divida a circunferência em partes iguais, marque cada ordenada e una os pontos com régua flexível — é o contorno de corte.",
    },
  ],
  gomos: [
    {
      title: "Gomos",
      body: "A curva é fatiada em gomos; cada gomo é um tronco de cone curto. Traça-se um gomo, confere-se, e ele vira gabarito para os demais.",
    },
  ],
  triangulacao: [
    {
      title: "Triangulação",
      body: "A superfície é dividida em triângulos. Cada lado é medido em comprimento verdadeiro na vista auxiliar e transportado com o compasso, triângulo a triângulo.",
    },
    {
      title: "Gomas / abas",
      body: "Some a sobremetal de solda somente depois de fechar o contorno verdadeiro — nunca durante a triangulação.",
    },
  ],
};

const FAMILY: Record<string, keyof typeof DEVELOPMENT> = {
  cone: "radial",
  cones: "radial",
  reducoes: "radial",
  "reducao-concentrica": "radial",
  "reducao-excentrica": "radial",
  cilindro: "direto",
  cilindros: "direto",
  tubos: "direto",
  dutos: "direto",
  chamines: "direto",
  te: "direto",
  interseccoes: "direto",
  y: "direto",
  "boca-de-lobo": "direto",
  "curva-de-gomos": "gomos",
  calotas: "gomos",
  tampas: "gomos",
  "quadrado-redondo": "triangulacao",
  "redondo-quadrado": "triangulacao",
  transicoes: "triangulacao",
};

export function developmentNotes(slug: string): LearnNote[] {
  const fam = FAMILY[slug];
  return fam ? DEVELOPMENT[fam]! : [];
}

/** Dicas práticas de chão de fábrica. Vazio quando ainda não há conteúdo. */
const FABRICATION: Record<string, LearnNote[]> = {
  radial: [
    {
      title: "Risco na chapa",
      body: "Fixe o centro do setor com uma cantoneira e punção: raio grande sem centro firme entorta o traçado inteiro.",
    },
    {
      title: "Calandragem",
      body: "Cone calandra com pressão progressiva do lado do raio menor. Marque três geratrizes de conferência antes de rolar.",
    },
  ],
  direto: [
    {
      title: "Emenda",
      body: "Posicione a solda longitudinal fora da linha de maior esforço e desencontrada da emenda da virola vizinha.",
    },
    {
      title: "Conferência",
      body: "Antes de cortar, confira a circunferência com trena de fita: erro de 1 mm no diâmetro vira ~3 mm no comprimento.",
    },
  ],
  gomos: [
    {
      title: "Gabarito",
      body: "Corte um gomo, monte a seco e só então libere o restante — corrigir um gomo é barato, corrigir dez não.",
    },
  ],
  triangulacao: [
    {
      title: "Dobras",
      body: "Marque as arestas de dobra com punção leve. Risco fundo demais vira trinca depois de dobrar.",
    },
    {
      title: "Montagem",
      body: "Ponteie a transição pelos quatro cantos primeiro, confira a diagonal e só depois solde corrido.",
    },
  ],
};

export function fabricationTips(slug: string): LearnNote[] {
  const fam = FAMILY[slug];
  return fam ? (FABRICATION[fam] ?? []) : [];
}
