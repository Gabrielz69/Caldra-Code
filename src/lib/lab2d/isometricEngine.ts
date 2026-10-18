/**
 * CALDRA CHAMFER — MOTOR DE CONVERSÃO E RENDERIZAÇÃO ISOMÉTRICA SÓLIDA 2.5D/3D (HLR)
 *
 * Arquitetura de Engenharia:
 * 1. Renderização Técnica Sólida com Oclusão (Painter's Algorithm / Z-Sorting 2.5D/3D):
 *    - Sombreado técnico direcional discreto nas faces:
 *      * Topo (Top): #323B47
 *      * Esquerda (Left): #262E38
 *      * Direita (Right) e paredes internas de furos: #1B222A
 *    - Arestas visíveis em branco nítido (#FFFFFF, lineWidth 2.0px)
 *    - Remoção automática de linhas ocultas (HLR) por ordenação de profundidade (depth = X + Y + Z)
 *    - Linhas de centro e construção projetadas apenas uma única vez sobre a face principal (sem extrusão)
 * 2. Interpretação Topológica Real da Seleção 2D do Usuário (Zero Templates Fixos):
 *    - Contornos externos fechados (Outer Loops) com paredes laterais frontais visíveis
 *    - Furos passantes, rasgos e recortes internos com elipse superior completa, parede interna #1B222A
 *      e cálculo exato do arco inferior parcialmente visível dentro da abertura superior
 *    - Dobras reais de chapa (Linhas de Dobra) com partição geométrica, rotação espacial 3D real da aba
 *      e geração do cilindro de Raio de Dobra (R interno e R + espessura externo) com linhas de tangência
 *    - Cilindros, tubos, buchas e ressaltos extrudados (anéis concêntricos) com altura H, duas linhas
 *      de silhueta tangentes externas e semiarco frontal visível na base
 *    - Chanfros inclinados, filetes/concordâncias suaves (silhueta apenas na tangente extrema) e nervuras
 *      triangulares sólidas (mãos-francesas)
 */

import type { Vec2 } from "@/lib/geometry/types";
import type { Entity, LayerId } from "@/lib/lab2d/core";
import { uid, dist, bbox, translate } from "@/lib/lab2d/core";
import { makeDimension, measureDimension, resolvePoint, type Dimension } from "@/lib/lab2d/dimensions";

export type IsoPlane = "top" | "left" | "right";
export type DrawingProjectionMode = "orthographic" | "isometric";

export interface IsoPlaneConfig {
  id: IsoPlane;
  label: string;
  name: string;
  description: string;
  /** Ângulos dos eixos no plano (graus matemáticos) */
  axisAnglesDeg: [number, number];
  /** Vetores diretores unitários no espaço 2D de tela/canvas */
  uDir: Vec2;
  vDir: Vec2;
  /** Ângulo da elipse do isocírculo (graus no SVG) */
  ellipseRotationDeg: number;
  /** Cor do plano no HUD */
  accentColor: string;
}

// Paleta de Sombreado Técnico Sólido (Estilo Imagem de Referência Escura)
export const ISO_TECH_SHADING = {
  topFace: "#323B47",
  leftFace: "#262E38",
  rightFace: "#1B222A",
  chamferFace: "#2C3540",
  bendFace: "#2B3440",
  holeWall: "#1B222A",
  holeBottomVoid: "#141920",
  edgeStroke: "#FFFFFF",
  centerlineStroke: "#64748B",
} as const;

// Fatores canônicos de escala do isocírculo em projeção isométrica 2D
export const ISO_SQRT_1_5 = Math.sqrt(1.5); // ~1.224744871
export const ISO_SQRT_0_5 = Math.sqrt(0.5); // ~0.707106781
export const ISO_ASPECT_RATIO = Math.sqrt(1 / 3); // ~0.577350269 (ry / rx)

export const COS_30 = Math.cos(Math.PI / 6); // √3/2 ≈ 0.8660254037844386
export const SIN_30 = 0.5;
export const TAN_30 = Math.tan(Math.PI / 6); // 1/√3 ≈ 0.5773502691896257

// Vetores canônicos dos eixos isométricos (30°, 150°, 90° vertical)
export const ISO_AXIS_VECTORS = {
  axis30: { x: Math.cos(Math.PI / 6), y: -Math.sin(Math.PI / 6) },
  axis150: { x: Math.cos((5 * Math.PI) / 6), y: -Math.sin((5 * Math.PI / 6)) },
  axis90: { x: 0, y: -1 },
  axis210: { x: -Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) },
  axis330: { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) },
  axis270: { x: 0, y: 1 },
} as const;

export const ISO_PLANES: Record<IsoPlane, IsoPlaneConfig> = {
  top: {
    id: "top",
    label: "SUPERIOR",
    name: "Plano Superior (Isotop)",
    description: "Eixos a 30° e 150° (Largura × Comprimento)",
    axisAnglesDeg: [30, 150],
    uDir: ISO_AXIS_VECTORS.axis30,
    vDir: ISO_AXIS_VECTORS.axis150,
    ellipseRotationDeg: 0,
    accentColor: "#38BDF8",
  },
  left: {
    id: "left",
    label: "ESQUERDO",
    name: "Plano Esquerdo (Isoleft)",
    description: "Eixos a 150° e 90° (Comprimento × Altura)",
    axisAnglesDeg: [150, 90],
    uDir: ISO_AXIS_VECTORS.axis150,
    vDir: ISO_AXIS_VECTORS.axis90,
    ellipseRotationDeg: -60,
    accentColor: "#F59E0B",
  },
  right: {
    id: "right",
    label: "DIREITO",
    name: "Plano Direito (Isoright)",
    description: "Eixos a 30° e 90° (Largura × Altura)",
    axisAnglesDeg: [30, 90],
    uDir: ISO_AXIS_VECTORS.axis30,
    vDir: ISO_AXIS_VECTORS.axis90,
    ellipseRotationDeg: 60,
    accentColor: "#EC4899",
  },
};

export interface IsoEntityMeta {
  isIso?: boolean;
  plane?: IsoPlane;
  sourceKind?: "line" | "rect" | "circle" | "hole" | "arc" | "polygon";
  realRadius?: number;
  realDiameter?: number;
  realWidth?: number;
  realHeight?: number;
  realLength?: number;
}

/**
 * Converte coordenadas locais (u, v) em milímetros de um plano isométrico para o espaço 2D do canvas.
 */
export function isoPlaneToCanvas(
  plane: IsoPlane,
  u: number,
  v: number,
  origin: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const cfg = ISO_PLANES[plane];
  return {
    x: origin.x + u * cfg.uDir.x + v * cfg.vDir.x,
    y: origin.y + u * cfg.uDir.y + v * cfg.vDir.y,
  };
}

/**
 * Inverte ponto 2D do canvas para coordenadas locais (u, v) no plano isométrico especificado.
 */
export function canvasToIsoPlane(
  plane: IsoPlane,
  p: Vec2,
  origin: Vec2 = { x: 0, y: 0 },
): { u: number; v: number } {
  const cfg = ISO_PLANES[plane];
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const det = cfg.uDir.x * cfg.vDir.y - cfg.uDir.y * cfg.vDir.x;
  if (Math.abs(det) < 1e-9) return { u: dx, v: dy };
  const u = (dx * cfg.vDir.y - dy * cfg.vDir.x) / det;
  const v = (cfg.uDir.x * dy - cfg.uDir.y * dx) / det;
  return { u, v };
}

/**
 * Restringe o deslocamento do cursor aos eixos isométricos do plano ativo (Orto Isométrico / Isosnap).
 */
export function constrainToIsoAxes(from: Vec2, to: Vec2, plane: IsoPlane): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distTotal = Math.hypot(dx, dy);
  if (distTotal < 0.1) return to;

  const cfg = ISO_PLANES[plane];
  const candidateDirs: Vec2[] = [
    cfg.uDir,
    { x: -cfg.uDir.x, y: -cfg.uDir.y },
    cfg.vDir,
    { x: -cfg.vDir.x, y: -cfg.vDir.y },
  ];

  let bestDir = candidateDirs[0]!;
  let bestDot = -Infinity;

  for (const dir of candidateDirs) {
    const dot = (dx * dir.x + dy * dir.y) / distTotal;
    if (dot > bestDot) {
      bestDot = dot;
      bestDir = dir;
    }
  }

  const projDist = dx * bestDir.x + dy * bestDir.y;
  return {
    x: from.x + bestDir.x * projDist,
    y: from.y + bestDir.y * projDist,
  };
}

/**
 * Snapping em grade isométrica (passos regulares ao longo dos eixos isométricos).
 */
export function snapToIsoGrid(
  cursor: Vec2,
  gridStep: number,
  plane: IsoPlane,
  origin: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const g = Math.max(0.5, gridStep);
  const { u, v } = canvasToIsoPlane(plane, cursor, origin);
  const snappedU = Math.round(u / g) * g;
  const snappedV = Math.round(v / g) * g;
  return isoPlaneToCanvas(plane, snappedU, snappedV, origin);
}

/**
 * Constrói um retângulo isométrico (paralelogramo no plano ativo) a partir de 2 vértices opostos.
 */
export function buildIsoParallelogram(
  plane: IsoPlane,
  p1: Vec2,
  p2: Vec2,
  layer: LayerId,
): Entity {
  const { u: u1, v: v1 } = canvasToIsoPlane(plane, p1);
  const { u: u2, v: v2 } = canvasToIsoPlane(plane, p2);

  const realWidth = Math.abs(u2 - u1);
  const realHeight = Math.abs(v2 - v1);

  const corner1 = p1;
  const corner2 = isoPlaneToCanvas(plane, u2, v1);
  const corner3 = p2;
  const corner4 = isoPlaneToCanvas(plane, u1, v2);

  return {
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [corner1, corner2, corner3, corner4],
    params: {
      isIso: true,
      isoPlane: plane,
      sourceKind: "rect",
      realWidth,
      realHeight,
    },
  };
}

/**
 * Constrói um isocírculo no plano selecionado como uma elipse matematicamente exata.
 */
export function buildIsoCircle(
  plane: IsoPlane,
  center: Vec2,
  radius: number,
  layer: LayerId,
  isHole: boolean = false,
): Entity {
  const r = Math.max(0.1, radius);
  const cfg = ISO_PLANES[plane];

  const rx = r * ISO_SQRT_1_5;
  const ry = r * ISO_SQRT_0_5;

  return {
    id: uid(),
    layer,
    type: "ellipse",
    cx: center.x,
    cy: center.y,
    rx,
    ry,
    rotation: (cfg.ellipseRotationDeg * Math.PI) / 180,
    params: {
      isIso: true,
      isoPlane: plane,
      sourceKind: isHole ? "hole" : "circle",
      realRadius: r,
      realDiameter: r * 2,
      isHole,
    },
  };
}

/**
 * Constrói um furo cilíndrico isométrico sólido com oclusão real (Seção 2.2):
 * - Elipse superior completa com parede interna sombreada (#1B222A)
 * - Cálculo analítico da interseção da elipse inferior deslocada pela espessura T,
 *   desenhando APENAS o arco inferior que passa por dentro da abertura superior!
 */
export function buildIsoHoleWithDepth(
  plane: IsoPlane,
  center: Vec2,
  diameter: number,
  depth: number,
  layer: LayerId,
  refLayer: LayerId = "referencia",
  baseDepthOrder: number = 100,
): Entity[] {
  const r = Math.max(0.1, diameter / 2);
  const cfg = ISO_PLANES[plane];
  const entities: Entity[] = [];
  const rx = r * ISO_SQRT_1_5;
  const ry = r * ISO_SQRT_0_5;
  const rotRad = (cfg.ellipseRotationDeg * Math.PI) / 180;

  // 1. Preenchimento sombreado escuro da parede interna do furo (#1B222A)
  const holeWallFill: Entity = {
    id: uid(),
    layer,
    type: "ellipse",
    cx: center.x,
    cy: center.y,
    rx,
    ry,
    rotation: rotRad,
    params: {
      isIso: true,
      isoPlane: plane,
      isHole: true,
      realRadius: r,
      realDiameter: r * 2,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: ISO_TECH_SHADING.holeWall,
      strokeColor: "none",
      noStroke: true,
      depth: baseDepthOrder + 1,
    },
  };
  entities.push(holeWallFill);

  // 2. Arco inferior visível por dentro da elipse superior (Regra Visual 2.2)
  if (depth > 0) {
    const extVec = getIsoExtrusionVector(plane, depth);
    const botCenter: Vec2 = {
      x: center.x + extVec.x,
      y: center.y + extVec.y,
    };

    const visibleArcPts = computeVisibleBottomHoleArc(center, botCenter, rx, ry, rotRad);
    if (visibleArcPts.length >= 2) {
      entities.push({
        id: uid(),
        layer,
        type: "polyline",
        closed: false,
        pts: visibleArcPts,
        params: {
          isIso: true,
          isoPlane: plane,
          isIsoSolidFace: true,
          isIsoExtrudedBackFace: true,
          fillColor: "none",
          strokeColor: ISO_TECH_SHADING.edgeStroke,
          strokeWidth: 1.8,
          depth: baseDepthOrder + 2,
        },
      });
    }
  }

  // 3. Contorno branco nítido da elipse superior do furo
  const topHoleRing: Entity = {
    id: uid(),
    layer,
    type: "ellipse",
    cx: center.x,
    cy: center.y,
    rx,
    ry,
    rotation: rotRad,
    params: {
      isIso: true,
      isoPlane: plane,
      sourceKind: "hole",
      realRadius: r,
      realDiameter: r * 2,
      isHole: true,
      isIsoSolidFace: true,
      fillColor: "none",
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.0,
      depth: baseDepthOrder + 3,
    },
  };
  entities.push(topHoleRing);

  // 4. Linhas de centro isométricas discretas (apenas na face superior, sem duplicar no fundo)
  const crossLength = r * 1.25;
  entities.push({
    id: uid(),
    layer: refLayer,
    type: "line",
    x1: center.x - cfg.uDir.x * crossLength,
    y1: center.y - cfg.uDir.y * crossLength,
    x2: center.x + cfg.uDir.x * crossLength,
    y2: center.y + cfg.uDir.y * crossLength,
    isConstruction: true,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoExtrudedBackFace: true,
      depth: baseDepthOrder + 4,
    },
  });
  entities.push({
    id: uid(),
    layer: refLayer,
    type: "line",
    x1: center.x - cfg.vDir.x * crossLength,
    y1: center.y - cfg.vDir.y * crossLength,
    x2: center.x + cfg.vDir.x * crossLength,
    y2: center.y + cfg.vDir.y * crossLength,
    isConstruction: true,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoExtrudedBackFace: true,
      depth: baseDepthOrder + 4,
    },
  });

  return entities;
}

