/**
 * perspectiveCorrectionService — correção de perspectiva por 4 pontos.
 * Usado antes da vetorização quando a imagem é uma fotografia inclinada.
 */

export type Quad = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];

/** Resolve a homografia que leva o quadrilátero (px) para um retângulo w×h. */
export function computeHomography(src: Quad, w: number, h: number): number[] | null {
  const dst: Quad = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i]!;
    const d = dst[i]!;
    A.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    b.push(d.x);
    A.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    b.push(d.y);
  }
  // eliminação de Gauss com pivotamento parcial
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    if (Math.abs(M[piv]![c]!) < 1e-9) return null;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const pv = M[c]![c]!;
    for (let k = c; k <= n; k++) M[c]![k] = M[c]![k]! / pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r]![k] = M[r]![k]! - f * M[c]![k]!;
    }
  }
  return [...M.map((row) => row[n]!), 1];
}

/** Aplica a correção e devolve um novo dataURL retificado. */
export function warpToRect(
  img: HTMLImageElement,
  quad: Quad,
  out: { w: number; h: number },
): string | null {
  const H = computeHomography(quad, out.w, out.h);
  if (!H) return null;
  // invertemos a homografia para amostrar a origem a partir do destino
  const inv = invert3x3(H);
  if (!inv) return null;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  const sctx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0);
  const src = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

  const dst = document.createElement("canvas");
  dst.width = Math.round(out.w);
  dst.height = Math.round(out.h);
  const dctx = dst.getContext("2d");
  if (!dctx) return null;
  const outImg = dctx.createImageData(dst.width, dst.height);

  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const den = inv[6]! * x + inv[7]! * y + inv[8]!;
      const sx = Math.round((inv[0]! * x + inv[1]! * y + inv[2]!) / den);
      const sy = Math.round((inv[3]! * x + inv[4]! * y + inv[5]!) / den);
      const di = (y * dst.width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) {
        outImg.data[di] = 255;
        outImg.data[di + 1] = 255;
        outImg.data[di + 2] = 255;
        outImg.data[di + 3] = 255;
        continue;
      }
      const si = (sy * src.width + sx) * 4;
      outImg.data[di] = src.data[si]!;
      outImg.data[di + 1] = src.data[si + 1]!;
      outImg.data[di + 2] = src.data[si + 2]!;
      outImg.data[di + 3] = src.data[si + 3]!;
    }
  }
  dctx.putImageData(outImg, 0, 0);
  return dst.toDataURL("image/png");
}

function invert3x3(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  return [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ];
}
