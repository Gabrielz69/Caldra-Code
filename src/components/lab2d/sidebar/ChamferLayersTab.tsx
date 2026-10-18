/**
 * CALDRA CHAMFER — ABA CAMADAS (GESTÃO TÉCNICA COMPLETA DE CAMADAS)
 *
 * Cada camada possui:
 * - Nome e identificação clara
 * - Visibilidade (Ocultar / Mostrar)
 * - Bloqueio (Bloquear / Desbloquear)
 * - Seleção de todas as entidades pertencentes à camada
 * - Cor técnica canônica (CORTE: Verde, MARCAÇÃO: Azul, DOBRA: Rosa, RECORTE: Âmbar)
 * - Tipo de linha e espessura visual
 * - Contagem de entidades
 * - Ordem de renderização e sobreposição
 * - Criação, duplicação e exclusão de camadas personalizadas
 */

import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Copy,
  Trash2,
  Check,
  MoveUp,
  MoveDown,
  Layers,
  Sparkles,
  MousePointer2,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity, Layer } from "@/lib/lab2d/core";
import { techColor, isUserLayer } from "@/lib/lab2d/technical";

interface ChamferLayersTabProps {
  layers: Layer[];
  setLayers: (layers: Layer[] | ((prev: Layer[]) => Layer[])) => void;
  activeLayer: string;
  setActiveLayer: (layerId: string) => void;
  entities: Entity[];
  setSelection: (ids: string[]) => void;
  commit: (updater: Entity[] | ((prev: Entity[]) => Entity[])) => void;
  isDark?: boolean;
}

