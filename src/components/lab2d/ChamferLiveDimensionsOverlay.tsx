/**
 * CALDRA CHAMFER — OVERLAY DE COTAS VIVAS, ORIGEM TEMPORÁRIA (REF 0,0) E BORDA ATIVA (SVG)
 *
 * Renderiza elementos gráficos de precisão milimétrica mobile-first:
 *  - Marcador pulsante de Origem Temporária (REF 0,0) com eixos locais;
 *  - Destaque da Borda de Referência Ativa com vetor normal e linha guia paralela;
 *  - Cotas Vivas ("Smart Dimensions") com linhas de chamada, setas e badges clicáveis;
 *  - Toque direto sobre a cota para edição imediata no teclado CAD.
 */

import React from "react";
import type { Vec2 } from "@/lib/geometry/types";
import type { TemporaryOrigin } from "@/lib/lab2d/cadCoordinateFrames";
import type { EdgeReference } from "@/lib/lab2d/cadGeometricReferences";
import type { LiveDimension } from "@/lib/lab2d/cadDynamicDimensions";

interface ChamferLiveDimensionsOverlayProps {
  temporaryOrigin: TemporaryOrigin | null;
  activeEdge: EdgeReference | null;
  activeEdgeSide: 1 | -1;
  liveDimensions: LiveDimension[];
  viewK: number;
  isDark?: boolean;
  onDimensionClick?: (dim: LiveDimension, screenPos: Vec2) => void;
  onClearTemporaryOrigin?: () => void;
  onInvertEdgeSide?: () => void;
}

