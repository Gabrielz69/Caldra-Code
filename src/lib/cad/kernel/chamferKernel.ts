// @ts-nocheck
/**
 * CALDRA CAD — UNIFIED KERNEL (FASE 08)
 *
 * Núcleo mestre unificado do CAD CHAMFER.
 * Orquestra todo o fluxo paramétrico industrial do CALDRA:
 * PROJETAR → MODELAR 3D → PARAMETRIZAR → CONVERTER EM CHAPA → DOBRAR → DESDOBRAR → PLANIFICAR → FABRICAR CNC
 */

import {
  type CanonicalModel,
  type Solid,
  createRectangleSketch,
  extrudeSketchToSolid,
} from "../canonical";
import { FeatureTree } from "../features/featureTree";
import type { RebuildReport } from "../features/types";
import { SheetMetalEngine } from "../sheetmetal";
import { CAMEngine } from "../cam/camEngine";
import { GCodePostProcessor } from "../cam/gcodePostProcessor";
import type { MachineConfig } from "../cam/types";
import type { Entity } from "@/lib/lab2d/core";
import { ChamferBridge } from "./chamferBridge";
import { DraftingEngine, type DraftingOptions, type TechnicalDrawingSheet } from "../drafting";
import {
  StructuralEngine,
  type ProfileSection,
  type ProfileAlignment,
  type CornerTreatmentType,
  type StructuralMember,
  type StructuralFrameReport,
} from "../weldments";
import {
  NestingEngine,
  NestingDxfExporter,
  type NestingBlank,
  type NestingOptions,
  type NestingJobResult,
} from "../nesting";
import {
  HemEngine,
  FormingEngine,
  PressBrakeSimulator,
  type SheetMetalGussetDef,
  type SheetMetalLouverDef,
  type SheetMetalEmbossDef,
  type SheetMetalHemDef,
  type SheetMetalJogDef,
  type PressBrakeSimulationInput,
  type PressBrakeSimulationResult,
  type FormingEngineResult,
  type SheetMetalGrade,
} from "../forming";
import {
  DfmEngine,
  DfmCostEngine,
  DfmReportExporter,
  type DfmAuditResult,
  type DfmFullReport,
  type DfmRuleConfig,
  type FabricationCostRates,
} from "../dfm";
import {
  InspectionEngine,
  FaiReportExporter,
  type FirstArticleInspectionReport,
  type MetrologyOptions,
} from "../metrology";
import {
  FeaEngine,
  FeaReportExporter,
  type FeaAnalysisResult,
  type FeaSimulationOptions,
} from "../fea";
import { BoilermakingEngine } from "../boilermaking/boilermakingEngine";
import type { SolidInstance, SolidMaterial } from "@/lib/project-catalog/instances";
import { planSolids } from "@/lib/lab2d/solid3d";
import type { Vector3D } from "../canonical";
import type {
  PartDocument,
  RebuildKernelOptions,
  ParametricFlangeDef,
  BoilermakingFeatureDef,
} from "./types";
import { buildSheetMetalWireModel } from "../sheetmetal/sheetMetalWireBuilder";
import type { WireModel } from "@/lib/viz3d/wire";

