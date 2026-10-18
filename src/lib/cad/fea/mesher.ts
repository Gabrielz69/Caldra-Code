/**
 * CALDRA CAD — GERADOR DE MALHAS ESTRUTURAIS 2D CST / SHELL (FASE 15)
 *
 * Discretização geométrica da chapa metálica ou estrutura de caldeiraria
 * em elementos triangulares de deformação constante (CST - Constant Strain Triangles).
 */

import type { PartDocument } from "../kernel/types";
import type { FeaMesh, FeaNode, FeaElement, FeaSimulationOptions } from "./types";
import { bbox } from "@/lib/lab2d/core";

export class FeaMesher {
  /**
   * Gera a malha de elementos finitos a partir do documento da peça
   */
  static generateMesh(doc: PartDocument, options?: FeaSimulationOptions): FeaMesh {
    const thickness = Math.max(doc.thickness || 3, 0.5);
    const refinement = options?.meshRefinement || "MEDIUM";

    // 1. Determina as dimensões da peça
    let minX = 0;
    let maxX = 300;
    let minY = 0;
    let maxY = 150;

    if (doc.entities2D && doc.entities2D.length > 0) {
      const b = bbox(doc.entities2D);
      if (Number.isFinite(b.minX) && Number.isFinite(b.maxX) && b.maxX > b.minX) {
        minX = b.minX;
        maxX = b.maxX;
        minY = b.minY;
        maxY = b.maxY;
      }
    } else if (doc.baseWidth && doc.baseLength) {
      minX = 0;
      maxX = doc.baseLength;
      minY = 0;
      maxY = doc.baseWidth;
    }

    const width = Math.max(maxX - minX, 10);
    const height = Math.max(maxY - minY, 10);

    // 2. Define densidade da grade de acordo com o refinamento
    let nx = 12;
    let ny = 6;
    if (refinement === "COARSE") {
      nx = 8;
      ny = 4;
    } else if (refinement === "FINE") {
      nx = 20;
      ny = 10;
    }

    // Identifica se há furos na geometria 2D
    const holes: { cx: number; cy: number; r: number }[] = [];
    if (doc.entities2D) {
      for (const e of doc.entities2D) {
        if (e.type === "circle" && e.r > 2) {
          holes.push({ cx: e.cx, cy: e.cy, r: e.r });
        }
      }
    }

    const dx = width / nx;
    const dy = height / ny;

    const nodes: FeaNode[] = [];
    const elements: FeaElement[] = [];
    const nodeGrid: (number | null)[][] = [];

    let nodeIdCounter = 1;

    // 3. Criação dos Nós
    for (let j = 0; j <= ny; j++) {
      nodeGrid[j] = [];
      const y = minY + j * dy;

      for (let i = 0; i <= nx; i++) {
        const x = minX + i * dx;

        // Verifica se o nó cai estritamente dentro de um furo circular
        let insideHole = false;
        for (const h of holes) {
          const distSq = (x - h.cx) ** 2 + (y - h.cy) ** 2;
          if (distSq < (h.r * 0.85) ** 2) {
            insideHole = true;
            break;
          }
        }

        if (insideHole) {
          nodeGrid[j][i] = null;
          continue;
        }

        const id = nodeIdCounter++;
        nodeGrid[j][i] = id;
        nodes.push({
          id,
          x,
          y,
          z: 0,
          u: 0,
          v: 0,
          w: 0,
          totalDisp: 0,
        });
      }
    }

    // 4. Criação dos Elementos Triangulares (CST)
    let elemIdCounter = 1;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const nBL = nodeGrid[j][i];
        const nBR = nodeGrid[j][i + 1];
        const nTL = nodeGrid[j + 1][i];
        const nTR = nodeGrid[j + 1][i + 1];

        // Triângulo Inferior (BL -> BR -> TL)
        if (nBL !== null && nBR !== null && nTL !== null) {
          const nodeA = nodes.find((n) => n.id === nBL)!;
          const nodeB = nodes.find((n) => n.id === nBR)!;
          const nodeC = nodes.find((n) => n.id === nTL)!;
          const area = Math.abs((nodeA.x * (nodeB.y - nodeC.y) + nodeB.x * (nodeC.y - nodeA.y) + nodeC.x * (nodeA.y - nodeB.y)) / 2);

          if (area > 1e-4) {
            elements.push({
              id: elemIdCounter++,
              type: "CST_TRIANGLE",
              nodeIds: [nBL, nBR, nTL],
              thickness,
              area,
            });
          }
        }

        // Triângulo Superior (BR -> TR -> TL)
        if (nBR !== null && nTR !== null && nTL !== null) {
          const nodeB = nodes.find((n) => n.id === nBR)!;
          const nodeD = nodes.find((n) => n.id === nTR)!;
          const nodeC = nodes.find((n) => n.id === nTL)!;
          const area = Math.abs((nodeB.x * (nodeD.y - nodeC.y) + nodeD.x * (nodeC.y - nodeB.y) + nodeC.x * (nodeB.y - nodeD.y)) / 2);

          if (area > 1e-4) {
            elements.push({
              id: elemIdCounter++,
              type: "CST_TRIANGLE",
              nodeIds: [nBR, nTR, nTL],
              thickness,
              area,
            });
          }
        }
      }
    }

    return {
      nodes,
      elements,
      numNodes: nodes.length,
      numElements: elements.length,
      boundingBox: { minX, maxX, minY, maxY },
    };
  }
}
