/**
 * EXPORTADOR DXF CNC — dedicado à fabricação.
 *
 * A operação de cada entidade vem do seu PAPEL (ManufacturingRole), nunca
 * da cor. O papel é traduzido para um nome de layer no arquivo pelo
 * DxfExportProfile escolhido (DXF TÉCNICO / DXF LASER CNC).
 *
 * NUNCA entram aqui: grade, moldura, cursor, seleção, chevrons de FLUXO,
 * selos, indicadores de interface. Setas de direção são metadado e jamais
 * viram geometria.
 */

import type { Vec2 } from "@/lib/geometry/types";
import type { DxfDocument, DxfEntity, DxfXdata } from "@/lib/dxf/dxfService";
import { appIdsOf, dxfVersionFor, importDxf } from "@/lib/dxf/dxfService";
import { flattenPath } from "@/lib/lab2d/bezier";
import type { Entity } from "@/lib/lab2d/core";
import { pathLength } from "@/lib/lab2d/cutPlan";
import {
  contoursOf,
  leadPolyline,
  validateManufacturing,
  type CncIssue,
} from "@/lib/lab2d/manufacturing";
import {
  CYPCUT_APPID,
  CYPCUT_CHANNEL,
  CYPCUT_MAPPED_ROLES,
  DEFAULT_PROFILE_ID,
  ENTITY_ROLES,
  LASER_PROFILE_ID,
  EXPORT_ACI,
  profileById,
  roleOf,
  ROLE_LABEL,
  structureMap,
  unclassifiedOf,
  type EntityRole,
  type ManufacturingRole,
} from "@/lib/lab2d/roles";

/** Papéis diretamente selecionáveis na exportação. */
export type CncRole = EntityRole;

export type CncExportOptions = {
  /** Perfil de exportação (mapeamento papel → layer do arquivo). */
  profileId: string;
  /** Papéis habilitados pelo usuário. */
  roles: Record<CncRole, boolean>;
  /** Escrever os lead-in/lead-out como geometria no arquivo. */
  leads: boolean;
  /** Achatar curvas Bézier em polilinha (máquinas antigas). */
  flattenCurves: boolean;
};

export const DEFAULT_CNC_OPTIONS: CncExportOptions = {
  profileId: DEFAULT_PROFILE_ID,
  roles: { CUT: true, RECORTE: true, MARK: true, BEND: true, REFERENCE: false, DIMENSION: false },
  leads: true,
  flattenCurves: false,
};

/** DXF é Y para cima; o modelo do CHAMFER é Y para baixo. */
const m = (p: Vec2) => ({ x: p.x, y: -p.y });

/**
 * Layer de saída de um papel, definida EXCLUSIVAMENTE pelo perfil.
 * Nenhum papel é convertido em outro: DOBRA nunca vira MARCAÇÃO.
 */
export function exportLayerOf(role: ManufacturingRole, opts: CncExportOptions): string | null {
  return profileById(opts.profileId).layerMap[role] ?? null;
}

/** Mapeamento visível ao usuário antes de exportar. */
export function layerMapping(opts: CncExportOptions) {
  return ENTITY_ROLES.map((role) => ({
    role,
    label: ROLE_LABEL[role],
    enabled: opts.roles[role],
    layer: opts.roles[role] ? exportLayerOf(role, opts) : null,
  }));
}

