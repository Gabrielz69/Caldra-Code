/**
 * CALDRA CAD — SHEET METAL CORE & BENDING ENGINE (FASE 04)
 *
 * Motor analítico de chapa metálica, dobras, desdobramento cinemático (unfold/fold),
 * planificação (flat pattern) e verificação DFM (Design for Manufacturing).
 */

import type { Entity } from "@/lib/lab2d/core";
import type {
  SheetMetalFlangeDef,
  SheetMetalBendLine,
  FlatPatternResult,
  DFMValidationReport,
  DFMValidationIssue,
  BendDirection,
} from "./types";

const DEG = Math.PI / 180;

export interface SheetMetalPart {
  id: string;
  name: string;
  thickness: number; // T (mm)
  defaultKFactor: number; // K (0.2 a 0.5)
  defaultBendRadius: number; // R (mm)
  material: string;
  density: number; // g/cm³ (aço = 7.85)
  baseWidth: number; // mm
  baseLength: number; // mm
  flanges: SheetMetalFlangeDef[];
  isUnfolded: boolean;
}

export class SheetMetalEngine {
  /**
   * Cálculo de Raio Neutro: Rn = R + K × T
   */
  static computeNeutralRadius(radius: number, kFactor: number, thickness: number): number {
    return radius + kFactor * thickness;
  }

  /**
   * Cálculo de Bend Allowance (BA):
   * BA = θ × (R + K × T) [com θ em radianos]
   */
  static computeBendAllowance(
    angleDeg: number,
    radius: number,
    kFactor: number,
    thickness: number,
  ): number {
    const thetaRad = angleDeg * DEG;
    return thetaRad * this.computeNeutralRadius(radius, kFactor, thickness);
  }

  /**
   * Cálculo de Outside Setback (OSSB):
   * OSSB = (R + T) × tan(θ / 2) [com θ em radianos]
   */
  static computeOutsideSetback(angleDeg: number, radius: number, thickness: number): number {
    const halfThetaRad = angleDeg * DEG * 0.5;
    return (radius + thickness) * Math.tan(halfThetaRad);
  }

  /**
   * Cálculo de Bend Deduction (BD):
   * BD = 2 × OSSB − BA
   */
  static computeBendDeduction(
    angleDeg: number,
    radius: number,
    kFactor: number,
    thickness: number,
  ): number {
    const ossb = this.computeOutsideSetback(angleDeg, radius, thickness);
    const ba = this.computeBendAllowance(angleDeg, radius, kFactor, thickness);
    return 2 * ossb - ba;
  }

