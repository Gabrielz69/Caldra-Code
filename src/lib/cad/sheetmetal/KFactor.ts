/**
 * CALDRA CAD CORE — SHEET METAL: K-FACTOR (Seção 5 e 10)
 *
 * Determinação paramétrica do Fator K conforme o material, espessura e método de conformação:
 * K = distância da fibra neutra até a face interna / espessura
 */

export type SheetMetalMaterialType =
  | "carbon-steel"
  | "stainless-steel"
  | "aluminum"
  | "copper"
  | "brass";

export class KFactor {
  /**
   * Fator K padrão por material e relação R/T (Raio interno / Espessura)
   */
  static getDefault(material: SheetMetalMaterialType = "carbon-steel", rOverT = 1.0): number {
    if (rOverT < 1.0) {
      switch (material) {
        case "carbon-steel":
          return 0.38;
        case "stainless-steel":
          return 0.40;
        case "aluminum":
          return 0.35;
        default:
          return 0.38;
      }
    } else if (rOverT <= 2.5) {
      switch (material) {
        case "carbon-steel":
          return 0.42;
        case "stainless-steel":
          return 0.44;
        case "aluminum":
          return 0.40;
        default:
          return 0.42;
      }
    } else {
      // Para raios grandes, a linha neutra aproxima-se do centro (0.5)
      return 0.48;
    }
  }

  /**
   * Converte Fator K em Fator Y (Y = K * PI / 2)
   */
  static toYFactor(kFactor: number): number {
    return kFactor * (Math.PI / 2);
  }
}
