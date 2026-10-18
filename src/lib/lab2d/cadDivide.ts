/**
 * CALDRA CHAMFER — MOTOR GEOMÉTRICO DA FERRAMENTA DIVIDIR (CAD 2D)
 *
 * Divide peças e contornos em N partes iguais com precisão paramétrica:
 *  - Linhas e segmentos → N linhas reais iguais conectadas ponta a ponta
 *  - Arcos → N arcos de mesmo raio e abertura angular igual
 *  - Círculos → N arcos contíguos de 360°/N
 *  - Polilinhas abertas → N polilinhas com comprimentos de arco idênticos
 *  - Chapas e Retângulos fechados → N sub-chapas/retângulos fechados iguais (ao longo do comprimento ou largura)
 *  - Contornos fechados gerais → N trechos iguais de perímetro contíguos
 *
 * Todas as geometrias geradas são entidades reais, editáveis e compatíveis
 * com camadas, snap, corte CNC e histórico Undo/Redo.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, uid, type Entity } from "./core";

export interface DivideOptions {
  /** Para retângulos/chapas: "plate" = fatiar em sub-retângulos fechados; "perimeter" = dividir contorno */
  rectMode?: "plate" | "perimeter";
  /** Eixo de corte retangular: "auto" (ao longo da maior dimensão), "x" (comprimento) ou "y" (largura) */
  rectAxis?: "auto" | "x" | "y";
}

export interface DivideSummary {
  canDivide: boolean;
  typeLabel: string;
  totalMeasure: string;
  partMeasure: string;
  isRectangle: boolean;
  defaultAxis?: "x" | "y";
}

/** Verifica se a entidade é passível de divisão geométrica */
export function canDivideEntity(e: Entity | null | undefined): boolean {
  if (!e) return false;
  switch (e.type) {
    case "line":
    case "arc":
    case "circle":
    case "polyline":
    case "path":
      return true;
    default:
      return false;
  }
}

/** Verifica se a entidade é um retângulo fechado ortogonal ou polilinha retangular */
export function isRectangularPlate(e: Entity): boolean {
  if (e.type !== "polyline" || !e.closed || e.pts.length !== 4) return false;
  const pts = e.pts;
  // Verifica se lados adjacentes são aproximadamente ortogonais
  const d01 = dist(pts[0], pts[1]);
  const d12 = dist(pts[1], pts[2]);
  const d23 = dist(pts[2], pts[3]);
  const d30 = dist(pts[3], pts[0]);
  if (d01 < 1e-3 || d12 < 1e-3) return false;
  const tol = 1e-2;
  const oppSidesEqual = Math.abs(d01 - d23) < tol && Math.abs(d12 - d30) < tol;
  const diag1 = dist(pts[0], pts[2]);
  const diag2 = dist(pts[1], pts[3]);
  const diagsEqual = Math.abs(diag1 - diag2) < tol;
  return oppSidesEqual && diagsEqual;
}

