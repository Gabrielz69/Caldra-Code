/**
 * CALDRA CHAMFER — MODAL UNIVERSAL DE PROJEÇÃO E CONVERSÃO ISOMÉTRICA 2D/2.5D
 *
 * Motor geométrico 100% universal: opera diretamente sobre os IDs reais
 * das entidades selecionadas pelo usuário no canvas (linhas, polilinhas, arcos,
 * furos, contornos e cotas técnicas associativas), com zero predefinições/templates.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Box,
  Layers,
  Sparkles,
  Check,
  Copy,
  RefreshCw,
  Eye,
  Ruler,
  AlertCircle,
  HelpCircle,
  Undo2,
  ArrowRightLeft,
} from "lucide-react";
import {
  type IsoPlane,
  ISO_PLANES,
  convertSelectionToIsometric,
  unprojectSelectionFromIsometric,
} from "@/lib/lab2d/isometricEngine";
import type { Entity } from "@/lib/lab2d/core";
import type { Dimension } from "@/lib/lab2d/dimensions";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { cn } from "@/lib/utils";

export interface ChamferIsoConvertModalProps {
  open: boolean;
  onClose: () => void;
  selectedEntities: Entity[];
  allEntities: Entity[];
  dims: Dimension[];
  activeSheetThickness?: number;
  onConfirm: (result: {
    updatedEntities: Entity[];
    updatedDims: Dimension[];
    newSelectionIds: string[];
  }) => void;
  onPreviewChange?: (preview: {
    entities: Entity[];
    dims: Dimension[];
  } | null) => void;
  isDark?: boolean;
}

export function ChamferIsoConvertModal({
  open,
  onClose,
  selectedEntities,
  allEntities,
  dims,
  activeSheetThickness = 3,
  onConfirm,
  onPreviewChange,
  isDark = true,
}: ChamferIsoConvertModalProps) {
  const [plane, setPlane] = useState<IsoPlane>("top");
  const [mode, setMode] = useState<"replace" | "copy">("replace");
  const [thickness, setThickness] = useState<number>(activeSheetThickness > 0 ? activeSheetThickness : 3);
  const [bendAngleDeg, setBendAngleDeg] = useState<number>(90);
  const [bendRadius, setBendRadius] = useState<number>(2);
  const [bossHeight, setBossHeight] = useState<number>(0);
  const [ribThickness, setRibThickness] = useState<number>(6);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [actionDirection, setActionDirection] = useState<"project" | "unproject">("project");

  const selectedIds = useMemo(() => selectedEntities.map((e) => e.id), [selectedEntities]);

  // Detecta se as entidades selecionadas já estão em projeção isométrica
  const hasIsoEntities = useMemo(
    () => selectedEntities.some((e) => e.params?.isIso),
    [selectedEntities],
  );

  // Sincroniza espessura ativa da chapa do projeto ao abrir o modal
  useEffect(() => {
    if (open && activeSheetThickness > 0) {
      setThickness(activeSheetThickness);
    }
  }, [open, activeSheetThickness]);

  // Se o usuário selecionou uma peça que já é isométrica, inicializa o plano com o plano dela
  useEffect(() => {
    if (open && selectedEntities.length > 0) {
      const isoEnt = selectedEntities.find((e) => e.params?.isoPlane);
      if (isoEnt && isoEnt.params?.isoPlane) {
        setPlane(isoEnt.params.isoPlane as IsoPlane);
      }
    }
  }, [open, selectedEntities]);

  // Contagem de cotas associadas à seleção
  const associatedDimsCount = useMemo(() => {
    if (!selectedIds.length || !dims.length) return 0;
    const set = new Set(selectedIds);
    return dims.filter((d) => d.refs.some((r) => r.kind === "entity" && set.has(r.id))).length;
  }, [selectedIds, dims]);

  // Cálculo da prévia em tempo real
  const previewResult = useMemo(() => {
    if (!open || !selectedIds.length) return null;
    try {
      if (actionDirection === "unproject") {
        return unprojectSelectionFromIsometric({
          entities: allEntities,
          selectedIds,
          dims,
          fallbackPlane: plane,
        });
      }
      return convertSelectionToIsometric({
        entities: allEntities,
        selectedIds,
        dims,
        plane,
        mode,
        thickness: Math.max(0, thickness),
        bendAngleDeg,
        bendRadius,
        bossHeight,
        ribThickness,
      });
    } catch (e) {
      console.warn("Falha ao calcular preview isométrico:", e);
      return null;
    }
  }, [
    open,
    allEntities,
    selectedIds,
    dims,
    plane,
    mode,
    thickness,
    bendAngleDeg,
    bendRadius,
    bossHeight,
    ribThickness,
    actionDirection,
  ]);

  // Comunica a prévia para o canvas principal
  useEffect(() => {
    if (!open || !onPreviewChange) return;

    if (showPreview && previewResult) {
      onPreviewChange({
        entities: previewResult.previewEntities,
        dims: previewResult.previewDims,
      });
    } else {
      onPreviewChange(null);
    }

    return () => {
      onPreviewChange(null);
    };
  }, [open, showPreview, previewResult, onPreviewChange]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!selectedIds.length) return;
    triggerHaptic("success");
    AudioManager.play("ui_pop");

    try {
      const res =
        actionDirection === "unproject"
          ? unprojectSelectionFromIsometric({
              entities: allEntities,
              selectedIds,
              dims,
              fallbackPlane: plane,
            })
          : convertSelectionToIsometric({
              entities: allEntities,
              selectedIds,
              dims,
              plane,
              mode,
              thickness: Math.max(0, thickness),
              bendAngleDeg,
              bendRadius,
              bossHeight,
              ribThickness,
            });

      if (onPreviewChange) onPreviewChange(null);
      onConfirm({
        updatedEntities: res.updatedEntities,
        updatedDims: res.updatedDims,
        newSelectionIds: res.newSelectionIds,
      });
      onClose();
    } catch (err: unknown) {
      console.error("Erro na conversão isométrica:", err);
    }
  };

  const handleClose = () => {
    if (onPreviewChange) onPreviewChange(null);
    onClose();
  };

  const currentCfg = ISO_PLANES[plane];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={cn(
          "w-full max-w-md rounded-3xl border shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto select-none",
          isDark
            ? "bg-slate-950/95 border-slate-800 text-slate-100 shadow-black/80"
            : "bg-white border-slate-200 text-slate-900 shadow-slate-900/20",
        )}
      >
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Box className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold tracking-tight">
                  Projeção Isométrica 2D / 2.5D
                </h2>
                <span className="rounded bg-sky-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-sky-400 border border-sky-500/30">
                  UNIVERSAL
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Transformação afim analítica da seleção ativa no documento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* CASO A: SEM SELEÇÃO ATIVA (BLOQUEIO SEGURO) */}
        {selectedEntities.length === 0 ? (
          <div className="flex flex-col items-center text-center p-5 gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <AlertCircle className="size-8 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-foreground">Nenhuma entidade selecionada</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Para converter para projeção isométrica, selecione antes as entidades no canvas
                (linhas, contornos, furos, peças) utilizando a ferramenta de seleção ou toque.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Entendido, vou selecionar no canvas
            </button>
          </div>
        ) : (
          /* CASO B: SELEÇÃO VÁLIDA — PAINEL DE CONTROLE MOBILE-FIRST */
          <div className="flex flex-col gap-3.5">
            {/* INFORMAÇÃO DA SELEÇÃO ATIVA */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <span className="font-mono text-muted-foreground">Fonte de dados:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground">
                  {selectedEntities.length}{" "}
                  {selectedEntities.length === 1 ? "entidade" : "entidades"}
                </span>
                {associatedDimsCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    <Ruler className="size-2.5" />
                    <span>{associatedDimsCount} cotas</span>
                  </span>
                )}
                {hasIsoEntities && (
                  <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-300 border border-sky-500/40">
                    ISOMÉTRICO
                  </span>
                )}
              </div>
            </div>

            {/* ABAS DE DIREÇÃO: PROJETAR VS MATRIZ INVERSA (DESPROJETAR) */}
            <div className="flex rounded-2xl bg-slate-900/90 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  AudioManager.play("ui_select");
                  setActionDirection("project");
                }}
                className={cn(
                  "flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  actionDirection === "project"
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="size-3.5" />
                <span>Projetar Isométrico</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  AudioManager.play("ui_select");
                  setActionDirection("unproject");
                }}
                className={cn(
                  "flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  actionDirection === "unproject"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowRightLeft className="size-3.5" />
                <span>Matriz Inversa (2D)</span>
              </button>
            </div>

            {actionDirection === "unproject" ? (
              /* MODO INVERSO: DESPROJETAR PARA 2D ORTOGONAL */
              <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <ArrowRightLeft className="size-4 text-amber-400" />
                  <span>Reversão Analítica para 2D Ortogonal</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Aplica a matriz afim inversa matemática sobre as entidades selecionadas, restaurando as coordenadas ortogonais planas 2D originais e convertendo isocírculos (elipses) de volta em círculos reais com diâmetro canônico.
                </p>
                <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-amber-500/20 text-amber-300">
                  <span>Plano de origem detectado:</span>
                  <span className="font-bold uppercase">{ISO_PLANES[plane]?.label || plane}</span>
                </div>
              </div>
            ) : (
              /* MODO NORMAL: PROJETAR PARA ISOMÉTRICO (TOP, LEFT, RIGHT) */
              <>
                {/* 1. SELETOR DE PLANO ISOMÉTRICO (30°, 90°, 150°) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Plano Isométrico de Destino</span>
                    <span className="font-mono text-[10px]" style={{ color: currentCfg.accentColor }}>
                      {currentCfg.label} · {currentCfg.axisAnglesDeg[0]}° e {currentCfg.axisAnglesDeg[1]}°
                    </span>
                  </label>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(["top", "left", "right"] as const).map((pId) => {
                      const cfg = ISO_PLANES[pId];
                      const active = plane === pId;
                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => {
                            triggerHaptic("selection");
                            AudioManager.play("ui_select");
                            setPlane(pId);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer text-center",
                            active
                              ? "bg-slate-800 text-white ring-2 shadow-lg"
                              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
                          )}
                          style={
                            active
                              ? {
                                  borderColor: cfg.accentColor,
                                  boxShadow: `0 0 12px ${cfg.accentColor}33`,
                                }
                              : {}
                          }
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: cfg.accentColor }}
                            />
                            <span className="font-bold text-xs">{cfg.label}</span>
                          </div>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {cfg.axisAnglesDeg[0]}° / {cfg.axisAnglesDeg[1]}°
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. MODO DE OPERAÇÃO: SUBSTITUIR VS CRIAR CÓPIA */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Modo de Operação
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        AudioManager.play("ui_select");
                        setMode("replace");
                      }}
                      className={cn(
                        "flex flex-col p-2.5 rounded-2xl border text-left transition-all cursor-pointer",
                        mode === "replace"
                          ? "bg-sky-500/15 border-sky-500/50 text-sky-200 ring-1 ring-sky-500/40"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <RefreshCw className="size-3.5" />
                        <span>Substituir Seleção</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        Converte as peças in-place, mantendo os mesmos IDs.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("selection");
                        AudioManager.play("ui_select");
                        setMode("copy");
                      }}
                      className={cn(
                        "flex flex-col p-2.5 rounded-2xl border text-left transition-all cursor-pointer",
                        mode === "copy"
                          ? "bg-amber-500/15 border-amber-500/50 text-amber-200 ring-1 ring-amber-500/40"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Copy className="size-3.5" />
                        <span>Criar Cópia</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        Preserva o 2D intacto e gera nova projeção ao lado.
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3. ESPESSURA / PROFUNDIDADE 2.5D (OPCIONAL) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Espessura / Profundidade 2.5D (Opcional)
                    </label>
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {thickness > 0 ? `${thickness} mm` : "0 mm (Face Plana)"}
                    </span>
                  </div>

                  {/* Botões rápidos de espessura de chapa */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                    {[0, 2, 3, 4.75, 6.35, 9.5, 12.7, 16].map((th) => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => {
                          triggerHaptic("tap");
                          setThickness(th);
                        }}
                        className={cn(
                          "px-2 py-1 rounded-xl font-mono text-[10px] font-semibold shrink-0 transition-all cursor-pointer",
                          thickness === th
                            ? "bg-amber-500 text-black shadow-xs font-bold"
                            : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200",
                        )}
                      >
                        {th === 0 ? "Plano" : `${th}mm`}
                      </button>
                    ))}
                  </div>

                  {/* Entrada manual */}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      value={thickness}
                      onChange={(e) => setThickness(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0 (sem extrusão)"
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-amber-500"
                    />
                    <span className="font-mono text-xs text-muted-foreground">mm</span>
                  </div>
                </div>

                {/* 3.5. PARÂMETROS DE CONFORMAÇÃO MECÂNICA (DOBRAS, RESSALTOS CILÍNDRICOS E NERVURAS) */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Dobra (° / Raio R)
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={bendAngleDeg}
                        onChange={(e) => setBendAngleDeg(parseFloat(e.target.value) || 90)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-1.5 py-1 font-mono text-[11px] text-foreground outline-none focus:border-sky-500"
                      >
                        <option value={90}>+90° Cima</option>
                        <option value={-90}>-90° Baixo</option>
                        <option value={45}>+45° Cima</option>
                        <option value={-45}>-45° Baixo</option>
                      </select>
                      <input
                        type="number"
                        min="0.5"
                        max="50"
                        step="0.5"
                        value={bendRadius}
                        onChange={(e) => setBendRadius(Math.max(0.5, parseFloat(e.target.value) || 2))}
                        title="Raio interno de dobra R (mm)"
                        className="w-12 rounded-lg border border-slate-800 bg-slate-900 px-1.5 py-1 font-mono text-[11px] text-foreground outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Ressalto Cil. H (mm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      step="1"
                      value={bossHeight}
                      onChange={(e) => setBossHeight(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="Auto"
                      title="Altura de extrusão H para buchas/anéis concêntricos (0 = Automático)"
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Nervura Esp. (mm)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      step="0.5"
                      value={ribThickness}
                      onChange={(e) => setRibThickness(Math.max(1, parseFloat(e.target.value) || 6))}
                      title="Espessura da mão-francesa / nervura de reforço (mm)"
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 4. TOGGLE PRÉVIA EM TEMPO REAL */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => {
                    triggerHaptic("tap");
                    setShowPreview(e.target.checked);
                  }}
                  className="rounded text-sky-500 focus:ring-sky-500"
                />
                <span className="flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  <span>Exibir prévia em tempo real no canvas</span>
                </span>
              </label>
              {previewResult && (
                <span className="font-mono text-[10px] text-sky-400">
                  {previewResult.previewEntities.length} entidades geradas
                </span>
              )}
            </div>

            {/* BOTÕES DE CONFIRMAÇÃO */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-400 hover:to-amber-400 text-xs font-bold text-black shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {actionDirection === "unproject" ? (
                  <>
                    <Undo2 className="size-4" />
                    <span>Reverter para 2D Ortogonal</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Confirmar Conversão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-exporta compatibilidade retroativa
export const ChamferIsoPieceBuilderModal = ChamferIsoConvertModal;
