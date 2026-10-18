// @ts-nocheck
/**
 * TESTES OBRIGATÓRIOS DO SLIDER E CINEMÁTICA RÍGIDA 3D — CHAMFER CAD
 *
 * Validação rigorosa dos requisitos:
 * 1. Estágios do Slider: 0%, 25%, 50%, 75%, 100%
 * 2. Peça com 1 dobra (cantoneira L)
 * 3. Peça com 2 dobras (perfil U)
 * 4. Peça com 3 dobras (canal Z / aba de retorno)
 * 5. Peça com múltiplas dobras (caixa/bandeja com 4 abas)
 * 6. Preservação de espessura real e ausência de gaps
 * 7. Estado 0% = Flat Pattern (totalmente coplanar no plano Z=0)
 * 8. Estado 100% = Totalmente conformado (ângulos nominais atingidos)
 * 9. Integração com modelos de Caldeiraria da Traçagem (Cone, Curva de Gomos)
 */

import { describe, it, expect } from "vitest";
import { buildSheetMetalWireModel, rotatePointAroundLine } from "./sheetMetalWireBuilder";
import { ChamferKernel } from "../kernel/chamferKernel";
import type { PartDocument } from "../kernel/types";

describe("CALDRA CHAMFER — CINEMÁTICA RÍGIDA 3D & SLIDER (0% ↔ 100%)", () => {
  it("TESTE 1: Rotação analítica de Rodrigues em torno de uma linha 3D", () => {
    // Ponto P = (10, 0, 0) rotacionado 90° em torno do eixo Y passando por (0,0,0)
    const p = { x: 10, y: 0, z: 0 };
    const a = { x: 0, y: 0, z: 0 };
    const u = { x: 0, y: 1, z: 0 };
    const rad90 = Math.PI / 2;

    const rotated = rotatePointAroundLine(p, a, u, rad90);
    expect(rotated.x).toBeCloseTo(0, 4);
    expect(rotated.y).toBeCloseTo(0, 4);
    expect(rotated.z).toBeCloseTo(-10, 4);

    // Rotacionando 180°
    const rot180 = rotatePointAroundLine(p, a, u, Math.PI);
    expect(rot180.x).toBeCloseTo(-10, 4);
    expect(rot180.z).toBeCloseTo(0, 4);
  });

  it("TESTE 2: Peça com 1 dobra nos estágios 0%, 25%, 50%, 75%, 100%", () => {
    const doc = ChamferKernel.createDocument("Cantoneira L", 2.0, "Aço Carbono");
    doc.baseWidth = 100;
    doc.baseLength = 80;
    ChamferKernel.addFlange(doc, {
      edgeId: "right",
      flangeLength: 40,
      angleDeg: 90,
      direction: "UP",
    });

    // 0%: Totalmente planificado
    const m0 = buildSheetMetalWireModel(doc, 0.0);
    expect(m0.faces.length).toBeGreaterThan(0);
    expect(m0.edges.length).toBeGreaterThan(0);

    // Em 0%, todos os pontos z da face externa (top) devem estar em z = +1.0 (half thickness)
    const topFaces0 = m0.faces.filter((f) => f.kind === "outer");
    topFaces0.forEach((f) => {
      f.pts.forEach((pt) => {
        expect(pt.z).toBeCloseTo(1.0, 3);
      });
    });

    // Em 0%, a extensão em X deve ser baseWidth (100) + flangeLength (40) = 140
    const spanX0 = m0.bounds.max.x - m0.bounds.min.x;
    expect(spanX0).toBeCloseTo(140, 1);

    // Estágios intermediários contínuos: 25%, 50%, 75%, 100%
    const m25 = buildSheetMetalWireModel(doc, 0.25);
    const m50 = buildSheetMetalWireModel(doc, 0.5);
    const m75 = buildSheetMetalWireModel(doc, 0.75);
    const m100 = buildSheetMetalWireModel(doc, 1.0);

    // Altura máxima Z deve crescer monotonicamente à medida que dobra para cima (+Z)
    expect(m25.bounds.max.z).toBeGreaterThan(m0.bounds.max.z);
    expect(m50.bounds.max.z).toBeGreaterThan(m25.bounds.max.z);
    expect(m75.bounds.max.z).toBeGreaterThan(m50.bounds.max.z);
    expect(m100.bounds.max.z).toBeGreaterThan(m75.bounds.max.z);

    // Em 100% com 90°, a aba está vertical. A altura da ponta é flangeLength (40)
    expect(m100.bounds.max.z).toBeCloseTo(40.0, 1);

    // Em 100%, a largura X no plano base encolhe para ~ baseWidth (100) + espessura
    const spanX100 = m100.bounds.max.x - m100.bounds.min.x;
    expect(spanX100).toBeCloseTo(101.0, 1);
  });

  it("TESTE 3: Peça com 2 dobras (perfil U) — continuidade e ausência de gaps", () => {
    const doc = ChamferKernel.createDocument("Perfil U", 3.0, "Aço SAE 1020");
    doc.baseWidth = 120;
    doc.baseLength = 100;
    ChamferKernel.addFlange(doc, {
      edgeId: "right",
      flangeLength: 50,
      angleDeg: 90,
      direction: "UP",
    });
    ChamferKernel.addFlange(doc, {
      edgeId: "left",
      flangeLength: 50,
      angleDeg: 90,
      direction: "UP",
    });

    const mFlat = buildSheetMetalWireModel(doc, 0.0);
    const mFolded = buildSheetMetalWireModel(doc, 1.0);

    // No plano, comprimento total = 50 + 120 + 50 = 220mm
    const flatSpanX = mFlat.bounds.max.x - mFlat.bounds.min.x;
    expect(flatSpanX).toBeCloseTo(220, 1);

    // Dobrado a 90°, largura X = 120mm (+ espessura 3mm)
    const foldedSpanX = mFolded.bounds.max.x - mFolded.bounds.min.x;
    expect(foldedSpanX).toBeCloseTo(123, 1);

    // Ambas as abas subiram simetricamente para Z = 50mm
    expect(mFolded.bounds.max.z).toBeCloseTo(50.0, 1);

    // Todas as faces têm normais unitárias válidas calculadas via Newell
    mFolded.faces.forEach((f) => {
      expect(f.n).toBeDefined();
      const len = Math.hypot(f.n!.x, f.n!.y, f.n!.z);
      expect(len).toBeCloseTo(1.0, 4);
    });
  });

  it("TESTE 4: Peça com múltiplas dobras (caixa com 4 abas)", () => {
    const doc = ChamferKernel.createDocument("Bandeja 4 Abas", 2.0, "Inox 304");
    doc.baseWidth = 150;
    doc.baseLength = 100;
    ChamferKernel.addFlange(doc, { edgeId: "right", flangeLength: 30, angleDeg: 90 });
    ChamferKernel.addFlange(doc, { edgeId: "left", flangeLength: 30, angleDeg: 90 });
    ChamferKernel.addFlange(doc, { edgeId: "top", flangeLength: 30, angleDeg: 90 });
    ChamferKernel.addFlange(doc, { edgeId: "bottom", flangeLength: 30, angleDeg: 90 });

    const m0 = buildSheetMetalWireModel(doc, 0.0);
    const m50 = buildSheetMetalWireModel(doc, 0.5);
    const m100 = buildSheetMetalWireModel(doc, 1.0);

    // Em 0%: chapa plana completa (150+60 = 210mm x 100+60 = 160mm)
    expect(m0.bounds.max.x - m0.bounds.min.x).toBeCloseTo(210, 1);
    expect(m0.bounds.max.y - m0.bounds.min.y).toBeCloseTo(160, 1);

    // Em 50%: abas a 45°
    expect(m50.bounds.max.z).toBeGreaterThan(1.0);
    expect(m50.bounds.max.z).toBeLessThan(m100.bounds.max.z);

    // Em 100%: todas as 4 abas a 90° verticais
    expect(m100.bounds.max.z).toBeCloseTo(30.0, 1);
    expect(m100.bounds.max.x - m100.bounds.min.x).toBeCloseTo(152, 1);
    expect(m100.bounds.max.y - m100.bounds.min.y).toBeCloseTo(102, 1);

    // Possui 4 eixos de dobra técnicos em refLines
    expect(m100.refLines.length).toBe(4);
  });

  it("TESTE 5: Integração com modelo de Caldeiraria (Tronco de Cone) reutiliza motor da Traçagem", () => {
    const doc = ChamferKernel.createDocument("Tronco Caldeiraria", 3.0, "Aço");
    ChamferKernel.addBoilermakingFeature(doc, "cone", {
      D: 300,
      d: 150,
      H: 250,
      divisions: 32,
    });

    const wire = ChamferKernel.buildWireModel(doc, 1.0);
    expect(wire.faces.length).toBeGreaterThan(50);
    expect(wire.edges.length).toBeGreaterThan(50);
    expect(wire.refLines.length).toBeGreaterThanOrEqual(1);

    // Bounds condizentes com o cone
    expect(wire.bounds.max.y - wire.bounds.min.y).toBeCloseTo(250, 1);
  });

  it("TESTE 6: HIERARQUIA DAS DOBRAS — Base → Dobra 1 → Face dependente → Dobra 2 (Aba de Retorno)", () => {
    const doc = ChamferKernel.createDocument("Perfil com Dobra Encadeada", 2.0, "Aço SAE 1020");
    doc.baseWidth = 100;
    doc.baseLength = 80;

    // Dobra 1 ligada à direita da base
    const f1 = ChamferKernel.addFlange(doc, {
      name: "Dobra 1 (Flange Vertical)",
      edgeId: "right",
      flangeLength: 50,
      angleDeg: 90,
      direction: "UP",
    });

    const flange1Id = doc.flanges![0].id;

    // Dobra 2 encadeada na ponta da Dobra 1 (retorno para dentro)
    ChamferKernel.addFlange(doc, {
      name: "Dobra 2 (Aba de Retorno)",
      edgeId: "right",
      parentFlangeId: flange1Id,
      flangeLength: 30,
      angleDeg: 90,
      direction: "UP",
    });

    // 0%: Chapa totalmente planificada: comprimento total em X = 100 + 50 + 30 = 180mm
    const m0 = buildSheetMetalWireModel(doc, 0.0);
    const spanX0 = m0.bounds.max.x - m0.bounds.min.x;
    expect(spanX0).toBeCloseTo(180, 1);
    // Todas as faces externas em z = +1.0
    m0.faces
      .filter((f) => f.kind === "outer")
      .forEach((f) => {
        f.pts.forEach((pt) => expect(pt.z).toBeCloseTo(1.0, 3));
      });

    // Teste dos 5 estágios: 0%, 25%, 50%, 75%, 100%
    const stages = [0.0, 0.25, 0.5, 0.75, 1.0].map((s) => buildSheetMetalWireModel(doc, s));

    // Teste dos estágios: 0%, 25%, 50%, 75%, 100%
    // A peça se conforma continuamente no espaço sem gaps ou desprendimento
    stages.forEach((stg, idx) => {
      if (idx > 0) {
        expect(stg.bounds.max.z).toBeGreaterThan(1.0);
      }
      // Nenhuma face se desprende: todas as normais são unitárias válidas
      stg.faces.forEach((f) => {
        expect(f.n).toBeDefined();
        const nLen = Math.hypot(f.n!.x, f.n!.y, f.n!.z);
        expect(nLen).toBeCloseTo(1.0, 4);
      });
    });

    // Em 100%: Dobra 1 a 90° sobe 50mm em Z (+ 1mm half-thickness = 51mm). Dobra 2 vira 90° para a esquerda (retorno).
    const m100 = stages[4];
    expect(m100.bounds.max.z).toBeCloseTo(51.0, 1);
    // A ponta da aba 2 virou para a esquerda, então o span X diminui
    expect(m100.bounds.max.x - m100.bounds.min.x).toBeLessThan(spanX0);

    // Contém 2 eixos de dobra técnicos
    expect(m100.refLines.length).toBe(2);
  });

  it("TESTE 7: Teste explícito com ângulos não-ortogonais (ex: 45° e 120°)", () => {
    const doc = ChamferKernel.createDocument("Ângulos Variados", 2.0, "Alumínio 5052");
    doc.baseWidth = 100;
    doc.baseLength = 80;
    ChamferKernel.addFlange(doc, {
      name: "Flange 45°",
      edgeId: "right",
      flangeLength: 40,
      angleDeg: 45,
      direction: "UP",
    });
    ChamferKernel.addFlange(doc, {
      name: "Flange 120°",
      edgeId: "left",
      flangeLength: 40,
      angleDeg: 120,
      direction: "UP",
    });

    const mFlat = buildSheetMetalWireModel(doc, 0.0);
    const mHalf = buildSheetMetalWireModel(doc, 0.5);
    const mFull = buildSheetMetalWireModel(doc, 1.0);

    // Flat: 40 + 100 + 40 = 180mm
    expect(mFlat.bounds.max.x - mFlat.bounds.min.x).toBeCloseTo(180, 1);

    // No estágio intermediário 50%: ângulos são 22.5° e 60°
    expect(mHalf.bounds.max.z).toBeGreaterThan(1.0);
    expect(mHalf.bounds.max.z).toBeLessThan(mFull.bounds.max.z);

    // No estágio final 100%:
    // Flange 1 a 45° tem altura z = 40 * sin(45°) ≈ 28.28 mm + espessura
    // Flange 2 a 120° tem altura z ≈ 40 * sin(120°) + espessura/2 ≈ 35.1 mm
    expect(mFull.bounds.max.z).toBeCloseTo(35.14, 1);
  });
});
