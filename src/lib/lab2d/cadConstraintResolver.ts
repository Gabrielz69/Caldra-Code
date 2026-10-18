/**
 * CALDRA CHAMFER — RESOLVEDOR DE RESTRIÇÕES GEOMÉTRICAS (GeometricConstraintResolver)
 *
 * Aplica regras matemáticas exatas para geração e reposicionamento de geometrias:
 *  - Criação de linhas paralelas de corte, marcação (MAR) e dobra (DOBRA) por afastamento (offset);
 *  - Posicionamento de furos e círculos por coordenadas relativas a cantos ou bordas (u, v / Δx, Δy);
 *  - Parser flexível de medidas com suporte a vírgula, ponto, unidades ("40,5", "40.5 mm", "50+10");
 *  - Aplicação atômica preservando a integridade das entidades CAD.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { uid, type Entity, type LayerId } from "./core";
import type { EdgeReference } from "./cadGeometricReferences";
import { CoordinateFrameManager } from "./cadCoordinateFrames";

export class GeometricConstraintResolver {
  /**
   * Parser robusto para entrada de medidas CAD em teclados numéricos e prompts:
   * Aceita:
   *  - "40"       -> 40
   *  - "40.5"     -> 40.5
   *  - "40,5"     -> 40.5
   *  - "40,5 mm"  -> 40.5
   *  - "4 cm"     -> 40 (converte cm para mm)
   *  - "100/2"    -> 50
   *  - "45 + 15"  -> 60
   */
  static parseDimensionInput(input: string): number | null {
    if (!input) return null;
    let s = input.trim().toLowerCase();

    // Detecção de unidade cm
    let cmMultiplier = 1;
    if (s.endsWith("cm")) {
      cmMultiplier = 10;
      s = s.slice(0, -2).trim();
    } else if (s.endsWith("mm")) {
      s = s.slice(0, -2).trim();
    } else if (s.endsWith("m")) {
      cmMultiplier = 1000;
      s = s.slice(0, -1).trim();
    }

    // Normaliza vírgula para ponto decimal
    s = s.replace(/,/g, ".");

    // Remove caracteres não matemáticos
    s = s.replace(/[^0-9.\-+/*()]/g, "");
    if (!s) return null;

    try {
      // Avaliação de expressões aritméticas simples
      const result = Function(`"use strict"; return (${s})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return result * cmMultiplier;
      }
    } catch {
      const fallback = parseFloat(s);
      if (!isNaN(fallback) && isFinite(fallback)) {
        return fallback * cmMultiplier;
      }
    }

    return null;
  }

  /**
   * Cria uma linha paralela a uma borda de referência com afastamento exato.
   * side: 1 (na direção da normal) ou -1 (na direção oposta à normal)
   */
  static createOffsetLine(
    edge: EdgeReference,
    offsetDistance: number,
    side: 1 | -1 = 1,
    layer: LayerId = "corte",
    options?: {
      extendStart?: number;
      extendEnd?: number;
      customLength?: number;
    },
  ): Entity {
    const normalOffset: Vec2 = {
      x: edge.normal.x * offsetDistance * side,
      y: edge.normal.y * offsetDistance * side,
    };

    let p1: Vec2 = {
      x: edge.p1.x + normalOffset.x,
      y: edge.p1.y + normalOffset.y,
    };

    let p2: Vec2 = {
      x: edge.p2.x + normalOffset.x,
      y: edge.p2.y + normalOffset.y,
    };

    if (options?.extendStart) {
      p1 = {
        x: p1.x - edge.dir.x * options.extendStart,
        y: p1.y - edge.dir.y * options.extendStart,
      };
    }

    if (options?.extendEnd) {
      p2 = {
        x: p2.x + edge.dir.x * options.extendEnd,
        y: p2.y + edge.dir.y * options.extendEnd,
      };
    } else if (options?.customLength) {
      p2 = {
        x: p1.x + edge.dir.x * options.customLength,
        y: p1.y + edge.dir.y * options.customLength,
      };
    }

    return {
      id: uid(),
      type: "line",
      layer,
      x1: parseFloat(p1.x.toFixed(3)),
      y1: parseFloat(p1.y.toFixed(3)),
      x2: parseFloat(p2.x.toFixed(3)),
      y2: parseFloat(p2.y.toFixed(3)),
      params: {
        role: layer === "marcacao" ? "MARKING" : layer === "dobra" ? "BEND_LINE" : "CUT",
        sourceEdgeId: edge.id,
        offsetDistance,
        offsetSide: side,
        realLength: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      },
    };
  }

  /**
   * Cria especificamente linha de marcação ou dobra de caldeiraria por afastamento de borda.
   */
  static createMarkingOrBendLine(
    edge: EdgeReference,
    offsetDistance: number,
    side: 1 | -1 = 1,
    mode: "marcacao" | "dobra" = "marcacao",
    bendAngleDeg = 90,
  ): Entity {
    const layer: LayerId = mode === "dobra" ? "dobra" : "marcacao";
    const ent = this.createOffsetLine(edge, offsetDistance, side, layer);
    if (mode === "dobra") {
      ent.params = {
        ...ent.params,
        role: "BEND_LINE",
        bendAngle: bendAngleDeg,
        bendDirection: "UP",
        kFactor: 0.42,
      };
    }
    return ent;
  }

  /**
   * Posiciona um furo (círculo) por coordenadas relativas (u, v) alinhadas a uma borda.
   */
  static positionHoleAtEdgeUV(
    edge: EdgeReference,
    u: number,
    v: number,
    diameterMm: number,
    layer: LayerId = "corte",
  ): Entity {
    const center = CoordinateFrameManager.uvToWorld(u, v, edge);
    const radius = Math.max(0.1, diameterMm / 2);

    return {
      id: uid(),
      type: "circle",
      layer,
      cx: parseFloat(center.x.toFixed(3)),
      cy: parseFloat(center.y.toFixed(3)),
      r: parseFloat(radius.toFixed(3)),
      params: {
        role: "HOLE",
        diameter: diameterMm,
        referenceEdgeId: edge.id,
        uOffset: u,
        vOffset: v,
      },
    };
  }

  /**
   * Posiciona um furo (círculo) por coordenadas relativas a um canto de referência (dx, dy).
   */
  static positionHoleAtCorner(
    corner: Vec2,
    dx: number,
    dy: number,
    diameterMm: number,
    layer: LayerId = "corte",
  ): Entity {
    const center: Vec2 = {
      x: corner.x + dx,
      y: corner.y + dy,
    };
    const radius = Math.max(0.1, diameterMm / 2);

    return {
      id: uid(),
      type: "circle",
      layer,
      cx: parseFloat(center.x.toFixed(3)),
      cy: parseFloat(center.y.toFixed(3)),
      r: parseFloat(radius.toFixed(3)),
      params: {
        role: "HOLE",
        diameter: diameterMm,
        cornerRef: { x: corner.x, y: corner.y },
        dx,
        dy,
      },
    };
  }

  /**
   * Ajusta a posição de uma linha existente para que seu afastamento da borda de referência
   * se iguale exatamente a newOffset.
   */
  static applyOffsetToExistingLine(
    line: Entity,
    referenceEdge: EdgeReference,
    targetOffset: number,
    side: 1 | -1 = 1,
  ): Entity {
    if (line.type !== "line") return line;

    // Calcula o deslocamento atual
    const midLine: Vec2 = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
    const dx = midLine.x - referenceEdge.p1.x;
    const dy = midLine.y - referenceEdge.p1.y;
    const currentV = dx * referenceEdge.normal.x + dy * referenceEdge.normal.y;

    const targetV = targetOffset * side;
    const deltaV = targetV - currentV;

    const shiftX = referenceEdge.normal.x * deltaV;
    const shiftY = referenceEdge.normal.y * deltaV;

    return {
      ...line,
      x1: parseFloat((line.x1 + shiftX).toFixed(3)),
      y1: parseFloat((line.y1 + shiftY).toFixed(3)),
      x2: parseFloat((line.x2 + shiftX).toFixed(3)),
      y2: parseFloat((line.y2 + shiftY).toFixed(3)),
    };
  }
}
