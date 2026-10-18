export type { Vec2 } from "@/lib/geometry/types";
import type { CncMeta } from "@/lib/lab2d/cncTypes";
import type { DxfDocument, DxfEntity } from "@/lib/dxf/dxfService";

import {
  flattenPath,
  mapPath,
  pathAnchors,
  pathSegments,
  samplePath,
  type BezierSeg,
} from "@/lib/lab2d/bezier";
import {
  ANOTACOES_COLOR,
  AUXILIAR_COLOR,
  BEND_COLOR,
  CONSTRUCTION_COLOR,
  CUT_COLOR,
  DIMENSION_COLOR,
  MARK_COLOR,
  RECORTE_COLOR,
  REFERENCE_COLOR,
  techColor,
  type TechLayerId,
} from "@/lib/lab2d/technical";
import { roleOf, ROLE_BY_LAYER } from "@/lib/lab2d/roles";

export type LayerId = string;

export type Layer = {
  id: LayerId;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
};

/** Camadas técnicas com cores fixas do CALDRA (nunca derivadas do tema). */
export const DEFAULT_LAYERS: Layer[] = [
  { id: "construcao", name: "Construção", color: CONSTRUCTION_COLOR, visible: true, locked: false },
  { id: "referencia", name: "Referência", color: REFERENCE_COLOR, visible: true, locked: false },
  { id: "dobra", name: "Dobra", color: BEND_COLOR, visible: true, locked: false },
  { id: "marcacao", name: "Marcação", color: MARK_COLOR, visible: true, locked: false },
  { id: "recorte", name: "Recorte", color: RECORTE_COLOR, visible: true, locked: false },
  { id: "corte", name: "Corte", color: CUT_COLOR, visible: true, locked: false },
  { id: "cota", name: "Cota", color: DIMENSION_COLOR, visible: true, locked: false },
  { id: "anotacoes", name: "Anotações", color: ANOTACOES_COLOR, visible: true, locked: false },
  { id: "auxiliar", name: "Auxiliar", color: AUXILIAR_COLOR, visible: true, locked: false },
];

type Base = {
  id: string;
  layer: LayerId;
  /** Id do grupo (Fase 2A) — a entidade se comporta como parte de uma unidade. */
  group?: string;
  /** Trecho de CORTE COMUM: cortado uma única vez para duas peças. */
  shared?: boolean;
  /** Trecho comum invalidado por edição/movimento posterior. */
  invalid?: boolean;
  /** Dados semânticos de fabricação (sequência, contorno, lead-in/out). */
  cnc?: CncMeta;
  /** Estado de construção (geometria auxiliar/projeção) */
  isConstruction?: boolean;
  /** Parâmetros paramétricos associados */
  params?: Record<string, unknown>;
  /** IDs de entidades dependentes */
  dependencies?: string[];
  /** Feature correspondente no grafo CAD */
  featureId?: string;
};

export type Entity =
  | (Base & { type: "line"; x1: number; y1: number; x2: number; y2: number })
  | (Base & { type: "polyline"; pts: Vec2[]; closed: boolean })
  | (Base & { type: "circle"; cx: number; cy: number; r: number })
  | (Base & { type: "arc"; cx: number; cy: number; r: number; a0: number; a1: number })
  | (Base & {
      type: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotation?: number;
    })
  | (Base & {
      type: "point";
      x: number;
      y: number;
      label?: string;
    })
  | (Base & {
      type: "hatch";
      pattern: "ansi31" | "cross" | "solid" | "dots";
      angle: number;
      scale: number;
      boundaryPts: Vec2[];
    })
  | (Base & {
      /** Curva de Bézier cúbica — fidelidade máxima com poucos pontos. */
      type: "path";
      start: Vec2;
      segs: BezierSeg[];
      closed: boolean;
      /** Contorno interno (furo de letra) — corte com offset interno. */
      hole?: boolean;
      /** Id do contorno externo que contém este furo. */
      parent?: string;
    })
  | (Base & {
      type: "text";
      x: number;
      y: number;
      text: string;
      /** Dimensões reais do texto no desenho, em milímetros. */
      size: number;
      width?: number;
      bold?: boolean;
      italic?: boolean;
      rotation?: number;
    });

