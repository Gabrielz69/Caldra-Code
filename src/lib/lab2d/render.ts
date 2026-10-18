/**
 * Renderização de saída do Laboratório 2D.
 *
 * Gera um SVG autônomo (vetorial real, sem rasterização) a partir das
 * entidades, com enquadramento justo na peça e cotas de conferência
 * opcionais em âmbar. Esse mesmo SVG alimenta as exportações SVG, PNG e PDF,
 * garantindo que a prévia mostrada ao usuário seja idêntica ao arquivo final.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { bbox, dist, entityPoints, type Entity, type Layer } from "./core";
import { pathToSvg } from "./bezier";
import { DIMENSION_COLOR, techColor, techStyle } from "./technical";

export type RenderOptions = {
  dimensions: boolean;
  background: "white" | "transparent" | "dark";
  padding?: number;
  title?: string;
};

const AMBER = DIMENSION_COLOR;

/**
 * Cor de traço de uma entidade: sempre do sistema técnico fixo.
 * O tema visual do aplicativo não interfere na exportação.
 */
export const colorFor = (_layer: Layer | undefined, id: string, _dark: boolean) => techColor(id);

const f = (n: number) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(3));

/** Caminho SVG de uma entidade em coordenadas reais (mm). */
export function entityPath(e: Entity): string {
  switch (e.type) {
    case "line":
      return `M ${f(e.x1)} ${f(e.y1)} L ${f(e.x2)} ${f(e.y2)}`;
    case "polyline": {
      if (!e.pts.length) return "";
      const [h, ...rest] = e.pts as [Vec2, ...Vec2[]];
      return (
        `M ${f(h.x)} ${f(h.y)} ` +
        rest.map((p) => `L ${f(p.x)} ${f(p.y)}`).join(" ") +
        (e.closed ? " Z" : "")
      );
    }
    case "circle":
      return (
        `M ${f(e.cx - e.r)} ${f(e.cy)} ` +
        `A ${f(e.r)} ${f(e.r)} 0 1 0 ${f(e.cx + e.r)} ${f(e.cy)} ` +
        `A ${f(e.r)} ${f(e.r)} 0 1 0 ${f(e.cx - e.r)} ${f(e.cy)} Z`
      );
    case "arc": {
      const p0 = { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) };
      const p1 = { x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) };
      let sweep = e.a1 - e.a0;
      while (sweep < 0) sweep += Math.PI * 2;
      const large = sweep > Math.PI ? 1 : 0;
      return `M ${f(p0.x)} ${f(p0.y)} A ${f(e.r)} ${f(e.r)} 0 ${large} 1 ${f(p1.x)} ${f(p1.y)}`;
    }
    case "path":
      return pathToSvg(e.start, e.segs, e.closed);
    case "text":
      return "";
    default:
      return "";
  }
}

export type Dimension = { a: Vec2; b: Vec2; label: string; kind: "linear" | "radial" };

/** Cotas automáticas de conferência derivadas da geometria. */
export function autoDimensions(entities: Entity[]): Dimension[] {
  const out: Dimension[] = [];
  for (const e of entities) {
    if (e.type === "circle")
      out.push({
        a: { x: e.cx - e.r, y: e.cy },
        b: { x: e.cx + e.r, y: e.cy },
        label: `Ø${(e.r * 2).toFixed(1)}`,
        kind: "radial",
      });
    if (e.type === "arc")
      out.push({
        a: { x: e.cx, y: e.cy },
        b: { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) },
        label: `R${e.r.toFixed(1)}`,
        kind: "radial",
      });
    if (e.type === "line")
      out.push({
        a: { x: e.x1, y: e.y1 },
        b: { x: e.x2, y: e.y2 },
        label: dist({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }).toFixed(1),
        kind: "linear",
      });
  }
  const box = bbox(entities);
  if (box) {
    const off = Math.max((box.maxY - box.minY) * 0.12, 8);
    out.push({
      a: { x: box.minX, y: box.maxY + off },
      b: { x: box.maxX, y: box.maxY + off },
      label: `${(box.maxX - box.minX).toFixed(1)}`,
      kind: "linear",
    });
    out.push({
      a: { x: box.minX - off, y: box.minY },
      b: { x: box.minX - off, y: box.maxY },
      label: `${(box.maxY - box.minY).toFixed(1)}`,
      kind: "linear",
    });
  }
  return out;
}

function dimMarkup(d: Dimension, s: number): string {
  const mx = (d.a.x + d.b.x) / 2;
  const my = (d.a.y + d.b.y) / 2;
  const ang = (Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x) * 180) / Math.PI;
  const flip = ang > 90 || ang < -90 ? 180 : 0;
  return (
    `<g stroke="${AMBER}" fill="${AMBER}" stroke-width="${f(0.9 * s)}">` +
    `<path d="M ${f(d.a.x)} ${f(d.a.y)} L ${f(d.b.x)} ${f(d.b.y)}" fill="none"${
      d.kind === "radial" ? ` stroke-dasharray="${f(3 * s)} ${f(2 * s)}"` : ""
    }/>` +
    `<circle cx="${f(d.a.x)}" cy="${f(d.a.y)}" r="${f(1.2 * s)}" stroke="none"/>` +
    `<circle cx="${f(d.b.x)}" cy="${f(d.b.y)}" r="${f(1.2 * s)}" stroke="none"/>` +
    `<text x="${f(mx)}" y="${f(my - 2.2 * s)}" transform="rotate(${f(ang + flip)} ${f(mx)} ${f(my)})" ` +
    `font-size="${f(4.2 * s)}" text-anchor="middle" stroke="none" ` +
    `font-family="ui-monospace, monospace">${d.label}</text></g>`
  );
}

