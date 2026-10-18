/**
 * TRAÇAGEM GUIADA — sequência de execução na bancada.
 *
 * Esta camada NÃO calcula nada. Ela lê o `GeometryResult` já produzido pelo
 * motor paramétrico e o traduz numa sequência de passos com instrução,
 * medida, origem da medida, ferramenta e as entidades que devem ser
 * destacadas no desenho. Se a geometria muda, a sequência é regenerada.
 */

import type { GeometryResult } from "@/lib/geometry/types";
import {
  developmentRefs,
  foldRef,
  outlineRef,
  pointRef,
  refExists,
  type GeometryRef,
} from "@/lib/geometry/refs";

export type TraceTool =
  "riscador" | "regua" | "esquadro" | "compasso" | "transferidor" | "transferir" | "marcar";

export const TOOL_LABEL: Record<TraceTool, string> = {
  riscador: "Riscador",
  regua: "Régua",
  esquadro: "Esquadro",
  compasso: "Compasso",
  transferidor: "Transferidor",
  transferir: "Transferidor de medidas",
  marcar: "Marcação",
};

export type TraceMeasurement = {
  label: string;
  value: number;
  unit: string;
  /** De onde a medida vem — sempre um resultado já calculado. */
  origin: string;
};

export type TraceAnimation = "none" | "line" | "points" | "transfer" | "curve" | "outline";

export type TraceStep = {
  id: string;
  order: number;
  title: string;
  instruction: string;
  geometryRefs: GeometryRef[];
  measurements: TraceMeasurement[];
  tool: TraceTool;
  animation: TraceAnimation;
  /** Como o caldeireiro confere que o passo ficou correto. */
  validation: string;
};

const mm = (v: number) => Math.round(v * 100) / 100;

/** Textos específicos por família. Somente linguagem — nunca cálculo. */
const MODEL_COPY: Record<string, { base: string; divide: string; build: string }> = {
  "quadrado-redondo": {
    base: "Risque a linha de base do desenvolvimento e marque o eixo de simetria.",
    divide: "Divida o arco em partes iguais e numere os pontos do lado redondo.",
    build: "Una cada ponto do redondo aos cantos do quadrado — são as geratrizes reais.",
  },
  cone: {
    base: "Risque a linha de centro e marque o vértice do cone sobre ela.",
    divide: "Com o compasso no vértice, marque o raio de desenvolvimento e divida o arco.",
    build: "Trace as geratrizes do vértice até cada ponto do arco.",
  },
  "tronco-de-cone": {
    base: "Risque a linha de centro e marque o vértice virtual do tronco.",
    divide: "Com o compasso, marque os dois raios de desenvolvimento e divida o setor.",
    build: "Trace as geratrizes entre os dois arcos.",
  },
  "reducao-circular": {
    base: "Risque a linha de base e o eixo da redução.",
    divide: "Divida as duas circunferências no mesmo número de partes e numere os pontos.",
    build: "Una os pontos de mesma numeração: cada ligação é uma geratriz.",
  },
  "curva-de-gomos": {
    base: "Risque a linha de referência do gomo e marque a linha de costura.",
    divide: "Divida a circunferência do tubo em partes iguais e numere as geratrizes.",
    build: "Levante as ordenadas em cada divisão até a linha de corte do gomo.",
  },
  "boca-de-lobo": {
    base: "Risque a linha de base da boca de lobo e o eixo de simetria.",
    divide: "Divida a boca em partes iguais e numere os pontos de apoio.",
    build: "Una os pontos numerados formando as geratrizes do encaixe.",
  },
};

const GENERIC = {
  base: "Risque a linha de referência do desenvolvimento sobre a chapa.",
  divide: "Marque as divisões da geometria e numere os pontos.",
  build: "Trace as geratrizes ligando os pontos correspondentes.",
};

/**
 * Gera a sequência de traçagem a partir da geometria canônica.
 * Determinística: mesma geometria → mesma sequência.
 */
