/**
 * CALDRA CAD CORE — MASTER KERNEL INTERFACE
 *
 * Interface neutra de alto nível do motor CAD.
 * O restante da aplicação CALDRA (CHAMFER, traçagem, painéis React)
 * comunica-se EXCLUSIVAMENTE através desta interface.
 * Nenhuma dependência direta de APIs do OCCT deve transbordar para a UI.
 */

import type { CadShape } from "./CadShape";
import type { CadVector3D, CadBoundingBox, CadSolid, CadFace, CadEdge, CadVertex } from "./CadTopology";
import type { CadTessellatedShape } from "./CadMesh";

export interface MassProperties {
  volume: number; // mm³
  surfaceArea: number; // mm²
  mass: number; // kg
  centerOfMass: CadVector3D;
  inertiaMatrix?: number[];
}

export interface TessellateOptions {
  linearDeflection?: number; // Desvio máximo cordal (mm). Padrão: 0.1
  angularDeflection?: number; // Desvio máximo angular (rad). Padrão: 0.5
}

export interface ICadKernel {
  /** Indica se o kernel WASM está pronto para operações */
  readonly isInitialized: boolean;

  /** Inicializa o motor geométrico sob demanda */
  init(wasmSource?: string | URL | ArrayBuffer | Uint8Array): Promise<void>;

  /** Libera recursos e encerra a arena de memória do kernel */
  dispose(): void;

  // ==========================================
  // PRIMITIVAS SÓLIDAS B-REP
  // ==========================================

  /** Cria uma caixa sólida de dimensões dx, dy, dz (mm) */
  createBox(
    dx: number,
    dy: number,
    dz: number,
    centerOrigin?: boolean,
    name?: string,
  ): Promise<CadShape>;

  /** Cria um cilindro sólido ao longo do eixo Z com raio e altura (mm) */
  createCylinder(
    radius: number,
    height: number,
    centerBase?: boolean,
    name?: string,
  ): Promise<CadShape>;

  /** Cria um cone (ou tronco de cone) ao longo do eixo Z com raios r1, r2 e altura (mm) */
  createCone(
    r1: number,
    r2: number,
    height: number,
    name?: string,
  ): Promise<CadShape>;

  /** Cria uma esfera sólida centrada na origem com o raio especificado (mm) */
  createSphere(radius: number, name?: string): Promise<CadShape>;

  /** Cria um toro sólido com raio maior e raio do tubo (mm) */
  createTorus(majorRadius: number, minorRadius: number, name?: string): Promise<CadShape>;

  // ==========================================
  // MODELAGEM A PARTIR DE 2D (SKETCH / PERFIS)
  // ==========================================

  /** Cria uma face retangular planar no plano XY */
  createRectangleFace(width: number, height: number, name?: string): Promise<CadShape>;

  /** Cria uma face circular planar no plano XY */
  createCircleFace(radius: number, name?: string): Promise<CadShape>;

  /** Extruda uma face ou perfil 2D ao longo de um vetor tridimensional (dx, dy, dz) */
  extrude(
    profile: CadShape,
    dx: number,
    dy: number,
    dz: number,
    name?: string,
  ): Promise<CadShape>;

  /** Revoluciona uma face ou perfil em torno de um eixo por um determinado ângulo (radianos) */
  revolve(
    profile: CadShape,
    axisPoint: CadVector3D,
    axisDirection: CadVector3D,
    angleRad: number,
    name?: string,
  ): Promise<CadShape>;

  /** Transiciona suavemente (Loft) entre uma sequência de perfis de contorno */
  loft(
    wireProfiles: CadShape[],
    isSolid?: boolean,
    ruled?: boolean,
    name?: string,
  ): Promise<CadShape>;

  // ==========================================
  // OPERAÇÕES BOOLEANAS EXATAS (CSG / B-Rep)
  // ==========================================

  /** União booleana (Fuse) de dois corpos sólidos */
  fuse(a: CadShape, b: CadShape, name?: string): Promise<CadShape>;

  /** Subtração booleana (Cut): subtrai o sólido ferramental `tool` da peça `base` */
  cut(base: CadShape, tool: CadShape, name?: string): Promise<CadShape>;

  /** Interseção booleana (Common / Intersect): preserva apenas o volume compartilhado */
  intersect(a: CadShape, b: CadShape, name?: string): Promise<CadShape>;

