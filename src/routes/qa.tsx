import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import type { QaCase } from "@/lib/qa/suite";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qa")({
  head: () => ({
    meta: [
      { title: "Modo QA — verificação de cálculo | CALDRA" },
      {
        name: "description",
        content:
          "Bateria interna de verificação dos módulos de cálculo do CALDRA: casos de referência com esperado × obtido.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Modo QA — CALDRA" },
      {
        property: "og:description",
        content: "Verificação automática das fórmulas de traçagem antes de publicar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QaPage,
});

const fmt = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
    : "—";

function QaPage() {
  const [cases, setCases] = useState<QaCase[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    /* code-splitting: a suíte só entra no bundle quando o QA é aberto */
    const mod = await import("@/lib/qa/suite");
    setCases(mod.runQaSuite());
    setRunning(false);
  };

  useEffect(() => {
    void run();
  }, []);

  const passed = cases?.filter((c) => c.ok).length ?? 0;
  const total = cases?.length ?? 0;
  const failures = cases?.filter((c) => !c.ok) ?? [];

  const copyFailures = async () => {
    const text = failures
      .map(
        (c) =>
          `${c.group} · ${c.name} → esperado ${fmt(c.expected)} ${c.unit}, obtido ${fmt(c.actual)} ${c.unit} (tol ${fmt(c.tolerance)})`,
      )
      .join("\n");
    await navigator.clipboard.writeText(text || "Sem falhas.");
    toast.success("Falhas copiadas.");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Modo QA</h1>
      </header>

      <Panel className="p-4">
        <SectionLabel
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => void run()}
                className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase"
              >
                <RefreshCw className={cn("size-3", running && "animate-spin")} /> Rodar
              </button>
              {failures.length > 0 && (
                <button
                  onClick={() => void copyFailures()}
                  className="flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 font-mono text-[10px] text-destructive uppercase"
                >
                  <Copy className="size-3" /> Copiar falhas
                </button>
              )}
            </div>
          }
        >
          Resultado
        </SectionLabel>
        <p
          className={cn(
            "font-mono text-3xl",
            total > 0 && passed === total ? "text-accent" : "text-destructive",
          )}
        >
          {running ? "…" : `${passed}/${total} OK`}
        </p>
      </Panel>

      <Panel className="overflow-hidden">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="bg-card text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-normal">Caso</th>
              <th className="px-3 py-2 text-right font-normal">Esperado</th>
              <th className="px-3 py-2 text-right font-normal">Obtido</th>
            </tr>
          </thead>
          <tbody>
            {(cases ?? []).map((c, i) => (
              <tr
                key={`${c.group}-${c.name}-${i}`}
                className={cn("border-t border-line", !c.ok && "bg-destructive/10")}
              >
                <td className="px-3 py-1.5">
                  <span className={cn("mr-2", c.ok ? "text-accent" : "text-destructive")}>
                    {c.ok ? "●" : "✕"}
                  </span>
                  <span className="text-muted-foreground">{c.group}</span> · {c.name}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {fmt(c.expected)} {c.unit}
                </td>
                <td className={cn("px-3 py-1.5 text-right", !c.ok && "text-destructive")}>
                  {fmt(c.actual)} {c.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