export type PathEntity = Extract<Entity, { type: "path" }>;

export const uid = () => Math.random().toString(36).slice(2, 9);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------------------ pontos */

export function entityPoints(e: Entity): Vec2[] {
  switch (e.type) {
    case "line":
      return [
        { x: e.x1, y: e.y1 },
        { x: e.x2, y: e.y2 },
      ];
    case "polyline":
      return e.pts;
    case "circle":
      return [
        { x: e.cx, y: e.cy },
        { x: e.cx + e.r, y: e.cy },
        { x: e.cx - e.r, y: e.cy },
        { x: e.cx, y: e.cy + e.r },
        { x: e.cx, y: e.cy - e.r },
      ];
    case "arc":
      return [
        { x: e.cx, y: e.cy },
        { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) },
        { x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) },
      ];
    case "ellipse":
      return [
        { x: e.cx, y: e.cy },
        { x: e.cx + e.rx, y: e.cy },
        { x: e.cx - e.rx, y: e.cy },
        { x: e.cx, y: e.cy + e.ry },
        { x: e.cx, y: e.cy - e.ry },
      ];
    case "point":
      return [{ x: e.x, y: e.y }];
    case "hatch":
      return e.boundaryPts;
    case "path":
      return pathAnchors(e.start, e.segs);
    case "text":
      return [
        { x: e.x, y: e.y - e.size },
        { x: e.x + (e.width ?? Math.max(e.size, e.text.length * e.size * 0.6)), y: e.y },
      ];
  }
}

/** Pontos usados para enquadramento e hit-test (curvas entram amostradas). */
export function outlinePoints(e: Entity): Vec2[] {
  if (e.type === "path") return samplePath(e.start, e.segs, e.closed, 10);
  if (e.type === "ellipse") {
    const rot = e.rotation ?? 0;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    return Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      const px = e.rx * Math.cos(a);
      const py = e.ry * Math.sin(a);
      return {
        x: e.cx + px * cosR - py * sinR,
        y: e.cy + px * sinR + py * cosR,
      };
    });
  }
  return entityPoints(e);
}

export type Snap = {
  p: Vec2;
  kind: "grid" | "end" | "mid" | "center" | "cross" | "near" | "quadrant" | "perp" | "tangent" | "origin";
};

export function segmentsOf(e: Entity): [Vec2, Vec2][] {
  if (e.type === "line")
    return [
      [
        { x: e.x1, y: e.y1 },
        { x: e.x2, y: e.y2 },
      ],
    ];
  if (e.type === "polyline") {
    const out: [Vec2, Vec2][] = [];
    for (let i = 0; i < e.pts.length - 1; i++) out.push([e.pts[i]!, e.pts[i + 1]!]);
    if (e.closed && e.pts.length > 2) out.push([e.pts[e.pts.length - 1]!, e.pts[0]!]);
    return out;
  }
  if (e.type === "ellipse") {
    const pts = outlinePoints(e);
    const out: [Vec2, Vec2][] = [];
    for (let i = 0; i < pts.length; i++) {
      out.push([pts[i]!, pts[(i + 1) % pts.length]!]);
    }
    return out;
  }
  if (e.type === "hatch") {
    const out: [Vec2, Vec2][] = [];
    for (let i = 0; i < e.boundaryPts.length; i++) {
      out.push([e.boundaryPts[i]!, e.boundaryPts[(i + 1) % e.boundaryPts.length]!]);
    }
    return out;
  }
  if (e.type === "path") return pathSegments(e.start, e.segs, e.closed);
  return [];
}

