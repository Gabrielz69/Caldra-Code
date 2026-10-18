/**
 * MODELO SEMÂNTICO DE FABRICAÇÃO DO CALDRA.
 *
 * Aqui vive a INTENÇÃO de fabricação — operação, contorno, sequência,
 * orientação, ponto de partida, lead-in e lead-out. É a fonte de verdade.
 *
 * Princípios:
 *   GEOMETRIA        ≠ UI
 *   DIREÇÃO          ≠ seta desenhada
 *   START POINT      ≠ marcador visual
 *   LEAD-IN          ≠ linha de construção
 *   LAYER            ≠ cor
 *
 * O renderer apenas representa este modelo; o exportador CNC apenas o converte.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { samplePath } from "./bezier";
import { dist, outlinePoints, segmentsOf, type Entity } from "./core";
import { endPointOf, isCutPath, pathLength, startPointOf } from "./cutPlan";
import { ROLE_BY_LAYER } from "./roles";

/* ------------------------------------------------------------- operações */

export type CncLayer = "CUT" | "MARK" | "BEND" | "REFERENCE" | "DIMENSION";

/**
 * Camada CNC de uma camada de desenho — pela SEMÂNTICA, nunca pela cor.
 * Fonte única: o mapa de papéis em `roles.ts`.
 */
export function cncLayerOf(layerId: string): CncLayer | null {
  const role = ROLE_BY_LAYER[layerId];
  return role && role !== "LEAD_IN" && role !== "LEAD_OUT" && role !== "DIRECTION"
    ? (role as CncLayer)
    : null;
}

/** Camadas exportáveis por padrão no modo CNC. */
export const DEFAULT_CNC_LAYERS: Record<CncLayer, boolean> = {
  CUT: true,
  MARK: true,
  BEND: true,
  REFERENCE: false,
  DIMENSION: false,
};

export const CNC_LAYER_HINT: Record<CncLayer, string> = {
  CUT: "corte",
  MARK: "marcação",
  BEND: "dobra / referência de processo",
  REFERENCE: "não exportado por padrão",
  DIMENSION: "não exportado por padrão",
};

/* ----------------------------------------------------------- lead in/out */

export type { Lead, LeadKind, CncMeta } from "./cncTypes";
import type { CncMeta, Lead } from "./cncTypes";

export const DEFAULT_LEAD: Lead = {
  kind: "none",
  length: 5,
  radius: 3,
  angleDeg: 45,
  side: "left",
};

export const cncOf = (e: Entity): CncMeta => (e as { cnc?: CncMeta }).cnc ?? {};

export const withCnc = (e: Entity, patch: Partial<CncMeta>): Entity =>
  ({ ...e, cnc: { ...cncOf(e), ...patch } }) as Entity;

/* ------------------------------------------------------------ orientação */

export type Orientation = "cw" | "ccw" | "open";