/**
 * Calcula analiticamente os pontos do arco da elipse inferior (botCenter) que estão
 * estritamente DENTRO da área interna da elipse superior (topCenter), ocultando a parte sob a chapa.
 */
export function computeVisibleBottomHoleArc(
  topCenter: Vec2,
  botCenter: Vec2,
  rx: number,
  ry: number,
  rotRad: number,
  steps: number = 72,
): Vec2[] {
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  const pointOnBot = (t: number): Vec2 => {
    const lx = rx * Math.cos(t);
    const ly = ry * Math.sin(t);
    return {
      x: botCenter.x + lx * cosR - ly * sinR,
      y: botCenter.y + lx * sinR + ly * cosR,
    };
  };

  const isInsideTop = (p: Vec2): boolean => {
    const dx = p.x - topCenter.x;
    const dy = p.y - topCenter.y;
    const ux = dx * cosR + dy * sinR;
    const uy = -dx * sinR + dy * cosR;
    return (ux * ux) / (rx * rx) + (uy * uy) / (ry * ry) <= 1.002;
  };

  // Amostra um ciclo completo e encontra o intervalo contínuo dentro da elipse superior
  const flags: boolean[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    flags.push(isInsideTop(pointOnBot(t)));
  }

  if (flags.every((f) => !f)) return [];
  if (flags.every((f) => f)) {
    const allPts: Vec2[] = [];
    for (let i = 0; i <= steps; i++) {
      allPts.push(pointOnBot((i / steps) * Math.PI * 2));
    }
    return allPts;
  }

  // Encontra o início do arco visível (transição false -> true)
  let startIdx = 0;
  for (let i = 0; i < steps; i++) {
    const prev = flags[(i - 1 + steps) % steps];
    const curr = flags[i];
    if (!prev && curr) {
      startIdx = i;
      break;
    }
  }

  let endIdx = startIdx;
  while (flags[(endIdx + 1) % steps] && (endIdx - startIdx) < steps) {
    endIdx++;
  }

  // Refinamento por busca binária nas duas bordas de interseção
  const refineBoundary = (tOut: number, tIn: number): number => {
    let a = tOut;
    let b = tIn;
    for (let iter = 0; iter < 12; iter++) {
      const mid = 0.5 * (a + b);
      if (isInsideTop(pointOnBot(mid))) b = mid;
      else a = mid;
    }
    return b;
  };

  const dt = (Math.PI * 2) / steps;
  const tStart = refineBoundary((startIdx - 1) * dt, startIdx * dt);
  const tEnd = refineBoundary((endIdx + 1) * dt, endIdx * dt);

  const arcPts: Vec2[] = [];
  const numArcSteps = 28;
  for (let i = 0; i <= numArcSteps; i++) {
    const t = tStart + ((tEnd - tStart) * i) / numArcSteps;
    arcPts.push(pointOnBot(t));
  }
  return arcPts;
}

/**
 * Retorna o vetor normal 2D ao plano isométrico (para profundidade / extrusão isométrica 2D).
 */
export function getPlaneNormalDir(plane: IsoPlane): Vec2 {
  switch (plane) {
    case "top":
      return ISO_AXIS_VECTORS.axis270;
    case "left":
      return ISO_AXIS_VECTORS.axis30;
    case "right":
      return ISO_AXIS_VECTORS.axis150;
  }
}

/**
 * Projeta um ponto canônico (x, y) relativo a uma âncora local (pivot)
 * para coordenadas no plano isométrico especificado (Top, Right, Left).
 */
export function projectPointToIsoPlane(p: Vec2, plane: IsoPlane, pivot: Vec2): Vec2 {
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;

  switch (plane) {
    case "top":
      return {
        x: pivot.x + (dx - dy) * COS_30,
        y: pivot.y + (dx + dy) * SIN_30,
      };
    case "right":
      return {
        x: pivot.x + dx * COS_30,
        y: pivot.y + dx * SIN_30 + dy,
      };
    case "left":
      return {
        x: pivot.x - dx * COS_30,
        y: pivot.y + dx * SIN_30 + dy,
      };
  }
}

/**
 * Inverte um ponto projetado em coordenadas isométricas de volta para as coordenadas
 * canônicas reais (dx, dy) em relação ao pivot.
 */
export function unprojectPointFromIsoPlane(isoP: Vec2, plane: IsoPlane, pivot: Vec2): Vec2 {
  const rx = isoP.x - pivot.x;
  const ry = isoP.y - pivot.y;

  switch (plane) {
    case "top": {
      const dx = 0.5 * (rx / COS_30) + ry;
      const dy = ry - 0.5 * (rx / COS_30);
      return { x: pivot.x + dx, y: pivot.y + dy };
    }
    case "right": {
      const dx = rx / COS_30;
      const dy = ry - dx * SIN_30;
      return { x: pivot.x + dx, y: pivot.y + dy };
    }
    case "left": {
      const dx = -rx / COS_30;
      const dy = ry - dx * SIN_30;
      return { x: pivot.x + dx, y: pivot.y + dy };
    }
  }
}

/**
 * Vetor de profundidade / extrusão para o plano isométrico ativo (espessura 2.5D).
 */
export function getIsoExtrusionVector(plane: IsoPlane, depth: number): Vec2 {
  switch (plane) {
    case "top":
      return { x: 0, y: depth };
    case "right":
      return { x: -COS_30 * depth, y: SIN_30 * depth };
    case "left":
      return { x: COS_30 * depth, y: SIN_30 * depth };
  }
}

/**
 * Projeta um ponto 3D local (u, v, w) onde (u, v) = (x - pivot.x, y - pivot.y)
 * e w é a cota perpendicular à face base (+w = para cima/frente, -w = espessura da chapa).
 */
export function project3DToIso(
  u: number,
  v: number,
  w: number,
  plane: IsoPlane,
  pivot: Vec2,
): { pt: Vec2; depth: number } {
  const base = projectPointToIsoPlane({ x: pivot.x + u, y: pivot.y + v }, plane, pivot);
  const extUnit = getIsoExtrusionVector(plane, 1); // direção de -w
  const pt: Vec2 = {
    x: base.x - w * extUnit.x,
    y: base.y - w * extUnit.y,
  };

  // Profundidade canônica no eixo da câmera isométrica (X_30 + Y_150 + Z_90)
  let depth = 0;
  switch (plane) {
    case "top":
      depth = u + v + w;
      break;
    case "right":
      depth = u - w - v;
      break;
    case "left":
      depth = -w + u - v;
      break;
  }
  return { pt, depth };
}

/**
 * Determina a cor de sombreado técnico direcional a partir do vetor normal 3D local (nu, nv, nw).
 */
export function shadeFromLocalNormal(
  nu: number,
  nv: number,
  nw: number,
  plane: IsoPlane,
): { fillColor: string; cameraDot: number } {
  // Converte normal local (nu, nv, nw) para normal canônica (nx_30, ny_150, nz_90)
  let nx = 0;
  let ny = 0;
  let nz = 0;
  switch (plane) {
    case "top":
      nx = nu;
      ny = nv;
      nz = nw;
      break;
    case "right":
      nx = nu;
      ny = -nw;
      nz = -nv;
      break;
    case "left":
      nx = -nw;
      ny = nu;
      nz = -nv;
      break;
  }

  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;

  const cameraDot = nx + ny + nz;

  if (nz > 0.65) {
    return { fillColor: ISO_TECH_SHADING.topFace, cameraDot };
  }
  if (nz > 0.2) {
    return { fillColor: ISO_TECH_SHADING.bendFace, cameraDot };
  }
  if (Math.abs(nx - ny) < 0.25 && nx > 0 && ny > 0) {
    return { fillColor: ISO_TECH_SHADING.chamferFace, cameraDot };
  }
  if (ny >= nx) {
    return { fillColor: ISO_TECH_SHADING.leftFace, cameraDot };
  }
  return { fillColor: ISO_TECH_SHADING.rightFace, cameraDot };
}

/**
 * Projeta uma entidade geométrica qualquer para o plano isométrico (modo plano 2D),
 * preservando sua topologia, metadados paramétricos e dimensões reais.
 */
export function projectEntityToIso(
  entity: Entity,
  plane: IsoPlane,
  pivot: Vec2,
  overrideId?: string,
): Entity {
  const id = overrideId ?? entity.id;
  const cfg = ISO_PLANES[plane];

  switch (entity.type) {
    case "line": {
      const p1 = projectPointToIsoPlane({ x: entity.x1, y: entity.y1 }, plane, pivot);
      const p2 = projectPointToIsoPlane({ x: entity.x2, y: entity.y2 }, plane, pivot);
      const realLen = Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
      return {
        ...entity,
        id,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
          sourceKind: "line",
          realLength: realLen,
        },
      };
    }

    case "polyline": {
      const pts = entity.pts.map((pt) => projectPointToIsoPlane(pt, plane, pivot));
      return {
        ...entity,
        id,
        pts,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
          sourceKind: "polygon",
        },
      };
    }

    case "circle": {
      const c = projectPointToIsoPlane({ x: entity.cx, y: entity.cy }, plane, pivot);
      const r = entity.r;
      const rx = r * ISO_SQRT_1_5;
      const ry = r * ISO_SQRT_0_5;
      const rotation = (cfg.ellipseRotationDeg * Math.PI) / 180;
      return {
        id,
        layer: entity.layer,
        type: "ellipse",
        cx: c.x,
        cy: c.y,
        rx,
        ry,
        rotation,
        isConstruction: entity.isConstruction,
        cnc: entity.cnc,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
          sourceKind: entity.cnc?.hole || entity.layer === "recorte" ? "hole" : "circle",
          realRadius: r,
          realDiameter: r * 2,
          isHole: !!(entity.cnc?.hole || entity.layer === "recorte"),
        },
      };
    }

    case "arc": {
      const c = projectPointToIsoPlane({ x: entity.cx, y: entity.cy }, plane, pivot);
      const r = entity.r;
      const rx = r * ISO_SQRT_1_5;
      const ry = r * ISO_SQRT_0_5;
      const rotation = (cfg.ellipseRotationDeg * Math.PI) / 180;
      const numPts = 20;
      let sweep = entity.a1 - entity.a0;
      if (sweep <= 0) sweep += Math.PI * 2;
      const arcPts: Vec2[] = [];
      for (let i = 0; i <= numPts; i++) {
        const theta = entity.a0 + (sweep * i) / numPts;
        const canonicalPt = {
          x: entity.cx + r * Math.cos(theta),
          y: entity.cy + r * Math.sin(theta),
        };
        arcPts.push(projectPointToIsoPlane(canonicalPt, plane, pivot));
      }
      return {
        id,
        layer: entity.layer,
        type: "polyline",
        closed: false,
        pts: arcPts,
        isConstruction: entity.isConstruction,
        cnc: entity.cnc,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
          sourceKind: "arc",
          realRadius: r,
          realDiameter: r * 2,
          center: c,
          rx,
          ry,
          rotation,
          arcA0: entity.a0,
          arcA1: entity.a1,
        },
      };
    }

    case "ellipse": {
      const c = projectPointToIsoPlane({ x: entity.cx, y: entity.cy }, plane, pivot);
      return {
        ...entity,
        id,
        cx: c.x,
        cy: c.y,
        rx: entity.rx * ISO_SQRT_1_5,
        ry: entity.ry * ISO_SQRT_0_5,
        rotation: (entity.rotation ?? 0) + (cfg.ellipseRotationDeg * Math.PI) / 180,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
        },
      };
    }

    case "point": {
      const p = projectPointToIsoPlane({ x: entity.x, y: entity.y }, plane, pivot);
      return {
        ...entity,
        id,
        x: p.x,
        y: p.y,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
        },
      };
    }

    case "path": {
      const start = projectPointToIsoPlane(entity.start, plane, pivot);
      const segs = entity.segs.map((s) => ({
        ...s,
        c1: projectPointToIsoPlane(s.c1, plane, pivot),
        c2: projectPointToIsoPlane(s.c2, plane, pivot),
        p: projectPointToIsoPlane(s.p, plane, pivot),
      }));
      return {
        ...entity,
        id,
        start,
        segs,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
        },
      };
    }

    case "hatch": {
      const boundaryPts = entity.boundaryPts.map((pt) => projectPointToIsoPlane(pt, plane, pivot));
      return {
        ...entity,
        id,
        boundaryPts,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
        },
      };
    }

    case "text": {
      const p = projectPointToIsoPlane({ x: entity.x, y: entity.y }, plane, pivot);
      return {
        ...entity,
        id,
        x: p.x,
        y: p.y,
        params: {
          ...entity.params,
          isIso: true,
          isoPlane: plane,
        },
      };
    }
  }
}

/**
 * Inverte analiticamente uma entidade projetada no plano isométrico de volta para
 * o seu formato canônico 2D ortogonal original.
 */
export function unprojectEntityFromIso(
  entity: Entity,
  plane: IsoPlane,
  pivot: Vec2,
  overrideId?: string,
): Entity {
  const id = overrideId ?? entity.id;

  // Se a entidade guardou seu snapshot 2D canônico exato antes da conformação/extrusão 3D, restaura-o
  if (entity.params?.canonical2D && typeof entity.params.canonical2D === "object") {
    const snap = entity.params.canonical2D as Entity;
    return {
      ...snap,
      id,
    };
  }

  const cleanParams = { ...entity.params };
  delete cleanParams.isIso;
  delete cleanParams.isoPlane;
  delete cleanParams.isIsoExtrudedBackFace;
  delete cleanParams.isoThickness;
  delete cleanParams.isIsoSolidFace;
  delete cleanParams.fillColor;
  delete cleanParams.strokeColor;
  delete cleanParams.strokeWidth;
  delete cleanParams.noStroke;
  delete cleanParams.depth;

  switch (entity.type) {
    case "line": {
      const p1 = unprojectPointFromIsoPlane({ x: entity.x1, y: entity.y1 }, plane, pivot);
      const p2 = unprojectPointFromIsoPlane({ x: entity.x2, y: entity.y2 }, plane, pivot);
      return {
        ...entity,
        id,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        params: cleanParams,
      };
    }

    case "polyline": {
      const pts = entity.pts.map((pt) => unprojectPointFromIsoPlane(pt, plane, pivot));
      return {
        ...entity,
        id,
        pts,
        params: cleanParams,
      };
    }

    case "ellipse": {
      const c = unprojectPointFromIsoPlane({ x: entity.cx, y: entity.cy }, plane, pivot);
      const r =
        typeof entity.params?.realRadius === "number"
          ? entity.params.realRadius
          : entity.rx / ISO_SQRT_1_5;
      return {
        id,
        layer: entity.layer,
        type: "circle",
        cx: c.x,
        cy: c.y,
        r,
        isConstruction: entity.isConstruction,
        cnc: entity.cnc,
        params: cleanParams,
      };
    }

    case "circle": {
      const c = unprojectPointFromIsoPlane({ x: entity.cx, y: entity.cy }, plane, pivot);
      return {
        ...entity,
        id,
        cx: c.x,
        cy: c.y,
        params: cleanParams,
      };
    }

    case "arc": {
      const c = unprojectPointFromIsoPlane({ x: entity.cx, y: entity.cy }, plane, pivot);
      return {
        ...entity,
        id,
        cx: c.x,
        cy: c.y,
        params: cleanParams,
      };
    }

    case "point": {
      const p = unprojectPointFromIsoPlane({ x: entity.x, y: entity.y }, plane, pivot);
      return {
        ...entity,
        id,
        x: p.x,
        y: p.y,
        params: cleanParams,
      };
    }

    default:
      return entity;
  }
}

