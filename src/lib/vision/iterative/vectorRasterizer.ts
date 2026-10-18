// @ts-nocheck
/**
 * CALDRA VISION — VECTOR RASTERIZER
 *
 * Rasterizador puro em software de alto desempenho para converter primitivas
 * vetoriais (Prim[]) em uma máscara binária (Uint8Array) de resolução idêntica à imagem original.
 * Totalmente compatível com Web Workers (zero dependências de Canvas/DOM).
 */

import type { Prim } from "../geometryRecognizer";

export class VectorRasterizer {
  /**
   * Rasteriza uma lista de primitivas vetoriais em uma máscara binária (1 = tinta/traço, 0 = fundo).
   * @param prims Primitivas geométricas em coordenadas de pixel.
   * @param width Largura da imagem em pixels.
   * @param height Altura da imagem em pixels.
   * @param strokeWidth Espessura do traço rasterizado em pixels (padrão: 2).
   */
  static rasterize(prims: Prim[], width: number, height: number, strokeWidth = 2): Uint8Array {
    const mask = new Uint8Array(width * height);
    const radius = Math.max(1, Math.floor(strokeWidth * 0.5));

    const setPixel = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      mask[y * width + x] = 1;
    };

    const drawThickPixel = (cx: number, cy: number) => {
      const ix = Math.round(cx);
      const iy = Math.round(cy);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius + 1) {
            setPixel(ix + dx, iy + dy);
          }
        }
      }
    };

    const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      let cx = Math.round(x0);
      let cy = Math.round(y0);
      const targetX = Math.round(x1);
      const targetY = Math.round(y1);

      while (true) {
        drawThickPixel(cx, cy);
        if (cx === targetX && cy === targetY) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          cx += sx;
        }
        if (e2 < dx) {
          err += dx;
          cy += sy;
        }
      }
    };

    const drawCircle = (cx: number, cy: number, r: number) => {
      const circumference = 2 * Math.PI * r;
      const stepCount = Math.max(16, Math.ceil(circumference * 1.5));
      const angleStep = (2 * Math.PI) / stepCount;

      for (let i = 0; i < stepCount; i++) {
        const theta = i * angleStep;
        const px = cx + r * Math.cos(theta);
        const py = cy + r * Math.sin(theta);
        drawThickPixel(px, py);
      }
    };

    const drawArc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
      // Normaliza ângulos
      const start = a0;
      let end = a1;
      while (end < start) end += 2 * Math.PI;
      const span = end - start;

      const arcLength = span * r;
      const stepCount = Math.max(8, Math.ceil(arcLength * 1.5));
      const angleStep = span / stepCount;

      for (let i = 0; i <= stepCount; i++) {
        const theta = start + i * angleStep;
        const px = cx + r * Math.cos(theta);
        const py = cy + r * Math.sin(theta);
        drawThickPixel(px, py);
      }
    };

    for (const prim of prims) {
      switch (prim.kind) {
        case "line":
          drawLine(prim.x1, prim.y1, prim.x2, prim.y2);
          break;

        case "circle":
          drawCircle(prim.cx, prim.cy, prim.r);
          break;

        case "arc":
          drawArc(prim.cx, prim.cy, prim.r, prim.a0, prim.a1);
          break;

        case "polyline":
          if (prim.pts.length >= 2) {
            for (let i = 0; i < prim.pts.length - 1; i++) {
              drawLine(prim.pts[i].x, prim.pts[i].y, prim.pts[i + 1].x, prim.pts[i + 1].y);
            }
            if (prim.closed) {
              const last = prim.pts[prim.pts.length - 1];
              const first = prim.pts[0];
              drawLine(last.x, last.y, first.x, first.y);
            }
          }
          break;
      }
    }

    return mask;
  }
}
