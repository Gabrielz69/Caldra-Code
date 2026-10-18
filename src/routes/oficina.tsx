import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Cloud,
  FileText,
  Grid2x2,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { FeatureGate, Panel, SectionLabel } from "@/components/chameleon/ui";
import { MaterialManager } from "@/components/chameleon/MaterialManager";
import { CaldraIntegratedWorkshopModal } from "@/components/lab2d/CaldraIntegratedWorkshopModal";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { formatMoney, formatWeight } from "@/lib/regional/regional";
import { materialCostBRL, plateMassKg } from "@/lib/geometry/mass";
import {
  DEFAULT_RATES,
  cutTimeMinutes,
  fabricationCost,
  type MachineRates,
} from "@/lib/costing/fabrication";
import { nestParts, type NestResult } from "@/lib/nesting/nesting";
import { DEFAULT_SHEET_ID } from "@/lib/nesting/sheets";
import { emptyPart, partsFromProject, type ProductionPart } from "@/lib/production/parts";
import { jobSheetPdf } from "@/lib/production/jobSheet";
import { newQuote, quotePdf, quoteTotals, quoteFilename, type Quote } from "@/lib/costing/quote";
import { listProjects, newProject, saveProject, type Project } from "@/lib/lab2d/projects";
import {
  listVersions,
  restoreVersion,
  saveVersion,
  syncProjects,
  type CloudVersion,
} from "@/lib/cloud/cloudProjects";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/oficina")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabId } => ({
    tab:
      typeof search.tab === "string" &&
      ["chapa", "custo", "orcamento", "ficha", "nuvem"].includes(search.tab)
        ? (search.tab as TabId)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Oficina Digital Integrada — Corte, BOM e Orçamento | CALDRA" },
      {
        name: "description",
        content:
          "Projete estruturas e peças com o Catálogo Costa Ferro, gere dossiê multi-vistas, lista de corte de barras 6m, materiais e orçamento.",
      },
      { property: "og:title", content: "Oficina Digital Integrada — Corte, BOM e Orçamento | CALDRA" },
      {
        property: "og:description",
        content: "Do traçado ao orçamento: aproveitamento de barras 6m e chapas, custo real e dossiê técnico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OficinaPage,
});

const TABS = [
  { id: "chapa", label: "Chapa", icon: Grid2x2 },
  { id: "custo", label: "Custo", icon: Wallet },
  { id: "orcamento", label: "Orçamento", icon: Receipt },
  { id: "ficha", label: "Ficha", icon: QrCode },
  { id: "nuvem", label: "Nuvem", icon: Cloud },
] as const;
type TabId = (typeof TABS)[number]["id"];

function OficinaPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <CaldraIntegratedWorkshopModal
        open={true}
        onClose={() => {}}
        embedded={true}
        onInsertEntitiesToCad={(entities) => {
          const proj = newProject(`Estrutura Oficina ${new Date().toLocaleDateString("pt-BR")}`, entities);
          saveProject(proj);
          navigate({ to: "/desenho-2d/$projectId", params: { projectId: proj.id } });
        }}
      />
      {/* Materiais moraram em Configurações; agora ficam ao lado de quem os usa.
          Fora do FeatureGate: continuam disponíveis no plano gratuito. */}
      <MaterialManager />
      <FeatureGate
        feature="workshop.manage"
        title="OFICINA"
        description="Encaixe na chapa, custo de fabricação, orçamento e ficha de produção. Disponível no CALDRA Pro."
      >
        <Oficina />
      </FeatureGate>
    </div>
  );
}

/* ------------------------------------------------------------- controles */

