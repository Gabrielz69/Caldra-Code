/**
 * PAPÉIS DE FABRICAÇÃO (ManufacturingRole) E PERFIS DE EXPORTAÇÃO DXF.
 *
 * Regra absoluta do CALDRA:
 *
 *    A COR é representação visual.
 *    A LAYER/ROLE define a operação de fabricação.
 *
 * Nenhuma decisão de operação pode derivar de cor. O papel vem de
 * `cnc.role` (explícito) ou da camada semântica do desenho; geometria
 * sem papel é ERRO DE FABRICAÇÃO e nunca é exportada em silêncio.
 */

import type { CncMeta } from "@/lib/lab2d/cncTypes";
import type { Entity, LayerId } from "@/lib/lab2d/core";

export type ManufacturingRole =
  | "CUT"
  | "RECORTE"
  | "MARK"
  | "BEND"
  | "REFERENCE"
  | "DIMENSION"
  | "LEAD_IN"
  | "LEAD_OUT"
  | "DIRECTION";

/** Papéis que uma entidade de desenho pode assumir diretamente. */
export type EntityRole = "CUT" | "RECORTE" | "MARK" | "BEND" | "REFERENCE" | "DIMENSION";

export const ENTITY_ROLES: EntityRole[] = [
  "CUT",
  "RECORTE",
  "MARK",
  "BEND",
  "REFERENCE",
  "DIMENSION",
];

/** Papéis oferecidos ao usuário no CHAMFER — os únicos que ele escolhe. */
export const USER_ROLES: EntityRole[] = ["CUT", "MARK", "BEND", "RECORTE"];

export const ROLE_LABEL: Record<ManufacturingRole, string> = {
  CUT: "Corte",
  RECORTE: "Recorte",
  MARK: "Marcação",
  BEND: "Dobra",
  REFERENCE: "Referência",
  DIMENSION: "Cota",
  LEAD_IN: "Entrada",
  LEAD_OUT: "Saída",
  DIRECTION: "Direção (metadado)",
};

/** Camada semântica do desenho → papel de fabricação. Nunca por cor. */
export const ROLE_BY_LAYER: Record<string, ManufacturingRole> = {
  corte: "CUT",
  recorte: "RECORTE",
  marcacao: "MARK",
  dobra: "BEND",
  referencia: "REFERENCE",
  construcao: "REFERENCE",
  cota: "DIMENSION",
};

const metaOf = (e: Entity): CncMeta => (e as { cnc?: CncMeta }).cnc ?? {};

/** Papel de fabricação da entidade, ou null quando não classificada. */
export function roleOf(e: Entity): ManufacturingRole | null {
  const explicit = metaOf(e).role;
  if (explicit) return explicit;
  const byLayer = ROLE_BY_LAYER[e.layer as LayerId];
  if (byLayer) return byLayer;
  // texto técnico nunca é corte: na ausência de classificação é cota
  return e.type === "text" ? "DIMENSION" : null;
}

/** Entidades sem papel explícito nem camada semântica conhecida. */
export const unclassifiedOf = (entities: Entity[]) => entities.filter((e) => roleOf(e) === null);

/* ------------------------------------------------- estrutura dos contornos */

export type StructureKind = "outer" | "hole" | "slot" | "internal";

export const STRUCTURE_LABEL: Record<StructureKind, string> = {
  outer: "Contorno externo",
  hole: "Furo",
  slot: "Rasgo",
  internal: "Corte interno",
};

const isClosed = (e: Entity) =>
  e.type === "circle" || ((e.type === "polyline" || e.type === "path") && e.closed);

