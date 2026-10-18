/**
 * imagePreprocessor — etapa 1 da pipeline CHAMFER VISION.
 *
 * Converte um arquivo de imagem em um buffer binário (preto/branco) pronto
 * para análise. Todos os cálculos aqui acontecem em PIXELS; a conversão para
 * milímetros ocorre apenas no geometryNormalizer.
 */

export type Binary = {
  /** 1 = tinta (geometria), 0 = fundo. */
  data: Uint8Array;
  width: number;
  height: number;
};

export type PreprocessOptions = {
  /** Rotação aplicada antes da análise, em graus (0/90/180/270 ou livre). */
  rotationDeg?: number;
  /** Recorte normalizado (0..1) sobre a imagem já rotacionada. */
  crop?: { x: number; y: number; w: number; h: number };
  /** Maior dimensão do buffer analisado (limita custo). */
  maxSize?: number;
  /** Inverte tinta/fundo quando o desenho é claro sobre fundo escuro. */
  invert?: boolean;
  /** Ampliação antes da binarização (modo LOGO: 2–4×). */
  upscale?: number;
  /** Raio do desfoque gaussiano aplicado antes do limiar (px). */
  blur?: number;
  /** Limiar manual 0–255; ausente = Otsu automático. */
  threshold?: number;
};

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function isAcceptedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    fr.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida ou corrompida."));
    img.src = src;
  });
}

/** Desenha a imagem aplicando rotação/recorte e devolve os pixels RGBA. */
export function rasterize(img: HTMLImageElement, opt: PreprocessOptions = {}) {
  const rot = (((opt.rotationDeg ?? 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const rw = swap ? img.naturalHeight : img.naturalWidth;
  const rh = swap ? img.naturalWidth : img.naturalHeight;

  const crop = opt.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cw = Math.max(1, Math.round(rw * crop.w));
  const ch = Math.max(1, Math.round(rh * crop.h));

  const max = opt.maxSize ?? 1400;
  const up = Math.max(1, Math.min(4, opt.upscale ?? 1));
  const scale = Math.min(up, (max * up) / Math.max(cw, ch));
  const W = Math.max(1, Math.round(cw * scale));
  const H = Math.max(1, Math.round(ch * scale));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponível neste dispositivo.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-rw * crop.x, -rh * crop.y);
  ctx.translate(rw / 2, rh / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  return { ctx, width: W, height: H, pixels: ctx.getImageData(0, 0, W, H) };
}

/** Limiar automático de Otsu sobre o histograma de luminância. */
function otsu(hist: number[], total: number) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * (hist[i] ?? 0);
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t] ?? 0;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * (hist[t] ?? 0);
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Converte a imagem em máscara binária (1 = traço). */
export function binarize(image: ImageData, invert = false): Binary {
  const { width, height, data } = image;
  const gray = new Uint8Array(width * height);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]! / 255;
    // pixels transparentes contam como fundo branco
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gray[p] = v;
    hist[v] = (hist[v] ?? 0) + 1;
  }
  const t = otsu(hist, width * height);
  const out = new Uint8Array(width * height);
  let ink = 0;
  for (let p = 0; p < out.length; p++) {
    const isInk = invert ? gray[p]! > t : gray[p]! <= t;
    out[p] = isInk ? 1 : 0;
    ink += out[p]!;
  }
  // desenho invertido (fundo escuro): se mais de 60% virou "tinta", inverte
  if (!invert && ink > out.length * 0.6) {
    for (let p = 0; p < out.length; p++) out[p] = out[p] ? 0 : 1;
  }
  return { data: out, width, height };
}

/** Remove pontos isolados (ruído sal e pimenta) por abertura morfológica leve. */
export function denoise(bin: Binary, strength = 1): Binary {
  if (strength <= 0) return bin;
  const { width: w, height: h } = bin;
  let src = bin.data;
  for (let pass = 0; pass < strength; pass++) {
    const out = new Uint8Array(src.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!src[i]) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (!(dx === 0 && dy === 0)) n += src[i + dy * w + dx]!;
        out[i] = n >= 2 ? 1 : 0;
      }
    }
    src = out;
  }
  return { data: src, width: w, height: h };
}

/**
 * Desfoque gaussiano separável — remove o "mosquito noise" de bordas em JPG
 * antes do limiar, evitando ondulação no contorno cortado.
 */
export function gaussianBlur(image: ImageData, radius: number): ImageData {
  const r = Math.max(0, Math.min(4, radius));
  if (r < 0.1) return image;
  const { width: w, height: h } = image;
  const src = new Float32Array(w * h * 4);
  for (let i = 0; i < src.length; i++) src[i] = image.data[i]!;

  const sigma = r;
  const k = Math.max(1, Math.ceil(r * 2));
  const kernel: number[] = [];
  let sum = 0;
  for (let i = -k; i <= k; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] = kernel[i]! / sum;

  const tmp = new Float32Array(src.length);
  const pass = (input: Float32Array, output: Float32Array, horizontal: boolean) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 4; c++) {
          let acc = 0;
          for (let i = -k; i <= k; i++) {
            const sx = horizontal ? Math.min(w - 1, Math.max(0, x + i)) : x;
            const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + i));
            acc += input[(sy * w + sx) * 4 + c]! * kernel[i + k]!;
          }
          output[(y * w + x) * 4 + c] = acc;
        }
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, src, false);

  const out = new ImageData(w, h);
  for (let i = 0; i < out.data.length; i++) out.data[i] = Math.round(src[i]!);
  return out;
}

