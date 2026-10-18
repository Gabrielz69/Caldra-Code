/**
 * Tipos do modelo de fabricação usados pelo núcleo de geometria.
 * Módulo isolado para que `core.ts` não dependa de `manufacturing.ts`.
 */

export type LeadKind = "none" | "line" | "arc";

export type Lead = {
  kind: LeadKind;
  length: number;
  radius: number;
  angleDeg: number;
  side: "left" | "right";
};

/** Papel de fabricação explícito — prevalece sobre a camada de desenho. */
export type ManufacturingRoleId =
  "CUT" | "MARK" | "BEND" | "REFERENCE" | "DIMENSION" | "LEAD_IN" | "LEAD_OUT" | "DIRECTION";

/** Classificação estrutural de um corte (não muda a operação). */
export type StructureId = "outer" | "hole" | "slot" | "internal";

/** Dados de fabricação anexos a uma entidade — nunca desenho decorativo. */
export type CncMeta = {
  contourId?: string;
  sequence?: number;
  leadIn?: Lead;
  leadOut?: Lead;
  /** Operação explícita da entidade. Nunca derivada de cor. */
  role?: ManufacturingRoleId;
  /** Estrutura do corte: contorno externo, furo, rasgo ou corte interno. */
  structure?: StructureId;
};
