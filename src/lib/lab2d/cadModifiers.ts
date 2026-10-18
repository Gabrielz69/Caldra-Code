/**
 * CALDRA CHAMFER — MOTOR AVANÇADO DE MODIFICAÇÕES E FERRAMENTAS CAD 2D
 *
 * Implementa operações técnicas de modificação com precisão geométrica:
 *  - Esticar (Stretch) baseado em janela de cruzamento (crossing window);
 *  - Quebrar (Break) linha, polilinha ou círculo em ponto indicado;
 *  - Unir (Join) linhas e polilinhas contíguas em uma única polilinha contínua;
 *  - Explodir (Explode) polilinha, polígono ou retângulo em segmentos primitivos;
 *  - Chanfro Técnico Avançado (duas distâncias ou distância + ângulo);
 *  - Matriz Linear (Array retangular com linhas, colunas e espaçamentos);
 *  - Matriz Polar/Circular (Array circular com centro, contagem e ângulo total);
 *  - Espelhar por Eixo Livre (Mirror por 2 pontos de referência);
 *  - Divisão de Traçagem (Divide círculo/arco/linha em N partes iguais para caldeiraria);
 *  - Auditoria de Contornos (Fechamento, detecção de frestas/gaps, auto-interseções e duplicatas).
 */

import type { Vec2 } from "@/lib/geometry/types";
import {
  dist,
  lineIntersection,
  uid,
  type Box,
  type Entity,
  type LayerId,
} from "./core";

const DEG = Math.PI / 180;

// -------------------------------------------------------------
// 1. ESTICAR (STRETCH)
// -------------------------------------------------------------

/**
 * Estica as entidades selecionadas: vértices que estiverem DENTRO da janela
 * de seleção (crossing box) são deslocados por `delta` (dx, dy), enquanto os
 * vértices fora permanecem estáticos, preservando a conectividade do desenho.
 */
export function stretchSelection(
  entities: Entity[],
  crossingBox: Box,
  delta: Vec2,
): Entity[] {
  if (Math.abs(delta.x) < 1e-6 && Math.abs(delta.y) < 1e-6) return entities;

  const isInside = (p: Vec2): boolean =>
    p.x >= crossingBox.minX &&
    p.x <= crossingBox.maxX &&
    p.y >= crossingBox.minY &&
    p.y <= crossingBox.maxY;

  return entities.map((e) => {
    switch (e.type) {
      case "line": {
        const in1 = isInside({ x: e.x1, y: e.y1 });
        const in2 = isInside({ x: e.x2, y: e.y2 });
        if (!in1 && !in2) return e;
        return {
          ...e,
          x1: in1 ? e.x1 + delta.x : e.x1,
          y1: in1 ? e.y1 + delta.y : e.y1,
          x2: in2 ? e.x2 + delta.x : e.x2,
          y2: in2 ? e.y2 + delta.y : e.y2,
        };
      }
      case "polyline": {
        let changed = false;
        const newPts = e.pts.map((p) => {
          if (isInside(p)) {
            changed = true;
            return { x: p.x + delta.x, y: p.y + delta.y };
          }
          return p;
        });
        return changed ? { ...e, pts: newPts } : e;
      }
      case "circle":
      case "arc": {
        if (isInside({ x: e.cx, y: e.cy })) {
          return { ...e, cx: e.cx + delta.x, cy: e.cy + delta.y };
        }
        return e;
      }
      case "point": {
        if (isInside({ x: e.x, y: e.y })) {
          return { ...e, x: e.x + delta.x, y: e.y + delta.y };
        }
        return e;
      }
      case "text": {
        if (isInside({ x: e.x, y: e.y })) {
          return { ...e, x: e.x + delta.x, y: e.y + delta.y };
        }
        return e;
      }
      default:
        return e;
    }
  });
}

// -------------------------------------------------------------
// 2. QUEBRAR (BREAK)
// -------------------------------------------------------------

/**
 * Quebra uma linha ou polilinha em duas entidades separadas no ponto `clickP`.
 */