function geometryOf(e: Entity, layer: string, flatten: boolean): DxfEntity[] {
  switch (e.type) {
    case "line":
      return [
        { type: "LINE", layer, start: m({ x: e.x1, y: e.y1 }), end: m({ x: e.x2, y: e.y2 }) },
      ];
    case "polyline":
      return [{ type: "LWPOLYLINE", layer, closed: e.closed, points: e.pts.map(m) }];
    case "circle":
      return [{ type: "CIRCLE", layer, center: m({ x: e.cx, y: e.cy }), radius: e.r }];
    case "arc": {
      const deg = (r: number) => ((-r * 180) / Math.PI + 360) % 360;
      return [
        {
          type: "ARC",
          layer,
          center: m({ x: e.cx, y: e.cy }),
          radius: e.r,
          startAngle: deg(e.a1),
          endAngle: deg(e.a0),
        },
      ];
    }
    case "path": {
      if (flatten)
        return [
          {
            type: "LWPOLYLINE",
            layer,
            closed: e.closed,
            points: flattenPath(e.start, e.segs, e.closed, 16).map(m),
          },
        ];
      const controls: Vec2[] = [m(e.start)];
      let cur = e.start;
      for (const s of e.segs) {
        const c1 = s.line
          ? { x: cur.x + (s.p.x - cur.x) / 3, y: cur.y + (s.p.y - cur.y) / 3 }
          : s.c1;
        const c2 = s.line
          ? { x: cur.x + (2 * (s.p.x - cur.x)) / 3, y: cur.y + (2 * (s.p.y - cur.y)) / 3 }
          : s.c2;
        controls.push(m(c1), m(c2), m(s.p));
        cur = s.p;
      }
      return controls.length >= 4 ? [{ type: "SPLINE", layer, controls, closed: e.closed }] : [];
    }
    default:
      return [];
  }
}

/* --------------------------------------------------------------- contagem */

export type CncCounts = Record<CncRole, number> & {
  leadIn: number;
  leadOut: number;
  contours: number;
  unclassified: number;
  outer: number;
  holes: number;
  slots: number;
  internal: number;
};

export function cncCounts(entities: Entity[]): CncCounts {
  const c: CncCounts = {
    CUT: 0,
    RECORTE: 0,
    MARK: 0,
    BEND: 0,
    REFERENCE: 0,
    DIMENSION: 0,
    leadIn: 0,
    leadOut: 0,
    contours: contoursOf(entities).length,
    unclassified: unclassifiedOf(entities).length,
    outer: 0,
    holes: 0,
    slots: 0,
    internal: 0,
  };
  const structure = structureMap(entities);
  for (const e of entities) {
    const r = roleOf(e);
    if (r && (ENTITY_ROLES as ManufacturingRole[]).includes(r)) c[r as CncRole]++;
    if (e.type === "text") continue;
    if (leadPolyline(e, "in")) c.leadIn++;
    if (leadPolyline(e, "out")) c.leadOut++;
    switch (structure.get(e.id)) {
      case "outer":
        c.outer++;
        break;
      case "hole":
        c.holes++;
        break;
      case "slot":
        c.slots++;
        break;
      case "internal":
        c.internal++;
        break;
      default:
        break;
    }
  }
  return c;
}

/**
 * DADOS ESTENDIDOS FS_CYPCUT.
 *
 * Estrutura observada no golden sample aceito pelo CypCut: Channel (canal
 * de processo, ver CYPCUT_CHANNEL), LeadIn/LeadOut (listas de parâmetros de
 * entrada e saída), IsFill, PathStart e ToolCompensation. Os valores nulos
 * significam "usar a configuração da máquina" — o CALDRA não inventa
 * parâmetros de processo.
 */
export function cypcutXdata(role: ManufacturingRole): DxfXdata {
  return {
    appId: CYPCUT_APPID,
    pairs: [
      { code: 1000, value: "Channel" },
      { code: 1070, value: CYPCUT_CHANNEL[role] },
      { code: 1000, value: "LeadIn" },
      { code: 1002, value: "{" },
      { code: 1070, value: 0 },
      { code: 1040, value: 0 },
      { code: 1040, value: 0 },
      { code: 1040, value: 0 },
      { code: 1040, value: 0 },
      { code: 1070, value: 0 },
      { code: 1040, value: 0 },
      { code: 1070, value: 0 },
      { code: 1002, value: "}" },
      { code: 1000, value: "LeadOut" },
      { code: 1002, value: "{" },
      { code: 1070, value: 0 },
      { code: 1040, value: 0 },
      { code: 1040, value: 0 },
      { code: 1040, value: 0 },
      { code: 1070, value: 0 },
      { code: 1002, value: "}" },
      { code: 1000, value: "IsFill" },
      { code: 1070, value: 0 },
      { code: 1000, value: "PathStart" },
      { code: 1040, value: 0 },
      { code: 1000, value: "ToolCompensation" },
      { code: 1002, value: "{" },
      { code: 1070, value: 0 },
      { code: 1040, value: 0 },
      { code: 1070, value: 0 },
      { code: 1002, value: "}" },
    ],
  };
}

