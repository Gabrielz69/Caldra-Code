// @ts-nocheck
/**
 * CALDRA CAD — NÚCLEO SHEET METAL 3D & CONFORMAÇÃO PARAMÉTRICA
 *
 * Transforma qualquer planificação 2D (esboço aberto / Flange Base ou chapa plana com linhas de dobra)
 * em uma chapa metálica 3D sólida, paramétrica e com simulação cinemática contínua de dobra/desdobra.
 *
 * Suporte a:
 *  - UMA ou VÁRIAS PEÇAS no mesmo projeto (multipeças / montagem com identidades próprias);
 *  - Eixos de dobra reais com ângulo, sentido (UP/DOWN), raio interno, Fator K e deduções;
 *  - Particionamento poligonal da chapa plana pelas linhas de dobra (Face Base e Abas/Flanges);
 *  - Preservação e rotação de furos e recortes contidos em cada face;
 *  - Slider 3D ↔ 2D contínuo (0% a 100%) a 60fps.
 */

import * as THREE from "three";
import type { Vec2 } from "@/lib/geometry/types";
import type { SolidInstance, SolidMaterial, SolidCustomMesh } from "@/lib/project-catalog/instances";
import { outlinePoints, type Entity } from "@/lib/lab2d/core";
import { solidShapes, type SolidShape } from "@/lib/lab2d/solid3d";

const S = 0.001; // mm -> m
const DEG = Math.PI / 180;

export interface SheetMetalBendInfo {
  bendId: string;
  index: number;
  angleDeg: number;
  direction: "UP" | "DOWN";
  insideRadius: number;
  thickness: number;
  kFactor: number;
  bendAllowance: number;
  bendDeduction: number;
  outsideSetback: number;
  neutralRadius: number;
  /** Posição ao longo da chapa planificada (mm) */
  flatPosition: number;
  /** Eixo 2D de dobra na coordenada local */
  p1?: Vec2;
  p2?: Vec2;
}

export type SheetMetalDetectionType = "open-profile" | "blank-with-bends" | "flat-blank";

export interface SheetMetalFlangeRegion {
  id: string;
  isBase: boolean;
  outline: Vec2[];
  holes: Vec2[][];
  bend?: SheetMetalBendInfo;
  parentFaceId?: string;
}

export interface SheetMetalProfileResult {
  id: string;
  code: string;
  label: string;
  type: SheetMetalDetectionType;
  thickness: number;
  width: number; // Profundidade do Flange Base ou largura do blank (mm)
  material: SolidMaterial;
  kFactor: number;
  density: number; // g/cm³ (aço = 7.85)
  insideRadius: number;
  center: Vec2; // Centro no canvas 2D
  bends: SheetMetalBendInfo[];
  developedLength: number; // Comprimento total planificado (mm)
  developedWidth: number; // Largura total planificada (mm)
  blankAreaMm2: number;
  weightKg: number;
  // Faces/Abas particionadas (para 'blank-with-bends')
  flangeRegions?: SheetMetalFlangeRegion[];
  // Segmentos do perfil original (para 'open-profile')
  segments: {
    p0: Vec2;
    p1: Vec2;
    length: number;
    angleRad: number;
  }[];
  // Advertências DFM
  issues: {
    code: string;
    severity: "warning" | "error" | "info";
    message: string;
  }[];
}

// -------------------------------------------------------------
// MATEMÁTICA VETORIAL & GEOMETRIA COMPUTACIONAL 2D
// -------------------------------------------------------------

