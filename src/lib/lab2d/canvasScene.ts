/**
 * Camada de DESENHO do CHAMFER em canvas 2D.
 *
 * O modelo de geometria e as ferramentas continuam idênticos: aqui só muda
 * como os pixels aparecem. Aplica culling pelo índice espacial, LOD durante
 * gestos e mantém rigorosamente as cores técnicas fixas do CALDRA.
 */

import type { Vec2 } from "@/lib/geometry/types";
import type { Box, Entity } from "./core";
import { samplePath } from "./bezier";
import { SELECTION_COLOR, techStyle } from "./technical";
import { viewportBox, type SpatialIndex } from "./spatialIndex";

export type SceneView = { tx: number; ty: number; k: number };

export type SceneOptions = {
  index: SpatialIndex;
  view: SceneView;
  width: number;
  height: number;
  dpr: number;
  selection: Set<string>;
  /** Durante pan/zoom: versão simplificada (sem tracejado, sem detalhes < 1px). */
  lod: boolean;
  /** Tema claro ativo para contraste da seleção */
  isLight?: boolean;
  /** Movimento destravado via Long-Press (destaque ciano/laranja brilhante de arraste ativo) */
  isDraggingUnlocked?: boolean;
};

/** Ordena por camada técnica ou por profundidade Z (Painter's Algorithm para oclusão 2.5D/3D). */
function paintOrder(list: Entity[]) {
  return list.slice().sort((a, b) => {
    const aDepth = typeof a.params?.depth === "number" ? (a.params.depth as number) : null;
    const bDepth = typeof b.params?.depth === "number" ? (b.params.depth as number) : null;
    if (aDepth !== null && bDepth !== null) {
      return aDepth - bDepth; // Menor profundidade (fundo) desenhado antes, maior (frente) desenhado por cima!
    }
    if (a.params?.isIsoSolidFace && !b.params?.isIsoSolidFace) return -1;
    if (!a.params?.isIsoSolidFace && b.params?.isIsoSolidFace) return 1;
    return techStyle(a.layer).order - techStyle(b.layer).order;
  });
}

function tracePolyline(ctx: CanvasRenderingContext2D, pts: Vec2[], closed: boolean, step: number) {
  if (!pts.length) return;
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = step; i < pts.length; i += step) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  const last = pts[pts.length - 1]!;
  ctx.lineTo(last.x, last.y);
  if (closed) ctx.closePath();
}

function traceEntity(ctx: CanvasRenderingContext2D, e: Entity, lod: boolean) {
  switch (e.type) {
    case "line":
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      break;
    case "polyline":
      tracePolyline(ctx, e.pts, !!e.closed, lod && e.pts.length > 64 ? 3 : 1);
      break;
    case "circle":
      ctx.moveTo(e.cx + e.r, e.cy);
      ctx.arc(e.cx, e.cy, e.r, 0, Math.PI * 2);
      break;
    case "arc": {
      let sweep = e.a1 - e.a0;
      while (sweep < 0) sweep += Math.PI * 2;
      ctx.moveTo(e.cx + e.r * Math.cos(e.a0), e.cy + e.r * Math.sin(e.a0));
      ctx.arc(e.cx, e.cy, e.r, e.a0, e.a0 + sweep);
      break;
    }
    case "path": {
      ctx.moveTo(e.start.x, e.start.y);
      for (const s of e.segs)
        if (s.line) ctx.lineTo(s.p.x, s.p.y);
        else ctx.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p.x, s.p.y);
      if (e.closed) ctx.closePath();
      break;
    }
    case "ellipse": {
      ctx.ellipse(e.cx, e.cy, e.rx, e.ry, e.rotation ?? 0, 0, Math.PI * 2);
      break;
    }
    case "point": {
      ctx.moveTo(e.x + 2, e.y);
      ctx.arc(e.x, e.y, 2, 0, Math.PI * 2);
      break;
    }
    case "hatch": {
      tracePolyline(ctx, e.boundaryPts, true, 1);
      break;
    }
    case "text":
      break;
  }
}

const screenSize = (b: Box | undefined, k: number) =>
  b ? Math.max(b.maxX - b.minX, b.maxY - b.minY) * k : Infinity;

