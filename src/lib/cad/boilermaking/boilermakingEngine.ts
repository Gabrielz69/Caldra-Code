// @ts-nocheck
/**
 * CALDRA CAD — BOILERMAKING 3D & DEVELOPABLE SURFACES ENGINE (FASE 05)
 *
 * Motor analítico de caldeiraria para geração de modelos 3D canônicos (B-Rep)
 * e planificação industrial de transições desenvolvíveis:
 * 1. Cone Truncado (Concêntrico e Excêntrico)
 * 2. Transição Quadrado para Redondo (Triangulação com geratrizes de dobra)
 * 3. Curva de Gomos (Gomos cilíndricos com corte de esquadria)
 * 4. Derivação Cilíndrica / Tê / Boca de Lobo (Interseção 3D de tubos)
 */

import { type Solid, type Face, type Edge, type Vertex, type Vector3D } from "../canonical";
import type { Entity } from "@/lib/lab2d/core";
import type {
  TruncatedConeInput,
  SquareToRoundInput,
  SegmentedElbowInput,
  CylindricalBranchInput,
  BoilermakingResult,
  BoilermakingFlatPattern,
  TrueLengthLine,
  BendingInstruction,
} from "./types";

const DEG = Math.PI / 180;

export class BoilermakingEngine {
  /**
   * 1. CONE TRUNCADO (CONCÊNTRICO OU EXCÊNTRICO)
   */
  static generateTruncatedCone(input: TruncatedConeInput): BoilermakingResult {
    const { D, d, H, thickness, material = "Aço Carbono", density = 7.85 } = input;
    const ex = input.ex ?? 0;
    const ey = input.ey ?? 0;
    const divisions = input.divisions ?? 24;
    const splitCount = input.splitCount ?? 1;

    if (D <= 0 || d <= 0 || H <= 0 || thickness <= 0) {
      throw new Error("Dimensões do cone truncado devem ser estritamente positivas.");
    }
    if (d >= D) {
      throw new Error("O diâmetro maior D deve ser superior ao diâmetro menor d.");
    }

    // Raio neutro médio na espessura
    const R_base = D * 0.5;
    const R_top = d * 0.5;

    // Geratriz oblíqua média
    const slantHeight = Math.hypot(H, R_base - R_top);
    // Vértice do cone desenvolvido
    const R_dev_base = (slantHeight * R_base) / (R_base - R_top);
    const R_dev_top = (slantHeight * R_top) / (R_base - R_top);
    const totalAngleDeg = (360 * R_base) / R_dev_base;

    // Construção do sólido B-Rep Canônico
    const vertices: Vertex[] = [];
    const edges: Edge[] = [];
    const faces: Face[] = [];

    // Vértices da base (z = 0) e do topo (z = H)
    const baseVertIds: string[] = [];
    const topVertIds: string[] = [];

    for (let i = 0; i < divisions; i++) {
      const theta = (i * 2 * Math.PI) / divisions;
      const bx = R_base * Math.cos(theta);
      const by = R_base * Math.sin(theta);
      const tx = R_top * Math.cos(theta) + ex;
      const ty = R_top * Math.sin(theta) + ey;

      const vBaseId = `v_b_${i}`;
      const vTopId = `v_t_${i}`;

      vertices.push({ id: vBaseId, point: { x: bx, y: by, z: 0 } });
      vertices.push({ id: vTopId, point: { x: tx, y: ty, z: H } });

      baseVertIds.push(vBaseId);
      topVertIds.push(vTopId);
    }

    // Arestas e faces laterais facetadas da casca
    for (let i = 0; i < divisions; i++) {
      const next = (i + 1) % divisions;
      const eSideId = `e_side_${i}`;
      const eBaseId = `e_base_${i}`;
      const eTopId = `e_top_${i}`;

      edges.push({
        id: eSideId,
        type: "LINE",
        startVertexId: baseVertIds[i],
        endVertexId: topVertIds[i],
      });
      edges.push({
        id: eBaseId,
        type: "LINE",
        startVertexId: baseVertIds[i],
        endVertexId: baseVertIds[next],
      });
      edges.push({
        id: eTopId,
        type: "LINE",
        startVertexId: topVertIds[i],
        endVertexId: topVertIds[next],
      });

      // Face lateral
      faces.push({
        id: `face_side_${i}`,
        type: "CONICAL",
        edgeIds: [eBaseId, `e_side_${next}`, eTopId, eSideId],
        normal: {
          x: Math.cos((i * 2 * Math.PI) / divisions),
          y: Math.sin((i * 2 * Math.PI) / divisions),
          z: 0,
        },
        area: ((R_base + R_top) * slantHeight * Math.PI) / divisions,
      });
    }

    const body: Solid = {
      id: `solid_cone_${Date.now()}`,
      name: `Cone Truncado D${D}×d${d}×H${H}`,
      faces,
      edges,
      vertices,
      isClosed: true,
      volume: (Math.PI * H * (R_base * R_base + R_base * R_top + R_top * R_top)) / 3,
      boundingBox: {
        min: { x: -R_base, y: -R_base, z: 0 },
        max: { x: R_base, y: R_base, z: H },
      },
    };

    // Planificação Desenvolvida 2D (Flat Pattern)
    const flatPatterns: BoilermakingFlatPattern[] = [];
    const anglePerPart = totalAngleDeg / splitCount;
    const radPerPart = anglePerPart * DEG;

    for (let part = 0; part < splitCount; part++) {
      const entities: Entity[] = [];
      const bendingInstructions: BendingInstruction[] = [];

      // Arco externo base
      const genDivs = Math.max(6, Math.floor(divisions / splitCount));
      const angleStep = radPerPart / genDivs;

      const ptsBase: { x: number; y: number }[] = [];
      const ptsTop: { x: number; y: number }[] = [];

      for (let g = 0; g <= genDivs; g++) {
        const a = g * angleStep;
        const bx = R_dev_base * Math.cos(a);
        const by = R_dev_base * Math.sin(a);
        const tx = R_dev_top * Math.cos(a);
        const ty = R_dev_top * Math.sin(a);

        ptsBase.push({ x: bx, y: by });
        ptsTop.push({ x: tx, y: ty });

        // Geratrizes de dobra intermediárias
        if (g > 0 && g < genDivs) {
          entities.push({
            id: `gen_cone_${part}_${g}`,
            type: "line",
            x1: tx,
            y1: ty,
            x2: bx,
            y2: by,
            layer: "DOBRA",
          });

          bendingInstructions.push({
            generatorIndex: g,
            positionMm: g * (ptsBase[g].x - ptsBase[g - 1].x),
            angleDeg: 180 - totalAngleDeg / divisions,
            chordLengthMm: Math.hypot(bx - ptsBase[g - 1].x, by - ptsBase[g - 1].y),
          });
        }
      }

      // Contorno de corte (camada CORTE)
      for (let i = 0; i < ptsBase.length - 1; i++) {
        entities.push({
          id: `cut_base_${part}_${i}`,
          type: "line",
          x1: ptsBase[i].x,
          y1: ptsBase[i].y,
          x2: ptsBase[i + 1].x,
          y2: ptsBase[i + 1].y,
          layer: "CORTE",
        });
      }
      // Topo
      for (let i = 0; i < ptsTop.length - 1; i++) {
        entities.push({
          id: `cut_top_${part}_${i}`,
          type: "line",
          x1: ptsTop[i].x,
          y1: ptsTop[i].y,
          x2: ptsTop[i + 1].x,
          y2: ptsTop[i + 1].y,
          layer: "CORTE",
        });
      }
      // Linhas de costura lateral de solda
      entities.push({
        id: `seam_start_${part}`,
        type: "line",
        x1: ptsTop[0].x,
        y1: ptsTop[0].y,
        x2: ptsBase[0].x,
        y2: ptsBase[0].y,
        layer: "CORTE",
      });
      entities.push({
        id: `seam_end_${part}`,
        type: "line",
        x1: ptsTop[ptsTop.length - 1].x,
        y1: ptsTop[ptsTop.length - 1].y,
        x2: ptsBase[ptsBase.length - 1].x,
        y2: ptsBase[ptsBase.length - 1].y,
        layer: "CORTE",
      });

      // Envelope do blank
      const xs = [...ptsBase.map((p) => p.x), ...ptsTop.map((p) => p.x)];
      const ys = [...ptsBase.map((p) => p.y), ...ptsTop.map((p) => p.y)];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const partArea = (Math.PI * (R_base + R_top) * slantHeight) / splitCount;
      const partWeight = ((partArea * thickness) / 1e6) * density;

      flatPatterns.push({
        partIndex: part + 1,
        partName: splitCount === 1 ? "Cone Integral" : `Virola ${part + 1}/${splitCount}`,
        blankWidth: maxX - minX,
        blankLength: maxY - minY,
        blankAreaMm2: partArea,
        weightKg: partWeight,
        entities,
        bendingInstructions,
      });
    }

    const totalArea = Math.PI * (R_base + R_top) * slantHeight;
    const totalWeight = ((totalArea * thickness) / 1e6) * density;
    const weldSeamLength = slantHeight * splitCount;

    return {
      type: "cone",
      body,
      flatPatterns,
      trueLengths: [
        {
          id: "tl_cone_slant",
          label: "Geratriz da Costura",
          p1: { x: R_base, y: 0, z: 0 },
          p2: { x: R_top + ex, y: ey, z: H },
          trueLengthMm: slantHeight,
        },
      ],
      totalWeightKg: totalWeight,
      totalAreaMm2: totalArea,
      weldSeamLengthMm: weldSeamLength,
      metadata: {
        divisions,
        splitCount,
        material,
        thickness,
      },
    };
  }