export class ChamferKernel {
  /**
   * Constrói o modelo 3D WireModel com a MESMA LINGUAGEM VISUAL DA TRAÇAGEM (Wire3D).
   * - 0% = Totalmente planificado (Flat Pattern)
   * - 100% = Totalmente dobrado (respeitando os eixos e ângulos reais de dobra)
   * - Transição cinemática contínua rígida via Rodrigues
   */
  static buildWireModel(doc: PartDocument, foldProgress = doc.foldProgress ?? 1.0): WireModel {
    return buildSheetMetalWireModel(doc, foldProgress);
  }
  /**
   * Cria um novo documento de peça CAD paramétrica no CALDRA.
   */
  static createDocument(
    nameOrOptions:
      | string
      | {
          name?: string;
          thickness?: number;
          material?: string;
          kFactor?: number;
          density?: number;
        } = "Nova Peça Paramétrica",
    thickness = 2.0,
    material = "Aço Carbono SAE 1020",
    kFactor = 0.44,
  ): PartDocument {
    const docName =
      typeof nameOrOptions === "string"
        ? nameOrOptions
        : (nameOrOptions?.name ?? "Nova Peça Paramétrica");
    const docThickness =
      typeof nameOrOptions === "object" && nameOrOptions.thickness !== undefined
        ? nameOrOptions.thickness
        : thickness;
    const docMaterial =
      typeof nameOrOptions === "object" && nameOrOptions.material !== undefined
        ? nameOrOptions.material
        : material;
    const docKFactor =
      typeof nameOrOptions === "object" && nameOrOptions.kFactor !== undefined
        ? nameOrOptions.kFactor
        : kFactor;
    const docDensity =
      typeof nameOrOptions === "object" && nameOrOptions.density !== undefined
        ? nameOrOptions.density
        : 7.85;

    const featureTree = new FeatureTree(docName);
    const canonicalModel = featureTree.model;

    return {
      id: `doc_${Date.now()}`,
      name: docName,
      thickness: docThickness,
      material: docMaterial,
      density: docDensity,
      kFactor: docKFactor,
      innerRadius: docThickness,
      featureTree,
      canonicalModel,
      activeState: "3D_FOLDED",
      entities2D: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Importa o desenho 2D do canvas do CHAMFER como um Sketch paramétrico na Feature Tree.
   */
  static addSketchFromEntities(
    doc: PartDocument,
    entities: Entity[],
    sketchName = "Perfil Base",
  ): PartDocument {
    const { sketch } = ChamferBridge.entitiesToSketch(entities, sketchName);

    doc.featureTree.addFeature({
      id: sketch.id,
      name: sketchName,
      type: "sketch",
      parameters: { sketch },
      references: [doc.featureTree.features[0]?.id ?? "ref_plane_xy"],
    });

    doc.entities2D = [...entities];
    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Extrusa o perfil em chapa sólida com a espessura configurada.
   */
  static extrudeBasePlate(doc: PartDocument, widthMm = 100, lengthMm = 100): PartDocument {
    const t = doc.thickness;

    // Garante que o recurso de sketch esteja na árvore paramétrica antes da extrusão
    let sketchFeat = doc.featureTree.features.find((f) => f.type === "sketch");
    if (!sketchFeat) {
      sketchFeat = doc.featureTree.addFeature({
        id: `sketch_base_${Date.now()}`,
        name: `Esboço Base (${widthMm}×${lengthMm})`,
        type: "sketch",
        parameters: { width: widthMm, height: lengthMm },
        references: [doc.featureTree.features[0]?.id ?? "ref_plane_xy"],
      });
    }

    const sketch = createRectangleSketch(widthMm, lengthMm, { x: 0, y: 0 }, "Perfil Base");
    const solid = extrudeSketchToSolid(sketch, t, doc.material, doc.density);

    doc.activeSolid = solid;
    doc.canonicalModel.bodies.push(solid);

    doc.featureTree.addFeature({
      id: `extrude_${Date.now()}`,
      name: `Chapa Base (${widthMm}×${lengthMm})`,
      type: "extrude",
      parameters: { widthMm, lengthMm, depth: t },
      references: [sketchFeat.id],
      dependencies: [sketchFeat.id],
    });

    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Adiciona uma dobra de chapa metálica com cálculo analítico de dedução/compensação.
   */
  /**
   * Adiciona Base Flange paramétrica (transforma contorno em chapa metálica de espessura T).
   */
  static addBaseFlange(
    doc: PartDocument,
    widthMm = 120,
    lengthMm = 100,
    name = "Base Flange",
  ): PartDocument {
    doc.baseWidth = widthMm;
    doc.baseLength = lengthMm;

    // Atualiza/Gera contorno em layer corte
    const baseBoxEntity: Entity = {
      id: `base_contour_${Date.now()}`,
      type: "polyline",
      pts: [
        { x: 0, y: 0 },
        { x: widthMm, y: 0 },
        { x: widthMm, y: lengthMm },
        { x: 0, y: lengthMm },
      ],
      closed: true,
      layer: "corte",
    };

    doc.entities2D = [baseBoxEntity];

    doc.featureTree.addFeature({
      id: `base_flange_${Date.now()}`,
      name,
      type: "sheet_metal_part",
      parameters: { width: widthMm, length: lengthMm, thickness: doc.thickness },
    });

    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Adiciona uma dobra com suporte polimórfico a argumentos (objeto ou parâmetros posicionais).
   */
  static addBend(
    doc: PartDocument,
    bendParamsOrEdge:
      | string
      | {
          angleDeg?: number;
          flangeLengthMm?: number;
          bendLinePositionMm?: number;
          innerRadius?: number;
        },
    angleDeg = 90,
    innerRadius?: number,
    flangeLength = 50,
  ): PartDocument {
    let edgeId: "top" | "bottom" | "left" | "right" = "right";
    let angle = angleDeg;
    let ir = innerRadius ?? doc.innerRadius;
    let length = flangeLength;

    if (typeof bendParamsOrEdge === "object") {
      angle = bendParamsOrEdge.angleDeg ?? 90;
      ir = bendParamsOrEdge.innerRadius ?? doc.innerRadius;
      length = bendParamsOrEdge.flangeLengthMm ?? 50;
    } else if (typeof bendParamsOrEdge === "string") {
      if (bendParamsOrEdge.includes("top")) edgeId = "top";
      else if (bendParamsOrEdge.includes("left")) edgeId = "left";
      else if (bendParamsOrEdge.includes("bottom")) edgeId = "bottom";
      else edgeId = "right";
    }

    return this.addFlange(doc, {
      edgeId,
      flangeLength: length,
      angleDeg: angle,
      insideRadius: ir,
    });
  }

  /**
   * Adiciona uma aba dobrada paramétrica (Edge Flange) ligada a uma das arestas da chapa.
   */
  static addFlange(
    doc: PartDocument,
    options: {
      name?: string;
      edgeId: "top" | "bottom" | "left" | "right";
      flangeLength: number;
      angleDeg?: number;
      insideRadius?: number;
      direction?: "UP" | "DOWN";
      parentFlangeId?: string;
    },
  ): PartDocument {
    const angleDeg = options.angleDeg ?? 90;
    const insideRadius = options.insideRadius ?? doc.innerRadius;
    const direction = options.direction ?? "UP";
    const flangeLength = options.flangeLength;

    const ba = SheetMetalEngine.computeBendAllowance(
      angleDeg,
      insideRadius,
      doc.kFactor,
      doc.thickness,
    );
    const bd = SheetMetalEngine.computeBendDeduction(
      angleDeg,
      insideRadius,
      doc.kFactor,
      doc.thickness,
    );
    const ossb = SheetMetalEngine.computeOutsideSetback(angleDeg, insideRadius, doc.thickness);

    const flangeDef: ParametricFlangeDef = {
      id: `flange_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${options.edgeId}`,
      name: options.name || `Aba ${options.edgeId.toUpperCase()} (${angleDeg}°)`,
      edgeId: options.edgeId,
      parentFlangeId: options.parentFlangeId,
      angleDeg,
      insideRadius,
      flangeLength,
      direction,
      kFactor: doc.kFactor,
      bendAllowance: ba,
      bendDeduction: bd,
      outsideSetback: ossb,
    };

    if (!doc.flanges) doc.flanges = [];
    doc.flanges.push(flangeDef);

    doc.featureTree.addFeature({
      id: flangeDef.id,
      name: flangeDef.name,
      type: "bend",
      parameters: { ...flangeDef },
      dependencies: doc.featureTree
        .getFeatures()
        .slice(-1)
        .map((f) => f.id),
    });

    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Converte uma linha selecionada do Sketch 2D em uma Linha de Dobra Paramétrica (Sketched Bend).
   */
  static addSketchedBend(
    doc: PartDocument,
    line: { x1: number; y1: number; x2: number; y2: number },
    options: {
      angleDeg?: number;
      insideRadius?: number;
      direction?: "UP" | "DOWN";
      flangeLength?: number;
    } = {},
  ): PartDocument {
    const angleDeg = options.angleDeg ?? 90;
    const insideRadius = options.insideRadius ?? doc.innerRadius;
    const direction = options.direction ?? "UP";
    const length = options.flangeLength ?? 50;

    const ba = SheetMetalEngine.computeBendAllowance(
      angleDeg,
      insideRadius,
      doc.kFactor,
      doc.thickness,
    );
    const bd = SheetMetalEngine.computeBendDeduction(
      angleDeg,
      insideRadius,
      doc.kFactor,
      doc.thickness,
    );
    const ossb = SheetMetalEngine.computeOutsideSetback(angleDeg, insideRadius, doc.thickness);

    // Determina orientação da linha
    const dx = Math.abs(line.x2 - line.x1);
    const dy = Math.abs(line.y2 - line.y1);
    const edgeId: "top" | "bottom" | "left" | "right" = dx > dy ? "top" : "right";

    const flangeDef: ParametricFlangeDef = {
      id: `sketched_bend_${Date.now()}`,
      name: `Dobra Esboçada ${angleDeg}° R${insideRadius}`,
      edgeId,
      p1: { x: line.x1, y: line.y1 },
      p2: { x: line.x2, y: line.y2 },
      angleDeg,
      insideRadius,
      flangeLength: length,
      direction,
      kFactor: doc.kFactor,
      bendAllowance: ba,
      bendDeduction: bd,
      outsideSetback: ossb,
    };

    if (!doc.flanges) doc.flanges = [];
    doc.flanges.push(flangeDef);

    doc.featureTree.addFeature({
      id: flangeDef.id,
      name: flangeDef.name,
      type: "bend",
      parameters: { ...flangeDef },
      dependencies: doc.featureTree
        .getFeatures()
        .slice(-1)
        .map((f) => f.id),
    });

    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Insere um modelo paramétrico canônico de Caldeiraria no projeto CHAMFER.
   */
  static addBoilermakingFeature(
    doc: PartDocument,
    type: "cone" | "square_to_round" | "elbow" | "branch",
    params: Record<string, unknown>,
    name?: string,
  ): PartDocument {
    const featureName = name || `Caldeiraria — ${type.toUpperCase()}`;
    doc.boilermakingFeature = {
      type,
      name: featureName,
      params,
    };

    doc.featureTree.addFeature({
      id: `boilermaking_${type}_${Date.now()}`,
      name: featureName,
      type: "sheet_metal_part",
      parameters: { type, ...params },
    });

    // Se o modelo gerar entidades 2D desenvolvidas, atualiza doc.entities2D
    try {
      let result: { dxfEntities?: Entity[]; solid?: Solid } | null = null;
      const p = params as Record<string, number | undefined>;
      if (type === "cone") {
        result = BoilermakingEngine.generateTruncatedCone({
          D: p.D ?? 200,
          d: p.d ?? 100,
          H: p.H ?? 250,
          thickness: doc.thickness,
          material: doc.material,
          density: doc.density,
          divisions: p.divisions ?? 32,
        });
      } else if (type === "square_to_round") {
        result = BoilermakingEngine.generateSquareToRound({
          baseWidth: p.baseWidth ?? 200,
          baseLength: p.baseLength ?? 200,
          topDiameter: p.topDiameter ?? 140,
          height: p.height ?? 220,
          thickness: doc.thickness,
          material: doc.material,
          density: doc.density,
        });
      } else if (type === "elbow") {
        result = BoilermakingEngine.generateSegmentedElbow({
          diameter: p.diameter ?? 150,
          bendRadius: p.bendRadius ?? 225,
          totalAngleDeg: p.totalAngleDeg ?? 90,
          segmentsCount: p.segmentsCount ?? 4,
          thickness: doc.thickness,
          material: doc.material,
          density: doc.density,
        });
      } else if (type === "branch") {
        result = BoilermakingEngine.generateCylindricalBranch({
          mainDiameter: p.mainDiameter ?? 200,
          branchDiameter: p.branchDiameter ?? 120,
          angleDeg: p.angleDeg ?? 90,
          branchHeight: p.branchHeight ?? 180,
          thickness: doc.thickness,
          material: doc.material,
        });
      }

      if (result?.dxfEntities && result.dxfEntities.length > 0) {
        doc.entities2D = [...result.dxfEntities];
      }
    } catch (err) {
      console.warn("Aviso ao gerar entidades 2D do modelo de caldeiraria:", err);
    }

    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Constrói instâncias sólidas 3D canônicas para visualização no Model3DViewer.
   * Suporta o slider de transição contínua 3D Dobrado (0%) ↔ 2D Planificado (100%).
   */
  static buildSolidInstances(
    doc: PartDocument,
    foldProgress = doc.foldProgress ?? 0,
    material: SolidMaterial = "aco",
  ): SolidInstance[] {
    const instances: SolidInstance[] = [];

    // 1. Caso Caldeiraria Paramétrica Canônica
    if (doc.boilermakingFeature) {
      const { type, params } = doc.boilermakingFeature;
      try {
        let result: { dxfEntities?: Entity[]; solid?: Solid } | null = null;
        const p = params as Record<string, number | undefined>;
        if (type === "cone") {
          result = BoilermakingEngine.generateTruncatedCone({
            D: p.D ?? 200,
            d: p.d ?? 100,
            H: p.H ?? 250,
            thickness: doc.thickness,
            material: doc.material,
            density: doc.density,
            divisions: p.divisions ?? 32,
          });
        } else if (type === "square_to_round") {
          result = BoilermakingEngine.generateSquareToRound({
            baseWidth: p.baseWidth ?? 200,
            baseLength: p.baseLength ?? 200,
            topDiameter: p.topDiameter ?? 140,
            height: p.height ?? 220,
            thickness: doc.thickness,
            material: doc.material,
            density: doc.density,
          });
        } else if (type === "elbow") {
          result = BoilermakingEngine.generateSegmentedElbow({
            diameter: p.diameter ?? 150,
            bendRadius: p.bendRadius ?? 225,
            totalAngleDeg: p.totalAngleDeg ?? 90,
            segmentsCount: p.segmentsCount ?? 4,
            thickness: doc.thickness,
            material: doc.material,
            density: doc.density,
          });
        } else if (type === "branch") {
          result = BoilermakingEngine.generateCylindricalBranch({
            mainDiameter: p.mainDiameter ?? 200,
            branchDiameter: p.branchDiameter ?? 120,
            angleDeg: p.angleDeg ?? 90,
            branchHeight: p.branchHeight ?? 180,
            thickness: doc.thickness,
            material: doc.material,
          });
        }

        if (result?.solid && result.solid.vertices && result.solid.vertices.length > 0) {
          const vertices: number[] = [];
          const indices: number[] = [];
          const idMap = new Map<string, number>();

          result.solid.vertices.forEach((v, idx) => {
            idMap.set(v.id, idx);
            vertices.push(v.point.x, v.point.y, v.point.z);
          });

          // Se tiver divisões estruturadas, gera faixas de triângulos
          const totalV = result.solid.vertices.length;
          if (totalV >= 4) {
            const half = Math.floor(totalV / 2);
            for (let i = 0; i < half - 1; i++) {
              const b0 = i;
              const b1 = i + 1;
              const t0 = i + half;
              const t1 = i + 1 + half;
              indices.push(b0, b1, t1);
              indices.push(b0, t1, t0);
            }
          }

          instances.push({
            id: `boilermaking_${type}`,
            partKey: `caldeiraria_${type}`,
            code: `${type.toUpperCase()}-01`,
            index: 1,
            label: `${doc.boilermakingFeature.name || type.toUpperCase()}`,
            center: { x: 0, y: 0, z: 0 },
            size: { x: 200, y: 200, z: 200 },
            rotZ: 0,
            material,
            assemblyKey: "main",
            fabricable: true,
            meshVertices: vertices,
            meshIndices: indices.length > 0 ? indices : undefined,
          });
          return instances;
        }
      } catch (err) {
        console.warn("Aviso ao construir malha de caldeiraria:", err);
      }
    }

    // 2. Chapa Metálica Paramétrica (Base Flange + Abas Dobradas)
    const W = doc.baseWidth ?? 120;
    const L = doc.baseLength ?? 100;
    const T = Math.max(0.5, doc.thickness);

    // Chapa Base
    instances.push({
      id: "base_flange",
      partKey: "base_plate",
      code: "BASE-01",
      index: 1,
      label: "Chapa Base",
      center: { x: W * 0.5, y: -L * 0.5, z: 0 },
      size: { x: W, y: L, z: T },
      rotZ: 0,
      rotX: 0,
      rotY: 0,
      material,
      assemblyKey: "base",
      fabricable: true,
    });

    const flanges = doc.flanges && doc.flanges.length > 0 ? doc.flanges : [];

    for (let i = 0; i < flanges.length; i++) {
      const f = flanges[i];
      const nominalAngle = f.angleDeg ?? 90;
      // Cinemática da transição do slider: 0 = planificado (0°), 1 = dobrado (nominalAngle)
      const curAngleDeg = nominalAngle * Math.max(0, Math.min(1, foldProgress));
      const curAngleRad = (curAngleDeg * Math.PI) / 180;
      const F = f.flangeLength ?? 50;
      const dirSign = f.direction === "DOWN" ? -1 : 1;

      if (f.edgeId === "right") {
        const dx = F * 0.5 * Math.cos(curAngleRad);
        const dz = F * 0.5 * Math.sin(curAngleRad) * dirSign;
        instances.push({
          id: f.id,
          partKey: `flange_${f.id}`,
          code: `FLANGE-${i + 1}`,
          index: i + 2,
          label: `${f.name || "Aba Direita"} (${curAngleDeg.toFixed(0)}°)`,
          center: { x: W + dx, y: -L * 0.5, z: dz },
          size: { x: F, y: L, z: T },
          rotZ: 0,
          rotY: -curAngleRad * dirSign,
          material,
          assemblyKey: "flange",
          fabricable: true,
        });
      } else if (f.edgeId === "left") {
        const dx = -(F * 0.5) * Math.cos(curAngleRad);
        const dz = F * 0.5 * Math.sin(curAngleRad) * dirSign;
        instances.push({
          id: f.id,
          partKey: `flange_${f.id}`,
          code: `FLANGE-${i + 1}`,
          index: i + 2,
          label: `${f.name || "Aba Esquerda"} (${curAngleDeg.toFixed(0)}°)`,
          center: { x: dx, y: -L * 0.5, z: dz },
          size: { x: F, y: L, z: T },
          rotZ: 0,
          rotY: curAngleRad * dirSign,
          material,
          assemblyKey: "flange",
          fabricable: true,
        });
      } else if (f.edgeId === "top") {
        const dy = F * 0.5 * Math.cos(curAngleRad);
        const dz = F * 0.5 * Math.sin(curAngleRad) * dirSign;
        instances.push({
          id: f.id,
          partKey: `flange_${f.id}`,
          code: `FLANGE-${i + 1}`,
          index: i + 2,
          label: `${f.name || "Aba Superior"} (${curAngleDeg.toFixed(0)}°)`,
          center: { x: W * 0.5, y: dy, z: dz },
          size: { x: W, y: F, z: T },
          rotZ: 0,
          rotX: curAngleRad * dirSign,
          material,
          assemblyKey: "flange",
          fabricable: true,
        });
      } else if (f.edgeId === "bottom") {
        const dy = -(F * 0.5) * Math.cos(curAngleRad);
        const dz = F * 0.5 * Math.sin(curAngleRad) * dirSign;
        instances.push({
          id: f.id,
          partKey: `flange_${f.id}`,
          code: `FLANGE-${i + 1}`,
          index: i + 2,
          label: `${f.name || "Aba Inferior"} (${curAngleDeg.toFixed(0)}°)`,
          center: { x: W * 0.5, y: -L + dy, z: dz },
          size: { x: W, y: F, z: T },
          rotZ: 0,
          rotX: -curAngleRad * dirSign,
          material,
          assemblyKey: "flange",
          fabricable: true,
        });
      }
    }

    // 3. Fallback: Se não houver dobras configuradas mas houver desenho 2D
    if (instances.length <= 1 && doc.entities2D.length > 0) {
      const solids = planSolids(doc.entities2D, doc.thickness, material);
      if (solids.length > 0) return solids;
    }

    return instances;
  }

  /**
   * Desdobra o modelo em sua planificação técnica 2D verdadeira (Flat Pattern).
   */
  static unfold(doc: PartDocument): PartDocument {
    doc.foldProgress = 0.0;
    doc.activeState = "2D_FLAT";

    // Se houver modelo de caldeiraria, gera planificação via BoilermakingEngine
    if (doc.boilermakingFeature) {
      const { type, params } = doc.boilermakingFeature;
      let result: { dxfEntities?: Entity[]; solid?: Solid } | null = null;
      const p = params as Record<string, number | undefined>;
      if (type === "cone") {
        result = BoilermakingEngine.generateTruncatedCone({
          D: p.D ?? 200,
          d: p.d ?? 100,
          H: p.H ?? 250,
          thickness: doc.thickness,
          material: doc.material,
          density: doc.density,
          divisions: p.divisions ?? 32,
        });
      } else if (type === "square_to_round") {
        result = BoilermakingEngine.generateSquareToRound({
          baseWidth: p.baseWidth ?? 200,
          baseLength: p.baseLength ?? 200,
          topDiameter: p.topDiameter ?? 140,
          height: p.height ?? 220,
          thickness: doc.thickness,
          material: doc.material,
          density: doc.density,
        });
      } else if (type === "elbow") {
        result = BoilermakingEngine.generateSegmentedElbow({
          diameter: p.diameter ?? 150,
          bendRadius: p.bendRadius ?? 225,
          totalAngleDeg: p.totalAngleDeg ?? 90,
          segmentsCount: p.segmentsCount ?? 4,
          thickness: doc.thickness,
          material: doc.material,
          density: doc.density,
        });
      } else if (type === "branch") {
        result = BoilermakingEngine.generateCylindricalBranch({
          mainDiameter: p.mainDiameter ?? 200,
          branchDiameter: p.branchDiameter ?? 120,
          angleDeg: p.angleDeg ?? 90,
          branchHeight: p.branchHeight ?? 180,
          thickness: doc.thickness,
          material: doc.material,
        });
      }

      if (result?.dxfEntities && result.dxfEntities.length > 0) {
        doc.entities2D = [...result.dxfEntities];
      }
      doc.updatedAt = Date.now();
      return doc;
    }

    const flanges =
      doc.flanges && doc.flanges.length > 0
        ? doc.flanges.map((f) => ({
            id: f.id,
            edgeId: f.edgeId ?? ("right" as const),
            length: f.flangeLength,
            angleDeg: f.angleDeg,
            insideRadius: f.insideRadius,
            materialPosition: "INSIDE" as const,
          }))
        : [
            {
              id: "flange_01",
              edgeId: "right" as const,
              length: 50,
              angleDeg: 90,
              insideRadius: doc.innerRadius,
              materialPosition: "INSIDE" as const,
            },
          ];

    const smPart = {
      id: doc.id,
      name: doc.name,
      thickness: doc.thickness,
      defaultKFactor: doc.kFactor,
      defaultBendRadius: doc.innerRadius,
      material: doc.material,
      density: doc.density,
      baseWidth: doc.baseWidth ?? 120,
      baseLength: doc.baseLength ?? 100,
      flanges,
      isUnfolded: true,
    };

    const flatResult = SheetMetalEngine.generateFlatPattern(smPart);

    const bendEntities: Entity[] = flatResult.bendLines.map((bl) => ({
      id: `bend_line_${bl.id}`,
      type: "line",
      x1: bl.startPoint.x,
      y1: bl.startPoint.y,
      x2: bl.endPoint.x,
      y2: bl.endPoint.y,
      layer: "DOBRA",
    }));

    doc.flatPatternResult = flatResult;
    doc.entities2D = [...flatResult.contourEntities, ...bendEntities];
    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Dobra o modelo de volta ao estado volumétrico tridimensional conformado (100%).
   */
  static fold(doc: PartDocument): PartDocument {
    doc.foldProgress = 1.0;
    doc.activeState = "3D_FOLDED";
    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Ajusta o progresso de transição contínua entre 2D Planificado (0%) e 3D Dobrado (100%).
   */
  static setFoldProgress(doc: PartDocument, progress: number): PartDocument {
    const clamped = Math.max(0, Math.min(1, progress));
    doc.foldProgress = clamped;
    if (clamped <= 0.001) {
      doc.activeState = "2D_FLAT";
    } else {
      doc.activeState = "3D_FOLDED";
    }
    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Gera percurso de corte CAM e pós-processamento G-Code industrial.
   */
  static generateCAM(doc: PartDocument, machineConfig?: MachineConfig): PartDocument {
    // Se o documento estiver dobrado, planifica temporariamente para extrair contornos 2D
    const entities = doc.entities2D.length > 0 ? doc.entities2D : this.unfold(doc).entities2D;

    const cuttingParams = {
      technology: "LASER" as const,
      sheetThicknessMm: doc.thickness,
      kerfWidthMm: 0.2,
      feedrateMmMin: 2800,
      rapidSpeedMmMin: 18000,
      pierceTimeSec: 0.35,
      gasPressureBar: 1.0,
      powerWatts: 3000,
    };

    const toolpath = CAMEngine.generateToolpath(entities, cuttingParams);
    const gcode = GCodePostProcessor.generateGCode(toolpath, cuttingParams);

    doc.camResult = toolpath;
    doc.gcode = gcode;
    doc.activeState = "CAM_TOOLPATH";
    doc.updatedAt = Date.now();
    return doc;
  }

  /**
   * Reexecuta a reconstrução paramétrica (rebuild) de todo o documento CAD.
   */
  static rebuild(
    doc: PartDocument,
    opts?: RebuildKernelOptions,
  ): { doc: PartDocument; report: RebuildReport } {
    const report = doc.featureTree.rebuild();

    if (opts?.generateFlatPattern) {
      this.unfold(doc);
    }
    if (opts?.generateCamToolpath) {
      this.generateCAM(doc, opts.machineConfig);
    }

    doc.updatedAt = Date.now();
    return { doc, report };
  }

  /**
   * Gera a prancha técnica 2D com vistas ortográficas, tabela de dobras e bloco de título ABNT.
   */
  static generateTechnicalDrawing(
    doc: PartDocument,
    options?: DraftingOptions,
  ): TechnicalDrawingSheet {
    const drawing = DraftingEngine.generateDrawing(doc, options);
    doc.technicalDrawing = drawing;
    doc.activeState = "2D_DRAWING";
    doc.updatedAt = Date.now();
    return drawing;
  }

  /**
   * Adiciona um perfil estrutural ao documento (vigas, tubos, cantoneiras).
   */
  static addStructuralMember(
    doc: PartDocument,
    params: {
      profile: ProfileSection;
      startPoint: Vector3D;
      endPoint: Vector3D;
      alignment?: ProfileAlignment;
      rotationDeg?: number;
      name?: string;
    },
  ): StructuralMember {
    const member = StructuralEngine.createMember(params);
    if (!doc.structuralMembers) {
      doc.structuralMembers = [];
    }
    doc.structuralMembers.push(member);
    doc.activeState = "WELDMENTS";
    doc.updatedAt = Date.now();
    return member;
  }

  /**
   * Aplica tratamento de cantos (esquadria, topo ou copagem) entre membros.
   */
  static applyCornerTreatment(
    doc: PartDocument,
    memberAId: string,
    memberBId: string,
    treatment: CornerTreatmentType,
    weldGapMm = 1.5,
  ): void {
    if (!doc.structuralMembers) return;
    const idxA = doc.structuralMembers.findIndex((m) => m.id === memberAId);
    const idxB = doc.structuralMembers.findIndex((m) => m.id === memberBId);
    if (idxA === -1 || idxB === -1) return;

    const res = StructuralEngine.applyCornerTreatment(
      doc.structuralMembers[idxA],
      doc.structuralMembers[idxB],
      treatment,
      weldGapMm,
    );

    doc.structuralMembers[idxA] = res.memberA;
    doc.structuralMembers[idxB] = res.memberB;
    doc.updatedAt = Date.now();
  }

  /**
   * Gera a lista de corte (Cut List) e relatório de aproveitamento de barras.
   */
  static generateWeldmentCutList(
    doc: PartDocument,
    standardBarLengthMeters = 6.0,
  ): StructuralFrameReport {
    const members = doc.structuralMembers || [];
    const report = StructuralEngine.generateCutList(doc.name, members, standardBarLengthMeters);
    doc.structuralReport = report;
    doc.updatedAt = Date.now();
    return report;
  }

  /**
   * Executa o aninhamento industrial de blanks na chapa e calcula aproveitamento e retalhos.
   */
  static generateNesting(
    doc: PartDocument,
    additionalBlanks: NestingBlank[] = [],
    options?: Partial<NestingOptions>,
  ): NestingJobResult {
    const blanks: NestingBlank[] = [...additionalBlanks];

    if (doc.flatPatternResult) {
      blanks.unshift({
        id: doc.id,
        name: doc.name,
        width: doc.flatPatternResult.blankWidth,
        height: doc.flatPatternResult.blankLength,
        quantity: 1,
        thickness: doc.thickness,
        material: doc.material,
      });
    } else {
      blanks.unshift({
        id: doc.id,
        name: doc.name,
        width: 150,
        height: 100,
        quantity: 1,
        thickness: doc.thickness,
        material: doc.material,
      });
    }

    const job = NestingEngine.runNesting(blanks, options);
    doc.nestingJob = job;
    doc.activeState = "NESTING";
    doc.updatedAt = Date.now();
    return job;
  }

  /**
   * Exporta a prancha de aninhamento para DXF industrial compatível com CypCut.
   */
  static exportNestingDxf(doc: PartDocument, sheetIndex = 1): string {
    if (!doc.nestingJob || doc.nestingJob.sheets.length === 0) {
      throw new Error("Nenhum aninhamento calculado para exportar DXF.");
    }
    const sheet =
      doc.nestingJob.sheets.find((s) => s.sheetIndex === sheetIndex) ?? doc.nestingJob.sheets[0];
    return NestingDxfExporter.exportSheetToDxf(sheet);
  }

  /**
   * Adiciona uma nervura de reforço em dobra (Gusset).
   */
  static addGusset(doc: PartDocument, gusset: SheetMetalGussetDef): void {
    if (!doc.gussets) doc.gussets = [];
    doc.gussets.push(gusset);
    this.rebuildForming(doc);
  }

  /**
   * Adiciona uma veneziana de respiro (Louver).
   */
  static addLouver(doc: PartDocument, louver: SheetMetalLouverDef): void {
    if (!doc.louvers) doc.louvers = [];
    doc.louvers.push(louver);
    this.rebuildForming(doc);
  }

  /**
   * Adiciona um estampo, repuxo ou escareado (Emboss / Countersink).
   */
  static addEmboss(doc: PartDocument, emboss: SheetMetalEmbossDef): void {
    if (!doc.embosses) doc.embosses = [];
    doc.embosses.push(emboss);
    this.rebuildForming(doc);
  }

  /**
   * Adiciona uma bainha industrial (Hem Flange).
   */
  static addHem(doc: PartDocument, hem: SheetMetalHemDef): void {
    if (!doc.hems) doc.hems = [];
    doc.hems.push(hem);
    const hemRes = HemEngine.calculateHem(hem);
    if (doc.flatPatternResult) {
      doc.flatPatternResult.bendLines.push(...hemRes.bendLines);
      doc.flatPatternResult.contourEntities.push(...hemRes.flatPatternEntities);
    }
    this.rebuildForming(doc);
  }

  /**
   * Adiciona um degrau de chapa (Jog Flange).
   */
  static addJog(doc: PartDocument, jog: SheetMetalJogDef): void {
    if (!doc.jogs) doc.jogs = [];
    doc.jogs.push(jog);
    const jogRes = HemEngine.calculateJog(jog);
    if (doc.flatPatternResult) {
      doc.flatPatternResult.bendLines.push(...jogRes.bendLines);
      doc.flatPatternResult.contourEntities.push(...jogRes.flatPatternEntities);
    }
    this.rebuildForming(doc);
  }

  /**
   * Regenera e consolida todos os recursos de conformação da peça.
   */
  static rebuildForming(doc: PartDocument): FormingEngineResult {
    const bendLines =
      doc.flatPatternResult?.bendLines.map((b) => ({
        id: b.id,
        start: b.startPoint,
        end: b.endPoint,
      })) ?? [];

    const result = FormingEngine.consolidateForming(
      doc.gussets || [],
      doc.louvers || [],
      doc.embosses || [],
      bendLines,
    );

    doc.formingResult = result;
    if (doc.activeState === "FORMING") {
      doc.entities2D = [
        ...(doc.flatPatternResult?.contourEntities || []),
        ...result.allFlatPatternEntities,
      ];
    }
    doc.updatedAt = Date.now();
    return result;
  }

  /**
   * Executa a simulação de prensagem, cálculo de tonelagem e retorno elástico (springback).
   */
  static simulatePressBrake(
    doc: PartDocument,
    options?: Partial<PressBrakeSimulationInput>,
  ): PressBrakeSimulationResult {
    let grade: SheetMetalGrade = "A36";
    const mat = (doc.material || "").toUpperCase();
    if (mat.includes("INOX") || mat.includes("304")) grade = "INOX_304";
    else if (mat.includes("316")) grade = "INOX_316";
    else if (mat.includes("ALU") || mat.includes("5052")) grade = "ALU_5052";
    else if (mat.includes("GALV") || mat.includes("ZINC")) grade = "GALVANIZED";
    else if (mat.includes("1020")) grade = "SAE1020";

    const bendLength =
      options?.bendLengthMm ??
      (doc.flatPatternResult?.blankLength || doc.flatPatternResult?.blankWidth || 1000);

    const targetAngle = options?.targetAngleDeg ?? 90;

    const input: PressBrakeSimulationInput = {
      material: options?.material ?? grade,
      thicknessMm: options?.thicknessMm ?? doc.thickness,
      bendLengthMm: bendLength,
      dieOpeningVMm: options?.dieOpeningVMm,
      punchRadiusMm: options?.punchRadiusMm ?? doc.innerRadius,
      targetAngleDeg: targetAngle,
    };

    const sim = PressBrakeSimulator.simulate(input);
    doc.pressBrakeSimulation = sim;
    doc.updatedAt = Date.now();
    return sim;
  }

  /**
   * Executa a auditoria DFM completa e orçamentação analítica da peça.
   */
  static auditDfm(
    doc: PartDocument,
    configOverride?: Partial<DfmRuleConfig>,
    ratesOverride?: Partial<FabricationCostRates>,
  ): DfmFullReport {
    if (!doc.sheetMetal) {
      doc.sheetMetal = {
        thickness: doc.thickness,
        material: doc.material,
        defaultBendRadius: doc.innerRadius,
        bends: (doc.flatPatternResult?.bendAnnotations || []).map((b, idx) => ({
          id: b.bendId || `BEND_${idx + 1}`,
          start: b.start,
          end: b.end,
          angle: b.angleDeg,
          direction: b.direction,
        })),
        flatPattern: doc.flatPatternResult
          ? {
              width: doc.flatPatternResult.blankWidth,
              height: doc.flatPatternResult.blankLength,
              innerLoops: [],
            }
          : undefined,
      };
    }
    if (!doc.solid && doc.activeSolid) {
      doc.solid = doc.activeSolid;
    }
    if (!doc.forming) {
      doc.forming = {
        embosses: doc.embosses,
        gussets: doc.gussets,
        louvers: doc.louvers,
        hems: doc.hems,
        jogs: doc.jogs,
      };
    }

    const audit = DfmEngine.audit(doc, configOverride);
    const cost = DfmCostEngine.calculate(doc, ratesOverride);

    const report: DfmFullReport = {
      partName: doc.name || doc.header?.name || "Peça Caldra",
      audit,
      cost,
      generatedAt: new Date().toISOString(),
    };

    doc.dfmReport = report;
    doc.updatedAt = Date.now();
    return report;
  }

  /**
   * Exporta relatório de DFM e Custos em CSV.
   */
  static exportDfmReportCsv(doc: PartDocument): string {
    const report = doc.dfmReport || this.auditDfm(doc);
    return DfmReportExporter.generateCsv(report);
  }

  /**
   * Exporta arquivo DXF com marcações e círculos na camada DFM_ISSUES.
   */
  static exportDfmDxf(doc: PartDocument): string {
    const report = doc.dfmReport || this.auditDfm(doc);
    return DfmReportExporter.generateDxfWithDfmLayer(doc, report.audit);
  }

  /**
   * Executa o plano de inspeção de metrologia dimensional e GD&T (Fase 14).
   */
  static generateMetrology(
    doc: PartDocument,
    options?: MetrologyOptions,
  ): FirstArticleInspectionReport {
    const report = InspectionEngine.generateInspectionPlan(doc, options);
    doc.metrologyReport = report;
    doc.activeState = "METROLOGY";
    doc.updatedAt = Date.now();
    return report;
  }

  /**
   * Exporta o relatório FAI / PPAP de Metrologia em CSV.
   */
  static exportMetrologyCsv(doc: PartDocument): string {
    const report = doc.metrologyReport || this.generateMetrology(doc);
    return FaiReportExporter.exportToCSV(report);
  }

  /**
   * Exporta a prancha de inspeção baloneada em SVG.
   */
  static exportMetrologySvg(doc: PartDocument, width?: number, height?: number): string {
    const report = doc.metrologyReport || this.generateMetrology(doc);
    return FaiReportExporter.exportToInspectionSVG(report, width, height);
  }

  /**
   * Executa a análise estrutural por elementos finitos FEA / CAE (Fase 15).
   */
  static runFeaSimulation(
    doc: PartDocument,
    options?: FeaSimulationOptions,
  ): FeaAnalysisResult {
    const report = FeaEngine.solve(doc, options);
    doc.feaReport = report;
    doc.activeState = "FEA";
    doc.updatedAt = Date.now();
    return report;
  }

  /**
   * Exporta o Memorial de Cálculo FEA em CSV.
   */
  static exportFeaCsv(doc: PartDocument): string {
    const report = doc.feaReport || this.runFeaSimulation(doc);
    return FeaReportExporter.exportToCSV(report);
  }

  /**
   * Exporta o Mapa de Calor de Tensões de Von Mises em SVG.
   */
  static exportFeaHeatmapSvg(doc: PartDocument, width?: number, height?: number): string {
    const report = doc.feaReport || this.runFeaSimulation(doc);
    return FeaReportExporter.exportToStressHeatmapSVG(report, width, height);
  }
}
