/**
 * CALDRA CAD — FAI & BALLOONED DRAWING EXPORTER (FASE 14)
 *
 * Exportador industrial de documentação de metrologia:
 * - Relatório FAI (First Article Inspection) / PPAP em formato CSV para Excel/ERP;
 * - Prancha de Inspeção Baloneada em SVG técnico (com balões numerados #1, #2, #3,
 *   carimbo técnico de controle de qualidade, tabela de cotas e tolerâncias).
 */

import type { FirstArticleInspectionReport, InspectionPoint } from "./types";
import { GdtEngine } from "./gdtEngine";

export class FaiReportExporter {
  /**
   * Exporta a tabela completa de inspeção dimensional em formato CSV (padrão FAI / PPAP).
   */
  static exportToCSV(report: FirstArticleInspectionReport): string {
    const lines: string[] = [];

    // Cabeçalho da Empresa / Projeto
    lines.push(`"RELATORIO DE INSPECÃO DE PRIMEIRO ARTIGO (FAI / PPAP) - CALDRA CAD"`);
    lines.push(`"Peça:","${report.partName}","Código:","${report.partId}","Revisão:","${report.revision}"`);
    lines.push(`"Inspetor:","${report.inspectorName}","Data:","${report.date}","Classe Tol:","${report.toleranceClass}"`);
    lines.push(`"Material:","${report.material}","Espessura:","${report.thickness} mm"`);
    lines.push(`"Total Cotas:","${report.summary.totalDimensions}","Aprovadas:","${report.summary.passed}","Reprovadas:","${report.summary.failed}","Conformidade:","${report.summary.conformanceRate}%"`);
    lines.push(`"Veredito Geral:","${report.summary.overallVerdict}"`);
    if (report.capability) {
      lines.push(`"Índice Cp:","${report.capability.cp}","Índice Cpk:","${report.capability.cpk}","Desvio Padrão:","${report.capability.stdDev}"`);
    }
    lines.push("");

    // Colunas da Tabela FAI
    lines.push(
      `"Balão (#)","Característica / Cota","Tipo","Nominal","Tol (+/-)","Mínimo","Máximo","Medido","Desvio","Instrumento","Status","Notas / GD&T"`,
    );

    report.points.forEach((pt: InspectionPoint) => {
      const min = Number((pt.nominal + pt.lowerTol).toFixed(3));
      const max = Number((pt.nominal + pt.upperTol).toFixed(3));
      const measuredStr = pt.measured !== undefined ? pt.measured.toFixed(3) : "Pendente";
      const devStr = pt.deviation !== undefined ? pt.deviation.toFixed(3) : "-";
      const gdtDesc = pt.gdtFrame ? GdtEngine.formatFeatureControlFrame(pt.gdtFrame) : pt.notes || "";

      lines.push(
        `"#${pt.balloonNumber}","${pt.label}","${pt.type}","${pt.nominal}","+${pt.upperTol} / ${pt.lowerTol}","${min}","${max}","${measuredStr}","${devStr}","${pt.instrument}","${pt.status}","${gdtDesc.replace(/"/g, '""')}"`,
      );
    });

    return lines.join("\n");
  }

  /**
   * Exporta a Prancha Vetorial de Inspeção Baloneada (Bubble Sheet) em SVG técnico.
   */
  static exportToInspectionSVG(
    report: FirstArticleInspectionReport,
    width = 1100,
    height = 780,
  ): string {
    const margin = 40;
    const drawingW = width - 2 * margin;
    const drawingH = height - 2 * margin;

    const svgParts: string[] = [];

    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #0F172A; font-family: 'JetBrains Mono', monospace;">`,
    );

    // Borda da Prancha Industrial
    svgParts.push(`
      <rect x="${margin}" y="${margin}" width="${drawingW}" height="${drawingH}" fill="none" stroke="#334155" stroke-width="2" />
      <rect x="${margin + 4}" y="${margin + 4}" width="${drawingW - 8}" height="${drawingH - 8}" fill="none" stroke="#1E293B" stroke-width="1" />
    `);

    // Título e Carimbo de Qualidade
    svgParts.push(`
      <!-- Carimbo de Inspeção de Qualidade CALDRA -->
      <g transform="translate(${margin + 20}, ${margin + 30})">
        <text x="0" y="0" font-size="16" font-weight="bold" fill="#38BDF8" letter-spacing="1.5">CALDRA METROLOGY &amp; QUALITY ASSURANCE</text>
        <text x="0" y="20" font-size="11" fill="#94A3B8">PRANCHA DE INSPEÇÃO DIMENSIONAL (BALLOONED DRAWING) — FAI / PPAP</text>
        <text x="0" y="38" font-size="10" fill="#64748B">PEÇA: <tspan fill="#F8FAFC" font-weight="bold">${report.partName}</tspan> | REV: <tspan fill="#38BDF8">${report.revision}</tspan> | CLASSE: <tspan fill="#F8FAFC">${report.toleranceClass}</tspan> | DATA: <tspan fill="#94A3B8">${report.date}</tspan></text>
      </g>
    `);

    // Veredito Badge no canto superior direito
    const verdictColor =
      report.summary.overallVerdict === "APPROVED"
        ? "#22C55E"
        : report.summary.overallVerdict === "CONDITIONALLY_APPROVED"
          ? "#EAB308"
          : report.summary.overallVerdict === "REJECTED"
            ? "#EF4444"
            : "#64748B";

