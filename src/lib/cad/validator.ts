/**
 * CALDRA GEOMETRY CORE — VALIDATORS (FASE 01)
 *
 * Validação geométrica e topológica rigorosa.
 * Identifica não-conformidades antes de operações downstream (DXF/CNC/Sheet Metal).
 */

import type { SolidBody3D, SheetMetalBody } from "./canonical";

export type ValidationStatus = "PASS" | "WARNING" | "ERROR";

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  entityId?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  status: ValidationStatus;
  isValid: boolean;
  issues: ValidationIssue[];
}

export class GeometryValidator {
  /**
   * Valida a integridade topológica e geométrica de um SolidBody3D (B-Rep).
   */
  static validateSolid(solid: SolidBody3D): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Verificação de NaN e Infinity nos vértices
    for (const v of solid.vertices) {
      if (
        !Number.isFinite(v.point.x) ||
        !Number.isFinite(v.point.y) ||
        !Number.isFinite(v.point.z)
      ) {
        issues.push({
          code: "INVALID_COORDINATES",
          severity: "error",
          entityId: v.id,
          message: `Vértice ${v.id} possui coordenadas não numéricas (NaN ou Infinity).`,
          details: { point: v.point },
        });
      }
    }

    // 2. Arestas degeneradas (comprimento zero ou vértices duplicados)
    for (const e of solid.edges) {
      if (e.v0 === e.v1) {
        issues.push({
          code: "DEGENERATE_EDGE_SELF_LOOP",
          severity: "error",
          entityId: e.id,
          message: `Aresta ${e.id} conecta um vértice a si mesmo.`,
        });
      }
      if (e.length <= 1e-7 || !Number.isFinite(e.length)) {
        issues.push({
          code: "ZERO_LENGTH_EDGE",
          severity: "error",
          entityId: e.id,
          message: `Aresta ${e.id} possui comprimento nulo ou inválido (${e.length} mm).`,
        });
      }
    }

    // 3. Faces degeneradas (área zero ou loops sem arestas)
    for (const f of solid.faces) {
      if (f.area <= 1e-7 || !Number.isFinite(f.area)) {
        issues.push({
          code: "DEGENERATE_FACE_AREA",
          severity: "error",
          entityId: f.id,
          message: `Face ${f.id} possui área nula ou inválida (${f.area} mm²).`,
        });
      }
      if (!f.outerLoop || f.outerLoop.edgeIds.length < 3) {
        issues.push({
          code: "DEGENERATE_FACE_LOOP",
          severity: "error",
          entityId: f.id,
          message: `Face ${f.id} possui loop externo com menos de 3 arestas.`,
        });
      }
    }

    // 4. Característica de Euler-Poincaré para sólidos poliédricos conexos: V - E + F = 2 (Gênero 0)
    const V = solid.vertices.length;
    const E = solid.edges.length;
    const F = solid.faces.length;
    const euler = V - E + F;

    if (solid.shell.isClosed && solid.shell.isManifold) {
      if (euler !== 2) {
        issues.push({
          code: "EULER_CHARACTERISTIC_MISMATCH",
          severity: "warning",
          message: `Característica de Euler V - E + F = ${euler} (esperado 2 para poliedro fechado).`,
          details: { V, E, F, euler },
        });
      }
    }

    // 5. Verificação de arestas não-manifold (compartilhadas por mais de 2 faces)
    for (const e of solid.edges) {
      if (e.faceIds.length > 2) {
        issues.push({
          code: "NON_MANIFOLD_EDGE",
          severity: "error",
          entityId: e.id,
          message: `Aresta ${e.id} é compartilhada por ${e.faceIds.length} faces (máximo permitido: 2).`,
          details: { faceIds: e.faceIds },
        });
      } else if (solid.shell.isClosed && e.faceIds.length < 2) {
        issues.push({
          code: "OPEN_SHELL_EDGE",
          severity: "warning",
          entityId: e.id,
          message: `Aresta ${e.id} possui apenas ${e.faceIds.length} face adjacente em uma casca que deveria ser fechada.`,
        });
      }
    }

    // 6. Volume e Área total positivos
    if (solid.volume <= 0 || !Number.isFinite(solid.volume)) {
      issues.push({
        code: "INVALID_SOLID_VOLUME",
        severity: "error",
        message: `Volume do sólido inválido (${solid.volume} mm³).`,
      });
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning");

    return {
      status: hasErrors ? "ERROR" : hasWarnings ? "WARNING" : "PASS",
      isValid: !hasErrors,
      issues,
    };
  }
}

export class SheetMetalValidator {
  /**
   * Valida propriedades técnicas de fabricação em chapa metálica.
   */
  static validate(sheetMetal: SheetMetalBody): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Valida integridade do sólido subjacente
    const solidRes = GeometryValidator.validateSolid(sheetMetal.solidBody);
    issues.push(...solidRes.issues);

    // 2. Validação de espessura de chapa
    if (sheetMetal.thickness <= 0 || !Number.isFinite(sheetMetal.thickness)) {
      issues.push({
        code: "INVALID_THICKNESS",
        severity: "error",
        message: `Espessura de chapa inválida (${sheetMetal.thickness} mm). Deve ser maior que zero.`,
      });
    }

    // 3. Validação do Fator K (faixa física usual 0.20 a 0.50)
    if (sheetMetal.defaultKFactor < 0 || sheetMetal.defaultKFactor > 1) {
      issues.push({
        code: "INVALID_K_FACTOR",
        severity: "error",
        message: `Fator K fora dos limites físicos válidos [0.0, 1.0]: ${sheetMetal.defaultKFactor}.`,
      });
    } else if (sheetMetal.defaultKFactor < 0.2 || sheetMetal.defaultKFactor > 0.5) {
      issues.push({
        code: "ATYPICAL_K_FACTOR",
        severity: "warning",
        message: `Fator K atípico (${sheetMetal.defaultKFactor}). A maioria dos materiais varia entre 0.25 e 0.45.`,
      });
    }

    // 4. Validação do raio interno de dobra
    if (sheetMetal.defaultBendRadius < sheetMetal.thickness * 0.5) {
      issues.push({
        code: "SHARP_BEND_RADIUS",
        severity: "warning",
        message: `Raio de dobra padrão (${sheetMetal.defaultBendRadius} mm) inferior a 0.5× a espessura. Risco de trinca mecânica na fibra externa.`,
      });
    }

    // 5. Validação da face fixa
    const fixedFace = sheetMetal.solidBody.faces.find((f) => f.id === sheetMetal.fixedFaceId);
    if (!fixedFace) {
      issues.push({
        code: "MISSING_FIXED_FACE",
        severity: "error",
        message: `Face fixa '${sheetMetal.fixedFaceId}' não existe no corpo sólido.`,
      });
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning");

    return {
      status: hasErrors ? "ERROR" : hasWarnings ? "WARNING" : "PASS",
      isValid: !hasErrors,
      issues,
    };
  }
}
