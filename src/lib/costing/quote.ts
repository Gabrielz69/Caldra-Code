/**
 * ORÇAMENTO — modelo puro + geração de PDF.
 *
 * O cálculo mora em `quoteTotals` (função pura, testável). O PDF é apenas
 * apresentação: nenhuma conta nova acontece dentro dele.
 */

import { jsPDF } from "jspdf";
import { formatMoney, type Region } from "@/lib/regional/regional";

export type QuoteItem = {
  id: string;
  description: string;
  detail: string;
  quantity: number;
  /** Custo de material do item (lote inteiro). */
  materialCost: number;
  /** Custo de fabricação do item (lote inteiro). */
  fabricationCost: number;
};

export type QuoteParty = {
  name: string;
  document: string;
  contact: string;
  address: string;
};

export type Quote = {
  number: string;
  date: number;
  validityDays: number;
  supplier: QuoteParty;
  customer: QuoteParty;
  items: QuoteItem[];
  /** Margem de lucro em % sobre o custo. */
  marginPct: number;
  /** Desconto em % sobre o subtotal com margem. */
  discountPct: number;
  /** Imposto em % (IVA/ICMS/sales tax conforme a região). */
  taxPct: number;
  notes: string;
};

export type QuoteTotals = {
  material: number;
  fabrication: number;
  cost: number;
  margin: number;
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  /** Preço final unitário médio (total ÷ quantidade total). */
  unit: number;
};

export function quoteTotals(q: Quote): QuoteTotals {
  const material = q.items.reduce((a, i) => a + i.materialCost, 0);
  const fabrication = q.items.reduce((a, i) => a + i.fabricationCost, 0);
  const cost = material + fabrication;
  const margin = cost * (q.marginPct / 100);
  const subtotal = cost + margin;
  const discount = subtotal * (q.discountPct / 100);
  const taxable = subtotal - discount;
  const tax = taxable * (q.taxPct / 100);
  const total = taxable + tax;
  const qty = q.items.reduce((a, i) => a + i.quantity, 0);
  return {
    material,
    fabrication,
    cost,
    margin,
    subtotal,
    discount,
    taxable,
    tax,
    total,
    unit: qty > 0 ? total / qty : 0,
  };
}

/** Preço final de um item, rateando margem, desconto e imposto proporcionalmente. */
export function itemPrice(q: Quote, item: QuoteItem): number {
  const t = quoteTotals(q);
  if (t.cost <= 0) return 0;
  const share = (item.materialCost + item.fabricationCost) / t.cost;
  return t.total * share;
}

export const emptyParty = (): QuoteParty => ({ name: "", document: "", contact: "", address: "" });

export function newQuote(region: Region): Quote {
  const now = new Date();
  const seq = String(now.getTime()).slice(-5);
  return {
    number: `${now.getFullYear()}-${seq}`,
    date: now.getTime(),
    validityDays: 15,
    supplier: emptyParty(),
    customer: emptyParty(),
    items: [],
    marginPct: 30,
    discountPct: 0,
    taxPct: region.taxPct,
    notes: "Prazo de entrega a combinar. Valores sujeitos à confirmação de medidas em campo.",
  };
}

/* ------------------------------------------------------------------- PDF */

const MM = (v: number) => v;

/** Gera o PDF do orçamento em A4 retrato e devolve o documento jsPDF. */
export function quotePdf(q: Quote, region: Region, opts?: { title?: string }): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210;
  const left = 16;
  const right = W - 16;
  const t = quoteTotals(q);
  const money = (v: number) => formatMoney(v, region);
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(opts?.title ?? "ORÇAMENTO", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nº ${q.number}`, right, y - 4, { align: "right" });
  doc.text(new Date(q.date).toLocaleDateString(region.locale), right, y, { align: "right" });
  doc.text(`Validade: ${q.validityDays} dias`, right, y + 4, { align: "right" });

  y += 8;
  doc.setDrawColor(20);
  doc.setLineWidth(0.4);
  doc.line(left, y, right, y);
  y += 7;

  const party = (label: string, p: QuoteParty, x: number) => {
    let py = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, x, py);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const line of [p.name, p.document, p.contact, p.address].filter(Boolean)) {
      py += 4.6;
      doc.text(String(line).slice(0, 48), x, py);
    }
    return py;
  };
  const y1 = party("FORNECEDOR", q.supplier, left);
  const y2 = party("CLIENTE", q.customer, left + 92);
  y = Math.max(y1, y2) + 8;

  // cabeçalho da tabela
  const cols = [left, left + 86, left + 104, left + 133, right];
  doc.setFillColor(238, 238, 238);
  doc.rect(left, y - 4.5, right - left, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESCRIÇÃO", cols[0]! + 1, y);
  doc.text("QTD", cols[1]!, y);
  doc.text("UNITÁRIO", cols[2]!, y);
  doc.text("TOTAL", cols[4]!, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const item of q.items) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const price = itemPrice(q, item);
    doc.text(item.description.slice(0, 46), cols[0]! + 1, y);
    doc.text(String(item.quantity), cols[1]!, y);
    doc.text(money(item.quantity > 0 ? price / item.quantity : 0), cols[2]!, y);
    doc.text(money(price), cols[4]!, y, { align: "right" });
    if (item.detail) {
      y += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(110);
      doc.text(item.detail.slice(0, 90), cols[0]! + 1, y);
      doc.setTextColor(0);
      doc.setFontSize(9);
    }
    y += 5.5;
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(left, y - 3.4, right, y - 3.4);
  }

  y += 4;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, MM(right - 62), y);
    doc.text(value, right, y, { align: "right" });
    y += bold ? 7 : 5;
  };
  row("Material", money(t.material));
  row("Fabricação", money(t.fabrication));
  row(`Margem (${q.marginPct}%)`, money(t.margin));
  if (q.discountPct > 0) row(`Desconto (${q.discountPct}%)`, `− ${money(t.discount)}`);
  if (q.taxPct > 0) row(`${region.taxLabel} (${q.taxPct}%)`, money(t.tax));
  doc.setDrawColor(20);
  doc.setLineWidth(0.4);
  doc.line(right - 62, y - 3, right, y - 3);
  y += 2;
  row("TOTAL", money(t.total), true);

  if (q.notes) {
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(doc.splitTextToSize(q.notes, right - left) as string[], left, y);
    doc.setTextColor(0);
  }

  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text("CALDRA — Traçado e Planificação Zero Fresta", left, 288);
  doc.setTextColor(0);
  return doc;
}

export const quoteFilename = (q: Quote) => `orcamento-${q.number}.pdf`;
