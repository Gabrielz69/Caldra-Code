/**
 * CALDRA CHAMFER — CLASSE MESTRE: CAD DOCUMENT PARAMÉTRICO (FASE 01)
 *
 * Entidade central da arquitetura B-Rep do CALDRA CHAMFER.
 * Unifica:
 * 1. Documento e Metadados (versão, unidades, revisões)
 * 2. Materiais Industriais (Aço Carbono A36, Inox 304, Alumínio 5052, etc.)
 * 3. Parâmetros e Expressões Paramétricas (tabela de variáveis)
 * 4. Esboços 2D Paramétricos (Sketches)
 * 5. Feature Graph (DAG de operações B-Rep)
 * 6. Corpos Sólidos e Chapas Metálicas (Bodies)
 * 7. Motor de Regeneração Seletiva B-Rep (CadRegenerator)
 * 8. Persistência Nativa (.chamfer / JSON)
 * 9. Compatibilidade bidirecional com a arquitetura existente da CALDRA
 */

import type { ICadKernel } from "../core/CadKernel";
import { getCadKernel } from "../core";
import type {
  CadDocumentUnits,
  CadMaterial,
  CadParameter,
  CadBody,
  CadSketch,
  CadReference,
} from "./types";
import { CadFeatureGraph } from "./CadFeatureGraph";
import { CadRegenerator, type RebuildReport } from "./CadRegenerator";
import { CadPersistence } from "./CadPersistence";
import { CadReferenceManager } from "./CadReference";
import type { CadFeatureType, CadFeatureParams } from "../features/CadFeatureModel";
import type { PartDocument } from "../kernel/types";

export const DEFAULT_UNITS: CadDocumentUnits = {
  length: "mm",
  angle: "deg",
  mass: "kg",
  precision: 2,
};

export const DEFAULT_MATERIALS: CadMaterial[] = [
  {
    id: "mat_steel_a36",
    name: "Aço Carbono ASTM A36",
    density: 7.85,
    yieldStrength: 250,
    ultimateStrength: 400,
    elasticModulus: 200,
    poissonRatio: 0.29,
    category: "Aço Carbono",
    sheetMetalDefaults: {
      kFactor: 0.44,
      defaultThicknessMm: 3.0,
      bendRadiusMm: 3.0,
    },
  },
  {
    id: "mat_inox_304",
    name: "Aço Inox AISI 304",
    density: 8.0,
    yieldStrength: 215,
    ultimateStrength: 505,
    elasticModulus: 193,
    poissonRatio: 0.29,
    category: "Aço Inox",
    sheetMetalDefaults: {
      kFactor: 0.42,
      defaultThicknessMm: 2.0,
      bendRadiusMm: 2.5,
    },
  },
  {
    id: "mat_al_5052",
    name: "Alumínio Naval 5052-H32",
    density: 2.68,
    yieldStrength: 195,
    ultimateStrength: 230,
    elasticModulus: 70,
    poissonRatio: 0.33,
    category: "Alumínio",
    sheetMetalDefaults: {
      kFactor: 0.40,
      defaultThicknessMm: 2.0,
      bendRadiusMm: 2.0,
    },
  },
];

export class CadDocument {
  public readonly id: string;
  public name: string;
  public revision: string = "1.0";
  public readonly createdAt: number = Date.now();
  public notes?: string;

  private units: CadDocumentUnits;
  private materialsCatalog: Map<string, CadMaterial> = new Map();
  private activeMaterialId: string;
  private parameters: Map<string, CadParameter> = new Map();
  private sketches: Map<string, CadSketch> = new Map();
  private bodies: Map<string, CadBody> = new Map();

  public readonly featureGraph: CadFeatureGraph;
  private kernel: ICadKernel;

