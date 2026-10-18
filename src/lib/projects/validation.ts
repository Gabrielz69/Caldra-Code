/**
 * VALIDAÇÃO DE FABRICAÇÃO — conferência do dossiê antes de cortar.
 *
 * Funções puras derivadas da mesma fonte já usada pela lista de materiais
 * (`projectBom`). Nada é recalculado por caminhos paralelos: aqui apenas
 * interpretamos as linhas do BOM e os dados da peça para apontar impedimentos
 * (erros), riscos (alertas) e observações (informações).
 */

import type { Material } from "@/lib/materials/types";
import { SHEETS_METRIC } from "@/lib/nesting/sheets";
import { projectBom, type BomLine, type ProjectBom } from "./bom";
import type { Project, ProjectPart } from "./store";

export type IssueLevel = "erro" | "alerta" | "info";

export type ValidationIssue = {
  id: string;
  level: IssueLevel;
  /** Código da peça envolvida, quando aplicável. */
  partCode?: string | undefined;
  instanceId?: string | undefined;
  title: string;
  detail: string;
};

export type ProjectValidation = {
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  infos: number;
  /** Verdadeiro quando não há impedimento para liberar a fabricação. */
  ready: boolean;
  bom: ProjectBom;
};

/** Maior chapa comercial disponível (mm), usada como limite físico de corte. */
const MAX_SHEET = SHEETS_METRIC.reduce(
  (best, s) => (s.w * s.h > best.w * best.h ? s : best),
  SHEETS_METRIC[0]!,
);

/** A peça cabe em alguma chapa comercial (com giro de 90°)? */
function fitsAnySheet(w: number, h: number): boolean {
  return SHEETS_METRIC.some((s) => (w <= s.w && h <= s.h) || (h <= s.w && w <= s.h));
}

const nearest = (list: number[], v: number) =>
  list.length === 0
    ? v
    : list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]!);

const fmt = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function partIssues(part: ProjectPart, line: BomLine, materials: Material[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const base = { partCode: line.code, instanceId: part.instanceId };

  if (!line.resolved) {
    out.push({
      ...base,
      id: `${part.instanceId}:geometria`,
      level: "erro",
      title: `${line.code} sem medida calculada`,
      detail: "Abra a peça e confirme os parâmetros: sem desenvolvimento não há corte nem massa.",
    });
  } else if (!fitsAnySheet(line.w, line.h)) {
    out.push({
      ...base,
      id: `${part.instanceId}:chapa`,
      level: "erro",
      title: `${line.code} maior que a chapa comercial`,
      detail: `Desenvolvimento ${fmt(line.w)} × ${fmt(line.h)} mm — a maior chapa é ${MAX_SHEET.label} mm. Divida a peça em segmentos com emenda.`,
    });
  }

  if (!(part.thickness > 0)) {
    out.push({
      ...base,
      id: `${part.instanceId}:espessura`,
      level: "erro",
      title: `${line.code} sem espessura`,
      detail: "Defina a espessura da chapa para calcular massa e custo.",
    });
  }

  const mat = materials.find(
    (m) =>
      m.id === part.materialId ||
      m.name.toLowerCase() === (part.material ?? "").trim().toLowerCase(),
  );

  if (!mat) {
    out.push({
      ...base,
      id: `${part.instanceId}:material`,
      level: "alerta",
      title: `${line.code} com material não cadastrado`,
      detail: `"${part.material || "—"}" não está na sua lista de materiais: massa e custo usam densidade padrão do aço.`,
    });
  } else if (part.thickness > 0 && !mat.thicknesses.includes(part.thickness)) {
    out.push({
      ...base,
      id: `${part.instanceId}:bitola`,
      level: "alerta",
      title: `${line.code} com espessura fora da bitola`,
      detail: `${fmt(part.thickness, 2)} mm não consta em ${mat.name}. A bitola comercial mais próxima é ${fmt(nearest(mat.thicknesses, part.thickness), 2)} mm.`,
    });
  }

  if (line.resolved && line.massUnitKg > 50) {
    out.push({
      ...base,
      id: `${part.instanceId}:manuseio`,
      level: "alerta",
      title: `${line.code} com ${fmt(line.massUnitKg, 1)} kg por unidade`,
      detail: "Acima de 50 kg exige içamento ou dois operadores no manuseio.",
    });
  }

  if (!part.assemblyId && !part.subassemblyId) {
    out.push({
      ...base,
      id: `${part.instanceId}:conjunto`,
      level: "info",
      title: `${line.code} sem conjunto`,
      detail: "Vincule a peça a um conjunto para organizar a montagem em obra.",
    });
  }

  return out;
}

/** Conferência completa do dossiê. */
export function validateProject(project: Project, materials: Material[] = []): ProjectValidation {
  const bom = projectBom(project, materials);
  const byId = new Map(bom.lines.map((l) => [l.instanceId, l]));
  const issues: ValidationIssue[] = [];

  if (project.parts.length === 0) {
    issues.push({
      id: "projeto:sem-pecas",
      level: "erro",
      title: "Projeto sem peças",
      detail: "Adicione peças da biblioteca para gerar corte, massa e custo.",
    });
  }

  for (const part of project.parts) {
    const line = byId.get(part.instanceId);
    if (line) issues.push(...partIssues(part, line, materials));
  }

  if (project.assemblies.length === 0 && project.parts.length > 3) {
    issues.push({
      id: "projeto:sem-estrutura",
      level: "info",
      title: "Projeto sem conjuntos",
      detail: "Com muitas peças, criar conjuntos facilita fabricação e montagem.",
    });
  }

  const order = { erro: 0, alerta: 1, info: 2 } as const;
  issues.sort((a, b) => order[a.level] - order[b.level]);

  const errors = issues.filter((i) => i.level === "erro").length;
  const warnings = issues.filter((i) => i.level === "alerta").length;
  const infos = issues.filter((i) => i.level === "info").length;

  return { issues, errors, warnings, infos, ready: errors === 0, bom };
}
