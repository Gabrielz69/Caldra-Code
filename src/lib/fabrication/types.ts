/**
 * CAMADA DE FABRICAÇÃO — separada da GEOMETRIA.
 *
 * A geometria responde por forma, superfícies, dimensões, interseções e
 * planificação geométrica. Esta camada responde por espessura, dobras, raio
 * interno, linha neutra, Fator K, allowance e deduction.
 *
 * Nenhum valor de material, K, Y, allowance ou deduction é assumido aqui:
 * o que não for informado pelo usuário não existe.
 */

/** Métodos previstos; apenas os marcados como suportados podem ser usados. */
export type DevelopmentMethod = "geometric" | "k-factor" | "y-factor" | "shop-table";

export const SUPPORTED_METHODS: readonly DevelopmentMethod[] = ["geometric", "k-factor"] as const;

export function isMethodSupported(m: DevelopmentMethod): boolean {
  return SUPPORTED_METHODS.includes(m);
}

export const METHOD_LABELS: Record<DevelopmentMethod, string> = {
  geometric: "Geométrico",
  "k-factor": "Fator K",
  "y-factor": "Fator Y",
  "shop-table": "Tabela de fabricação",
};

/** Dobra real da peça. Sem valor padrão de K: ausente significa "usar o do projeto". */
export type Bend = {
  bendId: string;
  /** ângulo de dobra em graus (ângulo de flexão, não o ângulo incluso) */
  angleDeg: number;
  /** raio interno (mm) */
  insideRadius: number;
  /** K específico desta dobra; ausente = usar o K padrão do projeto */
  kFactor?: number;
  /** direção da dobra, apenas informativa para a visualização técnica */
  direction?: "up" | "down";
};

/** Configuração de fabricação do projeto. */
export type FabricationConfig = {
  /** espessura da chapa (mm); 0 ou ausente = sem espessura declarada */
  thickness: number;
  method: DevelopmentMethod;
  /** K padrão do projeto; ausente = não informado */
  defaultKFactor?: number;
  /** identificação da origem dos parâmetros (oficina/usuário), quando houver */
  source?: string;
};

/** Registro previsto da futura Biblioteca de Dobra. Nunca pré-preenchida. */
export type BendLibraryEntry = {
  material: string;
  thickness: number;
  process: string;
  tool?: string;
  insideRadius: number;
  angleDeg: number;
  kFactor?: number;
  yFactor?: number;
  bendAllowance?: number;
  bendDeduction?: number;
  /** valores calibrados pelo próprio usuário/oficina */
  source: "user";
};

/** Estado técnico calculado de uma dobra — é dado, não rótulo visual. */
export type BendState = {
  bendId: string;
  angleDeg: number;
  insideRadius: number;
  thickness: number;
  kFactor: number;
  /** distância da face interna até a linha neutra (mm) */
  neutralAxisOffset: number;
  /** raio da linha neutra: R + K × T */
  neutralRadius: number;
  bendAllowance: number;
  bendDeduction: number;
  method: DevelopmentMethod;
};

/** Motivo pelo qual uma dobra não pôde ser resolvida. */
export type BendIssue = {
  bendId: string;
  reason: "missing-thickness" | "missing-k" | "unsupported-method" | "invalid-parameters";
  message: string;
};
