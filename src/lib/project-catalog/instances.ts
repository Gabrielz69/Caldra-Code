/**
 * INSTÂNCIAS SÓLIDAS 3D — derivadas do RESULTADO CANÔNICO.
 *
 * Não existe cálculo paralelo da escada aqui: os parâmetros já resolvidos em
 * `CanonicalProject.parameters` e as peças canônicas (`parts`) são a única
 * fonte. Esta camada apenas POSICIONA cada ocorrência real de cada peça no
 * espaço (X ao longo do vão, Y para cima, Z na largura), com volume, espessura
 * e rotação reais — sem geometria inventada.
 */

import type { CanonicalPart, CanonicalProject } from "./types";

export type SolidMaterial = "aco" | "aco-pintado" | "aluminio";

export type SolidInstance = {
  /** identidade única e determinística da ocorrência */
  id: string;
  partKey: string;
  code: string;
  /** número da ocorrência (1..quantidade) para montagem */
  index: number;
  label: string;
  /** centro do sólido em mm */
  center: { x: number; y: number; z: number };
  /** dimensões reais em mm (antes da rotação) */
  size: { x: number; y: number; z: number };
  /** rotação em torno de Z (rad) — perfis inclinados */
  rotZ: number;
  /** rotação em torno de X (rad) — dobras e articulações cinemáticas */
  rotX?: number;
  /** rotação em torno de Y (rad) */
  rotY?: number;
  material: SolidMaterial;
  assemblyKey: string;
  fabricable: boolean;
  /**
   * Perfil fechado real (mm, plano XY) extrudado pela espessura em Z.
   * Quando ausente, o motor usa a caixa definida por `size`.
   */
  shape?: { outline: { x: number; y: number }[]; holes: { x: number; y: number }[][] };
  /** Geometria 3D canônica customizada (vértices contínuos em mm) */
  meshVertices?: number[];
  /** Índices dos triângulos da malha 3D */
  meshIndices?: number[];
};

const num = (p: Record<string, number>, k: string, fb: number) =>
  Number.isFinite(p[k]) ? (p[k] as number) : fb;

function make(
  part: CanonicalPart,
  index: number,
  center: SolidInstance["center"],
  size: SolidInstance["size"],
  rotZ = 0,
  material: SolidMaterial = "aco",
): SolidInstance {
  return {
    id: `${part.key}#${index}`,
    partKey: part.key,
    code: part.codeSuffix,
    index,
    label: part.quantity > 1 ? `${part.name} ${String(index).padStart(2, "0")}` : part.name,
    center,
    size,
    rotZ,
    material,
    assemblyKey: part.assemblyKey,
    fabricable: part.fabricable,
  };
}

