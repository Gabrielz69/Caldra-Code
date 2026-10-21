import { describe, expect, it } from "vitest";
import type { Entity } from "./core";
import {
  copySelection,
  finishPolylinePoints,
  pasteClipboard,
  projectOrthoSegment,
  removeEntityOnly,
  shouldClosePolyline,
} from "./editorInteractions";

const line = (id: string, x: number, group?: string): Entity => ({
  id,
  ...(group ? { group } : {}),
  layer: id === "bend" ? "dobra" : "corte",
  type: "line",
  x1: x,
  y1: 0,
  x2: x + 10,
  y2: 0,
});

describe("interações do editor CHAMFER", () => {
  it("finaliza e fecha uma única polilinha sem duplicar o último vértice", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 10 },
    ];
    expect(finishPolylinePoints(points)).toHaveLength(3);
    expect(shouldClosePolyline(points.slice(0, 3), { x: 0.1, y: 0.1 }, 1)).toBe(true);
    expect(finishPolylinePoints([...points.slice(0, 3), { x: 0, y: 0 }], true)).toHaveLength(3);
  });

  it("copia somente a seleção e preserva layer e grupo ao colar", () => {
    const entities = [line("a", 0, "g1"), line("bend", 20, "g1"), line("c", 40)];
    const clipboard = copySelection(entities, ["bend"]);
    expect(clipboard?.entities.map((e) => e.id)).toEqual(["bend"]);
    const pasted = pasteClipboard(clipboard!, { x: 100, y: 50 });
    expect(pasted.entities).toHaveLength(1);
    expect(pasted.entities[0]?.layer).toBe("dobra");
    expect(pasted.entities[0]?.group).not.toBe("g1");
  });

  it("copia múltiplos membros e remapeia o grupo sem alterar sua estrutura", () => {
    const clipboard = copySelection([line("a", 0, "g1"), line("b", 20, "g1")], ["a", "b"]);
    const pasted = pasteClipboard(clipboard!, { x: 50, y: 50 });
    expect(pasted.entities[0]?.group).toBe(pasted.entities[1]?.group);
    expect(pasted.entities[0]?.group).not.toBe("g1");
  });

  it("tesoura remove somente o membro tocado e mantém o restante do grupo", () => {
    const entities = [line("a", 0, "g1"), line("b", 20, "g1"), line("c", 40, "g1")];
    const result = removeEntityOnly(entities, [{ id: "g1", name: "Grupo 1" }], "b");
    expect(result.entities.map((e) => e.id)).toEqual(["a", "c"]);
    expect(result.entities.every((e) => e.group === "g1")).toBe(true);
    expect(result.groups).toHaveLength(1);
  });

  it("trava os segmentos da polilinha no modo ORTO escolhendo o eixo dominante (horizontal ou vertical)", () => {
    const origin = { x: 50, y: 50 };

    // Movimento predominantemente horizontal (dx > dy): y deve ser travado no y anterior (50)
    const horizRight = projectOrthoSegment(origin, { x: 120, y: 65 });
    expect(horizRight).toEqual({ x: 120, y: 50 });

    const horizLeft = projectOrthoSegment(origin, { x: 10, y: 40 });
    expect(horizLeft).toEqual({ x: 10, y: 50 });

    // Movimento predominantemente vertical (dy >= dx): x deve ser travado no x anterior (50)
    const vertUp = projectOrthoSegment(origin, { x: 62, y: 150 });
    expect(vertUp).toEqual({ x: 50, y: 150 });

    const vertDown = projectOrthoSegment(origin, { x: 45, y: -20 });
    expect(vertDown).toEqual({ x: 50, y: -20 });
  });
});
