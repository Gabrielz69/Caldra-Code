import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  PenTool,
} from "lucide-react";
import {
  SQUARE_TO_ROUND_DEFAULTS,
  calculateSquareToRound,
  validateSquareToRound,
  type SquareToRoundInput,
} from "@/lib/geometry/squareToRound";
import { downloadDxf, type DxfEntity } from "@/lib/dxf/dxfService";
import { TechnicalSheetDialog } from "@/components/caldra/TechnicalSheetDialog";
import { downloadTracagemPng } from "@/lib/export/tracagemSheet";
import { MATERIALS } from "@/lib/projects/demo-data";
import { formatNumber, useSettings } from "@/lib/settings/SettingsProvider";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { buildWire } from "@/lib/viz3d/wire";
import { edgeRefAt, faceRefAt } from "@/lib/viz3d/selection";
import type { GeometryRef } from "@/lib/geometry/refs";
import { developmentToEntities, piecesToEntities, sendToLab2D } from "@/lib/lab2d/handoff";
import { cn } from "@/lib/utils";
import { VisualizationViewport, type VisualizationMode } from "./View3DPanel";
import { DevelopmentView } from "./DevelopmentView";
import { TracagemPanel } from "./TracagemPanel";
import { SchematicSquareToRound } from "./SchematicSquareToRound";
import { Metric, Panel, SectionLabel } from "./ui";
import { StageBar } from "./StageBar";
import { saveCustom, updateCustom } from "@/lib/library/store";
import { Save } from "lucide-react";

type FieldKey = keyof SquareToRoundInput;

const FIELDS: { key: FieldKey; label: string; tag: string; step?: number }[] = [
  { key: "baseA", label: "Lado A da base", tag: "A" },
  { key: "baseB", label: "Lado B da base", tag: "B" },
  { key: "topDiameter", label: "Diâmetro do topo", tag: "ØD" },
  { key: "height", label: "Altura vertical", tag: "H" },
  { key: "offsetX", label: "Excentricidade X", tag: "ex" },
  { key: "offsetY", label: "Excentricidade Y", tag: "ey" },
];

const TABS = [
  "Dimensões",
  "Cálculos",
  "Traçado",
  "Traçagem",
  "Desenvolvimento",
  "Material",
  "Exportação",
] as const;
type Tab = (typeof TABS)[number];

/** Resultados em três grupos: cada grupo é uma aba com suas etapas. */
const RESULT_GROUPS = [
  { id: "Geometria", tabs: ["Dimensões", "Cálculos"] },
  { id: "Planificação", tabs: ["Traçado", "Traçagem", "Desenvolvimento"] },
  { id: "Fabricação", tabs: ["Material", "Exportação"] },
] as const satisfies readonly { id: string; tabs: readonly Tab[] }[];

type ResultGroup = (typeof RESULT_GROUPS)[number]["id"];

function groupOf(tab: Tab): ResultGroup {
  return RESULT_GROUPS.find((g) => (g.tabs as readonly string[]).includes(tab))?.id ?? "Geometria";
}