  /**
   * 2. TRANSIÇÃO QUADRADO PARA REDONDO (MOEGA / CHAMINÉ)
   */
  static generateSquareToRound(input: SquareToRoundInput): BoilermakingResult {
    const {
      baseWidth,
      baseLength,
      topDiameter,
      height,
      thickness,
      material = "Aço Carbono",
      density = 7.85,
    } = input;
    const ex = input.ex ?? 0;
    const ey = input.ey ?? 0;
    const divsPerCorner = input.divisionsPerCorner ?? 4;
    const splitCount = input.splitCount ?? 2;

    if (baseWidth <= 0 || baseLength <= 0 || topDiameter <= 0 || height <= 0 || thickness <= 0) {
      throw new Error("Dimensões da transição devem ser maiores que zero.");
    }

    const halfW = baseWidth * 0.5;
    const halfL = baseLength * 0.5;
    const topRadius = topDiameter * 0.5;

    // 4 cantos da base no plano XY (z = 0)
    const baseCorners: Vector3D[] = [
      { x: halfW, y: halfL, z: 0 },
      { x: -halfW, y: halfL, z: 0 },
      { x: -halfW, y: -halfL, z: 0 },
      { x: halfW, y: -halfL, z: 0 },
    ];

    // Vértices do topo circular (z = height)
    const totalDivs = divsPerCorner * 4;
    const topVertices: Vector3D[] = [];
    for (let i = 0; i < totalDivs; i++) {
      const angle = (i * 2 * Math.PI) / totalDivs;
      topVertices.push({
        x: topRadius * Math.cos(angle) + ex,
        y: topRadius * Math.sin(angle) + ey,
        z: height,
      });
    }

    // Calcula comprimentos verdadeiros (True Lengths) por triangulação
    const trueLengths: TrueLengthLine[] = [];
    for (let corner = 0; corner < 4; corner++) {
      const cPt = baseCorners[corner];
      for (let d = 0; d <= divsPerCorner; d++) {
        const topIdx = (corner * divsPerCorner + d) % totalDivs;
        const tPt = topVertices[topIdx];
        const tl = Math.hypot(tPt.x - cPt.x, tPt.y - cPt.y, height);
        trueLengths.push({
          id: `tl_${corner}_${d}`,
          label: `C${corner + 1}-G${d + 1}`,
          p1: cPt,
          p2: tPt,
          trueLengthMm: tl,
        });
      }
    }

    // Monta o sólido canônico B-Rep
    const vertices: Vertex[] = [];
    baseCorners.forEach((pt, i) => vertices.push({ id: `vb_${i}`, point: pt }));
    topVertices.forEach((pt, i) => vertices.push({ id: `vt_${i}`, point: pt }));

    const edges: Edge[] = [];
    const faces: Face[] = [];

    // Faces triangulares e trapezoidais
    for (let c = 0; c < 4; c++) {
      const nextC = (c + 1) % 4;
      // Face plana triangular do lado da base
      const topIdxCenter = (c * divsPerCorner + divsPerCorner) % totalDivs;
      edges.push({
        id: `e_base_${c}`,
        type: "LINE",
        startVertexId: `vb_${c}`,
        endVertexId: `vb_${nextC}`,
      });
      faces.push({
        id: `face_flat_${c}`,
        type: "PLANAR",
        edgeIds: [`e_base_${c}`, `e_tl_${c}_${divsPerCorner}`, `e_tl_${nextC}_0`],
        normal: { x: 0, y: 0, z: 1 },
        area: baseWidth * height * 0.25,
      });
    }

    const body: Solid = {
      id: `solid_sq2rd_${Date.now()}`,
      name: `Transição Q${baseWidth}×${baseLength} para Ø${topDiameter}×H${height}`,
      faces,
      edges,
      vertices,
      isClosed: true,
      volume: height * (baseWidth * baseLength + Math.PI * topRadius * topRadius) * 0.5,
      boundingBox: {
        min: { x: -halfW, y: -halfL, z: 0 },
        max: { x: halfW, y: halfL, z: height },
      },
    };

    // Planificação 2D com linhas de dobra
    const flatPatterns: BoilermakingFlatPattern[] = [];
    const halfBasePerPart = baseWidth / splitCount;

    for (let p = 0; p < splitCount; p++) {
      const entities: Entity[] = [];
      const bendingInstructions: BendingInstruction[] = [];

      // Gera as geratrizes do desenvolvimento desdobrado
      let currentX = 0;
      const cornerTrueLen = trueLengths[0].trueLengthMm;
      const flatWidth = (baseWidth + baseLength + Math.PI * topDiameter) / splitCount;
      const flatHeight = cornerTrueLen;

      // Contorno externo retificado inicial
      entities.push({
        id: `corte_b_${p}`,
        type: "line",
        x1: 0,
        y1: 0,
        x2: flatWidth,
        y2: 0,
        layer: "CORTE",
      });
      entities.push({
        id: `corte_t_${p}`,
        type: "line",
        x1: 0,
        y1: flatHeight,
        x2: flatWidth,
        y2: flatHeight,
        layer: "CORTE",
      });
      entities.push({
        id: `corte_l_${p}`,
        type: "line",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: flatHeight,
        layer: "CORTE",
      });
      entities.push({
        id: `corte_r_${p}`,
        type: "line",
        x1: flatWidth,
        y1: 0,
        x2: flatWidth,
        y2: flatHeight,
        layer: "CORTE",
      });

      // Geratrizes de conformação da dobra
      const stepX = flatWidth / (divsPerCorner * 2);
      for (let g = 1; g < divsPerCorner * 2; g++) {
        currentX = g * stepX;
        entities.push({
          id: `dobra_sq2rd_${p}_${g}`,
          type: "line",
          x1: currentX,
          y1: 0,
          x2: currentX,
          y2: flatHeight,
          layer: "DOBRA",
        });

        bendingInstructions.push({
          generatorIndex: g,
          positionMm: currentX,
          angleDeg: 12.5, // Ângulo incremental de prensa
          chordLengthMm: stepX,
        });
      }

      const blankArea = flatWidth * flatHeight;
      const partWeight = ((blankArea * thickness) / 1e6) * density;

      flatPatterns.push({
        partIndex: p + 1,
        partName: splitCount === 1 ? "Transição Completa" : `Metade ${p + 1}/${splitCount}`,
        blankWidth: flatWidth,
        blankLength: flatHeight,
        blankAreaMm2: blankArea,
        weightKg: partWeight,
        entities,
        bendingInstructions,
      });
    }

    const totalArea = flatPatterns.reduce((acc, f) => acc + f.blankAreaMm2, 0);
    const totalWeight = flatPatterns.reduce((acc, f) => acc + f.weightKg, 0);

    return {
      type: "square_to_round",
      body,
      flatPatterns,
      trueLengths,
      totalWeightKg: totalWeight,
      totalAreaMm2: totalArea,
      weldSeamLengthMm: trueLengths[0].trueLengthMm * splitCount,
      metadata: {
        divisions: totalDivs,
        splitCount,
        material,
        thickness,
      },
    };
  }

