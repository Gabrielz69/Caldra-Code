/**
 * DESENHO TÉCNICO 2D — PROJEÇÃO ORTOGRÁFICA (1º DIEDRO).
 *
 * Tudo aqui é DERIVADO do resultado canônico e das instâncias sólidas: nenhuma
 * geometria própria é inventada e nenhum parâmetro é recalculado. As mesmas
 * ocorrências que alimentam o motor 3D são projetadas nos planos XY (frontal),
 * XZ (superior) e ZY (lateral esquerda), garantindo consistência matemática
 * entre 2D, 3D, árvore, BOM e fabricação.
 *
 * Apresentação monocromática de engenharia: a hierarquia de linhas (contorno
 * visível, eixo, auxiliar, cota) é independente do tema da interface.
 */

import { Maximize2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SolidInstance } from "@/lib/project-catalog/instances";
import type { CanonicalProject } from "@/lib/project-catalog/types";

export type DrawingMeta = {
  projectName?: string;
  code?: string;
  revision?: string;
  sheet?: string;
  notes?: string;
};

type Pt = { x: number; y: number };
type Shape = { id: string; partKey: string; pts: Pt[] };

const rotRect = (cx: number, cy: number, sx: number, sy: number, rot: number): Pt[] => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const hx = sx / 2;
  const hy = sy / 2;
  return [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ].map(([px, py]) => ({
    x: cx + (px as number) * c - (py as number) * s,
    y: cy + (px as number) * s + (py as number) * c,
  }));
};

const extX = (i: SolidInstance) =>
  (Math.abs(i.size.x * Math.cos(i.rotZ)) + Math.abs(i.size.y * Math.sin(i.rotZ))) / 2;
const extY = (i: SolidInstance) =>
  (Math.abs(i.size.x * Math.sin(i.rotZ)) + Math.abs(i.size.y * Math.cos(i.rotZ))) / 2;

const box = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];

const fmt = (n: number) =>
  Math.abs(n) >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();

