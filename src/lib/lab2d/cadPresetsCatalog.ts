/**
 * CALDRA CHAMFER — CATÁLOGO DE PRESETS INTELIGENTES DE CALDEIRARIA E MECÂNICA (ETAPA 33)
 *
 * Gera GEOMETRIA REAL 100% EDITÁVEL (linhas, círculos, polilinhas, arcos) com camadas corretas:
 *  1. Flange Circular (DIN/ANSI com furação polar);
 *  2. Base de Fixação / Sapata (4 furos nos cantos com margem e raio);
 *  3. Tubo Retangular / Metalon (com espessura de parede real);
 *  4. Placa com Furação Perfurada / Grade de Rasgos Oblongos;
 *  5. Gomo de Curva / Cotovelo Planificado (Desenvolvimento de traçagem com geratrizes);
 *  6. Transição Quadrado para Redondo Planificada (Meia-peça com linhas de dobra);
 *  7. Boca de Lobo / Derivação Tubo a Tubo Planificada (Desenvolvimento do ramal);
 *  8. Redução Cônica / Cone Truncado Planificado (Setor circular concêntrico).
 */

import type { Vec2 } from "@/lib/geometry/types";
import { uid, type Entity } from "./core";
import { createSlotPolyline } from "./cadGeometryCore";
import { buildBentSupportPreset } from "./isometricEngine";

export interface PresetParamDef {
  id: string;
  label: string;
  defaultValue: number;
  unit: string;
  min: number;
  max: number;
}

export interface PresetDefinition {
  id: string;
  name: string;
  category: "caldeiraria" | "mecanica" | "estrutural" | "chapas";
  description: string;
  params: PresetParamDef[];
  generate: (params: Record<string, number>, basePos: Vec2) => Entity[];
}

