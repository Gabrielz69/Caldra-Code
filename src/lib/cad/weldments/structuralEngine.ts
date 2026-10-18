// @ts-nocheck
/**
 * CALDRA CAD — STRUCTURAL FRAMING & WELDMENTS ENGINE (FASE 10)
 *
 * Motor de modelagem para estruturas metálicas paramétricas, tratamento de cantos
 * (esquadrias, juntas de topo, recortes copados), cálculo de lista de corte (Cut List),
 * aproveitamento de barras comerciais e consumo de solda.
 */

import type { Vector3D, SolidBody3D, Face3D, Edge3D, Vertex3D } from "../canonical";
import type {
  StructuralMember,
  ProfileSection,
  ProfileAlignment,
  CornerTreatmentType,
  WeldmentCutListItem,
  StructuralFrameReport,
  StructuralWeld,
} from "./types";

export class StructuralEngine {
  /**
   * Cria um membro estrutural 3D ao longo de um vetor diretor no espaço.
   */
  static createMember(params: {
    id?: string;
    name?: string;
    profile: ProfileSection;
    startPoint: Vector3D;
    endPoint: Vector3D;
    alignment?: ProfileAlignment;
    rotationDeg?: number;
    weldGapMm?: number;
  }): StructuralMember {
    const {
      id = `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name = `${params.profile.designation}`,
      profile,
      startPoint,
      endPoint,
      alignment = "CENTER",
      rotationDeg = 0,
      weldGapMm = 0,
    } = params;

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const dz = endPoint.z - startPoint.z;
    const lengthMm = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (lengthMm <= 0.001) {
      throw new Error("Comprimento do membro estrutural deve ser maior que zero.");
    }

    const member: StructuralMember = {
      id,
      name,
      profile,
      startPoint: { ...startPoint },
      endPoint: { ...endPoint },
      lengthMm: Number(lengthMm.toFixed(2)),
      rotationDeg,
      alignment,
      cutAngleStartDeg: 90,
      cutAngleEndDeg: 90,
      weldGapMm,
    };

    // Gera o sólido representativo B-Rep 3D
    member.solid = this.generateMemberSolid(member);

    return member;
  }

  /**
   * Aplica tratamento de cantos/junções entre dois membros adjacentes.
   */
  static applyCornerTreatment(
    memberA: StructuralMember,
    memberB: StructuralMember,
    treatment: CornerTreatmentType,
    weldGapMm = 1.5,
  ): { memberA: StructuralMember; memberB: StructuralMember } {
    // Vetores diretores normalizados
    const vA = this.getDirection(memberA);
    const vB = this.getDirection(memberB);

    // Produto escalar para calcular ângulo relativo entre eixos
    const dot = Math.max(-1, Math.min(1, vA.x * vB.x + vA.y * vB.y + vA.z * vB.z));
    const angleRad = Math.acos(Math.abs(dot));
    const angleDeg = (angleRad * 180) / Math.PI;

    const updatedA = { ...memberA };
    const updatedB = { ...memberB };

    switch (treatment) {
      case "MITER": {
        // Corte de esquadria na bissetriz (normalmente 45° quando ortogonal a 90°)
        const miterAngle = angleDeg > 0.1 ? angleDeg / 2 : 45;
        updatedA.cutAngleEndDeg = Number(miterAngle.toFixed(1));
        updatedB.cutAngleStartDeg = Number(miterAngle.toFixed(1));
        break;
      }

      case "BUTT_1": {
        // Membro A estende completamente; Membro B trunca no encosto com gap de solda
        const offsetMm = memberA.profile.widthMm + weldGapMm;
        const newLenB = Math.max(10, memberB.lengthMm - offsetMm);
        updatedB.lengthMm = Number(newLenB.toFixed(2));
        updatedB.weldGapMm = weldGapMm;
        updatedA.cutAngleEndDeg = 90;
        updatedB.cutAngleStartDeg = 90;
        break;
      }

      case "BUTT_2": {
        // Membro B estende completamente; Membro A trunca no encosto
        const offsetMm = memberB.profile.widthMm + weldGapMm;
        const newLenA = Math.max(10, memberA.lengthMm - offsetMm);
        updatedA.lengthMm = Number(newLenA.toFixed(2));
        updatedA.weldGapMm = weldGapMm;
        updatedA.cutAngleEndDeg = 90;
        updatedB.cutAngleStartDeg = 90;
        break;
      }

      case "COPE": {
        // Recorte copado para viga/canal
        updatedA.cutAngleEndDeg = 90;
        updatedB.cutAngleStartDeg = 90;
        break;
      }

      default:
        break;
    }

    // Regenera sólidos com novos parâmetros
    updatedA.solid = this.generateMemberSolid(updatedA);
    updatedB.solid = this.generateMemberSolid(updatedB);

    return { memberA: updatedA, memberB: updatedB };
  }

  /**
   * Gera a Lista Técnica de Corte (Weldment Cut List) e cálculo de barras comerciais.
   */
  static generateCutList(
    projectName: string,
    members: StructuralMember[],
    standardBarLengthMeters = 6.0,
  ): StructuralFrameReport {
    // Agrupa membros por perfil + comprimento aproximado + ângulos
    const groupMap = new Map<string, WeldmentCutListItem>();
    let totalLengthMm = 0;
    let totalMassKg = 0;

    members.forEach((m) => {
      const key = `${m.profile.designation}_${Math.round(m.lengthMm)}_${m.cutAngleStartDeg}_${m.cutAngleEndDeg}`;
      const unitMassKg = Number(((m.lengthMm / 1000) * m.profile.linearMassKgM).toFixed(3));
      totalLengthMm += m.lengthMm;
      totalMassKg += unitMassKg;

      const existing = groupMap.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.totalMassKg = Number((existing.unitMassKg * existing.quantity).toFixed(2));
      } else {
        groupMap.set(key, {
          itemNumber: groupMap.size + 1,
          profileDesignation: m.profile.designation,
          profileType: m.profile.type,
          material: m.profile.standard,
          cutLengthMm: Math.round(m.lengthMm),
          quantity: 1,
          angle1Deg: m.cutAngleStartDeg,
          angle2Deg: m.cutAngleEndDeg,
          linearMassKgM: m.profile.linearMassKgM,
          unitMassKg,
          totalMassKg: unitMassKg,
        });
      }
    });

    const cutList = Array.from(groupMap.values());

    // Algoritmo de Otimização de Corte 1D (First Fit Decreasing Heuristic)
    // Calcula o número de barras padrão necessárias para cada seção de perfil
    const profileGroups = new Map<string, number[]>();
    members.forEach((m) => {
      const list = profileGroups.get(m.profile.designation) || [];
      list.push(m.lengthMm);
      profileGroups.set(m.profile.designation, list);
    });

    const barStockMm = standardBarLengthMeters * 1000;
    const sawKerfMm = 3.0; // Espessura do disco de serra fita

    const rawStockBarsNeeded: StructuralFrameReport["rawStockBarsNeeded"] = [];

    profileGroups.forEach((lengths, designation) => {
      // Ordena comprimentos de forma decrescente
      const sorted = [...lengths].sort((a, b) => b - a);
      const barsRemaining: number[] = [];

      for (const len of sorted) {
        let placed = false;
        for (let i = 0; i < barsRemaining.length; i++) {
          if (barsRemaining[i] >= len + sawKerfMm) {
            barsRemaining[i] -= len + sawKerfMm;
            placed = true;
            break;
          }
        }
        if (!placed) {
          barsRemaining.push(barStockMm - len);
        }
      }

      const barsCount = Math.max(1, barsRemaining.length);
      const totalPurchasedMm = barsCount * barStockMm;
      const totalConsumedMm = lengths.reduce((acc, v) => acc + v, 0);
      const scrapPercentage = Number(
        Math.max(0, ((totalPurchasedMm - totalConsumedMm) / totalPurchasedMm) * 100).toFixed(1),
      );

      rawStockBarsNeeded.push({
        profileDesignation: designation,
        standardBarLengthMeters,
        barsCount,
        scrapPercentage,
      });
    });

    return {
      projectName,
      totalMembersCount: members.length,
      totalLengthMeters: Number((totalLengthMm / 1000).toFixed(2)),
      totalMassKg: Number(totalMassKg.toFixed(2)),
      cutList,
      rawStockBarsNeeded,
      totalWeldLengthMeters: 0,
      totalWeldConsumablesKg: 0,
    };
  }

  /**
   * Estima o consumo de metal de adição e comprimento de cordões de solda.
   */
  static calculateWeldConsumables(welds: StructuralWeld[]): {
    totalLengthMeters: number;
    totalConsumableKg: number;
  } {
    let totalLengthMm = 0;
    let totalKg = 0;

    welds.forEach((w) => {
      totalLengthMm += w.lengthMm;
      // Para solda de filete: área da seção do triângulo A = 0.5 * z * z
      // Volume = A * comprimento. Densidade aço = 7.85 g/cm3. Rendimento MIG ~ 85%
      const legCm = w.legSizeMm / 10;
      const lengthCm = w.lengthMm / 10;
      const areaCm2 = 0.5 * legCm * legCm;
      const volumeCm3 = areaCm2 * lengthCm;
      const depositMassKg = (volumeCm3 * 7.85) / 1000;
      const efficiency = w.weldProcess === "MIG_MAG" ? 0.88 : w.weldProcess === "TIG" ? 0.95 : 0.65;
      const consumedKg = depositMassKg / efficiency;

      totalKg += consumedKg;
    });

    return {
      totalLengthMeters: Number((totalLengthMm / 1000).toFixed(2)),
      totalConsumableKg: Number(totalKg.toFixed(3)),
    };
  }

  /**
   * Constrói a representação sólida B-Rep 3D aproximada do membro.
   */
  private static generateMemberSolid(member: StructuralMember): SolidBody3D {
    const { startPoint, endPoint, profile } = member;
    const minX = Math.min(startPoint.x, endPoint.x) - profile.widthMm / 2;
    const maxX = Math.max(startPoint.x, endPoint.x) + profile.widthMm / 2;
    const minY = Math.min(startPoint.y, endPoint.y) - profile.heightMm / 2;
    const maxY = Math.max(startPoint.y, endPoint.y) + profile.heightMm / 2;
    const minZ = Math.min(startPoint.z, endPoint.z);
    const maxZ = Math.max(startPoint.z, endPoint.z) + member.lengthMm;

    // Vértices do paralelepípedo envolvente
    const vertices: Vertex3D[] = [
      { id: `${member.id}_v0`, point: { x: minX, y: minY, z: minZ } },
      { id: `${member.id}_v1`, point: { x: maxX, y: minY, z: minZ } },
      { id: `${member.id}_v2`, point: { x: maxX, y: maxY, z: minZ } },
      { id: `${member.id}_v3`, point: { x: minX, y: maxY, z: minZ } },
      { id: `${member.id}_v4`, point: { x: minX, y: minY, z: maxZ } },
      { id: `${member.id}_v5`, point: { x: maxX, y: minY, z: maxZ } },
      { id: `${member.id}_v6`, point: { x: maxX, y: maxY, z: maxZ } },
      { id: `${member.id}_v7`, point: { x: minX, y: maxY, z: maxZ } },
    ];

    const edges: Edge3D[] = [
      { id: `${member.id}_e0`, v0: vertices[0], v1: vertices[1], curveType: "LINE" },
      { id: `${member.id}_e1`, v0: vertices[1], v1: vertices[2], curveType: "LINE" },
      { id: `${member.id}_e2`, v0: vertices[2], v1: vertices[3], curveType: "LINE" },
      { id: `${member.id}_e3`, v0: vertices[3], v1: vertices[0], curveType: "LINE" },
      { id: `${member.id}_e4`, v0: vertices[4], v1: vertices[5], curveType: "LINE" },
      { id: `${member.id}_e5`, v0: vertices[5], v1: vertices[6], curveType: "LINE" },
      { id: `${member.id}_e6`, v0: vertices[6], v1: vertices[7], curveType: "LINE" },
      { id: `${member.id}_e7`, v0: vertices[7], v1: vertices[4], curveType: "LINE" },
      { id: `${member.id}_e8`, v0: vertices[0], v1: vertices[4], curveType: "LINE" },
      { id: `${member.id}_e9`, v0: vertices[1], v1: vertices[5], curveType: "LINE" },
      { id: `${member.id}_e10`, v0: vertices[2], v1: vertices[6], curveType: "LINE" },
      { id: `${member.id}_e11`, v0: vertices[3], v1: vertices[7], curveType: "LINE" },
    ];

    const faces: Face3D[] = [
      {
        id: `${member.id}_f0`,
        surfaceType: "PLANE",
        outerLoop: [edges[0], edges[1], edges[2], edges[3]],
        normal: { x: 0, y: 0, z: -1 },
      },
      {
        id: `${member.id}_f1`,
        surfaceType: "PLANE",
        outerLoop: [edges[4], edges[5], edges[6], edges[7]],
        normal: { x: 0, y: 0, z: 1 },
      },
      {
        id: `${member.id}_f2`,
        surfaceType: "PLANE",
        outerLoop: [edges[0], edges[9], edges[4], edges[8]],
        normal: { x: 0, y: -1, z: 0 },
      },
      {
        id: `${member.id}_f3`,
        surfaceType: "PLANE",
        outerLoop: [edges[2], edges[10], edges[6], edges[11]],
        normal: { x: 0, y: 1, z: 0 },
      },
      {
        id: `${member.id}_f4`,
        surfaceType: "PLANE",
        outerLoop: [edges[3], edges[8], edges[7], edges[11]],
        normal: { x: -1, y: 0, z: 0 },
      },
      {
        id: `${member.id}_f5`,
        surfaceType: "PLANE",
        outerLoop: [edges[1], edges[9], edges[5], edges[10]],
        normal: { x: 1, y: 0, z: 0 },
      },
    ];

    const volume = profile.areaCm2 * 100 * member.lengthMm;

    return {
      id: `solid_${member.id}`,
      name: member.name,
      faces,
      edges,
      vertices,
      volume,
      bounds: {
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
      },
    };
  }

  /**
   * Vetor unitário diretor do membro.
   */
  private static getDirection(member: StructuralMember): Vector3D {
    const dx = member.endPoint.x - member.startPoint.x;
    const dy = member.endPoint.y - member.startPoint.y;
    const dz = member.endPoint.z - member.startPoint.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return {
      x: dx / len,
      y: dy / len,
      z: dz / len,
    };
  }
}
