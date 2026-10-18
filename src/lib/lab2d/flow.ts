/**
 * FLUXO CALDRA — linguagem visual própria de direção de corte.
 *
 * Chevrons finos em "V" desenhados EM PIXELS DE TELA sobre a trajetória,
 * com espaçamento constante em pixels (LOD natural: menos marcadores com
 * zoom baixo, mais detalhe com zoom alto, nunca saturado).
 *
 * ISTO É UI. Nada daqui vai para o DXF. A direção real vive no modelo.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { samplePath } from "./bezier";
import type { Entity } from "./core";
import { CUT_COLOR, WARNING_COLOR } from "./technical";
import { endPointOf, isCutPath } from "./cutPlan";
import { leadPolyline } from "./manufacturing";

export type FlowView = { tx: number; ty: number; k: number };

export type FlowOptions = {
  view: FlowView;
  width: number;
  height: number;
  dpr: number;
  /** Chevrons de direção. */
  arrows: boolean;
  /** Anel de origem com o número da sequência. */
  order: boolean;
  /** Deslocamento animado, em px (0 = estático). */
  phase: number;
  /** Desenhar lead-in/lead-out como pré-visualização de fabricação. */
  leads?: boolean;
};

/** Espaçamento alvo entre chevrons, em pixels de tela. */
const SPACING = 74;
const MIN_PER_PATH = 1;
const MAX_PER_PATH = 40;
const CHEV = 5.5;

/** Percurso amostrado em coordenadas de tela, no sentido real de corte. */
function screenPath(e: Entity, v: FlowView): Vec2[] {
  const to = (p: Vec2): Vec2 => ({ x: v.tx + p.x * v.k, y: v.ty + p.y * v.k });
  switch (e.type) {
    case "line":
      return [to({ x: e.x1, y: e.y1 }), to({ x: e.x2, y: e.y2 })];
    case "polyline":
      return (e.closed ? [...e.pts, e.pts[0]!] : e.pts).filter(Boolean).map(to);
    case "path":
      return samplePath(e.start, e.segs, e.closed, 10).map(to);
    case "circle": {
      const n = 64;
      return Array.from({ length: n + 1 }, (_, i) =>
        to({
          x: e.cx + e.r * Math.cos((i / n) * Math.PI * 2),
          y: e.cy + e.r * Math.sin((i / n) * Math.PI * 2),
        }),
      );
    }
    case "arc": {
      let sweep = e.a1 - e.a0;
      while (sweep < -Math.PI * 2) sweep += Math.PI * 2;
      while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
      const n = 48;
      return Array.from({ length: n + 1 }, (_, i) =>
        to({
          x: e.cx + e.r * Math.cos(e.a0 + sweep * (i / n)),
          y: e.cy + e.r * Math.sin(e.a0 + sweep * (i / n)),
        }),
      );
    }
    default:
      return [];
  }
}

function chevron(ctx: CanvasRenderingContext2D, p: Vec2, ang: number, size: number) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const back = -size;
  const wing = size * 0.72;
  ctx.beginPath();
  ctx.moveTo(p.x + back * c - wing * -s, p.y + back * s - wing * c);
  ctx.lineTo(p.x, p.y);
  ctx.lineTo(p.x + back * c + wing * -s, p.y + back * s + wing * c);
  ctx.stroke();
}

