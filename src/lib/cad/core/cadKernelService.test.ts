import { describe, it, expect, beforeAll } from "vitest";
import { OcctKernelAdapter } from "../adapters/OcctKernel";
import { createShapeFromPartDocument } from "./cadKernelService";
import { ChamferKernel } from "../kernel/chamferKernel";
import type { Entity } from "@/lib/lab2d/core";

describe("CALDRA CAD CORE — Real Geometry Pipeline (Flange Circular & 2D Sketches)", () => {
  let kernel: OcctKernelAdapter;

  beforeAll(async () => {
    kernel = new OcctKernelAdapter();
    await kernel.init();
  });

  it("1. Constrói Flange Circular real (Øext=500mm, Øint=300mm, 8 furos de fixação)", async () => {
    const doc = ChamferKernel.createDocument("Flange_Circular_500", 12, "Aço A36");

    // Simula entidades da Flange Circular da biblioteca CALDRA
    const c = 250;
    const rOuter = 250;
    const rInner = 150;
    const rBolt = 210;
    const boltDiameter = 22;

    const entities: Entity[] = [
      // Círculo externo de corte Ø500
      { id: "c_ext", type: "circle", cx: c, cy: c, r: rOuter, layer: "corte" },
      // Furo central de passagem Ø300
      { id: "c_int", type: "circle", cx: c, cy: c, r: rInner, layer: "corte" },
      // Círculo de centro dos furos (referência)
      { id: "c_bc", type: "circle", cx: c, cy: c, r: rBolt, layer: "referência" },
    ];

    // 8 furos periféricos
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45 * Math.PI) / 180;
      entities.push({
        id: `furo_${i}`,
        type: "circle",
        cx: c + rBolt * Math.cos(angle),
        cy: c + rBolt * Math.sin(angle),
        r: boltDiameter / 2,
        layer: "corte",
      });
    }

    doc.entities2D = entities;

    const shape = await createShapeFromPartDocument(doc, kernel);
    expect(shape.shapeType).toBe("solid");
    expect(shape.kernelHandle).toBeGreaterThan(0);

    // Consulta física
    const mass = await kernel.getMassProperties(shape);
    const bbox = await kernel.getBoundingBox(shape);

    // Diâmetro de 500 mm e espessura de 12 mm
    expect(bbox.size.x).toBeCloseTo(500, -1);
    expect(bbox.size.y).toBeCloseTo(500, -1);
    expect(bbox.size.z).toBeCloseTo(12, 0);

    // O volume deve ser menor que o cilindro maciço: PI * 250^2 * 12 ≈ 2.356.194 mm³
    const solidCylVol = Math.PI * rOuter * rOuter * 12;
    expect(mass.volume).toBeLessThan(solidCylVol);
    // E maior que 0
    expect(mass.volume).toBeGreaterThan(1e5);

    // Tesselação para Three.js
    const mesh = await kernel.tessellate(shape);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.normals?.length).toBe(mesh.positions.length);
  });

  it("2. Constrói Chapa Base com furos a partir de polígonos/linhas 2D", async () => {
    const doc = ChamferKernel.createDocument("Chapa_Furada", 6.35, "Aço Carbono");

    const entities: Entity[] = [
      // Contorno retangular 400x300 mm
      { id: "l1", type: "line", x1: 0, y1: 0, x2: 400, y2: 0, layer: "corte" },
      { id: "l2", type: "line", x1: 400, y1: 0, x2: 400, y2: 300, layer: "corte" },
      { id: "l3", type: "line", x1: 400, y1: 300, x2: 0, y2: 300, layer: "corte" },
      { id: "l4", type: "line", x1: 0, y1: 300, x2: 0, y2: 0, layer: "corte" },
      // Furo central Ø100 mm
      { id: "f_cent", type: "circle", cx: 200, cy: 150, r: 50, layer: "corte" },
    ];

    doc.entities2D = entities;

    const shape = await createShapeFromPartDocument(doc, kernel);
    expect(shape.shapeType).toBe("solid");

    const bbox = await kernel.getBoundingBox(shape);
    expect(bbox.size.x).toBeCloseTo(400, 0);
    expect(bbox.size.y).toBeCloseTo(300, 0);
    expect(bbox.size.z).toBeCloseTo(6.35, 1);
  });
});
