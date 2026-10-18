/**
 * CALDRA — GERADOR DE PDF VETORIAL E RENDERIZADOR DE FOLHA TÉCNICA
 *
 * Converte um TechnicalSheetDocument em:
 * 1. PDF Vetorial Real via jsPDF (linhas limpas, textos vetoriais, zoom infinito).
 * 2. SVG Vetorial de Alta Fidelidade para pré-visualização interativa e inspeção.
 */

import { jsPDF } from "jspdf";
import type {
  TechnicalSheetDocument,
  TechnicalLine,
  TechnicalDimension,
  TechnicalView,
  SheetTheme,
} from "./technicalSheetEngine";

/** Cores normativas da folha técnica (impressão profissional) */
const INK_DARK = "#111827"; // Preto técnico para linhas visíveis e quadro
const INK_MUTED = "#6B7280"; // Cinza técnico para eixos e linhas de chamada
const INK_CENTER = "#4B5563"; // Eixo de centro (dash-dot)
const INK_FOLD = "#2563EB"; // Linhas de dobra / planificação (azul técnico de dobra)
const INK_DIM = "#1F2937"; // Linhas e textos de cota

/** Cores para visualização Blueprint (modo tela/inspeção escura) */
const BP_BG = "#0B0F17";
const BP_LINE = "#E2E8F0";
const BP_MUTED = "#94A3B8";
const BP_CENTER = "#38BDF8";
const BP_ACCENT = "#F59E0B";

/**
 * Desenha setas de cota mecânicas em uma linha dimensional.
 */
function drawDimensionArrow(
  doc: jsPDF,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  size = 2.0,
) {
  const angle = Math.atan2(dirY, dirX);
  const arrowAngle = Math.PI / 7;
  const x1 = x - size * Math.cos(angle - arrowAngle);
  const y1 = y - size * Math.sin(angle - arrowAngle);
  const x2 = x - size * Math.cos(angle + arrowAngle);
  const y2 = y - size * Math.sin(angle + arrowAngle);

  doc.line(x, y, x1, y1);
  doc.line(x, y, x2, y2);
}

/**
 * Gera e baixa o arquivo PDF vetorial real da folha técnica.
 */
