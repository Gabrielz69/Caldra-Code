/**
 * CALDRA CHAMFER — MODAL / PAINEL DE ÁREA DE TRANSFERÊNCIA GLOBAL (SEÇÃO 17)
 *
 * Exibido ao segurar o dedo (long-press 400ms) no espaço vazio do canvas:
 *  - Lista todos os recortes de peças e formas geométricas copiadas;
 *  - Validade automática de 24 horas para itens normais;
 *  - Fixação permanente (📌 Pin) de peças favoritas ou blocos recorrentes;
 *  - Miniatura gráfica vetorial Retina em tempo real;
 *  - Ação "Colar Aqui" na coordenada exata onde o usuário tocou no CAD.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardList,
  Pin,
  PinOff,
  Trash2,
  X,
  Plus,
  Clock,
  Sparkles,
  Layers,
  Check,
  RotateCcw,
  Boxes,
} from "lucide-react";
import type { Vec2 } from "@/lib/geometry/types";
import {
  loadGlobalClipboard,
  togglePinClipboardItem,
  deleteClipboardItem,
  clearUnpinnedClipboard,
  formatRelativeTime,
  formatTimeRemaining,
  type GlobalClipboardItem,
} from "@/lib/lab2d/globalClipboard";
import { triggerHaptic } from "@/lib/ui/haptics";
import { toast } from "sonner";

export interface ChamferClipboardModalProps {
  open: boolean;
  onClose: () => void;
  anchorWorldPos?: Vec2 | null; // Posição CAD onde o usuário tocou no vazio (mm)
  onPasteItem: (item: GlobalClipboardItem, targetPos?: Vec2 | null) => void;
  isDark?: boolean;
}

export function ChamferClipboardModal({
  open,
  onClose,
  anchorWorldPos,
  onPasteItem,
  isDark = true,
}: ChamferClipboardModalProps) {
  const [items, setItems] = useState<GlobalClipboardItem[]>([]);

  // Recarrega os itens do localStorage sempre que o modal abre ou a área é atualizada
  useEffect(() => {
    if (open) {
      const loaded = loadGlobalClipboard();
      setItems(loaded);
    }
    const reload = () => {
      setItems(loadGlobalClipboard());
    };
    window.addEventListener("chamfer:clipboard-updated", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("chamfer:clipboard-updated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [open]);

  // Contagem de fixados e normais
  const pinnedCount = useMemo(() => items.filter((it) => it.isPinned).length, [items]);
  const unpinnedCount = items.length - pinnedCount;

  if (!open) return null;

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    triggerHaptic("selection");
    const updated = togglePinClipboardItem(id);
    setItems(updated);
    const target = updated.find((it) => it.id === id);
    if (target?.isPinned) {
      toast.success("Item fixado! Não expirará após 24h.");
    } else {
      toast.info("Item desafixado. Expirará em 24h.");
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    triggerHaptic("action");
    const updated = deleteClipboardItem(id);
    setItems(updated);
    toast.success("Recorte removido da área de transferência.");
  };

  const handleClearUnpinned = () => {
    if (unpinnedCount === 0) return;
    triggerHaptic("action");
    const updated = clearUnpinnedClipboard();
    setItems(updated);
    toast.success(`${unpinnedCount} item(ns) não fixado(s) removido(s).`);
  };

  const handlePaste = (item: GlobalClipboardItem) => {
    triggerHaptic("action");
    onPasteItem(item, anchorWorldPos);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ClipboardList className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm tracking-tight">
                  Área de Transferência do CAD
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {items.length} {items.length === 1 ? "recorte" : "recortes"}
                </span>
                {pinnedCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Pin className="size-2.5" />
                    {pinnedCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {anchorWorldPos
                  ? `Colar na posição X: ${anchorWorldPos.x.toFixed(1)} mm, Y: ${anchorWorldPos.y.toFixed(1)} mm`
                  : "Toque em um recorte para colar no canvas"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unpinnedCount > 0 && (
              <button
                type="button"
                onClick={handleClearUnpinned}
                title="Limpar itens não fixados"
                className="px-2 py-1 text-[11px] rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 flex items-center gap-1"
              >
                <Trash2 className="size-3" />
                <span className="hidden sm:inline">Limpar não fixados</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="size-7 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors flex items-center justify-center"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* CORPO DA LISTA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
              <div className="size-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                <ClipboardList className="size-7 stroke-[1.5]" />
              </div>
              <h4 className="font-semibold text-sm text-slate-200 mb-1">
                Nenhum item copiado ainda
              </h4>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-4">
                Selecione uma ou mais formas geométricas ou peças e clique no botão{" "}
                <span className="text-cyan-400 font-medium">Copiar</span> na barra de ferramentas (ou use{" "}
                <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
                  Ctrl+C
                </kbd>
                ).
              </p>
              <div className="text-[11px] text-slate-500 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 max-w-sm flex items-center gap-2">
                <Clock className="size-3.5 text-cyan-400 shrink-0" />
                <span>
                  Ao segurar no vazio do canvas, este menu se abre para colar instantaneamente onde você tocou.
                </span>
              </div>
            </div>
          ) : (
            items.map((item) => {
              const isPinned = item.isPinned;
              const hasGroup = Boolean(item.groups && item.groups.length > 0);

              return (
                <div
                  key={item.id}
                  onClick={() => handlePaste(item)}
                  className={`group relative flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isPinned
                      ? "bg-slate-900/80 border-amber-500/30 hover:border-amber-400/60 shadow-xs"
                      : "bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80"
                  }`}
                >
                  {/* MINIATURA VETORIAL SVG */}
                  <div
                    className="relative size-16 sm:size-18 shrink-0 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-center overflow-hidden p-1 shadow-inner"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                      backgroundSize: "8px 8px",
                    }}
                  >
                    {item.previewSvg ? (
                      <div
                        className="size-full flex items-center justify-center [&_svg]:size-full pointer-events-none"
                        dangerouslySetInnerHTML={{ __html: item.previewSvg }}
                      />
                    ) : (
                      <Layers className="size-6 text-slate-600" />
                    )}
                  </div>

                  {/* INFORMAÇÕES DO RECORTE */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-medium text-xs sm:text-sm text-slate-100 truncate">
                        {item.title}
                      </span>
                      {hasGroup && (
                        <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <Boxes className="size-2.5" />
                          Peça
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1.5">
                      <span className="bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 text-slate-300">
                        {item.width.toFixed(1)} × {item.height.toFixed(1)} mm
                      </span>
                      <span className="text-slate-500">·</span>
                      <span>
                        {item.entities.length} {item.entities.length === 1 ? "forma" : "formas"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      {isPinned ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                          <Pin className="size-2.5 fill-current" />
                          Fixado permanentemente
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400">
                          <span>{formatRelativeTime(item.timestamp)}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-cyan-400/90 font-mono">
                            {formatTimeRemaining(item.expiresAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AÇÕES LATERAIS */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* BOTÃO FIXAR / DESAFIXAR */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, item.id)}
                      title={isPinned ? "Desafixar recorte" : "Fixar permanentemente (não expira)"}
                      className={`size-8 rounded-lg flex items-center justify-center transition-colors ${
                        isPinned
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                      }`}
                    >
                      {isPinned ? <Pin className="size-3.5 fill-current" /> : <Pin className="size-3.5" />}
                    </button>

                    {/* BOTÃO EXCLUIR */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item.id)}
                      title="Excluir da área de transferência"
                      className="size-8 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>

                    {/* BOTÃO COLAR AQUI */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePaste(item);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 active:scale-95 transition-all flex items-center gap-1 shadow-md shadow-cyan-500/20"
                    >
                      <Plus className="size-3.5 stroke-[2.5]" />
                      <span>Colar Aqui</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ TÉCNICO */}
        <div className="border-t border-slate-800/80 px-4 py-2.5 bg-slate-900/40 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-cyan-400 font-semibold">Ctrl+V:</span>
            <span>Cola o item mais recente instantaneamente</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Itens não fixados expiram automaticamente em 24h
          </div>
        </div>
      </div>
    </div>
  );
}