/** Área com sinal do percurso amostrado (Y para baixo → positiva = horário). */
export function signedArea(e: Entity): number {
  if (e.type === "circle") return Math.PI * e.r * e.r;
  const pts = e.type === "path" ? samplePath(e.start, e.segs, e.closed, 8) : outlinePoints(e);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function orientationOf(e: Entity): Orientation {
  if (e.type === "arc") return e.a1 >= e.a0 ? "cw" : "ccw";
  const closed = e.type === "circle" || ((e.type === "polyline" || e.type === "path") && e.closed);
  if (!closed) return "open";
  return signedArea(e) >= 0 ? "cw" : "ccw";
}

export const ORIENTATION_LABEL: Record<Orientation, string> = {
  cw: "Horário",
  ccw: "Anti-horário",
  open: "Aberto",
};

/* -------------------------------------------------------------- tangente */

/** Direção unitária do percurso no ponto de partida (sentido real de corte). */
export function startTangent(e: Entity): Vec2 {
  if (e.type === "circle") return { x: 0, y: 1 };
  if (e.type === "arc") {
    const dir = e.a1 >= e.a0 ? 1 : -1;
    return { x: -Math.sin(e.a0) * dir, y: Math.cos(e.a0) * dir };
  }
  const segs = segmentsOf(e);
  const s = segs[0];
  if (!s) return { x: 1, y: 0 };
  const dx = s[1].x - s[0].x;
  const dy = s[1].y - s[0].y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/** Direção unitária do percurso no ponto final. */
export function endTangent(e: Entity): Vec2 {
  if (e.type === "circle") return { x: 0, y: 1 };
  if (e.type === "arc") {
    const dir = e.a1 >= e.a0 ? 1 : -1;
    return { x: -Math.sin(e.a1) * dir, y: Math.cos(e.a1) * dir };
  }
  const segs = segmentsOf(e);
  const s = segs[segs.length - 1];
  if (!s) return { x: 1, y: 0 };
  const dx = s[1].x - s[0].x;
  const dy = s[1].y - s[0].y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/**
 * Geometria real do lead. Devolve uma polilinha em mm:
 *  - lead-in  termina no ponto de partida;
 *  - lead-out começa no ponto final.
 * Devolve null quando não há lead (kind = "none").
 */
export function leadPolyline(e: Entity, which: "in" | "out"): Vec2[] | null {
  const meta = cncOf(e);
  const lead = which === "in" ? meta.leadIn : meta.leadOut;
  if (!lead || lead.kind === "none") return null;
  const p = which === "in" ? startPointOf(e) : endPointOf(e);
  const t = which === "in" ? startTangent(e) : endTangent(e);
  const sign = lead.side === "left" ? 1 : -1;

  if (lead.kind === "line") {
    const a = ((which === "in" ? 180 - lead.angleDeg : lead.angleDeg) * Math.PI) / 180;
    const c = Math.cos(a * sign);
    const s = Math.sin(a * sign);
    const d = { x: t.x * c - t.y * s, y: t.x * s + t.y * c };
    const q = { x: p.x + d.x * lead.length, y: p.y + d.y * lead.length };
    return which === "in" ? [q, p] : [p, q];
  }

  // arco tangente de 90° com raio definido
  const r = Math.max(0.1, lead.radius);
  const n = { x: -t.y * sign, y: t.x * sign };
  const c = { x: p.x + n.x * r, y: p.y + n.y * r };
  const a0 = Math.atan2(p.y - c.y, p.x - c.x);
  const dir = which === "in" ? -sign : sign;
  const pts: Vec2[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + dir * (Math.PI / 2) * (i / steps);
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return which === "in" ? pts.reverse() : pts;
}

/* -------------------------------------------------------------- contornos */

export type Contour = {
  id: string;
  ids: string[];
  closed: boolean;
  orientation: Orientation;
  length: number;
  /** Posição (1-based) na sequência de fabricação. */
  sequence: number;
  start: Vec2;
};

const CONNECT_TOL = 0.05;

/**
 * Agrupa os caminhos de corte conectados em contornos.
 * A ordem do array de entidades é a sequência de fabricação (fonte única).
 */
export function contoursOf(entities: Entity[]): Contour[] {
  const paths = entities.filter(isCutPath);
  const used = new Set<string>();
  const out: Contour[] = [];

  const selfClosed = (e: Entity) =>
    e.type === "circle" || ((e.type === "polyline" || e.type === "path") && e.closed);

  for (const seed of paths) {
    if (used.has(seed.id)) continue;
    used.add(seed.id);
    const chain: Entity[] = [seed];

    if (!selfClosed(seed)) {
      let grew = true;
      while (grew) {
        grew = false;
        const head = startPointOf(chain[0]!);
        const tail = endPointOf(chain[chain.length - 1]!);
        for (const cand of paths) {
          if (used.has(cand.id) || selfClosed(cand)) continue;
          if (dist(startPointOf(cand), tail) <= CONNECT_TOL) {
            chain.push(cand);
          } else if (dist(endPointOf(cand), head) <= CONNECT_TOL) {
            chain.unshift(cand);
          } else continue;
          used.add(cand.id);
          grew = true;
          break;
        }
      }
    }

    const first = chain[0]!;
    const last = chain[chain.length - 1]!;
    const closed =
      selfClosed(first) ||
      (chain.length > 1 && dist(startPointOf(first), endPointOf(last)) <= CONNECT_TOL);
    out.push({
      id: cncOf(first).contourId ?? first.id,
      ids: chain.map((e) => e.id),
      closed,
      orientation:
        chain.length === 1 ? orientationOf(first) : closed ? chainOrientation(chain) : "open",
      length: chain.reduce((a, e) => a + pathLength(e), 0),
      sequence: out.length + 1,
      start: startPointOf(first),
    });
  }
  return out;
}

function chainOrientation(chain: Entity[]): Orientation {
  let a = 0;
  for (const e of chain) for (const s of segmentsOf(e)) a += s[0].x * s[1].y - s[1].x * s[0].y;
  return a >= 0 ? "cw" : "ccw";
}

/** Contorno ao qual uma entidade pertence. */
export function contourContaining(entities: Entity[], id: string): Contour | null {
  return contoursOf(entities).find((c) => c.ids.includes(id)) ?? null;
}

/* -------------------------------------------------------- medidas / lote */

/** Comprimento fabricável total (corte, marcação e dobra). Ignora cotas e UI. */
export function totalLengthOf(entities: Entity[]): number {
  return entities
    .filter((e) => {
      const l = cncLayerOf(e.layer);
      return e.type !== "text" && (l === "CUT" || l === "MARK" || l === "BEND");
    })
    .reduce((a, e) => a + pathLength(e), 0);
}

/** Entidades que possuem direção real de percurso. */
export const isDirectional = (e: Entity) =>
  e.type === "line" || e.type === "polyline" || e.type === "arc" || e.type === "path";

/* ------------------------------------------------------------- validação */

export type CncIssue = { level: "error" | "warning"; scope: string; message: string };

export function validateManufacturing(entities: Entity[]): CncIssue[] {
  const issues: CncIssue[] = [];
  const contours = contoursOf(entities);

  if (!contours.length)
    issues.push({ level: "error", scope: "Projeto", message: "Nenhum contorno de corte." });

  for (const c of contours) {
    const label = `Contorno ${String(c.sequence).padStart(2, "0")}`;
    if (!Number.isFinite(c.start.x) || !Number.isFinite(c.start.y))
      issues.push({ level: "error", scope: label, message: "Ponto de partida inválido." });
    if (c.length < 0.1)
      issues.push({ level: "error", scope: label, message: "Comprimento degenerado (< 0,1 mm)." });

    for (const id of c.ids) {
      const e = entities.find((x) => x.id === id);
      if (!e) continue;
      for (const which of ["in", "out"] as const) {
        const lead = which === "in" ? cncOf(e).leadIn : cncOf(e).leadOut;
        if (!lead || lead.kind === "none") continue;
        const poly = leadPolyline(e, which);
        const anchor = which === "in" ? startPointOf(e) : endPointOf(e);
        const touch = which === "in" ? poly?.[poly.length - 1] : poly?.[0];
        if (!poly || !touch || dist(touch, anchor) > 0.01)
          issues.push({
            level: "error",
            scope: label,
            message: `Lead-${which === "in" ? "in" : "out"} não está conectado ao percurso.`,
          });
        else if (lead.length <= 0 && lead.kind === "line")
          issues.push({
            level: "warning",
            scope: label,
            message: `Lead-${which} com comprimento zero.`,
          });
      }
    }
  }

  // duplicatas exatas
  const seen = new Set<string>();
  for (const e of entities) {
    if (e.type === "text") continue;
    const key = `${e.type}|${e.layer}|${outlinePoints(e)
      .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
      .join(";")}`;
    if (seen.has(key))
      issues.push({ level: "warning", scope: "Geometria", message: "Entidade duplicada." });
    seen.add(key);
  }
  return issues;
}
