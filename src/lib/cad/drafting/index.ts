/**
 * CALDRA CAD — DRAFTING & TECHNICAL DRAWINGS (FASE 09)
 *
 * Módulo de detalhamento técnico paramétrico 2D:
 * - Vistas ortográficas (1º diedro ABNT/ISO e 3º diedro ANSI);
 * - Perspectiva isométrica com detecção de arestas visíveis e ocultas;
 * - Tabela de dobras paramétrica com cálculo analítico de dedução de dobra e V-die;
 * - Bloco de título / carimbo ABNT e notas técnicas de oficina;
 * - Exportação vetorial SVG 1:1 e DXF com separação rigorosa de camadas.
 */

export * from "./types";
export * from "./projectionEngine";
export * from "./draftingEngine";
export * from "./drawingExporter";
