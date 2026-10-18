import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Box,
  Check,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Lightbulb,
  PenTool,
} from "lucide-react";
import { getEngine, type EngineValues } from "@/lib/geometry/engines";
import { downloadDxf, type DxfEntity } from "@/lib/dxf/dxfService";
import { TechnicalSheetDialog } from "@/components/caldra/TechnicalSheetDialog";
import { downloadTracagemPng } from "@/lib/export/tracagemSheet";
import { formatNumber, useSettings } from "@/lib/settings/SettingsProvider";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { buildWire, type WireParams } from "@/lib/viz3d/wire";
import { edgeRefAt, faceRefAt, refLabel } from "@/lib/viz3d/selection";
import { developmentToEntities, piecesToEntities, sendToLab2D } from "@/lib/lab2d/handoff";
import { conferenceRows } from "@/lib/geometry/conference";
import { fieldMeaning } from "@/lib/education/learn";
import { diagnose } from "@/lib/geometry/copilot";
import { toKgDm3 } from "@/lib/geometry/mass";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { cn } from "@/lib/utils";
import { VisualizationViewport, type VisualizationMode } from "./View3DPanel";
import { DevelopmentView } from "./DevelopmentView";
import { TracagemPanel } from "./TracagemPanel";
import {
  NO_HIGHLIGHT,
  fieldRefs,
  foldRef,
  outlineRef,
  refExists,
  refId,
  refKind,
  refsForDim,
  stepForDim,
  type GeometryRef,
  type HighlightState,
} from "@/lib/geometry/refs";
import { ParametricDiagram, type CotaSpec } from "./ParametricDiagram";
import { MassCostPanel } from "./MassCostPanel";
import { SmartNumberInput } from "./SmartNumberInput";
import { LearnDialog } from "./LearnDialog";
import { Metric, Panel, SectionLabel } from "./ui";
import { StageBar } from "./StageBar";
import { saveCustom, updateCustom } from "@/lib/library/store";
import { Save } from "lucide-react";

const BASE_TABS = [
  "Dimensões",
  "Cálculos",
  "Conferência",
  "Traçado",
  "Traçagem",
  "Desenvolvimento",
  "Material",
  "Exportação",
] as const;

/** Resultados em três grupos: cada grupo é uma aba com suas etapas. */
const RESULT_GROUPS = [
  { id: "Geometria", tabs: ["Dimensões", "Cálculos", "Conferência"] },
  { id: "Planificação", tabs: ["Traçado", "Traçagem", "Desenvolvimento"] },
  { id: "Fabricação", tabs: ["Material", "Exportação"] },
] as const;

type ResultGroup = (typeof RESULT_GROUPS)[number]["id"];

function groupOf(tab: string): ResultGroup {
  return RESULT_GROUPS.find((g) => (g.tabs as readonly string[]).includes(tab))?.id ?? "Geometria";
}

export type StudioSnapshot = {
  values: Record<string, number>;
  materialId: string;
  material: string;
  thickness: number;
  quantity: number;
};

type Props = {
  slug: string;
  name: string;
  /** Estado salvo de uma peça de projeto (instância). */
  initial?: { [K in keyof StudioSnapshot]?: StudioSnapshot[K] | undefined } | undefined;
  /**
   * Configuração inicial de compatibilidade: modelos antigos (ex.: "curva de
   * 3 gomos") abrem a família paramétrica já nos parâmetros históricos.
   */
  preset?: Record<string, number> | undefined;
  /** Autosave: chamado com atraso após alterações relevantes. */
  onPersist?: ((snapshot: StudioSnapshot) => void) | undefined;
  customId?: string | undefined;
  customName?: string | undefined;
};

