// @ts-nocheck
/**
 * CALDRA CAD — CHAMFER BRIDGE (FASE 08)
 *
 * Ponte bidirecional entre o editor vetorial CHAMFER (Entity[]) e o núcleo CAD canônico.
 * Realiza a inferência automática de restrições geométricas a partir do desenho manual,
 * conversão de sketches em entidades vetoriais e extração de wireframe 3D.
 */

import type { Entity } from "@/lib/lab2d/core";
import type { Sketch2D, SketchElement, Constraint } from "../sketch/types";
import type { Solid } from "../canonical";

export class ChamferBridge {
  /**
   * Converte entidades vetoriais 2D do CHAMFER para um Sketch paramétrico
   * com inferência automática de restrições geométricas fundamentais.
   */
  static entitiesToSketch(
    entities: Entity[],
    sketchName = "Sketch Principal",
  ): { sketch: Sketch2D; autoConstraints: Constraint[] } {
    const sketchId = `sk_${Date.now()}`;
    const elements: SketchElement[] = [];
    const autoConstraints: Constraint[] = [];

    let elemIdx = 0;

    for (const ent of entities || []) {
      if (!ent) continue;
      if (
        ent.type === "line" &&
        Number.isFinite(ent.x1) &&
        Number.isFinite(ent.y1) &&
        Number.isFinite(ent.x2) &&
        Number.isFinite(ent.y2)
      ) {
        const id = `line_${elemIdx++}`;
        elements.push({
          id,
          type: "LINE",
          p1: { x: ent.x1, y: ent.y1 },
          p2: { x: ent.x2, y: ent.y2 },
          isConstruction: ent.layer === "REFERÊNCIA",
        });

        // Inferência: Horizontal ou Vertical
        const dx = Math.abs(ent.x2 - ent.x1);
        const dy = Math.abs(ent.y2 - ent.y1);
        if (dy < 0.05 && dx > 0.1) {
          autoConstraints.push({
            id: `c_h_${id}`,
            type: "HORIZONTAL",
            elementIds: [id],
          });
        } else if (dx < 0.05 && dy > 0.1) {
          autoConstraints.push({
            id: `c_v_${id}`,
            type: "VERTICAL",
            elementIds: [id],
          });
        }
      } else if (
        ent.type === "circle" &&
        Number.isFinite(ent.cx) &&
        Number.isFinite(ent.cy) &&
        Number.isFinite(ent.r) &&
        ent.r > 0
      ) {
        const id = `circle_${elemIdx++}`;
        elements.push({
          id,
          type: "CIRCLE",
          p1: { x: ent.cx, y: ent.cy },
          radius: ent.r,
          isConstruction: ent.layer === "REFERÊNCIA",
        });
        autoConstraints.push({
          id: `c_rad_${id}`,
          type: "RADIUS",
          elementIds: [id],
          value: ent.r,
        });
      } else if (ent.type === "arc") {
        const id = `arc_${elemIdx++}`;
        const arcEnt = ent as unknown as {
          a0?: number;
          a1?: number;
          startAngle?: number;
          endAngle?: number;
        };
        const startRad = arcEnt.a0 ?? ((arcEnt.startAngle ?? 0) * Math.PI) / 180;
        const endRad = arcEnt.a1 ?? ((arcEnt.endAngle ?? 180) * Math.PI) / 180;
        elements.push({
          id,
          type: "ARC",
          p1: { x: ent.cx + ent.r * Math.cos(startRad), y: ent.cy + ent.r * Math.sin(startRad) },
          p2: { x: ent.cx + ent.r * Math.cos(endRad), y: ent.cy + ent.r * Math.sin(endRad) },
          center: { x: ent.cx, y: ent.cy },
          radius: ent.r,
          startAngleRad: startRad,
          endAngleRad: endRad,
          isConstruction: ent.layer === "REFERÊNCIA",
        });
      } else if (ent.type === "polyline" && ent.pts && ent.pts.length >= 2) {
        for (let i = 0; i < ent.pts.length - 1; i++) {
          const id = `poly_line_${elemIdx++}`;
          elements.push({
            id,
            type: "LINE",
            p1: { x: ent.pts[i].x, y: ent.pts[i].y },
            p2: { x: ent.pts[i + 1].x, y: ent.pts[i + 1].y },
            isConstruction: ent.layer === "REFERÊNCIA",
          });
        }
        if (ent.closed && ent.pts.length >= 3) {
          const id = `poly_line_${elemIdx++}`;
          elements.push({
            id,
            type: "LINE",
            p1: { x: ent.pts[ent.pts.length - 1].x, y: ent.pts[ent.pts.length - 1].y },
            p2: { x: ent.pts[0].x, y: ent.pts[0].y },
            isConstruction: ent.layer === "REFERÊNCIA",
          });
        }
      }
    }

    // Inferência: Restrições de Coincidência entre extremidades conectadas (< 0.1 mm)
    const lineElements = elements.filter((e) => e.type === "LINE");
    for (let i = 0; i < lineElements.length; i++) {
      for (let j = i + 1; j < lineElements.length; j++) {
        const l1 = lineElements[i];
        const l2 = lineElements[j];
        if (!l1.p2 || !l2.p2) continue;

        // l1.p2 coincide com l2.p1
        if (Math.hypot(l1.p2.x - l2.p1.x, l1.p2.y - l2.p1.y) < 0.1) {
          autoConstraints.push({
            id: `c_coin_${l1.id}_${l2.id}`,
            type: "COINCIDENT",
            elementIds: [l1.id, l2.id],
            pointIndices: [1, 0],
          });
        }
      }
    }

    const sketch: Sketch2D = {
      id: sketchId,
      name: sketchName,
      plane: "XY",
      elements,
      constraints: autoConstraints,
      isFullyConstrained: false,
    };

    return { sketch, autoConstraints };
  }

