/**
 * CALDRA CAD — ANÁLISE ESTRUTURAL POR ELEMENTOS FINITOS (FEA / CAE) (FASE 15)
 *
 * Módulo completo de simulação estrutural mecânica:
 * - Solucionador elástico linear 2D CST (Constant Strain Triangles)
 * - Matriz de rigidez direta [K]{u} = {F} com pré-condicionamento
 * - Campo de tensões equivalentes de Von Mises, tensões principais e deformações
 * - Fator de Segurança (FOS) contra escoamento e verificação de flechas NBR 8800
 * - Exportação de Memorial de Cálculo em CSV e Mapa de Calor de Tensões em SVG
 */

export * from "./types";
export * from "./materials";
export * from "./mesher";
export * from "./feaEngine";
export * from "./feaReportExporter";
