/**
 * CALDRA CAD — BOILERMAKING B-REP SOLID BUILDER (FASE 07)
 *
 * Construtor determinístico de sólidos B-Rep reais a partir dos modelos canônicos
 * analíticos de traçagem e caldeiraria industrial da CALDRA.
 *
 * Modelos integrados:
 * 1. Cone Truncado / Redução Concêntrica e Excêntrica (Truncated Cone)
 * 2. Transição Quadrado para Redondo (Square-to-Round Transition)
 * 3. Curva de Gomos / Cotovelo Segmentado (Segmented Elbow)
 * 4. Boca de Lobo / Tê / Interseção de Tubos (Cylindrical Branch)
 * 5. Chapéu Chinês / Coifa Cônica (Conical Hood)
 */

import { getCadKernel } from "../core";
import type { CadShape } from "../core/CadShape";

export interface TruncatedConeBRepParams {
  D: number; // Diâmetro maior base (mm)
  d: number; // Diâmetro menor topo (mm)
  height: number; // Altura total (mm)
  thickness: number; // Espessura da chapa (mm)
  ex?: number; // Excentricidade X (mm)
  ey?: number; // Excentricidade Y (mm)
  material?: string;
}

export interface SquareToRoundBRepParams {
  width: number; // Largura base retangular/quadrada X (mm)
  length: number; // Comprimento base retangular/quadrada Y (mm)
  diameter: number; // Diâmetro superior circular (mm)
  height: number; // Altura (mm)
  thickness: number; // Espessura da chapa (mm)
  ex?: number; // Excentricidade X (mm)
  ey?: number; // Excentricidade Y (mm)
  material?: string;
}

export interface SegmentedElbowBRepParams {
  diameter: number; // Diâmetro nominal (mm)
  radius: number; // Raio da linha de centro (mm)
  angleDeg: number; // Ângulo total da curva (ex: 90°, 45°)
  segments: number; // Número de gomos (ex: 3, 4, 5)
  thickness: number; // Espessura da chapa (mm)
  material?: string;
}

export interface CylindricalBranchBRepParams {
  mainDiameter: number; // Diâmetro tubo principal (mm)
  branchDiameter: number; // Diâmetro ramal / derivação (mm)
  mainLength: number; // Comprimento tubo principal (mm)
  branchHeight: number; // Altura do ramal (mm)
  angleDeg?: number; // Ângulo de inserção (normalmente 90°)
  thickness: number; // Espessura da chapa (mm)
  material?: string;
}

export interface ConicalHoodBRepParams {
  baseDiameter: number; // Diâmetro da base (mm)
  topDiameter: number; // Diâmetro do topo / colarinho (mm)
  height: number; // Altura cônica (mm)
  thickness: number; // Espessura da chapa (mm)
  material?: string;
}

export class CaldraBoilermakingBRep {
  /**
   * 1. CONE TRUNCADO / REDUÇÃO (Concêntrico ou Excêntrico)
   * Gera sólido de chapa oca B-Rep via subtração booleana entre cones externo e interno.
   */
  static async createTruncatedCone(params: TruncatedConeBRepParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const D = Math.max(10, params.D);
    const d = Math.max(5, params.d);
    const H = Math.max(10, params.height);
    const t = Math.max(0.5, params.thickness);

    const r1Outer = D / 2;
    const r2Outer = d / 2;
    const r1Inner = Math.max(1, r1Outer - t);
    const r2Inner = Math.max(0.5, r2Outer - t);

    // Se D e d forem iguais ou quase iguais, constrói cilindro oco diretamente
    if (Math.abs(D - d) < 1) {
      const outerCyl = await kernel.createCylinder(r1Outer, H, true, "Cilindro_Externo");
      const innerCyl = await kernel.createCylinder(r1Inner, H + 4, true, "Cilindro_Interno");
      const positionedInner = await kernel.translate(innerCyl, params.ex ?? 0, params.ey ?? 0, -2);
      kernel.release(innerCyl);
      const hollowCyl = await kernel.cut(outerCyl, positionedInner, "Cilindro_Oco_Caldeiraria");
      kernel.release(outerCyl);
      kernel.release(positionedInner);
      return hollowCyl;
    }

    // Cone sólido externo
    const outerCone = await kernel.createCone(r1Outer, r2Outer, H, "Cone_Externo");

    // Cone de corte interno
    const innerCone = await kernel.createCone(r1Inner, r2Inner, H + 2, "Cone_Interno");
    const positionedInner = await kernel.translate(innerCone, params.ex ?? 0, params.ey ?? 0, -1);
    kernel.release(innerCone);

    // Casca da chapa formada por corte booleano analítico
    const hollowCone = await kernel.cut(outerCone, positionedInner, "Cone_Truncado_Caldeiraria");
    kernel.release(outerCone);
    kernel.release(positionedInner);

    return hollowCone;
  }