    svgParts.push(`
      <g transform="translate(${width - margin - 220}, ${margin + 20})">
        <rect width="200" height="46" rx="6" fill="#1E293B" stroke="${verdictColor}" stroke-width="1.5" />
        <text x="100" y="20" font-size="9" fill="#94A3B8" text-anchor="middle" letter-spacing="1">STATUS DE CONFORMIDADE</text>
        <text x="100" y="36" font-size="12" font-weight="bold" fill="${verdictColor}" text-anchor="middle">${report.summary.overallVerdict}</text>
      </g>
    `);

    // Área do Desenho Técnico com Balões de Inspeção
    const viewCenter = { x: margin + 300, y: height / 2 + 10 };
    const partSize = 240;

    svgParts.push(`
      <!-- Contorno da Peça -->
      <g transform="translate(${viewCenter.x - partSize / 2}, ${viewCenter.y - partSize / 2})">
        <rect width="${partSize}" height="${partSize}" rx="4" fill="#1E293B" fill-opacity="0.4" stroke="#38BDF8" stroke-width="2" stroke-dasharray="0" />
        
        <!-- Datums A e B de Referência -->
        <line x1="-15" y1="${partSize}" x2="${partSize + 15}" y2="${partSize}" stroke="#EAB308" stroke-width="2" />
        <text x="${partSize + 25}" y="${partSize + 4}" fill="#EAB308" font-size="12" font-weight="bold">[DATUM A]</text>
        <line x1="0" y1="-15" x2="0" y2="${partSize + 15}" stroke="#EAB308" stroke-width="2" />
        <text x="-15" y="-20" fill="#EAB308" font-size="12" font-weight="bold">[DATUM B]</text>
      </g>
    `);

    // Renderização dos Balões Numerados (#1, #2, ...)
    report.points.forEach((pt: InspectionPoint, i: number) => {
      // Posiciona os balões em torno da peça
      const angle = (i / Math.max(1, report.points.length)) * Math.PI * 2;
      const radius = partSize * 0.72;
      const bx = viewCenter.x + radius * Math.cos(angle);
      const by = viewCenter.y + radius * Math.sin(angle);

      const targetX = viewCenter.x + (partSize * 0.4) * Math.cos(angle);
      const targetY = viewCenter.y + (partSize * 0.4) * Math.sin(angle);

      const balloonStroke =
        pt.status === "PASS"
          ? "#22C55E"
          : pt.status === "WARNING"
            ? "#EAB308"
            : pt.status === "FAIL"
              ? "#EF4444"
              : "#0284C7";

      svgParts.push(`
        <!-- Balão #${pt.balloonNumber} -->
        <line x1="${bx}" y1="${by}" x2="${targetX}" y2="${targetY}" stroke="#475569" stroke-width="1.2" stroke-dasharray="2,2" />
        <circle cx="${targetX}" cy="${targetY}" r="3" fill="#38BDF8" />
        <circle cx="${bx}" cy="${by}" r="14" fill="#0F172A" stroke="${balloonStroke}" stroke-width="2" />
        <text x="${bx}" y="${by + 4.5}" font-size="11" font-weight="bold" fill="#F8FAFC" text-anchor="middle">${pt.balloonNumber}</text>
      `);
    });

    // Tabela Lateral de Balões & Cotas
    const tableX = width - margin - 380;
    const tableY = margin + 85;
    const rowH = 22;

    svgParts.push(`
      <g transform="translate(${tableX}, ${tableY})">
        <rect width="360" height="${Math.min(560, (report.points.length + 1) * rowH + 10)}" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="12" y="16" font-size="10" font-weight="bold" fill="#38BDF8" letter-spacing="1">MAPA DE COTAS E BALÕES</text>
        <line x1="0" y1="24" x2="360" y2="24" stroke="#334155" stroke-width="1" />
        
        <text x="12" y="38" font-size="9" fill="#64748B">#</text>
        <text x="36" y="38" font-size="9" fill="#64748B">CARACTERÍSTICA</text>
        <text x="210" y="38" font-size="9" fill="#64748B">NOMINAL</text>
        <text x="280" y="38" font-size="9" fill="#64748B">TOLERÂNCIA</text>
    `);

    report.points.slice(0, 22).forEach((pt: InspectionPoint, idx: number) => {
      const y = 56 + idx * rowH;
      const tolText = `+${pt.upperTol}/${pt.lowerTol}`;
      svgParts.push(`
        <g transform="translate(0, ${y})">
          <circle cx="16" cy="-4" r="7" fill="#0F172A" stroke="#38BDF8" stroke-width="1.2" />
          <text x="16" y="-1.5" font-size="8" font-weight="bold" fill="#F8FAFC" text-anchor="middle">${pt.balloonNumber}</text>
          <text x="36" y="0" font-size="8.5" fill="#E2E8F0">${pt.label.length > 25 ? pt.label.slice(0, 24) + "…" : pt.label}</text>
          <text x="210" y="0" font-size="8.5" fill="#38BDF8">${pt.nominal}</text>
          <text x="280" y="0" font-size="8" fill="#94A3B8">${tolText}</text>
        </g>
      `);
    });

    svgParts.push(`</g>`);

    // Rodapé de Conformidade
    svgParts.push(`
      <g transform="translate(${margin + 20}, ${height - margin - 20})">
        <text x="0" y="0" font-size="10" fill="#94A3B8">Índice de Conformidade FAI: <tspan fill="${verdictColor}" font-weight="bold">${report.summary.conformanceRate}%</tspan> (${report.summary.passed}/${report.summary.totalDimensions} cotas aprovadas) | Instrumentos: Paquímetro, Micrômetro, Goniômetro, CMM</text>
      </g>
    `);

    svgParts.push(`</svg>`);

    return svgParts.join("\n");
  }
}