  // ==========================================
  // OPERAÇÕES DE DETALHE (FILLET / CHAMFER)
  // ==========================================

  /** Aplica concordância / arredondamento (Fillet) com raio constante em arestas selecionadas */
  fillet(
    solid: CadShape,
    radius: number,
    edgeIndicesOrHandles?: number[],
    name?: string,
  ): Promise<CadShape>;

  /** Aplica chanfro uniforme (Chamfer) com distância constante em arestas selecionadas */
  chamfer(
    solid: CadShape,
    distance: number,
    edgeIndicesOrHandles?: number[],
    name?: string,
  ): Promise<CadShape>;

  // ==========================================
  // TRANSFORMAÇÕES GEOMÉTRICAS ESPACIAIS
  // ==========================================

  /** Translada uma forma por um vetor (dx, dy, dz) */
  translate(shape: CadShape, dx: number, dy: number, dz: number): Promise<CadShape>;

  /** Rotaciona uma forma em torno de um ponto e vetor de eixo por um ângulo (radianos) */
  rotate(
    shape: CadShape,
    point: CadVector3D,
    direction: CadVector3D,
    angleRad: number,
  ): Promise<CadShape>;

  /** Escala uma forma proporcionalmente a partir de um centro de escala */
  scale(shape: CadShape, center: CadVector3D, factor: number): Promise<CadShape>;

  /** Espelha uma forma em relação a um plano definido por um ponto e normal */
  mirror(shape: CadShape, planePoint: CadVector3D, planeNormal: CadVector3D): Promise<CadShape>;

  // ==========================================
  // CONSULTAS TOPOLÓGICAS E PROPRIEDADES FÍSICAS
  // ==========================================

  /** Extrai a estrutura topológica completa (Solid, Shell, Faces, Edges, Vertices) */
  getTopology(shape: CadShape): Promise<CadSolid>;

  /** Lista todas as faces B-Rep da forma */
  getFaces(shape: CadShape): Promise<CadFace[]>;

  /** Lista todas as arestas B-Rep da forma */
  getEdges(shape: CadShape): Promise<CadEdge[]>;

  /** Lista todos os vértices B-Rep da forma */
  getVertices(shape: CadShape): Promise<CadVertex[]>;

  /** Obtém a caixa delimitadora alinhada aos eixos (AABB) em coordenadas absolutas */
  getBoundingBox(shape: CadShape): Promise<CadBoundingBox>;

  /** Calcula propriedades de massa, volume, centro de gravidade e inércia */
  getMassProperties(shape: CadShape, density?: number): Promise<MassProperties>;

  /** Calcula a distância mínima euclidiana analítica entre duas entidades CAD */
  getDistanceBetween(handleA: number, handleB: number): Promise<number>;

  /** Obtém as faces adjacentes a uma determinada face do sólido */
  getAdjacentFaces(shape: CadShape, faceHandle: number): Promise<CadFace[]>;

  /** Obtém as arestas compartilhadas entre duas faces do sólido */
  getSharedEdges(shape: CadShape, faceAHandle: number, faceBHandle: number): Promise<CadEdge[]>;

  // ==========================================
  // TESSELAÇÃO E REPRESENTAÇÃO VISUAL THREE.JS
  // ==========================================

  /**
   * Converte o sólido B-Rep em malha triangulada + polilinhas de arestas CAD reais.
   * Não exporta diagonais de triangulação como arestas.
   */
  tessellate(shape: CadShape, options?: TessellateOptions): Promise<CadTessellatedShape>;

  // ==========================================
  // IMPORTAÇÃO / EXPORTAÇÃO INTEROPERÁVEL
  // ==========================================

  /** Exporta o sólido para o formato neutro industrial STEP (ISO 10303-21) */
  exportStep(shape: CadShape): Promise<string>;

  /** Importa um arquivo STEP neutro para um sólido B-Rep vivo no kernel */
  importStep(stepContent: string | ArrayBuffer, name?: string): Promise<CadShape>;

  /** Exporta a representação B-Rep nativa */
  exportBrep(shape: CadShape): Promise<string>;

  /** Exporta malha STL */
  exportStl(shape: CadShape, linearDeflection?: number): Promise<string>;

  // ==========================================
  // GERENCIAMENTO DE MEMÓRIA DA ARENA
  // ==========================================

  /** Libera explicitamente um handle na memória do WebAssembly */
  release(shape: CadShape): void;
}
