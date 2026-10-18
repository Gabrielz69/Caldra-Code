// @ts-nocheck
/**
 * CALDRA CAD — HEM & JOG FLANGE ENGINE (FASE 12)
 *
 * Motor analítico para cálculo de desenvolvimento de chapas com:
 *  - Bainhas (Closed, Open, Teardrop, Rolled Hem)
 *  - Degraus de sobreposição / encaixe faceado (Jog / Joggle Flanges)
 */

import type { Vector2D, Vector3D, SolidBody3D, Face3D } from "../canonical";
import type { SheetMetalHemDef, SheetMetalJogDef } from "./types";
import type { SheetMetalBendLine } from "../sheetmetal/types";
import type { Entity } from "@/lib/lab2d/core";

export interface HemCalculationResult {
  hem: SheetMetalHemDef;
  /** Comprimento de chapa plana adicional consumido no blank (mm) */
  developedLengthMm: number;
  /** Dedução de dobra específica para a conformação da bainha (mm) */
  bendDeductionMm: number;
  /** Raio neutro médio na curva de retorno (mm) */
  neutralRadiusMm: number;
  /** Linhas de dobra geradas para a ferramenta de prensa dobradeira */
  bendLines: SheetMetalBendLine[];
  /** Entidades 2D no Flat Pattern (Marcação do limite e dobra) */
  flatPatternEntities: Entity[];
}

export interface JogCalculationResult {
  jog: SheetMetalJogDef;
  /** Comprimento da diagonal/rampa central do degrau (mm) */
  webLengthMm: number;
  /** Comprimento total desenvolvido consumido no blank desdobrado (mm) */
  totalDevelopedLengthMm: number;
  /** Distância plana entre as duas linhas de centro de dobra (mm) */
  bendLineSpacingMm: number;
  /** Duas linhas de centro de dobra opostas (UP e DOWN) */
  bendLines: SheetMetalBendLine[];
  /** Entidades 2D para visualização na camada de dobra */
  flatPatternEntities: Entity[];
}

export class HemEngine {
  /**
   * Calcula o desenvolvimento analítico de uma bainha industrial.
   */
  public static calculateHem(hem: SheetMetalHemDef): HemCalculationResult {
    const t = Math.max(0.1, hem.thicknessMm);
    const L = Math.max(t * 2, hem.lengthMm);
    let developedLength = 0;
    let bendDeduction = 0;
    let neutralRadius = 0;

    switch (hem.type) {
      case "CLOSED": {
        // Bainha esmagada a 180°: DIN / Air bending flattening
        // Fator de retração empírico de dobra 180° com raio zero: K_hem = 0.43 * t
        const kHem = 0.43;
        neutralRadius = 0.5 * t;
        bendDeduction = kHem * t;
        developedLength = L - bendDeduction;
        break;
      }

      case "OPEN": {
        // Bainha aberta com folga interna gap (formato em U)
        const gap = Math.max(0.5, hem.gapMm ?? t);
        const insideRadius = gap / 2;
        const kFactor = 0.45;
        neutralRadius = insideRadius + kFactor * t;
        // Arco de 180° da curva interna + trecho reto retornado
        const arcLength = Math.PI * neutralRadius;
        developedLength = L + arcLength - 2 * (insideRadius + t);
        bendDeduction = 2 * (insideRadius + t) - arcLength;
        break;
      }

      case "TEARDROP": {
        // Bainha em gota d'água (curva de alívio ~270° com raio r)
        const r = Math.max(t, hem.radiusMm ?? t * 1.2);
        const kFactor = 0.45;
        neutralRadius = r + kFactor * t;
        // Arco aproximado de 240° a 270° para fechar a gota suavemente
        const loopAngleRad = (250 * Math.PI) / 180;
        const arcLength = loopAngleRad * neutralRadius;
        developedLength = L + arcLength;
        bendDeduction = 2 * (r + t) - arcLength;
        break;
      }

      case "ROLLED": {
        // Bainha cilíndrica enrolada (Curling / Roll hem)
        const r = Math.max(t, hem.radiusMm ?? t * 1.5);
        const rollAngleDeg = Math.min(360, Math.max(180, hem.rollAngleDeg ?? 270));
        const kFactor = 0.45;
        neutralRadius = r + kFactor * t;
        const arcLength = ((rollAngleDeg * Math.PI) / 180) * neutralRadius;
        developedLength = arcLength + (L > 2 * r ? L - 2 * r : 0);
        bendDeduction = 0;
        break;
      }
    }

    const bendLines: SheetMetalBendLine[] = [
      {
        id: `bend_${hem.id}_180`,
        flangeId: hem.id,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 0 },
        angleDeg: hem.type === "ROLLED" ? (hem.rollAngleDeg ?? 270) : 180,
        insideRadius: Math.max(0.1, neutralRadius - 0.5 * t),
        direction: hem.side === "TOP" ? "UP" : "DOWN",
        kFactor: 0.45,
        bendAllowance: developedLength,
        bendDeduction,
        outsideSetback: t,
        neutralRadius,
      },
    ];

