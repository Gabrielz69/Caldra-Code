import { useMemo } from "react";
import { buildViews, type Prim } from "@/lib/viz3d/views";
import type { WireParams } from "@/lib/viz3d/wire";
import { foldRef, type GeometryRef } from "@/lib/geometry/refs";

type Props = {
  slug: string;
  params: WireParams;
  highlight?: keyof WireParams | null;
  className?: string;
  showGeneratrices?: boolean;
  selectedRef?: GeometryRef | null;
  onSelectRef?: ((ref: GeometryRef | null) => void) | undefined;
};

const W = 440;
const H = 240;

function bboxOf(prims: Prim[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const acc = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of prims) {
    if (p.k === "poly") p.pts.forEach(([x, y]) => acc(x, y));
    else if (p.k === "circle") {
      acc(p.cx - p.r, p.cy - p.r);
      acc(p.cx + p.r, p.cy + p.r);
    } else {
      acc(p.x, p.y);
      acc(p.x + p.w, p.y + p.h);
    }
  }
  if (!Number.isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

type Generatrix2D = {
  id: string;
  index: number;
  label: string;
  front: { x1: number; y1: number; x2: number; y2: number };
  plan: { x1: number; y1: number; x2: number; y2: number };
};

/** Gera as geratrizes técnicas em 2D proporcionais aos parâmetros físicos (mm). */
function buildGeneratrices2D(slug: string, p: WireParams): Generatrix2D[] {
  const d1 = p.d1;
  const d2 = p.d2;
  const h = p.h;
  const e = p.e ?? 0;
  const r1 = d1 / 2;
  const r2 = d2 / 2;
  const N = Math.min(24, Math.max(8, p.seg ? Math.round(p.seg / 2) : 12));
  const gens: Generatrix2D[] = [];

  switch (slug) {
    case "cone": {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const bx = r1 * Math.cos(ang);
        const by = r1 * Math.sin(ang);
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: bx, y1: 0, x2: 0, y2: h },
          plan: { x1: 0, y1: 0, x2: bx, y2: by },
        });
      }
      break;
    }
    case "tronco-de-cone":
    case "reducao-circular":
    case "chamines": {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const bx = r1 * Math.cos(ang);
        const by = r1 * Math.sin(ang);
        const tx = r2 * Math.cos(ang);
        const ty = r2 * Math.sin(ang);
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: bx, y1: 0, x2: tx, y2: h },
          plan: { x1: bx, y1: by, x2: tx, y2: ty },
        });
      }
      break;
    }
    case "cone-excentrico": {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const bx = r1 * Math.cos(ang);
        const by = r1 * Math.sin(ang);
        const tx = r2 * Math.cos(ang) + e;
        const ty = r2 * Math.sin(ang);
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: bx, y1: 0, x2: tx, y2: h },
          plan: { x1: bx, y1: by, x2: tx, y2: ty },
        });
      }
      break;
    }
    case "cilindro":
    case "dutos": {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const bx = r1 * Math.cos(ang);
        const by = r1 * Math.sin(ang);
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: bx, y1: 0, x2: bx, y2: h },
          plan: { x1: 0, y1: 0, x2: bx, y2: by },
        });
      }
      break;
    }
    case "boca-de-lobo": {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const bx = r1 * Math.cos(ang);
        const by = r1 * Math.sin(ang);
        const saddleY = h * (0.35 + 0.65 * ((1 - Math.cos(ang)) / 2));
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: bx, y1: saddleY, x2: bx, y2: h },
          plan: { x1: 0, y1: 0, x2: bx, y2: by },
        });
      }
      break;
    }
    case "curva-de-gomos": {
      const gomos = 5;
      const R = d1;
      for (let i = 0; i <= gomos; i++) {
        const a = (i / gomos) * (Math.PI / 2);
        const p1x = (R + r2) * Math.sin(a);
        const p1y = (R + r2) * (1 - Math.cos(a));
        const p2x = (R - r2) * Math.sin(a);
        const p2y = (R - r2) * (1 - Math.cos(a)) + 2 * r2;
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: p1x, y1: p1y, x2: p2x, y2: p2y },
          plan: { x1: (i / gomos) * R - R / 2, y1: -r2, x2: (i / gomos) * R - R / 2, y2: r2 },
        });
      }
      break;
    }
    default: {
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const bx = r1 * Math.cos(ang);
        const by = r1 * Math.sin(ang);
        const tx = r2 * Math.cos(ang) + e;
        const ty = r2 * Math.sin(ang);
        gens.push({
          id: `gen-${i}`,
          index: i,
          label: `G${i + 1}`,
          front: { x1: bx, y1: 0, x2: tx, y2: h },
          plan: { x1: bx, y1: by, x2: tx, y2: ty },
        });
      }
      break;
    }
  }
  return gens;
}