export function breakEntityAtPoint(
  e: Entity,
  clickP: Vec2,
): { originalId: string; created: Entity[] } | null {
  if (e.type === "line") {
    // Projeção ortogonal de clickP na linha
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-4) return null;

    const t = Math.max(0.01, Math.min(0.99, ((clickP.x - e.x1) * dx + (clickP.y - e.y1) * dy) / l2));
    const splitPt = { x: e.x1 + t * dx, y: e.y1 + t * dy };

    const seg1: Entity = {
      ...e,
      id: uid(),
      x1: e.x1,
      y1: e.y1,
      x2: splitPt.x,
      y2: splitPt.y,
    };
    const seg2: Entity = {
      ...e,
      id: uid(),
      x1: splitPt.x,
      y1: splitPt.y,
      x2: e.x2,
      y2: e.y2,
    };
    return { originalId: e.id, created: [seg1, seg2] };
  }

  if (e.type === "polyline" && e.pts.length >= 2) {
    // Localiza o segmento mais próximo de clickP
    let bestSeg = -1;
    let bestDist = Infinity;
    let splitPt: Vec2 = clickP;

    for (let i = 0; i < e.pts.length - 1; i++) {
      const p1 = e.pts[i]!;
      const p2 = e.pts[i + 1]!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const l2 = dx * dx + dy * dy;
      if (l2 < 1e-4) continue;

      const t = Math.max(0, Math.min(1, ((clickP.x - p1.x) * dx + (clickP.y - p1.y) * dy) / l2));
      const proj = { x: p1.x + t * dx, y: p1.y + t * dy };
      const d = dist(clickP, proj);
      if (d < bestDist) {
        bestDist = d;
        bestSeg = i;
        splitPt = proj;
      }
    }

    if (bestSeg < 0) return null;

    if (e.closed) {
      // Abre a polilinha fechada no ponto de quebra
      const pts = [
        splitPt,
        ...e.pts.slice(bestSeg + 1),
        ...e.pts.slice(0, bestSeg + 1),
        splitPt,
      ];
      return {
        originalId: e.id,
        created: [{ ...e, id: uid(), closed: false, pts }],
      };
    } else {
      // Divide a polilinha aberta em duas
      const ptsA = [...e.pts.slice(0, bestSeg + 1), splitPt];
      const ptsB = [splitPt, ...e.pts.slice(bestSeg + 1)];
      return {
        originalId: e.id,
        created: [
          { ...e, id: uid(), pts: ptsA, closed: false },
          { ...e, id: uid(), pts: ptsB, closed: false },
        ],
      };
    }
  }

  return null;
}

// -------------------------------------------------------------
// 3. UNIR (JOIN)
// -------------------------------------------------------------

/**
 * Une um conjunto de linhas e polilinhas contíguas em uma única polilinha contínua.
 */
export function joinEntities(
  entities: Entity[],
  idsToJoin: string[],
  tol = 1.0,
): { removedIds: string[]; created: Entity } | null {
  const targets = entities.filter((e) => idsToJoin.includes(e.id));
  if (targets.length < 2) return null;

  // Extrai todas as cadeias de segmentos
  type Chain = { pts: Vec2[]; origIds: string[]; layer: LayerId };
  const chains: Chain[] = [];

  for (const e of targets) {
    if (e.type === "line") {
      chains.push({
        pts: [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }],
        origIds: [e.id],
        layer: e.layer,
      });
    } else if (e.type === "polyline") {
      chains.push({
        pts: [...e.pts],
        origIds: [e.id],
        layer: e.layer,
      });
    }
  }

  if (chains.length === 0) return null;

  let merged = chains[0]!;
  const remaining = chains.slice(1);
  const usedIds = new Set(merged.origIds);

  let progress = true;
  while (progress && remaining.length > 0) {
    progress = false;
    const head = merged.pts[0]!;
    const tail = merged.pts[merged.pts.length - 1]!;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]!;
      const candHead = cand.pts[0]!;
      const candTail = cand.pts[cand.pts.length - 1]!;

      if (dist(tail, candHead) <= tol) {
        merged.pts.push(...cand.pts.slice(1));
        cand.origIds.forEach((id) => usedIds.add(id));
        remaining.splice(i, 1);
        progress = true;
        break;
      } else if (dist(tail, candTail) <= tol) {
        merged.pts.push(...cand.pts.slice().reverse().slice(1));
        cand.origIds.forEach((id) => usedIds.add(id));
        remaining.splice(i, 1);
        progress = true;
        break;
      } else if (dist(head, candTail) <= tol) {
        merged.pts.unshift(...cand.pts.slice(0, -1));
        cand.origIds.forEach((id) => usedIds.add(id));
        remaining.splice(i, 1);
        progress = true;
        break;
      } else if (dist(head, candHead) <= tol) {
        merged.pts.unshift(...cand.pts.slice().reverse().slice(0, -1));
        cand.origIds.forEach((id) => usedIds.add(id));
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  // Verifica se o resultado fecha em si mesmo
  const isClosed =
    merged.pts.length > 2 &&
    dist(merged.pts[0]!, merged.pts[merged.pts.length - 1]!) <= tol;

  if (isClosed) {
    merged.pts.pop(); // remove duplicata final
  }

  const created: Entity = {
    id: uid(),
    layer: merged.layer,
    type: "polyline",
    closed: isClosed,
    pts: merged.pts,
  };

  return {
    removedIds: Array.from(usedIds),
    created,
  };
}

