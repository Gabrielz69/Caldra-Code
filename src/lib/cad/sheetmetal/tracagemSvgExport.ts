/**
 * UTILITÁRIOS DE EXPORTAÇÃO E GEOMETRIA SVG ESTILO MODELOS DE TRAÇAGEM
 */

import type { Vec2 } from "@/lib/geometry/types";
import type { Entity } from "@/lib/lab2d/core";
import { solidShapes } from "@/lib/lab2d/solid3d";

const COS30 = Math.cos((30 * Math.PI) / 180);
const SIN30 = Math.sin((30 * Math.PI) / 180);

/** Projeção isométrica 3D em coordenadas SVG 2D */
export function toIso(x: number, y: number, z: number): Vec2 {
  return {
    x: (x - y) * COS30,
    y: (x + y) * SIN30 - z,
  };
}

/**
 * Converte qualquer peça do Chamfer em SVG puro autônomo com a estética de Traçagem
 */
export function generateTracagemSvgString(
  entities: Entity[],
  thickness: number,
  viewMode3D: "planificada" | "isometrica" = "planificada",
  title = "CALDRA CHAMFER",
): string {
  const shapes = solidShapes(entities);
  const bendLines = entities.filter((e) => e.layer === "dobra" && e.type === "line");
  const markLines = entities.filter((e) => e.layer === "marcacao" && e.type === "line");

  // Calcula bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  shapes.forEach((s) => {
    s.outline.forEach((p) => {
      const pt = viewMode3D === "isometrica" ? toIso(p.x, p.y, thickness) : p;
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });
  });

  if (minX === Infinity) {
    minX = -50;
    minY = -50;
    maxX = 50;
    maxY = 50;
  }

  const pad = Math.max(20, (maxX - minX) * 0.1);
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const vx = minX - pad;
  const vy = minY - pad;

  let content = "";

  if (viewMode3D === "isometrica") {
    shapes.forEach((s) => {
      const topPts = s.outline.map((p) => toIso(p.x, p.y, thickness));
      const botPts = s.outline.map((p) => toIso(p.x, p.y, 0));
      const topPath =
        topPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
        " Z";
      const botPath =
        botPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
        " Z";

      content += `<path d="${botPath}" fill="#06b6d4" fill-opacity="0.04" stroke="#06b6d4" stroke-opacity="0.4" stroke-width="1.2" />\n`;

      for (let i = 0; i < s.outline.length; i++) {
        const next = (i + 1) % s.outline.length;
        const p0_top = topPts[i]!;
        const p1_top = topPts[next]!;
        const p1_bot = botPts[next]!;
        const p0_bot = botPts[i]!;
        const wallD = `M ${p0_top.x.toFixed(2)} ${p0_top.y.toFixed(2)} L ${p1_top.x.toFixed(2)} ${p1_top.y.toFixed(2)} L ${p1_bot.x.toFixed(2)} ${p1_bot.y.toFixed(2)} L ${p0_bot.x.toFixed(2)} ${p0_bot.y.toFixed(2)} Z`;
        content += `<path d="${wallD}" fill="#06b6d4" fill-opacity="0.22" stroke="#06b6d4" stroke-opacity="0.75" stroke-width="1.2" />\n`;
      }

      content += `<path d="${topPath}" fill="#06b6d4" fill-opacity="0.08" stroke="#06b6d4" stroke-width="1.8" />\n`;

      s.holes.forEach((h) => {
        const hTop = h.map((p) => toIso(p.x, p.y, thickness));
        const hPath =
          hTop.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
          " Z";
        content += `<path d="${hPath}" fill="#0b0f17" stroke="#06b6d4" stroke-width="1.4" />\n`;
      });
    });
  } else {
    // Planificada
    shapes.forEach((s) => {
      const outerD =
        s.outline.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
        " Z";
      const holesD = s.holes
        .map(
          (h) =>
            h.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
            " Z",
        )
        .join(" ");
      const compoundD = `${outerD} ${holesD}`.trim();
      content += `<path d="${compoundD}" fill-rule="evenodd" fill="#06b6d4" fill-opacity="0.06" stroke="#06b6d4" stroke-width="1.8" stroke-linejoin="round" />\n`;
    });

    bendLines.forEach((bl) => {
      if (bl.type === "line") {
        content += `<line x1="${bl.x1}" y1="${bl.y1}" x2="${bl.x2}" y2="${bl.y2}" stroke="#8b5cf6" stroke-width="1.4" stroke-dasharray="6 3.5" />\n`;
      }
    });

    markLines.forEach((ml) => {
      if (ml.type === "line") {
        content += `<line x1="${ml.x1}" y1="${ml.y1}" x2="${ml.x2}" y2="${ml.y2}" stroke="#06b6d4" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="4 3" />\n`;
      }
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(2)} ${vy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm">
  <title>${title}</title>
  <rect x="${vx.toFixed(2)}" y="${vy.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#0b0f17" />
  <g>
    ${content}
  </g>
</svg>`;
}

/**
 * Dispara o download de qualquer peça convertida em arquivo SVG autônomo
 */
export function downloadTracagemSvgFile(
  filename: string,
  entities: Entity[],
  thickness: number,
  viewMode3D: "planificada" | "isometrica" = "planificada",
) {
  const svgText = generateTracagemSvgString(entities, thickness, viewMode3D, filename);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
