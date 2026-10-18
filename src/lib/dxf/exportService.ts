/**
 * DXF EXPORT SERVICE — PONTO ÚNICO DE EXPORTAÇÃO DXF DO CHAMFER.
 *
 * REGRA ARQUITETURAL: um único exportador, um único pipeline, três perfis.
 *
 *   PARÂMETROS → GEOMETRIA CANÔNICA → buildCncDxf() → exportDxf() → arquivo
 *
 * DXF TÉCNICO e DXF LASER CNC NÃO são exportadores: são apenas configurações
 * (`DXF_PROFILE_*`) do mesmo pipeline. Nenhum componente de interface pode
 * gerar DXF por conta própria — todos passam por `exportDXF()`.
 *
 * A camada do arquivo representa a FUNÇÃO DE FABRICAÇÃO (ManufacturingRole).
 * Cor é apenas representação visual e nunca é fonte de verdade.
 */

import {
  DEFAULT_CNC_OPTIONS,
  buildCncDxf,
  cncCounts,
  preflightCnc,
  validateCncExport,
  verifyCncDxf,
  type CncExportOptions,
  type CncPreflightRow,
  type CncRole,
} from "@/lib/dxf/cncExport";
import { exportDxf, type DxfDocument } from "@/lib/dxf/dxfService";
import type { Entity } from "@/lib/lab2d/core";
import type { CncIssue } from "@/lib/lab2d/manufacturing";
import { LASER_PROFILE_ID, profileById, TECHNICAL_PROFILE_ID } from "@/lib/lab2d/roles";

/** Perfis = configurações do mesmo exportador. */
export const DXF_PROFILE_TECHNICAL = TECHNICAL_PROFILE_ID;
export const DXF_PROFILE_LASER = LASER_PROFILE_ID;
/** IDs antigos — continuam abrindo o perfil equivalente atual. */
export const DXF_PROFILE_PRODUCTION = "producao";
export const DXF_PROFILE_CYPCUT = "cypcut";

/** Metadados descritivos do arquivo — não alteram a geometria. */
export type DxfMetadata = {
  project?: string;
  plan?: string;
  material?: string;
  thickness?: number;
  quantity?: number;
};

export type DxfExportRequest = {
  /** Geometria canônica do CHAMFER (nunca reinterpretada aqui). */
  geometry: Entity[];
  /** Perfil de exportação. */
  profile?: string;
  /** Conteúdo habilitado por função de fabricação. */
  roles?: Partial<Record<CncRole, boolean>>;
  leads?: boolean;
  flattenCurves?: boolean;
  metadata?: DxfMetadata;
};

/** Opções padrão de um perfil: exporta o que o perfil permite. */
export function optionsForProfile(
  profileId: string,
  overrides: Partial<CncExportOptions> = {},
): CncExportOptions {
  const profile = profileById(profileId);
  const roles = (Object.keys(DEFAULT_CNC_OPTIONS.roles) as CncRole[]).reduce(
    (acc, r) => ({ ...acc, [r]: profile.layerMap[r] !== null }),
    {} as Record<CncRole, boolean>,
  );
  return { ...DEFAULT_CNC_OPTIONS, profileId: profile.id, roles, ...overrides };
}

export function optionsFrom(req: DxfExportRequest): CncExportOptions {
  const base = optionsForProfile(req.profile ?? DXF_PROFILE_LASER);
  return {
    ...base,
    roles: { ...base.roles, ...req.roles },
    leads: req.leads ?? base.leads,
    flattenCurves: req.flattenCurves ?? base.flattenCurves,
  };
}

export type DxfExportResult = {
  ok: boolean;
  doc: DxfDocument;
  text: string;
  issues: CncIssue[];
  errors: CncIssue[];
  preflight: CncPreflightRow[];
  counts: ReturnType<typeof cncCounts>;
  verification: ReturnType<typeof verifyCncDxf>;
  options: CncExportOptions;
};

/** Gera o DXF completo com validação/preflight. Não baixa nada. */
export function exportDXF(req: DxfExportRequest): DxfExportResult {
  const options = optionsFrom(req);
  const doc = buildCncDxf(req.geometry, options);
  const text = exportDxf(doc);
  const issues = validateCncExport(req.geometry, options);
  const errors = issues.filter((i) => i.level === "error");
  const preflight = preflightCnc(req.geometry, options);
  return {
    ok: errors.length === 0 && preflight.every((r) => r.ok) && doc.entities.length > 0,
    doc,
    text,
    issues,
    errors,
    preflight,
    counts: cncCounts(req.geometry),
    verification: verifyCncDxf(req.geometry, options, text),
    options,
  };
}

/** Único caminho de download de DXF da interface. */
export function downloadDXF(req: DxfExportRequest, filename: string): DxfExportResult {
  const result = exportDXF(req);
  const blob = new Blob([result.text], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".dxf") ? filename : `${filename}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
  return result;
}