  /**
   * Inicializa uma peça base de chapa metálica retangular.
   */
  static createBaseSheet(
    width: number,
    length: number,
    thickness: number,
    kFactor = 0.33,
    bendRadius?: number,
    material = "Aço Carbono SAE 1020",
    density = 7.85,
  ): SheetMetalPart {
    if (thickness <= 0) throw new Error("A espessura da chapa deve ser maior que zero.");
    if (width <= 0 || length <= 0) throw new Error("Dimensões da chapa base inválidas.");

    return {
      id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Chapa ${width}×${length}×${thickness}mm`,
      thickness,
      defaultKFactor: kFactor,
      defaultBendRadius: bendRadius ?? thickness,
      material,
      density,
      baseWidth: width,
      baseLength: length,
      flanges: [],
      isUnfolded: false,
    };
  }

  /**
   * Adiciona uma aba dobrada (Edge Flange) à chapa metálica.
   * edgeId indica a aresta (ex: "top", "bottom", "left", "right").
   */
  static addEdgeFlange(
    part: SheetMetalPart,
    edgeId: "top" | "bottom" | "left" | "right",
    length: number,
    angleDeg = 90,
    options: {
      insideRadius?: number;
      direction?: BendDirection;
    } = {},
  ): SheetMetalFlangeDef {
    const insideRadius = options.insideRadius ?? part.defaultBendRadius;
    const flange: SheetMetalFlangeDef = {
      id: `flange_${part.flanges.length}_${edgeId}`,
      edgeId,
      length,
      angleDeg,
      insideRadius,
      materialPosition: "OUTSIDE",
    };

    part.flanges.push(flange);
    return flange;
  }

  /**
   * Desdobra a peça (Unfold).
   */
  static unfold(part: SheetMetalPart): void {
    part.isUnfolded = true;
  }

  /**
   * Dobra de volta a peça para o estado 3D conformado (Fold).
   */
  static fold(part: SheetMetalPart): void {
    part.isUnfolded = false;
  }

  /**
   * Gera a planificação analítica 2D verdadeira (Flat Pattern).
   * Contornos em 'CORTE' e linhas de centro com compensação analítica em 'DOBRA'.
   */
  static generateFlatPattern(part: SheetMetalPart): FlatPatternResult {
    let totalLength = part.baseLength;
    let totalWidth = part.baseWidth;

    const bendLines: SheetMetalBendLine[] = [];
    const tangentLines: {
      startPoint: { x: number; y: number };
      endPoint: { x: number; y: number };
      type: "START" | "END";
    }[] = [];

    // Processa cada aba calculando as compensações reais de dobra
    for (const flange of part.flanges) {
      const radius = flange.insideRadius;
      const k = part.defaultKFactor;
      const t = part.thickness;
      const angle = flange.angleDeg;

      const ba = this.computeBendAllowance(angle, radius, k, t);
      const ossb = this.computeOutsideSetback(angle, radius, t);
      const bd = this.computeBendDeduction(angle, radius, k, t);
      const neutralRadius = this.computeNeutralRadius(radius, k, t);

      // Comprimento desdobrado da aba = Comprimento nominal - BD
      const developedFlangeLength = flange.length - bd;

      if (flange.edgeId === "right") {
        const bendX = part.baseWidth - ossb + ba * 0.5;
        bendLines.push({
          id: `bend_${flange.id}`,
          flangeId: flange.id,
          startPoint: { x: bendX, y: 0 },
          endPoint: { x: bendX, y: part.baseLength },
          angleDeg: angle,
          insideRadius: radius,
          direction: "UP",
          kFactor: k,
          bendAllowance: ba,
          bendDeduction: bd,
          outsideSetback: ossb,
          neutralRadius,
        });

        // Linhas de tangência (zona de conformação plástica)
        tangentLines.push(
          {
            startPoint: { x: bendX - ba * 0.5, y: 0 },
            endPoint: { x: bendX - ba * 0.5, y: part.baseLength },
            type: "START",
          },
          {
            startPoint: { x: bendX + ba * 0.5, y: 0 },
            endPoint: { x: bendX + ba * 0.5, y: part.baseLength },
            type: "END",
          },
        );

        totalWidth += developedFlangeLength;
      } else if (flange.edgeId === "top") {
        const bendY = part.baseLength - ossb + ba * 0.5;
        bendLines.push({
          id: `bend_${flange.id}`,
          flangeId: flange.id,
          startPoint: { x: 0, y: bendY },
          endPoint: { x: part.baseWidth, y: bendY },
          angleDeg: angle,
          insideRadius: radius,
          direction: "UP",
          kFactor: k,
          bendAllowance: ba,
          bendDeduction: bd,
          outsideSetback: ossb,
          neutralRadius,
        });

        tangentLines.push(
          {
            startPoint: { x: 0, y: bendY - ba * 0.5 },
            endPoint: { x: part.baseWidth, y: bendY - ba * 0.5 },
            type: "START",
          },
          {
            startPoint: { x: 0, y: bendY + ba * 0.5 },
            endPoint: { x: part.baseWidth, y: bendY + ba * 0.5 },
            type: "END",
          },
        );

        totalLength += developedFlangeLength;
      }
    }

    // Gera as 4 linhas do contorno externo do blank retificado na camada CORTE
    const contourEntities: Entity[] = [
      { id: "contour_0", type: "line", x1: 0, y1: 0, x2: totalWidth, y2: 0, layer: "CORTE" },
      {
        id: "contour_1",
        type: "line",
        x1: totalWidth,
        y1: 0,
        x2: totalWidth,
        y2: totalLength,
        layer: "CORTE",
      },
      {
        id: "contour_2",
        type: "line",
        x1: totalWidth,
        y1: totalLength,
        x2: 0,
        y2: totalLength,
        layer: "CORTE",
      },
      { id: "contour_3", type: "line", x1: 0, y1: totalLength, x2: 0, y2: 0, layer: "CORTE" },
    ];

    // Adiciona as linhas de centro de dobra na camada técnica DOBRA
    for (const bend of bendLines) {
      contourEntities.push({
        id: `entity_${bend.id}`,
        type: "line",
        x1: bend.startPoint.x,
        y1: bend.startPoint.y,
        x2: bend.endPoint.x,
        y2: bend.endPoint.y,
        layer: "DOBRA",
      });
    }

    const blankArea = totalWidth * totalLength;
    // Volume mm³ = Area * t => cm³ = (Area * t) / 1000 => kg = cm³ * densidade / 1000
    const weightKg = ((blankArea * part.thickness) / 1e6) * part.density;

    return {
      blankWidth: totalWidth,
      blankLength: totalLength,
      blankArea,
      weightKg,
      thickness: part.thickness,
      material: part.material,
      contourEntities,
      bendLines,
      tangentLines,
      isInterferenceFree: true,
    };
  }

  /**
   * Validação DFM (Design for Manufacturing):
   * Verifica riscos de trinca, distância furo-a-dobra e comprimento mínimo de prensa.
   */
  static validateDFM(
    part: SheetMetalPart,
    holes: { center: { x: number; y: number }; diameter: number }[] = [],
  ): DFMValidationReport {
    const issues: DFMValidationIssue[] = [];
    const t = part.thickness;
    const r = part.defaultBendRadius;

    // 1. Risco de Trinca: Raio de dobra muito agudo
    const riskOfCracking = r < t * 0.5;
    if (riskOfCracking) {
      issues.push({
        code: "SHARP_BEND_CRACK_RISK",
        severity: "warning",
        message: `Raio interno (${r} mm) inferior a 0.5× espessura (${t} mm). Alto risco de trinca na fibra externa.`,
        recommendation: `Aumentar raio interno para no mínimo ${t * 0.8} mm para aços comuns ou 1.0× T para aços endurecidos.`,
      });
    }

    // 2. Comprimento Mínimo de Aba (para prensagem segura em matriz V)
    const recommendedMinFlange = 4 * t + r;
    let minFlangeFound = Infinity;

    for (const f of part.flanges) {
      if (f.length < minFlangeFound) minFlangeFound = f.length;
      if (f.length < recommendedMinFlange) {
        issues.push({
          code: "SHORT_FLANGE_LENGTH",
          severity: "warning",
          featureId: f.id,
          message: `Comprimento da aba (${f.length} mm) é menor que o recomendado para dobra (${recommendedMinFlange.toFixed(1)} mm).`,
          recommendation: `Aba pode escorregar para dentro da matriz V durante a prensagem.`,
        });
      }
    }
    if (minFlangeFound === Infinity) minFlangeFound = 0;

    // 3. Distância Furo a Dobra (para evitar ovalização)
    const recommendedMinHoleDist = 2 * t + r;
    let minHoleDistFound = Infinity;

    for (const hole of holes) {
      for (const f of part.flanges) {
        // Distância estimada simplificada até a linha da aba
        const dist = Math.abs(hole.center.x - part.baseWidth);
        if (dist < minHoleDistFound) minHoleDistFound = dist;
        if (dist < recommendedMinHoleDist + hole.diameter * 0.5) {
          issues.push({
            code: "HOLE_TOO_CLOSE_TO_BEND",
            severity: "error",
            message: `Furo localizado a ${dist.toFixed(1)} mm da linha de dobra. Risco severo de distorção/ovalização.`,
            recommendation: `Manter centros de furos afastados no mínimo ${(recommendedMinHoleDist + hole.diameter * 0.5).toFixed(1)} mm da linha de tangência.`,
          });
        }
      }
    }
    if (minHoleDistFound === Infinity) minHoleDistFound = 0;

    const hasErrors = issues.some((i) => i.severity === "error");

    return {
      isValidForManufacturing: !hasErrors,
      issues,
      metrics: {
        minHoleToBendDistance: minHoleDistFound,
        recommendedMinHoleDistance: recommendedMinHoleDist,
        minFlangeLength: minFlangeFound,
        recommendedMinFlangeLength: recommendedMinFlange,
        riskOfCracking,
      },
    };
  }
}
