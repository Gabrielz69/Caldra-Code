/**
 * REGRESSÃO SEMÂNTICA DA EXPORTAÇÃO CNC.
 *
 * Golden sample: quadrado-→-redondo-p01.dxf (arquivo real do usuário).
 * A comparação é GEOMÉTRICA e SEMÂNTICA — nunca byte a byte.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dxfVersionFor, exportDxf, importDxf } from "@/lib/dxf/dxfService";
import {
  DEFAULT_CNC_OPTIONS,
  buildCncDxf,
  cncCounts,
  layerMapping,
  preflightCnc,
  validateCncExport,
  verifyCncDxf,
} from "@/lib/dxf/cncExport";
import { exportDXF } from "@/lib/dxf/exportService";
import { uid, type Entity } from "@/lib/lab2d/core";
import {
  CYPCUT_APPID,
  CYPCUT_CHANNEL,
  LASER_PROFILE_ID,
  roleOf,
  structureMap,
} from "@/lib/lab2d/roles";

const golden = importDxf(
  readFileSync(join(process.cwd(), "src/lib/dxf/__fixtures__/quadrado-redondo-p01.dxf"), "utf8"),
);

/** Peça equivalente ao golden sample, no modelo do CHAMFER. */
function samplePart(): Entity[] {
  const outline = [
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    { x: 600, y: 820 },
    { x: 0, y: 820 },
  ];
  return [
    { id: uid(), layer: "corte", type: "polyline", closed: true, pts: outline },
    { id: uid(), layer: "corte", type: "circle", cx: 300, cy: 410, r: 40 },
    { id: uid(), layer: "dobra", type: "line", x1: 0, y1: 200, x2: 600, y2: 200 },
    { id: uid(), layer: "dobra", type: "line", x1: 0, y1: 600, x2: 600, y2: 600 },
    { id: uid(), layer: "marcacao", type: "line", x1: 50, y1: 50, x2: 550, y2: 50 },
    { id: uid(), layer: "construcao", type: "line", x1: 0, y1: 410, x2: 600, y2: 410 },
    { id: uid(), layer: "cota", type: "text", x: 10, y: 10, text: "600", size: 12 },
  ];
}

