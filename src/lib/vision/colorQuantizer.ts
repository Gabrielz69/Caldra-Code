/**
 * colorQuantizer — reduz a paleta de uma imagem e gera uma máscara binária
 * por cor. Cada máscara alimenta o traçado independentemente, para que cada
 * cor da logo vire uma camada própria no CAD.
 */

import type { Binary } from "./imagePreprocessor";

export type Swatch = { hex: string; r: number; g: number; b: number; share: number };

const hex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** K-means simples sobre pixels opacos, com semente por amostragem regular. */
export function quantize(image: ImageData, k: number, ignoreBackground = true): Swatch[] {
  const { data, width, height } = image;
  const px: [number, number, number][] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]! / 255;
      if (a < 0.35) continue;
      px.push([
        data[i]! * a + 255 * (1 - a),
        data[i + 1]! * a + 255 * (1 - a),
        data[i + 2]! * a + 255 * (1 - a),
      ]);
    }
  }
  if (!px.length) return [];

  const kk = Math.max(1, Math.min(k, 8));
  const centers: [number, number, number][] = [];
  for (let i = 0; i < kk; i++) centers.push([...px[Math.floor((i + 0.5) * (px.length / kk))]!]);

  const assign = new Int32Array(px.length);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < kk; c++) {
        const d =
          (px[i]![0] - centers[c]![0]) ** 2 +
          (px[i]![1] - centers[c]![1]) ** 2 +
          (px[i]![2] - centers[c]![2]) ** 2;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    const sums: number[][] = Array.from({ length: kk }, () => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) {
      const s = sums[assign[i]!]!;
      const p = px[i]!;
      s[0] = s[0]! + p[0];
      s[1] = s[1]! + p[1];
      s[2] = s[2]! + p[2];
      s[3] = s[3]! + 1;
    }
    for (let c = 0; c < kk; c++) {
      const s = sums[c]!;
      if (s[3]) centers[c] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    }
  }

  const counts = new Array(kk).fill(0);
  for (let i = 0; i < px.length; i++) counts[assign[i]!]++;

  let out: Swatch[] = centers.map((c, i) => ({
    hex: hex(c[0], c[1], c[2]),
    r: c[0],
    g: c[1],
    b: c[2],
    share: counts[i] / px.length,
  }));
  out.sort((a, b) => b.share - a.share);

  if (ignoreBackground && out.length > 1) {
    // a cor mais clara e mais frequente costuma ser o fundo da logo
    const bg = out.find((s) => s.share > 0.35 && (s.r + s.g + s.b) / 3 > 200);
    if (bg) out = out.filter((s) => s !== bg);
  }
  return out;
}

/** Máscara binária dos pixels mais próximos de uma cor da paleta. */
export function maskForSwatch(image: ImageData, palette: Swatch[], index: number): Binary {
  const { data, width, height } = image;
  const out = new Uint8Array(width * height);
  const target = palette[index];
  if (!target) return { data: out, width, height };
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const a = data[i + 3]! / 255;
    if (a < 0.35) continue;
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    let best = -1;
    let bd = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const s = palette[c]!;
      const d = (r - s.r) ** 2 + (g - s.g) ** 2 + (b - s.b) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    // pixels muito distantes de toda a paleta são fundo
    if (best === index && bd < 90 * 90 * 3) out[p] = 1;
  }
  return { data: out, width, height };
}