// ============================================================================
// MOTOR SÓLIDO DE OCLUSÃO E INTERPRETAÇÃO TOPOLÓGICA 2.5D / 3D (SEÇÕES 1 E 2)
// ============================================================================

interface EdgeSegment2D {
  p1: Vec2;
  p2: Vec2;
  isArc?: boolean;
  arcCenter?: Vec2;
  arcRadius?: number;
  arcA0?: number;
  arcA1?: number;
  sourceId?: string;
}

interface ClosedLoop2D {
  id: string;
  pts: Vec2[];
  edges: EdgeSegment2D[];
  area: number;
  absArea: number;
  centroid: Vec2;
  isCircle?: boolean;
  circleCenter?: Vec2;
  circleRadius?: number;
  sourceEntityIds: string[];
  layer: LayerId;
}

function signedPolygonArea(pts: Vec2[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

function polygonCentroid(pts: Vec2[]): Vec2 {
  if (!pts.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

function isPointInPolygon2D(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Garante que os vértices de um polígono 2D estejam em sentido anti-horário (CCW, área > 0),
 * para que a normal externa de cada aresta (p1 -> p2) seja (+dy, -dx).
 */
function ensureCounterClockwise(pts: Vec2[]): Vec2[] {
  if (pts.length < 3) return pts;
  const area = signedPolygonArea(pts);
  return area < 0 ? pts.slice().reverse() : pts;
}

/**
 * Recorta um polígono 2D contra um semiplano definido por ( pointOnLine, normal )
 * mantendo os pontos onde (P - pointOnLine) · normal >= 0 (Sutherland-Hodgman).
 */
function clipPolygonByHalfPlane(poly: Vec2[], linePt: Vec2, normal: Vec2): Vec2[] {
  if (poly.length < 3) return [];
  const out: Vec2[] = [];
  const evalSide = (p: Vec2) => (p.x - linePt.x) * normal.x + (p.y - linePt.y) * normal.y;

  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const prev = poly[(i - 1 + poly.length) % poly.length]!;
    const dCur = evalSide(cur);
    const dPrev = evalSide(prev);

    if (dCur >= -1e-5) {
      if (dPrev < -1e-5) {
        const t = dPrev / (dPrev - dCur);
        out.push({
          x: prev.x + t * (cur.x - prev.x),
          y: prev.y + t * (cur.y - prev.y),
        });
      }
      out.push(cur);
    } else if (dPrev >= -1e-5) {
      const t = dPrev / (dPrev - dCur);
      out.push({
        x: prev.x + t * (cur.x - prev.x),
        y: prev.y + t * (cur.y - prev.y),
      });
    }
  }
  return out;
}

/**
 * Extrai contornos fechados (Outer Loops, Furos, Recortes) e segmentos abertos a partir
 * das entidades 2D selecionadas pelo usuário.
 */
function extractTopologyFrom2D(entities: Entity[]): {
  closedLoops: ClosedLoop2D[];
  openSegments: EdgeSegment2D[];
  bendLines: { id: string; p1: Vec2; p2: Vec2; angleDeg: number; radius: number; entity: Entity }[];
  centerEntities: Entity[];
} {
  const closedLoops: ClosedLoop2D[] = [];
  const openSegments: EdgeSegment2D[] = [];
  const bendLines: { id: string; p1: Vec2; p2: Vec2; angleDeg: number; radius: number; entity: Entity }[] = [];
  const centerEntities: Entity[] = [];

  const chainCandidates: { seg: EdgeSegment2D; pts: Vec2[]; used: boolean; layer: LayerId }[] = [];

  for (const e of entities) {
    // 1. Linhas de centro e construção (Seção 1.3)
    if (
      e.isConstruction ||
      e.layer === "eixo" ||
      e.layer === "referencia" ||
      e.layer === "cota"
    ) {
      centerEntities.push(e);
      continue;
    }

    // 2. Linhas de Dobra (Seção 2.3)
    if (e.layer === "dobra" || e.cnc?.bend || e.params?.isBendLine) {
      if (e.type === "line") {
        bendLines.push({
          id: e.id,
          p1: { x: e.x1, y: e.y1 },
          p2: { x: e.x2, y: e.y2 },
          angleDeg: typeof e.params?.bendAngle === "number" ? (e.params.bendAngle as number) : 90,
          radius: typeof e.params?.bendRadius === "number" ? (e.params.bendRadius as number) : 2,
          entity: e,
        });
        continue;
      } else if (e.type === "polyline" && e.pts.length >= 2) {
        bendLines.push({
          id: e.id,
          p1: e.pts[0]!,
          p2: e.pts[e.pts.length - 1]!,
          angleDeg: typeof e.params?.bendAngle === "number" ? (e.params.bendAngle as number) : 90,
          radius: typeof e.params?.bendRadius === "number" ? (e.params.bendRadius as number) : 2,
          entity: e,
        });
        continue;
      }
    }

    // 3. Círculos (Furos, Buchas, Cilindros ou Contornos Circulares)
    if (e.type === "circle") {
      const numPts = 40;
      const pts: Vec2[] = [];
      const edges: EdgeSegment2D[] = [];
      for (let i = 0; i < numPts; i++) {
        const a0 = (i / numPts) * Math.PI * 2;
        const a1 = ((i + 1) / numPts) * Math.PI * 2;
        const p1 = { x: e.cx + e.r * Math.cos(a0), y: e.cy + e.r * Math.sin(a0) };
        const p2 = { x: e.cx + e.r * Math.cos(a1), y: e.cy + e.r * Math.sin(a1) };
        pts.push(p1);
        edges.push({
          p1,
          p2,
          isArc: true,
          arcCenter: { x: e.cx, y: e.cy },
          arcRadius: e.r,
          arcA0: a0,
          arcA1: a1,
          sourceId: e.id,
        });
      }
      const area = Math.PI * e.r * e.r;
      closedLoops.push({
        id: e.id,
        pts,
        edges,
        area,
        absArea: area,
        centroid: { x: e.cx, y: e.cy },
        isCircle: true,
        circleCenter: { x: e.cx, y: e.cy },
        circleRadius: e.r,
        sourceEntityIds: [e.id],
        layer: e.layer,
      });
      continue;
    }

    // 4. Polilinhas já fechadas
    if (e.type === "polyline" && e.pts.length >= 3) {
      const first = e.pts[0]!;
      const last = e.pts[e.pts.length - 1]!;
      const isClosed = e.closed || dist(first, last) < 1.5;
      if (isClosed) {
        const cleanPts = dist(first, last) < 1e-3 ? e.pts.slice(0, -1) : e.pts.slice();
        const ccwPts = ensureCounterClockwise(cleanPts);
        const edges: EdgeSegment2D[] = [];
        for (let i = 0; i < ccwPts.length; i++) {
          edges.push({
            p1: ccwPts[i]!,
            p2: ccwPts[(i + 1) % ccwPts.length]!,
            sourceId: e.id,
          });
        }
        const area = signedPolygonArea(ccwPts);
        closedLoops.push({
          id: e.id,
          pts: ccwPts,
          edges,
          area,
          absArea: Math.abs(area),
          centroid: polygonCentroid(ccwPts),
          sourceEntityIds: [e.id],
          layer: e.layer,
        });
        continue;
      } else {
        for (let i = 0; i < e.pts.length - 1; i++) {
          chainCandidates.push({
            seg: { p1: e.pts[i]!, p2: e.pts[i + 1]!, sourceId: e.id },
            pts: [e.pts[i]!, e.pts[i + 1]!],
            used: false,
            layer: e.layer,
          });
        }
        continue;
      }
    }

    // 5. Linhas e Arcos abertos candidatos a formar loops fechados (ex: retângulos com chanfros/filetes)
    if (e.type === "line") {
      const p1 = { x: e.x1, y: e.y1 };
      const p2 = { x: e.x2, y: e.y2 };
      if (dist(p1, p2) > 1e-3) {
        chainCandidates.push({
          seg: { p1, p2, sourceId: e.id },
          pts: [p1, p2],
          used: false,
          layer: e.layer,
        });
      }
    } else if (e.type === "arc") {
      let sweep = e.a1 - e.a0;
      while (sweep <= 0) sweep += Math.PI * 2;
      const steps = Math.max(8, Math.round((sweep / (Math.PI / 2)) * 8));
      const arcPts: Vec2[] = [];
      for (let i = 0; i <= steps; i++) {
        const ang = e.a0 + (sweep * i) / steps;
        arcPts.push({
          x: e.cx + e.r * Math.cos(ang),
          y: e.cy + e.r * Math.sin(ang),
        });
      }
      chainCandidates.push({
        seg: {
          p1: arcPts[0]!,
          p2: arcPts[arcPts.length - 1]!,
          isArc: true,
          arcCenter: { x: e.cx, y: e.cy },
          arcRadius: e.r,
          arcA0: e.a0,
          arcA1: e.a0 + sweep,
          sourceId: e.id,
        },
        pts: arcPts,
        used: false,
        layer: e.layer,
      });
    }
  }

  // Encadeamento topológico de segmentos conectados (tolerância 2.0mm)
  const SNAP_TOL = 2.0;
  for (let i = 0; i < chainCandidates.length; i++) {
    const startCand = chainCandidates[i]!;
    if (startCand.used) continue;
    startCand.used = true;

    const chainPts: Vec2[] = [...startCand.pts];
    const chainEdges: EdgeSegment2D[] = [startCand.seg];
    const sourceIds = new Set<string>(startCand.seg.sourceId ? [startCand.seg.sourceId] : []);

    let grew = true;
    while (grew) {
      grew = false;
      const tail = chainPts[chainPts.length - 1]!;
      const head = chainPts[0]!;

      if (chainEdges.length >= 2 && dist(tail, head) <= SNAP_TOL) {
        break;
      }

      // Busca próximo segmento mais próximo do tail
      let bestIdx = -1;
      let bestRev = false;
      let bestDist = SNAP_TOL;

      for (let j = 0; j < chainCandidates.length; j++) {
        const cand = chainCandidates[j]!;
        if (cand.used) continue;
        const dStart = dist(tail, cand.pts[0]!);
        const dEnd = dist(tail, cand.pts[cand.pts.length - 1]!);
        if (dStart < bestDist) {
          bestDist = dStart;
          bestIdx = j;
          bestRev = false;
        }
        if (dEnd < bestDist) {
          bestDist = dEnd;
          bestIdx = j;
          bestRev = true;
        }
      }

      if (bestIdx >= 0) {
        const nextCand = chainCandidates[bestIdx]!;
        nextCand.used = true;
        if (nextCand.seg.sourceId) sourceIds.add(nextCand.seg.sourceId);

        const nextPts = bestRev ? nextCand.pts.slice().reverse() : nextCand.pts;
        for (let k = 1; k < nextPts.length; k++) {
          chainPts.push(nextPts[k]!);
        }
        chainEdges.push({
          ...nextCand.seg,
          p1: nextPts[0]!,
          p2: nextPts[nextPts.length - 1]!,
        });
        grew = true;
      }
    }

    const head = chainPts[0]!;
    const tail = chainPts[chainPts.length - 1]!;
    if (chainPts.length >= 3 && dist(head, tail) <= SNAP_TOL * 1.5) {
      const cleanPts = dist(head, tail) < 1e-2 ? chainPts.slice(0, -1) : chainPts;
      const rawArea = signedPolygonArea(cleanPts);
      if (Math.abs(rawArea) > 1.0) {
        const isReversed = rawArea < 0;
        const ccwPts = isReversed ? cleanPts.slice().reverse() : cleanPts;
        const orderedEdges = isReversed
          ? chainEdges
              .slice()
              .reverse()
              .map((ed) => ({ ...ed, p1: ed.p2, p2: ed.p1 }))
          : chainEdges;

        closedLoops.push({
          id: Array.from(sourceIds)[0] ?? uid(),
          pts: ccwPts,
          edges: orderedEdges,
          area: Math.abs(rawArea),
          absArea: Math.abs(rawArea),
          centroid: polygonCentroid(ccwPts),
          sourceEntityIds: Array.from(sourceIds),
          layer: startCand.layer,
        });
        continue;
      }
    }

    // Não fechou loop: preserva como segmentos abertos (ex: nervuras, linhas avulsas)
    openSegments.push(...chainEdges);
  }

  return { closedLoops, openSegments, bendLines, centerEntities };
}

/**
 * Renderiza um cilindro / tubo / ressalto extrudado sólido em perspectiva isométrica (Seção 2.4):
 * - Duas linhas de silhueta tangentes externas paralelas ao eixo do cilindro
 * - Apenas o semiarco frontal visível na base (0° a 180° na projeção)
 * - Face superior elíptica preenchida com #323B47
 * - Se houver furo interno (innerRadius > 0), renderiza o furo com parede interna #1B222A e arco inferior visível
 */
export function buildSolidIsoCylinder(params: {
  plane: IsoPlane;
  baseCenter: Vec2;
  topCenter: Vec2;
  outerRadius: number;
  innerRadius?: number;
  layer: LayerId;
  baseDepth: number;
  primaryId?: string;
}): Entity[] {
  const {
    plane,
    baseCenter,
    topCenter,
    outerRadius,
    innerRadius = 0,
    layer,
    baseDepth,
    primaryId,
  } = params;

  const rOut = Math.max(0.2, outerRadius);
  const cfg = ISO_PLANES[plane];
  const rx = rOut * ISO_SQRT_1_5;
  const ry = rOut * ISO_SQRT_0_5;
  const rotRad = (cfg.ellipseRotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  const uRot: Vec2 = { x: cosR, y: sinR };
  const vRot: Vec2 = { x: -sinR, y: cosR };

  const axisVec: Vec2 = {
    x: topCenter.x - baseCenter.x,
    y: topCenter.y - baseCenter.y,
  };
  const axisLen = Math.hypot(axisVec.x, axisVec.y);
  if (axisLen < 1e-4) {
    return [buildIsoCircle(plane, topCenter, rOut, layer, false)];
  }

  // Vetor normal 2D ao eixo do cilindro na tela
  const nAxis: Vec2 = { x: -axisVec.y / axisLen, y: axisVec.x / axisLen };

  // Ângulos paramétricos exatos onde a tangente à elipse é paralela ao eixo do cilindro
  const dotU = uRot.x * nAxis.x + uRot.y * nAxis.y;
  const dotV = vRot.x * nAxis.x + vRot.y * nAxis.y;
  const tTan1 = Math.atan2(ry * dotV, rx * dotU);
  const tTan2 = tTan1 + Math.PI;

  const evalEllipse = (center: Vec2, t: number): Vec2 => ({
    x: center.x + rx * Math.cos(t) * cosR - ry * Math.sin(t) * sinR,
    y: center.y + rx * Math.cos(t) * sinR + ry * Math.sin(t) * cosR,
  });

  // Escolhe qual semiarco [tTan1 -> tTan2] ou [tTan2 -> tTan1 + 2π] é o semiarco FRONTAL (voltado para fora de topCenter)
  const mid1 = evalEllipse(baseCenter, tTan1 + Math.PI * 0.5);
  const mid2 = evalEllipse(baseCenter, tTan1 - Math.PI * 0.5);
  const dist1 = Math.hypot(mid1.x - topCenter.x, mid1.y - topCenter.y);
  const dist2 = Math.hypot(mid2.x - topCenter.x, mid2.y - topCenter.y);

  const arcStart = dist1 >= dist2 ? tTan1 : tTan2;
  const arcEnd = arcStart + Math.PI;

  const numArcPts = 28;
  const frontBaseArcPts: Vec2[] = [];
  const backTopArcPts: Vec2[] = [];
  for (let i = 0; i <= numArcPts; i++) {
    const t = arcStart + (Math.PI * i) / numArcPts;
    frontBaseArcPts.push(evalEllipse(baseCenter, t));
  }
  for (let i = numArcPts; i >= 0; i--) {
    const t = arcStart + (Math.PI * i) / numArcPts;
    backTopArcPts.push(evalEllipse(topCenter, t));
  }

  const out: Entity[] = [];

  // 1. Corpo cilíndrico sólido sombreado (#262E38)
  out.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [...frontBaseArcPts, ...backTopArcPts],
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: ISO_TECH_SHADING.leftFace,
      strokeColor: "none",
      noStroke: true,
      depth: baseDepth,
    },
  });

  // 2. Semiarco frontal visível da base (ocultando o semiarco traseiro)
  out.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: false,
    pts: frontBaseArcPts,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: "none",
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.0,
      depth: baseDepth + 1,
    },
  });

  // 3. As duas linhas de silhueta (tangentes externas paralelas ao eixo do cilindro)
  const baseT1 = frontBaseArcPts[0]!;
  const baseT2 = frontBaseArcPts[frontBaseArcPts.length - 1]!;
  const topT1 = evalEllipse(topCenter, arcStart);
  const topT2 = evalEllipse(topCenter, arcEnd);

  out.push({
    id: uid(),
    layer,
    type: "line",
    x1: baseT1.x,
    y1: baseT1.y,
    x2: topT1.x,
    y2: topT1.y,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: "none",
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.0,
      depth: baseDepth + 1.5,
    },
  });

  out.push({
    id: uid(),
    layer,
    type: "line",
    x1: baseT2.x,
    y1: baseT2.y,
    x2: topT2.x,
    y2: topT2.y,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: "none",
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.0,
      depth: baseDepth + 1.5,
    },
  });

  // 4. Face elíptica superior preenchida (#323B47) com aresta branca nítida
  out.push({
    id: primaryId ?? uid(),
    layer,
    type: "ellipse",
    cx: topCenter.x,
    cy: topCenter.y,
    rx,
    ry,
    rotation: rotRad,
    params: {
      isIso: true,
      isoPlane: plane,
      sourceKind: "circle",
      realRadius: rOut,
      realDiameter: rOut * 2,
      isIsoSolidFace: true,
      fillColor: ISO_TECH_SHADING.topFace,
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.2,
      depth: baseDepth + 2,
    },
  });

  // 5. Furo interno do cilindro/bucha (ex: Ø20 dentro de Ø30) com parede interna cilíndrica sombreada
  if (innerRadius > 0.1 && innerRadius < rOut) {
    const holeEntities = buildIsoHoleWithDepth(
      plane,
      topCenter,
      innerRadius * 2,
      axisLen,
      "recorte",
      "referencia",
      baseDepth + 3,
    );
    out.push(...holeEntities);
  }

  return out;
}

