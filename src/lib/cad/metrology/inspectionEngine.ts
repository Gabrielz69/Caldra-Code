/**
 * CALDRA CAD — INSPECTION & METROLOGY ENGINE (FASE 14)
 *
 * Motor analítico de inspeção dimensional e metrologia industrial:
 * - Extrai automaticamente pontos de controle críticos a partir do modelo paramétrico;
 * - Numera balões sequenciais (#1, #2, #3...) para mapa de inspeção FAI / PPAP;
 * - Associa tolerâncias automáticas ISO 2768-1/2 e instrumentos adequados;
 * - Gera quadros de controle GD&T para elementos de precisão;
 * - Avalia desvios de medição e calcula índices estatísticos de capabilidade (Cp / Cpk).
 */

import type { PartDocument } from "../kernel/types";
import type {
  FirstArticleInspectionReport,
  GdtFeatureControlFrame,
  InspectionPoint,
  InspectionPointType,
  ProcessCapabilityIndices,
  ToleranceClass,
} from "./types";
import { getLinearTolerance, getAngularTolerance, getGeneralPerpendicularityTolerance } from "./iso2768";
import { GdtEngine } from "./gdtEngine";

export interface MetrologyOptions {
  toleranceClass?: ToleranceClass;
  inspectorName?: string;
  generateGdt?: boolean;
}