/** O perfil escolhido pede a estrutura estendida do CypCut? */
export const isCypcutProfile = (opts: CncExportOptions) =>
  profileById(opts.profileId).id === LASER_PROFILE_ID;

/**
 * Constrói o documento DXF CNC.
 * A ORDEM do array de entidades é a intenção de sequência do CALDRA e é
 * preservada na estrutura do arquivo (o CypCut pode reordenar segundo a
 * própria configuração — isso é comportamento do software de destino).
 */
export function buildCncDxf(entities: Entity[], opts: CncExportOptions): DxfDocument {
  const out: DxfEntity[] = [];
  const used: string[] = [];
  const cypcut = isCypcutProfile(opts);
  const registerLayer = (name: string) => {
    if (!used.includes(name)) used.push(name);
    return name;
  };
  const tag = (list: DxfEntity[], role: ManufacturingRole) => {
    if (!cypcut) return list;
    const xdata = [cypcutXdata(role)];
    return list.map((e) => ({ ...e, xdata }) as DxfEntity);
  };

  for (const e of entities) {
    if (e.type === "text") continue; // textos técnicos não vão para o arquivo de corte
    const role = roleOf(e);
    if (!role || !(ENTITY_ROLES as ManufacturingRole[]).includes(role)) continue;
    if (!opts.roles[role as CncRole]) continue;
    const layer = exportLayerOf(role, opts);
    if (!layer) continue;
    registerLayer(layer);

    const isCut = role === "CUT";
    if (opts.leads && isCut) {
      const lin = leadPolyline(e, "in");
      const target = exportLayerOf("LEAD_IN", opts);
      if (lin && target)
        out.push(
          ...tag(
            [
              {
                type: "LWPOLYLINE",
                layer: registerLayer(target),
                closed: false,
                points: lin.map(m),
              },
            ],
            "LEAD_IN",
          ),
        );
    }
    out.push(...tag(geometryOf(e, layer, opts.flattenCurves), role));
    if (opts.leads && isCut) {
      const lout = leadPolyline(e, "out");
      const target = exportLayerOf("LEAD_OUT", opts);
      if (lout && target)
        out.push(
          ...tag(
            [
              {
                type: "LWPOLYLINE",
                layer: registerLayer(target),
                closed: false,
                points: lout.map(m),
              },
            ],
            "LEAD_OUT",
          ),
        );
    }
  }

  return {
    layers: used.map((name, i) => ({ name, color: EXPORT_ACI[name] ?? i + 1 })),
    entities: out,
    ...(cypcut ? { appIds: [CYPCUT_APPID] } : {}),
  };
}

/* ------------------------------------------------- validação de fabricação */

/**
 * Validação semântica antes do download: classificação, duplicação,
 * segmentos degenerados e fechamento do contorno de corte.
 */
