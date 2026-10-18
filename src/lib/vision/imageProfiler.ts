/**
 * imageProfiler — análise pré-flight do CHAMFER VISION.
 *
 * Lê a imagem UMA vez e devolve um retrato objetivo dela (resolução,
 * contraste, ruído, espessura média de traço, uniformidade de fundo) mais uma
 * SUGESTÃO de modo e de parâmetros. Nada é aplicado automaticamente — a UI só
 * mostra o relatório e o botão "USAR SUGESTÃO".
 */

import type { Tolerance } from "./geometryRecognizer";
import type { TurnPolicy } from "./logoTracer";

export type ImageProfile = {
  widthPx: number;
  heightPx: number;
  /** Menor dimensão < 600 px. */
  small: boolean;
  /** Separação entre tinta e fundo, 0–1 (quanto maior, melhor). */
  contrast: number;
  /** Energia de alta frequência normalizada, 0–1 (quanto maior, mais ruído). */
  noise: number;
  /** Espessura média do traço, em px. */
  strokePx: number;
  /** Proporção de pixels de tinta. */
  inkRatio: number;
  /** Desvio da luminância do fundo entre blocos — alto = iluminação irregular. */
  backgroundSpread: number;
  uniformBackground: boolean;
  /** Limiar de Otsu calculado. */
  otsu: number;
  /** Imagem com poucos tons (arte chapada) → cara de logo. */
  flatArt: boolean;
};

export type VisionSuggestion = {
  mode: "tecnico" | "logo" | "tracado";
  threshold: number;
  invert: boolean;
  tolerance: Tolerance;
  noise: number;
  upscale: number;
  blur: number;
  turdsize: number;
  alphamax: number;
  opttolerance: number;
  turnpolicy: TurnPolicy;
  /** Usar limiar local (Sauvola) em vez do global. */
  adaptive: boolean;
  normalize: boolean;
  reasons: string[];
};

function luminance(data: Uint8ClampedArray, i: number) {
  const a = data[i + 3]! / 255;
  const r = data[i]! * a + 255 * (1 - a);
  const g = data[i + 1]! * a + 255 * (1 - a);
  const b = data[i + 2]! * a + 255 * (1 - a);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function otsuOf(hist: Float64Array, total: number) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = -1;
  let t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  return t;
}

