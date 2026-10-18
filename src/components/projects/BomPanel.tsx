import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Layers } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { bomCsv, projectBom } from "@/lib/projects/bom";
import type { Project } from "@/lib/projects/store";

const n = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Lista de materiais e de corte derivada das peças do projeto. */
export function BomPanel({ project }: { project: Project }) {
  const { materials } = useMaterials();
  const bom = useMemo(() => projectBom(project, materials), [project, materials]);

  if (project.parts.length === 0) return null;

  const download = () => {
    const blob = new Blob([`\uFEFF${bomCsv(project, bom)}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.code ?? project.name}-lista-materiais.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          <div className="flex items-center gap-1.5">
            <Link
              to="/planificacao"
              search={{ projeto: project.id }}
              aria-label="Planificar peças deste projeto"
              className="grid size-7 place-items-center rounded-lg text-accent ring-1 ring-accent/25"
            >
              <Layers className="size-3.5" />
            </Link>
            <button
              onClick={download}
              aria-label="Baixar lista de materiais"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground ring-1 ring-border"
            >
              <Download className="size-3.5" />
            </button>
          </div>
        }
      >
        Lista de materiais
      </SectionLabel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cell label="Peças" value={`${bom.lines.reduce((s, l) => s + l.quantity, 0)} un`} />
        <Cell label="Área desenvolvida" value={`${n(bom.totalAreaM2, 3)} m²`} />
        <Cell label="Massa total" value={`${n(bom.totalMassKg, 2)} kg`} />
        <Cell
          label="Custo estimado"
          value={bom.totalCost > 0 ? `R$ ${n(bom.totalCost, 2)}` : "—"}
        />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="font-mono text-[10px] text-muted-foreground uppercase">
            <tr>
              <th className="py-1.5 pr-3 font-normal">Material</th>
              <th className="py-1.5 pr-3 font-normal">Esp.</th>
              <th className="py-1.5 pr-3 font-normal">Qtd</th>
              <th className="py-1.5 pr-3 font-normal">Área</th>
              <th className="py-1.5 font-normal">Massa</th>
            </tr>
          </thead>
          <tbody>
            {bom.groups.map((g) => (
              <tr key={g.key} className="border-t border-line">
                <td className="py-2 pr-3">{g.material}</td>
                <td className="py-2 pr-3 font-mono">{n(g.thickness, 1)} mm</td>
                <td className="py-2 pr-3 font-mono">{g.quantity}</td>
                <td className="py-2 pr-3 font-mono">{n(g.areaM2, 3)} m²</td>
                <td className="py-2 font-mono">{n(g.massKg, 2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bom.pending > 0 && (
        <p className="t-caption mt-2">
          {bom.pending} peça(s) ainda sem medida: abra a peça e confirme os parâmetros para entrar
          na lista de corte.
        </p>
      )}
    </Panel>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-background/40 px-2.5 py-2">
      <p className="t-eyebrow">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}
