/**
 * CALDRA CAD — PROJECTION ENGINE (FASE 09)
 *
 * Motor analítico de projeção ortográfica (1º e 3º diedro) e axonométrica isométrica
 * a partir da topologia B-Rep do modelo canônico 3D.
 * Determina visibilidade de arestas (contínuas vs ocultas) e gera cotas de extensão.
 */

import type { SolidBody3D, SheetMetalBody, Vertex3D } from "../canonical";
import type {
  DrawingPoint,
  DrawingLine,
  DrawingArc,
  DrawingDimension,
  ViewType,
  DrawingView,
} from "./types";

export class ProjectionEngine {
  /**
   * Projeta um vértice 3D no plano 2D da vista especificada.
   */
  static projectVertex(v: Vertex3D, viewType: ViewType): DrawingPoint {
    const pt = v.point ?? { x: 0, y: 0, z: 0 };
    const x = pt.x ?? 0;
    const y = pt.y ?? 0;
    const z = pt.z ?? 0;

    switch (viewType) {
      case "FRONT":
        // Projeção olhando ao longo de -Y (plano XZ)
        return { x, y: z };
      case "TOP":
        // Projeção olhando de cima ao longo de -Z (plano XY)
        return { x, y: -y };
      case "RIGHT":
        // Projeção lateral olhando ao longo de -X (plano YZ)
        return { x: y, y: z };
      case "LEFT":
        // Projeção lateral esquerda olhando ao longo de +X
        return { x: -y, y: z };
      case "ISOMETRIC": {
        // Projeção axonométrica isométrica (30° / 30°)
        const cos30 = Math.cos(Math.PI / 6); // ~0.866
        const sin30 = Math.sin(Math.PI / 6); // 0.5
        const u = (x - y) * cos30;
        const w = z + (x + y) * sin30;
        return { x: u, y: w };
      }
      case "FLAT_PATTERN":
      default:
        // Projeção plana XY direta
        return { x, y };
    }
  }

  /**
   * Vetor de visão da câmera para cada tipo de vista.
   */
  private static getViewDirection(viewType: ViewType): { x: number; y: number; z: number } {
    switch (viewType) {
      case "FRONT":
        return { x: 0, y: -1, z: 0 };
      case "TOP":
        return { x: 0, y: 0, z: -1 };
      case "RIGHT":
        return { x: -1, y: 0, z: 0 };
      case "LEFT":
        return { x: 1, y: 0, z: 0 };
      case "ISOMETRIC":
        return { x: 0.577, y: 0.577, z: -0.577 };
      case "FLAT_PATTERN":
      default:
        return { x: 0, y: 0, z: 1 };
    }
  }