function signedPolyArea(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function pointInPoly(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Divide um polígono 2D por uma linha de dobra em dois sub-polígonos limpos */
function splitPolygonByLine(
  polygon: Vec2[],
  p1: Vec2,
  p2: Vec2,
): { polyA: Vec2[]; polyB: Vec2[]; splitAxis?: { p1: Vec2; p2: Vec2 } } | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;

  const nx = -dy / len;
  const ny = dx / len;

  const dists = polygon.map((p) => (p.x - p1.x) * nx + (p.y - p1.y) * ny);

  const polyA: Vec2[] = [];
  const polyB: Vec2[] = [];
  const intersections: Vec2[] = [];

  const eps = 1e-4;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const cur = polygon[i]!;
    const next = polygon[(i + 1) % n]!;
    const dCur = dists[i]!;
    const dNext = dists[(i + 1) % n]!;

    if (dCur >= -eps) polyA.push({ ...cur });
    if (dCur <= eps) polyB.push({ ...cur });

    if ((dCur > eps && dNext < -eps) || (dCur < -eps && dNext > eps)) {
      const t = dCur / (dCur - dNext);
      const ix = cur.x + t * (next.x - cur.x);
      const iy = cur.y + t * (next.y - cur.y);
      const interPt = { x: ix, y: iy };

      polyA.push({ ...interPt });
      polyB.push({ ...interPt });
      intersections.push(interPt);
    }
  }

  if (polyA.length >= 3 && polyB.length >= 3 && intersections.length >= 2) {
    return {
      polyA,
      polyB,
      splitAxis: { p1: intersections[0]!, p2: intersections[1]! },
    };
  }

  return null;
}

/** Rotação de Rodrigues 3D de um ponto V em torno de um eixo (origem A1, vetor unitário u) pelo ângulo theta */
function rotatePointAroundAxis(
  v: { x: number; y: number; z: number },
  a1: { x: number; y: number; z: number },
  u: { x: number; y: number; z: number },
  theta: number,
): { x: number; y: number; z: number } {
  const vx = v.x - a1.x;
  const vy = v.y - a1.y;
  const vz = v.z - a1.z;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const dot = vx * u.x + vy * u.y + vz * u.z;

  const crossX = u.y * vz - u.z * vy;
  const crossY = u.z * vx - u.x * vz;
  const crossZ = u.x * vy - u.y * vx;

  return {
    x: a1.x + vx * cosT + crossX * sinT + u.x * dot * (1 - cosT),
    y: a1.y + vy * cosT + crossY * sinT + u.y * dot * (1 - cosT),
    z: a1.z + vz * cosT + crossZ * sinT + u.z * dot * (1 - cosT),
  };
}

/** Extrai pontos de uma cadeia contínua de linhas conectadas (esboço aberto) */
function extractOpenChains(entities: Entity[]): Vec2[][] {
  const lines: { p1: Vec2; p2: Vec2; id: string }[] = [];

  for (const e of entities) {
    // Apenas entidades na camada CORTE podem formar perfis de contorno
    if (e.layer !== "corte") continue;
    if (e.type === "line") {
      lines.push({ p1: { x: e.x1, y: -e.y1 }, p2: { x: e.x2, y: -e.y2 }, id: e.id });
    } else if (e.type === "polyline" && !e.closed && e.pts.length > 1) {
      for (let i = 0; i < e.pts.length - 1; i++) {
        const ptA = e.pts[i]!;
        const ptB = e.pts[i + 1]!;
        lines.push({ p1: { x: ptA.x, y: -ptA.y }, p2: { x: ptB.x, y: -ptB.y }, id: `${e.id}_${i}` });
      }
    }
  }

  if (lines.length === 0) return [];

  const chains: Vec2[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const first = lines[i]!;
    const chain: Vec2[] = [{ ...first.p1 }, { ...first.p2 }];

    let expanded = true;
    while (expanded) {
      expanded = false;
      const tail = chain[chain.length - 1]!;
      const head = chain[0]!;

      for (let j = 0; j < lines.length; j++) {
        if (visited.has(j)) continue;
        const cur = lines[j]!;
        const tol = 1.2;

        if (Math.hypot(cur.p1.x - tail.x, cur.p1.y - tail.y) < tol) {
          chain.push({ ...cur.p2 });
          visited.add(j);
          expanded = true;
          break;
        } else if (Math.hypot(cur.p2.x - tail.x, cur.p2.y - tail.y) < tol) {
          chain.push({ ...cur.p1 });
          visited.add(j);
          expanded = true;
          break;
        } else if (Math.hypot(cur.p2.x - head.x, cur.p2.y - head.y) < tol) {
          chain.unshift({ ...cur.p1 });
          visited.add(j);
          expanded = true;
          break;
        } else if (Math.hypot(cur.p1.x - head.x, cur.p1.y - head.y) < tol) {
          chain.unshift({ ...cur.p2 });
          visited.add(j);
          expanded = true;
          break;
        }
      }
    }

    if (chain.length > 1) {
      chains.push(chain);
    }
  }

  return chains;
}

