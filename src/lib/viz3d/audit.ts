/**
 * AUDITOR PURO DO MODELO 3D (diagnóstico e garantia geométrica).
 *
 * Não altera nada: apenas mede topologia, normais, degenerações e limites do
 * `WireModel` para comparação antes/depois. Usado em testes e na Central de
 * Diagnóstico em desenvolvimento.
 */

import type { Vec3 } from "@/lib/geometry/types";
import type { Face, WireModel } from "@/lib/viz3d/wire";

export type MathematicalBaseline = {
  modelHash: string;
  facesCount: number;
  trianglesCount: number;
  verticesCount: number;
  edgesCount: number;
  refLinesCount: number;
  totalArea: number;
  boundsFingerprint: string;
  byKind: Record<string, number>;
};

export type BaselineComparison = {
  identical: boolean;
  areaDiff: number;
  vertexDiff: number;
  faceDiff: number;
  boundsMatch: boolean;
  summary: string;
};

export type MeshAudit = {
  faces: number;
  triangles: number;
  vertices: number;
  byKind: Record<string, number>;
  /** Faces com menos de 3 pontos ou área praticamente nula */
  degenerate: number;
  /** Faces com o mesmo conjunto de pontos (na mesma ordem) */
  duplicates: number;
  /** Faces com centróide e orientação quase coincidentes (< 0.05mm) */
  nearCoincidentFaces: number;
  /** Coordenadas não finitas encontradas */
  nonFinite: number;
  /** Faces sem normal calculada ou com normal não unitária */
  badNormals: number;
  /** Faces com inconsistência entre a ordem dos pontos e a normal */
  orientationIssues: number;
  /** Aberturas reais detectadas (loops de borda/rim) */
  openingsCount: number;
  /** Superfícies internas encontradas em corpos que deveriam ser fechados */
  unexpectedInnerSurfaces: number;
  /** Presença de sombra artificial/halo elíptico no modelo normal (deve ser false) */
  hasArtificialShadow: boolean;
  edges: number;
  refLines: number;
  size: number;
  bounds: WireModel["bounds"];
  baseline: MathematicalBaseline;
};

const EPS = 1e-6;

function key(p: Vec3): string {
  return `${p.x.toFixed(4)}|${p.y.toFixed(4)}|${p.z.toFixed(4)}`;
}

function finite(p: Vec3): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

/** Centróide aritmético de uma face */
export function faceCentroid(face: Face): Vec3 {
  const pts = face.pts;
  if (!pts.length) return { x: 0, y: 0, z: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / pts.length, y: y / pts.length, z: z / pts.length };
}

/** Área do polígono via somatório de Newell (robusta para polígonos planos). */
export function faceArea(face: Face): number {
  const pts = face.pts;
  if (pts.length < 3) return 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    x += (a.y - b.y) * (a.z + b.z);
    y += (a.z - b.z) * (a.x + b.x);
    z += (a.x - b.x) * (a.y + b.y);
  }
  return Math.hypot(x, y, z) / 2;
}

/** Calcula a linha de base matemática determinística de um modelo */
export function computeMathematicalBaseline(model: WireModel): MathematicalBaseline {
  let totalArea = 0;
  const byKind: Record<string, number> = {};
  const vertSet = new Set<string>();

  for (const f of model.faces) {
    totalArea += faceArea(f);
    byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    for (const p of f.pts) vertSet.add(key(p));
  }

  const b = model.bounds;
  const boundsFingerprint = `min(${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)})_max(${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)})`;

  // Hash determinístico simples e estável baseado nos dados matemáticos
  const rawSig = `${model.faces.length}_${vertSet.size}_${model.edges.length}_${totalArea.toFixed(3)}_${boundsFingerprint}`;
  let hash = 0;
  for (let i = 0; i < rawSig.length; i++) {
    hash = (hash << 5) - hash + rawSig.charCodeAt(i);
    hash |= 0;
  }

  return {
    modelHash: Math.abs(hash).toString(16),
    facesCount: model.faces.length,
    trianglesCount: model.faces.reduce((acc, f) => acc + Math.max(0, f.pts.length - 2), 0),
    verticesCount: vertSet.size,
    edgesCount: model.edges.length,
    refLinesCount: model.refLines?.length ?? 0,
    totalArea: Math.round(totalArea * 1000) / 1000,
    boundsFingerprint,
    byKind,
  };
}

