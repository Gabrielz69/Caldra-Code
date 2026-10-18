/**
 * CALDRA CAD — FLAT PATTERN & FABRICATION BRIDGE (FASE 08)
 *
 * Conecta o modelo 3D B-Rep (CAD CORE) aos algoritmos analíticos de planificação,
 * desenvolvimento de chapa, geração de DXF multicamadas, código G para corte CNC
 * e cálculo de dobras e geratrizes da CALDRA.
 *
 * Respeita a regra de ouro da Seção 9:
 * "O modelo 3D é o elemento central. A planificação decorre dele."
 */

import { BoilermakingEngine } from "../boilermaking/boilermakingEngine";
import type { BoilermakingFlatPattern } from "../boilermaking/types";
import type { CadFeatureNode } from "../features/CadFeatureModel";

export interface FlatPatternResult {
  partName: string;
  material: string;
  thickness: number;
  widthMm: number;
  heightMm: number;
  areaMm2: number;
  perimeterCutMm: number;
  bendCount: number;
  dxfString: string;
  gcodeString: string;
  svgPath: string;
  entities: {
    id: string;
    type: "line" | "arc" | "circle";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    layer: "CORTE" | "DOBRA" | "TEXTO";
  }[];
  bendingInstructions: {
    generatorIndex: number;
    positionMm: number;
    angleDeg: number;
    chordLengthMm: number;
  }[];
}

export class CaldraFlatPatternBridge {
  /**
   * Extrai parâmetros do sólido na árvore de recursos e calcula a planificação analítica
   */
  static generateFlatPatternFromFeatures(
    features: readonly CadFeatureNode[],
    fallbackDimensions = { width: 100, length: 100, thickness: 3 },
  ): FlatPatternResult {
    // 1. Procura por modelo paramétrico de caldeiraria na árvore
    const boilermakingFeature = features.find((f) =>
      f.type.startsWith("boilermaking_") || f.type === "base_box"
    );

    if (boilermakingFeature) {
      const p = boilermakingFeature.parameters as Record<string, unknown>;

      // CONE TRUNCADO
      if (boilermakingFeature.type === "boilermaking_cone") {
        const D = Number(p.D ?? 120);
        const d = Number(p.d ?? 70);
        const H = Number(p.height ?? 100);
        const t = Number(p.thickness ?? 3);
        const res = BoilermakingEngine.generateTruncatedCone({
          D,
          d,
          H,
          thickness: t,
          divisions: 24,
        });
        return this.formatBoilermakingResult(
          "Cone Truncado",
          t,
          res.flatPatterns[0],
        );
      }

      // TRANSIÇÃO QUADRADO PARA REDONDO
      if (boilermakingFeature.type === "boilermaking_transition") {
        const W = Number(p.width ?? 120);
        const L = Number(p.length ?? 120);
        const dia = Number(p.diameter ?? 80);
        const H = Number(p.height ?? 100);
        const t = Number(p.thickness ?? 4.75);
        const res = BoilermakingEngine.generateSquareToRound({
          baseWidth: W,
          baseLength: L,
          topDiameter: dia,
          height: H,
          thickness: t,
          divisionsPerCorner: 4,
        });
        return this.formatBoilermakingResult(
          "Transição Quadrado para Redondo",
          t,
          res.flatPatterns[0],
        );
      }

      // CURVA DE GOMOS (COTOVELO)
      if (boilermakingFeature.type === "boilermaking_elbow") {
        const dia = Number(p.diameter ?? 80);
        const R = Number(p.radius ?? 120);
        const angle = Number(p.angleDeg ?? 90);
        const segs = Number(p.segments ?? 4);
        const t = Number(p.thickness ?? 3.17);
        const res = BoilermakingEngine.generateSegmentedElbow({
          diameter: dia,
          bendRadius: R,
          totalAngleDeg: angle,
          segmentsCount: segs,
          thickness: t,
        });
        return this.formatBoilermakingResult(
          "Gomo de Cotovelo",
          t,
          res.flatPatterns[0],
        );
      }

      // BOCA DE LOBO / TÊ
      if (boilermakingFeature.type === "boilermaking_branch") {
        const mainD = Number(p.mainDiameter ?? 100);
        const branchD = Number(p.branchDiameter ?? 60);
        const mainL = Number(p.mainLength ?? 180);
        const branchH = Number(p.branchHeight ?? 80);
        const t = Number(p.thickness ?? 4.75);
        const res = BoilermakingEngine.generateCylindricalBranch({
          mainDiameter: mainD,
          branchDiameter: branchD,
          mainLength: mainL,
          branchHeight: branchH,
          thickness: t,
        });
        return this.formatBoilermakingResult(
          "Ramal Boca de Lobo",
          t,
          res.flatPatterns[0],
        );
      }

      // CHAPÉU CHINÊS
      if (boilermakingFeature.type === "boilermaking_hood") {
        const D = Number(p.baseDiameter ?? 160);
        const d = Number(p.topDiameter ?? 35);
        const H = Number(p.height ?? 60);
        const t = Number(p.thickness ?? 2.0);
        const res = BoilermakingEngine.generateTruncatedCone({
          D,
          d,
          H,
          thickness: t,
          divisions: 36,
        });
        return this.formatBoilermakingResult(
          "Chapéu Chinês",
          t,
          res.flatPatterns[0],
        );
      }

      // CAIXA BASE / CHAPA PLANA
      if (boilermakingFeature.type === "base_box") {
        const W = Number(p.width ?? fallbackDimensions.width);
        const L = Number(p.length ?? fallbackDimensions.length);
        const t = Number(p.height ?? fallbackDimensions.thickness);
        return this.generatePlateFlatPattern("Chapa Retangular B-Rep", W, L, t);
      }
    }

    // Fallback padrão se nenhuma feature de caldeiraria estiver explícita
    return this.generatePlateFlatPattern(
      "Chapa Plana Padrão",
      fallbackDimensions.width,
      fallbackDimensions.length,
      fallbackDimensions.thickness,
    );
  }

