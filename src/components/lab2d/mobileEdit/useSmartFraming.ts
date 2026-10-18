/**
 * CALDRA CHAMFER — ENQUADRAMENTO INTELIGENTE (REGRA 7)
 *
 * Ao abrir um editor contextual ou teclado numérico:
 * - Preserva rigorosamente o enquadramento atual;
 * - Mantém a peça visível;
 * - Mantém a entidade selecionada visível;
 * - Não faz zoom arbitrário nem altera a escala (view.k);
 * - Se o editor cobrir a entidade selecionada, translada SOMENTE o mínimo necessário;
 * - Ao fechar o editor, restaura o enquadramento anterior.
 */

import { useEffect, useRef } from "react";
import type { Entity } from "@/lib/lab2d/core";

interface ViewState {
  tx: number;
  ty: number;
  k: number;
}

interface SmartFramingOptions {
  isOpen: boolean;
  selectedEntity: Entity | null;
  view: ViewState;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  canvasWidth: number;
  canvasHeight: number;
  editorWidth?: number;
  editorHeight?: number;
}

export function useSmartFraming({
  isOpen,
  selectedEntity,
  view,
  setView,
  canvasWidth,
  canvasHeight,
  editorWidth = 320,
  editorHeight = 360,
}: SmartFramingOptions) {
  // Armazena a posição original do pan para restauração precisa ao fechar
  const originalPanRef = useRef<{ tx: number; ty: number } | null>(null);
  const isShiftedRef = useRef(false);
  const lastEntityIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. QUANDO O EDITOR ABRE: VERIFICA SE HÁ SOBREPOSIÇÃO COM A ENTIDADE
    if (isOpen && selectedEntity && canvasWidth > 0 && canvasHeight > 0) {
      if (lastEntityIdRef.current === selectedEntity.id) {
        return;
      }
      lastEntityIdRef.current = selectedEntity.id;

      if (!originalPanRef.current) {
        originalPanRef.current = { tx: view.tx, ty: view.ty };
      }

      // Calcula os limites da entidade no espaço da tela (pixels)
      let minX = 0;
      let maxX = 0;
      let minY = 0;
      let maxY = 0;

      if (selectedEntity.type === "circle" || selectedEntity.type === "arc") {
        minX = selectedEntity.cx - selectedEntity.r;
        maxX = selectedEntity.cx + selectedEntity.r;
        minY = selectedEntity.cy - selectedEntity.r;
        maxY = selectedEntity.cy + selectedEntity.r;
      } else if (selectedEntity.type === "line") {
        minX = Math.min(selectedEntity.x1, selectedEntity.x2);
        maxX = Math.max(selectedEntity.x1, selectedEntity.x2);
        minY = Math.min(selectedEntity.y1, selectedEntity.y2);
        maxY = Math.max(selectedEntity.y1, selectedEntity.y2);
      } else if (selectedEntity.type === "polyline" && selectedEntity.pts.length > 0) {
        const xs = selectedEntity.pts.map((p) => p.x);
        const ys = selectedEntity.pts.map((p) => p.y);
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
        minY = Math.min(...ys);
        maxY = Math.max(...ys);
      } else if (selectedEntity.type === "point") {
        minX = selectedEntity.x - 10;
        maxX = selectedEntity.x + 10;
        minY = selectedEntity.y - 10;
        maxY = selectedEntity.y + 10;
      } else if (selectedEntity.type === "text") {
        minX = selectedEntity.x;
        maxX = selectedEntity.x + (selectedEntity.width ?? 60);
        minY = selectedEntity.y - selectedEntity.size;
        maxY = selectedEntity.y;
      }

      // Projeção para tela: screen = tx + model * k
      const screenEntityMaxX = view.tx + maxX * view.k;
      const screenEntityMinX = view.tx + minX * view.k;
      const screenEntityMinY = view.ty + minY * view.k;
      const screenEntityMaxY = view.ty + maxY * view.k;

      // Área ocupada pelo editor flutuante (ancorado no canto superior direito)
      const editorLeftEdge = canvasWidth - editorWidth - 24;
      const editorBottomEdge = editorHeight + 60;

      // Verifica se há colisão espacial entre a entidade e o card do editor
      const isOverlappingX = screenEntityMaxX > editorLeftEdge;
      const isOverlappingY = screenEntityMinY < editorBottomEdge && screenEntityMaxY > 40;

      if (isOverlappingX && isOverlappingY) {
        // Deslocamento mínimo estritamente necessário para desobstruir a entidade
        const requiredShiftX = editorLeftEdge - screenEntityMaxX - 20;

        // Aplica o deslocamento conservando rigorosamente a escala (view.k)
        setView((prev) => ({
          ...prev,
          tx: prev.tx + requiredShiftX,
        }));
        isShiftedRef.current = true;
      }
    }

    // 2. QUANDO O EDITOR FECHA: RESTAURA O ENQUADRAMENTO ANTERIOR
    if (!isOpen && isShiftedRef.current && originalPanRef.current) {
      const restored = originalPanRef.current;
      isShiftedRef.current = false;
      originalPanRef.current = null;
      lastEntityIdRef.current = null;
      setView((prev) => ({
        ...prev,
        tx: restored.tx,
        ty: restored.ty,
      }));
    }
  }, [isOpen, selectedEntity, canvasWidth, canvasHeight, view.k, setView]);
}
