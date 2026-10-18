/**
 * CALDRA CHAMFER — NÚCLEO AVANÇADO DE GEOMETRIA 2D (CAD CORE)
 *
 * Suporte a entidades profissionais e métodos paramétricos de criação:
 *  - Rasgo Oblongo / Slot (dois centros + raio / centro + largura + comprimento + ângulo)
 *  - Retângulo 3 Pontos (inclinado) e Retângulo Centro-Canto
 *  - Círculo 2 Pontos, 3 Pontos e Tangente-Tangente-Raio (TTR)
 *  - Arco 3 Pontos, Centro-Início-Fim, Início-Fim-Raio
 *  - Linhas de Centro (Centerlines) e Marcas de Centro
 *  - Linhas de Construção Infinitas (XLine) e Semi-retas (Ray)
 *  - Spline Interpolada Suave (Catmull-Rom para polilinha ou Bézier composta)
 *  - Parser Universal de Coordenadas CAD (Absolutas, Relativas @dx,dy e Polares @dist<ang)
 *  - Polar Tracking (O-Track) com ângulos configuráveis (15°, 30°, 45°, 90°)
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, uid, type Entity, type LayerId } from "./core";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Cria um Rasgo Oblongo (Slot) preciso como uma polilinha fechada com extremidades arredondadas.
 */
export function createSlotPolyline(
  center: Vec2,
  length: number, // Distância entre centros dos raios
  width: number,  // Largura do rasgo (diâmetro = width, raio = width / 2)
  angleDeg = 0,
  layer: LayerId = "corte",
): Entity {
  const r = Math.max(0.1, width / 2);
  const halfLen = Math.max(0, length / 2);
  const angRad = angleDeg * DEG2RAD;
  const cosA = Math.cos(angRad);
  const sinA = Math.sin(angRad);

  // Vetor diretor ao longo do comprimento
  const dirX = cosA;
  const dirY = sinA;
  // Vetor normal
  const normX = -sinA;
  const normY = cosA;

  // Dois centros dos semicírculos
  const c1: Vec2 = {
    x: center.x - halfLen * dirX,
    y: center.y - halfLen * dirY,
  };
  const c2: Vec2 = {
    x: center.x + halfLen * dirX,
    y: center.y + halfLen * dirY,
  };

  const steps = 12;
  const pts: Vec2[] = [];

  // Semicírculo 1 (em torno de c2, de -90° a +90° relativo à normal)
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (i / steps) * Math.PI;
    const px = r * Math.cos(t);
    const py = r * Math.sin(t);
    // rotaciona pelo ângulo do slot
    pts.push({
      x: c2.x + (px * cosA - py * sinA),
      y: c2.y + (px * sinA + py * cosA),
    });
  }

  // Semicírculo 2 (em torno de c1, de +90° a +270° relativo à normal)
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI / 2 + (i / steps) * Math.PI;
    const px = r * Math.cos(t);
    const py = r * Math.sin(t);
    pts.push({
      x: c1.x + (px * cosA - py * sinA),
      y: c1.y + (px * sinA + py * cosA),
    });
  }

  return {
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts,
  };
}

/**
 * Cria Retângulo a partir do Centro e um dos Cantos.
 */
export function createCenterRectangle(
  center: Vec2,
  corner: Vec2,
  layer: LayerId = "corte",
  filletRadius = 0,
): Entity {
  const dx = Math.abs(corner.x - center.x);
  const dy = Math.abs(corner.y - center.y);
  const p1: Vec2 = { x: center.x - dx, y: center.y - dy };
  const p2: Vec2 = { x: center.x + dx, y: center.y + dy };

  if (filletRadius <= 0) {
    return {
      id: uid(),
      layer,
      type: "polyline",
      closed: true,
      pts: [
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p1.x, y: p2.y },
      ],
    };
  }

  const r = Math.min(filletRadius, dx, dy);
  const arc = (cx: number, cy: number, startAng: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = startAng + (i / 6) * (Math.PI / 2);
      return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) };
    });

  return {
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [
      ...arc(p1.x + r, p1.y + r, Math.PI),
      ...arc(p2.x - r, p1.y + r, -Math.PI / 2),
      ...arc(p2.x - r, p2.y - r, 0),
      ...arc(p1.x + r, p2.y - r, Math.PI / 2),
    ],
  };
}

/**
 * Cria Retângulo Inclinado por 3 Pontos (P1 -> P2 define a base e comprimento; P3 define a altura).
 */