/** Limiar fixo (0–255) sobre a luminância — usado quando há prévia manual. */
export function thresholdBinarize(image: ImageData, threshold: number, invert = false): Binary {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]! / 255;
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    out[p] = (invert ? v > threshold : v <= threshold) ? 1 : 0;
  }
  return { data: out, width, height };
}

/** Fechamento morfológico leve: tapa microfuros internos do traço. */
export function closeHoles(bin: Binary, passes = 1): Binary {
  let cur = bin;
  for (let n = 0; n < passes; n++) {
    const { width: w, height: h } = cur;
    const dil = new Uint8Array(cur.data.length);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        dil[i] =
          cur.data[i] || cur.data[i - 1] || cur.data[i + 1] || cur.data[i - w] || cur.data[i + w]
            ? 1
            : 0;
      }
    const ero = new Uint8Array(dil.length);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        ero[i] = dil[i] && dil[i - 1] && dil[i + 1] && dil[i - w] && dil[i + w] ? 1 : 0;
      }
    cur = { data: ero, width: w, height: h };
  }
  return cur;
}

/**
 * Normalização de contraste por percentis (2%–98%) — abre o histograma antes
 * do limiar sem estourar o traço, útil em fotos lavadas ou escaneadas fracas.
 */
export function normalizeContrast(image: ImageData): ImageData {
  const { width: w, height: h, data } = image;
  const hist = new Uint32Array(256);
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]! / 255;
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[p] = v;
    const bi = Math.max(0, Math.min(255, Math.round(v)));
    hist[bi] = (hist[bi] ?? 0) + 1;
  }
  const total = w * h;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    if (acc >= total * 0.02) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i]!;
    if (acc >= total * 0.02) {
      hi = i;
      break;
    }
  }
  const range = Math.max(8, hi - lo);
  const out =
    typeof ImageData !== "undefined"
      ? new ImageData(w, h)
      : ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData);
  for (let p = 0; p < lum.length; p++) {
    const v = Math.max(0, Math.min(255, ((lum[p]! - lo) / range) * 255));
    const i = p * 4;
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  return out;
}

/**
 * Limiar ADAPTATIVO local (Sauvola) via imagens integrais.
 * t(x,y) = m * (1 + k * (s / R - 1)) — compensa iluminação irregular sem
 * inventar manchas em áreas de fundo liso.
 */
export function sauvolaBinarize(
  image: ImageData,
  opt: { window?: number; k?: number; invert?: boolean } = {},
): Binary {
  const { width: w, height: h, data } = image;
  const k = opt.k ?? 0.3;
  const win = Math.max(7, Math.round(opt.window ?? Math.max(15, Math.min(w, h) * 0.035)) | 1);
  const rad = (win - 1) >> 1;

  const gray = new Float64Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]! / 255;
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const iw = w + 1;
  const sum = new Float64Array(iw * (h + 1));
  const sqr = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rs = 0;
    let rq = 0;
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x]!;
      rs += v;
      rq += v * v;
      sum[(y + 1) * iw + x + 1] = sum[y * iw + x + 1]! + rs;
      sqr[(y + 1) * iw + x + 1] = sqr[y * iw + x + 1]! + rq;
    }
  }
  const area = (acc: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    acc[(y1 + 1) * iw + x1 + 1]! -
    acc[y0 * iw + x1 + 1]! -
    acc[(y1 + 1) * iw + x0]! +
    acc[y0 * iw + x0]!;

  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rad);
    const y1 = Math.min(h - 1, y + rad);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rad);
      const x1 = Math.min(w - 1, x + rad);
      const n = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s1 = area(sum, x0, y0, x1, y1);
      const s2 = area(sqr, x0, y0, x1, y1);
      const mean = s1 / n;
      const std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
      const t = mean * (1 + k * (std / 128 - 1));
      const ink = gray[y * w + x]! <= t;
      out[y * w + x] = (opt.invert ? !ink : ink) ? 1 : 0;
    }
  }
  return { data: out, width: w, height: h };
}

/** Reamostragem bilinear — base da análise MULTI-ESCALA. */
export function resampleImageData(image: ImageData, factor: number): ImageData {
  const f = Math.max(0.05, factor);
  if (Math.abs(f - 1) < 1e-3) return image;
  const { width: w, height: h, data } = image;
  const nw = Math.max(1, Math.round(w * f));
  const nh = Math.max(1, Math.round(h * f));
  const out = new ImageData(nw, nh);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, (y + 0.5) / f - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, (x + 0.5) / f - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const a = data[(y0 * w + x0) * 4 + c]! * (1 - fx) + data[(y0 * w + x1) * 4 + c]! * fx;
        const b = data[(y1 * w + x0) * 4 + c]! * (1 - fx) + data[(y1 * w + x1) * 4 + c]! * fx;
        out.data[(y * nw + x) * 4 + c] = Math.round(a * (1 - fy) + b * fy);
      }
    }
  }
  return out;
}
