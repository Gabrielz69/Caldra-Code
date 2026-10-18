// @ts-nocheck
/**
 * CALDRA VISION — GEOMETRIC CONSENSUS ENGINE
 *
 * Módulo de fusão e consenso geométrico entre múltiplas hipóteses vetoriais:
 * 1. Agrupa entidades equivalentes identificadas por diferentes candidatos.
 * 2. Calcula estimativas ótimas ponderadas por confiança (linhas, círculos, arcos).
 * 3. Aplica TechnicalGeometryPrior: ortogonalização de linhas quase-ortogonais,
 *    paralelismo, perpendicularidade a 90° e fechamento de gaps de extremidade.
 */

import type { Prim } from "../geometryRecognizer";
import type { VectorCandidate, IterativeVisionOptions } from "./types";

export class GeometricConsensusEngine {
  /**
   * Realiza a fusão consensual dos melhores elementos entre múltiplos candidatos.
   */
  static formConsensus(
    candidates: VectorCandidate[],
    options: IterativeVisionOptions = {},
  ): Prim[] {
    if (candidates.length === 0) return [];
    const geomTol = options.geometryTolerance ?? 2.0;
    const angTolRad = ((options.angularToleranceDeg ?? 2.0) * Math.PI) / 180;
    const coincTol = options.coincidenceTolerance ?? 3.0;

    if (candidates.length === 1) {
      return this.applyTechnicalPrior(
        candidates[0].prims.map((p) => ({ ...p })),
        coincTol,
        angTolRad,
      );
    }

    // Coleta todas as primitivas ponderadas pelo score do candidato que as gerou
    const allPrimsWithWeight: { prim: Prim; weight: number }[] = [];
    for (const cand of candidates) {
      const w = Math.max(0.1, cand.finalScore);
      for (const p of cand.prims) {
        allPrimsWithWeight.push({ prim: p, weight: w });
      }
    }

    // 1. Processa e consolida Círculos
    const circles = allPrimsWithWeight.filter((pw) => pw.prim.kind === "circle");
    const consensusCircles = this.fuseCircles(circles, geomTol);

    // 2. Processa e consolida Arcos
    const arcs = allPrimsWithWeight.filter((pw) => pw.prim.kind === "arc");
    const consensusArcs = this.fuseArcs(arcs, geomTol);

    // 3. Processa e consolida Linhas
    const lines = allPrimsWithWeight.filter((pw) => pw.prim.kind === "line");
    const consensusLines = this.fuseLines(lines, geomTol, angTolRad);

    // 4. Polilinhas (mantém as melhores de candidatos com alto score)
    const polylines = allPrimsWithWeight
      .filter((pw) => pw.prim.kind === "polyline")
      .sort((a, b) => b.weight - a.weight)
      .map((pw) => pw.prim);

    // Combina todas as entidades consensuais
    const merged: Prim[] = [...consensusCircles, ...consensusArcs, ...consensusLines, ...polylines];

    // 5. Aplica TechnicalGeometryPrior (snap de extremidades e ortogonalização)
    return this.applyTechnicalPrior(merged, coincTol, angTolRad);
  }

  /**
   * Funde círculos concêntricos próximos identificados por múltiplos candidatos.
   */
  private static fuseCircles(items: { prim: Prim; weight: number }[], distTol: number): Prim[] {
    const fused: Prim[] = [];
    const used = new Uint8Array(items.length);

    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const base = items[i].prim;
      if (base.kind !== "circle") continue;

      let sumCx = base.cx * items[i].weight;
      let sumCy = base.cy * items[i].weight;
      let sumR = base.r * items[i].weight;
      let totalW = items[i].weight;
      let count = 1;
      used[i] = 1;

      for (let j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        const other = items[j].prim;
        if (other.kind !== "circle") continue;

        const centerDist = Math.hypot(other.cx - base.cx, other.cy - base.cy);
        const radiusDiff = Math.abs(other.r - base.r);

        if (centerDist <= distTol && radiusDiff <= distTol * 1.5) {
          sumCx += other.cx * items[j].weight;
          sumCy += other.cy * items[j].weight;
          sumR += other.r * items[j].weight;
          totalW += items[j].weight;
          count++;
          used[j] = 1;
        }
      }

      fused.push({
        kind: "circle",
        cx: sumCx / totalW,
        cy: sumCy / totalW,
        r: sumR / totalW,
        hole: base.hole,
        quality: Math.min(1.0, 0.7 + count * 0.1),
        status: "convertida",
      });
    }