describe("golden sample do usuário", () => {
  it("tem um contorno principal fechado e geometria auxiliar separada", () => {
    const closed = golden.entities.filter((e) => e.type === "LWPOLYLINE" && e.closed);
    expect(closed).toHaveLength(1);
    const contourLayer = closed[0]!.layer;
    const aux = golden.entities.filter((e) => e.layer !== contourLayer);
    expect(aux.length).toBeGreaterThan(0);
    expect(new Set(golden.entities.map((e) => e.layer)).size).toBe(2);
  });

  it("mantém escala 1:1 em milímetros", () => {
    const poly = golden.entities.find((e) => e.type === "LWPOLYLINE" && e.closed);
    expect(poly && poly.type === "LWPOLYLINE").toBe(true);
    if (poly?.type !== "LWPOLYLINE") return;
    const xs = poly.points.map((p) => p.x);
    const ys = poly.points.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(611.288, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(820.734, 1);
    expect(poly.points.length).toBe(30);
  });
});

describe("papéis de fabricação", () => {
  it("classifica pela camada semântica, nunca pela cor", () => {
    const [outline, hole, bend, , mark, ref, dim] = samplePart();
    expect(roleOf(outline!)).toBe("CUT");
    expect(roleOf(hole!)).toBe("CUT");
    expect(roleOf(bend!)).toBe("BEND");
    expect(roleOf(mark!)).toBe("MARK");
    expect(roleOf(ref!)).toBe("REFERENCE");
    expect(roleOf(dim!)).toBe("DIMENSION");
  });

  it("separa contorno externo, furos e cortes internos", () => {
    const part = samplePart();
    const structure = structureMap(part);
    expect(structure.get(part[0]!.id)).toBe("outer");
    expect(structure.get(part[1]!.id)).toBe("hole");
    const c = cncCounts(part);
    expect(c).toMatchObject({
      CUT: 2,
      RECORTE: 0,
      MARK: 1,
      BEND: 2,
      REFERENCE: 1,
      DIMENSION: 1,
      outer: 1,
      holes: 1,
    });
    expect(c.unclassified).toBe(0);
  });

  it("acusa erro de fabricação em geometria sem classificação", () => {
    const part: Entity[] = [
      ...samplePart(),
      { id: uid(), layer: "qualquer", type: "line", x1: 0, y1: 0, x2: 10, y2: 0 },
    ];
    expect(cncCounts(part).unclassified).toBe(1);
    const issues = validateCncExport(part, DEFAULT_CNC_OPTIONS);
    expect(issues.some((i) => i.level === "error" && i.scope === "Classificação")).toBe(true);
    // nada sem papel entra no arquivo
    const doc = buildCncDxf(part, DEFAULT_CNC_OPTIONS);
    expect(doc.entities.every((e) => e.layer !== "UNCLASSIFIED")).toBe(true);
  });
});

describe("perfil DXF LASER CNC", () => {
  const part = samplePart();
  const doc = buildCncDxf(part, DEFAULT_CNC_OPTIONS);

  it("exporta somente corte, marcação e dobra", () => {
    expect(new Set(doc.layers.map((l) => l.name))).toEqual(new Set(["CUT", "MARK", "BEND"]));
    expect(doc.entities.filter((e) => e.layer === "CUT")).toHaveLength(2);
    expect(doc.entities.filter((e) => e.layer === "BEND")).toHaveLength(2);
    expect(doc.entities.filter((e) => e.layer === "MARK")).toHaveLength(1);
  });

  it("nunca leva dobra, referência ou cota para CUT", () => {
    const cut = doc.entities.filter((e) => e.layer === "CUT");
    expect(cut.every((e) => e.type === "LWPOLYLINE" || e.type === "CIRCLE")).toBe(true);
    expect(doc.entities.some((e) => e.layer === "REFERENCE")).toBe(false);
    expect(doc.entities.some((e) => e.layer === "DIMENSION")).toBe(false);
  });

  it("mantém o contorno externo fechado e em escala 1:1 em mm", () => {
    const text = exportDxf(doc);
    expect(text).toContain("$INSUNITS");
    const back = importDxf(text);
    const outer = back.entities.find((e) => e.layer === "CUT" && e.type === "LWPOLYLINE");
    expect(outer?.type === "LWPOLYLINE" && outer.closed).toBe(true);
    if (outer?.type !== "LWPOLYLINE") return;
    const xs = outer.points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(600, 6);
    const check = verifyCncDxf(part, DEFAULT_CNC_OPTIONS, text);
    expect(check.ok).toBe(true);
  });

  it("NUNCA converte dobra em marcação", () => {
    expect(doc.entities.filter((e) => e.layer === "MARK")).toHaveLength(1);
    expect(doc.entities.filter((e) => e.layer === "BEND")).toHaveLength(2);
    for (const profile of ["tecnico", "laser-cnc", "cypcut", "producao"]) {
      const d = buildCncDxf(part, { ...DEFAULT_CNC_OPTIONS, profileId: profile });
      expect(d.entities.filter((e) => e.layer === "BEND")).toHaveLength(2);
      expect(d.entities.filter((e) => e.layer === "MARK")).toHaveLength(1);
    }
  });

  it("exporta o recorte em layer própria, sem virar corte", () => {
    const withCut: Entity[] = [
      ...part,
      { id: uid(), layer: "recorte", type: "circle", cx: 120, cy: 120, r: 25 },
    ];
    const d = buildCncDxf(withCut, DEFAULT_CNC_OPTIONS);
    expect(d.entities.filter((e) => e.layer === "RECORTE")).toHaveLength(1);
    expect(d.entities.filter((e) => e.layer === "CUT")).toHaveLength(2);
    expect(cncCounts(withCut).unclassified).toBe(0);
  });
});

describe("versão DXF declarada", () => {
  const part = samplePart();
  const doc = buildCncDxf(part, DEFAULT_CNC_OPTIONS);

  it("nunca declara AC1009 (R12) quando há LWPOLYLINE", () => {
    expect(doc.entities.some((e) => e.type === "LWPOLYLINE")).toBe(true);
    expect(dxfVersionFor(doc)).toBe("AC1018");
    const text = exportDxf(doc);
    expect(text).toContain("$ACADVER\n1\nAC1018");
    expect(text).not.toContain("AC1009");
  });

  it("declara AC1018 quando há SPLINE", () => {
    expect(
      dxfVersionFor({
        layers: [],
        entities: [
          {
            type: "SPLINE",
            layer: "CUT",
            closed: false,
            controls: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 2, y: 0 },
              { x: 3, y: 0 },
            ],
          },
        ],
      }),
    ).toBe("AC1018");
  });

  it("só declara AC1009 sem LWPOLYLINE, SPLINE e sem dados estendidos", () => {
    expect(
      dxfVersionFor({
        layers: [],
        entities: [{ type: "LINE", layer: "CUT", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }],
      }),
    ).toBe("AC1009");
  });

  it("a conferência do arquivo confere a versão declarada", () => {
    const check = verifyCncDxf(part, DEFAULT_CNC_OPTIONS, exportDxf(doc));
    const row = check.rows.find((r) => r.field === "Versão DXF");
    expect(row?.ok).toBe(true);
    expect(row?.actual).toBe("AC1018");
    expect(check.ok).toBe(true);
  });
});

