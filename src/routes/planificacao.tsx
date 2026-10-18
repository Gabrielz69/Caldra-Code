import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { MATERIALS } from "@/lib/projects/demo-data";
import { formatNumber, useSettings } from "@/lib/settings/SettingsProvider";
import { Metric, Panel, SectionLabel } from "@/components/chameleon/ui";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { useProjects } from "@/lib/projects/store";
import { bomToNestParts, projectBom } from "@/lib/projects/bom";
import { nestParts } from "@/lib/nesting/nesting";
import { cn } from "@/lib/utils";

type Search = { projeto?: string | undefined };

export const Route = createFileRoute("/planificacao")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    projeto: typeof raw["projeto"] === "string" ? raw["projeto"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planificação — CALDRA" },
      {
        name: "description",
        content:
          "Aproveitamento de chapa, cálculo de peso e distribuição de peças no formato comercial.",
      },
      { property: "og:title", content: "Planificação — CALDRA" },
      {
        property: "og:description",
        content: "Calcule aproveitamento de chapa, sobras e massa antes de cortar.",
      },
    ],
  }),
  component: Planificacao,
});

const SHEETS = [
  { label: "2000 × 1000", w: 2000, h: 1000 },
  { label: "2500 × 1200", w: 2500, h: 1200 },
  { label: "3000 × 1500", w: 3000, h: 1500 },
  { label: "6000 × 2000", w: 6000, h: 2000 },
];

