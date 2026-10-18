/**
 * CONFERÊNCIA DO TRAÇADO — funções puras.
 *
 * Medidas que o caldeireiro usa para conferir o traçado direto na chapa,
 * independentes do desenho de desenvolvimento.
 */

import type { EngineValues } from "./engines";
import type { GeometryResult, MetricRow } from "./types";

export type ConferenceRow = { label: string; value: number; suffix?: string; hint?: string };

/* ---------------- primitivas geométricas puras ---------------- */

export function circumference(diameterMm: number): number {
  return Math.PI * diameterMm;
}

/** Geratriz verdadeira de um cone/tronco reto. */
export function slantLength(bigD: number, smallD: number, heightMm: number): number {
  return Math.hypot(bigD / 2 - smallD / 2, heightMm);
}

/** Setor de desenvolvimento de cone/tronco reto. */
export function coneSector(bigD: number, smallD: number, heightMm: number) {
  const r1 = bigD / 2;
  const r2 = smallD / 2;
  const slant = Math.hypot(r1 - r2, heightMm);
  const outerRadius = r1 === r2 ? Infinity : (slant * r1) / (r1 - r2);
  const innerRadius = Number.isFinite(outerRadius) ? outerRadius - slant : Infinity;
  const angleRad = Number.isFinite(outerRadius) ? (2 * Math.PI * r1) / outerRadius : 0;
  const angleDeg = (angleRad * 180) / Math.PI;
  const chord = Number.isFinite(outerRadius) ? 2 * outerRadius * Math.sin(angleRad / 2) : 0;
  return { slant, outerRadius, innerRadius, angleRad, angleDeg, chord };
}

/** Curva de gomos: β por junta, braço (afastamento) e comprimentos. */
export function mitredElbow(diameterMm: number, radiusMm: number, totalDeg: number, gomos: number) {
  const total = (totalDeg * Math.PI) / 180;
  const beta = total / (2 * (gomos - 1) + 2);
  const tb = Math.tan(beta);
  const midLength = 2 * radiusMm * tb;
  const r = diameterMm / 2;
  return {
    betaDeg: (beta * 180) / Math.PI,
    jointDeg: (2 * beta * 180) / Math.PI,
    midLength,
    maxLength: midLength + 2 * r * tb,
    minLength: midLength - 2 * r * tb,
    /** Afastamento do braço na linha de centro. */
    arm: radiusMm * Math.tan(total / 2),
    /** Altura total sobre o eixo, incluindo o raio do tubo. */
    totalHeight: radiusMm * Math.tan(total / 2) + r,
  };
}

const RADIAL = new Set(["cone", "tronco-de-cone", "reducao-circular", "chamines"]);
const CYL = new Set(["cilindro", "dutos"]);
const BRANCH = new Set(["te", "interseccoes", "y"]);

function fromMetrics(metrics: MetricRow[], count = 6): ConferenceRow[] {
  return metrics.slice(0, count).map((m) => ({
    label: m.label,
    value: m.value,
    suffix: m.suffix ?? "mm",
  }));
}

/**
 * Medidas de conferência da peça. Sempre devolve entre 3 e 6 linhas.
 */
export function conferenceRows(
  slug: string,
  v: EngineValues,
  result: GeometryResult,
): ConferenceRow[] {
  if (CYL.has(slug)) {
    const D = v["d"] ?? 0;
    const H = v["h"] ?? 0;
    return [
      { label: "Circunferência", value: circumference(D), suffix: "mm", hint: "π × Ø" },
      { label: "Comprimento desenvolvido", value: circumference(D), suffix: "mm" },
      { label: "Altura do desenvolvimento", value: H, suffix: "mm" },
      { label: "Meia circunferência", value: circumference(D) / 2, suffix: "mm" },
    ];
  }

  if (RADIAL.has(slug)) {
    const D = v["d1"] ?? 0;
    const d = slug === "cone" ? 0 : (v["d2"] ?? 0);
    const H = v["h"] ?? 0;
    const s = coneSector(D, d, H);
    return [
      { label: "Geratriz", value: s.slant, suffix: "mm", hint: "√((R−r)² + H²)" },
      { label: "Raio do setor (externo)", value: s.outerRadius, suffix: "mm" },
      { label: "Raio do setor (interno)", value: s.innerRadius, suffix: "mm" },
      { label: "Ângulo do setor", value: s.angleDeg, suffix: "°" },
      { label: "Corda de referência", value: s.chord, suffix: "mm" },
      { label: "Circunferência da base", value: circumference(D), suffix: "mm" },
    ];
  }

  if (slug === "curva-de-gomos") {
    const e = mitredElbow(v["d"] ?? 0, v["r"] ?? 0, v["ang"] ?? 90, Math.round(v["gomos"] ?? 4));
    return [
      { label: "Altura total", value: e.totalHeight, suffix: "mm" },
      { label: "Afastamento (braço)", value: e.arm, suffix: "mm", hint: "R × tg(α/2)" },
      { label: "Raio da curva", value: v["r"] ?? 0, suffix: "mm" },
      { label: "Gomo — comprimento médio", value: e.midLength, suffix: "mm" },
      { label: "Gomo — geratriz máxima", value: e.maxLength, suffix: "mm" },
      { label: "Gomo — geratriz mínima", value: e.minLength, suffix: "mm" },
    ];
  }

  if (BRANCH.has(slug)) {
    const d = v["d2"] ?? 0;
    const cut = result.metrics.find((m) => m.label.startsWith("Recuo"))?.value ?? 0;
    return [
      { label: "Circunferência da derivação", value: circumference(d), suffix: "mm" },
      { label: "Circunferência do principal", value: circumference(v["d1"] ?? 0), suffix: "mm" },
      { label: "Recuo máximo (boca)", value: cut, suffix: "mm" },
      { label: "Altura útil mínima", value: (v["h"] ?? 0) - cut, suffix: "mm" },
      { label: "Ângulo do ramal", value: v["ang"] ?? 90, suffix: "°" },
    ];
  }

  if (slug === "boca-de-lobo") {
    const D = v["d"] ?? 0;
    return [
      { label: "Circunferência", value: circumference(D), suffix: "mm" },
      { label: "Geratriz máxima", value: v["h2"] ?? 0, suffix: "mm" },
      { label: "Geratriz mínima", value: v["h1"] ?? 0, suffix: "mm" },
      { label: "Altura média", value: ((v["h1"] ?? 0) + (v["h2"] ?? 0)) / 2, suffix: "mm" },
      {
        label: "Inclinação do corte",
        value: (Math.atan2((v["h2"] ?? 0) - (v["h1"] ?? 0), D) * 180) / Math.PI,
        suffix: "°",
      },
    ];
  }

  if (slug === "quadrado-redondo" || slug === "redondo-quadrado" || slug === "transicoes") {
    const lengths = result.trueLengths.map((t) => t.length);
    const b = result.development.bounds;
    return [
      { label: "Geratriz mínima", value: Math.min(...lengths), suffix: "mm" },
      { label: "Geratriz máxima", value: Math.max(...lengths), suffix: "mm" },
      { label: "Perímetro do topo", value: circumference(v["d"] ?? v["d2"] ?? 0), suffix: "mm" },
      { label: "Largura da planificação", value: b.maxX - b.minX, suffix: "mm" },
      { label: "Altura da planificação", value: b.maxY - b.minY, suffix: "mm" },
    ];
  }

  return fromMetrics(result.metrics);
}
