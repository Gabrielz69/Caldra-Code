/**
 * CALDRA CHAMFER — MOTOR GEOMÉTRICO DE CENTRALIZAÇÃO E ALINHAMENTO DE FORMAS (CAD 2D)
 *
 * Suporta:
 *  - Centralização horizontal (alinha centros em X);
 *  - Centralização vertical (alinha centros em Y);
 *  - Centralização total (horizontal + vertical / centro a centro);
 *  - Cálculo pelo Centro Geométrico real (centroide) ou Bounding Box;
 *  - Centralização do conjunto em bloco (mantendo posições relativas intactas);
 *  - Centralização individual (todas as formas convergem para o mesmo centro);
 *  - Centralização em relação a uma entidade mestre/referência definida pelo usuário;
 *  - Centralização em relação à origem (0, 0) ou à chapa/área de trabalho.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { type Entity, translate, entityPoints } from "./core";
import { getGeometricCenter } from "./cadReferenceSnaps";

export type CenterAxis = "both" | "horizontal" | "vertical";
export type CenterMethod = "centroid" | "bbox";
export type CenterGrouping = "block" | "individual";

export interface CenterOptions {
  axis: CenterAxis;
  method: CenterMethod;
  grouping: CenterGrouping;
  referenceEntityId?: string | null;
  targetPoint?: Vec2 | null;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  center: Vec2;
}

/**
 * Calcula o Bounding Box exato de uma ou mais entidades.
 */
export function computeBoundingBox(entities: Entity[]): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const e of entities) {
    const pts = entityPoints(e);
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, center: { x: 0, y: 0 } };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

/**
 * Obtém o ponto central de uma entidade de acordo com o método escolhido.
 */
export function getEntityCenterPoint(e: Entity, method: CenterMethod = "centroid"): Vec2 {
  if (method === "centroid") {
    return getGeometricCenter(e);
  }
  const bbox = computeBoundingBox([e]);
  return bbox.center;
}

/**
 * Obtém o ponto central do conjunto de entidades.
 */
export function getSetCenterPoint(entities: Entity[], method: CenterMethod = "centroid"): Vec2 {
  if (entities.length === 0) return { x: 0, y: 0 };
  if (entities.length === 1) return getEntityCenterPoint(entities[0]!, method);

  if (method === "bbox") {
    return computeBoundingBox(entities).center;
  }

  // Média ponderada dos centros geométricos
  const centers = entities.map((e) => getGeometricCenter(e));
  const avg = centers.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 });
  return { x: avg.x / entities.length, y: avg.y / entities.length };
}

/**
 * Executa o cálculo de centralização e retorna a lista de entidades transformadas.
 */
