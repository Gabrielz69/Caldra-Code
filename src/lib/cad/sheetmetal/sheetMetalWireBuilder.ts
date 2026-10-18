// @ts-nocheck
/**
 * CALDRA CAD — SHEET METAL WIRE MODEL BUILDER & RIGID FORWARD KINEMATICS
 *
 * Constrói a geometria 3D canônica da chapa metálica dobrada no mesmo formato
 * WireModel utilizado pelo renderizador da Traçagem (Wire3D).
 *
 * Cinemática de dobra analítica rigorosa:
 * - Slider 0% = Totalmente planificado (coincide 100% com o Flat Pattern)
 * - Slider 100% = Totalmente dobrado/conformado (respeita os ângulos nominais)
 * - Transição contínua entre 0% e 100%: rotação rígida analítica em torno
 *   dos eixos reais de dobra (fórmula de Rodrigues)
 * - Hierarquia analítica de dobras (Base → Dobra 1 → Flange Dependente → Dobra 2 → ...)
 * - Conexão contínua com setores cilíndricos facetados de dobra (zero gaps, zero deformação artificial)
 * - Espessura real com faces superiores (+T/2), inferiores (-T/2) e bordas de corte (rims)
 */

import type { Vec3 } from "@/lib/geometry/types";
import { finish, buildWire, type Edge, type Face, type WireModel } from "@/lib/viz3d/wire";
import type { PartDocument, ParametricFlangeDef } from "../kernel/types";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Produto escalar 3D */
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Produto vetorial 3D: a × b */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/** Rotação rígida analítica de Rodrigues de um vetor em torno de um eixo unitário u por ângulo rad */
export function rotateVectorAroundAxis(vec: Vec3, u: Vec3, rad: number): Vec3 {
  if (Math.abs(rad) < 1e-7) return { ...vec };
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const d = dot(u, vec);
  const cr = cross(u, vec);
  return v(
    vec.x * c + cr.x * s + u.x * d * (1 - c),
    vec.y * c + cr.y * s + u.y * d * (1 - c),
    vec.z * c + cr.z * s + u.z * d * (1 - c),
  );
}

/** Rotação rígida de um ponto P em torno de uma linha 3D passando por A com direção unitária u */
export function rotatePointAroundLine(p: Vec3, a: Vec3, u: Vec3, rad: number): Vec3 {
  if (Math.abs(rad) < 1e-7) return { ...p };
  const diff = v(p.x - a.x, p.y - a.y, p.z - a.z);
  const rot = rotateVectorAroundAxis(diff, u, rad);
  return v(a.x + rot.x, a.y + rot.y, a.z + rot.z);
}

export interface SheetBendDefinition {
  bendId: string;
  name: string;
  p1: Vec3;
  p2: Vec3;
  unitAxis: Vec3;
  targetAngleDeg: number;
  direction: "UP" | "DOWN";
  insideRadius: number;
  flangeLength: number;
  edgeId: "top" | "bottom" | "left" | "right" | "custom";
  parentRegionId: string;
}

interface FlangeKinematicNode {
  id: string;
  name: string;
  parentId: string; // "base" ou outro flange id
  // Coordenadas planas locais no Flat Pattern:
  rootA: Vec3; // topo do ponto de fixação A
  rootB: Vec3; // topo do ponto de fixação B
  tipA: Vec3; // topo da ponta livre A
  tipB: Vec3; // topo da ponta livre B
  axisPoint: Vec3; // ponto central na linha de dobra
  unitAxis: Vec3; // vetor unitário do eixo de rotação
  nominalAngleDeg: number;
  direction: "UP" | "DOWN";
  dirSign: number;
  insideRadius: number;
  flangeLength: number;
  edgeId: "top" | "bottom" | "left" | "right";
}

/**
 * Constrói o modelo 3D WireModel compatível com o renderer da Traçagem (Wire3D).
 * @param doc Documento da peça paramétrica
 * @param foldProgress 0 = Totalmente planificado (0%), 1 = Totalmente dobrado (100%)
 */
