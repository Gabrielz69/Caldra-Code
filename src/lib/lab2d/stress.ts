/**
 * Cenário de estresse interno para medir performance do CHAMFER.
 * Ativado por parâmetro de URL (?stress=5000) — nunca aparece na interface.
 */

import { uid, type Entity } from "./core";

/** Gera N entidades variadas (linhas, círculos, arcos e polilinhas densas). */
export function stressEntities(total = 5000): Entity[] {
  const out: Entity[] = [];
  const lines = Math.round(total * 0.6);
  const circles = Math.round(total * 0.2);
  const polys = Math.round(total * 0.1);
  const arcs = Math.max(0, total - lines - circles - polys);
  const rnd = (n: number) => Math.random() * n;
  const layers = ["corte", "dobra", "marcacao", "construcao"];
  const layer = () => layers[Math.floor(rnd(layers.length))]!;

  for (let i = 0; i < lines; i++) {
    const x = rnd(2000);
    const y = rnd(2000);
    out.push({
      id: uid(),
      layer: layer(),
      type: "line",
      x1: x,
      y1: y,
      x2: x + rnd(60) - 30,
      y2: y + rnd(60) - 30,
    });
  }
  for (let i = 0; i < circles; i++)
    out.push({
      id: uid(),
      layer: layer(),
      type: "circle",
      cx: rnd(2000),
      cy: rnd(2000),
      r: 2 + rnd(20),
    });
  for (let i = 0; i < arcs; i++)
    out.push({
      id: uid(),
      layer: layer(),
      type: "arc",
      cx: rnd(2000),
      cy: rnd(2000),
      r: 3 + rnd(25),
      a0: rnd(Math.PI * 2),
      a1: rnd(Math.PI * 2),
    });
  for (let i = 0; i < polys; i++) {
    const ox = rnd(2000);
    const oy = rnd(2000);
    const pts = Array.from({ length: 120 }, (_, j) => ({
      x: ox + j * 0.6,
      y: oy + Math.sin(j / 6) * 8,
    }));
    out.push({ id: uid(), layer: layer(), type: "polyline", pts, closed: false });
  }
  return out;
}
