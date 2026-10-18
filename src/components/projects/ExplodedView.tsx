import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { explodeLayout } from "@/lib/projects/explode";
import type { Project } from "@/lib/projects/store";

/** Vista explodida esquemática do dossiê (conjuntos, subconjuntos e peças). */
export function ExplodedView({
  project,
  onOpenPart,
}: {
  project: Project;
  onOpenPart?: (instanceId: string) => void;
}) {
  const [explode, setExplode] = useState(1);
  const layout = useMemo(() => explodeLayout(project, explode), [project, explode]);

  if (!project.parts.length) return null;

  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            <Boxes className="size-3.5" /> {project.parts.length} peça(s)
          </span>
        }
      >
        Vista explodida
      </SectionLabel>

      <label className="mb-3 flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
          Afastamento
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={explode}
          onChange={(e) => setExplode(Number(e.target.value))}
          aria-label="Afastamento das peças"
          className="h-1 flex-1 accent-[var(--accent)]"
        />
        <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">
          {Math.round(explode * 100)}%
        </span>
      </label>

      <div className="overflow-x-auto rounded-xl border border-line bg-background/40 p-2">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="Vista explodida do projeto"
          className="h-auto w-full"
          style={{ minWidth: Math.min(layout.width, 640) }}
        >
          {layout.groups.map((g) => {
            const first = g.nodes[0];
            const last = g.nodes[g.nodes.length - 1];
            return (
              <g key={g.id}>
                <text
                  x={g.x}
                  y={22}
                  className="fill-muted-foreground"
                  style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}
                >
                  {g.label.toUpperCase()}
                </text>
                {first && last && (
                  <line
                    x1={first.axisX}
                    y1={first.axisY}
                    x2={last.axisX}
                    y2={last.axisY}
                    stroke="currentColor"
                    strokeWidth={0.6}
                    strokeDasharray="4 4"
                    className="text-muted-foreground/50"
                  />
                )}
                {g.nodes.map((n) => (
                  <g
                    key={n.instanceId}
                    onClick={() => onOpenPart?.(n.instanceId)}
                    style={{ cursor: onOpenPart ? "pointer" : "default" }}
                  >
                    <line
                      x1={n.axisX}
                      y1={n.axisY}
                      x2={n.x + n.w / 2}
                      y2={n.y + n.h / 2}
                      stroke="currentColor"
                      strokeWidth={0.5}
                      strokeDasharray="2 3"
                      className="text-muted-foreground/40"
                    />
                    <rect
                      x={n.x}
                      y={n.y}
                      width={n.w}
                      height={n.h}
                      rx={2}
                      fill="var(--accent)"
                      fillOpacity={n.resolved ? 0.1 : 0.04}
                      stroke="var(--accent)"
                      strokeOpacity={n.resolved ? 0.65 : 0.3}
                      strokeWidth={0.9}
                      strokeDasharray={n.resolved ? undefined : "3 3"}
                    />
                    <text
                      x={n.x + n.w / 2}
                      y={n.y + n.h + 8}
                      textAnchor="middle"
                      className="fill-foreground"
                      style={{ fontSize: 7.5 }}
                    >
                      {n.code} {n.quantity > 1 ? `(${n.quantity}x)` : ""}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="t-caption mt-2">
        Esquema de posição por conjunto — toque em uma peça para abri-la. Contorno tracejado indica
        peça sem medida calculada.
      </p>
    </Panel>
  );
}
