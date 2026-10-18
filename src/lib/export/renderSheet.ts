/**
 * renderSheet — PIPELINE ÚNICA DE FOLHA (PDF + PNG).
 *
 * A exportação é sempre uma NOVA renderização da folha a partir do modelo de
 * geometria. Zoom, pan e viewport do usuário NÃO influenciam o arquivo:
 * nada aqui lê o canvas da tela.
 *
 * Fluxo: entidades visíveis -> bounding box -> escala de ajuste à área útil
 * -> comandos em milímetros da folha -> rasterização (PNG 4K) ou vetor (PDF).
 */

import type { Vec2 } from "@/lib/geometry/types";
import { bbox, type Entity, type Layer } from "@/lib/lab2d/core";
import { autoDimensions } from "@/lib/lab2d/render";
import { SHEET_INK, techStyle } from "@/lib/lab2d/technical";

/* --------------------------------------------------------------- geometria */

export type Cmd =
  { c: "M"; p: Vec2 } | { c: "L"; p: Vec2 } | { c: "C"; c1: Vec2; c2: Vec2; p: Vec2 } | { c: "Z" };

export type Shape = {
  color: string;
  /** Espessura CONSTANTE em mm da folha — nunca derivada do zoom. */
  widthMm: number;
  dash: number[] | null;
  cmds: Cmd[];
};

export type SheetText = {
  x: number;
  y: number;
  text: string;
  sizePt: number;
  color: string;
  align: "left" | "right" | "center";
  bold?: boolean;
  mono?: boolean;
};

export type SheetPlan = {
  widthMm: number;
  heightMm: number;
  shapes: Shape[];
  texts: SheetText[];
  /** Extensão real da peça (mm) — usada no rodapé e no nome do arquivo. */
  pieceWidthMm: number;
  pieceHeightMm: number;
  count: number;
  scaleLabel: string;
  filenameBase: string;
};

export type SheetMeta = {
  project: string;
  plan: string;
  material?: string;
  thickness?: string;
  quantity?: string;
};

/* ---------------------------------------------------------------- constantes */

/** A4 paisagem. */
export const SHEET_W = 297;
export const SHEET_H = 210;
const MARGIN = 10;
const HEADER_H = 12;
const FOOTER_H = 8;
/** Espessura base de traço na folha (mm). */
const BASE_LW = 0.25;
const RULE_COLOR = "#10151c";
const MUTED = "#5b6672";

const TAU = Math.PI * 2;

/** Aproxima um arco por curvas cúbicas (erro < 1e-4·r). */
function arcCmds(cx: number, cy: number, r: number, a0: number, a1: number): Cmd[] {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += TAU;
  const n = Math.max(1, Math.ceil(sweep / (Math.PI / 2)));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (a: number): Vec2 => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const out: Cmd[] = [{ c: "M", p: at(a0) }];
  for (let i = 0; i < n; i++) {
    const s = a0 + step * i;
    const e = s + step;
    const p0 = at(s);
    const p1 = at(e);
    out.push({
      c: "C",
      c1: { x: p0.x - k * r * Math.sin(s), y: p0.y + k * r * Math.cos(s) },
      c2: { x: p1.x + k * r * Math.sin(e), y: p1.y - k * r * Math.cos(e) },
      p: p1,
    });
  }
  return out;
}

function entityCmds(e: Entity): Cmd[] {
  switch (e.type) {
    case "line":
      return [
        { c: "M", p: { x: e.x1, y: e.y1 } },
        { c: "L", p: { x: e.x2, y: e.y2 } },
      ];
    case "polyline": {
      if (!e.pts.length) return [];
      const [h, ...rest] = e.pts as [Vec2, ...Vec2[]];
      const out: Cmd[] = [{ c: "M", p: h }];
      for (const p of rest) out.push({ c: "L", p });
      if (e.closed) out.push({ c: "Z" });
      return out;
    }
    case "circle":
      return [...arcCmds(e.cx, e.cy, e.r, 0, TAU - 1e-9), { c: "Z" }];
    case "arc":
      return arcCmds(e.cx, e.cy, e.r, e.a0, e.a1);
    case "path": {
      const out: Cmd[] = [{ c: "M", p: e.start }];
      for (const s of e.segs)
        out.push(s.line ? { c: "L", p: s.p } : { c: "C", c1: s.c1, c2: s.c2, p: s.p });
      if (e.closed) out.push({ c: "Z" });
      return out;
    }
    case "text":
      return [];
  }
}

/* ------------------------------------------------------------------ montagem */

export type SheetOptions = { dimensions?: boolean; technicalColors?: boolean };

