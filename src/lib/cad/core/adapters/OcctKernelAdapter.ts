/**
 * CALDRA CAD CORE — OCCT KERNEL ADAPTER
 *
 * Adaptador de integração para OpenCascade WebAssembly (occt-wasm v5.x).
 * Implementa ICadKernel isolando todas as chamadas internas ao OCCT.
 * Nenhuma entidade externa à camada /core precisa conhecer occt-wasm diretamente.
 */

import { OcctKernel, type ShapeHandle } from "occt-wasm";
import type {
  ICadKernel,
  MassProperties,
  TessellateOptions,
} from "../CadKernel";
import { CadKernelError, wrapKernelError } from "../CadKernelError";
import {
  type CadShape,
  type CadShapeType,
  createCadShape,
} from "../CadShape";
import type {
  CadBoundingBox,
  CadEdge,
  CadFace,
  CadSolid,
  CadVector3D,
  CadVertex,
  CadSurfaceType,
  CadCurveType,
} from "../CadTopology";
import type {
  CadTessellatedShape,
  CadMeshData,
  CadEdgeData,
  CadPolylineEdge,
  CadFaceGroup,
} from "../CadMesh";
import { CadTopologicalNaming } from "../CadTopologicalNaming";

export class OcctKernelAdapter implements ICadKernel {
  private occt: OcctKernel | null = null;
  private initializingPromise: Promise<void> | null = null;

  get isInitialized(): boolean {
    return this.occt !== null;
  }

  private ensureKernel(): OcctKernel {
    if (!this.occt) {
      throw new CadKernelError({
        operation: "ensureKernel",
        message: "O motor CAD (OCCT WASM) ainda não foi inicializado. Chame init() primeiro.",
        code: "NOT_INITIALIZED",
        recoverable: true,
      });
    }
    return this.occt;
  }

