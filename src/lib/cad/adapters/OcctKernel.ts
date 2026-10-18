/**
 * CALDRA CAD CORE — OCCT ADAPTER (Seções 1, 2, 6 e 7)
 *
 * Implementação do CadKernel integrando a biblioteca occt-wasm (OpenCascade Technology WASM).
 * Mantém os tipos de baixo nível e ponteiros C++ estritamente isolados da aplicação.
 */

import {
  OcctKernel as WasmKernel,
  type ShapeHandle,
  type Mesh as WasmMesh,
  type BoundingBox as WasmBBox,
  type EdgeData,
} from "occt-wasm";
import { type CadKernel, type CadKernelInitOptions } from "../core/CadKernel";
import { CadKernelError } from "../core/CadKernelError";
import { CadShape, type CadShapeType } from "../core/CadShape";
import type {
  CadBoundingBox,
  CadEdge,
  CadEdgeCurveType,
  CadFace,
  CadMassProperties,
  CadMesh,
  CadPoint3D,
  CadSketchProfile,
  CadSurfaceType,
  CadTessellationOptions,
  CadVertex,
} from "../core/CadTopology";

export class OcctKernelAdapter implements CadKernel {
  private _rawKernel: WasmKernel | null = null;
  private _isInitialized = false;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  private get kernel(): WasmKernel {
    if (!this._rawKernel || !this._isInitialized) {
      throw new CadKernelError({
        operation: "kernel_access",
        message: "O kernel OCCT-WASM ainda não foi inicializado. Chame init() primeiro.",
        code: "KERNEL_NOT_INITIALIZED",
      });
    }
    return this._rawKernel;
  }

  async init(options?: CadKernelInitOptions): Promise<void> {
    if (this._isInitialized) return;
    try {
      const isBrowser = typeof window !== "undefined";
      const wasmSource = options?.wasmUrl || (isBrowser ? "/occt-wasm.wasm" : undefined);
      this._rawKernel = await WasmKernel.init(
        wasmSource ? { wasm: wasmSource } : undefined
      );
      this._isInitialized = true;
    } catch (err) {
      throw new CadKernelError({
        operation: "init",
        message: `Falha ao carregar o módulo WebAssembly do OCCT: ${err instanceof Error ? err.message : String(err)}`,
        code: "WASM_LOAD_FAILED",
        recoverable: true,
        originalError: err,
      });
    }
  }

  /* --- 1. Criação de Primitivas Sólidas --- */

