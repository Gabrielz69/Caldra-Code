/**
 * CALDRA CHAMFER — BOLHA QUADRADA DE ZOOM (LUPA DE PRECISÃO MOBILE)
 *
 * Implementa um visor ampliado de alta precisão (3x sobre o zoom atual da câmera):
 *  - Formato técnico quadrado de 130px x 130px com cantos arredondados e borda ciano de alto contraste;
 *  - Posicionamento inteligente anti-oclusão (offsetY = -115px com auto-flip no topo < 160px);
 *  - Renderização vetorial nativa em Canvas 2D Retina (devicePixelRatio);
 *  - Exibição de entidades do mundo, grade ortogonal/isométrica e prévias (draft/pending);
 *  - Mira técnica central (crosshair) ortogonal (0°/90°) ou isométrica (30°/90°/150°);
 *  - Indicador geométrico de snap com destaque magnético e badges numéricos (X, Y, L, ∠).
 */

import React, { useEffect, useRef, useMemo } from "react";
import type { Vec2 } from "@/lib/geometry/types";
import type { Entity, Snap } from "@/lib/lab2d/core";
import type { SmartReferencePoint } from "@/lib/lab2d/cadReferenceSnaps";
import type { TemporaryOrigin } from "@/lib/lab2d/cadCoordinateFrames";
import type { EdgeReference } from "@/lib/lab2d/cadGeometricReferences";
import { CoordinateFrameManager } from "@/lib/lab2d/cadCoordinateFrames";
import type { IsoPlane } from "@/lib/lab2d/isometricEngine";
import { techStyle } from "@/lib/lab2d/technical";
import { Magnet, Crosshair } from "lucide-react";

export interface ChamferPrecisionLoupeOverlayProps {
  visible: boolean;
  screenPos: Vec2; // Posição de toque na tela (px)
  cadPos: Vec2;    // Coordenada geométrica no mundo CAD (mm)
  activeSnap?: Snap | SmartReferencePoint | null;
  baseCadPoint?: Vec2 | null;
  temporaryOrigin?: TemporaryOrigin | null;
  activeEdge?: EdgeReference | null;
  cameraZoom?: number;
  drawingProjection?: "orthographic" | "isometric";
  isoPlane?: IsoPlane;
  entities?: Entity[];
  draft?: Entity | null;
  pendingPoints?: Vec2[];
  grid?: number;
  showGrid?: boolean;
  isDark?: boolean;
}

const LOUPE_SIZE = 130;
const HALF_SIZE = LOUPE_SIZE / 2; // 65px

