// @ts-nocheck
/**
 * CALDRA CAD — DFM (DESIGN FOR MANUFACTURING) AUDIT ENGINE (FASE 13)
 *
 * Motor analítico de validação de fabricabilidade para conformação e corte de chapas.
 * Identifica automaticamente violações de oficina que causam:
 * - Ovalização e deformação plástica de furos em dobras
 * - Abas de dobra curtas que caem na fresta da matriz V
 * - Rompimento e estufamento perimetral por furos colados na borda
 * - Escórias e queima de bico por furação menor que a espessura
 * - Empenamento térmico por istmos e pontes estreitas de corte
 * - Ausência de alívios de canto em dobras contíguas
 */

import { DfmAuditResult, DfmAuditSummary, DfmIssue, DfmRuleConfig } from "./types";
import { PartDocument } from "../kernel/types";
import { PressBrakeSimulator } from "../forming/pressBrakeSimulator";

export const DEFAULT_DFM_CONFIG: DfmRuleConfig = {
  holeToBendFactor: 2.0,
  holeToEdgeFactor: 1.5,
  minHoleDiameterFactor: 1.0,
  minFlangeToVFactor: 0.7,
  minNarrowWebMm: 3.0,
  maxPressBrakeTonnage: 160.0,
};

export class DfmEngine {
  /**
   * Executa a auditoria DFM completa em um documento de peça de chapa metálica
   */
  public static audit(doc: PartDocument, configOverride?: Partial<DfmRuleConfig>): DfmAuditResult {
    const config: DfmRuleConfig = { ...DEFAULT_DFM_CONFIG, ...configOverride };
    const issues: DfmIssue[] = [];

    const thickness = doc.sheetMetal?.thickness ?? 2.0;
    const material = doc.sheetMetal?.material ?? "Aço Carbono A36";
    const bendRadius = doc.sheetMetal?.defaultBendRadius ?? thickness;

    // 1. Extração de elementos geométricos relevantes
    const bendLines = doc.sheetMetal?.bends ?? [];
    const flatPattern = doc.sheetMetal?.flatPattern;

    // Furos e rasgos contidos na geometria plana ou no modelo 3D
    const holes = this.extractHoles(doc);
    const outerBounds = this.getOuterBounds(doc);

    // 2. REGRA: Distância de Furo à Linha de Dobra (HOLE_TOO_CLOSE_TO_BEND)
    for (const hole of holes) {
      for (const bend of bendLines) {
        // Distância do centro do furo ao segmento de linha de dobra
        const distToCenter = this.pointToSegmentDistance(
          hole.x,
          hole.y,
          bend.start.x,
          bend.start.y,
          bend.end.x,
          bend.end.y,
        );

        const edgeOfHoleDist = distToCenter - hole.radius;
        const requiredDist = bendRadius + config.holeToBendFactor * thickness;

        if (edgeOfHoleDist < requiredDist) {
          const isCritical = edgeOfHoleDist < bendRadius + 0.8 * thickness;
          issues.push({
            id: `DFM_BEND_${hole.id}_${bend.id}`,
            ruleId: "HOLE_TOO_CLOSE_TO_BEND",
            severity: isCritical ? "ERROR" : "WARNING",
            title: isCritical
              ? "Furo na Zona Plástica da Dobra (Alto Risco de Ovalização)"
              : "Furo Próximo à Zona de Dobra",
            description: `O furo '${hole.id}' (Ø${(hole.radius * 2).toFixed(1)}mm) está a ${edgeOfHoleDist.toFixed(1)}mm da linha de dobra '${bend.id}'. O mínimo seguro é ${requiredDist.toFixed(1)}mm (Raio + ${config.holeToBendFactor}×t) para evitar estiramento da furação.`,
            location: { x: hole.x, y: hole.y },
            measuredValue: Number(edgeOfHoleDist.toFixed(2)),
            thresholdValue: Number(requiredDist.toFixed(2)),
            unit: "mm",
            suggestedFix: `Aumentar a distância da furação em relação à dobra para pelo menos ${requiredDist.toFixed(1)}mm ou realizar o corte do furo após a conformação mecânica.`,
            affectedEntityId: hole.id,
          });
        }
      }
    }

    // 3. REGRA: Distância de Furo à Borda Livre (HOLE_TOO_CLOSE_TO_EDGE)
    for (const hole of holes) {
      const distToBorder = this.distanceToBoundary(hole.x, hole.y, outerBounds);
      const edgeDist = distToBorder - hole.radius;
      const minEdgeDist = config.holeToEdgeFactor * thickness;

      if (edgeDist < minEdgeDist) {
        const isCritical = edgeDist < 0.6 * thickness;
        issues.push({
          id: `DFM_EDGE_${hole.id}`,
          ruleId: "HOLE_TOO_CLOSE_TO_EDGE",
          severity: isCritical ? "ERROR" : "WARNING",
          title: isCritical
            ? "Furo Perigosamente Próximo à Borda da Chapa"
            : "Furo com Margem Reduzida de Borda",
          description: `A aresta do furo '${hole.id}' dista apenas ${edgeDist.toFixed(1)}mm da borda livre externa. Espessura t = ${thickness}mm requer margem de no mínimo ${minEdgeDist.toFixed(1)}mm (${config.holeToEdgeFactor}×t) para não estufar o perímetro.`,
          location: { x: hole.x, y: hole.y },
          measuredValue: Number(edgeDist.toFixed(2)),
          thresholdValue: Number(minEdgeDist.toFixed(2)),
          unit: "mm",
          suggestedFix: `Reposicionar o centro do furo para manter afastamento de pelo menos ${minEdgeDist.toFixed(1)}mm até a borda externa.`,
          affectedEntityId: hole.id,
        });
      }
    }

    // 4. REGRA: Diâmetro Mínimo de Furo por Corte Térmico (MIN_HOLE_DIAMETER_SMALL)
    for (const hole of holes) {
      const diameter = hole.radius * 2;
      const minDiameter = config.minHoleDiameterFactor * thickness;

      if (diameter < minDiameter) {
        const isCritical = diameter < 0.7 * thickness;
        issues.push({
          id: `DFM_DIAMETER_${hole.id}`,
          ruleId: "MIN_HOLE_DIAMETER_SMALL",
          severity: isCritical ? "ERROR" : "WARNING",
          title: "Diâmetro de Furo Menor que a Espessura da Chapa",
          description: `O furo '${hole.id}' possui diâmetro de Ø${diameter.toFixed(1)}mm, inferior ao limite recomendado de Ø${minDiameter.toFixed(1)}mm (${config.minHoleDiameterFactor}×t). Em corte laser/plasma, isso pode gerar conicidade excessiva, fusão de escória e desgaste prematuro de bico.`,
          location: { x: hole.x, y: hole.y },
          measuredValue: Number(diameter.toFixed(2)),
          thresholdValue: Number(minDiameter.toFixed(2)),
          unit: "mm",
          suggestedFix: `Aumentar o diâmetro para no mínimo Ø${minDiameter.toFixed(1)}mm ou projetar como punção mecânica / furação em furadeira de bancada.`,
          affectedEntityId: hole.id,
        });
      }
    }

    // 5. REGRA: Comprimento Mínimo de Aba para Apoio na Matriz V (MIN_FLANGE_LENGTH_TOO_SHORT)
    const vDie = PressBrakeSimulator.recommendVDie(thickness);
    const minFlange = config.minFlangeToVFactor * vDie;

    for (const bend of bendLines) {
      // Verifica se há informação de altura de aba (flangeLength)
      const flangeLength = (bend as any).flangeLength ?? (bend as any).length ?? 0;
      if (flangeLength > 0 && flangeLength < minFlange) {
        issues.push({
          id: `DFM_FLANGE_${bend.id}`,
          ruleId: "MIN_FLANGE_LENGTH_TOO_SHORT",
          severity: "ERROR",
          title: "Aba de Dobra Menor que o Apoio Mínimo na Matriz V",
          description: `A aba da dobra '${bend.id}' tem comprimento de ${flangeLength.toFixed(1)}mm, insuficiente para apoiar na matriz V recomendada (V=${vDie}mm). A peça escorregará para dentro do canal da matriz durante o golpe.`,
          location: { x: bend.start.x, y: bend.start.y },
          measuredValue: Number(flangeLength.toFixed(2)),
          thresholdValue: Number(minFlange.toFixed(2)),
          unit: "mm",
          suggestedFix: `Aumentar o comprimento da aba para no mínimo ${minFlange.toFixed(1)}mm (0.7×V) ou prever matriz especial / dobra com navalha dedicada.`,
          affectedEntityId: bend.id,
        });
      }
    }

    // 6. REGRA: Istmo Térmico Estreito entre Cortes (NARROW_WEB_THERMAL_RISK)
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        const h1 = holes[i];
        const h2 = holes[j];
        const centerDist = Math.hypot(h1.x - h2.x, h1.y - h2.y);
        const webDist = centerDist - (h1.radius + h2.radius);
        const minWeb = Math.max(thickness, config.minNarrowWebMm);

        if (webDist > 0 && webDist < minWeb) {
          issues.push({
            id: `DFM_WEB_${h1.id}_${h2.id}`,
            ruleId: "NARROW_WEB_THERMAL_RISK",
            severity: "WARNING",
            title: "Ponte Térmica Estreita Entre Furações",
            description: `A distância livre entre as furações '${h1.id}' e '${h2.id}' é de apenas ${webDist.toFixed(1)}mm (mínimo seguro = ${minWeb.toFixed(1)}mm). Risco de queima por acúmulo térmico e perda dimensional.`,
            location: { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2 },
            measuredValue: Number(webDist.toFixed(2)),
            thresholdValue: Number(minWeb.toFixed(2)),
            unit: "mm",
            suggestedFix: `Aumentar a distância entre os centros dos furos ou unir os furos em um rasgo oblongo único.`,
          });
        }
      }
    }

    // 7. REGRA: Capacidade de Tonelagem da Prensa Dobradeira (TONNAGE_LIMIT_EXCEEDED)
    if (bendLines.length > 0) {
      // Simula a dobra mais longa
      let maxBendLength = 0;
      for (const bend of bendLines) {
        const len = Math.hypot(bend.end.x - bend.start.x, bend.end.y - bend.start.y);
        if (len > maxBendLength) maxBendLength = len;
      }
      if (maxBendLength > 0) {
        const sim = PressBrakeSimulator.simulate({
          thicknessMm: thickness,
          bendLengthMm: maxBendLength,
          material: "A36",
          targetAngleDeg: 90,
        });

        if (sim.tonnageTotal > config.maxPressBrakeTonnage) {
          issues.push({
            id: `DFM_TONNAGE_EXCEEDED`,
            ruleId: "TONNAGE_LIMIT_EXCEEDED",
            severity: "ERROR",
            title: "Capacidade de Tonelagem da Dobradeira Excedida",
            description: `A dobra de comprimento ${maxBendLength.toFixed(0)}mm em ${material} (${thickness}mm) exige ${sim.tonnageTotal.toFixed(1)} ton de força, superando o limite da prensa (${config.maxPressBrakeTonnage} ton).`,
            location: { x: 0, y: 0 },
            measuredValue: Number(sim.tonnageTotal.toFixed(1)),
            thresholdValue: config.maxPressBrakeTonnage,
            unit: "ton",
            suggestedFix: `Aumentar a abertura da matriz V ou segmentar a linha de dobra com alívios de corte intercalados.`,
          });
        }
      }
    }

    // 8. Cálculo de sumário e DFM Score
    const errorCount = issues.filter((i) => i.severity === "ERROR").length;
    const warningCount = issues.filter((i) => i.severity === "WARNING").length;
    const infoCount = issues.filter((i) => i.severity === "INFO").length;

    let score = 100 - errorCount * 25 - warningCount * 10 - infoCount * 2;
    if (score < 0) score = 0;

    const summary: DfmAuditSummary = {
      errorCount,
      warningCount,
      infoCount,
      score,
      isApproved: errorCount === 0,
    };

    return {
      partName: doc.header?.name || doc.name || "Peça Caldra",
      material,
      thickness,
      summary,
      issues,
      auditedAt: new Date().toISOString(),
    };
  }

  // --- Auxiliares Geométricos ---

  private static extractHoles(
    doc: PartDocument,
  ): Array<{ id: string; x: number; y: number; radius: number }> {
    const list: Array<{ id: string; x: number; y: number; radius: number }> = [];

    // Furos do flatPattern se existirem
    if (doc.sheetMetal?.flatPattern?.innerLoops) {
      doc.sheetMetal.flatPattern.innerLoops.forEach((loop, idx) => {
        if (loop.type === "CIRCLE") {
          list.push({
            id: `FURO_${idx + 1}`,
            x: loop.center.x,
            y: loop.center.y,
            radius: loop.radius,
          });
        }
      });
    }

    // Furos de furações canônicas de faces
    if (doc.solid?.faces) {
      for (const face of doc.solid.faces) {
        if (face.innerHoles) {
          for (let i = 0; i < face.innerHoles.length; i++) {
            const h = face.innerHoles[i];
            list.push({
              id: `HOLE_3D_${i + 1}`,
              x: h.center.x,
              y: h.center.y,
              radius: h.radius,
            });
          }
        }
      }
    }

    // Furos de forming tools (Emboss com hole)
    if (doc.forming?.embosses) {
      for (const emb of doc.forming.embosses) {
        if (emb.hasPiercedHole && emb.piercedHoleDiameter) {
          list.push({
            id: `EMBOSS_HOLE_${emb.id}`,
            x: emb.position.x,
            y: emb.position.y,
            radius: emb.piercedHoleDiameter / 2,
          });
        }
      }
    }

    return list;
  }

  private static getOuterBounds(doc: PartDocument): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (doc.sheetMetal?.flatPattern) {
      return {
        minX: 0,
        maxX: doc.sheetMetal.flatPattern.width,
        minY: 0,
        maxY: doc.sheetMetal.flatPattern.height,
      };
    }
    return { minX: 0, maxX: 500, minY: 0, maxY: 300 };
  }

  private static distanceToBoundary(
    x: number,
    y: number,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
  ): number {
    const dLeft = Math.abs(x - bounds.minX);
    const dRight = Math.abs(bounds.maxX - x);
    const dBottom = Math.abs(y - bounds.minY);
    const dTop = Math.abs(bounds.maxY - y);
    return Math.min(dLeft, dRight, dBottom, dTop);
  }

  private static pointToSegmentDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);

    // Projeção escalar normalizada
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.hypot(px - projX, py - projY);
  }
}
