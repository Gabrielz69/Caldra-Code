/**
 * CALDRA CAD — EXPORTADOR DE RELATÓRIOS E MAPAS DE TENSÃO FEA (FASE 15)
 *
 * Exportação dos resultados da análise estrutural:
 * - Relatório Técnico Detalhado em CSV para auditoria estrutural e memorial de cálculo
 * - Prancha Vetorial SVG com Gradiente de Tensões de Von Mises (Color Fringe Heatmap),
 *   símbolos de engaste e vetores de carregamento mecânico.
 */

import type { FeaAnalysisResult } from "./types";

export class FeaReportExporter {
  /**
   * Exporta o Memorial de Cálculo e Resultados FEA em formato CSV estruturado
   */
  static exportToCSV(res: FeaAnalysisResult): string {
    const lines: string[] = [];

    lines.push(`"CALDRA CAD — MEMORIAL DE CÁLCULO ESTRUTURAL (FEA / CAE)"`);
    lines.push(`"ID da Análise";"${res.id}"`);
    lines.push(`"Peça";"${res.partName}"`);
    lines.push(`"Data/Hora";"${new Date(res.timestamp).toISOString()}"`);
    lines.push(`"Material";"${res.material.name}"`);
    lines.push(`"Módulo de Elasticidade E (MPa)";${res.material.youngsModulus}`);
    lines.push(`"Coeficiente de Poisson ν";${res.material.poissonsRatio}`);
    lines.push(`"Tensão de Escoamento fy (MPa)";${res.material.yieldStrength}`);
    lines.push(`"Espessura t (mm)";${res.thicknessMm}`);
    lines.push(`"Status de Segurança";"${res.status}"`);
    lines.push(`"Fator de Segurança Mínimo (FOS)";${res.minFactorOfSafety}`);
    lines.push(`"Tensão Máxima de Von Mises (MPa)";${res.maxVonMisesMPa}`);
    lines.push(`"Deflexão Máxima δ_max (mm)";${res.maxDeflectionMm}`);
    lines.push(`"Flecha Admissível L/300 (mm)";${res.allowableDeflectionMm}`);
    lines.push(`"Conformidade NBR 8800";"${res.deflectionPassed ? 'APROVADO' : 'EXCEDIDO'}"`);
    lines.push("");

    lines.push(`"--- PONTOS CRÍTICOS / CONCENTRAÇÃO DE TENSÃO (HOTSPOTS) ---"`);
    lines.push(`"Elemento";"Coord X (mm)";"Coord Y (mm)";"Von Mises (MPa)";"Descrição"`);
    for (const h of res.hotspots) {
      lines.push(`${h.elementId};${h.center.x.toFixed(1)};${h.center.y.toFixed(1)};${h.vonMisesMPa};"${h.description}"`);
    }
    lines.push("");

    lines.push(`"--- ELEMENTOS DA MALHA E TENSÕES ---"`);
    lines.push(`"Elemento";"Nós";"Área (mm²)";"σx (MPa)";"σy (MPa)";"τxy (MPa)";"σ_vm (MPa)"`);
    for (const el of res.mesh.elements) {
      const s = el.stress;
      lines.push(
        `${el.id};"${el.nodeIds.join('-')}";${el.area.toFixed(2)};${(s?.sigmaX || 0).toFixed(2)};${(s?.sigmaY || 0).toFixed(2)};${(s?.tauXY || 0).toFixed(2)};${(s?.vonMises || 0).toFixed(2)}`
      );
    }

    return lines.join("\n");
  }