  async createBox(dx: number, dy: number, dz: number, name?: string): Promise<CadShape> {
    if (dx <= 0 || dy <= 0 || dz <= 0) {
      throw new CadKernelError({
        operation: "createBox",
        message: "Dimensões do paralelepípedo devem ser estritamente positivas (> 0 mm).",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const handle = this.kernel.makeBox(dx, dy, dz);
      return new CadShape({
        name: name ?? `Bloco_${dx}x${dy}x${dz}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { dimensions: { dx, dy, dz } },
      });
    } catch (err) {
      throw this.wrapError("createBox", err);
    }
  }

  async createCylinder(radius: number, height: number, name?: string): Promise<CadShape> {
    if (radius <= 0 || height <= 0) {
      throw new CadKernelError({
        operation: "createCylinder",
        message: "Raio e altura do cilindro devem ser positivos.",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const handle = this.kernel.makeCylinder(radius, height);
      return new CadShape({
        name: name ?? `Cilindro_R${radius}_H${height}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { radius, height },
      });
    } catch (err) {
      throw this.wrapError("createCylinder", err);
    }
  }

  async createCone(
    radius1: number,
    radius2: number,
    height: number,
    name?: string
  ): Promise<CadShape> {
    if (radius1 < 0 || radius2 < 0 || height <= 0 || (radius1 === 0 && radius2 === 0)) {
      throw new CadKernelError({
        operation: "createCone",
        message: "Dimensões do cone/tronco de cone inválidas.",
        code: "DEGENERATE_GEOMETRY",
      });
    }

    if (Math.abs(radius1 - radius2) < 1e-3) {
      return await this.createCylinder(radius1, height, name);
    }

    try {
      const handle = this.kernel.makeCone(radius1, radius2, height);
      return new CadShape({
        name: name ?? `Cone_R${radius1}_R${radius2}_H${height}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { radius1, radius2, height },
      });
    } catch (err) {
      throw this.wrapError("createCone", err);
    }
  }

  async createSphere(radius: number, name?: string): Promise<CadShape> {
    if (radius <= 0) {
      throw new CadKernelError({
        operation: "createSphere",
        message: "Raio da esfera deve ser estritamente positivo.",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const handle = this.kernel.makeSphere(radius);
      return new CadShape({
        name: name ?? `Esfera_R${radius}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { radius },
      });
    } catch (err) {
      throw this.wrapError("createSphere", err);
    }
  }

  /* --- 2. Modelagem por Esboço / Extrusão --- */

  async createSketch(profile: CadSketchProfile): Promise<CadShape> {
    return this.createSketchProfile(profile);
  }

  async createSketchProfile(profile: CadSketchProfile): Promise<CadShape> {
    if (!profile.points || profile.points.length < 3) {
      throw new CadKernelError({
        operation: "createSketchProfile",
        message: "Um esboço requer ao menos 3 pontos para formar uma face fechada.",
        code: "DEGENERATE_GEOMETRY",
      });
    }

    try {
      const pts = profile.points;
      const edges: ShapeHandle[] = [];

      for (let i = 0; i < pts.length; i++) {
        const nextIdx = (i + 1) % pts.length;
        if (!profile.closed && i === pts.length - 1) break;

        const p1 = pts[i]!;
        const p2 = pts[nextIdx]!;
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 1e-6) continue;

        const edgeHandle = this.kernel.makeLineEdge(
          { x: p1.x, y: p1.y, z: 0 },
          { x: p2.x, y: p2.y, z: 0 }
        );
        edges.push(edgeHandle);
      }

      const wireHandle = this.kernel.makeWire(edges);
      let shapeHandle = wireHandle;
      let shapeType: CadShapeType = "wire";

      if (profile.closed) {
        try {
          shapeHandle = this.kernel.makeFace(wireHandle);
          shapeType = "face";
        } catch {
          // Fallback para wire se não conseguir planarizar face
          shapeHandle = wireHandle;
          shapeType = "wire";
        }
      }

      return new CadShape({
        name: `Esboço_${profile.id}`,
        shapeType,
        kernelHandle: shapeHandle as unknown as number,
        metadata: { profileId: profile.id, pointCount: pts.length },
      });
    } catch (err) {
      throw this.wrapError("createSketchProfile", err);
    }
  }

  async extrude(
    shape: CadShape,
    dx: number,
    dy: number,
    dz: number,
    name?: string
  ): Promise<CadShape> {
    if (dx === 0 && dy === 0 && dz === 0) {
      throw new CadKernelError({
        operation: "extrude",
        message: "Vetor de extrusão não pode ser nulo.",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const handle = this.kernel.extrude(this.asHandle(shape), dx, dy, dz);
      return new CadShape({
        name: name ?? `Extrusao_${shape.name}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { vector: { dx, dy, dz } },
      });
    } catch (err) {
      throw this.wrapError("extrude", err);
    }
  }

  async revolve(
    shape: CadShape,
    axisPoint: CadPoint3D,
    axisDirection: CadPoint3D,
    angleDeg: number,
    name?: string
  ): Promise<CadShape> {
    if (angleDeg === 0) {
      throw new CadKernelError({
        operation: "revolve",
        message: "Ângulo de revolução não pode ser zero.",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const angleRad = (angleDeg * Math.PI) / 180;
      const handle = this.kernel.revolve(
        this.asHandle(shape),
        { point: axisPoint, direction: axisDirection },
        angleRad
      );
      return new CadShape({
        name: name ?? `Revolucao_${shape.name}_${angleDeg}graus`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { axisPoint, axisDirection, angleDeg },
      });
    } catch (err) {
      throw this.wrapError("revolve", err);
    }
  }

  async loft(sections: CadShape[], name?: string): Promise<CadShape> {
    if (sections.length < 2) {
      throw new CadKernelError({
        operation: "loft",
        message: "Operação de loft requer ao menos 2 perfis de seção.",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const wireHandles = sections.map((s) => this.asHandle(s));
      const handle = this.kernel.loft(wireHandles, true, true);
      return new CadShape({
        name: name ?? `Loft_${sections.length}secoes`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("loft", err);
    }
  }

  async offset(
    shape: CadShape,
    distance: number,
    tolerance = 1e-3,
    name?: string
  ): Promise<CadShape> {
    try {
      const handle = this.kernel.offset(this.asHandle(shape), distance, tolerance);
      return new CadShape({
        name: name ?? `Offset_${shape.name}`,
        shapeType: shape.shapeType,
        kernelHandle: handle as unknown as number,
        metadata: { distance, tolerance },
      });
    } catch (err) {
      throw this.wrapError("offset", err);
    }
  }

  /* --- 3. Operações Booleanas (CSG / B-Rep) --- */

  async fuse(base: CadShape, tool: CadShape, name?: string): Promise<CadShape> {
    try {
      const handle = this.kernel.fuse(this.asHandle(base), this.asHandle(tool));
      return new CadShape({
        name: name ?? `Uniao_${base.name}_${tool.name}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("fuse", err);
    }
  }

  async cut(base: CadShape, tool: CadShape, name?: string): Promise<CadShape> {
    try {
      const handle = this.kernel.cut(this.asHandle(base), this.asHandle(tool));
      return new CadShape({
        name: name ?? `Corte_${base.name}_por_${tool.name}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("cut", err);
    }
  }

  async intersect(base: CadShape, tool: CadShape, name?: string): Promise<CadShape> {
    try {
      const handle = this.kernel.intersect(this.asHandle(base), this.asHandle(tool));
      return new CadShape({
        name: name ?? `Intersecao_${base.name}_${tool.name}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("intersect", err);
    }
  }

  /* --- 4. Modificadores Geométricos (Arredondamento & Chanfro) --- */

  async fillet(
    solid: CadShape,
    edgeIndices: number[],
    radius: number,
    name?: string
  ): Promise<CadShape> {
    if (radius <= 0) {
      throw new CadKernelError({
        operation: "fillet",
        message: "Raio de arredondamento deve ser positivo.",
        code: "FILLET_FAILED",
      });
    }
    try {
      const allEdges = this.kernel.getSubShapes(this.asHandle(solid), "edge");
      const edgesToFillet =
        edgeIndices.length > 0
          ? edgeIndices.map((idx) => allEdges[idx]).filter((h): h is ShapeHandle => h !== undefined)
          : allEdges;

      if (edgesToFillet.length === 0) {
        return solid;
      }

      const handle = this.kernel.fillet(this.asHandle(solid), edgesToFillet, radius);
      return new CadShape({
        name: name ?? `Arredondamento_R${radius}_${solid.name}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { radius, edgeIndices },
      });
    } catch (err) {
      throw this.wrapError("fillet", err, "FILLET_FAILED");
    }
  }

  async chamfer(
    solid: CadShape,
    edgeIndices: number[],
    distance: number,
    name?: string
  ): Promise<CadShape> {
    if (distance <= 0) {
      throw new CadKernelError({
        operation: "chamfer",
        message: "Distância do chanfro deve ser positiva.",
        code: "CHAMFER_FAILED",
      });
    }
    try {
      const allEdges = this.kernel.getSubShapes(this.asHandle(solid), "edge");
      const edgesToChamfer =
        edgeIndices.length > 0
          ? edgeIndices.map((idx) => allEdges[idx]).filter((h): h is ShapeHandle => h !== undefined)
          : allEdges;

      if (edgesToChamfer.length === 0) {
        return solid;
      }

      const handle = this.kernel.chamfer(this.asHandle(solid), edgesToChamfer, distance);
      return new CadShape({
        name: name ?? `Chanfro_D${distance}_${solid.name}`,
        shapeType: "solid",
        kernelHandle: handle as unknown as number,
        metadata: { distance, edgeIndices },
      });
    } catch (err) {
      throw this.wrapError("chamfer", err, "CHAMFER_FAILED");
    }
  }

  /* --- 5. Transformações Rígidas no Espaço --- */

  async translate(
    shape: CadShape,
    dx: number,
    dy: number,
    dz: number,
    name?: string
  ): Promise<CadShape> {
    try {
      const handle = this.kernel.translate(this.asHandle(shape), dx, dy, dz);
      return new CadShape({
        name: name ?? `${shape.name}_trans`,
        shapeType: shape.shapeType,
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("translate", err);
    }
  }

  async rotate(
    shape: CadShape,
    axisPoint: CadPoint3D,
    axisDirection: CadPoint3D,
    angleDeg: number,
    name?: string
  ): Promise<CadShape> {
    try {
      const handle = this.kernel.rotate(
        this.asHandle(shape),
        axisPoint,
        axisDirection,
        angleDeg
      );
      return new CadShape({
        name: name ?? `${shape.name}_rot`,
        shapeType: shape.shapeType,
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("rotate", err);
    }
  }

  async scale(
    shape: CadShape,
    factor: number,
    center: CadPoint3D = { x: 0, y: 0, z: 0 },
    name?: string
  ): Promise<CadShape> {
    if (factor <= 0) {
      throw new CadKernelError({
        operation: "scale",
        message: "Fator de escala deve ser estritamente positivo.",
        code: "DEGENERATE_GEOMETRY",
      });
    }
    try {
      const handle = this.kernel.scale(this.asHandle(shape), center, factor);
      return new CadShape({
        name: name ?? `${shape.name}_escala${factor}`,
        shapeType: shape.shapeType,
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("scale", err);
    }
  }

  async mirror(
    shape: CadShape,
    planePoint: CadPoint3D,
    planeNormal: CadPoint3D,
    name?: string
  ): Promise<CadShape> {
    try {
      const handle = this.kernel.mirror(this.asHandle(shape), planePoint, planeNormal);
      return new CadShape({
        name: name ?? `${shape.name}_espelho`,
        shapeType: shape.shapeType,
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("mirror", err);
    }
  }

  /* --- 6. Topologia e Consulta B-Rep --- */

  async getFaces(shape: CadShape): Promise<CadFace[]> {
    const cached = shape.getCachedFaces();
    if (cached) return cached;

    try {
      const faceHandles = this.kernel.getSubShapes(this.asHandle(shape), "face");
      const faces: CadFace[] = [];

      for (let i = 0; i < faceHandles.length; i++) {
        const fh = faceHandles[i]!;
        let area = 0;
        let surfaceType: CadSurfaceType = "plane";
        let normal: CadPoint3D | undefined;
        let centerOfMass: CadPoint3D | undefined;

        try {
          area = this.kernel.getSurfaceArea(fh);
        } catch (_e) {
          void _e;
        }

        try {
          const kind = this.kernel.surfaceType(fh);
          surfaceType = this.mapSurfaceKind(kind);
        } catch (_e) {
          void _e;
        }

        try {
          normal = this.kernel.surfaceNormal(fh, 0.5, 0.5);
        } catch (_e) {
          void _e;
        }

        try {
          centerOfMass = this.kernel.getSurfaceCenterOfMass(fh);
        } catch (_e) {
          void _e;
        }

        faces.push({
          id: `face_${shape.id}_${i}`,
          index: i,
          surfaceType,
          area,
          normal,
          centerOfMass,
        });
      }

      shape.setCachedFaces(faces);
      return faces;
    } catch (err) {
      throw this.wrapError("getFaces", err);
    }
  }

  async getEdges(shape: CadShape): Promise<CadEdge[]> {
    const cached = shape.getCachedEdges();
    if (cached) return cached;

    try {
      const edgeHandles = this.kernel.getSubShapes(this.asHandle(shape), "edge");
      const edges: CadEdge[] = [];

      for (let i = 0; i < edgeHandles.length; i++) {
        const eh = edgeHandles[i]!;
        let length = 0;
        let curveType: CadEdgeCurveType = "line";

        try {
          length = this.kernel.getLength(eh);
        } catch (_e) {
          void _e;
        }

        try {
          const kind = this.kernel.curveType(eh);
          curveType = this.mapCurveKind(kind);
        } catch (_e) {
          void _e;
        }

        let startPoint: CadPoint3D = { x: 0, y: 0, z: 0 };
        let endPoint: CadPoint3D = { x: 0, y: 0, z: 0 };

        try {
          const verts = this.kernel.getSubShapes(eh, "vertex");
          if (verts[0]) startPoint = this.kernel.vertexPosition(verts[0]);
          if (verts[1]) endPoint = this.kernel.vertexPosition(verts[1]);
          else endPoint = startPoint;
        } catch (_e) {
          void _e;
        }

        edges.push({
          id: `edge_${shape.id}_${i}`,
          index: i,
          curveType,
          length,
          startPoint,
          endPoint,
        });
      }

      shape.setCachedEdges(edges);
      return edges;
    } catch (err) {
      throw this.wrapError("getEdges", err);
    }
  }

  async getVertices(shape: CadShape): Promise<CadVertex[]> {
    const cached = shape.getCachedVertices();
    if (cached) return cached;

    try {
      const vertexHandles = this.kernel.getSubShapes(this.asHandle(shape), "vertex");
      const vertices: CadVertex[] = [];

      for (let i = 0; i < vertexHandles.length; i++) {
        const vh = vertexHandles[i]!;
        let point: CadPoint3D = { x: 0, y: 0, z: 0 };
        try {
          point = this.kernel.vertexPosition(vh);
        } catch (_e) {
          void _e;
        }

        vertices.push({
          id: `vertex_${shape.id}_${i}`,
          index: i,
          point,
        });
      }

      shape.setCachedVertices(vertices);
      return vertices;
    } catch (err) {
      throw this.wrapError("getVertices", err);
    }
  }

  async getBoundingBox(shape: CadShape): Promise<CadBoundingBox> {
    const cached = shape.getCachedBounds();
    if (cached) return cached;

    try {
      const bbox: WasmBBox = this.kernel.getBoundingBox(this.asHandle(shape));
      const res: CadBoundingBox = {
        min: { x: bbox.xmin, y: bbox.ymin, z: bbox.zmin },
        max: { x: bbox.xmax, y: bbox.ymax, z: bbox.zmax },
        size: {
          x: Math.abs(bbox.xmax - bbox.xmin),
          y: Math.abs(bbox.ymax - bbox.ymin),
          z: Math.abs(bbox.zmax - bbox.zmin),
        },
      };
      shape.setCachedBounds(res);
      return res;
    } catch (err) {
      throw this.wrapError("getBoundingBox", err);
    }
  }

  async getMassProperties(shape: CadShape): Promise<CadMassProperties> {
    const cached = shape.getCachedMassProps();
    if (cached) return cached;

    try {
      const handle = this.asHandle(shape);
      const volume = this.kernel.getVolume(handle);
      const surfaceArea = this.kernel.getSurfaceArea(handle);
      const centerOfMass = this.kernel.getCenterOfMass(handle);

      const props: CadMassProperties = {
        volume,
        surfaceArea,
        centerOfMass,
      };
      shape.setCachedMassProps(props);
      return props;
    } catch (err) {
      throw this.wrapError("getMassProperties", err);
    }
  }

  /* --- 7. Tesselação (B-Rep → Triângulos / Tridimensional Three.js) --- */

  async tessellate(
    shape: CadShape,
    options?: CadTessellationOptions
  ): Promise<CadMesh> {
    const cached = shape.getCachedMesh();
    if (cached) return cached;

    try {
      const handle = this.asHandle(shape);
      const linDef = options?.linearDeflection ?? 0.1;
      const angDef = options?.angularDeflection ?? 0.5;

      // 1. Gera malha com identificadores de faces
      const mesh: WasmMesh = this.kernel.meshShape(handle, {
        linearDeflection: linDef,
        angularDeflection: angDef,
      });

      // 2. Extrai arestas poligonais para visualização técnica limpa (bordas brancas)
      let polygonalEdges: CadMesh["edges"] = [];
      try {
        const edgeData: EdgeData = this.kernel.wireframe(handle, {
          deflection: linDef,
          source: "curve",
        });

        polygonalEdges = this.extractPolygonalEdges(edgeData);
      } catch (_e) {
        // Fallback gracioso se wireframe falhar
        void _e;
      }

      const cadMesh: CadMesh = {
        positions: mesh.positions,
        normals: mesh.normals,
        indices: mesh.indices,
        faceGroups: mesh.faceGroups,
        faceCount: mesh.faceCount,
        edges: polygonalEdges,
      };

      shape.setCachedMesh(cadMesh);
      return cadMesh;
    } catch (err) {
      throw this.wrapError("tessellate", err, "TESSELLATION_FAILED");
    }
  }

  /* --- 8. Intercâmbio de Dados CAD (I/O) --- */

  async exportStep(shape: CadShape): Promise<string> {
    try {
      return this.kernel.exportStep(this.asHandle(shape));
    } catch (err) {
      throw this.wrapError("exportStep", err, "STEP_EXPORT_FAILED");
    }
  }

  async importStep(stepContent: string, name?: string): Promise<CadShape> {
    try {
      const handle = this.kernel.importStep(stepContent);
      return new CadShape({
        name: name ?? `Importado_STEP_${Date.now()}`,
        shapeType: "compound",
        kernelHandle: handle as unknown as number,
      });
    } catch (err) {
      throw this.wrapError("importStep", err, "STEP_IMPORT_FAILED");
    }
  }

  async exportStl(shape: CadShape, binary = false): Promise<Uint8Array | string> {
    try {
      return this.kernel.exportStl(this.asHandle(shape), 0.1, !binary as any);
    } catch (err) {
      throw this.wrapError("exportStl", err);
    }
  }

  /* --- Utilitários Privados --- */

  private asHandle(shape: CadShape): ShapeHandle {
    return shape.kernelHandle as unknown as ShapeHandle;
  }

  private wrapError(
    op: string,
    err: unknown,
    code: import("../core/CadKernelError").CadErrorCode = "UNKNOWN_ERROR"
  ): CadKernelError {
    return new CadKernelError({
      operation: op,
      message: err instanceof Error ? err.message : String(err),
      code,
      recoverable: true,
      originalError: err,
    });
  }

  private mapSurfaceKind(kind: string): CadSurfaceType {
    switch (kind) {
      case "plane":
        return "plane";
      case "cylinder":
        return "cylinder";
      case "cone":
        return "cone";
      case "sphere":
        return "sphere";
      case "torus":
        return "torus";
      default:
        return "freeform";
    }
  }

  private mapCurveKind(kind: string): CadEdgeCurveType {
    switch (kind) {
      case "line":
        return "line";
      case "circle":
        return "circle";
      case "arc":
        return "arc";
      case "ellipse":
        return "ellipse";
      case "bspline":
      case "bezier":
        return "spline";
      default:
        return "other";
    }
  }

  private extractPolygonalEdges(edgeData: EdgeData): NonNullable<CadMesh["edges"]> {
    const { points, edgeGroups, edgeCount } = edgeData;
    const result: NonNullable<CadMesh["edges"]> = [];

    // edgeGroups vem como triplas: [pointStart, pointCount, edgeHash]
    for (let i = 0; i < edgeCount; i++) {
      const pointStart = edgeGroups[i * 3];
      const count = edgeGroups[i * 3 + 1];
      const edgeHash = edgeGroups[i * 3 + 2];

      if (pointStart === undefined || count === undefined || count < 2) continue;

      const pts: CadPoint3D[] = [];
      for (let p = 0; p < count; p++) {
        const offset = (pointStart + p) * 3;
        const x = points[offset];
        const y = points[offset + 1];
        const z = points[offset + 2];
        if (x !== undefined && y !== undefined && z !== undefined) {
          pts.push({ x, y, z });
        }
      }

      if (pts.length >= 2) {
        result.push({
          edgeId: `edge_hash_${edgeHash}`,
          points: pts,
          isBoundary: true,
        });
      }
    }

    return result;
  }
}
