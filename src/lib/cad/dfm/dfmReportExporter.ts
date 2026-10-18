// @ts-nocheck
/**
 * CALDRA CAD — DFM REPORT & DXF MARKUP EXPORTER (FASE 13)
 *
 * Gera relatórios industriais detalhados de fabricabilidade em CSV e
 * sobreposições DXF com anotações gráficas de auditoria técnica.
 */

import { DfmFullReport, DfmAuditResult } from "./types";
import { PartDocument } from "../kernel/types";

export class DfmReportExporter {
  /**
   * Exporta relatório industrial completo em formato CSV tabular
   */
  public static generateCsv(report: DfmFullReport): string {
    const lines: string[] = [];

    lines.push("CALDRA CAD — RELATÓRIO DE FABRICABILIDADE DFM & FORMAÇÃO DE CUSTOS");
    lines.push(`Peça;${report.partName};Data;${report.generatedAt}`);
    lines.push(`Material;${report.audit.material};Espessura;${report.audit.thickness} mm`);
    lines.push(
      `Status Fabricabilidade;${report.audit.summary.isApproved ? "APROVADO" : "REPROVADO"};Índice DFM;${report.audit.summary.score}/100`,
    );
    lines.push(
      `Erros Críticos;${report.audit.summary.errorCount};Alertas;${report.audit.summary.warningCount};Informativos;${report.audit.summary.infoCount}`,
    );
    lines.push("");

    // Tabela de Apontamentos DFM
    lines.push("AUDITORIA TÉCNICA DE FABRICAÇÃO (DFM)");
    lines.push(
      "ID;SEVERIDADE;REGRA;TÍTULO;MEDIÇÃO;LIMITE;UNIDADE;POSIÇÃO (X,Y);SUGESTÃO DE CORREÇÃO",
    );

    if (report.audit.issues.length === 0) {
      lines.push(
        "NENHUM;INFO;SEM_VIOLACOES;Peça 100% em conformidade com as regras de oficina;0;0;mm;(0, 0);Nenhuma ação necessária",
      );
    } else {
      for (const issue of report.audit.issues) {
        lines.push(
          `${issue.id};${issue.severity};${issue.ruleId};"${issue.title}";${issue.measuredValue};${issue.thresholdValue};${issue.unit};"(${issue.location.x.toFixed(1)}, ${issue.location.y.toFixed(1)})";"${issue.suggestedFix}"`,
        );
      }
    }
    lines.push("");

    // Formação de Custos Industriais
    const c = report.cost;
    lines.push("FORMAÇÃO ANALÍTICA DE CUSTOS E TEMPOS DE FABRICAÇÃO");
    lines.push(`Item;Valor;Unidade`);
    lines.push(`Peso Estimado da Peça;${c.partWeightKg};kg`);
    lines.push(`Custo da Matéria-Prima;${c.materialCost.toFixed(2)};${c.currency}`);
    lines.push(`Perímetro Total de Corte;${c.cutLengthMm};mm`);
    lines.push(`Tempo de Corte CNC;${c.cutTimeMinutes};min`);
    lines.push(`Custo de Máquina Laser/Plasma;${c.cuttingCost.toFixed(2)};${c.currency}`);
    lines.push(`Quantidade de Pierces (Furações);${c.pierceCount};un`);
    lines.push(`Custo de Furação Térmica;${c.piercingCost.toFixed(2)};${c.currency}`);
    lines.push(`Quantidade de Dobras;${c.bendCount};un`);
    lines.push(`Tempo de Dobra;${c.bendingTimeMinutes};min`);
    lines.push(`Custo Prensa Dobradeira;${c.bendingCost.toFixed(2)};${c.currency}`);
    lines.push(`Custo de Setup de Ferramentas;${c.setupCost.toFixed(2)};${c.currency}`);
    lines.push(`Tempo Total de Ciclo;${c.totalCycleTimeMinutes};min`);
    lines.push(`CUSTO DIRETO TOTAL;${c.directCost.toFixed(2)};${c.currency}`);
    lines.push(`PREÇO DE VENDA SUGERIDO;${c.suggestedSellingPrice.toFixed(2)};${c.currency}`);

    return lines.join("\n");
  }

  /**
   * Exporta arquivo DXF contendo o contorno da peça e camada DFM_ISSUES com marcações
   */
  public static generateDxfWithDfmLayer(doc: PartDocument, audit: DfmAuditResult): string {
    const flatW = doc.sheetMetal?.flatPattern?.width ?? 300;
    const flatH = doc.sheetMetal?.flatPattern?.height ?? 200;

    let dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";

    // Seção de TABELAS / LAYERS
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n";
    // Layer 0: Contorno
    dxf += "0\nLAYER\n2\n0_CONTOUR\n70\n0\n62\n7\n6\nCONTINUOUS\n0\n";
    // Layer 1: Dobras
    dxf += "0\nLAYER\n2\n1_BEND\n70\n0\n62\n6\n6\nCONTINUOUS\n0\n";
    // Layer DFM: Apontamentos de auditoria (Cor 1 = Vermelho para erro)
    dxf += "0\nLAYER\n2\nDFM_ISSUES\n70\n0\n62\n1\n6\nCONTINUOUS\n0\n";
    dxf += "ENDTAB\n0\nENDSEC\n";

    // Seção de ENTIDADES
    dxf += "0\nSECTION\n2\nENTITIES\n";

    // Contorno retangular do blank
    dxf += this.dxfLine("0_CONTOUR", 0, 0, flatW, 0);
    dxf += this.dxfLine("0_CONTOUR", flatW, 0, flatW, flatH);
    dxf += this.dxfLine("0_CONTOUR", flatW, flatH, 0, flatH);
    dxf += this.dxfLine("0_CONTOUR", 0, flatH, 0, 0);

    // Linhas de dobra
    if (doc.sheetMetal?.bends) {
      for (const b of doc.sheetMetal.bends) {
        dxf += this.dxfLine("1_BEND", b.start.x, b.start.y, b.end.x, b.end.y);
      }
    }

    // Marcações DFM (Círculo de destaque + texto do apontamento)
    for (const issue of audit.issues) {
      const radius = issue.severity === "ERROR" ? 15 : 10;
      // Círculo ao redor do ponto crítico
      dxf += "0\nCIRCLE\n8\nDFM_ISSUES\n";
      dxf += `10\n${issue.location.x.toFixed(3)}\n20\n${issue.location.y.toFixed(3)}\n30\n0.0\n`;
      dxf += `40\n${radius.toFixed(3)}\n`;

      // Texto com ID da regra
      dxf += "0\nTEXT\n8\nDFM_ISSUES\n";
      dxf += `10\n${(issue.location.x + radius + 2).toFixed(3)}\n20\n${issue.location.y.toFixed(3)}\n30\n0.0\n`;
      dxf += `40\n5.0\n`;
      dxf += `1\n${issue.ruleId} [${issue.severity}]\n`;
    }

    dxf += "0\nENDSEC\n0\nEOF\n";
    return dxf;
  }

  private static dxfLine(layer: string, x1: number, y1: number, x2: number, y2: number): string {
    let out = "0\nLINE\n";
    out += `8\n${layer}\n`;
    out += `10\n${x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n30\n0.0\n`;
    out += `11\n${x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n31\n0.0\n`;
    return out;
  }
}
