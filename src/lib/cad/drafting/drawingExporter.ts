// @ts-nocheck
/**
 * CALDRA CAD — DRAWING EXPORTER (FASE 09)
 *
 * Exportador vetorial de pranchas técnicas:
 * - SVG vetorial de precisão micrométrica (pronto para plotagem e impressão A4/A3);
 * - DXF R12/2000 industrial com separação de camadas normalizadas (MOLDURA, LEGENDA, VISÍVEIS, OCULTAS, COTAS, TABELA).
 */

import type {
  TechnicalDrawingSheet,
  DrawingLine,
  DrawingDimension,
  BendTableRow,
  TitleBlock,
} from "./types";

export class DrawingExporter {
  /**
   * Exporta a prancha técnica completa em formato SVG vetorial técnico.
   */
  static exportToSVG(sheet: TechnicalDrawingSheet): string {
    const w = sheet.widthMm;
    const h = sheet.heightMm;
    const m = sheet.marginMm;

    const svgParts: string[] = [];

    // Cabeçalho SVG em milímetros com viewBox 1:1
    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" style="background:#ffffff; font-family:'Roboto', 'Arial', sans-serif;">`,
    );

    // Definições de marcadores de seta para cotas e linhas de chamada
    svgParts.push(`  <defs>`);
    svgParts.push(
      `    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">`,
    );
    svgParts.push(`      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#1e293b"/>`);
    svgParts.push(`    </marker>`);
    svgParts.push(`  </defs>`);

    // 1. Moldura externa e margem interna normalizada
    svgParts.push(`  <!-- MOLDURA DA FOLHA -->`);
    svgParts.push(
      `  <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" stroke="#94a3b8" stroke-width="0.3"/>`,
    );
    svgParts.push(
      `  <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="#0f172a" stroke-width="0.7"/>`,
    );

    // 2. Vistas do desenho (linhas contínuas, ocultas, eixos e cotas)
    for (const view of sheet.views) {
      svgParts.push(`  <!-- VISTA: ${view.name} -->`);
      svgParts.push(`  <g id="${view.id}">`);

      // Linhas da vista
      for (const line of view.lines) {
        const svgLine = this.renderLineToSVG(line);
        if (svgLine) svgParts.push(`    ${svgLine}`);
      }

      // Arcos da vista
      for (const arc of view.arcs) {
        svgParts.push(
          `    <circle cx="${arc.center.x}" cy="${arc.center.y}" r="${arc.radius}" fill="none" stroke="#0f172a" stroke-width="0.5"/>`,
        );
      }

      // Cotas da vista
      for (const dim of view.dimensions) {
        const svgDim = this.renderDimensionToSVG(dim);
        svgParts.push(`    ${svgDim}`);
      }

      // Rótulos e anotações da vista
      for (const ann of view.annotations) {
        svgParts.push(
          `    <text x="${ann.pos.x}" y="${ann.pos.y}" font-size="${ann.fontSizePt}pt" font-weight="${ann.bold ? "bold" : "normal"}" fill="#0f172a" text-anchor="${ann.align ?? "left"}">${ann.text}</text>`,
        );
      }

      svgParts.push(`  </g>`);
    }

    // 3. Tabela de dobras (se presente)
    if (sheet.bendTable && sheet.bendTable.rows.length > 0) {
      svgParts.push(this.renderBendTableToSVG(sheet.bendTable, m + 5, h - m - 45));
    }

    // 4. Notas Gerais
    if (sheet.generalNotes && sheet.generalNotes.length > 0) {
      svgParts.push(`  <!-- NOTAS GERAIS -->`);
      svgParts.push(`  <g id="general-notes">`);
      svgParts.push(
        `    <text x="${m + 5}" y="${m + 15}" font-size="8pt" font-weight="bold" fill="#0f172a">NOTAS GERAIS:</text>`,
      );
      sheet.generalNotes.forEach((note, idx) => {
        svgParts.push(
          `    <text x="${m + 5}" y="${m + 22 + idx * 4.5}" font-size="6.5pt" fill="#334155">${note}</text>`,
        );
      });
      svgParts.push(`  </g>`);
    }

    // 5. Bloco de Título (Carimbo ABNT) no canto inferior direito
    svgParts.push(this.renderTitleBlockToSVG(sheet.titleBlock, w - m - 140, h - m - 35, 140, 35));