export function centerShapes(
  entitiesToCenter: Entity[],
  allEntities: Entity[],
  options: CenterOptions,
): {
  transformed: Entity[];
  targetCenter: Vec2;
  originalCenter: Vec2;
  shiftVector: Vec2;
} {
  if (entitiesToCenter.length === 0) {
    return {
      transformed: [],
      targetCenter: { x: 0, y: 0 },
      originalCenter: { x: 0, y: 0 },
      shiftVector: { x: 0, y: 0 },
    };
  }

  // 1. Determina o ponto de destino (Target Center)
  let targetCenter: Vec2;

  if (options.targetPoint) {
    targetCenter = options.targetPoint;
  } else if (options.referenceEntityId) {
    // Alinhar a uma entidade de referência específica
    const refEnt = allEntities.find((e) => e.id === options.referenceEntityId);
    if (refEnt) {
      targetCenter = getEntityCenterPoint(refEnt, options.method);
    } else {
      targetCenter = getSetCenterPoint(entitiesToCenter, options.method);
    }
  } else {
    // Centro natural do conjunto selecionado
    targetCenter = getSetCenterPoint(entitiesToCenter, options.method);
  }

  // 2. Modo A: Em Bloco (mantém distâncias e posições relativas entre as peças)
  if (options.grouping === "block") {
    const originalCenter = getSetCenterPoint(entitiesToCenter, options.method);
    const dx = options.axis === "vertical" ? 0 : targetCenter.x - originalCenter.x;
    const dy = options.axis === "horizontal" ? 0 : targetCenter.y - originalCenter.y;

    const transformed = entitiesToCenter.map((e) => translate(e, dx, dy));
    return {
      transformed,
      targetCenter,
      originalCenter,
      shiftVector: { x: dx, y: dy },
    };
  }

  // 3. Modo B: Individual (cada entidade converge para o centro de destino)
  const originalCenter = getSetCenterPoint(entitiesToCenter, options.method);
  const transformed = entitiesToCenter.map((e) => {
    // Se a entidade for a própria referência mestre, não move
    if (options.referenceEntityId && e.id === options.referenceEntityId) return e;

    const entCenter = getEntityCenterPoint(e, options.method);
    const dx = options.axis === "vertical" ? 0 : targetCenter.x - entCenter.x;
    const dy = options.axis === "horizontal" ? 0 : targetCenter.y - entCenter.y;
    return translate(e, dx, dy);
  });

  return {
    transformed,
    targetCenter,
    originalCenter,
    shiftVector: { x: targetCenter.x - originalCenter.x, y: targetCenter.y - originalCenter.y },
  };
}

export type AlignDirection = "left" | "right" | "top" | "bottom" | "centerX" | "centerY";

/**
 * Alinha um grupo de entidades pela borda esquerda, direita, topo, base ou centro.
 */
export function alignEntities(
  entities: Entity[],
  direction: AlignDirection,
): Entity[] {
  if (entities.length <= 1) return entities;
  const collectiveBox = computeBoundingBox(entities);

  return entities.map((e) => {
    const box = computeBoundingBox([e]);
    let dx = 0;
    let dy = 0;

    switch (direction) {
      case "left":
        dx = collectiveBox.minX - box.minX;
        break;
      case "right":
        dx = collectiveBox.maxX - box.maxX;
        break;
      case "top":
        dy = collectiveBox.maxY - box.maxY;
        break;
      case "bottom":
        dy = collectiveBox.minY - box.minY;
        break;
      case "centerX":
        dx = collectiveBox.center.x - box.center.x;
        break;
      case "centerY":
        dy = collectiveBox.center.y - box.center.y;
        break;
    }

    return translate(e, dx, dy);
  });
}

/**
 * Distribui entidades selecionadas com espaçamento uniforme ao longo de um eixo.
 */
export function distributeEntities(
  entities: Entity[],
  direction: "horizontal" | "vertical",
): Entity[] {
  if (entities.length <= 2) return entities;

  const boxesWithEntities = entities.map((e) => ({
    entity: e,
    box: computeBoundingBox([e]),
  }));

  if (direction === "horizontal") {
    // Ordena por X
    boxesWithEntities.sort((a, b) => a.box.center.x - b.box.center.x);
    const minX = boxesWithEntities[0]!.box.center.x;
    const maxX = boxesWithEntities[boxesWithEntities.length - 1]!.box.center.x;
    const step = (maxX - minX) / (boxesWithEntities.length - 1);

    return boxesWithEntities.map((item, idx) => {
      const targetX = minX + idx * step;
      const dx = targetX - item.box.center.x;
      return translate(item.entity, dx, 0);
    });
  } else {
    // Ordena por Y
    boxesWithEntities.sort((a, b) => a.box.center.y - b.box.center.y);
    const minY = boxesWithEntities[0]!.box.center.y;
    const maxY = boxesWithEntities[boxesWithEntities.length - 1]!.box.center.y;
    const step = (maxY - minY) / (boxesWithEntities.length - 1);

    return boxesWithEntities.map((item, idx) => {
      const targetY = minY + idx * step;
      const dy = targetY - item.box.center.y;
      return translate(item.entity, 0, dy);
    });
  }
}
