/**
 * PACOTE DE FABRICAÇÃO + IDENTIFICAÇÃO (QR).
 *
 * Um único documento com tudo que a oficina precisa para executar o dossiê:
 * capa, estrutura (conjuntos/subconjuntos), lista de materiais, conferência de
 * fabricação e uma ficha por peça com QR de rastreio.
 *
 * Fonte única: `projectBom` e `validateProject` — nada é recalculado aqui.
 * Todas as linhas saem em tinta preta, como o restante das exportações.
 */

import { jsPDF } from "jspdf";
import type { Material } from "@/lib/materials/types";
import { formatMoney, formatWeight, type Region } from "@/lib/regional/regional";
import { qrDataUrl } from "@/lib/production/jobSheet";
import { projectBom, type BomLine } from "./bom";
import { validateProject } from "./validation";
import { PART_STATUS_LABEL, PROJECT_STATUS_LABEL, derivedStatus, projectProgress } from "./store";
import type { Project } from "./store";

const LEFT = 16;
const RIGHT = 194;

/** Endereço de rastreio da peça (abre o dossiê no app). */
export function partTrackUrl(project: Project, instanceId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://caldra.app");
  return `${base}/projetos/${project.id}?peca=${instanceId}`;
}

const num = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function footer(doc: jsPDF, region: Region, label: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(`${label} · CALDRA · ${new Date().toLocaleString(region.locale)}`, LEFT, 288);
    doc.text(`${i}/${pages}`, RIGHT, 288, { align: "right" });
    doc.setTextColor(0);
  }
}

function heading(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(text.toUpperCase(), LEFT, y);
  doc.setDrawColor(20);
  doc.setLineWidth(0.3);
  doc.line(LEFT, y + 1.6, RIGHT, y + 1.6);
  return y + 8;
}

function row(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(label.toUpperCase(), LEFT, y);
  doc.setTextColor(0);
  doc.text(value, LEFT + 42, y);
  return y + 5.4;
}

function table(doc: jsPDF, head: string[], widths: number[], rows: string[][], y: number): number {
  const step = 5.6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(90);
  let x = LEFT;
  head.forEach((h, i) => {
    doc.text(h.toUpperCase(), x, y);
    x += widths[i] ?? 20;
  });
  y += 3;
  doc.setDrawColor(200);
  doc.line(LEFT, y, RIGHT, y);
  y += 4.6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  for (const r of rows) {
    if (y > 272) {
      doc.addPage();
      y = 20;
    }
    x = LEFT;
    r.forEach((c, i) => {
      const w = widths[i] ?? 20;
      const lines = doc.splitTextToSize(c, w - 2) as string[];
      doc.text(lines[0] ?? "", x, y);
      x += w;
    });
    y += step;
  }
  return y + 2;
}

