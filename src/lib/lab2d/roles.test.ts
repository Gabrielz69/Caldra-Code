import { describe, expect, it } from "vitest";

import type { Entity } from "./core";
import { createGroup, dissolveGroup, expandSelection } from "./groups";
import { roleOf } from "./roles";
import { buildCncDxf, DEFAULT_CNC_OPTIONS } from "@/lib/dxf/cncExport";
import { LASER_PROFILE_ID, TECHNICAL_PROFILE_ID } from "./roles";
import { dimensionEntities, makeDimension } from "./dimensions";

const line = (id: string, layer: string, x = 0): Entity => ({
  id,
  layer,
  type: "line",
  x1: x,
  y1: 0,
  x2: x + 100,
  y2: 0,
});

const square = (id: string): Entity => ({
  id,
  layer: "corte",
  type: "polyline",
  closed: true,
  pts: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ],
});

/** Grupo com papéis mistos — o caso que produzia BEND → MARK. */
const mixed = (): Entity[] => [
  square("cut"),
  line("b1", "dobra", 10),
  line("b2", "dobra", 20),
  line("b3", "dobra", 30),
  line("m1", "marcacao", 40),
  line("r1", "recorte", 50),
];

describe("agrupamento nunca define a função de fabricação", () => {
  it("cada entidade preserva seu papel dentro de um grupo", () => {
    const list = mixed();
    const g = createGroup(
      list,
      list.map((e) => e.id),
      [],
    )!;
    expect(g.entities.every((e) => e.group === g.id)).toBe(true);
    expect(roleOf(g.entities.find((e) => e.id === "b1")!)).toBe("BEND");
    expect(roleOf(g.entities.find((e) => e.id === "b2")!)).toBe("BEND");
    expect(roleOf(g.entities.find((e) => e.id === "b3")!)).toBe("BEND");
    expect(roleOf(g.entities.find((e) => e.id === "m1")!)).toBe("MARK");
    expect(roleOf(g.entities.find((e) => e.id === "r1")!)).toBe("RECORTE");
  });

  it("desagrupar preserva os papéis", () => {
    const list = mixed();
    const g = createGroup(
      list,
      list.map((e) => e.id),
      [],
    )!;
    const d = dissolveGroup(g.entities, g.groups, g.id);
    expect(d.entities.map(roleOf)).toEqual(list.map(roleOf));
    expect(d.entities.every((e) => e.group === undefined)).toBe(true);
  });

  it("seleção expandida não altera papéis", () => {
    const list = mixed();
    const g = createGroup(
      list,
      list.map((e) => e.id),
      [],
    )!;
    const sel = expandSelection(g.entities, ["b1"]);
    expect(sel.length).toBe(list.length);
    expect(roleOf(g.entities.find((e) => e.id === "b1")!)).toBe("BEND");
  });

  it("DOBRA agrupada é exportada na layer BEND, nunca MARK", () => {
    const list = mixed();
    const g = createGroup(
      list,
      list.map((e) => e.id),
      [],
    )!;
    for (const profileId of [TECHNICAL_PROFILE_ID, LASER_PROFILE_ID]) {
      const doc = buildCncDxf(g.entities, { ...DEFAULT_CNC_OPTIONS, profileId });
      const layers = doc.entities.map((e) => e.layer);
      expect(layers.filter((l) => l === "BEND").length).toBe(3);
      expect(layers).not.toContain("MARK_WRONG");
      expect(layers.filter((l) => l === "MARK").length).toBe(1);
      expect(layers.filter((l) => l === "RECORTE").length).toBe(1);
    }
  });
});

describe("cotas na exportação", () => {
  const list = mixed();
  const dims = dimensionEntities(
    [
      makeDimension("linear", [
        { kind: "point", p: { x: 0, y: 0 } },
        { kind: "point", p: { x: 200, y: 0 } },
      ]),
    ],
    list,
  );

  it("DXF LASER CNC não exporta cotas", () => {
    const doc = buildCncDxf([...list, ...dims], {
      ...DEFAULT_CNC_OPTIONS,
      profileId: LASER_PROFILE_ID,
    });
    expect(doc.entities.some((e) => e.layer === "DIMENSION")).toBe(false);
    expect(doc.entities.some((e) => e.layer === "CUT")).toBe(true);
  });

  it("DXF TÉCNICO preserva a natureza DIMENSION das cotas", () => {
    const doc = buildCncDxf([...list, ...dims], {
      ...DEFAULT_CNC_OPTIONS,
      profileId: TECHNICAL_PROFILE_ID,
      roles: { ...DEFAULT_CNC_OPTIONS.roles, DIMENSION: true },
    });
    expect(doc.entities.some((e) => e.layer === "DIMENSION")).toBe(true);
    for (const e of doc.entities.filter((x) => x.layer === "DIMENSION"))
      expect(e.layer).not.toBe("CUT");
  });
});
