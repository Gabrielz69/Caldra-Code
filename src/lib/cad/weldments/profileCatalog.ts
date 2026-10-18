/**
 * CALDRA CAD — STRUCTURAL PROFILE CATALOG (FASE 10)
 *
 * Catálogo industrial de perfis estruturais normalizados (ABNT NBR / ASTM / DIN)
 * com propriedades geométricas, massa linear e módulos de resistência.
 */

import type { ProfileSection, ProfileType } from "./types";
import { getAllCostaFerroMaterials } from "@/lib/library/costaFerroCatalog";

function mapCostaFerroToProfileSections(): ProfileSection[] {
  const items = getAllCostaFerroMaterials();
  const mapped: ProfileSection[] = [];
  for (const m of items) {
    if (m.category === "CHAPA_ACO" || !m.linearWeightKgM) continue;
    let type: ProfileType = "RECT_TUBE";
    if (m.category === "TUBO_REDONDO_INDUSTRIAL" || m.category === "TUBO_CONDUCAO_DIN_SCH") {
      type = "ROUND_TUBE";
    } else if (m.subcategory.includes("Viga")) {
      type = "I_BEAM";
    } else if (m.subcategory.includes("Perfil U")) {
      type = "U_CHANNEL";
    } else if (m.subcategory.includes("Cantoneira")) {
      type = "L_ANGLE";
    } else if (m.subcategory.includes("Barra Chata")) {
      type = "FLAT_BAR";
    }
    const areaCm2 = +(m.linearWeightKgM / 0.785).toFixed(2);
    mapped.push({
      type,
      designation: m.name,
      standard: `${m.norm} · ${m.origin}`,
      heightMm: m.heightMm,
      widthMm: m.widthMm,
      diameterMm: m.diameterMm,
      wallThicknessMm: m.wallThicknessMm,
      webThicknessMm: m.wallThicknessMm,
      flangeThicknessMm: m.wallThicknessMm,
      linearMassKgM: m.linearWeightKgM,
      areaCm2,
      ixCm4: +((areaCm2 * m.heightMm * m.heightMm) / 1200).toFixed(2),
      iyCm4: +((areaCm2 * m.widthMm * m.widthMm) / 1200).toFixed(2),
    });
  }
  return mapped;
}

