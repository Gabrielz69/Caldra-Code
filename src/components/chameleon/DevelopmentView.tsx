import { forwardRef } from "react";
import type { DevelopmentPattern } from "@/lib/geometry/types";
import {
  NO_HIGHLIGHT,
  dimFactor,
  foldRef,
  isHighlighted,
  outlineRef,
  pointRef,
  type HighlightState,
} from "@/lib/geometry/refs";

type Props = {
  pattern: DevelopmentPattern;
  showFolds?: boolean;
  showPoints?: boolean;
  /**
   * Destaque TEMPORÁRIO. Nunca troca a cor semântica: a entidade destacada
   * mantém CORTE/DOBRA/COTA e ganha espessura, brilho e contorno.
   */
  highlight?: HighlightState;
};

/** Renderiza o desenvolvimento planificado em escala real (mm → unidades SVG). */
export const DevelopmentView = forwardRef<SVGSVGElement, Props>(function DevelopmentView(
  { pattern, showFolds = true, showPoints = true, highlight = NO_HIGHLIGHT },
  ref,
) {
  const { minX, minY, maxX, maxY } = pattern.bounds;
  const pad = Math.max((maxX - minX) * 0.08, 20);
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const path =
    pattern.outline
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${(-p.y).toFixed(2)}`)
      .join(" ") + " Z";

  const dim = dimFactor(highlight);
  const boost = highlight.intensity ?? 1;
  const active = highlight.level !== "normal";
  const outlineActive = pattern.outline.some((_, i) => isHighlighted(highlight, outlineRef(i)));

  return (
    <svg
      ref={ref}
      viewBox={`${minX - pad} ${-maxY - pad} ${w} ${h}`}
      className="h-full w-full"
      role="img"
      aria-label="Desenvolvimento planificado"
    >
      <rect
        x={minX - pad}
        y={-maxY - pad}
        width={w}
        height={h}
        fill="var(--background)"
        fillOpacity="0"
      />
      {showFolds &&
        pattern.foldLines.map((s, i) => {
          const on = isHighlighted(highlight, foldRef(i));
          return (
            <line
              key={i}
              x1={s.a.x}
              y1={-s.a.y}
              x2={s.b.x}
              y2={-s.b.y}
              stroke="var(--accent2)"
              strokeOpacity={on ? 1 : 0.55 * dim}
              strokeWidth={(w / 400) * (on ? 2.6 * boost : 1)}
              strokeDasharray={on ? undefined : `${w / 90} ${w / 160}`}
            />
          );
        })}
      <path
        d={path}
        fill="var(--accent)"
        fillOpacity={0.06 * (active && !outlineActive ? dim : 1)}
        stroke="var(--accent)"
        strokeOpacity={active && !outlineActive ? dim : 1}
        strokeWidth={(w / 250) * (outlineActive ? 2.2 * boost : 1)}
        strokeLinejoin="round"
      />
      {showPoints &&
        pattern.points.map((pt) => {
          const on = isHighlighted(highlight, pointRef(pt.id));
          return (
            <g key={pt.id} opacity={active && !on ? dim : 1}>
              <circle
                cx={pt.p.x}
                cy={-pt.p.y}
                r={(w / 200) * (on ? 2 * boost : 1)}
                fill="var(--warn)"
              />
              {on && (
                <circle
                  cx={pt.p.x}
                  cy={-pt.p.y}
                  r={(w / 200) * 4 * boost}
                  fill="none"
                  stroke="var(--warn)"
                  strokeWidth={w / 500}
                  strokeOpacity={0.7}
                />
              )}
              <text
                x={pt.p.x}
                y={-pt.p.y + w / 45}
                fill="var(--warn)"
                fontSize={w / 45}
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                {pt.id}
              </text>
            </g>
          );
        })}
      {active && highlight.label && (
        <text
          x={minX}
          y={-maxY - pad / 2.2}
          fill="var(--accent)"
          fontSize={w / 38}
          fontFamily="var(--font-mono)"
        >
          {highlight.label}
        </text>
      )}
    </svg>
  );
});
