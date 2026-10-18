/**
 * CALDRA CHAMFER — MOTOR GEOMÉTRICO AVANÇADO DE FILETE E CHANFRO (CAD 2D)
 *
 * Implementa concordância e corte de cantos com precisão industrial:
 *  - Suporte a seleção direta de cantos (1 clique sobre o vértice ou interseção);
 *  - Suporte a seleção sequencial de 2 linhas concorrentes;
 *  - Suporte a múltiplos cantos na seleção (polilinhas, retângulos, polígonos, contornos fechados);
 *  - Criação de arcos tangentes matematicamente perfeitos com sweep correto;
 *  - Criação de chanfros retos conectando os pontos de corte;
 *  - Preservação topológica estrita (sem linhas duplicadas, sem lacunas ou vértices órfãos);
 *  - Atualização com histórico completo (desfazer / refazer);
 *  - Pré-visualização gráfica precisa em tempo real.
 */

import {
  type Entity,
  type Vec2,
  dist,
  lineIntersection,
  uid,
  segmentsOf,
} from "./core";

export interface CornerGeometry {
  corner: Vec2;
  farA: Vec2;
  farB: Vec2;
  dirA: Vec2;
  dirB: Vec2;
  lenA: number;
  lenB: number;
  angle: number;
}

export type DetectedCorner =
  | {
      kind: "lines";
      corner: Vec2;
      entityA: Extract<Entity, { type: "line" }>;
      entityB: Extract<Entity, { type: "line" }>;
      farA: Vec2;
      farB: Vec2;
    }
  | {
      kind: "polyline";
      corner: Vec2;
      entity: Extract<Entity, { type: "polyline" }>;
      vertexIndex: number;
      farA: Vec2;
      farB: Vec2;
    };

export interface FilletCalculation {
  radius: number;
  tangentDist: number;
  cutPointA: Vec2;
  cutPointB: Vec2;
  arcCenter: Vec2;
  startAngle: number;
  endAngle: number;
}

export interface ChamferCalculation {
  distA: number;
  distB: number;
  cutPointA: Vec2;
  cutPointB: Vec2;
}

/**
 * Analisa a geometria de um canto formado por um ponto central e duas direções.
 */
export function analyzeCorner(corner: Vec2, farA: Vec2, farB: Vec2): CornerGeometry | null {
  const lenA = dist(corner, farA);
  const lenB = dist(corner, farB);
  if (lenA < 0.05 || lenB < 0.05) return null;

  const dirA = { x: (farA.x - corner.x) / lenA, y: (farA.y - corner.y) / lenA };
  const dirB = { x: (farB.x - corner.x) / lenB, y: (farB.y - corner.y) / lenB };

  const dot = Math.max(-1, Math.min(1, dirA.x * dirB.x + dirA.y * dirB.y));
  const angle = Math.acos(dot);

  // Evita linhas colineares (0° ou 180°) que não formam um canto
  if (angle < 0.03 || angle > Math.PI - 0.03) return null;

  return { corner, farA, farB, dirA, dirB, lenA, lenB, angle };
}

/**
 * Calcula o arco tangente exato para um filete de raio R em um canto.
 */