// -------------------------------------------------------------
// DETECÇÃO DE PEÇAS DE CHAPA (UMA OU VÁRIAS PEÇAS / MONTAGEM)
// -------------------------------------------------------------

export function detectAllSheetMetalParts(
  entities: Entity[],
  thickness: number,
  options: {
    width?: number;
    radius?: number;
    kFactor?: number;
    material?: SolidMaterial;
  } = {},
): SheetMetalProfileResult[] {
  const t = Math.max(0.2, thickness);
  const r = Math.max(0.2, options.radius ?? t);
  const k = Math.min(0.5, Math.max(0.2, options.kFactor ?? 0.33));
  const defaultWidth = Math.max(5, options.width ?? 120);
  const mat = options.material ?? "aco";
  const density = mat === "aluminio" ? 2.7 : 7.85;

  const bendEntities = entities.filter((e) => e.layer === "dobra" && e.type === "line");
  const cutShapes = solidShapes(entities);
  const openChains = extractOpenChains(entities);

  const results: SheetMetalProfileResult[] = [];

  // 1. Processa chapas planas com contorno fechado (com ou sem dobras)
  if (cutShapes.length > 0) {
    cutShapes.forEach((shape, shapeIdx) => {
      const flip = (p: Vec2) => ({ x: p.x, y: -p.y });
      const outline = shape.outline.map(flip);
      const holes = shape.holes.map((h) => h.map(flip));

      const xs = outline.map((p) => p.x);
      const ys = outline.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const bW = maxX - minX;
      const bL = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // Localiza linhas de dobra que interceptam ou estão contidas neste contorno
      const partBends: SheetMetalBendInfo[] = [];
      const associatedBends = bendEntities.filter((bl) => {
        if (bl.type !== "line") return false;
        const bP1 = { x: bl.x1, y: -bl.y1 };
        const bP2 = { x: bl.x2, y: -bl.y2 };
        const mid = { x: (bP1.x + bP2.x) / 2, y: (bP1.y + bP2.y) / 2 };
        return (
          pointInPoly(mid, outline) ||
          (mid.x >= minX - 2 && mid.x <= maxX + 2 && mid.y >= minY - 2 && mid.y <= maxY + 2)
        );
      });

      associatedBends.forEach((bl, bIdx) => {
        if (bl.type !== "line") return;
        const angleDeg = (bl as any).angleDeg ? Number((bl as any).angleDeg) : 90;
        const dir: "UP" | "DOWN" = (bl as any).direction === "down" ? "DOWN" : "UP";
        const customR = (bl as any).insideRadius ? Number((bl as any).insideRadius) : r;
        const customK = (bl as any).kFactor ? Number((bl as any).kFactor) : k;

        const ba = (angleDeg * DEG) * (customR + customK * t);
        const ossb = (customR + t) * Math.tan((angleDeg * DEG) * 0.5);
        const bd = 2 * ossb - ba;

        const localP1 = { x: bl.x1 - cx, y: -bl.y1 - cy };
        const localP2 = { x: bl.x2 - cx, y: -bl.y2 - cy };

        partBends.push({
          bendId: bl.id || `bend_${shapeIdx + 1}_${bIdx + 1}`,
          index: bIdx + 1,
          angleDeg,
          direction: dir,
          insideRadius: customR,
          thickness: t,
          kFactor: customK,
          bendAllowance: ba,
          bendDeduction: bd,
          outsideSetback: ossb,
          neutralRadius: customR + customK * t,
          flatPosition: Math.hypot(localP1.x, localP1.y),
          p1: localP1,
          p2: localP2,
        });
      });

      // Particiona a chapa em Face Base e Abas quando houver dobras
      const flangeRegions: SheetMetalFlangeRegion[] = [];
      const localOutline = outline.map((p) => ({ x: p.x - cx, y: p.y - cy }));
      const localHoles = holes.map((h) => h.map((p) => ({ x: p.x - cx, y: p.y - cy })));

      if (partBends.length > 0) {
        // Divide pela primeira dobra principal (ou sucessivas)
        let currentPolys = [localOutline];

        for (const bend of partBends) {
          if (!bend.p1 || !bend.p2) continue;
          const nextPolys: Vec2[][] = [];

          for (const poly of currentPolys) {
            const split = splitPolygonByLine(poly, bend.p1, bend.p2);
            if (split) {
              nextPolys.push(split.polyA, split.polyB);
            } else {
              nextPolys.push(poly);
            }
          }
          currentPolys = nextPolys;
        }

        // Ordena: o de maior área é a Face Base
        currentPolys.sort((a, b) => Math.abs(signedPolyArea(b)) - Math.abs(signedPolyArea(a)));

        currentPolys.forEach((poly, polyIdx) => {
          const isBase = polyIdx === 0;
          // Atribui os furos contidos nesta face
          const assignedHoles = localHoles.filter((h) => h.length > 0 && pointInPoly(h[0]!, poly));

          flangeRegions.push({
            id: `face_${shapeIdx + 1}_${polyIdx}`,
            isBase,
            outline: poly,
            holes: assignedHoles,
            bend: (!isBase && partBends[polyIdx - 1] ? partBends[polyIdx - 1] : partBends[0])!,
          });
        });
      }

      const blankArea = Math.abs(signedPolyArea(outline));
      const weightKg = ((blankArea * t) / 1e6) * density;

      results.push({
        id: shape.entityId,
        code: `CH${String(shapeIdx + 1).padStart(2, "0")}`,
        label:
          cutShapes.length > 1
            ? `Chapa ${shapeIdx + 1} (${partBends.length > 0 ? `${partBends.length} Dobras` : "Plana"})`
            : partBends.length > 0
              ? `Chapa Metálica (${partBends.length} Dobras)`
              : "Chapa Plana",
        type: partBends.length > 0 ? "blank-with-bends" : "flat-blank",
        thickness: t,
        width: bW,
        material: mat,
        kFactor: k,
        density,
        insideRadius: r,
        center: { x: cx, y: cy },
        bends: partBends,
        ...(flangeRegions.length > 0 ? { flangeRegions } : {}),
        developedLength: bL,
        developedWidth: bW,
        blankAreaMm2: blankArea,
        weightKg,
        segments: [],
        issues: [],
      });
    });
  }

  // 2. Processa perfis abertos (Flange Base / Esboço aberto)
  if (cutShapes.length === 0 && openChains.length > 0) {
    openChains.forEach((chain, chainIdx) => {
      const segments: SheetMetalProfileResult["segments"] = [];
      let nominalLength = 0;

      for (let i = 0; i < chain.length - 1; i++) {
        const p0 = chain[i]!;
        const p1 = chain[i + 1]!;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.1) continue;
        const angleRad = Math.atan2(dy, dx);
        segments.push({ p0, p1, length: len, angleRad });
        nominalLength += len;
      }

      const bends: SheetMetalBendInfo[] = [];
      let accumFlatPos = 0;
      let totalDeduction = 0;

      for (let i = 0; i < segments.length - 1; i++) {
        const s1 = segments[i]!;
        const s2 = segments[i + 1]!;

        let diff = s2.angleRad - s1.angleRad;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff <= -Math.PI) diff += 2 * Math.PI;

        const angleDeg = Math.abs(diff) * (180 / Math.PI);
        if (angleDeg > 1) {
          const direction: "UP" | "DOWN" = diff >= 0 ? "UP" : "DOWN";
          const ba = (angleDeg * DEG) * (r + k * t);
          const ossb = (r + t) * Math.tan((angleDeg * DEG) * 0.5);
          const bd = 2 * ossb - ba;

          accumFlatPos += s1.length;
          bends.push({
            bendId: `bend_open_${chainIdx + 1}_${i + 1}`,
            index: i + 1,
            angleDeg,
            direction,
            insideRadius: r,
            thickness: t,
            kFactor: k,
            bendAllowance: ba,
            bendDeduction: bd,
            outsideSetback: ossb,
            neutralRadius: r + k * t,
            flatPosition: accumFlatPos,
          });

          totalDeduction += bd;
        }
      }

      const developedLength = Math.max(1, nominalLength - totalDeduction);
      const blankArea = developedLength * defaultWidth;
      const weightKg = ((blankArea * t) / 1e6) * density;

      const xs = chain.map((p) => p.x);
      const ys = chain.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

      results.push({
        id: `open_chain_${chainIdx + 1}`,
        code: `CH${String(results.length + 1).padStart(2, "0")}`,
        label:
          openChains.length > 1
            ? `Flange Base ${chainIdx + 1} (${developedLength.toFixed(0)}×${defaultWidth}mm)`
            : `Flange Base (${developedLength.toFixed(0)}×${defaultWidth}mm)`,
        type: "open-profile",
        thickness: t,
        width: defaultWidth,
        material: mat,
        kFactor: k,
        density,
        insideRadius: r,
        center: { x: cx, y: cy },
        bends,
        developedLength,
        developedWidth: defaultWidth,
        blankAreaMm2: blankArea,
        weightKg,
        segments,
        issues: [],
      });
    });
  }

  return results;
}