export class ProfileCatalog {
  private static profiles: ProfileSection[] = [
    // --- VIGAS W / I (ABNT NBR 5884 / ASTM A6) ---
    {
      type: "I_BEAM",
      designation: "W150x13.0",
      standard: "ASTM A6 / A572 Gr. 50",
      heightMm: 148,
      widthMm: 100,
      webThicknessMm: 4.3,
      flangeThicknessMm: 4.9,
      innerRadiusMm: 6.0,
      linearMassKgM: 13.0,
      areaCm2: 16.6,
      ixCm4: 635,
      iyCm4: 82,
    },
    {
      type: "I_BEAM",
      designation: "W200x15.0",
      standard: "ASTM A6 / A572 Gr. 50",
      heightMm: 200,
      widthMm: 100,
      webThicknessMm: 4.3,
      flangeThicknessMm: 5.2,
      innerRadiusMm: 7.0,
      linearMassKgM: 15.0,
      areaCm2: 19.1,
      ixCm4: 1305,
      iyCm4: 87,
    },
    {
      type: "I_BEAM",
      designation: "W250x17.9",
      standard: "ASTM A6 / A572 Gr. 50",
      heightMm: 251,
      widthMm: 101,
      webThicknessMm: 4.8,
      flangeThicknessMm: 5.3,
      innerRadiusMm: 7.0,
      linearMassKgM: 17.9,
      areaCm2: 22.8,
      ixCm4: 2291,
      iyCm4: 91,
    },

    // --- PERFIS U / CANAL (ABNT NBR 6355 / ASTM A36) ---
    {
      type: "U_CHANNEL",
      designation: "U 75x40",
      standard: "NBR 6355 / ASTM A36",
      heightMm: 75,
      widthMm: 40,
      webThicknessMm: 3.0,
      flangeThicknessMm: 3.0,
      innerRadiusMm: 3.0,
      linearMassKgM: 3.42,
      areaCm2: 4.35,
      ixCm4: 38.2,
      iyCm4: 6.5,
    },
    {
      type: "U_CHANNEL",
      designation: "U 100x50",
      standard: "NBR 6355 / ASTM A36",
      heightMm: 100,
      widthMm: 50,
      webThicknessMm: 3.0,
      flangeThicknessMm: 3.0,
      innerRadiusMm: 3.5,
      linearMassKgM: 4.62,
      areaCm2: 5.88,
      ixCm4: 93.5,
      iyCm4: 14.8,
    },
    {
      type: "U_CHANNEL",
      designation: "U 150x50",
      standard: "NBR 6355 / ASTM A36",
      heightMm: 150,
      widthMm: 50,
      webThicknessMm: 4.75,
      flangeThicknessMm: 4.75,
      innerRadiusMm: 5.0,
      linearMassKgM: 9.02,
      areaCm2: 11.5,
      ixCm4: 395,
      iyCm4: 26.2,
    },

    // --- CANTONEIRAS L (ABNT NBR / ASTM A36) ---
    {
      type: "L_ANGLE",
      designation: "L 25x3",
      standard: "ASTM A36",
      heightMm: 25.4,
      widthMm: 25.4,
      webThicknessMm: 3.18,
      flangeThicknessMm: 3.18,
      innerRadiusMm: 3.0,
      linearMassKgM: 1.19,
      areaCm2: 1.52,
      ixCm4: 0.9,
      iyCm4: 0.9,
    },
    {
      type: "L_ANGLE",
      designation: "L 38x3",
      standard: "ASTM A36",
      heightMm: 38.1,
      widthMm: 38.1,
      webThicknessMm: 3.18,
      flangeThicknessMm: 3.18,
      innerRadiusMm: 3.5,
      linearMassKgM: 1.83,
      areaCm2: 2.33,
      ixCm4: 3.2,
      iyCm4: 3.2,
    },
    {
      type: "L_ANGLE",
      designation: "L 50x4.75",
      standard: "ASTM A36",
      heightMm: 50.8,
      widthMm: 50.8,
      webThicknessMm: 4.76,
      flangeThicknessMm: 4.76,
      innerRadiusMm: 4.5,
      linearMassKgM: 3.63,
      areaCm2: 4.62,
      ixCm4: 11.2,
      iyCm4: 11.2,
    },

    // --- TUBOS ESTRUTURAIS RETANGULARES / METALON (ASTM A500) ---
    {
      type: "RECT_TUBE",
      designation: "Tubo 40x40x2.0",
      standard: "ASTM A500 Grau B",
      heightMm: 40,
      widthMm: 40,
      webThicknessMm: 2.0,
      flangeThicknessMm: 2.0,
      outerRadiusMm: 4.0,
      linearMassKgM: 2.36,
      areaCm2: 3.01,
      ixCm4: 7.2,
      iyCm4: 7.2,
    },
    {
      type: "RECT_TUBE",
      designation: "Tubo 50x30x2.0",
      standard: "ASTM A500 Grau B",
      heightMm: 50,
      widthMm: 30,
      webThicknessMm: 2.0,
      flangeThicknessMm: 2.0,
      outerRadiusMm: 4.0,
      linearMassKgM: 2.36,
      areaCm2: 3.01,
      ixCm4: 10.4,
      iyCm4: 4.8,
    },
    {
      type: "RECT_TUBE",
      designation: "Tubo 80x40x3.0",
      standard: "ASTM A500 Grau B",
      heightMm: 80,
      widthMm: 40,
      webThicknessMm: 3.0,
      flangeThicknessMm: 3.0,
      outerRadiusMm: 6.0,
      linearMassKgM: 5.22,
      areaCm2: 6.65,
      ixCm4: 55.4,
      iyCm4: 18.2,
    },
    {
      type: "RECT_TUBE",
      designation: "Tubo 100x50x3.0",
      standard: "ASTM A500 Grau B",
      heightMm: 100,
      widthMm: 50,
      webThicknessMm: 3.0,
      flangeThicknessMm: 3.0,
      outerRadiusMm: 6.0,
      linearMassKgM: 6.63,
      areaCm2: 8.45,
      ixCm4: 114.2,
      iyCm4: 38.6,
    },

    // --- TUBOS REDONDOS INDUSTRIAIS (NBR 5580 / ASTM A53 Sch 40) ---
    {
      type: "ROUND_TUBE",
      designation: 'Tubo Redondo 1" (33.7x3.2)',
      standard: "NBR 5580 / Sch 40",
      heightMm: 33.7,
      widthMm: 33.7,
      diameterMm: 33.7,
      wallThicknessMm: 3.25,
      webThicknessMm: 3.25,
      flangeThicknessMm: 3.25,
      linearMassKgM: 2.44,
      areaCm2: 3.11,
      ixCm4: 3.7,
      iyCm4: 3.7,
    },
    {
      type: "ROUND_TUBE",
      designation: 'Tubo Redondo 2" (60.3x3.9)',
      standard: "NBR 5580 / Sch 40",
      heightMm: 60.3,
      widthMm: 60.3,
      diameterMm: 60.3,
      wallThicknessMm: 3.91,
      webThicknessMm: 3.91,
      flangeThicknessMm: 3.91,
      linearMassKgM: 5.44,
      areaCm2: 6.93,
      ixCm4: 27.8,
      iyCm4: 27.8,
    },

    // --- BARRAS CHATAS LAMINADAS (ASTM A36) ---
    {
      type: "FLAT_BAR",
      designation: "Barra Chata 50x6.35",
      standard: "ASTM A36",
      heightMm: 50.8,
      widthMm: 6.35,
      webThicknessMm: 6.35,
      flangeThicknessMm: 6.35,
      linearMassKgM: 2.53,
      areaCm2: 3.23,
      ixCm4: 6.95,
      iyCm4: 0.11,
    },
  ];

