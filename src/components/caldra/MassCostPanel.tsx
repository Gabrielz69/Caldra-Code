import { useMemo } from "react";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { formatBRL, formatMass, materialCostBRL, plateMassKg } from "@/lib/geometry/mass";
import { SmartNumberInput } from "./SmartNumberInput";
import { SectionLabel } from "./ui";
import { cn } from "@/lib/utils";

/**
 * PESO E CUSTO EM TEMPO REAL — material, espessura, quantidade e perda.
 * Somente custo de MATERIAL.
 */
export function MassCostPanel({
  areaMm2,
  materialId,
  onMaterialId,
  thickness,
  onThickness,
  quantity,
  onQuantity,
}: {
  areaMm2: number;
  materialId: string;
  onMaterialId: (id: string) => void;
  thickness: number;
  onThickness: (mm: number) => void;
  quantity: number;
  onQuantity: (n: number) => void;
}) {
  const { visible, get, lossPct, setLossPct, defaultMaterialId } = useMaterials();
  const material = get(materialId) ?? get(defaultMaterialId) ?? visible[0];

  const { massKg, cost } = useMemo(() => {
    const density = material?.density ?? 7850;
    const unit = plateMassKg(areaMm2, thickness, density);
    return {
      massKg: unit,
      cost: materialCostBRL({
        massKg: unit,
        pricePerKg: material?.pricePerKg ?? 0,
        quantity,
        lossPct,
      }),
    };
  }, [areaMm2, thickness, material, quantity, lossPct]);

  return (
    <div className="rounded-xl border border-line bg-background/40 p-3">
      <SectionLabel>Peso e custo de material</SectionLabel>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">Material</span>
          <select
            value={material?.id ?? ""}
            onChange={(e) => onMaterialId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {visible.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.density} kg/m³
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">Espessura</span>
          <span className="mt-1 block">
            <SmartNumberInput
              value={thickness}
              onChange={onThickness}
              ariaLabel="Espessura da chapa"
            />
          </span>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(material?.thicknesses ?? []).map((t) => (
          <button
            key={t}
            onClick={() => onThickness(t)}
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
              Math.abs(t - thickness) < 1e-9
                ? "border-accent/40 bg-accent/12 text-accent"
                : "border-line text-muted-foreground hover:text-foreground",
            )}
          >
            {t.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">Quantidade</span>
          <input
            inputMode="numeric"
            value={String(quantity)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && n >= 0) onQuantity(n);
            }}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">Perda (%)</span>
          <input
            inputMode="decimal"
            value={String(lossPct)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && n >= 0) setLossPct(n);
            }}
            className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-accent/25 bg-accent/8 p-2.5">
          <p className="font-mono text-[9px] text-muted-foreground uppercase">Peso unitário</p>
          <p className="mt-0.5 font-mono text-[16px] text-accent">{formatMass(massKg)}</p>
          <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
            total {formatMass(massKg * quantity)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-background/50 p-2.5">
          <p className="font-mono text-[9px] text-muted-foreground uppercase">Custo do material</p>
          <p className="mt-0.5 font-mono text-[16px]">{formatBRL(cost)}</p>
          <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
            {quantity} un · perda {lossPct}% · {formatBRL(material?.pricePerKg ?? 0)}/kg
          </p>
        </div>
      </div>
    </div>
  );
}