/** Redesenha a cena inteira. Chamado apenas quando algo sujou (rAF). */
export function drawScene(ctx: CanvasRenderingContext2D, opts: SceneOptions) {
  const { view, width, height, dpr, index, selection, lod } = opts;

  const safeK = Number.isFinite(view.k) && view.k > 0 ? view.k : 1;
  const safeTx = Number.isFinite(view.tx) ? view.tx : 0;
  const safeTy = Number.isFinite(view.ty) ? view.ty : 0;
  const safeW = Number.isFinite(width) && width > 0 ? width : 800;
  const safeH = Number.isFinite(height) && height > 0 ? height : 600;
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;

  ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
  ctx.clearRect(0, 0, safeW, safeH);
  ctx.setTransform(safeDpr * safeK, 0, 0, safeDpr * safeK, safeDpr * safeTx, safeDpr * safeTy);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const box = viewportBox({ k: safeK, tx: safeTx, ty: safeTy }, safeW, safeH);
  const list = paintOrder(index.query(box));
  const inv = 1 / safeK;

  // agrupa por estilo para minimizar trocas de estado do contexto
  let currentLayer = "";
  for (const e of list) {
    if (e.type === "text") continue;
    if (lod && screenSize(index.boxOfId(e.id), view.k) < 1.2) continue;

    // RENDERIZAÇÃO SÓLIDA TÉCNICA COM SOMBREAMENTO E OCLUSÃO (CHAMFER ISO 2.5D/3D)
    if (e.params?.isIsoSolidFace) {
      currentLayer = ""; // reset layer tracking
      const fillCol = (e.params.fillColor as string) || "#323B47";
      const strokeCol = (e.params.strokeColor as string) || "#FFFFFF";
      const strokeW = (typeof e.params.strokeWidth === "number" ? e.params.strokeWidth : 2) * inv;
      const noStroke = !!e.params.noStroke;

      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      traceEntity(ctx, e, lod);

      if (fillCol && fillCol !== "none" && fillCol !== "transparent") {
        ctx.fillStyle = fillCol;
        ctx.fill();
      }

      if (!noStroke && strokeCol && strokeCol !== "none" && strokeCol !== "transparent") {
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = strokeW;
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }

    const style = techStyle(e.layer);
    if (e.layer !== currentLayer) {
      currentLayer = e.layer;
      const isCutOrWhite = style.color === "#FFFFFF" || e.layer === "corte";
      ctx.strokeStyle = opts.isLight && isCutOrWhite ? "#0F172A" : style.color;
      ctx.lineWidth = 1.4 * style.weight * inv;
      const dash = !lod && style.dash(inv);
      ctx.setLineDash(dash ? dash.split(" ").map(Number) : []);
    }
    ctx.beginPath();
    traceEntity(ctx, e, lod);
    ctx.stroke();
  }

  // halo de seleção — destaque temporário, nunca substitui a cor técnica
  if (selection.size) {
    if (opts.isDraggingUnlocked) {
      // Destaque visual ao destravar movimento: contorno laranja brilhante com dash técnico
      ctx.setLineDash([8 * inv, 4 * inv]);
      ctx.strokeStyle = "#FF8800";
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 6 * inv;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = opts.isLight ? "#DC2626" : SELECTION_COLOR;
      ctx.globalAlpha = opts.isLight ? 0.75 : 0.65;
      ctx.lineWidth = 4.5 * inv;
    }
    for (const e of list) {
      if (!selection.has(e.id) || e.type === "text") continue;
      ctx.beginPath();
      traceEntity(ctx, e, lod);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // textos por último (custo alto por item, quantidade sempre baixa)
  ctx.setLineDash([]);
  for (const e of list) {
    if (e.type !== "text") continue;
    ctx.fillStyle = techStyle(e.layer).color;
    ctx.font = `${e.italic ? "italic " : ""}${e.bold ? "700 " : "400 "}${e.size}px var(--font-display-family), ui-sans-serif, system-ui`;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.rotation) ctx.rotate((e.rotation * Math.PI) / 180);
    const natural = Math.max(ctx.measureText(e.text).width, 0.01);
    if (e.width && e.width > 0) ctx.scale(e.width / natural, 1);
    ctx.fillText(e.text, 0, 0);
    ctx.restore();
  }
}

/** Prévia de criação (draft) desenhada acima da cena, sem sujar o modelo. */
export function drawDraft(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  view: SceneView,
  color: string,
) {
  const inv = 1 / view.k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 * inv;
  ctx.setLineDash([5 * inv, 4 * inv]);
  ctx.beginPath();
  if (e.type === "path") {
    const pts = samplePath(e.start, e.segs, e.closed, 12);
    tracePolyline(ctx, pts, !!e.closed, 1);
  } else traceEntity(ctx, e, false);
  ctx.stroke();
  ctx.setLineDash([]);
}