/**
 * Gera paredes laterais sólidas oclusivas e face principal preenchida para uma região poligonal 3D
 * (chapa base ou aba dobrada), tratando chanfros, filetes (arcos suaves) e recortes internos.
 */
function buildSolidSheetRegion3D(params: {
  topPts2D: Vec2[];
  botPts2D: Vec2[];
  edgesMeta?: EdgeSegment2D[];
  faceFillColor: string;
  wallLeftColor?: string;
  wallRightColor?: string;
  baseDepth: number;
  plane: IsoPlane;
  layer: LayerId;
  primaryId?: string;
  canonicalEntity?: Entity;
}): Entity[] {
  const {
    topPts2D,
    botPts2D,
    edgesMeta,
    faceFillColor,
    baseDepth,
    plane,
    layer,
    primaryId,
    canonicalEntity,
  } = params;

  if (topPts2D.length < 3 || botPts2D.length !== topPts2D.length) return [];

  const result: Entity[] = [];
  const n = topPts2D.length;

  // Vetor médio de extrusão na tela (Top -> Bot)
  const extVec: Vec2 = {
    x: botPts2D[0]!.x - topPts2D[0]!.x,
    y: botPts2D[0]!.y - topPts2D[0]!.y,
  };
  const extLen = Math.hypot(extVec.x, extVec.y);

  // Orientação em tela do polígono superior para determinar normais externas 2D
  const screenArea = signedPolygonArea(topPts2D);
  const windingSign = screenArea >= 0 ? 1 : -1;

  if (extLen > 0.15) {
    // 1. Paredes laterais da espessura da chapa (apenas paredes frontais visíveis à câmera!)
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const tA = topPts2D[i]!;
      const tB = topPts2D[next]!;
      const bB = botPts2D[next]!;
      const bA = botPts2D[i]!;

      const edgeDx = tB.x - tA.x;
      const edgeDy = tB.y - tA.y;
      const edgeLen = Math.hypot(edgeDx, edgeDy);
      if (edgeLen < 1e-3) continue;

      // Normal externa 2D na tela apontando para fora do polígono superior
      const outNx = (edgeDy / edgeLen) * windingSign;
      const outNy = (-edgeDx / edgeLen) * windingSign;

      // A parede lateral é frontal/visível se o deslocamento de extrusão avança na direção da normal externa
      const visibilityDot = (outNx * extVec.x + outNy * extVec.y) / extLen;
      if (visibilityDot <= -0.02) continue;

      // Determina o tom de sombra técnico da parede lateral pela direção da normal em tela:
      // Normal apontando para a direita (+X) -> #1B222A (sombra mais escura)
      // Normal apontando para a esquerda (-X) -> #262E38 (tom intermediário)
      // Chanfro inclinado -> #2C3540
      let wallColor: string = ISO_TECH_SHADING.leftFace;
      if (outNx > 0.25) {
        wallColor = ISO_TECH_SHADING.rightFace;
      } else if (Math.abs(outNx) <= 0.25) {
        wallColor = ISO_TECH_SHADING.chamferFace;
      }

      // Profundidade da parede lateral (sempre desenhada antes da face principal superior, mas ordenada entre si)
      const midScreenY = 0.25 * (tA.y + tB.y + bA.y + bB.y);
      const wallDepth = baseDepth - 15 + midScreenY * 0.01;

      const isArcSegment = edgesMeta && edgesMeta[i]?.isArc;

      result.push({
        id: uid(),
        layer,
        type: "polyline",
        closed: true,
        pts: [tA, tB, bB, bA],
        params: {
          isIso: true,
          isoPlane: plane,
          isIsoSolidFace: true,
          isIsoExtrudedBackFace: true,
          fillColor: wallColor,
          // Em segmentos curvos de filete (Seção 2.5), não desenha linhas verticais internas de tesselação!
          strokeColor: isArcSegment ? "none" : ISO_TECH_SHADING.edgeStroke,
          noStroke: !!isArcSegment,
          strokeWidth: 1.9,
          depth: wallDepth,
        },
      });

      if (isArcSegment) {
        // Para filetes/arcos suaves, desenha a borda inferior visível contínua
        result.push({
          id: uid(),
          layer,
          type: "line",
          x1: bA.x,
          y1: bA.y,
          x2: bB.x,
          y2: bB.y,
          params: {
            isIso: true,
            isoPlane: plane,
            isIsoSolidFace: true,
            isIsoExtrudedBackFace: true,
            fillColor: "none",
            strokeColor: ISO_TECH_SHADING.edgeStroke,
            strokeWidth: 1.9,
            depth: wallDepth + 0.1,
          },
        });
      }
    }
  }

  // 2. Face principal opaca preenchida com arestas brancas nítidas (#FFFFFF)
  result.push({
    id: primaryId ?? uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: topPts2D,
    params: {
      isIso: true,
      isoPlane: plane,
      sourceKind: "polygon",
      isIsoSolidFace: true,
      fillColor: faceFillColor,
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.1,
      depth: baseDepth,
      ...(canonicalEntity ? { canonical2D: canonicalEntity } : {}),
    },
  });

  return result;
}

/**
 * Renderiza uma nervura / mão-francesa triangular sólida em perspectiva isométrica (Seção 2.5).
 */
export function buildSolidIsoRib(params: {
  pStart2D: Vec2; // Ponto junto à parede vertical / cilindro (altura H)
  pEnd2D: Vec2;   // Ponto na ponta da rampa sobre a chapa base (altura 0)
  ribHeight: number;
  ribThickness: number;
  plane: IsoPlane;
  pivot: Vec2;
  layer: LayerId;
  baseDepth: number;
}): Entity[] {
  const { pStart2D, pEnd2D, ribHeight, ribThickness, plane, pivot, layer, baseDepth } = params;
  const dx = pEnd2D.x - pStart2D.x;
  const dy = pEnd2D.y - pStart2D.y;
  const len = Math.hypot(dx, dy);
  if (len < 1.0 || ribHeight <= 0.5) return [];

  const halfT = Math.max(1.5, ribThickness * 0.5);
  const nx = (-dy / len) * halfT;
  const ny = (dx / len) * halfT;

  const uStart = pStart2D.x - pivot.x;
  const vStart = pStart2D.y - pivot.y;
  const uEnd = pEnd2D.x - pivot.x;
  const vEnd = pEnd2D.y - pivot.y;

  // Vértices 3D dos dois lados (+n e -n) do triângulo da nervura
  const topA = project3DToIso(uStart + nx, vStart + ny, ribHeight, plane, pivot);
  const topB = project3DToIso(uStart - nx, vStart - ny, ribHeight, plane, pivot);
  const botStartA = project3DToIso(uStart + nx, vStart + ny, 0, plane, pivot);
  const botStartB = project3DToIso(uStart - nx, vStart - ny, 0, plane, pivot);
  const tipA = project3DToIso(uEnd + nx, vEnd + ny, 0, plane, pivot);
  const tipB = project3DToIso(uEnd - nx, vEnd - ny, 0, plane, pivot);

  const out: Entity[] = [];

  // Escolhe a face lateral triangular mais próxima da câmera isométrica
  const depthSideA = (topA.depth + botStartA.depth + tipA.depth) / 3;
  const depthSideB = (topB.depth + botStartB.depth + tipB.depth) / 3;

  const frontTri = depthSideA >= depthSideB
    ? [botStartA.pt, tipA.pt, topA.pt]
    : [botStartB.pt, tipB.pt, topB.pt];
  const backTri = depthSideA >= depthSideB
    ? [botStartB.pt, tipB.pt, topB.pt]
    : [botStartA.pt, tipA.pt, topA.pt];

  // Parede triangular traseira (oclusa pela rampa e parede frontal)
  out.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: backTri,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: ISO_TECH_SHADING.rightFace,
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 1.8,
      depth: baseDepth + 0.5,
    },
  });

  // Rampa inclinada superior da nervura (4 vértices)
  out.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [topA.pt, topB.pt, tipB.pt, tipA.pt],
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: ISO_TECH_SHADING.topFace,
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.0,
      depth: baseDepth + 1.5,
    },
  });

  // Parede lateral triangular frontal visível da nervura
  out.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: frontTri,
    params: {
      isIso: true,
      isoPlane: plane,
      isIsoSolidFace: true,
      isIsoExtrudedBackFace: true,
      fillColor: ISO_TECH_SHADING.leftFace,
      strokeColor: ISO_TECH_SHADING.edgeStroke,
      strokeWidth: 2.0,
      depth: baseDepth + 2.0,
    },
  });

  return out;
}

/**
 * Gera a extrusão volumétrica 2.5D/3D sólida com oclusão (Painter's Algorithm + HLR).
 * Mantém assinatura compatível, operando com superfícies opacas preenchidas e silhuetas reais.
 */