describe("estrutura CypCut (FS_CYPCUT)", () => {
  const part = samplePart();
  const doc = buildCncDxf(part, DEFAULT_CNC_OPTIONS);

  it("declara o APPID e marca todas as entidades", () => {
    expect(doc.appIds).toEqual([CYPCUT_APPID]);
    expect(doc.entities.every((e) => (e.xdata ?? []).some((x) => x.appId === CYPCUT_APPID))).toBe(
      true,
    );
  });

  it("usa o canal correto por função de fabricação", () => {
    const channelOf = (layer: string) => {
      const e = doc.entities.find((x) => x.layer === layer)!;
      const pairs = e.xdata![0]!.pairs;
      const i = pairs.findIndex((p) => p.value === "Channel");
      return pairs[i + 1]!.value;
    };
    expect(channelOf("CUT")).toBe(CYPCUT_CHANNEL.CUT);
    expect(channelOf("MARK")).toBe(CYPCUT_CHANNEL.MARK);
    expect(channelOf("BEND")).toBe(CYPCUT_CHANNEL.BEND);
  });

  it("mapeia o golden sample: CUT 1, RECORTE 2, BEND 7, MARK 15", () => {
    expect(CYPCUT_CHANNEL.CUT).toBe(1);
    expect(CYPCUT_CHANNEL.RECORTE).toBe(2);
    expect(CYPCUT_CHANNEL.BEND).toBe(7);
    expect(CYPCUT_CHANNEL.MARK).toBe(15);
  });

  it("RECORTE nunca vira CUT: layer própria e Channel 2", () => {
    const recorte: Entity[] = [
      { id: "c1", layer: "corte", type: "circle", cx: 0, cy: 0, r: 50 },
      { id: "r1", layer: "recorte", type: "circle", cx: 0, cy: 0, r: 10 },
    ];
    const d = buildCncDxf(recorte, { ...DEFAULT_CNC_OPTIONS, profileId: LASER_PROFILE_ID });
    const e = d.entities.find((x) => x.layer === "RECORTE")!;
    expect(e).toBeTruthy();
    const pairs = e.xdata![0]!.pairs;
    expect(pairs[pairs.findIndex((p) => p.value === "Channel") + 1]!.value).toBe(2);
    expect(d.entities.filter((x) => x.layer === "CUT")).toHaveLength(1);
  });

  it("escreve APPID, blocos balanceados e 1001 no arquivo", () => {
    const text = exportDxf(doc);
    expect(text).toContain("APPID");
    expect(text).toContain(`1001\n${CYPCUT_APPID}`);
    expect(text).toContain("LeadIn");
    expect(text).toContain("ToolCompensation");
    const opens = (text.match(/1002\n\{/g) ?? []).length;
    const closes = (text.match(/1002\n\}/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(opens).toBe(doc.entities.length * 3);
  });

  it("o perfil técnico não escreve a estrutura do CypCut", () => {
    const tech = buildCncDxf(part, { ...DEFAULT_CNC_OPTIONS, profileId: "tecnico" });
    expect(tech.appIds).toBeUndefined();
    expect(tech.entities.every((e) => !e.xdata)).toBe(true);
  });

  it("o preflight confirma a estrutura e o conteúdo", () => {
    const rows = preflightCnc(part, DEFAULT_CNC_OPTIONS);
    const row = rows.find((r) => r.label.startsWith("Estrutura CypCut"));
    expect(row?.ok).toBe(true);
    expect(rows.every((r) => r.ok)).toBe(true);
  });
});

describe("ponto único de exportação", () => {
  it("os três perfis são configurações do mesmo pipeline", () => {
    const part = samplePart();
    for (const profile of ["tecnico", "laser-cnc", "cypcut", "producao"]) {
      const r = exportDXF({ geometry: part, profile });
      expect(r.text).toContain("$INSUNITS");
      expect(r.doc.entities.length).toBeGreaterThan(0);
      expect(r.errors).toHaveLength(0);
    }
    // a geometria de corte é idêntica nos três perfis
    const cut = (p: string) =>
      exportDXF({ geometry: samplePart(), profile: p }).doc.entities.filter(
        (e) => e.layer === "CUT",
      ).length;
    expect(cut("tecnico")).toBe(cut("laser-cnc"));
    // ids antigos continuam válidos e apontam para o perfil de laser
    expect(cut("cypcut")).toBe(cut("laser-cnc"));
    expect(cut("producao")).toBe(cut("laser-cnc"));
  });
});

describe("perfis técnico e laser", () => {
  const part = samplePart();

  it("o técnico inclui referência e cotas em layers próprias", () => {
    const opts = {
      ...DEFAULT_CNC_OPTIONS,
      profileId: "tecnico",
      roles: { CUT: true, RECORTE: true, MARK: true, BEND: true, REFERENCE: true, DIMENSION: true },
    };
    const doc = buildCncDxf(part, opts);
    expect(doc.layers.map((l) => l.name)).toContain("REFERENCE");
    expect(doc.entities.some((e) => e.layer === "REFERENCE")).toBe(true);
  });

  it("o laser descarta referência e cota mesmo se habilitadas", () => {
    const opts = {
      ...DEFAULT_CNC_OPTIONS,
      profileId: "laser-cnc",
      roles: { CUT: true, RECORTE: true, MARK: true, BEND: true, REFERENCE: true, DIMENSION: true },
    };
    const doc = buildCncDxf(part, opts);
    expect(doc.entities.some((e) => e.layer === "REFERENCE")).toBe(false);
    expect(layerMapping(opts).find((m) => m.role === "REFERENCE")?.layer).toBeNull();
  });
});
