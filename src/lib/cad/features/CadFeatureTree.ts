/**
 * CALDRA CAD CORE — DETERMINISTIC PARAMETRIC FEATURE TREE (FASE 05)
 *
 * Motor de modelagem paramétrica orientado a recursos conectado ao OCCT WASM.
 * Implementa pipeline determinístico de avaliação (DAG), dirty tracking,
 * rollback de histórico, supressão de recursos e cache de geometria intermediária.
 */

import { getCadKernel } from "../core";
import type { ICadKernel } from "../core/CadKernel";
import type { CadShape } from "../core/CadShape";
import type {
  CadFeatureNode,
  CadFeatureParams,
  CadFeatureType,
  CadTreeRebuildResult,
  BaseBoxParams,
  BaseCylinderParams,
  HoleCutParams,
  FilletParams,
  ChamferParams,
  TransformParams,
  ExtrudeSketchParams,
  BoilermakingConeParams,
  BoilermakingTransitionParams,
  BoilermakingElbowParams,
  BoilermakingBranchParams,
  BoilermakingHoodParams,
  WeldmentBeamParams,
  WeldmentFrameParams,
} from "./CadFeatureModel";
import { CaldraBoilermakingBRep } from "../boilermaking/CaldraBoilermakingBRep";
import { CaldraWeldmentBridge } from "../weldments/CaldraWeldmentBridge";

export class CadFeatureTree {
  private features: CadFeatureNode[] = [];
  private kernel: ICadKernel;
  private rollbackIndex: number = -1; // -1 = avalia até a última feature
  private activeFinalShape: CadShape | null = null;

  constructor(kernel?: ICadKernel) {
    this.kernel = kernel ?? getCadKernel();
  }

  // ==========================================
  // CONSULTA E GESTÃO DE RECURSOS
  // ==========================================

  public getFeatures(): readonly CadFeatureNode[] {
    return this.features;
  }

  public getFeature(id: string): CadFeatureNode | undefined {
    return this.features.find((f) => f.id === id);
  }

  public getRollbackIndex(): number {
    return this.rollbackIndex;
  }

  public setRollbackIndex(index: number): void {
    const clamped = Math.max(-1, Math.min(index, this.features.length - 1));
    if (this.rollbackIndex !== clamped) {
      this.rollbackIndex = clamped;
      // Marca tudo a partir do novo índice como necessitando reavaliação se necessário
    }
  }