export async function downloadTechnicalSheetPdf(
  sheet: TechnicalSheetDocument,
  filename?: string,
): Promise<void> {
  const doc = new jsPDF({
    orientation: sheet.orientation,
    unit: "mm",
    format: sheet.paperSize.toLowerCase(),
  });

  doc.setLineCap("round");
  doc.setLineJoin("round");

  const m = sheet.margin;
  const sw = sheet.sheetW;
  const sh = sheet.sheetH;

  // 1. Moldura externa da folha (NBR 10068)
  doc.setDrawColor(INK_DARK);
  doc.setLineWidth(0.6);
  doc.rect(m, m, sw - m * 2, sh - m * 2);

  // Margem interna fina de desenho
  doc.setLineWidth(0.2);
  doc.rect(m + 1.5, m + 1.5, sw - m * 2 - 3, sh - m * 2 - 3);

  // 2. Cabeçalho Normativo Superior
  if (sheet.header) {
    const hy = m + 6;
    doc.setTextColor(INK_DARK);
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text(sheet.header.brand, m + 4, hy);

    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(`|  ${sheet.header.pieceName}`, m + 26, hy);

    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(INK_MUTED);
    doc.text(sheet.header.classification, m + 4, hy + 4.5);

    doc.setFontSize(6);
    doc.text(sheet.header.standard, sw - m - 4, hy, { align: "right" });

    // Linha divisória horizontal do cabeçalho
    doc.setDrawColor(INK_MUTED);
    doc.setLineWidth(0.18);
    doc.line(m + 2, m + 12, sw - m - 2, m + 12);
  }

  // 3. Renderização de cada Vista Técnica
  for (const v of sheet.views) {
    const vx = v.ox;
    const vy = v.oy;
    const s = v.scale;

    // Título da Vista
    doc.setTextColor(INK_DARK);
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.text(v.title, vx, vy + v.height * 0.46, { align: "center" });

    // Subtítulos (Escala da vista, etc.)
    if (v.subtitles && v.subtitles.length > 0) {
      doc.setFont("courier", "normal");
      doc.setFontSize(6);
      doc.setTextColor(INK_MUTED);
      v.subtitles.forEach((sub, i) => {
        doc.text(sub, vx, vy + v.height * 0.46 + 3.0 * (i + 1), { align: "center" });
      });
    }

    // Linhas geométricas
    for (const l of v.lines) {
      const lx1 = vx + l.x1 * s;
      const ly1 = vy + l.y1 * s;
      const lx2 = vx + l.x2 * s;
      const ly2 = vy + l.y2 * s;

      if (l.style === "center") {
        doc.setDrawColor(INK_CENTER);
        doc.setLineWidth(0.18);
        doc.setLineDashPattern([4, 1.2, 1, 1.2], 0);
      } else if (l.style === "fold") {
        doc.setDrawColor(INK_FOLD);
        doc.setLineWidth(0.18);
        doc.setLineDashPattern([2, 1.5], 0);
      } else if (l.style === "hidden") {
        doc.setDrawColor(INK_MUTED);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([2, 1], 0);
      } else if (l.style === "border") {
        doc.setDrawColor(INK_MUTED);
        doc.setLineWidth(0.15);
        doc.setLineDashPattern([1.5, 1], 0);
      } else {
        doc.setDrawColor(INK_DARK);
        doc.setLineWidth(0.38); // Linha visível contínua encorpada
        doc.setLineDashPattern([], 0);
      }

      doc.line(lx1, ly1, lx2, ly2);
    }

    // Cotas associativas da vista
    doc.setLineDashPattern([], 0);
    for (const d of v.dimensions) {
      doc.setDrawColor(INK_DIM);
      doc.setLineWidth(0.18);
      doc.setTextColor(INK_DIM);
      doc.setFont("courier", "bold");
      doc.setFontSize(6.5);

      if (d.type === "horizontal") {
        const x1 = vx + d.x1 * s;
        const x2 = vx + d.x2 * s;
        const y = vy + d.dimPos * s;
        const origY = vy + d.y1 * s;

        // Linhas de extensão (chamada)
        doc.line(x1, origY, x1, y + (y > origY ? 2 : -2));
        doc.line(x2, origY, x2, y + (y > origY ? 2 : -2));
        // Linha de cota
        doc.line(x1, y, x2, y);
        // Setas mecânicas
        drawDimensionArrow(doc, x1, y, 1, 0, 1.8);
        drawDimensionArrow(doc, x2, y, -1, 0, 1.8);
        // Texto
        doc.text(d.valueText, (x1 + x2) / 2, y - 1.2, { align: "center" });
      } else if (d.type === "vertical") {
        const y1 = vy + d.y1 * s;
        const y2 = vy + d.y2 * s;
        const x = vx + d.dimPos * s;
        const origX = vx + d.x1 * s;

        doc.line(origX, y1, x + (x > origX ? 2 : -2), y1);
        doc.line(origX, y2, x + (x > origX ? 2 : -2), y2);
        doc.line(x, y1, x, y2);
        drawDimensionArrow(doc, x, y1, 0, 1, 1.8);
        drawDimensionArrow(doc, x, y2, 0, -1, 1.8);

        // Texto vertical rotacionado
        doc.text(d.valueText, x - 1.2, (y1 + y2) / 2, { align: "center", angle: 90 });
      } else {
        // Alinhada
        const x1 = vx + d.x1 * s;
        const y1 = vy + d.y1 * s;
        const x2 = vx + d.x2 * s;
        const y2 = vy + d.y2 * s;
        doc.line(x1, y1, x2, y2);
        doc.text(d.valueText, (x1 + x2) / 2, (y1 + y2) / 2 - 1.5, { align: "center" });
      }
    }
  }

  // 4. Notas Técnicas
  const tb = sheet.titleBlock;
  const notesX = m + 4;
  const notesY = tb.by - 3 - sheet.notes.length * 3.2;

  doc.setTextColor(INK_DARK);
  doc.setFont("courier", "bold");
  doc.setFontSize(7.5);
  doc.text("NOTAS TÉCNICAS:", notesX, notesY - 2);

  doc.setFont("courier", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(INK_MUTED);
  sheet.notes.forEach((note, idx) => {
    doc.text(note, notesX, notesY + 3.0 * idx);
  });

  // 5. Quadro Técnico Padronizado CALDRA (Title Block)
  doc.setDrawColor(INK_DARK);
  doc.setLineWidth(0.45);
  doc.rect(tb.bx, tb.by, tb.bw, tb.bh);

  const colW = tb.bw / 4;
  const rowH = tb.bh / 3;

  // Grade interna do quadro técnico
  doc.setLineWidth(0.2);
  for (let c = 1; c < 4; c++) {
    doc.line(tb.bx + c * colW, tb.by, tb.bx + c * colW, tb.by + tb.bh);
  }
  for (let r = 1; r < 3; r++) {
    doc.line(tb.bx, tb.by + r * rowH, tb.bx + tb.bw, tb.by + r * rowH);
  }

  // Logomarca e Identificação CALDRA no canto superior esquerdo do quadro
  doc.setTextColor(INK_DARK);
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text("CALDRA", tb.bx + 4, tb.by + rowH * 0.45);
  doc.setFontSize(5.2);
  doc.setTextColor(INK_MUTED);
  doc.text("TRAÇADO & PLANIFICAÇÃO ZERO FRESTA", tb.bx + 4, tb.by + rowH * 0.8);

  // Preenchimento de cada célula do quadro
  for (const f of tb.fields) {
    const fx = tb.bx + f.col * colW + 3;
    const fy = tb.by + f.row * rowH;

    doc.setFont("courier", "normal");
    doc.setFontSize(5);
    doc.setTextColor(INK_MUTED);
    doc.text(f.title, fx, fy + rowH * 0.35);

    doc.setFont("courier", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(INK_DARK);
    doc.text(f.value, fx, fy + rowH * 0.78);
  }

  // Nome final do arquivo
  const safeName = sheet.modelName.replace(/\s+/g, "_").toUpperCase();
  const outName = filename || `CALDRA_${safeName}_FOLHA_TECNICA.pdf`;

  doc.save(outName);
}

/**
 * Renderiza o SVG vetorial da folha técnica completa para preview na tela.
 */
export function renderTechnicalSheetSvg(
  sheet: TechnicalSheetDocument,
  themeOverride?: SheetTheme,
): string {
  const theme = themeOverride || sheet.theme;
  const isBp = theme === "blueprint";

  const bg = isBp ? BP_BG : "#FFFFFF";
  const ink = isBp ? BP_LINE : INK_DARK;
  const muted = isBp ? BP_MUTED : INK_MUTED;
  const centerColor = isBp ? BP_CENTER : INK_CENTER;
  const foldColor = isBp ? BP_ACCENT : INK_FOLD;
  const dimColor = isBp ? BP_LINE : INK_DIM;

  const m = sheet.margin;
  const sw = sheet.sheetW;
  const sh = sheet.sheetH;

  const tb = sheet.titleBlock;
  const colW = tb.bw / 4;
  const rowH = tb.bh / 3;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sw} ${sh}" width="100%" height="100%" style="background:${bg};font-family:ui-monospace, monospace;">`;

  // Defs para setas mecânicas
  svg += `<defs>
    <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
      <path d="M 10 1.5 L 0 5 L 10 8.5 z" fill="${dimColor}" />
    </marker>
    <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto">
      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${dimColor}" />
    </marker>
  </defs>`;

  // Fundo
  svg += `<rect width="${sw}" height="${sh}" fill="${bg}" />`;

  // Margem e moldura externa
  svg += `<rect x="${m}" y="${m}" width="${sw - m * 2}" height="${sh - m * 2}" fill="none" stroke="${ink}" stroke-width="0.6" />`;
  svg += `<rect x="${m + 1.5}" y="${m + 1.5}" width="${sw - m * 2 - 3}" height="${sh - m * 2 - 3}" fill="none" stroke="${muted}" stroke-width="0.2" />`;

  // Cabeçalho Superior
  if (sheet.header) {
    const hy = m + 6;
    svg += `<g id="header-block">`;
    svg += `<text x="${m + 4}" y="${hy}" font-size="3.8" font-weight="bold" fill="${ink}" letter-spacing="0.5">${sheet.header.brand}</text>`;
    svg += `<text x="${m + 26}" y="${hy}" font-size="3.2" font-weight="bold" fill="${ink}">|  ${sheet.header.pieceName}</text>`;
    svg += `<text x="${m + 4}" y="${hy + 4.5}" font-size="2.2" fill="${muted}">${sheet.header.classification}</text>`;
    svg += `<text x="${sw - m - 4}" y="${hy}" font-size="2.2" fill="${muted}" text-anchor="end">${sheet.header.standard}</text>`;
    svg += `<line x1="${m + 2}" y1="${m + 12}" x2="${sw - m - 2}" y2="${m + 12}" stroke="${muted}" stroke-width="0.18" />`;
    svg += `</g>`;
  }

  // Vistas
  for (const v of sheet.views) {
    const vx = v.ox;
    const vy = v.oy;
    const s = v.scale;

    svg += `<g id="view-${v.id}">`;

    // Linhas
    for (const l of v.lines) {
      const x1 = vx + l.x1 * s;
      const y1 = vy + l.y1 * s;
      const x2 = vx + l.x2 * s;
      const y2 = vy + l.y2 * s;

      let color = ink;
      let width = 0.38;
      let dash = "";

      if (l.style === "center") {
        color = centerColor;
        width = 0.18;
        dash = 'stroke-dasharray="4,1.2,1,1.2"';
      } else if (l.style === "fold") {
        color = foldColor;
        width = 0.18;
        dash = 'stroke-dasharray="2,1.5"';
      } else if (l.style === "hidden") {
        color = muted;
        width = 0.2;
        dash = 'stroke-dasharray="2,1"';
      } else if (l.style === "border") {
        color = muted;
        width = 0.15;
        dash = 'stroke-dasharray="1.5,1"';
      }

      svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="${width}" ${dash} stroke-linecap="round" />`;
    }

    // Cotas
    for (const d of v.dimensions) {
      if (d.type === "horizontal") {
        const x1 = vx + d.x1 * s;
        const x2 = vx + d.x2 * s;
        const y = vy + d.dimPos * s;
        const origY = vy + d.y1 * s;
        svg += `<line x1="${x1.toFixed(2)}" y1="${origY.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${(y + (y > origY ? 2 : -2)).toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" />`;
        svg += `<line x1="${x2.toFixed(2)}" y1="${origY.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${(y + (y > origY ? 2 : -2)).toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" />`;
        svg += `<line x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" marker-start="url(#dim-arrow-start)" marker-end="url(#dim-arrow-end)" />`;
        svg += `<text x="${((x1 + x2) / 2).toFixed(2)}" y="${(y - 1.2).toFixed(2)}" font-size="2.4" font-weight="bold" fill="${dimColor}" text-anchor="middle">${d.valueText}</text>`;
      } else if (d.type === "vertical") {
        const y1 = vy + d.y1 * s;
        const y2 = vy + d.y2 * s;
        const x = vx + d.dimPos * s;
        const origX = vx + d.x1 * s;
        svg += `<line x1="${origX.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${(x + (x > origX ? 2 : -2)).toFixed(2)}" y2="${y1.toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" />`;
        svg += `<line x1="${origX.toFixed(2)}" y1="${y2.toFixed(2)}" x2="${(x + (x > origX ? 2 : -2)).toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" />`;
        svg += `<line x1="${x.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" marker-start="url(#dim-arrow-start)" marker-end="url(#dim-arrow-end)" />`;
        svg += `<text x="${(x - 1.2).toFixed(2)}" y="${((y1 + y2) / 2).toFixed(2)}" font-size="2.4" font-weight="bold" fill="${dimColor}" text-anchor="middle" transform="rotate(-90 ${x - 1.2} ${(y1 + y2) / 2})">${d.valueText}</text>`;
      } else {
        const x1 = vx + d.x1 * s;
        const y1 = vy + d.y1 * s;
        const x2 = vx + d.x2 * s;
        const y2 = vy + d.y2 * s;
        svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${dimColor}" stroke-width="0.18" marker-start="url(#dim-arrow-start)" marker-end="url(#dim-arrow-end)" />`;
        svg += `<text x="${((x1 + x2) / 2).toFixed(2)}" y="${((y1 + y2) / 2 - 1.5).toFixed(2)}" font-size="2.4" font-weight="bold" fill="${dimColor}" text-anchor="middle">${d.valueText}</text>`;
      }
    }

    // Título e subtítulos da vista
    svg += `<text x="${vx.toFixed(2)}" y="${(vy + v.height * 0.46).toFixed(2)}" font-size="3.0" font-weight="bold" fill="${ink}" text-anchor="middle">${v.title}</text>`;
    if (v.subtitles) {
      v.subtitles.forEach((sub, i) => {
        svg += `<text x="${vx.toFixed(2)}" y="${(vy + v.height * 0.46 + 2.8 * (i + 1)).toFixed(2)}" font-size="2.0" fill="${muted}" text-anchor="middle">${sub}</text>`;
      });
    }

    svg += `</g>`;
  }

  // Notas Técnicas
  const notesX = m + 4;
  const notesY = tb.by - 3 - sheet.notes.length * 3.2;
  svg += `<text x="${notesX}" y="${notesY - 2}" font-size="2.6" font-weight="bold" fill="${ink}">NOTAS TÉCNICAS:</text>`;
  sheet.notes.forEach((note, idx) => {
    svg += `<text x="${notesX}" y="${notesY + 3.0 * idx}" font-size="2.0" fill="${muted}">${note}</text>`;
  });

  // Quadro Técnico (Title Block)
  svg += `<g id="title-block">`;
  svg += `<rect x="${tb.bx}" y="${tb.by}" width="${tb.bw}" height="${tb.bh}" fill="none" stroke="${ink}" stroke-width="0.5" />`;
  for (let c = 1; c < 4; c++) {
    svg += `<line x1="${tb.bx + c * colW}" y1="${tb.by}" x2="${tb.bx + c * colW}" y2="${tb.by + tb.bh}" stroke="${ink}" stroke-width="0.2" />`;
  }
  for (let r = 1; r < 3; r++) {
    svg += `<line x1="${tb.bx}" y1="${tb.by + r * rowH}" x2="${tb.bx + tb.bw}" y2="${tb.by + r * rowH}" stroke="${ink}" stroke-width="0.2" />`;
  }

  // Logo CALDRA
  svg += `<text x="${tb.bx + 4}" y="${tb.by + rowH * 0.45}" font-size="4.2" font-weight="bold" fill="${ink}" letter-spacing="1">CALDRA</text>`;
  svg += `<text x="${tb.bx + 4}" y="${tb.by + rowH * 0.8}" font-size="1.9" fill="${muted}">TRAÇADO & PLANIFICAÇÃO ZERO FRESTA</text>`;

  // Células
  for (const f of tb.fields) {
    const fx = tb.bx + f.col * colW + 3;
    const fy = tb.by + f.row * rowH;
    svg += `<text x="${fx}" y="${fy + rowH * 0.35}" font-size="1.9" fill="${muted}">${f.title}</text>`;
    svg += `<text x="${fx}" y="${fy + rowH * 0.78}" font-size="2.6" font-weight="bold" fill="${ink}">${f.value}</text>`;
  }
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}