function Field({
  label,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="mt-1 flex items-center gap-1 rounded-xl border border-line bg-card/60 px-2.5 py-1.5">
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent font-mono text-sm outline-none"
        />
        {suffix && <span className="font-mono text-[10px] text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-card/60 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ raiz */

function Oficina() {
  const { regionConfig } = useSettings();
  const materials = useMaterials();

  const search = Route.useSearch();
  const [tab, setTab] = useState<TabId>(() => search.tab ?? "chapa");

  useEffect(() => {
    if (search.tab && TABS.some((t) => t.id === search.tab)) {
      setTab(search.tab);
    }
  }, [search.tab]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [parts, setParts] = useState<ProductionPart[]>([]);

  const [materialId, setMaterialId] = useState(materials.defaultMaterialId);
  const [thickness, setThickness] = useState(materials.defaultThickness);
  const [lossPct, setLossPct] = useState(materials.lossPct);
  const [rates, setRates] = useState<MachineRates>(DEFAULT_RATES);

  const [sheetId, setSheetId] = useState(DEFAULT_SHEET_ID);
  const [gap, setGap] = useState(8);
  const [margin, setMargin] = useState(10);
  const [rotate, setRotate] = useState(true);

  const [quote, setQuote] = useState<Quote>(() => newQuote(regionConfig));

  useEffect(() => setProjects(listProjects()), []);

  const material = materials.get(materialId) ?? materials.visible[0];
  const sheet = regionConfig.sheets.find((s) => s.id === sheetId) ?? regionConfig.sheets[0]!;

  const money = (v: number) => formatMoney(v, regionConfig);

  const costed = useMemo(
    () =>
      parts.map((p) => {
        const massKg = plateMassKg(p.areaMm2, thickness, material?.density ?? 7850);
        const mat = materialCostBRL({
          massKg,
          pricePerKg: material?.pricePerKg ?? 0,
          quantity: p.quantity,
          lossPct,
        });
        const fab = fabricationCost({
          cutLengthMm: p.cutLengthMm,
          pierces: p.pierces,
          bends: p.bends,
          weldLengthMm: 0,
          laborHours: 0,
          thicknessMm: thickness,
          quantity: p.quantity,
          rates,
          includeSetup: false,
        });
        return { part: p, massKg, mat, fab };
      }),
    [parts, thickness, material, lossPct, rates],
  );

  const setupTotal = parts.length ? rates.setup : 0;
  const totalMaterial = costed.reduce((a, c) => a + c.mat, 0);
  const totalFab = costed.reduce((a, c) => a + c.fab.total, 0) + setupTotal;

  const nest = useMemo<NestResult>(
    () =>
      nestParts(
        parts.map((p) => ({
          id: p.id,
          name: p.name,
          w: p.w,
          h: p.h,
          quantity: p.quantity,
          allowRotate: p.allowRotate,
        })),
        { sheetW: sheet.w, sheetH: sheet.h, gap, margin, rotate },
      ),
    [parts, sheet, gap, margin, rotate],
  );

  const importProject = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    const next = partsFromProject(p);
    if (!next.length) {
      toast.error("Este projeto não tem planos com geometria.");
      return;
    }
    setParts((prev) => [...prev, ...next.filter((n) => !prev.some((o) => o.id === n.id))]);
    toast.success(`${next.length} peça(s) importada(s).`);
  };

  const patch = (id: string, p: Partial<ProductionPart>) =>
    setParts((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const next = { ...x, ...p };
        return { ...next, areaMm2: next.w * next.h };
      }),
    );

  return (
    <div className="space-y-5 pb-6">
      <NavigationAreaHeader
        badgeText="BANCADA DE OFICINA & CHÃO DE FÁBRICA"
        badgeColor="text-emerald-500"
        indicatorColor="bg-emerald-500"
        secondaryBadge={
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-emerald-500 border border-emerald-500/30">
            CALDRA SHOP
          </span>
        }
        title="Bancada de Oficina"
        description="Da chapa ao orçamento: plano de corte, aproveitamento de nesting, custos de fabricação e ordens de serviço."
      />

      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors",
              tab === t.id
                ? "bg-accent/12 text-accent amber-ring"
                : "border border-line text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </nav>

      {tab !== "nuvem" && (
        <PartsPanel
          parts={parts}
          projects={projects}
          onImport={importProject}
          onAdd={() => setParts((p) => [...p, emptyPart(`Peça ${p.length + 1}`)])}
          onRemove={(id) => setParts((p) => p.filter((x) => x.id !== id))}
          onPatch={patch}
        />
      )}

      {tab === "chapa" && (
        <ChapaTab
          nest={nest}
          sheetLabel={sheet.label}
          sheetId={sheet.id}
          sheets={regionConfig.sheets}
          onSheet={setSheetId}
          gap={gap}
          setGap={setGap}
          margin={margin}
          setMargin={setMargin}
          rotate={rotate}
          setRotate={setRotate}
        />
      )}

      {tab === "custo" && (
        <CustoTab
          costed={costed}
          rates={rates}
          setRates={setRates}
          thickness={thickness}
          setThickness={setThickness}
          lossPct={lossPct}
          setLossPct={setLossPct}
          materialId={material?.id ?? ""}
          setMaterialId={setMaterialId}
          materials={materials.visible}
          totalMaterial={totalMaterial}
          totalFab={totalFab}
          setupTotal={setupTotal}
          money={money}
          weight={(kg) => formatWeight(kg, regionConfig)}
        />
      )}

      {tab === "orcamento" && (
        <OrcamentoTab
          quote={quote}
          setQuote={setQuote}
          money={money}
          onSync={() =>
            setQuote((q) => ({
              ...q,
              items: costed.map((c) => ({
                id: c.part.id,
                description: c.part.name,
                detail: `${c.part.w.toFixed(0)} × ${c.part.h.toFixed(0)} mm · ${thickness} mm · ${material?.name ?? ""}`,
                quantity: c.part.quantity,
                materialCost: c.mat,
                fabricationCost: c.fab.total,
              })),
            }))
          }
          region={regionConfig}
        />
      )}

      {tab === "ficha" && (
        <FichaTab
          costed={costed}
          thickness={thickness}
          materialName={material?.name ?? "—"}
          region={regionConfig}
          money={money}
        />
      )}

      {tab === "nuvem" && (
        <NuvemTab projects={projects} onRefresh={() => setProjects(listProjects())} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ peças */

function PartsPanel({
  parts,
  projects,
  onImport,
  onAdd,
  onRemove,
  onPatch,
}: {
  parts: ProductionPart[];
  projects: Project[];
  onImport: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, p: Partial<ProductionPart>) => void;
}) {
  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          <div className="flex items-center gap-1.5">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) onImport(e.target.value);
                e.currentTarget.value = "";
              }}
              className="rounded-xl border border-line bg-card/60 px-2 py-1 font-mono text-[10px] uppercase"
            >
              <option value="">Importar do CHAMFER</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={onAdd}
              className="flex items-center gap-1 rounded-xl border border-line px-2 py-1 font-mono text-[10px] uppercase"
            >
              <Plus className="size-3" /> Peça
            </button>
          </div>
        }
      >
        Peças do lote
      </SectionLabel>

      {parts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Importe um projeto do CHAMFER ou adicione uma peça manual para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12px]">
            <thead className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="py-1.5 pr-2 font-normal">Peça</th>
                <th className="py-1.5 pr-2 font-normal">L (mm)</th>
                <th className="py-1.5 pr-2 font-normal">A (mm)</th>
                <th className="py-1.5 pr-2 font-normal">Corte (mm)</th>
                <th className="py-1.5 pr-2 font-normal">Furos</th>
                <th className="py-1.5 pr-2 font-normal">Dobras</th>
                <th className="py-1.5 pr-2 font-normal">Qtd</th>
                <th className="py-1.5 font-normal">Girar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="max-w-[180px] truncate py-1.5 pr-2">{p.name}</td>
                  {(
                    [
                      ["w", p.w],
                      ["h", p.h],
                      ["cutLengthMm", p.cutLengthMm],
                      ["pierces", p.pierces],
                      ["bends", p.bends],
                      ["quantity", p.quantity],
                    ] as const
                  ).map(([key, value]) => (
                    <td key={key} className="py-1.5 pr-2">
                      <input
                        type="number"
                        value={Math.round(value * 100) / 100}
                        onChange={(e) => onPatch(p.id, { [key]: Number(e.target.value) })}
                        className="w-[68px] rounded-lg border border-line bg-card/60 px-1.5 py-1 font-mono text-[11px] outline-none"
                      />
                    </td>
                  ))}
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      checked={p.allowRotate}
                      onChange={(e) => onPatch(p.id, { allowRotate: e.target.checked })}
                      className="size-3.5 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => onRemove(p.id)}
                      aria-label={`Remover ${p.name}`}
                      className="text-muted-foreground transition-colors hover:text-warn"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- chapa */

function ChapaTab({
  nest,
  sheetLabel,
  sheetId,
  sheets,
  onSheet,
  gap,
  setGap,
  margin,
  setMargin,
  rotate,
  setRotate,
}: {
  nest: NestResult;
  sheetLabel: string;
  sheetId: string;
  sheets: { id: string; label: string }[];
  onSheet: (id: string) => void;
  gap: number;
  setGap: (n: number) => void;
  margin: number;
  setMargin: (n: number) => void;
  rotate: boolean;
  setRotate: (b: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SectionLabel>Chapa e folgas</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Chapa comercial
            </span>
            <select
              value={sheetId}
              onChange={(e) => onSheet(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-card/60 px-2.5 py-1.5 text-sm outline-none"
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Folga entre peças" value={gap} onChange={setGap} suffix="mm" step={0.5} />
          <Field
            label="Margem da borda"
            value={margin}
            onChange={setMargin}
            suffix="mm"
            step={0.5}
          />
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={rotate}
              onChange={(e) => setRotate(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            <span className="text-sm">Permitir girar 90°</span>
          </label>
        </div>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Chapas" value={String(nest.sheets.length)} hint={sheetLabel} />
        <Stat
          label="Aproveitamento"
          value={`${(nest.utilization * 100).toFixed(1)}%`}
          hint="área útil"
        />
        <Stat label="Peças posicionadas" value={String(nest.placed)} hint="no lote" />
        <Stat
          label="Sobra"
          value={`${(nest.scrapMm2 * 1e-6).toFixed(2)} m²`}
          hint="retalho estimado"
        />
      </div>

      {nest.rejected.length > 0 && (
        <Panel className="border border-warn/30 p-3">
          <p className="font-mono text-[10px] tracking-wider text-warn uppercase">
            Não cabem na chapa
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
            {nest.rejected.map((r) => (
              <li key={`${r.name}${r.w}`}>
                {r.name} — {r.w.toFixed(0)} × {r.h.toFixed(0)} mm (×{r.quantity})
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="space-y-3">
        {nest.sheets.map((s, i) => (
          <Panel key={i} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Chapa {String(i + 1).padStart(2, "0")} · {sheetLabel} mm
              </span>
              <span className="font-mono text-[11px] text-accent">
                {((s.usedMm2 / (nest.sheetW * nest.sheetH)) * 100).toFixed(1)}%
              </span>
            </div>
            <svg
              viewBox={`0 0 ${nest.sheetW} ${nest.sheetH}`}
              className="h-auto w-full rounded-lg bg-card/50"
              role="img"
              aria-label={`Plano de encaixe da chapa ${i + 1}`}
            >
              <rect
                x="0"
                y="0"
                width={nest.sheetW}
                height={nest.sheetH}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth={nest.sheetW / 500}
              />
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
                    strokeWidth={nest.sheetW / 700}
                  />
                  <text
                    x={p.x + p.w / 2}
                    y={p.y + p.h / 2}
                    fontSize={Math.max(12, Math.min(p.w, p.h) / 5)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    opacity="0.75"
                  >
                    {p.name.split("·").pop()?.trim().slice(0, 10)}
                    {p.rotated ? " ↻" : ""}
                  </text>
                </g>
              ))}
            </svg>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Panel className="p-3">
      <span className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </span>
      <p className="font-display text-xl">{value}</p>
      <p className="font-mono text-[10px] text-muted-foreground">{hint}</p>
    </Panel>
  );
}

/* ------------------------------------------------------------- custo */

type Costed = {
  part: ProductionPart;
  massKg: number;
  mat: number;
  fab: ReturnType<typeof fabricationCost>;
};

function CustoTab({
  costed,
  rates,
  setRates,
  thickness,
  setThickness,
  lossPct,
  setLossPct,
  materialId,
  setMaterialId,
  materials,
  totalMaterial,
  totalFab,
  setupTotal,
  money,
  weight,
}: {
  costed: Costed[];
  rates: MachineRates;
  setRates: (r: MachineRates) => void;
  thickness: number;
  setThickness: (n: number) => void;
  lossPct: number;
  setLossPct: (n: number) => void;
  materialId: string;
  setMaterialId: (id: string) => void;
  materials: { id: string; name: string }[];
  totalMaterial: number;
  totalFab: number;
  setupTotal: number;
  money: (v: number) => string;
  weight: (kg: number) => string;
}) {
  const rate = (key: keyof MachineRates, label: string, suffix: string) => (
    <Field
      key={key}
      label={label}
      value={rates[key]}
      onChange={(n) => setRates({ ...rates, [key]: n })}
      suffix={suffix}
      step={0.1}
    />
  );

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SectionLabel>Material do lote</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Material
            </span>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-card/60 px-2.5 py-1.5 text-sm outline-none"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Espessura"
            value={thickness}
            onChange={setThickness}
            suffix="mm"
            step={0.1}
          />
          <Field label="Perda" value={lossPct} onChange={setLossPct} suffix="%" step={1} />
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionLabel>Tarifas de fabricação</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          {rate("cutPerMeter", "Corte", "/m")}
          {rate("pierce", "Perfuração", "/furo")}
          {rate("bendPerBend", "Dobra", "/dobra")}
          {rate("weldPerMeter", "Solda", "/m")}
          {rate("laborPerHour", "Mão de obra", "/h")}
          {rate("setup", "Setup do lote", "")}
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionLabel>Composição por peça</SectionLabel>
        {costed.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sem peças no lote.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="py-1.5 pr-2 font-normal">Peça</th>
                  <th className="py-1.5 pr-2 font-normal">Peso (un.)</th>
                  <th className="py-1.5 pr-2 font-normal">Tempo de corte</th>
                  <th className="py-1.5 pr-2 font-normal">Material</th>
                  <th className="py-1.5 pr-2 font-normal">Fabricação</th>
                  <th className="py-1.5 font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {costed.map((c) => (
                  <tr key={c.part.id} className="border-t border-line">
                    <td className="max-w-[180px] truncate py-1.5 pr-2">{c.part.name}</td>
                    <td className="py-1.5 pr-2 font-mono">{weight(c.massKg)}</td>
                    <td className="py-1.5 pr-2 font-mono text-muted-foreground">
                      {cutTimeMinutes(c.part.cutLengthMm * c.part.quantity, thickness).toFixed(1)}{" "}
                      min
                    </td>
                    <td className="py-1.5 pr-2 font-mono">{money(c.mat)}</td>
                    <td className="py-1.5 pr-2 font-mono">{money(c.fab.total)}</td>
                    <td className="py-1.5 font-mono text-accent">{money(c.mat + c.fab.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Material" value={money(totalMaterial)} hint="com perda" />
        <Stat label="Fabricação" value={money(totalFab - setupTotal)} hint="sem setup" />
        <Stat label="Setup" value={money(setupTotal)} hint="uma vez por lote" />
        <Stat label="Custo total" value={money(totalMaterial + totalFab)} hint="lote completo" />
      </div>
    </div>
  );
}

/* --------------------------------------------------------- orçamento */

function OrcamentoTab({
  quote,
  setQuote,
  money,
  onSync,
  region,
}: {
  quote: Quote;
  setQuote: React.Dispatch<React.SetStateAction<Quote>>;
  money: (v: number) => string;
  onSync: () => void;
  region: import("@/lib/regional/regional").Region;
}) {
  const t = quoteTotals(quote);

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SectionLabel
          action={
            <button
              onClick={onSync}
              className="flex items-center gap-1 rounded-xl border border-line px-2 py-1 font-mono text-[10px] uppercase"
            >
              <RefreshCw className="size-3" /> Puxar do custo
            </button>
          }
        >
          Itens
        </SectionLabel>
        {quote.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Toque em “Puxar do custo” para trazer as peças calculadas.
          </p>
        ) : (
          <ul className="space-y-1 text-[12px]">
            {quote.items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between border-b border-line py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate">{i.description}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {i.detail}
                  </span>
                </span>
                <span className="ml-3 shrink-0 font-mono">
                  ×{i.quantity} · {money(i.materialCost + i.fabricationCost)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="space-y-2 p-4">
          <SectionLabel>Fornecedor</SectionLabel>
          <TextField
            label="Nome"
            value={quote.supplier.name}
            onChange={(v) => setQuote((q) => ({ ...q, supplier: { ...q.supplier, name: v } }))}
          />
          <TextField
            label="Documento"
            value={quote.supplier.document}
            onChange={(v) => setQuote((q) => ({ ...q, supplier: { ...q.supplier, document: v } }))}
          />
          <TextField
            label="Contato"
            value={quote.supplier.contact}
            onChange={(v) => setQuote((q) => ({ ...q, supplier: { ...q.supplier, contact: v } }))}
          />
        </Panel>
        <Panel className="space-y-2 p-4">
          <SectionLabel>Cliente</SectionLabel>
          <TextField
            label="Nome"
            value={quote.customer.name}
            onChange={(v) => setQuote((q) => ({ ...q, customer: { ...q.customer, name: v } }))}
          />
          <TextField
            label="Documento"
            value={quote.customer.document}
            onChange={(v) => setQuote((q) => ({ ...q, customer: { ...q.customer, document: v } }))}
          />
          <TextField
            label="Contato"
            value={quote.customer.contact}
            onChange={(v) => setQuote((q) => ({ ...q, customer: { ...q.customer, contact: v } }))}
          />
        </Panel>
      </div>

      <Panel className="p-4">
        <SectionLabel>Condições</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field
            label="Margem"
            value={quote.marginPct}
            onChange={(n) => setQuote((q) => ({ ...q, marginPct: n }))}
            suffix="%"
          />
          <Field
            label="Desconto"
            value={quote.discountPct}
            onChange={(n) => setQuote((q) => ({ ...q, discountPct: n }))}
            suffix="%"
          />
          <Field
            label={region.taxLabel}
            value={quote.taxPct}
            onChange={(n) => setQuote((q) => ({ ...q, taxPct: n }))}
            suffix="%"
          />
          <Field
            label="Validade"
            value={quote.validityDays}
            onChange={(n) => setQuote((q) => ({ ...q, validityDays: n }))}
            suffix="dias"
          />
        </div>
        <label className="mt-3 block">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Observações
          </span>
          <textarea
            value={quote.notes}
            onChange={(e) => setQuote((q) => ({ ...q, notes: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-xl border border-line bg-card/60 px-2.5 py-1.5 text-sm outline-none"
          />
        </label>
      </Panel>

      <Panel className="p-4">
        <div className="space-y-1 text-[13px]">
          <Line label="Material" value={money(t.material)} />
          <Line label="Fabricação" value={money(t.fabrication)} />
          <Line label={`Margem (${quote.marginPct}%)`} value={money(t.margin)} />
          {quote.discountPct > 0 && <Line label="Desconto" value={`− ${money(t.discount)}`} />}
          {quote.taxPct > 0 && <Line label={region.taxLabel} value={money(t.tax)} />}
          <div className="flex items-center justify-between border-t border-line pt-2 font-display text-lg">
            <span>Total</span>
            <span className="text-accent">{money(t.total)}</span>
          </div>
        </div>
        <button
          disabled={quote.items.length === 0}
          onClick={() => {
            const doc = quotePdf(quote, region);
            doc.save(quoteFilename(quote));
            toast.success("Orçamento gerado.");
          }}
          className="brand-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-[11px] tracking-[0.18em] text-background uppercase disabled:opacity-40"
        >
          <FileText className="size-3.5" /> Baixar orçamento PDF
        </button>
      </Panel>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------- ficha */

function FichaTab({
  costed,
  thickness,
  materialName,
  region,
  money,
}: {
  costed: Costed[];
  thickness: number;
  materialName: string;
  region: import("@/lib/regional/regional").Region;
  money: (v: number) => string;
}) {
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState("");

  const generate = async (c: Costed) => {
    setBusy(c.part.id);
    try {
      const code = `CAL-${c.part.id.slice(-6).toUpperCase()}`;
      const doc = await jobSheetPdf(
        {
          code,
          piece: c.part.name,
          project: projectName,
          material: materialName,
          thicknessMm: thickness,
          quantity: c.part.quantity,
          massKg: c.massKg,
          costTotal: c.mat + c.fab.total,
          conference: [
            { label: "Largura envolvente", value: `${c.part.w.toFixed(1)} mm` },
            { label: "Altura envolvente", value: `${c.part.h.toFixed(1)} mm` },
            { label: "Comprimento de corte", value: `${c.part.cutLengthMm.toFixed(1)} mm` },
            { label: "Perfurações", value: String(c.part.pierces) },
            { label: "Dobras", value: String(c.part.bends) },
            { label: "Custo do lote", value: money(c.mat + c.fab.total) },
          ],
          steps: [
            "Conferir a chapa: material, espessura e ausência de empeno.",
            "Riscar/posicionar conforme o plano de encaixe da chapa.",
            "Cortar seguindo a sequência do CHAMFER (furos internos antes do contorno).",
            c.part.bends > 0 ? "Dobrar na sequência marcada, conferindo ângulo a cada dobra." : "",
            "Conferir as medidas acima antes de liberar a peça.",
          ].filter(Boolean),
          qrPayload: `${typeof window !== "undefined" ? window.location.origin : ""}/oficina?peca=${encodeURIComponent(code)}`,
        },
        region,
      );
      doc.save(`ficha-${code}.pdf`);
      toast.success("Ficha gerada.");
    } catch {
      toast.error("Não foi possível gerar a ficha.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Panel className="p-4">
      <SectionLabel>Ficha de produção</SectionLabel>
      <TextField
        label="Projeto / OS"
        value={projectName}
        onChange={setProjectName}
        placeholder="Obra, cliente ou nº da OS"
      />
      {costed.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem peças no lote.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {costed.map((c) => (
            <li
              key={c.part.id}
              className="flex items-center justify-between gap-3 border-b border-line py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{c.part.name}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">
                  {c.part.w.toFixed(0)} × {c.part.h.toFixed(0)} mm · ×{c.part.quantity}
                </span>
              </span>
              <button
                onClick={() => void generate(c)}
                disabled={busy === c.part.id}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase disabled:opacity-50"
              >
                <QrCode className="size-3.5" /> Ficha + QR
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------- nuvem */

function NuvemTab({ projects, onRefresh }: { projects: Project[]; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [versions, setVersions] = useState<CloudVersion[]>([]);

  const loadVersions = async (id: string) => {
    setSelected(id);
    try {
      setVersions(await listVersions(id));
    } catch {
      setVersions([]);
    }
  };

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <SectionLabel>Sincronizar</SectionLabel>
        <p className="text-sm text-muted-foreground">
          O aparelho continua funcionando offline. A nuvem guarda uma cópia e o mais recente vence.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const s = await syncProjects();
              if (!s) toast.error("Entre na sua conta para usar a nuvem.");
              else {
                toast.success(`${s.uploaded} enviado(s) · ${s.downloaded} recebido(s).`);
                onRefresh();
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha na sincronização.");
            } finally {
              setBusy(false);
            }
          }}
          className="brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-[11px] tracking-[0.18em] text-background uppercase disabled:opacity-50"
        >
          <Cloud className="size-3.5" /> {busy ? "Sincronizando…" : "Sincronizar projetos"}
        </button>
      </Panel>

      <Panel className="p-4">
        <SectionLabel>Versões</SectionLabel>
        {projects.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum projeto local.</p>
        ) : (
          <ul className="space-y-1.5">
            {projects.map((p) => (
              <li key={p.id} className="border-b border-line py-2">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => void loadVersions(p.id)} className="min-w-0 text-left">
                    <span className="block truncate text-sm">{p.name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleString("pt-BR")}
                    </span>
                  </button>
                  <button
                    onClick={async () => {
                      const label = window.prompt(
                        "Nome da versão",
                        new Date().toLocaleString("pt-BR"),
                      );
                      if (label === null) return;
                      try {
                        await saveVersion(p, label);
                        toast.success("Versão salva.");
                        void loadVersions(p.id);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha ao salvar versão.");
                      }
                    }}
                    className="shrink-0 rounded-xl border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase"
                  >
                    Salvar versão
                  </button>
                </div>
                {selected === p.id && (
                  <ul className="mt-2 space-y-1 pl-2">
                    {versions.length === 0 && (
                      <li className="font-mono text-[10px] text-muted-foreground uppercase">
                        Sem versões na nuvem
                      </li>
                    )}
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 text-[12px]"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">{v.label}</span>
                        <button
                          onClick={async () => {
                            const ok = await restoreVersion(v.id);
                            if (ok) {
                              toast.success("Versão restaurada.");
                              onRefresh();
                            } else toast.error("Não foi possível restaurar.");
                          }}
                          className="shrink-0 font-mono text-[10px] text-accent uppercase"
                        >
                          Restaurar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