export function ChamferLiveDimensionsOverlay({
  temporaryOrigin,
  activeEdge,
  activeEdgeSide,
  liveDimensions,
  viewK,
  isDark = true,
  onDimensionClick,
  onClearTemporaryOrigin,
  onInvertEdgeSide,
}: ChamferLiveDimensionsOverlayProps) {
  const safeK = Number.isFinite(viewK) && viewK > 0 ? viewK : 1;

  const cyan = isDark ? "#00E5FF" : "#0284c7";
  const amber = isDark ? "#FBBF24" : "#D97706";
  const emerald = isDark ? "#10B981" : "#059669";
  const bgBadge = isDark ? "rgba(11, 16, 23, 0.94)" : "rgba(255, 255, 255, 0.96)";

  return (
    <g className="select-none">
      {/* 1. MARCADOR DE ORIGEM TEMPORÁRIA (REF 0,0) */}
      {temporaryOrigin && (
        <g>
          {/* Círculo pulsante e mira central */}
          <circle
            cx={temporaryOrigin.p.x}
            cy={temporaryOrigin.p.y}
            r={16 / safeK}
            fill="none"
            stroke={amber}
            strokeWidth={1.5 / safeK}
            strokeDasharray={`${3 / safeK},${3 / safeK}`}
            className="animate-spin"
            style={{ transformOrigin: `${temporaryOrigin.p.x}px ${temporaryOrigin.p.y}px`, animationDuration: "10s" }}
          />
          <circle
            cx={temporaryOrigin.p.x}
            cy={temporaryOrigin.p.y}
            r={5 / safeK}
            fill={amber}
            fillOpacity={0.4}
            stroke={amber}
            strokeWidth={2 / safeK}
          />
          {/* Eixos Ortogonais Locais do REF 0,0 */}
          <line
            x1={temporaryOrigin.p.x - 24 / safeK}
            y1={temporaryOrigin.p.y}
            x2={temporaryOrigin.p.x + 24 / safeK}
            y2={temporaryOrigin.p.y}
            stroke={amber}
            strokeWidth={1.2 / safeK}
          />
          <line
            x1={temporaryOrigin.p.x}
            y1={temporaryOrigin.p.y - 24 / safeK}
            x2={temporaryOrigin.p.x}
            y2={temporaryOrigin.p.y + 24 / safeK}
            stroke={amber}
            strokeWidth={1.2 / safeK}
          />
          {/* Badge flutuante de REF 0,0 */}
          <g transform={`translate(${temporaryOrigin.p.x + 14 / safeK}, ${temporaryOrigin.p.y - 24 / safeK})`}>
            <rect
              x={0}
              y={0}
              width={86 / safeK}
              height={18 / safeK}
              rx={4 / safeK}
              fill={bgBadge}
              stroke={amber}
              strokeWidth={1.2 / safeK}
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
            />
            <text
              x={5 / safeK}
              y={12.5 / safeK}
              fill={amber}
              fontSize={9 / safeK}
              fontWeight="bold"
              fontFamily="monospace"
            >
              📍 REF (0,0)
            </text>
            <text
              x={62 / safeK}
              y={12 / safeK}
              fill={isDark ? "#94a3b8" : "#64748b"}
              fontSize={8 / safeK}
              fontWeight="bold"
              className="cursor-pointer hover:fill-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onClearTemporaryOrigin?.();
              }}
            >
              ✕
            </text>
          </g>
        </g>
      )}

      {/* 2. DESTAQUE DA BORDA DE REFERÊNCIA ATIVA */}
      {activeEdge && (
        <g>
          {/* Linha guia destacada sobre a borda */}
          <line
            x1={activeEdge.p1.x}
            y1={activeEdge.p1.y}
            x2={activeEdge.p2.x}
            y2={activeEdge.p2.y}
            stroke={cyan}
            strokeWidth={3 / safeK}
            strokeLinecap="round"
          />
          <line
            x1={activeEdge.p1.x}
            y1={activeEdge.p1.y}
            x2={activeEdge.p2.x}
            y2={activeEdge.p2.y}
            stroke="#ffffff"
            strokeWidth={1.2 / safeK}
            strokeDasharray={`${4 / safeK},${4 / safeK}`}
          />

          {/* Vetor Normal indicador de lado (afastamento) */}
          <g
            transform={`translate(${activeEdge.midpoint.x}, ${activeEdge.midpoint.y})`}
          >
            {/* Seta normal na direção ativa */}
            <line
              x1={0}
              y1={0}
              x2={activeEdge.normal.x * (30 / safeK) * activeEdgeSide}
              y2={activeEdge.normal.y * (30 / safeK) * activeEdgeSide}
              stroke={cyan}
              strokeWidth={2 / safeK}
              markerEnd="url(#arrow-cyan)"
            />
          </g>

          {/* Badge da Borda com Comprimento e Botão de Inverter Lado */}
          <g
            transform={`translate(${activeEdge.midpoint.x + activeEdge.normal.x * (40 / safeK) * activeEdgeSide}, ${
              activeEdge.midpoint.y + activeEdge.normal.y * (40 / safeK) * activeEdgeSide
            })`}
          >
            <rect
              x={-50 / safeK}
              y={-10 / safeK}
              width={100 / safeK}
              height={20 / safeK}
              rx={5 / safeK}
              fill={bgBadge}
              stroke={cyan}
              strokeWidth={1.2 / safeK}
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.7))"
            />
            <text
              x={0}
              y={3.5 / safeK}
              fill={cyan}
              fontSize={8.5 / safeK}
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              BORDA {activeEdge.length.toFixed(1)} mm
            </text>
          </g>
        </g>
      )}

      {/* 3. COTAS VIVAS DINÂMICAS (LIVE DIMENSIONS) */}
      {liveDimensions.map((dim) => {
        const dx = dim.endPoint.x - dim.startPoint.x;
        const dy = dim.endPoint.y - dim.startPoint.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) return null;

        const isOffset = dim.kind === "offset";
        const strokeColor = isOffset ? amber : cyan;

        return (
          <g key={dim.id}>
            {/* Linha da Cota */}
            <line
              x1={dim.startPoint.x}
              y1={dim.startPoint.y}
              x2={dim.endPoint.x}
              y2={dim.endPoint.y}
              stroke={strokeColor}
              strokeWidth={1.4 / safeK}
              strokeDasharray={`${3 / safeK},${2 / safeK}`}
            />

            {/* Marcadores de Extremidade (Ticks ortogonais) */}
            <circle cx={dim.startPoint.x} cy={dim.startPoint.y} r={2.5 / safeK} fill={strokeColor} />
            <circle cx={dim.endPoint.x} cy={dim.endPoint.y} r={2.5 / safeK} fill={strokeColor} />

            {/* Pill Interativo com o Valor da Cota (Clicável para edição) */}
            <g
              transform={`translate(${dim.midPoint.x}, ${dim.midPoint.y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (dim.isEditable && onDimensionClick) {
                  onDimensionClick(dim, { x: e.clientX, y: e.clientY });
                }
              }}
            >
              {/* Sombra / Halo do pill */}
              <rect
                x={-34 / safeK}
                y={-10 / safeK}
                width={68 / safeK}
                height={20 / safeK}
                rx={10 / safeK}
                fill={bgBadge}
                stroke={strokeColor}
                strokeWidth={1.5 / safeK}
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.8))"
              />
              <text
                x={0}
                y={3.5 / safeK}
                fill={strokeColor}
                fontSize={9 / safeK}
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {dim.label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
