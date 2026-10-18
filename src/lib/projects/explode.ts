/**
 * VISTA EXPLODIDA — layout puro do dossiê.
 *
 * Não existe modelo 3D no CALDRA: a vista explodida é uma representação
 * esquemática, em milímetros relativos, das peças do projeto separadas por
 * conjunto/subconjunto. A silhueta de cada peça vem do MESMO desenvolvimento
 * usado na BOM (`partShape`) — nada é recalculado por outro caminho.
 *
 * Funções puras: recebem o projeto, devolvem coordenadas em um viewBox.
 */

import { partShape } from "./bom";
import type { Project, ProjectPart } from "./store";

export type ExplodeNode = {
  instanceId: string;
  code: string;
  name: string;
  quantity: number;
  /** true quando o desenvolvimento pôde ser calculado (silhueta real). */
  resolved: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** ponto no eixo do conjunto, origem da linha de chamada. */
  axisX: number;
  axisY: number;
};

export type ExplodeGroup = {
  id: string;
  label: string;
  kind: "conjunto" | "subconjunto" | "avulsas";
  x: number;
  nodes: ExplodeNode[];
};

export type ExplodeLayout = {
  groups: ExplodeGroup[];
  width: number;
  height: number;
};

const CELL_W = 120;
const CELL_H = 78;
const COL_GAP = 44;
const BASE_GAP = 14;
const TOP = 44;

function fit(part: ProjectPart): { w: number; h: number; resolved: boolean } {
  const shape = partShape(part);
  if (!shape) return { w: CELL_W * 0.55, h: CELL_H * 0.5, resolved: false };
  const k = Math.min((CELL_W * 0.86) / shape.w, (CELL_H * 0.8) / shape.h);
  return { w: Math.max(14, shape.w * k), h: Math.max(10, shape.h * k), resolved: true };
}

/**
 * Monta o layout da vista explodida.
 * @param explode 0 = montado (peças encostadas) … 1 = totalmente separado.
 */
export function explodeLayout(project: Project, explode = 1): ExplodeLayout {
  const factor = Math.max(0, Math.min(1, explode));
  const columns: { id: string; label: string; kind: ExplodeGroup["kind"]; parts: ProjectPart[] }[] =
    [];

  for (const asm of project.assemblies) {
    const direct = project.parts.filter((p) => p.assemblyId === asm.id && !p.subassemblyId);
    if (direct.length) {
      columns.push({ id: asm.id, label: asm.name, kind: "conjunto", parts: direct });
    }
    for (const sub of project.subassemblies.filter((s) => s.assemblyId === asm.id)) {
      const sp = project.parts.filter((p) => p.subassemblyId === sub.id);
      if (sp.length) {
        columns.push({
          id: sub.id,
          label: `${asm.name} · ${sub.name}`,
          kind: "subconjunto",
          parts: sp,
        });
      }
    }
  }
  const loose = project.parts.filter((p) => !p.assemblyId && !p.subassemblyId);
  if (loose.length) {
    columns.push({ id: "avulsas", label: "Peças avulsas", kind: "avulsas", parts: loose });
  }

  const groups: ExplodeGroup[] = [];
  let maxBottom = TOP;

  columns.forEach((col, ci) => {
    const x = 30 + ci * (CELL_W + COL_GAP);
    const nodes: ExplodeNode[] = [];
    let y = TOP;
    col.parts.forEach((part, ri) => {
      const box = fit(part);
      const gap = BASE_GAP + factor * 46;
      const cy = y + box.h / 2;
      nodes.push({
        instanceId: part.instanceId,
        code: part.code,
        name: part.name,
        quantity: Math.max(1, part.quantity),
        resolved: box.resolved,
        x: x + CELL_W / 2 - box.w / 2 + factor * (ri % 2 === 0 ? -10 : 10),
        y,
        w: box.w,
        h: box.h,
        axisX: x + CELL_W / 2,
        axisY: cy,
      });
      y += box.h + gap;
    });
    maxBottom = Math.max(maxBottom, y);
    groups.push({ id: col.id, label: col.label, kind: col.kind, x, nodes });
  });

  return {
    groups,
    width: Math.max(320, 30 + columns.length * (CELL_W + COL_GAP)),
    height: Math.max(240, maxBottom + 16),
  };
}