function bboxArea(e: Entity): number {
  if (e.type === "circle") return 4 * e.r * e.r;
  const pts =
    e.type === "polyline"
      ? e.pts
      : e.type === "path"
        ? [e.start, ...e.segs.map((s) => s.p)]
        : e.type === "line"
          ? [
              { x: e.x1, y: e.y1 },
              { x: e.x2, y: e.y2 },
            ]
          : [];
  if (!pts.length) return 0;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/**
 * Classificação estrutural do corte: o maior contorno fechado é o contorno
 * externo; demais fechados são furo (círculo) ou rasgo; abertos são cortes
 * internos. Todos continuam sendo operação CUT.
 */
export function structureMap(entities: Entity[]): Map<string, StructureKind> {
  const cuts = entities.filter((e) => roleOf(e) === "CUT" && e.type !== "text");
  const closed = cuts.filter(isClosed);
  let outerId: string | null = null;
  let best = -1;
  for (const e of closed) {
    const a = bboxArea(e);
    if (a > best) {
      best = a;
      outerId = e.id;
    }
  }
  const map = new Map<string, StructureKind>();
  for (const e of cuts) {
    const explicit = metaOf(e).structure;
    if (explicit) map.set(e.id, explicit);
    else if (e.id === outerId) map.set(e.id, "outer");
    else if (!isClosed(e)) map.set(e.id, "internal");
    else map.set(e.id, e.type === "circle" ? "hole" : "slot");
  }
  return map;
}

/* --------------------------------------------------- perfis de exportação */

/**
 * Mapeamento papel → nome de layer no arquivo. `null` = não exportar.
 * Trocar de máquina/CAM é trocar de perfil: a geometria nunca muda.
 */
export type DxfExportProfile = {
  id: string;
  name: string;
  description: string;
  layerMap: Record<ManufacturingRole, string | null>;
};

const TECHNICAL_MAP: Record<ManufacturingRole, string | null> = {
  CUT: "CUT",
  RECORTE: "RECORTE",
  MARK: "MARK",
  BEND: "BEND",
  REFERENCE: "REFERENCE",
  DIMENSION: "DIMENSION",
  LEAD_IN: "LEAD_IN",
  LEAD_OUT: "LEAD_OUT",
  DIRECTION: null, // direção é metadado, nunca geometria
};

/** Identificadores dos DOIS perfis oficiais. */
export const TECHNICAL_PROFILE_ID = "tecnico";
export const LASER_PROFILE_ID = "laser-cnc";

export const DXF_PROFILES: DxfExportProfile[] = [
  {
    id: TECHNICAL_PROFILE_ID,
    name: "DXF TÉCNICO",
    description:
      "Conferência e documentação: corte, recorte, marcação, dobra, referência e cotas em layers separadas.",
    layerMap: { ...TECHNICAL_MAP },
  },
  {
    id: LASER_PROFILE_ID,
    name: "DXF LASER CNC",
    description:
      "Máquina de corte a laser (CypCut e similares): corte, recorte, marcação e dobra em layers próprias, com entradas e saídas na layer de corte.",
    layerMap: {
      ...TECHNICAL_MAP,
      REFERENCE: null,
      DIMENSION: null,
      LEAD_IN: "CUT",
      LEAD_OUT: "CUT",
    },
  },
];

/** IDs antigos preservados: abrem o perfil equivalente atual. */
const PROFILE_ALIAS: Record<string, string> = {
  producao: LASER_PROFILE_ID,
  cypcut: LASER_PROFILE_ID,
};

export const DEFAULT_PROFILE_ID = LASER_PROFILE_ID;

export const profileById = (id: string): DxfExportProfile => {
  const key = PROFILE_ALIAS[id] ?? id;
  return DXF_PROFILES.find((p) => p.id === key) ?? DXF_PROFILES[DXF_PROFILES.length - 1]!;
};

/** Cor ACI por nome de layer de saída — visual apenas, sem valor semântico. */
export const EXPORT_ACI: Record<string, number> = {
  CUT: 1,
  RECORTE: 2,
  MARK: 5,
  BEND: 3,
  REFERENCE: 8,
  DIMENSION: 9,
  LEAD_IN: 4,
  LEAD_OUT: 4,
};

/**
 * CANAIS (Channel) DO DADO ESTENDIDO FS_CYPCUT.
 *
 * Observado no golden sample corrigido manualmente e aceito pelo CypCut
 * (`quadrado-redondo-p01.dxf`): o valor de `Channel` coincide com o nome
 * numérico da layer do arquivo — contorno de corte em layer "1" traz
 * `Channel 1`; as linhas auxiliares em layer "15" trazem `Channel 15`.
 *
 * ATENÇÃO: apenas 1 (corte) e 15 (auxiliar/marcação) estão ATESTADOS no
 * golden sample. Os demais valores abaixo são convenção do CALDRA, não
 * regra universal do CypCut, e podem ser ajustados por máquina.
 */
export const CYPCUT_CHANNEL: Record<ManufacturingRole, number> = {
  CUT: 1, // atestado no golden sample
  RECORTE: 2, // atestado em "batata 01.dxf" (layer 2 / Channel 2)
  MARK: 15, // atestado no golden sample
  BEND: 7, // atestado no golden sample corrigido
  REFERENCE: 14, // convenção CALDRA
  DIMENSION: 14, // convenção CALDRA
  LEAD_IN: 1, // entra junto do corte
  LEAD_OUT: 1, // entra junto do corte
  DIRECTION: 0, // metadado: nunca vira geometria
};

/** Papéis com canal CypCut atestado — usados no preflight do perfil laser. */
export const CYPCUT_MAPPED_ROLES: ManufacturingRole[] = ["CUT", "BEND", "RECORTE", "MARK"];

/** Nome do aplicativo registrado (APPID) dos dados estendidos do CypCut. */
export const CYPCUT_APPID = "FS_CYPCUT";