function Planificacao() {
  const { projeto } = Route.useSearch();
  const [mode, setMode] = useState<"manual" | "projeto">(projeto ? "projeto" : "manual");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Planificação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Distribua as peças desenvolvidas na chapa comercial e antecipe consumo, sobra e peso.
        </p>
      </header>

      <div className="flex gap-1.5">
        {(
          [
            { id: "manual", label: "Peça avulsa" },
            { id: "projeto", label: "Do projeto" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider uppercase",
              mode === t.id
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "manual" ? <ManualMode /> : <ProjectMode initialId={projeto} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modo peça avulsa (comportamento original)                           */
/* ------------------------------------------------------------------ */

function ManualMode() {
  const { precision } = useSettings();
  const [sheet, setSheet] = useState(SHEETS[2]!);
  const [pieceW, setPieceW] = useState(620);
  const [pieceH, setPieceH] = useState(430);
  const [quantity, setQuantity] = useState(12);
  const [kerf, setKerf] = useState(3);
  const [thickness, setThickness] = useState(3);
  const [material, setMaterial] = useState(MATERIALS[0]!);

  const plan = useMemo(() => {
    const w = pieceW + kerf;
    const h = pieceH + kerf;
    const cols = Math.max(0, Math.floor(sheet.w / w));
    const rows = Math.max(0, Math.floor(sheet.h / h));
    const perSheet = cols * rows;
    const sheets = perSheet > 0 ? Math.ceil(quantity / perSheet) : 0;
    const usedArea = quantity * pieceW * pieceH;
    const totalArea = sheets * sheet.w * sheet.h;
    const yieldPct = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;
    const mass = (usedArea * thickness * material.density) / 1_000_000_000;
    return { cols, rows, perSheet, sheets, yieldPct, mass, usedArea, totalArea };
  }, [sheet, pieceW, pieceH, quantity, kerf, thickness, material]);

  const placed = Math.min(plan.perSheet, quantity);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Panel className="space-y-3 p-4">
        <SectionLabel>Parâmetros</SectionLabel>
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            Chapa comercial (mm)
          </span>
          <select
            value={sheet.label}
            onChange={(e) => setSheet(SHEETS.find((s) => s.label === e.target.value)!)}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {SHEETS.map((s, idx) => (
              <option key={`${s.label}-${idx}`} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Largura da peça" value={pieceW} onChange={setPieceW} />
          <Field label="Altura da peça" value={pieceH} onChange={setPieceH} />
          <Field label="Quantidade" value={quantity} onChange={setQuantity} unit="un" />
          <Field label="Sangria (kerf)" value={kerf} onChange={setKerf} />
          <Field label="Espessura" value={thickness} onChange={setThickness} />
          <label className="block">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">Material</span>
            <select
              value={material.name}
              onChange={(e) => setMaterial(MATERIALS.find((m) => m.name === e.target.value)!)}
              className="mt-1 w-full rounded-lg border border-line bg-background/50 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
            >
              {MATERIALS.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel className="p-4">
          <SectionLabel>Aproveitamento</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Peças por chapa" value={plan.perSheet} suffix="un" precision={0} />
            <Metric label="Chapas" value={plan.sheets} suffix="un" precision={0} />
            <Metric label="Aproveitamento" value={plan.yieldPct} suffix="%" precision={1} />
            <Metric label="Massa total" value={plan.mass} suffix="kg" precision={precision} />
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            Grade {plan.cols} × {plan.rows} · sobra{" "}
            {formatNumber((plan.totalArea - plan.usedArea) / 1_000_000, 3)} m²
          </p>
        </Panel>

        <Panel className="p-4">
          <SectionLabel action={<Layers className="size-4 text-accent" />}>
            Prévia da chapa
          </SectionLabel>
          <svg
            viewBox={`0 0 ${sheet.w} ${sheet.h}`}
            className="h-auto w-full rounded-lg border border-line bg-background/40"
            role="img"
            aria-label="Distribuição de peças na chapa"
          >
            {Array.from({ length: placed }).map((_, i) => {
              const col = i % Math.max(plan.cols, 1);
              const row = Math.floor(i / Math.max(plan.cols, 1));
              return (
                <rect
                  key={i}
                  x={col * (pieceW + kerf)}
                  y={row * (pieceH + kerf)}
                  width={pieceW}
                  height={pieceH}
                  fill="var(--accent)"
                  fillOpacity="0.14"
                  stroke="var(--accent)"
                  strokeWidth={sheet.w / 500}
                />
              );
            })}
            <rect
              x="0"
              y="0"
              width={sheet.w}
              height={sheet.h}
              fill="none"
              stroke="var(--border)"
              strokeWidth={sheet.w / 400}
            />
          </svg>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modo projeto — usa as peças reais do dossiê                         */
/* ------------------------------------------------------------------ */

function ProjectMode({ initialId }: { initialId?: string | undefined }) {
  const projects = useProjects();
  const { materials } = useMaterials();
  const [projectId, setProjectId] = useState(initialId ?? projects[0]?.id ?? "");
  const [sheet, setSheet] = useState(SHEETS[2]!);
  const [kerf, setKerf] = useState(3);
  const [margin, setMargin] = useState(10);
  const [groupKey, setGroupKey] = useState<string>("");

  const project = projects.find((p) => p.id === projectId) ?? null;
  const bom = useMemo(
    () => (project ? projectBom(project, materials) : null),
    [project, materials],
  );

  const group = bom?.groups.find((g) => g.key === groupKey) ?? bom?.groups[0] ?? null;

  const nest = useMemo(() => {
    if (!group) return null;
    const parts = bomToNestParts(group.lines);
    if (parts.length === 0) return null;
    return nestParts(parts, {
      sheetW: sheet.w,
      sheetH: sheet.h,
      gap: kerf,
      margin,
      rotate: true,
    });
  }, [group, sheet, kerf, margin]);

  if (projects.length === 0) {
    return (
      <Panel className="p-8 text-center">
        <p className="t-subtitle">Nenhum projeto ainda.</p>
        <Link to="/projetos" className="t-caption mt-2 inline-block text-accent underline">
          Criar um projeto
        </Link>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Panel className="space-y-3 p-4">
        <SectionLabel>Projeto</SectionLabel>
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">Dossiê</span>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setGroupKey("");
            }}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `${p.code} · ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            Material e espessura
          </span>
          <select
            value={group?.key ?? ""}
            onChange={(e) => setGroupKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {(bom?.groups ?? []).map((g) => (
              <option key={g.key} value={g.key}>
                {g.material} · {g.thickness} mm ({g.quantity} un)
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            Chapa comercial (mm)
          </span>
          <select
            value={sheet.label}
            onChange={(e) => setSheet(SHEETS.find((s) => s.label === e.target.value)!)}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {SHEETS.map((s, idx) => (
              <option key={`${s.label}-${idx}`} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Sangria (kerf)" value={kerf} onChange={setKerf} />
          <Field label="Margem da chapa" value={margin} onChange={setMargin} />
        </div>

        {project && (
          <Link
            to="/projetos/$projectId"
            params={{ projectId: project.id }}
            className="t-caption inline-block text-accent underline"
          >
            Abrir o projeto
          </Link>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel className="p-4">
          <SectionLabel>Aproveitamento</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Peças" value={nest?.placed ?? 0} suffix="un" precision={0} />
            <Metric label="Chapas" value={nest?.sheets.length ?? 0} suffix="un" precision={0} />
            <Metric
              label="Aproveitamento"
              value={(nest?.utilization ?? 0) * 100}
              suffix="%"
              precision={1}
            />
            <Metric label="Massa do lote" value={group?.massKg ?? 0} suffix="kg" precision={2} />
          </div>
          {nest && nest.rejected.length > 0 && (
            <p className="t-caption mt-2">
              {nest.rejected.length} peça(s) maior(es) que a chapa escolhida.
            </p>
          )}
          {bom && bom.pending > 0 && (
            <p className="t-caption mt-1">
              {bom.pending} peça(s) sem medida ainda — confirme os parâmetros na Traçagem.
            </p>
          )}
        </Panel>

        {nest ? (
          nest.sheets.map((s, i) => (
            <Panel key={i} className="p-4">
              <SectionLabel action={<Layers className="size-4 text-accent" />}>
                Chapa {i + 1} de {nest.sheets.length}
              </SectionLabel>
              <svg
                viewBox={`0 0 ${sheet.w} ${sheet.h}`}
                className="h-auto w-full rounded-lg border border-line bg-background/40"
                role="img"
                aria-label={`Distribuição de peças na chapa ${i + 1}`}
              >
                {s.placements.map((p, k) => (
                  <g key={k}>
                    <rect
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={p.h}
                      fill="var(--accent)"
                      fillOpacity="0.14"
                      stroke="var(--accent)"
                      strokeWidth={sheet.w / 600}
                    />
                    <text
                      x={p.x + p.w / 2}
                      y={p.y + p.h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--accent)"
                      fontSize={Math.max(18, sheet.w / 90)}
                    >
                      {p.name.split(" · ")[0]}
                    </text>
                  </g>
                ))}
                <rect
                  x="0"
                  y="0"
                  width={sheet.w}
                  height={sheet.h}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={sheet.w / 400}
                />
              </svg>
            </Panel>
          ))
        ) : (
          <Panel className="p-8 text-center">
            <p className="t-subtitle">Sem peças com medida para aninhar.</p>
            <p className="t-caption mt-1">
              Adicione peças ao projeto e confirme os parâmetros para ver o plano de chapa.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  unit = "mm",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] text-muted-foreground uppercase">{label}</span>
      <span className="mt-1 flex items-center overflow-hidden rounded-lg border border-line bg-background/50 focus-within:border-accent">
        <input
          inputMode="decimal"
          value={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="w-full min-w-0 bg-transparent px-2.5 py-2.5 font-mono text-sm outline-none"
        />
        <span className="border-l border-line px-2 font-mono text-[10px] text-muted-foreground">
          {unit}
        </span>
      </span>
    </label>
  );
}
