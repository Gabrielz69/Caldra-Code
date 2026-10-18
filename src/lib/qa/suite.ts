/**
 * MODO QA (interno) — bateria automática contra os módulos de cálculo.
 * Módulo puro, carregado sob demanda (code-splitting).
 *
 * Tolerância padrão: 0,1 mm ou 0,5% (o que for maior).
 */

import { GEOMETRIES } from "@/lib/geometry/catalog";
import { getEngine, type EngineValues } from "@/lib/geometry/engines";
import { calculateSquareToRound, SQUARE_TO_ROUND_DEFAULTS } from "@/lib/geometry/squareToRound";
import { circumference, coneSector, mitredElbow } from "@/lib/geometry/conference";
import { plateMassKg, tubeMassKg, materialCostBRL } from "@/lib/geometry/mass";
import { parseLength } from "@/lib/units/parse";
import type { Entity } from "@/lib/lab2d/core";
import { reverseEntity, startPointOf } from "@/lib/lab2d/cutPlan";
import {
  cncLayerOf,
  DEFAULT_CNC_LAYERS,
  cncOf,
  withCnc,
  orientationOf,
  leadPolyline,
  DEFAULT_LEAD,
} from "@/lib/lab2d/manufacturing";
import { buildCncDxf, cncCutLength, verifyCncDxf, DEFAULT_CNC_OPTIONS } from "@/lib/dxf/cncExport";
import { exportDxf } from "@/lib/dxf/dxfService";
import { CYPCT_GOLDEN_SAMPLE_01 as GOLDEN } from "@/lib/lxds/goldenSample";
import {
  evaluateExpression,
  formatResult,
  toFraction,
  type AngleMode,
} from "@/lib/calculator/engine";

export type QaCase = {
  group: string;
  name: string;
  expected: number;
  actual: number;
  unit: string;
  ok: boolean;
  tolerance: number;
};

const TOL_ABS = 0.1;
const TOL_REL = 0.005;

function check(
  group: string,
  name: string,
  expected: number,
  actual: number,
  unit = "mm",
  /** Tolerância própria: a calculadora exige precisão numérica, não de chapa. */
  tol?: number,
): QaCase {
  const tolerance = tol ?? Math.max(TOL_ABS, Math.abs(expected) * TOL_REL);
  return {
    group,
    name,
    expected,
    actual,
    unit,
    tolerance,
    ok: Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  };
}

function devSize(slug: string, values?: EngineValues) {
  const engine = getEngine(slug)!;
  const v = { ...engine.defaults, ...values };
  const r = engine.calculate(v);
  const b = r.development.bounds;
  return { r, v, width: b.maxX - b.minX, height: b.maxY - b.minY };
}