export function lineIntersection(a: [Vec2, Vec2], b: [Vec2, Vec2], bounded = true): Vec2 | null {
  const [p1, p2] = a;
  const [p3, p4] = b;
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (bounded && (t < 0 || t > 1 || u < 0 || u > 1)) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

export function closestOnSegment(p: Vec2, s: [Vec2, Vec2]): Vec2 {
  const [a, b] = s;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Encontra o melhor ponto de captura próximo ao cursor. */
export function findSnap(
  cursor: Vec2,
  entities: Entity[],
  tol: number,
  grid: number,
  enabled: { grid: boolean; object: boolean },
  activeStartPoint: Vec2 | null = null,
): Snap | null {
  const cands: Snap[] = [];
  if (enabled.object) {
    // 0. Origem (0, 0)
    cands.push({ p: { x: 0, y: 0 }, kind: "origin" });

    const segs = entities.flatMap(segmentsOf);
    for (const e of entities) {
      if (e.type === "circle" || e.type === "arc") {
        cands.push({ p: { x: e.cx, y: e.cy }, kind: "center" });
        if (e.type === "circle") {
          // Quadrantes
          cands.push(
            { p: { x: e.cx + e.r, y: e.cy }, kind: "quadrant" },
            { p: { x: e.cx - e.r, y: e.cy }, kind: "quadrant" },
            { p: { x: e.cx, y: e.cy + e.r }, kind: "quadrant" },
            { p: { x: e.cx, y: e.cy - e.r }, kind: "quadrant" },
          );
        }
      }
      if (e.type === "ellipse") {
        cands.push(
          { p: { x: e.cx, y: e.cy }, kind: "center" },
          { p: { x: e.cx + e.rx, y: e.cy }, kind: "quadrant" },
          { p: { x: e.cx - e.rx, y: e.cy }, kind: "quadrant" },
          { p: { x: e.cx, y: e.cy + e.ry }, kind: "quadrant" },
          { p: { x: e.cx, y: e.cy - e.ry }, kind: "quadrant" },
        );
      }
      for (const p of entityPoints(e)) {
        if (e.type !== "circle" && e.type !== "ellipse") cands.push({ p, kind: "end" });
      }

      // Perpendicular ao segmento a partir de activeStartPoint
      if (activeStartPoint && e.type === "line") {
        const dx = e.x2 - e.x1;
        const dy = e.y2 - e.y1;
        const l2 = dx * dx + dy * dy;
        if (l2 > 1e-4) {
          const t = ((activeStartPoint.x - e.x1) * dx + (activeStartPoint.y - e.y1) * dy) / l2;
          if (t >= 0 && t <= 1) {
            cands.push({ p: { x: e.x1 + t * dx, y: e.y1 + t * dy }, kind: "perp" });
          }
        }
      }
    }
    for (const s of segs)
      cands.push({ p: { x: (s[0].x + s[1].x) / 2, y: (s[0].y + s[1].y) / 2 }, kind: "mid" });
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++) {
        const x = lineIntersection(segs[i]!, segs[j]!);
        if (x) cands.push({ p: x, kind: "cross" });
      }
    for (const s of segs) cands.push({ p: closestOnSegment(cursor, s), kind: "near" });
  }
  if (enabled.grid)
    cands.push({
      p: { x: Math.round(cursor.x / grid) * grid, y: Math.round(cursor.y / grid) * grid },
      kind: "grid",
    });

  const rank: Record<Snap["kind"], number> = {
    end: 0,
    cross: 1,
    center: 2,
    quadrant: 3,
    mid: 4,
    perp: 5,
    tangent: 6,
    origin: 7,
    near: 9,
    grid: 8,
  };
  const hit = cands
    .filter((c) => dist(c.p, cursor) <= tol)
    .sort((a, b) => rank[a.kind] - rank[b.kind] || dist(a.p, cursor) - dist(b.p, cursor));
  return hit[0] ?? null;
}

/* ------------------------------------------------------- transformações */

export function mapEntity(e: Entity, f: (p: Vec2) => Vec2, scale = 1): Entity {
  switch (e.type) {
    case "line": {
      const a = f({ x: e.x1, y: e.y1 });
      const b = f({ x: e.x2, y: e.y2 });
      return { ...e, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    case "polyline":
      return { ...e, pts: e.pts.map(f) };
    case "circle": {
      const c = f({ x: e.cx, y: e.cy });
      return { ...e, cx: c.x, cy: c.y, r: e.r * Math.abs(scale) };
    }
    case "arc": {
      const c = f({ x: e.cx, y: e.cy });
      return { ...e, cx: c.x, cy: c.y, r: e.r * Math.abs(scale) };
    }
    case "ellipse": {
      const c = f({ x: e.cx, y: e.cy });
      return { ...e, cx: c.x, cy: c.y, rx: e.rx * Math.abs(scale), ry: e.ry * Math.abs(scale) };
    }
    case "point": {
      const c = f({ x: e.x, y: e.y });
      return { ...e, x: c.x, y: c.y };
    }
    case "hatch": {
      return { ...e, boundaryPts: e.boundaryPts.map(f) };
    }
    case "path": {
      const m = mapPath(e.start, e.segs, f);
      return { ...e, start: m.start, segs: m.segs };
    }
    case "text": {
      const c = f({ x: e.x, y: e.y });
      return { ...e, x: c.x, y: c.y };
    }
  }
}

export const translate = (e: Entity, dx: number, dy: number) =>
  mapEntity(e, (p) => ({ x: p.x + dx, y: p.y + dy }));

export const rotate = (e: Entity, o: Vec2, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const rot = (p: Vec2) => ({
    x: o.x + (p.x - o.x) * c - (p.y - o.y) * s,
    y: o.y + (p.x - o.x) * s + (p.y - o.y) * c,
  });
  if (e.type === "arc") {
    const cp = rot({ x: e.cx, y: e.cy });
    return { ...e, cx: cp.x, cy: cp.y, a0: e.a0 + a, a1: e.a1 + a };
  }
  if (e.type === "ellipse") {
    const cp = rot({ x: e.cx, y: e.cy });
    return { ...e, cx: cp.x, cy: cp.y, rotation: (e.rotation ?? 0) + a };
  }
  if (e.type === "text") {
    const cp = rot({ x: e.x, y: e.y });
    return { ...e, x: cp.x, y: cp.y, rotation: (e.rotation ?? 0) + deg };
  }
  return mapEntity(e, rot);
};

export const scaleEntity = (e: Entity, o: Vec2, k: number) =>
  mapEntity(e, (p) => ({ x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k }), k);

export const mirror = (e: Entity, o: Vec2, axis: "x" | "y") => {
  const ref = (p: Vec2) => (axis === "x" ? { x: 2 * o.x - p.x, y: p.y } : { x: p.x, y: 2 * o.y - p.y });
  if (e.type === "arc") {
    const cp = ref({ x: e.cx, y: e.cy });
    const p0 = ref({ x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) });
    const p1 = ref({ x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) });
    return {
      ...e,
      cx: cp.x,
      cy: cp.y,
      a0: Math.atan2(p1.y - cp.y, p1.x - cp.x),
      a1: Math.atan2(p0.y - cp.y, p0.x - cp.x),
    };
  }
  if (e.type === "ellipse") {
    const cp = ref({ x: e.cx, y: e.cy });
    const rot = e.rotation ?? 0;
    return { ...e, cx: cp.x, cy: cp.y, rotation: axis === "x" ? Math.PI - rot : -rot };
  }
  return mapEntity(e, ref);
};

/* ------------------------------------------------------------ bounding box */

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

export function bbox(entities: Entity[]): Box | null {
  if (!entities.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let count = 0;
  for (const e of entities) {
    const pts = outlinePoints(e);
    if (!pts || !Array.isArray(pts)) continue;
    for (const p of pts) {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        count++;
      }
    }
  }
  if (count === 0 || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

export function boxOf(e: Entity): Box {
  return bbox([e]) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

export function inside(b: Box, o: Box) {
  return b.minX >= o.minX && b.maxX <= o.maxX && b.minY >= o.minY && b.maxY <= o.maxY;
}
export function overlaps(b: Box, o: Box) {
  return !(b.minX > o.maxX || b.maxX < o.minX || b.minY > o.maxY || b.maxY < o.minY);
}

/** Verifica se um ponto 2D está estritamente dentro de um polígono fechado (ray-casting). */
export function pointInPoly(p: Vec2, poly: Vec2[]): boolean {
  if (poly.length < 3) return false;
  let isInside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/* ------------------------------------------------------------- construção */

export const rectPolyline = (a: Vec2, b: Vec2, layer: LayerId, radius = 0): Entity => {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  if (radius <= 0)
    return {
      id: uid(),
      layer,
      type: "polyline",
      closed: true,
      pts: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
    };
  const r = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
  const arc = (cx: number, cy: number, s: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = s + (i / 6) * (Math.PI / 2);
      return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) };
    });
  return {
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [
      ...arc(x0 + r, y0 + r, Math.PI),
      ...arc(x1 - r, y0 + r, -Math.PI / 2),
      ...arc(x1 - r, y1 - r, 0),
      ...arc(x0 + r, y1 - r, Math.PI / 2),
    ],
  };
};

export const polygonEntity = (c: Vec2, r: number, sides: number, layer: LayerId): Entity => ({
  id: uid(),
  layer,
  type: "polyline",
  closed: true,
  pts: Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  }),
});