// -------------------------------------------------------------
// 4. EXPLODIR (EXPLODE)
// -------------------------------------------------------------

/**
 * Converte polilinhas fechadas, retângulos e polígonos em segmentos de linha individuais.
 */
export function explodeEntity(e: Entity): Entity[] | null {
  if (e.type === "polyline" && e.pts.length >= 2) {
    const lines: Entity[] = [];
    const n = e.pts.length;
    const limit = e.closed ? n : n - 1;

    for (let i = 0; i < limit; i++) {
      const p1 = e.pts[i]!;
      const p2 = e.pts[(i + 1) % n]!;
      lines.push({
        id: uid(),
        layer: e.layer,
        type: "line",
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        group: e.group,
        cnc: e.cnc,
      });
    }
    return lines;
  }
  return null;
}

// -------------------------------------------------------------
// 5. CHANFRO TÉCNICO AVANÇADO (DISTÂNCIA / ÂNGULO)
// -------------------------------------------------------------

export function chamferLinesAdvanced(
  a: Entity,
  b: Entity,
  opts: {
    d1: number;
    d2?: number;
    angleDeg?: number;
  },
): { a: Entity; b: Entity; seg: Entity } | null {
  if (a.type !== "line" || b.type !== "line") return null;

  const sa: [Vec2, Vec2] = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }];
  const sb: [Vec2, Vec2] = [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];
  const inter = lineIntersection(sa, sb, false);
  if (!inter) return null;

  // Vetores unitários direcionados para fora da interseção
  const dirA = dist(inter, sa[0]) > dist(inter, sa[1])
    ? { x: (sa[0].x - inter.x) / (dist(inter, sa[0]) || 1), y: (sa[0].y - inter.y) / (dist(inter, sa[0]) || 1) }
    : { x: (sa[1].x - inter.x) / (dist(inter, sa[1]) || 1), y: (sa[1].y - inter.y) / (dist(inter, sa[1]) || 1) };

  const dirB = dist(inter, sb[0]) > dist(inter, sb[1])
    ? { x: (sb[0].x - inter.x) / (dist(inter, sb[0]) || 1), y: (sb[0].y - inter.y) / (dist(inter, sb[0]) || 1) }
    : { x: (sb[1].x - inter.x) / (dist(inter, sb[1]) || 1), y: (sb[1].y - inter.y) / (dist(inter, sb[1]) || 1) };

  const d1 = Math.max(0.1, opts.d1);
  let d2 = d1;

  if (opts.d2 !== undefined) {
    d2 = Math.max(0.1, opts.d2);
  } else if (opts.angleDeg !== undefined) {
    const angRad = (opts.angleDeg * DEG);
    d2 = Math.max(0.1, d1 * Math.tan(angRad));
  }

  const p1 = { x: inter.x + dirA.x * d1, y: inter.y + dirA.y * d1 };
  const p2 = { x: inter.x + dirB.x * d2, y: inter.y + dirB.y * d2 };

  const trimTo = (line: Extract<Entity, { type: "line" }>, seg: [Vec2, Vec2], cutP: Vec2): Entity => {
    return dist(inter, seg[0]) < dist(inter, seg[1])
      ? { ...line, x1: cutP.x, y1: cutP.y }
      : { ...line, x2: cutP.x, y2: cutP.y };
  };

  const newA = trimTo(a, sa, p1);
  const newB = trimTo(b, sb, p2);

  const seg: Entity = {
    id: uid(),
    layer: a.layer,
    type: "line",
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
  };

  return { a: newA, b: newB, seg };
}

