import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import type { Material } from "@/lib/materials/types";
import { DEFAULT_THICKNESSES } from "@/lib/materials/types";
import { Panel, SectionLabel } from "./ui";
import { cn } from "@/lib/utils";

/** MEUS MATERIAIS — CRUD offline-first (IndexedDB). */
export function MaterialManager() {
  const { materials, ready, upsert, remove, create, lossPct, setLossPct } = useMaterials();
  const [openId, setOpenId] = useState<string | null>(null);

  const add = async () => {
    const m = await create();
    setOpenId(m.id);
  };

  return (
    <Panel className="space-y-3 p-4">
      <SectionLabel
        action={
          <button
            onClick={() => void add()}
            className="flex items-center gap-1 rounded-lg border border-accent/40 px-2.5 py-1.5 font-mono text-[10px] text-accent uppercase"
          >
            <Plus className="size-3" /> Novo
          </button>
        }
      >
        Meus materiais
      </SectionLabel>
      <p className="text-xs text-muted-foreground">
        Salvos no aparelho — funcionam sem internet. Os padrões podem ser editados e ocultados, mas
        não excluídos.
      </p>

      <label className="block max-w-[220px]">
        <span className="font-mono text-[10px] text-muted-foreground uppercase">
          Perda padrão (%)
        </span>
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

      {!ready && <p className="font-mono text-[10px] text-muted-foreground">carregando…</p>}

      <div className="space-y-2">
        {materials.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-xl border border-line bg-background/40 p-3",
              m.hidden && "opacity-55",
            )}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenId(openId === m.id ? null : m.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm">{m.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {m.density} kg/m³ · R$ {m.pricePerKg}/kg · {m.thicknesses.length} espessuras
                  {m.builtIn ? " · padrão" : ""}
                </p>
              </button>
              <button
                aria-label={m.hidden ? "Mostrar material" : "Ocultar material"}
                onClick={() => void upsert({ ...m, hidden: !m.hidden })}
                className="rounded-lg border border-line p-2 text-muted-foreground"
              >
                {m.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              {!m.builtIn && (
                <button
                  aria-label="Excluir material"
                  onClick={() => {
                    void remove(m.id);
                    toast.success("Material excluído.");
                  }}
                  className="rounded-lg border border-destructive/40 p-2 text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>

            {openId === m.id && <Editor material={m} onSave={(next) => void upsert(next)} />}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Editor({ material, onSave }: { material: Material; onSave: (m: Material) => void }) {
  const [draft, setDraft] = useState<Material>(material);
  const [thick, setThick] = useState(draft.thicknesses.join(" / "));

  const commit = (next: Material) => {
    setDraft(next);
    onSave(next);
  };

  return (
    <div className="mt-3 space-y-2.5 border-t border-line pt-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Text label="Nome" value={draft.name} onChange={(v) => commit({ ...draft, name: v })} />
        <Num
          label="Densidade (kg/m³)"
          value={draft.density}
          onChange={(v) => commit({ ...draft, density: v })}
        />
        <Num
          label="Preço (R$/kg)"
          value={draft.pricePerKg}
          onChange={(v) => commit({ ...draft, pricePerKg: v })}
        />
        <Text
          label="Observação"
          value={draft.note ?? ""}
          onChange={(v) => commit({ ...draft, note: v })}
        />
      </div>
      <label className="block">
        <span className="font-mono text-[10px] text-muted-foreground uppercase">
          Espessuras comerciais (mm, separadas por / )
        </span>
        <input
          value={thick}
          onChange={(e) => setThick(e.target.value)}
          onBlur={() => {
            const list = thick
              .split(/[/,;]/)
              .map((s) => Number(s.trim().replace(",", ".")))
              .filter((n) => Number.isFinite(n) && n > 0)
              .sort((a, b) => a - b);
            const next = list.length ? list : DEFAULT_THICKNESSES;
            setThick(next.join(" / "));
            commit({ ...draft, thicknesses: next });
          }}
          className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] text-muted-foreground uppercase">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] text-muted-foreground uppercase">{label}</span>
      <input
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        className="mt-1 w-full rounded-lg border border-line bg-background/50 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
