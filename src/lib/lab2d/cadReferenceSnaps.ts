/**
 * CALDRA CHAMFER — MOTOR DE REFERÊNCIAS INTELIGENTES E SNAPPING GEOMÉTRICO (CAD 2D)
 *
 * Reconhecimento paramétrico de pontos característicos de alta precisão:
 *  - Extremidades (Endpoints): pontas de linhas, polilinhas, arcos;
 *  - Pontos Médios (Midpoints): centro de segmentos e perímetro de arcos;
 *  - Centros (Centers): centros de círculos, arcos, elipses e centroides de contornos fechados;
 *  - Quadrantes (Quadrants): 0°, 90°, 180°, 270° de círculos e elipses;
 *  - Vértices (Vertices): vértices de polilinhas, retângulos e polígonos;
 *  - Interseções (Intersections): encontros reais e projetados entre geometrias;
 *  - Tangências (Tangents): pontos de tangência a arcos e circunferências a partir de referência ativa;
 *  - Perpendiculares (Perpendicular): pontos normais a partir do ponto base;
 *  - Geratrizes de Caldeiraria (Geratriz): divisões de boca e geratrizes cilíndricas/cônicas (12/16/24 partes);
 *  - Pontos de Construção (Construction): centros de bounding boxes e pontos de origem (0,0);
 *  - Mais Próximo (Nearest): projeção ortogonal mais próxima sobre a geometria.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, type Entity, segmentsOf, lineIntersection, closestOnSegment, entityPoints } from "./core";

export type SmartSnapKind =
  | "end"          // Extremidade
  | "mid"          // Ponto Médio
  | "center"       // Centro
  | "quadrant"     // Quadrante
  | "intersection" // Interseção Real
  | "proj_inter"   // Interseção Projetada
  | "tangent"      // Tangência
  | "perp"         // Perpendicular
  | "geratriz"     // Geratriz de Caldeiraria
  | "construction" // Ponto de Construção / Bounding Box
  | "origin"       // Origem (0, 0)
  | "near";        // Mais Próximo

export interface SmartReferencePoint {
  p: Vec2;
  kind: SmartSnapKind;
  entityId?: string;
  label: string;
  desc?: string;
  priority: number;
}

export const SMART_SNAP_LABELS: Record<SmartSnapKind, string> = {
  end: "Extremidade",
  mid: "Ponto Médio",
  center: "Centro",
  quadrant: "Quadrante",
  intersection: "Interseção",
  proj_inter: "Interseção Projetada",
  tangent: "Tangência",
  perp: "Perpendicular",
  geratriz: "Geratriz",
  construction: "Construção",
  origin: "Origem (0,0)",
  near: "Mais Próximo",
};

/**
 * Calcula o centroide / centro geométrico real de uma entidade qualquer.
 */