export function TechnicalDrawing2D({
  result,
  instances,
  selectedId,
  onSelect,
  meta,
}: {
  result: CanonicalProject;
  instances: SolidInstance[];
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  meta?: DrawingMeta;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const sheet = useMemo(() => {
    const b = result.bounds;
    const L = Math.max(1, b.max.x - b.min.x);
    const W = Math.max(1, b.max.z - b.min.z);
    const Hv = Math.max(1, result.drawing.height || b.max.y - b.min.y);
    const gap = Math.max(L, Hv) * 0.22;

    /* origens de cada vista na folha (1º diedro: lateral esquerda à direita, superior abaixo) */
    const front = { ox: 0, oy: 0, w: L, h: Hv };
    const side = { ox: L + gap, oy: 0, w: W, h: Hv };
    const top = { ox: 0, oy: Hv + gap, w: L, h: W };

    const frontShapes: Shape[] = [];
    const sideShapes: Shape[] = [];
    const topShapes: Shape[] = [];
    for (const i of instances) {
      frontShapes.push({
        id: i.id,
        partKey: i.partKey,
        pts: rotRect(i.center.x, i.center.y, i.size.x, i.size.y, i.rotZ).map((p) => ({
          x: p.x,
          y: Hv - p.y,
        })),
      });
      const ey = extY(i);
      sideShapes.push({
        id: i.id,
        partKey: i.partKey,
        pts: box(
          i.center.z - i.size.z / 2,
          Hv - (i.center.y + ey),
          i.center.z + i.size.z / 2,
          Hv - (i.center.y - ey),
        ),
      });
      const ex = extX(i);
      topShapes.push({
        id: i.id,
        partKey: i.partKey,
        pts: box(
          i.center.x - ex,
          i.center.z - i.size.z / 2,
          i.center.x + ex,
          i.center.z + i.size.z / 2,
        ),
      });
    }

    const sheetW = side.ox + side.w;
    const blockH = Math.max(Hv, L) * 0.26;
    const sheetH = top.oy + top.h + blockH * 1.5;
    const k = Math.max(sheetW, sheetH) / 620;
    const margin = Math.max(sheetW, sheetH) * 0.13;

    return {
      L,
      W,
      Hv,
      front,
      side,
      top,
      frontShapes,
      sideShapes,
      topShapes,
      sheetW,
      sheetH,
      blockH,
      k,
      margin,
    };
  }, [result, instances]);

  const p = result.parameters;
  const val = (key: string, fb = 0) => (Number.isFinite(p[key]) ? (p[key] as number) : fb);
  const metric = (label: string) => result.metrics.find((m) => m.label === label)?.value ?? 0;

  const { k } = sheet;
  const W_VISIBLE = 1.7 * k;
  const W_THIN = 0.7 * k;
  const W_CENTER = 0.8 * k;
  const FS = 12 * k;
  const FS_SMALL = 9.5 * k;

  const ink = "var(--foreground)";
  const soft = "var(--muted-foreground)";

  const selPartKey = instances.find((i) => i.id === selectedId)?.partKey ?? null;

  const view = `${-sheet.margin - pan.x} ${-sheet.margin - pan.y} ${(sheet.sheetW + sheet.margin * 2) / zoom} ${(sheet.sheetH + sheet.margin * 2) / zoom}`;

  const renderShapes = (shapes: Shape[]) =>
    shapes.map((s) => {
      const isSel = s.id === selectedId;
      const sameKey = selPartKey === s.partKey;
      return (
        <polygon
          key={s.id}
          points={s.pts.map((q) => `${q.x},${q.y}`).join(" ")}
          fill={isSel ? "var(--accent)" : sameKey ? "var(--accent)" : "none"}
          fillOpacity={isSel ? 0.32 : sameKey ? 0.14 : 0}
          stroke={ink}
          strokeWidth={W_VISIBLE}
          strokeLinejoin="round"
          onClick={() => onSelect?.(s.id)}
          className="cursor-pointer"
        />
      );
    });

  /* cota linear horizontal (y é a linha de cota) */
  const dimH = (key: string, x1: number, x2: number, y: number, label: string) => (
    <g key={key} stroke={ink} fill={ink}>
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={W_THIN} />
      <line x1={x1} y1={y - 4 * k} x2={x1} y2={y + 4 * k} strokeWidth={W_THIN} />
      <line x1={x2} y1={y - 4 * k} x2={x2} y2={y + 4 * k} strokeWidth={W_THIN} />
      <text
        x={(x1 + x2) / 2}
        y={y - 3 * k}
        textAnchor="middle"
        fontSize={FS}
        stroke="none"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );

  /* cota linear vertical (x é a linha de cota) */
  const dimV = (key: string, y1: number, y2: number, x: number, label: string) => (
    <g key={key} stroke={ink} fill={ink}>
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={W_THIN} />
      <line x1={x - 4 * k} y1={y1} x2={x + 4 * k} y2={y1} strokeWidth={W_THIN} />
      <line x1={x - 4 * k} y1={y2} x2={x + 4 * k} y2={y2} strokeWidth={W_THIN} />
      <text
        x={x + 4 * k}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        fontSize={FS}
        stroke="none"
        fontFamily="ui-monospace, monospace"
        transform={`rotate(-90 ${x + 4 * k} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </g>
  );

  const label = (key: string, x: number, y: number, text: string, size = FS_SMALL) => (
    <text
      key={key}
      x={x}
      y={y}
      fontSize={size}
      fill={soft}
      fontFamily="ui-monospace, monospace"
      letterSpacing={0.6 * k}
    >
      {text}
    </text>
  );

  const steps = Math.round(val("steps", 0));
  const rise = metric("Espelho");
  const run = metric("Passo horizontal");
  const angle = metric("Inclinação");
  const isStair = result.modelSlug === "escada-reta";
  const railH = val("handrailHeight", 0);

  const scaleDen = Math.max(1, Math.round(sheet.sheetW / 380));
  const today = new Date().toLocaleDateString("pt-BR");
  const material = result.parts[0]?.material ?? "Aço Carbono";

  const bx = 0;
  const by = sheet.top.oy + sheet.top.h + sheet.blockH * 0.5;
  const bw = sheet.sheetW;
  const bh = sheet.blockH;
  const col = bw / 4;
  const row = bh / 3;

  const field = (i: number, j: number, title: string, value: string) => (
    <g key={`${title}-${i}-${j}`}>
      <rect
        x={bx + i * col}
        y={by + j * row}
        width={col}
        height={row}
        fill="none"
        stroke={ink}
        strokeWidth={W_THIN}
      />
      <text
        x={bx + i * col + 4 * k}
        y={by + j * row + row * 0.4}
        fontSize={FS_SMALL}
        fill={soft}
        fontFamily="ui-monospace, monospace"
      >
        {title}
      </text>
      <text
        x={bx + i * col + 4 * k}
        y={by + j * row + row * 0.82}
        fontSize={FS}
        fill={ink}
        fontFamily="ui-monospace, monospace"
      >
        {value}
      </text>
    </g>
  );

  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl border border-line bg-background lg:h-[560px]">
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
          onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
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
        role="img"
        aria-label="Desenho técnico de fabricação em projeção ortográfica"
        onPointerMove={(e) => {
          if (e.buttons === 1)
            setPan((q) => ({
              x: q.x + (e.movementX * 4) / zoom,
              y: q.y + (e.movementY * 4) / zoom,
            }));
        }}
      >
        {/* moldura da folha */}
        <rect
          x={-sheet.margin * 0.7}
          y={-sheet.margin * 0.7}
          width={sheet.sheetW + sheet.margin * 1.4}
          height={sheet.sheetH + sheet.margin * 1.4}
          fill="none"
          stroke={soft}
          strokeWidth={W_THIN}
        />

        {/* VISTA FRONTAL */}
        <g transform={`translate(${sheet.front.ox} ${sheet.front.oy})`}>
          <line
            x1={-sheet.L * 0.05}
            y1={sheet.Hv}
            x2={sheet.L * 1.05}
            y2={sheet.Hv}
            stroke={soft}
            strokeWidth={W_CENTER}
            strokeDasharray={`${12 * k} ${4 * k} ${2 * k} ${4 * k}`}
          />
          {renderShapes(sheet.frontShapes)}
          {label("lf", 0, sheet.Hv + 26 * k, "VISTA FRONTAL")}
          {dimH("d-len", 0, sheet.L, sheet.Hv + 46 * k, `${fmt(sheet.L)}`)}
          {dimV(
            "d-alt",
            sheet.Hv,
            sheet.Hv - val("height", 0),
            -18 * k,
            `${fmt(val("height", 0))}`,
          )}
          {isStair && railH > 0
            ? dimV(
                "d-rail",
                sheet.Hv - val("height", 0),
                sheet.Hv - val("height", 0) - railH,
                sheet.L + 18 * k,
                `${fmt(railH)}`,
              )
            : null}
          {isStair && steps > 1
            ? dimH("d-run", run, run * 2, sheet.Hv - rise * 2 - 14 * k, `${fmt(run)}`)
            : null}
          {isStair && steps > 1
            ? dimV("d-rise", sheet.Hv - rise, sheet.Hv - rise * 2, run * 2 + 14 * k, `${fmt(rise)}`)
            : null}
        </g>

        {/* VISTA LATERAL ESQUERDA */}
        <g transform={`translate(${sheet.side.ox} ${sheet.side.oy})`}>
          <line
            x1={sheet.W / 2}
            y1={-sheet.Hv * 0.04}
            x2={sheet.W / 2}
            y2={sheet.Hv * 1.04}
            stroke={soft}
            strokeWidth={W_CENTER}
            strokeDasharray={`${12 * k} ${4 * k} ${2 * k} ${4 * k}`}
          />
          {renderShapes(sheet.sideShapes)}
          {label("ls", 0, sheet.Hv + 26 * k, "VISTA LATERAL ESQUERDA")}
          {dimH("d-w-side", 0, sheet.W, sheet.Hv + 46 * k, `${fmt(sheet.W)}`)}
        </g>

        {/* VISTA SUPERIOR */}
        <g transform={`translate(${sheet.top.ox} ${sheet.top.oy})`}>
          <line
            x1={-sheet.L * 0.05}
            y1={sheet.W / 2}
            x2={sheet.L * 1.05}
            y2={sheet.W / 2}
            stroke={soft}
            strokeWidth={W_CENTER}
            strokeDasharray={`${12 * k} ${4 * k} ${2 * k} ${4 * k}`}
          />
          {renderShapes(sheet.topShapes)}
          {label("lt", 0, sheet.W + 26 * k, "VISTA SUPERIOR")}
          {dimV("d-w-top", 0, sheet.W, -18 * k, `${fmt(sheet.W)}`)}
        </g>

        {/* NOTAS TÉCNICAS */}
        <g>
          {label("n0", sheet.side.ox, sheet.top.oy + 14 * k, "NOTAS", FS)}
          {label("n1", sheet.side.ox, sheet.top.oy + 32 * k, "Cotas em milímetros.")}
          {label("n2", sheet.side.ox, sheet.top.oy + 48 * k, "Projeção ortográfica — 1º diedro.")}
          {isStair
            ? label(
                "n3",
                sheet.side.ox,
                sheet.top.oy + 64 * k,
                `${steps} degraus · espelho ${fmt(rise)} · piso ${fmt(val("treadDepth", 0))}`,
              )
            : null}
          {isStair
            ? label("n4", sheet.side.ox, sheet.top.oy + 80 * k, `Inclinação ${fmt(angle)}°`)
            : null}
          {label(
            "n5",
            sheet.side.ox,
            sheet.top.oy + 96 * k,
            "Geometria de fabricação — sem dimensionamento estrutural.",
          )}
        </g>

        {/* QUADRO TÉCNICO CALDRA */}
        <g>
          <rect
            x={bx}
            y={by}
            width={bw}
            height={bh}
            fill="none"
            stroke={ink}
            strokeWidth={W_VISIBLE}
          />
          <text
            x={bx + 6 * k}
            y={by + row * 0.7}
            fontSize={FS * 1.9}
            fill={ink}
            fontFamily="ui-monospace, monospace"
            letterSpacing={2 * k}
          >
            CALDRA
          </text>
          <rect
            x={bx}
            y={by}
            width={col}
            height={row}
            fill="none"
            stroke={ink}
            strokeWidth={W_THIN}
          />
          {field(1, 0, "PROJETO", meta?.projectName ?? result.modelName)}
          {field(2, 0, "CÓDIGO", meta?.code ?? result.modelSlug.toUpperCase())}
          {field(3, 0, "REVISÃO", meta?.revision ?? "A")}
          {field(0, 1, "CONJUNTO", "Conjunto completo")}
          {field(1, 1, "MATERIAL", material)}
          {field(2, 1, "UNIDADE", "mm")}
          {field(3, 1, "ESCALA", `1:${scaleDen}`)}
          {field(0, 2, "DATA", today)}
          {field(1, 2, "FOLHA", meta?.sheet ?? "01/01")}
          {field(2, 2, "COMPONENTES", `${result.parts.reduce((s, x) => s + x.quantity, 0)} un`)}
          {field(3, 2, "OBSERVAÇÕES", meta?.notes ?? "Conferir em obra")}
        </g>
      </svg>
    </div>
  );
}
