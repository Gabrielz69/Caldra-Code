import type { Entity } from "@/lib/lab2d/core";
import type { CanonicalBox, CanonicalPart, CanonicalProject } from "./types";

const round = (n: number) => Math.round(n * 1000) / 1000;
const uid = (s: string) => `stairs_${s}`;
const rect = (id: string, w: number, h: number, x = 0, y = 0, layer = "corte"): Entity => ({
  id: uid(id),
  layer,
  type: "polyline",
  closed: true,
  pts: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});
const box = (x: number, y: number, z: number, l: number, h: number, w: number): CanonicalBox => ({
  min: { x, y, z },
  max: { x: x + l, y: y + h, z: z + w },
});
const part = (
  p: Omit<CanonicalPart, "entities" | "dimensions"> & {
    length: number;
    width: number;
    height: number;
    entities?: Entity[];
  },
): CanonicalPart => ({
  ...p,
  dimensions: { length: round(p.length), width: round(p.width), height: round(p.height) },
  entities: p.entities ?? [rect(p.key, p.length, p.width)],
});
export const STAIR_DEFAULTS = {
  width: 900,
  height: 2800,
  length: 4200,
  steps: 14,
  treadDepth: 280,
  stringerHeight: 250,
  stringerThickness: 8,
  treadThickness: 4,
  profileWidth: 50,
  handrailHeight: 1100,
  materialDensity: 7850,
};
export function generateStraightStair(raw: Record<string, number>): CanonicalProject {
  const v: Record<string, number> = { ...STAIR_DEFAULTS, ...raw };
  const width = Math.max(500, v["width"] ?? STAIR_DEFAULTS.width),
    height = Math.max(500, v["height"] ?? STAIR_DEFAULTS.height),
    length = Math.max(800, v["length"] ?? STAIR_DEFAULTS.length),
    steps = Math.max(3, Math.round(v["steps"] ?? STAIR_DEFAULTS.steps));
  const rise = height / steps,
    run = length / steps,
    angle = Math.atan2(height, length),
    slope = Math.hypot(height, length);
  const treadDepth = Math.min(
      Math.max(120, v["treadDepth"] ?? STAIR_DEFAULTS.treadDepth),
      run + 80,
    ),
    stringerH = Math.max(80, v["stringerHeight"] ?? STAIR_DEFAULTS.stringerHeight),
    stringerT = Math.max(3, v["stringerThickness"] ?? STAIR_DEFAULTS.stringerThickness);
  const treadT = Math.max(2, v["treadThickness"] ?? STAIR_DEFAULTS.treadThickness),
    profile = Math.max(25, v["profileWidth"] ?? STAIR_DEFAULTS.profileWidth),
    railH = Math.max(700, v["handrailHeight"] ?? STAIR_DEFAULTS.handrailHeight);
  const parts: CanonicalPart[] = [];
  for (const side of [0, 1])
    parts.push(
      part({
        key: `stringer-${side}`,
        codeSuffix: `LON-${side + 1}`,
        name: `Longarina ${side ? "direita" : "esquerda"}`,
        quantity: 1,
        material: "Aço Carbono",
        thickness: stringerT,
        role: "Estrutura principal",
        assemblyKey: "estrutura",
        stage: 1,
        process: "Corte de chapa",
        fabricable: true,
        length: slope,
        width: stringerH,
        height: stringerT,
        box: box(0, 0, side * (width - stringerT), length, height, stringerT),
      }),
    );
  parts.push(
    part({
      key: "tread",
      codeSuffix: "DEG-001",
      name: "Degrau",
      quantity: steps,
      material: "Aço Carbono",
      thickness: treadT,
      role: "Piso",
      assemblyKey: "degraus",
      stage: 2,
      process: "Corte e dobra",
      fabricable: true,
      length: width,
      width: treadDepth,
      height: treadT,
      box: box(run - treadDepth, rise, width / 2 - width / 2, treadDepth, treadT, width),
      entities: [rect("tread", width, treadDepth)],
    }),
  );
  parts.push(
    part({
      key: "crossbar",
      codeSuffix: "TRV-001",
      name: "Travessa",
      quantity: Math.max(2, steps - 1),
      material: "Aço Carbono",
      thickness: profile,
      role: "Travamento",
      assemblyKey: "estrutura",
      stage: 1,
      process: "Serra",
      fabricable: false,
      length: width,
      width: profile,
      height: profile,
      box: box(run, rise - profile, 0, profile, profile, width),
    }),
  );
  parts.push(
    part({
      key: "post",
      codeSuffix: "GCO-001",
      name: "Montante do guarda-corpo",
      quantity: Math.max(2, Math.ceil(length / 1200) + 1),
      material: "Aço Carbono",
      thickness: profile,
      role: "Proteção coletiva",
      assemblyKey: "guarda-corpo",
      subassemblyKey: "corrimao",
      stage: 3,
      process: "Serra e solda",
      fabricable: false,
      length: railH,
      width: profile,
      height: profile,
      box: box(0, 0, width - profile, profile, railH, profile),
    }),
  );
  parts.push(
    part({
      key: "rail",
      codeSuffix: "GCO-002",
      name: "Corrimão",
      quantity: 1,
      material: "Aço Carbono",
      thickness: profile,
      role: "Proteção coletiva",
      assemblyKey: "guarda-corpo",
      subassemblyKey: "corrimao",
      stage: 3,
      process: "Serra e solda",
      fabricable: false,
      length: slope,
      width: profile,
      height: profile,
      box: box(0, railH, width - profile, length, height, profile),
    }),
  );
  parts.push(
    part({
      key: "base",
      codeSuffix: "FIX-001",
      name: "Chapa de fixação",
      quantity: 4,
      material: "Aço Carbono",
      thickness: 8,
      role: "Fixação",
      assemblyKey: "fixacoes",
      stage: 4,
      process: "Corte e furação",
      fabricable: true,
      length: 160,
      width: 120,
      height: 8,
      box: box(0, 0, 0, 160, 8, 120),
      entities: [
        rect("base", 160, 120),
        { id: uid("h1"), layer: "corte", type: "circle", cx: 30, cy: 30, r: 7 },
        { id: uid("h2"), layer: "corte", type: "circle", cx: 130, cy: 30, r: 7 },
        { id: uid("h3"), layer: "corte", type: "circle", cx: 30, cy: 90, r: 7 },
        { id: uid("h4"), layer: "corte", type: "circle", cx: 130, cy: 90, r: 7 },
      ],
    }),
  );
  const drawingEntities: Entity[] = [
    {
      id: uid("floor"),
      layer: "referencia",
      type: "line",
      x1: -200,
      y1: 0,
      x2: length + 300,
      y2: 0,
    },
    { id: uid("slope"), layer: "corte", type: "line", x1: 0, y1: 0, x2: length, y2: height },
  ];
  for (let i = 1; i <= steps; i++) {
    const x = i * run,
      y = i * rise;
    drawingEntities.push(
      { id: uid(`r${i}`), layer: "corte", type: "line", x1: x - run, y1: y, x2: x, y2: y },
      { id: uid(`v${i}`), layer: "corte", type: "line", x1: x, y1: y - rise, x2: x, y2: y },
    );
  }
  const fingerprint = Object.keys(v)
    .sort()
    .map((k) => `${k}:${round(v[k] ?? 0)}`)
    .join("|");
  return {
    modelSlug: "escada-reta",
    modelName: "Escada Reta",
    schemaVersion: 1,
    parameters: {
      ...v,
      width,
      height,
      length,
      steps,
      treadDepth,
      stringerHeight: stringerH,
      stringerThickness: stringerT,
      treadThickness: treadT,
      profileWidth: profile,
      handrailHeight: railH,
    },
    fingerprint,
    bounds: box(0, 0, 0, length, height, width),
    drawing: {
      width: length,
      height: height + railH,
      entities: drawingEntities,
      dimensions: [
        { label: "Largura", value: width, a: { x: 0, y: -180 }, b: { x: width, y: -180 } },
        {
          label: "Altura",
          value: height,
          a: { x: length + 180, y: 0 },
          b: { x: length + 180, y: height },
        },
        { label: "Comprimento", value: length, a: { x: 0, y: -90 }, b: { x: length, y: -90 } },
      ],
    },
    parts,
    assemblies: [
      { key: "estrutura", name: "Estrutura", code: "EST", order: 0 },
      { key: "degraus", name: "Degraus", code: "DEG", order: 1 },
      { key: "guarda-corpo", name: "Guarda-corpo", code: "GCO", order: 2 },
      { key: "fixacoes", name: "Fixações", code: "FIX", order: 3 },
    ],
    subassemblies: [
      { key: "corrimao", assemblyKey: "guarda-corpo", name: "Corrimão", code: "COR", order: 0 },
    ],
    steps: [
      {
        key: "estrutura",
        title: "Montar estrutura",
        detail: "Posicionar longarinas e travessas; conferir esquadro e diagonais.",
        partKeys: ["stringer-0", "stringer-1", "crossbar"],
      },
      {
        key: "degraus",
        title: "Instalar degraus",
        detail: "Distribuir os degraus conforme passo calculado.",
        partKeys: ["tread"],
      },
      {
        key: "guarda-corpo",
        title: "Montar guarda-corpo",
        detail: "Instalar montantes e corrimão após conferência geométrica.",
        partKeys: ["post", "rail"],
      },
      {
        key: "fixacoes",
        title: "Executar fixações",
        detail: "Posicionar chapas e conferir furações antes da instalação.",
        partKeys: ["base"],
      },
    ],
    metrics: [
      { label: "Inclinação", value: round((angle * 180) / Math.PI), unit: "°" },
      { label: "Espelho", value: round(rise), unit: "mm" },
      { label: "Passo horizontal", value: round(run), unit: "mm" },
      { label: "Comprimento inclinado", value: round(slope), unit: "mm" },
      { label: "Componentes", value: parts.reduce((s, p) => s + p.quantity, 0), unit: "un" },
    ],
    warnings: [
      "Geometria de fabricação. Não constitui dimensionamento estrutural, verificação de cargas ou conformidade normativa.",
    ],
  };
}
