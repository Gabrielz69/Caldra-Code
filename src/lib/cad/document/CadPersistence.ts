/**
 * CALDRA CHAMFER — FORMATO NATIVO DE PERSISTÊNCIA CAD (.chamfer / JSON)
 *
 * Salva a intenção paramétrica completa:
 * - Histórico e árvore de operações (FeatureGraph)
 * - Parâmetros e fórmulas
 * - Referências topológicas
 * - Unidades e materiais
 * - Esboços (sketches) e restrições
 * - Corpos (bodies)
 * - Snapshots B-Rep analíticos (STEP / BREP) opcionais para carregamento ultrarrápido
 * - Metadados de engenharia
 */

import type { CadDocumentSerialized } from "./types";
import type { CadDocument } from "./CadDocument";
import type { ICadKernel } from "../core/CadKernel";
import { getCadKernel } from "../core";

export class CadPersistence {
  public static readonly FILE_EXTENSION = ".chamfer";
  public static readonly MIME_TYPE = "application/vnd.caldra.chamfer+json";
  public static readonly CURRENT_SCHEMA_VERSION = "1.0.0";

  /**
   * Serializa um CadDocument para o formato nativo JSON do CHAMFER
   */
  public static serialize(
    doc: CadDocument,
    options?: {
      includeBRepSnapshot?: boolean;
      includeTessellationSnapshot?: boolean;
    },
  ): CadDocumentSerialized {
    const rawDoc: CadDocumentSerialized = {
      metadata: {
        format: "CALDRA_CHAMFER_CAD",
        schemaVersion: this.CURRENT_SCHEMA_VERSION,
        title: doc.name,
        revision: doc.revision,
        createdAt: doc.createdAt,
        updatedAt: Date.now(),
        notes: doc.notes,
      },
      units: doc.getUnits(),
      materials: {
        activeMaterialId: doc.getActiveMaterial().id,
        catalog: doc.getMaterialsCatalog(),
      },
      parameters: doc.getAllParameters(),
      sketches: doc.getAllSketches(),
      features: doc.featureGraph.getAllNodes().map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        order: node.order,
        isSuppressed: node.isSuppressed,
        parameters: { ...node.parameters },
        references: [...node.references],
        dependencies: [...node.dependencies],
        targetBodyId: node.targetBodyId,
      })),
      bodies: doc.getAllBodies().map((body) => ({
        id: body.id,
        name: body.name,
        type: body.type,
        isVisible: body.isVisible,
        color: body.color,
        opacity: body.opacity,
        featureIds: [...body.featureIds],
      })),
    };

    // Snapshot opcional de malha visual para pré-visualização instantânea sem OCCT
    if (options?.includeTessellationSnapshot) {
      const primaryBody = doc.getPrimaryBody();
      if (primaryBody?.tessellationCache) {
        rawDoc.tessellationSnapshot = primaryBody.tessellationCache;
      }
    }

    return rawDoc;
  }

  /**
   * Exporta para string JSON formatada
   */
  public static exportToJson(
    doc: CadDocument,
    options?: {
      includeBRepSnapshot?: boolean;
      includeTessellationSnapshot?: boolean;
      pretty?: boolean;
    },
  ): string {
    const serialized = this.serialize(doc, options);
    return JSON.stringify(serialized, null, options?.pretty ? 2 : undefined);
  }

  /**
   * Converte para Blob para download de arquivo .chamfer
   */
  public static exportToBlob(
    doc: CadDocument,
    options?: { pretty?: boolean },
  ): Blob {
    const json = this.exportToJson(doc, options);
    return new Blob([json], { type: this.MIME_TYPE });
  }

  /**
   * Desserializa dados JSON no formato nativo para um novo CadDocument
   */
  public static async deserialize(
    jsonStringOrObject: string | CadDocumentSerialized,
    kernel?: ICadKernel,
    autoRebuild = true,
  ): Promise<CadDocument> {
    const data: CadDocumentSerialized =
      typeof jsonStringOrObject === "string"
        ? JSON.parse(jsonStringOrObject)
        : jsonStringOrObject;

    if (!data.metadata || data.metadata.format !== "CALDRA_CHAMFER_CAD") {
      throw new Error("Formato de arquivo incompatível: esperado CALDRA_CHAMFER_CAD");
    }

    // Lazy import para evitar dependência cíclica
    const { CadDocument } = await import("./CadDocument");
    const activeKernel = kernel ?? getCadKernel();
    const doc = new CadDocument({
      name: data.metadata.title,
      units: data.units,
      kernel: activeKernel,
    });

    doc.revision = data.metadata.revision || "1.0";
    doc.notes = data.metadata.notes;

    // 1. Materiais
    if (data.materials?.catalog) {
      for (const mat of data.materials.catalog) {
        doc.addMaterial(mat);
      }
      if (data.materials.activeMaterialId) {
        doc.setActiveMaterial(data.materials.activeMaterialId);
      }
    }

    // 2. Parâmetros
    if (data.parameters) {
      for (const param of data.parameters) {
        doc.setParameter(param);
      }
    }

    // 3. Sketches
    if (data.sketches) {
      for (const sketch of data.sketches) {
        doc.addSketch(sketch);
      }
    }

    // 4. Features no Grafo
    if (data.features) {
      for (const feat of data.features) {
        doc.featureGraph.addFeature({
          id: feat.id,
          name: feat.name,
          type: feat.type,
          parameters: feat.parameters,
          references: feat.references,
          dependencies: feat.dependencies,
          targetBodyId: feat.targetBodyId,
          isSuppressed: feat.isSuppressed,
        });
      }
    }

    // 5. Corpos
    if (data.bodies) {
      for (const bodyData of data.bodies) {
        doc.addBody({
          id: bodyData.id,
          name: bodyData.name,
          type: bodyData.type,
          isVisible: bodyData.isVisible,
          color: bodyData.color,
          opacity: bodyData.opacity,
          bRepShape: null,
          tessellationCache: null,
          featureIds: bodyData.featureIds,
        });
      }
    }

    // 6. Regeneração B-Rep para reconstruir os sólidos analíticos se solicitado
    if (autoRebuild && doc.featureGraph.size() > 0) {
      await doc.rebuild();
    }

    return doc;
  }
}
