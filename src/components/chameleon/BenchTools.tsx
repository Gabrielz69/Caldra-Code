import { Compass, Eraser, Move3d, PencilLine, Ruler, Stamp } from "lucide-react";
import { TOOL_LABEL, type TraceTool } from "@/lib/tracagem/steps";
import { cn } from "@/lib/utils";

const TOOLS: { id: TraceTool; icon: typeof Ruler; hint: string }[] = [
  { id: "riscador", icon: PencilLine, hint: "Risque a linha indicada com traço firme e contínuo." },
  { id: "regua", icon: Ruler, hint: "Apoie a régua na linha de base e confira o comprimento." },
  { id: "esquadro", icon: Move3d, hint: "Garanta o esquadro entre a base e o eixo da peça." },
  { id: "compasso", icon: Compass, hint: "Mantenha a abertura do compasso e repita a divisão." },
  {
    id: "transferidor",
    icon: Move3d,
    hint: "Alinhe a base no vértice e marque o ângulo indicado.",
  },
  {
    id: "transferir",
    icon: Stamp,
    hint: "Leve a medida da tabela para a chapa sem reabrir o compasso.",
  },
  { id: "marcar", icon: Eraser, hint: "Marque corte, dobra e recorte de forma distinta." },
];

/**
 * MODO BANCADA — ferramentas pedagógicas. São orientação visual: o CALDRA
 * não simula física nem controla ferramenta real.
 */
export function BenchTools({ tool }: { tool: TraceTool }) {
  const active = TOOLS.find((t) => t.id === tool);
  return (
    <div className="rounded-xl border border-line bg-background/40 p-3">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        Modo bancada
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tool;
          return (
            <span
              key={t.id}
              aria-current={on}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase",
                on
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-line text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" /> {TOOL_LABEL[t.id]}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {active?.hint ?? "Siga a instrução do passo atual."}
      </p>
    </div>
  );
}
