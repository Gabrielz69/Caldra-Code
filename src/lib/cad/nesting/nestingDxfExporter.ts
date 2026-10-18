/**
 * CALDRA CAD — NESTING DXF & REPORT EXPORTER (FASE 11)
 *
 * Exportador de pranchas aninhadas inteiras para DXF CNC industrial (CypCut / FastCAM)
 * com camadas segregadas de chapa, corte externo, furos internos, linhas comuns,
 * retalhos identificados e etiquetas de rastreabilidade.
 */

import type { NestedSheet, NestingJobResult } from "./types";

export class NestingDxfExporter {
  /**
   * Exporta uma chapa aninhada específica para arquivo DXF ASCII (AutoCAD R12/2000).
   */
  static exportSheetToDxf(sheet: NestedSheet): string {
    const lines: string[] = [];

    // Header
    lines.push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC");

    // Tables
    lines.push("0", "SECTION", "2", "TABLES");

    // Layers Table
    lines.push(
      "0",
      "TABLE",
      "2",
      "LAYER",
      "70",
      "6",
      // Layer 0_BORDA_CHAPA (Amarelo / Cor 2)
      "0",
      "LAYER",
      "2",
      "0_BORDA_CHAPA",
      "70",
      "0",
      "62",
      "2",
      "6",
      "CONTINUOUS",
      // Layer 1_CORTE_EXTERNO (Verde / Cor 3 - CUT)
      "0",
      "LAYER",
      "2",
      "1_CORTE_EXTERNO",
      "70",
      "0",
      "62",
      "3",
      "6",
      "CONTINUOUS",
      // Layer 2_FUROS_INTERNOS (Ciano / Cor 4)
      "0",
      "LAYER",
      "2",
      "2_FUROS_INTERNOS",
      "70",
      "0",
      "62",
      "4",
      "6",
      "CONTINUOUS",
      // Layer 3_LINHA_COMUM (Magenta / Cor 6)
      "0",
      "LAYER",
      "2",
      "3_LINHA_COMUM",
      "70",
      "0",
      "62",
      "6",
      "6",
      "CONTINUOUS",
      // Layer 4_RETALHO_UTIL (Azul / Cor 5)
      "0",
      "LAYER",
      "2",
      "4_RETALHO_UTIL",
      "70",
      "0",
      "62",
      "5",
      "6",
      "DASHED",
      // Layer 5_IDENTIFICACAO (Branco / Cor 7 - MARK)
      "0",
      "LAYER",
      "2",
      "5_IDENTIFICACAO",
      "70",
      "0",
      "62",
      "7",
      "6",
      "CONTINUOUS",
      "0",
      "ENDTAB",
      "0",
      "ENDSEC",
    );

    // Entities Section
    lines.push("0", "SECTION", "2", "ENTITIES");

    // 1. Contorno da chapa bruta
    this.addRectPolyline(lines, 0, 0, sheet.stock.width, sheet.stock.height, "0_BORDA_CHAPA");

    // 2. Peças alocadas (contorno externo)
    for (const p of sheet.placements) {
      this.addRectPolyline(lines, p.x, p.y, p.width, p.height, "1_CORTE_EXTERNO");

      // Furos internos
      if (p.internalHoles && p.internalHoles.length > 0) {
        for (const hole of p.internalHoles) {
          const hX = p.x + hole.x;
          const hY = p.y + hole.y;
          if (hole.type === "CIRCLE") {
            const radius = Math.min(hole.width, hole.height) / 2;
            lines.push(
              "0",
              "CIRCLE",
              "8",
              "2_FUROS_INTERNOS",
              "10",
              (hX + radius).toFixed(3),
              "20",
              (hY + radius).toFixed(3),
              "30",
              "0.0",
              "40",
              radius.toFixed(3),
            );
          } else {
            this.addRectPolyline(lines, hX, hY, hole.width, hole.height, "2_FUROS_INTERNOS");
          }
        }
      }

      // Etiqueta com nome e instância no centro da peça
      const textX = p.x + p.width / 2;
      const textY = p.y + p.height / 2;
      lines.push(
        "0",
        "TEXT",
        "8",
        "5_IDENTIFICACAO",
        "10",
        textX.toFixed(3),
        "20",
        textY.toFixed(3),
        "30",
        "0.0",
        "40",
        "14.0", // Altura do texto em mm
        "1",
        `${p.name} #${p.instanceIndex}`,
        "72",
        "1", // Centralizado horizontal
        "11",
        textX.toFixed(3),
        "21",
        textY.toFixed(3),
        "31",
        "0.0",
      );
    }

    // 3. Linhas de corte comum (se houver)
    for (const cl of sheet.commonLines) {
      lines.push(
        "0",
        "LINE",
        "8",
        "3_LINHA_COMUM",
        "10",
        cl.startX.toFixed(3),
        "20",
        cl.startY.toFixed(3),
        "30",
        "0.0",
        "11",
        cl.endX.toFixed(3),
        "21",
        cl.endY.toFixed(3),
        "31",
        "0.0",
      );
    }

    // 4. Retalhos aproveitáveis (Remnants)
    for (const rem of sheet.remnants) {
      this.addRectPolyline(lines, rem.x, rem.y, rem.width, rem.height, "4_RETALHO_UTIL");
      // Texto de identificação do retalho
      const remTextX = rem.x + rem.width / 2;
      const remTextY = rem.y + rem.height / 2;
      lines.push(
        "0",
        "TEXT",
        "8",
        "4_RETALHO_UTIL",
        "10",
        remTextX.toFixed(3),
        "20",
        remTextY.toFixed(3),
        "30",
        "0.0",
        "40",
        "18.0",
        "1",
        `SOBRA UTIL: ${rem.width.toFixed(0)}x${rem.height.toFixed(0)}mm (${rem.weightKg}kg)`,
        "72",
        "1",
        "11",
        remTextX.toFixed(3),
        "21",
        remTextY.toFixed(3),
        "31",
        "0.0",
      );
    }

    lines.push("0", "ENDSEC", "0", "EOF");
    return lines.join("\n");
  }

