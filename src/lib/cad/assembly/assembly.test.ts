// @ts-nocheck
import { describe, it, expect } from "vitest";
import type { Solid } from "../canonical";
import { BooleanEngine } from "./booleanEngine";
import { MateSolver } from "./mateSolver";
import { InterferenceEngine } from "./interferenceEngine";
import { BOMGenerator } from "./bomGenerator";
import type { ComponentInstance, AssemblyMate } from "./types";

function createBoxSolid(id: string, name: string, w: number, l: number, h: number): Solid {
  const faces: Face[] = [
    {
      id: `${id}_f_bottom`,
      type: "PLANAR",
      edgeIds: [],
      normal: { x: 0, y: 0, z: -1 },
      area: w * l,
    },
    { id: `${id}_f_top`, type: "PLANAR", edgeIds: [], normal: { x: 0, y: 0, z: 1 }, area: w * l },
    {
      id: `${id}_f_front`,
      type: "PLANAR",
      edgeIds: [],
      normal: { x: 0, y: -1, z: 0 },
      area: w * h,
    },
    { id: `${id}_f_back`, type: "PLANAR", edgeIds: [], normal: { x: 0, y: 1, z: 0 }, area: w * h },
    { id: `${id}_f_left`, type: "PLANAR", edgeIds: [], normal: { x: -1, y: 0, z: 0 }, area: l * h },
    { id: `${id}_f_right`, type: "PLANAR", edgeIds: [], normal: { x: 1, y: 0, z: 0 }, area: l * h },
  ];
  return {
    id,
    name,
    faces,
    edges: [],
    vertices: [
      { id: `${id}_v0`, point: { x: 0, y: 0, z: 0 } },
      { id: `${id}_v1`, point: { x: w, y: 0, z: 0 } },
      { id: `${id}_v2`, point: { x: w, y: l, z: 0 } },
      { id: `${id}_v3`, point: { x: 0, y: l, z: 0 } },
      { id: `${id}_v4`, point: { x: 0, y: 0, z: h } },
      { id: `${id}_v5`, point: { x: w, y: 0, z: h } },
      { id: `${id}_v6`, point: { x: w, y: l, z: h } },
      { id: `${id}_v7`, point: { x: 0, y: l, z: h } },
    ],
    isClosed: true,
    volume: w * l * h,
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: w, y: l, z: h },
    },
  };
}