export function ChamferPrecisionLoupeOverlay({
  visible,
  screenPos,
  cadPos,
  activeSnap,
  baseCadPoint,
  temporaryOrigin,
  activeEdge,
  cameraZoom = 1,
  drawingProjection = "orthographic",
  isoPlane = "top",
  entities = [],
  draft = null,
  pendingPoints = [],
  grid = 10,
  showGrid = true,
  isDark = true,
}: ChamferPrecisionLoupeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Determina o ponto-alvo no espaço do mundo: se houver snap ativo, mira no snap
  const targetWorld: Vec2 = useMemo(() => {
    if (activeSnap && activeSnap.p && Number.isFinite(activeSnap.p.x) && Number.isFinite(activeSnap.p.y)) {
      return activeSnap.p;
    }
    if (cadPos && Number.isFinite(cadPos.x) && Number.isFinite(cadPos.y)) {
      return cadPos;
    }
    return { x: 0, y: 0 };
  }, [activeSnap, cadPos]);

  // Cálculo de distância e ângulo a partir do ponto base (ex: desenho de linha ou cota)
  let distMm = 0;
  let angleDeg = 0;
  if (baseCadPoint && Number.isFinite(baseCadPoint.x) && Number.isFinite(baseCadPoint.y)) {
    const dx = targetWorld.x - baseCadPoint.x;
    const dy = targetWorld.y - baseCadPoint.y;
    distMm = Math.hypot(dx, dy);
    angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;
  }

  // Posicionamento inteligente da bolha:
  // Flutua acima do dedo (offsetY = -115px). Se muito perto do topo (< 160px), inverte para baixo (+115px).
  const isTouchNearTop = screenPos && screenPos.y < 160;
  const offsetY = isTouchNearTop ? 115 : -115;

  const winW = typeof window !== "undefined" ? window.innerWidth : 800;
  const winH = typeof window !== "undefined" ? window.innerHeight : 600;

  // Garante que a bolha nunca saia das bordas da tela
  const loupeCenterX = Math.max(HALF_SIZE + 10, Math.min(winW - HALF_SIZE - 10, screenPos?.x ?? HALF_SIZE + 10));
  const loupeCenterY = Math.max(HALF_SIZE + 10, Math.min(winH - HALF_SIZE - 10, (screenPos?.y ?? 150) + offsetY));

  const boxLeft = loupeCenterX - HALF_SIZE;
  const boxTop = loupeCenterY - HALF_SIZE;

  // Renderização em Canvas 2D da região ampliada
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2.5, window.devicePixelRatio || 2);
    const w = LOUPE_SIZE;
    const h = LOUPE_SIZE;

    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Fundo técnico escuro de alto contraste
    ctx.fillStyle = "#0B1017";
    ctx.fillRect(0, 0, w, h);

    // 2. Fator de ampliação adicional de 3x sobre o zoom atual da câmera
    const safeK = Number.isFinite(cameraZoom) && cameraZoom > 0 ? cameraZoom : 1;
    const loupeZoom = safeK * 3;

    // Área visível em coordenadas do mundo CAD (mm)
    const halfSpanMm = HALF_SIZE / loupeZoom;
    const minWx = targetWorld.x - halfSpanMm;
    const maxWx = targetWorld.x + halfSpanMm;
    const minWy = targetWorld.y - halfSpanMm;
    const maxWy = targetWorld.y + halfSpanMm;

    // 3. Renderização da Grade Técnica (Grid / IsoGrid)
    if (showGrid && grid > 0) {
      ctx.save();
      ctx.translate(HALF_SIZE, HALF_SIZE);
      ctx.scale(loupeZoom, loupeZoom);
      ctx.translate(-targetWorld.x, -targetWorld.y);

      if (drawingProjection === "isometric") {
        // Grade Isométrica com linhas a 30°, 150° e 90°
        ctx.strokeStyle = "rgba(0, 229, 255, 0.12)";
        ctx.lineWidth = 1 / loupeZoom;
        const isoStep = grid;
        const range = Math.max(halfSpanMm * 2, 80);

        const startX = Math.floor((targetWorld.x - range) / isoStep) * isoStep;
        const endX = Math.ceil((targetWorld.x + range) / isoStep) * isoStep;

        ctx.beginPath();
        // Linhas a 30° e 150°
        for (let gx = startX; gx <= endX; gx += isoStep) {
          const dy = range * Math.tan(Math.PI / 6);
          // Eixo 30°
          ctx.moveTo(gx - range, targetWorld.y - dy);
          ctx.lineTo(gx + range, targetWorld.y + dy);
          // Eixo 150°
          ctx.moveTo(gx - range, targetWorld.y + dy);
          ctx.lineTo(gx + range, targetWorld.y - dy);
        }
        ctx.stroke();
      } else {
        // Grade Ortogonal 2D
        const gStep = grid;
        const startX = Math.floor(minWx / gStep) * gStep;
        const endX = Math.ceil(maxWx / gStep) * gStep;
        const startY = Math.floor(minWy / gStep) * gStep;
        const endY = Math.ceil(maxWy / gStep) * gStep;

        ctx.strokeStyle = "rgba(0, 229, 255, 0.10)";
        ctx.lineWidth = 1 / loupeZoom;
        ctx.beginPath();
        for (let gx = startX; gx <= endX; gx += gStep) {
          ctx.moveTo(gx, minWy);
          ctx.lineTo(gx, maxWy);
        }
        for (let gy = startY; gy <= endY; gy += gStep) {
          ctx.moveTo(minWx, gy);
          ctx.lineTo(maxWx, gy);
        }
        ctx.stroke();

        // Eixos de origem principal se visíveis
        if (minWx <= 0 && maxWx >= 0) {
          ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
          ctx.lineWidth = 1.5 / loupeZoom;
          ctx.beginPath();
          ctx.moveTo(0, minWy);
          ctx.lineTo(0, maxWy);
          ctx.stroke();
        }
        if (minWy <= 0 && maxWy >= 0) {
          ctx.strokeStyle = "rgba(236, 72, 153, 0.4)";
          ctx.lineWidth = 1.5 / loupeZoom;
          ctx.beginPath();
          ctx.moveTo(minWx, 0);
          ctx.lineTo(maxWx, 0);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4. Renderização das Entidades Geométricas
    ctx.save();
    ctx.translate(HALF_SIZE, HALF_SIZE);
    ctx.scale(loupeZoom, loupeZoom);
    ctx.translate(-targetWorld.x, -targetWorld.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const inv = 1 / loupeZoom;

    // Função auxiliar para traçar polígono / polilinha
    const tracePts = (pts: Vec2[], closed?: boolean) => {
      if (!pts || pts.length === 0) return;
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      if (closed) ctx.closePath();
    };

    // Ordenação técnica de desenho
    const visibleEntities = entities.filter((e) => {
      if (e.type === "text") return false;
      // Teste rápido de proximidade para performance
      if (e.type === "line") {
        return (
          Math.min(e.x1, e.x2) <= maxWx &&
          Math.max(e.x1, e.x2) >= minWx &&
          Math.min(e.y1, e.y2) <= maxWy &&
          Math.max(e.y1, e.y2) >= minWy
        );
      }
      if (e.type === "circle") {
        return Math.hypot(e.cx - targetWorld.x, e.cy - targetWorld.y) <= e.r + halfSpanMm;
      }
      return true;
    });

    for (const e of visibleEntities) {
      // Faces sólidas isométricas com sombreamento técnico
      if (e.params?.isIsoSolidFace) {
        const fillCol = (e.params.fillColor as string) || "#323B47";
        const strokeCol = (e.params.strokeColor as string) || "#FFFFFF";
        const strokeW = (typeof e.params.strokeWidth === "number" ? e.params.strokeWidth : 2) * inv;

        ctx.save();
        ctx.beginPath();
        if (e.type === "polyline") tracePts(e.pts, !!e.closed);
        if (fillCol && fillCol !== "none") {
          ctx.fillStyle = fillCol;
          ctx.fill();
        }
        if (!e.params.noStroke && strokeCol && strokeCol !== "none") {
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = strokeW;
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      const style = techStyle(e.layer);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.max(1.2 * inv, style.weight * 1.5 * inv);
      const dash = style.dash(inv);
      ctx.setLineDash(dash ? dash.split(" ").map(Number) : []);

      ctx.beginPath();
      if (e.type === "line") {
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(e.x2, e.y2);
      } else if (e.type === "polyline") {
        tracePts(e.pts, !!e.closed);
      } else if (e.type === "circle") {
        ctx.moveTo(e.cx + e.r, e.cy);
        ctx.arc(e.cx, e.cy, e.r, 0, Math.PI * 2);
      } else if (e.type === "arc") {
        let sweep = e.a1 - e.a0;
        while (sweep < 0) sweep += Math.PI * 2;
        ctx.moveTo(e.cx + e.r * Math.cos(e.a0), e.cy + e.r * Math.sin(e.a0));
        ctx.arc(e.cx, e.cy, e.r, e.a0, e.a0 + sweep);
      } else if (e.type === "ellipse") {
        ctx.ellipse(e.cx, e.cy, e.rx, e.ry, e.rotation ?? 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // 5. Renderização do Traçado Ativo / Draft / Pontos Pendentes
    if (pendingPoints && pendingPoints.length > 0) {
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1.8 * inv;
      ctx.setLineDash([4 * inv, 3 * inv]);
      ctx.beginPath();
      tracePts(pendingPoints, false);
      const lastP = pendingPoints[pendingPoints.length - 1]!;
      ctx.lineTo(targetWorld.x, targetWorld.y);
      ctx.stroke();

      // Vértices dos pontos pendentes
      ctx.fillStyle = "#00E5FF";
      ctx.setLineDash([]);
      for (const pt of pendingPoints) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3 * inv, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (draft) {
      ctx.strokeStyle = "#FFD600";
      ctx.lineWidth = 1.8 * inv;
      ctx.setLineDash([3 * inv, 3 * inv]);
      ctx.beginPath();
      if (draft.type === "line") {
        ctx.moveTo(draft.x1, draft.y1);
        ctx.lineTo(draft.x2, draft.y2);
      } else if (draft.type === "polyline") {
        tracePts(draft.pts, !!draft.closed);
      } else if (draft.type === "circle") {
        ctx.arc(draft.cx, draft.cy, draft.r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    ctx.restore(); // Restaura transform do mundo CAD

    // 6. Mira Técnica Central (Crosshair de Alta Precisão)
    ctx.save();
    ctx.translate(HALF_SIZE, HALF_SIZE);

    if (drawingProjection === "isometric") {
      // Mira Isométrica alinhada aos eixos do plano ativo
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#00E5FF";
      ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
      ctx.shadowBlur = 4;

      const arm = 38;
      const gap = 5;

      const drawIsoRay = (angleRad: number) => {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        ctx.beginPath();
        ctx.moveTo(cos * gap, sin * gap);
        ctx.lineTo(cos * arm, sin * arm);
        ctx.stroke();
      };

      if (isoPlane === "top") {
        // Eixos a 30° e 150°
        drawIsoRay(Math.PI / 6);       // 30°
        drawIsoRay(-5 * Math.PI / 6);  // 210°
        drawIsoRay(5 * Math.PI / 6);   // 150°
        drawIsoRay(-Math.PI / 6);      // 330°
      } else if (isoPlane === "left") {
        // Eixos a 90° e 150°
        drawIsoRay(-Math.PI / 2);      // 90° para cima
        drawIsoRay(Math.PI / 2);       // 90° para baixo
        drawIsoRay(5 * Math.PI / 6);   // 150°
        drawIsoRay(-Math.PI / 6);      // 330°
      } else {
        // right: eixos a 90° e 30°
        drawIsoRay(-Math.PI / 2);
        drawIsoRay(Math.PI / 2);
        drawIsoRay(Math.PI / 6);
        drawIsoRay(-5 * Math.PI / 6);
      }
    } else {
      // Mira Ortogonal 2D (0° e 90°)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#00E5FF";
      ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
      ctx.shadowBlur = 3;

      const arm = 42;
      const gap = 5;

      ctx.beginPath();
      // Horizontal
      ctx.moveTo(-arm, 0);
      ctx.lineTo(-gap, 0);
      ctx.moveTo(gap, 0);
      ctx.lineTo(arm, 0);
      // Vertical
      ctx.moveTo(0, -arm);
      ctx.lineTo(0, -gap);
      ctx.moveTo(0, gap);
      ctx.lineTo(0, arm);
      ctx.stroke();

      // Círculo fino de tolerância central
      ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Marcador Geométrico de Snap Central (com destaque técnico)
    if (activeSnap) {
      const snapKind = activeSnap.kind;
      ctx.strokeStyle = "#FFD600";
      ctx.fillStyle = "rgba(255, 214, 0, 0.25)";
      ctx.lineWidth = 2.2;
      ctx.shadowColor = "rgba(255, 214, 0, 0.8)";
      ctx.shadowBlur = 6;

      ctx.beginPath();
      if (snapKind === "end") {
        // Extremidade / Vértice: Quadrado 12x12
        ctx.rect(-6, -6, 12, 12);
      } else if (snapKind === "mid") {
        // Ponto Médio: Triângulo equilátero
        ctx.moveTo(0, -7);
        ctx.lineTo(6, 5);
        ctx.lineTo(-6, 5);
        ctx.closePath();
      } else if (snapKind === "center") {
        // Centro: Círculo com cruzinha
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.moveTo(0, -3);
        ctx.lineTo(0, 3);
      } else if (snapKind === "quadrant") {
        // Quadrante: Losango
        ctx.moveTo(0, -7);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-7, 0);
        ctx.closePath();
      } else if (snapKind === "cross" || snapKind === "intersection") {
        // Interseção: "X"
        ctx.moveTo(-5, -5);
        ctx.lineTo(5, 5);
        ctx.moveTo(5, -5);
        ctx.lineTo(-5, 5);
      } else if (snapKind === "perp") {
        // Perpendicular: Esquadro
        ctx.moveTo(-6, -6);
        ctx.lineTo(-6, 6);
        ctx.lineTo(6, 6);
        ctx.moveTo(-6, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, 6);
      } else {
        // Snap genérico / Grid
        ctx.rect(-5, -5, 10, 10);
      }
      ctx.fill();
      ctx.stroke();
    } else {
      // Ponto de mira sem snap: micro ponto central ciano
      ctx.fillStyle = "#00E5FF";
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 8. Cantoneiras Técnicas estilo CAD HUD
    ctx.strokeStyle = "rgba(0, 229, 255, 0.7)";
    ctx.lineWidth = 1.5;
    const cl = 10; // comprimento da cantoneira
    const inset = 6;

    ctx.beginPath();
    // Top-Left
    ctx.moveTo(inset, inset + cl);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset + cl, inset);
    // Top-Right
    ctx.moveTo(w - inset - cl, inset);
    ctx.lineTo(w - inset, inset);
    ctx.lineTo(w - inset, inset + cl);
    // Bottom-Left
    ctx.moveTo(inset, h - inset - cl);
    ctx.lineTo(inset, h - inset);
    ctx.lineTo(inset + cl, h - inset);
    // Bottom-Right
    ctx.moveTo(w - inset - cl, h - inset);
    ctx.lineTo(w - inset, h - inset);
    ctx.lineTo(w - inset, h - inset - cl);
    ctx.stroke();

    ctx.restore();
  }, [
    visible,
    targetWorld,
    cameraZoom,
    drawingProjection,
    isoPlane,
    entities,
    draft,
    pendingPoints,
    grid,
    showGrid,
    activeSnap,
  ]);

  if (!visible || !screenPos || !Number.isFinite(screenPos.x) || !Number.isFinite(screenPos.y)) {
    return null;
  }

  // Label amigável do snap ativo
  const snapLabel =
    activeSnap && typeof activeSnap === "object"
      ? "label" in activeSnap && activeSnap.label
        ? activeSnap.label
        : activeSnap.kind.toUpperCase()
      : null;

  return (
    <div
      className="pointer-events-none fixed z-50 transition-opacity duration-150 ease-out select-none"
      style={{
        left: `${boxLeft}px`,
        top: `${boxTop}px`,
        width: `${LOUPE_SIZE}px`,
      }}
    >
      {/* BADGE DE CABEÇALHO (INDICADOR DE SNAP OU PRECISÃO 3X) */}
      <div className="mb-1.5 flex items-center justify-between px-2 py-0.5 rounded-md bg-[#0B1017]/95 border border-[#00E5FF]/40 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-1 text-[9px] font-mono font-bold tracking-wider text-[#00E5FF]">
          {temporaryOrigin ? (
            <>
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 truncate max-w-[85px]">REF (0,0)</span>
            </>
          ) : activeSnap ? (
            <>
              <Magnet className="w-2.5 h-2.5 text-[#FFD600] animate-pulse" />
              <span className="text-[#FFD600] truncate max-w-[85px]">{snapLabel}</span>
            </>
          ) : (
            <>
              <Crosshair className="w-2.5 h-2.5 text-[#00E5FF]" />
              <span>LUPA 3X</span>
            </>
          )}
        </div>
        <span className="text-[8px] font-mono text-cyan-300/70 font-semibold uppercase">
          {drawingProjection === "isometric" ? `ISO ${isoPlane}` : "ORTHO"}
        </span>
      </div>

      {/* CONTAINER QUADRADO TÉCNICO 130px x 130px (CANVAS VETORIAL AMPLIADO) */}
      <div
        className="relative w-[130px] h-[130px] rounded-[10px] overflow-hidden bg-[#0B1017] border-2 border-[#00E5FF] shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(0,229,255,0.35)] ring-1 ring-[#00E5FF]/40"
      >
        <canvas
          ref={canvasRef}
          style={{ width: `${LOUPE_SIZE}px`, height: `${LOUPE_SIZE}px` }}
          className="block w-full h-full"
        />
      </div>

      {/* BADGE DE RODAPÉ (COORDENADAS MILIMÉTRICAS DIGITAIS E MEDIDAS) */}
      <div className="mt-1.5 px-2 py-1 rounded-md bg-[#0B1017]/95 border border-border/80 backdrop-blur-md shadow-lg text-center font-mono text-[9px]">
        {temporaryOrigin ? (
          <div>
            <div className="flex items-center justify-center gap-1.5 font-bold text-amber-300">
              <span className="text-amber-400">ΔX:</span>
              <span>{(targetWorld.x - temporaryOrigin.p.x >= 0 ? "+" : "") + (targetWorld.x - temporaryOrigin.p.x).toFixed(1)}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400">ΔY:</span>
              <span>{(targetWorld.y - temporaryOrigin.p.y >= 0 ? "+" : "") + (targetWorld.y - temporaryOrigin.p.y).toFixed(1)}</span>
            </div>
            <div className="text-[7.5px] text-slate-400 font-normal">
              G: {targetWorld.x.toFixed(0)}, {targetWorld.y.toFixed(0)} mm
            </div>
          </div>
        ) : activeEdge ? (
          <div>
            {(() => {
              const { u, v } = CoordinateFrameManager.worldToUV(targetWorld, activeEdge);
              return (
                <div className="flex items-center justify-center gap-1.5 font-bold text-cyan-300">
                  <span className="text-cyan-400">u:</span>
                  <span>{u.toFixed(1)}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400">v:</span>
                  <span>{(v >= 0 ? "+" : "") + v.toFixed(1)} mm</span>
                </div>
              );
            })()}
            <div className="text-[7.5px] text-slate-400 font-normal truncate max-w-[120px] mx-auto">
              {activeEdge.label}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 font-bold text-slate-100">
            <span className="text-cyan-400">X:</span>
            <span>{targetWorld.x.toFixed(1)}</span>
            <span className="text-slate-600">|</span>
            <span className="text-pink-400">Y:</span>
            <span>{targetWorld.y.toFixed(1)}</span>
          </div>
        )}
        {baseCadPoint && distMm > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-[8.5px] text-amber-300 font-semibold mt-0.5 border-t border-slate-800/80 pt-0.5">
            <span>L: {distMm.toFixed(1)} mm</span>
            <span className="text-slate-600">•</span>
            <span>∠ {angleDeg.toFixed(1)}°</span>
          </div>
        )}
      </div>

      {/* GUIA TÉCNICA VISUAL APONTANDO NA DIREÇÃO DO DEDO / PONTO DE CONTATO */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-[#00E5FF]/80 to-transparent pointer-events-none ${
          isTouchNearTop ? "-top-6 h-6" : "-bottom-6 h-6"
        }`}
      />
    </div>
  );
}