  constructor(options?: {
    id?: string;
    name?: string;
    units?: Partial<CadDocumentUnits>;
    kernel?: ICadKernel;
  }) {
    this.id = options?.id ?? `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.name = options?.name ?? "Nova_Peça_CHAMFER";
    this.units = { ...DEFAULT_UNITS, ...options?.units };
    this.kernel = options?.kernel ?? getCadKernel();
    this.featureGraph = new CadFeatureGraph();

    // Carrega materiais padrão da indústria
    for (const mat of DEFAULT_MATERIALS) {
      this.materialsCatalog.set(mat.id, mat);
    }
    this.activeMaterialId = DEFAULT_MATERIALS[0]!.id;

    // Inicializa plano datum XY padrão
    this.initDefaultDatums();
  }

  // ==========================================
  // PLANOS E EIXOS DE REFERÊNCIA (DATUMS)
  // ==========================================

  private initDefaultDatums(): void {
    // Planos de referência canônicos no documento
    CadReferenceManager.createPlaneReference("DATUM_XY", { customId: "datum_plane_xy" });
    CadReferenceManager.createPlaneReference("DATUM_XZ", { customId: "datum_plane_xz" });
    CadReferenceManager.createPlaneReference("DATUM_YZ", { customId: "datum_plane_yz" });
  }

  // ==========================================
  // UNIDADES
  // ==========================================

  public getUnits(): CadDocumentUnits {
    return { ...this.units };
  }

  public setUnits(newUnits: Partial<CadDocumentUnits>): void {
    this.units = { ...this.units, ...newUnits };
  }

  // ==========================================
  // MATERIAIS
  // ==========================================

  public getActiveMaterial(): CadMaterial {
    return this.materialsCatalog.get(this.activeMaterialId) ?? DEFAULT_MATERIALS[0]!;
  }

  public setActiveMaterial(id: string): boolean {
    if (this.materialsCatalog.has(id)) {
      this.activeMaterialId = id;
      return true;
    }
    return false;
  }

  public addMaterial(material: CadMaterial): void {
    this.materialsCatalog.set(material.id, material);
  }

  public getMaterialsCatalog(): CadMaterial[] {
    return Array.from(this.materialsCatalog.values());
  }

  // ==========================================
  // PARÂMETROS E VARIÁVEIS
  // ==========================================

  public getParameter(name: string): CadParameter | undefined {
    return this.parameters.get(name);
  }

  public getAllParameters(): CadParameter[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Define ou atualiza um parâmetro geométrico.
   * Se o valor ou a expressão mudar, marca automaticamente como DIRTY
   * todas as features que utilizam este parâmetro.
   */
  public setParameter(param: CadParameter): void {
    const existing = this.parameters.get(param.name);
    const valueChanged = !existing || existing.value !== param.value || existing.expression !== param.expression;

    this.parameters.set(param.name, { ...param });

    if (valueChanged) {
      this.onParameterChanged(param.name);
    }
  }

  /**
   * Atalho simplificado para atribuir valor a um parâmetro
   */
  public setParam(name: string, value: number, expression?: string, unit: CadParameter["unit"] = "mm"): void {
    let finalValue = value;
    if (expression) {
      const evaluated = CadRegenerator.evaluateExpression(expression, this.parameters);
      if (!isNaN(evaluated)) finalValue = evaluated;
    }
    this.setParameter({
      id: `param_${name}`,
      name,
      value: finalValue,
      expression,
      unit,
    });
  }

  /**
   * Avalia uma expressão com o contexto das variáveis do documento
   */
  public evalExpr(expr: string | number): number {
    return CadRegenerator.evaluateExpression(expr, this.parameters);
  }

  private onParameterChanged(paramName: string): void {
    // Percorre todas as features do grafo procurando ocorrências do parâmetro
    for (const node of this.featureGraph.getAllNodes()) {
      const pString = JSON.stringify(node.parameters);
      const regex = new RegExp(`\\b${paramName}\\b`);
      if (regex.test(pString) || node.dependencies.includes(paramName)) {
        this.featureGraph.markDirty(node.id);
      }
    }
  }

  // ==========================================
  // ESBOÇOS (SKETCHES)
  // ==========================================

  public addSketch(sketch: CadSketch): void {
    this.sketches.set(sketch.id, sketch);
  }

  public getSketch(id: string): CadSketch | undefined {
    return this.sketches.get(id);
  }

  public getAllSketches(): CadSketch[] {
    return Array.from(this.sketches.values());
  }

  // ==========================================
  // CORPOS (BODIES)
  // ==========================================

  public getBody(id: string): CadBody | undefined {
    return this.bodies.get(id);
  }

  public getPrimaryBody(): CadBody | undefined {
    // Retorna o primeiro corpo sólido do documento
    return this.bodies.values().next().value;
  }

  public getAllBodies(): CadBody[] {
    return Array.from(this.bodies.values());
  }

  public addBody(body: CadBody): void {
    this.bodies.set(body.id, body);
  }

  // ==========================================
  // OPERAÇÕES PARAMÉTRICAS (FEATURES)
  // ==========================================

  public addFeature(data: {
    name: string;
    type: CadFeatureType;
    parameters: CadFeatureParams;
    references?: CadReference[];
    dependencies?: string[];
    targetBodyId?: string;
  }) {
    return this.featureGraph.addFeature(data);
  }

  public removeFeature(id: string): boolean {
    return this.featureGraph.removeFeature(id);
  }

  // ==========================================
  // REGENERAÇÃO INCREMENTAL DO B-REP (OCCT)
  // ==========================================

  /**
   * Regenera determinística e seletivamente apenas as features modificadas
   */
  public async rebuild(options?: { forceAll?: boolean }): Promise<RebuildReport> {
    return await CadRegenerator.regenerate(
      this.featureGraph,
      this.sketches,
      this.parameters,
      this.bodies,
      this.kernel,
      options,
    );
  }

  // ==========================================
  // PERSISTÊNCIA NATIVA (.chamfer / JSON)
  // ==========================================

  public serialize(options?: {
    includeBRepSnapshot?: boolean;
    includeTessellationSnapshot?: boolean;
  }) {
    return CadPersistence.serialize(this, options);
  }

  public toJson(pretty = true): string {
    return CadPersistence.exportToJson(this, { pretty });
  }

  public toBlob(): Blob {
    return CadPersistence.exportToBlob(this, { pretty: true });
  }

  public static async fromJson(json: string, kernel?: ICadKernel): Promise<CadDocument> {
    return await CadPersistence.deserialize(json, kernel);
  }

  // ==========================================
  // COMPATIBILIDADE COM A ARQUITETURA CALDRA
  // ==========================================

  /**
   * Converte este CadDocument paramétrico para o PartDocument legado
   * mantendo 100% de compatibilidade com todos os subpainéis e visualizadores
   */
  public toPartDocument(): PartDocument {
    const primaryBody = this.getPrimaryBody();
    const activeMat = this.getActiveMaterial();
    const thicknessParam = this.getParameter("thickness");
    const kFactorParam = this.getParameter("kFactor");

    const partDoc: PartDocument = {
      id: this.id,
      name: this.name,
      thickness: thicknessParam ? thicknessParam.value : (activeMat.sheetMetalDefaults?.defaultThicknessMm ?? 3.0),
      material: activeMat.name,
      density: activeMat.density,
      kFactor: kFactorParam ? kFactorParam.value : (activeMat.sheetMetalDefaults?.kFactor ?? 0.44),
      innerRadius: activeMat.sheetMetalDefaults?.bendRadiusMm ?? 3.0,
      activeState: "3D_FOLDED",
      featureTree: {} as any,
      canonicalModel: {} as any,
      cadDocumentRef: this,
    };

    if (primaryBody?.bRepShape) {
      (partDoc as any).activeCadShape = primaryBody.bRepShape;
    }

    return partDoc;
  }

  /**
   * Cria um CadDocument moderno a partir de um PartDocument legado
   */
  public static fromPartDocument(partDoc: PartDocument, kernel?: ICadKernel): CadDocument {
    const doc = new CadDocument({
      id: partDoc.id,
      name: partDoc.name,
      kernel,
    });

    // Sincroniza parâmetros base
    doc.setParam("thickness", partDoc.thickness || 3.0);
    doc.setParam("kFactor", partDoc.kFactor || 0.44);

    // Se houver caldeiraria ou features existentes
    if (partDoc.boilermakingFeature) {
      const { type, params } = partDoc.boilermakingFeature;
      let featType: CadFeatureType = "boilermaking_cone";
      if (type === "square_to_round") featType = "boilermaking_transition";
      else if (type === "elbow") featType = "boilermaking_elbow";
      else if (type === "branch") featType = "boilermaking_branch";

      doc.addFeature({
        name: partDoc.boilermakingFeature.name || "Caldeiraria_Base",
        type: featType,
        parameters: params,
      });
    }

    return doc;
  }
}