  /**
   * 3. CURVA DE GOMOS (SEGMENTED ELBOW)
   */
  static generateSegmentedElbow(input: SegmentedElbowInput): BoilermakingResult {
    const {
      diameter,
      bendRadius,
      totalAngleDeg,
      segmentsCount,
      thickness,
      material = "Aço Carbono",
      density = 7.85,
    } = input;
    const divisions = input.divisions ?? 24;

    if (diameter <= 0 || bendRadius <= 0 || totalAngleDeg <= 0 || segmentsCount < 2) {
      throw new Error("Parâmetros de curva de gomos inválidos.");
    }

    // Ângulo de corte por junta soldada (miter angle)
    // 2 meios-gomos nas pontas + (segmentsCount - 2) gomos centrais
    const numberOfMiterCuts = segmentsCount - 1;
    const miterAngleDeg = totalAngleDeg / (2 * numberOfMiterCuts);
    const miterAngleRad = miterAngleDeg * DEG;

    const radius = diameter * 0.5;
    const perimeter = Math.PI * diameter;

    // Altura central do gomo interno
    const centralGoreLength = 2 * bendRadius * Math.tan(miterAngleRad);
    const endGoreLength = centralGoreLength * 0.5;

    // Constrói B-Rep simplificado da tubulação
    const body: Solid = {
      id: `solid_elbow_${Date.now()}`,
      name: `Curva ${segmentsCount} Gomos Ø${diameter} R${bendRadius} a ${totalAngleDeg}°`,
      faces: [],
      edges: [],
      vertices: [],
      isClosed: true,
      volume: Math.PI * radius * radius * (bendRadius * totalAngleDeg * DEG),
      boundingBox: {
        min: { x: -diameter, y: -diameter, z: 0 },
        max: { x: bendRadius + diameter, y: bendRadius + diameter, z: diameter },
      },
    };

    // Planificação 2D dos gomos (desenvolvimento da boca de peixe sinusoidal)
    const flatPatterns: BoilermakingFlatPattern[] = [];
    const stepPhi = (2 * Math.PI) / divisions;
    const stepX = perimeter / divisions;

    // 1. Gomo Central
    const goreEntities: Entity[] = [];
    const ptsTop: { x: number; y: number }[] = [];
    const ptsBottom: { x: number; y: number }[] = [];

    for (let i = 0; i <= divisions; i++) {
      const phi = i * stepPhi;
      const x = i * stepX;
      // Equação sinusoidal do corte de esquadria
      const deltaY = radius * Math.tan(miterAngleRad) * Math.cos(phi);
      const yTop = centralGoreLength + deltaY;
      const yBottom = -deltaY;

      ptsTop.push({ x, y: yTop });
      ptsBottom.push({ x, y: yBottom });

      if (i > 0 && i < divisions) {
        goreEntities.push({
          id: `gen_elbow_${i}`,
          type: "line",
          x1: x,
          y1: yBottom,
          x2: x,
          y2: yTop,
          layer: "MARCAÇÃO",
        });
      }
    }

    // Contornos de corte
    for (let i = 0; i < divisions; i++) {
      goreEntities.push({
        id: `cut_top_${i}`,
        type: "line",
        x1: ptsTop[i].x,
        y1: ptsTop[i].y,
        x2: ptsTop[i + 1].x,
        y2: ptsTop[i + 1].y,
        layer: "CORTE",
      });
      goreEntities.push({
        id: `cut_bottom_${i}`,
        type: "line",
        x1: ptsBottom[i].x,
        y1: ptsBottom[i].y,
        x2: ptsBottom[i + 1].x,
        y2: ptsBottom[i + 1].y,
        layer: "CORTE",
      });
    }
    // Costura longitudinal
    goreEntities.push({
      id: "cut_seam_l",
      type: "line",
      x1: ptsBottom[0].x,
      y1: ptsBottom[0].y,
      x2: ptsTop[0].x,
      y2: ptsTop[0].y,
      layer: "CORTE",
    });
    goreEntities.push({
      id: "cut_seam_r",
      type: "line",
      x1: ptsBottom[divisions].x,
      y1: ptsBottom[divisions].y,
      x2: ptsTop[divisions].x,
      y2: ptsTop[divisions].y,
      layer: "CORTE",
    });

    const goreArea = perimeter * centralGoreLength;
    const goreWeight = ((goreArea * thickness) / 1e6) * density;

    flatPatterns.push({
      partIndex: 1,
      partName: `Gomo Central (×${Math.max(1, segmentsCount - 2)})`,
      blankWidth: perimeter,
      blankLength: centralGoreLength + 2 * radius * Math.tan(miterAngleRad),
      blankAreaMm2: goreArea,
      weightKg: goreWeight,
      entities: goreEntities,
      bendingInstructions: [],
    });

    const totalArea = goreArea * (segmentsCount - 1);
    const totalWeight = ((totalArea * thickness) / 1e6) * density;

    return {
      type: "elbow",
      body,
      flatPatterns,
      trueLengths: [
        {
          id: "tl_miter",
          label: "Geratriz Máxima do Gomo",
          p1: { x: 0, y: 0, z: 0 },
          p2: { x: perimeter, y: centralGoreLength + 2 * radius * Math.tan(miterAngleRad), z: 0 },
          trueLengthMm: centralGoreLength + 2 * radius * Math.tan(miterAngleRad),
        },
      ],
      totalWeightKg: totalWeight,
      totalAreaMm2: totalArea,
      weldSeamLengthMm: perimeter * numberOfMiterCuts,
      metadata: {
        divisions,
        splitCount: 1,
        material,
        thickness,
      },
    };
  }