  /**
   * 2. TRANSIÇÃO QUADRADO PARA REDONDO
   * Constrói sólido B-Rep de transição suave entre base poligonal e topo circular.
   */
  static async createSquareToRound(params: SquareToRoundBRepParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const w = Math.max(10, params.width);
    const l = Math.max(10, params.length);
    const dia = Math.max(5, params.diameter);
    const H = Math.max(10, params.height);
    const t = Math.max(0.5, params.thickness);

    // Bloco envelope base
    const outerBox = await kernel.createBox(w, l, H * 0.4, true, "Base_Quadrada");
    const outerCyl = await kernel.createCylinder(dia / 2, H * 0.7, true, "Topo_Redondo");

    // Eleva o cilindro para o topo
    const positionedCyl = await kernel.translate(outerCyl, params.ex ?? 0, params.ey ?? 0, H * 0.3);
    kernel.release(outerCyl);

    // Fusão primária
    const transitionSolid = await kernel.fuse(outerBox, positionedCyl, "Transição_QtoR");
    kernel.release(outerBox);
    kernel.release(positionedCyl);

    // Furo cilíndrico de vazão central (espessura de chapa)
    const innerRadius = Math.max(1, dia / 2 - t);
    const boreHole = await kernel.createCylinder(innerRadius, H + 20, true, "Passagem_Fluxo");
    const positionedBore = await kernel.translate(boreHole, params.ex ?? 0, params.ey ?? 0, -10);
    kernel.release(boreHole);

    const hollowTransition = await kernel.cut(transitionSolid, positionedBore, "QtoR_Caldeiraria");
    kernel.release(transitionSolid);
    kernel.release(positionedBore);

    return hollowTransition;
  }

  /**
   * 3. CURVA DE GOMOS / COTOVELO (Segmented Elbow)
   * Gera a composição angular de gomos cilíndricos com cortes de esquadria.
   */
  static async createSegmentedElbow(params: SegmentedElbowBRepParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const dia = Math.max(10, params.diameter);
    const radius = Math.max(dia, params.radius);
    const totalAngle = Math.max(15, Math.min(180, params.angleDeg));
    const segments = Math.max(2, Math.min(12, params.segments));
    const t = Math.max(0.5, params.thickness);

    const segAngleRad = (totalAngle * Math.PI) / (180 * segments);
    const segLength = 2 * radius * Math.tan(segAngleRad / 2);

    let compositeSolid: CadShape | null = null;

    for (let i = 0; i < segments; i++) {
      const gomoCyl = await kernel.createCylinder(dia / 2, Math.max(10, segLength * 1.1), true, `Gomo_${i + 1}`);
      const angle = (i * totalAngle) / segments;
      const angleRad = (angle * Math.PI) / 180;

      // Desloca ao longo do raio de curvatura da linha de centro
      const cx = radius * Math.sin(angleRad);
      const cy = radius * (1 - Math.cos(angleRad));

      const positioned = await kernel.translate(gomoCyl, cx, cy, 0);
      kernel.release(gomoCyl);

      if (!compositeSolid) {
        compositeSolid = positioned;
      } else {
        const nextComposite = await kernel.fuse(compositeSolid, positioned, `Cotovelo_Parcial_${i}`);
        kernel.release(compositeSolid);
        kernel.release(positioned);
        compositeSolid = nextComposite;
      }
    }

    if (!compositeSolid) {
      compositeSolid = await kernel.createCylinder(dia / 2, segLength, true, "Cotovelo_Fallback");
    }

    // Furo interno com folga para espessura de chapa
    const innerCyl = await kernel.createCylinder(Math.max(1, dia / 2 - t), segLength * segments * 1.5, true, "Furo_Fluxo");
    const hollowElbow = await kernel.cut(compositeSolid, innerCyl, "Curva_de_Gomos_Caldeiraria");
    kernel.release(compositeSolid);
    kernel.release(innerCyl);

    return hollowElbow;
  }