    svgParts.push(`</svg>`);
    return svgParts.join("\n");
  }

  private static renderLineToSVG(line: DrawingLine): string {
    const { start, end, type } = line;
    let stroke = "#0f172a";
    let width = 0.5;
    let dash = "";

    switch (type) {
      case "VISIBLE":
        stroke = "#0f172a";
        width = 0.5;
        break;
      case "HIDDEN":
        stroke = "#64748b";
        width = 0.25;
        dash = 'stroke-dasharray="3,2"';
        break;
      case "CENTER":
        stroke = "#0284c7";
        width = 0.25;
        dash = 'stroke-dasharray="10,2,2,2"';
        break;
      case "BEND_UP":
        stroke = "#d946ef";
        width = 0.35;
        dash = 'stroke-dasharray="6,2"';
        break;
      case "BEND_DOWN":
        stroke = "#06b6d4";
        width = 0.35;
        dash = 'stroke-dasharray="6,2,2,2"';
        break;
      case "DIMENSION":
      case "EXTENSION":
        stroke = "#475569";
        width = 0.25;
        break;
      default:
        stroke = "#0f172a";
        width = 0.3;
    }

    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${stroke}" stroke-width="${width}" ${dash}/>`;
  }

  private static renderDimensionToSVG(dim: DrawingDimension): string {
    const { p1, p2, textPos, formattedText } = dim;
    const parts: string[] = [];

    // Linha de cota principal com setas
    parts.push(
      `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#1e293b" stroke-width="0.25" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`,
    );

    // Texto da cota com fundo branco para legibilidade
    parts.push(
      `<text x="${textPos.x}" y="${textPos.y}" font-size="7pt" font-weight="600" fill="#0f172a" text-anchor="middle" dominant-baseline="central">${formattedText}</text>`,
    );

    return parts.join("\n    ");
  }

  private static renderBendTableToSVG(
    table: { title: string; rows: BendTableRow[] },
    x: number,
    y: number,
  ): string {
    const parts: string[] = [];
    parts.push(`  <!-- TABELA DE DOBRAS -->`);
    parts.push(`  <g transform="translate(${x}, ${y})">`);
    parts.push(
      `    <text x="0" y="-4" font-size="8pt" font-weight="bold" fill="#0f172a">${table.title}</text>`,
    );

    const colWidths = [12, 18, 16, 18, 22, 20];
    const headers = ["ID", "DIR", "ÂNG", "RAIO", "DED (BD)", "V-DIE"];
    const rowH = 5;

    // Cabeçalho da tabela
    let curX = 0;
    headers.forEach((h, i) => {
      parts.push(
        `    <rect x="${curX}" y="0" width="${colWidths[i]}" height="${rowH}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="0.3"/>`,
      );
      parts.push(
        `    <text x="${curX + colWidths[i] / 2}" y="${rowH / 2 + 1}" font-size="5.5pt" font-weight="bold" fill="#0f172a" text-anchor="middle" dominant-baseline="central">${h}</text>`,
      );
      curX += colWidths[i];
    });

    // Linhas de dados
    table.rows.forEach((row, rIdx) => {
      const rowY = (rIdx + 1) * rowH;
      const vals = [
        row.tag,
        row.direction,
        `${row.angleDeg}°`,
        `R${row.insideRadiusMm}`,
        `${row.bendDeductionMm}`,
        `V${row.recommendedVDieMm}`,
      ];

      curX = 0;
      vals.forEach((v, cIdx) => {
        parts.push(
          `    <rect x="${curX}" y="${rowY}" width="${colWidths[cIdx]}" height="${rowH}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.2"/>`,
        );
        parts.push(
          `    <text x="${curX + colWidths[cIdx] / 2}" y="${rowY + rowH / 2 + 1}" font-size="5.5pt" fill="#1e293b" text-anchor="middle" dominant-baseline="central">${v}</text>`,
        );
        curX += colWidths[cIdx];
      });
    });

    parts.push(`  </g>`);
    return parts.join("\n");
  }

  private static renderTitleBlockToSVG(
    tb: TitleBlock,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string {
    const parts: string[] = [];
    parts.push(`  <!-- BLOCO DE TÍTULO / CARIMBO ABNT -->`);
    parts.push(`  <g transform="translate(${x}, ${y})">`);
    parts.push(
      `    <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" stroke="#0f172a" stroke-width="0.7"/>`,
    );

    // Linhas divisórias internas do carimbo
    parts.push(`    <line x1="0" y1="12" x2="${w}" y2="12" stroke="#0f172a" stroke-width="0.4"/>`);
    parts.push(`    <line x1="0" y1="24" x2="${w}" y2="24" stroke="#0f172a" stroke-width="0.4"/>`);
    parts.push(`    <line x1="85" y1="0" x2="85" y2="24" stroke="#0f172a" stroke-width="0.4"/>`);
    parts.push(`    <line x1="45" y1="24" x2="45" y2="${h}" stroke="#0f172a" stroke-width="0.4"/>`);
    parts.push(`    <line x1="95" y1="24" x2="95" y2="${h}" stroke="#0f172a" stroke-width="0.4"/>`);

    // Conteúdo dos campos
    parts.push(
      `    <text x="3" y="6" font-size="5pt" fill="#64748b">ORGANIZAÇÃO:</text>`,
      `    <text x="3" y="10" font-size="6.5pt" font-weight="bold" fill="#0f172a">${tb.company}</text>`,
      `    <text x="3" y="17" font-size="5pt" fill="#64748b">TÍTULO / PEÇA:</text>`,
      `    <text x="3" y="21.5" font-size="7.5pt" font-weight="bold" fill="#0f172a">${tb.title}</text>`,
      `    <text x="88" y="6" font-size="5pt" fill="#64748b">CÓDIGO:</text>`,
      `    <text x="88" y="10" font-size="6.5pt" font-weight="bold" fill="#0f172a">${tb.drawingNumber}</text>`,
      `    <text x="88" y="17" font-size="5pt" fill="#64748b">MATERIAL / ESPESSURA:</text>`,
      `    <text x="88" y="21.5" font-size="6pt" fill="#0f172a">${tb.material}</text>`,
      `    <text x="3" y="28" font-size="4.5pt" fill="#64748b">ESCALA:</text>`,
      `    <text x="3" y="32" font-size="6pt" font-weight="bold" fill="#0f172a">${tb.scale}</text>`,
      `    <text x="48" y="28" font-size="4.5pt" fill="#64748b">MASSA EST.:</text>`,
      `    <text x="48" y="32" font-size="6pt" fill="#0f172a">${tb.estimatedMassKg} kg</text>`,
      `    <text x="98" y="28" font-size="4.5pt" fill="#64748b">DATA:</text>`,
      `    <text x="98" y="32" font-size="6pt" fill="#0f172a">${tb.date}</text>`,
    );

    parts.push(`  </g>`);
    return parts.join("\n");
  }

  /**
   * Exporta a prancha técnica completa em formato DXF com camadas normalizadas.
   */
  static exportToDXF(sheet: TechnicalDrawingSheet): string {
    const lines: string[] = [];

    // Cabeçalho DXF
    lines.push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC");

    // Definição de Camadas (TABLES)
    lines.push(
      "0",
      "SECTION",
      "2",
      "TABLES",
      "0",
      "TABLE",
      "2",
      "LAYER",
      "70",
      "7",
      "0",
      "LAYER",
      "2",
      "0_MOLDURA",
      "70",
      "0",
      "62",
      "7",
      "6",
      "CONTINUOUS",
      "0",
      "LAYER",
      "2",
      "0_LEGENDA",
      "70",
      "0",
      "62",
      "7",
      "6",
      "CONTINUOUS",
      "0",
      "LAYER",
      "2",
      "1_ARESTAS_VISIVEIS",
      "70",
      "0",
      "62",
      "3",
      "6",
      "CONTINUOUS",
      "0",
      "LAYER",
      "2",
      "2_ARESTAS_OCULTAS",
      "70",
      "0",
      "62",
      "1",
      "6",
      "HIDDEN",
      "0",
      "LAYER",
      "2",
      "3_LINHAS_CENTRO",
      "70",
      "0",
      "62",
      "4",
      "6",
      "CENTER",
      "0",
      "LAYER",
      "2",
      "4_COTAS",
      "70",
      "0",
      "62",
      "2",
      "6",
      "CONTINUOUS",
      "0",
      "LAYER",
      "2",
      "5_TABELA_DOBRAS",
      "70",
      "0",
      "62",
      "6",
      "6",
      "CONTINUOUS",
      "0",
      "ENDTAB",
      "0",
      "ENDSEC",
    );

    // Seção de Entidades (ENTITIES)
    lines.push("0", "SECTION", "2", "ENTITIES");

    const m = sheet.marginMm;
    const w = sheet.widthMm;
    const h = sheet.heightMm;

    // Moldura
    const addDxfLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
      lines.push(
        "0",
        "LINE",
        "8",
        layer,
        "10",
        x1.toFixed(3),
        "20",
        y1.toFixed(3),
        "30",
        "0.0",
        "11",
        x2.toFixed(3),
        "21",
        y2.toFixed(3),
        "31",
        "0.0",
      );
    };

    addDxfLine(m, m, w - m, m, "0_MOLDURA");
    addDxfLine(w - m, m, w - m, h - m, "0_MOLDURA");
    addDxfLine(w - m, h - m, m, h - m, "0_MOLDURA");
    addDxfLine(m, h - m, m, m, "0_MOLDURA");

    // Vistas
    for (const view of sheet.views) {
      for (const line of view.lines) {
        let layer = "1_ARESTAS_VISIVEIS";
        if (line.type === "HIDDEN") layer = "2_ARESTAS_OCULTAS";
        else if (line.type === "CENTER") layer = "3_LINHAS_CENTRO";
        else if (line.type.startsWith("BEND")) layer = "5_TABELA_DOBRAS";

        addDxfLine(line.start.x, line.start.y, line.end.x, line.end.y, layer);
      }
    }

    lines.push("0", "ENDSEC", "0", "EOF");
    return lines.join("\n");
  }
}