/** Gera o pacote de fabricação completo em A4 retrato. */
export async function fabricationPackagePdf(
  project: Project,
  materials: Material[],
  region: Region,
  options: { origin?: string; includeSheets?: boolean } = {},
): Promise<jsPDF> {
  const bom = projectBom(project, materials);
  const validation = validateProject(project, materials);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ---------- Capa ----------
  let y = 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("PACOTE DE FABRICAÇÃO", LEFT, y);
  doc.setFontSize(12);
  y += 8;
  doc.text(project.name, LEFT, y);
  y += 4;

  const qr = await qrDataUrl(partTrackUrl(project, "", options.origin));
  doc.addImage(qr, "PNG", RIGHT - 28, 14, 28, 28);

  y = heading(doc, "Identificação", y + 6);
  y = row(doc, "Código", `${project.code ?? "—"} · REV ${project.revision}`, y);
  y = row(doc, "Cliente", project.client || "—", y);
  y = row(doc, "Tipo", project.type ?? "—", y);
  y = row(
    doc,
    "Situação",
    `${PROJECT_STATUS_LABEL[derivedStatus(project)]} · ${projectProgress(project)}%`,
    y,
  );
  y = row(doc, "Peças", `${bom.lines.reduce((s, l) => s + l.quantity, 0)} un`, y);
  y = row(doc, "Massa total", formatWeight(bom.totalMassKg, region), y);
  y = row(doc, "Custo estimado", bom.totalCost > 0 ? formatMoney(bom.totalCost, region) : "—", y);
  if (project.description) {
    const lines = doc.splitTextToSize(project.description, RIGHT - LEFT) as string[];
    doc.setTextColor(60);
    doc.text(lines.slice(0, 4), LEFT, y + 2);
    doc.setTextColor(0);
    y += lines.slice(0, 4).length * 4.6 + 4;
  }

  // ---------- Estrutura ----------
  y = heading(doc, "Estrutura do conjunto", y + 6);
  const structure: string[][] = [];
  const push = (level: string, name: string, info: string) => structure.push([level, name, info]);
  for (const asm of project.assemblies) {
    const partsOf = project.parts.filter((p) => p.assemblyId === asm.id && !p.subassemblyId);
    push("CONJ", asm.name, `${partsOf.length} peça(s) diretas`);
    for (const sub of project.subassemblies.filter((s) => s.assemblyId === asm.id)) {
      const sp = project.parts.filter((p) => p.subassemblyId === sub.id);
      push("SUB", `  ${sub.name}`, `${sp.length} peça(s)`);
      for (const p of sp) push("PEÇA", `    ${p.code} ${p.name}`, `${p.quantity} un`);
    }
    for (const p of partsOf) push("PEÇA", `  ${p.code} ${p.name}`, `${p.quantity} un`);
  }
  for (const p of project.parts.filter((p) => !p.assemblyId)) {
    push("PEÇA", `${p.code} ${p.name}`, `${p.quantity} un · sem conjunto`);
  }
  y = structure.length
    ? table(doc, ["Nível", "Item", "Info"], [20, 120, 42], structure, y)
    : row(doc, "Estrutura", "Projeto sem conjuntos cadastrados.", y);

  // ---------- Lista de materiais ----------
  if (y > 210) {
    doc.addPage();
    y = 20;
  }
  y = heading(doc, "Lista de materiais", y + 6);
  y = table(
    doc,
    ["Código", "Peça", "Material", "Esp.", "Qtd", "Medida", "Massa"],
    [24, 46, 34, 16, 12, 30, 20],
    bom.lines.map((l) => [
      l.code,
      l.name,
      l.material || "—",
      `${num(l.thickness, 1)}`,
      String(l.quantity),
      l.resolved ? `${num(l.w, 0)}×${num(l.h, 0)}` : "pendente",
      `${num(l.massTotalKg, 2)} kg`,
    ]),
    y,
  );
  y = row(
    doc,
    "Totais",
    `${num(bom.totalAreaM2, 3)} m² · ${formatWeight(bom.totalMassKg, region)}`,
    y + 2,
  );

  // ---------- Conferência ----------
  if (y > 220) {
    doc.addPage();
    y = 20;
  }
  y = heading(doc, "Conferência de fabricação", y + 6);
  y = row(
    doc,
    "Situação",
    validation.ready
      ? "LIBERADO PARA CORTE"
      : `${validation.errors} impedimento(s) · ${validation.warnings} alerta(s)`,
    y,
  );
  if (validation.issues.length) {
    y = table(
      doc,
      ["Nível", "Peça", "Ponto", "Detalhe"],
      [18, 24, 52, 84],
      validation.issues.map((i) => [i.level.toUpperCase(), i.partCode ?? "—", i.title, i.detail]),
      y,
    );
  }

  // ---------- Fichas por peça ----------
  if (options.includeSheets !== false) {
    for (const line of bom.lines) {
      const part = project.parts.find((p) => p.instanceId === line.instanceId);
      doc.addPage();
      await partSheet(doc, project, line, part?.status, region, options.origin);
    }
  }

  footer(doc, region, `${project.code ?? project.name}`);
  return doc;
}