/** Retrato completo da imagem já rasterizada. */
export function profileImage(image: ImageData): ImageProfile {
  const { width: w, height: h, data } = image;
  const gray = new Float32Array(w * h);
  const hist = new Float64Array(256);
  for (let p = 0; p < gray.length; p++) {
    const v = luminance(data, p * 4);
    gray[p] = v;
    const bi = Math.max(0, Math.min(255, Math.round(v)));
    hist[bi] = (hist[bi] ?? 0) + 1;
  }
  const total = w * h;
  const otsu = otsuOf(hist, total);

  // contraste: distância entre a média do escuro e a média do claro
  let dSum = 0,
    dN = 0,
    lSum = 0,
    lN = 0;
  for (let p = 0; p < gray.length; p++) {
    if (gray[p]! <= otsu) {
      dSum += gray[p]!;
      dN++;
    } else {
      lSum += gray[p]!;
      lN++;
    }
  }
  const dark = dN ? dSum / dN : 0;
  const light = lN ? lSum / lN : 255;
  const contrast = Math.max(0, Math.min(1, (light - dark) / 255));
  const inkRatio = dN / total;

  // ruído: energia laplaciana média nas regiões de fundo
  let noiseAcc = 0;
  let noiseN = 0;
  for (let y = 1; y < h - 1; y += 2)
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      if (gray[i]! <= otsu) continue;
      const lap = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
      noiseAcc += Math.abs(lap);
      noiseN++;
    }
  const noise = Math.max(0, Math.min(1, noiseN ? noiseAcc / noiseN / 60 : 0));

  // espessura média do traço: comprimento médio das corridas de tinta por linha
  let runs = 0;
  let runPx = 0;
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 200))) {
    let cur = 0;
    for (let x = 0; x < w; x++) {
      const ink = gray[y * w + x]! <= otsu;
      if (ink) cur++;
      else if (cur) {
        runs++;
        runPx += cur;
        cur = 0;
      }
    }
    if (cur) {
      runs++;
      runPx += cur;
    }
  }
  const strokePx = runs ? runPx / runs : 0;

  // uniformidade do fundo: variação da luminância clara entre blocos 8×8
  const bx = 8;
  const means: number[] = [];
  for (let by = 0; by < bx; by++)
    for (let bxi = 0; bxi < bx; bxi++) {
      let s = 0;
      let n = 0;
      const x0 = Math.floor((bxi * w) / bx);
      const x1 = Math.floor(((bxi + 1) * w) / bx);
      const y0 = Math.floor((by * h) / bx);
      const y1 = Math.floor(((by + 1) * h) / bx);
      for (let y = y0; y < y1; y += 2)
        for (let x = x0; x < x1; x += 2) {
          const v = gray[y * w + x]!;
          if (v > otsu) {
            s += v;
            n++;
          }
        }
      if (n > 8) means.push(s / n);
    }
  const mAvg = means.reduce((a, b) => a + b, 0) / Math.max(1, means.length);
  const backgroundSpread = Math.sqrt(
    means.reduce((a, b) => a + (b - mAvg) ** 2, 0) / Math.max(1, means.length),
  );

  // arte chapada: poucos tons dominam a imagem
  const sorted = Array.from(hist).sort((a, b) => b - a);
  const top = (sorted[0]! + (sorted[1] ?? 0) + (sorted[2] ?? 0) + (sorted[3] ?? 0)) / total;

  return {
    widthPx: w,
    heightPx: h,
    small: Math.min(w, h) < 600,
    contrast,
    noise,
    strokePx,
    inkRatio,
    backgroundSpread,
    uniformBackground: backgroundSpread < 12,
    otsu,
    flatArt: top > 0.55,
  };
}

/** Sugestão de modo e parâmetros a partir do retrato da imagem. */
export function suggestFromProfile(p: ImageProfile): VisionSuggestion {
  const reasons: string[] = [];

  let mode: VisionSuggestion["mode"] = "tecnico";
  if (p.flatArt && p.strokePx > 6 && p.inkRatio > 0.06) {
    mode = "logo";
    reasons.push("Arte chapada com traço grosso — curvas de Bézier preservam melhor a forma.");
  } else if (!p.uniformBackground && p.strokePx > 1.5 && p.strokePx < 14) {
    mode = "tracado";
    reasons.push("Fundo irregular com traço fino — linha central evita contornos duplos.");
  } else {
    reasons.push("Traço definido sobre fundo uniforme — reconhecimento técnico é o mais preciso.");
  }

  const adaptive = !p.uniformBackground;
  if (adaptive) reasons.push("Iluminação irregular: limiar adaptativo (local) recomendado.");

  const normalize = p.contrast < 0.45;
  if (normalize) reasons.push("Contraste baixo: normalização antes do limiar.");

  const upscale = p.small ? (Math.min(p.widthPx, p.heightPx) < 320 ? 4 : 3) : 2;
  if (p.small) reasons.push("Resolução baixa: ampliação automática antes de binarizar.");

  const blur = p.noise > 0.35 ? 2 : p.noise > 0.18 ? 1 : 0;
  if (blur) reasons.push("Ruído de compressão detectado: suavização leve antes do limiar.");

  const noise = p.noise > 0.35 ? 2 : p.noise > 0.12 ? 1 : 0;
  const tolerance: Tolerance = p.noise > 0.3 ? "alta" : p.strokePx > 8 ? "media" : "baixa";

  return {
    mode,
    threshold: Math.max(40, Math.min(215, Math.round(p.otsu))),
    invert: p.inkRatio > 0.6,
    tolerance,
    noise,
    upscale,
    blur,
    turdsize: p.noise > 0.3 ? 5 : 3,
    alphamax: p.flatArt ? 1 : 0.8,
    opttolerance: p.strokePx > 10 ? 0.2 : 0.15,
    turnpolicy: "minority",
    adaptive,
    normalize,
    reasons,
  };
}
