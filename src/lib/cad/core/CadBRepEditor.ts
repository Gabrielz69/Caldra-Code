/**
 * CALDRA CAD — CAD B-REP EDITOR & COMMAND DISPATCHER (FASE 06)
 *
 * Camada de comando e orquestração de edição paramétrica B-Rep.
 * Conecta a interação do usuário na interface 3D e no Gizmo ao motor analítico
 * do OpenCascade (OCCT), garantindo reconstrução geométrica determinística real.
 *
 * Respeita a regra fundamental da CALDRA:
 * NUNCA aplicar apenas transformações visuais (mesh.position/scale).
 * Toda alteração modifica os parâmetros da geometria no CAD CORE e reconstrói o B-Rep.
 */

import { CadFeatureTree } from "../features/CadFeatureTree";
import type { CadFeature, CadFeatureType } from "../features/types";
import type { CadSelectedEntity } from "./CadSelection";

export interface CadEditSnapshot {
  featuresJson: string;
  rollbackIndex: number;
  timestamp: number;
}

export class CadBRepEditor {
  private tree: CadFeatureTree;
  private undoStack: CadEditSnapshot[] = [];
  private redoStack: CadEditSnapshot[] = [];
  private maxHistory = 30;

  constructor(tree: CadFeatureTree) {
    this.tree = tree;
  }

