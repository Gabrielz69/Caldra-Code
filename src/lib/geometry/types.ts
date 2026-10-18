export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };

export type Segment2 = { a: Vec2; b: Vec2 };

/** Passo pedagógico do "Entender o cálculo". */
export type CalcStep = {
  title: string;
  given: string;
  formula: string;
  substitution: string;
  result: string;
  meaning: string;
};

export type DevelopmentPattern = {
  /** Contorno externo fechado do desenvolvimento (mm). */
  outline: Vec2[];
  /** Linhas de dobra / geratrizes (mm). */
  foldLines: Segment2[];
  /** Pontos notáveis com rótulo. */
  points: { id: string; p: Vec2 }[];
  /** Extensão do padrão em mm. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

export type MetricRow = { label: string; value: number; unitMm?: boolean; suffix?: string };

/**
 * Peça física derivada do MESMO cálculo (ex.: cada gomo de uma curva).
 * Quantidade de gomos ≠ quantidade de peças: cada entidade tem código,
 * geometria e posição próprias.
 */
export type GeometryPiece = {
  code: string;
  name: string;
  quantity: number;
  development: DevelopmentPattern;
  metrics?: MetricRow[];
};

/** União física entre peças da decomposição (emenda soldada etc.). */
export type FabricationJoint = {
  id: string;
  kind: "weld";
  label: string;
  /** Posição da emenda descrita pelas geratrizes/arestas envolvidas. */
  position: string;
  /** Códigos das peças unidas. */
  between: [string, string];
};

export type GeometryResult = {
  metrics: MetricRow[];
  /** Comprimentos verdadeiros das geratrizes (mm). */
  trueLengths: { id: string; length: number }[];
  development: DevelopmentPattern;
  steps: CalcStep[];
  /** Área desenvolvida em mm². */
  areaMm2: number;
  method: string;
  warnings: string[];
  /** Peças individuais quando a peça se decompõe (curva de gomos, boca de lobo). */
  pieces?: GeometryPiece[] | undefined;
  /** Uniões físicas entre as peças (emendas soldadas), quando houver. */
  joints?: FabricationJoint[] | undefined;
};

export type ValidationIssue = { field: string; message: string };