// -------------------------------------------------------------
// 6. MATRIZ LINEAR (ARRAY RETANGULAR)
// -------------------------------------------------------------

export function arrayLinear(
  entities: Entity[],
  opts: {
    rows: number;
    cols: number;
    dx: number;
    dy: number;
  },
): Entity[] {
  const rows = Math.max(1, opts.rows);
  const cols = Math.max(1, opts.cols);
  const created: Entity[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue; // entidade base já existe
      const shiftX = c * opts.dx;
      const shiftY = r * opts.dy;

      entities.forEach((e) => {
        created.push({
          ...shiftEntity(e, shiftX, shiftY),
          id: uid(),
        });
      });
    }
  }

  return created;
}

// -------------------------------------------------------------
// 7. MATRIZ POLAR / CIRCULAR (ARRAY CIRCULAR)
// -------------------------------------------------------------

export function arrayCircular(
  entities: Entity[],
  opts: {
    center: Vec2;
    count: number;
    totalAngleDeg?: number; // padrão 360°
    rotateItems?: boolean; // padrão true
  },
): Entity[] {
  const count = Math.max(2, opts.count);
  const totalDeg = opts.totalAngleDeg ?? 360;
  const isFull = Math.abs(Math.abs(totalDeg) - 360) < 1e-3;
  const stepDeg = isFull ? totalDeg / count : totalDeg / (count - 1);
  const rotItems = opts.rotateItems ?? true;

  const created: Entity[] = [];
  const c = opts.center;

  for (let i = 1; i < count; i++) {
    const angleRad = (i * stepDeg) * DEG;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    entities.forEach((e) => {
      let rotated: Entity;
      if (rotItems) {
        rotated = rotateEntityAroundPoint(e, c, angleRad);
      } else {
        // Apenas translada a posição mantendo a orientação
        const centerE = getEntityCenter(e);
        const newCenterX = c.x + (centerE.x - c.x) * cosA - (centerE.y - c.y) * sinA;
        const newCenterY = c.y + (centerE.x - c.x) * sinA + (centerE.y - c.y) * cosA;
        const dx = newCenterX - centerE.x;
        const dy = newCenterY - centerE.y;
        rotated = shiftEntity(e, dx, dy);
      }
      created.push({ ...rotated, id: uid() });
    });
  }

  return created;
}

// -------------------------------------------------------------
// 8. ESPELHAR POR EIXO LIVRE (MIRROR 2 PONTOS)
// -------------------------------------------------------------

export function mirrorAcrossAxis(
  e: Entity,
  p1: Vec2,
  p2: Vec2,
): Entity {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Reflete um ponto em relação à linha que passa por p1 na direção (ux, uy)
  const reflect = (p: Vec2): Vec2 => {
    const vx = p.x - p1.x;
    const vy = p.y - p1.y;
    const dot = vx * ux + vy * uy;
    const projX = p1.x + dot * ux;
    const projY = p1.y + dot * uy;
    return {
      x: 2 * projX - p.x,
      y: 2 * projY - p.y,
    };
  };

  switch (e.type) {
    case "line":
      return {
        ...e,
        x1: reflect({ x: e.x1, y: e.y1 }).x,
        y1: reflect({ x: e.x1, y: e.y1 }).y,
        x2: reflect({ x: e.x2, y: e.y2 }).x,
        y2: reflect({ x: e.x2, y: e.y2 }).y,
      };
    case "polyline":
      return {
        ...e,
        pts: e.pts.map(reflect),
      };
    case "circle": {
      const refC = reflect({ x: e.cx, y: e.cy });
      return { ...e, cx: refC.x, cy: refC.y };
    }
    case "arc": {
      const refC = reflect({ x: e.cx, y: e.cy });
      const p0 = reflect({ x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) });
      const p1 = reflect({ x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) });
      return {
        ...e,
        cx: refC.x,
        cy: refC.y,
        a0: Math.atan2(p1.y - refC.y, p1.x - refC.x),
        a1: Math.atan2(p0.y - refC.y, p0.x - refC.x),
      };
    }
    case "ellipse": {
      const refC = reflect({ x: e.cx, y: e.cy });
      const lineAngle = Math.atan2(dy, dx);
      const newRot = 2 * lineAngle - (e.rotation ?? 0);
      return { ...e, cx: refC.x, cy: refC.y, rotation: newRot };
    }
    case "point": {
      const refP = reflect({ x: e.x, y: e.y });
      return { ...e, x: refP.x, y: refP.y };
    }
    case "text": {
      const refP = reflect({ x: e.x, y: e.y });
      return { ...e, x: refP.x, y: refP.y };
    }
    case "hatch": {
      return { ...e, boundaryPts: e.boundaryPts.map(reflect) };
    }
    default:
      return e;
  }
}