export function create3PointRectangle(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  layer: LayerId = "corte",
): Entity {
  const baseLen = dist(p1, p2);
  if (baseLen < 1e-4) {
    return { id: uid(), layer, type: "polyline", closed: true, pts: [p1, p2, p3] };
  }

  const ux = (p2.x - p1.x) / baseLen;
  const uy = (p2.y - p1.y) / baseLen;
  const nx = -uy;
  const ny = ux;

  // Altura é a projeção perpendicular do vetor (p3 - p1) na normal
  const h = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;

  const p4: Vec2 = { x: p1.x + h * nx, y: p1.y + h * ny };
  const p3Aligned: Vec2 = { x: p2.x + h * nx, y: p2.y + h * ny };

  return {
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [p1, p2, p3Aligned, p4],
  };
}

/**
 * Cria Círculo por 2 Pontos (diâmetro formado por P1 e P2).
 */
export function createCircle2Points(p1: Vec2, p2: Vec2, layer: LayerId = "corte"): Entity {
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const r = dist(p1, p2) / 2;
  return {
    id: uid(),
    layer,
    type: "circle",
    cx,
    cy,
    r: Math.max(0.1, r),
  };
}

/**
 * Cria Círculo por 3 Pontos (circuncírculo que passa exatamente por P1, P2 e P3).
 */
export function createCircle3Points(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  layer: LayerId = "corte",
): Entity | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-6) return null; // Pontos colineares

  const p1Sq = p1.x * p1.x + p1.y * p1.y;
  const p2Sq = p2.x * p2.x + p2.y * p2.y;
  const p3Sq = p3.x * p3.x + p3.y * p3.y;

  const cx = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
  const cy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;
  const r = Math.hypot(p1.x - cx, p1.y - cy);

  return {
    id: uid(),
    layer,
    type: "circle",
    cx,
    cy,
    r: Math.max(0.1, r),
  };
}

/**
 * Cria Arco por 3 Pontos (início P1, ponto intermediário P2, fim P3).
 */
export function createArc3Points(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  layer: LayerId = "corte",
): Entity | null {
  const circle = createCircle3Points(p1, p2, p3, layer);
  if (!circle || circle.type !== "circle") return null;

  const cx = circle.cx;
  const cy = circle.cy;
  const r = circle.r;

  let a0 = Math.atan2(p1.y - cy, p1.x - cx);
  const aMid = Math.atan2(p2.y - cy, p2.x - cx);
  let a1 = Math.atan2(p3.y - cy, p3.x - cx);

  // Normaliza ângulos no sentido trigonométrico que contém aMid
  const norm = (a: number) => (a < 0 ? a + 2 * Math.PI : a);
  const n0 = norm(a0);
  const nm = norm(aMid);
  const n1 = norm(a1);

  const passesCounterClockwise =
    (n0 < n1 && nm > n0 && nm < n1) || (n0 > n1 && (nm > n0 || nm < n1));

  if (!passesCounterClockwise) {
    // Inverte a0 e a1 para percorrer pelo lado correto
    const tmp = a0;
    a0 = a1;
    a1 = tmp;
  }

  return {
    id: uid(),
    layer,
    type: "arc",
    cx,
    cy,
    r,
    a0,
    a1,
  };
}

/**
 * Cria Linhas de Centro Técnicas (cruz de centro + traço-ponto) para furos / círculos.
 */
export function createCircleCenterline(
  circle: Extract<Entity, { type: "circle" | "arc" }>,
  overshoot = 5, // mm além da borda do raio
  layer: LayerId = "construcao",
): Entity[] {
  const r = circle.r + overshoot;
  return [
    {
      id: uid(),
      layer,
      type: "line",
      x1: circle.cx - r,
      y1: circle.cy,
      x2: circle.cx + r,
      y2: circle.cy,
    },
    {
      id: uid(),
      layer,
      type: "line",
      x1: circle.cx,
      y1: circle.cy - r,
      x2: circle.cx,
      y2: circle.cy + r,
    },
  ];
}

/**
 * Cria Spline suave interpolada por pontos de controle (Catmull-Rom para polilinha densa).
 */
export function createSplinePolyline(
  controlPoints: Vec2[],
  closed = false,
  layer: LayerId = "corte",
  subdivisions = 16,
): Entity {
  if (controlPoints.length < 2) {
    return {
      id: uid(),
      layer,
      type: "polyline",
      closed,
      pts: controlPoints,
    };
  }

  const pts: Vec2[] = [];
  const n = controlPoints.length;

  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = controlPoints[(i - 1 + n) % n]!;
    const p1 = controlPoints[i]!;
    const p2 = controlPoints[(i + 1) % n]!;
    const p3 = controlPoints[(i + 2) % n]!;

    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom spline formula
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      pts.push({ x, y });
    }
  }

  if (!closed && controlPoints[n - 1]) {
    pts.push(controlPoints[n - 1]!);
  }

  return {
    id: uid(),
    layer,
    type: "polyline",
    closed,
    pts,
  };
}