/** Constrói o plano da folha (fonte única da verdade de PDF e PNG). */
export function renderSheet(
  entities: Entity[],
  layers: Layer[],
  meta: SheetMeta,
  opts: SheetOptions = {},
): SheetPlan {
  const hidden = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
  const visible = entities.filter((e) => !hidden.has(e.layer));

  const dims = opts.dimensions ? autoDimensions(visible) : [];
  const probe: Entity[] = [...visible];
  for (const d of dims)
    probe.push({
      id: "d",
      layer: "cota",
      type: "line",
      x1: d.a.x,
      y1: d.a.y,
      x2: d.b.x,
      y2: d.b.y,
    });

  const box = bbox(probe) ?? { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const pieceBox = bbox(visible) ?? box;
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);

  const areaX = MARGIN;
  const areaY = MARGIN + HEADER_H;
  const areaW = SHEET_W - MARGIN * 2;
  const areaH = SHEET_H - MARGIN * 2 - HEADER_H - FOOTER_H;
  const k = Math.min(areaW / w, areaH / h);
  const offX = areaX + (areaW - w * k) / 2 - box.minX * k;
  const offY = areaY + (areaH - h * k) / 2 - box.minY * k;
  const P = (p: Vec2): Vec2 => ({ x: offX + p.x * k, y: offY + p.y * k });

  const map = (cmds: Cmd[]): Cmd[] =>
    cmds.map((c) =>
      c.c === "M" || c.c === "L"
        ? { c: c.c, p: P(c.p) }
        : c.c === "C"
          ? { c: "C", c1: P(c.c1), c2: P(c.c2), p: P(c.p) }
          : c,
    );

  const shapes: Shape[] = [];
  const texts: SheetText[] = [];

  for (const e of [...visible].sort(
    (a, b) => techStyle(a.layer).order - techStyle(b.layer).order,
  )) {
    const style = techStyle(e.layer);
    if (e.type === "text") {
      const p = P({ x: e.x, y: e.y });
      texts.push({
        x: p.x,
        y: p.y,
        text: e.text,
        sizePt: Math.max(5, e.size * k * 2.5),
        color: opts.technicalColors ? style.color : SHEET_INK,
        align: "left",
      });
      continue;
    }
    const cmds = entityCmds(e);
    if (!cmds.length) continue;
    shapes.push({
      color: opts.technicalColors ? style.color : SHEET_INK,
      widthMm: BASE_LW * style.weight,
      dash: dashFor(e.layer),
      cmds: map(cmds),
    });
  }

  // cotas de conferência
  const dimStyle = techStyle("cota");
  for (const d of dims) {
    const a = P(d.a);
    const b = P(d.b);
    shapes.push({
      color: SHEET_INK,
      widthMm: BASE_LW * dimStyle.weight,
      dash: d.kind === "radial" ? [1.2, 0.8] : null,
      cmds: [
        { c: "M", p: a },
        { c: "L", p: b },
      ],
    });
    texts.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - 1,
      text: d.label,
      sizePt: 6,
      color: SHEET_INK,
      align: "center",
      mono: true,
    });
  }

  /* ------------------------------------------------ cabeçalho e rodapé */

  const pieceW = Math.max(pieceBox.maxX - pieceBox.minX, 0);
  const pieceH = Math.max(pieceBox.maxY - pieceBox.minY, 0);
  const date = new Date();
  const dateLabel = date.toLocaleDateString("pt-BR");

  texts.push(
    {
      x: MARGIN,
      y: MARGIN + 4,
      text: "CALDRA",
      sizePt: 13,
      color: RULE_COLOR,
      align: "left",
      bold: true,
    },
    {
      x: MARGIN,
      y: MARGIN + 8.6,
      text: "TRAÇADO E PLANIFICAÇÃO ZERO FRESTA",
      sizePt: 6.2,
      color: MUTED,
      align: "left",
    },
    {
      x: SHEET_W - MARGIN,
      y: MARGIN + 4,
      text: meta.project,
      sizePt: 10,
      color: RULE_COLOR,
      align: "right",
      bold: true,
    },
    {
      x: SHEET_W - MARGIN,
      y: MARGIN + 8.6,
      text: meta.plan,
      sizePt: 6.2,
      color: MUTED,
      align: "right",
    },
  );

  // régua do cabeçalho
  shapes.push({
    color: RULE_COLOR,
    widthMm: 0.3,
    dash: null,
    cmds: [
      { c: "M", p: { x: MARGIN, y: MARGIN + HEADER_H - 1.5 } },
      { c: "L", p: { x: SHEET_W - MARGIN, y: MARGIN + HEADER_H - 1.5 } },
    ],
  });
  // moldura da área de desenho
  shapes.push({
    color: "#c7ced6",
    widthMm: 0.2,
    dash: null,
    cmds: [
      { c: "M", p: { x: areaX, y: areaY } },
      { c: "L", p: { x: areaX + areaW, y: areaY } },
      { c: "L", p: { x: areaX + areaW, y: areaY + areaH } },
      { c: "L", p: { x: areaX, y: areaY + areaH } },
      { c: "Z" },
    ],
  });

  const footY = SHEET_H - MARGIN + 1;
  const foot = [
    `Material  ${meta.material ?? "—"}`,
    `Espessura  ${meta.thickness ?? "—"}`,
    `Qtd  ${meta.quantity ?? "1"}`,
    `Extensão  ${pieceW.toFixed(1)} × ${pieceH.toFixed(1)} mm`,
  ];
  let fx = MARGIN;
  for (const t of foot) {
    texts.push({ x: fx, y: footY, text: t, sizePt: 6.5, color: MUTED, align: "left" });
    fx += 58;
  }
  texts.push({
    x: SHEET_W - MARGIN,
    y: footY,
    text: dateLabel,
    sizePt: 6.5,
    color: MUTED,
    align: "right",
  });

  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "folha";

  return {
    widthMm: SHEET_W,
    heightMm: SHEET_H,
    shapes,
    texts,
    pieceWidthMm: pieceW,
    pieceHeightMm: pieceH,
    count: visible.length,
    scaleLabel: `1:${(1 / k).toFixed(2)}`,
    filenameBase: `${slug(meta.project)}-${slug(meta.plan)}-${stamp}`,
  };
}