/** Compatibilidade: detecta o perfil principal */
export function detectSheetMetalProfile(
  entities: Entity[],
  thickness: number,
  options: {
    width?: number;
    radius?: number;
    kFactor?: number;
    material?: SolidMaterial;
  } = {},
): SheetMetalProfileResult {
  const parts = detectAllSheetMetalParts(entities, thickness, options);
  if (parts.length > 0) return parts[0]!;

  return {
    id: "empty_sheet",
    code: "CH01",
    label: "Chapa Vazia",
    type: "flat-blank",
    thickness: Math.max(0.2, thickness),
    width: options.width ?? 120,
    material: options.material ?? "aco",
    kFactor: options.kFactor ?? 0.33,
    density: 7.85,
    insideRadius: thickness,
    center: { x: 0, y: 0 },
    bends: [],
    developedLength: 100,
    developedWidth: 100,
    blankAreaMm2: 10000,
    weightKg: 0.1,
    segments: [],
    issues: [],
  };
}

// -------------------------------------------------------------
// GERAÇÃO DE MALHA 3D COM CINEMÁTICA CONTÍNUA (SLIDER 0% A 100%)
// -------------------------------------------------------------

export function generateSheetMetalMesh(
  profile: SheetMetalProfileResult,
  foldProgress: number, // 0..1
): SolidCustomMesh {
  const kProg = Math.max(0, Math.min(1, foldProgress));
  const t = profile.thickness;
  const width = profile.width;
  const r = profile.insideRadius;

  // CASO 1: Perfil Aberto (Flange Base extrudado com raios de dobra analíticos)
  if (profile.type === "open-profile" && profile.segments.length > 0) {
    const segs = profile.segments;
    const pointsTop: Vec2[] = [];
    const pointsBot: Vec2[] = [];

    let curX = 0;
    let curY = 0;
    let curAngle = 0;

    const midPoints: { x: number; y: number }[] = [{ x: 0, y: 0 }];

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!;

      if (i > 0) {
        const prevS = segs[i - 1]!;
        let delta = s.angleRad - prevS.angleRad;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta <= -Math.PI) delta += 2 * Math.PI;

        const effectiveBendAngle = delta * kProg;
        curAngle += effectiveBendAngle;

        if (Math.abs(delta) > 0.02) {
          const ba = Math.abs(delta) * (r + profile.kFactor * t);
          const arcSteps = 6;
          const arcAngleStep = effectiveBendAngle / arcSteps;
          const stepLen = ba / arcSteps;

          for (let step = 1; step <= arcSteps; step++) {
            const a = curAngle - effectiveBendAngle + arcAngleStep * step;
            curX += Math.cos(a) * stepLen;
            curY += Math.sin(a) * stepLen;
            midPoints.push({ x: curX, y: curY });
          }
        }
      }

      const straightLen = s.length;
      curX += Math.cos(curAngle) * straightLen;
      curY += Math.sin(curAngle) * straightLen;
      midPoints.push({ x: curX, y: curY });
    }

    const xs = midPoints.map((p) => p.x);
    const ys = midPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const centeredMid = midPoints.map((p) => ({ x: p.x - centerX, y: p.y - centerY }));
    const nPts = centeredMid.length;

    for (let i = 0; i < nPts; i++) {
      const p = centeredMid[i]!;
      let nx = 0;
      let ny = 1;

      if (nPts === 1) {
        nx = 0;
        ny = 1;
      } else if (i === 0) {
        const next = centeredMid[i + 1]!;
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        nx = -dy / l;
        ny = dx / l;
      } else if (i === nPts - 1) {
        const prev = centeredMid[i - 1]!;
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const l = Math.hypot(dx, dy) || 1;
        nx = -dy / l;
        ny = dx / l;
      } else {
        const prev = centeredMid[i - 1]!;
        const next = centeredMid[i + 1]!;
        const dx1 = p.x - prev.x;
        const dy1 = p.y - prev.y;
        const l1 = Math.hypot(dx1, dy1) || 1;
        const dx2 = next.x - p.x;
        const dy2 = next.y - p.y;
        const l2 = Math.hypot(dx2, dy2) || 1;

        const avgNx = (-dy1 / l1 + -dy2 / l2) / 2;
        const avgNy = (dx1 / l1 + dx2 / l2) / 2;
        const nl = Math.hypot(avgNx, avgNy) || 1;
        nx = avgNx / nl;
        ny = avgNy / nl;
      }

      pointsTop.push({ x: p.x + nx * (t * 0.5), y: p.y + ny * (t * 0.5) });
      pointsBot.push({ x: p.x - nx * (t * 0.5), y: p.y - ny * (t * 0.5) });
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const halfZ = width * 0.5 * S;

    for (let i = 0; i < nPts; i++) {
      const pt = pointsTop[i]!;
      const pb = pointsBot[i]!;

      positions.push(pt.x * S, pt.y * S, -halfZ);
      positions.push(pt.x * S, pt.y * S, halfZ);
      positions.push(pb.x * S, pb.y * S, -halfZ);
      positions.push(pb.x * S, pb.y * S, halfZ);
    }

    for (let i = 0; i < nPts - 1; i++) {
      const b0 = i * 4;
      const b1 = (i + 1) * 4;

      indices.push(b0, b1, b0 + 1);
      indices.push(b1, b1 + 1, b0 + 1);

      indices.push(b0 + 2, b0 + 3, b1 + 2);
      indices.push(b1 + 2, b0 + 3, b1 + 3);

      indices.push(b0, b0 + 2, b1);
      indices.push(b1, b0 + 2, b1 + 2);

      indices.push(b0 + 1, b1 + 1, b0 + 3);
      indices.push(b1 + 1, b1 + 3, b0 + 3);
    }

    indices.push(0, 1, 2);
    indices.push(1, 3, 2);

    const end = (nPts - 1) * 4;
    indices.push(end, end + 2, end + 1);
    indices.push(end + 1, end + 2, end + 3);

    return {
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
    };
  }

  // CASO 2: Chapa Plana com Faces/Abas e Linhas de Dobra
  if (profile.flangeRegions && profile.flangeRegions.length > 0) {
    const allPositions: number[] = [];
    const allIndices: number[] = [];
    const halfT = (t * 0.5) * S;

    // Extruda e rotaciona cada região poligonal (Base ou Aba)
    for (const region of profile.flangeRegions) {
      if (region.outline.length < 3) continue;

      const shape = new THREE.Shape(
        region.outline.map((p) => new THREE.Vector2(p.x * S, p.y * S)),
      );
      for (const h of region.holes) {
        if (h.length > 2) {
          shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x * S, p.y * S))));
        }
      }

      const geom = new THREE.ExtrudeGeometry(shape, { depth: t * S, bevelEnabled: false });
      geom.translate(0, 0, -halfT);

      const posAttr = geom.getAttribute("position");
      const idxAttr = geom.getIndex();

      if (!posAttr) continue;

      // Se for uma Aba dobrada, aplica a rotação de Rodrigues em torno do eixo da dobra
      if (!region.isBase && region.bend && region.bend.p1 && region.bend.p2) {
        const a1 = { x: region.bend.p1.x * S, y: region.bend.p1.y * S, z: 0 };
        const a2 = { x: region.bend.p2.x * S, y: region.bend.p2.y * S, z: 0 };
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const len = Math.hypot(dx, dy) || 1;
        const u = { x: dx / len, y: dy / len, z: 0 };

        const dirSign = region.bend.direction === "DOWN" ? -1 : 1;
        const theta = dirSign * (region.bend.angleDeg * DEG) * kProg;

        for (let i = 0; i < posAttr.count; i++) {
          const v = { x: posAttr.getX(i), y: posAttr.getY(i), z: posAttr.getZ(i) };
          const rot = rotatePointAroundAxis(v, a1, u, theta);
          posAttr.setXYZ(i, rot.x, rot.y, rot.z);
        }
      }

      const vertexOffset = allPositions.length / 3;
      for (let i = 0; i < posAttr.count; i++) {
        allPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      }

      if (idxAttr) {
        for (let i = 0; i < idxAttr.count; i++) {
          allIndices.push(idxAttr.getX(i) + vertexOffset);
        }
      } else {
        for (let i = 0; i < posAttr.count; i++) {
          allIndices.push(vertexOffset + i);
        }
      }

      geom.dispose();
    }

    if (allPositions.length > 0) {
      return {
        positions: new Float32Array(allPositions),
        indices: new Uint32Array(allIndices),
      };
    }
  }

  // CASO 3: Chapa plana sem dobras (caixa / bloco sólido com espessura)
  const bW = profile.developedWidth;
  const bL = profile.developedLength;
  const halfX = (bW * 0.5) * S;
  const halfY = (bL * 0.5) * S;
  const halfZ = (t * 0.5) * S;

  const boxPositions = [
    -halfX, -halfY, -halfZ,  halfX, -halfY, -halfZ,  halfX,  halfY, -halfZ, -halfX,  halfY, -halfZ,
    -halfX, -halfY,  halfZ,  halfX, -halfY,  halfZ,  halfX,  halfY,  halfZ, -halfX,  halfY,  halfZ,
  ];
  const boxIndices = [
    0, 1, 2,  0, 2, 3,
    4, 6, 5,  4, 7, 6,
    0, 4, 1,  1, 4, 5,
    2, 6, 3,  3, 6, 7,
    0, 3, 4,  4, 3, 7,
    1, 5, 2,  2, 5, 6,
  ];

  return {
    positions: new Float32Array(boxPositions),
    indices: new Uint32Array(boxIndices),
  };
}

