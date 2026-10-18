/**
 * CALDRA CHAMFER — OVERLAY DE MARCADORES GEOMÉTRICOS E TOOLTIPS CAD DE PRECISÃO (SVG)
 *
 * Renderiza os glifos canônicos de snapping e referências inteligentes:
 *  - Endpoint: Quadrado □
 *  - Midpoint: Triângulo △
 *  - Center: Círculo com mira central ⊕
 *  - Quadrant: Losango ◇
 *  - Intersection: Cruz em X ✕
 *  - Projected Intersection: Cruz em X tracejada ✕
 *  - Tangent: Círculo com barra tangente ⊚
 *  - Perpendicular: Esquadro ortogonal ⟂
 *  - Geratriz: Círculo com raio radial de divisão ⊞
 *  - Construction: Ponto estelar / centro de montagem ✦
 *  - Badge flutuante com coordenadas mundiais e tipo de referência.
 */

import React from "react";
import type { Vec2 } from "@/lib/geometry/types";
import type { SmartReferencePoint, SmartSnapKind } from "@/lib/lab2d/cadReferenceSnaps";

interface ChamferSmartSnapOverlayProps {
  activeSnap: SmartReferencePoint | null;
  referencePoints?: SmartReferencePoint[];
  viewK: number;
  unit?: string;
  isDark?: boolean;
}