export function getGeometricCenter(e: Entity): Vec2 {
  if (e.type === "circle" || e.type === "arc" || e.type === "ellipse") {
    return { x: e.cx, y: e.cy };
  }
  if (e.type === "line") {
    return { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 };
  }
  if (e.type === "point") {
    return { x: e.x, y: e.y };
  }
  if (e.type === "polyline" && e.pts.length > 0) {
    if (e.closed && e.pts.length >= 3) {
      // Centroide de polígono fechado
      let a = 0;
      let cx = 0;
      let cy = 0;
      const n = e.pts.length;
      for (let i = 0; i < n; i++) {
        const p1 = e.pts[i]!;
        const p2 = e.pts[(i + 1) % n]!;
        const cross = p1.x * p2.y - p2.x * p1.y;
        a += cross;
        cx += (p1.x + p2.x) * cross;
        cy += (p1.y + p2.y) * cross;
      }
      a = a * 0.5;
      if (Math.abs(a) > 1e-6) {
        return { x: cx / (6 * a), y: cy / (6 * a) };
      }
    }
    // Média dos pontos
    const sum = e.pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / e.pts.length, y: sum.y / e.pts.length };
  }
  if (e.type === "hatch" && e.boundaryPts.length > 0) {
    const sum = e.boundaryPts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / e.boundaryPts.length, y: sum.y / e.boundaryPts.length };
  }
  // Fallback: centro do bounding box
  const pts = entityPoints(e);
  if (pts.length === 0) return { x: 0, y: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * Extrai todos os pontos característicos de uma entidade individual para exibição dinâmica.
 */
export function extractEntitySmartReferences(
  e: Entity,
  activeStartPoint: Vec2 | null = null,
  divisionsCaldeiraria = 12,
): SmartReferencePoint[] {
  const refs: SmartReferencePoint[] = [];

  // 1. Linha simples
  if (e.type === "line") {
    refs.push(
      { p: { x: e.x1, y: e.y1 }, kind: "end", entityId: e.id, label: "Extremidade", priority: 1 },
      { p: { x: e.x2, y: e.y2 }, kind: "end", entityId: e.id, label: "Extremidade", priority: 1 },
      { p: { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 }, kind: "mid", entityId: e.id, label: "Ponto Médio", priority: 2 },
    );

    // Perpendicular a partir de ponto base ativo
    if (activeStartPoint) {
      const dx = e.x2 - e.x1;
      const dy = e.y2 - e.y1;
      const l2 = dx * dx + dy * dy;
      if (l2 > 1e-6) {
        const t = ((activeStartPoint.x - e.x1) * dx + (activeStartPoint.y - e.y1) * dy) / l2;
        if (t >= 0 && t <= 1) {
          refs.push({
            p: { x: e.x1 + t * dx, y: e.y1 + t * dy },
            kind: "perp",
            entityId: e.id,
            label: "Perpendicular",
            priority: 4,
          });
        }
      }
    }
    return refs;
  }

  // 2. Círculo
  if (e.type === "circle") {
    // Centro
    refs.push({ p: { x: e.cx, y: e.cy }, kind: "center", entityId: e.id, label: "Centro", priority: 1 });

    // 4 Quadrantes Canônicos (0°, 90°, 180°, 270°)
    refs.push(
      { p: { x: e.cx + e.r, y: e.cy }, kind: "quadrant", entityId: e.id, label: "Quadrante 0°", priority: 2 },
      { p: { x: e.cx, y: e.cy + e.r }, kind: "quadrant", entityId: e.id, label: "Quadrante 90°", priority: 2 },
      { p: { x: e.cx - e.r, y: e.cy }, kind: "quadrant", entityId: e.id, label: "Quadrante 180°", priority: 2 },
      { p: { x: e.cx, y: e.cy - e.r }, kind: "quadrant", entityId: e.id, label: "Quadrante 270°", priority: 2 },
    );

    // Geratrizes de caldeiraria (12 ou 16 divisões iguais para traçagem de bocas e curvas)
    if (divisionsCaldeiraria > 4) {
      for (let i = 0; i < divisionsCaldeiraria; i++) {
        // Evita duplicar quadrantes
        if (i % (divisionsCaldeiraria / 4) === 0) continue;
        const ang = (2 * Math.PI * i) / divisionsCaldeiraria;
        refs.push({
          p: { x: e.cx + e.r * Math.cos(ang), y: e.cy + e.r * Math.sin(ang) },
          kind: "geratriz",
          entityId: e.id,
          label: `Geratriz ${i + 1}/${divisionsCaldeiraria}`,
          priority: 5,
        });
      }
    }

    // Tangência a partir de ponto ativo
    if (activeStartPoint) {
      const dCenter = dist(activeStartPoint, { x: e.cx, y: e.cy });
      if (dCenter > e.r + 1e-4) {
        const baseAng = Math.atan2(e.cy - activeStartPoint.y, e.cx - activeStartPoint.x);
        const theta = Math.acos(e.r / dCenter);
        const t1 = baseAng + (Math.PI / 2 - theta);
        const t2 = baseAng - (Math.PI / 2 - theta);
        refs.push(
          { p: { x: e.cx + e.r * Math.cos(t1), y: e.cy + e.r * Math.sin(t1) }, kind: "tangent", entityId: e.id, label: "Tangente", priority: 3 },
          { p: { x: e.cx + e.r * Math.cos(t2), y: e.cy + e.r * Math.sin(t2) }, kind: "tangent", entityId: e.id, label: "Tangente", priority: 3 },
        );
      }
    }
    return refs;
  }

  // 3. Arco
  if (e.type === "arc") {
    // Centro do arco
    refs.push({ p: { x: e.cx, y: e.cy }, kind: "center", entityId: e.id, label: "Centro do Arco", priority: 1 });

    // Extremidades do arco
    const pStart = { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) };
    const pEnd = { x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) };
    refs.push(
      { p: pStart, kind: "end", entityId: e.id, label: "Extremidade Inicial", priority: 1 },
      { p: pEnd, kind: "end", entityId: e.id, label: "Extremidade Final", priority: 1 },
    );

    // Ponto médio no arco (sweep angular)
    let sweep = e.a1 - e.a0;
    while (sweep <= 0) sweep += 2 * Math.PI;
    const midAngle = e.a0 + sweep / 2;
    refs.push({
      p: { x: e.cx + e.r * Math.cos(midAngle), y: e.cy + e.r * Math.sin(midAngle) },
      kind: "mid",
      entityId: e.id,
      label: "Ponto Médio do Arco",
      priority: 2,
    });
    return refs;
  }

  // 4. Polilinha / Retângulo / Contorno fechado
  if (e.type === "polyline") {
    const pts = e.pts;
    const n = pts.length;

    // Vértices
    for (let i = 0; i < n; i++) {
      refs.push({
        p: pts[i]!,
        kind: "end",
        entityId: e.id,
        label: e.closed ? `Vértice ${i + 1}` : (i === 0 || i === n - 1 ? "Extremidade" : `Vértice ${i + 1}`),
        priority: 1,
      });
    }

    // Pontos médios dos segmentos
    for (let i = 0; i < n - 1; i++) {
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      refs.push({
        p: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        kind: "mid",
        entityId: e.id,
        label: `Ponto Médio (${i + 1}-${i + 2})`,
        priority: 2,
      });
    }
    if (e.closed && n > 2) {
      const pFirst = pts[0]!;
      const pLast = pts[n - 1]!;
      refs.push({
        p: { x: (pLast.x + pFirst.x) / 2, y: (pLast.y + pFirst.y) / 2 },
        kind: "mid",
        entityId: e.id,
        label: `Ponto Médio Fechamento`,
        priority: 2,
      });

      // Centro geométrico / Centroide do polígono fechado
      const center = getGeometricCenter(e);
      refs.push({
        p: center,
        kind: "center",
        entityId: e.id,
        label: n === 4 ? "Centro da Chapa" : "Centroide Geométrico",
        priority: 1,
      });
    }
    return refs;
  }

  // 5. Elipse
  if (e.type === "ellipse") {
    refs.push({ p: { x: e.cx, y: e.cy }, kind: "center", entityId: e.id, label: "Centro da Elipse", priority: 1 });
    refs.push(
      { p: { x: e.cx + e.rx, y: e.cy }, kind: "quadrant", entityId: e.id, label: "Quadrante Maior", priority: 2 },
      { p: { x: e.cx - e.rx, y: e.cy }, kind: "quadrant", entityId: e.id, label: "Quadrante Maior", priority: 2 },
      { p: { x: e.cx, y: e.cy + e.ry }, kind: "quadrant", entityId: e.id, label: "Quadrante Menor", priority: 2 },
      { p: { x: e.cx, y: e.cy - e.ry }, kind: "quadrant", entityId: e.id, label: "Quadrante Menor", priority: 2 },
    );
    return refs;
  }

  return refs;
}