export function ChamferLayersTab({
  layers,
  setLayers,
  activeLayer,
  setActiveLayer,
  entities,
  setSelection,
  commit,
  isDark = true,
}: ChamferLayersTabProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [nameBuffer, setNameBuffer] = useState("");
  const [newLayerModal, setNewLayerModal] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerColor, setNewLayerColor] = useState("#22C55E");

  // Contagem de entidades por camada
  const countPerLayer = (layerId: string) => {
    return entities.filter((e) => e.layer === layerId).length;
  };

  // Alternar visibilidade
  const toggleVisibility = (layerId: string) => {
    triggerHaptic("selection");
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  // Alternar bloqueio
  const toggleLock = (layerId: string) => {
    triggerHaptic("selection");
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
    );
  };

  // Selecionar todas as entidades da camada
  const selectAllInLayer = (layerId: string) => {
    triggerHaptic("selection");
    const matchingIds = entities
      .filter((e) => e.layer === layerId)
      .map((e) => e.id);
    setSelection(matchingIds);
  };

  // Mover ordem da camada para cima/baixo
  const moveLayerOrder = (index: number, direction: -1 | 1) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= layers.length) return;
    triggerHaptic("selection");
    const nextList = [...layers];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(nextIdx, 0, moved);
    setLayers(nextList);
  };

  // Criar nova camada personalizada
  const handleCreateLayer = () => {
    if (!newLayerName.trim()) return;
    triggerHaptic("heavy");
    const id = newLayerName.trim().toLowerCase().replace(/\s+/g, "_");
    const exists = layers.some((l) => l.id === id);
    const finalId = exists ? `${id}_${Date.now().toString().slice(-4)}` : id;

    const created: Layer = {
      id: finalId,
      name: newLayerName.trim(),
      color: newLayerColor,
      visible: true,
      locked: false,
    };

    setLayers((prev) => [...prev, created]);
    setActiveLayer(finalId);
    setNewLayerName("");
    setNewLayerModal(false);
  };

  // Duplicar camada
  const handleDuplicateLayer = (layer: Layer) => {
    triggerHaptic("selection");
    const newId = `${layer.id}_copia_${Date.now().toString().slice(-3)}`;
    const duplicated: Layer = {
      ...layer,
      id: newId,
      name: `${layer.name} (Cópia)`,
    };
    setLayers((prev) => [...prev, duplicated]);
  };

  // Excluir camada (somente para camadas não-essenciais)
  const handleDeleteLayer = (layerId: string) => {
    if (["corte", "marcacao", "dobra", "recorte"].includes(layerId)) {
      return;
    }
    triggerHaptic("warning");
    // Move entidades da camada excluída para "corte"
    commit((list) =>
      list.map((e) => (e.layer === layerId ? { ...e, layer: "corte" } : e))
    );
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    if (activeLayer === layerId) {
      setActiveLayer("corte");
    }
  };

  // Renomear camada
  const handleSaveRename = (layerId: string) => {
    if (nameBuffer.trim()) {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === layerId ? { ...l, name: nameBuffer.trim() } : l
        )
      );
    }
    setEditingLayerId(null);
  };

  return (
    <div className="flex flex-col gap-2.5 text-slate-200 select-none pb-4">
      {/* Cabeçalho da Aba Camadas com Botão Nova Camada */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-red-600/15 text-red-500 border border-red-500/25">
            <Layers className="size-4" />
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold text-white leading-tight">
              Camadas Técnicas
            </h4>
            <span className="font-mono text-[9px] text-slate-400">
              {layers.length} camadas configuradas
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNewLayerModal((prev) => !prev)}
          title="Adicionar nova camada"
          className="flex h-7 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 font-mono text-[10px] font-bold text-slate-200 hover:border-red-500 hover:text-white transition-colors"
        >
          <Plus className="size-3.5 text-red-500" />
          <span>Nova</span>
        </button>
      </div>

      {/* Modal / Formulário Compacto para Nova Camada */}
      {newLayerModal && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
            Criar Nova Camada
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              placeholder="Nome da camada..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-sans text-xs text-white outline-none focus:border-red-500"
            />
            <input
              type="color"
              value={newLayerColor}
              onChange={(e) => setNewLayerColor(e.target.value)}
              className="size-7 rounded cursor-pointer border border-slate-700 bg-slate-950 p-0.5"
            />
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setNewLayerModal(false)}
              className="rounded-lg px-2.5 py-1 font-mono text-[10px] text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateLayer}
              className="rounded-lg bg-red-600 px-3 py-1 font-mono text-[10px] font-bold text-white hover:bg-red-500"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Camadas */}
      <div className="flex flex-col gap-1.5">
        {layers.map((layer, index) => {
          const isAct = activeLayer === layer.id;
          const count = countPerLayer(layer.id);
          const isProtected = ["corte", "marcacao", "dobra", "recorte"].includes(layer.id);
          const colorHex = techColor(layer.id) || layer.color;

          return (
            <div
              key={layer.id}
              className={cn(
                "group relative flex flex-col rounded-xl border p-2 transition-all shadow-2xs",
                isAct
                  ? "border-red-500/70 bg-slate-900/95 ring-1 ring-red-500/30"
                  : "border-slate-800/80 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/50"
              )}
            >
              {/* Linha Principal da Camada */}
              <div className="flex items-center justify-between gap-1.5">
                {/* Lado Esquerdo: Indicador Ativo + Cor Técnica + Nome */}
                <div
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    triggerHaptic("selection");
                    setActiveLayer(layer.id);
                  }}
                >
                  {/* Amostra da Cor Técnica Canônica */}
                  <span
                    className="size-3 rounded-full shrink-0 shadow-xs ring-1 ring-white/10"
                    style={{ backgroundColor: colorHex }}
                    title={`Cor da camada: ${colorHex}`}
                  />

                  {/* Nome da Camada (ou campo de edição inline) */}
                  {editingLayerId === layer.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={nameBuffer}
                        onChange={(e) => setNameBuffer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRename(layer.id)}
                        autoFocus
                        className="w-24 rounded border border-red-500 bg-slate-950 px-1 py-0.5 font-sans text-xs text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(layer.id)}
                        className="rounded p-0.5 text-green-400 hover:bg-slate-800"
                      >
                        <Check className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span
                        className={cn(
                          "font-sans text-xs font-semibold truncate",
                          isAct ? "text-white font-bold" : "text-slate-300"
                        )}
                      >
                        {layer.name}
                      </span>
                      {isAct && (
                        <span className="rounded bg-red-600/30 px-1 py-0.2 font-mono text-[8px] font-bold text-red-400 border border-red-500/40 uppercase">
                          Ativa
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Contagem de Entidades */}
                <span
                  title={`${count} entidades nesta camada`}
                  className="font-mono text-[9.5px] font-medium text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                >
                  {count}
                </span>

                {/* Controles Rápidos: Visibilidade, Bloqueio, Seleção */}
                <div className="flex items-center gap-0.5">
                  {/* Visibilidade (Eye) */}
                  <button
                    type="button"
                    onClick={() => toggleVisibility(layer.id)}
                    title={layer.visible ? "Ocultar camada" : "Exibir camada"}
                    className={cn(
                      "rounded p-1 transition-colors",
                      layer.visible
                        ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                        : "text-slate-600 bg-slate-900 hover:text-slate-400"
                    )}
                  >
                    {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </button>

                  {/* Bloqueio (Lock) */}
                  <button
                    type="button"
                    onClick={() => toggleLock(layer.id)}
                    title={layer.locked ? "Desbloquear camada" : "Bloquear camada"}
                    className={cn(
                      "rounded p-1 transition-colors",
                      layer.locked
                        ? "text-amber-400 bg-amber-950/40"
                        : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                    )}
                  >
                    {layer.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                  </button>

                  {/* Selecionar tudo da camada */}
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={() => selectAllInLayer(layer.id)}
                      title="Selecionar todas as entidades desta camada"
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <MousePointer2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de Ações Adicionais da Camada (Reordenar, Duplicar, Renomear, Excluir) */}
              <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-800/60 opacity-60 group-hover:opacity-100 transition-opacity">
                {/* Tipo de Traço Técnico */}
                <span className="font-mono text-[9px] text-slate-400">
                  {layer.id === "dobra"
                    ? "Traço-ponto · Dobra (Rosa)"
                    : layer.id === "marcacao"
                    ? "Tracejada · Marcação (Azul)"
                    : layer.id === "recorte"
                    ? "Contínua · Recorte interno (Âmbar)"
                    : layer.id === "corte"
                    ? "Contínua larga ABNT · Corte (Branco)"
                    : "Contínua fina · 0.8mm"}
                </span>

                <div className="flex items-center gap-1">
                  {/* Subir Ordem */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveLayerOrder(index, -1)}
                    title="Mover para cima"
                    className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  >
                    <MoveUp className="size-3" />
                  </button>
                  {/* Descer Ordem */}
                  <button
                    type="button"
                    disabled={index === layers.length - 1}
                    onClick={() => moveLayerOrder(index, 1)}
                    title="Mover para baixo"
                    className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"
                  >
                    <MoveDown className="size-3" />
                  </button>

                  {/* Renomear */}
                  <button
                    type="button"
                    onClick={() => {
                      setNameBuffer(layer.name);
                      setEditingLayerId(layer.id);
                    }}
                    title="Renomear camada"
                    className="p-0.5 text-slate-500 hover:text-white"
                  >
                    <Edit2 className="size-3" />
                  </button>

                  {/* Duplicar */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateLayer(layer)}
                    title="Duplicar camada"
                    className="p-0.5 text-slate-500 hover:text-white"
                  >
                    <Copy className="size-3" />
                  </button>

                  {/* Excluir (somente se não for do sistema) */}
                  {!isProtected && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLayer(layer.id)}
                      title="Excluir camada"
                      className="p-0.5 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