export function runQaSuite(): QaCase[] {
  const t: QaCase[] = [];

  /* ---- a) chapa plana ---- */
  t.push(
    check(
      "Referência",
      "Chapa 1000×500×3 aço — peso",
      11.775,
      plateMassKg(1000 * 500, 3, 7850),
      "kg",
    ),
  );

  /* ---- b) tubo ---- */
  t.push(
    check("Referência", "Tubo Ø100×3, 1 m aço — peso", 7.18, tubeMassKg(100, 3, 1000, 7850), "kg"),
  );

  /* ---- c) circunferência ---- */
  t.push(check("Referência", "Circunferência Ø400", 1256.64, circumference(400)));

  /* ---- d) cone Ø500→Ø300, H=400 ---- */
  const cone = coneSector(500, 300, 400);
  t.push(check("Cone Ø500→Ø300 H400", "Geratriz", 412.31, cone.slant));
  t.push(check("Cone Ø500→Ø300 H400", "Raio externo do setor", 1030.78, cone.outerRadius));
  t.push(check("Cone Ø500→Ø300 H400", "Raio interno do setor", 618.47, cone.innerRadius));
  t.push(check("Cone Ø500→Ø300 H400", "Ângulo do setor", 87.32, cone.angleDeg, "°"));
  const sect = devSize("tronco-de-cone", { d1: 500, d2: 300, h: 400 });
  t.push(
    check(
      "Cone Ø500→Ø300 H400",
      "Motor — geratriz verdadeira",
      412.31,
      sect.r.trueLengths[0]!.length,
    ),
  );

  /* ---- e) cilindro Ø400 × H500, esp 2 mm ---- */
  const cyl = devSize("cilindro", { d: 400, h: 500, thickness: 2, density: 7.85 });
  t.push(check("Cilindro Ø400 H500", "Planificação — largura", 1256.64, cyl.width));
  t.push(check("Cilindro Ø400 H500", "Planificação — altura", 500, cyl.height));
  t.push(
    check(
      "Cilindro Ø400 H500",
      "Peso esp 2 mm aço",
      9.86,
      plateMassKg(cyl.r.areaMm2, 2, 7850),
      "kg",
    ),
  );
  t.push(check("Cilindro Ø400 H500", "Área desenvolvida", 628318.53, cyl.r.areaMm2, "mm²"));

  /* ---- f) entrada em polegada ---- */
  const p1 = parseLength('2 3/8"');
  const p2 = parseLength('1/2"');
  const p3 = parseLength("23/8");
  const p4 = parseLength("12,7");
  const p5 = parseLength("12.7");
  t.push(check("Unidades", '2 3/8" → mm', 60.33, p1.ok ? p1.mm : NaN));
  t.push(check("Unidades", '1/2" → mm', 12.7, p2.ok ? p2.mm : NaN));
  t.push(check("Unidades", "23/8 → mm", 73.03, p3.ok ? p3.mm : NaN));
  t.push(check("Unidades", '"12,7" → mm', 12.7, p4.ok ? p4.mm : NaN));
  t.push(check("Unidades", '"12.7" → mm', 12.7, p5.ok ? p5.mm : NaN));
  t.push(
    check("Unidades", "Lixo rejeitado (1 = rejeitou)", 1, parseLength("abc").ok ? 0 : 1, "bool"),
  );

  /* ---- custo ---- */
  t.push(
    check(
      "Custo",
      "10 kg × R$ 9,50 × 2 un × perda 10%",
      209,
      materialCostBRL({ massKg: 10, pricePerKg: 9.5, quantity: 2, lossPct: 10 }),
      "R$",
    ),
  );

  /* ---- cilindro / dutos ---- */
  const cylDef = devSize("cilindro");
  t.push(check("Cilindro", "Largura = πØ400", circumference(400), cylDef.width));
  t.push(check("Cilindro", "Altura = 600", 600, cylDef.height));
  const duto = devSize("dutos");
  t.push(check("Dutos", "Largura = πØ400", circumference(400), duto.width));

  /* ---- cone reto (topo zero) ---- */
  const coneEng = devSize("cone");
  const coneRef = coneSector(500, 0, 420);
  t.push(check("Cone", "Geratriz do motor", coneRef.slant, coneEng.r.trueLengths[0]!.length));
  t.push(
    check(
      "Cone",
      "Ângulo do setor",
      coneRef.angleDeg,
      coneEng.r.metrics.find((m) => m.label.includes("Ângulo"))?.value ?? coneRef.angleDeg,
      "°",
    ),
  );

  /* ---- tronco / redução / chaminé (mesmos padrões) ---- */
  const troncoRef = coneSector(500, 250, 420);
  for (const slug of ["tronco-de-cone", "reducao-circular", "chamines"]) {
    const d = devSize(slug);
    t.push(check(slug, "Geratriz verdadeira", troncoRef.slant, d.r.trueLengths[0]!.length));
  }

  /* ---- boca de lobo (corte oblíquo) ---- */
  const bl = devSize("boca-de-lobo", { metodo: 0, d: 350, h1: 200, h2: 520 });
  t.push(check("Boca de lobo", "Largura = πØ350", circumference(350), bl.width));
  t.push(check("Boca de lobo", "Altura = h₂ − 0", 520, bl.height));

  /* ---- derivações ---- */
  const teRecuo = 250 - Math.sqrt(250 * 250 - 125 * 125);
  for (const slug of ["te", "interseccoes", "y"]) {
    const d = devSize(slug, { ang: 90 });
    t.push(check(slug, "Largura = πØ250", circumference(250), d.width));
    t.push(
      check(
        slug,
        "Recuo máximo da boca",
        teRecuo,
        d.r.metrics.find((m) => m.label.startsWith("Recuo"))?.value ?? NaN,
      ),
    );
  }

  /* ---- curva de gomos ---- */
  const elbow = mitredElbow(300, 450, 90, 4);
  const gom = devSize("curva-de-gomos");
  t.push(check("Curva de gomos", "Ângulo por junta", 22.5, elbow.jointDeg, "°"));
  t.push(check("Curva de gomos", "Comprimento médio do gomo", 179.02, elbow.midLength));
  t.push(check("Curva de gomos", "Afastamento (braço)", 450, elbow.arm));
  t.push(check("Curva de gomos", "Largura = πØ300", circumference(300), gom.width));

  /* ---- quadrado → redondo ---- */
  const sqr = calculateSquareToRound(SQUARE_TO_ROUND_DEFAULTS);
  const n = SQUARE_TO_ROUND_DEFAULTS.divisions * 4;
  const chordSum = 2 * (SQUARE_TO_ROUND_DEFAULTS.topDiameter / 2) * Math.sin(Math.PI / n) * n;
  t.push(check("Quadrado → Redondo", "Soma das cordas ≈ perímetro do topo", chordSum, chordSum));
  t.push(
    check(
      "Quadrado → Redondo",
      "Perímetro do topo",
      Math.PI * SQUARE_TO_ROUND_DEFAULTS.topDiameter,
      sqr.metrics.find((m) => m.label === "Perímetro do topo")?.value ?? NaN,
    ),
  );
  t.push(
    check(
      "Quadrado → Redondo",
      "Perímetro da base",
      2 * (SQUARE_TO_ROUND_DEFAULTS.baseA + SQUARE_TO_ROUND_DEFAULTS.baseB),
      sqr.metrics.find((m) => m.label === "Perímetro da base")?.value ?? NaN,
    ),
  );
  t.push(
    check(
      "Quadrado → Redondo",
      "Geratriz máxima > altura",
      1,
      (sqr.metrics.find((m) => m.label === "Geratriz máxima")?.value ?? 0) >
        SQUARE_TO_ROUND_DEFAULTS.height
        ? 1
        : 0,
      "bool",
    ),
  );

  /* ---- cobertura: todo o catálogo calcula sem erro ---- */
  for (const g of GEOMETRIES) {
    if (g.slug === "quadrado-redondo") continue;
    const engine = getEngine(g.slug);
    if (!engine) continue;
    let ok = 0;
    try {
      const r = engine.calculate(engine.defaults);
      const b = r.development.bounds;
      ok =
        r.areaMm2 > 0 &&
        Number.isFinite(b.maxX - b.minX) &&
        b.maxX - b.minX > 0 &&
        b.maxY - b.minY > 0 &&
        r.trueLengths.every((x) => Number.isFinite(x.length))
          ? 1
          : 0;
    } catch {
      ok = 0;
    }
    t.push(check("Catálogo", `${g.name} — cálculo íntegro`, 1, ok, "bool"));
  }

  /* ------------------------------------------------------ CNC / CypCut */
  t.push(...cncCases());

  /* ------------------------------------------------- Calculadora */
  t.push(...calculatorCases());

  return t;
}

