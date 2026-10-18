/**
 * CALDRA CAD — CNC G-CODE POST-PROCESSOR (FASE 07)
 *
 * Pós-processador industrial para exportação de código G (ISO 6983 / CypCut / Fanuc / Mach3).
 * Estrutura determinística: cabeçalho técnico, perfurações M03/M05, interpolações lineares/circulares
 * e compensação de percurso.
 */

import type { ToolpathResult, GCodeOptions, CuttingParameters } from "./types";

export class GCodePostProcessor {
  /**
   * Converte a trajetória gerada em código G industrial formatado.
   */
  static generateGCode(
    toolpath: ToolpathResult,
    params: CuttingParameters,
    options?: GCodeOptions,
  ): string {
    const lines: string[] = [];
    const programName = options?.programName ?? "CALDRA_CNC_001";
    const partName = options?.partName ?? "PECA_CHAPA";
    const dialect = options?.dialect ?? "STANDARD_ISO";
    const comments = options?.includeComments ?? true;

    // Cabeçalho do Programa CNC
    if (comments) {
      lines.push(`(========================================)`);
      lines.push(`( PROGRAMA: ${programName} )`);
      lines.push(`( PECA: ${partName} )`);
      lines.push(`( GERADO POR: CALDRA CAD POST-PROCESSOR )`);
      lines.push(`( TECNOLOGIA: ${params.technology} )`);
      lines.push(`( MATERIAL: ${params.material} - ESPESSURA: ${params.thicknessMm} mm )`);
      lines.push(`( AVANCO CORTE: ${params.feedrateMmMin} mm/min )`);
      lines.push(`( PERFURACOES: ${toolpath.pierceCount} )`);
      lines.push(`( COMPRIMENTO CORTE: ${toolpath.totalCutLengthMm} mm )`);
      lines.push(`( TEMPO ESTIMADO: ${toolpath.totalCycleTimeSec} s )`);
      lines.push(`( DIALETO: ${dialect} )`);
      lines.push(`(========================================)`);
    }

    // Inicialização da máquina CNC
    lines.push(`%`);
    lines.push(`O0001 (${programName})`);
    lines.push(`G21 (Modo Milimetros)`);
    lines.push(`G90 (Coordenadas Absolutas)`);
    lines.push(`G17 (Plano XY de Trabalho)`);
    lines.push(`G94 (Avanco em mm/min)`);
    lines.push(`G40 (Cancela compensacao de raio)`);

    // Processamento de cada contorno na ordem estrita (furos primeiro, externo por último)
    toolpath.contours.forEach((contour, idx) => {
      if (comments) {
        lines.push(
          `\n(--- CONTORNO ${idx + 1}/${toolpath.contours.length}: ${contour.isOuter ? "EXTERNO" : "FURO INTERNO"} ---)`,
        );
      }

      // 1. Deslocamento Rápido em Vazio até o ponto de perfuração
      lines.push(`G00 X${contour.piercePoint.x.toFixed(3)} Y${contour.piercePoint.y.toFixed(3)}`);

      // 2. Acionamento do Feixe e Perfuração Inicial
      lines.push(`M08 (Gas de assistencia LIGADO)`);
      lines.push(`M03 (Feixe/Tocha LIGADO)`);
      if (params.pierceTimeSec > 0) {
        lines.push(`G04 P${params.pierceTimeSec.toFixed(2)} (Dwell perfuracao)`);
      }

      // 3. Trajetória de Entrada (Lead-in)
      contour.leadInSegments.forEach((seg) => {
        lines.push(
          `G01 X${seg.end.x.toFixed(3)} Y${seg.end.y.toFixed(3)} F${Math.round(seg.feedrate)}`,
        );
      });

      // 4. Corte do Contorno Útil
      contour.cutSegments.forEach((seg) => {
        if (seg.type === "CUT_CIRCULAR" && seg.center) {
          const iOffset = seg.center.x - seg.start.x;
          const jOffset = seg.center.y - seg.start.y;
          const gCodeCmd = seg.isClockwise ? "G02" : "G03";
          lines.push(
            `${gCodeCmd} X${seg.end.x.toFixed(3)} Y${seg.end.y.toFixed(3)} I${iOffset.toFixed(3)} J${jOffset.toFixed(3)} F${Math.round(seg.feedrate)}`,
          );
        } else {
          lines.push(
            `G01 X${seg.end.x.toFixed(3)} Y${seg.end.y.toFixed(3)} F${Math.round(seg.feedrate)}`,
          );
        }
      });

      // 5. Trajetória de Saída (Lead-out)
      contour.leadOutSegments.forEach((seg) => {
        lines.push(
          `G01 X${seg.end.x.toFixed(3)} Y${seg.end.y.toFixed(3)} F${Math.round(seg.feedrate)}`,
        );
      });

      // 6. Desligamento do Feixe e Gás
      lines.push(`M05 (Feixe/Tocha DESLIGADO)`);
      lines.push(`M09 (Gas de assistencia DESLIGADO)`);
    });

    // Finalização e Retorno à Origem
    if (comments) {
      lines.push(`\n(--- FIM DE PROGRAMA E RETORNO A ORIGEM ---)`);
    }
    lines.push(`G00 X0.000 Y0.000 (Retorno ao zero peca)`);
    lines.push(`M30 (Fim de Programa)`);
    lines.push(`%`);

    return lines.join("\n");
  }
}
