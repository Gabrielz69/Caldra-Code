/**
 * CALDRA CAD — CATÁLOGO DE MATERIAIS PARA ANÁLISE ESTRUTURAL (FASE 15)
 *
 * Propriedades mecânicas e elásticas canônicas para ligas metálicas industriais,
 * chapas de caldeiraria e perfis estruturais.
 */

import type { FeaMaterial } from "./types";

export const FEA_MATERIALS: Record<string, FeaMaterial> = {
  ASTM_A36: {
    id: "ASTM_A36",
    name: "Aço Carbono Estrutural ASTM A36",
    youngsModulus: 200000, // 200 GPa = 200,000 MPa
    poissonsRatio: 0.26,
    yieldStrength: 250, // 250 MPa
    tensileStrength: 400, // 400 MPa
    densityKgM3: 7850,
    thermalExpansion: 1.2e-5,
  },
  SAE_1020: {
    id: "SAE_1020",
    name: "Aço Carbono SAE 1020",
    youngsModulus: 205000,
    poissonsRatio: 0.29,
    yieldStrength: 210,
    tensileStrength: 380,
    densityKgM3: 7850,
    thermalExpansion: 1.17e-5,
  },
  AISI_304: {
    id: "AISI_304",
    name: "Aço Inoxidável Austenítico AISI 304",
    youngsModulus: 193000,
    poissonsRatio: 0.29,
    yieldStrength: 205,
    tensileStrength: 515,
    densityKgM3: 7930,
    thermalExpansion: 1.73e-5,
  },
  AL_6061_T6: {
    id: "AL_6061_T6",
    name: "Alumínio Estrutural 6061-T6",
    youngsModulus: 68900,
    poissonsRatio: 0.33,
    yieldStrength: 276,
    tensileStrength: 310,
    densityKgM3: 2700,
    thermalExpansion: 2.36e-5,
  },
  HARDOX_450: {
    id: "HARDOX_450",
    name: "Aço Resistente ao Desgaste Hardox 450",
    youngsModulus: 210000,
    poissonsRatio: 0.29,
    yieldStrength: 1200,
    tensileStrength: 1400,
    densityKgM3: 7850,
    thermalExpansion: 1.2e-5,
  },
  CORTEN_A: {
    id: "CORTEN_A",
    name: "Aço Patinável ASTM A588 (Cor-Ten)",
    youngsModulus: 200000,
    poissonsRatio: 0.30,
    yieldStrength: 345,
    tensileStrength: 485,
    densityKgM3: 7850,
    thermalExpansion: 1.2e-5,
  },
};

export function getFeaMaterial(keyOrName?: string): FeaMaterial {
  if (!keyOrName) return FEA_MATERIALS.ASTM_A36;
  const upper = keyOrName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  
  for (const [k, mat] of Object.entries(FEA_MATERIALS)) {
    if (k === upper || mat.name.toUpperCase().includes(keyOrName.toUpperCase())) {
      return mat;
    }
  }
  
  if (upper.includes("INOX") || upper.includes("304") || upper.includes("STAINLESS")) {
    return FEA_MATERIALS.AISI_304;
  }
  if (upper.includes("ALUMINIO") || upper.includes("ALUM") || upper.includes("6061")) {
    return FEA_MATERIALS.AL_6061_T6;
  }
  if (upper.includes("HARDOX") || upper.includes("DESGASTE")) {
    return FEA_MATERIALS.HARDOX_450;
  }
  if (upper.includes("1020")) {
    return FEA_MATERIALS.SAE_1020;
  }
  
  return FEA_MATERIALS.ASTM_A36;
}
