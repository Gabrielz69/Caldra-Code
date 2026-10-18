/**
 * CALDRA — MOTOR DE EXERCÍCIOS
 *
 * Gera exercícios numéricos a partir das fórmulas do currículo. Cada gerador
 * sorteia valores plausíveis de oficina, calcula a resposta com a mesma
 * fórmula ensinada na aula e devolve a correção passo a passo.
 *
 * Sem estado de usuário aqui — a pontuação vive em progress.ts.
 */

export type Exercise = {
  /** Id da fórmula que originou o exercício. */
  formulaId: string;
  prompt: string;
  /** Unidade esperada na resposta (apenas rótulo). */
  unit: string;
  answer: number;
  /** Tolerância absoluta aceita na correção. */
  tolerance: number;
  /** Resolução comentada, mostrada após responder. */
  steps: string[];
};

type Rnd = {
  int: (min: number, max: number, step?: number) => number;
  pick: <T>(list: readonly T[]) => T;
};

function makeRnd(): Rnd {
  const int = (min: number, max: number, step = 1) => {
    const n = Math.floor(Math.random() * (Math.floor((max - min) / step) + 1));
    return min + n * step;
  };
  return { int, pick: (list) => list[Math.floor(Math.random() * list.length)] as never };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => r2(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const rad = (deg: number) => (deg * Math.PI) / 180;

type Generator = (rnd: Rnd) => Exercise;

const GENERATORS: Record<string, Generator> = {
  circunferencia: (rnd) => {
    const D = rnd.int(200, 1600, 20);
    const C = Math.PI * D;
    return {
      formulaId: "circunferencia",
      prompt: `Qual o comprimento desenvolvido de um anel de diâmetro médio Ø${D} mm?`,
      unit: "mm",
      answer: C,
      tolerance: Math.max(1, C * 0.005),
      steps: [`C = π × D`, `C = π × ${D}`, `C = ${fmt(C)} mm`],
    };
  },

  pitagoras: (rnd) => {
    const a = rnd.int(150, 900, 10);
    const b = rnd.int(150, 900, 10);
    const d = Math.hypot(a, b);
    return {
      formulaId: "pitagoras",
      prompt: `Um segmento tem afastamento horizontal de ${a} mm e altura de ${b} mm. Qual o comprimento verdadeiro?`,
      unit: "mm",
      answer: d,
      tolerance: Math.max(1, d * 0.005),
      steps: [`d = √(a² + b²)`, `d = √(${a}² + ${b}²)`, `d = ${fmt(d)} mm`],
    };
  },

  "corda-divisao": (rnd) => {
    const R = rnd.int(100, 700, 10);
    const n = rnd.pick([8, 12, 16, 24]);
    const c = 2 * R * Math.sin(Math.PI / n);
    return {
      formulaId: "corda-divisao",
      prompt: `Dividindo uma circunferência de raio ${R} mm em ${n} partes iguais, qual a corda a abrir no compasso?`,
      unit: "mm",
      answer: c,
      tolerance: Math.max(0.5, c * 0.005),
      steps: [
        `corda = 2 × R × sen(180° / n)`,
        `corda = 2 × ${R} × sen(${r2(180 / n)}°)`,
        `corda = ${fmt(c)} mm`,
      ],
    };
  },

  "arco-corda-flecha": (rnd) => {
    const c = rnd.int(300, 1200, 50);
    const f = rnd.int(20, 120, 5);
    const R = c ** 2 / (8 * f) + f / 2;
    return {
      formulaId: "arco-corda-flecha",
      prompt: `Na peça calandrada mediu-se corda ${c} mm e flecha ${f} mm. Qual o raio do arco?`,
      unit: "mm",
      answer: R,
      tolerance: Math.max(1, R * 0.005),
      steps: [
        `R = (c² / (8 × f)) + (f / 2)`,
        `R = (${c}² / (8 × ${f})) + (${f} / 2)`,
        `R = ${fmt(R)} mm`,
      ],
    };
  },

  polegada: (rnd) => {
    const num = rnd.pick([1, 3, 5, 7, 3, 5]);
    const den = rnd.pick([2, 4, 8, 16]);
    const pol = num / den;
    const mm = pol * 25.4;
    return {
      formulaId: "polegada",
      prompt: `Converta ${num}/${den}" para milímetros.`,
      unit: "mm",
      answer: mm,
      tolerance: 0.05,
      steps: [`mm = polegada × 25,4`, `mm = ${r2(pol)} × 25,4`, `mm = ${fmt(mm)} mm`],
    };
  },

  "tangente-cone": (rnd) => {
    const D = rnd.int(400, 1000, 20);
    const d = rnd.int(120, 380, 20);
    const h = rnd.int(200, 800, 20);
    const alpha = (Math.atan((D - d) / (2 * h)) * 180) / Math.PI;
    return {
      formulaId: "tangente-cone",
      prompt: `Tronco de cone com Ø maior ${D} mm, Ø menor ${d} mm e altura ${h} mm. Qual o ângulo de meia-abertura α, em graus?`,
      unit: "°",
      answer: alpha,
      tolerance: 0.5,
      steps: [
        `tg α = (D − d) / (2 × h)`,
        `tg α = (${D} − ${d}) / (2 × ${h}) = ${r2((D - d) / (2 * h))}`,
        `α = ${fmt(alpha)}°`,
      ],
    };
  },

  escala: (rnd) => {
    const fator = rnd.pick([2, 5, 10, 20, 50]);
    const desenho = rnd.int(15, 180, 1);
    const real = desenho * fator;
    return {
      formulaId: "escala",
      prompt: `Um traço mede ${desenho} mm no desenho em escala 1:${fator}. Qual a medida real da peça?`,
      unit: "mm",
      answer: real,
      tolerance: 0.5,
      steps: [
        `medida real = medida do desenho × fator`,
        `real = ${desenho} × ${fator}`,
        `real = ${fmt(real)} mm`,
      ],
    };
  },

  "perimetro-poligono": (rnd) => {
    const n = rnd.pick([4, 5, 6, 8, 12]);
    const L = rnd.int(60, 500, 5);
    return {
      formulaId: "perimetro-poligono",
      prompt: `Qual o perímetro de um polígono regular de ${n} lados com ${L} mm cada?`,
      unit: "mm",
      answer: n * L,
      tolerance: 0.5,
      steps: [`P = n × L`, `P = ${n} × ${L}`, `P = ${fmt(n * L)} mm`],
    };
  },

  "linha-neutra": (rnd) => {
    const De = rnd.int(300, 1600, 20);
    const e = rnd.pick([3, 4.75, 6.35, 8, 9.5, 12.7]);
    return {
      formulaId: "linha-neutra",
      prompt: `Virola com diâmetro externo ${De} mm em chapa de ${fmt(e)} mm. Qual o diâmetro médio (linha neutra)?`,
      unit: "mm",
      answer: De - e,
      tolerance: 0.2,
      steps: [`Dm = De − e`, `Dm = ${De} − ${fmt(e)}`, `Dm = ${fmt(De - e)} mm`],
    };
  },

  "desenvolvimento-cilindro": (rnd) => {
    const De = rnd.int(300, 1600, 20);
    const e = rnd.pick([3, 4.75, 6.35, 8, 9.5, 12.7]);
    const L = Math.PI * (De - e);
    return {
      formulaId: "desenvolvimento-cilindro",
      prompt: `Qual o comprimento da chapa plana de uma virola de Ø externo ${De} mm em chapa de ${fmt(e)} mm?`,
      unit: "mm",
      answer: L,
      tolerance: Math.max(1, L * 0.005),
      steps: [
        `L = π × (De − e)`,
        `L = π × (${De} − ${fmt(e)}) = π × ${fmt(De - e)}`,
        `L = ${fmt(L)} mm`,
      ],
    };
  },

  "cone-geratriz": (rnd) => {
    const h = rnd.int(200, 900, 10);
    const R = rnd.int(120, 600, 10);
    const G = Math.hypot(h, R);
    return {
      formulaId: "cone-geratriz",
      prompt: `Cone com altura ${h} mm e raio da base ${R} mm. Qual a geratriz?`,
      unit: "mm",
      answer: G,
      tolerance: Math.max(1, G * 0.005),
      steps: [`G = √(h² + R²)`, `G = √(${h}² + ${R}²)`, `G = ${fmt(G)} mm`],
    };
  },

  "cone-setor": (rnd) => {
    const R = rnd.int(120, 500, 10);
    const G = R + rnd.int(80, 600, 10);
    const a = (360 * R) / G;
    return {
      formulaId: "cone-setor",
      prompt: `Cone com raio da base ${R} mm e geratriz ${G} mm. Qual o ângulo do setor da planificação?`,
      unit: "°",
      answer: a,
      tolerance: 0.5,
      steps: [`α = 360° × R / G`, `α = 360 × ${R} / ${G}`, `α = ${fmt(a)}°`],
    };
  },

  "tronco-geratriz": (rnd) => {
    const R = rnd.int(200, 600, 10);
    const r = rnd.int(60, 180, 10);
    const h = rnd.int(150, 800, 10);
    const g = Math.hypot(h, R - r);
    return {
      formulaId: "tronco-geratriz",
      prompt: `Redução concêntrica com raio maior ${R} mm, raio menor ${r} mm e altura ${h} mm. Qual a geratriz do tronco?`,
      unit: "mm",
      answer: g,
      tolerance: Math.max(1, g * 0.005),
      steps: [`g = √(h² + (R − r)²)`, `g = √(${h}² + (${R} − ${r})²)`, `g = ${fmt(g)} mm`],
    };
  },

  "tronco-vertice": (rnd) => {
    const R = rnd.int(200, 600, 10);
    const r = rnd.int(60, 180, 10);
    const g = rnd.int(200, 800, 10);
    const G = (g * R) / (R - r);
    return {
      formulaId: "tronco-vertice",
      prompt: `Tronco com geratriz ${g} mm, raio maior ${R} mm e raio menor ${r} mm. Qual a distância do vértice até a base maior?`,
      unit: "mm",
      answer: G,
      tolerance: Math.max(1, G * 0.005),
      steps: [`G = g × R / (R − r)`, `G = ${g} × ${R} / (${R} − ${r})`, `G = ${fmt(G)} mm`],
    };
  },

  "curva-gomos": (rnd) => {
    const theta = rnd.pick([45, 60, 90]);
    const n = rnd.pick([3, 4, 5]);
    const b = theta / (2 * (n - 1));
    return {
      formulaId: "curva-gomos",
      prompt: `Curva de ${theta}° com ${n} gomos (contando os dois meios). Qual o ângulo de corte de cada face?`,
      unit: "°",
      answer: b,
      tolerance: 0.2,
      steps: [`β = θ / (2 × (n − 1))`, `β = ${theta} / (2 × (${n} − 1))`, `β = ${fmt(b)}°`],
    };
  },

  "curva-recuo": (rnd) => {
    const D = rnd.int(150, 800, 10);
    const beta = rnd.pick([7.5, 11.25, 15, 22.5]);
    const s = (D / 2) * Math.tan(rad(beta));
    return {
      formulaId: "curva-recuo",
      prompt: `Gomo de tubo com diâmetro médio ${D} mm e face cortada a ${fmt(beta)}°. Qual o recuo entre a geratriz longa e a curta?`,
      unit: "mm",
      answer: s,
      tolerance: Math.max(0.5, s * 0.01),
      steps: [`s = (D / 2) × tg β`, `s = (${D} / 2) × tg ${fmt(beta)}°`, `s = ${fmt(s)} mm`],
    };
  },

  "raio-curva": (rnd) => {
    const R = rnd.int(200, 1500, 50);
    const theta = rnd.pick([30, 45, 60, 90]);
    const L = (R * theta * Math.PI) / 180;
    return {
      formulaId: "raio-curva",
      prompt: `Curva de ${theta}° com raio de eixo ${R} mm. Qual o comprimento do eixo da curva?`,
      unit: "mm",
      answer: L,
      tolerance: Math.max(1, L * 0.005),
      steps: [`L = R × θ × π / 180`, `L = ${R} × ${theta} × π / 180`, `L = ${fmt(L)} mm`],
    };
  },

  "intersecao-tubos": (rnd) => {
    const R = rnd.int(150, 600, 10);
    const x = rnd.int(20, Math.max(30, Math.floor(R * 0.8)), 10);
    const y = Math.sqrt(R * R - x * x);
    return {
      formulaId: "intersecao-tubos",
      prompt: `Tubo maior de raio ${R} mm. Para uma geratriz afastada ${x} mm do eixo, qual a altura y do recorte?`,
      unit: "mm",
      answer: y,
      tolerance: Math.max(1, y * 0.005),
      steps: [`y = √(R² − x²)`, `y = √(${R}² − ${x}²)`, `y = ${fmt(y)} mm`],
    };
  },

  "derivacao-angulo": (rnd) => {
    const d = rnd.int(100, 500, 10);
    const alpha = rnd.pick([30, 45, 60]);
    const e = d / Math.sin(rad(alpha));
    return {
      formulaId: "derivacao-angulo",
      prompt: `Derivação com tubo de Ø ${d} mm entrando a ${alpha}°. Qual o comprimento da boca (eixo maior da elipse)?`,
      unit: "mm",
      answer: e,
      tolerance: Math.max(1, e * 0.005),
      steps: [`e = d / sen α`, `e = ${d} / sen ${alpha}°`, `e = ${fmt(e)} mm`],
    };
  },

  "deslocamento-45": (rnd) => {
    const d = rnd.int(100, 900, 10);
    const L = d * Math.SQRT2;
    return {
      formulaId: "deslocamento-45",
      prompt: `Desvio de ${d} mm feito com duas curvas de 45°. Qual a distância entre os centros das curvas?`,
      unit: "mm",
      answer: L,
      tolerance: Math.max(1, L * 0.005),
      steps: [`L = d × 1,4142`, `L = ${d} × 1,4142`, `L = ${fmt(L)} mm`],
    };
  },

  "deslocamento-generico": (rnd) => {
    const d = rnd.int(100, 900, 10);
    const alpha = rnd.pick([22.5, 30, 60]);
    const L = d / Math.sin(rad(alpha));
    return {
      formulaId: "deslocamento-generico",
      prompt: `Desvio de ${d} mm com curvas de ${fmt(alpha)}°. Qual a distância entre centros?`,
      unit: "mm",
      answer: L,
      tolerance: Math.max(1, L * 0.005),
      steps: [`L = d / sen α`, `L = ${d} / sen ${fmt(alpha)}°`, `L = ${fmt(L)} mm`],
    };
  },

  "niple-takeout": (rnd) => {
    const L = rnd.int(300, 1500, 10);
    const t1 = rnd.int(40, 160, 5);
    const t2 = rnd.int(40, 160, 5);
    return {
      formulaId: "niple-takeout",
      prompt: `Distância entre centros ${L} mm, com take-out de ${t1} mm e ${t2} mm nos acessórios. Qual o comprimento de corte do niple?`,
      unit: "mm",
      answer: L - t1 - t2,
      tolerance: 0.5,
      steps: [`C = L − (t₁ + t₂)`, `C = ${L} − (${t1} + ${t2})`, `C = ${fmt(L - t1 - t2)} mm`],
    };
  },

  "bend-allowance": (rnd) => {
    const A = rnd.pick([30, 45, 60, 90, 120]);
    const r = rnd.pick([2, 3, 4, 5, 6]);
    const e = rnd.pick([1.5, 2, 3, 4, 5]);
    const K = rnd.pick([0.33, 0.4, 0.44, 0.5]);
    const BA = (Math.PI / 180) * A * (r + K * e);
    return {
      formulaId: "bend-allowance",
      prompt: `Dobra de ${A}° com raio interno ${r} mm, chapa ${fmt(e)} mm e fator K ${fmt(K)}. Qual o comprimento da linha neutra na dobra (BA)?`,
      unit: "mm",
      answer: BA,
      tolerance: Math.max(0.1, BA * 0.01),
      steps: [
        `BA = (π / 180) × A × (r + K × e)`,
        `BA = (π / 180) × ${A} × (${r} + ${fmt(K)} × ${fmt(e)})`,
        `BA = ${fmt(BA)} mm`,
      ],
    };
  },

  "bend-deduction": (rnd) => {
    const A = rnd.pick([45, 60, 90]);
    const r = rnd.pick([2, 3, 4, 5]);
    const e = rnd.pick([2, 3, 4, 5]);
    const K = rnd.pick([0.33, 0.4, 0.44]);
    const BA = (Math.PI / 180) * A * (r + K * e);
    const BD = 2 * (r + e) * Math.tan(rad(A / 2)) - BA;
    return {
      formulaId: "bend-deduction",
      prompt: `Dobra de ${A}°, raio interno ${r} mm, chapa ${e} mm e fator K ${fmt(K)} (BA = ${fmt(BA)} mm). Qual o desconto de dobra (BD)?`,
      unit: "mm",
      answer: BD,
      tolerance: Math.max(0.1, Math.abs(BD) * 0.02),
      steps: [
        `BD = 2 × (r + e) × tg(A / 2) − BA`,
        `BD = 2 × (${r} + ${e}) × tg ${A / 2}° − ${fmt(BA)}`,
        `BD = ${fmt(BD)} mm`,
      ],
    };
  },
};

/** Fórmulas que já possuem exercício gerado. */
export const hasExercise = (formulaId: string) => formulaId in GENERATORS;

/** Gera um exercício para a primeira fórmula praticável da lista. */
export function generateExercise(formulaIds: string[]): Exercise | null {
  const usable = formulaIds.filter(hasExercise);
  if (usable.length === 0) return null;
  const rnd = makeRnd();
  const id = usable[Math.floor(Math.random() * usable.length)] as string;
  return (GENERATORS[id] as Generator)(rnd);
}

/** Correção: aceita vírgula decimal e tolerância da própria fórmula. */
export function checkAnswer(
  ex: Exercise,
  raw: string,
): { ok: boolean; value: number | null; expected: string } {
  const value = Number(raw.replace(/\s/g, "").replace(",", "."));
  const expected = `${fmt(ex.answer)} ${ex.unit}`;
  if (!Number.isFinite(value)) return { ok: false, value: null, expected };
  return { ok: Math.abs(value - ex.answer) <= ex.tolerance, value, expected };
}

export const formatAnswer = (v: number) => `${fmt(v)}`;
export const roundOne = r1;