// -------------------------------------------------------------
// CONVERSÃO PARA INSTÂNCIAS SÓLIDAS DO MOTOR 3D (THREE.JS)
// -------------------------------------------------------------

export function buildAllSheetMetalSolidInstances(
  profiles: SheetMetalProfileResult[],
  foldProgress: number,
): SolidInstance[] {
  return profiles.map((p, idx) => {
    const mesh = generateSheetMetalMesh(p, foldProgress / 100);
    return {
      id: p.id,
      partKey: p.id,
      code: p.code,
      index: idx + 1,
      label: p.label,
      center: { x: p.center.x, y: p.center.y, z: 0 },
      size: {
        x: p.developedLength,
        y: p.developedWidth,
        z: p.thickness,
      },
      rotZ: 0,
      material: p.material,
      assemblyKey: "sheetmetal",
      fabricable: true,
      customMesh: mesh,
    };
  });
}

/** Compatibilidade para peça única */
export function buildSheetMetalSolidInstances(
  profile: SheetMetalProfileResult,
  foldProgress: number,
): SolidInstance[] {
  return buildAllSheetMetalSolidInstances([profile], foldProgress);
}

// -------------------------------------------------------------
// PLANIFICAÇÃO VETORIAL 2D (FLAT PATTERN)
// -------------------------------------------------------------

export function generateFlatPatternEntities(profile: SheetMetalProfileResult): Entity[] {
  const entities: Entity[] = [];
  const W = profile.developedWidth;
  const L = profile.developedLength;

  entities.push(
    { id: "fp_corte_1", type: "line", x1: 0, y1: 0, x2: W, y2: 0, layer: "corte" },
    { id: "fp_corte_2", type: "line", x1: W, y1: 0, x2: W, y2: L, layer: "corte" },
    { id: "fp_corte_3", type: "line", x1: W, y1: L, x2: 0, y2: L, layer: "corte" },
    { id: "fp_corte_4", type: "line", x1: 0, y1: L, x2: 0, y2: 0, layer: "corte" },
  );

  profile.bends.forEach((b, idx) => {
    const yPos = Math.min(L, Math.max(0, b.flatPosition));
    entities.push({
      id: `fp_bend_${idx + 1}`,
      type: "line",
      x1: 0,
      y1: yPos,
      x2: W,
      y2: yPos,
      layer: "dobra",
    });
  });

  return entities;
}