export const CAD_PRESETS_CATALOG: PresetDefinition[] = [
  {
    id: "circular_flange",
    name: "Flange Circular com Furação",
    category: "caldeiraria",
    description: "Flange com furo de passagem central e furação polar simétrica (DIN/ANSI).",
    params: [
      { id: "outerDia", label: "Ø Externo (OD)", defaultValue: 300, unit: "mm", min: 50, max: 2000 },
      { id: "innerDia", label: "Ø Furo Central (ID)", defaultValue: 150, unit: "mm", min: 10, max: 1900 },
      { id: "boltCircleDia", label: "Ø Círculo de Furação (PCD)", defaultValue: 230, unit: "mm", min: 30, max: 1950 },
      { id: "numHoles", label: "Quantidade de Furos", defaultValue: 8, unit: "un", min: 3, max: 64 },
      { id: "holeDia", label: "Ø dos Furos", defaultValue: 18, unit: "mm", min: 4, max: 80 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const cx = base.x;
      const cy = base.y;
      const outerDia = p["outerDia"] ?? 300;
      const innerDia = p["innerDia"] ?? 150;
      const boltCircleDia = p["boltCircleDia"] ?? 230;
      const numHoles = p["numHoles"] ?? 8;
      const holeDia = p["holeDia"] ?? 18;

      // 1. Círculo Externo (Corte)
      entities.push({
        id: uid(),
        layer: "corte",
        type: "circle",
        cx,
        cy,
        r: outerDia / 2,
      });

      // 2. Furo Central (Recorte interno)
      if (innerDia > 0) {
        entities.push({
          id: uid(),
          layer: "recorte",
          type: "circle",
          cx,
          cy,
          r: innerDia / 2,
        });
      }

      // 3. Linha de Centro da Furação (Construção)
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "circle",
        cx,
        cy,
        r: boltCircleDia / 2,
      });

      // 4. Eixos de centro da flange
      const rExt = outerDia / 2;
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "line",
        x1: cx - rExt * 1.1,
        y1: cy,
        x2: cx + rExt * 1.1,
        y2: cy,
      });
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "line",
        x1: cx,
        y1: cy - rExt * 1.1,
        x2: cx,
        y2: cy + rExt * 1.1,
      });

      // 5. Furos de Parafuso
      const n = Math.max(3, Math.round(numHoles));
      const bcdR = boltCircleDia / 2;
      const holeR = holeDia / 2;

      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        entities.push({
          id: uid(),
          layer: "recorte",
          type: "circle",
          cx: cx + bcdR * Math.cos(a),
          cy: cy + bcdR * Math.sin(a),
          r: holeR,
        });
      }

      return entities;
    },
  },

  {
    id: "mounting_base",
    name: "Sapata / Base com Furos nos Cantos",
    category: "estrutural",
    description: "Placa base retangular de fixação com margens de furação simétricas.",
    params: [
      { id: "width", label: "Largura (X)", defaultValue: 300, unit: "mm", min: 50, max: 2000 },
      { id: "height", label: "Altura (Y)", defaultValue: 250, unit: "mm", min: 50, max: 2000 },
      { id: "margin", label: "Margem dos Furos", defaultValue: 35, unit: "mm", min: 10, max: 200 },
      { id: "holeDia", label: "Ø dos Furos", defaultValue: 22, unit: "mm", min: 5, max: 60 },
      { id: "cornerFillet", label: "Raio de Canto", defaultValue: 15, unit: "mm", min: 0, max: 50 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const w = p["width"] ?? 300;
      const h = p["height"] ?? 250;
      const m = p["margin"] ?? 35;
      const r = (p["holeDia"] ?? 22) / 2;
      const x0 = base.x;
      const y0 = base.y;

      // Contorno externo retangular
      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: [
          { x: x0, y: y0 },
          { x: x0 + w, y: y0 },
          { x: x0 + w, y: y0 + h },
          { x: x0, y: y0 + h },
        ],
      });

      // 4 Furos simétricos nos cantos
      const holeCenters: Vec2[] = [
        { x: x0 + m, y: y0 + m },
        { x: x0 + w - m, y: y0 + m },
        { x: x0 + w - m, y: y0 + h - m },
        { x: x0 + m, y: y0 + h - m },
      ];

      for (const hc of holeCenters) {
        entities.push({
          id: uid(),
          layer: "recorte",
          type: "circle",
          cx: hc.x,
          cy: hc.y,
          r,
        });
      }

      // Linhas de centro das furações
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "line",
        x1: x0 + m,
        y1: y0 + m,
        x2: x0 + w - m,
        y2: y0 + m,
      });
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "line",
        x1: x0 + m,
        y1: y0 + h - m,
        x2: x0 + w - m,
        y2: y0 + h - m,
      });

      return entities;
    },
  },

  {
    id: "metalon_tube",
    name: "Perfil Tubular / Metalon",
    category: "mecanica",
    description: "Perfil quadrado ou retangular oco com espessura de parede real.",
    params: [
      { id: "width", label: "Largura Externa (X)", defaultValue: 100, unit: "mm", min: 20, max: 500 },
      { id: "height", label: "Altura Externa (Y)", defaultValue: 60, unit: "mm", min: 20, max: 500 },
      { id: "thickness", label: "Espessura de Parede (e)", defaultValue: 4.75, unit: "mm", min: 1, max: 25 },
      { id: "cornerR", label: "Raio de Dobra Externo", defaultValue: 8, unit: "mm", min: 0, max: 30 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const w = p["width"] ?? 100;
      const h = p["height"] ?? 60;
      const t = p["thickness"] ?? 4.75;
      const x0 = base.x;
      const y0 = base.y;

      // Contorno externo
      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: [
          { x: x0, y: y0 },
          { x: x0 + w, y: y0 },
          { x: x0 + w, y: y0 + h },
          { x: x0, y: y0 + h },
        ],
      });

      // Contorno interno oco
      entities.push({
        id: uid(),
        layer: "recorte",
        type: "polyline",
        closed: true,
        pts: [
          { x: x0 + t, y: y0 + t },
          { x: x0 + w - t, y: y0 + t },
          { x: x0 + w - t, y: y0 + h - t },
          { x: x0 + t, y: y0 + h - t },
        ],
      });

      return entities;
    },
  },

  {
    id: "slot_perforated_plate",
    name: "Chapa com Rasgos Oblongos",
    category: "chapas",
    description: "Chapa de ventilação / peneira com sequência de slots oblongos.",
    params: [
      { id: "plateW", label: "Largura da Chapa", defaultValue: 400, unit: "mm", min: 100, max: 1500 },
      { id: "plateH", label: "Altura da Chapa", defaultValue: 250, unit: "mm", min: 100, max: 1500 },
      { id: "slotLen", label: "Comprimento do Rasgo", defaultValue: 60, unit: "mm", min: 10, max: 200 },
      { id: "slotW", label: "Largura do Rasgo", defaultValue: 16, unit: "mm", min: 4, max: 50 },
      { id: "rows", label: "Linhas de Rasgos", defaultValue: 3, unit: "un", min: 1, max: 10 },
      { id: "cols", label: "Colunas de Rasgos", defaultValue: 4, unit: "un", min: 1, max: 10 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const w = p["plateW"] ?? 400;
      const h = p["plateH"] ?? 250;
      const slotLen = p["slotLen"] ?? 60;
      const slotW = p["slotW"] ?? 16;
      const x0 = base.x;
      const y0 = base.y;

      // Contorno externo
      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: [
          { x: x0, y: y0 },
          { x: x0 + w, y: y0 },
          { x: x0 + w, y: y0 + h },
          { x: x0, y: y0 + h },
        ],
      });

      const rows = Math.max(1, Math.round(p["rows"] ?? 3));
      const cols = Math.max(1, Math.round(p["cols"] ?? 4));
      const stepX = w / (cols + 1);
      const stepY = h / (rows + 1);

      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const slot = createSlotPolyline(
            { x: x0 + c * stepX, y: y0 + r * stepY },
            slotLen,
            slotW,
            0,
            "recorte",
          );
          entities.push(slot);
        }
      }

      return entities;
    },
  },

  {
    id: "curved_elbow_segment",
    name: "Gomo de Curva / Cotovelo Planificado",
    category: "caldeiraria",
    description: "Desenvolvimento planificado 2D de gomo intermediário com geratrizes de traçagem.",
    params: [
      { id: "diameter", label: "Diâmetro Externo (Ø)", defaultValue: 300, unit: "mm", min: 50, max: 1500 },
      { id: "bendRadius", label: "Raio de Curvatura (R)", defaultValue: 450, unit: "mm", min: 50, max: 3000 },
      { id: "totalAngle", label: "Ângulo Total da Curva", defaultValue: 90, unit: "deg", min: 15, max: 180 },
      { id: "segments", label: "Número Total de Gomos", defaultValue: 4, unit: "un", min: 2, max: 12 },
      { id: "divisions", label: "Divisões de Geratriz", defaultValue: 12, unit: "un", min: 8, max: 36 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const d = p["diameter"] ?? 300;
      const rCurve = p["bendRadius"] ?? 450;
      const totAng = (p["totalAngle"] ?? 90) * (Math.PI / 180);
      const numSegments = Math.max(2, Math.round(p["segments"] ?? 4));
      const numDivs = Math.max(8, Math.round(p["divisions"] ?? 12));

      // Ângulo de cada gomo intermediário
      const segmentAngle = totAng / (numSegments - 1);
      const halfMiterAngle = segmentAngle / 2;

      // Perímetro desenvolvido da chapa
      const perimeter = Math.PI * d;
      const stepX = perimeter / numDivs;

      // Altura média no centro do gomo (geratriz central)
      const hCenter = 2 * rCurve * Math.tan(halfMiterAngle / 2);
      const baseHeight = Math.max(80, hCenter + d * 0.15);

      const topPts: Vec2[] = [];
      const botPts: Vec2[] = [];

      for (let i = 0; i <= numDivs; i++) {
        const x = base.x + i * stepX;
        const theta = (i / numDivs) * Math.PI * 2;
        // Ordenada senoidal de caldeiraria
        const delta = (d / 2) * Math.sin(theta) * Math.tan(halfMiterAngle);

        const yTop = base.y + baseHeight + delta;
        const yBot = base.y - delta;

        topPts.push({ x, y: yTop });
        botPts.push({ x, y: yBot });

        // Geratrizes de marcação interna na chapa
        if (i > 0 && i < numDivs) {
          entities.push({
            id: uid(),
            layer: "marcacao",
            type: "line",
            x1: x,
            y1: yBot,
            x2: x,
            y2: yTop,
          });
        }
      }

      // Perímetro fechado externo de corte (Gomo planificado)
      const contourPts = [...botPts, ...topPts.reverse()];
      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: contourPts,
      });

      // Linha de centro do desenvolvimento
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "line",
        x1: base.x,
        y1: base.y + baseHeight / 2,
        x2: base.x + perimeter,
        y2: base.y + baseHeight / 2,
      });

      return entities;
    },
  },

  {
    id: "square_to_round_transition",
    name: "Transição Quadrado-Redondo Planificada",
    category: "caldeiraria",
    description: "Desenvolvimento 2D de meia-peça com linhas de dobra por triangulação de caldeiraria.",
    params: [
      { id: "squareSide", label: "Lado da Base Quadrada (A)", defaultValue: 300, unit: "mm", min: 50, max: 1500 },
      { id: "roundDia", label: "Diâmetro da Boca (Ø)", defaultValue: 200, unit: "mm", min: 30, max: 1400 },
      { id: "height", label: "Altura da Transição (H)", defaultValue: 250, unit: "mm", min: 30, max: 1500 },
      { id: "bendsPerCorner", label: "Dobras por Canto", defaultValue: 4, unit: "un", min: 2, max: 10 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const a = p["squareSide"] ?? 300;
      const d = p["roundDia"] ?? 200;
      const h = p["height"] ?? 250;
      const bends = Math.max(2, Math.round(p["bendsPerCorner"] ?? 4));

      // Meia-peça planificada:
      // Base retificada de meia chapa: largura ~ a + a/2 = 1.5 * a nos cantos
      // Comprimento da boca redonda desenvolvida (meia-boca) = PI * d / 2
      const halfCirc = (Math.PI * d) / 2;
      const x0 = base.x;
      const y0 = base.y;

      // Base inferior reta do quadrado
      const pBaseLeft: Vec2 = { x: x0, y: y0 };
      const pCornerLeft: Vec2 = { x: x0 + a * 0.25, y: y0 };
      const pBaseCenter: Vec2 = { x: x0 + a * 0.75, y: y0 };
      const pCornerRight: Vec2 = { x: x0 + a * 1.25, y: y0 };
      const pBaseRight: Vec2 = { x: x0 + a * 1.5, y: y0 };

      // Bordo curvo superior (arco desenvolvido da boca)
      const topPts: Vec2[] = [];
      const totalSteps = bends * 2;
      const slantHeight = Math.hypot(h, (a - d) / 2);

      for (let i = 0; i <= totalSteps; i++) {
        const u = i / totalSteps;
        const x = x0 + u * (a * 1.5);
        // Leve curvatura de conformação da boca
        const arch = Math.sin(u * Math.PI) * (d * 0.1);
        const y = y0 + slantHeight + arch;
        const pt = { x, y };
        topPts.push(pt);

        // Geratrizes de dobra (camada "dobra")
        const anchorCorner = u < 0.5 ? pCornerLeft : pCornerRight;
        if (i % 2 === 0 && i > 0 && i < totalSteps) {
          entities.push({
            id: uid(),
            layer: "dobra",
            type: "line",
            x1: anchorCorner.x,
            y1: anchorCorner.y,
            x2: pt.x,
            y2: pt.y,
          });
        }
      }

      // Perímetro externo de corte
      const outerPerimeter: Vec2[] = [
        pBaseLeft,
        pCornerLeft,
        pBaseCenter,
        pCornerRight,
        pBaseRight,
        ...topPts.reverse(),
      ];

      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: outerPerimeter,
      });

      return entities;
    },
  },

  {
    id: "branch_pipe_lateral",
    name: "Boca de Lobo / Tê 90° Planificada",
    category: "caldeiraria",
    description: "Desenvolvimento 2D do tubo ramal com curva de corte de penetração.",
    params: [
      { id: "mainDia", label: "Ø Tubo Principal (D)", defaultValue: 300, unit: "mm", min: 60, max: 1500 },
      { id: "branchDia", label: "Ø Tubo Ramal (d)", defaultValue: 200, unit: "mm", min: 30, max: 1400 },
      { id: "branchLength", label: "Comprimento do Ramal (L)", defaultValue: 250, unit: "mm", min: 50, max: 1500 },
      { id: "divisions", label: "Divisões da Traçagem", defaultValue: 16, unit: "un", min: 8, max: 36 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const D = p["mainDia"] ?? 300;
      const d = p["branchDia"] ?? 200;
      const L = p["branchLength"] ?? 250;
      const divs = Math.max(8, Math.round(p["divisions"] ?? 16));

      const R_main = D / 2;
      const r_branch = d / 2;
      const perimeter = Math.PI * d;
      const stepX = perimeter / divs;

      const curvePts: Vec2[] = [];
      for (let i = 0; i <= divs; i++) {
        const x = base.x + i * stepX;
        const theta = (i / divs) * Math.PI * 2;
        // Equação de penetração cilíndrica 90°
        const term = Math.max(0, R_main * R_main - Math.pow(r_branch * Math.sin(theta), 2));
        const delta = R_main - Math.sqrt(term);
        const y = base.y + delta;
        curvePts.push({ x, y });

        // Geratrizes de conferência
        if (i > 0 && i < divs && i % 2 === 0) {
          entities.push({
            id: uid(),
            layer: "marcacao",
            type: "line",
            x1: x,
            y1: y,
            x2: x,
            y2: base.y + L,
          });
        }
      }

      // Contorno planificado do ramal
      const contour: Vec2[] = [
        ...curvePts,
        { x: base.x + perimeter, y: base.y + L },
        { x: base.x, y: base.y + L },
      ];

      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: contour,
      });

      return entities;
    },
  },

  {
    id: "conical_reducer",
    name: "Redução Cônica / Cone Truncado Planificado",
    category: "caldeiraria",
    description: "Desenvolvimento 2D em setor circular concêntrico com geratriz de chapa metálica.",
    params: [
      { id: "largeDia", label: "Ø Maior da Base (D)", defaultValue: 400, unit: "mm", min: 50, max: 2000 },
      { id: "smallDia", label: "Ø Menor do Topo (d)", defaultValue: 200, unit: "mm", min: 20, max: 1900 },
      { id: "height", label: "Altura Axial (H)", defaultValue: 300, unit: "mm", min: 30, max: 2000 },
    ],
    generate: (p, base) => {
      const entities: Entity[] = [];
      const D = p["largeDia"] ?? 400;
      const d = p["smallDia"] ?? 200;
      const h = p["height"] ?? 300;

      // Geratriz lateral do tronco de cone
      const diffR = (D - d) / 2;
      const slantG = Math.hypot(h, diffR);

      // Raio do cone estendido até o vértice
      const R_ext = (D / 2 / (diffR > 0.001 ? diffR : 0.001)) * slantG;
      const r_int = Math.max(1, R_ext - slantG);

      // Ângulo de abertura do desenvolvimento (radianos)
      const thetaTotal = Math.min(Math.PI * 1.95, (Math.PI * D) / R_ext);
      const cx = base.x;
      const cy = base.y;

      const numPts = 32;
      const outerArcPts: Vec2[] = [];
      const innerArcPts: Vec2[] = [];

      for (let i = 0; i <= numPts; i++) {
        const a = (i / numPts) * thetaTotal - thetaTotal / 2 - Math.PI / 2;
        outerArcPts.push({
          x: cx + R_ext * Math.cos(a),
          y: cy + R_ext * Math.sin(a),
        });
        innerArcPts.push({
          x: cx + r_int * Math.cos(a),
          y: cy + r_int * Math.sin(a),
        });
      }

      // Contorno fechado do setor circular
      const contour = [...outerArcPts, ...innerArcPts.reverse()];
      entities.push({
        id: uid(),
        layer: "corte",
        type: "polyline",
        closed: true,
        pts: contour,
      });

      // Eixo de simetria do cone
      entities.push({
        id: uid(),
        layer: "construcao",
        type: "line",
        x1: cx,
        y1: cy,
        x2: cx,
        y2: cy - R_ext * 1.05,
      });

      return entities;
    },
  },
  {
    id: "iso_bent_support",
    name: "Suporte Dobrado Isométrico 2D",
    category: "mecanica",
    description: "Peça técnica com representação isométrica 2D: base horizontal, flange vertical dobrada e furações em múltiplos planos.",
    params: [
      { id: "baseWidth", label: "Largura da Base (30°)", defaultValue: 120, unit: "mm", min: 30, max: 600 },
      { id: "baseLength", label: "Comprimento da Base (150°)", defaultValue: 80, unit: "mm", min: 30, max: 600 },
      { id: "flangeHeight", label: "Altura da Flange (90°)", defaultValue: 60, unit: "mm", min: 20, max: 500 },
      { id: "thickness", label: "Espessura da Chapa", defaultValue: 4, unit: "mm", min: 1, max: 30 },
      { id: "holeDiameter", label: "Ø dos Furos Técnicos", defaultValue: 14, unit: "mm", min: 4, max: 80 },
    ],
    generate: (p, base) => {
      const res = buildBentSupportPreset({
        baseWidth: p["baseWidth"] ?? 120,
        baseLength: p["baseLength"] ?? 80,
        flangeHeight: p["flangeHeight"] ?? 60,
        thickness: p["thickness"] ?? 4,
        holeDiameter: p["holeDiameter"] ?? 14,
        origin: base,
      });
      return res.entities;
    },
  },
];
