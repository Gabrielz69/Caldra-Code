import { Maximize2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SolidInstance } from "@/lib/project-catalog/instances";
import type { CanonicalProject } from "@/lib/project-catalog/types";

/**
 * Vista 2D do MESMO resultado canônico. O destaque da peça selecionada é
 * projetado das instâncias 3D (plano X–Y), sem geometria independente.
 */
export function ProjectDrawing2D({
  result,
  instances = [],
  selectedId = null,
  onSelect,
}: {
  result: CanonicalProject;
  instances?: SolidInstance[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const view = useMemo(
    () =>
      `${-300 - pan.x} ${-result.drawing.height - 200 - pan.y} ${result.drawing.width + 700} ${result.drawing.height + 500}`,
    [result, pan],
  );
  const selPartKey = instances.find((i) => i.id === selectedId)?.partKey ?? null;
  const marks = selPartKey ? instances.filter((i) => i.partKey === selPartKey) : [];

  return (
    <div className="relative h-[340px] overflow-hidden rounded-xl border border-line bg-background/60">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <Button
          size="icon"
          variant="outline"
          aria-label="Diminuir zoom"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
        >
          <Minus />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Aumentar zoom"
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
        >
          <Plus />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Enquadrar desenho"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Maximize2 />
        </Button>
      </div>
      <svg
        viewBox={view}
        className="h-full w-full touch-none"
        onPointerMove={(e) => {
          if (e.buttons === 1)
            setPan((p) => ({
              x: p.x - (e.movementX * 4) / zoom,
              y: p.y + (e.movementY * 4) / zoom,
            }));
        }}
        role="img"
        aria-label="Desenho técnico paramétrico do projeto"
      >
        <g transform={`scale(${zoom})`}>
          {result.drawing.entities.map((e) =>
            e.type === "line" ? (
              <line
                key={e.id}
                x1={e.x1}
                y1={-e.y1}
                x2={e.x2}
                y2={-e.y2}
                stroke={e.layer === "corte" ? "var(--accent)" : "var(--muted-foreground)"}
                strokeWidth={e.layer === "corte" ? 10 : 5}
              />
            ) : null,
          )}
          {marks.map((m) => (
            <rect
              key={m.id}
              x={m.center.x - m.size.x / 2}
              y={-(m.center.y + m.size.y / 2)}
              width={Math.max(m.size.x, 20)}
              height={Math.max(m.size.y, 20)}
              fill="var(--accent)"
              fillOpacity={m.id === selectedId ? 0.35 : 0.14}
              stroke="var(--accent)"
              strokeWidth={8}
              onClick={() => onSelect?.(m.id)}
              className="cursor-pointer"
            />
          ))}
          {result.drawing.dimensions.map((d) => (
            <g key={d.label}>
              <line
                x1={d.a.x}
                y1={-d.a.y}
                x2={d.b.x}
                y2={-d.b.y}
                stroke="var(--accent2)"
                strokeWidth="5"
              />
              <text
                x={(d.a.x + d.b.x) / 2}
                y={-(d.a.y + d.b.y) / 2 - 20}
                textAnchor="middle"
                fill="var(--foreground)"
                fontSize="70"
              >
                {d.label} {d.value.toFixed(0)} mm
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