/**
 * Vistas ortográficas técnicas (VISTA FRONTAL + VISTA SUPERIOR) geradas
 * a partir da geometria da peça — mesmo padrão do motor de cálculo,
 * com suporte a geratrizes interativas clicáveis sincronizadas com 3D.
 */
export function SchematicViews({
  slug,
  params,
  highlight: _highlight = null,
  className,
  showGeneratrices = true,
  selectedRef = null,
  onSelectRef,
}: Props) {
  const views = useMemo(() => buildViews(slug, params), [slug, params]);
  const generatrices = useMemo(() => buildGeneratrices2D(slug, params), [slug, params]);

  const getTransformers = (
    prims: Prim[],
    box: { x: number; y: number; w: number; h: number },
    flipY: boolean,
  ) => {
    const bb = bboxOf(prims);
    const gw = Math.max(bb.maxX - bb.minX, 1);
    const gh = Math.max(bb.maxY - bb.minY, 1);
    const s = Math.min(box.w / gw, box.h / gh);
    const ox = box.x + box.w / 2 - ((bb.minX + bb.maxX) / 2) * s;
    const oy = box.y + box.h / 2 + (flipY ? ((bb.minY + bb.maxY) / 2) * s : 0);
    const X = (x: number) => ox + x * s;
    const Y = (y: number) =>
      flipY ? oy - y * s : box.y + box.h / 2 + (y - (bb.minY + bb.maxY) / 2) * s;
    return { X, Y, s };
  };

  const frontBox = { x: 26, y: 22, w: 176, h: 168 };
  const planBox = { x: 246, y: 22, w: 176, h: 168 };

  const frontT = getTransformers(views.front, frontBox, true);
  const planT = getTransformers(views.plan, planBox, false);

  const renderPrims = (
    prims: Prim[],
    { X, Y, s }: { X: (x: number) => number; Y: (y: number) => number; s: number },
    flipY: boolean,
  ) => {
    return prims.map((p, i) => {
      const common = {
        stroke: "dash" in p && p.dash ? "var(--holo, #00FFEF)" : "var(--accent)",
        strokeWidth: p.k === "poly" || !("dash" in p) || !p.dash ? 1.4 : 1,
        strokeOpacity: "dash" in p && p.dash ? 0.75 : 1,
        strokeDasharray: "dash" in p && p.dash ? "5 3" : undefined,
        fill:
          (("fill" in p && p.fill) ?? false)
            ? "dash" in p && p.dash
              ? "var(--holo, #00FFEF)"
              : "var(--accent)"
            : "none",
        fillOpacity: 0.07,
        strokeLinejoin: "round" as const,
      };
      if (p.k === "poly")
        return (
          <path
            key={i}
            {...common}
            d={
              p.pts
                .map(
                  (pt, j) => `${j === 0 ? "M" : "L"}${X(pt[0]).toFixed(2)} ${Y(pt[1]).toFixed(2)}`,
                )
                .join(" ") + (p.closed === false ? "" : " Z")
            }
          />
        );
      if (p.k === "circle")
        return (
          <circle
            key={i}
            {...common}
            cx={X(p.cx).toFixed(2)}
            cy={Y(p.cy).toFixed(2)}
            r={(p.r * s).toFixed(2)}
          />
        );
      return (
        <rect
          key={i}
          {...common}
          x={X(p.x).toFixed(2)}
          y={(flipY ? Y(p.y + p.h) : Y(p.y)).toFixed(2)}
          width={(p.w * s).toFixed(2)}
          height={(p.h * s).toFixed(2)}
        />
      );
    });
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className ?? "h-full w-full select-none"}
      role="img"
      aria-label="Vistas técnicas: frontal e superior"
      onClick={() => onSelectRef?.(null)}
    >
      <defs>
        <pattern id={`sv-grid-${slug}`} width="11" height="11" patternUnits="userSpaceOnUse">
          <path d="M11 0H0v11" fill="none" stroke="var(--grid-line)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#sv-grid-${slug})`} />

      {/* VISTA FRONTAL */}
      <g>
        {renderPrims(views.front, frontT, true)}

        {/* Geratrizes interativas na vista frontal */}
        {showGeneratrices && (
          <g data-layer="generatrices-front">
            {generatrices.map((g) => {
              const x1 = Number(frontT.X(g.front.x1).toFixed(3));
              const y1 = Number(frontT.Y(g.front.y1).toFixed(3));
              const x2 = Number(frontT.X(g.front.x2).toFixed(3));
              const y2 = Number(frontT.Y(g.front.y2).toFixed(3));
              const isSelected = selectedRef === foldRef(g.index);
              const mx = Number(((x1 + x2) / 2).toFixed(3));
              const my = Number(((y1 + y2) / 2).toFixed(3));
              return (
                <g key={`front-${g.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? "var(--accent)" : "var(--solid-edge, var(--accent))"}
                    strokeWidth={isSelected ? 2 : 0.75}
                    strokeOpacity={isSelected ? 1 : 0.45}
                    strokeDasharray={isSelected ? undefined : "3 2"}
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={10}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRef?.(isSelected ? null : foldRef(g.index));
                    }}
                  >
                    <title>{`Geratriz ${g.label}`}</title>
                  </line>
                  {isSelected && (
                    <g transform={`translate(${mx}, ${my})`} pointerEvents="none">
                      <rect
                        x={-34}
                        y={-9}
                        width={68}
                        height={18}
                        rx={4}
                        fill="var(--card)"
                        stroke="var(--accent)"
                        strokeWidth={1}
                        className="shadow-sm"
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fontSize={8}
                        fontFamily="var(--font-mono)"
                        fill="var(--accent)"
                        fontWeight="bold"
                      >
                        Geratriz {g.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        <line
          x1={114}
          y1={16}
          x2={114}
          y2={198}
          stroke="var(--muted-foreground)"
          strokeWidth="0.6"
          strokeDasharray="6 3 1 3"
        />
        <text
          x={114}
          y={222}
          fill="var(--muted-foreground)"
          fontSize="8"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          VISTA FRONTAL
        </text>
      </g>

      {/* VISTA SUPERIOR / PLANTA */}
      <g>
        {renderPrims(views.plan, planT, false)}

        {/* Geratrizes interativas na vista superior */}
        {showGeneratrices && (
          <g data-layer="generatrices-plan">
            {generatrices.map((g) => {
              const x1 = Number(planT.X(g.plan.x1).toFixed(3));
              const y1 = Number(planT.Y(g.plan.y1).toFixed(3));
              const x2 = Number(planT.X(g.plan.x2).toFixed(3));
              const y2 = Number(planT.Y(g.plan.y2).toFixed(3));
              const isSelected = selectedRef === foldRef(g.index);
              const mx = Number(((x1 + x2) / 2).toFixed(3));
              const my = Number(((y1 + y2) / 2).toFixed(3));
              return (
                <g key={`plan-${g.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? "var(--accent)" : "var(--solid-edge, var(--accent))"}
                    strokeWidth={isSelected ? 2 : 0.75}
                    strokeOpacity={isSelected ? 1 : 0.45}
                    strokeDasharray={isSelected ? undefined : "3 2"}
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={10}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRef?.(isSelected ? null : foldRef(g.index));
                    }}
                  >
                    <title>{`Geratriz ${g.label}`}</title>
                  </line>
                  {isSelected && (
                    <g transform={`translate(${mx}, ${my})`} pointerEvents="none">
                      <rect
                        x={-34}
                        y={-9}
                        width={68}
                        height={18}
                        rx={4}
                        fill="var(--card)"
                        stroke="var(--accent)"
                        strokeWidth={1}
                        className="shadow-sm"
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fontSize={8}
                        fontFamily="var(--font-mono)"
                        fill="var(--accent)"
                        fontWeight="bold"
                      >
                        Geratriz {g.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        <text
          x={334}
          y={222}
          fill="var(--muted-foreground)"
          fontSize="8"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          VISTA SUPERIOR
        </text>
      </g>
    </svg>
  );
}