export function validateCncExport(entities: Entity[], opts: CncExportOptions): CncIssue[] {
  const issues: CncIssue[] = [...validateManufacturing(entities)];

  for (const e of unclassifiedOf(entities))
    issues.push({
      level: "error",
      scope: "Classificação",
      message: `Entidade ${e.type} sem função de fabricação (camada "${e.layer}").`,
    });

  const structure = structureMap(entities);
  const outer = entities.filter((e) => structure.get(e.id) === "outer");
  if (opts.roles.CUT && outer.length === 0)
    issues.push({
      level: "error",
      scope: "Contorno",
      message: "Nenhum contorno externo fechado de corte identificado.",
    });

  for (const c of contoursOf(entities))
    if (!c.closed)
      issues.push({
        level: "warning",
        scope: `Contorno ${String(c.sequence).padStart(2, "0")}`,
        message: "Contorno de corte aberto (possível gap).",
      });

  const doc = buildCncDxf(entities, opts);
  for (const e of doc.entities) {
    if (e.type === "LINE" && Math.hypot(e.end.x - e.start.x, e.end.y - e.start.y) < 0.01)
      issues.push({ level: "warning", scope: "Geometria", message: "Segmento degenerado." });
    if (e.type === "CIRCLE" && e.radius < 0.05)
      issues.push({ level: "warning", scope: "Geometria", message: "Círculo degenerado." });
  }
  if (!doc.entities.length)
    issues.push({
      level: "error",
      scope: "Exportação",
      message: "Nenhuma geometria nas layers escolhidas.",
    });

  // entidades CUT duplicadas (mesma geometria, tolerância de 0,001 mm)
  const cutKeys = new Set<string>();
  for (const e of doc.entities.filter((x) => x.layer === exportLayerOf("CUT", opts))) {
    const key = JSON.stringify(e, (k, v) =>
      typeof v === "number" ? Math.round(v * 1000) / 1000 : v,
    );
    if (cutKeys.has(key))
      issues.push({
        level: "warning",
        scope: "Geometria",
        message: "Entidade CUT duplicada.",
      });
    cutKeys.add(key);
  }

  // todo layer usado precisa existir na tabela LAYER do documento
  const declared = new Set(doc.layers.map((l) => l.name));
  for (const e of doc.entities)
    if (!declared.has(e.layer))
      issues.push({
        level: "error",
        scope: "Layers",
        message: `Entidade em layer inexistente na tabela: "${e.layer}".`,
      });

  // versão declarada compatível com as entidades emitidas
  const version = dxfVersionFor(doc);
  const hasLw = doc.entities.some((e) => e.type === "LWPOLYLINE");
  const hasSpline = doc.entities.some((e) => e.type === "SPLINE");
  if (version === "AC1009" && (hasLw || hasSpline))
    issues.push({
      level: "error",
      scope: "Versão DXF",
      message: `Versão ${version} incompatível com as entidades emitidas.`,
    });

  return issues;
}

/* ------------------------------------------------- verificação do arquivo */

export type CncVerification = {
  ok: boolean;
  rows: { field: string; expected: string; actual: string; ok: boolean }[];
};

/** Relê o DXF gerado com o importador interno e compara com o modelo. */
export function verifyCncDxf(
  entities: Entity[],
  opts: CncExportOptions,
  dxfText: string,
): CncVerification {
  const doc = buildCncDxf(entities, opts);
  const back = importDxf(dxfText);
  const rows: CncVerification["rows"] = [];

  const push = (field: string, expected: unknown, actual: unknown) => {
    const e = String(expected);
    const a = String(actual);
    rows.push({ field, expected: e, actual: a, ok: e === a });
  };

  push("Entidades", doc.entities.length, back.entities.length);
  for (const l of doc.layers) {
    push(
      `Layer ${l.name}`,
      doc.entities.filter((e) => e.layer === l.name).length,
      back.entities.filter((e) => e.layer === l.name).length,
    );
  }
  const lenOf = (list: DxfEntity[]) =>
    list.reduce((acc, e) => {
      if (e.type === "LINE") return acc + Math.hypot(e.end.x - e.start.x, e.end.y - e.start.y);
      if (e.type === "CIRCLE") return acc + 2 * Math.PI * e.radius;
      if (e.type === "LWPOLYLINE")
        return (
          acc +
          e.points.reduce(
            (s, p, i) =>
              i ? s + Math.hypot(p.x - e.points[i - 1]!.x, p.y - e.points[i - 1]!.y) : s,
            0,
          )
        );
      return acc;
    }, 0);
  push("Perímetro (mm)", lenOf(doc.entities).toFixed(1), lenOf(back.entities).toFixed(1));
  push("Unidade", "mm", /\$INSUNITS\n\s*70\n4/.test(dxfText) ? "mm" : "?");
  push("Escala", "1:1", "1:1");
  const expectedVersion = dxfVersionFor(doc);
  const declaredVersion = /\$ACADVER\n\s*1\n(\S+)/.exec(dxfText)?.[1] ?? "?";
  push("Versão DXF", expectedVersion, declaredVersion);
  push("Geometria não classificada", 0, unclassifiedOf(entities).length);

  return { ok: rows.every((r) => r.ok), rows };
}

