/**
 * ÁRVORE DO PROJETO + PROPRIEDADES.
 *
 * Conjunto → subconjunto → peça → ocorrência, derivados do resultado
 * canônico. A seleção é compartilhada com o 3D, o 2D e a lista de peças.
 */

import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { SolidInstance } from "@/lib/project-catalog/instances";
import type { CanonicalProject } from "@/lib/project-catalog/types";
import { cn } from "@/lib/utils";

type Props = {
  result: CanonicalProject;
  instances: SolidInstance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hidden: Set<string>;
  onToggleHidden: (partKey: string) => void;
};

export function ProjectTreePanel({
  result,
  instances,
  selectedId,
  onSelect,
  hidden,
  onToggleHidden,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ estrutura: true, degraus: true });
  const groups = result.assemblies.map((asm) => ({
    asm,
    subs: result.subassemblies.filter((s) => s.assemblyKey === asm.key),
    direct: result.parts.filter((p) => p.assemblyKey === asm.key && !p.subassemblyKey),
  }));
  const selInst = instances.find((i) => i.id === selectedId) ?? null;

  const PartRow = ({ partKey }: { partKey: string }) => {
    const part = result.parts.find((p) => p.key === partKey)!;
    const items = instances.filter((i) => i.partKey === partKey);
    const isOpen = open[`p:${partKey}`];
    const active = selInst?.partKey === partKey;
    return (
      <li>
        <div
          className={cn(
            "flex items-center gap-1 rounded px-1 py-1 text-xs",
            active && "bg-accent/10",
          )}
        >
          <button
            type="button"
            aria-label={isOpen ? "Recolher ocorrências" : "Expandir ocorrências"}
            onClick={() => setOpen((o) => ({ ...o, [`p:${partKey}`]: !isOpen }))}
            className="text-muted-foreground"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
          </button>
          <button
            type="button"
            onClick={() => onSelect(items[0]?.id ?? null)}
            className="flex-1 text-left"
          >
            <span className="font-mono text-accent">{part.codeSuffix}</span> {part.name}
            <span className="ml-1 text-muted-foreground">×{part.quantity}</span>
          </button>
          <button
            type="button"
            aria-label={hidden.has(partKey) ? "Mostrar peça" : "Ocultar peça"}
            onClick={() => onToggleHidden(partKey)}
            className="text-muted-foreground hover:text-accent"
          >
            {hidden.has(partKey) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        {isOpen && (
          <ul className="ml-6 border-l border-line pl-2">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onSelect(i.id)}
                  className={cn(
                    "w-full rounded px-1 py-0.5 text-left font-mono text-[11px] text-muted-foreground",
                    i.id === selectedId && "bg-accent/15 text-accent",
                  )}
                >
                  {i.code}-{String(i.index).padStart(2, "0")} · {i.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
      <div className="max-h-[320px] overflow-auto rounded-xl border border-line bg-background/40 p-2">
        <p className="t-eyebrow mb-1">{result.modelName}</p>
        <ul className="space-y-1">
          {groups.map(({ asm, subs, direct }) => (
            <li key={asm.key}>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [asm.key]: !o[asm.key] }))}
                className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-xs font-medium"
              >
                <ChevronRight
                  className={cn("size-3.5 transition-transform", open[asm.key] && "rotate-90")}
                />
                {asm.name}
              </button>
              {open[asm.key] && (
                <ul className="ml-4 space-y-0.5 border-l border-line pl-2">
                  {direct.map((p) => (
                    <PartRow key={p.key} partKey={p.key} />
                  ))}
                  {subs.map((s) => (
                    <li key={s.key}>
                      <p className="px-1 py-1 text-[11px] text-muted-foreground">{s.name}</p>
                      <ul className="ml-2 space-y-0.5 border-l border-line pl-2">
                        {result.parts
                          .filter((p) => p.subassemblyKey === s.key)
                          .map((p) => (
                            <PartRow key={p.key} partKey={p.key} />
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-line bg-background/40 p-3 text-xs">
        <p className="t-eyebrow mb-2">Propriedades</p>
        {!selInst ? (
          <p className="text-muted-foreground">Selecione uma peça no 3D, no 2D ou na árvore.</p>
        ) : (
          (() => {
            const part = result.parts.find((p) => p.key === selInst.partKey)!;
            const asm = result.assemblies.find((a) => a.key === part.assemblyKey);
            const sub = result.subassemblies.find((s) => s.key === part.subassemblyKey);
            const step = result.steps.findIndex((s) => s.partKeys.includes(part.key));
            const rows: [string, string][] = [
              ["Código", `${part.codeSuffix} · ${String(selInst.index).padStart(2, "0")}`],
              ["Nome", part.name],
              ["Quantidade", `${part.quantity} un`],
              ["Material", part.material],
              ["Espessura/perfil", `${part.thickness} mm`],
              [
                "Dimensões",
                `${part.dimensions.length.toFixed(0)} × ${part.dimensions.width.toFixed(0)} × ${part.thickness} mm`,
              ],
              ["Conjunto", asm?.name ?? "—"],
              ["Subconjunto", sub?.name ?? "—"],
              ["Etapa de fabricação", `${part.stage} · ${part.process}`],
              ["Etapa de montagem", step >= 0 ? `${step + 1} · ${result.steps[step]!.title}` : "—"],
              ["Status", part.fabricable ? "Fabricável (CNC)" : "Componente não-CNC"],
            ];
            return (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            );
          })()
        )}
      </div>
    </div>
  );
}