export function GeometryStudio({
  slug,
  name,
  initial,
  preset,
  onPersist,
  customId,
  customName,
}: Props) {
  const engine = getEngine(slug);
  const { can, isMestre, requirePro } = useFeatureAccess();
  const { precision, level } = useSettings();
  const aprendiz = level === "aprendiz";
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [values, setValues] = useState<EngineValues>(() => ({
    ...(engine?.defaults ?? {}),
    ...(preset ?? {}),
    ...(initial?.values ?? {}),
  }));

  const { get, defaultMaterialId } = useMaterials();
  const [materialId, setMaterialId] = useState(initial?.materialId ?? defaultMaterialId);
  const [material, setMaterial] = useState(initial?.material ?? "Aço Carbono");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);

  const [focused, setFocused] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const [tab, setTab] = useState<string>("Dimensões");
  /* Fluxo em duas telas: modelo (medidas) → resultados. */
  const [stage, setStage] = useState<"modelo" | "resultados">("modelo");
  const group = groupOf(tab);
  const goTab = (t: string) => {
    setTab(t);
    setStage("resultados");
  };

  const [explain, setExplain] = useState(false);
  const [learn, setLearn] = useState(false);
  const [piece, setPiece] = useState<number | "all">("all");
  const [unfold, setUnfold] = useState(0);
  /* 3D é camada da área de resultado, não etapa do fluxo. */
  const [viewMode, setViewMode] = useState<VisualizationMode>("2d");
  /* Seleção 3D ↔ 2D (Fase F): referência canônica escolhida no modelo. */
  const [selRef, setSelRef] = useState<GeometryRef | null>(null);
  const [showGeneratrices, setShowGeneratrices] = useState(true);
  /* Trocar de peça sempre volta para o 2D e limpa a seleção. */
  useEffect(() => {
    setViewMode("2d");
    setSelRef(null);
  }, [slug]);
  const [pulse, setPulse] = useState<string | null>(null);
  const [showTechnicalSheet, setShowTechnicalSheet] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const pulseTimer = useRef<number | null>(null);

  const issues = useMemo(() => (engine ? engine.validate(values) : []), [engine, values]);
  const result = useMemo(() => {
    if (!engine || issues.length) return null;
    try {
      return engine.calculate(values);
    } catch {
      return null;
    }
  }, [engine, values, issues]);

  const wireParams: WireParams = useMemo(
    () => (engine ? engine.wire(values) : { d1: 300, d2: 160, h: 260, e: 0, seg: 24 }),
    [engine, values],
  );
  const wireModel = useMemo(() => buildWire(slug, wireParams), [slug, wireParams]);

  /* Resolvers 3D → ref canônica: dependem só do modelo e do desenvolvimento. */
  const foldCount = result?.development.foldLines.length ?? 0;
  const refForEdge = useMemo(
    () => (index: number) => edgeRefAt(wireModel, foldCount, index),
    [wireModel, foldCount],
  );
  const refForFace = useMemo(
    () => (index: number) => faceRefAt(wireModel, foldCount, index),
    [wireModel, foldCount],
  );

  /** Campos ativos para os parâmetros atuais (o método escolhe o conjunto). */
  const activeFields = useMemo(
    () => (engine ? engine.fields.filter((f) => !f.visibleIf || f.visibleIf(values)) : []),
    [engine, values],
  );

  const cotas = useMemo<CotaSpec[]>(
    () =>
      engine
        ? activeFields
            .filter((f) => !f.options && engine.dimKey(f.key) !== null)
            .map((f) => ({
              field: f.key,
              dim: engine.dimKey(f.key),
              label: f.tag,
              value: values[f.key] ?? 0,
              unit: f.unit ?? "mm",
            }))
        : [],
    [engine, activeFields, values],
  );

  /* Vínculo PARÂMETRO ↔ COTA ↔ ENTIDADE: destaque temporário, cor técnica intacta. */
  const devHighlight = useMemo<HighlightState>(() => {
    const dev = result?.development;
    const field = focused ?? pulse;
    if (!engine || !dev) return NO_HIGHLIGHT;
    if (field) {
      return {
        refs: fieldRefs(field, dev, refsForDim(engine.dimKey(field), dev)),
        level: "focus",
        label: engine.fields.find((f) => f.key === field)?.tag ?? field,
      };
    }
    /* 3D → 2D: a entidade selecionada no modelo destaca a origem na planificação. */
    if (selRef) return { refs: [selRef], level: "focus", label: refLabel(selRef) };
    return NO_HIGHLIGHT;
  }, [engine, result, focused, pulse, selRef]);

  /*
   * 2D/parâmetro → 3D: refs do destaque atual que têm entidade no modelo.
   * dobra/contorno passam direto; ponto de geratriz gN → dobra N;
   * cota de diâmetro → contorno da boca (0 = base, 1 = topo).
   */
  const highlightRef3d = useMemo<readonly GeometryRef[]>(() => {
    if (selRef) return [selRef];
    const dev = result?.development;
    if (!dev) return [];
    const out: GeometryRef[] = [];
    for (const r of devHighlight.refs) {
      const kind = refKind(r);
      const id = refId(r);
      if (kind === "fold" || kind === "outline") out.push(r);
      else if (kind === "point" && /^g\d+$/.test(id)) out.push(foldRef(Number(id.slice(1))));
      else if (kind === "dim" && (id === "d1" || id === "d2")) {
        const rim = outlineRef(id === "d1" ? 0 : 1);
        if (refExists(dev, rim)) out.push(rim);
      }
    }
    return out;
  }, [selRef, devHighlight, result]);

  /* Autosave inteligente: grava 700 ms após a última alteração. */
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  useEffect(() => {
    if (!persistRef.current) return;
    const id = window.setTimeout(() => {
      persistRef.current?.({
        values: { ...values } as Record<string, number>,
        materialId,
        material,
        thickness: (values["thickness"] as number) ?? 3,
        quantity,
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [values, materialId, material, quantity]);

  if (!engine) return null;

  const tabs = BASE_TABS as readonly string[];

  const set = (key: string, raw: string) => {
    const value = raw === "" || raw === "-" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(value)) return;
    setValues((prev) => ({ ...prev, [key]: value }));
    /* realce curto da cota alterada + micro-indicação de recálculo */
    setPulse(key);
    setCalculating(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => {
      setPulse(null);
      setCalculating(false);
    }, 340);
  };

  /** Valor já convertido para mm pela entrada inteligente. */
  const setNumber = (key: string, mm: number) => set(key, String(mm));

  const diagnoses = diagnose(engine, values, issues);

  const issueFor = (key: string) => issues.find((i) => i.field === key)?.message;

  const exportPng = async () => {
    if (!result) return;
    await downloadTracagemPng(result, {
      project: "CALDRA",
      plan: name,
      material,
      thickness: `${values["thickness"] ?? 3} mm`,
      quantity: String(quantity),
    });
    toast.success("PNG exportado.");
  };

  const exportPdf = () => {
    if (!result) return;
    setShowTechnicalSheet(true);
  };

  const exportDxfFile = () => {
    if (!result) return;
    const entities: DxfEntity[] = [
      {
        type: "LWPOLYLINE",
        layer: "CORTE",
        closed: true,
        points: result.development.outline.map((p) => ({ x: p.x, y: p.y })),
      },
      ...result.development.foldLines.map<DxfEntity>((s) => ({
        type: "LINE",
        layer: "DOBRA",
        start: s.a,
        end: s.b,
      })),
    ];
    downloadDxf(
      {
        layers: [
          { name: "CORTE", color: 1 },
          { name: "DOBRA", color: 3 },
        ],
        entities,
      },
      `caldra-${slug}`,
    );
    toast.success("DXF exportado.");
  };

  const thickness = values["thickness"] ?? 3;
  const density = values["density"] ?? 7.85;

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
              selection={{
                refForEdge,
                refForFace,
                highlightRef: highlightRef3d,
                onSelectRef: setSelRef,
              }}
              showGeneratrices={showGeneratrices}
              onToggleGeneratrices={() => setShowGeneratrices((v) => !v)}
              onPlanificar={() => {
                setUnfold(1);
                window.setTimeout(() => {
                  setViewMode("2d");
                  goTab("Desenvolvimento");
                }, 420);
              }}
            >
              <ParametricDiagram
                slug={slug}
                params={wireParams}
                cotas={cotas}
                active={focused}
                pulse={pulse}
                onPick={(key) => {
                  setFocused(key);
                  inputs.current[key]?.focus();
                  inputs.current[key]?.select();
                }}
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
                {activeFields.map((f) => {
                  const err = issueFor(f.key);
                  if (f.options) {
                    const current = Math.round(values[f.key] ?? f.options[0]!.value);
                    return (
                      <div key={f.key} className="col-span-2">
                        <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                          <span className="truncate">{f.label}</span>
                          <span className="text-accent/80">{f.tag}</span>
                        </span>
                        <div className="flex gap-1.5" role="group" aria-label={f.label}>
                          {f.options.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              aria-pressed={current === o.value}
                              onClick={() => setNumber(f.key, o.value)}
                              className={`flex-1 rounded-lg border px-2 py-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                                current === o.value
                                  ? "border-accent/60 bg-accent/10 text-accent"
                                  : "border-line text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <label key={f.key} className="block">
                      <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                        <span className="truncate">{f.label}</span>
                        <span className="text-accent/80">{f.tag}</span>
                      </span>
                      <SmartNumberInput
                        value={values[f.key] ?? 0}
                        unit={f.unit ?? "mm"}
                        invalid={Boolean(err)}
                        ariaLabel={f.label}
                        inputRef={(el) => {
                          inputs.current[f.key] = el;
                        }}
                        onFocus={() => setFocused(f.key)}
                        onBlur={() => setFocused(null)}
                        onChange={(mm) => setNumber(f.key, mm)}
                      />
                      {err && (
                        <span className="mt-1 block text-[10px] text-destructive">{err}</span>
                      )}
                      {aprendiz && !err && fieldMeaning(f.key) && (
                        <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
                          {fieldMeaning(f.key)}
                        </span>
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
                <p className="mt-1 text-sm">{engine.method}</p>
                <label className="mt-2 flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Divisões do traçado
                  </span>
                  <input
                    type="range"
                    min={3}
                    max={24}
                    value={values["divisions"] ?? 12}
                    onChange={(e) => set("divisions", e.target.value)}
                    className="h-1 flex-1 accent-[var(--accent)]"
                  />
                  <span className="w-8 text-right font-mono text-xs">
                    {values["divisions"] ?? 12}
                  </span>
                </label>
              </div>

              {diagnoses.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {diagnoses.map((d) => (
                    <div
                      key={`${d.field}-${d.message}`}
                      className="rounded-xl border border-destructive/40 bg-destructive/8 p-3"
                    >
                      <p className="text-[12px] text-destructive">{d.message}</p>
                      {d.fix && (
                        <button
                          onClick={() => {
                            setValues((p) => ({ ...p, ...d.fix!.values }));
                            toast.success(d.fix!.label);
                          }}
                          className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] tracking-wider text-accent uppercase"
                        >
                          {d.fix.label}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className={cn(
                    "mt-3 text-center font-mono text-[11px] tracking-[0.16em] uppercase transition-colors",
                    calculating ? "text-muted-foreground" : "text-accent",
                  )}
                >
                  {calculating ? "Calculando…" : "Pronto · atualização em tempo real"}
                </p>
              )}
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

          <StageBar tab={tab} tabs={tabs} onJump={setTab} />

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
                        <th className="px-3 py-2 font-normal">Elemento</th>
                        <th className="px-3 py-2 text-right font-normal">
                          Comprimento verdadeiro (mm)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trueLengths.map((t, i) => (
                        <tr key={`${t.id}-${i}`} className="border-t border-line">
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

            {tab === "Traçagem" && (
              <TracagemPanel
                slug={slug}
                result={result}
                focusStepId={focused ? stepForDim(engine.dimKey(focused)) : null}
              />
            )}

            {(tab === "Traçado" || tab === "Desenvolvimento") && (
              <div className="grid-bg-fine relative rounded-xl border border-line bg-background/40 p-3">
                <div className="h-[300px] lg:h-[420px]">
                  <DevelopmentView
                    ref={svgRef}
                    pattern={result.development}
                    showFolds={tab === "Traçado"}
                    showPoints={tab === "Traçado"}
                    highlight={devHighlight}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {tab === "Traçado"
                    ? "Linhas de corte (contorno) · geratrizes e ordenadas tracejadas · pontos notáveis."
                    : "Contorno de corte pronto para nesting. Escala real em milímetros."}
                </p>
              </div>
            )}

            {tab === "Conferência" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-accent/25 bg-accent/8 p-3">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
                    Conferência do traçado
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Medidas que o caldeireiro usa para conferir o risco direto na chapa.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {conferenceRows(slug, values, result).map((row, idx) => (
                    <Metric
                      key={`${row.label}-${idx}`}
                      label={row.label}
                      value={row.value}
                      suffix={row.suffix ?? "mm"}
                      precision={row.suffix === "°" ? 2 : precision}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "Material" && (
              <div className="space-y-3">
                <MassCostPanel
                  areaMm2={result.areaMm2}
                  materialId={materialId}
                  onMaterialId={(id) => {
                    setMaterialId(id);
                    const m = get(id);
                    if (m) {
                      setMaterial(m.name);
                      setValues((p) => ({ ...p, density: toKgDm3(m.density) }));
                    }
                  }}
                  thickness={thickness}
                  onThickness={(mm) => setValues((p) => ({ ...p, thickness: mm }))}
                  quantity={quantity}
                  onQuantity={setQuantity}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="Área desenvolvida"
                    value={result.areaMm2 / 1_000_000}
                    suffix="m²"
                    precision={4}
                  />
                  <Metric
                    label="Densidade aplicada"
                    value={density * 1000}
                    suffix="kg/m³"
                    precision={0}
                  />
                </div>
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
                {result.pieces && result.pieces.length > 1 && (
                  <div className="rounded-xl border border-line bg-background/40 p-3">
                    <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                      Peças desta geometria
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        aria-pressed={piece === "all"}
                        onClick={() => setPiece("all")}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 font-mono text-[10px] uppercase",
                          piece === "all"
                            ? "border-accent/60 bg-accent/10 text-accent"
                            : "border-line text-muted-foreground",
                        )}
                      >
                        Todas ({result.pieces.length})
                      </button>
                      {result.pieces.map((pc, i) => (
                        <button
                          key={pc.code}
                          type="button"
                          aria-pressed={piece === i}
                          onClick={() => setPiece(i)}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 font-mono text-[10px] uppercase",
                            piece === i
                              ? "border-accent/60 bg-accent/10 text-accent"
                              : "border-line text-muted-foreground",
                          )}
                        >
                          {pc.code}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {piece === "all"
                        ? "Todas as peças vão para o CHAMFER lado a lado, em geometria vetorial."
                        : result.pieces[piece as number]?.name}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!requirePro("lab2d")) return;
                    const pieces = result.pieces ?? [];
                    const entities =
                      pieces.length > 1
                        ? piece === "all"
                          ? piecesToEntities(pieces)
                          : developmentToEntities(
                              pieces[piece as number]?.development ?? result.development,
                            )
                        : developmentToEntities(result.development);
                    sendToLab2D({ name, entities });
                    navigate({ to: "/desenho-2d" });
                  }}
                  className="brand-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-display text-[13px] font-semibold text-background"
                >
                  <PenTool className="size-4" /> Levar para Máquina a Laser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const snapshot = { ...values } as Record<string, number>;
                    const chosenName = window
                      .prompt("Nome do modelo", customName ?? `Meu ${name}`)
                      ?.trim();
                    if (!chosenName) return;
                    if (customId) updateCustom(customId, { name: chosenName, values: snapshot });
                    else
                      saveCustom({
                        baseId: `cald.${slug}`,
                        name: chosenName,
                        values: snapshot,
                        modelFamily: "parametric",
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

          {/* APRENDER */}
          <button
            onClick={() => setLearn(true)}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 font-display text-[13px] font-semibold transition-colors",
              aprendiz
                ? "border-accent/40 bg-accent/12 text-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <GraduationCap className="size-4" /> Aprender esta peça
          </button>
          <LearnDialog
            open={learn}
            onOpenChange={setLearn}
            slug={slug}
            name={name}
            fields={activeFields}
            values={values}
            result={result}
            precision={precision}
          />

          {/* ENTENDER O CÁLCULO */}
          <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.04] p-3">
            <button
              onClick={() => requirePro("calc.explanation") && setExplain((v) => !v)}
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
            {(explain || (aprendiz && can("calc.explanation"))) && can("calc.explanation") && (
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
          slug={slug}
          pieceName={name}
          values={values}
          result={result}
          material={material}
          thickness={values["thickness"] ?? values["t"] ?? 3}
          quantity={quantity}
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
