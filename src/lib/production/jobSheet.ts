/**
 * FICHA DE PRODUÇÃO — folha de chão de fábrica com QR de rastreio.
 *
 * A ficha resume o que o caldeireiro precisa na bancada: peça, material,
 * espessura, quantidade, medidas de conferência e o QR que aponta para a
 * peça dentro do app.
 */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatLength, formatMoney, formatWeight, type Region } from "@/lib/regional/regional";

export type JobSheetRow = { label: string; value: string };

export type JobSheet = {
  code: string;
  piece: string;
  project: string;
  material: string;
  thicknessMm: number;
  quantity: number;
  massKg: number;
  costTotal: number;
  /** Cotas de conferência do traçado. */
  conference: JobSheetRow[];
  /** Instruções de fabricação. */
  steps: string[];
  /** Destino do QR (URL do app ou identificador da OS). */
  qrPayload: string;
};

/** DataURL PNG do QR — gerado no navegador, sem rede. */
export async function qrDataUrl(payload: string, size = 512): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

/** Gera a ficha em A4 retrato. Todas as linhas em tinta preta. */
export async function jobSheetPdf(sheet: JobSheet, region: Region): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const left = 16;
  const right = 194;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FICHA DE PRODUÇÃO", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sheet.project || "—", left, y + 5.5);

  const qr = await qrDataUrl(sheet.qrPayload);
  doc.addImage(qr, "PNG", right - 30, y - 8, 30, 30);
  doc.setFontSize(7.5);
  doc.text(sheet.code, right - 15, y + 25.5, { align: "center" });

  y += 16;
  doc.setDrawColor(20);
  doc.setLineWidth(0.4);
  doc.line(left, y, right - 34, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(sheet.piece, left, y);
  y += 8;

  const info: JobSheetRow[] = [
    { label: "Material", value: sheet.material },
    { label: "Espessura", value: formatLength(sheet.thicknessMm, region) },
    { label: "Quantidade", value: String(sheet.quantity) },
    { label: "Peso (lote)", value: formatWeight(sheet.massKg * sheet.quantity, region) },
    { label: "Custo (lote)", value: formatMoney(sheet.costTotal, region) },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const r of info) {
    doc.setTextColor(110);
    doc.text(r.label.toUpperCase(), left, y);
    doc.setTextColor(0);
    doc.text(r.value, left + 40, y);
    y += 5.4;
  }

  if (sheet.conference.length) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("CONFERÊNCIA DO TRAÇADO", left, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFillColor(240, 240, 240);
    for (const r of sheet.conference) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.rect(left, y - 3.6, right - left, 5.2, "F");
      doc.setTextColor(90);
      doc.text(r.label, left + 1.5, y);
      doc.setTextColor(0);
      doc.text(r.value, right - 1.5, y, { align: "right" });
      y += 6.4;
    }
  }

  if (sheet.steps.length) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("EXECUÇÃO", left, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    let n = 1;
    for (const s of sheet.steps) {
      const lines = doc.splitTextToSize(`${n}. ${s}`, right - left - 4) as string[];
      if (y + lines.length * 4.6 > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, left, y);
      y += lines.length * 4.6 + 1.4;
      n++;
    }
  }

  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text(`CALDRA · ${new Date().toLocaleString(region.locale)}`, left, 288);
  doc.setTextColor(0);
  return doc;
}