export function generate25DExtrusion(
  projectedFront: Entity[],
  plane: IsoPlane,
  thickness: number,
  refLayer: LayerId = "referencia",
): Entity[] {
  if (thickness <= 0 || !projectedFront.length) return [];

  const extrudeVec = getIsoExtrusionVector(plane, thickness);
  const result: Entity[] = [];

  for (const ent of projectedFront) {
    // Regra 1.3: Linhas de centro e construção NUNCA recebem espessura 3D ou paredes verticais
    if (ent.isConstruction || ent.layer === "eixo" || ent.layer === "referencia") {
      continue;
    }

    if (ent.type === "ellipse") {
      const isHole = !!(ent.params?.isHole || ent.layer === "recorte");
      if (isHole) {
        // Regra 2.2: Furo passante — desenha APENAS o arco inferior visível dentro da elipse superior
        const botCenter = { x: ent.cx + extrudeVec.x, y: ent.cy + extrudeVec.y };
        const visArc = computeVisibleBottomHoleArc(
          { x: ent.cx, y: ent.cy },
          botCenter,
          ent.rx,
          ent.ry,
          ent.rotation ?? 0,
        );
        if (visArc.length >= 2) {
          result.push({
            id: uid(),
            layer: ent.layer,
            type: "polyline",
            closed: false,
            pts: visArc,
            params: {
              isIso: true,
              isoPlane: plane,
              isIsoSolidFace: true,
              isIsoExtrudedBackFace: true,
              isoThickness: thickness,
              fillColor: "none",
              strokeColor: ISO_TECH_SHADING.edgeStroke,
              strokeWidth: 1.8,
              depth: ((ent.params?.depth as number) ?? 100) - 0.5,
            },
          });
        }
      } else {
        // Regra 2.4: Cilindro externo — gera parede cilíndrica sólida, semiarco frontal e 2 linhas de silhueta
        const r =
          typeof ent.params?.realRadius === "number"
            ? (ent.params.realRadius as number)
            : ent.rx / ISO_SQRT_1_5;
        const botCenter = { x: ent.cx + extrudeVec.x, y: ent.cy + extrudeVec.y };
        const cylEntities = buildSolidIsoCylinder({
          plane,
          baseCenter: botCenter,
          topCenter: { x: ent.cx, y: ent.cy },
          outerRadius: r,
          layer: ent.layer,
          baseDepth: ((ent.params?.depth as number) ?? 100) - 10,
        });
        // Adiciona corpo, arco de base e as 2 linhas de silhueta (sem duplicar a elipse de topo)
        result.push(...cylEntities.filter((ce) => ce.type !== "ellipse"));
      }
    } else if (ent.type === "polyline" && ent.pts.length >= 3 && ent.closed) {
      const botPts = ent.pts.map((p) => ({ x: p.x + extrudeVec.x, y: p.y + extrudeVec.y }));
      const walls = buildSolidSheetRegion3D({
        topPts2D: ent.pts,
        botPts2D: botPts,
        faceFillColor: ISO_TECH_SHADING.topFace,
        baseDepth: (ent.params?.depth as number) ?? 100,
        plane,
        layer: ent.layer,
      });
      // Retorna as paredes laterais frontais visíveis
      result.push(...walls.filter((w) => w.params?.isIsoExtrudedBackFace));
    } else if (ent.type === "line") {
      const p1 = { x: ent.x1, y: ent.y1 };
      const p2 = { x: ent.x2, y: ent.y2 };
      const b1 = { x: ent.x1 + extrudeVec.x, y: ent.y1 + extrudeVec.y };
      const b2 = { x: ent.x2 + extrudeVec.x, y: ent.y2 + extrudeVec.y };
      result.push({
        id: uid(),
        layer: refLayer,
        type: "polyline",
        closed: true,
        pts: [p1, p2, b2, b1],
        params: {
          isIso: true,
          isoPlane: plane,
          isIsoSolidFace: true,
          isIsoExtrudedBackFace: true,
          isoThickness: thickness,
          fillColor: ISO_TECH_SHADING.leftFace,
          strokeColor: ISO_TECH_SHADING.edgeStroke,
          strokeWidth: 1.9,
          depth: 50,
        },
      });
    }
  }

  return result;
}

/**
 * Converte cotas associativas existentes para a perspectiva isométrica oblíqua,
 * preservando rigorosamente as medidas reais de engenharia, unidades e vínculos.
 */
export function projectDimensionsToIso(
  allDims: Dimension[],
  selectedEntities: Entity[],
  plane: IsoPlane,
  pivot: Vec2,
  idMap?: Map<string, string>,
): Dimension[] {
  if (!allDims.length || !selectedEntities.length) return [];

  const selectedIdSet = new Set(selectedEntities.map((e) => e.id));
  const selectionBBox = bbox(selectedEntities);

  const matchingDims = allDims.filter((d) => {
    for (const r of d.refs) {
      if (r.kind === "entity" && selectedIdSet.has(r.id)) return true;
    }
    if (selectionBBox && d.refs.every((r) => r.kind === "point")) {
      const tol = 5;
      const allInside = d.refs.every((r) => {
        if (r.kind !== "point") return false;
        return (
          r.p.x >= selectionBBox.minX - tol &&
          r.p.x <= selectionBBox.maxX + tol &&
          r.p.y >= selectionBBox.minY - tol &&
          r.p.y <= selectionBBox.maxY + tol
        );
      });
      if (allInside) return true;
    }
    return false;
  });

  return matchingDims.map((d) => {
    // Se for cota horizontal ou vertical entre pontos com desalinhamento ortogonal,
    // projeta os pontos alinhados ao eixo canônico correspondente para preservar a medida exata em isometria!
    if (
      (d.kind === "horizontal" || d.kind === "vertical") &&
      d.refs.length === 2
    ) {
      const p0 = resolvePoint(d.refs[0]!, selectedEntities);
      const p1 = resolvePoint(d.refs[1]!, selectedEntities);
      if (p0 && p1) {
        const alignedP0 =
          d.kind === "horizontal"
            ? { x: p0.x, y: d.style.side >= 0 ? Math.max(p0.y, p1.y) : Math.min(p0.y, p1.y) }
            : { x: d.style.side >= 0 ? Math.max(p0.x, p1.x) : Math.min(p0.x, p1.x), y: p0.y };
        const alignedP1 =
          d.kind === "horizontal"
            ? { x: p1.x, y: alignedP0.y }
            : { x: alignedP0.x, y: p1.y };

        return {
          ...d,
          id: idMap ? uid() : d.id,
          kind: "aligned",
          refs: [
            { kind: "point" as const, p: projectPointToIsoPlane(alignedP0, plane, pivot) },
            { kind: "point" as const, p: projectPointToIsoPlane(alignedP1, plane, pivot) },
          ],
        };
      }
    }

    const newRefs = d.refs.map((r) => {
      if (r.kind === "point") {
        return {
          kind: "point" as const,
          p: projectPointToIsoPlane(r.p, plane, pivot),
        };
      }
      const mappedId = idMap?.get(r.id) ?? r.id;
      return {
        ...r,
        id: mappedId,
      };
    });

    let newKind = d.kind;
    if (d.kind === "horizontal" || d.kind === "vertical" || d.kind === "linear") {
      newKind = "aligned";
    }

    return {
      ...d,
      id: idMap ? uid() : d.id,
      kind: newKind,
      refs: newRefs,
    };
  });
}

export interface IsoConversionParams {
  entities: Entity[];
  selectedIds: string[];
  dims: Dimension[];
  plane: IsoPlane;
  mode: "replace" | "copy";
  thickness?: number;
  bendAngleDeg?: number;
  bendRadius?: number;
  bossHeight?: number;
  ribThickness?: number;
  customOffset?: Vec2;
}

export interface IsoConversionResult {
  updatedEntities: Entity[];
  updatedDims: Dimension[];
  newSelectionIds: string[];
  previewEntities: Entity[];
  previewDims: Dimension[];
}

/**
 * Pipeline completo de construção isométrica sólida 3D com oclusão (HLR) para a seleção do usuário:
 * interpreta contornos externos, furos passantes, dobras de chapa (3D fold + raio R),
 * ressaltos cilíndricos concêntricos, chanfros, filetes e nervuras.
 */
