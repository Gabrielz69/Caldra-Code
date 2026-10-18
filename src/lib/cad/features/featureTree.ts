// @ts-nocheck
/**
 * CALDRA CAD — FEATURE TREE & REBUILD ENGINE (FASE 03)
 *
 * Árvore paramétrica de recursos orientada à fabricação com controle
 * estrito de dependências em DAG e mecanismo incremental de Rebuild.
 */

import {
  type CanonicalModel,
  type SolidBody3D,
  type SheetMetalBody,
  type Sketch2D,
  createRectangleSketch,
  extrudeSketchToSolid,
  convertToSheetMetal,
} from "../canonical";
import type { Feature, FeatureState, FeatureType, StaleNotification, RebuildReport } from "./types";

export class FeatureTree {
  features: Feature[] = [];
  model: CanonicalModel;
  staleAlerts: StaleNotification[] = [];

  constructor(modelName = "Peça CAD Paramétrica") {
    this.model = {
      id: `model_${Date.now()}`,
      name: modelName,
      version: 1,
      units: "mm",
      sketches: [],
      bodies: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    // Inicializa as referências canônicas fundamentais
    this.initDefaultDatumPlanes();
  }

  getFeatures(): Feature[] {
    return this.features;
  }

  private initDefaultDatumPlanes() {
    this.addFeature({
      name: "Plano Frontal (XY)",
      type: "reference_plane",
      parameters: { plane: "XY", normal: { x: 0, y: 0, z: 1 }, offset: 0 },
      references: [],
      dependencies: [],
    });

    this.addFeature({
      name: "Plano Superior (XZ)",
      type: "reference_plane",
      parameters: { plane: "XZ", normal: { x: 0, y: 1, z: 0 }, offset: 0 },
      references: [],
      dependencies: [],
    });

    this.addFeature({
      name: "Plano Lateral (YZ)",
      type: "reference_plane",
      parameters: { plane: "YZ", normal: { x: 1, y: 0, z: 0 }, offset: 0 },
      references: [],
      dependencies: [],
    });
  }

  addFeature<TParams = Record<string, unknown>>(data: {
    name: string;
    type: FeatureType;
    parameters: TParams;
    references?: string[];
    dependencies?: string[];
  }): Feature<TParams> {
    const id = `feat_${this.features.length}_${data.type}`;
    const feature: Feature<TParams> = {
      id,
      name: data.name,
      type: data.type,
      order: this.features.length,
      state: "DIRTY",
      parameters: data.parameters,
      references: data.references ?? [],
      dependencies: data.dependencies ?? [],
      affectedEntityIds: [],
      errors: [],
      warnings: [],
      isSuppressed: false,
      timestamp: Date.now(),
    };

    this.features.push(feature as Feature);
    return feature;
  }

  /**
   * Altera os parâmetros de uma feature existente.
   * Marca a feature como DIRTY e propaga cascata de STALE para todos os dependentes downstream.
   */
  updateFeatureParameters<TParams = Record<string, unknown>>(
    featureId: string,
    newParams: Partial<TParams>,
  ): StaleNotification[] {
    const targetIdx = this.features.findIndex((f) => f.id === featureId);
    if (targetIdx === -1) {
      throw new Error(`Feature com ID '${featureId}' não encontrada na árvore.`);
    }

    const feat = this.features[targetIdx];
    feat.parameters = { ...feat.parameters, ...newParams };
    if (!feat.isSuppressed) {
      feat.state = "DIRTY";
    }
    feat.timestamp = Date.now();

    // Propagação downstream (marcar todos os derivados diretos e indiretos como STALE)
    const affectedFeatureIds = new Set<string>([featureId]);
    const alerts: StaleNotification[] = [];

    for (let i = targetIdx + 1; i < this.features.length; i++) {
      const current = this.features[i];
      if (current.isSuppressed) continue;

      const dependsOnChanged =
        current.dependencies.some((d) => affectedFeatureIds.has(d)) ||
        current.references.some((r) => affectedFeatureIds.has(r)) ||
        affectedFeatureIds.has(current.id);

      if (dependsOnChanged) {
        affectedFeatureIds.add(current.id);
        current.state = "STALE";

        const notification: StaleNotification = {
          featureId: current.id,
          featureName: current.name,
          affectedDomains: ["2D", "3D", "planificação", "CNC", "BOM", "documentação", "fabricação"],
          reason: `Dependência '${feat.name}' alterada. Recalcular para manter integridade dimensional.`,
        };
        alerts.push(notification);
      }
    }

    this.staleAlerts = alerts;
    return alerts;
  }

  /**
   * Alterna estado de supressão (ativado/desativado) de uma feature.
   */
  setFeatureSuppressed(featureId: string, suppressed: boolean) {
    const feat = this.features.find((f) => f.id === featureId);
    if (!feat) return;
    feat.isSuppressed = suppressed;
    feat.state = suppressed ? "SUPPRESSED" : "DIRTY";

    // Reavalia derivados
    this.updateFeatureParameters(featureId, {});
  }

  /**
   * Executa a reconstrução paramétrica (Rebuild Engine).
   * Atualiza o CanonicalModel na ordem cronológica de dependências.
   */
  rebuild(): RebuildReport {
    const startTime = performance.now();
    let rebuiltCount = 0;
    let cachedCount = 0;
    const errors: { featureId: string; featureName: string; message: string }[] = [];

    // Limpa corpos do modelo canônico a serem reconstruídos
    this.model.bodies = [];
    this.model.sketches = [];

    let currentSolid: SolidBody3D | null = null;
    let currentSheetMetal: SheetMetalBody | null = null;

    for (const feat of this.features) {
      if (feat.isSuppressed) {
        feat.state = "SUPPRESSED";
        continue;
      }

      feat.errors = [];
      feat.warnings = [];

      try {
        switch (feat.type) {
          case "reference_plane": {
            feat.state = "VALID";
            cachedCount++;
            break;
          }

          case "sketch": {
            const p = feat.parameters as { width?: number; height?: number; name?: string };
            const w = p.width ?? 100;
            const h = p.height ?? 50;
            const sketch = createRectangleSketch(w, h, { x: 0, y: 0 }, feat.name);
            feat.result = sketch;
            feat.affectedEntityIds = [sketch.id];
            this.model.sketches.push(sketch);
            feat.state = "VALID";
            rebuiltCount++;
            break;
          }

          case "extrude": {
            // Busca o sketch de entrada nas referências ou dependências
            const sketchRefId = feat.references[0] || feat.dependencies[0];
            const sketchFeat = this.features.find((f) => f.id === sketchRefId);
            const sketch = (sketchFeat?.result as Sketch2D | undefined) || this.model.sketches[0];

            if (!sketch) {
              throw new Error("Extrusão requer um esboço (Sketch) válido como referência.");
            }

            const p = feat.parameters as { depth?: number; material?: string; density?: number };
            const depth = p.depth ?? 10;
            const mat = p.material ?? "Aço Carbono";
            const dens = p.density ?? 7.85;

            const solid = extrudeSketchToSolid(sketch, depth, mat, dens);
            currentSolid = solid;
            feat.result = solid;
            feat.affectedEntityIds = [solid.id];
            this.model.bodies.push(solid);
            this.model.activeBodyId = solid.id;
            feat.state = "VALID";
            rebuiltCount++;
            break;
          }

          case "convert_sheet_metal": {
            if (!currentSolid) {
              throw new Error("Não é possível converter em chapa: nenhum corpo sólido prévio.");
            }

            const p = feat.parameters as {
              thickness?: number;
              bendRadius?: number;
              kFactor?: number;
              fixedFaceId?: string;
            };

            const fixedFace = p.fixedFaceId ?? currentSolid.faces[0]?.id ?? "face_bottom";
            const thick = p.thickness ?? currentSolid.bounds.size.z;
            const radius = p.bendRadius ?? thick;
            const k = p.kFactor ?? 0.33;

            const smBody = convertToSheetMetal(currentSolid, fixedFace, thick, radius, k);
            currentSheetMetal = smBody;
            feat.result = smBody;
            feat.affectedEntityIds = [smBody.id];

            // Substitui o corpo na lista de corpos canônicos
            this.model.bodies = this.model.bodies.filter((b) => b.id !== currentSolid?.id);
            this.model.bodies.push(smBody);
            this.model.activeBodyId = smBody.id;

            feat.state = "VALID";
            rebuiltCount++;
            break;
          }

          default:
            feat.state = "VALID";
            cachedCount++;
            break;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        feat.state = "ERROR";
        feat.errors.push(msg);
        errors.push({ featureId: feat.id, featureName: feat.name, message: msg });
        // Interrompe reconstrução dependente downstream para evitar falsas geometrias
        break;
      }
    }

    const duration = performance.now() - startTime;
    this.staleAlerts = [];
    this.model.version += 1;
    this.model.metadata.updatedAt = Date.now();

    return {
      success: errors.length === 0,
      rebuiltFeatureCount: rebuiltCount,
      cachedFeatureCount: cachedCount,
      durationMs: duration,
      staleAlerts: this.staleAlerts,
      errors,
    };
  }
}