export class InspectionEngine {
  /**
   * Extrai e gera o Plano de Inspeção Dimensional completo a partir do PartDocument.
   */
  static generateInspectionPlan(
    doc: PartDocument,
    options: MetrologyOptions = {},
  ): FirstArticleInspectionReport {
    const tolClass = options.toleranceClass || "ISO_2768_M";
    const inspector = options.inspectorName || "Engenharia da Qualidade CALDRA";
    const generateGdt = options.generateGdt !== false;

    const points: InspectionPoint[] = [];
    const gdtFrames: GdtFeatureControlFrame[] = [];
    let balloonCounter = 1;

    // 1. ESPESSURA DA CHAPA
    const tNom = doc.thickness || 2.0;
    const tTol = getLinearTolerance(tNom, tolClass);
    points.push({
      id: `INSP_THICKNESS_${balloonCounter}`,
      balloonNumber: balloonCounter++,
      type: "SHEET_THICKNESS",
      label: "Espessura Nominal da Chapa",
      nominal: tNom,
      upperTol: tTol.upper,
      lowerTol: tTol.lower,
      status: "PENDING",
      instrument: "MICROMETER",
      coordinates: { x: 0, y: 0, z: 0 },
      notes: "Verificar com micrômetro em pelo menos 3 pontos da borda.",
    });

    // 2. DIMENSÕES GERAIS DO BLANK / PEÇA
    const widthNom = doc.baseWidth || 200;
    const lengthNom = doc.baseLength || 200;

    const wTol = getLinearTolerance(widthNom, tolClass);
    points.push({
      id: `INSP_OVERALL_WIDTH_${balloonCounter}`,
      balloonNumber: balloonCounter++,
      type: "OVERALL_WIDTH",
      label: "Largura Total do Blank (X)",
      nominal: widthNom,
      upperTol: wTol.upper,
      lowerTol: wTol.lower,
      status: "PENDING",
      instrument: "CALIPER",
      coordinates: { x: widthNom / 2, y: 0, z: 0 },
      notes: "Cota de referência global do blank cortado.",
    });

    const lTol = getLinearTolerance(lengthNom, tolClass);
    points.push({
      id: `INSP_OVERALL_LENGTH_${balloonCounter}`,
      balloonNumber: balloonCounter++,
      type: "OVERALL_LENGTH",
      label: "Comprimento Total do Blank (Y)",
      nominal: lengthNom,
      upperTol: lTol.upper,
      lowerTol: lTol.lower,
      status: "PENDING",
      instrument: "CALIPER",
      coordinates: { x: 0, y: lengthNom / 2, z: 0 },
      notes: "Cota de esquadro global do blank cortado.",
    });

    // 3. FUROS E RECORTES INTERNOS
    const innerLoops = doc.sheetMetal?.flatPattern?.innerLoops || [];
    innerLoops.forEach((loop: any, idx: number) => {
      const holeDia = loop.diameter || (loop.radius ? loop.radius * 2 : 10);
      const diaTol = getLinearTolerance(holeDia, "ISO_2768_F"); // Furos com tolerância fina

      // Cota de diâmetro do furo
      points.push({
        id: `INSP_HOLE_DIA_${idx + 1}`,
        balloonNumber: balloonCounter++,
        type: "HOLE_DIAMETER",
        label: `Diâmetro Furo #${idx + 1} (Ø${holeDia}mm)`,
        featureRefId: loop.id || `HOLE_${idx + 1}`,
        nominal: holeDia,
        upperTol: diaTol.upper,
        lowerTol: diaTol.lower,
        status: "PENDING",
        instrument: holeDia <= 25 ? "CALIPER" : "CMM_PROBE",
        coordinates: { x: loop.cx || 0, y: loop.cy || 0, z: 0 },
      });

      // Cota de posição X a partir do Datum A
      const posX = loop.cx || 0;
      const xTol = getLinearTolerance(posX, tolClass);
      points.push({
        id: `INSP_HOLE_POS_X_${idx + 1}`,
        balloonNumber: balloonCounter++,
        type: "HOLE_POSITION_X",
        label: `Posição X Furo #${idx + 1} (ref. Datum B)`,
        featureRefId: loop.id || `HOLE_${idx + 1}`,
        nominal: posX,
        upperTol: xTol.upper,
        lowerTol: xTol.lower,
        status: "PENDING",
        instrument: "CALIPER",
        coordinates: { x: posX, y: loop.cy || 0, z: 0 },
      });

      // Cota de posição Y a partir do Datum B
      const posY = loop.cy || 0;
      const yTol = getLinearTolerance(posY, tolClass);
      points.push({
        id: `INSP_HOLE_POS_Y_${idx + 1}`,
        balloonNumber: balloonCounter++,
        type: "HOLE_POSITION_Y",
        label: `Posição Y Furo #${idx + 1} (ref. Datum A)`,
        featureRefId: loop.id || `HOLE_${idx + 1}`,
        nominal: posY,
        upperTol: yTol.upper,
        lowerTol: yTol.lower,
        status: "PENDING",
        instrument: "CALIPER",
        coordinates: { x: loop.cx || 0, y: posY, z: 0 },
      });

      // Se GD&T ativado, gera o Feature Control Frame de Posição Verdadeira (True Position)
      if (generateGdt) {
        const gdtFrameId = `GDT_POS_${idx + 1}`;
        const frame: GdtFeatureControlFrame = {
          id: gdtFrameId,
          characteristic: "TRUE_POSITION",
          symbol: "⌖",
          toleranceValue: 0.25,
          isDiameterZone: true,
          materialModifier: "MMC",
          datums: {
            primary: "A",
            secondary: "B",
            tertiary: "C",
            secondaryModifier: "MMC",
          },
          appliedToFeatureId: loop.id || `HOLE_${idx + 1}`,
          description: `Posição Verdadeira de Ø0.25mm na condição de máximo material (MMC) em relação aos Datums A|B|C.`,
        };
        gdtFrames.push(frame);

        points.push({
          id: `INSP_GDT_TP_${idx + 1}`,
          balloonNumber: balloonCounter++,
          type: "GDT_POSITION",
          label: `GD&T Posição Verdadeira Furo #${idx + 1}`,
          featureRefId: loop.id || `HOLE_${idx + 1}`,
          nominal: 0,
          upperTol: 0.25,
          lowerTol: 0,
          status: "PENDING",
          instrument: "CMM_PROBE",
          gdtFrame: frame,
          coordinates: { x: posX, y: posY, z: 0 },
          notes: GdtEngine.formatFeatureControlFrame(frame),
        });
      }
    });

    // 4. DOBRAS E ABAS CONFORMADAS
    const bends = doc.sheetMetal?.bends || [];
    bends.forEach((b: any, idx: number) => {
      const bendAngle = b.angle || 90;
      const angleTol = getAngularTolerance(50, tolClass);

      points.push({
        id: `INSP_BEND_ANGLE_${idx + 1}`,
        balloonNumber: balloonCounter++,
        type: "BEND_ANGLE",
        label: `Ângulo de Dobra #${idx + 1} (${bendAngle}°)`,
        featureRefId: b.id || `BEND_${idx + 1}`,
        nominal: bendAngle,
        upperTol: angleTol.upperDeg,
        lowerTol: angleTol.lowerDeg,
        status: "PENDING",
        instrument: "PROTRACTOR",
        coordinates: {
          x: (b.start?.x + b.end?.x) / 2 || 0,
          y: (b.start?.y + b.end?.y) / 2 || 0,
          z: 0,
        },
        notes: "Medir com goniômetro de precisão após resfriamento da chapa.",
      });

      // Perpendicularidade da aba (GD&T)
      if (generateGdt && bendAngle === 90) {
        const perpTol = getGeneralPerpendicularityTolerance(50);
        const gdtFrameId = `GDT_PERP_${idx + 1}`;
        const frame: GdtFeatureControlFrame = {
          id: gdtFrameId,
          characteristic: "PERPENDICULARITY",
          symbol: "⟂",
          toleranceValue: perpTol,
          isDiameterZone: false,
          materialModifier: "RFS",
          datums: { primary: "A" },
          appliedToFeatureId: b.id || `BEND_${idx + 1}`,
          description: `Perpendicularidade da aba em relação ao plano base Datum A (máx ${perpTol}mm).`,
        };
        gdtFrames.push(frame);

        points.push({
          id: `INSP_GDT_PERP_${idx + 1}`,
          balloonNumber: balloonCounter++,
          type: "GDT_PERPENDICULARITY",
          label: `GD&T Perpendicularidade Aba #${idx + 1}`,
          featureRefId: b.id || `BEND_${idx + 1}`,
          nominal: 0,
          upperTol: perpTol,
          lowerTol: 0,
          status: "PENDING",
          instrument: "HEIGHT_GAUGE",
          gdtFrame: frame,
          coordinates: {
            x: (b.start?.x + b.end?.x) / 2 || 0,
            y: (b.start?.y + b.end?.y) / 2 || 0,
            z: 0,
          },
          notes: GdtEngine.formatFeatureControlFrame(frame),
        });
      }
    });

    const report: FirstArticleInspectionReport = {
      id: `FAI_${doc.id}_${Date.now()}`,
      partId: doc.id,
      partName: doc.name || "Peça Industrial",
      revision: "REV A",
      inspectorName: inspector,
      date: new Date().toISOString().split("T")[0]!,
      material: doc.material || "Aço Carbono A36",
      thickness: tNom,
      toleranceClass: tolClass,
      points,
      gdtFrames,
      summary: {
        totalDimensions: points.length,
        passed: 0,
        warnings: 0,
        failed: 0,
        pending: points.length,
        conformanceRate: 0,
        overallVerdict: "INCOMPLETE",
      },
    };

    return report;
  }

