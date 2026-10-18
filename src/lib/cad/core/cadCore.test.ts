import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OcctKernelAdapter, getCadKernel } from "./adapters/OcctKernelAdapter";
import { CadKernelError } from "./CadKernelError";

describe("CALDRA CAD CORE — FASE 02 (Abstração & Kernel OCCT)", () => {
  let kernel: OcctKernelAdapter;

  beforeAll(async () => {
    kernel = new OcctKernelAdapter();
    await kernel.init();
    expect(kernel.isInitialized).toBe(true);
  });

  afterAll(() => {
    if (kernel) {
      kernel.dispose();
      expect(kernel.isInitialized).toBe(false);
    }
  });

  it("deve inicializar e reaproveitar via singleton getCadKernel()", async () => {
    const singleton = getCadKernel();
    expect(singleton).toBeDefined();
    await singleton.init();
    expect(singleton.isInitialized).toBe(true);
  });

  it("deve lançar CadKernelError com código específico se dimensões forem inválidas", async () => {
    await expect(kernel.createBox(-10, 50, 20)).rejects.toThrow(CadKernelError);
    try {
      await kernel.createBox(0, 100, 50);
    } catch (err) {
      expect(err).toBeInstanceOf(CadKernelError);
      const kErr = err as CadKernelError;
      expect(kErr.code).toBe("INVALID_DIMENSIONS");
      expect(kErr.operation).toBe("createBox");
      expect(kErr.recoverable).toBe(true);
    }
  });

  it("POC PEÇA 01: deve criar uma Caixa sólida 100 × 100 × 50 mm e calcular propriedades", async () => {
    const box = await kernel.createBox(100, 100, 50, false, "Caixa Base 100x100x50");
    expect(box).toBeDefined();
    expect(box.type).toBe("solid");
    expect(box.name).toBe("Caixa Base 100x100x50");

    // Bounding Box
    const bbox = await kernel.getBoundingBox(box);
    expect(bbox.size.x).toBeCloseTo(100, 1);
    expect(bbox.size.y).toBeCloseTo(100, 1);
    expect(bbox.size.z).toBeCloseTo(50, 1);

    // Propriedades de massa e volume
    const mass = await kernel.getMassProperties(box, 7.85); // Aço 7.85 g/cm³
    expect(mass.volume).toBeCloseTo(100 * 100 * 50, 0); // 500.000 mm³
    expect(mass.mass).toBeCloseTo(500000 * 7.85 * 1e-6, 2); // ~3.925 kg
    expect(mass.centerOfMass.x).toBeCloseTo(50, 1);
    expect(mass.centerOfMass.y).toBeCloseTo(50, 1);
    expect(mass.centerOfMass.z).toBeCloseTo(25, 1);

    // Consulta de Faces, Arestas e Vértices
    const faces = await kernel.getFaces(box);
    expect(faces.length).toBe(6); // 6 faces da caixa

    const edges = await kernel.getEdges(box);
    expect(edges.length).toBe(12); // 12 arestas

    const vertices = await kernel.getVertices(box);
    expect(vertices.length).toBe(8); // 8 vértices

    // Tesselação para Three.js
    const tess = await kernel.tessellate(box);
    expect(tess.mesh.triangleCount).toBe(12); // 2 triângulos por face
    expect(tess.mesh.positions.length).toBe(tess.mesh.vertexCount * 3);
    expect(tess.mesh.normals.length).toBe(tess.mesh.vertexCount * 3);
    expect(tess.mesh.faceGroups.length).toBe(6); // 6 grupos de faces

    // Arestas CAD reais para renderização técnica
    expect(tess.edges.totalEdges).toBe(12);
    expect(tess.edges.edges.length).toBe(12);

    kernel.release(box);
  });

  it("POC PEÇA 01: deve executar Boolean Cut criando furo cilíndrico na caixa", async () => {
    // 1. Caixa 100 x 100 x 50 mm centrada na origem
    const box = await kernel.createBox(100, 100, 50, true, "Placa Base");

    // 2. Cilindro para furo de diâmetro Ø30 mm (raio 15 mm) passando por toda a espessura
    const holeTool = await kernel.createCylinder(15, 70, true, "Cilindro Furo");
    // Move o cilindro para atravessar de z = -35 a +35 (cobrindo todo o z da caixa de -25 a +25)
    const shiftedTool = await kernel.translate(holeTool, 0, 0, -35);
    kernel.release(holeTool);

    // 3. Subtração booleana: Peça com furo
    const holedPart = await kernel.cut(box, shiftedTool, "Placa com Furo Central");
    kernel.release(box);
    kernel.release(shiftedTool);

    expect(holedPart).toBeDefined();
    expect(holedPart.type).toBe("solid");

    // Bounding Box da peça furada
    const bbox = await kernel.getBoundingBox(holedPart);
    expect(bbox.size.x).toBeCloseTo(100, 1);
    expect(bbox.size.y).toBeCloseTo(100, 1);
    expect(bbox.size.z).toBeCloseTo(50, 1);

    // Volume do sólido resultante deve ser Volume(Caixa) - Volume(Cilindro que intersecta)
    const expectedCylinderVolInBox = Math.PI * 15 * 15 * 50;
    const expectedVol = 100 * 100 * 50 - expectedCylinderVolInBox;
    const mass = await kernel.getMassProperties(holedPart);
    expect(mass.volume).toBeCloseTo(expectedVol, 0);

    // Faces: 6 da caixa + 1 (ou 2 semi-cilindros) da parede interna do furo
    const faces = await kernel.getFaces(holedPart);
    expect(faces.length).toBeGreaterThanOrEqual(7);

    // Tesselação
    const tess = await kernel.tessellate(holedPart);
    expect(tess.mesh.triangleCount).toBeGreaterThan(12);
    expect(tess.edges.totalEdges).toBeGreaterThan(12); // 12 arestas da caixa + círculos do furo

    kernel.release(holedPart);
  });

  it("deve aplicar Filete (Fillet) em arestas de um sólido", async () => {
    const box = await kernel.createBox(60, 60, 40, false, "Caixa para Filete");
    const filleted = await kernel.fillet(box, 3, [0, 1], "Caixa Filetada");
    kernel.release(box);

    expect(filleted).toBeDefined();
    expect(filleted.type).toBe("solid");

    const mass = await kernel.getMassProperties(filleted);
    expect(mass.volume).toBeLessThan(60 * 60 * 40); // Perdeu material nos cantos arredondados

    kernel.release(filleted);
  });

  it("deve aplicar Chanfro (Chamfer) em arestas de um sólido", async () => {
    const box = await kernel.createBox(50, 50, 30, false, "Caixa para Chanfro");
    const chamfered = await kernel.chamfer(box, 4, [0], "Caixa Chanfrada");
    kernel.release(box);

    expect(chamfered).toBeDefined();
    expect(chamfered.type).toBe("solid");

    const mass = await kernel.getMassProperties(chamfered);
    expect(mass.volume).toBeLessThan(50 * 50 * 30);

    kernel.release(chamfered);
  });

  it("deve exportar para arquivo neutro STEP (ISO 10303-21)", async () => {
    const box = await kernel.createBox(40, 30, 20, false, "Peça STEP");
    const stepData = await kernel.exportStep(box);
    kernel.release(box);

    expect(stepData).toBeDefined();
    expect(typeof stepData).toBe("string");
    expect(stepData).toContain("ISO-10303-21");
    expect(stepData).toContain("HEADER");
    expect(stepData).toContain("DATA");
    expect(stepData).toContain("ENDSEC");
  });

  it("FASE 04: deve gerar impressões digitais determinísticas (Fingerprints) para Faces, Arestas e Vértices", async () => {
    const box = await kernel.createBox(100, 100, 50, false, "Caixa Fingerprint");
    const faces = await kernel.getFaces(box);
    const edges = await kernel.getEdges(box);
    const vertices = await kernel.getVertices(box);

    expect(faces.length).toBe(6);
    for (const f of faces) {
      expect(f.fingerprint).toBeDefined();
      expect(typeof f.fingerprint).toBe("string");
      expect(f.fingerprint).toContain("face_plane");
    }

    expect(edges.length).toBe(12);
    for (const e of edges) {
      expect(e.fingerprint).toBeDefined();
      expect(e.fingerprint).toContain("edge_line");
    }

    expect(vertices.length).toBe(8);
    for (const v of vertices) {
      expect(v.fingerprint).toBeDefined();
      expect(v.fingerprint).toContain("vertex_p");
    }

    kernel.release(box);
  });

  it("FASE 04: deve calcular a distância analítica mínima entre duas faces opostas", async () => {
    const box = await kernel.createBox(100, 100, 50, false, "Caixa Distância");
    const faces = await kernel.getFaces(box);

    // Encontra duas faces opostas em X (normal -1,0,0 e +1,0,0)
    const faceLeft = faces.find((f) => f.normal.x < -0.9);
    const faceRight = faces.find((f) => f.normal.x > 0.9);

    expect(faceLeft).toBeDefined();
    expect(faceRight).toBeDefined();

    if (faceLeft?.handle !== undefined && faceRight?.handle !== undefined) {
      const dist = await kernel.getDistanceBetween(faceLeft.handle, faceRight.handle);
      expect(dist).toBeCloseTo(100, 1); // Distância exata entre as faces = largura da caixa (100 mm)
    }

    // Consulta de faces adjacentes à face esquerda (devem ser 4 faces: topo, base, frontal, traseira)
    if (faceLeft?.handle !== undefined) {
      const adj = await kernel.getAdjacentFaces(box, faceLeft.handle);
      expect(adj.length).toBe(4);
    }

    kernel.release(box);
  });
});
