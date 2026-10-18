import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Boxes,
  Layers,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  LIBRARY_CATEGORIES,
  LIBRARY_ITEMS,
  type LibraryCategory,
} from "@/lib/library/catalog";
import {
  addCustomCostaFerroMaterial,
  COSTA_FERRO_OPERATIONS,
  getAllCostaFerroHardware,
  getAllCostaFerroMaterials,
  savePriceOverride,
  type CostaFerroLayer,
  type CostaFerroMaterialCategory,
} from "@/lib/library/costaFerroCatalog";
import { Panel } from "@/components/chameleon/ui";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca Técnica & Catálogo Costa Ferro — CALDRA" },
      {
        name: "description",
        content:
          "Catálogo Técnico Costa Ferro (Tubos Metalon Quadrados, Retangulares, Redondos, Perfis, Chapas, Ferragens e Regras de Fabricação).",
      },
      { property: "og:title", content: "Biblioteca Técnica & Catálogo Costa Ferro — CALDRA" },
      {
        property: "og:description",
        content: "Referência técnica estruturada em 3 camadas para serralheria, caldeiraria e traçagem.",
      },
    ],
  }),
  component: Biblioteca,
});

const MATERIAL_CATEGORY_LABELS: { id: "TODAS" | CostaFerroMaterialCategory; label: string }[] = [
  { id: "TODAS", label: "Todos os Materiais" },
  { id: "TUBO_QUADRADO_METALON", label: "Metalon Quadrado (NBR 6591)" },
  { id: "TUBO_RETANGULAR_METALON", label: "Metalon Retangular (NBR 6591)" },
  { id: "TUBO_REDONDO_INDUSTRIAL", label: "Tubo Redondo Industrial" },
  { id: "TUBO_CONDUCAO_DIN_SCH", label: "Tubo DIN 2440 & Schedule" },
  { id: "PERFIL_ESTRUTURAL", label: "Perfis U & Vigas W/I" },
  { id: "CANTONEIRA_BARRA", label: "Cantoneiras & Barras Maciças" },
  { id: "CHAPA_ACO", label: "Chapas (Finas, Grossas, Xadrez, Lambril)" },
];