/** Retorna resumo e métricas da divisão para exibir no editor compacto */
export function getDivideSummary(e: Entity, parts: number, options?: DivideOptions): DivideSummary {
  const n = Math.max(2, Math.min(50, Math.round(parts)));

  if (e.type === "line") {
    const len = dist({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
    const partLen = len / n;
    return {
      canDivide: true,
      typeLabel: "Linha / Segmento",
      totalMeasure: `${len.toFixed(2)} mm`,
      partMeasure: `${partLen.toFixed(2)} mm cada`,
      isRectangle: false,
    };
  }

  if (e.type === "circle") {
    const perimeter = 2 * Math.PI * e.r;
    const arcAngleDeg = 360 / n;
    return {
      canDivide: true,
      typeLabel: "Círculo",
      totalMeasure: `Ø${(e.r * 2).toFixed(2)} mm (360°)`,
      partMeasure: `Arco ${arcAngleDeg.toFixed(1)}° (${(perimeter / n).toFixed(2)} mm)`,
      isRectangle: false,
    };
  }

  if (e.type === "arc") {
    let sweep = e.a1 - e.a0;
    while (sweep < 0) sweep += Math.PI * 2;
    const sweepDeg = (sweep * 180) / Math.PI;
    const arcLen = sweep * e.r;
    const partSweepDeg = sweepDeg / n;
    const partLen = arcLen / n;
    return {
      canDivide: true,
      typeLabel: "Arco de Circunferência",
      totalMeasure: `${sweepDeg.toFixed(1)}° (L = ${arcLen.toFixed(2)} mm)`,
      partMeasure: `${partSweepDeg.toFixed(1)}° (${partLen.toFixed(2)} mm cada)`,
      isRectangle: false,
    };
  }

  if (e.type === "polyline") {
    const isRect = isRectangularPlate(e);
    if (isRect) {
      const xs = e.pts.map((p) => p.x);
      const ys = e.pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = maxX - minX;
      const h = maxY - minY;
      const defaultAxis = w >= h ? "x" : "y";
      const axis = options?.rectAxis === "auto" || !options?.rectAxis ? defaultAxis : options.rectAxis;

      if (options?.rectMode === "perimeter") {
        const perim = 2 * (w + h);
        return {
          canDivide: true,
          typeLabel: "Perímetro da Chapa",
          totalMeasure: `${perim.toFixed(2)} mm`,
          partMeasure: `${(perim / n).toFixed(2)} mm cada`,
          isRectangle: true,
          defaultAxis,
        };
      }

      const partSize = axis === "x" ? w / n : h / n;
      const fixedSize = axis === "x" ? h : w;
      return {
        canDivide: true,
        typeLabel: "Chapa Retangular",
        totalMeasure: `${w.toFixed(1)} × ${h.toFixed(1)} mm`,
        partMeasure:
          axis === "x"
            ? `${partSize.toFixed(2)} × ${fixedSize.toFixed(2)} mm`
            : `${fixedSize.toFixed(2)} × ${partSize.toFixed(2)} mm`,
        isRectangle: true,
        defaultAxis,
      };
    }

    // Polilinha geral
    let totalLen = 0;
    for (let i = 0; i < e.pts.length - 1; i++) {
      totalLen += dist(e.pts[i], e.pts[i + 1]);
    }
    if (e.closed && e.pts.length > 2) {
      totalLen += dist(e.pts[e.pts.length - 1], e.pts[0]);
    }
    const partLen = totalLen / n;
    return {
      canDivide: true,
      typeLabel: e.closed ? "Contorno Fechado" : "Polilinha",
      totalMeasure: `${totalLen.toFixed(2)} mm`,
      partMeasure: `${partLen.toFixed(2)} mm cada`,
      isRectangle: false,
    };
  }

  return {
    canDivide: false,
    typeLabel: "Entidade",
    totalMeasure: "—",
    partMeasure: "—",
    isRectangle: false,
  };
}

/** Divide uma linha em N segmentos lineares iguais */
function divideLine(e: Extract<Entity, { type: "line" }>, n: number): Entity[] {
  const result: Entity[] = [];
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;

  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    result.push({
      ...e,
      id: uid(),
      type: "line",
      x1: e.x1 + t0 * dx,
      y1: e.y1 + t0 * dy,
      x2: e.x1 + t1 * dx,
      y2: e.y1 + t1 * dy,
    });
  }

  return result;
}

/** Divide um arco em N arcos iguais */
function divideArc(e: Extract<Entity, { type: "arc" }>, n: number): Entity[] {
  const result: Entity[] = [];
  let sweep = e.a1 - e.a0;
  while (sweep < 0) sweep += Math.PI * 2;
  const subSweep = sweep / n;

  for (let i = 0; i < n; i++) {
    const a0 = e.a0 + i * subSweep;
    const a1 = e.a0 + (i + 1) * subSweep;
    result.push({
      ...e,
      id: uid(),
      type: "arc",
      cx: e.cx,
      cy: e.cy,
      r: e.r,
      a0,
      a1,
    });
  }

  return result;
}

/** Divide um círculo em N arcos iguais contíguos de 360°/N */
function divideCircle(e: Extract<Entity, { type: "circle" }>, n: number): Entity[] {
  const result: Entity[] = [];
  const subSweep = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const a0 = i * subSweep;
    const a1 = (i + 1) * subSweep;
    result.push({
      ...e,
      id: uid(),
      type: "arc",
      cx: e.cx,
      cy: e.cy,
      r: e.r,
      a0,
      a1,
    });
  }

  return result;
}

