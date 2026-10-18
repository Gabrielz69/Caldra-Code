import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORY_LABEL,
  PART_REGISTRY,
  type PartCategory,
  type PartModel,
} from "@/lib/library/registry";
import { cn } from "@/lib/utils";

/**
 * Escolha de peça REUTILIZANDO a biblioteca da Traçagem.
 * Nunca cria um segundo catálogo: lê o mesmo `PART_REGISTRY`.
 */

const TABS: Array<{ id: "todas" | PartCategory; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "caldeiraria", label: CATEGORY_LABEL.caldeiraria },
  { id: "tubulacoes", label: CATEGORY_LABEL.tubulacoes },
  { id: "cnc2d", label: CATEGORY_LABEL.cnc2d },
];

export function AddPartDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (model: PartModel) => void;
}) {
  const [tab, setTab] = useState<"todas" | PartCategory>("todas");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return PART_REGISTRY.filter((p) => tab === "todas" || p.category === tab).filter((p) =>
      !term
        ? true
        : p.name.toLowerCase().includes(term) ||
          p.family.toLowerCase().includes(term) ||
          p.tags.some((t) => t.includes(term)),
    );
  }, [tab, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] w-[min(90vw,640px)] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Adicionar peça</DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar peça..."
            className="w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider uppercase",
                  tab === t.id
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onPick(p)}
                  className="w-full px-1 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]"
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="t-caption truncate">
                    {CATEGORY_LABEL[p.category]} · {p.family} · {p.summary}
                  </p>
                </button>
              </li>
            ))}
            {!list.length && (
              <li className="py-8 text-center">
                <p className="t-caption">Nenhuma peça encontrada.</p>
              </li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