// -------------------------------------------------------------
// 9. DIVISÃO DE TRAÇAGEM (CALDEIRARIA)
// -------------------------------------------------------------

/**
 * Divide uma circunferência, arco ou segmento em N partes iguais, gerando
 * pontos notáveis numerados de traçagem na camada indicada.
 */
export function divideEntityForTracagem(
  e: Entity,
  divisions: number,
  layer: LayerId = "marcacao",
): Entity[] {
  const n = Math.max(2, Math.min(360, divisions));
  const points: Entity[] = [];

  if (e.type === "circle") {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const px = e.cx + e.r * Math.cos(angle);
      const py = e.cy + e.r * Math.sin(angle);
      points.push({
        id: uid(),
        layer,
        type: "point",
        x: px,
        y: py,
        label: String(i + 1),
      });
    }
  } else if (e.type === "arc") {
    let sweep = e.a1 - e.a0;
    while (sweep < 0) sweep += Math.PI * 2;
    for (let i = 0; i <= n; i++) {
      const angle = e.a0 + (i / n) * sweep;
      const px = e.cx + e.r * Math.cos(angle);
      const py = e.cy + e.r * Math.sin(angle);
      points.push({
        id: uid(),
        layer,
        type: "point",
        x: px,
        y: py,
        label: String(i + 1),
      });
    }
  } else if (e.type === "line") {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = e.x1 + t * (e.x2 - e.x1);
      const py = e.y1 + t * (e.y2 - e.y1);
      points.push({
        id: uid(),
        layer,
        type: "point",
        x: px,
        y: py,
        label: String(i + 1),
      });
    }
  }

  return points;
}

// -------------------------------------------------------------
// 10. AUDITORIA DE CONTORNOS (CONTOUR AUDIT)
// -------------------------------------------------------------

export interface ContourAuditReport {
  isValidForCnc: boolean;
  closedLoopsCount: number;
  openChainsCount: number;
  duplicateSegmentsCount: number;
  gaps: { p1: Vec2; p2: Vec2; distance: number }[];
  issues: string[];
}