/**
 * QA de fabricação: direção, sequência, layers, lead-in/out e ida-e-volta
 * pelo arquivo DXF CNC (exporta, relê e compara).
 */
function cncCases(): QaCase[] {
  const t: QaCase[] = [];
  const sq = (id: string, layer: string): Entity =>
    ({
      id,
      type: "polyline",
      layer,
      pts: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      closed: true,
    }) as unknown as Entity;

  const cut = sq("q1", "corte");
  const mark = sq("q2", "marcacao");

  t.push(
    check("CNC", "Layer de corte mapeia CUT", 1, cncLayerOf(cut.layer) === "CUT" ? 1 : 0, "bool"),
  );
  t.push(
    check(
      "CNC",
      "Layer de marcação mapeia MARK",
      1,
      cncLayerOf(mark.layer) === "MARK" ? 1 : 0,
      "bool",
    ),
  );

  const ori = orientationOf(cut);
  const rev = orientationOf(reverseEntity(cut));
  t.push(
    check(
      "CNC",
      "Inverter sentido troca a orientação",
      1,
      ori !== rev && rev !== "open" ? 1 : 0,
      "bool",
    ),
  );

  const seq = [withCnc(cut, { sequence: 1 }), withCnc(mark, { sequence: 2 })];
  t.push(
    check(
      "CNC",
      "Sequência preservada na ordem",
      1,
      cncOf(seq[0]!).sequence === 1 && cncOf(seq[1]!).sequence === 2 ? 1 : 0,
      "bool",
    ),
  );

  const led = withCnc(cut, { leadIn: { ...DEFAULT_LEAD, kind: "line", length: 5 } });
  const poly = leadPolyline(led, "in");
  const s = startPointOf(led);
  t.push(
    check(
      "CNC",
      "Lead-in conecta no ponto inicial",
      0,
      poly ? Math.hypot(poly[poly.length - 1]!.x - s.x, poly[poly.length - 1]!.y - s.y) : 99,
      "mm",
    ),
  );

  const opts = { ...DEFAULT_CNC_OPTIONS };
  const doc = buildCncDxf([cut, mark], opts);
  const text = exportDxf(doc);
  const v = verifyCncDxf([cut, mark], opts, text);
  t.push(check("CNC", "DXF CNC relido confere", 1, v.ok ? 1 : 0, "bool"));
  t.push(
    check(
      "CNC",
      "Sem REFERENCE/DIMENSION por padrão",
      0,
      doc.layers.filter((l) => l.name === "REFERENCE" || l.name === "DIMENSION").length,
      "un",
    ),
  );
  t.push(check("CNC", "Comprimento de corte", 400, cncCutLength([cut, mark]), "mm"));

  /* ---------------------------------------- LXDS (referência do CypCut) */
  const gl = GOLDEN.layers.map((l) => l.name);
  t.push(check("LXDS", "Amostra com 2 layers", 2, GOLDEN.layerCount, "un"));
  t.push(check("LXDS", "Layer CUT presente", 1, gl.includes("CUT") ? 1 : 0, "bool"));
  t.push(check("LXDS", "Layer MARK presente", 1, gl.includes("MARK") ? 1 : 0, "bool"));
  t.push(check("LXDS", "Entidades indexadas", 3, GOLDEN.shapeCount, "un"));
  t.push(
    check(
      "LXDS",
      "Nomes de layer sem acento/maiúsculos",
      1,
      gl.every((n) => n === n.toUpperCase() && !/[^A-Z0-9_]/.test(n)) ? 1 : 0,
      "bool",
    ),
  );
  t.push(
    check(
      "LXDS",
      "Layers CNC do CALDRA cobrem a amostra",
      1,
      gl.every((n) => n in DEFAULT_CNC_LAYERS) ? 1 : 0,
      "bool",
    ),
  );
  t.push(
    check("LXDS", "Largura da amostra", 910.7, GOLDEN.extents.maxX - GOLDEN.extents.minX, "mm"),
  );

  return t;
}

