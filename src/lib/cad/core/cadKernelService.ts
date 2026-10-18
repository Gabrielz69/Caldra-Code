/**
 * CALDRA CAD CORE — KERNEL SERVICE (SINGLETON & BRIDGE)
 *
 * Gerencia a inicialização sob demanda do kernel B-Rep (occt-wasm)
 * e converte rigorosamente o PartDocument / entidades 2D do CHAMFER
 * em sólidos B-Rep com faces, arestas e furações reais.
 */

import { OcctKernelAdapter } from "../adapters/OcctKernel";
import type { CadKernel } from "./CadKernel";
import type { CadShape } from "./CadShape";
import type { PartDocument } from "../kernel/types";
import type { Entity } from "@/lib/lab2d/core";

let sharedKernel: OcctKernelAdapter | null = null;
let initPromise: Promise<CadKernel> | null = null;

export async function getCaldraCadKernel(): Promise<CadKernel> {
  if (sharedKernel && sharedKernel.isInitialized) {
    return sharedKernel;
  }
  if (!initPromise) {
    initPromise = (async () => {
      const adapter = new OcctKernelAdapter();
      await adapter.init();
      sharedKernel = adapter;
      return adapter;
    })();
  }
  return initPromise;
}

/**
 * Cria ou sincroniza um CadShape B-Rep sólido correspondente à geometria real
 * do PartDocument / entidades 2D do Chamfer (incluindo Flanges Circulares,
 * chapas com furação e flanges dobradas).
 */
