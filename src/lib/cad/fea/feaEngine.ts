/**
 * CALDRA CAD — MOTOR DE SOLUÇÃO ESTRUTURAL FEA / CAE (FASE 15)
 *
 * Solucionador matricial por rigidez direta [K]{u} = {F} para elementos finitos 2D CST:
 * - Matriz constitutiva elástica de Estado Plano de Tensão (Plane Stress)
 * - Matriz de deformação-deslocamento [B] e rigidez elementar [ke]
 * - Montagem e aplicação de condições de contorno (Engaste, Apoio)
 * - Solucionador linear por Gradiente Conjugado com Pré-condicionamento de Jacobi
 * - Recuperação do campo de tensões de Von Mises, Fator de Segurança e Verificação NBR 8800
 */

import type { PartDocument } from "../kernel/types";
import type {
  FeaAnalysisResult,
  FeaSimulationOptions,
  FeaMaterial,
  FeaBoundaryCondition,
  FeaLoad,
  FeaHotspot,
  FeaSafetyStatus,
} from "./types";
import { getFeaMaterial } from "./materials";
import { FeaMesher } from "./mesher";

export class FeaEngine {
  /**
   * Executa a análise estrutural completa por elementos finitos
   */
  static solve(doc: PartDocument, options?: FeaSimulationOptions): FeaAnalysisResult {
    const material: FeaMaterial = getFeaMaterial(options?.materialId || doc.material);
    const mesh = FeaMesher.generateMesh(doc, options);
    const numNodes = mesh.nodes.length;
    const numDOF = numNodes * 2; // 2 graus de liberdade por nó (u_x, v_y)

    // Mapa rápido de id do nó para índice 0-based
    const nodeIndexMap = new Map<number, number>();
    mesh.nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

    const E = material.youngsModulus;
    const nu = material.poissonsRatio;
    const thickness = Math.max(doc.thickness || 3, 0.5);

    // 1. Matriz Constitutiva [D] para Estado Plano de Tensão (Plane Stress)
    // sigma = [D] * epsilon
    const factorD = E / (1 - nu * nu);
    const D = [
      [factorD, factorD * nu, 0],
      [factorD * nu, factorD, 0],
      [0, 0, factorD * (1 - nu) / 2],
    ];

    // 2. Montagem da Matriz de Rigidez Global [K]
    // Usamos mapa esparso de linhas para eficiência de memória e desempenho
    const K: Map<number, number>[] = Array.from({ length: numDOF }, () => new Map<number, number>());

    const addK = (r: number, c: number, val: number) => {
      const row = K[r];
      const cur = row.get(c) || 0;
      row.set(c, cur + val);
    };

    // Para cada elemento CST
    for (const elem of mesh.elements) {
      const idx1 = nodeIndexMap.get(elem.nodeIds[0])!;
      const idx2 = nodeIndexMap.get(elem.nodeIds[1])!;
      const idx3 = nodeIndexMap.get(elem.nodeIds[2])!;

      const n1 = mesh.nodes[idx1];
      const n2 = mesh.nodes[idx2];
      const n3 = mesh.nodes[idx3];

      const x1 = n1.x, y1 = n1.y;
      const x2 = n2.x, y2 = n2.y;
      const x3 = n3.x, y3 = n3.y;

      const y23 = y2 - y3;
      const y31 = y3 - y1;
      const y12 = y1 - y2;

      const x32 = x3 - x2;
      const x13 = x1 - x3;
      const x21 = x2 - x1;

      const twoArea = x13 * y23 - x32 * y31;
      const area = Math.abs(twoArea) / 2;
      elem.area = Math.max(area, 0.001);

      if (Math.abs(twoArea) < 1e-6) continue;

      // Matriz [B] (3x6)
      // epsilon = [B] * {u1, v1, u2, v2, u3, v3}
      const inv2A = 1.0 / twoArea;
      const B = [
        [y23 * inv2A, 0, y31 * inv2A, 0, y12 * inv2A, 0],
        [0, x32 * inv2A, 0, x13 * inv2A, 0, x21 * inv2A],
        [x32 * inv2A, y23 * inv2A, x13 * inv2A, y31 * inv2A, x21 * inv2A, y12 * inv2A],
      ];

      // [DB] = [D] * [B] (3x6)
      const DB: number[][] = [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          DB[r][c] = D[r][0] * B[0][c] + D[r][1] * B[1][c] + D[r][2] * B[2][c];
        }
      }

      // [ke] = thickness * area * [B]^T * [DB] (6x6)
      const elemDof = [idx1 * 2, idx1 * 2 + 1, idx2 * 2, idx2 * 2 + 1, idx3 * 2, idx3 * 2 + 1];
      const scale = elem.thickness * elem.area;

      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          let kij = 0;
          for (let k = 0; k < 3; k++) {
            kij += B[k][i] * DB[k][j];
          }
          addK(elemDof[i], elemDof[j], kij * scale);
        }
      }
    }

    // 3. Condições de Contorno e Carregamento Mecânico
    const loadCase = options?.loadCase || "CANTILEVER_BENDING";
    const forceVal = options?.appliedForceN ?? 2500; // 2.5 kN padrão
    const F = new Float64Array(numDOF);

    const boundaryConditions: FeaBoundaryCondition[] = [];
    const loads: FeaLoad[] = [];
    const fixedDofs = new Set<number>();

    const { minX, maxX, minY, maxY } = mesh.boundingBox;
    const tolX = (maxX - minX) * 0.05 + 1.0;
    const tolY = (maxY - minY) * 0.05 + 1.0;

    // Condição padrão: Engaste em X = minX (borda esquerda fixa)
    const leftNodes: FeaNode[] = [];
    const rightNodes: FeaNode[] = [];

    for (const node of mesh.nodes) {
      if (Math.abs(node.x - minX) <= tolX) {
        leftNodes.push(node);
      }
      if (Math.abs(node.x - maxX) <= tolX) {
        rightNodes.push(node);
      }
    }

    // Engasta a borda esquerda
    boundaryConditions.push({
      id: "BC_FIX_LEFT",
      name: "Engaste Borda Esquerda",
      type: "FIXED",
      edge: "left",
      nodeIds: leftNodes.map((n) => n.id),
    });

    for (const n of leftNodes) {
      const idx = nodeIndexMap.get(n.id)!;
      fixedDofs.add(idx * 2);     // u = 0
      fixedDofs.add(idx * 2 + 1); // v = 0
      n.isRestrained = true;
    }

    // Aplicação da Força nos nós da extremidade oposta
    const targetNodes = rightNodes.length > 0 ? rightNodes : [mesh.nodes[mesh.nodes.length - 1]];
    const forcePerNode = forceVal / Math.max(targetNodes.length, 1);

    if (loadCase === "TENSION") {
      // Tração pura ao longo do eixo X (+)
      for (const n of targetNodes) {
        const idx = nodeIndexMap.get(n.id)!;
        F[idx * 2] += forcePerNode;
      }
      loads.push({
        id: "LOAD_TENSION_X",
        name: `Tração Axial (${forceVal} N)`,
        type: "POINT_FORCE",
        edge: "right",
        force: { fx: forceVal, fy: 0, fz: 0 },
      });
    } else {
      // Flexão em balanço (Carga vertical descendente em Y (-))
      for (const n of targetNodes) {
        const idx = nodeIndexMap.get(n.id)!;
        F[idx * 2 + 1] -= forcePerNode;
      }
      loads.push({
        id: "LOAD_BEND_Y",
        name: `Carga de Flexão (${forceVal} N)`,
        type: "POINT_FORCE",
        edge: "right",
        force: { fx: 0, fy: -forceVal, fz: 0 },
      });
    }

    // 4. Aplicação das restrições em [K] (Linha e Coluna com 1 na diagonal para DOF fixo)
    for (const dof of fixedDofs) {
      K[dof].clear();
      K[dof].set(dof, 1.0);
      F[dof] = 0;
    }
    for (let r = 0; r < numDOF; r++) {
      if (fixedDofs.has(r)) continue;
      for (const dof of fixedDofs) {
        if (K[r].has(dof)) {
          K[r].delete(dof);
        }
      }
    }

    // 5. Solucionador Linear: Gradiente Conjugado com Pré-condicionador de Jacobi (Diagonal)
    const u = solveConjugateGradient(K, F, numDOF, 1000, 1e-7);

    // 6. Atualização dos Deslocamentos Nodais
    let maxDeflectionMm = 0;
    let maxDeflectionNodeId = 1;

    for (let i = 0; i < numNodes; i++) {
      const node = mesh.nodes[i];
      const ux = u[i * 2];
      const vy = u[i * 2 + 1];
      const disp = Math.sqrt(ux * ux + vy * vy);

      node.u = ux;
      node.v = vy;
      node.totalDisp = disp;

      if (disp > maxDeflectionMm) {
        maxDeflectionMm = disp;
        maxDeflectionNodeId = node.id;
      }
    }

    // 7. Recuperação das Tensões Elementares e Tensão de Von Mises
    let maxVonMises = 0;
    let minVonMises = Infinity;
    let sumVonMises = 0;
    let maxVonMisesElementId = 1;
    const hotspots: FeaHotspot[] = [];

    for (const elem of mesh.elements) {
      const idx1 = nodeIndexMap.get(elem.nodeIds[0])!;
      const idx2 = nodeIndexMap.get(elem.nodeIds[1])!;
      const idx3 = nodeIndexMap.get(elem.nodeIds[2])!;

      const n1 = mesh.nodes[idx1];
      const n2 = mesh.nodes[idx2];
      const n3 = mesh.nodes[idx3];

      const y23 = n2.y - n3.y;
      const y31 = n3.y - n1.y;
      const y12 = n1.y - n2.y;

      const x32 = n3.x - n2.x;
      const x13 = n1.x - n3.x;
      const x21 = n2.x - n1.x;

      const twoArea = x13 * y23 - x32 * y31;
      const inv2A = 1.0 / (twoArea || 1e-5);

      // Deformações elementares {epsilon} = [B] * {u}
      const ue = [
        n1.u || 0, n1.v || 0,
        n2.u || 0, n2.v || 0,
        n3.u || 0, n3.v || 0,
      ];

      const ex = inv2A * (y23 * ue[0] + y31 * ue[2] + y12 * ue[4]);
      const ey = inv2A * (x32 * ue[1] + x13 * ue[3] + x21 * ue[5]);
      const gxy = inv2A * (x32 * ue[0] + y23 * ue[1] + x13 * ue[2] + y31 * ue[3] + x21 * ue[4] + y12 * ue[5]);

      // Tensões {sigma} = [D] * {epsilon}
      const sigmaX = D[0][0] * ex + D[0][1] * ey;
      const sigmaY = D[1][0] * ex + D[1][1] * ey;
      const tauXY = D[2][2] * gxy;

      // Tensões Principais
      const sAvg = (sigmaX + sigmaY) / 2;
      const radius = Math.sqrt(((sigmaX - sigmaY) / 2) ** 2 + tauXY ** 2);
      const sigma1 = sAvg + radius;
      const sigma2 = sAvg - radius;

      // Tensão Equivalente de Von Mises: σ_vm = √(σx² - σx·σy + σy² + 3·τxy²)
      const vmSq = Math.max(0, sigmaX * sigmaX - sigmaX * sigmaY + sigmaY * sigmaY + 3 * tauXY * tauXY);
      const vonMises = Math.sqrt(vmSq);

      elem.stress = {
        sigmaX,
        sigmaY,
        tauXY,
        sigma1,
        sigma2,
        vonMises,
      };

      if (vonMises > maxVonMises) {
        maxVonMises = vonMises;
        maxVonMisesElementId = elem.id;
      }
      if (vonMises < minVonMises) {
        minVonMises = vonMises;
      }
      sumVonMises += vonMises;
    }

    if (minVonMises === Infinity) minVonMises = 0;
    const avgVonMises = mesh.elements.length > 0 ? sumVonMises / mesh.elements.length : 0;

    // 8. Fator de Segurança (FOS) e Limite de Flecha (L/300)
    const yieldStrength = material.yieldStrength;
    const effectiveMaxStress = Math.max(maxVonMises, 0.001);
    const minFactorOfSafety = Number((yieldStrength / effectiveMaxStress).toFixed(2));

    const spanLength = Math.max(maxX - minX, 10);
    const allowableDeflectionMm = Number((spanLength / 300).toFixed(2)); // NBR 8800 L/300
    const deflectionPassed = maxDeflectionMm <= allowableDeflectionMm;

    let status: FeaSafetyStatus = "SAFE";
    if (minFactorOfSafety < 1.0) {
      status = "CRITICAL_FAILURE";
    } else if (minFactorOfSafety < 1.5 || !deflectionPassed) {
      status = "MARGINAL";
    }

    // 9. Hotspots (Pontos Críticos de Concentração de Tensão)
    const sortedElems = [...mesh.elements].sort(
      (a, b) => (b.stress?.vonMises || 0) - (a.stress?.vonMises || 0),
    );
    for (let i = 0; i < Math.min(3, sortedElems.length); i++) {
      const el = sortedElems[i];
      const nA = mesh.nodes.find((n) => n.id === el.nodeIds[0])!;
      const nB = mesh.nodes.find((n) => n.id === el.nodeIds[1])!;
      const nC = mesh.nodes.find((n) => n.id === el.nodeIds[2])!;
      const cx = (nA.x + nB.x + nC.x) / 3;
      const cy = (nA.y + nB.y + nC.y) / 3;

      hotspots.push({
        elementId: el.id,
        center: { x: cx, y: cy },
        vonMisesMPa: Number((el.stress?.vonMises || 0).toFixed(1)),
        description: `Pico de tensão próximo a (${cx.toFixed(0)}, ${cy.toFixed(0)}) mm`,
      });
    }

    const summaryMessage =
      status === "SAFE"
        ? `ESTRUTURA APROVADA: FOS mínimo ${minFactorOfSafety} ≥ 1.50 com deflexão ${maxDeflectionMm.toFixed(2)} mm (limite ${allowableDeflectionMm} mm).`
        : status === "MARGINAL"
        ? `ATENÇÃO: Fator de segurança ${minFactorOfSafety} limítrofe (< 1.5) ou flecha acima da norma NBR 8800.`
        : `FALHA ESTRUTURAL IMINENTE: Tensão de pico ${maxVonMises.toFixed(1)} MPa excede o escoamento (${yieldStrength} MPa). FOS = ${minFactorOfSafety}.`;

    return {
      id: `FEA-${Date.now().toString(36).toUpperCase()}`,
      partId: doc.id,
      partName: doc.name,
      timestamp: Date.now(),
      material,
      thicknessMm: thickness,
      mesh,
      boundaryConditions,
      loads,
      maxDeflectionMm: Number(maxDeflectionMm.toFixed(3)),
      maxDeflectionNodeId,
      maxVonMisesMPa: Number(maxVonMises.toFixed(1)),
      maxVonMisesElementId,
      minVonMisesMPa: Number(minVonMises.toFixed(1)),
      avgVonMisesMPa: Number(avgVonMises.toFixed(1)),
      yieldStrengthMPa: yieldStrength,
      minFactorOfSafety,
      status,
      allowableDeflectionMm,
      deflectionPassed,
      hotspots,
      summaryMessage,
    };
  }
}