/* ------------------------------------------------------------------ offset */

export function offsetEntity(e: Entity, d: number): Entity | null {
  if (e.type === "circle") return e.r + d > 0 ? { ...e, id: uid(), r: e.r + d } : null;
  if (e.type === "ellipse") return e.rx + d > 0 && e.ry + d > 0 ? { ...e, id: uid(), rx: e.rx + d, ry: e.ry + d } : null;
  if (e.type === "point" || e.type === "hatch") return null;
  const shift = (pts: Vec2[], closed: boolean): Vec2[] => {
    const out: Vec2[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n]!;
      const cur = pts[i]!;
      const next = pts[(i + 1) % n]!;
      const nrm = (a: Vec2, b: Vec2) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        return { x: dy / l, y: -dx / l };
      };
      const n1 = i === 0 && !closed ? nrm(cur, next) : nrm(prev, cur);
      const n2 = i === n - 1 && !closed ? nrm(prev, cur) : nrm(cur, next);
      const nx = (n1.x + n2.x) / 2;
      const ny = (n1.y + n2.y) / 2;
      const l = Math.hypot(nx, ny) || 1;
      out.push({ x: cur.x + (nx / l) * d, y: cur.y + (ny / l) * d });
    }
    return out;
  };
  if (e.type === "polyline") return { ...e, id: uid(), pts: shift(e.pts, e.closed) };
  if (e.type === "path") {
    // paralela de curva: o contorno amostrado é deslocado pela normal;
    // furos recebem o sentido oposto (offset interno no corte).
    const dir = e.hole ? -d : d;
    const pts = samplePath(e.start, e.segs, false, 12);
    const moved = shift(pts, e.closed);
    return {
      id: uid(),
      layer: e.layer,
      type: "polyline",
      closed: e.closed,
      pts: moved.map((p, i) => ({
        x: pts[i]!.x + (p.x - pts[i]!.x) * (dir / (d || 1)),
        y: pts[i]!.y + (p.y - pts[i]!.y) * (dir / (d || 1)),
      })),
    };
  }
  if (e.type === "line") {
    const [a, b] = [
      { x: e.x1, y: e.y1 },
      { x: e.x2, y: e.y2 },
    ];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const ox = (dy / l) * d;
    const oy = (-dx / l) * d;
    return { ...e, id: uid(), x1: a.x + ox, y1: a.y + oy, x2: b.x + ox, y2: b.y + oy };
  }
  return null;
}