function dashFor(layerId: string): number[] | null {
  switch (layerId) {
    case "construcao":
      return [1.2, 1.2];
    case "referencia":
      return [4, 1.2, 0.8, 1.2];
    case "dobra":
      return [3.5, 1.4, 0.8, 1.4];
    case "marcacao":
      return [2.2, 1.4];
    default:
      return null;
  }
}

/* ------------------------------------------------------------------- PNG 4K */

const PNG_LONG_SIDE = 3840;

/** Rasteriza a folha em alta definição. Todas as linhas em preto puro. */
export function sheetToCanvas(plan: SheetPlan, longSide = PNG_LONG_SIDE): HTMLCanvasElement {
  const pxPerMm = longSide / Math.max(plan.widthMm, plan.heightMm);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(plan.widthMm * pxPerMm);
  canvas.height = Math.round(plan.heightMm * pxPerMm);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(pxPerMm, pxPerMm);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const s of plan.shapes) {
    ctx.strokeStyle = s.color;
    ctx.setLineDash(s.dash ?? []);
    ctx.lineWidth = s.widthMm;
    ctx.beginPath();
    for (const c of s.cmds) {
      if (c.c === "M") ctx.moveTo(c.p.x, c.p.y);
      else if (c.c === "L") ctx.lineTo(c.p.x, c.p.y);
      else if (c.c === "C") ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p.x, c.p.y);
      else ctx.closePath();
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const t of plan.texts) {
    const px = t.sizePt * 0.3528; // pt -> mm
    ctx.font = `${t.bold ? "600 " : ""}${px}px ${t.mono ? "ui-monospace, monospace" : "Helvetica, Arial, sans-serif"}`;
    ctx.textAlign = t.align === "right" ? "right" : t.align === "center" ? "center" : "left";
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  return canvas;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSheetPng(plan: SheetPlan) {
  const canvas = sheetToCanvas(plan);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Falha ao gerar PNG.");
  saveBlob(blob, `${plan.filenameBase}.png`);
}

/* ------------------------------------------------------------- PDF vetorial */

export async function downloadSheetPdf(plan: SheetPlan) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setLineCap("round");
  doc.setLineJoin("round");

  for (const s of plan.shapes) {
    doc.setDrawColor(s.color);
    doc.setLineWidth(s.widthMm);
    doc.setLineDashPattern(s.dash ?? [], 0);
    let started = false;
    let cur: Vec2 = { x: 0, y: 0 };
    let startPt: Vec2 = { x: 0, y: 0 };
    for (const c of s.cmds) {
      if (c.c === "M") {
        doc.moveTo(c.p.x, c.p.y);
        cur = c.p;
        startPt = c.p;
        started = true;
      } else if (c.c === "L") {
        doc.lineTo(c.p.x, c.p.y);
        cur = c.p;
      } else if (c.c === "C") {
        doc.curveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p.x, c.p.y);
        cur = c.p;
      } else if (started) {
        doc.lineTo(startPt.x, startPt.y);
        cur = startPt;
      }
    }
    void cur;
    if (started) doc.stroke();
  }
  doc.setLineDashPattern([], 0);

  for (const t of plan.texts) {
    doc.setTextColor(t.color);
    doc.setFont(t.mono ? "courier" : "helvetica", t.bold ? "bold" : "normal");
    doc.setFontSize(t.sizePt);
    doc.text(t.text, t.x, t.y, { align: t.align });
  }

  doc.save(`${plan.filenameBase}.pdf`);
}