  /** Cria snapshot imutável do estado atual da árvore */
  private createSnapshot(): CadEditSnapshot {
    return {
      featuresJson: JSON.stringify(
        this.tree.getFeatures().map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          parameters: f.parameters,
          isSuppressed: f.isSuppressed,
        })),
      ),
      rollbackIndex: this.tree.getRollbackIndex(),
      timestamp: Date.now(),
    };
  }

  /** Registra um ponto de restauração antes de uma nova mutação */
  public pushUndo(): void {
    this.undoStack.push(this.createSnapshot());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Nova ação invalida histórico de redo futuro
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Desfaz a última alteração geométrica */
  public async undo(): Promise<boolean> {
    if (!this.canUndo()) return false;

    // Guarda o estado atual no redoStack para poder refazer
    this.redoStack.push(this.createSnapshot());

    const target = this.undoStack.pop()!;
    await this.restoreSnapshot(target);
    return true;
  }

  /** Refaz a alteração desfeita */
  public async redo(): Promise<boolean> {
    if (!this.canRedo()) return false;

    // Guarda o estado atual no undoStack para poder desfazer novamente
    this.undoStack.push(this.createSnapshot());

    const target = this.redoStack.pop()!;
    await this.restoreSnapshot(target);
    return true;
  }

  private async restoreSnapshot(snapshot: CadEditSnapshot): Promise<void> {
    const rawFeatures = JSON.parse(snapshot.featuresJson) as CadFeature[];
    this.tree.dispose();

    for (const f of rawFeatures) {
      const added = this.tree.addFeature({
        name: f.name,
        type: f.type,
        parameters: f.parameters,
      });
      if (f.isSuppressed) {
        this.tree.setSuppressed(added.id, true);
      }
    }
    this.tree.setRollbackIndex(snapshot.rollbackIndex);
    await this.tree.rebuild();
  }

  /**
   * EDIÇÃO VIA GIZMO (Seção 15 do Requisito Industrial):
   * Exemplo: Selecionar Face Superior (Z+) e arrastar de 50 mm para 70 mm (+20 mm).
   * Atualiza a altura do bloco base diretamente e reconstrói o sólido analítico.
   */
  public async applyFacePushPull(
    faceIndex: number,
    delta: { x: number; y: number; z: number },
    normal?: { x: number; y: number; z: number },
  ): Promise<boolean> {
    const features = this.tree.getFeatures();
    const baseBox = features.find((f) => f.type === "base_box");

    this.pushUndo();

    if (baseBox) {
      const p = { ...(baseBox.parameters as { width: number; length: number; height: number }) };

      // Se a face for predominantemente Z+ ou Z-
      if (normal && Math.abs(normal.z) > 0.7) {
        const change = normal.z > 0 ? delta.z : -delta.z;
        p.height = Math.max(1, p.height + change);
      } else if (normal && Math.abs(normal.x) > 0.7) {
        const change = normal.x > 0 ? delta.x : -delta.x;
        p.width = Math.max(1, p.width + change);
      } else if (normal && Math.abs(normal.y) > 0.7) {
        const change = normal.y > 0 ? delta.y : -delta.y;
        p.length = Math.max(1, p.length + change);
      } else {
        // Sem normal explícita, aplica a maior componente euclidiana
        if (Math.abs(delta.z) >= Math.abs(delta.x) && Math.abs(delta.z) >= Math.abs(delta.y)) {
          p.height = Math.max(1, p.height + delta.z);
        } else if (Math.abs(delta.x) >= Math.abs(delta.y)) {
          p.width = Math.max(1, p.width + delta.x);
        } else {
          p.length = Math.max(1, p.length + delta.y);
        }
      }

      this.tree.updateFeature(baseBox.id, p);
      await this.tree.rebuild();
      return true;
    } else {
      // Adiciona uma transformação espacial no sólido
      this.tree.addFeature({
        name: `Deslocamento Face #${faceIndex}`,
        type: "transform",
        parameters: { dx: delta.x, dy: delta.y, dz: delta.z },
      });
      await this.tree.rebuild();
      return true;
    }
  }

  /**
   * APLICAÇÃO DE FILETE (Arredondamento / Concordância)
   * Adiciona ou atualiza operação de concordância nas arestas selecionadas
   */
  public async applyFillet(edgeIndices: number[], radius: number): Promise<boolean> {
    if (edgeIndices.length === 0 || radius <= 0) return false;
    this.pushUndo();

    this.tree.addFeature({
      name: `Filete R${radius} mm (${edgeIndices.length} arestas)`,
      type: "fillet",
      parameters: { radius, edgeIndices },
    });

    await this.tree.rebuild();
    return true;
  }

  /**
   * APLICAÇÃO DE CHANFRO (Quebra de canto linear)
   */
  public async applyChamfer(edgeIndices: number[], distance: number): Promise<boolean> {
    if (edgeIndices.length === 0 || distance <= 0) return false;
    this.pushUndo();

    this.tree.addFeature({
      name: `Chanfro ${distance} mm (${edgeIndices.length} arestas)`,
      type: "chamfer",
      parameters: { distance, edgeIndices },
    });

    await this.tree.rebuild();
    return true;
  }

  /**
   * ADIÇÃO DE FURO CILÍNDRICO (Hole Cut)
   * Aplica furo em posição tridimensional com diâmetro e profundidade configuráveis
   */
  public async addHole(
    diameter: number,
    depth: number,
    position: { x: number; y: number; z: number },
    isThrough = true,
  ): Promise<boolean> {
    if (diameter <= 0 || depth <= 0) return false;
    this.pushUndo();

    this.tree.addFeature({
      name: `Furo Ø${diameter} mm`,
      type: "hole_cut",
      parameters: {
        diameter,
        depth,
        position,
        isThrough,
      },
    });

    await this.tree.rebuild();
    return true;
  }

  /**
   * ALTERAÇÃO DE ESPESSURA DE CHAPA (CALDEIRARIA)
   */
  public async setSheetThickness(newThickness: number): Promise<boolean> {
    if (newThickness <= 0) return false;
    const features = this.tree.getFeatures();
    const baseBox = features.find((f) => f.type === "base_box");

    if (baseBox) {
      this.pushUndo();
      const p = { ...(baseBox.parameters as { width: number; length: number; height: number }) };
      p.height = newThickness;
      this.tree.updateFeature(baseBox.id, p);
      await this.tree.rebuild();
      return true;
    }
    return false;
  }
}