/**
 * Solucionador Matricial de Gradiente Conjugado com Pré-condicionador Diagonal (Jacobi)
 */
function solveConjugateGradient(
  K: Map<number, number>[],
  F: Float64Array,
  n: number,
  maxIter = 1000,
  tol = 1e-7,
): Float64Array {
  const x = new Float64Array(n);
  const r = new Float64Array(n);
  const z = new Float64Array(n);
  const p = new Float64Array(n);
  const Ap = new Float64Array(n);
  const invDiag = new Float64Array(n);

  // Inversa da diagonal para pré-condicionamento
  for (let i = 0; i < n; i++) {
    const diag = K[i].get(i) || 1.0;
    invDiag[i] = Math.abs(diag) > 1e-12 ? 1.0 / diag : 1.0;
    r[i] = F[i]; // Inicialmente x = 0, logo r = F - K*0 = F
    z[i] = invDiag[i] * r[i];
    p[i] = z[i];
  }

  let rzOld = 0;
  for (let i = 0; i < n; i++) {
    rzOld += r[i] * z[i];
  }

  if (Math.sqrt(rzOld) < tol) return x;

  for (let iter = 0; iter < maxIter; iter++) {
    // Ap = K * p
    let pAp = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const [col, val] of K[i].entries()) {
        sum += val * p[col];
      }
      Ap[i] = sum;
      pAp += p[i] * sum;
    }

    if (Math.abs(pAp) < 1e-18) break;

    const alpha = rzOld / pAp;

    // x = x + alpha * p
    // r = r - alpha * Ap
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
      z[i] = invDiag[i] * r[i];
    }

    let rzNew = 0;
    for (let i = 0; i < n; i++) {
      rzNew += r[i] * z[i];
    }

    if (Math.sqrt(Math.abs(rzNew)) < tol) break;

    const beta = rzNew / rzOld;
    rzOld = rzNew;

    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
  }

  return x;
}
