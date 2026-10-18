/**
 * CALDRA CHAMFER — ABA PROPRIEDADES (INSPETOR CAD CONTEXTUAL COMPLETO)
 *
 * Exibe propriedades contextuais da geometria selecionada ou da chapa/projeto:
 * - LINHA: X1, Y1, X2, Y2, comprimento, ângulo polar, comprimento real
 * - CÍRCULO: centro X, centro Y, diâmetro (Ø), raio (R), perímetro, área
 * - ARCO: centro X, centro Y, raio (R), ângulo inicial, ângulo final, comprimento
 * - POLILINHA / RETÂNGULO: largura, altura, perímetro, vértices, fechamento
 * - CHAPA / PEÇA: comprimento, largura, espessura, material, dobra, raio, K-factor
 *
 * INTEGRAÇÃO COM EDITOR COMPACTO:
 * Ao tocar em qualquer medida, abre o ChamferCompactNumericEditor no local,
 * alterando a geometria no canvas EM TEMPO REAL.
 */

import React, { useState, useMemo } from "react";
import {
  Circle,
  CornerUpRight,
  Minus,
  Square,
  Type,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Divide,
  Maximize2,
  Box,
  Ruler,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity, Layer } from "@/lib/lab2d/core";
import { techColor, isUserLayer } from "@/lib/lab2d/technical";
import { ChamferCompactNumericEditor } from "@/components/lab2d/mobileEdit/ChamferCompactNumericEditor";
import type { NumericPropertyDef } from "@/components/lab2d/mobileEdit/types";
import { copyToGlobalClipboard } from "@/lib/lab2d/globalClipboard";
import { toast } from "sonner";

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

interface ChamferPropertiesTabProps {
  entities: Entity[];
  selection: string[];
  setSelection: (ids: string[]) => void;
  layers: Layer[];
  thickness: number;
  onThicknessChange: (th: number) => void;
  onUpdateEntity: (e: Entity) => void;
  onDeleteEntity: (id: string) => void;
  onDuplicateEntity: (e: Entity) => void;
  onDivideEntity?: (e: Entity) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  material: string;
  onMaterialChange: (mat: string) => void;
  kFactor?: number;
  onKFactorChange?: (k: number) => void;
  bendRadius?: number;
  onBendRadiusChange?: (r: number) => void;
  isDark?: boolean;
}

