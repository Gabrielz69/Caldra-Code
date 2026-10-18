/**
 * CALDRA CAD CORE — PUBLIC EXPORTS
 *
 * Ponto de entrada oficial da camada de abstração CAD da CALDRA.
 */

export * from "./CadKernelError";
export * from "./CadTopology";
export * from "./CadMesh";
export * from "./CadSelection";
export * from "./CadShape";
export * from "./CadKernel";
export * from "./CadTopologicalNaming";
export { OcctKernelAdapter, getCadKernel } from "./adapters/OcctKernelAdapter";