function buildSolidIsoSceneFromSelection(params: {
  selectedEntities: Entity[];
  plane: IsoPlane;
  pivot: Vec2;
  thickness: number;
  bendAngleDeg: number;
  bendRadius: number;
  bossHeight: number;
  ribThickness: number;
  idMap?: Map<string, string>;
}): Entity[] {
  const {
    selectedEntities,
    plane,
    pivot,
    thickness,
    bendAngleDeg,
    bendRadius,
    bossHeight,
    ribThickness,
    idMap,
  } = params;

  const T = Math.max(0.5, thickness);
  const topology = extractTopologyFrom2D(selectedEntities);
  const { closedLoops, openSegments, bendLines, centerEntities } = topology;

  const mapId = (origId: string) => idMap?.get(origId) ?? origId;

  // Caso 1: Apenas um único círculo selecionado (ex: disco/cilindro simples)
  if (closedLoops.length === 1 && closedLoops[0]!.isCircle && bendLines.length === 0 && openSegments.length === 0) {
    const loop = closedLoops[0]!;
    const origEnt = selectedEntities.find((e) => e.id === loop.id);
    const topC = projectPointToIsoPlane(loop.circleCenter!, plane, pivot);
    const extVec = getIsoExtrusionVector(plane, T);
    const botC = { x: topC.x + extVec.x, y: topC.y + extVec.y };
    const cylEnts = buildSolidIsoCylinder({
      plane,
      baseCenter: botC,
      topCenter: topC,
      outerRadius: loop.circleRadius!,
      layer: loop.layer,
      baseDepth: 100,
      primaryId: mapId(loop.id),
    });
    if (origEnt) {
      const topEllipse = cylEnts.find((e) => e.type === "ellipse");
      if (topEllipse) {
        topEllipse.params = { ...topEllipse.params, canonical2D: origEnt };
      }
    }
    return cylEnts;
  }

  // Caso 2: Sem contornos fechados (ex: apenas linhas soltas selecionadas)
  if (closedLoops.length === 0) {
    const projectedFront = selectedEntities.map((e) => {
      const newId = mapId(e.id);
      const proj = projectEntityToIso(e, plane, pivot, newId);
      return {
        ...proj,
        params: {
          ...proj.params,
          canonical2D: e,
          depth: 100,
        },
      };
    });
    const extr = generate25DExtrusion(projectedFront, plane, T);
    return [...extr, ...projectedFront].sort(
      (a, b) => ((a.params?.depth as number) ?? 0) - ((b.params?.depth as number) ?? 0),
    );
  }

  // Ordena loops fechados do maior para o menor em área
  const sortedLoops = closedLoops.slice().sort((a, b) => b.absArea - a.absArea);
  const outerLoop = sortedLoops[0]!;
  const innerLoops = sortedLoops.slice(1);

  // Detecta pares de círculos concêntricos (Seção 2.4: Buchas / Tubos / Ressaltos Cilíndricos)
  const circleLoops = sortedLoops.filter((l) => l.isCircle && l.circleCenter && l.circleRadius);
  const usedInnerIds = new Set<string>();
  const bosses: {
    outerLoop: ClosedLoop2D;
    innerHoleLoop?: ClosedLoop2D;
    height: number;
  }[] = [];

  // Caso 2A: Peça inteira é um anel / tubo / flange de dois círculos concêntricos
  if (
    outerLoop.isCircle &&
    innerLoops.length === 1 &&
    innerLoops[0]!.isCircle &&
    dist(outerLoop.circleCenter!, innerLoops[0]!.circleCenter!) <= Math.max(2.5, outerLoop.circleRadius! * 0.15)
  ) {
    const holeLoop = innerLoops[0]!;
    const topC = projectPointToIsoPlane(outerLoop.circleCenter!, plane, pivot);
    const H = bossHeight > 0 ? bossHeight : T;
    const extVec = getIsoExtrusionVector(plane, H);
    const botC = { x: topC.x + extVec.x, y: topC.y + extVec.y };

    const cylEnts = buildSolidIsoCylinder({
      plane,
      baseCenter: botC,
      topCenter: topC,
      outerRadius: outerLoop.circleRadius!,
      innerRadius: holeLoop.circleRadius!,
      layer: outerLoop.layer,
      baseDepth: 100,
      primaryId: mapId(outerLoop.id),
    });

    // Preserva os IDs das entidades originais para vínculos de cotas e reversão 2D
    const origOuter = selectedEntities.find((e) => e.id === outerLoop.id);
    const origInner = selectedEntities.find((e) => e.id === holeLoop.id);
    const topEllipses = cylEnts.filter((e) => e.type === "ellipse");
    if (topEllipses[0] && origOuter) {
      topEllipses[0].params = { ...topEllipses[0].params, canonical2D: origOuter };
    }
    if (topEllipses.length >= 2 && origInner) {
      const innerMain = topEllipses[topEllipses.length - 1]!;
      innerMain.id = mapId(holeLoop.id);
      innerMain.params = { ...innerMain.params, canonical2D: origInner };
    }

    return cylEnts;
  }

  // Caso 2B: Círculos concêntricos DENTRO do contorno externo (Ressalto Cilíndrico / Boss na chapa)
  const innerCircles = innerLoops.filter((l) => l.isCircle && l.circleCenter && l.circleRadius);
  for (let i = 0; i < innerCircles.length; i++) {
    const cOuter = innerCircles[i]!;
    if (usedInnerIds.has(cOuter.id)) continue;

    for (let j = i + 1; j < innerCircles.length; j++) {
      const cInner = innerCircles[j]!;
      if (usedInnerIds.has(cInner.id)) continue;

      if (dist(cOuter.circleCenter!, cInner.circleCenter!) <= Math.max(2.5, cOuter.circleRadius! * 0.15)) {
        usedInnerIds.add(cOuter.id);
        usedInnerIds.add(cInner.id);
        const computedBossH =
          bossHeight > 0
            ? bossHeight
            : Math.max(T * 3.5, Math.round(cOuter.circleRadius! * 0.9));
        bosses.push({
          outerLoop: cOuter,
          innerHoleLoop: cInner,
          height: computedBossH,
        });
        break;
      }
    }
  }

  // Demais loops internos são Furos Passantes ou Recortes Internos (Seção 2.2)
  const throughHoles = innerLoops.filter((l) => !usedInnerIds.has(l.id));
  // Os furos internos dos ressaltos também furam a chapa base
  for (const b of bosses) {
    if (b.innerHoleLoop) throughHoles.push(b.innerHoleLoop);
  }

  const allGenerated: Entity[] = [];

  // Função auxiliar para transformar um ponto 2D (x, y) considerando Dobras de Chapa 3D (Seção 2.3)
  // Se não houver linhas de dobra, w = 0 para a face superior e w = -T para a face inferior.
  // Se houver linhas de dobra, divide o polígono em Base + Abas Dobradas e rotaciona cada aba em 3D!
  if (bendLines.length > 0 && !outerLoop.isCircle) {
    let basePoly = outerLoop.pts.slice();
    const flangeRegions: {
      poly2D: Vec2[];
      bendLine: (typeof bendLines)[number];
      uBend: Vec2;
      nFlange: Vec2;
    }[] = [];

    const outerCentroid = outerLoop.centroid;

    for (const bl of bendLines) {
      const dx = bl.p2.x - bl.p1.x;
      const dy = bl.p2.y - bl.p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-2) continue;

      const uBend = { x: dx / len, y: dy / len };
      const n1 = { x: -uBend.y, y: uBend.x };
      const n2 = { x: uBend.y, y: -uBend.x };

      // O lado que NÃO contém o centroide principal (ou o lado menor) é a aba dobrada (Flange)
      const sideCentroid = (outerCentroid.x - bl.p1.x) * n1.x + (outerCentroid.y - bl.p1.y) * n1.y;
      const nBase = sideCentroid >= 0 ? n1 : n2;
      const nFlange = sideCentroid >= 0 ? n2 : n1;

      const clippedFlange = clipPolygonByHalfPlane(basePoly, bl.p1, nFlange);
      const clippedBase = clipPolygonByHalfPlane(basePoly, bl.p1, nBase);

      if (clippedFlange.length >= 3 && clippedBase.length >= 3) {
        basePoly = ensureCounterClockwise(clippedBase);
        flangeRegions.push({
          poly2D: ensureCounterClockwise(clippedFlange),
          bendLine: bl,
          uBend,
          nFlange,
        });
      }
    }

    // 1. Renderiza a Região Base Plana (w = 0 topo, w = -T fundo)
    const baseTopPts = basePoly.map((p) =>
      project3DToIso(p.x - pivot.x, p.y - pivot.y, 0, plane, pivot).pt,
    );
    const baseBotPts = basePoly.map((p) =>
      project3DToIso(p.x - pivot.x, p.y - pivot.y, -T, plane, pivot).pt,
    );
    const baseCenter3D = project3DToIso(
      polygonCentroid(basePoly).x - pivot.x,
      polygonCentroid(basePoly).y - pivot.y,
      0,
      plane,
      pivot,
    );

    allGenerated.push(
      ...buildSolidSheetRegion3D({
        topPts2D: baseTopPts,
        botPts2D: baseBotPts,
        faceFillColor: ISO_TECH_SHADING.topFace,
        baseDepth: baseCenter3D.depth,
        plane,
        layer: outerLoop.layer,
        primaryId: mapId(outerLoop.id),
        canonicalEntity: selectedEntities.find((e) => e.id === outerLoop.id),
      }),
    );

    // Furos que pertencem à Região Base
    for (const hole of throughHoles) {
      const inFlange = flangeRegions.some((fr) => isPointInPolygon2D(hole.centroid, fr.poly2D));
      if (inFlange) continue;

      if (hole.isCircle && hole.circleCenter && hole.circleRadius) {
        const hc = project3DToIso(
          hole.circleCenter.x - pivot.x,
          hole.circleCenter.y - pivot.y,
          0,
          plane,
          pivot,
        );
        const holeEnts = buildIsoHoleWithDepth(
          plane,
          hc.pt,
          hole.circleRadius * 2,
          T,
          hole.layer,
          "referencia",
          baseCenter3D.depth + 2,
        );
        const mainRing = holeEnts.find((he) => he.type === "ellipse" && !he.params?.noStroke);
        const origHole = selectedEntities.find((e) => e.id === hole.id);
        if (mainRing) {
          mainRing.id = mapId(hole.id);
          if (origHole) mainRing.params = { ...mainRing.params, canonical2D: origHole };
        }
        allGenerated.push(...holeEnts);
      } else {
        // Recorte poligonal ou oblongo interno na base
        const topHolePts = hole.pts.map(
          (p) => project3DToIso(p.x - pivot.x, p.y - pivot.y, 0, plane, pivot).pt,
        );
        const botHolePts = hole.pts.map(
          (p) => project3DToIso(p.x - pivot.x, p.y - pivot.y, -T, plane, pivot).pt,
        );
        allGenerated.push({
          id: mapId(hole.id),
          layer: hole.layer,
          type: "polyline",
          closed: true,
          pts: topHolePts,
          params: {
            isIso: true,
            isoPlane: plane,
            isIsoSolidFace: true,
            fillColor: ISO_TECH_SHADING.holeWall,
            strokeColor: ISO_TECH_SHADING.edgeStroke,
            strokeWidth: 2.0,
            depth: baseCenter3D.depth + 2,
          },
        });
        // Segmentos inferiores visíveis dentro da abertura do recorte
        const visBotPts = botHolePts.filter((bp) => isPointInPolygon2D(bp, topHolePts));
        if (visBotPts.length >= 2) {
          allGenerated.push({
            id: uid(),
            layer: hole.layer,
            type: "polyline",
            closed: false,
            pts: visBotPts,
            params: {
              isIso: true,
              isoPlane: plane,
              isIsoSolidFace: true,
              isIsoExtrudedBackFace: true,
              fillColor: "none",
              strokeColor: ISO_TECH_SHADING.edgeStroke,
              strokeWidth: 1.8,
              depth: baseCenter3D.depth + 2.5,
            },
          });
        }
      }
    }

    // 2. Renderiza cada Aba Dobrada (Flange) + Cilindro de Raio de Dobra R (Seção 2.3)
    for (const fr of flangeRegions) {
      const { poly2D, bendLine, uBend, nFlange } = fr;
      const angleDeg = bendLine.angleDeg || bendAngleDeg || 90;
      const alphaRad = (angleDeg * Math.PI) / 180;
      const signAlpha = alphaRad >= 0 ? 1 : -1;
      const absAlpha = Math.abs(alphaRad);
      const R = Math.max(1.5, bendRadius || bendLine.radius || T * 0.65);

      // Função que mapeia um ponto 2D da aba (x, y) e offset normal (off = 0 face interna, off = -T face externa)
      // para coordenadas 3D (u, v, w) rotacionadas em torno da linha de dobra com raio R!
      const mapFlangePoint3D = (p: Vec2, normalOffset: number) => {
        const rx = p.x - bendLine.p1.x;
        const ry = p.y - bendLine.p1.y;
        const s = rx * uBend.x + ry * uBend.y;
        const d = Math.max(0, rx * nFlange.x + ry * nFlange.y);

        const footX = bendLine.p1.x + s * uBend.x;
        const footY = bendLine.p1.y + s * uBend.y;

        // Rotação 3D real em torno da linha de dobra por ângulo alphaRad com raio de concordância R
        const rEff = R - signAlpha * normalOffset;
        const flatDist = Math.max(0, d - R * 0.5);
        const horizAdvance = rEff * Math.sin(absAlpha) + flatDist * Math.cos(absAlpha);
        const vertRise =
          signAlpha * (R + rEff * (1 - Math.cos(absAlpha)) + flatDist * Math.sin(absAlpha)) +
          normalOffset * Math.cos(absAlpha);

        const worldX = footX + horizAdvance * nFlange.x;
        const worldY = footY + horizAdvance * nFlange.y;
        const worldW = vertRise;

        return project3DToIso(worldX - pivot.x, worldY - pivot.y, worldW, plane, pivot);
      };

      // 2.1. Gera o Cilindro Suave do Raio de Dobra (R interno e R + T externo) e Linhas de Tangência
      // Encontra a extensão [sMin, sMax] da linha de dobra no polígono
      let sMin = Infinity;
      let sMax = -Infinity;
      for (const p of poly2D) {
        const d = (p.x - bendLine.p1.x) * nFlange.x + (p.y - bendLine.p1.y) * nFlange.y;
        if (Math.abs(d) < 3.0) {
          const s = (p.x - bendLine.p1.x) * uBend.x + (p.y - bendLine.p1.y) * uBend.y;
          if (s < sMin) sMin = s;
          if (s > sMax) sMax = s;
        }
      }
      if (!Number.isFinite(sMin) || !Number.isFinite(sMax) || sMax <= sMin) {
        sMin = 0;
        sMax = Math.hypot(bendLine.p2.x - bendLine.p1.x, bendLine.p2.y - bendLine.p1.y);
      }

      const bStart = {
        x: bendLine.p1.x + sMin * uBend.x,
        y: bendLine.p1.y + sMin * uBend.y,
      };
      const bEnd = {
        x: bendLine.p1.x + sMax * uBend.x,
        y: bendLine.p1.y + sMax * uBend.y,
      };

      // Superfície cilíndrica de concordância da dobra (entre a base plana e o início da aba vertical)
      const bendBaseStart = project3DToIso(bStart.x - pivot.x, bStart.y - pivot.y, 0, plane, pivot);
      const bendBaseEnd = project3DToIso(bEnd.x - pivot.x, bEnd.y - pivot.y, 0, plane, pivot);
      const bendFlangeStart = mapFlangePoint3D(bStart, 0);
      const bendFlangeEnd = mapFlangePoint3D(bEnd, 0);

      const bendZoneDepth =
        0.25 * (bendBaseStart.depth + bendBaseEnd.depth + bendFlangeStart.depth + bendFlangeEnd.depth);

      // Polígono preenchido da zona do raio de dobra com as duas linhas de tangência visíveis
      allGenerated.push({
        id: mapId(bendLine.id),
        layer: "dobra",
        type: "polyline",
        closed: true,
        pts: [bendBaseStart.pt, bendBaseEnd.pt, bendFlangeEnd.pt, bendFlangeStart.pt],
        params: {
          isIso: true,
          isoPlane: plane,
          isIsoSolidFace: true,
          fillColor: ISO_TECH_SHADING.bendFace,
          strokeColor: ISO_TECH_SHADING.edgeStroke,
          strokeWidth: 1.8,
          depth: bendZoneDepth + 1,
          canonical2D: bendLine.entity,
        },
      });

      // Perfil lateral curvo da espessura da chapa no raio de dobra (arco interno R e externo R + T)
      const sidePivot = bendBaseEnd.depth >= bendBaseStart.depth ? bEnd : bStart;
      const numBendSteps = 8;
      const outerArcPts: Vec2[] = [];
      const innerArcPts: Vec2[] = [];
      for (let k = 0; k <= numBendSteps; k++) {
        const theta = (absAlpha * k) / numBendSteps;
        const rIn = R;
        const rOut = R + T;
        const pInX = sidePivot.x + rIn * Math.sin(theta) * nFlange.x;
        const pInY = sidePivot.y + rIn * Math.sin(theta) * nFlange.y;
        const pInW = signAlpha * (R - rIn * Math.cos(theta));

        const pOutX = sidePivot.x + rOut * Math.sin(theta) * nFlange.x;
        const pOutY = sidePivot.y + rOut * Math.sin(theta) * nFlange.y;
        const pOutW = signAlpha * (R - rOut * Math.cos(theta));

        innerArcPts.push(project3DToIso(pInX - pivot.x, pInY - pivot.y, pInW, plane, pivot).pt);
        outerArcPts.push(project3DToIso(pOutX - pivot.x, pOutY - pivot.y, pOutW, plane, pivot).pt);
      }

      allGenerated.push({
        id: uid(),
        layer: outerLoop.layer,
        type: "polyline",
        closed: true,
        pts: [...innerArcPts, ...outerArcPts.slice().reverse()],
        params: {
          isIso: true,
          isoPlane: plane,
          isIsoSolidFace: true,
          isIsoExtrudedBackFace: true,
          fillColor: ISO_TECH_SHADING.rightFace,
          strokeColor: ISO_TECH_SHADING.edgeStroke,
          strokeWidth: 1.9,
          depth: bendZoneDepth + 2,
        },
      });

      // 2.2. Superfície 3D rotacionada da Aba Dobrada (Flange)
      const flangeFrontPts = poly2D.map((p) => mapFlangePoint3D(p, 0).pt);
      const flangeBackPts = poly2D.map((p) => mapFlangePoint3D(p, -T).pt);
      const flangeCentroid2D = polygonCentroid(poly2D);
      const flangeCenterFront = mapFlangePoint3D(flangeCentroid2D, 0);
      const flangeCenterBack = mapFlangePoint3D(flangeCentroid2D, -T);

      // Verifica qual face da aba dobrada (0 ou -T) está voltada para a câmera isométrica
      const isFrontCloser = flangeCenterFront.depth >= flangeCenterBack.depth;
      const visTopPts = isFrontCloser ? flangeFrontPts : flangeBackPts;
      const visBotPts = isFrontCloser ? flangeBackPts : flangeFrontPts;
      const flangeDepth = Math.max(flangeCenterFront.depth, flangeCenterBack.depth);

      // Cor de sombreado técnico da aba dobrada segundo sua orientação 3D
      const flangeNormalShade = shadeFromLocalNormal(
        -nFlange.x * Math.sin(absAlpha),
        -nFlange.y * Math.sin(absAlpha),
        Math.cos(absAlpha),
        plane,
      );

      // Determina o plano isométrico equivalente da aba vertical ("left" ou "right")
      const flangeIsoPlane: IsoPlane =
        Math.abs(nFlange.x) >= Math.abs(nFlange.y) ? "left" : "right";

      const flangeSheetEnts = buildSolidSheetRegion3D({
        topPts2D: visTopPts,
        botPts2D: visBotPts,
        faceFillColor: flangeNormalShade.fillColor,
        baseDepth: flangeDepth,
        plane: flangeIsoPlane,
        layer: outerLoop.layer,
      }).map((fe) => ({
        ...fe,
        params: {
          ...fe.params,
          isIsoExtrudedBackFace: true,
        },
      }));
      allGenerated.push(...flangeSheetEnts);

      // 2.3. Furos passantes localizados na Aba Dobrada (rotacionados em 3D junto com a aba!)
      for (const hole of throughHoles) {
        if (!isPointInPolygon2D(hole.centroid, poly2D)) continue;

        if (hole.isCircle && hole.circleCenter && hole.circleRadius) {
          const hcFront = mapFlangePoint3D(hole.circleCenter, isFrontCloser ? 0 : -T);
          const holeEnts = buildIsoHoleWithDepth(
            flangeIsoPlane,
            hcFront.pt,
            hole.circleRadius * 2,
            T,
            hole.layer,
            "referencia",
            flangeDepth + 2,
          );
          const mainRing = holeEnts.find((he) => he.type === "ellipse" && !he.params?.noStroke);
          const origHole = selectedEntities.find((e) => e.id === hole.id);
          if (mainRing) {
            mainRing.id = mapId(hole.id);
            if (origHole) mainRing.params = { ...mainRing.params, canonical2D: origHole };
          }
          allGenerated.push(...holeEnts);
        }
      }
    }
  } else {
    // Peça sem dobras (chapa plana com possíveis chanfros, filetes, furos, rasgos, ressaltos e nervuras)
    const topPts = outerLoop.pts.map(
      (p) => project3DToIso(p.x - pivot.x, p.y - pivot.y, 0, plane, pivot).pt,
    );
    const botPts = outerLoop.pts.map(
      (p) => project3DToIso(p.x - pivot.x, p.y - pivot.y, -T, plane, pivot).pt,
    );
    const baseCenter = project3DToIso(
      outerLoop.centroid.x - pivot.x,
      outerLoop.centroid.y - pivot.y,
      0,
      plane,
      pivot,
    );

    const mainFaceColor =
      plane === "top"
        ? ISO_TECH_SHADING.topFace
        : plane === "left"
          ? ISO_TECH_SHADING.leftFace
          : ISO_TECH_SHADING.rightFace;

    allGenerated.push(
      ...buildSolidSheetRegion3D({
        topPts2D: topPts,
        botPts2D: botPts,
        edgesMeta: outerLoop.edges,
        faceFillColor: mainFaceColor,
        baseDepth: baseCenter.depth,
        plane,
        layer: outerLoop.layer,
        primaryId: mapId(outerLoop.id),
        canonicalEntity: selectedEntities.find((e) => e.id === outerLoop.id),
      }),
    );

    // Se o contorno externo possui arcos de filete (Seção 2.5), desenha a linha de silhueta vertical
    // APENAS na extremidade tangente externa da curva!
    const extVec = getIsoExtrusionVector(plane, T);
    for (const ed of outerLoop.edges) {
      if (ed.isArc && ed.arcCenter && ed.arcRadius) {
        const arcCenterIso = projectPointToIsoPlane(ed.arcCenter, plane, pivot);
        const rx = ed.arcRadius * ISO_SQRT_1_5;
        const ry = ed.arcRadius * ISO_SQRT_0_5;
        const rotRad = (ISO_PLANES[plane].ellipseRotationDeg * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        // Pontos de tangência vertical na elipse do filete
        const nAxis = { x: -extVec.y, y: extVec.x };
        const dotU = cosR * nAxis.x + sinR * nAxis.y;
        const dotV = -sinR * nAxis.x + cosR * nAxis.y;
        const t1 = Math.atan2(ry * dotV, rx * dotU);
        const candidates = [t1, t1 + Math.PI];

        for (const tCand of candidates) {
          const tanPt = {
            x: arcCenterIso.x + rx * Math.cos(tCand) * cosR - ry * Math.sin(tCand) * sinR,
            y: arcCenterIso.y + rx * Math.cos(tCand) * sinR + ry * Math.sin(tCand) * cosR,
          };
          // Verifica se o ponto tangente pertence ao trecho do arco de filete
          const dStart = dist(tanPt, projectPointToIsoPlane(ed.p1, plane, pivot));
          const dEnd = dist(tanPt, projectPointToIsoPlane(ed.p2, plane, pivot));
          const chord = dist(
            projectPointToIsoPlane(ed.p1, plane, pivot),
            projectPointToIsoPlane(ed.p2, plane, pivot),
          );
          if (dStart + dEnd <= chord * 1.35) {
            allGenerated.push({
              id: uid(),
              layer: outerLoop.layer,
              type: "line",
              x1: tanPt.x,
              y1: tanPt.y,
              x2: tanPt.x + extVec.x,
              y2: tanPt.y + extVec.y,
              params: {
                isIso: true,
                isoPlane: plane,
                isIsoSolidFace: true,
                isIsoExtrudedBackFace: true,
                fillColor: "none",
                strokeColor: ISO_TECH_SHADING.edgeStroke,
                strokeWidth: 2.0,
                depth: baseCenter.depth - 5,
              },
            });
          }
        }
      }
    }

    // Furos Passantes e Recortes Internos (Seção 2.2)
    for (const hole of throughHoles) {
      // Se este furo já é o furo interno de um boss concêntrico, ele será desenhado no topo do boss
      if (bosses.some((b) => b.innerHoleLoop?.id === hole.id)) continue;

      if (hole.isCircle && hole.circleCenter && hole.circleRadius) {
        const hc = project3DToIso(
          hole.circleCenter.x - pivot.x,
          hole.circleCenter.y - pivot.y,
          0,
          plane,
          pivot,
        );
        const holeEnts = buildIsoHoleWithDepth(
          plane,
          hc.pt,
          hole.circleRadius * 2,
          T,
          hole.layer,
          "referencia",
          baseCenter.depth + 2,
        );
        const mainRing = holeEnts.find((he) => he.type === "ellipse" && !he.params?.noStroke);
        const origHole = selectedEntities.find((e) => e.id === hole.id);
        if (mainRing) {
          mainRing.id = mapId(hole.id);
          if (origHole) mainRing.params = { ...mainRing.params, canonical2D: origHole };
        }
        allGenerated.push(...holeEnts);
      } else {
        // Rasgo oblongo ou recorte poligonal interno
        const topHolePts = hole.pts.map(
          (p) => project3DToIso(p.x - pivot.x, p.y - pivot.y, 0, plane, pivot).pt,
        );
        const botHolePts = hole.pts.map(
          (p) => project3DToIso(p.x - pivot.x, p.y - pivot.y, -T, plane, pivot).pt,
        );
        allGenerated.push({
          id: mapId(hole.id),
          layer: hole.layer,
          type: "polyline",
          closed: true,
          pts: topHolePts,
          params: {
            isIso: true,
            isoPlane: plane,
            isIsoSolidFace: true,
            fillColor: ISO_TECH_SHADING.holeWall,
            strokeColor: ISO_TECH_SHADING.edgeStroke,
            strokeWidth: 2.0,
            depth: baseCenter.depth + 2,
          },
        });
        const visBotPts = botHolePts.filter((bp) => isPointInPolygon2D(bp, topHolePts));
        if (visBotPts.length >= 2) {
          allGenerated.push({
            id: uid(),
            layer: hole.layer,
            type: "polyline",
            closed: false,
            pts: visBotPts,
            params: {
              isIso: true,
              isoPlane: plane,
              isIsoSolidFace: true,
              isIsoExtrudedBackFace: true,
              fillColor: "none",
              strokeColor: ISO_TECH_SHADING.edgeStroke,
              strokeWidth: 1.8,
              depth: baseCenter.depth + 2.5,
            },
          });
        }
      }
    }
  }

  // 3. Ressaltos Cilíndricos / Buchas Extrudadas (Bosses - Seção 2.4)
  for (const boss of bosses) {
    const c2D = boss.outerLoop.circleCenter!;
    const baseIso = project3DToIso(c2D.x - pivot.x, c2D.y - pivot.y, 0, plane, pivot);
    const topIso = project3DToIso(c2D.x - pivot.x, c2D.y - pivot.y, boss.height, plane, pivot);

    const bossEntities = buildSolidIsoCylinder({
      plane,
      baseCenter: baseIso.pt,
      topCenter: topIso.pt,
      outerRadius: boss.outerLoop.circleRadius!,
      innerRadius: boss.innerHoleLoop?.circleRadius ?? 0,
      layer: boss.outerLoop.layer,
      baseDepth: topIso.depth + 20,
      primaryId: mapId(boss.outerLoop.id),
    });

    const origOuter = selectedEntities.find((e) => e.id === boss.outerLoop.id);
    const origInner = boss.innerHoleLoop
      ? selectedEntities.find((e) => e.id === boss.innerHoleLoop!.id)
      : undefined;
    const bossEllipses = bossEntities.filter((e) => e.type === "ellipse");
    if (bossEllipses[0] && origOuter) {
      bossEllipses[0].params = { ...bossEllipses[0].params, canonical2D: origOuter };
    }
    if (bossEllipses.length >= 2 && origInner && boss.innerHoleLoop) {
      const innerMain = bossEllipses[bossEllipses.length - 1]!;
      innerMain.id = mapId(boss.innerHoleLoop.id);
      innerMain.params = { ...innerMain.params, canonical2D: origInner };
    }

    allGenerated.push(...bossEntities);
  }

  // 4. Nervuras / Mãos-Francesas Triangulares (Seção 2.5)
  for (const seg of openSegments) {
    // Verifica se o segmento aberto conecta um ressalto cilíndrico (boss) ou uma linha de dobra à base
    let startPt = seg.p1;
    let endPt = seg.p2;
    let ribH = Math.max(T * 4, 20);

    for (const boss of bosses) {
      const bc = boss.outerLoop.circleCenter!;
      const br = boss.outerLoop.circleRadius!;
      const d1 = Math.abs(dist(seg.p1, bc) - br);
      const d2 = Math.abs(dist(seg.p2, bc) - br);
      if (d1 < d2 && d1 <= br * 0.5) {
        startPt = seg.p1;
        endPt = seg.p2;
        ribH = boss.height * 0.85;
      } else if (d2 < d1 && d2 <= br * 0.5) {
        startPt = seg.p2;
        endPt = seg.p1;
        ribH = boss.height * 0.85;
      }
    }

    for (const bl of bendLines) {
      const d1 = dist(seg.p1, bl.p1) + dist(seg.p1, bl.p2) - dist(bl.p1, bl.p2);
      const d2 = dist(seg.p2, bl.p1) + dist(seg.p2, bl.p2) - dist(bl.p1, bl.p2);
      if (d1 < d2 && d1 < 5) {
        startPt = seg.p1;
        endPt = seg.p2;
      } else if (d2 < d1 && d2 < 5) {
        startPt = seg.p2;
        endPt = seg.p1;
      }
    }

    const midRib = project3DToIso(
      0.5 * (startPt.x + endPt.x) - pivot.x,
      0.5 * (startPt.y + endPt.y) - pivot.y,
      ribH * 0.5,
      plane,
      pivot,
    );

    const ribEntities = buildSolidIsoRib({
      pStart2D: startPt,
      pEnd2D: endPt,
      ribHeight: ribH,
      ribThickness: ribThickness > 0 ? ribThickness : Math.max(4, T * 1.5),
      plane,
      pivot,
      layer: outerLoop.layer,
      baseDepth: midRib.depth + 15,
    });
    allGenerated.push(...ribEntities);
  }

  // 5. Linhas de Centro e Construção (Regra 1.3: projetadas apenas UMA ÚNICA VEZ sobre a face principal)
  for (const ce of centerEntities) {
    const projCe = projectEntityToIso(ce, plane, pivot, mapId(ce.id));
    allGenerated.push({
      ...projCe,
      isConstruction: true,
      params: {
        ...projCe.params,
        canonical2D: ce,
        depth: 999,
      },
    });
  }

  // Ordena todas as entidades geradas por profundidade (Painter's Algorithm HLR: fundo -> frente)
  return allGenerated.sort(
    (a, b) => ((a.params?.depth as number) ?? 0) - ((b.params?.depth as number) ?? 0),
  );
}