  async init(wasmSource?: string | URL | ArrayBuffer | Uint8Array): Promise<void> {
    if (this.occt) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      try {
        let options: { wasm?: string | URL | ArrayBuffer | Uint8Array } = {};
        if (wasmSource) {
          options = { wasm: wasmSource };
        } else if (typeof window !== "undefined") {
          // No navegador, consome o binário estático servido em /public/
          options = { wasm: "/occt-wasm.wasm" };
        }
        // No Node.js (ex: Vitest), se options.wasm for omitido, o occt-wasm auto-localiza o arquivo via import.meta.url

        this.occt = await OcctKernel.init(options);
      } catch (err) {
        this.occt = null;
        throw wrapKernelError("init", err, "INITIALIZATION_FAILED", false);
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  dispose(): void {
    if (this.occt) {
      try {
        if (typeof (this.occt as unknown as { [Symbol.dispose]?: () => void })[Symbol.dispose] === "function") {
          (this.occt as unknown as { [Symbol.dispose]: () => void })[Symbol.dispose]();
        }
      } catch (err) {
        console.warn("[CALDRA CAD Core] Aviso ao descartar kernel OCCT:", err);
      }
      this.occt = null;
    }
  }

  // ==========================================
  // PRIMITIVAS B-REP
  // ==========================================

  async createBox(
    dx: number,
    dy: number,
    dz: number,
    centerOrigin = false,
    name = "Caixa",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    if (dx <= 0 || dy <= 0 || dz <= 0) {
      throw new CadKernelError({
        operation: "createBox",
        message: `Dimensões inválidas para caixa: ${dx} × ${dy} × ${dz} mm. Devem ser estritamente positivas.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      let handle = k.makeBox(dx, dy, dz);
      if (centerOrigin) {
        const centered = k.translate(handle, -dx / 2, -dy / 2, -dz / 2);
        k.release(handle);
        handle = centered;
      }
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
        volume: dx * dy * dz,
      });
    } catch (err) {
      throw wrapKernelError("createBox", err, "BOOLEAN_FAILED");
    }
  }

  async createCylinder(
    radius: number,
    height: number,
    centerBase = true,
    name = "Cilindro",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    if (radius <= 0 || height <= 0) {
      throw new CadKernelError({
        operation: "createCylinder",
        message: `Dimensões inválidas para cilindro: Raio=${radius}, Altura=${height} mm.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      let handle = k.makeCylinder(radius, height);
      if (centerBase) {
        // Por padrão o makeCylinder já tem a base centrada no eixo Z em (0, 0, 0) até (0, 0, height)
      }
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
        volume: Math.PI * radius * radius * height,
      });
    } catch (err) {
      throw wrapKernelError("createCylinder", err, "BOOLEAN_FAILED");
    }
  }

  async createCone(
    r1: number,
    r2: number,
    height: number,
    name = "Cone",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    if (r1 < 0 || r2 < 0 || (r1 === 0 && r2 === 0) || height <= 0) {
      throw new CadKernelError({
        operation: "createCone",
        message: `Dimensões inválidas para cone: r1=${r1}, r2=${r2}, altura=${height} mm.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    // OpenCascade MakeCone proíbe r1 == r2 (Abs(r1 - r2) < Confusion lança DomainError).
    // Se r1 == r2, delega transparentemente para criação de cilindro correspondente.
    if (Math.abs(r1 - r2) < 1e-3) {
      return await this.createCylinder(r1, height, false, name);
    }

    try {
      const handle = k.makeCone(r1, r2, height);
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("createCone", err, "BOOLEAN_FAILED");
    }
  }

  async createSphere(radius: number, name = "Esfera"): Promise<CadShape> {
    const k = this.ensureKernel();
    if (radius <= 0) {
      throw new CadKernelError({
        operation: "createSphere",
        message: `Raio inválido para esfera: ${radius} mm.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      const handle = k.makeSphere(radius);
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
        volume: (4 / 3) * Math.PI * radius * radius * radius,
      });
    } catch (err) {
      throw wrapKernelError("createSphere", err, "BOOLEAN_FAILED");
    }
  }

  async createTorus(majorRadius: number, minorRadius: number, name = "Toro"): Promise<CadShape> {
    const k = this.ensureKernel();
    if (majorRadius <= 0 || minorRadius <= 0 || minorRadius >= majorRadius) {
      throw new CadKernelError({
        operation: "createTorus",
        message: `Dimensões inválidas para toro: Raio Maior=${majorRadius}, Raio Menor=${minorRadius}.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      const handle = k.makeTorus(majorRadius, minorRadius);
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("createTorus", err, "BOOLEAN_FAILED");
    }
  }

  // ==========================================
  // PERFIS 2D E EXTRUSÃO
  // ==========================================

  async createRectangleFace(width: number, height: number, name = "Face Retangular"): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.makeRectangle(width, height);
      return createCadShape({
        name,
        type: "face",
        handle: handle as unknown as number,
        surfaceArea: width * height,
      });
    } catch (err) {
      throw wrapKernelError("createRectangleFace", err);
    }
  }

  async createCircleFace(radius: number, name = "Face Circular"): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const edge = k.makeCircleEdge({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, radius);
      const wire = k.makeWire([edge]);
      const face = k.makeFace(wire);
      k.release(edge);
      k.release(wire);
      return createCadShape({
        name,
        type: "face",
        handle: face as unknown as number,
        surfaceArea: Math.PI * radius * radius,
      });
    } catch (err) {
      throw wrapKernelError("createCircleFace", err);
    }
  }

  async extrude(
    profile: CadShape,
    dx: number,
    dy: number,
    dz: number,
    name = "Extrusão",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.extrude(profile.handle as unknown as ShapeHandle, dx, dy, dz);
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("extrude", err, "EXTRUSION_FAILED");
    }
  }

  async revolve(
    profile: CadShape,
    axisPoint: CadVector3D,
    axisDirection: CadVector3D,
    angleRad = Math.PI * 2,
    name = "Revolução",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.revolve(
        profile.handle as unknown as ShapeHandle,
        {
          point: axisPoint,
          direction: axisDirection,
        },
        angleRad,
      );
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("revolve", err, "REVOLUTION_FAILED");
    }
  }

  async loft(
    wireProfiles: CadShape[],
    isSolid = true,
    ruled = false,
    name = "Loft",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    if (wireProfiles.length < 2) {
      throw new CadKernelError({
        operation: "loft",
        message: "A operação de Loft exige pelo menos 2 perfis de contorno (wires).",
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      const handles = wireProfiles.map((p) => p.handle as unknown as ShapeHandle);
      const handle = k.loft(handles, isSolid, ruled);
      return createCadShape({
        name,
        type: isSolid ? "solid" : "shell",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("loft", err, "LOFT_FAILED");
    }
  }

  // ==========================================
  // OPERAÇÕES BOOLEANAS EXATAS
  // ==========================================

  async fuse(a: CadShape, b: CadShape, name = "União Booleana"): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.fuse(
        a.handle as unknown as ShapeHandle,
        b.handle as unknown as ShapeHandle,
      );
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("fuse", err, "BOOLEAN_FAILED");
    }
  }

  async cut(base: CadShape, tool: CadShape, name = "Corte Booleano"): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.cut(
        base.handle as unknown as ShapeHandle,
        tool.handle as unknown as ShapeHandle,
      );
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("cut", err, "BOOLEAN_FAILED");
    }
  }

  async intersect(a: CadShape, b: CadShape, name = "Interseção Booleana"): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.intersect(
        a.handle as unknown as ShapeHandle,
        b.handle as unknown as ShapeHandle,
      );
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("intersect", err, "BOOLEAN_FAILED");
    }
  }

  // ==========================================
  // OPERAÇÕES DE DETALHE (FILLET / CHAMFER)
  // ==========================================

  async fillet(
    solid: CadShape,
    radius: number,
    edgeIndicesOrHandles?: number[],
    name = "Filete",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    if (radius <= 0) {
      throw new CadKernelError({
        operation: "fillet",
        message: `Raio de concordância inválido: ${radius} mm. Deve ser maior que zero.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      let targetEdges: ShapeHandle[] = [];
      const allEdges = k.getSubShapes(solid.handle as unknown as ShapeHandle, "edge");

      if (edgeIndicesOrHandles && edgeIndicesOrHandles.length > 0) {
        targetEdges = edgeIndicesOrHandles
          .map((idx) => allEdges[idx])
          .filter((e): e is ShapeHandle => e !== undefined);
      } else {
        targetEdges = allEdges;
      }

      const handle = k.fillet(
        solid.handle as unknown as ShapeHandle,
        targetEdges,
        radius,
      );
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("fillet", err, "FILLET_FAILED");
    }
  }

  async chamfer(
    solid: CadShape,
    distance: number,
    edgeIndicesOrHandles?: number[],
    name = "Chanfro",
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    if (distance <= 0) {
      throw new CadKernelError({
        operation: "chamfer",
        message: `Distância de chanfro inválida: ${distance} mm. Deve ser maior que zero.`,
        code: "INVALID_DIMENSIONS",
      });
    }

    try {
      let targetEdges: ShapeHandle[] = [];
      const allEdges = k.getSubShapes(solid.handle as unknown as ShapeHandle, "edge");

      if (edgeIndicesOrHandles && edgeIndicesOrHandles.length > 0) {
        targetEdges = edgeIndicesOrHandles
          .map((idx) => allEdges[idx])
          .filter((e): e is ShapeHandle => e !== undefined);
      } else {
        targetEdges = allEdges;
      }

      const handle = k.chamfer(
        solid.handle as unknown as ShapeHandle,
        targetEdges,
        distance,
      );
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("chamfer", err, "CHAMFER_FAILED");
    }
  }

  // ==========================================
  // TRANSFORMAÇÕES ESPACIAIS
  // ==========================================

  async translate(shape: CadShape, dx: number, dy: number, dz: number): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.translate(shape.handle as unknown as ShapeHandle, dx, dy, dz);
      return createCadShape({
        name: shape.name,
        type: shape.type,
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("translate", err, "TRANSFORM_FAILED");
    }
  }

  async rotate(
    shape: CadShape,
    point: CadVector3D,
    direction: CadVector3D,
    angleRad: number,
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.rotate(
        shape.handle as unknown as ShapeHandle,
        { point, direction },
        angleRad,
      );
      return createCadShape({
        name: shape.name,
        type: shape.type,
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("rotate", err, "TRANSFORM_FAILED");
    }
  }

  async scale(shape: CadShape, center: CadVector3D, factor: number): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.scale(shape.handle as unknown as ShapeHandle, center, factor);
      return createCadShape({
        name: shape.name,
        type: shape.type,
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("scale", err, "TRANSFORM_FAILED");
    }
  }

  async mirror(
    shape: CadShape,
    planePoint: CadVector3D,
    planeNormal: CadVector3D,
  ): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.mirror(shape.handle as unknown as ShapeHandle, planePoint, planeNormal);
      return createCadShape({
        name: shape.name,
        type: shape.type,
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("mirror", err, "TRANSFORM_FAILED");
    }
  }

  // ==========================================
  // CONSULTAS TOPOLÓGICAS E PROPRIEDADES FÍSICAS
  // ==========================================

  async getBoundingBox(shape: CadShape): Promise<CadBoundingBox> {
    const k = this.ensureKernel();
    try {
      const bb = k.getBoundingBox(shape.handle as unknown as ShapeHandle);
      const min: CadVector3D = { x: bb.xmin, y: bb.ymin, z: bb.zmin };
      const max: CadVector3D = { x: bb.xmax, y: bb.ymax, z: bb.zmax };
      const size: CadVector3D = {
        x: bb.xmax - bb.xmin,
        y: bb.ymax - bb.ymin,
        z: bb.zmax - bb.zmin,
      };
      return { min, max, size };
    } catch (err) {
      throw wrapKernelError("getBoundingBox", err);
    }
  }

  async getMassProperties(shape: CadShape, densityGcm3 = 7.85): Promise<MassProperties> {
    const k = this.ensureKernel();
    try {
      const volume = k.getVolume(shape.handle as unknown as ShapeHandle);
      const surfaceArea = k.getSurfaceArea(shape.handle as unknown as ShapeHandle);
      const com = k.getCenterOfMass(shape.handle as unknown as ShapeHandle);
      let inertiaMatrix: number[] | undefined;
      try {
        inertiaMatrix = k.getInertia(shape.handle as unknown as ShapeHandle);
      } catch {
        // Ignora se não aplicável
      }

      // Densidade g/cm³ para kg/mm³: 1 g/cm³ = 1e-6 kg/mm³
      const massKg = volume * (densityGcm3 * 1e-6);

      return {
        volume,
        surfaceArea,
        mass: massKg,
        centerOfMass: { x: com.x, y: com.y, z: com.z },
        inertiaMatrix,
      };
    } catch (err) {
      throw wrapKernelError("getMassProperties", err);
    }
  }

  async getFaces(shape: CadShape): Promise<CadFace[]> {
    const k = this.ensureKernel();
    try {
      const faceHandles = k.getSubShapes(shape.handle as unknown as ShapeHandle, "face");
      const faces: CadFace[] = [];

      for (let i = 0; i < faceHandles.length; i++) {
        const fh = faceHandles[i]!;
        let surfaceKind: CadSurfaceType = "plane";
        try {
          const rawKind = k.surfaceType(fh);
          surfaceKind = (rawKind as CadSurfaceType) || "plane";
        } catch {
          surfaceKind = "other";
        }

        let area = 0;
        try {
          area = k.getSurfaceArea(fh);
        } catch {
          area = 0;
        }

        let normal: CadVector3D = { x: 0, y: 0, z: 1 };
        try {
          const n = k.surfaceNormal(fh, 0.5, 0.5);
          normal = { x: n.x, y: n.y, z: n.z };
        } catch {
          normal = { x: 0, y: 0, z: 1 };
        }

        let centerOfMass: CadVector3D = { x: 0, y: 0, z: 0 };
        try {
          const com = k.getSurfaceCenterOfMass(fh);
          centerOfMass = { x: com.x, y: com.y, z: com.z };
        } catch {
          centerOfMass = { x: 0, y: 0, z: 0 };
        }

        const edgeHandles = k.getSubShapes(fh, "edge");
        const edgeIds = edgeHandles.map((eh, eidx) => `edge_${eidx}`);

        const fingerprint = CadTopologicalNaming.computeFaceFingerprint({
          surfaceType: surfaceKind,
          normal,
          centerOfMass,
          area,
        });

        faces.push({
          id: `face_${i}`,
          index: i,
          handle: fh as unknown as number,
          fingerprint,
          surfaceType: surfaceKind,
          area,
          normal,
          centerOfMass,
          edgeIds,
        });
      }

      return faces;
    } catch (err) {
      throw wrapKernelError("getFaces", err);
    }
  }

  async getEdges(shape: CadShape): Promise<CadEdge[]> {
    const k = this.ensureKernel();
    try {
      const edgeHandles = k.getSubShapes(shape.handle as unknown as ShapeHandle, "edge");
      const edges: CadEdge[] = [];

      for (let i = 0; i < edgeHandles.length; i++) {
        const eh = edgeHandles[i]!;
        let length = 0;
        try {
          length = k.getLength(eh);
        } catch {
          length = 0;
        }

        const vertices = k.getSubShapes(eh, "vertex");
        let p0: CadVector3D = { x: 0, y: 0, z: 0 };
        let p1: CadVector3D = { x: 0, y: 0, z: 0 };
        if (vertices[0]) {
          try {
            const pos0 = k.vertexPosition(vertices[0]);
            p0 = { x: pos0.x, y: pos0.y, z: pos0.z };
          } catch {
            p0 = { x: 0, y: 0, z: 0 };
          }
        }
        if (vertices[1]) {
          try {
            const pos1 = k.vertexPosition(vertices[1]);
            p1 = { x: pos1.x, y: pos1.y, z: pos1.z };
          } catch {
            p1 = { x: 0, y: 0, z: 0 };
          }
        }

        const v0 = vertices[0] ? `vertex_${0}` : "";
        const v1 = vertices[1] ? `vertex_${1}` : v0;

        const midpoint: CadVector3D = {
          x: (p0.x + p1.x) / 2,
          y: (p0.y + p1.y) / 2,
          z: (p0.z + p1.z) / 2,
        };

        const fingerprint = CadTopologicalNaming.computeEdgeFingerprint({
          curveType: "line",
          length,
          midpoint,
        });

        edges.push({
          id: `edge_${i}`,
          index: i,
          handle: eh as unknown as number,
          fingerprint,
          curveType: "line",
          v0,
          v1,
          length,
          faceIds: [],
        });
      }

      return edges;
    } catch (err) {
      throw wrapKernelError("getEdges", err);
    }
  }

  async getVertices(shape: CadShape): Promise<CadVertex[]> {
    const k = this.ensureKernel();
    try {
      const vertexHandles = k.getSubShapes(shape.handle as unknown as ShapeHandle, "vertex");
      const vertices: CadVertex[] = [];

      for (let i = 0; i < vertexHandles.length; i++) {
        const vh = vertexHandles[i]!;
        let point: CadVector3D = { x: 0, y: 0, z: 0 };
        try {
          const pos = k.vertexPosition(vh);
          point = { x: pos.x, y: pos.y, z: pos.z };
        } catch {
          point = { x: 0, y: 0, z: 0 };
        }

        const fingerprint = CadTopologicalNaming.computeVertexFingerprint({ point });

        vertices.push({
          id: `vertex_${i}`,
          index: i,
          handle: vh as unknown as number,
          fingerprint,
          point,
          edgeIds: [],
        });
      }

      return vertices;
    } catch (err) {
      throw wrapKernelError("getVertices", err);
    }
  }

  async getDistanceBetween(handleA: number, handleB: number): Promise<number> {
    const k = this.ensureKernel();
    try {
      return k.distanceBetween(
        handleA as unknown as ShapeHandle,
        handleB as unknown as ShapeHandle,
      );
    } catch (err) {
      throw wrapKernelError("getDistanceBetween", err);
    }
  }

  async getAdjacentFaces(shape: CadShape, faceHandle: number): Promise<CadFace[]> {
    const k = this.ensureKernel();
    try {
      const adjHandles = k.adjacentFaces(
        shape.handle as unknown as ShapeHandle,
        faceHandle as unknown as ShapeHandle,
      );
      const allFaces = await this.getFaces(shape);
      return allFaces.filter((f) =>
        adjHandles.some((ah) =>
          k.isSame(ah, f.handle as unknown as ShapeHandle),
        ),
      );
    } catch (err) {
      throw wrapKernelError("getAdjacentFaces", err);
    }
  }

  async getSharedEdges(
    shape: CadShape,
    faceAHandle: number,
    faceBHandle: number,
  ): Promise<CadEdge[]> {
    const k = this.ensureKernel();
    try {
      const sharedEdgeHandles = k.sharedEdges(
        faceAHandle as unknown as ShapeHandle,
        faceBHandle as unknown as ShapeHandle,
      );
      const allEdges = await this.getEdges(shape);
      return allEdges.filter((e) =>
        sharedEdgeHandles.some((seh) =>
          k.isSame(seh, e.handle as unknown as ShapeHandle),
        ),
      );
    } catch (err) {
      throw wrapKernelError("getSharedEdges", err);
    }
  }

  async getTopology(shape: CadShape): Promise<CadSolid> {
    const [bounds, mass, faces, edges, vertices] = await Promise.all([
      this.getBoundingBox(shape),
      this.getMassProperties(shape),
      this.getFaces(shape),
      this.getEdges(shape),
      this.getVertices(shape),
    ]);

    return {
      id: shape.id,
      name: shape.name,
      shells: [
        {
          id: `shell_0`,
          faceIds: faces.map((f) => f.id),
          isClosed: true,
        },
      ],
      faces,
      edges,
      vertices,
      volume: mass.volume,
      surfaceArea: mass.surfaceArea,
      bounds,
      centerOfMass: mass.centerOfMass,
    };
  }

  // ==========================================
  // TESSELAÇÃO PARA VISUALIZAÇÃO THREE.JS
  // ==========================================

  async tessellate(
    shape: CadShape,
    options: TessellateOptions = {},
  ): Promise<CadTessellatedShape> {
    const k = this.ensureKernel();
    try {
      const linearDeflection = options.linearDeflection ?? 0.1;
      const angularDeflection = options.angularDeflection ?? 0.5;

      // 1. Tesselação das faces com mapeamento de grupos por Face CAD
      const rawMesh = k.meshShape(shape.handle as unknown as ShapeHandle, {
        linearDeflection,
        angularDeflection,
      });

      const faceGroups: CadFaceGroup[] = [];
      if (rawMesh.faceGroups && rawMesh.faceCount) {
        for (let i = 0; i < rawMesh.faceCount; i++) {
          const startTriangle = rawMesh.faceGroups[i * 3] ?? 0;
          const triangleCount = rawMesh.faceGroups[i * 3 + 1] ?? 0;
          const faceHash = rawMesh.faceGroups[i * 3 + 2] ?? 0;
          faceGroups.push({
            faceId: `face_${i}`,
            faceIndex: i,
            faceHash,
            startTriangle,
            triangleCount,
          });
        }
      }

      const meshData: CadMeshData = {
        positions: rawMesh.positions,
        normals: rawMesh.normals,
        indices: rawMesh.indices,
        vertexCount: rawMesh.vertexCount,
        triangleCount: rawMesh.triangleCount,
        faceGroups,
      };

      // 2. Extração das arestas CAD reais (sem triangulação interna)
      const edgeData = k.wireframe(shape.handle as unknown as ShapeHandle, {
        deflection: linearDeflection,
        source: "curve",
      });

      const edges: CadPolylineEdge[] = [];
      if (edgeData.edgeGroups && edgeData.edgeCount) {
        for (let i = 0; i < edgeData.edgeCount; i++) {
          const pointStart = edgeData.edgeGroups[i * 3] ?? 0;
          const pointCount = edgeData.edgeGroups[i * 3 + 1] ?? 0;
          const edgeHash = edgeData.edgeGroups[i * 3 + 2] ?? 0;

          // Extrai o slice de coordenadas XYZ correspondente à polilinha
          const edgePoints = edgeData.points.slice(pointStart, pointStart + pointCount);

          edges.push({
            edgeId: `edge_${i}`,
            edgeIndex: i,
            edgeHash,
            points: edgePoints,
            pointCount: pointCount / 3,
          });
        }
      }

      const bounds = await this.getBoundingBox(shape);

      return {
        mesh: meshData,
        edges: {
          edges,
          totalEdges: edgeData.edgeCount,
          totalPoints: edgeData.pointCount / 3,
        },
        bounds,
      };
    } catch (err) {
      throw wrapKernelError("tessellate", err, "TESSELLATION_FAILED");
    }
  }

  // ==========================================
  // INTEROPERABILIDADE STEP / BREP / STL
  // ==========================================

  async exportStep(shape: CadShape): Promise<string> {
    const k = this.ensureKernel();
    try {
      return k.exportStep(shape.handle as unknown as ShapeHandle);
    } catch (err) {
      throw wrapKernelError("exportStep", err, "STEP_EXPORT_FAILED");
    }
  }

  async importStep(stepContent: string | ArrayBuffer, name = "Importado STEP"): Promise<CadShape> {
    const k = this.ensureKernel();
    try {
      const handle = k.importStep(stepContent);
      return createCadShape({
        name,
        type: "solid",
        handle: handle as unknown as number,
      });
    } catch (err) {
      throw wrapKernelError("importStep", err, "STEP_IMPORT_FAILED");
    }
  }

  async exportBrep(shape: CadShape): Promise<string> {
    const k = this.ensureKernel();
    try {
      return k.toBREP(shape.handle as unknown as ShapeHandle);
    } catch (err) {
      throw wrapKernelError("exportBrep", err);
    }
  }

  async exportStl(shape: CadShape, linearDeflection = 0.1): Promise<string> {
    const k = this.ensureKernel();
    try {
      return k.exportStl(shape.handle as unknown as ShapeHandle, linearDeflection, true);
    } catch (err) {
      throw wrapKernelError("exportStl", err);
    }
  }

  // ==========================================
  // LIBERAÇÃO DE MEMÓRIA DA ARENA
  // ==========================================

  release(shape: CadShape): void {
    if (!this.occt) return;
    try {
      this.occt.release(shape.handle as unknown as ShapeHandle);
    } catch (err) {
      console.warn(`[CALDRA CAD Core] Erro ao liberar shape ${shape.id}:`, err);
    }
  }
}

// Instância Singleton do motor CAD para reaproveitamento de memória WASM
let _cadKernelInstance: ICadKernel | null = null;

export function getCadKernel(): ICadKernel {
  if (!_cadKernelInstance) {
    _cadKernelInstance = new OcctKernelAdapter();
  }
  return _cadKernelInstance;
}