export type RenderResult = { svg: string; widthMm: number; heightMm: number; count: number };

/** SVG autônomo, enquadrado na peça, em coordenadas reais (1 unidade = 1 mm). */
export function renderSvg(entities: Entity[], layers: Layer[], opts: RenderOptions): RenderResult {
  const dims = opts.dimensions ? autoDimensions(entities) : [];
  const probe: Entity[] = [...entities];
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
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  const pad = opts.padding ?? Math.max(w, h) * 0.06 + 4;
  const s = Math.max(w, h) / 200; // escala do traço em relação à peça
  const dark = opts.background === "dark";

  const body = [...entities]
    .sort((a, b) => techStyle(a.layer).order - techStyle(b.layer).order)
    .map((e) => {
      const layer = layers.find((l) => l.id === e.layer);
      const style = techStyle(e.layer);
      const stroke = colorFor(layer, e.layer, dark);
      if (e.type === "text") {
        const width = e.width ? ` textLength="${f(e.width)}" lengthAdjust="spacingAndGlyphs"` : "";
        const rotate = e.rotation
          ? ` transform="rotate(${f(e.rotation)} ${f(e.x)} ${f(e.y)})"`
          : "";
        return `<text x="${f(e.x)}" y="${f(e.y)}" font-size="${f(e.size)}" fill="${stroke}" font-family="Space Grotesk,ui-sans-serif,system-ui" font-weight="${e.bold ? "700" : "400"}" font-style="${e.italic ? "italic" : "normal"}"${width}${rotate}>${escapeXml(e.text)}</text>`;
      }
      const d = entityPath(e);
      if (!d) return "";
      const pattern = style.dash(s);
      const dash = pattern ? ` stroke-dasharray="${pattern}"` : "";
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(
        1.1 * s * style.weight,
      )}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
    })
    .join("");

  const bg =
    opts.background === "transparent"
      ? ""
      : `<rect x="${f(box.minX - pad)}" y="${f(box.minY - pad)}" width="${f(w + pad * 2)}" height="${f(
          h + pad * 2,
        )}" fill="${dark ? "#0f1115" : "#ffffff"}"/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(box.minX - pad)} ${f(box.minY - pad)} ${f(
      w + pad * 2,
    )} ${f(h + pad * 2)}" width="${f(w + pad * 2)}mm" height="${f(h + pad * 2)}mm">` +
    bg +
    body +
    dims.map((d) => dimMarkup(d, s)).join("") +
    `</svg>`;

  return { svg, widthMm: w, heightMm: h, count: entities.length };
}

function escapeXml(t: string) {
  return t.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}

/* ------------------------------------------------------------- downloads */

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: string, filename: string) {
  saveBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), ensureExt(filename, "svg"));
}

const ensureExt = (n: string, ext: string) => (n.endsWith(`.${ext}`) ? n : `${n}.${ext}`);

/** PNG em alta resolução, enquadrado na peça. */
export async function downloadPng(
  svg: string,
  filename: string,
  opts: { transparent: boolean; pxPerMm?: number } = { transparent: false },
) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Falha ao renderizar o desenho."));
    img.src = url;
  });
  const ratio = img.height / img.width || 1;
  const width = Math.min(4000, Math.max(1200, Math.round(img.width * (opts.pxPerMm ?? 6))));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  if (!opts.transparent) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Falha ao gerar PNG.");
  saveBlob(blob, ensureExt(filename, "png"));
}

export type SheetMeta = {
  project: string;
  plan: string;
  material?: string;
  thickness?: string;
  quantity?: string;
  scale?: string;
};

/** Prancha técnica: abre a janela de impressão já com a peça visível. */
export function printSheet(svg: string, meta: SheetMeta, widthMm: number, heightMm: number) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) throw new Error("Bloqueio de pop-up impediu a geração do PDF.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeXml(meta.project)} — ${escapeXml(meta.plan)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  html,body { height:100%; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; color:#10151c; margin:0; display:flex; flex-direction:column; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid #10151c; padding-bottom:6px; }
  h1 { font-size:15px; margin:0; letter-spacing:.08em; }
  .sub { font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:#5b6672; }
  .stage { flex:1; display:flex; align-items:center; justify-content:center; border:1px solid #c7ced6; margin-top:8px; padding:6px; min-height:0; }
  .stage svg { max-width:100%; max-height:100%; width:auto; height:auto; }
  footer { margin-top:6px; font-size:9px; color:#5b6672; display:flex; gap:16px; }
  footer b { color:#10151c; font-weight:600; }
</style></head><body>
<header>
  <div><h1>CALDRA</h1><div class="sub">Traçado e Planificação Zero Fresta</div></div>
  <div style="text-align:right"><div style="font-size:13px;font-weight:600">${escapeXml(meta.project)}</div><div class="sub">${escapeXml(meta.plan)}</div></div>
</header>
<div class="stage">${svg}</div>
<footer>
  <span>Material <b>${escapeXml(meta.material ?? "—")}</b></span>
  <span>Espessura <b>${escapeXml(meta.thickness ?? "—")}</b></span>
  <span>Qtd <b>${escapeXml(meta.quantity ?? "1")}</b></span>
  <span>Extensão <b>${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm</b></span>
  <span style="margin-left:auto">${new Date().toLocaleDateString("pt-BR")}</span>
</footer>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export { AMBER };