/**
 * Calcula todas as interseções reais e projetadas entre as entidades fornecidas.
 */
export function extractIntersections(
  entities: Entity[],
  includeProjected = false,
  maxDistance = 5000,
): SmartReferencePoint[] {
  const points: SmartReferencePoint[] = [];
  const segsWithEntity: { seg: [Vec2, Vec2]; id: string; type: string }[] = [];

  for (const e of entities) {
    const sList = segmentsOf(e);
    for (const s of sList) {
      segsWithEntity.push({ seg: s, id: e.id, type: e.type });
    }
  }

  const n = segsWithEntity.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = segsWithEntity[i]!;
      const b = segsWithEntity[j]!;
      if (a.id === b.id) continue;

      // 1. Interseção Real
      const realX = lineIntersection(a.seg, b.seg, true);
      if (realX) {
        // Evita duplicatas muito próximas
        const exists = points.some((pt) => dist(pt.p, realX) < 1e-3);
        if (!exists) {
          points.push({
            p: realX,
            kind: "intersection",
            label: "Interseção",
            desc: "Cruzamento entre contornos",
            priority: 1,
          });
        }
      } else if (includeProjected) {
        // 2. Interseção Projetada (Prolongamento matemático)
        const projX = lineIntersection(a.seg, b.seg, false);
        if (projX) {
          const dA = dist(projX, a.seg[0]);
          const dB = dist(projX, b.seg[0]);
          if (dA <= maxDistance && dB <= maxDistance) {
            const exists = points.some((pt) => dist(pt.p, projX) < 1e-3);
            if (!exists) {
              points.push({
                p: projX,
                kind: "proj_inter",
                label: "Interseção Projetada",
                desc: "Encontro no prolongamento",
                priority: 3,
              });
            }
          }
        }
      }
    }
  }

  return points;
}

