import { describe, it, expect, beforeAll } from "vitest";
import { OcctKernelAdapter } from "./OcctKernel";
import { CadKernelError } from "../core/CadKernelError";

describe("CALDRA CAD CORE — OcctKernelAdapter (B-Rep / Solid Modeling)", () => {
  let kernel: OcctKernelAdapter;

  beforeAll(async () => {
    kernel = new OcctKernelAdapter();
    await kernel.init();
    expect(kernel.isInitialized).toBe(true);
  });

  it("1. Criação de Primitivas Sólidas (Box, Cylinder, Cone, Sphere)", async () => {
    // Paralelepípedo
    const box = await kernel.createBox(100, 50, 10, "Chapa_Teste");
    expect(box.name).toBe("Chapa_Teste");
    expect(box.shapeType).toBe("solid");
    expect(box.kernelHandle).toBeGreaterThan(0);

    // Cilindro
    const cyl = await kernel.createCylinder(20, 80);
    expect(cyl.shapeType).toBe("solid");

    // Cone
    const cone = await kernel.createCone(30, 10, 60);
    expect(cone.shapeType).toBe("solid");

    // Esfera
    const sphere = await kernel.createSphere(25);
    expect(sphere.shapeType).toBe("solid");
  });

  it("2. Validação e prevenção de geometrias degeneradas", async () => {
    await expect(kernel.createBox(-10, 50, 10)).rejects.toThrow(CadKernelError);
    await expect(kernel.createCylinder(0, 100)).rejects.toThrow(CadKernelError);
    await expect(kernel.createSphere(-5)).rejects.toThrow(CadKernelError);
  });

  it("3. Modelagem 2D → 3D: Esboço e Extrusão", async () => {
    const sketch = await kernel.createSketch({
      id: "perfil_retangular",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 },
      ],
    });

    expect(sketch.kernelHandle).toBeGreaterThan(0);

    const solidExtruded = await kernel.extrude(sketch, 0, 0, 15, "Solido_Extrudado");
    expect(solidExtruded.shapeType).toBe("solid");

    const bbox = await kernel.getBoundingBox(solidExtruded);
    expect(bbox.size.x).toBeCloseTo(80, 0);
    expect(bbox.size.y).toBeCloseTo(40, 0);
    expect(bbox.size.z).toBeCloseTo(15, 0);
  });

  it("4. Operações Booleanas CSG (Fuse, Cut, Intersect)", async () => {
    const base = await kernel.createBox(100, 100, 20, "Base");
    const holeTool = await kernel.createCylinder(15, 40, "Furo");
    // Centraliza o cilindro
    const translatedTool = await kernel.translate(holeTool, 50, 50, -10);

    // Corte booleano (furação)
    const cutResult = await kernel.cut(base, translatedTool, "Chapa_Furada");
    expect(cutResult.shapeType).toBe("solid");

    // Propriedades de massa devem refletir remoção de volume
    const massBase = await kernel.getMassProperties(base);
    const massCut = await kernel.getMassProperties(cutResult);
    expect(massCut.volume).toBeLessThan(massBase.volume);

    // União booleana (fuse)
    const boss = await kernel.createBox(30, 30, 20);
    const fused = await kernel.fuse(base, boss);
    const massFused = await kernel.getMassProperties(fused);
    expect(massFused.volume).toBeGreaterThan(massBase.volume);
  });

  it("5. Modificadores Geométricos (Fillet e Chamfer)", async () => {
    const box = await kernel.createBox(50, 50, 50, "Cubo_Fillet");
    const edges = await kernel.getEdges(box);
    expect(edges.length).toBe(12);

    // Arredonda arestas superiores
    const filleted = await kernel.fillet(box, [0, 1], 5, "Cubo_Arredondado");
    expect(filleted.shapeType).toBe("solid");

    // Chanfro
    const chamfered = await kernel.chamfer(box, [2], 3, "Cubo_Chanfrado");
    expect(chamfered.shapeType).toBe("solid");
  });

  it("6. Transformações Rígidas (Translate, Rotate, Scale, Mirror)", async () => {
    const box = await kernel.createBox(20, 20, 20);
    const moved = await kernel.translate(box, 100, 0, 0);
    const bboxMoved = await kernel.getBoundingBox(moved);
    expect(bboxMoved.min.x).toBeCloseTo(100, 0);

    const scaled = await kernel.scale(box, 2);
    const massScaled = await kernel.getMassProperties(scaled);
    const massOrig = await kernel.getMassProperties(box);
    // Escala 2x em 3D multiplica volume por 8
    expect(massScaled.volume).toBeCloseTo(massOrig.volume * 8, -1);
  });

  it("7. Topologia B-Rep e Consultas Físicas (Faces, Arestas, Vértices)", async () => {
    const box = await kernel.createBox(60, 40, 30);

    const faces = await kernel.getFaces(box);
    expect(faces.length).toBe(6);
    expect(faces[0]?.surfaceType).toBe("plane");

    const edges = await kernel.getEdges(box);
    expect(edges.length).toBe(12);
    expect(edges[0]?.curveType).toBe("line");

    const vertices = await kernel.getVertices(box);
    expect(vertices.length).toBe(8);

    const mass = await kernel.getMassProperties(box);
    expect(mass.volume).toBeCloseTo(60 * 40 * 30, -1);
    expect(mass.surfaceArea).toBeCloseTo(2 * (60 * 40 + 60 * 30 + 40 * 30), -1);
  });

  it("8. Tesselação para Three.js com arestas técnicas (SOMB / SOMB+AR)", async () => {
    const cyl = await kernel.createCylinder(25, 50);
    const mesh = await kernel.tessellate(cyl, { linearDeflection: 0.1, angularDeflection: 0.5 });

    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.normals?.length).toBe(mesh.positions.length);
    expect(mesh.edges && mesh.edges.length).toBeGreaterThan(0);
  });

  it("9. Intercâmbio de Dados CAD: Exportação/Importação STEP e STL", async () => {
    const part = await kernel.createBox(40, 30, 10, "Peca_Export");

    // STEP
    const stepData = await kernel.exportStep(part);
    expect(stepData).toContain("ISO-10303-21");
    expect(stepData).toContain("END-ISO-10303-21");

    // Import STEP
    const imported = await kernel.importStep(stepData, "Peca_Reimportada");
    expect(imported.kernelHandle).toBeGreaterThan(0);

    // STL
    const stlData = await kernel.exportStl(part, false);
    expect(typeof stlData).toBe("string");
    expect((stlData as string).toLowerCase()).toContain("solid");
  });
});
