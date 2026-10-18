/**
 * CALDRA CAD — CALDEIRARIA B-REP (FASE 07) UNIT TESTS
 *
 * Valida a geração analítica de sólidos B-Rep reais no OpenCascade (OCCT)
 * para os modelos clássicos de traçagem e caldeiraria da CALDRA:
 * 1. Cone Truncado / Redução
 * 2. Transição Quadrado para Redondo
 * 3. Curva de Gomos (Cotovelo)
 * 4. Boca de Lobo / Tê
 * 5. Chapéu Chinês
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getCadKernel } from "../core";
import { CaldraBoilermakingBRep } from "./CaldraBoilermakingBRep";

describe("CALDRA CAD — FASE 07 (Modelos Paramétricos de Caldeiraria B-Rep)", () => {
  beforeAll(async () => {
    const kernel = getCadKernel();
    await kernel.init();
  });

  it("deve gerar Cone Truncado B-Rep com espessura de chapa e propriedades de massa reais", async () => {
    const kernel = getCadKernel();
    const cone = await CaldraBoilermakingBRep.createTruncatedCone({
      D: 100,
      d: 60,
      height: 80,
      thickness: 3,
    });

    expect(cone).toBeDefined();
    expect(cone.type).toBe("solid");

    const mass = await kernel.getMassProperties(cone, 7.85);
    expect(mass.volume).toBeGreaterThan(1000);
    expect(mass.mass).toBeGreaterThan(0.01);

    const tess = await kernel.tessellate(cone);
    expect(tess.mesh.indices.length).toBeGreaterThan(0);
    expect(tess.edges.edges.length).toBeGreaterThan(0);

    kernel.release(cone);
  });

  it("deve gerar Transição Quadrado para Redondo B-Rep com espessura oca", async () => {
    const kernel = getCadKernel();
    const transition = await CaldraBoilermakingBRep.createSquareToRound({
      width: 120,
      length: 120,
      diameter: 80,
      height: 100,
      thickness: 4.75,
    });

    expect(transition).toBeDefined();
    const mass = await kernel.getMassProperties(transition, 7.85);
    expect(mass.volume).toBeGreaterThan(5000);

    const tess = await kernel.tessellate(transition);
    expect(tess.mesh.indices.length).toBeGreaterThan(0);

    kernel.release(transition);
  });

  it("deve gerar Curva de Gomos (Cotovelo) B-Rep com múltiplos gomos e passagem de fluxo", async () => {
    const kernel = getCadKernel();
    const elbow = await CaldraBoilermakingBRep.createSegmentedElbow({
      diameter: 80,
      radius: 120,
      angleDeg: 90,
      segments: 4,
      thickness: 3.17,
    });

    expect(elbow).toBeDefined();
    const mass = await kernel.getMassProperties(elbow, 7.85);
    expect(mass.volume).toBeGreaterThan(1000);

    kernel.release(elbow);
  });

  it("deve gerar Boca de Lobo / Tê B-Rep com penetração e furos vazados", async () => {
    const kernel = getCadKernel();
    const branch = await CaldraBoilermakingBRep.createCylindricalBranch({
      mainDiameter: 100,
      branchDiameter: 60,
      mainLength: 180,
      branchHeight: 80,
      thickness: 4.75,
    });

    expect(branch).toBeDefined();
    const mass = await kernel.getMassProperties(branch, 7.85);
    expect(mass.volume).toBeGreaterThan(5000);

    kernel.release(branch);
  });

  it("deve gerar Chapéu Chinês B-Rep oco para caldeiraria", async () => {
    const kernel = getCadKernel();
    const hood = await CaldraBoilermakingBRep.createConicalHood({
      baseDiameter: 150,
      topDiameter: 30,
      height: 60,
      thickness: 2,
    });

    expect(hood).toBeDefined();
    const mass = await kernel.getMassProperties(hood, 7.85);
    expect(mass.volume).toBeGreaterThan(1000);

    kernel.release(hood);
  });
});