  /**
   * Adiciona um retângulo fechado como LWPOLYLINE de 4 vértices.
   */
  private static addRectPolyline(
    lines: string[],
    x: number,
    y: number,
    w: number,
    h: number,
    layer: string,
  ): void {
    lines.push(
      "0",
      "LWPOLYLINE",
      "8",
      layer,
      "90",
      "4",
      "70",
      "1", // Fechada
      "10",
      x.toFixed(3),
      "20",
      y.toFixed(3),
      "10",
      (x + w).toFixed(3),
      "20",
      y.toFixed(3),
      "10",
      (x + w).toFixed(3),
      "20",
      (y + h).toFixed(3),
      "10",
      x.toFixed(3),
      "20",
      (y + h).toFixed(3),
    );
  }

  /**
   * Gera relatório de aproveitamento e corte de chapa em formato CSV industrial.
   */
  static generateReportCsv(job: NestingJobResult): string {
    const rows: string[] = [];
    rows.push("CALDRA CAD — RELATÓRIO INDUSTRIAL DE ANINHAMENTO E APROVEITAMENTO DE CHAPA");
    rows.push(`Lote ID;${job.id};Data;${job.createdAt}`);
    rows.push(
      `Peças Solicitadas;${job.totalBlanksRequested};Peças Aninhadas;${job.totalBlanksPlaced};Aproveitamento Global;${job.globalEfficiencyPercent}%`,
    );
    rows.push(
      `Peso Total Chapas;${job.totalSheetWeightKg} kg;Peso Peças;${job.totalPartsWeightKg} kg;Peso Sucata;${job.totalScrapWeightKg} kg`,
    );
    rows.push(`Comprimento Economizado (Corte Comum);${job.totalCommonLineSavedLengthMm} mm`);
    rows.push("");

    // Detalhamento por Chapa
    rows.push(
      "CHAPA;MATERIAL;ESPESSURA (mm);DIMENSOES (mm);PECAS;EFICIENCIA (%);SUCATA (%);PESO CHAPA (kg);TEMPO CORTE (min)",
    );
    for (const s of job.sheets) {
      rows.push(
        `${s.sheetIndex};${s.stock.material};${s.stock.thickness};${s.stock.width}x${s.stock.height};${s.placements.length};${s.efficiencyPercent}%;${s.scrapPercent}%;${s.totalSheetWeightKg};${s.estimatedCutTimeMinutes}`,
      );
    }
    rows.push("");

    // Retalhos Gerados
    if (job.totalRemnantsGenerated.length > 0) {
      rows.push("RETALHOS REAPROVEITAVEIS GERADOS PARA ESTOQUE");
      rows.push(
        "ID;CHAPA ORIGEM;LARGURA (mm);COMPRIMENTO (mm);AREA (m2);PESO ESTIMADO (kg);MATERIAL",
      );
      for (const r of job.totalRemnantsGenerated) {
        rows.push(
          `${r.id};Chapa ${r.sheetIndex};${r.width.toFixed(1)};${r.height.toFixed(1)};${(r.areaMm2 / 1e6).toFixed(3)};${r.weightKg};${r.material}`,
        );
      }
    }

    return rows.join("\n");
  }
}