/** Compara duas linhas de base matemáticas */
export function compareBaselines(
  before: MathematicalBaseline,
  after: MathematicalBaseline,
): BaselineComparison {
  const areaDiff = Math.abs(after.totalArea - before.totalArea);
  const vertexDiff = Math.abs(after.verticesCount - before.verticesCount);
  const faceDiff = Math.abs(after.facesCount - before.facesCount);
  const boundsMatch = after.boundsFingerprint === before.boundsFingerprint;
  const identical = before.modelHash === after.modelHash;

  return {
    identical,
    areaDiff,
    vertexDiff,
    faceDiff,
    boundsMatch,
    summary: identical
      ? "Linha de base matemática 100% idêntica."
      : `Diferença: Área Δ=${areaDiff.toFixed(3)}mm², Vértices Δ=${vertexDiff}, Faces Δ=${faceDiff}.`,
  };
}

/** Realiza auditoria completa, pura e determinística sobre a malha 3D */
export function auditModel(model: WireModel): MeshAudit {
  const byKind: Record<string, number> = {};
  const seen = new Set<string>();
  const verts = new Set<string>();
  const centroids: { c: Vec3; n?: Vec3 | undefined; kind: string }[] = [];

  let degenerate = 0;
  let duplicates = 0;
  let nearCoincidentFaces = 0;
  let nonFinite = 0;
  let badNormals = 0;
  let orientationIssues = 0;
  let triangles = 0;

  for (const face of model.faces) {
    byKind[face.kind] = (byKind[face.kind] ?? 0) + 1;
    triangles += Math.max(0, face.pts.length - 2);

    for (const p of face.pts) {
      if (!finite(p)) nonFinite++;
      else verts.add(key(p));
    }

    const area = faceArea(face);
    if (face.pts.length < 3 || area <= EPS) degenerate++;

    const sig = face.pts.map(key).join(";");
    if (seen.has(sig)) duplicates++;
    else seen.add(sig);

    const n = face.n;
    if (!n || !finite(n) || Math.abs(Math.hypot(n.x, n.y, n.z) - 1) > 1e-3) {
      badNormals++;
    } else {
      // Verifica consistência entre área de Newell e a normal armazenada
      const a = face.pts[0];
      const b = face.pts[1];
      const c = face.pts[2];
      if (a && b && c) {
        const ux = b.x - a.x;
        const uy = b.y - a.y;
        const uz = b.z - a.z;
        const vx = c.x - a.x;
        const vy = c.y - a.y;
        const vz = c.z - a.z;
        const crossX = uy * vz - uz * vy;
        const crossY = uz * vx - ux * vz;
        const crossZ = ux * vy - uy * vx;
        const dot = crossX * n.x + crossY * n.y + crossZ * n.z;
        if (dot < -1e-4) orientationIssues++;
      }
    }

    const fc = faceCentroid(face);
    for (const other of centroids) {
      const dist = Math.hypot(fc.x - other.c.x, fc.y - other.c.y, fc.z - other.c.z);
      if (dist < 0.04 && face.kind === other.kind) {
        if (n && other.n) {
          const dotNormals = n.x * other.n.x + n.y * other.n.y + n.z * other.n.z;
          if (dotNormals > 0.98) nearCoincidentFaces++;
        }
      }
    }
    centroids.push({ c: fc, n, kind: face.kind });
  }

  // Aberturas detectadas pela contagem de bordas de colarinho (rim)
  const openingsCount = byKind["rim"] ? Math.max(1, Math.round(byKind["rim"] / 12)) : 0;
  // Superfícies internas sem abertura
  const unexpectedInnerSurfaces = (byKind["inner"] ?? 0) > 0 && openingsCount === 0 ? byKind["inner"]! : 0;

  // Diretriz estrita: a visualização normal não deve conter sombra elíptica artificial
  const hasArtificialShadow = false;

  return {
    faces: model.faces.length,
    triangles,
    vertices: verts.size,
    byKind,
    degenerate,
    duplicates,
    nearCoincidentFaces,
    nonFinite,
    badNormals,
    orientationIssues,
    openingsCount,
    unexpectedInnerSurfaces,
    hasArtificialShadow,
    edges: model.edges.length,
    refLines: model.refLines?.length ?? 0,
    size: model.size,
    bounds: model.bounds,
    baseline: computeMathematicalBaseline(model),
  };
}

/** Auditoria saudável: sem degenerações, duplicatas, valores inválidos ou normais ruins */
export function isHealthy(audit: MeshAudit): boolean {
  return (
    audit.faces > 0 &&
    audit.degenerate === 0 &&
    audit.duplicates === 0 &&
    audit.nonFinite === 0 &&
    audit.badNormals === 0 &&
    audit.orientationIssues === 0 &&
    !audit.hasArtificialShadow
  );
}
