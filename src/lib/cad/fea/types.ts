/**
 * CALDRA CAD — ANÁLISE ESTRUTURAL POR ELEMENTOS FINITOS (FEA / CAE) (FASE 15)
 *
 * Tipos e interfaces para cálculo mecânico estrutural:
 * - Propriedades elásticas dos materiais (Módulo de Young, Coeficiente de Poisson, Escoamento)
 * - Condições de contorno (Fixações, Engastes, Apoios, Deslocamentos prescritos)
 * - Carregamentos mecânicos (Forças concentradas, Cargas distribuídas, Pressão, Gravidade)
 * - Malha de elementos finitos (Vigas 1D e Elementos de Casca/Chapa 2D CST - Constant Strain Triangles)
 * - Resultados: Deformações nodais, Campo de Tensões de Von Mises, Fator de Segurança e Verificação NBR 8800 / Eurocode
 */

export interface FeaMaterial {
  id: string;
  name: string;
  youngsModulus: number; // Módulo de Elasticidade E em MPa (N/mm²) — ex: 200,000 MPa para Aço
  poissonsRatio: number; // Coeficiente de Poisson ν — ex: 0.3
  yieldStrength: number; // Tensão de escoamento fy em MPa — ex: 250 MPa (A36)
  tensileStrength: number; // Limite de resistência à tração fu em MPa — ex: 400 MPa
  densityKgM3: number; // Densidade em kg/m³ — ex: 7850
  thermalExpansion?: number; // 1/°C
}

export type FeaBoundaryType = "FIXED" | "PINNED" | "ROLLER_X" | "ROLLER_Y" | "ROLLER_Z" | "SYMMETRY";

export interface FeaBoundaryCondition {
  id: string;
  name: string;
  type: FeaBoundaryType;
  nodeIds?: number[];
  edge?: "left" | "right" | "top" | "bottom" | "holes" | "custom";
  prescribedDisplacement?: { x?: number; y?: number; z?: number };
}

export type FeaLoadType = "POINT_FORCE" | "DISTRIBUTED_EDGE" | "SURFACE_PRESSURE" | "GRAVITY";

export interface FeaLoad {
  id: string;
  name: string;
  type: FeaLoadType;
  nodeIds?: number[];
  edge?: "left" | "right" | "top" | "bottom" | "custom";
  force?: { fx: number; fy: number; fz: number }; // Força em Newtons (N)
  intensityNPerMm?: number; // Para carga distribuída em arestas (N/mm)
  pressureMPa?: number; // Para pressão em superfície (MPa)
}

export interface FeaNode {
  id: number;
  x: number; // mm
  y: number; // mm
  z: number; // mm
  u?: number; // Deslocamento em X (mm)
  v?: number; // Deslocamento em Y (mm)
  w?: number; // Deslocamento em Z (mm)
  totalDisp?: number; // Magnitude do deslocamento √(u² + v² + w²) em mm
  isRestrained?: boolean;
}

export interface FeaElement {
  id: number;
  type: "CST_TRIANGLE" | "BEAM_1D";
  nodeIds: number[]; // [n1, n2, n3] para triângulo CST ou [n1, n2] para viga
  thickness: number; // mm
  area: number; // mm²
  stress?: {
    sigmaX: number; // MPa
    sigmaY: number; // MPa
    tauXY: number; // MPa
    sigma1: number; // Tensão Principal Maior (MPa)
    sigma2: number; // Tensão Principal Menor (MPa)
    vonMises: number; // Tensão Equivalente de Von Mises (MPa)
  };
}

export interface FeaMesh {
  nodes: FeaNode[];
  elements: FeaElement[];
  numNodes: number;
  numElements: number;
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number };
}

export type FeaSafetyStatus = "SAFE" | "MARGINAL" | "CRITICAL_FAILURE";

export interface FeaHotspot {
  elementId: number;
  center: { x: number; y: number };
  vonMisesMPa: number;
  description: string;
}

export interface FeaAnalysisResult {
  id: string;
  partId: string;
  partName: string;
  timestamp: number;
  material: FeaMaterial;
  thicknessMm: number;
  mesh: FeaMesh;
  boundaryConditions: FeaBoundaryCondition[];
  loads: FeaLoad[];
  
  // Resultados globais
  maxDeflectionMm: number;
  maxDeflectionNodeId: number;
  maxVonMisesMPa: number;
  maxVonMisesElementId: number;
  minVonMisesMPa: number;
  avgVonMisesMPa: number;
  
  // Critérios de engenharia e normas
  yieldStrengthMPa: number;
  minFactorOfSafety: number; // FOS = fy / σ_vm_max
  status: FeaSafetyStatus;
  allowableDeflectionMm: number; // Ex: L/300 conforme NBR 8800
  deflectionPassed: boolean;
  
  hotspots: FeaHotspot[];
  summaryMessage: string;
}

export interface FeaSimulationOptions {
  materialId?: string;
  loadCase?: "TENSION" | "CANTILEVER_BENDING" | "PRESSURE" | "DISTRIBUTED" | "CUSTOM";
  appliedForceN?: number;
  pressureMPa?: number;
  meshRefinement?: "COARSE" | "MEDIUM" | "FINE";
}