  /** Retorna todos os perfis disponíveis (incluindo Catálogo Costa Ferro) */
  static getAll(): ProfileSection[] {
    const cf = mapCostaFerroToProfileSections();
    const seen = new Set(cf.map((p) => p.designation.toLowerCase()));
    const legacy = this.profiles.filter((p) => !seen.has(p.designation.toLowerCase()));
    return [...cf, ...legacy];
  }

  /** Busca perfil por designação */
  static get(designation: string): ProfileSection | undefined {
    return this.getAll().find((p) => p.designation.toLowerCase() === designation.toLowerCase());
  }

  /** Filtra perfis por tipo */
  static getByType(type: ProfileType): ProfileSection[] {
    return this.getAll().filter((p) => p.type === type);
  }

  /** Cria especificação paramétrica customizada de tubo retangular/quadrado */
  static createCustomRectTube(
    widthMm: number,
    heightMm: number,
    wallThicknessMm: number,
    designation = `Tubo Custom ${heightMm}x${widthMm}x${wallThicknessMm}`,
  ): ProfileSection {
    const areaMm2 = 2 * wallThicknessMm * (widthMm + heightMm - 2 * wallThicknessMm);
    const areaCm2 = areaMm2 / 100;
    const linearMassKgM = areaCm2 * 0.785; // Aço: 7.85 g/cm3

    return {
      type: "RECT_TUBE",
      designation,
      standard: "CUSTOM ASTM A500",
      heightMm,
      widthMm,
      webThicknessMm: wallThicknessMm,
      flangeThicknessMm: wallThicknessMm,
      linearMassKgM: Number(linearMassKgM.toFixed(2)),
      areaCm2: Number(areaCm2.toFixed(2)),
    };
  }

  /** Cria especificação customizada de viga I / W */
  static createCustomIBeam(
    heightMm: number,
    widthMm: number,
    webThicknessMm: number,
    flangeThicknessMm: number,
    designation = `Viga Custom I ${heightMm}x${widthMm}`,
  ): ProfileSection {
    const areaMm2 =
      2 * (widthMm * flangeThicknessMm) + (heightMm - 2 * flangeThicknessMm) * webThicknessMm;
    const areaCm2 = areaMm2 / 100;
    const linearMassKgM = areaCm2 * 0.785;

    return {
      type: "I_BEAM",
      designation,
      standard: "CUSTOM ASTM A6",
      heightMm,
      widthMm,
      webThicknessMm,
      flangeThicknessMm,
      linearMassKgM: Number(linearMassKgM.toFixed(2)),
      areaCm2: Number(areaCm2.toFixed(2)),
    };
  }
}