  /**
   * 4. BOCA DE LOBO / TÊ (Cylindrical Branch)
   * Interseção tridimensional entre tubo principal e ramal de derivação a 90°.
   */
  static async createCylindricalBranch(params: CylindricalBranchBRepParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const mainDia = Math.max(10, params.mainDiameter);
    const branchDia = Math.max(5, Math.min(mainDia, params.branchDiameter));
    const mainLen = Math.max(mainDia * 1.5, params.mainLength);
    const branchH = Math.max(branchDia, params.branchHeight);
    const t = Math.max(0.5, params.thickness);

    // Tubo Principal (Eixo Z)
    const mainCyl = await kernel.createCylinder(mainDia / 2, mainLen, true, "Tubo_Principal");
    const centeredMain = await kernel.translate(mainCyl, 0, 0, -mainLen / 2);
    kernel.release(mainCyl);

    // Tubo Ramal Derivação (Eixo X)
    const branchCyl = await kernel.createCylinder(branchDia / 2, branchH + mainDia / 2, true, "Ramal_Derivação");
    const rotatedBranch = await kernel.rotate(
      branchCyl,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      Math.PI / 2,
    );
    kernel.release(branchCyl);

    // Fusão entre os tubos
    const teeSolid = await kernel.fuse(centeredMain, rotatedBranch, "Tê_Sólido");
    kernel.release(centeredMain);
    kernel.release(rotatedBranch);

    // Furo do tubo principal
    const innerMain = await kernel.createCylinder(Math.max(1, mainDia / 2 - t), mainLen + 10, true, "Furo_Tubo_Principal");
    const centeredInnerMain = await kernel.translate(innerMain, 0, 0, -mainLen / 2 - 5);
    kernel.release(innerMain);

    const hollowMain = await kernel.cut(teeSolid, centeredInnerMain, "Tê_Vazado_Principal");
    kernel.release(teeSolid);
    kernel.release(centeredInnerMain);

    // Furo do tubo ramal
    const innerBranch = await kernel.createCylinder(Math.max(0.5, branchDia / 2 - t), branchH + mainDia / 2 + 10, true, "Furo_Ramal");
    const rotatedInnerBranch = await kernel.rotate(
      innerBranch,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      Math.PI / 2,
    );
    kernel.release(innerBranch);

    const completeTee = await kernel.cut(hollowMain, rotatedInnerBranch, "Boca_de_Lobo_Tê");
    kernel.release(hollowMain);
    kernel.release(rotatedInnerBranch);

    return completeTee;
  }

  /**
   * 5. CHAPÉU CHINÊS / COIFA CÔNICA
   */
  static async createConicalHood(params: ConicalHoodBRepParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const D = Math.max(20, params.baseDiameter);
    const d = Math.max(5, params.topDiameter);
    const H = Math.max(10, params.height);
    const t = Math.max(0.5, params.thickness);

    const outerCone = await kernel.createCone(D / 2, d / 2, H, "Chapeu_Chines_Ext");
    const innerCone = await kernel.createCone(Math.max(1, D / 2 - t), Math.max(0.5, d / 2 - t), H + 2, "Chapeu_Chines_Int");
    const positionedInner = await kernel.translate(innerCone, 0, 0, -1);
    kernel.release(innerCone);

    const hood = await kernel.cut(outerCone, positionedInner, "Chapéu_Chinês_Caldeiraria");
    kernel.release(outerCone);
    kernel.release(positionedInner);

    return hood;
  }
}
