/**
 * CALDRA CAD — FEATURE TREE & REBUILD TYPES (FASE 03)
 *
 * Estruturas da árvore paramétrica de recursos (Feature Tree),
 * estados de validação de dependências e rebuild de modelo canônico.
 */

export type FeatureState =
  | "VALID" // Feature calculada e consistente
  | "DIRTY" // Parâmetro modificado diretamente nesta feature
  | "STALE" // Derivado desatualizado (uma dependência anterior mudou)
  | "ERROR" // Erro geométrico ou topológico durante o cálculo
  | "SUPPRESSED"; // Recurso temporariamente desativado pelo usuário

export type FeatureType =
  | "reference_plane"
  | "sketch"
  | "extrude"
  | "cut_extrude"
  | "hole"
  | "fillet"
  | "chamfer"
  | "convert_sheet_metal"
  | "bend"
  | "edge_flange"
  | "unfold"
  | "fold"
  | "flat_pattern"
  | "boilermaking_cone"
  | "boilermaking_transition"
  | "boilermaking_elbow"
  | "boilermaking_branch"
  | "boolean_union"
  | "boolean_difference"
  | "boolean_intersect"
  | "assembly_mate"
  | "component_instance"
  | "cam_toolpath"
  | "cam_gcode_export"
  | "gusset"
  | "louver"
  | "emboss"
  | "hem_flange"
  | "jog_flange";

export interface StaleNotification {
  featureId: string;
  featureName: string;
  affectedDomains: ("2D" | "3D" | "planificação" | "CNC" | "BOM" | "documentação" | "fabricação")[];
  reason: string;
}

export interface Feature<TParams = Record<string, unknown>, TResult = unknown> {
  id: string;
  name: string;
  type: FeatureType;
  order: number;
  state: FeatureState;
  parameters: TParams;
  references: string[]; // IDs de entidades de apoio (planos, faces, arestas, sketches)
  dependencies: string[]; // IDs de features anteriores das quais esta depende
  affectedEntityIds: string[]; // IDs de entidades geradas no CanonicalModel
  result?: TResult;
  errors: string[];
  warnings: string[];
  isSuppressed: boolean;
  timestamp: number;
}

export interface RebuildReport {
  success: boolean;
  rebuiltFeatureCount: number;
  cachedFeatureCount: number;
  durationMs: number;
  staleAlerts: StaleNotification[];
  errors: { featureId: string; featureName: string; message: string }[];
}
