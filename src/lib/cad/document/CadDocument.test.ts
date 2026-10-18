/**
 * CALDRA CHAMFER — EVOLUÇÃO DO CAD CORE (FASE 01)
 * SUÍTE DE TESTES: FUNDAÇÃO CAD PARAMÉTRICA B-REP
 */

import { describe, it, expect, beforeAll } from "vitest";
import { CadDocument } from "./CadDocument";
import { CadReferenceManager } from "./CadReference";
import { CadPersistence } from "./CadPersistence";
import { CadRegenerator } from "./CadRegenerator";
import { getCaldraCadKernel } from "../core/cadKernelService";
import type { ICadKernel } from "../core/CadKernel";

describe("CHAMFER CAD CORE — FASE 1: Fundação Paramétrica B-Rep", () => {
  let kernel: ICadKernel;

  beforeAll(async () => {
    kernel = await getCaldraCadKernel();
  });

  describe("1. Documento CAD Paramétrico", () => {
    it("deve instanciar um documento CAD com unidades, metadados e materiais industriais", () => {
      const doc = new CadDocument({
        name: "Flange_Fixacao_Industrial",
        units: { length: "mm", angle: "deg", mass: "kg", precision: 2 },
        kernel,
      });

      expect(doc.name).toBe("Flange_Fixacao_Industrial");
      expect(doc.getUnits().length).toBe("mm");
      expect(doc.getUnits().precision).toBe(2);

      const activeMat = doc.getActiveMaterial();
      expect(activeMat.name).toContain("Aço Carbono");
      expect(activeMat.density).toBeCloseTo(7.85);

      // Troca de material para Inox
      const changed = doc.setActiveMaterial("mat_inox_304");
      expect(changed).toBe(true);
      expect(doc.getActiveMaterial().category).toBe("Aço Inox");
    });

    it("deve gerenciar parâmetros e avaliar expressões matemáticas dinâmicas", () => {
      const doc = new CadDocument({ kernel });

      doc.setParam("COMPRIMENTO", 600);
      doc.setParam("LARGURA", 300);
      doc.setParam("ALTURA", 150);
      doc.setParam("ESPESSURA", 6.35);

      // Parâmetro derivado por expressão
      doc.setParam("MEIO_COMPRIMENTO", 0, "COMPRIMENTO / 2");
      doc.setParam("AREA_BASE", 0, "COMPRIMENTO * LARGURA");

      expect(doc.evalExpr("COMPRIMENTO")).toBe(600);
      expect(doc.evalExpr("MEIO_COMPRIMENTO")).toBe(300);
      expect(doc.evalExpr("AREA_BASE")).toBe(180000);
      expect(doc.evalExpr("sqrt(ALTURA * 4)")).toBeCloseTo(Math.sqrt(600));
    });
  });

  describe("2. Feature Graph (DAG) e Histórico de Operações", () => {
    it("deve encadear operações em DAG: Sketch -> Extrusão -> Furo -> Corpo", async () => {
      const doc = new CadDocument({ kernel });

      // 1. Feature de Base Sólida (Caixa)
      const baseFeat = doc.addFeature({
        name: "Base_Prancha",
        type: "base_box",
        parameters: { width: 300, length: 200, height: 40, centered: true },
      });

      // 2. Feature de Furo Cilíndrico dependente da Base
      const holeFeat = doc.addFeature({
        name: "Furo_Centro",
        type: "hole_cut",
        parameters: { diameter: 50, depth: 60, isThrough: true, position: { x: 0, y: 0, z: 0 } },
        dependencies: [baseFeat.id],
      });

      expect(doc.featureGraph.size()).toBe(2);
      expect(holeFeat.dependencies).toContain(baseFeat.id);
      expect(baseFeat.dependents).toContain(holeFeat.id);

      // Executa o rebuild inicial B-Rep
      const report = await doc.rebuild();
      expect(report.errors).toEqual([]);
      expect(report.success).toBe(true);
      expect(report.rebuiltCount).toBe(2);

      const primaryBody = doc.getPrimaryBody();
      expect(primaryBody).toBeDefined();
      expect(primaryBody?.bRepShape).toBeDefined();
      expect(primaryBody?.bRepShape?.faces.length).toBeGreaterThan(5);
    });
  });

  describe("3. B-Rep como Modelo Canônico", () => {
    it("deve gerar sólidos B-Rep analíticos no kernel OCCT preservando massa e topologia", async () => {
      const doc = new CadDocument({ kernel });

      doc.addFeature({
        name: "Bloco_Mecanico",
        type: "base_box",
        parameters: { width: 100, length: 100, height: 100, centered: false },
      });

      const report = await doc.rebuild();
      expect(report.success).toBe(true);

      const body = doc.getPrimaryBody();
      expect(body?.bRepShape).toBeDefined();

      const volume = body?.bRepShape?.volume;
      expect(volume).toBeGreaterThan(990000); // ~1,000,000 mm³
      expect(body?.bRepShape?.faces.length).toBe(6);
      expect(body?.bRepShape?.edges.length).toBe(12);
      expect(body?.bRepShape?.vertices.length).toBe(8);
    });
  });

  describe("4. Regeneração Incremental (Selective Rebuild)", () => {
    it("deve regenerar apenas features dependentes quando um parâmetro ou feature for alterado", async () => {
      const doc = new CadDocument({ kernel });

      doc.setParam("LARGURA", 200);
      doc.setParam("COMPRIMENTO", 150);

      const feat1 = doc.addFeature({
        name: "Base_Parametrica",
        type: "base_box",
        parameters: { width: "LARGURA", length: "COMPRIMENTO", height: 30, centered: true },
      });

      const feat2 = doc.addFeature({
        name: "Furo_Passante",
        type: "hole_cut",
        parameters: { diameter: 30, depth: 50, isThrough: true, position: { x: 0, y: 0, z: 0 } },
        dependencies: [feat1.id],
      });

      // Primeiro rebuild constrói as duas features
      const r1 = await doc.rebuild();
      expect(r1.rebuiltCount).toBe(2);
      expect(r1.cachedCount).toBe(0);

      // Segundo rebuild sem alterações: zero reconstruções, 100% de cache!
      const r2 = await doc.rebuild();
      expect(r2.rebuiltCount).toBe(0);
      expect(r2.cachedCount).toBe(2);

      // Altera o parâmetro do furo diretamente
      doc.featureGraph.updateParameters(feat2.id, { diameter: 45 });
      expect(feat1.state).toBe("UP_TO_DATE");
      expect(feat2.state).toBe("DIRTY");

      // Terceiro rebuild: apenas o furo é reconstruído, a base é reaproveitada do cache B-Rep!
      const r3 = await doc.rebuild();
      expect(r3.rebuiltCount).toBe(1);
      expect(r3.cachedCount).toBe(1);
    });
  });

  describe("5. Sistema de Referências Reais (Face, Aresta, Vértice, Eixo, Plano)", () => {
    it("deve criar e resolver referências a planos, eixos, faces e arestas B-Rep", async () => {
      const doc = new CadDocument({ kernel });

      doc.addFeature({
        name: "Bloco",
        type: "base_box",
        parameters: { width: 100, length: 100, height: 50, centered: true },
      });

      await doc.rebuild();
      const body = doc.getPrimaryBody()!;
      const shape = body.bRepShape!;

      // 1. Referência a Face real do sólido
      const topFace = shape.faces[0]!;
      const faceRef = CadReferenceManager.createFaceReference(body.id, topFace);
      expect(faceRef.kind).toBe("face");
      expect(faceRef.fingerprint).toBeDefined();

      const resolvedFace = CadReferenceManager.resolveFace(shape, faceRef);
      expect(resolvedFace).toBeDefined();
      expect(resolvedFace?.index).toBe(topFace.index);

      // 2. Referência a Aresta real do sólido
      const sampleEdge = shape.edges[0]!;
      const edgeRef = CadReferenceManager.createEdgeReference(body.id, sampleEdge);
      expect(edgeRef.kind).toBe("edge");

      const resolvedEdge = CadReferenceManager.resolveEdge(shape, edgeRef);
      expect(resolvedEdge).toBeDefined();

      // 3. Referência a Planos Datum
      const planeRef = CadReferenceManager.createPlaneReference("DATUM_XY", { offset: 25 });
      const planeDef = CadReferenceManager.resolvePlaneDefinition(planeRef);
      expect(planeDef.normal.z).toBe(1);
      expect(planeDef.origin.z).toBe(25);
    });
  });

  describe("6. Persistência Nativa do CHAMFER (.chamfer / JSON)", () => {
    it("deve serializar e desserializar o documento preservando histórico, parâmetros e intenção de projeto", async () => {
      const doc = new CadDocument({
        name: "Projeto_Duto_Transmissao",
        kernel,
      });

      doc.setParam("DIAMETRO", 250);
      doc.setParam("ESPESSURA", 4.75);

      doc.addFeature({
        name: "Cilindro_Principal",
        type: "base_cylinder",
        parameters: { radius: "DIAMETRO / 2", height: 400, centered: true },
      });

      await doc.rebuild();

      // Exportação nativa completa
      const json = doc.toJson(true);
      expect(json).toContain("CALDRA_CHAMFER_CAD");
      expect(json).toContain("Projeto_Duto_Transmissao");
      expect(json).toContain("DIAMETRO");

      // Desserialização e reconstrução paramétrica
      const reloadedDoc = await CadDocument.fromJson(json, kernel);
      expect(reloadedDoc.name).toBe("Projeto_Duto_Transmissao");
      expect(reloadedDoc.getParameter("DIAMETRO")?.value).toBe(250);
      expect(reloadedDoc.featureGraph.size()).toBe(1);

      const reloadedBody = reloadedDoc.getPrimaryBody();
      expect(reloadedBody?.bRepShape).toBeDefined();
      expect(reloadedBody?.bRepShape?.faces.length).toBeGreaterThan(1);
    });
  });

  describe("7. Compatibilidade Bidirecional com a Arquitetura CALDRA", () => {
    it("deve converter entre CadDocument e PartDocument legado sem perda de dados", () => {
      const doc = new CadDocument({ name: "Flange_Normatizada", kernel });
      doc.setParam("thickness", 8.0);
      doc.setParam("kFactor", 0.45);

      const partDoc = doc.toPartDocument();
      expect(partDoc.name).toBe("Flange_Normatizada");
      expect(partDoc.cadDocumentRef).toBe(doc);

      const backToDoc = CadDocument.fromPartDocument(partDoc, kernel);
      expect(backToDoc.name).toBe("Flange_Normatizada");
      expect(backToDoc.getParameter("thickness")?.value).toBe(8.0);
    });
  });
});