    return fused;
  }

  /**
   * Funde arcos coincidentes.
   */
  private static fuseArcs(items: { prim: Prim; weight: number }[], distTol: number): Prim[] {
    const fused: Prim[] = [];
    const used = new Uint8Array(items.length);

    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const base = items[i].prim;
      if (base.kind !== "arc") continue;

      let sumCx = base.cx * items[i].weight;
      let sumCy = base.cy * items[i].weight;
      let sumR = base.r * items[i].weight;
      let totalW = items[i].weight;
      let count = 1;
      used[i] = 1;

      for (let j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        const other = items[j].prim;
        if (other.kind !== "arc") continue;

        const centerDist = Math.hypot(other.cx - base.cx, other.cy - base.cy);
        const radiusDiff = Math.abs(other.r - base.r);

        if (centerDist <= distTol && radiusDiff <= distTol * 1.5) {
          sumCx += other.cx * items[j].weight;
          sumCy += other.cy * items[j].weight;
          sumR += other.r * items[j].weight;
          totalW += items[j].weight;
          count++;
          used[j] = 1;
        }
      }

      fused.push({
        kind: "arc",
        cx: sumCx / totalW,
        cy: sumCy / totalW,
        r: sumR / totalW,
        a0: base.a0,
        a1: base.a1,
        hole: base.hole,
        quality: Math.min(1.0, 0.7 + count * 0.1),
        status: "convertida",
      });
    }

    return fused;
  }

  /**
   * Funde linhas colineares e sobrepostas identificadas por múltiplos candidatos.
   */
  private static fuseLines(
    items: { prim: Prim; weight: number }[],
    distTol: number,
    angTolRad: number,
  ): Prim[] {
    const fused: Prim[] = [];
    const used = new Uint8Array(items.length);

    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const base = items[i].prim;
      if (base.kind !== "line") continue;

      const baseAngle = Math.atan2(base.y2 - base.y1, base.x2 - base.x1);
      const candidatesInCluster: Prim[] = [base];
      used[i] = 1;

      for (let j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        const other = items[j].prim;
        if (other.kind !== "line") continue;

        let diffAngle = Math.abs(Math.atan2(other.y2 - other.y1, other.x2 - other.x1) - baseAngle);
        while (diffAngle > Math.PI) diffAngle -= Math.PI;
        diffAngle = Math.abs(diffAngle);

        if (diffAngle < angTolRad || Math.abs(diffAngle - Math.PI) < angTolRad) {
          // Distância perpendicular das extremidades
          const d1 = this.pointLineDistance({ x: other.x1, y: other.y1 }, base);
          const d2 = this.pointLineDistance({ x: other.x2, y: other.y2 }, base);

          if (d1 < distTol * 1.5 && d2 < distTol * 1.5) {
            candidatesInCluster.push(other);
            used[j] = 1;
          }
        }
      }

      // Projeta todos os pontos na linha consensual e obtém o segmento de maior extensão
      if (candidatesInCluster.length === 1) {
        fused.push(base);
      } else {
        const consolidatedLine = this.consolidateCollinearLines(candidatesInCluster, baseAngle);
        fused.push(consolidatedLine);
      }
    }

    return fused;
  }

  private static pointLineDistance(
    p: { x: number; y: number },
    l: { x1: number; y1: number; x2: number; y2: number },
  ): number {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-7) return Math.hypot(p.x - l.x1, p.y - l.y1);
    return Math.abs(dy * p.x - dx * p.y + l.x2 * l.y1 - l.y2 * l.x1) / len;
  }

  private static consolidateCollinearLines(lines: Prim[], angleRad: number): Prim {
    // Eixo diretor
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);

    let minT = Infinity;
    let maxT = -Infinity;
    let pMin = { x: 0, y: 0 };
    let pMax = { x: 0, y: 0 };

    for (const l of lines) {
      if (l.kind !== "line") continue;
      const pts = [
        { x: l.x1, y: l.y1 },
        { x: l.x2, y: l.y2 },
      ];
      for (const pt of pts) {
        const t = pt.x * dirX + pt.y * dirY;
        if (t < minT) {
          minT = t;
          pMin = pt;
        }
        if (t > maxT) {
          maxT = t;
          pMax = pt;
        }
      }
    }

    return {
      kind: "line",
      x1: pMin.x,
      y1: pMin.y,
      x2: pMax.x,
      y2: pMax.y,
      hole: lines[0].hole,
      quality: 0.95,
      status: "convertida",
    };
  }

  /**
   * TechnicalGeometryPrior:
   * Regulariza linhas quase-horizontais/quase-verticais e fecha cantos em esquadro exato (90°).
   */
  private static applyTechnicalPrior(prims: Prim[], coincTol: number, angTolRad: number): Prim[] {
    const result: Prim[] = prims.map((p) => ({ ...p }));

    // 1. Identifica e une cantos de linhas perpendiculares na interseção exata (X_vert, Y_horiz)
    for (let i = 0; i < result.length; i++) {
      const p1 = result[i];
      if (p1.kind !== "line") continue;

      for (let j = i + 1; j < result.length; j++) {
        const p2 = result[j];
        if (p2.kind !== "line") continue;

        const ang1 = Math.abs(Math.atan2(p1.y2 - p1.y1, p1.x2 - p1.x1));
        const ang2 = Math.abs(Math.atan2(p2.y2 - p2.y1, p2.x2 - p2.x1));

        const isHoriz1 = ang1 < angTolRad || Math.abs(ang1 - Math.PI) < angTolRad;
        const isVert1 = Math.abs(ang1 - Math.PI * 0.5) < angTolRad;
        const isHoriz2 = ang2 < angTolRad || Math.abs(ang2 - Math.PI) < angTolRad;
        const isVert2 = Math.abs(ang2 - Math.PI * 0.5) < angTolRad;

        // Caso p1 horizontal e p2 vertical (ou vice-versa)
        if ((isHoriz1 && isVert2) || (isVert1 && isHoriz2)) {
          const horiz = isHoriz1 ? p1 : p2;
          const vert = isVert1 ? p1 : p2;

          const hY = (horiz.y1 + horiz.y2) * 0.5;
          const vX = (vert.x1 + vert.x2) * 0.5;

          // Verifica se extremidades estão próximas
          const distE2S1 = Math.hypot(horiz.x2 - vert.x1, horiz.y2 - vert.y1);
          const distE2E2 = Math.hypot(horiz.x2 - vert.x2, horiz.y2 - vert.y2);
          const distS1S1 = Math.hypot(horiz.x1 - vert.x1, horiz.y1 - vert.y1);
          const distS1E2 = Math.hypot(horiz.x1 - vert.x2, horiz.y1 - vert.y2);

          if (distE2S1 <= coincTol) {
            horiz.x2 = vX;
            horiz.y2 = hY;
            horiz.y1 = hY;
            vert.x1 = vX;
            vert.y1 = hY;
            vert.x2 = vX;
          } else if (distE2E2 <= coincTol) {
            horiz.x2 = vX;
            horiz.y2 = hY;
            horiz.y1 = hY;
            vert.x2 = vX;
            vert.y2 = hY;
            vert.x1 = vX;
          } else if (distS1S1 <= coincTol) {
            horiz.x1 = vX;
            horiz.y1 = hY;
            horiz.y2 = hY;
            vert.x1 = vX;
            vert.y1 = hY;
            vert.x2 = vX;
          } else if (distS1E2 <= coincTol) {
            horiz.x1 = vX;
            horiz.y1 = hY;
            horiz.y2 = hY;
            vert.x2 = vX;
            vert.y2 = hY;
            vert.x1 = vX;
          }
        }
      }
    }

    // 2. Ortogonalização residual para linhas individuais isoladas
    for (let i = 0; i < result.length; i++) {
      const p = result[i];
      if (p.kind === "line") {
        const dx = p.x2 - p.x1;
        const dy = p.y2 - p.y1;
        const len = Math.hypot(dx, dy);
        if (len > 2) {
          const ang = Math.abs(Math.atan2(dy, dx));
          if (ang < angTolRad || Math.abs(ang - Math.PI) < angTolRad) {
            const avgY = (p.y1 + p.y2) * 0.5;
            result[i] = { ...p, y1: avgY, y2: avgY };
          } else if (Math.abs(ang - Math.PI * 0.5) < angTolRad) {
            const avgX = (p.x1 + p.x2) * 0.5;
            result[i] = { ...p, x1: avgX, x2: avgX };
          }
        }
      }
    }

    return result;
  }
}