export function buildTraceSequence(slug: string, result: GeometryResult): TraceStep[] {
  const dev = result.development;
  const copy = MODEL_COPY[slug] ?? GENERIC;
  const b = dev.bounds;
  const width = mm(b.maxX - b.minX);
  const height = mm(b.maxY - b.minY);

  const outlineAll = dev.outline.map((_, i) => outlineRef(i));
  const foldAll = dev.foldLines.map((_, i) => foldRef(i));
  const pointAll = dev.points.map((p) => pointRef(p.id));

  const steps: Omit<TraceStep, "order">[] = [];
  const segmentLength = (i: number) => {
    const a = dev.outline[i];
    const b = dev.outline[(i + 1) % dev.outline.length];
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  };
  const baseIndex = outlineAll.reduce(
    (best, _, i) =>
      Math.abs(segmentLength(i) - width) < Math.abs(segmentLength(best) - width) ? i : best,
    0,
  );
  const baseLength = mm(segmentLength(baseIndex) || width);

  steps.push({
    id: "referencia",
    title: "Linha de referência",
    instruction: `${copy.base} Trace uma linha base de ${baseLength} mm.`,
    geometryRefs: outlineAll.length ? [outlineRef(baseIndex)] : [],
    measurements: [
      {
        label: "Comprimento da base",
        value: baseLength,
        unit: "mm",
        origin: "Segmento real da linha de referência",
      },
      { label: "Altura útil", value: height, unit: "mm", origin: "Altura do desenvolvimento" },
    ],
    tool: "riscador",
    animation: "line",
    validation: "A base deve medir exatamente o comprimento indicado, em esquadro com o eixo.",
  });

  if (pointAll.length) {
    steps.push({
      id: "divisao",
      title: "Divisão geométrica",
      instruction: `${copy.divide} São ${pointAll.length} pontos notáveis.`,
      geometryRefs: pointAll,
      measurements: [
        {
          label: "Pontos de divisão",
          value: pointAll.length,
          unit: "un",
          origin: "Pontos do desenvolvimento",
        },
      ],
      tool: "compasso",
      animation: "points",
      validation: "Todas as divisões devem ficar com a mesma abertura de compasso.",
    });
  }

  if (foldAll.length) {
    steps.push({
      id: "geratrizes",
      title: "Construção das geratrizes",
      instruction: `${copy.build} São ${foldAll.length} linhas de construção.`,
      geometryRefs: foldAll,
      measurements: [
        {
          label: "Geratrizes",
          value: foldAll.length,
          unit: "un",
          origin: "Linhas de dobra do desenvolvimento",
        },
      ],
      tool: "riscador",
      animation: "line",
      validation: "Cada geratriz liga pontos de mesma numeração, sem cruzamentos.",
    });
  }

  const lengths = result.trueLengths.slice(0, 12);
  if (lengths.length) {
    steps.push({
      id: "transferencia",
      title: "Transferência de medidas",
      instruction:
        "Transfira para a chapa o comprimento verdadeiro de cada geratriz, sempre a partir da linha de base.",
      geometryRefs: foldAll.length ? foldAll : pointAll,
      measurements: lengths.map((t) => ({
        label: t.id,
        value: mm(t.length),
        unit: "mm",
        origin: "Comprimento verdadeiro calculado",
      })),
      tool: "transferir",
      animation: "transfer",
      validation:
        "Confira duas medidas opostas: devem bater com a tabela de comprimentos verdadeiros.",
    });
  }

  steps.push({
    id: "contorno",
    title: "Construção da curva / perfil",
    instruction:
      "Ligue as extremidades transferidas com traço contínuo e suave, fechando o contorno do desenvolvimento.",
    geometryRefs: outlineAll,
    measurements: [
      {
        label: "Área desenvolvida",
        value: mm(result.areaMm2 / 1_000_000),
        unit: "m²",
        origin: "Área calculada",
      },
    ],
    tool: "riscador",
    animation: "curve",
    validation: "O contorno deve passar por todos os pontos transferidos, sem quinas falsas.",
  });

  steps.push({
    id: "marcacao",
    title: "Marcação final",
    instruction:
      "Marque o contorno de corte, as linhas de dobra, os recortes e as referências de montagem antes de tirar a peça da bancada.",
    geometryRefs: [...outlineAll, ...foldAll],
    measurements: [
      {
        label: "Linhas de corte",
        value: outlineAll.length,
        unit: "un",
        origin: "Contorno do desenvolvimento",
      },
      { label: "Linhas de dobra", value: foldAll.length, unit: "un", origin: "Linhas de dobra" },
    ],
    tool: "marcar",
    animation: "outline",
    validation: "Corte, dobra e recorte devem estar visualmente distintos na chapa.",
  });

  steps.push({
    id: "concluido",
    title: "Desenvolvimento concluído",
    instruction: "Desenvolvimento concluído. A chapa está pronta para corte.",
    geometryRefs: outlineAll,
    measurements: [],
    tool: "marcar",
    animation: "none",
    validation: "Confira o comprimento da base e uma geratriz antes de cortar.",
  });

  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

/** Nenhum passo pode apontar para geometria inexistente. */
export function validateSequence(result: GeometryResult, steps: TraceStep[]): string[] {
  const known = new Set(developmentRefs(result.development));
  const problems: string[] = [];
  for (const step of steps) {
    for (const ref of step.geometryRefs) {
      if (!known.has(ref) && !refExists(result.development, ref)) {
        problems.push(`${step.id}: referência inexistente ${ref}`);
      }
    }
  }
  return problems;
}
