/**
 * CALDRA CHAMFER — REGENERADOR PARAMÉTRICO B-REP (FASE 01)
 *
 * Motor de execução de features com base no modelo B-Rep canônico.
 * Executa exclusivamente as features marcadas como "DIRTY" e seus dependentes,
 * preservando o cache de sólidos B-Rep e malhas das operações precedentes.
 *
 * Prioriza o kernel OCCT (occt-wasm) e calcula propriedades de massa,
 * tesselação e nomes topológicos invariantes.
 */

import type { ICadKernel } from "../core/CadKernel";
import type { CadShape } from "../core/CadShape";
import type { CadFeatureNode, CadBody, CadSketch, CadParameter } from "./types";
import { CadFeatureGraph } from "./CadFeatureGraph";
import { CadReferenceManager } from "./CadReference";
import { CaldraBoilermakingBRep } from "../boilermaking/CaldraBoilermakingBRep";
import { CaldraWeldmentBridge } from "../weldments/CaldraWeldmentBridge";

export interface RebuildReport {
  success: boolean;
  totalFeatures: number;
  rebuiltCount: number;
  cachedCount: number;
  durationMs: number;
  bodies: CadBody[];
  errors: Array<{ featureId: string; featureName: string; error: string }>;
}

export class CadRegenerator {
  /**
   * Avalia uma expressão numérica substituindo parâmetros existentes no documento.
   * Exemplo: "L - 50", "DIAMETER * 2", "120", "MEIO_COMPRIMENTO"
   */
  public static evaluateExpression(
    expr: string | number | undefined,
    parameters: Map<string, CadParameter>,
    depth = 0,
  ): number {
    if (expr === undefined || expr === null) return 0;
    if (typeof expr === "number") return expr;
    if (depth > 8) return 0; // Proteção contra recursão infinita

    const trimmed = String(expr).trim();
    if (!trimmed) return 0;

    // Se corresponder exatamente ao nome de um parâmetro registrado
    const directParam = parameters.get(trimmed);
    if (directParam) {
      if (directParam.expression && directParam.expression !== trimmed) {
        return this.evaluateExpression(directParam.expression, parameters, depth + 1);
      }
      return directParam.value;
    }

    // Se for número puro
    const num = Number(trimmed);
    if (!isNaN(num)) return num;

    // Substitui variáveis conhecidas por seus valores numéricos
    let evaluatedString = trimmed;
    for (const [name, param] of parameters.entries()) {
      const regex = new RegExp(`\\b${name}\\b`, "g");
      let val = param.value;
      if (param.expression && param.expression !== name) {
        val = this.evaluateExpression(param.expression, parameters, depth + 1);
      }
      evaluatedString = evaluatedString.replace(regex, String(val));
    }

    try {
      const mathScope = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        pow: Math.pow,
        min: Math.min,
        max: Math.max,
        abs: Math.abs,
        PI: Math.PI,
        pi: Math.PI,
      };

      const fn = new Function(...Object.keys(mathScope), `"use strict"; return (${evaluatedString});`);
      const result = Number(fn(...Object.values(mathScope)));
      return isNaN(result) ? 0 : result;
    } catch {
      return 0;
    }
  }

  /**
   * Executa a regeneração seletiva da árvore / grafo de features
   */
  public static async regenerate(
    graph: CadFeatureGraph,
    sketches: Map<string, CadSketch>,
    parameters: Map<string, CadParameter>,
    bodies: Map<string, CadBody>,
    kernel: ICadKernel,
    options?: { forceAll?: boolean },
  ): Promise<RebuildReport> {
    const startTime = performance.now();
    const orderedNodes = graph.getAllNodes();
    const errors: Array<{ featureId: string; featureName: string; error: string }> = [];

    let rebuiltCount = 0;
    let cachedCount = 0;

    // Garante inicialização do kernel se necessário
    if (!kernel.isInitialized) {
      await kernel.init();
    }

    // Se for solicitado rebuild completo, força todos como DIRTY
    if (options?.forceAll) {
      orderedNodes.forEach((n) => graph.markDirty(n.id));
    }

    // Pipeline sequencial de sólidos intermediários por corpo
    // Mapa: bodyId -> último CadShape B-Rep avaliado
    const currentBodyShapes = new Map<string, CadShape>();

    // Inicializa o mapa com corpos já existentes
    for (const [bId, body] of bodies.entries()) {
      if (body.bRepShape) {
        currentBodyShapes.set(bId, body.bRepShape);
      }
    }

    for (const node of orderedNodes) {
      if (node.isSuppressed) {
        node.state = "SUPPRESSED";
        continue;
      }

      // Determina o corpo alvo (padrão: "body_1")
      const targetBodyId = node.targetBodyId ?? "body_1";
      const previousShape = currentBodyShapes.get(targetBodyId) ?? null;

      // 1. Se a feature já está UP_TO_DATE e possui resultado em cache, reaproveita!
      if (node.state === "UP_TO_DATE" && node.result?.bRepShape) {
        currentBodyShapes.set(targetBodyId, node.result.bRepShape);
        cachedCount++;
        continue;
      }

      // 2. Executa a feature que está "DIRTY"
      const featStart = performance.now();
      try {
        const newShape = await this.executeFeature(
          node,
          previousShape,
          sketches,
          parameters,
          kernel,
        );

        if (newShape) {
          // Extrai malha e propriedades de massa através da interface do kernel
          const k = kernel as any;
          const [tessellation, massProps] = await Promise.all([
            typeof k.tessellate === "function"
              ? k.tessellate(newShape, { linearDeflection: 0.1, angularDeflection: 0.5 }).catch(() => null)
              : null,
            typeof k.getMassProperties === "function"
              ? k.getMassProperties(newShape, 7.85).catch(() => null)
              : null,
          ]);

          // Popula faces, arestas e vértices para fingerprinting e referências estáveis
          if (typeof k.getFaces === "function" && !newShape.getCachedFaces()?.length) {
            const faces = await k.getFaces(newShape).catch(() => []);
            newShape.setCachedFaces(faces);
          }
          if (typeof k.getEdges === "function" && !newShape.getCachedEdges()?.length) {
            const edges = await k.getEdges(newShape).catch(() => []);
            newShape.setCachedEdges(edges);
          }
          if (typeof k.getVertices === "function" && !newShape.getCachedVertices()?.length) {
            const vertices = await k.getVertices(newShape).catch(() => []);
            newShape.setCachedVertices(vertices);
          }

          node.result = {
            bRepShape: newShape,
            tessellation,
            massProperties: massProps ?? undefined,
            rebuiltAt: Date.now(),
            executionTimeMs: performance.now() - featStart,
          };

          node.state = "UP_TO_DATE";
          node.targetBodyId = targetBodyId;
          currentBodyShapes.set(targetBodyId, newShape);
          rebuiltCount++;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        node.state = "ERROR";
        errors.push({
          featureId: node.id,
          featureName: node.name,
          error: msg,
        });
        // Interrompe a esteira daquele corpo para evitar cascatas corrompidas
        break;
      }
    }

    // 3. Atualiza os CadBody com os sólidos finais B-Rep correspondentes
    for (const [bodyId, shape] of currentBodyShapes.entries()) {
      let body = bodies.get(bodyId);
      if (!body) {
        body = {
          id: bodyId,
          name: `Corpo ${bodies.size + 1}`,
          type: "solid",
          isVisible: true,
          bRepShape: shape,
          tessellationCache: null,
          featureIds: [],
        };
        bodies.set(bodyId, body);
      }

      body.bRepShape = shape;
      const lastFeatNode = orderedNodes
        .filter((n) => (n.targetBodyId ?? "body_1") === bodyId && n.state === "UP_TO_DATE")
        .pop();

      if (lastFeatNode?.result) {
        body.tessellationCache = lastFeatNode.result.tessellation;
        body.massProperties = lastFeatNode.result.massProperties;
      }

      body.boundingBox = shape.bounds;
      body.featureIds = orderedNodes
        .filter((n) => (n.targetBodyId ?? "body_1") === bodyId)
        .map((n) => n.id);
    }

    const durationMs = performance.now() - startTime;

    return {
      success: errors.length === 0,
      totalFeatures: orderedNodes.length,
      rebuiltCount,
      cachedCount,
      durationMs,
      bodies: Array.from(bodies.values()),
      errors,
    };
  }

  /**
   * Executa uma feature específica sobre o sólido B-Rep anterior
   */
  private static async executeFeature(
    node: CadFeatureNode,
    currentShape: CadShape | null,
    sketches: Map<string, CadSketch>,
    parameters: Map<string, CadParameter>,
    kernel: ICadKernel,
  ): Promise<CadShape> {
    const p = node.parameters as Record<string, any>;
    const k = kernel as any;

    switch (node.type) {
      // ----------------------------------------------------
      // PRIMITIVAS SÓLIDAS
      // ----------------------------------------------------
      case "base_box": {
        const dx = this.evaluateExpression(p.width, parameters) || 200;
        const dy = this.evaluateExpression(p.length, parameters) || 150;
        const dz = this.evaluateExpression(p.height, parameters) || 50;
        const centered = Boolean(p.centered);
        return await kernel.createBox(dx, dy, dz, centered, node.name);
      }

      case "base_cylinder": {
        const r = this.evaluateExpression(p.radius, parameters) || 50;
        const h = this.evaluateExpression(p.height, parameters) || 100;
        const centered = Boolean(p.centered);
        return await kernel.createCylinder(r, h, centered, node.name);
      }

      // ----------------------------------------------------
      // EXTRUSÃO A PARTIR DE SKETCH
      // ----------------------------------------------------
      case "extrude_sketch": {
        const depth = this.evaluateExpression(p.depth, parameters) || 10;

        const sketchRef = node.references.find((r) => r.kind === "sketch");
        let sketch = sketchRef ? sketches.get(sketchRef.targetId) : undefined;

        if (!sketch && sketches.size > 0) {
          sketch = sketches.values().next().value;
        }

        let faceProfile: CadShape;

        if (sketch && sketch.points.length >= 3 && typeof k.createPolygonFace === "function") {
          const pts2d = sketch.points.map((pt) => ({ x: pt.x, y: pt.y }));
          faceProfile = await k.createPolygonFace(pts2d, `${node.name}_profile`);
        } else if (p.sketchProfile?.points && p.sketchProfile.points.length >= 3 && typeof k.createPolygonFace === "function") {
          faceProfile = await k.createPolygonFace(p.sketchProfile.points, `${node.name}_profile`);
        } else {
          const w = this.evaluateExpression(p.width, parameters) || 200;
          const h = this.evaluateExpression(p.height, parameters) || 150;
          faceProfile = await kernel.createRectangleFace(w, h, `${node.name}_rect`);
        }

        const extruded = await kernel.extrude(faceProfile, 0, 0, depth, node.name);

        if (currentShape && p.operation === "union" && typeof k.fuse === "function") {
          return await k.fuse(currentShape, extruded, node.name);
        } else if (currentShape && p.operation === "cut" && typeof k.cut === "function") {
          return await k.cut(currentShape, extruded, node.name);
        }

        return extruded;
      }

      // ----------------------------------------------------
      // FURO PARAMÉTRICO
      // ----------------------------------------------------
      case "hole_cut": {
        if (!currentShape) {
          throw new Error("Operação de Furo necessita de um corpo sólido precedente");
        }

        const dia = this.evaluateExpression(p.diameter, parameters) || 20;
        const depth = this.evaluateExpression(p.depth, parameters) || 100;
        const radius = dia / 2;

        const posX = this.evaluateExpression(p.position?.x, parameters) || 0;
        const posY = this.evaluateExpression(p.position?.y, parameters) || 0;
        const posZ = this.evaluateExpression(p.position?.z, parameters) || 0;

        const toolCylinder = await kernel.createCylinder(radius, depth, true, "hole_tool");
        let activeTool = toolCylinder;

        if ((posX !== 0 || posY !== 0 || posZ !== 0) && typeof k.translate === "function") {
          activeTool = await k.translate(toolCylinder, posX, posY, posZ);
        }

        if (typeof k.cut === "function") {
          return await k.cut(currentShape, activeTool, node.name);
        }
        return currentShape;
      }

      // ----------------------------------------------------
      // FILETE / CHANFRO
      // ----------------------------------------------------
      case "fillet": {
        if (!currentShape) throw new Error("Filete necessita de um corpo sólido");
        const radius = this.evaluateExpression(p.radius, parameters) || 5;

        let targetEdges: number[] = [];
        if (p.edgeIndices && Array.isArray(p.edgeIndices)) {
          targetEdges = p.edgeIndices;
        } else if (node.references && node.references.length > 0) {
          for (const ref of node.references) {
            const edge = CadReferenceManager.resolveEdge(currentShape, ref);
            if (edge) targetEdges.push(edge.index);
          }
        }

        if (targetEdges.length === 0) targetEdges = [0];
        if (typeof k.fillet === "function") {
          return await k.fillet(currentShape, targetEdges, radius, node.name);
        }
        return currentShape;
      }

      case "chamfer": {
        if (!currentShape) throw new Error("Chanfro necessita de um corpo sólido");
        const dist = this.evaluateExpression(p.distance, parameters) || 5;

        let targetEdges: number[] = [];
        if (p.edgeIndices && Array.isArray(p.edgeIndices)) {
          targetEdges = p.edgeIndices;
        } else if (node.references && node.references.length > 0) {
          for (const ref of node.references) {
            const edge = CadReferenceManager.resolveEdge(currentShape, ref);
            if (edge) targetEdges.push(edge.index);
          }
        }

        if (targetEdges.length === 0) targetEdges = [0];
        if (typeof k.chamfer === "function") {
          return await k.chamfer(currentShape, targetEdges, dist, node.name);
        }
        return currentShape;
      }

      // ----------------------------------------------------
      // MODELOS DE CALDEIRARIA INDUSTRIAL (CALDRA B-REP)
      // ----------------------------------------------------
      case "boilermaking_cone": {
        const D = this.evaluateExpression(p.D, parameters) || 300;
        const d = this.evaluateExpression(p.d, parameters) || 150;
        const h = this.evaluateExpression(p.height, parameters) || 200;
        const t = this.evaluateExpression(p.thickness, parameters) || 3;
        return await CaldraBoilermakingBRep.createTroncoConeBRep(kernel as any, {
          D,
          d,
          height: h,
          thickness: t,
        });
      }

      case "boilermaking_transition": {
        const w = this.evaluateExpression(p.width, parameters) || 300;
        const l = this.evaluateExpression(p.length, parameters) || 300;
        const dia = this.evaluateExpression(p.diameter, parameters) || 200;
        const h = this.evaluateExpression(p.height, parameters) || 250;
        const t = this.evaluateExpression(p.thickness, parameters) || 3;
        return await CaldraBoilermakingBRep.createQuadradoRedondoBRep(kernel as any, {
          width: w,
          length: l,
          diameter: dia,
          height: h,
          thickness: t,
        });
      }

      case "boilermaking_elbow": {
        const dia = this.evaluateExpression(p.diameter, parameters) || 200;
        const r = this.evaluateExpression(p.radius, parameters) || 300;
        const angle = this.evaluateExpression(p.angleDeg, parameters) || 90;
        const segs = this.evaluateExpression(p.segments, parameters) || 4;
        const t = this.evaluateExpression(p.thickness, parameters) || 3;
        return await CaldraBoilermakingBRep.createCurvaGomosBRep(kernel as any, {
          diameter: dia,
          radius: r,
          angleDeg: angle,
          segments: segs,
          thickness: t,
        });
      }

      case "boilermaking_branch": {
        const D = this.evaluateExpression(p.mainDiameter, parameters) || 300;
        const d = this.evaluateExpression(p.branchDiameter, parameters) || 150;
        const l = this.evaluateExpression(p.mainLength, parameters) || 600;
        const h = this.evaluateExpression(p.branchHeight, parameters) || 300;
        const t = this.evaluateExpression(p.thickness, parameters) || 3;
        return await CaldraBoilermakingBRep.createBocaDeLoboBRep(kernel as any, {
          mainDiameter: D,
          branchDiameter: d,
          mainLength: l,
          branchHeight: h,
          thickness: t,
        });
      }

      // ----------------------------------------------------
      // ESTRUTURAS METÁLICAS SOLDADAS (WELDMENTS)
      // ----------------------------------------------------
      case "weldment_beam": {
        return await CaldraWeldmentBridge.generateBeamBRep(kernel as any, p as any);
      }

      case "weldment_frame": {
        return await CaldraWeldmentBridge.generateFrameBRep(kernel as any, p as any);
      }

      default:
        if (currentShape) return currentShape;
        return await kernel.createBox(100, 100, 100, true, node.name);
    }
  }
}
