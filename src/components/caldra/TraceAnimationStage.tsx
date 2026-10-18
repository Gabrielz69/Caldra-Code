import type { DevelopmentPattern, Vec2 } from "@/lib/geometry/types";
import { foldRef, outlineRef, pointRef, type GeometryRef } from "@/lib/geometry/refs";
import type { TraceFrame } from "@/lib/tracagem/animation";
import { TOOL_LABEL } from "@/lib/tracagem/steps";

type Props = {
  pattern: DevelopmentPattern;
  frame: TraceFrame;
  completedRefs: GeometryRef[];
  showAll: boolean;
  stepLabel: string;
  onTarget?: (point: Vec2) => void;
};

const sameRef = (refs: GeometryRef[], ref: GeometryRef) => refs.includes(ref);

/** Palco SVG leve: desenho, ferramenta e cota usam as coordenadas canônicas em mm. */
export function TraceAnimationStage({
  pattern,
  frame,
  completedRefs,
  showAll,
  stepLabel,
  onTarget,
}: Props) {
  const { minX, minY, maxX, maxY } = pattern.bounds;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const activeRef = frame.action.geometryRefs[0];
  const activeEntity = frame.action.entities[0];
  const focusStart = activeEntity?.startPoint;
  const focusEnd = activeEntity?.endPoint;
  const focusMinX = focusStart && focusEnd ? Math.min(focusStart.x, focusEnd.x) : minX;
  const focusMaxX = focusStart && focusEnd ? Math.max(focusStart.x, focusEnd.x) : maxX;
  const focusMinY = focusStart && focusEnd ? Math.min(focusStart.y, focusEnd.y) : minY;
  const focusMaxY = focusStart && focusEnd ? Math.max(focusStart.y, focusEnd.y) : maxY;
  const focusWidth = Math.max(focusMaxX - focusMinX, width * 0.24, 1);
  const focusHeight = Math.max(focusMaxY - focusMinY, height * 0.24, 1);
  const viewMinX = showAll ? minX : (focusMinX + focusMaxX - focusWidth) / 2;
  const viewMaxY = showAll ? maxY : (focusMinY + focusMaxY + focusHeight) / 2;
  const viewWidth = showAll ? width : focusWidth;
  const viewHeight = showAll ? height : focusHeight;
  const pad = Math.max(viewWidth * 0.16, viewHeight * 0.16, 22);
  const stroke = Math.max(viewWidth, viewHeight) / 280;
  const drawing =
    frame.action.type === "DRAW" ||
    frame.action.type === "TRANSFER" ||
    frame.action.type === "ROTATE";
  const markProgress = frame.action.type === "MARK" ? frame.progress : 0;
  const tool = frame.action.tool;
  const p = frame.toolPoint;
  const a = frame.action.startPoint;
  const b = frame.action.endPoint;
  const dimension = frame.action.measurement;
  const angle = frame.action.angleDeg;
  const offset = Math.max(width, height) * 0.065;
  const nx = a && b ? -((b.y - a.y) / Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1)) * offset : 0;
  const ny = a && b ? ((b.x - a.x) / Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1)) * offset : 0;

  const opacityFor = (ref: GeometryRef) => {
    if (showAll || sameRef(completedRefs, ref)) return 1;
    if (ref === activeRef) return drawing ? 0.1 : 0.38;
    return 0.06;
  };

  return (
    <svg
      viewBox={`${viewMinX - pad} ${-viewMaxY - pad} ${viewWidth + pad * 2} ${viewHeight + pad * 2}`}
      className="h-full w-full touch-manipulation"
      role="img"
      aria-label={`${stepLabel}. ${frame.action.instruction}`}
      onClick={(event) => {
        if (!onTarget) return;
        const svg = event.currentTarget;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        onTarget({ x: point.x, y: -point.y });
      }}
    >
      <rect
        x={viewMinX - pad}
        y={-viewMaxY - pad}
        width={viewWidth + pad * 2}
        height={viewHeight + pad * 2}
        fill="var(--background)"
        fillOpacity="0"
      />

      {pattern.outline.map((start, i) => {
        const end = pattern.outline[(i + 1) % pattern.outline.length];
        const ref = outlineRef(i);
        if (!end) return null;
        return (
          <line
            key={ref}
            x1={start.x}
            y1={-start.y}
            x2={end.x}
            y2={-end.y}
            stroke="var(--accent)"
            strokeWidth={stroke * 1.35}
            strokeOpacity={opacityFor(ref)}
          />
        );
      })}
      {pattern.foldLines.map((segment, i) => {
        const ref = foldRef(i);
        return (
          <line
            key={ref}
            x1={segment.a.x}
            y1={-segment.a.y}
            x2={segment.b.x}
            y2={-segment.b.y}
            stroke="var(--accent2)"
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 4} ${stroke * 3}`}
            strokeOpacity={opacityFor(ref)}
          />
        );
      })}
      {pattern.points.map((point) => {
        const ref = pointRef(point.id);
        const visible = showAll || sameRef(completedRefs, ref) || ref === activeRef;
        return visible ? (
          <g key={ref} opacity={ref === activeRef && markProgress > 0 ? markProgress : 1}>
            <circle cx={point.p.x} cy={-point.p.y} r={stroke * 2.3} fill="var(--warn)" />
            <text
              x={point.p.x}
              y={-point.p.y + stroke * 10}
              textAnchor="middle"
              fill="var(--warn)"
              fontFamily="var(--font-mono)"
              fontSize={stroke * 7}
            >
              {point.id}
            </text>
          </g>
        ) : null;
      })}

      {drawing && activeEntity?.kind === "segment" && frame.partialEnd && (
        <line
          x1={activeEntity.startPoint.x}
          y1={-activeEntity.startPoint.y}
          x2={frame.partialEnd.x}
          y2={-frame.partialEnd.y}
          stroke={activeRef?.startsWith("fold:") ? "var(--accent2)" : "var(--accent)"}
          strokeWidth={stroke * 2.5}
          strokeLinecap="round"
        />
      )}

      {a && b && dimension && (
        <g aria-label={`${dimension.label}: ${dimension.value} ${dimension.unit}`}>
          <line
            x1={a.x + nx}
            y1={-(a.y + ny)}
            x2={b.x + nx}
            y2={-(b.y + ny)}
            stroke="var(--success)"
            strokeWidth={stroke}
          />
          <line
            x1={a.x}
            y1={-a.y}
            x2={a.x + nx * 1.25}
            y2={-(a.y + ny * 1.25)}
            stroke="var(--success)"
            strokeWidth={stroke * 0.75}
          />
          <line
            x1={b.x}
            y1={-b.y}
            x2={b.x + nx * 1.25}
            y2={-(b.y + ny * 1.25)}
            stroke="var(--success)"
            strokeWidth={stroke * 0.75}
          />
          <text
            x={(a.x + b.x) / 2 + nx}
            y={-((a.y + b.y) / 2 + ny) - stroke * 4}
            textAnchor="middle"
            fill="var(--success)"
            fontFamily="var(--font-mono)"
            fontSize={stroke * 7}
          >
            {dimension.value} {dimension.unit}
          </text>
          <text
            x={a.x - stroke * 5}
            y={-a.y + stroke * 8}
            fill="var(--foreground)"
            fontFamily="var(--font-mono)"
            fontSize={stroke * 6}
          >
            A
          </text>
          <text
            x={b.x + stroke * 3}
            y={-b.y + stroke * 8}
            fill="var(--foreground)"
            fontFamily="var(--font-mono)"
            fontSize={stroke * 6}
          >
            B
          </text>
        </g>
      )}

      {tool === "compasso" && a && p && (
        <g stroke="var(--foreground)" strokeWidth={stroke * 1.4} fill="none">
          <circle cx={a.x} cy={-a.y} r={stroke * 3} fill="var(--warn)" stroke="none" />
          <line x1={a.x} y1={-a.y} x2={(a.x + p.x) / 2} y2={-((a.y + p.y) / 2) - offset * 0.65} />
          <line x1={p.x} y1={-p.y} x2={(a.x + p.x) / 2} y2={-((a.y + p.y) / 2) - offset * 0.65} />
          <circle cx={(a.x + p.x) / 2} cy={-((a.y + p.y) / 2) - offset * 0.65} r={stroke * 2.2} />
        </g>
      )}

      {(tool === "regua" || tool === "esquadro") && a && b && (
        <g transform={`rotate(${-angle} ${a.x} ${-a.y})`}>
          <rect
            x={a.x}
            y={-a.y - stroke * 6}
            width={Math.max(activeEntity?.length ?? 0, stroke * 30)}
            height={stroke * 9}
            fill="var(--foreground)"
            fillOpacity="0.12"
            stroke="var(--foreground)"
            strokeWidth={stroke * 0.8}
          />
        </g>
      )}

      {tool === "transferidor" && a && (
        <g transform={`translate(${a.x} ${-a.y}) rotate(${-angle})`}>
          <path
            d={`M ${-offset} 0 A ${offset} ${offset} 0 0 1 ${offset} 0`}
            fill="var(--foreground)"
            fillOpacity="0.1"
            stroke="var(--foreground)"
            strokeWidth={stroke}
          />
          <text
            x="0"
            y={-offset * 0.35}
            textAnchor="middle"
            fill="var(--success)"
            fontFamily="var(--font-mono)"
            fontSize={stroke * 6}
          >
            {Math.abs(angle).toFixed(1)}°
          </text>
        </g>
      )}

      {p &&
        tool !== "compasso" &&
        tool !== "regua" &&
        tool !== "esquadro" &&
        tool !== "transferidor" && (
          <g transform={`translate(${p.x} ${-p.y}) rotate(${-angle})`}>
            <path
              d={`M ${-stroke * 16} ${-stroke * 3} L 0 0 L ${-stroke * 16} ${stroke * 3} Z`}
              fill="var(--warn)"
              stroke="var(--foreground)"
              strokeWidth={stroke * 0.7}
            />
            <circle
              cx="0"
              cy="0"
              r={stroke * 3.4}
              fill="none"
              stroke="var(--warn)"
              strokeWidth={stroke}
            />
          </g>
        )}

      <g transform={`translate(${viewMinX} ${-viewMaxY - pad * 0.58})`}>
        <text fill="var(--accent)" fontFamily="var(--font-mono)" fontSize={stroke * 7}>
          {stepLabel.toUpperCase()}
        </text>
        <text
          y={stroke * 9}
          fill="var(--foreground)"
          fontFamily="var(--font-mono)"
          fontSize={stroke * 6}
        >
          {TOOL_LABEL[tool]} · {frame.action.type}
        </text>
      </g>
    </svg>
  );
}
