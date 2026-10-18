/**
 * CALDRA CHAMFER — GERENCIADOR DE ESPAÇOS DE COORDENADAS (CoordinateFrameManager)
 *
 * Gerencia e converte rigorosamente entre 5 espaços de coordenadas mantendo a verdade global:
 *  1. Coordenadas Globais do Documento (mm reais);
 *  2. Coordenadas Relativas a uma Origem Temporária (REF 0,0);
 *  3. Coordenadas Locais Alinhadas a uma Borda/Plano (u = longitudinal, v = afastamento normal);
 *  4. Coordenadas Polares Locais (r = raio/distância, θ = ângulo em graus);
 *  5. Coordenadas de Visualização e Tela (Screen / Viewport com pan e zoom).
 */

import type { Vec2 } from "@/lib/geometry/types";
import type { SmartSnapKind } from "./cadReferenceSnaps";
import type { EdgeReference } from "./cadGeometricReferences";

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export interface TemporaryOrigin {
  id: string;
  p: Vec2;           // Coordenada no espaço global do mundo (mm)
  label: string;     // Ex: "Canto Superior", "Centro do Furo", "Origem (0,0)"
  kind: SmartSnapKind;
  entityId?: string;
  timestamp: number;
}

export interface ViewTransform {
  tx: number;
  ty: number;
  k: number;
}

export class CoordinateFrameManager {
  /**
   * 1 <-> 2: Conversão Global <-> Relativa a REF 0,0
   */
  static worldToRelative(worldPoint: Vec2, ref: TemporaryOrigin): Vec2 {
    return {
      x: worldPoint.x - ref.p.x,
      y: worldPoint.y - ref.p.y,
    };
  }

  static relativeToWorld(relativePoint: Vec2, ref: TemporaryOrigin): Vec2 {
    return {
      x: ref.p.x + relativePoint.x,
      y: ref.p.y + relativePoint.y,
    };
  }

  /**
   * 1 <-> 3: Conversão Global <-> Local Alinhada à Borda (u, v)
   * u: distância ao longo da borda a partir de p1
   * v: afastamento normal (perpendicular)
   */
  static worldToUV(worldPoint: Vec2, edge: EdgeReference): { u: number; v: number } {
    const dx = worldPoint.x - edge.p1.x;
    const dy = worldPoint.y - edge.p1.y;
    const u = dx * edge.dir.x + dy * edge.dir.y;
    const v = dx * edge.normal.x + dy * edge.normal.y;
    return { u, v };
  }

  static uvToWorld(u: number, v: number, edge: EdgeReference): Vec2 {
    return {
      x: edge.p1.x + u * edge.dir.x + v * edge.normal.x,
      y: edge.p1.y + u * edge.dir.y + v * edge.normal.y,
    };
  }

  /**
   * 1 <-> 4: Conversão Global <-> Polar Local (r, θ)
   */
  static worldToPolar(
    worldPoint: Vec2,
    origin: Vec2,
    baseAngleRad = 0,
  ): { r: number; thetaDeg: number; thetaRad: number } {
    const dx = worldPoint.x - origin.x;
    const dy = worldPoint.y - origin.y;
    const r = Math.hypot(dx, dy);

    let thetaRad = Math.atan2(dy, dx) - baseAngleRad;
    while (thetaRad < 0) thetaRad += 2 * Math.PI;
    while (thetaRad >= 2 * Math.PI) thetaRad -= 2 * Math.PI;

    return {
      r,
      thetaDeg: thetaRad * RAD2DEG,
      thetaRad,
    };
  }

  static polarToWorld(r: number, thetaDeg: number, origin: Vec2, baseAngleRad = 0): Vec2 {
    const totalRad = thetaDeg * DEG2RAD + baseAngleRad;
    return {
      x: origin.x + r * Math.cos(totalRad),
      y: origin.y + r * Math.sin(totalRad),
    };
  }

  /**
   * 1 <-> 5: Conversão Global <-> Tela / Viewport
   */
  static worldToScreen(worldPoint: Vec2, view: ViewTransform): Vec2 {
    return {
      x: worldPoint.x * view.k + view.tx,
      y: worldPoint.y * view.k + view.ty,
    };
  }

  static screenToWorld(screenPoint: Vec2, view: ViewTransform): Vec2 {
    const safeK = view.k !== 0 ? view.k : 1;
    return {
      x: (screenPoint.x - view.tx) / safeK,
      y: (screenPoint.y - view.ty) / safeK,
    };
  }

  /**
   * Formatação amigável das coordenadas relativas para a barra inferior e HUD:
   * Ex: "ΔX: +40.0 mm | ΔY: -15.5 mm"
   */
  static formatRelative(p: Vec2, ref: TemporaryOrigin, precision = 1): { dxStr: string; dyStr: string; text: string } {
    const rel = this.worldToRelative(p, ref);
    const signX = rel.x >= 0 ? "+" : "";
    const signY = rel.y >= 0 ? "+" : "";
    const dxStr = `${signX}${rel.x.toFixed(precision)} mm`;
    const dyStr = `${signY}${rel.y.toFixed(precision)} mm`;
    return {
      dxStr,
      dyStr,
      text: `ΔX: ${dxStr} | ΔY: ${dyStr}`,
    };
  }

  /**
   * Formatação das coordenadas de borda:
   * Ex: "u: 40.0 mm | v: 25.0 mm"
   */
  static formatUV(u: number, v: number, precision = 1): { uStr: string; vStr: string; text: string } {
    const uStr = `${u.toFixed(precision)} mm`;
    const vStr = `${v >= 0 ? "+" : ""}${v.toFixed(precision)} mm`;
    return {
      uStr,
      vStr,
      text: `u: ${uStr} | v: ${vStr}`,
    };
  }
}