/* -------------------------------------------------------- trim / extend / fillet */

/** Apara a linha `target` no cruzamento com `cutter`, removendo o lado clicado. */
export function trimLine(target: Entity, cutter: Entity, click: Vec2): Entity | null {
  if (target.type !== "line") return null;
  const ts = segmentsOf(target)[0]!;
  for (const cs of segmentsOf(cutter)) {
    const x = lineIntersection(ts, cs, true);
    if (!x) continue;
    const keepStart = dist(click, ts[0]) > dist(click, ts[1]);
    return keepStart ? { ...target, x2: x.x, y2: x.y } : { ...target, x1: x.x, y1: x.y };
  }
  return null;
}

/** Prolonga a linha até encontrar a outra geometria. */
export function extendLine(target: Entity, other: Entity): Entity | null {
  if (target.type !== "line") return null;
  const ts = segmentsOf(target)[0]!;
  for (const cs of segmentsOf(other)) {
    const x = lineIntersection(ts, cs, false);
    if (!x) continue;
    return dist(x, ts[1]) < dist(x, ts[0])
      ? { ...target, x2: x.x, y2: x.y }
      : { ...target, x1: x.x, y1: x.y };
  }
  return null;
}

/** Concordância entre duas linhas: encurta ambas e devolve o arco de raio R tangente com sweep correto. */
export function filletLines(
  a: Entity,
  b: Entity,
  r: number,
): { a: Entity; b: Entity; arc: Entity } | null {
  if (a.type !== "line" || b.type !== "line") return null;
  const sa: [Vec2, Vec2] = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }];
  const sb: [Vec2, Vec2] = [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];

  let x = lineIntersection(sa, sb, false);
  if (!x) return null;

  // Se houver um ponto de canto compartilhado (ex: quina conexa), usa com prioridade
  const sharedCorners: Vec2[] = [];
  if (dist(sa[0], sb[0]) < 1.0) sharedCorners.push(sa[0]);
  if (dist(sa[0], sb[1]) < 1.0) sharedCorners.push(sa[0]);
  if (dist(sa[1], sb[0]) < 1.0) sharedCorners.push(sa[1]);
  if (dist(sa[1], sb[1]) < 1.0) sharedCorners.push(sa[1]);
  if (sharedCorners.length > 0) {
    x = sharedCorners[0]!;
  }

  const farA = dist(x, sa[0]) > dist(x, sa[1]) ? sa[0] : sa[1];
  const farB = dist(x, sb[0]) > dist(x, sb[1]) ? sb[0] : sb[1];

  const lenA = dist(x, farA);
  const lenB = dist(x, farB);
  if (lenA < 0.05 || lenB < 0.05) return null;

  const da = { x: (farA.x - x.x) / lenA, y: (farA.y - x.y) / lenA };
  const db = { x: (farB.x - x.x) / lenB, y: (farB.y - x.y) / lenB };

  const dot = Math.max(-1, Math.min(1, da.x * db.x + da.y * db.y));
  const ang = Math.acos(dot);
  if (ang < 0.04 || ang > Math.PI - 0.04) return null; // Colineares ou paralelas

  const tanHalf = Math.tan(ang / 2);
  const sinHalf = Math.sin(ang / 2);
  if (tanHalf <= 1e-4 || sinHalf <= 1e-4) return null;

  // Limite de raio admissível pelos comprimentos das linhas
  const maxAllowableR = Math.min(lenA, lenB) * tanHalf * 0.98;
  const effR = Math.max(0.1, Math.min(r, maxAllowableR));

  const t = effR / tanHalf;
  const pa = { x: x.x + da.x * t, y: x.y + da.y * t };
  const pb = { x: x.x + db.x * t, y: x.y + db.y * t };

  const bis = { x: da.x + db.x, y: da.y + db.y };
  const bl = Math.hypot(bis.x, bis.y) || 1;
  const cd = effR / sinHalf;
  const c = { x: x.x + (bis.x / bl) * cd, y: x.y + (bis.y / bl) * cd };

  const setNear = (e: Entity, s: [Vec2, Vec2], p: Vec2): Entity => {
    if (e.type !== "line") return e;
    return dist(x, s[0]) < dist(x, s[1])
      ? { ...e, x1: p.x, y1: p.y }
      : { ...e, x2: p.x, y2: p.y };
  };

  const a0Raw = Math.atan2(pa.y - c.y, pa.x - c.x);
  const a1Raw = Math.atan2(pb.y - c.y, pb.x - c.x);

  // Garante que o arco desenhado no SVG (que usa sweep positivo) seja o arco MENOR (< 180°)
  let dTheta = a1Raw - a0Raw;
  while (dTheta <= -Math.PI) dTheta += 2 * Math.PI;
  while (dTheta > Math.PI) dTheta -= 2 * Math.PI;

  const a0 = dTheta > 0 ? a0Raw : a1Raw;
  const a1 = dTheta > 0 ? a1Raw : a0Raw;

  return {
    a: setNear(a, sa, pa),
    b: setNear(b, sb, pb),
    arc: {
      id: uid(),
      layer: a.layer,
      type: "arc",
      cx: c.x,
      cy: c.y,
      r: effR,
      a0,
      a1,
    },
  };
}

