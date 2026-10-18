/**
 * CALDRA CAD CORE — SHAPE WRAPPER
 *
 * Encapsula a referência viva de uma forma geométrica no kernel CAD,
 * abstraindo o ponteiro/handle numérico subjacente e gerindo metadados.
 */

import type {
  CadBoundingBox,
  CadEdge,
  CadFace,
  CadMassProperties,
  CadMesh,
  CadVertex,
} from "./CadTopology";

export type CadShapeType =
  | "solid"
  | "shell"
  | "face"
  | "wire"
  | "edge"
  | "vertex"
  | "compound"
  | "comp_solid";

export class CadShape {
  /** ID único da forma na sessão CALDRA */
  readonly id: string;
  /** Nome amigável para a árvore de recursos */
  readonly name: string;
  /** Tipo topológico da forma */
  readonly type: CadShapeType;
  /** Alias para shapeType */
  readonly shapeType: CadShapeType;
  /** Identificador / handle numérico interno na arena do kernel */
  readonly handle: number;
  /** Alias para kernelHandle */
  readonly kernelHandle: number;
  /** Bounding box cacheado (se calculado) */
  bounds?: CadBoundingBox;
  /** Volume cacheado (se sólido) em mm³ */
  volume?: number;
  /** Área superficial em mm² */
  surfaceArea?: number;
  /** Metadados adicionais */
  metadata?: Record<string, unknown>;
  /** Data de criação */
  readonly createdAt: number;

  private _cachedFaces?: CadFace[];
  private _cachedEdges?: CadEdge[];
  private _cachedVertices?: CadVertex[];
  private _cachedBounds?: CadBoundingBox;
  private _cachedMassProps?: CadMassProperties;
  private _cachedMesh?: CadMesh;

  constructor(options: {
    name: string;
    type?: CadShapeType;
    shapeType?: CadShapeType;
    handle?: number;
    kernelHandle?: number;
    id?: string;
    bounds?: CadBoundingBox;
    volume?: number;
    surfaceArea?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.id = options.id || `shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.name = options.name;
    const st: CadShapeType = options.type || options.shapeType || "solid";
    this.type = st;
    this.shapeType = st;
    const h = options.handle ?? options.kernelHandle ?? 0;
    this.handle = h;
    this.kernelHandle = h;
    this.bounds = options.bounds;
    this._cachedBounds = options.bounds;
    this.volume = options.volume;
    this.surfaceArea = options.surfaceArea;
    this.metadata = options.metadata;
    this.createdAt = Date.now();
  }

  get faces(): CadFace[] {
    return this._cachedFaces ?? [];
  }

  get edges(): CadEdge[] {
    return this._cachedEdges ?? [];
  }

  get vertices(): CadVertex[] {
    return this._cachedVertices ?? [];
  }

  getCachedFaces(): CadFace[] | undefined {
    return this._cachedFaces;
  }

  setCachedFaces(faces: CadFace[]): void {
    this._cachedFaces = faces;
  }

  getCachedEdges(): CadEdge[] | undefined {
    return this._cachedEdges;
  }

  setCachedEdges(edges: CadEdge[]): void {
    this._cachedEdges = edges;
  }

  getCachedVertices(): CadVertex[] | undefined {
    return this._cachedVertices;
  }

  setCachedVertices(vertices: CadVertex[]): void {
    this._cachedVertices = vertices;
  }

  getCachedBounds(): CadBoundingBox | undefined {
    return this._cachedBounds ?? this.bounds;
  }

  setCachedBounds(bounds: CadBoundingBox): void {
    this._cachedBounds = bounds;
    this.bounds = bounds;
  }

  getCachedMassProps(): CadMassProperties | undefined {
    return this._cachedMassProps;
  }

  setCachedMassProps(props: CadMassProperties): void {
    this._cachedMassProps = props;
    if (props.volume !== undefined) this.volume = props.volume;
    if (props.surfaceArea !== undefined) this.surfaceArea = props.surfaceArea;
  }

  getCachedMesh(): CadMesh | undefined {
    return this._cachedMesh;
  }

  setCachedMesh(mesh: CadMesh): void {
    this._cachedMesh = mesh;
  }
}

export function createCadShape(options: {
  name: string;
  type?: CadShapeType;
  shapeType?: CadShapeType;
  handle?: number;
  kernelHandle?: number;
  id?: string;
  bounds?: CadBoundingBox;
  volume?: number;
  surfaceArea?: number;
  metadata?: Record<string, unknown>;
}): CadShape {
  return new CadShape(options);
}