  /**
   * Avalia um lote de medições reais preenchidas pelo inspetor e gera o veredito e capabilidade.
   */
  static evaluateMeasurements(
    report: FirstArticleInspectionReport,
    measurementsMap: Record<string, number>, // point.id -> valor medido
  ): FirstArticleInspectionReport {
    let passed = 0;
    let warnings = 0;
    let failed = 0;
    let pending = 0;
    const deviations: number[] = [];

    const updatedPoints = report.points.map((pt) => {
      const measured = measurementsMap[pt.id];
      if (measured === undefined) {
        pending++;
        return { ...pt, status: "PENDING" as const };
      }

      let deviation = 0;
      let status: "PASS" | "WARNING" | "FAIL" = "PASS";

      if (pt.type === "GDT_POSITION") {
        // Para GD&T posição, o desvio é o valor medido diametral
        deviation = measured;
        if (measured <= pt.upperTol) {
          status = measured > pt.upperTol * 0.85 ? "WARNING" : "PASS";
        } else {
          status = "FAIL";
        }
      } else {
        deviation = Number((measured - pt.nominal).toFixed(3));
        const inTol = deviation >= pt.lowerTol - 1e-5 && deviation <= pt.upperTol + 1e-5;
        if (inTol) {
          // Alerta amarelo se estiver nos 15% extremos da banda de tolerância
          const band = pt.upperTol - pt.lowerTol;
          const distToLimit = Math.min(pt.upperTol - deviation, deviation - pt.lowerTol);
          status = distToLimit < band * 0.15 ? "WARNING" : "PASS";
        } else {
          status = "FAIL";
        }
      }

      if (status === "PASS") passed++;
      else if (status === "WARNING") warnings++;
      else if (status === "FAIL") failed++;

      deviations.push(deviation);

      return {
        ...pt,
        measured,
        deviation,
        status,
      };
    });

    const total = updatedPoints.length;
    const conformanceRate =
      total > 0 ? Number((((passed + warnings) / total) * 100).toFixed(1)) : 0;

    let overallVerdict: "APPROVED" | "CONDITIONALLY_APPROVED" | "REJECTED" | "INCOMPLETE" =
      "INCOMPLETE";

    if (pending === 0) {
      if (failed === 0 && warnings === 0) {
        overallVerdict = "APPROVED";
      } else if (failed === 0 && warnings > 0) {
        overallVerdict = "CONDITIONALLY_APPROVED";
      } else {
        overallVerdict = "REJECTED";
      }
    }

    // Cálculo estatístico de capabilidade
    let capability: ProcessCapabilityIndices | undefined;
    if (deviations.length >= 3) {
      const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
      const variance =
        deviations.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
        (deviations.length - 1);
      const stdDev = Math.sqrt(variance);

      // Usando banda média típica de ±0.3mm para cálculo global de Cp/Cpk
      const usl = 0.3;
      const lsl = -0.3;
      const cp = stdDev > 1e-6 ? (usl - lsl) / (6 * stdDev) : 2.0;
      const cpkUpper = stdDev > 1e-6 ? (usl - mean) / (3 * stdDev) : 2.0;
      const cpkLower = stdDev > 1e-6 ? (mean - lsl) / (3 * stdDev) : 2.0;
      const cpk = Math.min(cpkUpper, cpkLower);

      capability = {
        mean: Number(mean.toFixed(4)),
        stdDev: Number(stdDev.toFixed(4)),
        cp: Number(cp.toFixed(2)),
        cpk: Number(cpk.toFixed(2)),
        totalSamples: deviations.length,
      };
    }

    return {
      ...report,
      points: updatedPoints,
      summary: {
        totalDimensions: total,
        passed,
        warnings,
        failed,
        pending,
        conformanceRate,
        overallVerdict,
      },
      capability,
    };
  }
}
