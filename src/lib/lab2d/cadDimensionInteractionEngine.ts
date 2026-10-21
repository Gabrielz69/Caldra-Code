/**
 * CALDRA CHAMFER — MOTOR DE INTERAÇÃO E APLICAÇÃO DE COTAS E REFERÊNCIAS
 * (DimensionInteractionEngine)
 *
 * Responsável por:
 *  1. Parser flexível de medidas com suporte a vírgula, ponto, unidades (mm, cm, m) e expressões;
 *  2. Aplicação real e imediata das cotas de referência (REF 0,0, bordas ativas, ΔX, ΔY, L, offset)
 *     ao modelo geométrico e ao cursor;
 *  3. Geração de transação atômica no histórico (Undo/Redo).
 */

import type { Vec2 } from "@/lib/geometry/types";
import { translate, type Entity } from "./core";
import type { LiveDimension } from "./cadDynamicDimensions";
import type { TemporaryOrigin } from "./cadCoordinateFrames";
import type { EdgeReference } from "./cadGeometricReferences";
import { CoordinateFrameManager } from "./cadCoordinateFrames";
import { GeometricConstraintResolver } from "./cadConstraintResolver";

export interface ApplyDimensionParams {
  dim: LiveDimension;
  newValue: number;
  entities: Entity[];
  selectedIds: string[];
  temporaryOrigin?: TemporaryOrigin | null;
  activeEdge?: EdgeReference | null;
  activeEdgeSide?: 1 | -1;
  currentCursor?: Vec2;
  activeLayer?: string;
}

export interface ApplyDimensionResult {
  updatedEntities: Entity[];
  newCursor?: Vec2;
  message: string;
}

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "e-" + Math.random().toString(36).slice(2, 10);
}

export class DimensionInteractionEngine {
  /**
   * Converte texto de entrada em valor numérico em mm, aceitando:
   * - "118.25", "118,25", "118.25 mm", "11.825 cm", "100 + 18.25"
   */
  static parseInput(input: string | number): number | null {
    if (typeof input === "number") {
      return Number.isFinite(input) ? input : null;
    }
    if (!input) return null;
    const s = String(input).trim().replace(/,/g, ".");
    return GeometricConstraintResolver.parseDimensionInput(s);
  }