async function partSheet(
  doc: jsPDF,
  project: Project,
  line: BomLine,
  status: string | undefined,
  region: Region,
  origin?: string,
) {
  let y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${line.code} · ${line.name}`, LEFT, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${project.name} · ${project.code ?? "—"} REV ${project.revision}`, LEFT, y + 5.5);
  doc.setTextColor(0);

  const qr = await qrDataUrl(partTrackUrl(project, line.instanceId, origin));
  doc.addImage(qr, "PNG", RIGHT - 28, y - 8, 28, 28);

  y = heading(doc, "Dados da peça", y + 18);
  y = row(doc, "Modelo", line.modelName, y);
  y = row(doc, "Conjunto", line.assembly, y);
  y = row(doc, "Material", `${line.material || "—"} · ${num(line.thickness, 1)} mm`, y);
  y = row(doc, "Quantidade", `${line.quantity} un`, y);
  y = row(
    doc,
    "Desenvolvimento",
    line.resolved ? `${num(line.w, 1)} × ${num(line.h, 1)} mm` : "pendente de parâmetros",
    y,
  );
  y = row(doc, "Massa (lote)", formatWeight(line.massTotalKg, region), y);
  if (status) {
    y = row(
      doc,
      "Status",
      PART_STATUS_LABEL[status as keyof typeof PART_STATUS_LABEL] ?? status,
      y,
    );
  }

  y = heading(doc, "Execução", y + 6);
  const steps = [
    "Conferir material e espessura antes de marcar a chapa.",
    "Transferir o desenvolvimento para a chapa conferindo as medidas gerais.",
    "Cortar respeitando a sobremedida e identificar a peça com o código acima.",
    "Conferir dobras, furação e alinhamento antes da montagem.",
    "Registrar a peça como finalizada no dossiê após a conferência.",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  steps.forEach((s, i) => {
    doc.text(`${i + 1}. ${s}`, LEFT, y);
    y += 5.4;
  });

  y = heading(doc, "Conferência na bancada", y + 6);
  doc.setDrawColor(180);
  for (const label of ["Medida A", "Medida B", "Diagonal", "Esquadro", "Visto do inspetor"]) {
    doc.setTextColor(110);
    doc.setFontSize(8.5);
    doc.text(label.toUpperCase(), LEFT, y);
    doc.setTextColor(0);
    doc.line(LEFT + 42, y + 0.8, RIGHT, y + 0.8);
    y += 8;
  }
}

/** Folha de etiquetas com QR — 2 colunas × 5 linhas por página A4. */
export async function partLabelsPdf(
  project: Project,
  materials: Material[],
  options: { origin?: string } = {},
): Promise<jsPDF> {
  const bom = projectBom(project, materials);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const cols = 2;
  const rows = 5;
  const w = (RIGHT - LEFT) / cols;
  const h = 52;
  let i = 0;

  for (const line of bom.lines) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const col = slot % cols;
    const rowIdx = Math.floor(slot / cols);
    const x = LEFT + col * w;
    const y = 16 + rowIdx * h;

    doc.setDrawColor(190);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w - 4, h - 6);

    const qr = await qrDataUrl(partTrackUrl(project, line.instanceId, options.origin));
    doc.addImage(qr, "PNG", x + 3, y + 4, 30, 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(line.code, x + 36, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const nameLines = doc.splitTextToSize(line.name, w - 42) as string[];
    doc.text(nameLines.slice(0, 2), x + 36, y + 16);
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`${line.material || "—"} · ${num(line.thickness, 1)} mm`, x + 36, y + 27);
    doc.text(`${line.quantity} un · ${line.assembly}`, x + 36, y + 32);
    doc.setTextColor(0);
    doc.setFontSize(7.5);
    doc.text(`${project.name} · ${project.code ?? "—"} REV ${project.revision}`, x + 3, y + 41);
    i++;
  }

  if (i === 0) {
    doc.setFontSize(10);
    doc.text("Projeto sem peças para identificar.", LEFT, 24);
  }
  return doc;
}