/** Chanfro: corta o canto entre duas linhas com um segmento reto conectando os pontos de corte. */
export function chamferLines(
  a: Entity,
  b: Entity,
  d1: number,
  d2?: number,
): { a: Entity; b: Entity; seg: Entity } | null {
  if (a.type !== "line" || b.type !== "line") return null;
  const sa: [Vec2, Vec2] = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }];
  const sb: [Vec2, Vec2] = [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];

  let x = lineIntersection(sa, sb, false);
  if (!x) return null;

  const sharedCorners: Vec2[] = [];
  if (dist(sa[0], sb[0]) < 1.0) sharedCorners.push(sa[0]);
  if (dist(sa[0], sb[1]) < 1.0) sharedCorners.push(sa[0]);
  if (dist(sa[1], sb[0]) < 1.0) sharedCorners.push(sa[1]);
  if (dist(sa[1], sb[1]) < 1.0) sharedCorners.push(sa[1]);
  if (sharedCorners.length > 0) {
    x = sharedCorners[0]!;
  }

  const farA = dist(x, sa[0]) > dist(x, sa[1]) ? sa[0] : sa[1];
  const farB = dist(x, sb[0]) > dist(x, sb[1]) ? sb[0] : sb[1];

  const lenA = dist(x, farA);
  const lenB = dist(x, farB);
  if (lenA < 0.05 || lenB < 0.05) return null;

  const da = { x: (farA.x - x.x) / lenA, y: (farA.y - x.y) / lenA };
  const db = { x: (farB.x - x.x) / lenB, y: (farB.y - x.y) / lenB };

  const dot = Math.max(-1, Math.min(1, da.x * db.x + da.y * db.y));
  const ang = Math.acos(dot);
  if (ang < 0.04 || ang > Math.PI - 0.04) return null;

  const effD1 = Math.min(Math.max(0.1, d1), lenA * 0.95);
  const effD2 = Math.min(Math.max(0.1, d2 ?? d1), lenB * 0.95);

  const pa = { x: x.x + da.x * effD1, y: x.y + da.y * effD1 };
  const pb = { x: x.x + db.x * effD2, y: x.y + db.y * effD2 };

  const setNear = (e: Entity, s: [Vec2, Vec2], p: Vec2): Entity => {
    if (e.type !== "line") return e;
    return dist(x, s[0]) < dist(x, s[1])
      ? { ...e, x1: p.x, y1: p.y }
      : { ...e, x2: p.x, y2: p.y };
  };

  return {
    a: setNear(a, sa, pa),
    b: setNear(b, sb, pb),
    seg: {
      id: uid(),
      layer: a.layer,
      type: "line",
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
    },
  };
}