export function calculateFillet(
  corner: Vec2,
  farA: Vec2,
  farB: Vec2,
  desiredRadius: number,
): FilletCalculation | null {
  const geom = analyzeCorner(corner, farA, farB);
  if (!geom) return null;

  const { dirA, dirB, lenA, lenB, angle } = geom;
  const halfAngle = angle / 2;
  const tanHalf = Math.tan(halfAngle);
  const sinHalf = Math.sin(halfAngle);
  if (tanHalf <= 1e-5 || sinHalf <= 1e-5) return null;

  // Limite máximo do recuo da concordância para não ultrapassar o comprimento das entidades
  const maxTangent = Math.min(lenA, lenB) * 0.95;
  const desiredTangent = desiredRadius / tanHalf;

  let effTangent = desiredTangent;
  let effRadius = desiredRadius;

  if (desiredTangent > maxTangent) {
    effTangent = maxTangent;
    effRadius = maxTangent * tanHalf;
  }
  if (effRadius < 0.05) return null;

  // Pontos de tangência nas duas pernas
  const cutPointA: Vec2 = {
    x: corner.x + dirA.x * effTangent,
    y: corner.y + dirA.y * effTangent,
  };
  const cutPointB: Vec2 = {
    x: corner.x + dirB.x * effTangent,
    y: corner.y + dirB.y * effTangent,
  };

  // Centro do arco na bissetriz interna do canto
  const bisector = { x: dirA.x + dirB.x, y: dirA.y + dirB.y };
  const bisLen = Math.hypot(bisector.x, bisector.y) || 1;
  const centerDist = effRadius / sinHalf;
  const arcCenter: Vec2 = {
    x: corner.x + (bisector.x / bisLen) * centerDist,
    y: corner.y + (bisector.y / bisLen) * centerDist,
  };

  // Ângulos polares dos pontos de tangência a partir do centro do círculo
  const angA = Math.atan2(cutPointA.y - arcCenter.y, cutPointA.x - arcCenter.x);
  const angB = Math.atan2(cutPointB.y - arcCenter.y, cutPointB.x - arcCenter.x);

  // No renderizador CAD SVG, arcos são desenhados de a0 para a1 no sentido horário (sweep positivo)
  // Testamos os dois sentidos e escolhemos aquele cujo ponto médio fica mais próximo do canto
  const normalize = (rad: number) => {
    let a = rad % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a;
  };

  const sweepAB = normalize(angB - angA);
  const midAngleAB = angA + sweepAB / 2;
  const midPtAB: Vec2 = {
    x: arcCenter.x + effRadius * Math.cos(midAngleAB),
    y: arcCenter.y + effRadius * Math.sin(midAngleAB),
  };

  const sweepBA = normalize(angA - angB);
  const midAngleBA = angB + sweepBA / 2;
  const midPtBA: Vec2 = {
    x: arcCenter.x + effRadius * Math.cos(midAngleBA),
    y: arcCenter.y + effRadius * Math.sin(midAngleBA),
  };

  let startAngle: number;
  let endAngle: number;

  if (dist(midPtAB, corner) <= dist(midPtBA, corner)) {
    startAngle = angA;
    endAngle = angB;
  } else {
    startAngle = angB;
    endAngle = angA;
  }

  return {
    radius: effRadius,
    tangentDist: effTangent,
    cutPointA,
    cutPointB,
    arcCenter,
    startAngle,
    endAngle,
  };
}

/**
 * Calcula os pontos de corte para um chanfro de distâncias d1 e d2.
 */
export function calculateChamfer(
  corner: Vec2,
  farA: Vec2,
  farB: Vec2,
  d1: number,
  d2?: number,
): ChamferCalculation | null {
  const geom = analyzeCorner(corner, farA, farB);
  if (!geom) return null;

  const { dirA, dirB, lenA, lenB } = geom;
  const effD1 = Math.min(Math.max(0.1, d1), lenA * 0.95);
  const effD2 = Math.min(Math.max(0.1, d2 ?? d1), lenB * 0.95);

  const cutPointA: Vec2 = {
    x: corner.x + dirA.x * effD1,
    y: corner.y + dirA.y * effD1,
  };
  const cutPointB: Vec2 = {
    x: corner.x + dirB.x * effD2,
    y: corner.y + dirB.y * effD2,
  };

  return {
    distA: effD1,
    distB: effD2,
    cutPointA,
    cutPointB,
  };
}

/**
 * Localiza um canto próximo ao ponto clicado ou tocado (tolerância em mm).
 */
export function findCornerAtPoint(
  p: Vec2,
  entities: Entity[],
  tol = 8,
): DetectedCorner | null {
  const lines = entities.filter((e): e is Extract<Entity, { type: "line" }> => e.type === "line");
  const polylines = entities.filter(
    (e): e is Extract<Entity, { type: "polyline" }> => e.type === "polyline",
  );

  // 1. Procura primeiro vértices compartilhados entre duas linhas (quinas unidas)
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]!;
    const ptsA = [{ x: la.x1, y: la.y1 }, { x: la.x2, y: la.y2 }];
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]!;
      const ptsB = [{ x: lb.x1, y: lb.y1 }, { x: lb.x2, y: lb.y2 }];

      for (let idxA = 0; idxA < 2; idxA++) {
        for (let idxB = 0; idxB < 2; idxB++) {
          const pa = ptsA[idxA]!;
          const pb = ptsB[idxB]!;
          if (dist(pa, pb) <= Math.max(1.5, tol * 0.6)) {
            const midCorner = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            if (dist(p, midCorner) <= tol) {
              const farA = idxA === 0 ? ptsA[1]! : ptsA[0]!;
              const farB = idxB === 0 ? ptsB[1]! : ptsB[0]!;
              return {
                kind: "lines",
                corner: midCorner,
                entityA: la,
                entityB: lb,
                farA,
                farB,
              };
            }
          }
        }
      }
    }
  }

  // 2. Procura vértices de polilinhas
  for (const poly of polylines) {
    const pts = poly.pts;
    const n = pts.length;
    if (n < 3) continue;
    const isClosed = poly.closed !== false;
    const maxIdx = isClosed ? n : n - 1;
    const startIdx = isClosed ? 0 : 1;

    for (let i = startIdx; i < maxIdx; i++) {
      const corner = pts[i]!;
      if (dist(p, corner) <= tol) {
        const prevIdx = (i - 1 + n) % n;
        const nextIdx = (i + 1) % n;
        return {
          kind: "polyline",
          corner,
          entity: poly,
          vertexIndex: i,
          farA: pts[prevIdx]!,
          farB: pts[nextIdx]!,
        };
      }
    }
  }

  // 3. Procura interseção geométrica de duas linhas que se cruzam próximo ao ponto
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]!;
    const sa: [Vec2, Vec2] = [{ x: la.x1, y: la.y1 }, { x: la.x2, y: la.y2 }];
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]!;
      const sb: [Vec2, Vec2] = [{ x: lb.x1, y: lb.y1 }, { x: lb.x2, y: lb.y2 }];
      const inter = lineIntersection(sa, sb, false);
      if (inter && dist(p, inter) <= tol) {
        const farA = dist(inter, sa[0]) > dist(inter, sa[1]) ? sa[0] : sa[1];
        const farB = dist(inter, sb[0]) > dist(inter, sb[1]) ? sb[0] : sb[1];
        return {
          kind: "lines",
          corner: inter,
          entityA: la,
          entityB: lb,
          farA,
          farB,
        };
      }
    }
  }

  return null;
}