export function auditContours(entities: Entity[], gapTol = 0.5): ContourAuditReport {
  const cutLines: [Vec2, Vec2][] = [];
  const issues: string[] = [];
  let duplicates = 0;

  // Filtra entidades de corte
  for (const e of entities) {
    if (e.layer !== "corte") continue;
    if (e.type === "line") {
      cutLines.push([{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]);
    } else if (e.type === "polyline") {
      for (let i = 0; i < e.pts.length - 1; i++) {
        cutLines.push([e.pts[i]!, e.pts[i + 1]!]);
      }
      if (e.closed && e.pts.length > 2) {
        cutLines.push([e.pts[e.pts.length - 1]!, e.pts[0]!]);
      }
    }
  }

  // Verifica duplicatas
  const seenKeys = new Set<string>();
  for (const [p1, p2] of cutLines) {
    const key = [p1.x, p1.y, p2.x, p2.y].map((v) => v.toFixed(2)).sort().join("-");
    if (seenKeys.has(key)) {
      duplicates++;
    } else {
      seenKeys.add(key);
    }
  }

  // Identifica frestas / extremidades abertas sem conexão
  const endpoints: Vec2[] = [];
  for (const [p1, p2] of cutLines) {
    endpoints.push(p1, p2);
  }

  const freeEnds: Vec2[] = [];
  for (let i = 0; i < endpoints.length; i++) {
    const pt = endpoints[i]!;
    // Conta quantas vezes este ponto se conecta a outros
    let connectionCount = 0;
    for (let j = 0; j < endpoints.length; j++) {
      if (i !== j && dist(pt, endpoints[j]!) <= gapTol) {
        connectionCount++;
      }
    }
    // Em contornos fechados válidos, cada vértice conecta exatamente a 1 outro segmento (grau 2 no grafo de arestas)
    if (connectionCount === 0) {
      freeEnds.push(pt);
    }
  }

  const gaps: { p1: Vec2; p2: Vec2; distance: number }[] = [];
  for (let i = 0; i < freeEnds.length; i++) {
    for (let j = i + 1; j < freeEnds.length; j++) {
      const d = dist(freeEnds[i]!, freeEnds[j]!);
      if (d <= gapTol * 4) {
        gaps.push({ p1: freeEnds[i]!, p2: freeEnds[j]!, distance: d });
      }
    }
  }

  if (duplicates > 0) {
    issues.push(`${duplicates} segmento(s) duplicado(s) na camada de corte.`);
  }
  if (freeEnds.length > 0) {
    issues.push(`${freeEnds.length} extremidade(s) aberta(s) ou fresta(s) detectada(s).`);
  }

  const closedLoopsCount = cutLines.length > 0 && freeEnds.length === 0 ? 1 : 0;
  const openChainsCount = freeEnds.length > 0 ? Math.ceil(freeEnds.length / 2) : 0;
  const isValidForCnc = issues.length === 0 && cutLines.length >= 3;

  return {
    isValidForCnc,
    closedLoopsCount,
    openChainsCount,
    duplicateSegmentsCount: duplicates,
    gaps,
    issues,
  };
}

// -------------------------------------------------------------
// AUXILIARES GEOMÉTRICOS INTERNOS
// -------------------------------------------------------------

export function shiftEntity(e: Entity, dx: number, dy: number): Entity {
  switch (e.type) {
    case "line":
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    case "polyline":
      return { ...e, pts: e.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case "circle":
    case "arc":
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    case "point":
    case "text":
      return { ...e, x: e.x + dx, y: e.y + dy };
    default:
      return e;
  }
}

export function rotateEntityAroundPoint(e: Entity, center: Vec2, angleRad: number): Entity {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const rot = (p: Vec2): Vec2 => ({
    x: center.x + (p.x - center.x) * cosA - (p.y - center.y) * sinA,
    y: center.y + (p.x - center.x) * sinA + (p.y - center.y) * cosA,
  });

  switch (e.type) {
    case "line": {
      const p1 = rot({ x: e.x1, y: e.y1 });
      const p2 = rot({ x: e.x2, y: e.y2 });
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case "polyline":
      return { ...e, pts: e.pts.map(rot) };
    case "circle": {
      const c = rot({ x: e.cx, y: e.cy });
      return { ...e, cx: c.x, cy: c.y };
    }
    case "arc": {
      const c = rot({ x: e.cx, y: e.cy });
      return { ...e, cx: c.x, cy: c.y, a0: e.a0 + angleRad, a1: e.a1 + angleRad };
    }
    case "point": {
      const p = rot({ x: e.x, y: e.y });
      return { ...e, x: p.x, y: p.y };
    }
    case "ellipse": {
      const c = rot({ x: e.cx, y: e.cy });
      return { ...e, cx: c.x, cy: c.y, rotation: (e.rotation ?? 0) + angleRad };
    }
    case "text": {
      const p = rot({ x: e.x, y: e.y });
      return { ...e, x: p.x, y: p.y, rotation: (e.rotation ?? 0) + (angleRad * 180) / Math.PI };
    }
    case "hatch": {
      return { ...e, boundaryPts: e.boundaryPts.map(rot) };
    }
    default:
      return e;
  }
}

export function getEntityCenter(e: Entity): Vec2 {
  switch (e.type) {
    case "line":
      return { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 };
    case "circle":
    case "arc":
      return { x: e.cx, y: e.cy };
    case "polyline": {
      const xs = e.pts.map((p) => p.x);
      const ys = e.pts.map((p) => p.y);
      return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
    }
    case "point":
    case "text":
      return { x: e.x, y: e.y };
    default:
      return { x: 0, y: 0 };
  }
}