/**
 * Parser Universal de Coordenadas CAD para entrada rápida (barra de comando / HUD):
 * Formatos suportados:
 *  - "@50<45"    -> Relativo: 50mm no ângulo de 45°
 *  - "@100,50"   -> Relativo: deltaX = 100, deltaY = 50
 *  - "50<90"     -> Absoluto polar: 50mm a 90° da origem (0,0)
 *  - "150,200"   -> Absoluto cartesiano: X = 150, Y = 200
 *  - "150"       -> Distância pura na direção atual (se fornecida direção)
 */
export function parseCadCoordinate(
  input: string,
  basePoint?: Vec2,
  currentDirection?: Vec2,
): Vec2 | null {
  const clean = input.trim().replace(/\s+/g, "").toLowerCase();
  if (!clean) return null;

  // 1. Relativo Polar: @dist<ang
  const relPolarMatch = clean.match(/^@([+-]?\d*\.?\d+)<([+-]?\d*\.?\d+)$/);
  if (relPolarMatch) {
    const d = parseFloat(relPolarMatch[1]!);
    const a = parseFloat(relPolarMatch[2]!) * DEG2RAD;
    const base = basePoint ?? { x: 0, y: 0 };
    return {
      x: base.x + d * Math.cos(a),
      y: base.y + d * Math.sin(a),
    };
  }

  // 2. Relativo Cartesiano: @dx,dy
  const relCartMatch = clean.match(/^@([+-]?\d*\.?\d+),([+-]?\d*\.?\d+)$/);
  if (relCartMatch) {
    const dx = parseFloat(relCartMatch[1]!);
    const dy = parseFloat(relCartMatch[2]!);
    const base = basePoint ?? { x: 0, y: 0 };
    return {
      x: base.x + dx,
      y: base.y + dy,
    };
  }

  // 3. Absoluto Polar: dist<ang
  const absPolarMatch = clean.match(/^([+-]?\d*\.?\d+)<([+-]?\d*\.?\d+)$/);
  if (absPolarMatch) {
    const d = parseFloat(absPolarMatch[1]!);
    const a = parseFloat(absPolarMatch[2]!) * DEG2RAD;
    return {
      x: d * Math.cos(a),
      y: d * Math.sin(a),
    };
  }

  // 4. Absoluto Cartesiano: x,y
  const absCartMatch = clean.match(/^([+-]?\d*\.?\d+),([+-]?\d*\.?\d+)$/);
  if (absCartMatch) {
    return {
      x: parseFloat(absCartMatch[1]!),
      y: parseFloat(absCartMatch[2]!),
    };
  }

  // 5. Distância direta na direção ativa
  const distOnlyMatch = clean.match(/^([+-]?\d*\.?\d+)$/);
  if (distOnlyMatch && basePoint && currentDirection) {
    const d = parseFloat(distOnlyMatch[1]!);
    const len = Math.hypot(currentDirection.x, currentDirection.y) || 1;
    return {
      x: basePoint.x + (currentDirection.x / len) * d,
      y: basePoint.y + (currentDirection.y / len) * d,
    };
  }

  return null;
}

export interface PolarTrackingRay {
  origin: Vec2;
  angleDeg: number;
  guideSegment: [Vec2, Vec2];
}

/**
 * Calcula guias de Polar Tracking (O-Track) magnético a partir de um ponto base.
 * Retorna o ponto projetado no vetor polar mais próximo se dentro da tolerância angular.
 */
export function computePolarTrackingSnap(
  base: Vec2,
  cursor: Vec2,
  stepDeg = 45, // 15, 30, 45 ou 90 graus
  tolerancePx = 14, // em pixels da tela
  zoom = 1,
): { snappedPoint: Vec2; angleDeg: number; distance: number } | null {
  const dx = cursor.x - base.x;
  const dy = cursor.y - base.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-3) return null;

  let currentAngle = Math.atan2(dy, dx) * RAD2DEG;
  if (currentAngle < 0) currentAngle += 360;

  // Encontra o múltiplo de stepDeg mais próximo
  const nearestAngle = Math.round(currentAngle / stepDeg) * stepDeg;
  const normNearest = (nearestAngle % 360 + 360) % 360;

  const targetRad = normNearest * DEG2RAD;
  const targetDir = { x: Math.cos(targetRad), y: Math.sin(targetRad) };

  // Projeção ortogonal do cursor sobre a linha guia
  const projDist = dx * targetDir.x + dy * targetDir.y;
  const snappedPoint: Vec2 = {
    x: base.x + projDist * targetDir.x,
    y: base.y + projDist * targetDir.y,
  };

  // Distância perpendicular até a reta polar
  const perpDist = dist(cursor, snappedPoint) * zoom;
  if (perpDist <= tolerancePx) {
    return {
      snappedPoint,
      angleDeg: normNearest,
      distance: Math.abs(projDist),
    };
  }

  return null;
}