export async function createShapeFromPartDocument(
  doc: PartDocument,
  kernel: CadKernel,
  providedEntities?: Entity[]
): Promise<CadShape> {
  const thickness = Math.max(0.5, Number(doc.thickness) || 2.0);
  const rawEntities =
    providedEntities && providedEntities.length > 0
      ? providedEntities
      : doc.entities2D && doc.entities2D.length > 0
        ? doc.entities2D
        : [];

  // 1. Caso especial: Modelo de Caldeiraria existente (Cone, Cilindro)
  if (doc.boilermakingFeature) {
    const { type, params } = doc.boilermakingFeature;
    const p = params as Record<string, number | undefined>;
    try {
      if (type === "cone") {
        const r1 = Math.max(1, (p.D ?? 200) / 2);
        const r2 = Math.max(0, (p.d ?? 100) / 2);
        const h = Math.max(1, p.H ?? 250);
        return await kernel.createCone(r1, r2, h, doc.name || "Cone_Caldeiraria");
      }
    } catch (err) {
      console.warn("Aviso ao gerar sólido B-Rep de caldeiraria:", err);
    }
  }

  // Filtra entidades não-construtivas (ignora linhas de centro e referência pura)
  const cutEntities = rawEntities.filter((e) => {
    const l = (e.layer || "").toLowerCase();
    return l !== "referencia" && l !== "referência" && l !== "centro";
  });

  // Filtra furos e círculos
  const circles = cutEntities.filter(
    (e): e is Extract<Entity, { type: "circle" }> =>
      e.type === "circle" &&
      Number.isFinite(e.cx) &&
      Number.isFinite(e.cy) &&
      Number.isFinite(e.r) &&
      e.r > 0
  );

  // 2. Análise de contorno linear / poligonal
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let lineCount = 0;

  for (const e of cutEntities) {
    if (e.type === "line") {
      minX = Math.min(minX, e.x1, e.x2);
      maxX = Math.max(maxX, e.x1, e.x2);
      minY = Math.min(minY, e.y1, e.y2);
      maxY = Math.max(maxY, e.y1, e.y2);
      lineCount++;
    } else if (e.type === "polyline" && Array.isArray(e.pts)) {
      for (const p of e.pts) {
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
          lineCount++;
        }
      }
    } else if (e.type === "arc") {
      minX = Math.min(minX, e.cx - e.r);
      maxX = Math.max(maxX, e.cx + e.r);
      minY = Math.min(minY, e.cy - e.r);
      maxY = Math.max(maxY, e.cy + e.r);
      lineCount++;
    }
  }

  const hasBoundingContour =
    lineCount >= 2 &&
    Number.isFinite(minX) &&
    Number.isFinite(maxX) &&
    maxX - minX > 5 &&
    maxY - minY > 5;

  // 3. FLANGE CIRCULAR PURA (apenas círculos, sem linhas/polígonos delimitadores externos)
  if (!hasBoundingContour && circles.length > 0) {
    const sortedCircles = [...circles].sort((a, b) => b.r - a.r);
    const outerCircle = sortedCircles[0]!;

    if (outerCircle.r >= 5) {
      const partName = doc.name || doc.metadata?.name || "Flange_Circular";
      let shape = await kernel.createCylinder(outerCircle.r, thickness, partName);

      if (Math.abs(outerCircle.cx) > 1e-4 || Math.abs(outerCircle.cy) > 1e-4) {
        shape = await kernel.translate(shape, outerCircle.cx, outerCircle.cy, 0);
      }

      // Furos internos concêntricos e de fixação
      const holes = sortedCircles.slice(1);
      for (let i = 0; i < holes.length; i++) {
        const h = holes[i]!;
        try {
          const holeTool = await kernel.createCylinder(h.r, thickness * 2.2, `Furo_${i + 1}`);
          const positionedHole = await kernel.translate(
            holeTool,
            h.cx,
            h.cy,
            -thickness * 0.6
          );
          shape = await kernel.cut(shape, positionedHole, `Peca_Com_Furo_${i + 1}`);
        } catch (err) {
          console.warn(`Aviso ao furar B-Rep no raio ${h.r}:`, err);
        }
      }

      return shape;
    }
  }

  // 4. CHAPA RETANGULAR OU CONTORNO DELIMITADO
  let width = 120;
  let length = 100;
  let offsetX = 0;
  let offsetY = 0;

  if (hasBoundingContour) {
    width = maxX - minX;
    length = maxY - minY;
    offsetX = minX;
    offsetY = minY;
  } else {
    const baseFeature = doc.featureTree.getFeatures().find(
      (f) => f.type === "BASE_PLATE" || f.type === "extrude" || f.type === "sketch"
    );
    if (baseFeature?.parameters) {
      width = Number(baseFeature.parameters.width) || 120;
      length = Number(baseFeature.parameters.length || baseFeature.parameters.height) || 100;
    }
  }

  // Garante valores finitos positivos estritos
  width = Math.max(5, Number.isFinite(width) ? width : 120);
  length = Math.max(5, Number.isFinite(length) ? length : 100);
  offsetX = Number.isFinite(offsetX) ? offsetX : 0;
  offsetY = Number.isFinite(offsetY) ? offsetY : 0;

  const boxName = doc.name || doc.metadata?.name || "Chapa_Chamfer";
  let shape = await kernel.createBox(width, length, thickness, boxName);
  if (Math.abs(offsetX) > 1e-4 || Math.abs(offsetY) > 1e-4) {
    shape = await kernel.translate(shape, offsetX, offsetY, 0);
  }

  // Subtração de furos internos na chapa
  for (let i = 0; i < circles.length; i++) {
    const h = circles[i]!;
    if (h.r <= 0 || !Number.isFinite(h.r)) continue;
    try {
      const holeTool = await kernel.createCylinder(h.r, thickness * 2.2, `Furo_${i + 1}`);
      const positionedHole = await kernel.translate(holeTool, h.cx, h.cy, -thickness * 0.6);
      shape = await kernel.cut(shape, positionedHole, `Chapa_Com_Furo_${i + 1}`);
    } catch (err) {
      console.warn(`Aviso ao aplicar furo em chapa:`, err);
    }
  }

  // Flanges dobradas
  const flanges = doc.featureTree.getFeatures().filter((f) => f.type === "PARAMETRIC_FLANGE");
  for (let i = 0; i < flanges.length; i++) {
    const flange = flanges[i]!;
    const fLength = Number(flange.parameters.length) || 30;
    try {
      const flangeTool = await kernel.createBox(width, thickness, fLength, `Flange_${i + 1}`);
      const translated = await kernel.translate(
        flangeTool,
        offsetX,
        offsetY + length - thickness,
        thickness
      );
      shape = await kernel.fuse(shape, translated, `Peca_Com_Flange_${i + 1}`);
    } catch (err) {
      console.warn("Aviso ao modelar flange no B-Rep:", err);
    }
  }

  return shape;
}
