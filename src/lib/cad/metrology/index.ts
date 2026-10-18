/**
 * CALDRA CAD — METROLOGIA INDUSTRIAL, GD&T & INSPEÇÃO DE QUALIDADE (FASE 14)
 *
 * Módulo de metrologia dimensional, toleranciamento geométrico e controle da qualidade:
 * - ISO 2768-1 e ISO 2768-2 (tolerâncias gerais lineares, angulares e geométricas)
 * - GD&T conforme ASME Y14.5 e ISO 1101 (Posição Verdadeira, Perpendicularidade, Planicidade, etc.)
 * - Geração de Plano de Inspeção e Mapa de Balões (#1, #2, ...) para FAI / PPAP
 * - Exportação de Relatório FAI em CSV e Prancha Baloneada em SVG
 */

export * from "./types";
export * from "./iso2768";
export * from "./gdtEngine";
export * from "./inspectionEngine";
export * from "./faiReportExporter";