    const flatPatternEntities: Entity[] = [
      {
        id: `ent_${hem.id}_bend`,
        type: "line",
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        role: "BEND",
      },
      {
        id: `ent_${hem.id}_edge`,
        type: "line",
        p1: { x: 0, y: developedLength },
        p2: { x: 100, y: developedLength },
        role: "CUT",
      },
    ];

    return {
      hem,
      developedLengthMm: Number(developedLength.toFixed(2)),
      bendDeductionMm: Number(bendDeduction.toFixed(2)),
      neutralRadiusMm: Number(neutralRadius.toFixed(2)),
      bendLines,
      flatPatternEntities,
    };
  }

  /**
   * Calcula o desenvolvimento analítico de um degrau de chapa (Jog / Joggle Flange).
   */
  public static calculateJog(jog: SheetMetalJogDef): JogCalculationResult {
    const t = Math.max(0.1, jog.thicknessMm);
    const offset = Math.max(0.1, Math.abs(jog.offsetMm));
    const angleRad = (Math.max(15, Math.min(90, jog.angleDeg)) * Math.PI) / 180;
    const r = Math.max(0.5, jog.bendRadiusMm);
    const kFactor = 0.45;

    // Comprimento da alma inclinada entre centros
    const webLength = offset / Math.sin(angleRad);

    // Bend Allowance de cada uma das duas dobras
    const bendAllowancePerBend = angleRad * (r + kFactor * t);
    const outsideSetback = Math.tan(angleRad / 2) * (r + t);
    const bendDeductionPerBend = 2 * outsideSetback - bendAllowancePerBend;

    // Espaçamento plano entre as duas linhas de dobra
    const bendLineSpacing = Math.max(t, webLength - bendDeductionPerBend);
    const totalDevelopedLength = webLength + jog.flangeLengthMm - 2 * bendDeductionPerBend;

    const bendLines: SheetMetalBendLine[] = [
      {
        id: `jog_${jog.id}_bend1`,
        flangeId: jog.id,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 0 },
        angleDeg: jog.angleDeg,
        insideRadius: r,
        direction: "UP",
        kFactor,
        bendAllowance: bendAllowancePerBend,
        bendDeduction: bendDeductionPerBend,
        outsideSetback,
        neutralRadius: r + kFactor * t,
      },
      {
        id: `jog_${jog.id}_bend2`,
        flangeId: jog.id,
        startPoint: { x: 0, y: bendLineSpacing },
        endPoint: { x: 100, y: bendLineSpacing },
        angleDeg: jog.angleDeg,
        insideRadius: r,
        direction: "DOWN",
        kFactor,
        bendAllowance: bendAllowancePerBend,
        bendDeduction: bendDeductionPerBend,
        outsideSetback,
        neutralRadius: r + kFactor * t,
      },
    ];

    const flatPatternEntities: Entity[] = [
      {
        id: `ent_${jog.id}_b1`,
        type: "line",
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        role: "BEND",
      },
      {
        id: `ent_${jog.id}_b2`,
        type: "line",
        p1: { x: 0, y: bendLineSpacing },
        p2: { x: 100, y: bendLineSpacing },
        role: "BEND",
      },
      {
        id: `ent_${jog.id}_end`,
        type: "line",
        p1: { x: 0, y: bendLineSpacing + jog.flangeLengthMm },
        p2: { x: 100, y: bendLineSpacing + jog.flangeLengthMm },
        role: "CUT",
      },
    ];

    return {
      jog,
      webLengthMm: Number(webLength.toFixed(2)),
      totalDevelopedLengthMm: Number(totalDevelopedLength.toFixed(2)),
      bendLineSpacingMm: Number(bendLineSpacing.toFixed(2)),
      bendLines,
      flatPatternEntities,
    };
  }
}
