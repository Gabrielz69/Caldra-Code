import { useMemo } from "react";
import { buildSquareToRoundModel, type SquareToRoundInput } from "@/lib/geometry/squareToRound";
import { foldRef, type GeometryRef } from "@/lib/geometry/refs";

/**
 * Desenho esquemático (vista frontal + planta) com linhas de cota
 * associadas aos campos de parâmetro e geratrizes interativas selecionáveis.
 */
export function SchematicSquareToRound({
  input,
  highlight,
  showGeneratrices = true,
  selectedRef = null,
  onSelectRef,
}: {
  input: SquareToRoundInput;
  highlight?: keyof SquareToRoundInput | null;
  showGeneratrices?: boolean;
  selectedRef?: GeometryRef | null;
  onSelectRef?: (ref: GeometryRef | null) => void;
}) {
  const model = useMemo(() => {
    try {
      return buildSquareToRoundModel(input);
    } catch {
      return null;
    }
  }, [input]);

  const { baseA, baseB, topDiameter, height, offsetX } = input;
  const maxW = Math.max(baseA, topDiameter, 1);
  const scale = 150 / Math.max(maxW, height * 0.85);
  const w = baseA * scale;
  const wTop = topDiameter * scale;
  const h = height * scale;
  const ox = offsetX * scale;
  const cx = 130;
  const baseY = 190;
  const topY = baseY - h;

  const on = (k: keyof SquareToRoundInput) =>
    highlight === k ? "var(--accent)" : "var(--muted-foreground)";
  const onW = (k: keyof SquareToRoundInput) => (highlight === k ? 1.6 : 1);

  // planta
  const pcx = 330;
  const pcy = 120;
  const pw = (baseA * scale) / 1.15;
  const ph = (baseB * scale) / 1.15;
  const pr = (topDiameter * scale) / 2 / 1.15;

  return (
    <svg
      viewBox="0 0 440 240"
      className="h-full w-full"
      role="img"
      aria-label="Esquema técnico da transição quadrado para redondo"
      onClick={() => onSelectRef?.(null)}
    >
      <defs>
        <pattern id="sq-grid" width="11" height="11" patternUnits="userSpaceOnUse">
          <path d="M11 0H0v11" fill="none" stroke="var(--grid-line)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="440" height="240" fill="url(#sq-grid)" />

      {/* VISTA FRONTAL */}
      <g>
        <path
          d={`M${cx - w / 2} ${baseY} L${cx - wTop / 2 + ox} ${topY} L${cx + wTop / 2 + ox} ${topY} L${cx + w / 2} ${baseY} Z`}
          fill="var(--accent)"
          fillOpacity="0.06"
          stroke="var(--accent)"
          strokeWidth="1.4"
        />

        {/* Geratrizes da vista frontal */}
        {showGeneratrices && model && (
          <g data-layer="generatrices-front">
            {model.generatrices.map((g, i) => {
              const x1 = cx + g.a.x * scale;
              const y1 = baseY - g.a.z * scale;
              const x2 = cx + g.b.x * scale;
              const y2 = baseY - g.b.z * scale;
              const isSelected = selectedRef === foldRef(i);
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              return (
                <g key={`gen-f-${g.id}`}>
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
                      onSelectRef?.(isSelected ? null : foldRef(i));
                    }}
                  >
                    <title>{`Geratriz G${i + 1}`}</title>
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
                        Geratriz G{i + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        <ellipse
          cx={cx + ox}
          cy={topY}
          rx={wTop / 2}
          ry={Math.max(wTop / 8, 3)}
          fill="none"
          stroke="var(--accent2)"
          strokeWidth="1.2"
        />
        <line
          x1={cx - w / 2}
          y1={baseY}
          x2={cx + w / 2}
          y2={baseY}
          stroke="var(--accent)"
          strokeWidth="1.6"
        />
        {/* eixo */}
        <line
          x1={cx}
          y1={topY - 14}
          x2={cx}
          y2={baseY + 14}
          stroke="var(--muted-foreground)"
          strokeWidth="0.6"
          strokeDasharray="6 3 1 3"
        />

        {/* cota altura */}
        <g stroke={on("height")} strokeWidth={onW("height")} fill="none">
          <line x1={cx - w / 2 - 26} y1={topY} x2={cx - w / 2 - 26} y2={baseY} />
          <line x1={cx - w / 2 - 30} y1={topY} x2={cx - w / 2 - 22} y2={topY} />
          <line x1={cx - w / 2 - 30} y1={baseY} x2={cx - w / 2 - 22} y2={baseY} />
        </g>
        <text
          x={cx - w / 2 - 30}
          y={(topY + baseY) / 2}
          fill={on("height")}
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          transform={`rotate(-90 ${cx - w / 2 - 30} ${(topY + baseY) / 2})`}
        >
          H {height}
        </text>

        {/* cota base A */}
        <g stroke={on("baseA")} strokeWidth={onW("baseA")} fill="none">
          <line x1={cx - w / 2} y1={baseY + 20} x2={cx + w / 2} y2={baseY + 20} />
          <line x1={cx - w / 2} y1={baseY + 16} x2={cx - w / 2} y2={baseY + 24} />
          <line x1={cx + w / 2} y1={baseY + 16} x2={cx + w / 2} y2={baseY + 24} />
        </g>
        <text
          x={cx}
          y={baseY + 34}
          fill={on("baseA")}
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          A {baseA}
        </text>

        {/* cota diâmetro topo */}
        <g stroke={on("topDiameter")} strokeWidth={onW("topDiameter")} fill="none">
          <line x1={cx - wTop / 2 + ox} y1={topY - 18} x2={cx + wTop / 2 + ox} y2={topY - 18} />
          <line x1={cx - wTop / 2 + ox} y1={topY - 22} x2={cx - wTop / 2 + ox} y2={topY - 14} />
          <line x1={cx + wTop / 2 + ox} y1={topY - 22} x2={cx + wTop / 2 + ox} y2={topY - 14} />
        </g>
        <text
          x={cx + ox}
          y={topY - 24}
          fill={on("topDiameter")}
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          Ø {topDiameter}
        </text>

        <text
          x={cx}
          y={228}
          fill="var(--muted-foreground)"
          fontSize="8"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          VISTA FRONTAL
        </text>
      </g>

      {/* PLANTA */}
      <g>
        <rect
          x={pcx - pw / 2}
          y={pcy - ph / 2}
          width={pw}
          height={ph}
          fill="var(--accent)"
          fillOpacity="0.05"
          stroke={on("baseB")}
          strokeWidth="1.3"
        />

        {/* Geratrizes na planta */}
        {showGeneratrices && model && (
          <g data-layer="generatrices-plan">
            {model.generatrices.map((g, i) => {
              const x1 = pcx + (g.a.x * scale) / 1.15;
              const y1 = pcy - (g.a.y * scale) / 1.15;
              const x2 = pcx + (g.b.x * scale) / 1.15;
              const y2 = pcy - (g.b.y * scale) / 1.15;
              const isSelected = selectedRef === foldRef(i);
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              return (
                <g key={`gen-p-${g.id}`}>
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
                      onSelectRef?.(isSelected ? null : foldRef(i));
                    }}
                  >
                    <title>{`Geratriz G${i + 1}`}</title>
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
                        Geratriz G{i + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        <circle
          cx={pcx + (offsetX * scale) / 1.15}
          cy={pcy - (input.offsetY * scale) / 1.15}
          r={pr}
          fill="none"
          stroke="var(--accent2)"
          strokeWidth="1.3"
        />
        {[0, 1, 2, 3].map((k) => {
          const sx = pcx + (k === 0 || k === 3 ? pw / 2 : -pw / 2);
          const sy = pcy + (k < 2 ? -ph / 2 : ph / 2);
          const ang = (k * Math.PI) / 2;
          return (
            <line
              key={k}
              x1={sx}
              y1={sy}
              x2={pcx + (offsetX * scale) / 1.15 + pr * Math.cos(ang)}
              y2={pcy - (input.offsetY * scale) / 1.15 - pr * Math.sin(ang)}
              stroke="var(--muted-foreground)"
              strokeWidth="0.6"
              strokeDasharray="3 3"
            />
          );
        })}
        <text
          x={pcx}
          y={pcy + ph / 2 + 16}
          fill={on("baseB")}
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          B {baseB}
        </text>
        <text
          x={pcx}
          y={228}
          fill="var(--muted-foreground)"
          fontSize="8"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          PLANTA
        </text>
      </g>
    </svg>
  );
}