function Biblioteca() {
  const [activeLayer, setActiveLayer] = useState<CostaFerroLayer | "NORMAS">("A_MATERIAIS");
  const [matCategory, setMatCategory] = useState<"TODAS" | CostaFerroMaterialCategory>("TODAS");
  const [normCat, setNormCat] = useState<LibraryCategory | "Todas">("Todas");
  const [query, setQuery] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [addingCustom, setAddingCustom] = useState(false);

  // Estado do formulário de novo material personalizado
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] =
    useState<CostaFerroMaterialCategory>("TUBO_QUADRADO_METALON");
  const [customWidth, setCustomWidth] = useState(40);
  const [customHeight, setCustomHeight] = useState(40);
  const [customWall, setCustomWall] = useState(1.5);
  const [customKgM, setCustomKgM] = useState(1.88);
  const [customPrice, setCustomPrice] = useState(110);

  const materials = useMemo(() => {
    const all = getAllCostaFerroMaterials();
    return all.filter((m) => {
      const matchCat = matCategory === "TODAS" || m.category === matCategory;
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.subcategory.toLowerCase().includes(q) ||
        m.dimensionsMm.toLowerCase().includes(q) ||
        m.norm.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [matCategory, query, refreshTick]);

  const hardwareList = useMemo(() => {
    const all = getAllCostaFerroHardware();
    const q = query.trim().toLowerCase();
    return all.filter(
      (h) =>
        !q ||
        h.name.toLowerCase().includes(q) ||
        h.specification.toLowerCase().includes(q) ||
        h.application.toLowerCase().includes(q),
    );
  }, [query, refreshTick]);

  const operationsList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COSTA_FERRO_OPERATIONS.filter(
      (op) =>
        !q ||
        op.name.toLowerCase().includes(q) ||
        op.notes.toLowerCase().includes(q) ||
        op.norm.toLowerCase().includes(q),
    );
  }, [query]);

  const normItems = useMemo(
    () =>
      LIBRARY_ITEMS.filter(
        (i) =>
          (normCat === "Todas" || i.category === normCat) &&
          (i.title + i.detail).toLowerCase().includes(query.toLowerCase()),
      ),
    [query, normCat],
  );

  const handleAddCustomMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast.error("Informe o nome técnico do perfil ou chapa.");
      return;
    }
    const isSheet = customCategory === "CHAPA_ACO";
    const unitWeight = isSheet
      ? +(((customWidth * customHeight) / 1e6) * customWall * 7.85).toFixed(2)
      : +(customKgM * 6).toFixed(2);

    addCustomCostaFerroMaterial({
      category: customCategory,
      subcategory: "Item Personalizado da Oficina",
      name: customName.trim(),
      norm: "Padrão Oficina / Personalizado",
      dimensionsMm: `${customHeight}×${customWidth}×${customWall} mm`,
      widthMm: customWidth,
      heightMm: customHeight,
      wallThicknessMm: customWall,
      commercialLengthMm: isSheet ? undefined : 6000,
      sheetAreaMm: isSheet ? { widthMm: customWidth, lengthMm: customHeight } : undefined,
      linearWeightKgM: isSheet ? undefined : customKgM,
      areaWeightKgM2: isSheet ? +(customWall * 7.85).toFixed(2) : undefined,
      unitWeightKg: unitWeight,
      finish: "Preto",
      unitPriceBRL: customPrice,
      pricePerKgBRL: unitWeight > 0 ? +(customPrice / unitWeight).toFixed(2) : 9.8,
    });
    setRefreshTick((t) => t + 1);
    setAddingCustom(false);
    setCustomName("");
    toast.success("Material personalizado adicionado ao Catálogo Técnico!");
  };

  return (
    <div className="space-y-4">
      <NavigationAreaHeader
        badgeText="CATÁLOGO TÉCNICO COSTA FERRO · 3 CAMADAS CONECTADAS"
        badgeColor="text-amber-400"
        indicatorColor="bg-amber-400"
        title="Biblioteca Técnica & Catálogo Costa Ferro"
      />

      {/* Seletor das 3 Camadas da Biblioteca Técnica + Tabelas Normativas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-card/60 p-1">
          <button
            type="button"
            onClick={() => setActiveLayer("A_MATERIAIS")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold uppercase transition-colors",
              activeLayer === "A_MATERIAIS"
                ? "bg-accent text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Boxes className="size-3.5" />
            Camada A · Materiais Costa Ferro ({materials.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("B_FERRAGENS")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold uppercase transition-colors",
              activeLayer === "B_FERRAGENS"
                ? "bg-accent text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Wrench className="size-3.5" />
            Camada B · Ferragens & Acessórios ({hardwareList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("C_OPERACOES")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold uppercase transition-colors",
              activeLayer === "C_OPERACOES"
                ? "bg-accent text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings2 className="size-3.5" />
            Camada C · Operações & Limites ({operationsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("NORMAS")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold uppercase transition-colors",
              activeLayer === "NORMAS"
                ? "bg-accent text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers className="size-3.5" />
            Tabelas & Fórmulas de Bolso
          </button>
        </div>

        {activeLayer === "A_MATERIAIS" && (
          <button
            type="button"
            onClick={() => setAddingCustom((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 py-2 font-mono text-[10px] font-bold uppercase text-accent hover:bg-accent/25"
          >
            <Plus className="size-3.5" />
            Cadastrar Perfil / Chapa Personalizada
          </button>
        )}
      </div>

      {/* Formulário de Cadastro de Item Personalizado */}
      {addingCustom && activeLayer === "A_MATERIAIS" && (
        <Panel className="p-4 border-accent/40">
          <form onSubmit={handleAddCustomMaterial} className="space-y-3">
            <p className="font-mono text-xs font-bold uppercase text-accent">
              Novo Item Personalizado na Biblioteca da Oficina
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label className="block sm:col-span-2">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Nome / Designação
                </span>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ex: Metalon 70×40×2,00mm Especial"
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Categoria
                </span>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as CostaFerroMaterialCategory)}
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-1.5 text-xs outline-none"
                >
                  {MATERIAL_CATEGORY_LABELS.filter((c) => c.id !== "TODAS").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Parede / Esp. (mm)
                </span>
                <input
                  type="number"
                  step="0.05"
                  value={customWall}
                  onChange={(e) => setCustomWall(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2.5 py-1.5 font-mono text-xs outline-none"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Peso Linear (kg/m)
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={customKgM}
                  onChange={(e) => setCustomKgM(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2.5 py-1.5 font-mono text-xs outline-none"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Preço Barra/Chapa (R$)
                </span>
                <input
                  type="number"
                  step="1"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2.5 py-1.5 font-mono text-xs outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddingCustom(false)}
                className="rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-1.5 font-mono text-[10px] font-bold uppercase text-background"
              >
                Salvar na Biblioteca
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Barra de Busca */}
      <label className="glass flex items-center gap-2 rounded-xl px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar bitola (ex: 50x30, 20x20, 4.75mm, Sch 40, roldana, lambril)…"
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </label>

      {/* =================================================================== */}
      {/* CAMADA A: MATERIAIS COMERCIAIS COSTA FERRO                          */}
      {/* =================================================================== */}
      {activeLayer === "A_MATERIAIS" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {MATERIAL_CATEGORY_LABELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setMatCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  matCategory === c.id
                    ? "bg-accent/15 text-accent ring-1 ring-accent/30 font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-card/70">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-muted/40 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3.5 py-2.5">Material / Bitola Comercial</th>
                  <th className="px-3 py-2.5">Norma / Origem</th>
                  <th className="px-3 py-2.5 text-right">Parede (mm)</th>
                  <th className="px-3 py-2.5 text-right">Massa Linear / Área</th>
                  <th className="px-3 py-2.5 text-right">Fornecimento</th>
                  <th className="px-3 py-2.5 text-right">Peso Unit.</th>
                  <th className="px-3.5 py-2.5 text-right">Preço Editável (R$)</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-t border-line/60 hover:bg-muted/20">
                    <td className="px-3.5 py-2.5">
                      <p className="font-display font-semibold text-foreground">{m.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {m.subcategory} · {m.dimensionsMm} {m.finish ? `· ${m.finish}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      <span>{m.norm}</span>
                      <span className="block text-[10px] text-accent">{m.origin}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">
                      {m.wallThicknessMm.toFixed(2)} mm
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-accent font-semibold">
                      {m.linearWeightKgM
                        ? `${m.linearWeightKgM.toFixed(2)} kg/m`
                        : `${m.areaWeightKgM2?.toFixed(2)} kg/m²`}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px]">
                      {m.commercialLengthMm
                        ? `Barra ${m.commercialLengthMm} mm`
                        : m.sheetAreaMm
                          ? `Chapa ${m.sheetAreaMm.lengthMm}×${m.sheetAreaMm.widthMm} mm`
                          : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {m.unitWeightKg.toFixed(2)} kg
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">
                      <input
                        type="number"
                        step="0.5"
                        defaultValue={m.unitPriceBRL}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v) && v > 0) {
                            savePriceOverride(m.id, v);
                            setRefreshTick((t) => t + 1);
                            toast.success(`Preço de "${m.name}" atualizado!`);
                          }
                        }}
                        className="w-24 rounded-lg border border-line bg-background px-2 py-1 text-right font-mono text-xs font-bold text-foreground outline-none focus:border-accent"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* CAMADA B: COMPONENTES E FERRAGENS DE MONTAGEM                       */}
      {/* =================================================================== */}
      {activeLayer === "B_FERRAGENS" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hardwareList.map((hw) => (
            <Panel key={hw.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[9.5px] uppercase text-accent">
                    {hw.category.replace(/_/g, " ")} · {hw.origin}
                  </span>
                  <h3 className="font-display text-sm font-semibold text-foreground mt-0.5">
                    {hw.name}
                  </h3>
                </div>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">{hw.specification}</p>
              <p className="text-xs text-muted-foreground">{hw.application}</p>
              <div className="flex items-center justify-between border-t border-line pt-2.5 font-mono text-xs">
                <span className="text-muted-foreground">
                  Massa: <strong>{hw.unitWeightKg} kg</strong>/{hw.unit}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">R$:</span>
                  <input
                    type="number"
                    step="0.5"
                    defaultValue={hw.unitPriceBRL}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v > 0) {
                        savePriceOverride(hw.id, v);
                        setRefreshTick((t) => t + 1);
                        toast.success(`Preço de "${hw.name}" salvo!`);
                      }
                    }}
                    className="w-20 rounded-lg border border-line bg-background px-2 py-1 text-right font-mono text-xs font-bold text-accent outline-none focus:border-accent"
                  />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* CAMADA C: OPERAÇÕES E LIMITES DE FABRICAÇÃO                         */}
      {/* =================================================================== */}
      {activeLayer === "C_OPERACOES" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {operationsList.map((op) => (
            <Panel key={op.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase text-accent">{op.norm}</span>
                <span className="font-mono text-xs font-bold text-foreground">
                  Taxa Ref.: R$ {op.defaultHourlyRateBRL.toFixed(2)}/h
                </span>
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{op.name}</h3>
              <p className="text-xs text-muted-foreground">{op.notes}</p>
              <div className="grid grid-cols-3 gap-2 border-t border-line pt-2 font-mono text-[11px]">
                <div>
                  <span className="block text-[9.5px] text-muted-foreground uppercase">
                    Perda de Corte (Kerf)
                  </span>
                  <strong>{op.kerfMm.toFixed(1)} mm</strong>
                </div>
                <div>
                  <span className="block text-[9.5px] text-muted-foreground uppercase">
                    Faixa de Espessura
                  </span>
                  <strong>
                    {op.minThicknessMm} a {op.maxThicknessMm} mm
                  </strong>
                </div>
                <div>
                  <span className="block text-[9.5px] text-muted-foreground uppercase">
                    Ângulos Suportados
                  </span>
                  <strong>{op.supportedAnglesDeg.map((a) => `${a}°`).join(" · ")}</strong>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* TABELAS E FÓRMULAS RÁPIDAS DE CALDEIRARIA                           */}
      {/* =================================================================== */}
      {activeLayer === "NORMAS" && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(["Todas", ...LIBRARY_CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setNormCat(c)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
                  normCat === c
                    ? "bg-accent/12 text-accent ring-1 ring-accent/20"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {normItems.map((item) => (
              <Panel key={item.id} className="p-3.5">
                <p className="font-display text-[13px] font-medium">{item.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
                <dl className="mt-3 space-y-1 border-t border-line pt-2 font-mono text-[11px]">
                  {item.data.map((d, idx) => (
                    <div key={`${d.label}-${d.value}-${idx}`} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{d.label}</dt>
                      <dd>{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
