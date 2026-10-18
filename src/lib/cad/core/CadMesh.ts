/**
 * CALDRA CAD CORE — MESH & VISUAL TESSELLATION
 *
 * Estruturas de dados para tesselação de alta fidelidade industrial.
 * Separa com rigor:
 * 1. Triângulos de superfície (posições, normais, índices e grupos por Face CAD real)
 * 2. Arestas de fronteira CAD (polilinhas contínuas reais do B-Rep — sem diagonais de triangulação)
 */

import type { CadBoundingBox } from "./CadTopology";

export interface CadFaceGroup {
  faceId: string;
  faceIndex: number;
  faceHash: number;
  startTriangle: number;
  triangleCount: number;
}

export interface CadMeshData {
  /** Array plano XYZ intercalado de coordenadas de vértices. Comprimento = vertexCount * 3 */
  positions: Float32Array;
  /** Array plano XYZ intercalado de normais por vértice. Comprimento = vertexCount * 3 */
  normals: Float32Array;
  /** Índices dos triângulos. Comprimento = triangleCount * 3 */
  indices: Uint32Array;
  /** Quantidade total de vértices na malha */
  vertexCount: number;
  /** Quantidade total de triângulos na malha */
  triangleCount: number;
  /** Segmentação da malha por Face CAD real */
  faceGroups: CadFaceGroup[];
}

export interface CadPolylineEdge {
  edgeId: string;
  edgeIndex: number;
  edgeHash: number;
  /** Pontos XYZ contínuos amostrados da curva analítica real da aresta */
  points: Float32Array;
  pointCount: number;
  isSeam?: boolean;
}

export interface CadEdgeData {
  edges: CadPolylineEdge[];
  totalEdges: number;
  totalPoints: number;
}

export interface CadTessellatedShape {
  mesh: CadMeshData;
  edges: CadEdgeData;
  bounds: CadBoundingBox;
}