/**
 * Localiza todos os cantos presentes no conjunto de entidades fornecido.
 */
export function findAllCornersInEntities(entities: Entity[]): DetectedCorner[] {
  const corners: DetectedCorner[] = [];
  const lines = entities.filter((e): e is Extract<Entity, { type: "line" }> => e.type === "line");
  const polylines = entities.filter(
    (e): e is Extract<Entity, { type: "polyline" }> => e.type === "polyline",
  );

  // Linhas conexas
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]!;
    const ptsA = [{ x: la.x1, y: la.y1 }, { x: la.x2, y: la.y2 }];
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]!;
      const ptsB = [{ x: lb.x1, y: lb.y1 }, { x: lb.x2, y: lb.y2 }];

      for (let idxA = 0; idxA < 2; idxA++) {
        for (let idxB = 0; idxB < 2; idxB++) {
          const pa = ptsA[idxA]!;
          const pb = ptsB[idxB]!;
          if (dist(pa, pb) <= 1.5) {
            const corner = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            const farA = idxA === 0 ? ptsA[1]! : ptsA[0]!;
            const farB = idxB === 0 ? ptsB[1]! : ptsB[0]!;
            if (analyzeCorner(corner, farA, farB)) {
              corners.push({
                kind: "lines",
                corner,
                entityA: la,
                entityB: lb,
                farA,
                farB,
              });
            }
          }
        }
      }
    }
  }

  // Polilinhas
  for (const poly of polylines) {
    const pts = poly.pts;
    const n = pts.length;
    if (n < 3) continue;
    const isClosed = poly.closed !== false;
    const maxIdx = isClosed ? n : n - 1;
    const startIdx = isClosed ? 0 : 1;

    for (let i = startIdx; i < maxIdx; i++) {
      const corner = pts[i]!;
      const prevIdx = (i - 1 + n) % n;
      const nextIdx = (i + 1) % n;
      const farA = pts[prevIdx]!;
      const farB = pts[nextIdx]!;
      if (analyzeCorner(corner, farA, farB)) {
        corners.push({
          kind: "polyline",
          corner,
          entity: poly,
          vertexIndex: i,
          farA,
          farB,
        });
      }
    }
  }

  return corners;
}

export interface FilletApplicationResult {
  updatedEntities: Entity[];
  createdArcId?: string;
  success: boolean;
}

export interface ChamferApplicationResult {
  updatedEntities: Entity[];
  createdLineId?: string;
  success: boolean;
}

/**
 * Aplica um filete com raio R sobre o canto detectado, retornando a lista de entidades atualizada.
 */