  /**
   * Converte um valor normalizado (0 a 1) para cor HEX do mapa de calor FEA (Azul -> Ciano -> Verde -> Amarelo -> Vermelho)
   */
  private static getFeaColor(t: number): string {
    const clamped = Math.max(0, Math.min(1, t));
    // 0.0 -> Blue (0, 0, 255)
    // 0.25 -> Cyan (0, 255, 255)
    // 0.5 -> Green (0, 255, 0)
    // 0.75 -> Yellow (255, 255, 0)
    // 1.0 -> Red (255, 0, 0)
    let r = 0, g = 0, b = 0;

    if (clamped <= 0.25) {
      const f = clamped / 0.25;
      r = 0;
      g = Math.round(255 * f);
      b = 255;
    } else if (clamped <= 0.5) {
      const f = (clamped - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round(255 * (1 - f));
    } else if (clamped <= 0.75) {
      const f = (clamped - 0.5) / 0.25;
      r = Math.round(255 * f);
      g = 255;
      b = 0;
    } else {
      const f = (clamped - 0.75) / 0.25;
      r = 255;
      g = Math.round(255 * (1 - f));
      b = 0;
    }

    const hex = (c: number) => c.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  /**
   * Exporta a prancha vetorial SVG com o mapa de calor das tensões de Von Mises
   */
  static exportToStressHeatmapSVG(res: FeaAnalysisResult, width = 800, height = 500): string {
    const { minX, maxX, minY, maxY } = res.mesh.boundingBox;
    const modelW = Math.max(maxX - minX, 10);
    const modelH = Math.max(maxY - minY, 10);

    const margin = 70;
    const legendW = 120;
    const viewW = width - margin * 2 - legendW;
    const viewH = height - margin * 2;

    const scale = Math.min(viewW / modelW, viewH / modelH) * 0.9;
    const ox = margin + (viewW - modelW * scale) / 2;
    const oy = margin + (viewH - modelH * scale) / 2;

    const toScreen = (x: number, y: number) => ({
      sx: ox + (x - minX) * scale,
      sy: oy + (modelH - (y - minY)) * scale, // Inverte Y para CAD padrão (Y para cima)
    });

    const maxVM = Math.max(res.maxVonMisesMPa, 1);
    const minVM = res.minVonMisesMPa;

    const nodeMap = new Map<number, { x: number; y: number; u: number; v: number }>();
    for (const n of res.mesh.nodes) {
      nodeMap.set(n.id, { x: n.x, y: n.y, u: n.u || 0, v: n.v || 0 });
    }

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#0f172a;font-family:sans-serif;">\n`;

    // Cabeçalho
    svg += `  <text x="30" y="35" fill="#f8fafc" font-size="16" font-weight="bold">CALDRA CAD — ANÁLISE ESTRUTURAL FEA (TENSÕES DE VON MISES)</text>\n`;
    svg += `  <text x="30" y="55" fill="#94a3b8" font-size="12">Peça: ${res.partName} | Material: ${res.material.name} | Espessura: ${res.thicknessMm} mm</text>\n`;

    // Malha com preenchimento colorido por elemento
    svg += `  <g id="elements">\n`;
    for (const el of res.mesh.elements) {
      const nA = nodeMap.get(el.nodeIds[0])!;
      const nB = nodeMap.get(el.nodeIds[1])!;
      const nC = nodeMap.get(el.nodeIds[2])!;

      const pA = toScreen(nA.x, nA.y);
      const pB = toScreen(nB.x, nB.y);
      const pC = toScreen(nC.x, nC.y);

      const vm = el.stress?.vonMises || 0;
      const t = (vm - minVM) / (maxVM - minVM || 1);
      const color = this.getFeaColor(t);

      svg += `    <polygon points="${pA.sx.toFixed(1)},${pA.sy.toFixed(1)} ${pB.sx.toFixed(1)},${pB.sy.toFixed(1)} ${pC.sx.toFixed(1)},${pC.sy.toFixed(1)}" fill="${color}" fill-opacity="0.85" stroke="#1e293b" stroke-width="0.75" />\n`;
    }
    svg += `  </g>\n`;

    // Barra de Legenda de Cores (Colorbar)
    const legX = width - 110;
    const legY = 90;
    const legH = 260;
    const numSteps = 20;

    svg += `  <g id="legend">\n`;
    svg += `    <text x="${legX}" y="${legY - 15}" fill="#f8fafc" font-size="11" font-weight="bold">Von Mises (MPa)</text>\n`;

    for (let i = 0; i < numSteps; i++) {
      const tTop = 1 - i / numSteps;
      const tBot = 1 - (i + 1) / numSteps;
      const stepH = legH / numSteps;
      const color = this.getFeaColor((tTop + tBot) / 2);
      svg += `    <rect x="${legX}" y="${legY + i * stepH}" width="22" height="${stepH + 0.5}" fill="${color}" />\n`;
    }
    svg += `    <rect x="${legX}" y="${legY}" width="22" height="${legH}" fill="none" stroke="#64748b" stroke-width="1" />\n`;

    // Escala numérica da legenda
    const numLabels = 5;
    for (let i = 0; i <= numLabels; i++) {
      const frac = 1 - i / numLabels;
      const val = minVM + frac * (maxVM - minVM);
      const py = legY + i * (legH / numLabels);
      svg += `    <text x="${legX + 28}" y="${py + 4}" fill="#cbd5e1" font-size="10">${val.toFixed(1)}</text>\n`;
    }
    svg += `  </g>\n`;

    // Quadro de Resultados e FOS no rodapé
    const statusColor = res.status === "SAFE" ? "#22c55e" : res.status === "MARGINAL" ? "#f59e0b" : "#ef4444";
    svg += `  <g id="summary" transform="translate(30, ${height - 50})">\n`;
    svg += `    <rect width="${width - 60}" height="35" rx="6" fill="#1e293b" stroke="${statusColor}" stroke-width="1.5" />\n`;
    svg += `    <text x="15" y="22" fill="${statusColor}" font-size="12" font-weight="bold">${res.status === "SAFE" ? "● SEGURO" : res.status === "MARGINAL" ? "▲ MARGINAL" : "✖ FALHA ESTRUTURAL"}</text>\n`;
    svg += `    <text x="120" y="22" fill="#f8fafc" font-size="12">FOS Mínimo: <tspan font-weight="bold">${res.minFactorOfSafety}</tspan> | Tensão Máx: <tspan font-weight="bold">${res.maxVonMisesMPa} MPa</tspan> | Escoamento fy: <tspan font-weight="bold">${res.yieldStrengthMPa} MPa</tspan> | Flecha: <tspan font-weight="bold">${res.maxDeflectionMm} mm</tspan></text>\n`;
    svg += `  </g>\n`;

    svg += `</svg>`;
    return svg;
  }
}
