// @ts-nocheck
/**
 * CALDRA CAD — GEOMETRIC CONSTRAINT SOLVER (FASE 02)
 *
 * Resolvedor geométrico determinístico baseado em relaxação iterativa
 * e método dos mínimos quadrados com amortecimento.
 * Calcula graus de liberdade (DoF), detecta sobredefinições e atualiza a geometria.
 */

import type {
  SketchPoint,
  SketchSegment,
  GeometricConstraint,
  DimensionParameter,
  SolveResult,
  SketchStatus,
} from "./types";

/**
 * Avaliador seguro de expressões paramétricas (sem eval/Function).
 * Suporta expressões como: "Altura * 2", "Espessura * 1.5", "(W + 20) / 2"
 */
export function evaluateParametricExpression(expr: string, params: Record<string, number>): number {
  const clean = expr.trim();
  if (!clean) return 0;

  // Substitui os nomes dos parâmetros pelos seus valores numéricos
  const keys = Object.keys(params).sort((a, b) => b.length - a.length);
  let resolved = clean;
  for (const k of keys) {
    const val = params[k];
    const regex = new RegExp(`\\b${k}\\b`, "g");
    resolved = resolved.replace(regex, `(${val})`);
  }

  // Tokenizador e parser descendente recursivo seguro
  const tokens = resolved.match(/(\d+\.?\d*|\+|-|\*|\/|\(|\))/g);
  if (!tokens) {
    const num = Number(resolved);
    return Number.isFinite(num) ? num : 0;
  }

  let pos = 0;

  function parseExpression(): number {
    let val = parseTerm();
    while (pos < tokens!.length && (tokens![pos] === "+" || tokens![pos] === "-")) {
      const op = tokens![pos++];
      const next = parseTerm();
      if (op === "+") val += next;
      else val -= next;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (pos < tokens!.length && (tokens![pos] === "*" || tokens![pos] === "/")) {
      const op = tokens![pos++];
      const next = parseFactor();
      if (op === "*") val *= next;
      else val = next !== 0 ? val / next : 0;
    }
    return val;
  }

  function parseFactor(): number {
    if (pos >= tokens!.length) return 0;
    const token = tokens![pos++];
    if (token === "(") {
      const val = parseExpression();
      if (pos < tokens!.length && tokens![pos] === ")") pos++;
      return val;
    }
    if (token === "-") {
      return -parseFactor();
    }
    if (token === "+") {
      return parseFactor();
    }
    const num = parseFloat(token);
    return Number.isFinite(num) ? num : 0;
  }

  try {
    return parseExpression();
  } catch {
    return 0;
  }
}

export class ConstraintSolver {
  /**
   * Resolve o sistema de restrições geométricas para os pontos fornecidos.
   */
  static solve(
    points: SketchPoint[],
    segments: SketchSegment[],
    constraints: GeometricConstraint[],
    parameters: DimensionParameter[] = [],
    maxIterations = 80,
    tolerance = 1e-4,
  ): { points: SketchPoint[]; result: SolveResult } {
    // Mapa de parâmetros para resolução de cotas
    const paramMap: Record<string, number> = {};
    for (const p of parameters) {
      if (p.expression) {
        paramMap[p.name] = evaluateParametricExpression(p.expression, paramMap);
      } else {
        paramMap[p.name] = p.value;
      }
    }

    // Cópia profunda dos pontos de trabalho
    const pts = points.map((p) => ({ ...p }));
    const pointMap = new Map<string, SketchPoint>();
    pts.forEach((p) => pointMap.set(p.id, p));

    // Identifica pontos livres vs fixos
    const freePoints = pts.filter((p) => !p.isFixed);
    const variableCount = freePoints.length * 2;

    const activeConstraints = constraints.filter((c) => c.isActive);

    // Resolução iterativa por relaxamento amortecido
    let iteration = 0;
    let maxResidual = 0;
    const conflictingConstraints: string[] = [];

    while (iteration < maxIterations) {
      maxResidual = 0;

      for (const c of activeConstraints) {
        let residual = 0;

        switch (c.type) {
          case "horizontal": {
            const [p0Id, p1Id] = c.pointIds;
            const p0 = pointMap.get(p0Id);
            const p1 = pointMap.get(p1Id);
            if (!p0 || !p1) break;
            residual = Math.abs(p1.y - p0.y);
            if (!p0.isFixed && !p1.isFixed) {
              const midY = (p0.y + p1.y) * 0.5;
              p0.y = midY;
              p1.y = midY;
            } else if (!p0.isFixed && p1.isFixed) {
              p0.y = p1.y;
            } else if (p0.isFixed && !p1.isFixed) {
              p1.y = p0.y;
            }
            break;
          }

          case "vertical": {
            const [p0Id, p1Id] = c.pointIds;
            const p0 = pointMap.get(p0Id);
            const p1 = pointMap.get(p1Id);
            if (!p0 || !p1) break;
            residual = Math.abs(p1.x - p0.x);
            if (!p0.isFixed && !p1.isFixed) {
              const midX = (p0.x + p1.x) * 0.5;
              p0.x = midX;
              p1.x = midX;
            } else if (!p0.isFixed && p1.isFixed) {
              p0.x = p1.x;
            } else if (p0.isFixed && !p1.isFixed) {
              p1.x = p0.x;
            }
            break;
          }

          case "coincident": {
            const [p0Id, p1Id] = c.pointIds;
            const p0 = pointMap.get(p0Id);
            const p1 = pointMap.get(p1Id);
            if (!p0 || !p1) break;
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            residual = Math.hypot(dx, dy);
            if (!p0.isFixed && !p1.isFixed) {
              p0.x += dx * 0.5;
              p0.y += dy * 0.5;
              p1.x -= dx * 0.5;
              p1.y -= dy * 0.5;
            } else if (!p0.isFixed && p1.isFixed) {
              p0.x = p1.x;
              p0.y = p1.y;
            } else if (p0.isFixed && !p1.isFixed) {
              p1.x = p0.x;
              p1.y = p0.y;
            }
            break;
          }

          case "distance":
          case "length": {
            const [p0Id, p1Id] = c.pointIds;
            const p0 = pointMap.get(p0Id);
            const p1 = pointMap.get(p1Id);
            if (!p0 || !p1) break;
            let targetDist = c.value ?? 0;
            if (c.expression && paramMap[c.expression] !== undefined) {
              targetDist = paramMap[c.expression];
            }
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            let currDist = Math.hypot(dx, dy);
            residual = Math.abs(currDist - targetDist);

            const ux = currDist > 1e-7 ? dx / currDist : 1;
            const uy = currDist > 1e-7 ? dy / currDist : 0;
            if (currDist < 1e-7) currDist = 1e-7;

            if (!p0.isFixed && !p1.isFixed) {
              const midX = (p0.x + p1.x) * 0.5;
              const midY = (p0.y + p1.y) * 0.5;
              p0.x = midX - ux * targetDist * 0.5;
              p0.y = midY - uy * targetDist * 0.5;
              p1.x = midX + ux * targetDist * 0.5;
              p1.y = midY + uy * targetDist * 0.5;
            } else if (!p0.isFixed && p1.isFixed) {
              p0.x = p1.x - ux * targetDist;
              p0.y = p1.y - uy * targetDist;
            } else if (p0.isFixed && !p1.isFixed) {
              p1.x = p0.x + ux * targetDist;
              p1.y = p0.y + uy * targetDist;
            }
            break;
          }

          case "perpendicular": {
            if (c.pointIds.length >= 4) {
              const p0 = pointMap.get(c.pointIds[0]);
              const p1 = pointMap.get(c.pointIds[1]);
              const p2 = pointMap.get(c.pointIds[2]);
              const p3 = pointMap.get(c.pointIds[3]);
              if (!p0 || !p1 || !p2 || !p3) break;

              const v1x = p1.x - p0.x;
              const v1y = p1.y - p0.y;
              const v2x = p3.x - p2.x;
              const v2y = p3.y - p2.y;

              const len1 = Math.hypot(v1x, v1y);
              const len2 = Math.hypot(v2x, v2y);
              if (len1 > 1e-7 && len2 > 1e-7) {
                const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
                residual = Math.abs(dot);
                if (residual > tolerance && !p3.isFixed) {
                  const rot = -dot * 0.5;
                  const nx = v2x * Math.cos(rot) - v2y * Math.sin(rot);
                  const ny = v2x * Math.sin(rot) + v2y * Math.cos(rot);
                  p3.x = p2.x + nx;
                  p3.y = p2.y + ny;
                }
              }
            }
            break;
          }

          case "parallel": {
            if (c.pointIds.length >= 4) {
              const p0 = pointMap.get(c.pointIds[0]);
              const p1 = pointMap.get(c.pointIds[1]);
              const p2 = pointMap.get(c.pointIds[2]);
              const p3 = pointMap.get(c.pointIds[3]);
              if (!p0 || !p1 || !p2 || !p3) break;

              const v1x = p1.x - p0.x;
              const v1y = p1.y - p0.y;
              const v2x = p3.x - p2.x;
              const v2y = p3.y - p2.y;

              const len1 = Math.hypot(v1x, v1y);
              const len2 = Math.hypot(v2x, v2y);
              if (len1 > 1e-7 && len2 > 1e-7) {
                const cross = (v1x * v2y - v1y * v2x) / (len1 * len2);
                residual = Math.abs(cross);
                if (residual > tolerance && !p3.isFixed) {
                  const dirX = v1x / len1;
                  const dirY = v1y / len1;
                  p3.x = p2.x + dirX * len2;
                  p3.y = p2.y + dirY * len2;
                }
              }
            }
            break;
          }

          case "equal": {
            if (c.pointIds.length >= 4) {
              const p0 = pointMap.get(c.pointIds[0]);
              const p1 = pointMap.get(c.pointIds[1]);
              const p2 = pointMap.get(c.pointIds[2]);
              const p3 = pointMap.get(c.pointIds[3]);
              if (!p0 || !p1 || !p2 || !p3) break;

              const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
              const l2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
              residual = Math.abs(l1 - l2);
              const avgLen = (l1 + l2) * 0.5;

              if (!p1.isFixed && l1 > 1e-7) {
                const s = avgLen / l1;
                p1.x = p0.x + (p1.x - p0.x) * s;
                p1.y = p0.y + (p1.y - p0.y) * s;
              }
              if (!p3.isFixed && l2 > 1e-7) {
                const s = avgLen / l2;
                p3.x = p2.x + (p3.x - p2.x) * s;
                p3.y = p2.y + (p3.y - p2.y) * s;
              }
            }
            break;
          }

          case "fixed": {
            const p = pointMap.get(c.pointIds[0]);
            if (p) {
              p.isFixed = true;
            }
            break;
          }
        }

        if (residual > maxResidual) maxResidual = residual;
      }

      iteration++;
      if (maxResidual < tolerance) break;
    }

    // Contagem de equações ativas para cálculo de graus de liberdade (DoF)
    let effectiveConstraintEquations = 0;
    for (const c of activeConstraints) {
      if (c.type === "coincident") effectiveConstraintEquations += 2;
      else if (c.type === "fixed")
        effectiveConstraintEquations += 0; // já subtraído em variableCount
      else effectiveConstraintEquations += 1;
    }

    const degreesOfFreedom = Math.max(0, variableCount - effectiveConstraintEquations);

    let status: SketchStatus = "under_defined";
    const converged = maxResidual <= tolerance;

    if (effectiveConstraintEquations > variableCount && !converged) {
      status = "over_defined";
      conflictingConstraints.push(
        "SOBREDEFINIDO: Número de restrições contraditórias excede graus de liberdade.",
      );
    } else if (degreesOfFreedom === 0 && converged) {
      status = "fully_defined";
    } else if (degreesOfFreedom > 0) {
      status = "under_defined";
    } else {
      status = converged ? "fully_defined" : "invalid";
    }

    return {
      points: pts,
      result: {
        converged,
        iterations: iteration,
        maxResidual,
        degreesOfFreedom,
        status,
        conflictingConstraints,
      },
    };
  }
}