/** Localiza dois segmentos lineares que formam um canto próximo ao ponto fornecido. */
export function findCornerNearPoint(
  p: Vec2,
  entities: Entity[],
  tol: number,
): { corner: Vec2; a: Entity; b: Entity } | null {
  const lines = entities.filter((e): e is Extract<Entity, { type: "line" }> => e.type === "line");

  // 1. Procura primeiro vértice compartilhado entre duas linhas dentro da tolerância
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]!;
    const ptsA = [{ x: la.x1, y: la.y1 }, { x: la.x2, y: la.y2 }];
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]!;
      const ptsB = [{ x: lb.x1, y: lb.y1 }, { x: lb.x2, y: lb.y2 }];

      for (const pa of ptsA) {
        for (const pb of ptsB) {
          if (dist(pa, pb) <= Math.max(1.5, tol * 0.5)) {
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            if (dist(p, mid) <= tol) {
              return { corner: mid, a: la, b: lb };
            }
          }
        }
      }
    }
  }

  // 2. Procura interseção geométrica de duas linhas próximas ao ponto
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]!;
    const sa: [Vec2, Vec2] = [{ x: la.x1, y: la.y1 }, { x: la.x2, y: la.y2 }];
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]!;
      const sb: [Vec2, Vec2] = [{ x: lb.x1, y: lb.y1 }, { x: lb.x2, y: lb.y2 }];
      const inter = lineIntersection(sa, sb, false);
      if (inter && dist(p, inter) <= tol) {
        // Verifica se o ponto de interseção está razoavelmente próximo aos segmentos reais
        const distToA = Math.min(dist(inter, sa[0]), dist(inter, sa[1]));
        const distToB = Math.min(dist(inter, sb[0]), dist(inter, sb[1]));
        if (distToA <= tol * 2.5 && distToB <= tol * 2.5) {
          return { corner: inter, a: la, b: lb };
        }
      }
    }
  }

  return null;
}