  /**
   * Converte o resultado de planificação da CALDRA em DXF, G-Code e SVG
   */
  private static formatBoilermakingResult(
    partName: string,
    thickness: number,
    pattern?: BoilermakingFlatPattern,
  ): FlatPatternResult {
    if (!pattern) {
      return this.generatePlateFlatPattern(partName, 100, 100, thickness);
    }

    const width = pattern.blankWidth;
    const height = pattern.blankLength;
    let perimeter = 0;

    const entities: FlatPatternResult["entities"] = [];

    for (const e of pattern.entities) {
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
      if (e.layer === "CORTE") perimeter += len;

      entities.push({
        id: e.id,
        type: "line",
        x1: e.x1,
        y1: e.y1,
        x2: e.x2,
        y2: e.y2,
        layer: e.layer as "CORTE" | "DOBRA" | "TEXTO",
      });
    }

    // Gera DXF R12 industrial
    const dxfString = this.formatDxfR12(entities, partName);

    // Gera Código G CNC Plasma/Laser
    const gcodeString = this.generateCncGCode(partName, entities, thickness);

    // Gera SVG path string
    const svgPath = this.generateSvgPath(entities);

    return {
      partName,
      material: "Aço Carbono A36",
      thickness,
      widthMm: width,
      heightMm: height,
      areaMm2: width * height * 0.85,
      perimeterCutMm: perimeter,
      bendCount: pattern.bendingInstructions?.length ?? 0,
      dxfString,
      gcodeString,
      svgPath,
      entities,
      bendingInstructions: pattern.bendingInstructions ?? [],
    };
  }

  /**
   * Gera planificação direta para chapa plana retangular
   */
  private static generatePlateFlatPattern(
    partName: string,
    width: number,
    length: number,
    thickness: number,
  ): FlatPatternResult {
    const hw = width / 2;
    const hl = length / 2;

    const entities: FlatPatternResult["entities"] = [
      { id: "e1", type: "line", x1: -hw, y1: -hl, x2: hw, y2: -hl, layer: "CORTE" },
      { id: "e2", type: "line", x1: hw, y1: -hl, x2: hw, y2: hl, layer: "CORTE" },
      { id: "e3", type: "line", x1: hw, y1: hl, x2: -hw, y2: hl, layer: "CORTE" },
      { id: "e4", type: "line", x1: -hw, y1: hl, x2: -hw, y2: -hl, layer: "CORTE" },
    ];

    const dxfString = this.formatDxfR12(entities, partName);
    const gcodeString = this.generateCncGCode(partName, entities, thickness);
    const svgPath = this.generateSvgPath(entities);

    return {
      partName,
      material: "Aço Carbono A36",
      thickness,
      widthMm: width,
      heightMm: length,
      areaMm2: width * length,
      perimeterCutMm: 2 * (width + length),
      bendCount: 0,
      dxfString,
      gcodeString,
      svgPath,
      entities,
      bendingInstructions: [],
    };
  }