/**
 * MOTOR UNIVERSAL DE CONVERSÃO ISOMÉTRICA DO CHAMFER:
 * Transforma analiticamente a seleção ativa do documento para a perspectiva
 * isométrica escolhida (Superior, Esquerda, Direita), com renderização sólida
 * oclusiva (HLR) quando thickness > 0 ou dobras/volumes estão presentes.
 */
export function convertSelectionToIsometric(params: IsoConversionParams): IsoConversionResult {
  const {
    entities,
    selectedIds,
    dims,
    plane,
    mode,
    thickness = 0,
    bendAngleDeg = 90,
    bendRadius = 2,
    bossHeight = 0,
    ribThickness = 6,
    customOffset,
  } = params;

  const selectedSet = new Set(selectedIds);
  const selectedEntities = entities.filter((e) => selectedSet.has(e.id));

  if (!selectedEntities.length) {
    throw new Error("Nenhuma entidade selecionada para converter para isométrico.");
  }

  const selBox = bbox(selectedEntities);
  const pivot: Vec2 = selBox
    ? { x: selBox.minX, y: selBox.minY }
    : { x: 0, y: 0 };

  const isCopy = mode === "copy";
  const idMap = isCopy ? new Map<string, string>() : undefined;

  if (isCopy) {
    for (const e of selectedEntities) {
      idMap!.set(e.id, uid());
    }
  }

  const hasBendEntities = selectedEntities.some(
    (e) => e.layer === "dobra" || e.cnc?.bend || e.params?.isBendLine,
  );

  let allConvertedEntities: Entity[];

  if (thickness > 0 || hasBendEntities) {
    // Pipeline Sólido Oclusivo 2.5D/3D (Seções 1 e 2)
    allConvertedEntities = buildSolidIsoSceneFromSelection({
      selectedEntities,
      plane,
      pivot,
      thickness: thickness > 0 ? thickness : 3,
      bendAngleDeg,
      bendRadius,
      bossHeight,
      ribThickness,
      idMap,
    });
  } else {
    // Projeção afim 2D plana (quando espessura === 0 e sem dobras)
    allConvertedEntities = selectedEntities.map((e) => {
      const newId = idMap?.get(e.id);
      const projected = projectEntityToIso(e, plane, pivot, newId);
      return {
        ...projected,
        params: {
          ...projected.params,
          canonical2D: e,
        },
      };
    });
  }

  // Deslocamento se for cópia (para posicionar ao lado da peça original)
  let copyOffset: Vec2 = { x: 0, y: 0 };
  if (isCopy) {
    if (customOffset) {
      copyOffset = customOffset;
    } else if (selBox) {
      const boxW = Math.max(40, selBox.maxX - selBox.minX);
      const boxH = Math.max(40, selBox.maxY - selBox.minY);
      copyOffset = {
        x: (boxW + 40) * COS_30,
        y: -(boxH + 40) * SIN_30,
      };
    } else {
      copyOffset = { x: 100, y: -50 };
    }
  }

  const finalConvertedEntities = isCopy
    ? allConvertedEntities.map((e) => translate(e, copyOffset.x, copyOffset.y))
    : allConvertedEntities;

  // Projeção e remapeamento de cotas oblíquas
  const projectedDims = projectDimensionsToIso(dims, selectedEntities, plane, pivot, idMap);
  const finalConvertedDims = isCopy
    ? projectedDims.map((d) => ({
        ...d,
        refs: d.refs.map((r) =>
          r.kind === "point"
            ? { kind: "point" as const, p: { x: r.p.x + copyOffset.x, y: r.p.y + copyOffset.y } }
            : r,
        ),
      }))
    : projectedDims;

  let updatedEntities: Entity[];
  let updatedDims: Dimension[];

  if (isCopy) {
    updatedEntities = [...entities, ...finalConvertedEntities];
    updatedDims = [...dims, ...finalConvertedDims];
  } else {
    const untouched = entities.filter((e) => !selectedSet.has(e.id));
    updatedEntities = [...untouched, ...finalConvertedEntities];

    const convertedDimMap = new Map(finalConvertedDims.map((d) => [d.id, d]));
    updatedDims = dims.map((d) => convertedDimMap.get(d.id) ?? d);
  }

  const newSelectionIds = finalConvertedEntities.map((e) => e.id);

  return {
    updatedEntities,
    updatedDims,
    newSelectionIds,
    previewEntities: finalConvertedEntities,
    previewDims: finalConvertedDims,
  };
}

/**
 * Inverte as cotas associadas à seleção isométrica de volta para coordenadas ortogonais 2D.
 */
