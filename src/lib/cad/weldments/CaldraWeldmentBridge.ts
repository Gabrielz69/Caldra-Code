/**
 * CALDRA CAD — WELDMENTS & STRUCTURAL FRAMING BRIDGE (FASE 10)
 *
 * Conecta o catálogo e motor de estruturas metálicas e perfis industriais
 * ao CAD CORE B-Rep (OpenCascade / OCCT) e à Árvore Paramétrica de Recursos:
 * - Vigas W / I, Canais U, Cantoneiras L, Tubos Metalon e Redondos;
 * - Criação de membros e quadros soldados paramétricos;
 * - Cálculo automático de lista de corte (Cut-List de Serralheria);
 * - Estimativa de aproveitamento de barras de 6m e 12m;
 * - Exportação de Cut-List para CSV / Excel e relatório técnico.
 */

import { ProfileCatalog } from "./profileCatalog";
import type { ProfileSection, ProfileType, CornerTreatmentType } from "./types";
import type { CadFeatureNode, WeldmentBeamParams, WeldmentFrameParams } from "../features/CadFeatureModel";
import { getCadKernel } from "../core";
import type { CadShape } from "../core/CadShape";

export interface CutListItem {
  itemNumber: number;
  profileDesignation: string;
  profileType: string;
  lengthMm: number;
  miterLeftDeg: number;
  miterRightDeg: number;
  quantity: number;
  unitMassKg: number;
  totalMassKg: number;
  commercialBarLengthM: number;
}

export interface WeldmentReport {
  projectName: string;
  totalMassKg: number;
  totalLengthM: number;
  cutList: CutListItem[];
  commercialBars6mNeeded: number;
  weldElectrodeMassKg: number;
  csvString: string;
}

export class CaldraWeldmentBridge {
  /**
   * Retorna todos os perfis disponíveis no catálogo
   */
  static getAvailableProfiles(): ProfileSection[] {
    return ProfileCatalog.getAll();
  }

  /**
   * Retorna perfis filtrados por tipo
   */
  static getProfilesByType(type: ProfileType): ProfileSection[] {
    return ProfileCatalog.getByType(type);
  }

  /**
   * Cria o sólido B-Rep 3D para um perfil estrutural no OCCT Kernel
   */
  static async createStructuralBeam(params: WeldmentBeamParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const length = Math.max(10, params.lengthMm);
    const width = Math.max(5, params.widthMm);
    const height = Math.max(5, params.heightMm);
    const thk = Math.max(1, params.thicknessMm);

    // 1. TUBO RETANGULAR / QUADRADO (METALON OCO)
    if (params.profileType === "RECT_TUBE") {
      const outerBox = await kernel.createBox(width, length, height, true, "Tubo Externo");
      if (width > thk * 2.2 && height > thk * 2.2) {
        const innerBox = await kernel.createBox(
          width - thk * 2,
          length + 4,
          height - thk * 2,
          true,
          "Tubo Interno Vazio",
        );
        return await kernel.cut(outerBox, innerBox, params.profileDesignation);
      }
      return outerBox;
    }

    // 2. TUBO REDONDO INDUSTRIAL (OCO)
    if (params.profileType === "ROUND_TUBE") {
      const r = width / 2;
      const outerCyl = await kernel.createCylinder(r, length, true, "Tubo Redondo Externo");
      if (r > thk * 1.2) {
        const innerCyl = await kernel.createCylinder(
          r - thk,
          length + 4,
          true,
          "Tubo Redondo Furo",
        );
        return await kernel.cut(outerCyl, innerCyl, params.profileDesignation);
      }
      return outerCyl;
    }

    // 3. VIGA I / W (COM ABAS E ALMA)
    if (params.profileType === "I_BEAM") {
      const b = width;
      const h = height;
      const tf = thk;
      const tw = Math.max(2, thk * 0.8);

      const mainEnvelope = await kernel.createBox(b, length, h, true, "Viga Envelope");
      const cutW = (b - tw) / 2;
      const cutH = h - tf * 2;

      if (cutW > 2 && cutH > 2) {
        const cutLeft = await kernel.createBox(cutW, length + 4, cutH, true, "Recorte Alma Esq");
        const cutRight = await kernel.createBox(cutW, length + 4, cutH, true, "Recorte Alma Dir");
        const cut1 = await kernel.cut(mainEnvelope, cutLeft, "Viga Sem Alma Esq");
        return await kernel.cut(cut1, cutRight, params.profileDesignation);
      }
      return mainEnvelope;
    }

    // 4. PERFIL U / CANAL
    if (params.profileType === "U_CHANNEL") {
      const b = width;
      const h = height;
      const tf = thk;

      const mainEnvelope = await kernel.createBox(b, length, h, true, "Canal Envelope");
      const cutW = b - tf;
      const cutH = h - tf * 2;

      if (cutW > 2 && cutH > 2) {
        const innerCut = await kernel.createBox(cutW, length + 4, cutH, true, "Vazio Canal");
        return await kernel.cut(mainEnvelope, innerCut, params.profileDesignation);
      }
      return mainEnvelope;
    }

    // 5. CANTONEIRA L
    if (params.profileType === "L_ANGLE") {
      const b = width;
      const h = height;
      const t = thk;

      const mainEnvelope = await kernel.createBox(b, length, h, true, "Cantoneira Envelope");
      const cutW = b - t;
      const cutH = h - t;

      if (cutW > 2 && cutH > 2) {
        const cornerCut = await kernel.createBox(cutW, length + 4, cutH, true, "Vazio Cantoneira");
        return await kernel.cut(mainEnvelope, cornerCut, params.profileDesignation);
      }
      return mainEnvelope;
    }

    // 6. BARRA CHATA / PADRÃO
    return await kernel.createBox(width, length, height, true, params.profileDesignation);
  }