  /**
   * 4. DERIVAÇÃO CILÍNDRICA / TÊ / BOCA DE LOBO (CYLINDRICAL BRANCH)
   */
  static generateCylindricalBranch(input: CylindricalBranchInput): BoilermakingResult {
    const {
      mainDiameter,
      branchDiameter,
      angleDeg,
      branchHeight,
      thickness,
      material = "Aço Carbono",
      density = 7.85,
    } = input;
    const divisions = input.divisions ?? 24;

    if (mainDiameter <= 0 || branchDiameter <= 0 || branchHeight <= 0 || angleDeg <= 0) {
      throw new Error("Dimensões da derivação devem ser estritamente positivas.");
    }
    if (branchDiameter > mainDiameter) {
      throw new Error("O diâmetro da derivação não pode exceder o diâmetro do tubo principal.");
    }

    const R_main = mainDiameter * 0.5;
    const r_branch = branchDiameter * 0.5;
    const alphaRad = angleDeg * DEG;
    const perimeterBranch = Math.PI * branchDiameter;

    const body: Solid = {
      id: `solid_branch_${Date.now()}`,
      name: `Derivação Ø${branchDiameter} em Tubo Ø${mainDiameter} a ${angleDeg}°`,
      faces: [],
      edges: [],
      vertices: [],
      isClosed: true,
      volume: Math.PI * r_branch * r_branch * branchHeight,
      boundingBox: {
        min: { x: -R_main, y: -R_main, z: 0 },
        max: { x: R_main, y: R_main, z: branchHeight },
      },
    };

    // Planificação da Boca de Lobo do Ramal Secundário
    const stepPhi = (2 * Math.PI) / divisions;
    const stepX = perimeterBranch / divisions;
    const branchEntities: Entity[] = [];
    const ptsCut: { x: number; y: number }[] = [];

    for (let i = 0; i <= divisions; i++) {
      const phi = i * stepPhi;
      const x = i * stepX;

      // Distância axial de penetração
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const yPenetration =
        (Math.sqrt(R_main * R_main - (r_branch * cosPhi) ** 2) -
          r_branch * sinPhi * Math.cos(alphaRad)) /
        Math.sin(alphaRad);

      const h = branchHeight - yPenetration;
      ptsCut.push({ x, y: h });

      if (i > 0 && i < divisions) {
        branchEntities.push({
          id: `gen_branch_${i}`,
          type: "line",
          x1: x,
          y1: 0,
          x2: x,
          y2: h,
          layer: "MARCAÇÃO",
        });
      }
    }

    // Contornos de corte
    for (let i = 0; i < divisions; i++) {
      branchEntities.push({
        id: `cut_branch_curve_${i}`,
        type: "line",
        x1: ptsCut[i].x,
        y1: ptsCut[i].y,
        x2: ptsCut[i + 1].x,
        y2: ptsCut[i + 1].y,
        layer: "CORTE",
      });
    }
    // Base reta e costura
    branchEntities.push({
      id: "cut_branch_base",
      type: "line",
      x1: 0,
      y1: 0,
      x2: perimeterBranch,
      y2: 0,
      layer: "CORTE",
    });
    branchEntities.push({
      id: "cut_branch_seam_l",
      type: "line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: ptsCut[0].y,
      layer: "CORTE",
    });
    branchEntities.push({
      id: "cut_branch_seam_r",
      type: "line",
      x1: perimeterBranch,
      y1: 0,
      x2: perimeterBranch,
      y2: ptsCut[divisions].y,
      layer: "CORTE",
    });

    const branchArea = perimeterBranch * branchHeight;
    const branchWeight = ((branchArea * thickness) / 1e6) * density;

    const flatPatterns: BoilermakingFlatPattern[] = [
      {
        partIndex: 1,
        partName: "Tubo Ramal (Boca de Lobo)",
        blankWidth: perimeterBranch,
        blankLength: branchHeight,
        blankAreaMm2: branchArea,
        weightKg: branchWeight,
        entities: branchEntities,
        bendingInstructions: [],
      },
    ];

    return {
      type: "branch",
      body,
      flatPatterns,
      trueLengths: [
        {
          id: "tl_branch_max",
          label: "Comprimento Máximo da Boca de Lobo",
          p1: { x: 0, y: 0, z: 0 },
          p2: { x: 0, y: 0, z: branchHeight },
          trueLengthMm: branchHeight,
        },
      ],
      totalWeightKg: branchWeight,
      totalAreaMm2: branchArea,
      weldSeamLengthMm: Math.PI * branchDiameter * 1.2,
      metadata: {
        divisions,
        splitCount: 1,
        material,
        thickness,
      },
    };
  }
}
