/**
 * Importação de SVG como geometria editável (nunca como imagem).
 * Converte line, rect, circle, ellipse, polyline, polygon e paths simples
 * em entidades internas em milímetros.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { uid, type Entity, type LayerId } from "./core";

const num = (v: string | null, d = 0) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : d;
};

/** Fator de conversão unidade-de-usuário → mm a partir de width/viewBox. */
function scaleOf(svg: SVGSVGElement): number {
  const w = svg.getAttribute("width") ?? "";
  const vb = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const vbw = vb.length === 4 ? vb[2]! : 0;
  if (!vbw) return 1;
  const m = w.match(/^([\d.]+)\s*(mm|cm|in|px)?$/);
  if (!m) return 1;
  const val = Number(m[1]);
  const unit = m[2] ?? "px";
  const mm =
    unit === "mm" ? val : unit === "cm" ? val * 10 : unit === "in" ? val * 25.4 : val * 0.264583;
  return mm / vbw;
}

function samplePath(d: string): Vec2[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const subs: Vec2[][] = [];
  let cur: Vec2[] = [];
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  const nextNum = () => Number(tokens[i++] ?? 0);
  const cubic = (p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2) => {
    for (let t = 1; t <= 12; t++) {
      const u = t / 12;
      const m = 1 - u;
      cur.push({
        x: m ** 3 * p0.x + 3 * m * m * u * c1.x + 3 * m * u * u * c2.x + u ** 3 * p1.x,
        y: m ** 3 * p0.y + 3 * m * m * u * c1.y + 3 * m * u * u * c2.y + u ** 3 * p1.y,
      });
    }
  };
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        if (cur.length > 1) subs.push(cur);
        const nx = nextNum();
        const ny = nextNum();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        sx = x;
        sy = y;
        cur = [{ x, y }];
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        const nx = nextNum();
        const ny = nextNum();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        cur.push({ x, y });
        break;
      }
      case "H": {
        const nx = nextNum();
        x = rel ? x + nx : nx;
        cur.push({ x, y });
        break;
      }
      case "V": {
        const ny = nextNum();
        y = rel ? y + ny : ny;
        cur.push({ x, y });
        break;
      }
      case "C": {
        const p0 = { x, y };
        const c1 = { x: (rel ? x : 0) + nextNum(), y: (rel ? y : 0) + nextNum() };
        const c2 = { x: (rel ? x : 0) + nextNum(), y: (rel ? y : 0) + nextNum() };
        const p1 = { x: (rel ? x : 0) + nextNum(), y: (rel ? y : 0) + nextNum() };
        cubic(p0, c1, c2, p1);
        x = p1.x;
        y = p1.y;
        break;
      }
      case "Z": {
        if (cur.length > 1) {
          cur.push({ x: sx, y: sy });
          subs.push(cur);
        }
        cur = [];
        x = sx;
        y = sy;
        i++;
        break;
      }
      default:
        i++;
    }
    if (i > 20000) break;
  }
  if (cur.length > 1) subs.push(cur);
  return subs;
}

export function importSvg(text: string, layer: LayerId): Entity[] {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.querySelector("svg");
  if (!root) throw new Error("SVG inválido.");
  const s = scaleOf(root as SVGSVGElement);
  const P = (x: number, y: number): Vec2 => ({ x: x * s, y: y * s });
  const out: Entity[] = [];

  root.querySelectorAll("line").forEach((el) => {
    const a = P(num(el.getAttribute("x1")), num(el.getAttribute("y1")));
    const b = P(num(el.getAttribute("x2")), num(el.getAttribute("y2")));
    out.push({ id: uid(), layer, type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  });

  root.querySelectorAll("rect").forEach((el) => {
    const x = num(el.getAttribute("x"));
    const y = num(el.getAttribute("y"));
    const w = num(el.getAttribute("width"));
    const h = num(el.getAttribute("height"));
    out.push({
      id: uid(),
      layer,
      type: "polyline",
      closed: true,
      pts: [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)],
    });
  });

  root.querySelectorAll("circle").forEach((el) => {
    const c = P(num(el.getAttribute("cx")), num(el.getAttribute("cy")));
    out.push({
      id: uid(),
      layer,
      type: "circle",
      cx: c.x,
      cy: c.y,
      r: num(el.getAttribute("r")) * s,
    });
  });

  root.querySelectorAll("ellipse").forEach((el) => {
    const c = P(num(el.getAttribute("cx")), num(el.getAttribute("cy")));
    const rx = num(el.getAttribute("rx")) * s;
    const ry = num(el.getAttribute("ry")) * s;
    const pts = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return { x: c.x + rx * Math.cos(a), y: c.y + ry * Math.sin(a) };
    });
    out.push({ id: uid(), layer, type: "polyline", closed: true, pts });
  });

  const poly = (sel: string, closed: boolean) =>
    root.querySelectorAll(sel).forEach((el) => {
      const nums = (el.getAttribute("points") ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const pts: Vec2[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push(P(nums[i]!, nums[i + 1]!));
      if (pts.length > 1) out.push({ id: uid(), layer, type: "polyline", closed, pts });
    });
  poly("polyline", false);
  poly("polygon", true);

  root.querySelectorAll("path").forEach((el) => {
    for (const sub of samplePath(el.getAttribute("d") ?? "")) {
      const pts = sub.map((p) => P(p.x, p.y));
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      const closed = Math.hypot(first.x - last.x, first.y - last.y) < 1e-6;
      out.push({
        id: uid(),
        layer,
        type: "polyline",
        closed,
        pts: closed ? pts.slice(0, -1) : pts,
      });
    }
  });

  return out;
}