export function ChamferPropertiesTab({
  entities,
  selection,
  setSelection,
  layers,
  thickness,
  onThicknessChange,
  onUpdateEntity,
  onDeleteEntity,
  onDuplicateEntity,
  onDivideEntity,
  projectName,
  onProjectNameChange,
  material,
  onMaterialChange,
  kFactor = 0.40,
  onKFactorChange,
  bendRadius = 3.0,
  onBendRadiusChange,
  isDark = true,
}: ChamferPropertiesTabProps) {
  // Propriedade ativa em edição pelo ChamferCompactNumericEditor
  const [activeNumericProp, setActiveNumericProp] = useState<NumericPropertyDef | null>(null);

  // Seções colapsáveis
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Entidade única selecionada
  const selectedEntity = useMemo(() => {
    if (selection.length === 1) {
      return entities.find((e) => e.id === selection[0]) ?? null;
    }
    return null;
  }, [selection, entities]);

  // Multiseleção
  const selectedEntities = useMemo(() => {
    if (selection.length > 1) {
      return entities.filter((e) => selection.includes(e.id));
    }
    return [];
  }, [selection, entities]);

  // Cálculo da Bounding Box Geral do Projeto ou da Seleção
  const overallBounds = useMemo(() => {
    const targetList = selectedEntities.length > 0 ? selectedEntities : entities;
    if (targetList.length === 0) return { minX: 0, maxX: 200, minY: 0, maxY: 100, width: 200, height: 100 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const ent of targetList) {
      if (ent.type === "circle" || ent.type === "arc") {
        minX = Math.min(minX, ent.cx - ent.r);
        maxX = Math.max(maxX, ent.cx + ent.r);
        minY = Math.min(minY, ent.cy - ent.r);
        maxY = Math.max(maxY, ent.cy + ent.r);
      } else if (ent.type === "line") {
        minX = Math.min(minX, ent.x1, ent.x2);
        maxX = Math.max(maxX, ent.x1, ent.x2);
        minY = Math.min(minY, ent.y1, ent.y2);
        maxY = Math.max(maxY, ent.y1, ent.y2);
      } else if (ent.type === "polyline" && ent.pts.length > 0) {
        for (const p of ent.pts) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    }

    if (minX === Infinity) return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(0.1, maxX - minX),
      height: Math.max(0.1, maxY - minY),
    };
  }, [selectedEntities, entities]);

  // Perímetro e Área Totais
  const totalPerimeter = useMemo(() => {
    let len = 0;
    for (const e of entities) {
      if (e.type === "line") {
        len += Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
      } else if (e.type === "circle") {
        len += 2 * Math.PI * e.r;
      } else if (e.type === "arc") {
        let sw = e.a1 - e.a0;
        while (sw < 0) sw += Math.PI * 2;
        len += e.r * sw;
      } else if (e.type === "polyline" && e.pts.length > 1) {
        for (let i = 0; i < e.pts.length - 1; i++) {
          len += Math.hypot(e.pts[i + 1].x - e.pts[i].x, e.pts[i + 1].y - e.pts[i].y);
        }
        if (e.closed && e.pts.length > 2) {
          len += Math.hypot(e.pts[0].x - e.pts[e.pts.length - 1].x, e.pts[0].y - e.pts[e.pts.length - 1].y);
        }
      }
    }
    return len;
  }, [entities]);

  // Aplicação de mutação em tempo real pelo ChamferCompactNumericEditor
  const handleNumericPropChange = (key: string, val: number) => {
    // 1. Espessura da chapa
    if (key === "thickness") {
      onThicknessChange(val);
      return;
    }
    // 2. Fator K
    if (key === "kFactor" && onKFactorChange) {
      onKFactorChange(val);
      return;
    }
    // 3. Raio de dobra
    if (key === "bendRadius" && onBendRadiusChange) {
      onBendRadiusChange(val);
      return;
    }

    // 4. Entidade selecionada
    if (!selectedEntity) return;

    if (selectedEntity.type === "circle") {
      if (key === "diameter") {
        onUpdateEntity({ ...selectedEntity, r: Math.max(0.1, val / 2) });
      } else if (key === "radius") {
        onUpdateEntity({ ...selectedEntity, r: Math.max(0.05, val) });
      } else if (key === "cx") {
        onUpdateEntity({ ...selectedEntity, cx: val });
      } else if (key === "cy") {
        onUpdateEntity({ ...selectedEntity, cy: val });
      }
    } else if (selectedEntity.type === "arc") {
      if (key === "radius") {
        onUpdateEntity({ ...selectedEntity, r: Math.max(0.05, val) });
      } else if (key === "sweep") {
        onUpdateEntity({ ...selectedEntity, a1: selectedEntity.a0 + rad(val) });
      } else if (key === "a0") {
        onUpdateEntity({ ...selectedEntity, a0: rad(val) });
      } else if (key === "a1") {
        onUpdateEntity({ ...selectedEntity, a1: rad(val) });
      } else if (key === "cx") {
        onUpdateEntity({ ...selectedEntity, cx: val });
      } else if (key === "cy") {
        onUpdateEntity({ ...selectedEntity, cy: val });
      }
    } else if (selectedEntity.type === "line") {
      const dx = selectedEntity.x2 - selectedEntity.x1;
      const dy = selectedEntity.y2 - selectedEntity.y1;
      const curAng = Math.atan2(dy, dx);
      const curLen = Math.hypot(dx, dy);

      if (key === "length") {
        const nextLen = Math.max(0.1, val);
        onUpdateEntity({
          ...selectedEntity,
          x2: selectedEntity.x1 + nextLen * Math.cos(curAng),
          y2: selectedEntity.y1 + nextLen * Math.sin(curAng),
        });
      } else if (key === "angle") {
        const nextAng = rad(val);
        onUpdateEntity({
          ...selectedEntity,
          x2: selectedEntity.x1 + curLen * Math.cos(nextAng),
          y2: selectedEntity.y1 + curLen * Math.sin(nextAng),
        });
      } else if (key === "x1") {
        onUpdateEntity({ ...selectedEntity, x1: val });
      } else if (key === "y1") {
        onUpdateEntity({ ...selectedEntity, y1: val });
      } else if (key === "x2") {
        onUpdateEntity({ ...selectedEntity, x2: val });
      } else if (key === "y2") {
        onUpdateEntity({ ...selectedEntity, y2: val });
      }
    } else if (selectedEntity.type === "polyline" && selectedEntity.pts.length > 0) {
      const xs = selectedEntity.pts.map((p) => p.x);
      const ys = selectedEntity.pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const curW = Math.max(...xs) - minX;
      const curH = Math.max(...ys) - minY;

      if (key === "width" && curW > 0.001) {
        const scaleX = Math.max(0.1, val) / curW;
        onUpdateEntity({
          ...selectedEntity,
          pts: selectedEntity.pts.map((p) => ({
            x: minX + (p.x - minX) * scaleX,
            y: p.y,
          })),
        });
      } else if (key === "height" && curH > 0.001) {
        const scaleY = Math.max(0.1, val) / curH;
        onUpdateEntity({
          ...selectedEntity,
          pts: selectedEntity.pts.map((p) => ({
            x: p.x,
            y: minY + (p.y - minY) * scaleY,
          })),
        });
      }
    } else if (selectedEntity.type === "text") {
      if (key === "size") onUpdateEntity({ ...selectedEntity, size: Math.max(1, val) });
      if (key === "rotation") onUpdateEntity({ ...selectedEntity, rotation: rad(val) });
      if (key === "x") onUpdateEntity({ ...selectedEntity, x: val });
      if (key === "y") onUpdateEntity({ ...selectedEntity, y: val });
    }
  };

  /**
   * Componente de Campo Numérico Conectado ao ChamferCompactNumericEditor
   */
  const renderNumericField = (
    def: NumericPropertyDef,
    highlight: boolean = false,
  ) => {
    const isEditingThis = activeNumericProp?.key === def.key;

    return (
      <div key={def.key} className="relative py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {def.symbol && (
              <span className="font-mono text-red-500 font-bold text-xs shrink-0">
                {def.symbol}
              </span>
            )}
            <span className="font-mono text-[10px] text-slate-400 truncate">
              {def.label}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setActiveNumericProp(isEditingThis ? null : def);
            }}
            title={`Editar ${def.label} com o editor compacto`}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-semibold transition-all cursor-pointer shadow-2xs",
              isEditingThis
                ? "border-red-500 bg-red-600 text-white shadow-red-900/30 ring-1 ring-red-400"
                : highlight
                ? "border-red-500/50 bg-slate-900 text-white hover:border-red-500 hover:bg-slate-800"
                : "border-slate-800 bg-slate-900/90 text-slate-200 hover:border-slate-700 hover:bg-slate-800"
            )}
          >
            <span>{def.value.toFixed(def.decimals ?? 2)}</span>
            {def.unit && (
              <span className="text-[9px] text-slate-400 font-normal">
                {def.unit}
              </span>
            )}
          </button>
        </div>

        {/* Popover flutuante do Editor Compacto do CHAMFER */}
        {isEditingThis && (
          <div className="absolute right-0 top-full mt-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <ChamferCompactNumericEditor
              property={def}
              onChange={(newVal) => handleNumericPropChange(def.key, newVal)}
              onConfirm={(finalVal) => {
                handleNumericPropChange(def.key, finalVal);
                setActiveNumericProp(null);
              }}
              onCancel={() => setActiveNumericProp(null)}
            />
          </div>
        )}
      </div>
    );
  };

  /**
   * Componente de Campo de Leitura / Informação
   */
  const renderInfoRow = (label: string, value: string, symbol?: string) => (
    <div key={label} className="flex items-center justify-between gap-2 py-0.5">
      <div className="flex items-center gap-1.5">
        {symbol && <span className="font-mono text-[10px] text-slate-500">{symbol}</span>}
        <span className="font-mono text-[10px] text-slate-400">{label}</span>
      </div>
      <span className="font-mono text-[10.5px] font-medium text-slate-300">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5 text-slate-200 select-none pb-4">
      {/* ===================================================================== */}
      {/* CASO 1: SEM SELEÇÃO → PROPRIEDADES DA PEÇA & CHAPA                    */}
      {/* ===================================================================== */}
      {!selectedEntity && selectedEntities.length === 0 && (
        <div className="flex flex-col gap-2.5">
          {/* Cabeçalho da Peça */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-red-600/15 text-red-500 border border-red-500/25">
                <Box className="size-4" />
              </div>
              <div>
                <h4 className="font-sans text-xs font-bold text-white leading-tight">
                  Peça & Chapa
                </h4>
                <span className="font-mono text-[9px] text-slate-400">
                  {entities.length} entidades no desenho
                </span>
              </div>
            </div>
          </div>

          {/* Seção 1: Identificação do Projeto */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
            <div
              onClick={() => toggleSection("ident")}
              className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
            >
              <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Identificação
              </span>
              {collapsedSections.ident ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>

            {!collapsedSections.ident && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400">Nome da Peça</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => onProjectNameChange(e.target.value)}
                    placeholder="Nome da peça CAD"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-sans text-xs text-white outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400">Material de Fabricação</label>
                  <select
                    value={material}
                    onChange={(e) => onMaterialChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-sans text-xs text-white outline-none focus:border-red-500"
                  >
                    <option value="Aço carbono (1020)">Aço Carbono (SAE 1020)</option>
                    <option value="Aço carbono (A36)">Aço Estrutural (ASTM A36)</option>
                    <option value="Aço inoxidável (304)">Aço Inox (AISI 304)</option>
                    <option value="Alumínio (5052-H32)">Alumínio Naval (5052-H32)</option>
                    <option value="Aço corten">Aço Corten / Resistente</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Seção 2: Dimensões Globais da Chapa */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
            <div
              onClick={() => toggleSection("dims")}
              className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
            >
              <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Dimensões da Chapa
              </span>
              {collapsedSections.dims ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>

            {!collapsedSections.dims && (
              <div className="flex flex-col gap-1">
                {renderNumericField(
                  {
                    key: "thickness",
                    label: "Espessura da Chapa",
                    symbol: "e",
                    value: thickness,
                    unit: "mm",
                    min: 0.5,
                    max: 50,
                    defaultStep: 0.5,
                    stepOptions: [0.1, 0.5, 1, 2],
                  },
                  true
                )}
                {renderInfoRow("Comprimento (X)", `${overallBounds.width.toFixed(2)} mm`, "↔")}
                {renderInfoRow("Largura (Y)", `${overallBounds.height.toFixed(2)} mm`, "↕")}
                {renderInfoRow(
                  "Área da chapa",
                  `${((overallBounds.width * overallBounds.height) / 1e6).toFixed(4)} m²`,
                  "▨"
                )}
                {renderInfoRow("Perímetro de corte", `${(totalPerimeter / 1000).toFixed(3)} m`, "✂")}
              </div>
            )}
          </div>

          {/* Seção 3: Parâmetros de Dobra & K-Factor */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
            <div
              onClick={() => toggleSection("dobra")}
              className="flex items-center justify-between cursor-pointer text-slate-400 hover:text-white mb-2"
            >
              <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Dobra & Conformação
              </span>
              {collapsedSections.dobra ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>

            {!collapsedSections.dobra && (
              <div className="flex flex-col gap-1">
                {renderNumericField({
                  key: "bendRadius",
                  label: "Raio Interno de Dobra",
                  symbol: "R",
                  value: bendRadius,
                  unit: "mm",
                  min: 0.5,
                  defaultStep: 0.5,
                  stepOptions: [0.5, 1, 2, 5],
                })}
                {renderNumericField({
                  key: "kFactor",
                  label: "Fator K",
                  symbol: "K",
                  value: kFactor,
                  unit: "",
                  min: 0.1,
                  max: 0.8,
                  decimals: 2,
                  defaultStep: 0.05,
                  stepOptions: [0.01, 0.05, 0.1],
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CASO 2: UMA ENTIDADE SELECIONADA → INSPETOR COMPLETO                  */}
      {/* ===================================================================== */}
      {selectedEntity && (
        <div className="flex flex-col gap-2.5">
          {/* Cabeçalho da Entidade com Tipo e Camada */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div
                className="flex size-7 items-center justify-center rounded-lg border"
                style={{
                  background: `${techColor(selectedEntity.layer)}20`,
                  borderColor: `${techColor(selectedEntity.layer)}40`,
                  color: techColor(selectedEntity.layer),
                }}
              >
                {selectedEntity.type === "circle" && <Circle className="size-3.5" />}
                {selectedEntity.type === "arc" && <CornerUpRight className="size-3.5" />}
                {selectedEntity.type === "line" && <Minus className="size-3.5" />}
                {selectedEntity.type === "polyline" && <Square className="size-3.5" />}
                {selectedEntity.type === "text" && <Type className="size-3.5" />}
              </div>
              <div>
                <h4 className="font-sans text-xs font-bold text-white capitalize">
                  {selectedEntity.type === "circle" && "Círculo"}
                  {selectedEntity.type === "arc" && "Arco de Circunferência"}
                  {selectedEntity.type === "line" && "Linha Reta"}
                  {selectedEntity.type === "polyline" && (selectedEntity.closed ? "Retângulo / Polígono" : "Polilinha")}
                  {selectedEntity.type === "text" && "Texto Técnico"}
                  {selectedEntity.type === "point" && "Ponto de Referência"}
                </h4>
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  Camada: {selectedEntity.layer}
                </span>
              </div>
            </div>

            {/* Ações Rápidas: Duplicar, Dividir e Excluir */}
            <div className="flex items-center gap-1">
              {onDivideEntity && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    onDivideEntity(selectedEntity);
                  }}
                  title="Dividir em partes iguais (2 a 50)"
                  className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Divide className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  const item = copyToGlobalClipboard(entities, [selectedEntity.id]);
                  if (item) {
                    toast.success(`✓ "${item.title}" copiado para a Área de Transferência.`);
                  }
                }}
                title="Copiar para Área de Transferência"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("warning");
                  onDeleteEntity(selectedEntity.id);
                  setSelection([]);
                }}
                title="Excluir entidade"
                className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          {/* ---------------- LINHA ---------------- */}
          {selectedEntity.type === "line" && (() => {
            const dx = selectedEntity.x2 - selectedEntity.x1;
            const dy = selectedEntity.y2 - selectedEntity.y1;
            const len = Math.hypot(dx, dy);
            const ang = (Math.atan2(dy, dx) * 180) / Math.PI;

            return (
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Comprimento & Direção
                  </span>
                  {renderNumericField(
                    {
                      key: "length",
                      label: "Comprimento",
                      symbol: "↔",
                      value: len,
                      unit: "mm",
                      min: 0.1,
                      defaultStep: 5,
                      stepOptions: [0.1, 1, 5, 10],
                    },
                    true
                  )}
                  {renderNumericField({
                    key: "angle",
                    label: "Ângulo Polar",
                    symbol: "∠",
                    value: ang,
                    unit: "°",
                    defaultStep: 5,
                    stepOptions: [1, 5, 15, 45],
                    allowNegative: true,
                  })}
                  {renderInfoRow("Comprimento Real", `${len.toFixed(2)} mm`, "📏")}
                  {renderInfoRow("Projeção ΔX", `${Math.abs(dx).toFixed(2)} mm`)}
                  {renderInfoRow("Projeção ΔY", `${Math.abs(dy).toFixed(2)} mm`)}
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Pontos Extremos
                  </span>
                  {renderNumericField({
                    key: "x1",
                    label: "X Inicial (X1)",
                    symbol: "X1",
                    value: selectedEntity.x1,
                    unit: "mm",
                    defaultStep: 5,
                    allowNegative: true,
                  })}
                  {renderNumericField({
                    key: "y1",
                    label: "Y Inicial (Y1)",
                    symbol: "Y1",
                    value: selectedEntity.y1,
                    unit: "mm",
                    defaultStep: 5,
                    allowNegative: true,
                  })}
                  {renderNumericField({
                    key: "x2",
                    label: "X Final (X2)",
                    symbol: "X2",
                    value: selectedEntity.x2,
                    unit: "mm",
                    defaultStep: 5,
                    allowNegative: true,
                  })}
                  {renderNumericField({
                    key: "y2",
                    label: "Y Final (Y2)",
                    symbol: "Y2",
                    value: selectedEntity.y2,
                    unit: "mm",
                    defaultStep: 5,
                    allowNegative: true,
                  })}
                </div>
              </div>
            );
          })()}

          {/* ---------------- CÍRCULO ---------------- */}
          {selectedEntity.type === "circle" && (() => {
            const diameter = selectedEntity.r * 2;
            const perimeter = 2 * Math.PI * selectedEntity.r;
            const area = Math.PI * Math.pow(selectedEntity.r, 2);

            return (
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Dimensões Radiais
                  </span>
                  {renderNumericField(
                    {
                      key: "diameter",
                      label: "Diâmetro",
                      symbol: "Ø",
                      value: diameter,
                      unit: "mm",
                      min: 0.1,
                      defaultStep: 1,
                      stepOptions: [0.1, 1, 5, 10],
                    },
                    true
                  )}
                  {renderNumericField({
                    key: "radius",
                    label: "Raio (R)",
                    symbol: "R",
                    value: selectedEntity.r,
                    unit: "mm",
                    min: 0.05,
                    defaultStep: 1,
                    stepOptions: [0.1, 1, 5, 10],
                  })}
                  {renderInfoRow("Circunferência", `${perimeter.toFixed(2)} mm`)}
                  {renderInfoRow("Área do furo", `${area.toFixed(2)} mm²`)}
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Centro do Furo
                  </span>
                  {renderNumericField({
                    key: "cx",
                    label: "Centro X",
                    symbol: "X",
                    value: selectedEntity.cx,
                    unit: "mm",
                    defaultStep: 5,
                    stepOptions: [0.1, 1, 5, 10],
                    allowNegative: true,
                  })}
                  {renderNumericField({
                    key: "cy",
                    label: "Centro Y",
                    symbol: "Y",
                    value: selectedEntity.cy,
                    unit: "mm",
                    defaultStep: 5,
                    stepOptions: [0.1, 1, 5, 10],
                    allowNegative: true,
                  })}
                </div>
              </div>
            );
          })()}

          {/* ---------------- ARCO ---------------- */}
          {selectedEntity.type === "arc" && (() => {
            let sweep = selectedEntity.a1 - selectedEntity.a0;
            while (sweep < 0) sweep += Math.PI * 2;
            const sweepDeg = (sweep * 180) / Math.PI;
            const arcLength = selectedEntity.r * sweep;

            return (
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Dimensões do Arco
                  </span>
                  {renderNumericField(
                    {
                      key: "radius",
                      label: "Raio (R)",
                      symbol: "R",
                      value: selectedEntity.r,
                      unit: "mm",
                      min: 0.1,
                      defaultStep: 1,
                      stepOptions: [0.1, 1, 5, 10],
                    },
                    true
                  )}
                  {renderNumericField({
                    key: "sweep",
                    label: "Ângulo de Abertura",
                    symbol: "∠",
                    value: sweepDeg,
                    unit: "°",
                    min: 1,
                    max: 360,
                    defaultStep: 5,
                    stepOptions: [1, 5, 15, 45],
                  })}
                  {renderNumericField({
                    key: "a0",
                    label: "Ângulo Inicial",
                    symbol: "∠0",
                    value: deg(selectedEntity.a0),
                    unit: "°",
                    defaultStep: 15,
                    stepOptions: [1, 5, 15, 45],
                    allowNegative: true,
                  })}
                  {renderNumericField({
                    key: "a1",
                    label: "Ângulo Final",
                    symbol: "∠1",
                    value: deg(selectedEntity.a1),
                    unit: "°",
                    defaultStep: 15,
                    stepOptions: [1, 5, 15, 45],
                    allowNegative: true,
                  })}
                  {renderInfoRow("Comprimento do arco", `${arcLength.toFixed(2)} mm`, "⌒")}
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Centro do Arco
                  </span>
                  {renderNumericField({
                    key: "cx",
                    label: "Centro X",
                    symbol: "X",
                    value: selectedEntity.cx,
                    unit: "mm",
                    defaultStep: 5,
                    allowNegative: true,
                  })}
                  {renderNumericField({
                    key: "cy",
                    label: "Centro Y",
                    symbol: "Y",
                    value: selectedEntity.cy,
                    unit: "mm",
                    defaultStep: 5,
                    allowNegative: true,
                  })}
                </div>
              </div>
            );
          })()}

          {/* ---------------- POLILINHA / RETÂNGULO ---------------- */}
          {selectedEntity.type === "polyline" && (() => {
            const xs = selectedEntity.pts.map((p) => p.x);
            const ys = selectedEntity.pts.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const w = Math.max(...xs) - minX;
            const h = Math.max(...ys) - minY;

            let polyLen = 0;
            for (let i = 0; i < selectedEntity.pts.length - 1; i++) {
              polyLen += Math.hypot(selectedEntity.pts[i + 1].x - selectedEntity.pts[i].x, selectedEntity.pts[i + 1].y - selectedEntity.pts[i].y);
            }
            if (selectedEntity.closed && selectedEntity.pts.length > 2) {
              polyLen += Math.hypot(selectedEntity.pts[0].x - selectedEntity.pts[selectedEntity.pts.length - 1].x, selectedEntity.pts[0].y - selectedEntity.pts[selectedEntity.pts.length - 1].y);
            }

            return (
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Dimensões do Contorno
                  </span>
                  {renderNumericField(
                    {
                      key: "width",
                      label: "Largura (X)",
                      symbol: "↔",
                      value: w,
                      unit: "mm",
                      min: 0.1,
                      defaultStep: 5,
                      stepOptions: [0.1, 1, 5, 10],
                    },
                    true
                  )}
                  {renderNumericField(
                    {
                      key: "height",
                      label: "Altura (Y)",
                      symbol: "↕",
                      value: h,
                      unit: "mm",
                      min: 0.1,
                      defaultStep: 5,
                      stepOptions: [0.1, 1, 5, 10],
                    },
                    true
                  )}
                  {renderInfoRow("Perímetro de contorno", `${polyLen.toFixed(2)} mm`)}
                  {renderInfoRow("Número de vértices", `${selectedEntity.pts.length}`)}
                  {renderInfoRow("Fechamento", selectedEntity.closed ? "Fechada (Chapa/Loop)" : "Aberta")}
                </div>
              </div>
            );
          })()}

          {/* ---------------- TEXTO ---------------- */}
          {selectedEntity.type === "text" && (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
                <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Conteúdo do Texto
                </span>
                <input
                  type="text"
                  value={selectedEntity.text}
                  onChange={(e) => onUpdateEntity({ ...selectedEntity, text: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-sans text-xs text-white outline-none focus:border-red-500 mb-1.5"
                />
                {renderNumericField({
                  key: "size",
                  label: "Altura da Fonte",
                  symbol: "H",
                  value: selectedEntity.size,
                  unit: "mm",
                  min: 1,
                  defaultStep: 1,
                  stepOptions: [0.5, 1, 2, 5],
                })}
                {renderNumericField({
                  key: "rotation",
                  label: "Rotação",
                  symbol: "∠",
                  value: deg(selectedEntity.rotation ?? 0),
                  unit: "°",
                  defaultStep: 15,
                  stepOptions: [1, 5, 15, 45],
                  allowNegative: true,
                })}
              </div>
            </div>
          )}

          {/* Seletor de Camada da Entidade */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex items-center justify-between">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Camada
            </span>
            <select
              value={selectedEntity.layer}
              onChange={(e) => onUpdateEntity({ ...selectedEntity, layer: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white outline-none focus:border-red-500"
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CASO 3: MULTISELEÇÃO → PROPRIEDADES E AÇÕES EM LOTE                   */}
      {/* ===================================================================== */}
      {selectedEntities.length > 1 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-red-600/15 text-red-500 border border-red-500/25">
                <Layers className="size-4" />
              </div>
              <div>
                <h4 className="font-sans text-xs font-bold text-white leading-tight">
                  Multiseleção
                </h4>
                <span className="font-mono text-[9px] text-slate-400">
                  {selectedEntities.length} entidades selecionadas
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-1">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              Caixa Delimitadora Conjunta
            </span>
            {renderInfoRow("Largura total (X)", `${overallBounds.width.toFixed(2)} mm`, "↔")}
            {renderInfoRow("Altura total (Y)", `${overallBounds.height.toFixed(2)} mm`, "↕")}
          </div>

          {/* Ações em lote */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 flex flex-col gap-2">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Ações em Lote
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  const item = copyToGlobalClipboard(entities, selection);
                  if (item) {
                    toast.success(`✓ "${item.title}" copiado para a Área de Transferência.`);
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 py-1.5 font-mono text-[10px] font-semibold text-slate-200 hover:bg-slate-800"
              >
                <Copy className="size-3.5" />
                <span>Copiar Todas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic("warning");
                  for (const ent of selectedEntities) {
                    onDeleteEntity(ent.id);
                  }
                  setSelection([]);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-red-900/50 bg-red-950/40 py-1.5 font-mono text-[10px] font-semibold text-red-300 hover:bg-red-900/60"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir Todas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
