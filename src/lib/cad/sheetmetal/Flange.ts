/**
 * CALDRA CAD CORE — SHEET METAL: FLANGE (Seção 5 e 10)
 *
 * Definição paramétrica de abas/flanges dobradas em chapa metálica.
 */

export type FlangePositionType = "outer-virtual-sharp" | "inner-virtual-sharp" | "bend-tangent";

export interface FlangeDefinition {
  id: string;
  edgeIndex: number;
  length: number;
  angleDeg: number;
  position: FlangePositionType;
  innerRadius?: number;
  offsetStart?: number;
  offsetEnd?: number;
}

export class Flange {
  static createDefault(edgeIndex = 0, length = 30, angleDeg = 90): FlangeDefinition {
    return {
      id: `flange_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      edgeIndex,
      length,
      angleDeg,
      position: "outer-virtual-sharp",
    };
  }
}