export function SquareToRoundStudio({
  initialValues,
  customId,
  customName,
}: {
  initialValues?: Record<string, number> | undefined;
  customId?: string | undefined;
  customName?: string | undefined;
}) {
  const { can, requirePro } = useFeatureAccess();
  const { precision } = useSettings();
  const [input, setInput] = useState<SquareToRoundInput>(() => ({
    ...SQUARE_TO_ROUND_DEFAULTS,
    ...(initialValues ?? {}),
    strategy: initialValues?.["strategy"] === 1 ? "two-weld" : SQUARE_TO_ROUND_DEFAULTS.strategy,
  }));
  const [material, setMaterial] = useState(MATERIALS[0]!.name);
  const [focused, setFocused] = useState<FieldKey | null>(null);
  const [pulse, setPulse] = useState<FieldKey | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const pulseTimer = useRef<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [tab, setTab] = useState<Tab>("Dimensões");
  /* Fluxo em duas telas: modelo (medidas) → resultados. */
  const [stage, setStage] = useState<"modelo" | "resultados">("modelo");
  const group = groupOf(tab);

  /* 3D é camada da área de resultado, não etapa do fluxo. */
  const [viewMode, setViewMode] = useState<VisualizationMode>("2d");
  const [explain, setExplain] = useState(false);
  const [unfold, setUnfold] = useState(0);
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const issues = useMemo(() => validateSquareToRound(input), [input]);
  const result = useMemo(() => {
    if (issues.length) return null;
    try {
      return calculateSquareToRound(input);
    } catch {
      return null;
    }
  }, [input, issues]);
  const wireModel = useMemo(
    () =>
      buildWire("quadrado-redondo", {
        d1: Math.max(input.baseA, input.baseB),
        d2: input.topDiameter,
        h: input.height,
        e: input.offsetX,
        t: input.thickness,
        seg: input.divisions * 4,
        baseA: input.baseA,
        baseB: input.baseB,
        offsetY: input.offsetY,
        divisions: input.divisions,
        strategy: input.strategy,
      }),
    [input],
  );

  /* Seleção 3D ↔ ref canônica (Fase F): geratrizes da malha facetada. */
  const [selRef, setSelRef] = useState<GeometryRef | null>(null);
  const [showGeneratrices, setShowGeneratrices] = useState(true);
  const foldCount = result?.development.foldLines.length ?? 0;
  const refForEdge = useMemo(
    () => (index: number) => edgeRefAt(wireModel, foldCount, index),
    [wireModel, foldCount],
  );
  const refForFace = useMemo(
    () => (index: number) => faceRefAt(wireModel, foldCount, index),
    [wireModel, foldCount],
  );

  const set = (key: FieldKey, raw: string) => {
    const value = raw === "" || raw === "-" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(value)) return;
    setInput((prev) => ({ ...prev, [key]: value }));
    setPulse(key);
    setCalculating(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => {
      setPulse(null);
      setCalculating(false);
    }, 340);
  };

  const issueFor = (key: FieldKey) => issues.find((i) => i.field === key)?.message;

  const exportPng = async () => {
    if (!result) return;
    await downloadTracagemPng(result, {
      project: "CALDRA",
      plan: input.strategy === "two-weld" ? "Quadrado Redondo 2 partes" : "Quadrado Redondo",
      material,
      thickness: `${input.thickness} mm`,
      quantity: input.strategy === "two-weld" ? "2" : "1",
    });
    toast.success("PNG exportado.");
  };

  const [showTechnicalSheet, setShowTechnicalSheet] = useState(false);

  const exportPdf = () => {
    if (!result) return;
    setShowTechnicalSheet(true);
  };

  const exportDxfFile = () => {
    if (!result) return;
    const parts = result.pieces?.length
      ? result.pieces
      : [{ code: "QR", development: result.development }];
    const entities: DxfEntity[] = [];
    let cursor = 0;
    for (const part of parts) {
      const b = part.development.bounds;
      const dx = cursor - b.minX;
      entities.push({
        type: "LWPOLYLINE",
        layer: "CORTE",
        closed: true,
        points: part.development.outline.map((p) => ({ x: p.x + dx, y: p.y })),
      });
      for (const s of part.development.foldLines)
        entities.push({
          type: "LINE",
          layer: "DOBRA",
          start: { x: s.a.x + dx, y: s.a.y },
          end: { x: s.b.x + dx, y: s.b.y },
        });
      cursor += b.maxX - b.minX + 40;
    }
    downloadDxf(
      {
        layers: [
          { name: "CORTE", color: 1 },
          { name: "DOBRA", color: 3 },
        ],
        entities,
      },
      "chameleon-quadrado-redondo",
    );
    toast.success("DXF exportado.");
  };

  return (
    <div className="space-y-4">
      {/* MEDIDAS */}
      {stage === "modelo" && (
        <Panel className="p-3.5 lg:p-5" glow>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <VisualizationViewport
              mode={viewMode}
              onModeChange={setViewMode}
              model={wireModel}
              unfold={unfold}
              onUnfold={setUnfold}
              selection={{ refForEdge, refForFace, highlightRef: selRef, onSelectRef: setSelRef }}
              showGeneratrices={showGeneratrices}
              onToggleGeneratrices={() => setShowGeneratrices((v) => !v)}
              onPlanificar={() => {
                setUnfold(1);
                window.setTimeout(() => {
                  setViewMode("2d");
                  setTab("Desenvolvimento");
                  setStage("resultados");
                }, 420);
              }}
            >
              <SchematicSquareToRound
                input={input}
                highlight={focused}
                showGeneratrices={showGeneratrices}
                selectedRef={selRef}
                onSelectRef={setSelRef}
              />
              <span className="pointer-events-none absolute top-2 left-2.5 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
                Vista 2D · mm
              </span>
            </VisualizationViewport>

            <div>
              <SectionLabel>Medidas</SectionLabel>
              <p className="mb-3 text-xs text-muted-foreground">
                Defina as dimensões da peça. O desenho acompanha cada alteração.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {FIELDS.map((f) => {
                  const err = issueFor(f.key);
                  return (
                    <label key={f.key} className="block">
                      <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                        <span className="truncate">{f.label}</span>
                        <span className="text-accent/80">{f.tag}</span>
                      </span>
                      <span
                        className={cn(
                          "flex items-center overflow-hidden rounded-lg border bg-background/50 transition-colors",
                          err ? "border-destructive" : "border-line focus-within:border-accent",
                        )}
                      >
                        <input
                          ref={(el) => {
                            inputs.current[f.key] = el;
                          }}
                          inputMode="decimal"
                          value={String(input[f.key])}
                          onChange={(e) => set(f.key, e.target.value)}
                          onFocus={() => setFocused(f.key)}
                          onBlur={() => setFocused(null)}
                          className="w-full min-w-0 bg-transparent px-2.5 py-2.5 font-mono text-[15px] outline-none"
                        />
                        <span className="border-l border-line px-2 font-mono text-[10px] text-muted-foreground">
                          mm
                        </span>
                      </span>
                      {err && (
                        <span className="mt-1 block text-[10px] text-destructive">{err}</span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* MÉTODO */}
              <div className="mt-3 rounded-xl border border-line bg-background/40 p-3">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Método
                </p>
                <p className="mt-1 text-sm">Triangulação · comprimentos verdadeiros</p>
                <label className="mt-2 flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Divisões por quadrante
                  </span>
                  <input
                    type="range"
                    min={3}
                    max={24}
                    value={input.divisions}
                    onChange={(e) => set("divisions", e.target.value)}
                    className="h-1 flex-1 accent-[var(--accent)]"
                  />
                  <span className="w-8 text-right font-mono text-xs">{input.divisions}</span>
                </label>

                {/* ESTRATÉGIA DE FABRICAÇÃO — mesmo modelo, decomposição diferente */}
                <div className="mt-3 border-t border-line pt-3">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Estratégia de fabricação
                  </span>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: "single", label: "Uma peça única" },
                        { id: "two-weld", label: "2 partes + solda" },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setInput((p) => ({ ...p, strategy: s.id }))}
                        className={cn(
                          "rounded-lg border px-2 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors",
                          input.strategy === s.id
                            ? "border-accent/40 bg-accent/12 text-accent"
                            : "border-line text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {input.strategy === "two-weld" && result?.joints && (
                    <div className="mt-2 space-y-1 rounded-lg border border-line bg-background/60 p-2">
                      {result.joints.map((j) => (
                        <p key={j.id} className="font-mono text-[10px] text-muted-foreground">
                          <span className="text-accent">{j.id}</span> · {j.position}
                        </p>
                      ))}
                      <p className="font-mono text-[9px] text-muted-foreground/70">
                        A geometria final do conjunto é idêntica nos dois modos — muda apenas a
                        decomposição da chapa.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <p
                className={cn(
                  "mt-3 text-center font-mono text-[11px] tracking-[0.16em] uppercase transition-colors",
                  calculating ? "text-muted-foreground" : "text-accent",
                )}
              >
                {issues.length
                  ? issues[0]!.message
                  : calculating
                    ? "Calculando…"
                    : "Pronto · atualização em tempo real"}
              </p>
            </div>
          </div>

          {/* AVANÇAR — leva para a tela de Resultados */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!result}
              onClick={() => setStage("resultados")}
              className={cn(
                "brand-gradient flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-[13px] font-semibold text-background transition-opacity",
                !result && "pointer-events-none opacity-40",
              )}
            >
              Avançar <ChevronRight className="size-4" />
            </button>
          </div>
        </Panel>
      )}

      {/* RESULTADOS */}
      {stage === "resultados" && result && (
        <Panel className="fade-up p-3.5 lg:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Resultados</SectionLabel>
            <span className="flex items-center gap-1 font-mono text-[10px] text-accent">
              <Check className="size-3" /> Desenvolvimento calculado
            </span>
          </div>

          <button
            type="button"
            onClick={() => setStage("modelo")}
            className="mb-3 flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-3 rotate-180" /> Voltar ao modelo
          </button>

          {/* GRUPOS */}
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {RESULT_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={group === g.id}
                onClick={() => setTab(g.tabs[0]!)}
                className={cn(
                  "rounded-lg border px-2 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  group === g.id
                    ? "border-accent/50 bg-accent/12 text-accent"
                    : "border-line text-muted-foreground hover:text-foreground",
                )}
              >
                {g.id}
              </button>
            ))}
          </div>

          <StageBar tab={tab} tabs={TABS} onJump={(t) => setTab(t as Tab)} />

          <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
            {RESULT_GROUPS.find((g) => g.id === group)!.tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  tab === t
                    ? "bg-accent/12 text-accent ring-1 ring-accent/20"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="fade-up">
            {tab === "Dimensões" && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {result.metrics.map((m) => (
                  <Metric
                    key={m.label}
                    label={m.label}
                    value={m.value}
                    suffix={m.suffix ?? "mm"}
                    precision={m.suffix === "un" ? 0 : precision}
                  />
                ))}
              </div>
            )}

            {tab === "Cálculos" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-line bg-background/40 p-3">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase">Método</p>
                  <p className="mt-1 text-sm">{result.method}</p>
                </div>
                <div className="max-h-64 overflow-auto rounded-xl border border-line">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-muted-foreground">
                        <th className="px-3 py-2 font-normal">Geratriz</th>
                        <th className="px-3 py-2 text-right font-normal">
                          Comprimento verdadeiro (mm)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trueLengths.map((t) => (
                        <tr key={t.id} className="border-t border-line">
                          <td className="px-3 py-1.5">{t.id}</td>
                          <td className="px-3 py-1.5 text-right">
                            {formatNumber(t.length, precision)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.warnings.map((w) => (
                  <p key={w} className="text-[11px] text-warn">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {tab === "Traçagem" && <TracagemPanel slug="quadrado-redondo" result={result} />}

            {(tab === "Traçado" || tab === "Desenvolvimento") && result.pieces?.length && (
              <div className={cn("grid gap-3", result.pieces.length > 1 && "lg:grid-cols-2")}>
                {result.pieces.map((piece, i) => (
                  <div
                    key={piece.code}
                    className="grid-bg-fine relative rounded-xl border border-line bg-background/40 p-3"
                  >
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10px] tracking-wider text-accent uppercase">
                        {piece.code}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {piece.name}
                      </span>
                    </div>
                    <div className="h-[280px] lg:h-[380px]">
                      <DevelopmentView
                        ref={i === 0 ? svgRef : undefined}
                        pattern={piece.development}
                        showFolds={tab === "Traçado"}
                        showPoints={tab === "Traçado"}
                      />
                    </div>
                  </div>
                ))}
                <p className="font-mono text-[10px] text-muted-foreground lg:col-span-2">
                  {tab === "Traçado"
                    ? "Cada metade é traçada separadamente; as costuras J1/J2 unem as peças na montagem."
                    : "Contornos de corte das duas metades prontos para nesting. Escala real em milímetros."}
                </p>
              </div>
            )}

            {(tab === "Traçado" || tab === "Desenvolvimento") && !result.pieces?.length && (
              <div className="grid-bg-fine relative rounded-xl border border-line bg-background/40 p-3">
                <div className="h-[300px] lg:h-[420px]">
                  <DevelopmentView
                    ref={svgRef}
                    pattern={result.development}
                    showFolds={tab === "Traçado"}
                    showPoints={tab === "Traçado"}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {tab === "Traçado"
                    ? "Linhas de corte (contorno) · geratrizes tracejadas · pontos V0–V3 da base."
                    : "Contorno de corte pronto para nesting. Escala real em milímetros."}
                </p>
              </div>
            )}

            {tab === "Material" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    Material
                  </span>
                  <select
                    value={material}
                    onChange={(e) => {
                      const m = MATERIALS.find((x) => x.name === e.target.value)!;
                      setMaterial(m.name);
                      setInput((p) => ({ ...p, density: m.density }));
                    }}
                    className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    Espessura (mm)
                  </span>
                  <input
                    inputMode="decimal"
                    value={String(input.thickness)}
                    onChange={(e) => set("thickness", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
                  />
                </label>
                <Metric
                  label="Área desenvolvida"
                  value={result.areaMm2 / 1_000_000}
                  suffix="m²"
                  precision={4}
                />
                <Metric
                  label="Massa estimada"
                  value={(result.areaMm2 * input.thickness * input.density) / 1_000_000_000}
                  suffix="kg"
                  precision={precision}
                />
              </div>
            )}

            {tab === "Exportação" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={exportPng}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 py-2.5 font-mono text-[11px] transition-colors hover:bg-secondary"
                  >
                    <ImageIcon className="size-3.5" /> PNG
                  </button>
                  <button
                    onClick={() => requirePro("export.pdf") && exportPdf()}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border py-2.5 font-mono text-[11px] transition-colors",
                      can("export.pdf")
                        ? "border-border bg-secondary/40 hover:bg-secondary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <FileText className="size-3.5" /> PDF
                  </button>
                  <button
                    onClick={() => requirePro("export.dxf") && exportDxfFile()}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border py-2.5 font-mono text-[11px] transition-colors",
                      can("export.dxf")
                        ? "border-accent/25 bg-accent/10 text-accent"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <Download className="size-3.5" /> DXF
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (!requirePro("lab2d")) return;

                    sendToLab2D({
                      name: result.pieces?.length
                        ? "Quadrado → Redondo · 2 partes + solda"
                        : "Quadrado → Redondo",
                      entities: result.pieces?.length
                        ? piecesToEntities(result.pieces)
                        : developmentToEntities(result.development),
                    });
                    navigate({ to: "/desenho-2d" });
                  }}
                  className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-display text-[13px] font-semibold text-background"
                >
                  <PenTool className="size-4" /> Levar para Máquina a Laser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const values = {
                      ...input,
                      strategy: input.strategy === "two-weld" ? 1 : 0,
                    } as unknown as Record<string, number>;
                    const chosenName = window
                      .prompt("Nome do modelo", customName ?? "Meu Quadrado → Redondo")
                      ?.trim();
                    if (!chosenName) return;
                    if (customId) updateCustom(customId, { name: chosenName, values });
                    else
                      saveCustom({
                        baseId: "cald.quadrado-redondo",
                        name: chosenName,
                        values,
                        modelFamily: "parametric",
                        manufacturingStrategy: input.strategy,
                      });
                    toast.success(customId ? "Modelo atualizado" : "Salvo em Meus Modelos");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"
                >
                  <Save className="size-3.5" />{" "}
                  {customId ? "Atualizar modelo" : "Salvar em Meus Modelos"}
                </button>
                <div className="hidden">
                  <DevelopmentView ref={svgRef} pattern={result.development} />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  PNG em alta resolução · PDF com folha técnica · DXF em milímetros com camadas
                  CORTE e DOBRA.
                </p>
              </div>
            )}
          </div>

          {/* ENTENDER O CÁLCULO */}
          <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.04] p-3">
            <button
              onClick={() =>
                can("calc.explanation")
                  ? setExplain((v) => !v)
                  : toast.error("Explicação passo a passo disponível no Modo Mestre.")
              }
              className="flex w-full items-center gap-2 text-left"
            >
              <Lightbulb className="size-4 shrink-0 text-accent" />
              <span className="font-mono text-[10px] tracking-wider text-accent uppercase">
                Entender o cálculo
              </span>
              <ChevronRight
                className={cn(
                  "ml-auto size-4 text-accent transition-transform",
                  explain && "rotate-90",
                )}
              />
            </button>
            {explain && can("calc.explanation") && (
              <div className="fade-up mt-3 space-y-3">
                {result.steps.map((s) => (
                  <div key={s.title} className="rounded-lg border border-line bg-background/40 p-3">
                    <p className="text-[12px] font-medium">{s.title}</p>
                    <div className="mt-2 space-y-1 font-mono text-[11px]">
                      <Row k="Dado" v={s.given} />
                      <Row k="Fórmula" v={s.formula} />
                      <Row k="Subst." v={s.substitution} muted />
                      <Row k="Resultado" v={s.result} accent />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{s.meaning}</p>
                  </div>
                ))}
              </div>
            )}
            {!can("calc.explanation") && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No Modo Mestre, cada medida é explicada passo a passo: dado, fórmula, substituição,
                resultado e interpretação geométrica.
              </p>
            )}
          </div>
        </Panel>
      )}

      {result && (
        <TechnicalSheetDialog
          open={showTechnicalSheet}
          onClose={() => setShowTechnicalSheet(false)}
          slug="quadrado-redondo"
          pieceName="Quadrado → Redondo"
          values={{
            baseA: input.baseA,
            baseB: input.baseB,
            topDiameter: input.topDiameter,
            height: input.height,
            eccentricity: input.eccentricity,
            thickness: input.thickness,
          }}
          result={result}
          material={material}
          thickness={input.thickness}
          quantity={input.strategy === "two-weld" ? 2 : 1}
          projectName="CALDRA — Traçagem"
        />
      )}
    </div>
  );
}

function Row({ k, v, muted, accent }: { k: string; v: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-muted-foreground">{k}</span>
      <span className={cn(accent && "text-accent", muted && "text-foreground/70")}>{v}</span>
    </div>
  );
}