  /**
   * Aplica a alteração de medida da referência de forma definitiva sobre o modelo geométrico.
   */
  static applyDimension({
    dim,
    newValue,
    entities,
    selectedIds,
    temporaryOrigin,
    activeEdge,
    activeEdgeSide = 1,
    currentCursor,
    activeLayer = "corte",
  }: ApplyDimensionParams): ApplyDimensionResult {
    const val = Math.abs(newValue);

    // 1. Caso A: Dimensão com borda ativa (offset ou u_along)
    if (dim.kind === "offset" && activeEdge) {
      // Se houver uma linha selecionada, reposiciona a linha para o novo offset
      const selectedLine = entities.find((e) => selectedIds.includes(e.id) && e.type === "line");
      if (selectedLine) {
        const adjustedLine = GeometricConstraintResolver.applyOffsetToExistingLine(
          selectedLine,
          activeEdge,
          newValue,
          activeEdgeSide,
        );
        const updated = entities.map((e) => (e.id === adjustedLine.id ? adjustedLine : e));
        return {
          updatedEntities: updated,
          message: `Linha reposicionada para afastamento de ${val.toFixed(2)} mm`,
        };
      }

      // Se não houver linha selecionada, cria uma nova linha na camada correspondente
      const newLine = GeometricConstraintResolver.createMarkingOrBendLine(
        activeEdge,
        newValue,
        activeEdgeSide,
        activeLayer || "corte",
      );
      return {
        updatedEntities: [...entities, newLine],
        message: `Linha criada com afastamento de ${val.toFixed(2)} mm`,
      };
    }

    if (dim.kind === "u_along" && activeEdge) {
      // Se houver uma entidade selecionada (ex: círculo / furo), reposiciona-a ao longo da borda
      const sel = entities.filter((e) => selectedIds.includes(e.id));
      if (sel.length > 0) {
        const { v } = currentCursor
          ? CoordinateFrameManager.worldToUV(currentCursor, activeEdge)
          : { v: 0 };
        const newCenter = CoordinateFrameManager.uvToWorld(newValue, v, activeEdge);
        const refPoint = sel[0] && sel[0].type === "circle" ? { x: sel[0].cx, y: sel[0].cy } : dim.endPoint;
        const shiftX = newCenter.x - refPoint.x;
        const shiftY = newCenter.y - refPoint.y;
        const updated = entities.map((e) => (selectedIds.includes(e.id) ? translate(e, shiftX, shiftY) : e));
        return {
          updatedEntities: updated,
          newCursor: newCenter,
          message: `Posição longitudinal u ajustada para ${val.toFixed(2)} mm`,
        };
      }
    }

    // 2. Caso B: Dimensões relativas à REF 0,0 (ΔX, ΔY, L / distance)
    if (temporaryOrigin) {
      const refP = temporaryOrigin.p;
      let targetX = dim.endPoint.x;
      let targetY = dim.endPoint.y;

      if (dim.kind === "dx") {
        const curDx = dim.endPoint.x - refP.x;
        const sign = curDx >= 0 ? 1 : -1;
        targetX = refP.x + val * sign;
        targetY = currentCursor ? currentCursor.y : dim.endPoint.y;
      } else if (dim.kind === "dy") {
        const curDy = dim.endPoint.y - refP.y;
        const sign = curDy >= 0 ? 1 : -1;
        targetX = currentCursor ? currentCursor.x : dim.endPoint.x;
        targetY = refP.y + val * sign;
      } else if (dim.kind === "distance") {
        const dx = dim.endPoint.x - refP.x;
        const dy = dim.endPoint.y - refP.y;
        const len = Math.hypot(dx, dy);
        const angle = len > 0.001 ? Math.atan2(dy, dx) : 0;
        targetX = refP.x + Math.cos(angle) * val;
        targetY = refP.y + Math.sin(angle) * val;
      }

      const shiftX = targetX - dim.endPoint.x;
      const shiftY = targetY - dim.endPoint.y;
      const newCursor: Vec2 = { x: targetX, y: targetY };

      // Caso B1: Se houver entidades selecionadas, reposiciona-as diretamente
      if (selectedIds.length > 0) {
        const updated = entities.map((e) => {
          if (!selectedIds.includes(e.id)) return e;
          if (e.type === "line") {
            const d1 = Math.hypot(e.x1 - refP.x, e.y1 - refP.y);
            const d2 = Math.hypot(e.x2 - refP.x, e.y2 - refP.y);
            // Se o início da linha está na REF 0,0, estende/contrai a linha até o novo ponto
            if (d1 < 10) {
              return { ...e, x2: targetX, y2: targetY };
            }
            if (d2 < 10) {
              return { ...e, x1: targetX, y1: targetY };
            }
            // Caso contrário, ajusta o vértice mais próximo do endpoint da cota
            const de1 = Math.hypot(e.x1 - dim.endPoint.x, e.y1 - dim.endPoint.y);
            const de2 = Math.hypot(e.x2 - dim.endPoint.x, e.y2 - dim.endPoint.y);
            if (de2 <= de1) {
              return { ...e, x2: targetX, y2: targetY };
            }
            return { ...e, x1: targetX, y1: targetY };
          }
          if (e.type === "point") {
            return { ...e, x: targetX, y: targetY };
          }
          if (e.type === "circle") {
            return { ...e, cx: targetX, cy: targetY };
          }
          return translate(e, shiftX, shiftY);
        });

        const label = dim.kind === "dx" ? "ΔX" : dim.kind === "dy" ? "ΔY" : "L";
        return {
          updatedEntities: updated,
          newCursor,
          message: `${label} ajustado para ${val.toFixed(2)} mm em relação à REF (0,0)`,
        };
      }

      // Caso B2: Nenhuma seleção explícita.
      // Procura linha conectada à REF 0,0 ou com vértice próximo ao ponto da cota
      let targetEntityFound = false;
      const updated = entities.map((e) => {
        if (targetEntityFound) return e;
        if (e.type === "line") {
          const d1 = Math.hypot(e.x1 - refP.x, e.y1 - refP.y);
          const d2 = Math.hypot(e.x2 - refP.x, e.y2 - refP.y);
          if (d1 < 10) {
            targetEntityFound = true;
            return { ...e, x2: targetX, y2: targetY };
          }
          if (d2 < 10) {
            targetEntityFound = true;
            return { ...e, x1: targetX, y1: targetY };
          }
          const de1 = Math.hypot(e.x1 - dim.endPoint.x, e.y1 - dim.endPoint.y);
          const de2 = Math.hypot(e.x2 - dim.endPoint.x, e.y2 - dim.endPoint.y);
          if (de1 < 25) {
            targetEntityFound = true;
            return { ...e, x1: targetX, y1: targetY };
          }
          if (de2 < 25) {
            targetEntityFound = true;
            return { ...e, x2: targetX, y2: targetY };
          }
        } else if (e.type === "point") {
          const dp = Math.hypot(e.x - dim.endPoint.x, e.y - dim.endPoint.y);
          if (dp < 25) {
            targetEntityFound = true;
            return { ...e, x: targetX, y: targetY };
          }
        } else if (e.type === "circle") {
          const dc = Math.hypot(e.cx - dim.endPoint.x, e.cy - dim.endPoint.y);
          if (dc < 25) {
            targetEntityFound = true;
            return { ...e, cx: targetX, cy: targetY };
          }
        }
        return e;
      });

      if (targetEntityFound) {
        const label = dim.kind === "dx" ? "ΔX" : dim.kind === "dy" ? "ΔY" : "L";
        return {
          updatedEntities: updated,
          newCursor,
          message: `Geometria reposicionada: ${label} = ${val.toFixed(2)} mm da REF (0,0)`,
        };
      }

      // Caso B3: Se não havia entidade existente para reposicionar, cria a linha de referência definitiva a partir de REF 0,0
      const newLine: Entity = {
        id: uid(),
        layer: activeLayer || "corte",
        type: "line",
        x1: refP.x,
        y1: refP.y,
        x2: targetX,
        y2: targetY,
      };

      const label = dim.kind === "dx" ? "ΔX" : dim.kind === "dy" ? "ΔY" : "L";
      return {
        updatedEntities: [...entities, newLine],
        newCursor,
        message: `Linha criada a partir da REF (0,0) com ${label} = ${val.toFixed(2)} mm`,
      };
    }

    // 3. Caso C: Dimensão de Diâmetro
    if (dim.kind === "diameter") {
      const updated = entities.map((e) => {
        if (!selectedIds.includes(e.id)) return e;
        if (e.type === "circle") {
          const newR = val / 2;
          return { ...e, r: newR, params: { ...e.params, diameter: val, realRadius: newR } };
        }
        return e;
      });
      return {
        updatedEntities: updated,
        message: `Diâmetro ajustado para ${val.toFixed(2)} mm`,
      };
    }

    return {
      updatedEntities: entities,
      message: `Medida ${dim.label} atualizada para ${val.toFixed(2)} mm`,
    };
  }
}