export function applyFilletToCorner(
  corner: DetectedCorner,
  radius: number,
  allEntities: Entity[],
): FilletApplicationResult {
  const calc = calculateFillet(corner.corner, corner.farA, corner.farB, radius);
  if (!calc) return { updatedEntities: allEntities, success: false };

  if (corner.kind === "lines") {
    const { entityA, entityB } = corner;

    const trimLine = (line: Extract<Entity, { type: "line" }>, cutP: Vec2): Entity => {
      const p1 = { x: line.x1, y: line.y1 };
      const p2 = { x: line.x2, y: line.y2 };
      return dist(corner.corner, p1) < dist(corner.corner, p2)
        ? { ...line, x1: cutP.x, y1: cutP.y }
        : { ...line, x2: cutP.x, y2: cutP.y };
    };

    const newA = trimLine(entityA, calc.cutPointA);
    const newB = trimLine(entityB, calc.cutPointB);

    const arcId = uid();
    const arcEntity: Entity = {
      id: arcId,
      layer: entityA.layer,
      type: "arc",
      cx: calc.arcCenter.x,
      cy: calc.arcCenter.y,
      r: calc.radius,
      a0: calc.startAngle,
      a1: calc.endAngle,
    };

    const updated = allEntities.map((e) => {
      if (e.id === entityA.id) return newA;
      if (e.id === entityB.id) return newB;
      return e;
    });
    updated.push(arcEntity);

    return { updatedEntities: updated, createdArcId: arcId, success: true };
  }

  if (corner.kind === "polyline") {
    const { entity, vertexIndex } = corner;
    const pts = [...entity.pts];
    const n = pts.length;

    // Discretiza o arco suavemente para manter a polilinha íntegra e fechada
    const numArcPts = 8;
    const arcPoints: Vec2[] = [];
    let sweep = calc.endAngle - calc.startAngle;
    while (sweep < 0) sweep += Math.PI * 2;

    for (let step = 0; step <= numArcPts; step++) {
      const t = calc.startAngle + (step / numArcPts) * sweep;
      arcPoints.push({
        x: calc.arcCenter.x + calc.radius * Math.cos(t),
        y: calc.arcCenter.y + calc.radius * Math.sin(t),
      });
    }

    // Garante orientação contínua com a ordem dos vértices da polilinha
    const prevPt = pts[(vertexIndex - 1 + n) % n]!;
    if (dist(arcPoints[0]!, prevPt) > dist(arcPoints[numArcPts]!, prevPt)) {
      arcPoints.reverse();
    }

    pts.splice(vertexIndex, 1, ...arcPoints);
    const newPoly: Entity = { ...entity, pts };

    const updated = allEntities.map((e) => (e.id === entity.id ? newPoly : e));
    return { updatedEntities: updated, success: true };
  }

  return { updatedEntities: allEntities, success: false };
}

/**
 * Aplica um chanfro sobre o canto detectado, retornando a lista de entidades atualizada.
 */
export function applyChamferToCorner(
  corner: DetectedCorner,
  distance1: number,
  distance2: number | undefined,
  allEntities: Entity[],
): ChamferApplicationResult {
  const calc = calculateChamfer(corner.corner, corner.farA, corner.farB, distance1, distance2);
  if (!calc) return { updatedEntities: allEntities, success: false };

  if (corner.kind === "lines") {
    const { entityA, entityB } = corner;

    const trimLine = (line: Extract<Entity, { type: "line" }>, cutP: Vec2): Entity => {
      const p1 = { x: line.x1, y: line.y1 };
      const p2 = { x: line.x2, y: line.y2 };
      return dist(corner.corner, p1) < dist(corner.corner, p2)
        ? { ...line, x1: cutP.x, y1: cutP.y }
        : { ...line, x2: cutP.x, y2: cutP.y };
    };

    const newA = trimLine(entityA, calc.cutPointA);
    const newB = trimLine(entityB, calc.cutPointB);

    const lineId = uid();
    const chamferLine: Entity = {
      id: lineId,
      layer: entityA.layer,
      type: "line",
      x1: calc.cutPointA.x,
      y1: calc.cutPointA.y,
      x2: calc.cutPointB.x,
      y2: calc.cutPointB.y,
    };

    const updated = allEntities.map((e) => {
      if (e.id === entityA.id) return newA;
      if (e.id === entityB.id) return newB;
      return e;
    });
    updated.push(chamferLine);

    return { updatedEntities: updated, createdLineId: lineId, success: true };
  }

  if (corner.kind === "polyline") {
    const { entity, vertexIndex } = corner;
    const pts = [...entity.pts];
    const n = pts.length;

    const prevPt = pts[(vertexIndex - 1 + n) % n]!;
    const insertPts =
      dist(calc.cutPointA, prevPt) <= dist(calc.cutPointB, prevPt)
        ? [calc.cutPointA, calc.cutPointB]
        : [calc.cutPointB, calc.cutPointA];

    pts.splice(vertexIndex, 1, ...insertPts);
    const newPoly: Entity = { ...entity, pts };

    const updated = allEntities.map((e) => (e.id === entity.id ? newPoly : e));
    return { updatedEntities: updated, success: true };
  }

  return { updatedEntities: allEntities, success: false };
}