/** Fallback genérico: usa a caixa canônica da peça, distribuída em X. */
function genericInstances(result: CanonicalProject): SolidInstance[] {
  const out: SolidInstance[] = [];
  for (const part of result.parts) {
    const b = part.box;
    const size = { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
    for (let i = 1; i <= part.quantity; i++) {
      out.push(
        make(
          part,
          i,
          {
            x: b.min.x + size.x / 2 + (i - 1) * (size.x + size.x * 0.25),
            y: b.min.y + size.y / 2,
            z: b.min.z + size.z / 2,
          },
          size,
        ),
      );
    }
  }
  return out;
}

function stairInstances(result: CanonicalProject): SolidInstance[] {
  const p = result.parameters;
  const width = num(p, "width", 900);
  const height = num(p, "height", 2800);
  const length = num(p, "length", 4200);
  const steps = Math.max(3, Math.round(num(p, "steps", 14)));
  const treadDepth = num(p, "treadDepth", 280);
  const stringerH = num(p, "stringerHeight", 250);
  const stringerT = num(p, "stringerThickness", 8);
  const treadT = num(p, "treadThickness", 4);
  const profile = num(p, "profileWidth", 50);
  const railH = num(p, "handrailHeight", 1100);

  const rise = height / steps;
  const run = length / steps;
  const angle = Math.atan2(height, length);
  const slope = Math.hypot(height, length);
  const byKey = new Map(result.parts.map((x) => [x.key, x] as const));
  const out: SolidInstance[] = [];
  const push = (
    key: string,
    ...rest: [number, SolidInstance["center"], SolidInstance["size"], number?, SolidMaterial?]
  ) => {
    const part = byKey.get(key);
    if (!part) return;
    out.push(make(part, rest[0], rest[1], rest[2], rest[3] ?? 0, rest[4] ?? "aco"));
  };

  /* longarinas: chapas inclinadas, alma perpendicular ao plano da escada */
  for (const side of [0, 1]) {
    const z = side === 0 ? stringerT / 2 : width - stringerT / 2;
    push(
      `stringer-${side}`,
      1,
      {
        x: length / 2 + Math.sin(angle) * (stringerH / 2),
        y: height / 2 - Math.cos(angle) * (stringerH / 2),
        z,
      },
      { x: slope, y: stringerH, z: stringerT },
      angle,
    );
  }

  /* degraus: um sólido real por degrau */
  for (let i = 1; i <= steps; i++) {
    push(
      "tread",
      i,
      {
        x: i * run - treadDepth / 2,
        y: i * rise - treadT / 2,
        z: width / 2,
      },
      { x: treadDepth, y: treadT, z: width - 2 * stringerT },
    );
  }

  /* travessas de travamento sob os degraus */
  const bars = Math.max(2, steps - 1);
  for (let i = 1; i <= bars; i++) {
    push(
      "crossbar",
      i,
      {
        x: i * run - treadDepth - profile / 2,
        y: i * rise - treadT - profile / 2,
        z: width / 2,
      },
      { x: profile, y: profile, z: width - 2 * stringerT },
    );
  }

  /* montantes do guarda-corpo, apoiados na linha inclinada */
  const postPart = byKey.get("post");
  const posts = postPart ? postPart.quantity : Math.max(2, Math.ceil(length / 1200) + 1);
  for (let i = 1; i <= posts; i++) {
    const x = ((i - 1) / (posts - 1 || 1)) * length;
    const base = (x / length) * height;
    push(
      "post",
      i,
      {
        x,
        y: base + railH / 2,
        z: width - profile / 2,
      },
      { x: profile, y: railH, z: profile },
    );
  }

  /* corrimão: barra inclinada acompanhando a rampa */
  push(
    "rail",
    1,
    {
      x: length / 2,
      y: height / 2 + railH,
      z: width - profile / 2,
    },
    { x: slope, y: profile, z: profile },
    angle,
  );

  /* chapas de fixação: duas na base, duas no topo */
  const basePart = byKey.get("base");
  if (basePart) {
    const bl = basePart.dimensions.length;
    const bw = basePart.dimensions.width;
    const bt = basePart.thickness;
    const spots: SolidInstance["center"][] = [
      { x: bl / 2, y: -bt / 2, z: stringerT / 2 },
      { x: bl / 2, y: -bt / 2, z: width - stringerT / 2 },
      { x: length - bl / 2, y: height - bt / 2, z: stringerT / 2 },
      { x: length - bl / 2, y: height - bt / 2, z: width - stringerT / 2 },
    ];
    spots.slice(0, Math.max(1, basePart.quantity)).forEach((c, i) => {
      push("base", i + 1, c, { x: bl, y: bt, z: bw });
    });
  }

  return out;
}

/** Instâncias sólidas do projeto canônico (mm). */
export function buildInstances(result: CanonicalProject): SolidInstance[] {
  if (result.modelSlug === "escada-reta") return stairInstances(result);
  return genericInstances(result);
}

/** Direção de afastamento da vista explodida, por conjunto. */
export function explodeDirection(assemblyKey: string): { x: number; y: number; z: number } {
  switch (assemblyKey) {
    case "degraus":
      return { x: 0, y: 1, z: 0 };
    case "guarda-corpo":
      return { x: 0, y: 1.4, z: 0.8 };
    case "fixacoes":
      return { x: 0, y: -1, z: 0 };
    default:
      return { x: 0, y: 0, z: -1 };
  }
}
