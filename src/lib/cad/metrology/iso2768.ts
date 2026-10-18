/**
 * CALDRA CAD — TABELAS DE TOLERÂNCIAS GERAIS ISO 2768-1 & ISO 2768-2 (FASE 14)
 *
 * Padrão internacional para caldeiraria, chaparia e usinagem:
 * - ISO 2768-1: Tolerâncias lineares e angulares sem indicação individual
 *   (f - fina, m - média, c - grosseira, v - muito grosseira)
 * - ISO 2768-2: Tolerâncias geométricas gerais (H, K, L)
 */

import type { ToleranceClass } from "./types";

interface LinearToleranceRange {
  min: number;
  max: number;
  f: number; // fina
  m: number; // média
  c: number; // grosseira
  v: number; // muito grosseira
}

// ISO 2768-1: Tabela 1 — Tolerâncias para dimensões lineares (exceto arestas chanfradas)
const LINEAR_TOLERANCES: LinearToleranceRange[] = [
  { min: 0.5, max: 3, f: 0.05, m: 0.1, c: 0.2, v: 0.5 },
  { min: 3, max: 6, f: 0.05, m: 0.1, c: 0.3, v: 0.5 },
  { min: 6, max: 30, f: 0.1, m: 0.2, c: 0.5, v: 1.0 },
  { min: 30, max: 120, f: 0.15, m: 0.3, c: 0.8, v: 1.5 },
  { min: 120, max: 400, f: 0.2, m: 0.5, c: 1.2, v: 2.5 },
  { min: 400, max: 1000, f: 0.3, m: 0.8, c: 2.0, v: 4.0 },
  { min: 1000, max: 2000, f: 0.5, m: 1.2, c: 3.0, v: 6.0 },
  { min: 2000, max: 4000, f: 0.8, m: 2.0, c: 4.0, v: 8.0 },
];

interface AngularToleranceRange {
  min: number; // comprimento do lado mais curto em mm
  max: number;
  fDeg: number;
  mDeg: number;
  cDeg: number;
  vDeg: number;
}

// ISO 2768-1: Tabela 3 — Tolerâncias para dimensões angulares
const ANGULAR_TOLERANCES: AngularToleranceRange[] = [
  { min: 0, max: 10, fDeg: 1.0, mDeg: 1.0, cDeg: 1.5, vDeg: 3.0 },
  { min: 10, max: 50, fDeg: 0.5, mDeg: 0.5, cDeg: 1.0, vDeg: 2.0 },
  { min: 50, max: 120, fDeg: 0.33, mDeg: 0.33, cDeg: 0.5, vDeg: 1.0 },
  { min: 120, max: 400, fDeg: 0.17, mDeg: 0.17, cDeg: 0.25, vDeg: 0.5 },
  { min: 400, max: 10000, fDeg: 0.08, mDeg: 0.08, cDeg: 0.17, vDeg: 0.33 },
];

/**
 * Obtém a tolerância simétrica (±) para uma dimensão linear segundo a classe ISO 2768-1.
 */
export function getLinearTolerance(
  dimension: number,
  toleranceClass: ToleranceClass = "ISO_2768_M",
): { upper: number; lower: number; val: number } {
  const absDim = Math.abs(dimension);
  const row = LINEAR_TOLERANCES.find((r) => absDim >= r.min && absDim <= r.max);

  let val = 0.5; // fallback
  if (row) {
    switch (toleranceClass) {
      case "ISO_2768_F":
        val = row.f;
        break;
      case "ISO_2768_M":
        val = row.m;
        break;
      case "ISO_2768_C":
        val = row.c;
        break;
      case "ISO_2768_V":
        val = row.v;
        break;
    }
  } else if (absDim > 4000) {
    val = toleranceClass === "ISO_2768_C" ? 6.0 : 4.0;
  }

  return { upper: val, lower: -val, val };
}

/**
 * Obtém a tolerância angular (± em graus) segundo ISO 2768-1.
 */
export function getAngularTolerance(
  shortLegLength: number,
  toleranceClass: ToleranceClass = "ISO_2768_M",
): { upperDeg: number; lowerDeg: number; valDeg: number } {
  const absLen = Math.abs(shortLegLength);
  const row = ANGULAR_TOLERANCES.find((r) => absLen >= r.min && absLen <= r.max);

  let valDeg = 0.5;
  if (row) {
    switch (toleranceClass) {
      case "ISO_2768_F":
        valDeg = row.fDeg;
        break;
      case "ISO_2768_M":
        valDeg = row.mDeg;
        break;
      case "ISO_2768_C":
        valDeg = row.cDeg;
        break;
      case "ISO_2768_V":
        valDeg = row.vDeg;
        break;
    }
  }

  return { upperDeg: valDeg, lowerDeg: -valDeg, valDeg };
}

/**
 * Retorna a tolerância de planicidade (mm) geral segundo ISO 2768-2 (Classe K industrial).
 */
export function getGeneralFlatnessTolerance(diagonalLength: number): number {
  if (diagonalLength <= 100) return 0.2;
  if (diagonalLength <= 300) return 0.4;
  if (diagonalLength <= 1000) return 0.8;
  return 1.2;
}

/**
 * Retorna a tolerância de perpendicularidade (mm) geral segundo ISO 2768-2 (Classe K industrial).
 */
export function getGeneralPerpendicularityTolerance(longerSideLength: number): number {
  if (longerSideLength <= 100) return 0.2;
  if (longerSideLength <= 300) return 0.4;
  if (longerSideLength <= 1000) return 0.6;
  return 0.8;
}