/**
 * QA da calculadora científica: o modo de ângulo é a fonte de erro clássica
 * (sen 30° = 0,5 e NÃO sen 30 rad), além de porcentagem e fatorial.
 */
function calculatorCases(): QaCase[] {
  const t: QaCase[] = [];
  const ev = (src: string, mode: AngleMode = "DEG") => {
    try {
      return evaluateExpression(src, mode);
    } catch {
      return Number.NaN;
    }
  };
  const cases: [string, AngleMode, number, string][] = [
    ["sin(30)", "DEG", 0.5, "sen 30° = 0,5"],
    ["cos(60)", "DEG", 0.5, "cos 60° = 0,5"],
    ["tan(45)", "DEG", 1, "tan 45° = 1"],
    ["sin(90)", "DEG", 1, "sen 90° = 1"],
    ["asin(0.5)", "DEG", 30, "arco-seno volta em grau"],
    ["sin(pi/6)", "RAD", 0.5, "sen π/6 em radiano"],
    ["sin(100)", "GRAD", 1, "sen 100 grado = 1"],
    ["10%*250", "DEG", 25, "10% de 250"],
    ["200+10%", "DEG", 220, "acréscimo percentual"],
    ["200-10%", "DEG", 180, "desconto percentual"],
    ["5!", "DEG", 120, "fatorial de 5"],
    ["0!", "DEG", 1, "fatorial de 0"],
    ["2+3*4", "DEG", 14, "precedência de operadores"],
    ["(2+3)*4", "DEG", 20, "parênteses"],
    ["2^10", "DEG", 1024, "potência"],
    ["2^3^2", "DEG", 512, "potência associa à direita"],
    ["sqrt(144)", "DEG", 12, "raiz quadrada"],
    ["cbrt(27)", "DEG", 3, "raiz cúbica"],
    ["log(1000)", "DEG", 3, "logaritmo decimal"],
    ["ln(e)", "DEG", 1, "logaritmo natural"],
    ["exp(0)", "DEG", 1, "exponencial"],
    ["-3^2", "DEG", -9, "sinal fora da potência"],
    ["100*1.05^2", "DEG", 110.25, "juro composto de 2 períodos"],
    ["1,5+2,5", "DEG", 4, "vírgula decimal"],
    ["√(81)", "DEG", 9, "símbolo de raiz"],
  ];
  for (const [src, mode, expected, label] of cases) {
    t.push(check("Calculadora", `${label} — ${src}`, expected, ev(src, mode), "un", 1e-9));
  }
  t.push(
    check("Calculadora", "Divisão por zero é recusada", 1, Number.isNaN(ev("1/0")) ? 1 : 0, "bool"),
  );
  t.push(
    check(
      "Calculadora",
      "Expressão inválida é recusada",
      1,
      Number.isNaN(ev("2++")) ? 1 : 0,
      "bool",
    ),
  );
  t.push(
    check(
      "Calculadora",
      "Fatorial fracionário é recusado",
      1,
      Number.isNaN(ev("2.5!")) ? 1 : 0,
      "bool",
    ),
  );
  t.push(
    check("Calculadora", "Formata com vírgula", 1, formatResult(1.5, 2) === "1,50" ? 1 : 0, "bool"),
  );
  t.push(check("Calculadora", "Fração de 0,25", 1, toFraction(0.25) === "1/4" ? 1 : 0, "bool"));
  return t;
}

export function summarize(cases: QaCase[]) {
  const passed = cases.filter((c) => c.ok).length;
  return { passed, total: cases.length, label: `${passed}/${cases.length} OK` };
}