  public addFeature(
    data: {
      name: string;
      type: CadFeatureType;
      parameters: CadFeatureParams;
      dependencies?: string[];
      references?: string[];
      isSuppressed?: boolean;
    },
    insertAfterId?: string,
  ): CadFeatureNode {
    const id = `feat_${data.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newNode: CadFeatureNode = {
      id,
      name: data.name,
      type: data.type,
      order: this.features.length,
      state: "DIRTY",
      isSuppressed: data.isSuppressed ?? false,
      parameters: { ...data.parameters },
      dependencies: data.dependencies ? [...data.dependencies] : [],
      references: data.references ? [...data.references] : [],
    };

    if (insertAfterId) {
      const idx = this.features.findIndex((f) => f.id === insertAfterId);
      if (idx >= 0) {
        this.features.splice(idx + 1, 0, newNode);
        this.reindexOrders();
        this.markDirtyFrom(idx + 1);
        return newNode;
      }
    }

    this.features.push(newNode);
    this.reindexOrders();
    this.markDirtyFrom(this.features.length - 1);
    return newNode;
  }

  public updateFeature(id: string, params: Partial<CadFeatureParams>): void {
    const idx = this.features.findIndex((f) => f.id === id);
    if (idx < 0) return;

    const node = this.features[idx]!;
    node.parameters = { ...node.parameters, ...params };
    node.state = "DIRTY";
    this.markDirtyFrom(idx);
  }

  public setFeatureSuppression(id: string, isSuppressed: boolean): void {
    const idx = this.features.findIndex((f) => f.id === id);
    if (idx < 0) return;

    const node = this.features[idx]!;
    if (node.isSuppressed !== isSuppressed) {
      node.isSuppressed = isSuppressed;
      node.state = isSuppressed ? "SUPPRESSED" : "DIRTY";
      this.markDirtyFrom(idx);
    }
  }

  public deleteFeature(id: string): void {
    const idx = this.features.findIndex((f) => f.id === id);
    if (idx < 0) return;

    const removed = this.features.splice(idx, 1)[0]!;
    if (removed.cachedShape) {
      try {
        this.kernel.release(removed.cachedShape);
      } catch {
        // Ignora se já liberado
      }
    }

    this.reindexOrders();
    this.markDirtyFrom(idx);
  }

  public reorderFeature(id: string, targetIndex: number): void {
    const currentIndex = this.features.findIndex((f) => f.id === id);
    if (currentIndex < 0) return;

    const clampedTarget = Math.max(0, Math.min(targetIndex, this.features.length - 1));
    if (currentIndex === clampedTarget) return;

    const [item] = this.features.splice(currentIndex, 1);
    if (item) {
      this.features.splice(clampedTarget, 0, item);
      this.reindexOrders();
      this.markDirtyFrom(Math.min(currentIndex, clampedTarget));
    }
  }

  private reindexOrders(): void {
    for (let i = 0; i < this.features.length; i++) {
      this.features[i]!.order = i;
    }
  }

  private markDirtyFrom(startIndex: number): void {
    for (let i = startIndex; i < this.features.length; i++) {
      const f = this.features[i]!;
      if (!f.isSuppressed) {
        f.state = "DIRTY";
      }
    }
  }

  // ==========================================
  // RECONSTRUÇÃO DETERMINÍSTICA DO MODELO (REBUILD)
  // ==========================================

  public async rebuild(): Promise<CadTreeRebuildResult> {
    const startTime = performance.now();
    let rebuiltCount = 0;
    let cachedCount = 0;

    if (!this.kernel.isInitialized) {
      await this.kernel.init();
    }

    // Determina o limite de avaliação de acordo com a barra de Rollback
    const effectiveLimit =
      this.rollbackIndex >= 0 ? Math.min(this.rollbackIndex + 1, this.features.length) : this.features.length;

    let currentShape: CadShape | null = null;

    try {
      for (let i = 0; i < effectiveLimit; i++) {
        const feature = this.features[i]!;

        // Se o recurso estiver suprimido, apenas mantém o estado anterior
        if (feature.isSuppressed) {
          feature.state = "SUPPRESSED";
          continue;
        }

        // Se ainda não temos um sólido ativo:
        if (!currentShape) {
          if (
            feature.type === "base_box" ||
            feature.type === "base_cylinder" ||
            feature.type === "extrude_sketch" ||
            feature.type === "boilermaking_cone" ||
            feature.type === "boilermaking_transition" ||
            feature.type === "boilermaking_elbow" ||
            feature.type === "boilermaking_branch" ||
            feature.type === "boilermaking_hood" ||
            feature.type === "weldment_beam" ||
            feature.type === "weldment_frame"
          ) {
            try {
              currentShape = await this.evaluateFeature(feature, null);
              feature.cachedShape = currentShape;
              feature.state = "VALID";
              feature.errorMessage = undefined;
              rebuiltCount++;
            } catch (err: unknown) {
              feature.state = "ERROR";
              feature.errorMessage = err instanceof Error ? err.message : String(err);
            }
            continue;
          } else {
            // Recurso modificador (hole_cut, fillet, chamfer) sem sólido base prévio.
            // Provisiona uma caixa sólida de apoio para permitir a modelagem sem quebrar a árvore.
            try {
              currentShape = await this.kernel.createBox(100, 100, 50, true, "Caixa Base Suporte");
              const nextShape = await this.evaluateFeature(feature, currentShape);
              if (nextShape) {
                currentShape = nextShape;
                feature.cachedShape = nextShape;
                feature.state = "VALID";
                feature.errorMessage = undefined;
                rebuiltCount++;
              }
            } catch (err: unknown) {
              feature.state = "ERROR";
              feature.errorMessage = err instanceof Error ? err.message : String(err);
              console.warn(`[CadFeatureTree] Recurso '${feature.name}' requer sólido base:`, feature.errorMessage);
            }
            continue;
          }
        }

        // Se a feature não estiver DIRTY e tiver cache válido reutilizável
        // Para nós subsequentes, se os nós anteriores não foram recalculados, podemos aproveitar
        if (feature.state === "VALID" && feature.cachedShape) {
          currentShape = feature.cachedShape;
          cachedCount++;
          continue;
        }

        // Avalia a operação contra o sólido acumulado
        try {
          const nextShape = await this.evaluateFeature(feature, currentShape);

          // Se produziu novo sólido, substitui
          if (nextShape) {
            currentShape = nextShape;
            feature.cachedShape = nextShape;
            feature.state = "VALID";
            feature.errorMessage = undefined;
            rebuiltCount++;
          }
        } catch (featErr: unknown) {
          feature.state = "ERROR";
          feature.errorMessage = featErr instanceof Error ? featErr.message : String(featErr);
          console.warn(`[CadFeatureTree] Recurso '${feature.name}' falhou:`, feature.errorMessage);
          // O sólido acumulado anterior permanece ativo
        }
      }

      this.activeFinalShape = currentShape;

      if (!currentShape) {
        const firstError = this.features.find((f) => f.state === "ERROR");
        const errMsg = firstError?.errorMessage || "Nenhum sólido B-Rep válido foi gerado a partir dos recursos.";
        return {
          success: false,
          activeShape: null,
          tessellation: null,
          massProperties: null,
          features: [...this.features],
          rebuiltCount,
          cachedCount,
          durationMs: performance.now() - startTime,
          error: errMsg,
        };
      }

      // Extrai a tesselação e massa do sólido ativo
      const [tess, mass] = await Promise.all([
        this.kernel.tessellate(currentShape, { linearDeflection: 0.1, angularDeflection: 0.4 }),
        this.kernel.getMassProperties(currentShape, 7.85),
      ]);

      const durationMs = performance.now() - startTime;

      return {
        success: true,
        activeShape: currentShape,
        tessellation: tess,
        massProperties: mass,
        features: [...this.features],
        rebuiltCount,
        cachedCount,
        durationMs,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[CadFeatureTree] Erro durante o Rebuild:", err);

      return {
        success: false,
        activeShape: currentShape,
        tessellation: null,
        massProperties: null,
        features: [...this.features],
        rebuiltCount,
        cachedCount,
        durationMs: performance.now() - startTime,
        error: errMsg,
      };
    }
  }

  // ==========================================
  // DISPATCHER DE EXECUÇÃO DE OPERAÇÃO CAD
  // ==========================================

  private async evaluateFeature(
    node: CadFeatureNode,
    inputSolid: CadShape | null,
  ): Promise<CadShape> {
    switch (node.type) {
      case "base_box": {
        const p = node.parameters as BaseBoxParams;
        return await this.kernel.createBox(
          Math.max(1, p.width),
          Math.max(1, p.length),
          Math.max(1, p.height),
          p.centered ?? true,
          node.name,
        );
      }

      case "base_cylinder": {
        const p = node.parameters as BaseCylinderParams;
        return await this.kernel.createCylinder(
          Math.max(0.5, p.radius),
          Math.max(0.5, p.height),
          p.centered ?? true,
          node.name,
        );
      }

      case "hole_cut": {
        const solid = inputSolid ?? (await this.kernel.createBox(100, 100, 50, true, "Caixa Base"));
        const p = node.parameters as HoleCutParams;
        const radius = Math.max(0.2, p.diameter / 2);
        const depth = Math.max(0.5, p.depth);

        // Cria ferramenta cilíndrica de corte
        const toolHeight = depth + 20;
        const toolCylinder = await this.kernel.createCylinder(
          radius,
          toolHeight,
          true,
          "HoleTool",
        );

        // Desloca para a posição especificada
        const px = p.position?.x ?? 0;
        const py = p.position?.y ?? 0;
        const pz = p.position?.z ?? 0;

        const positionedTool = await this.kernel.translate(
          toolCylinder,
          px,
          py,
          pz,
        );
        this.kernel.release(toolCylinder);

        // Executa o corte booleano
        const result = await this.kernel.cut(solid, positionedTool, node.name);
        this.kernel.release(positionedTool);
        return result;
      }

      case "fillet": {
        const solid = inputSolid ?? (await this.kernel.createBox(100, 100, 50, true, "Caixa Base"));
        const p = node.parameters as FilletParams;
        const radius = Math.max(0.1, p.radius);
        const edges = p.edgeIndices?.length > 0 ? p.edgeIndices : [0];
        return await this.kernel.fillet(solid, radius, edges, node.name);
      }

      case "chamfer": {
        const solid = inputSolid ?? (await this.kernel.createBox(100, 100, 50, true, "Caixa Base"));
        const p = node.parameters as ChamferParams;
        const distance = Math.max(0.1, p.distance);
        const edges = p.edgeIndices?.length > 0 ? p.edgeIndices : [0];
        return await this.kernel.chamfer(solid, distance, edges, node.name);
      }

      case "transform": {
        if (!inputSolid) {
          throw new Error("Transform requer um sólido de suporte.");
        }
        const p = node.parameters as TransformParams;
        let res = inputSolid;
        if (p.dx !== 0 || p.dy !== 0 || p.dz !== 0) {
          res = await this.kernel.translate(res, p.dx, p.dy, p.dz);
        }
        return res;
      }

      case "extrude_sketch": {
        const p = node.parameters as ExtrudeSketchParams;
        const depth = Math.max(0.1, p.depth);

        // Se fornecido perfil com pontos, cria o prisma
        if (p.sketchProfile?.points && p.sketchProfile.points.length >= 3) {
          const pts = p.sketchProfile.points;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const pt of pts) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          }
          const w = Math.max(1, maxX - minX);
          const l = Math.max(1, maxY - minY);
          const extruded = await this.kernel.createBox(w, l, depth, !p.symmetric, node.name);

          if (inputSolid) {
            if (p.operation === "cut") {
              return await this.kernel.cut(inputSolid, extruded, node.name);
            } else if (p.operation === "union") {
              return await this.kernel.fuse(inputSolid, extruded, node.name);
            }
          }
          return extruded;
        }

        // Parâmetros de largura/comprimento explícitos ou dimensões padrão
        const w = Math.max(1, (p as unknown as { width?: number }).width ?? 120);
        const l = Math.max(1, (p as unknown as { length?: number }).length ?? 100);
        const extruded = await this.kernel.createBox(w, l, depth, true, node.name);
        if (inputSolid && p.operation === "union") {
          return await this.kernel.fuse(inputSolid, extruded, node.name);
        }
        return extruded;
      }

      case "boilermaking_cone": {
        const p = node.parameters as unknown as BoilermakingConeParams;
        return await CaldraBoilermakingBRep.createTruncatedCone(p);
      }

      case "boilermaking_transition": {
        const p = node.parameters as unknown as BoilermakingTransitionParams;
        return await CaldraBoilermakingBRep.createSquareToRound(p);
      }

      case "boilermaking_elbow": {
        const p = node.parameters as unknown as BoilermakingElbowParams;
        return await CaldraBoilermakingBRep.createSegmentedElbow(p);
      }

      case "boilermaking_branch": {
        const p = node.parameters as unknown as BoilermakingBranchParams;
        return await CaldraBoilermakingBRep.createCylindricalBranch(p);
      }

      case "boilermaking_hood": {
        const p = node.parameters as unknown as BoilermakingHoodParams;
        return await CaldraBoilermakingBRep.createConicalHood(p);
      }

      case "weldment_beam": {
        const p = node.parameters as unknown as WeldmentBeamParams;
        return await CaldraWeldmentBridge.createStructuralBeam(p);
      }

      case "weldment_frame": {
        const p = node.parameters as unknown as WeldmentFrameParams;
        return await CaldraWeldmentBridge.createStructuralFrame(p);
      }

      default:
        if (inputSolid) return inputSolid;
        throw new Error(`Tipo de recurso desconhecido: ${String(node.type)}`);
    }
  }

  // ==========================================
  // INTEGRAÇÃO COM CAD DOCUMENT PARAMÉTRICO
  // ==========================================

  public async toCadDocument(docName = "Modelo_Parametrico"): Promise<any> {
    const { CadDocument } = await import("../document/CadDocument");
    const doc = new CadDocument({ name: docName, kernel: this.kernel });
    for (const f of this.features) {
      doc.addFeature({
        name: f.name,
        type: f.type,
        parameters: f.parameters,
        dependencies: f.dependencies,
      });
    }
    return doc;
  }

  // ==========================================
  // DISPOSE
  // ==========================================

  public dispose(): void {
    for (const f of this.features) {
      if (f.cachedShape) {
        try {
          this.kernel.release(f.cachedShape);
        } catch {
          // Ignora
        }
        f.cachedShape = undefined;
      }
    }
    this.features = [];
    this.activeFinalShape = null;
  }
}
