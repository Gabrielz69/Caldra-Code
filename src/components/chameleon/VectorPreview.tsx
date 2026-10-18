import { useMemo } from "react";
import { bbox, type Entity } from "@/lib/lab2d/core";
import { cn } from "@/lib/utils";

/** Prévia vetorial simplificada (nunca imagem) de entidades do CHAMFER. */
export function VectorPreview({
  entities,
  className,
  padding = 8,
}: {
  entities: Entity[];
  className?: string;
  padding?: number;
}) {
  const view = useMemo(() => {
    const b = bbox(entities);
    if (!b) return null;
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const pad = (Math.max(w, h) * padding) / 100;
    return { x: b.minX - pad, y: b.minY - pad, w: w + pad * 2, h: h + pad * 2 };
  }, [entities, padding]);

  if (!view) return null;
  const stroke = Math.max(view.w, view.h) / 220;

  return (
    <svg
      viewBox={`${view.x} ${-(view.y + view.h)} ${view.w} ${view.h}`}
      className={cn("size-full", className)}
      aria-hidden
    >
      <g transform="scale(1,-1)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {entities.map((e) => {
          const ref = e.layer === "corte";
          const props = {
            stroke: "currentColor",
            strokeWidth: ref ? stroke : stroke * 0.6,
            opacity: ref ? 1 : 0.35,
            strokeDasharray: ref ? undefined : `${stroke * 6} ${stroke * 4}`,
          };
          if (e.type === "line")
            return <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} {...props} />;
          if (e.type === "circle")
            return <circle key={e.id} cx={e.cx} cy={e.cy} r={e.r} {...props} />;
          if (e.type === "arc") {
            const x0 = e.cx + e.r * Math.cos(e.a0);
            const y0 = e.cy + e.r * Math.sin(e.a0);
            const x1 = e.cx + e.r * Math.cos(e.a1);
            const y1 = e.cy + e.r * Math.sin(e.a1);
            const large = Math.abs(e.a1 - e.a0) > Math.PI ? 1 : 0;
            return (
              <path
                key={e.id}
                d={`M ${x0} ${y0} A ${e.r} ${e.r} 0 ${large} 1 ${x1} ${y1}`}
                {...props}
              />
            );
          }
          if (e.type === "polyline") {
            const d =
              e.pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ") +
              (e.closed ? " Z" : "");
            return <path key={e.id} d={d} {...props} />;
          }
          return null;
        })}
      </g>
    </svg>
  );
}
