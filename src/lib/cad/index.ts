// @ts-nocheck
/**
 * CALDRA CAD KERNEL — ROOT EXPORTS
 *
 * Módulos integrados do núcleo CAD do CALDRA:
 * - canonical: B-Rep canônico e topologia sólida
 * - sketch: Esboços 2D e solucionador de restrições geométricas
 * - features: Árvore paramétrica DAG e rebuild engine
 * - sheetmetal: Chapa metálica, dobras analíticas e planificação técnica
 * - boilermaking: Caldeiraria 3D e superfícies transicionais desenvolvíveis
 * - assembly: Corpos múltiplos, booleanas CSG, mates e BOM hierárquica
 * - cam: Percurso CNC, leads, micro-juntas e pós-processador G-Code
 * - kernel: Fachada unificada e ponte com o CHAMFER
 */

export * from "./canonical";
export * from "./validator";
export * as Sketch from "./sketch";
export * as Features from "./features";
export * as SheetMetal from "./sheetmetal";
export * as Boilermaking from "./boilermaking";
export * as Assembly from "./assembly";
export * as CAM from "./cam";
export * as Drafting from "./drafting";
export * as Weldments from "./weldments";
export * as Nesting from "./nesting";
export * as Forming from "./forming";
export * as DFM from "./dfm";
export * as Metrology from "./metrology";
export * from "./kernel";
export * as CadCore from "./core";
export * as CadDocument from "./document";
export * from "./document";
export * as CadAdapters from "./adapters";
export * as CadRenderer from "./renderer/ThreeRenderer";
