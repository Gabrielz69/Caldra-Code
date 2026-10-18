/**
 * CALDRA CAD — WELDMENTS & STRUCTURAL FRAMING TYPES (FASE 10)
 *
 * Tipos e especificações para modelagem de estruturas metálicas,
 * perfis industriais normalizados (I, U, L, tubos, barras), cortes de esquadria (miter),
 * recortes copados (coping), juntas soldadas e lista de corte estrutural (Cut List).
 */

import type { Vector3D, SolidBody3D } from "../canonical";

/** Tipos de seções transversais normalizadas */
export type ProfileType =
  | "I_BEAM" // Perfis I / W (Vigas de abas paralelas ou inclinadas)
  | "U_CHANNEL" // Perfis U / UDC (Canais)
  | "L_ANGLE" // Cantoneiras de abas iguais ou desiguais
  | "RECT_TUBE" // Tubos estruturais retangulares / quadrados (Metalon)
  | "ROUND_TUBE" // Tubos redondos industriais / Sch 40
  | "FLAT_BAR"; // Barras chatas laminadas

/** Definição geométrica da seção de um perfil */
export interface ProfileSection {
  type: ProfileType;
  designation: string; // Ex: "W150x13", "U 100x50", "L 50x50x4.75", "Tubo 80x40x3"
  standard: string; // Ex: "ASTM A6 / A36", "NBR 5884", "DIN 1025"
  heightMm: number; // Altura externa total (h)
  widthMm: number; // Largura externa total (b)
  webThicknessMm: number; // Espessura da alma (tw)
  flangeThicknessMm: number; // Espessura da aba (tf)
  innerRadiusMm?: number; // Raio de concordância interno (r)
  outerRadiusMm?: number; // Raio externo (para tubos retangulares/quadrados)
  diameterMm?: number; // Diâmetro externo (para tubos redondos)
  wallThicknessMm?: number; // Espessura da parede (para tubos)
  linearMassKgM: number; // Massa linear nominal (kg/m)
  areaCm2: number; // Área da seção transversal (cm²)
  ixCm4?: number; // Momento de inércia eixo X (cm4)
  iyCm4?: number; // Momento de inércia eixo Y (cm4)
}

/** Tipo de tratamento em cantos e junções estruturais */
export type CornerTreatmentType =
  | "MITER" // Corte de esquadria 45° ou bissetriz angular
  | "BUTT_1" // Encontro de topo: membro 1 encosta no membro 2
  | "BUTT_2" // Encontro de topo: membro 2 encosta no membro 1
  | "COPE" // Recorte copado (encaixe da alma de uma viga na aba/alma da outra)
  | "OPEN"; // Sem tratamento (sobreposição livre)

/** Ponto de alinhamento / inserção da seção ao longo do caminho */
export type ProfileAlignment =
  | "CENTER"
  | "TOP_LEFT"
  | "TOP_CENTER"
  | "TOP_RIGHT"
  | "CENTER_LEFT"
  | "CENTER_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_CENTER"
  | "BOTTOM_RIGHT";

/** Membro estrutural 3D */
export interface StructuralMember {
  id: string;
  name: string;
  profile: ProfileSection;
  startPoint: Vector3D;
  endPoint: Vector3D;
  lengthMm: number;
  rotationDeg: number; // Rotação axial do perfil em graus
  alignment: ProfileAlignment;
  cutAngleStartDeg: number; // Ângulo de corte inicial (90° = reto, 45° = esquadria)
  cutAngleEndDeg: number; // Ângulo de corte final
  weldGapMm: number; // Folga de solda / alívio (ex: 1.5mm)
  solid?: SolidBody3D; // Sólido B-Rep gerado
}

/** Tipo de junta soldada estrutural */
export type WeldType =
  | "FILLET" // Solda de filete
  | "BUTT_SQUARE" // Solda de topo com bordas retas
  | "BUTT_V" // Solda de topo chanfrada em V
  | "BEVEL"; // Solda com chanfro simples

/** Especificação de um cordão de solda */
export interface StructuralWeld {
  id: string;
  type: WeldType;
  legSizeMm: number; // Perna de solda (z) em mm
  throatSizeMm: number; // Garganta da solda (a) em mm
  lengthMm: number; // Comprimento do cordão
  weldProcess: "MIG_MAG" | "TIG" | "SMAW_ELETRODO";
  materialYieldKgM: number; // Consumo de arame/eletrodo por metro linear (kg/m)
  totalConsumableKg: number; // Massa total estimada de metal de adição
}

/** Item da Lista de Corte de Perfis Estruturais (Cut List) */
export interface WeldmentCutListItem {
  itemNumber: number;
  profileDesignation: string;
  profileType: ProfileType;
  material: string;
  cutLengthMm: number;
  quantity: number;
  angle1Deg: number; // Ângulo de corte na extremidade 1
  angle2Deg: number; // Ângulo de corte na extremidade 2
  linearMassKgM: number;
  unitMassKg: number;
  totalMassKg: number;
}

/** Relatório consolidado do Frame Estrutural */
export interface StructuralFrameReport {
  projectName: string;
  totalMembersCount: number;
  totalLengthMeters: number;
  totalMassKg: number;
  cutList: WeldmentCutListItem[];
  rawStockBarsNeeded: {
    profileDesignation: string;
    standardBarLengthMeters: number; // Ex: 6m ou 12m
    barsCount: number;
    scrapPercentage: number;
  }[];
  totalWeldLengthMeters: number;
  totalWeldConsumablesKg: number;
}