  /**
   * Gera arquivo DXF AutoCAD R12 padrão industrial com camadas CORTE e DOBRA
   */
  public static formatDxfR12(
    entities: FlatPatternResult["entities"],
    source = "CALDRA CAD",
  ): string {
    const lines: string[] = [
      "0", "SECTION",
      "2", "HEADER",
      "9", "$ACADVER",
      "1", "AC1009",
      "0", "ENDSEC",
      "0", "SECTION",
      "2", "TABLES",
      "0", "TABLE",
      "2", "LAYER",
      "70", "3",
      "0", "LAYER",
      "2", "CORTE",
      "70", "0",
      "62", "3", // Verde
      "6", "CONTINUOUS",
      "0", "LAYER",
      "2", "DOBRA",
      "70", "0",
      "62", "6", // Magenta
      "6", "DASHED",
      "0", "LAYER",
      "2", "TEXTO",
      "70", "0",
      "62", "7", // Branco
      "6", "CONTINUOUS",
      "0", "ENDTAB",
      "0", "ENDSEC",
      "0", "SECTION",
      "2", "ENTITIES",
    ];

    for (const e of entities) {
      lines.push(
        "0", "LINE",
        "8", e.layer,
        "10", e.x1.toFixed(4),
        "20", e.y1.toFixed(4),
        "30", "0.0",
        "11", e.x2.toFixed(4),
        "21", e.y2.toFixed(4),
        "31", "0.0"
      );
    }

    lines.push("0", "ENDSEC", "0", "EOF");
    return lines.join("\n");
  }

  /**
   * Constrói G-Code ISO padrão para CNC Plasma / Laser / Oxicorte
   */
  private static generateCncGCode(
    partName: string,
    entities: FlatPatternResult["entities"],
    thickness: number,
  ): string {
    const cutLines = entities.filter((e) => e.layer === "CORTE");
    const feed = thickness > 6 ? 1200 : 2500;

    let g = `( ========================================== )\n`;
    g += `( CALDRA CAD — CNC POST PROCESSOR G-CODE     )\n`;
    g += `( PECA: ${partName.toUpperCase()}            )\n`;
    g += `( ESPESSURA: ${thickness.toFixed(2)} MM     )\n`;
    g += `( DATA: ${new Date().toISOString()}          )\n`;
    g += `( ========================================== )\n`;
    g += `G21 (Modo Milimetros)\n`;
    g += `G90 (Coordenadas Absolutas)\n`;
    g += `G00 Z10.0 (Altura de Seguranca)\n\n`;

    if (cutLines.length > 0) {
      const first = cutLines[0];
      g += `( Inicio do Perfil de Corte Externo )\n`;
      g += `G00 X${first.x1.toFixed(3)} Y${first.y1.toFixed(3)}\n`;
      g += `G00 Z1.5 (Altura de Perfuracao)\n`;
      g += `M03 (Plasma / Laser ON)\n`;
      g += `G04 P0.4 (Delay de Perfuracao)\n`;
      g += `G01 Z0.0 F1000\n`;

      for (const line of cutLines) {
        g += `G01 X${line.x2.toFixed(3)} Y${line.y2.toFixed(3)} F${feed}\n`;
      }

      g += `M05 (Plasma / Laser OFF)\n`;
      g += `G00 Z25.0 (Retracao Final)\n`;
    }

    g += `\nG00 X0.0 Y0.0 (Retorno a Origem da Maquina)\n`;
    g += `M30 (Fim de Programa)\n`;

    return g;
  }

  /**
   * Monta representação de SVG path para visualização imediata 2D
   */
  private static generateSvgPath(entities: FlatPatternResult["entities"]): string {
    if (entities.length === 0) return "";
    let d = "";
    for (const e of entities) {
      d += `M ${e.x1.toFixed(2)} ${e.y1.toFixed(2)} L ${e.x2.toFixed(2)} ${e.y2.toFixed(2)} `;
    }
    return d;
  }
}