  /**
   * Converte os elementos de um Sketch paramétrico de volta para entidades vetoriais do CHAMFER.
   */
  static sketchToEntities(sketch: Sketch2D, targetLayer = "CORTE"): Entity[] {
    const entities: Entity[] = [];

    for (const elem of sketch.elements) {
      const layer = elem.isConstruction ? "REFERÊNCIA" : targetLayer;

      if (elem.type === "LINE" && elem.p2) {
        entities.push({
          id: elem.id,
          type: "line",
          x1: elem.p1.x,
          y1: elem.p1.y,
          x2: elem.p2.x,
          y2: elem.p2.y,
          layer,
        });
      } else if (elem.type === "CIRCLE" && elem.radius) {
        entities.push({
          id: elem.id,
          type: "circle",
          cx: elem.p1.x,
          cy: elem.p1.y,
          r: elem.radius,
          layer,
        });
      } else if (elem.type === "ARC" && elem.center && elem.radius) {
        const sDeg = (elem.startAngleRad ?? 0) * (180 / Math.PI);
        const eDeg = (elem.endAngleRad ?? Math.PI) * (180 / Math.PI);
        entities.push({
          id: elem.id,
          type: "arc",
          cx: elem.center.x,
          cy: elem.center.y,
          r: elem.radius,
          startAngle: sDeg,
          endAngle: eDeg,
          anticlockwise: false,
          layer,
        });
      }
    }

    return entities;
  }

  /**
   * Extrai dados de arame (wireframe) de um sólido canônico B-Rep para o visualizador 3D.
   */
  static solidToWire3D(solid: Solid): {
    points: { x: number; y: number; z: number }[];
    edgeIndices: [number, number][];
  } {
    const vMap = new Map<string, number>();
    const points: { x: number; y: number; z: number }[] = [];

    solid.vertices.forEach((v, idx) => {
      vMap.set(v.id, idx);
      points.push({ ...v.point });
    });

    const edgeIndices: [number, number][] = [];
    solid.edges.forEach((e) => {
      const i1 = vMap.get(e.startVertexId);
      const i2 = vMap.get(e.endVertexId);
      if (i1 !== undefined && i2 !== undefined) {
        edgeIndices.push([i1, i2]);
      }
    });

    return { points, edgeIndices };
  }
}