/** Fatiamento de retângulo/chapa em N sub-retângulos fechados iguais */
function divideRectanglePlate(
  e: Extract<Entity, { type: "polyline" }>,
  n: number,
  axis: "x" | "y",
): Entity[] {
  const xs = e.pts.map((p) => p.x);
  const ys = e.pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;

  const result: Entity[] = [];

  if (axis === "x") {
    const subW = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = minX + i * subW;
      const x1 = minX + (i + 1) * subW;
      result.push({
        ...e,
        id: uid(),
        type: "polyline",
        closed: true,
        pts: [
          { x: x0, y: minY },
          { x: x1, y: minY },
          { x: x1, y: maxY },
          { x: x0, y: maxY },
        ],
      });
    }
  } else {
    const subH = h / n;
    for (let i = 0; i < n; i++) {
      const y0 = minY + i * subH;
      const y1 = minY + (i + 1) * subH;
      result.push({
        ...e,
        id: uid(),
        type: "polyline",
        closed: true,
        pts: [
          { x: minX, y: y0 },
          { x: maxX, y: y0 },
          { x: maxX, y: y1 },
          { x: minX, y: y1 },
        ],
      });
    }
  }

  return result;
}

/** Divide uma polilinha contínua (aberta ou fechada) em N partes de mesmo comprimento de arco */
function dividePolylineByLength(
  e: Extract<Entity, { type: "polyline" }>,
  n: number,
): Entity[] {
  const isClosed = !!e.closed;
  const pts = e.pts;
  if (pts.length < 2) return [e];

  // Constrói lista de segmentos elementares
  interface Seg {
    p1: Vec2;
    p2: Vec2;
    len: number;
    startDist: number;
    endDist: number;
  }

  const segs: Seg[] = [];
  let accum = 0;
  const count = isClosed ? pts.length : pts.length - 1;

  for (let i = 0; i < count; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const l = dist(p1, p2);
    if (l > 1e-6) {
      segs.push({
        p1,
        p2,
        len: l,
        startDist: accum,
        endDist: accum + l,
      });
      accum += l;
    }
  }

  const totalLen = accum;
  if (totalLen <= 1e-6) return [e];

  const partLen = totalLen / n;

  // Interpola ponto ao longo da cadeia de segmentos
  const pointAtDist = (targetD: number): Vec2 => {
    const clampedD = Math.max(0, Math.min(totalLen, targetD));
    for (const seg of segs) {
      if (clampedD >= seg.startDist && clampedD <= seg.endDist) {
        const segT = (clampedD - seg.startDist) / seg.len;
        return {
          x: seg.p1.x + segT * (seg.p2.x - seg.p1.x),
          y: seg.p1.y + segT * (seg.p2.y - seg.p1.y),
        };
      }
    }
    const last = segs[segs.length - 1];
    return last ? last.p2 : pts[pts.length - 1];
  };

  const result: Entity[] = [];

  for (let i = 0; i < n; i++) {
    const d0 = i * partLen;
    const d1 = (i + 1) * partLen;

    const startPt = pointAtDist(d0);
    const endPt = pointAtDist(d1);

    const subPts: Vec2[] = [startPt];

    // Inclui vértices intermediários da polilinha original entre d0 e d1
    for (const seg of segs) {
      if (seg.startDist > d0 + 1e-5 && seg.startDist < d1 - 1e-5) {
        subPts.push(seg.p1);
      }
    }

    subPts.push(endPt);

    // Se tiver apenas 2 pontos, podemos gerar uma linha simples para edição direta
    if (subPts.length === 2) {
      result.push({
        ...e,
        id: uid(),
        type: "line",
        x1: subPts[0].x,
        y1: subPts[0].y,
        x2: subPts[1].x,
        y2: subPts[1].y,
      });
    } else {
      result.push({
        ...e,
        id: uid(),
        type: "polyline",
        closed: false,
        pts: subPts,
      });
    }
  }

  return result;
}

/** Executa a divisão geométrica de uma entidade em N partes */
export function divideEntity(
  entity: Entity,
  parts: number,
  options?: DivideOptions,
): Entity[] {
  const n = Math.max(2, Math.min(50, Math.round(parts)));

  switch (entity.type) {
    case "line":
      return divideLine(entity, n);

    case "arc":
      return divideArc(entity, n);

    case "circle":
      return divideCircle(entity, n);

    case "polyline": {
      const isRect = isRectangularPlate(entity);
      if (isRect && options?.rectMode !== "perimeter") {
        const xs = entity.pts.map((p) => p.x);
        const ys = entity.pts.map((p) => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        const defaultAxis = w >= h ? "x" : "y";
        const chosenAxis =
          options?.rectAxis === "auto" || !options?.rectAxis ? defaultAxis : options.rectAxis;
        return divideRectanglePlate(entity, n, chosenAxis);
      }
      return dividePolylineByLength(entity, n);
    }

    default:
      return [entity];
  }
}