/** Desenha o FLUXO sobre a cena. `ctx` em coordenadas de tela (CSS px). */
export function drawFlow(ctx: CanvasRenderingContext2D, entities: Entity[], o: FlowOptions) {
  const paths = entities.filter(isCutPath);
  if (!paths.length) return;

  ctx.save();
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let seq = 0;
  for (const e of paths) {
    seq++;
    const pts = screenPath(e, o.view);
    if (pts.length < 2) continue;
    const color = e.invalid ? WARNING_COLOR : CUT_COLOR;

    // comprimento acumulado em px
    const acc: number[] = [0];
    for (let i = 1; i < pts.length; i++)
      acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
    const total = acc[acc.length - 1]!;
    if (total < 8) continue;

    // fora da tela? nem calcula
    if (
      Math.max(...pts.map((p) => p.x)) < -40 ||
      Math.min(...pts.map((p) => p.x)) > o.width + 40 ||
      Math.max(...pts.map((p) => p.y)) < -40 ||
      Math.min(...pts.map((p) => p.y)) > o.height + 40
    )
      continue;

    if (o.arrows) {
      const count = Math.max(MIN_PER_PATH, Math.min(MAX_PER_PATH, Math.round(total / SPACING)));
      const step = total / count;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.95;
      let j = 1;
      for (let n = 0; n < count; n++) {
        const d = ((n + 0.5) * step + o.phase) % total;
        while (j < acc.length - 1 && acc[j]! < d) j++;
        const a = pts[j - 1]!;
        const b = pts[j]!;
        const seg = acc[j]! - acc[j - 1]! || 1;
        const t = (d - acc[j - 1]!) / seg;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (p.x < -20 || p.y < -20 || p.x > o.width + 20 || p.y > o.height + 20) continue;
        chevron(ctx, p, Math.atan2(b.y - a.y, b.x - a.x), CHEV);
        j = 1;
      }
      ctx.globalAlpha = 1;

      // marcador de FIM em caminhos abertos: chevron ligeiramente maior
      const closed =
        e.type === "circle" || ((e.type === "polyline" || e.type === "path") && e.closed);
      if (!closed) {
        const last = pts[pts.length - 1]!;
        const prev = pts[pts.length - 2]!;
        ctx.lineWidth = 1.8;
        chevron(ctx, last, Math.atan2(last.y - prev.y, last.x - prev.x), CHEV * 1.7);
      }
    }

    if (o.leads) {
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = color;
      for (const which of ["in", "out"] as const) {
        const poly = leadPolyline(e, which);
        if (!poly) continue;
        ctx.beginPath();
        poly.forEach((p, i) => {
          const s = { x: o.view.tx + p.x * o.view.k, y: o.view.ty + p.y * o.view.k };
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // MARCADOR DE ORIGEM: um único anel comunicando partida + sequência
    if (o.order) {
      const s = pts[0]!;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(seq).padStart(2, "0"), s.x, s.y + 0.5);
    }
  }
  ctx.restore();
}

/** Ponto final do plano — usado pela simulação. */
export const planEnd = (entities: Entity[]) => {
  const paths = entities.filter(isCutPath);
  const last = paths[paths.length - 1];
  return last ? endPointOf(last) : null;
};

/* ---------------------------------------------------- simulação (overlay) */

import type { SimSample } from "./simulation";

const SIM_COLOR: Record<string, string> = {
  "lead-in": "#22C55E",
  cut: CUT_COLOR,
  "lead-out": "#3B82F6",
  rapid: "#6B7480",
};

/** Desenha o rastro percorrido e o cabeçote da simulação. */
export function drawSim(
  ctx: CanvasRenderingContext2D,
  s: SimSample,
  o: { view: FlowView; dpr: number },
) {
  const to = (p: Vec2) => ({ x: o.view.tx + p.x * o.view.k, y: o.view.ty + p.y * o.view.k });
  ctx.save();
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const trail = (pts: Vec2[], kind: string) => {
    if (pts.length < 2) return;
    ctx.strokeStyle = SIM_COLOR[kind] ?? CUT_COLOR;
    ctx.lineWidth = kind === "rapid" ? 1 : 3;
    ctx.setLineDash(kind === "rapid" ? [3, 4] : []);
    ctx.globalAlpha = kind === "rapid" ? 0.5 : 0.85;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = to(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
  };

  for (const step of s.done) trail(step.pts, step.kind);
  trail(s.partial, s.kind);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const h = to(s.p);
  ctx.beginPath();
  ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = SIM_COLOR[s.kind] ?? CUT_COLOR;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(h.x, h.y, 11, 0, Math.PI * 2);
  ctx.strokeStyle = SIM_COLOR[s.kind] ?? CUT_COLOR;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}
