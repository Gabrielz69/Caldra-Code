import type { CanonicalProject } from "@/lib/project-catalog/types";
import { cn } from "@/lib/utils";

export function ProjectBreakdown({
  result,
  selectedPartKey = null,
  onSelectPart,
}: {
  result: CanonicalProject;
  selectedPartKey?: string | null;
  onSelectPart?: (key: string) => void;
}) {
  const mass = result.parts.reduce(
    (sum, p) =>
      sum + ((p.dimensions.length * p.dimensions.width * p.thickness) / 1e9) * 7850 * p.quantity,
    0,
  );
  const cards: [string, string | number][] = [
    ["Peças", result.parts.reduce((s, p) => s + p.quantity, 0) + " un"],
    ["Conjuntos", result.assemblies.length],
    ["Fabricáveis", result.parts.filter((p) => p.fabricable).length],
    ["Massa estimada", mass.toFixed(1) + " kg"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-background/40 p-3">
            <p className="t-eyebrow">{l}</p>
            <p className="mt-1 font-mono text-lg">{v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="font-mono text-[9px] uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Código</th>
              <th>Peça</th>
              <th>Qtd</th>
              <th>Material</th>
              <th>Dimensões</th>
              <th>Processo</th>
            </tr>
          </thead>
          <tbody>
            {result.parts.map((p) => (
              <tr
                key={p.key}
                onClick={() => onSelectPart?.(p.key)}
                className={cn(
                  "cursor-pointer border-t border-line",
                  selectedPartKey === p.key && "bg-accent/10",
                )}
              >
                <td className="py-2 font-mono">{p.codeSuffix}</td>
                <td>
                  {p.name}
                  <span className="block text-[10px] text-muted-foreground">{p.role}</span>
                </td>
                <td>{p.quantity}</td>
                <td>{p.material}</td>
                <td className="font-mono">
                  {p.dimensions.length.toFixed(0)} × {p.dimensions.width.toFixed(0)} × {p.thickness}{" "}
                  mm
                </td>
                <td>{p.fabricable ? p.process : `${p.process} · não-CNC`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="t-eyebrow mb-2">Sequência de montagem</p>
        <ol className="grid gap-2 sm:grid-cols-2">
          {result.steps.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-line bg-background/40 p-3">
              <span className="font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-sm">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-muted-foreground">
        {result.warnings[0]}
      </div>
    </div>
  );
}