export function ChamferSmartSnapOverlay({
  activeSnap,
  referencePoints = [],
  viewK,
  unit = "mm",
  isDark = true,
}: ChamferSmartSnapOverlayProps) {
  const safeK = Number.isFinite(viewK) && viewK > 0 ? viewK : 1;
  const markerSize = Math.max(10, 14 / safeK);
  const half = markerSize / 2;

  // Cor característica de snap CAD profissional (verde-esmeralda vibrante ou amarelo técnico)
  const snapColor = isDark ? "#10b981" : "#059669"; // Emerald 500/600
  const activeColor = isDark ? "#38bdf8" : "#0284c7"; // Sky 400/600
  const geratrizColor = isDark ? "#f59e0b" : "#d97706"; // Amber 500/600

  const renderGlyph = (kind: SmartSnapKind, p: Vec2, size: number, color: string, isActive: boolean) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const safeSize = Number.isFinite(size) && size > 0 ? size : 14;
    const h = safeSize / 2;
    switch (kind) {
      case "end":
        // Quadrado canônico de extremidade
        return (
          <rect
            x={p.x - h}
            y={p.y - h}
            width={safeSize}
            height={safeSize}
            fill="none"
            stroke={color}
            strokeWidth={isActive ? 2.2 / safeK : 1.5 / safeK}
          />
        );

      case "mid":
        // Triângulo de ponto médio
        return (
          <polygon
            points={`${p.x},${p.y - h} ${p.x + h},${p.y + h} ${p.x - h},${p.y + h}`}
            fill="none"
            stroke={color}
            strokeWidth={isActive ? 2.2 / viewK : 1.5 / viewK}
          />
        );

      case "center":
        // Círculo com cruz interna (mira central)
        return (
          <g>
            <circle
              cx={p.x}
              cy={p.y}
              r={h}
              fill="none"
              stroke={color}
              strokeWidth={isActive ? 2.2 / safeK : 1.5 / safeK}
            />
            <line
              x1={p.x - h * 1.3}
              y1={p.y}
              x2={p.x + h * 1.3}
              y2={p.y}
              stroke={color}
              strokeWidth={1.2 / safeK}
            />
            <line
              x1={p.x}
              y1={p.y - h * 1.3}
              x2={p.x}
              y2={p.y + h * 1.3}
              stroke={color}
              strokeWidth={1.2 / safeK}
            />
          </g>
        );

      case "quadrant":
        // Losango de quadrante
        return (
          <polygon
            points={`${p.x},${p.y - h} ${p.x + h},${p.y} ${p.x},${p.y + h} ${p.x - h},${p.y}`}
            fill="none"
            stroke={color}
            strokeWidth={isActive ? 2.2 / safeK : 1.5 / safeK}
          />
        );

      case "intersection":
      case "proj_inter":
        // Cruz em X de interseção
        return (
          <g>
            <line
              x1={p.x - h}
              y1={p.y - h}
              x2={p.x + h}
              y2={p.y + h}
              stroke={color}
              strokeWidth={isActive ? 2.2 / safeK : 1.5 / safeK}
              strokeDasharray={kind === "proj_inter" ? `${2 / safeK},${2 / safeK}` : undefined}
            />
            <line
              x1={p.x + h}
              y1={p.y - h}
              x2={p.x - h}
              y2={p.y + h}
              stroke={color}
              strokeWidth={isActive ? 2.2 / safeK : 1.5 / safeK}
              strokeDasharray={kind === "proj_inter" ? `${2 / safeK},${2 / safeK}` : undefined}
            />
          </g>
        );

      case "tangent":
        // Círculo com tangente superior
        return (
          <g>
            <circle
              cx={p.x}
              cy={p.y + h * 0.2}
              r={h * 0.8}
              fill="none"
              stroke={color}
              strokeWidth={isActive ? 2.2 / safeK : 1.5 / safeK}
            />
            <line
              x1={p.x - h}
              y1={p.y - h * 0.6}
              x2={p.x + h}
              y2={p.y - h * 0.6}
              stroke={color}
              strokeWidth={1.8 / safeK}
            />
          </g>
        );

      case "perp":
        // Símbolo de esquadro perpendicular
        return (
          <g>
            <line x1={p.x - h} y1={p.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={1.8 / safeK} />
            <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - h} stroke={color} strokeWidth={1.8 / safeK} />
            <rect
              x={p.x - h * 0.45}
              y={p.y - h * 0.45}
              width={h * 0.45}
              height={h * 0.45}
              fill="none"
              stroke={color}
              strokeWidth={1.2 / safeK}
            />
          </g>
        );

      case "geratriz":
        // Círculo com ponto e raio para caldeiraria
        return (
          <g>
            <circle
              cx={p.x}
              cy={p.y}
              r={h * 0.7}
              fill="none"
              stroke={geratrizColor}
              strokeWidth={1.5 / safeK}
            />
            <circle cx={p.x} cy={p.y} r={1.5 / safeK} fill={geratrizColor} />
          </g>
        );

      case "construction":
      case "origin":
      default:
        // Círculo com mira discreta
        return (
          <g>
            <circle
              cx={p.x}
              cy={p.y}
              r={h * 0.6}
              fill="none"
              stroke={color}
              strokeWidth={1.5 / safeK}
            />
            <circle cx={p.x} cy={p.y} r={1.8 / safeK} fill={color} />
          </g>
        );
    }
  };

  return (
    <g className="pointer-events-none select-none">
      {/* 1. Pontos de referência contextuais passivos (visíveis durante comandos para orientação) */}
      {referencePoints
        .filter((ref) => ref && ref.p && Number.isFinite(ref.p.x) && Number.isFinite(ref.p.y))
        .map((ref, idx) => {
          const isCurrentlyActive =
            activeSnap &&
            activeSnap.p &&
            Number.isFinite(activeSnap.p.x) &&
            Number.isFinite(activeSnap.p.y) &&
            Math.hypot(activeSnap.p.x - ref.p.x, activeSnap.p.y - ref.p.y) < 1e-3;
          if (isCurrentlyActive) return null;

          const color = ref.kind === "geratriz" ? geratrizColor : isDark ? "#64748b" : "#94a3b8";
          return (
            <g key={`ref-${idx}`} opacity={0.65}>
              {renderGlyph(ref.kind, ref.p, markerSize * 0.8, color, false)}
            </g>
          );
        })}

      {/* 2. Ponto de Snap Ativo sob o cursor com Glifo Destacado e Tooltip */}
      {activeSnap && activeSnap.p && Number.isFinite(activeSnap.p.x) && Number.isFinite(activeSnap.p.y) && (
        <g>
          {/* Halo de destaque pulsante */}
          <circle
            cx={activeSnap.p.x}
            cy={activeSnap.p.y}
            r={markerSize * 0.9}
            fill={activeColor}
            fillOpacity={0.15}
            stroke={activeColor}
            strokeWidth={1 / safeK}
            strokeDasharray={`${3 / safeK},${3 / safeK}`}
          />

          {/* Glifo principal com cor de precisão */}
          {renderGlyph(activeSnap.kind, activeSnap.p, markerSize, snapColor, true)}

          {/* Tooltip flutuante CAD */}
          <g transform={`translate(${activeSnap.p.x + markerSize * 0.9}, ${activeSnap.p.y - markerSize * 0.8})`}>
            {/* Fundo do Tooltip */}
            <rect
              x={0}
              y={-14 / safeK}
              width={Math.max(80, 110 / safeK)}
              height={20 / safeK}
              rx={4 / safeK}
              fill={isDark ? "rgba(2, 6, 23, 0.92)" : "rgba(255, 255, 255, 0.95)"}
              stroke={snapColor}
              strokeWidth={1 / safeK}
              filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))"
            />
            {/* Texto do Tooltip */}
            <text
              x={5 / safeK}
              y={-1 / safeK}
              fill={isDark ? "#f8fafc" : "#0f172a"}
              fontSize={8.5 / safeK}
              fontFamily="ui-monospace, monospace"
              fontWeight="bold"
            >
              {activeSnap.label}
            </text>
            <text
              x={60 / safeK}
              y={-1 / safeK}
              fill={snapColor}
              fontSize={7.5 / safeK}
              fontFamily="ui-monospace, monospace"
              fontWeight="normal"
            >
              {activeSnap.p.x.toFixed(1)}, {activeSnap.p.y.toFixed(1)} {unit}
            </text>
          </g>
        </g>
      )}
    </g>
  );
}