/**
 * Localiza o melhor ponto de referência sob o cursor com snap magnético.
 */
export function findSmartSnap(
  cursor: Vec2,
  entities: Entity[],
  tol: number,
  activeStartPoint: Vec2 | null = null,
  activeTool?: string,
  selectedEntityIds?: string[],
): SmartReferencePoint | null {
  const candidates: SmartReferencePoint[] = [];

  // Origem do plano
  candidates.push({ p: { x: 0, y: 0 }, kind: "origin", label: "Origem (0, 0)", priority: 7 });

  // 1. Pontos característicos de cada entidade relevante
  for (const e of entities) {
    const isSelected = selectedEntityIds?.includes(e.id);
    // Prioriza ou inclui geratrizes dependendo da ferramenta
    const refs = extractEntitySmartReferences(e, activeStartPoint, 12);
    for (const r of refs) {
      if (isSelected) {
        // Bônus de prioridade se a peça estiver sendo manipulada
        candidates.push({ ...r, priority: r.priority - 0.5 });
      } else {
        candidates.push(r);
      }
    }
  }

  // 2. Interseções reais entre geometrias
  const inters = extractIntersections(entities, false);
  candidates.push(...inters);

  // 3. Projeção "Mais Próximo" (Near) sobre qualquer segmento
  const allSegs = entities.flatMap(segmentsOf);
  for (const seg of allSegs) {
    const nearPt = closestOnSegment(cursor, seg);
    if (dist(nearPt, cursor) <= tol) {
      candidates.push({
        p: nearPt,
        kind: "near",
        label: "Mais Próximo",
        priority: 9,
      });
    }
  }

  // Filtra por tolerância de captura e ordena por prioridade e distância
  const inRange = candidates.filter((c) => dist(c.p, cursor) <= tol);
  if (inRange.length === 0) return null;

  inRange.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return dist(a.p, cursor) - dist(b.p, cursor);
  });

  return inRange[0] ?? null;
}