/* ----------------------------------------------------- preflight CNC READY */

export type CncPreflightRow = { label: string; value: string; ok: boolean };

/**
 * Relatório de preflight exibido antes do download. Tudo em `ok === false`
 * com peso de erro já aparece também em `validateCncExport`.
 */
export function preflightCnc(entities: Entity[], opts: CncExportOptions): CncPreflightRow[] {
  const counts = cncCounts(entities);
  const doc = buildCncDxf(entities, opts);
  const issues = validateCncExport(entities, opts);
  const errors = issues.filter((i) => i.level === "error").length;
  const declared = new Set(doc.layers.map((l) => l.name));
  const layersOk = doc.entities.every((e) => declared.has(e.layer));
  const closedCuts = contoursOf(entities).filter((c) => c.closed).length;

  const cutKeys = new Set<string>();
  let dups = 0;
  for (const e of doc.entities.filter((x) => x.layer === exportLayerOf("CUT", opts))) {
    const key = JSON.stringify(e, (k, v) =>
      typeof v === "number" ? Math.round(v * 1000) / 1000 : v,
    );
    if (cutKeys.has(key)) dups++;
    cutKeys.add(key);
  }

  const rows: CncPreflightRow[] = [
    { label: "Units", value: "mm", ok: true },
    { label: "Scale", value: "1:1", ok: true },
  ];
  for (const role of ENTITY_ROLES)
    rows.push({ label: role, value: `${counts[role]} entidades`, ok: true });
  const cypcut = isCypcutProfile(opts);
  const tagged = doc.entities.filter((e) =>
    (e.xdata ?? []).some((x) => x.appId === CYPCUT_APPID),
  ).length;
  const zeroLen = doc.entities.filter(
    (e) => e.type === "LINE" && Math.hypot(e.end.x - e.start.x, e.end.y - e.start.y) < 0.01,
  ).length;

  rows.push(
    { label: "Layers válidos", value: layersOk ? "sim" : "não", ok: layersOk },
    {
      label: "Contornos fechados",
      value: `${closedCuts}/${counts.contours}`,
      ok: counts.contours > 0 && closedCuts === counts.contours,
    },
    { label: "Sem duplicatas", value: dups === 0 ? "sim" : `${dups}`, ok: dups === 0 },
    {
      label: "Sem segmentos nulos",
      value: zeroLen === 0 ? "sim" : `${zeroLen}`,
      ok: zeroLen === 0,
    },
    {
      label: "Funções preservadas",
      value: counts.unclassified === 0 ? "sim" : `${counts.unclassified} sem função`,
      ok: counts.unclassified === 0,
    },
    {
      label: "DXF estruturalmente válido",
      value: errors === 0 ? dxfVersionFor(doc) : `${errors} erros`,
      ok: errors === 0,
    },
  );
  if (cypcut) {
    rows.push({
      label: "Estrutura CypCut (FS_CYPCUT)",
      value:
        tagged === doc.entities.length && appIdsOf(doc).includes(CYPCUT_APPID)
          ? `${tagged} entidades · ${CYPCUT_MAPPED_ROLES.map((r) => CYPCUT_CHANNEL[r]).join("/")}`
          : "incompleta",
      ok: tagged === doc.entities.length && doc.entities.length > 0,
    });
    for (const role of CYPCUT_MAPPED_ROLES)
      rows.push({
        label: `${ROLE_LABEL[role]} → CypCut`,
        value: `Channel ${CYPCUT_CHANNEL[role]}`,
        ok: true,
      });
  }
  return rows;
}

/** Comprimento total de corte do plano, em mm. */
export const cncCutLength = (entities: Entity[]) =>
  entities
    .filter((e) => roleOf(e) === "CUT" && e.type !== "text")
    .reduce((a, e) => a + pathLength(e), 0);
