/**
 * SIMULAÇÃO DE TRAJETÓRIA (apenas visual).
 *
 * Percorre o plano na sequência real: START → LEAD-IN → CUT → LEAD-OUT →
 * deslocamento → próximo contorno. Nada aqui gera exportação: a fonte de
 * verdade continua sendo o modelo geométrico/semântico.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { samplePath } from "./bezier";
import type { Entity } from "./core";
import { isCutPath } from "./cutPlan";
import { leadPolyline } from "./manufacturing";

export type SimKind = "lead-in" | "cut" | "lead-out" | "rapid";

export type SimStep = { kind: SimKind; pts: Vec2[]; length: number; sequence: number };

export type SimPath = { steps: SimStep[]; total: number };

const polyLen = (pts: Vec2[]) =>
  pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) : 0), 0);

function worldPath(e: Entity): Vec2[] {
  switch (e.type) {
    case "line":
      return [
        { x: e.x1, y: e.y1 },
        { x: e.x2, y: e.y2 },
      ];
    case "polyline":
      return e.closed ? [...e.pts, e.pts[0]!] : e.pts;
    case "path":
      return samplePath(e.start, e.segs, e.closed, 10);
    case "circle":
      return Array.from({ length: 65 }, (_, i) => ({
        x: e.cx + e.r * Math.cos((i / 64) * Math.PI * 2),
        y: e.cy + e.r * Math.sin((i / 64) * Math.PI * 2),
      }));
    case "arc": {
      let sweep = e.a1 - e.a0;
      while (sweep < -Math.PI * 2) sweep += Math.PI * 2;
      return Array.from({ length: 49 }, (_, i) => ({
        x: e.cx + e.r * Math.cos(e.a0 + sweep * (i / 48)),
        y: e.cy + e.r * Math.sin(e.a0 + sweep * (i / 48)),
      }));
    }
    default:
      return [];
  }
}

export function buildSimPath(entities: Entity[]): SimPath {
  const steps: SimStep[] = [];
  let cursor: Vec2 | null = null;
  let seq = 0;

  for (const e of entities.filter(isCutPath)) {
    seq++;
    const cut = worldPath(e);
    if (cut.length < 2) continue;
    const lin = leadPolyline(e, "in");
    const lout = leadPolyline(e, "out");
    const entry = lin?.[0] ?? cut[0]!;

    if (cursor) {
      const pts = [cursor, entry];
      steps.push({ kind: "rapid", pts, length: polyLen(pts), sequence: seq });
    }
    if (lin) steps.push({ kind: "lead-in", pts: lin, length: polyLen(lin), sequence: seq });
    steps.push({ kind: "cut", pts: cut, length: polyLen(cut), sequence: seq });
    if (lout) steps.push({ kind: "lead-out", pts: lout, length: polyLen(lout), sequence: seq });
    cursor = lout?.[lout.length - 1] ?? cut[cut.length - 1]!;
  }
  return { steps, total: steps.reduce((a, s) => a + s.length, 0) };
}

export type SimSample = {
  p: Vec2;
  kind: SimKind;
  sequence: number;
  done: SimStep[];
  partial: Vec2[];
};

/** Posição do cabeçote a `d` mm do início, com o rastro já percorrido. */
export function sampleSim(sim: SimPath, d: number): SimSample | null {
  if (!sim.steps.length) return null;
  let rest = Math.max(0, Math.min(d, sim.total));
  const done: SimStep[] = [];
  for (const s of sim.steps) {
    if (rest > s.length) {
      rest -= s.length;
      done.push(s);
      continue;
    }
    const partial: Vec2[] = [s.pts[0]!];
    let acc = 0;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1]!;
      const b = s.pts[i]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + l >= rest) {
        const t = l ? (rest - acc) / l : 0;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        partial.push(p);
        return { p, kind: s.kind, sequence: s.sequence, done, partial };
      }
      acc += l;
      partial.push(b);
    }
    const last = s.pts[s.pts.length - 1]!;
    return { p: last, kind: s.kind, sequence: s.sequence, done, partial };
  }
  const last = sim.steps[sim.steps.length - 1]!;
  const p = last.pts[last.pts.length - 1]!;
  return { p, kind: last.kind, sequence: last.sequence, done: sim.steps, partial: [p] };
}

export const SIM_LABEL: Record<SimKind, string> = {
  "lead-in": "Entrada",
  cut: "Corte",
  "lead-out": "Saída",
  rapid: "Deslocamento",
};
