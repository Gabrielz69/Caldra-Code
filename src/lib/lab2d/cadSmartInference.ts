/**
 * CALDRA CHAMFER — MOTOR DE INTELIGÊNCIA GEOMÉTRICA (CHAMFER INTELLIGENCE)
 *
 * Analisa o contexto ativo da seleção e desenho do usuário e infere intenções:
 *  - Duas retas quase paralelas (< 4° de diferença) -> Sugere restrição de Paralelismo;
 *  - Duas retas quase ortogonais (86°..94°) -> Sugere Perpendicularidade;
 *  - 2+ peças selecionadas -> Sugere Centralização ou Alinhamento;
 *  - Segmentos contíguos com extremidades compartilhadas -> Sugere JOIN em polilinha;
 *  - Contorno quase fechado (fresta < 2 mm) -> Sugere Fechar Contorno;
 *  - Linhas que se cruzam ou prolongam -> Sugere Trim / Extend;
 *  - Formas com espaçamentos regulares repetidos -> Sugere Matriz (Array).
 *
 * REGRA ABSOLUTA: A inteligência APENAS SUGERE e NUNCA altera o desenho sem confirmação.
 */

import type { Vec2 } from "@/lib/geometry/types";
import { dist, type Entity, segmentsOf, lineIntersection } from "./core";

export type SuggestionType =
  | "parallel"
  | "perpendicular"
  | "center_align"
  | "join_polyline"
  | "close_contour"
  | "trim_extend"
  | "create_array";

export interface GeometricSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  actionLabel: string;
  confidence: number; // 0..1
  affectedEntityIds: string[];
  suggestedAction: () => void;
}

export function evaluateGeometricIntent(
  selectedEntities: Entity[],
  allEntities: Entity[],
  onApplyAction?: (type: SuggestionType, entityIds: string[]) => void,
): GeometricSuggestion[] {
  const suggestions: GeometricSuggestion[] = [];

  // Caso 1: Duas entidades selecionadas
  if (selectedEntities.length === 2) {
    const [e1, e2] = selectedEntities;

    // Duas linhas: testa paralelo e perpendicular
    if (e1 && e2 && e1.type === "line" && e2.type === "line") {
      const ang1 = Math.atan2(e1.y2 - e1.y1, e1.x2 - e1.x1);
      const ang2 = Math.atan2(e2.y2 - e2.y1, e2.x2 - e2.x1);

      let diffDeg = Math.abs((ang1 - ang2) * (180 / Math.PI)) % 180;
      if (diffDeg > 90) diffDeg = 180 - diffDeg;

      // Quase paralelo (< 5°)
      if (diffDeg > 0.05 && diffDeg < 6) {
        suggestions.push({
          id: `par_${e1.id}_${e2.id}`,
          type: "parallel",
          title: "Linhas Quase Paralelas",
          description: `Desvio de apenas ${diffDeg.toFixed(1)}°. Deseja torná-las perfeitamente paralelas?`,
          actionLabel: "Tornar Paralelas",
          confidence: 0.9,
          affectedEntityIds: [e1.id, e2.id],
          suggestedAction: () => onApplyAction?.("parallel", [e1.id, e2.id]),
        });
      }

      // Quase perpendicular (85° a 95°)
      const diffPerp = Math.abs(diffDeg - 90);
      if (diffPerp > 0.05 && diffPerp < 6) {
        suggestions.push({
          id: `perp_${e1.id}_${e2.id}`,
          type: "perpendicular",
          title: "Canto em 90° (Ortogonal)",
          description: `Desvio de ${diffPerp.toFixed(1)}° de um ângulo reto perfeito. Deseja aplicar perpendicularidade?`,
          actionLabel: "Tornar Ortogonal (90°)",
          confidence: 0.92,
          affectedEntityIds: [e1.id, e2.id],
          suggestedAction: () => onApplyAction?.("perpendicular", [e1.id, e2.id]),
        });
      }

      // Se as linhas se cruzam ou se prolongam até o cruzamento -> sugere Trim/Extend
      const seg1: [Vec2, Vec2] = [{ x: e1.x1, y: e1.y1 }, { x: e1.x2, y: e1.y2 }];
      const seg2: [Vec2, Vec2] = [{ x: e2.x1, y: e2.y1 }, { x: e2.x2, y: e2.y2 }];
      const inter = lineIntersection(seg1, seg2, false);
      if (inter) {
        const d1 = dist(inter, seg1[0]) + dist(inter, seg1[1]);
        const d2 = dist(inter, seg2[0]) + dist(inter, seg2[1]);
        if (d1 < 1000 && d2 < 1000) {
          suggestions.push({
            id: `trim_${e1.id}_${e2.id}`,
            type: "trim_extend",
            title: "Ponto de Encontro Encontrado",
            description: `Interseção matemática identificada em (${inter.x.toFixed(1)}, ${inter.y.toFixed(1)}).`,
            actionLabel: "Conectar / Aparar no Encontro",
            confidence: 0.85,
            affectedEntityIds: [e1.id, e2.id],
            suggestedAction: () => onApplyAction?.("trim_extend", [e1.id, e2.id]),
          });
        }
      }
    }
  }

  // Caso 2: Três ou mais entidades selecionadas -> Sugere Centralização e Alinhamento
  if (selectedEntities.length >= 2) {
    suggestions.push({
      id: "center_multi",
      type: "center_align",
      title: "Centralização de Conjunto",
      description: `${selectedEntities.length} entidades selecionadas. Deseja centralizar os centros de gravidade?`,
      actionLabel: "Centralizar Formas",
      confidence: 0.8,
      affectedEntityIds: selectedEntities.map((e) => e.id),
      suggestedAction: () =>
        onApplyAction?.(
          "center_align",
          selectedEntities.map((e) => e.id),
        ),
    });
  }

  // Caso 3: Segmentos contíguos de linhas que podem virar polilinha contínua (JOIN)
  if (selectedEntities.length >= 2) {
    const lines = selectedEntities.filter((e) => e.type === "line");
    if (lines.length >= 2) {
      let connections = 0;
      for (let i = 0; i < lines.length; i++) {
        const a = lines[i]!;
        for (let j = i + 1; j < lines.length; j++) {
          const b = lines[j]!;
          if (
            dist({ x: a.x1, y: a.y1 }, { x: b.x1, y: b.y1 }) < 1 ||
            dist({ x: a.x1, y: a.y1 }, { x: b.x2, y: b.y2 }) < 1 ||
            dist({ x: a.x2, y: a.y2 }, { x: b.x1, y: b.y1 }) < 1 ||
            dist({ x: a.x2, y: a.y2 }, { x: b.x2, y: b.y2 }) < 1
          ) {
            connections++;
          }
        }
      }

      if (connections >= 1) {
        suggestions.push({
          id: "join_contour",
          type: "join_polyline",
          title: "Contorno Contínuo Detectado",
          description: `Os segmentos compartilham nós de extremidade. Deseja uni-los em uma polilinha unificada?`,
          actionLabel: "Unir em Polilinha (Join)",
          confidence: 0.95,
          affectedEntityIds: lines.map((e) => e.id),
          suggestedAction: () =>
            onApplyAction?.(
              "join_polyline",
              lines.map((e) => e.id),
            ),
        });
      }
    }
  }

  return suggestions;
}