export function unprojectDimensionsFromIso(
  allDims: Dimension[],
  selectedEntities: Entity[],
  plane: IsoPlane,
  pivot: Vec2,
): Dimension[] {
  if (!allDims.length || !selectedEntities.length) return [];
  const selectedIdSet = new Set(selectedEntities.map((e) => e.id));

  return allDims
    .filter((d) => d.refs.some((r) => r.kind === "entity" && selectedIdSet.has(r.id)))
    .map((d) => ({
      ...d,
      refs: d.refs.map((r) =>
        r.kind === "point"
          ? { kind: "point" as const, p: unprojectPointFromIsoPlane(r.p, plane, pivot) }
          : r,
      ),
    }));
}

/**
 * MOTOR DE DESPROJEÇÃO ISOMÉTRICA (INVERSA ANALÍTICA):
 * Reverte a seleção isométrica ativa de volta para o formato plano 2D ortogonal canônico,
 * removendo paredes de extrusão 2.5D/3D e restaurando as entidades originais.
 */
export function unprojectSelectionFromIsometric(params: {
  entities: Entity[];
  selectedIds: string[];
  dims: Dimension[];
  fallbackPlane?: IsoPlane;
}): IsoConversionResult {
  const { entities, selectedIds, dims, fallbackPlane = "top" } = params;
  const selectedSet = new Set(selectedIds);
  const selectedEntities = entities.filter((e) => selectedSet.has(e.id));

  if (!selectedEntities.length) {
    throw new Error("Nenhuma entidade selecionada para desprojetar do isométrico.");
  }

  const detectedPlane: IsoPlane =
    (selectedEntities.find((e) => e.params?.isoPlane)?.params?.isoPlane as IsoPlane) ||
    fallbackPlane;

  const selBox = bbox(selectedEntities);
  const pivot: Vec2 = selBox ? { x: selBox.minX, y: selBox.minY } : { x: 0, y: 0 };

  // Filtra faces e arestas auxiliares de extrusão/sombreado 2.5D
  const frontEntities = selectedEntities.filter((e) => !e.params?.isIsoExtrudedBackFace);

  const unprojected = frontEntities.map((e) =>
    unprojectEntityFromIso(e, (e.params?.isoPlane as IsoPlane) || detectedPlane, pivot),
  );

  const unprojectedDims = unprojectDimensionsFromIso(dims, frontEntities, detectedPlane, pivot);

  const untouched = entities.filter((e) => !selectedSet.has(e.id));
  const updatedEntities = [...untouched, ...unprojected];

  const unprojectedDimMap = new Map(unprojectedDims.map((d) => [d.id, d]));
  const updatedDims = dims.map((d) => unprojectedDimMap.get(d.id) ?? d);

  return {
    updatedEntities,
    updatedDims,
    newSelectionIds: unprojected.map((e) => e.id),
    previewEntities: unprojected,
    previewDims: unprojectedDims,
  };
}

// ============================================================================
// PRESETS DE DEMONSTRAÇÃO TÉCNICA SÓLIDA (RETROCOMPATIBILIDADE E TESTES)
// ============================================================================

export function buildBentSupportPreset(params?: {
  baseWidth?: number;
  baseLength?: number;
  flangeHeight?: number;
  thickness?: number;
  holeDiameter?: number;
  origin?: Vec2;
}): { entities: Entity[]; dims: Dimension[] } {
  const w = params?.baseWidth ?? 120;
  const l = params?.baseLength ?? 80;
  const h = params?.flangeHeight ?? 60;
  const t = params?.thickness ?? 3;
  const d = params?.holeDiameter ?? 12;
  const origin = params?.origin ?? { x: 0, y: 0 };

  const entities: Entity[] = [];
  const dims: Dimension[] = [];

  const solidPoly = (
    pts: Vec2[],
    fillColor: string,
    depth: number,
    layer: LayerId = "corte",
    noStroke = false,
  ): Entity => ({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts,
    params: {
      isIso: true,
      isIsoSolidFace: true,
      fillColor,
      strokeColor: "#FFFFFF",
      strokeWidth: 2,
      noStroke,
      depth,
    },
  });

  const p0 = origin;
  const pW = isoPlaneToCanvas("top", w, 0, origin);
  const pWL = isoPlaneToCanvas("top", w, l, origin);
  const pL = isoPlaneToCanvas("top", 0, l, origin);

  const b0 = { x: p0.x, y: p0.y + t };
  const bW = { x: pW.x, y: pW.y + t };
  const bWL = { x: pWL.x, y: pWL.y + t };
  const bL = { x: pL.x, y: pL.y + t };

  // Paredes laterais frontais da base
  entities.push(solidPoly([p0, pL, bL, b0], "#262E38", 10));
  entities.push(solidPoly([p0, pW, bW, b0], "#1B222A", 12));

  // Face superior da base
  entities.push(solidPoly([p0, pW, pWL, pL], "#323B47", 20));

  // Linha de dobra e raio de concordância
  const bendStart = isoPlaneToCanvas("top", w - t, 0, origin);
  const bendEnd = isoPlaneToCanvas("top", w - t, l, origin);
  entities.push({
    id: uid(),
    layer: "dobra",
    type: "line",
    x1: bendStart.x,
    y1: bendStart.y,
    x2: bendEnd.x,
    y2: bendEnd.y,
    params: {
      isIso: true,
      isIsoSolidFace: true,
      fillColor: "none",
      strokeColor: "#FFFFFF",
      strokeWidth: 1.8,
      depth: 22,
    },
  });

  // Furos passantes na base com oclusão real (Seção 2.2)
  const hole1Center = isoPlaneToCanvas("top", w * 0.35, l * 0.3, origin);
  const hole2Center = isoPlaneToCanvas("top", w * 0.35, l * 0.7, origin);
  entities.push(...buildIsoHoleWithDepth("top", hole1Center, d, t, "recorte", "referencia", 25));
  entities.push(...buildIsoHoleWithDepth("top", hole2Center, d, t, "recorte", "referencia", 25));

  // Aba vertical dobrada a 90°
  const fTopBack = { x: pW.x, y: pW.y - h };
  const fTopFront = { x: pWL.x, y: pWL.y - h };
  const fInBotBack = bendStart;
  const fInBotFront = bendEnd;
  const fInTopBack = { x: fInBotBack.x, y: fInBotBack.y - h };
  const fInTopFront = { x: fInBotFront.x, y: fInBotFront.y - h };

  entities.push(solidPoly([pW, pWL, fTopFront, fTopBack], "#1B222A", 35));
  entities.push(solidPoly([fInTopBack, fTopBack, fTopFront, fInTopFront], "#323B47", 45));
  entities.push(solidPoly([fInBotFront, pWL, fTopFront, fInTopFront], "#1B222A", 48));
  entities.push(solidPoly([fInBotBack, fInBotFront, fInTopFront, fInTopBack], "#262E38", 50));

  // Furo passante na aba vertical
  const flangeHoleCenter = {
    x: (fInBotBack.x + fInBotFront.x) / 2,
    y: (fInBotBack.y + fInBotFront.y) / 2 - h * 0.55,
  };
  entities.push(
    ...buildIsoHoleWithDepth("left", flangeHoleCenter, d * 1.2, t, "recorte", "referencia", 55),
  );

  // Cotas técnicas associativas
  dims.push(
    makeDimension(
      "aligned",
      [
        { kind: "point", p: p0 },
        { kind: "point", p: pW },
      ],
      22,
    ),
  );
  dims.push(
    makeDimension(
      "aligned",
      [
        { kind: "point", p: p0 },
        { kind: "point", p: pL },
      ],
      -22,
    ),
  );
  dims.push(
    makeDimension(
      "aligned",
      [
        { kind: "point", p: pWL },
        { kind: "point", p: fTopFront },
      ],
      22,
    ),
  );

  return { entities, dims };
}

export function buildIsoFlangePreset(params?: {
  plane?: IsoPlane;
  outerDia?: number;
  innerDia?: number;
  boltCircleDia?: number;
  numHoles?: number;
  holeDia?: number;
  thickness?: number;
  origin?: Vec2;
}): { entities: Entity[]; dims: Dimension[] } {
  const plane = params?.plane ?? "top";
  const outerR = (params?.outerDia ?? 160) / 2;
  const innerR = (params?.innerDia ?? 60) / 2;
  const pcdR = (params?.boltCircleDia ?? 115) / 2;
  const numHoles = Math.max(3, Math.min(24, Math.round(params?.numHoles ?? 6)));
  const holeR = (params?.holeDia ?? 14) / 2;
  const thickness = params?.thickness ?? 12;
  const origin = params?.origin ?? { x: 0, y: 0 };

  const entities: Entity[] = [];
  const dims: Dimension[] = [];

  const extVec = getIsoExtrusionVector(plane, thickness);
  const botCenter = { x: origin.x + extVec.x, y: origin.y + extVec.y };

  // Disco principal sólido + furo central com oclusão real
  entities.push(
    ...buildSolidIsoCylinder({
      plane,
      baseCenter: botCenter,
      topCenter: origin,
      outerRadius: outerR,
      innerRadius: innerR,
      layer: "corte",
      baseDepth: 10,
    }),
  );

  const outerEllipse = entities.find((e) => e.type === "ellipse");
  const innerEllipse = entities.filter((e) => e.type === "ellipse")[1];

  // Círculo primitivo de furação (PCD - linha de centro apenas no topo)
  const pcdCircle = buildIsoCircle(plane, origin, pcdR, "referencia", false);
  pcdCircle.isConstruction = true;
  pcdCircle.params = { ...pcdCircle.params, depth: 30 };
  entities.push(pcdCircle);

  // Furos periféricos passantes com arco inferior visível
  for (let i = 0; i < numHoles; i++) {
    const angle = (i * 2 * Math.PI) / numHoles;
    const u = Math.cos(angle) * pcdR;
    const v = Math.sin(angle) * pcdR;
    const holeCenter = isoPlaneToCanvas(plane, u, v, origin);
    entities.push(
      ...buildIsoHoleWithDepth(plane, holeCenter, holeR * 2, thickness, "recorte", "referencia", 35),
    );
  }

  if (outerEllipse) {
    dims.push(makeDimension("diameter", [{ kind: "entity", id: outerEllipse.id }], 28));
  }
  if (innerEllipse) {
    dims.push(makeDimension("diameter", [{ kind: "entity", id: innerEllipse.id }], -20));
  }

  return { entities, dims };
}

export function buildIsoChannelPreset(params?: {
  webWidth?: number;
  flangeHeight?: number;
  length?: number;
  thickness?: number;
  holeDia?: number;
  origin?: Vec2;
}): { entities: Entity[]; dims: Dimension[] } {
  const w = params?.webWidth ?? 100;
  const h = params?.flangeHeight ?? 45;
  const l = params?.length ?? 140;
  const t = params?.thickness ?? 4;
  const holeDia = params?.holeDia ?? 12;
  const origin = params?.origin ?? { x: 0, y: 0 };

  const entities: Entity[] = [];
  const dims: Dimension[] = [];

  const solidPoly = (
    pts: Vec2[],
    fillColor: string,
    depth: number,
    layer: LayerId = "corte",
  ): Entity => ({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts,
    params: {
      isIso: true,
      isIsoSolidFace: true,
      fillColor,
      strokeColor: "#FFFFFF",
      strokeWidth: 2,
      depth,
    },
  });

  const p0 = origin;
  const pW = isoPlaneToCanvas("top", w, 0, origin);
  const pWL = isoPlaneToCanvas("top", w, l, origin);
  const pL = isoPlaneToCanvas("top", 0, l, origin);

  const lTop0 = { x: p0.x, y: p0.y - h };
  const lTopL = { x: pL.x, y: pL.y - h };
  const lIn0 = isoPlaneToCanvas("top", t, 0, origin);
  const lInL = isoPlaneToCanvas("top", t, l, origin);
  const lInTop0 = { x: lIn0.x, y: lIn0.y - h };
  const lInTopL = { x: lInL.x, y: lInL.y - h };

  entities.push(solidPoly([p0, pL, lTopL, lTop0], "#262E38", 10));
  entities.push(solidPoly([lIn0, lInL, lInTopL, lInTop0], "#1B222A", 15));
  entities.push(solidPoly([lTop0, lInTop0, lInTopL, lTopL], "#323B47", 18));
  entities.push(solidPoly([p0, lIn0, lInTop0, lTop0], "#1B222A", 19));

  entities.push(solidPoly([p0, pW, pWL, pL], "#323B47", 25));
  entities.push({
    id: uid(),
    layer: "dobra",
    type: "line",
    x1: lIn0.x,
    y1: lIn0.y,
    x2: lInL.x,
    y2: lInL.y,
    params: { isIso: true, depth: 26 },
  });

  if (holeDia > 0) {
    const h1 = isoPlaneToCanvas("top", w / 2, l * 0.3, origin);
    const h2 = isoPlaneToCanvas("top", w / 2, l * 0.7, origin);
    entities.push(...buildIsoHoleWithDepth("top", h1, holeDia, t, "recorte", "referencia", 28));
    entities.push(...buildIsoHoleWithDepth("top", h2, holeDia, t, "recorte", "referencia", 28));
  }

  const rTopW = { x: pW.x, y: pW.y - h };
  const rTopWL = { x: pWL.x, y: pWL.y - h };
  const rInW = isoPlaneToCanvas("top", w - t, 0, origin);
  const rInWL = isoPlaneToCanvas("top", w - t, l, origin);
  const rInTopW = { x: rInW.x, y: rInW.y - h };
  const rInTopWL = { x: rInWL.x, y: rInWL.y - h };

  entities.push({
    id: uid(),
    layer: "dobra",
    type: "line",
    x1: rInW.x,
    y1: rInW.y,
    x2: rInWL.x,
    y2: rInWL.y,
    params: { isIso: true, depth: 26 },
  });

  entities.push(solidPoly([rInW, rInWL, rInTopWL, rInTopW], "#262E38", 35));
  entities.push(solidPoly([rInTopW, rTopW, rTopWL, rInTopWL], "#323B47", 38));
  entities.push(solidPoly([rInW, pW, rTopW, rInTopW], "#262E38", 39));
  entities.push(solidPoly([pW, pWL, rTopWL, rTopW], "#1B222A", 42));

  dims.push(
    makeDimension(
      "aligned",
      [
        { kind: "point", p: p0 },
        { kind: "point", p: pW },
      ],
      22,
    ),
  );
  dims.push(
    makeDimension(
      "aligned",
      [
        { kind: "point", p: pW },
        { kind: "point", p: pWL },
      ],
      22,
    ),
  );
  dims.push(
    makeDimension(
      "aligned",
      [
        { kind: "point", p: pWL },
        { kind: "point", p: rTopWL },
      ],
      20,
    ),
  );

  return { entities, dims };
}