export function buildSheetMetalWireModel(doc: PartDocument, foldProgress = 1.0): WireModel {
  // 1. Caso especial: Modelo de Caldeiraria existente (Cone, Quadrado-Redondo, Curva, Boca de lobo)
  if (doc.boilermakingFeature) {
    const { type, params } = doc.boilermakingFeature;
    const p = params as Record<string, number | undefined>;
    const t = Math.max(0.5, doc.thickness);

    if (type === "cone") {
      return buildWire("tronco-de-cone", {
        d1: p.D ?? 200,
        d2: p.d ?? 100,
        h: p.H ?? 250,
        t,
        seg: (p.divisions as number) ?? 40,
      });
    } else if (type === "square_to_round") {
      return buildWire("quadrado-redondo", {
        baseA: p.baseWidth ?? 200,
        baseB: p.baseLength ?? 200,
        d2: p.topDiameter ?? 140,
        h: p.height ?? 220,
        t,
        e: p.offsetX ?? 0,
        offsetY: p.offsetY ?? 0,
        divisions: 6,
      });
    } else if (type === "elbow") {
      return buildWire("curva-gomos", {
        d1: p.diameter ?? 150,
        d2: p.diameter ?? 150,
        h: (p.bendRadius ?? 225) * 2,
        ang: p.totalAngleDeg ?? 90,
        n: p.segmentsCount ?? 4,
        t,
        seg: 36,
      });
    } else if (type === "branch") {
      return buildWire("boca-de-lobo", {
        d1: p.mainDiameter ?? 200,
        d2: p.branchDiameter ?? 120,
        h: p.branchHeight ?? 180,
        ang: p.angleDeg ?? 90,
        mode: "branch",
        t,
        seg: 36,
      });
    }
  }

  // 2. Chapa Metálica Paramétrica (Base + Dobras Hierárquicas)
  // Dimensões base:
  let W = Math.max(10, Number(doc.baseWidth) || 120);
  let L = Math.max(10, Number(doc.baseLength) || 100);

  // Se houver desenho 2D com contorno fechado em CORTE, calcula bounds
  if (doc.entities2D && doc.entities2D.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let count = 0;
    doc.entities2D.forEach((e) => {
      const layer = e.layer?.toLowerCase() ?? "";
      if (layer === "corte" || layer === "cut" || !e.layer) {
        if (
          e.type === "line" &&
          Number.isFinite(e.x1) &&
          Number.isFinite(e.x2) &&
          Number.isFinite(e.y1) &&
          Number.isFinite(e.y2)
        ) {
          minX = Math.min(minX, e.x1, e.x2);
          maxX = Math.max(maxX, e.x1, e.x2);
          minY = Math.min(minY, e.y1, e.y2);
          maxY = Math.max(maxY, e.y1, e.y2);
          count++;
        } else if (e.type === "polyline" && Array.isArray(e.pts)) {
          e.pts.forEach((pt) => {
            if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
              minX = Math.min(minX, pt.x);
              maxX = Math.max(maxX, pt.x);
              minY = Math.min(minY, pt.y);
              maxY = Math.max(maxY, pt.y);
              count++;
            }
          });
        } else if (
          e.type === "circle" &&
          Number.isFinite(e.cx) &&
          Number.isFinite(e.cy) &&
          Number.isFinite(e.r)
        ) {
          minX = Math.min(minX, e.cx - e.r);
          maxX = Math.max(maxX, e.cx + e.r);
          minY = Math.min(minY, e.cy - e.r);
          maxY = Math.max(maxY, e.cy + e.r);
          count++;
        }
      }
    });
    if (
      count >= 2 &&
      Number.isFinite(minX) &&
      Number.isFinite(maxX) &&
      maxX - minX > 5 &&
      maxY - minY > 5
    ) {
      W = maxX - minX;
      L = maxY - minY;
    }
  }

  const T = Math.max(0.4, Number(doc.thickness) || 2.0);
  const halfT = T * 0.5;
  const s = Math.max(0, Math.min(1, Number(foldProgress) || 0));

  const faces: Face[] = [];
  const edges: Edge[] = [];
  const refLines: Edge[] = [];

  // Vértices da chapa base no plano Z=0 (centrada para enquadramento equilibrado)
  const x0 = -W * 0.5;
  const x1 = W * 0.5;
  const y0 = -L * 0.5;
  const y1 = L * 0.5;

  // Face superior (+halfT) e inferior (-halfT) da base
  const baseTop = [v(x0, y0, halfT), v(x1, y0, halfT), v(x1, y1, halfT), v(x0, y1, halfT)];
  const baseBot = [v(x0, y0, -halfT), v(x0, y1, -halfT), v(x1, y1, -halfT), v(x1, y0, -halfT)];

  faces.push({ pts: baseTop, kind: "outer" });
  faces.push({ pts: baseBot, kind: "inner" });

  edges.push(
    [baseTop[0], baseTop[1]],
    [baseTop[1], baseTop[2]],
    [baseTop[2], baseTop[3]],
    [baseTop[3], baseTop[0]],
    [baseBot[0], baseBot[1]],
    [baseBot[1], baseBot[2]],
    [baseBot[2], baseBot[3]],
    [baseBot[3], baseBot[0]],
  );

  // 3. Montagem da Árvore Cinemática de Flanges (Suporte a Múltiplas Dobras e Dobras Encadeadas)
  const rawFlanges = doc.flanges && doc.flanges.length > 0 ? doc.flanges : [];

  // Também verifica se existem linhas na camada DOBRA em entities2D que não estão em doc.flanges
  const bendLinesFrom2D = (doc.entities2D ?? []).filter(
    (e) => e.layer?.toUpperCase() === "DOBRA" && e.type === "line",
  );

  const activeFlanges: ParametricFlangeDef[] = [...rawFlanges];
  if (activeFlanges.length === 0 && bendLinesFrom2D.length > 0) {
    bendLinesFrom2D.forEach((bl, idx) => {
      if (bl.type === "line") {
        const dx = Math.abs(bl.x2 - bl.x1);
        const dy = Math.abs(bl.y2 - bl.y1);
        const edgeId = dx > dy ? "top" : "right";
        activeFlanges.push({
          id: `bend2d_${idx}`,
          name: `Dobra 2D #${idx + 1}`,
          edgeId,
          flangeLength: 40,
          angleDeg: 90,
          direction: "UP",
          insideRadius: doc.thickness,
          kFactor: doc.kFactor,
          bendAllowance: 0,
          bendDeduction: 0,
          outsideSetback: 0,
        });
      }
    });
  }

  // Identifica bordas livres da base
  const hasBaseEdgeFlange = (eId: string) =>
    activeFlanges.some((f) => !f.parentFlangeId && f.edgeId === eId);

  if (!hasBaseEdgeFlange("left")) {
    faces.push({ pts: [baseTop[3], baseTop[0], baseBot[0], baseBot[1]], kind: "rim" });
    edges.push([baseTop[3], baseBot[1]], [baseTop[0], baseBot[0]]);
  }
  if (!hasBaseEdgeFlange("right")) {
    faces.push({ pts: [baseTop[1], baseTop[2], baseBot[2], baseBot[3]], kind: "rim" });
    edges.push([baseTop[1], baseBot[3]], [baseTop[2], baseBot[2]]);
  }
  if (!hasBaseEdgeFlange("bottom")) {
    faces.push({ pts: [baseTop[0], baseTop[1], baseBot[3], baseBot[0]], kind: "rim" });
    edges.push([baseTop[0], baseBot[0]], [baseTop[1], baseBot[3]]);
  }
  if (!hasBaseEdgeFlange("top")) {
    faces.push({ pts: [baseTop[2], baseTop[3], baseBot[1], baseBot[2]], kind: "rim" });
    edges.push([baseTop[2], baseBot[2]], [baseTop[3], baseBot[1]]);
  }

  // Constrói os nós cinemáticos no espaço do Flat Pattern
  const nodes = new Map<string, FlangeKinematicNode>();

  for (let i = 0; i < activeFlanges.length; i++) {
    const f = activeFlanges[i];
    const F = f.flangeLength ?? 50;
    const nominalAngle = f.angleDeg ?? 90;
    const dirSign = f.direction === "DOWN" ? -1 : 1;
    const parentId = f.parentFlangeId ?? "base";
    const edgeId = f.edgeId ?? (i === 0 ? "right" : i === 1 ? "left" : i === 2 ? "top" : "bottom");

    let rootA: Vec3;
    let rootB: Vec3;
    let tipA: Vec3;
    let tipB: Vec3;
    let axisPoint: Vec3;
    let unitAxis: Vec3;

    if (parentId === "base" || !nodes.has(parentId)) {
      // Flange ligado à Chapa Base
      if (edgeId === "right") {
        rootA = v(x1, y0, halfT);
        rootB = v(x1, y1, halfT);
        tipA = v(x1 + F, y0, halfT);
        tipB = v(x1 + F, y1, halfT);
        axisPoint = v(x1, 0, 0);
        unitAxis = v(0, -1, 0); // Regra da mão direita: rotação em torno de -Y dobra para cima (+Z)
      } else if (edgeId === "left") {
        rootA = v(x0, y0, halfT);
        rootB = v(x0, y1, halfT);
        tipA = v(x0 - F, y0, halfT);
        tipB = v(x0 - F, y1, halfT);
        axisPoint = v(x0, 0, 0);
        unitAxis = v(0, 1, 0); // Rotação em torno de +Y dobra para cima (+Z)
      } else if (edgeId === "top") {
        rootA = v(x0, y1, halfT);
        rootB = v(x1, y1, halfT);
        tipA = v(x0, y1 + F, halfT);
        tipB = v(x1, y1 + F, halfT);
        axisPoint = v(0, y1, 0);
        unitAxis = v(1, 0, 0); // Rotação em torno de +X dobra para cima (+Z)
      } else {
        // bottom
        rootA = v(x0, y0, halfT);
        rootB = v(x1, y0, halfT);
        tipA = v(x0, y0 - F, halfT);
        tipB = v(x1, y0 - F, halfT);
        axisPoint = v(0, y0, 0);
        unitAxis = v(-1, 0, 0); // Rotação em torno de -X dobra para cima (+Z)
      }
    } else {
      // HIERARQUIA DAS DOBRAS: Flange encadeado (filho de outro flange!)
      const parentNode = nodes.get(parentId)!;
      // Anexa à ponta do flange pai
      rootA = { ...parentNode.tipA };
      rootB = { ...parentNode.tipB };

      // Direção de extensão do pai em plano
      const extDir = v(
        parentNode.tipA.x - parentNode.rootA.x,
        parentNode.tipA.y - parentNode.rootA.y,
        0,
      );
      const len = Math.hypot(extDir.x, extDir.y) || 1;
      const uExt = v(extDir.x / len, extDir.y / len, 0);

      tipA = v(rootA.x + uExt.x * F, rootA.y + uExt.y * F, halfT);
      tipB = v(rootB.x + uExt.x * F, rootB.y + uExt.y * F, halfT);

      axisPoint = v((rootA.x + rootB.x) * 0.5, (rootA.y + rootB.y) * 0.5, 0);
      unitAxis = { ...parentNode.unitAxis };
    }

    nodes.set(f.id, {
      id: f.id,
      name: f.name || `Flange ${i + 1}`,
      parentId,
      rootA,
      rootB,
      tipA,
      tipB,
      axisPoint,
      unitAxis,
      nominalAngleDeg: nominalAngle,
      direction: f.direction ?? "UP",
      dirSign,
      insideRadius: f.insideRadius ?? doc.innerRadius ?? T,
      flangeLength: F,
      edgeId,
    });
  }

  // 4. Executa a Cinemática Direta Rigorosa (Forward Kinematics)
  // Para cada flange, calcula a cadeia de ancestrais até a base
  const getAncestorChain = (nodeId: string): FlangeKinematicNode[] => {
    const chain: FlangeKinematicNode[] = [];
    let curr = nodes.get(nodeId);
    while (curr) {
      chain.unshift(curr); // da raiz para a ponta
      if (curr.parentId === "base") break;
      curr = nodes.get(curr.parentId);
    }
    return chain;
  };

  // Transforma um ponto ou vetor aplicando a cadeia cinemática de rotações rígidas
  const applyKinematicsToPoint = (point: Vec3, chain: FlangeKinematicNode[]): Vec3 => {
    let p = { ...point };
    for (let step = 0; step < chain.length; step++) {
      const node = chain[step];
      const thetaRad = ((node.nominalAngleDeg * s * Math.PI) / 180) * node.dirSign;
      if (Math.abs(thetaRad) < 1e-7) continue;

      // O eixo desta dobra foi por sua vez transformado pelas dobras ancestrais anteriores
      let curAxisPoint = { ...node.axisPoint };
      let curUnitAxis = { ...node.unitAxis };
      for (let prev = 0; prev < step; prev++) {
        const prevNode = chain[prev];
        const prevTheta = ((prevNode.nominalAngleDeg * s * Math.PI) / 180) * prevNode.dirSign;
        if (Math.abs(prevTheta) < 1e-7) continue;
        curAxisPoint = rotatePointAroundLine(
          curAxisPoint,
          prevNode.axisPoint,
          prevNode.unitAxis,
          prevTheta,
        );
        curUnitAxis = rotateVectorAroundAxis(curUnitAxis, prevNode.unitAxis, prevTheta);
      }

      p = rotatePointAroundLine(p, curAxisPoint, curUnitAxis, thetaRad);
    }
    return p;
  };

  // 5. Gera as superfícies, arestas e setores cilíndricos de dobra
  nodes.forEach((node) => {
    const chain = getAncestorChain(node.id);
    const parentChain = chain.slice(0, -1);

    // Eixo de dobra no espaço 3D transformado
    const curThetaRad = ((node.nominalAngleDeg * s * Math.PI) / 180) * node.dirSign;

    let transformedAxisA = { ...node.rootA, z: 0 };
    let transformedAxisB = { ...node.rootB, z: 0 };
    let transformedUnitAxis = { ...node.unitAxis };

    // Aplica transformações dos pais ao eixo desta dobra
    for (const pNode of parentChain) {
      const pTheta = ((pNode.nominalAngleDeg * s * Math.PI) / 180) * pNode.dirSign;
      if (Math.abs(pTheta) < 1e-7) continue;
      transformedAxisA = rotatePointAroundLine(
        transformedAxisA,
        pNode.axisPoint,
        pNode.unitAxis,
        pTheta,
      );
      transformedAxisB = rotatePointAroundLine(
        transformedAxisB,
        pNode.axisPoint,
        pNode.unitAxis,
        pTheta,
      );
      transformedUnitAxis = rotateVectorAroundAxis(transformedUnitAxis, pNode.unitAxis, pTheta);
    }

    // Linha técnica de referência (eixo de dobra com traço estendido)
    const pad = 12;
    refLines.push([
      v(
        transformedAxisA.x - transformedUnitAxis.x * pad,
        transformedAxisA.y - transformedUnitAxis.y * pad,
        transformedAxisA.z,
      ),
      v(
        transformedAxisB.x + transformedUnitAxis.x * pad,
        transformedAxisB.y + transformedUnitAxis.y * pad,
        transformedAxisB.z,
      ),
    ]);

    // Pontos do flange transformados por toda a cadeia
    // Topo da raiz (conectada ao pai)
    const pRootTopA = applyKinematicsToPoint(node.rootA, parentChain);
    const pRootTopB = applyKinematicsToPoint(node.rootB, parentChain);
    const pRootBotA = applyKinematicsToPoint(v(node.rootA.x, node.rootA.y, -halfT), parentChain);
    const pRootBotB = applyKinematicsToPoint(v(node.rootB.x, node.rootB.y, -halfT), parentChain);

    // Topo e fundo da ponta do flange (rotacionados pelo próprio flange)
    const fTipTopA = applyKinematicsToPoint(node.tipA, chain);
    const fTipTopB = applyKinematicsToPoint(node.tipB, chain);
    const fTipBotA = applyKinematicsToPoint(v(node.tipA.x, node.tipA.y, -halfT), chain);
    const fTipBotB = applyKinematicsToPoint(v(node.tipB.x, node.tipB.y, -halfT), chain);

    // Início da aba plana (lado do flange já dobrado)
    const fRootTopA = applyKinematicsToPoint(node.rootA, chain);
    const fRootTopB = applyKinematicsToPoint(node.rootB, chain);
    const fRootBotA = applyKinematicsToPoint(v(node.rootA.x, node.rootA.y, -halfT), chain);
    const fRootBotB = applyKinematicsToPoint(v(node.rootB.x, node.rootB.y, -halfT), chain);

    // Face plana principal da aba dobrada
    faces.push({ pts: [fRootTopA, fTipTopA, fTipTopB, fRootTopB], kind: "outer" });
    faces.push({ pts: [fRootBotA, fRootBotB, fTipBotB, fTipBotA], kind: "inner" });

    edges.push(
      [fRootTopA, fTipTopA],
      [fTipTopA, fTipTopB],
      [fTipTopB, fRootTopB],
      [fRootBotA, fTipBotA],
      [fTipBotA, fTipBotB],
      [fTipBotB, fRootBotB],
    );

    // Borda de corte livre na ponta
    faces.push({ pts: [fTipTopA, fTipBotA, fTipBotB, fTipTopB], kind: "rim" });
    edges.push([fTipTopA, fTipBotA], [fTipTopB, fTipBotB]);

    // Laterais de corte da aba
    faces.push({ pts: [fRootTopA, fRootBotA, fTipBotA, fTipTopA], kind: "rim" });
    faces.push({ pts: [fRootTopB, fTipTopB, fTipBotB, fRootBotB], kind: "rim" });

    // 6. Setor Cilíndrico de Dobra com 4 Facetas Técnicas (Zero Gaps)
    // Conecta perfeitamente a aresta pai (pRootTop) com a aba (fRootTop)
    if (Math.abs(curThetaRad) > 1e-4) {
      const BEND_STEPS = 4;
      let prevTopA = pRootTopA;
      let prevTopB = pRootTopB;
      let prevBotA = pRootBotA;
      let prevBotB = pRootBotB;

      for (let sStep = 1; sStep <= BEND_STEPS; sStep++) {
        const frac = sStep / BEND_STEPS;
        const subAngle = curThetaRad * frac;

        const curTopA = rotatePointAroundLine(
          pRootTopA,
          transformedAxisA,
          transformedUnitAxis,
          subAngle,
        );
        const curTopB = rotatePointAroundLine(
          pRootTopB,
          transformedAxisA,
          transformedUnitAxis,
          subAngle,
        );
        const curBotA = rotatePointAroundLine(
          pRootBotA,
          transformedAxisA,
          transformedUnitAxis,
          subAngle,
        );
        const curBotB = rotatePointAroundLine(
          pRootBotB,
          transformedAxisA,
          transformedUnitAxis,
          subAngle,
        );

        // Faceta cilíndrica externa
        faces.push({ pts: [prevTopA, curTopA, curTopB, prevTopB], kind: "outer" });
        // Faceta cilíndrica interna
        faces.push({ pts: [prevBotA, prevBotB, curBotB, curBotA], kind: "inner" });

        // Crease / arestas da dobra técnica
        edges.push([curTopA, curTopB]);

        // Fechamento lateral do setor cilíndrico (rim da dobra)
        faces.push({ pts: [prevTopA, prevBotA, curBotA, curTopA], kind: "rim" });
        faces.push({ pts: [prevTopB, curTopB, curBotB, prevBotB], kind: "rim" });

        prevTopA = curTopA;
        prevTopB = curTopB;
        prevBotA = curBotA;
        prevBotB = curBotB;
      }
    } else {
      // Estado 100% planificado: junta reta e coplanar sem descontinuidade
      edges.push([pRootTopA, pRootTopB]);
    }
  });

  // 7. Normalização, cálculo Newell de normais e empacotamento WireModel
  return finish({ faces, edges }, refLines);
}
