/**
 * CALDRA CHAMFER — FOLHA DE DESENHO TÉCNICO E DOCUMENTAÇÃO INDUSTRIAL (ETAPA 26)
 *
 * Gera moldura normalizada ABNT / ISO (A4, A3, A2) e legenda técnica (carimbo):
 *  - Formatos: A4 (297x210 mm), A3 (420x297 mm), A2 (594x420 mm);
 *  - Margem normativa (esquerda 20/25 mm para encadernação, demais 10 mm);
 *  - Carimbo profissional CALDRA: Título, Cliente/Projeto, Material, Espessura,
 *    Escala, Unidades (mm), Projetista, Data, Tolerâncias gerais (ISO 2768-m).
 */

import type { Vec2 } from "@/lib/geometry/types";
import { uid, type Entity, type LayerId } from "./core";

export type SheetFormat = "A4_LANDSCAPE" | "A4_PORTRAIT" | "A3" | "A2";

export interface TechnicalSheetMetadata {
  title: string;
  pieceTag: string;
  material: string;
  thickness: string;
  scale: string;
  drafter: string;
  revision: string;
  date: string;
}

export function generateTechnicalSheetEntities(
  format: SheetFormat = "A3",
  origin: Vec2 = { x: 0, y: 0 },
  meta: TechnicalSheetMetadata = {
    title: "COMPONENTE DE CALDEIRARIA",
    pieceTag: "PC-01",
    material: "Aço ASTM A36",
    thickness: "6.35 mm",
    scale: "1:1",
    drafter: "CALDRA METAL LAB",
    revision: "R0",
    date: new Date().toLocaleDateString("pt-BR"),
  },
  layer: LayerId = "referencia",
): Entity[] {
  let width = 420;
  let height = 297;

  if (format === "A4_LANDSCAPE") {
    width = 297;
    height = 210;
  } else if (format === "A4_PORTRAIT") {
    width = 210;
    height = 297;
  } else if (format === "A3") {
    width = 420;
    height = 297;
  } else if (format === "A2") {
    width = 594;
    height = 420;
  }

  const entities: Entity[] = [];
  const x0 = origin.x;
  const y0 = origin.y;

  // 1. Borda externa do papel
  entities.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [
      { x: x0, y: y0 },
      { x: x0 + width, y: y0 },
      { x: x0 + width, y: y0 + height },
      { x: x0, y: y0 + height },
    ],
  });

  // 2. Margem interna normalizada (Esquerda 20mm, outras 10mm)
  const ml = 20;
  const mr = 10;
  const mt = 10;
  const mb = 10;

  const ix0 = x0 + ml;
  const iy0 = y0 + mb;
  const ix1 = x0 + width - mr;
  const iy1 = y0 + height - mt;

  entities.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [
      { x: ix0, y: iy0 },
      { x: ix1, y: iy0 },
      { x: ix1, y: iy1 },
      { x: ix0, y: iy1 },
    ],
  });

  // 3. Legenda Técnica / Carimbo CALDRA no canto inferior direito
  const titleW = 150;
  const titleH = 45;
  const tx0 = ix1 - titleW;
  const ty0 = iy0;

  // Contorno da legenda
  entities.push({
    id: uid(),
    layer,
    type: "polyline",
    closed: true,
    pts: [
      { x: tx0, y: ty0 },
      { x: ix1, y: ty0 },
      { x: ix1, y: ty0 + titleH },
      { x: tx0, y: ty0 + titleH },
    ],
  });

  // Divisórias internas da legenda
  entities.push(
    {
      id: uid(),
      layer,
      type: "line",
      x1: tx0,
      y1: ty0 + 20,
      x2: ix1,
      y2: ty0 + 20,
    },
    {
      id: uid(),
      layer,
      type: "line",
      x1: tx0,
      y1: ty0 + 32,
      x2: ix1,
      y2: ty0 + 32,
    },
    {
      id: uid(),
      layer,
      type: "line",
      x1: tx0 + 80,
      y1: ty0,
      x2: tx0 + 80,
      y2: ty0 + 32,
    },
  );

  // Textos da legenda
  entities.push(
    {
      id: uid(),
      layer: "anotacoes",
      type: "text",
      x: tx0 + 4,
      y: ty0 + 40,
      text: meta.title,
      size: 4.5,
      bold: true,
    },
    {
      id: uid(),
      layer: "anotacoes",
      type: "text",
      x: tx0 + 4,
      y: ty0 + 27,
      text: `MAT: ${meta.material} (${meta.thickness})`,
      size: 3.2,
    },
    {
      id: uid(),
      layer: "anotacoes",
      type: "text",
      x: tx0 + 84,
      y: ty0 + 27,
      text: `TAG: ${meta.pieceTag}`,
      size: 3.2,
      bold: true,
    },
    {
      id: uid(),
      layer: "anotacoes",
      type: "text",
      x: tx0 + 4,
      y: ty0 + 12,
      text: `ESC: ${meta.scale} | REV: ${meta.revision}`,
      size: 3,
    },
    {
      id: uid(),
      layer: "anotacoes",
      type: "text",
      x: tx0 + 84,
      y: ty0 + 12,
      text: `${meta.drafter} - ${meta.date}`,
      size: 2.8,
    },
  );

  return entities;
}