describe("CALDRA CAD MULTIBODY & ASSEMBLIES — FASE 06", () => {
  it("TESTE 1: BooleanEngine executa UNION, SUBTRACT e INTERSECT de corpos sólidos", () => {
    // Placa base: 100 × 100 × 10 (Volume = 100.000 mm³)
    const plate = createBoxSolid("plate", "Placa Base", 100, 100, 10);
    // Bloco ferramenta dentro da placa: 20 × 20 × 10 (Volume = 4.000 mm³)
    const tool = createBoxSolid("tool", "Rasgo", 20, 20, 10);

    // 1. SUBTRACTION (Corte/Furação)
    const cutResult = BooleanEngine.subtract(plate, tool);
    expect(cutResult.volume).toBe(96000);
    expect(cutResult.faces.length).toBeGreaterThan(plate.faces.length);

    // 2. UNION (Combinação)
    // Placa contígua: 50 × 100 × 10 fora da placa
    const sidePlate: Solid = {
      ...createBoxSolid("side", "Aba", 50, 100, 10),
      boundingBox: { min: { x: 100, y: 0, z: 0 }, max: { x: 150, y: 100, z: 10 } },
    };
    const unionResult = BooleanEngine.union(plate, sidePlate);
    expect(unionResult.volume).toBe(150000);
    expect(unionResult.boundingBox.max.x).toBe(150);

    // 3. INTERSECT (Volume comum compartilhado)
    const intersectResult = BooleanEngine.intersect(plate, tool);
    expect(intersectResult.volume).toBe(4000);
    expect(intersectResult.boundingBox.max.x).toBe(20);
  });

  it("TESTE 2: MateSolver posiciona componentes e rastreia graus de liberdade (DOF)", () => {
    const basePlate = createBoxSolid("c_base", "Mesa Base", 200, 200, 20);
    const bracket = createBoxSolid("c_bracket", "Suporte Angular", 50, 50, 80);

    const compBase: ComponentInstance = {
      id: "comp_base",
      name: "Mesa Base",
      partCode: "P-BASE-01",
      solid: basePlate,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      material: "Aço Carbono",
      density: 7.85,
      massKg: 6.28,
    };

    const compBracket: ComponentInstance = {
      id: "comp_bracket",
      name: "Suporte",
      partCode: "P-BRK-01",
      solid: bracket,
      position: { x: 500, y: 500, z: 500 }, // Posição livre arbitrária
      rotation: { x: 0, y: 0, z: 0 },
      isGrounded: false,
      material: "Aço Carbono",
      density: 7.85,
      massKg: 1.57,
    };

    const mateCoincident: AssemblyMate = {
      id: "mate_1",
      name: "Assentamento na Mesa",
      type: "COINCIDENT",
      targetComponentId: "comp_bracket",
      referenceComponentId: "comp_base",
      offsetMm: 20, // Altura da mesa
      status: "UNRESOLVED",
    };

    const solution = MateSolver.solve([compBase, compBracket], [mateCoincident]);

    expect(solution.updatedMates[0].status).toBe("SATISFIED");
    const updatedBracket = solution.updatedComponents.find((c) => c.id === "comp_bracket");
    expect(updatedBracket).toBeDefined();
    // Posição Z deve ser assentada no offset da mesa (Z = 20)
    expect(updatedBracket?.position.z).toBe(20);
    // DOF reduzido
    expect(solution.totalDOFRemaining).toBeLessThan(6);
  });

  it("TESTE 3: InterferenceEngine identifica colisões volumétricas e folgas", () => {
    const solidA = createBoxSolid("s1", "Peça 1", 100, 100, 20);
    const solidB = createBoxSolid("s2", "Peça 2", 100, 100, 20);

    const compA: ComponentInstance = {
      id: "ca",
      name: "Peça 1",
      partCode: "P01",
      solid: solidA,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      material: "Aço",
      density: 7.85,
      massKg: 1.5,
    };

    // Caso 1: Colisão crítica (mesma posição, sobreposição profunda)
    const compB_clash: ComponentInstance = {
      id: "cb",
      name: "Peça 2",
      partCode: "P02",
      solid: solidB,
      position: { x: 10, y: 10, z: 5 }, // Colisão de 15mm de penetração
      rotation: { x: 0, y: 0, z: 0 },
      isGrounded: false,
      material: "Aço",
      density: 7.85,
      massKg: 1.5,
    };

    const clashes = InterferenceEngine.checkInterferences([compA, compB_clash]);
    expect(clashes.length).toBe(1);
    expect(clashes[0].isCritical).toBe(true);
    expect(clashes[0].overlapVolumeMm3).toBeGreaterThan(0);

    // Caso 2: Peças separadas sem interferência
    const compB_clear: ComponentInstance = {
      ...compB_clash,
      position: { x: 150, y: 0, z: 0 }, // Separado por 50mm
    };
    const noClashes = InterferenceEngine.checkInterferences([compA, compB_clear]);
    expect(noClashes.length).toBe(0);
  });

  it("TESTE 4: BOMGenerator compila Lista Técnica de Materiais e Centro de Gravidade", () => {
    const plate = createBoxSolid("p1", "Chapa Base", 100, 100, 10);
    const pin = createBoxSolid("p2", "Pino Guia", 20, 20, 50);

    const components: ComponentInstance[] = [
      {
        id: "c1",
        name: "Chapa Base",
        partCode: "CHP-01",
        solid: plate,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        isGrounded: true,
        material: "Aço ASTM A36",
        density: 7.85,
        massKg: 0.785,
      },
      {
        id: "c2",
        name: "Pino Guia",
        partCode: "PIN-01",
        solid: pin,
        position: { x: 10, y: 10, z: 10 },
        rotation: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        material: "Aço SAE 1045",
        density: 7.85,
        massKg: 0.157,
      },
      {
        id: "c3",
        name: "Pino Guia",
        partCode: "PIN-01", // Mesmo código de peça
        solid: pin,
        position: { x: 70, y: 70, z: 10 },
        rotation: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        material: "Aço SAE 1045",
        density: 7.85,
        massKg: 0.157,
      },
    ];

    const report = BOMGenerator.generateReport("Montagem Gabarito", components);

    expect(report.totalComponents).toBe(3);
    expect(report.uniquePartsCount).toBe(2); // 2 itens na BOM

    const pinItem = report.bom.find((b) => b.partCode === "PIN-01");
    expect(pinItem).toBeDefined();
    expect(pinItem?.quantity).toBe(2);
    expect(pinItem?.totalMassKg).toBeCloseTo(0.314, 2);

    // Centro de gravidade deve estar computado
    expect(report.centerOfMass.z).toBeGreaterThan(0);
    expect(report.totalMassKg).toBeCloseTo(1.099, 2);
  });
});