  /**
   * Gera uma vista ortográfica ou isométrica a partir de um corpo sólido 3D.
   */
  static generateView(
    solid: SolidBody3D | SheetMetalBody,
    viewType: ViewType,
    options: {
      scale?: number;
      includeHiddenLines?: boolean;
      autoDimensions?: boolean;
    } = {},
  ): DrawingView {
    const scale = options.scale ?? 1.0;
    const includeHidden = options.includeHiddenLines ?? true;
    const autoDims = options.autoDimensions ?? true;

    const lines: DrawingLine[] = [];
    const arcs: DrawingArc[] = [];
    const dimensions: DrawingDimension[] = [];

    const solidBody = (solid as SheetMetalBody).solidBody || (solid as SolidBody3D);
    const vertices = solidBody.vertices || [];
    const edges = solidBody.edges || [];
    const faces = solidBody.faces || [];
    const vertexMap = new Map<string, Vertex3D>(vertices.map((v) => [v.id, v]));

    // Mapeamento de arestas para evitar duplicações
    const processedEdgeMap = new Map<string, boolean>();
    const viewDir = this.getViewDirection(viewType);

    // Avalia faces para visibilidade
    const faceVisibility = new Map<string, boolean>();
    for (const face of faces) {
      const dot = face.normal.x * viewDir.x + face.normal.y * viewDir.y + face.normal.z * viewDir.z;
      // Face é visível se a normal aponta na direção oposta ao raio de visão (dot < -1e-4)
      faceVisibility.set(face.id, dot < -1e-4);
    }

    for (const edge of edges) {
      const vStart = vertexMap.get(edge.v0);
      const vEnd = vertexMap.get(edge.v1);
      if (!vStart || !vEnd) continue;

      const edgeKey = [edge.v0, edge.v1].sort().join("-");
      if (processedEdgeMap.has(edgeKey)) continue;
      processedEdgeMap.set(edgeKey, true);

      // Determina visibilidade da aresta com base nas faces adjacentes
      let isVisible = false;
      let hasAdjacentFace = false;

      for (const faceId of edge.faceIds || []) {
        hasAdjacentFace = true;
        if (faceVisibility.get(faceId)) {
          isVisible = true;
          break;
        }
      }

      // Se a aresta não tem faces registradas, assume visível por padrão
      if (!hasAdjacentFace) {
        isVisible = true;
      }

      if (!isVisible && !includeHidden) {
        continue;
      }

      const pStart = this.projectVertex(vStart, viewType);
      const pEnd = this.projectVertex(vEnd, viewType);

      // Descarta arestas colapsadas na projeção
      const dist2 = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
      if (dist2 < 0.1) continue;

      lines.push({
        start: { x: pStart.x * scale, y: pStart.y * scale },
        end: { x: pEnd.x * scale, y: pEnd.y * scale },
        type: isVisible ? "VISIBLE" : "HIDDEN",
        label: edge.id,
      });
    }

    // Calcula bounding box 2D da vista projetada
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const line of lines) {
      minX = Math.min(minX, line.start.x, line.end.x);
      minY = Math.min(minY, line.start.y, line.end.y);
      maxX = Math.max(maxX, line.start.x, line.end.x);
      maxY = Math.max(maxY, line.start.y, line.end.y);
    }

    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 100 * scale;
      maxY = 100 * scale;
    }

    // Cotagem automática básica da vista ortográfica
    if (autoDims && viewType !== "ISOMETRIC") {
      const widthMm = (maxX - minX) / scale;
      const heightMm = (maxY - minY) / scale;

      if (widthMm > 1.0) {
        // Cota horizontal inferior
        const offset = 8; // 8 mm de afastamento da peça
        dimensions.push({
          id: `dim-h-${viewType}`,
          type: "LINEAR_HORIZ",
          value: Math.round(widthMm * 10) / 10,
          formattedText: `${Math.round(widthMm * 10) / 10}`,
          p1: { x: minX, y: minY - offset },
          p2: { x: maxX, y: minY - offset },
          textPos: { x: (minX + maxX) / 2, y: minY - offset - 2 },
        });
      }

      if (heightMm > 1.0) {
        // Cota vertical esquerda
        const offset = 8;
        dimensions.push({
          id: `dim-v-${viewType}`,
          type: "LINEAR_VERT",
          value: Math.round(heightMm * 10) / 10,
          formattedText: `${Math.round(heightMm * 10) / 10}`,
          p1: { x: minX - offset, y: minY },
          p2: { x: minX - offset, y: maxY },
          textPos: { x: minX - offset - 4, y: (minY + maxY) / 2 },
        });
      }
    }

    const viewNames: Record<ViewType, string> = {
      FRONT: "VISTA FRONTAL",
      TOP: "VISTA SUPERIOR",
      RIGHT: "VISTA LATERAL DIR.",
      LEFT: "VISTA LATERAL ESQ.",
      ISOMETRIC: "PERSPECTIVA ISOMÉTRICA",
      FLAT_PATTERN: "PLANIFICAÇÃO TÉCNICA",
      SECTION: "CORTE A-A",
    };

    return {
      id: `view-${viewType.toLowerCase()}`,
      type: viewType,
      name: viewNames[viewType],
      scale,
      origin: { x: 0, y: 0 },
      boundingBox: { minX, minY, maxX, maxY },
      lines,
      arcs,
      dimensions,
      annotations: [
        {
          text: `${viewNames[viewType]} (ESC. ${scale === 1 ? "1:1" : `1:${Math.round(1 / scale)}`})`,
          pos: { x: (minX + maxX) / 2, y: minY - 15 },
          fontSizePt: 8,
          align: "center",
          bold: true,
        },
      ],
    };
  }
}