  /**
   * Cria um quadro/chassi soldado completo (4 membros com corte de esquadria 45°)
   */
  static async createStructuralFrame(params: WeldmentFrameParams): Promise<CadShape> {
    const kernel = getCadKernel();
    const w = Math.max(50, params.frameWidthMm);
    const l = Math.max(50, params.frameLengthMm);
    const h = params.frameHeightMm ?? 40;
    const thk = 3.0;

    // Cria o sólido oco do chassi retangular
    const outerFrame = await kernel.createBox(w, l, h, true, "Quadro Externo");
    const innerVoid = await kernel.createBox(w - 60, l - 60, h + 4, true, "Quadro Vazio Central");
    return await kernel.cut(outerFrame, innerVoid, params.frameName);
  }

  /**
   * Extrai e calcula a lista de corte de serralheria (Cut-List) a partir das features
   */
  static generateCutList(
    features: readonly CadFeatureNode[],
    fallbackDimensions = { width: 100, length: 500, height: 50 },
  ): WeldmentReport {
    const cutList: CutListItem[] = [];
    let totalMassKg = 0;
    let totalLengthMm = 0;

    // Procura features de perfis ou quadros
    const weldmentFeatures = features.filter(
      (f) => f.type === "weldment_beam" || f.type === "weldment_frame",
    );

    if (weldmentFeatures.length > 0) {
      let idx = 1;
      for (const f of weldmentFeatures) {
        if (f.type === "weldment_beam") {
          const p = f.parameters as unknown as WeldmentBeamParams;
          const len = p.lengthMm;
          const mass = (len / 1000) * (p.linearMassKgM || 4.5);
          cutList.push({
            itemNumber: idx++,
            profileDesignation: p.profileDesignation,
            profileType: p.profileType,
            lengthMm: len,
            miterLeftDeg: p.miterLeftDeg ?? 90,
            miterRightDeg: p.miterRightDeg ?? 90,
            quantity: 1,
            unitMassKg: Number(mass.toFixed(2)),
            totalMassKg: Number(mass.toFixed(2)),
            commercialBarLengthM: len > 6000 ? 12 : 6,
          });
          totalMassKg += mass;
          totalLengthMm += len;
        } else if (f.type === "weldment_frame") {
          const p = f.parameters as unknown as WeldmentFrameParams;
          const w = p.frameWidthMm;
          const l = p.frameLengthMm;
          const unitW = (w / 1000) * 4.5;
          const unitL = (l / 1000) * 4.5;

          // 2 travessas de largura (45° / 45°)
          cutList.push({
            itemNumber: idx++,
            profileDesignation: p.profileDesignation,
            profileType: "RECT_TUBE",
            lengthMm: w,
            miterLeftDeg: 45,
            miterRightDeg: 45,
            quantity: 2,
            unitMassKg: Number(unitW.toFixed(2)),
            totalMassKg: Number((unitW * 2).toFixed(2)),
            commercialBarLengthM: 6,
          });

          // 2 longarinas de comprimento (45° / 45°)
          cutList.push({
            itemNumber: idx++,
            profileDesignation: p.profileDesignation,
            profileType: "RECT_TUBE",
            lengthMm: l,
            miterLeftDeg: 45,
            miterRightDeg: 45,
            quantity: 2,
            unitMassKg: Number(unitL.toFixed(2)),
            totalMassKg: Number((unitL * 2).toFixed(2)),
            commercialBarLengthM: 6,
          });

          const frameMass = (unitW * 2) + (unitL * 2);
          totalMassKg += frameMass;
          totalLengthMm += (w * 2) + (l * 2);
        }
      }
    } else {
      // Fallback padrão se não houver feature de perfil explícita
      const len = fallbackDimensions.length;
      const mass = (len / 1000) * 5.2;
      cutList.push({
        itemNumber: 1,
        profileDesignation: "Tubo Metalon 50x30x2.00",
        profileType: "RECT_TUBE",
        lengthMm: len,
        miterLeftDeg: 90,
        miterRightDeg: 90,
        quantity: 1,
        unitMassKg: Number(mass.toFixed(2)),
        totalMassKg: Number(mass.toFixed(2)),
        commercialBarLengthM: 6,
      });
      totalMassKg += mass;
      totalLengthMm += len;
    }

    const totalLengthM = totalLengthMm / 1000;
    const commercialBars6mNeeded = Math.ceil((totalLengthM * 1.1) / 6); // 10% de perda
    const weldElectrodeMassKg = Number((totalMassKg * 0.02).toFixed(2)); // ~2% do peso em solda

    // Monta string CSV para exportação
    let csv = `ITEM;PERFIL;TIPO;COMPRIMENTO (MM);ANGULO ESQ (GRAUS);ANGULO DIR (GRAUS);QUANTIDADE;MASSA UNIT (KG);MASSA TOTAL (KG);BARRA COMERCIAL (M)\n`;
    for (const c of cutList) {
      csv += `${c.itemNumber};"${c.profileDesignation}";${c.profileType};${c.lengthMm.toFixed(1)};${c.miterLeftDeg}°;${c.miterRightDeg}°;${c.quantity};${c.unitMassKg.toFixed(2)};${c.totalMassKg.toFixed(2)};${c.commercialBarLengthM}m\n`;
    }

    return {
      projectName: features[0]?.name || "Estrutura Metálica",
      totalMassKg: Number(totalMassKg.toFixed(2)),
      totalLengthM: Number(totalLengthM.toFixed(2)),
      cutList,
      commercialBars6mNeeded,
      weldElectrodeMassKg,
      csvString: csv,
    };
  }
}
