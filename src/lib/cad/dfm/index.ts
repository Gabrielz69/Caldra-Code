/**
 * CALDRA CAD — DFM (DESIGN FOR MANUFACTURING) & FABRICABILITY (FASE 13)
 *
 * Módulo completo de auditoria de fabricabilidade e orçamentação industrial:
 * - types: Interfaces de regras, apontamentos, severidades e formação de custos
 * - dfmEngine: Motor de auditoria analítica e cálculo de DFM score
 * - dfmCostEngine: Motor de custeio por processo térmico, punção e dobra mecânica
 * - dfmReportExporter: Exportador de relatórios executivos em CSV e anotações DXF
 */

export * from "./types";
export * from "./dfmEngine";
export * from "./dfmCostEngine";
export * from "./dfmReportExporter";
