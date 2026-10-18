/**
 * CYPCT_GOLDEN_SAMPLE_01 — características OBSERVADAS em um arquivo LXDS
 * real exportado pelo CypCut 6.3.907.9 (cone excêntrico, peça 01).
 *
 * Isto é uma AMOSTRA, não uma especificação: não se pode afirmar que todo
 * LXDS se comporta assim. Serve para comparar estrutura em QA e para
 * engenharia reversa futura.
 */

import type { LxdsAnalysis } from "./lxdsAnalyzer";

export const CYPCT_GOLDEN_SAMPLE_01 = {
  id: "CYPCT_GOLDEN_SAMPLE_01",
  file: "cone-excentrico-p01-cnc.lxds",
  app: "CypCut",
  appVersion: "6.3.907.9",
  docType: "Model2D",
  /** Partes do contêiner ZIP (todas armazenadas sem compressão nesta amostra). */
  parts: [
    "info.xml",
    "content.xml",
    "Model2D/content.xml",
    "Model2D/thumbnail.emf",
    "Shapes2D/data.bin",
    "Shapes2D/content.xml",
    "TextStyles/content.xml",
    "Technical/content.xml",
    "Layers/content.xml",
    "Viewports/content.xml",
    "Geometry2D/data.bin",
    "Geometry2D/content.xml",
  ],
  layers: [
    { name: "CUT", color: "255", flag: "768" },
    { name: "MARK", color: "16711680", flag: "768" },
  ],
  layerCount: 2,
  shapeCount: 3,
  shapeClasses: ["LwPolyline"],
  hasCut: true,
  hasMark: true,
  hasBend: false,
  /** mm, coordenadas do documento (Y negativo, como no CypCut). */
  extents: { minX: 162.338898, minY: -1238.85498, maxX: 1073.04126, maxY: -109.196503 },
  technicalBlocks: [
    "Channels",
    "Channel",
    "CamParams",
    "LeadLineParam",
    "LayerCutParams",
    "CornerParams",
    "SuperCut",
    "Cut",
    "Pierce1",
    "MaterialParams",
  ],
  md5Parts: ["Shapes2D", "Geometry2D"],
  notes: [
    "Layers usam nomes em maiúsculas e sem acento: CUT e MARK.",
    "Cada entidade referencia sua layer pelo NOME, não pelo handle.",
    "Geometria fica em blobs binários endereçados por DataAddr/GeoAddr.",
    "Os parâmetros de processo (potência, pierce, lead, velocidade) vivem em Technical — nada disso é representável em DXF.",
    "Não há campo de sequência explícito no índice XML desta amostra.",
  ],
} as const;

export type GoldenRow = { field: string; expected: string; actual: string; ok: boolean };

/** Compara um LXDS carregado com a amostra de referência. */
export function compareToGolden(a: LxdsAnalysis): GoldenRow[] {
  const g = CYPCT_GOLDEN_SAMPLE_01;
  const row = (field: string, expected: unknown, actual: unknown): GoldenRow => ({
    field,
    expected: String(expected),
    actual: String(actual),
    ok: String(expected) === String(actual),
  });
  const names = a.layers.map((l) => l.name);
  return [
    row("Aplicação", g.app, a.app),
    row("Tipo de documento", g.docType, a.docType),
    row("Nº de layers", g.layerCount, a.layers.length),
    row("Nomes das layers", g.layers.map((l) => l.name).join(", "), names.join(", ")),
    row("Contém CUT", g.hasCut, names.includes("CUT")),
    row("Contém MARK", g.hasMark, names.includes("MARK")),
    row("Nº de entidades", g.shapeCount, a.shapes.length),
    row(
      "Classes de entidade",
      g.shapeClasses.join(", "),
      [...new Set(a.shapes.map((s) => s.klass))].join(", "),
    ),
    row("Partes com MD5", g.md5Parts.join(", "), a.md5.map((m) => m.part).join(", ")),
  ];
}