/* ------------------------------------------------------------- otimização */

export function optimize(entities: Entity[], tol = 0.05) {
  const seen = new Set<string>();
  const out: Entity[] = [];
  let removed = 0;
  let tiny = 0;
  for (const e of entities) {
    if (e.type === "line") {
      const l = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
      if (l < tol) {
        tiny++;
        continue;
      }
      const key = [e.x1, e.y1, e.x2, e.y2]
        .map((n) => n.toFixed(2))
        .sort()
        .join("|");
      if (seen.has(key)) {
        removed++;
        continue;
      }
      seen.add(key);
    }
    out.push(e);
  }
  return { entities: out, removed, tiny };
}

export type Issue = { message: string; p: Vec2 };

/** Verificação geométrica: contornos abertos, segmentos mínimos e duplicações. */
export function verify(entities: Entity[]): Issue[] {
  const issues: Issue[] = [];
  for (const e of entities) {
    if (e.type === "polyline" && !e.closed && e.pts.length > 2) {
      const a = e.pts[0]!;
      const b = e.pts[e.pts.length - 1]!;
      if (dist(a, b) > 0.1) issues.push({ message: "Contorno aberto", p: b });
    }
    if (e.type === "line" && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) < 0.5)
      issues.push({ message: "Segmento mínimo", p: { x: e.x1, y: e.y1 } });
  }
  const keys = new Map<string, Vec2>();
  for (const e of entities) {
    if (e.type !== "line") continue;
    const key = [e.x1, e.y1, e.x2, e.y2]
      .map((n) => n.toFixed(2))
      .sort()
      .join("|");
    if (keys.has(key)) issues.push({ message: "Entidade duplicada", p: keys.get(key)! });
    else keys.set(key, { x: e.x1, y: e.y1 });
  }
  return issues;
}

/* -------------------------------------------------------------------- DXF */

/** Índice ACI aproximado por camada técnica (o hex exato vai no grupo 420). */
/* O DXF é gerado exclusivamente por src/lib/dxf/exportService.ts. */

export function fromDxf(doc: DxfDocument, layer: LayerId): Entity[] {
  const out: Entity[] = [];
  for (const e of doc.entities) {
    if (e.type === "LINE")
      out.push({
        id: uid(),
        layer,
        type: "line",
        x1: e.start.x,
        y1: -e.start.y,
        x2: e.end.x,
        y2: -e.end.y,
      });
    if (e.type === "CIRCLE")
      out.push({ id: uid(), layer, type: "circle", cx: e.center.x, cy: -e.center.y, r: e.radius });
    if (e.type === "LWPOLYLINE")
      out.push({
        id: uid(),
        layer,
        type: "polyline",
        closed: !!e.closed,
        pts: e.points.map((p) => ({ x: p.x, y: -p.y })),
      });
    if (e.type === "ARC") {
      const rad = (d: number) => (-d * Math.PI) / 180;
      out.push({
        id: uid(),
        layer,
        type: "arc",
        cx: e.center.x,
        cy: -e.center.y,
        r: e.radius,
        a0: rad(e.endAngle),
        a1: rad(e.startAngle),
      });
    }
    if (e.type === "SPLINE" && e.controls.length >= 4) {
      const c = e.controls.map((p) => ({ x: p.x, y: -p.y }));
      const segs: BezierSeg[] = [];
      for (let i = 0; i + 3 < c.length; i += 3)
        segs.push({ c1: c[i + 1]!, c2: c[i + 2]!, p: c[i + 3]! });
      if (segs.length)
        out.push({ id: uid(), layer, type: "path", start: c[0]!, segs, closed: !!e.closed });
    }
  }

  return out;
}
