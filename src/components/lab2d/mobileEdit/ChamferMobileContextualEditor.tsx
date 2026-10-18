/**
 * CALDRA CHAMFER — EDITOR CONTEXTUAL MOBILE (PAINÉIS 1 E 3 DA REFERÊNCIA)
 *
 * Exibe apenas as propriedades estritamente relevantes da entidade selecionada:
 * - Círculo: Diâmetro, Centro X, Centro Y
 * - Arco: Raio, Ângulo, Centro X, Centro Y
 * - Linha: Comprimento, Ângulo, X, Y
 * - Chapa / Retângulo: Comprimento, Largura, Espessura
 * - Texto: Conteúdo textual com teclado nativo, Altura, Rotação
 * - 3D Sólido & Flanges: Dimensões paramétricas do sólido e espessura real
 * - Peça / Chapa global: Nome da peça, Material, Espessura
 *
 * Ao tocar em qualquer medida numérica, abre o ChamferCompactNumericEditor
 * sem abrir o teclado virtual nativo do sistema, mantendo a peça 100% visível!
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  ChevronRight,
  Circle,
  Square,
  Minus,
  Type,
  CornerUpRight,
  Trash2,
  Copy,
  Box,
  Layers,
  Sparkles,
  Sliders,
  FoldHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import type { Entity, Layer } from "@/lib/lab2d/core";
import { ChamferCompactNumericEditor } from "./ChamferCompactNumericEditor";
import type { NumericPropertyDef } from "./types";

export interface Model3DParams {
  type: string;
  name: string;
  params: Record<string, number>;
}

interface ChamferMobileContextualEditorProps {
  entity?: Entity | null;
  onUpdateEntity?: (updated: Entity) => void;
  onDeleteEntity?: (id: string) => void;
  onDuplicateEntity?: (entity: Entity) => void;
  onClose: () => void;
  layers?: Layer[];
  // Dados globais da peça/projeto (Painel 3)
  projectName?: string;
  onUpdateProjectName?: (name: string) => void;
  material?: string;
  onUpdateMaterial?: (material: string) => void;
  thickness?: number;
  onUpdateThickness?: (thickness: number) => void;
  // Parâmetros 3D / Sólido / Flanges (Regra 14)
  is3DMode?: boolean;
  model3D?: Model3DParams | null;
  onUpdate3DParam?: (key: string, value: number) => void;
  // Notificação para feedback visual no canvas (Regra 15)
  onActivePropertyChange?: (prop: { key: string; label: string; value: number; unit: string } | null) => void;
  className?: string;
}

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

export function ChamferMobileContextualEditor({
  entity,
  onUpdateEntity,
  onDeleteEntity,
  onDuplicateEntity,
  onClose,
  layers = [],
  projectName = "Suporte lateral",
  onUpdateProjectName,
  material = "Aço carbono (1020)",
  onUpdateMaterial,
  thickness = 3.0,
  onUpdateThickness,
  is3DMode = false,
  model3D,
  onUpdate3DParam,
  onActivePropertyChange,
  className,
}: ChamferMobileContextualEditorProps) {
  // Propriedade numérica atualmente aberta no ChamferCompactNumericEditor
  const [activeNumericProp, setActiveNumericProp] = useState<NumericPropertyDef | null>(null);

  // Ativa a Virtual Keyboard API para evitar redimensionamento brusco do canvas (Regra 13)
  useEffect(() => {
    if (typeof navigator !== "undefined" && "virtualKeyboard" in navigator) {
      try {
        (navigator as unknown as { virtualKeyboard: { overlaysContent: boolean } }).virtualKeyboard.overlaysContent = true;
      } catch {
        // Fallback silencioso
      }
    }
  }, []);

  // Notifica o canvas sobre a propriedade em edição para feedback visual (Regra 15)
  const prevPropKeyRef = useRef<string | null>(null);
  const onActivePropertyChangeRef = useRef(onActivePropertyChange);
  onActivePropertyChangeRef.current = onActivePropertyChange;

  useEffect(() => {
    const curKey = activeNumericProp?.key ?? null;
    if (prevPropKeyRef.current === curKey) return;
    prevPropKeyRef.current = curKey;

    if (activeNumericProp && onActivePropertyChangeRef.current) {
      onActivePropertyChangeRef.current({
        key: activeNumericProp.key,
        label: activeNumericProp.label,
        value: activeNumericProp.value,
        unit: activeNumericProp.unit,
      });
    } else if (onActivePropertyChangeRef.current) {
      onActivePropertyChangeRef.current(null);
    }
  }, [activeNumericProp]);

  // Identificação do tipo da entidade
  const isRect = entity?.type === "polyline" && entity.closed && entity.pts.length === 4;

  const entityTitle = useMemo(() => {
    if (is3DMode && model3D) return model3D.name || "Sólido 3D";
    if (!entity) return "Propriedades da Peça";
    if (isRect) return "Chapa / Retângulo";
    switch (entity.type) {
      case "circle":
        return "Círculo";
      case "arc":
        return "Arco";
      case "line":
        return "Linha";
      case "polyline":
        return "Polilinha";
      case "ellipse":
        return "Elipse";
      case "text":
        return "Texto";
      case "point":
        return "Ponto";
      default:
        return "Entidade";
    }
  }, [entity, isRect, is3DMode, model3D]);

  // Ícone característico da entidade
  const EntityIcon = useMemo(() => {
    if (is3DMode && model3D) return Box;
    if (!entity) return Layers;
    if (isRect) return Square;
    switch (entity.type) {
      case "circle":
        return Circle;
      case "arc":
        return CornerUpRight;
      case "line":
        return Minus;
      case "text":
        return Type;
      default:
        return Sparkles;
    }
  }, [entity, isRect, is3DMode, model3D]);

  // -------------------------------------------------------------------------
  // MUTAÇÃO GEOMÉTRICA CONTEXTUAL EM TEMPO REAL
  // -------------------------------------------------------------------------
  const handleNumericPropChange = (key: string, val: number) => {
    // Caso 1: Parâmetros 3D de sólidos (Regra 14)
    if (is3DMode && model3D && onUpdate3DParam && key in model3D.params) {
      onUpdate3DParam(key, val);
      return;
    }

    // Caso 2: Espessura global da peça / chapa
    if (key === "thickness" && onUpdateThickness) {
      onUpdateThickness(val);
      return;
    }

    // Caso 3: Entidades 2D no Sketcher
    if (!entity || !onUpdateEntity) return;

    if (entity.type === "circle") {
      if (key === "diameter") {
        onUpdateEntity({ ...entity, r: Math.max(0.1, val / 2) });
      } else if (key === "radius") {
        onUpdateEntity({ ...entity, r: Math.max(0.05, val) });
      } else if (key === "cx") {
        onUpdateEntity({ ...entity, cx: val });
      } else if (key === "cy") {
        onUpdateEntity({ ...entity, cy: val });
      }
    } else if (entity.type === "arc") {
      if (key === "radius") {
        onUpdateEntity({ ...entity, r: Math.max(0.05, val) });
      } else if (key === "sweep") {
        onUpdateEntity({ ...entity, a1: entity.a0 + rad(val) });
      } else if (key === "cx") {
        onUpdateEntity({ ...entity, cx: val });
      } else if (key === "cy") {
        onUpdateEntity({ ...entity, cy: val });
      }
    } else if (entity.type === "line") {
      const dx = entity.x2 - entity.x1;
      const dy = entity.y2 - entity.y1;
      const curAng = Math.atan2(dy, dx);
      const curLen = Math.hypot(dx, dy);

      if (key === "length") {
        const nextLen = Math.max(0.1, val);
        onUpdateEntity({
          ...entity,
          x2: entity.x1 + nextLen * Math.cos(curAng),
          y2: entity.y1 + nextLen * Math.sin(curAng),
        });
      } else if (key === "angle") {
        const nextAng = rad(val);
        onUpdateEntity({
          ...entity,
          x2: entity.x1 + curLen * Math.cos(nextAng),
          y2: entity.y1 + curLen * Math.sin(nextAng),
        });
      } else if (key === "x1") {
        onUpdateEntity({ ...entity, x1: val });
      } else if (key === "y1") {
        onUpdateEntity({ ...entity, y1: val });
      } else if (key === "x2") {
        onUpdateEntity({ ...entity, x2: val });
      } else if (key === "y2") {
        onUpdateEntity({ ...entity, y2: val });
      }
    } else if (entity.type === "polyline" && entity.pts.length > 0) {
      const xs = entity.pts.map((p) => p.x);
      const ys = entity.pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const curW = Math.max(...xs) - minX;
      const curH = Math.max(...ys) - minY;

      if (key === "width" && curW > 0.001) {
        const scaleX = Math.max(0.1, val) / curW;
        onUpdateEntity({
          ...entity,
          pts: entity.pts.map((p) => ({
            x: minX + (p.x - minX) * scaleX,
            y: p.y,
          })),
        });
      } else if (key === "height" && curH > 0.001) {
        const scaleY = Math.max(0.1, val) / curH;
        onUpdateEntity({
          ...entity,
          pts: entity.pts.map((p) => ({
            x: p.x,
            y: minY + (p.y - minY) * scaleY,
          })),
        });
      } else if (key === "posX") {
        const diffX = val - minX;
        onUpdateEntity({
          ...entity,
          pts: entity.pts.map((p) => ({ x: p.x + diffX, y: p.y })),
        });
      } else if (key === "posY") {
        const diffY = val - minY;
        onUpdateEntity({
          ...entity,
          pts: entity.pts.map((p) => ({ x: p.x, y: p.y + diffY })),
        });
      }
    } else if (entity.type === "ellipse") {
      if (key === "diameter") {
        const nextR = Math.max(0.1, val / 2);
        const isIso = !!entity.params?.isIso;
        if (isIso) {
          onUpdateEntity({
            ...entity,
            rx: nextR * Math.sqrt(1.5),
            ry: nextR * Math.sqrt(0.5),
            params: { ...entity.params, realRadius: nextR, realDiameter: val },
          });
        } else {
          onUpdateEntity({ ...entity, rx: nextR, ry: nextR * (entity.ry / (entity.rx || 1)) });
        }
      } else if (key === "radius") {
        const nextR = Math.max(0.05, val);
        const isIso = !!entity.params?.isIso;
        if (isIso) {
          onUpdateEntity({
            ...entity,
            rx: nextR * Math.sqrt(1.5),
            ry: nextR * Math.sqrt(0.5),
            params: { ...entity.params, realRadius: nextR, realDiameter: nextR * 2 },
          });
        } else {
          onUpdateEntity({ ...entity, rx: nextR });
        }
      } else if (key === "rx") {
        onUpdateEntity({ ...entity, rx: Math.max(0.1, val) });
      } else if (key === "ry") {
        onUpdateEntity({ ...entity, ry: Math.max(0.1, val) });
      } else if (key === "cx") {
        onUpdateEntity({ ...entity, cx: val });
      } else if (key === "cy") {
        onUpdateEntity({ ...entity, cy: val });
      }
    } else if (entity.type === "point") {
      if (key === "x") onUpdateEntity({ ...entity, x: val });
      if (key === "y") onUpdateEntity({ ...entity, y: val });
    } else if (entity.type === "text") {
      if (key === "size") onUpdateEntity({ ...entity, size: Math.max(1, val) });
      if (key === "width") onUpdateEntity({ ...entity, width: Math.max(1, val) });
      if (key === "rotation") onUpdateEntity({ ...entity, rotation: rad(val) });
      if (key === "x") onUpdateEntity({ ...entity, x: val });
      if (key === "y") onUpdateEntity({ ...entity, y: val });
    }
  };

  // -------------------------------------------------------------------------
  // 1. SE UM EDITOR NUMÉRICO ESTIVER ABERTO (PAINEL 2 OU 4)
  // -------------------------------------------------------------------------
  if (activeNumericProp) {
    return (
      <ChamferCompactNumericEditor
        property={activeNumericProp}
        onChange={(newVal) => {
          // Aplicação imediata em tempo real na geometria (Regra 6)
          handleNumericPropChange(activeNumericProp.key, newVal);
        }}
        onConfirm={(finalVal) => {
          handleNumericPropChange(activeNumericProp.key, finalVal);
          setActiveNumericProp(null);
        }}
        onCancel={() => {
          setActiveNumericProp(null);
        }}
        className={className}
      />
    );
  }

  // -------------------------------------------------------------------------
  // CONSTRUÇÃO DAS LINHAS CONTEXTUAIS DA ENTIDADE
  // -------------------------------------------------------------------------
  const renderContextualRows = () => {
    // 1. MODO 3D SÓLIDO (REGRA 14: 2D E 3D)
    if (is3DMode && model3D) {
      const p = model3D.params;
      return (
        <div className="flex flex-col gap-1.5 py-1">
          {Object.entries(p).map(([k, v]) => {
            const labelMap: Record<string, { label: string; symbol: string; unit: "mm" | "°" }> = {
              width: { label: "Largura base", symbol: "↔", unit: "mm" },
              length: { label: "Comprimento base", symbol: "↕", unit: "mm" },
              diameter: { label: "Diâmetro", symbol: "Ø", unit: "mm" },
              height: { label: "Altura", symbol: "H", unit: "mm" },
              thickness: { label: "Espessura", symbol: "e", unit: "mm" },
              radius: { label: "Raio de curvatura", symbol: "R", unit: "mm" },
              angleDeg: { label: "Ângulo de curva", symbol: "∠", unit: "°" },
              segments: { label: "Gomos", symbol: "#", unit: "" as "mm" },
              mainDiameter: { label: "Diâmetro tubo principal", symbol: "Ø1", unit: "mm" },
              branchDiameter: { label: "Diâmetro ramal", symbol: "Ø2", unit: "mm" },
              mainLength: { label: "Comprimento tubo", symbol: "L", unit: "mm" },
              branchHeight: { label: "Altura ramal", symbol: "H", unit: "mm" },
            };

            const info = labelMap[k] || { label: k, symbol: "•", unit: "mm" as const };

            return (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setActiveNumericProp({
                    key: k,
                    label: info.label,
                    symbol: info.symbol,
                    value: v,
                    unit: info.unit,
                    min: 0.1,
                    defaultStep: info.unit === "°" ? 5 : 5,
                    stepOptions: info.unit === "°" ? [1, 5, 15, 45] : [0.1, 1, 5, 10],
                  })
                }
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-red-500/50 hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5 font-sans text-xs text-slate-300">
                  <span className="font-mono text-red-400 font-bold">{info.symbol}</span>
                  <span>{info.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                  <span>{v.toFixed(info.unit === "°" ? 1 : 2)} {info.unit}</span>
                  <ChevronRight className="size-3.5 text-red-500" />
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    // 2. CASO SEM ENTIDADE SELECIONADA: PROPRIEDADES DA PEÇA (PAINEL 3 DA REFERÊNCIA)
    if (!entity) {
      return (
        <div className="flex flex-col gap-2.5 py-1">
          {/* Nome da peça (Campo textual com teclado nativo do dispositivo - Regra 5) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-sans font-medium text-slate-400">
              Nome da peça
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 focus-within:border-red-500">
              <input
                type="text"
                value={projectName}
                onChange={(e) => onUpdateProjectName?.(e.target.value)}
                placeholder="Ex: Suporte lateral"
                className="w-full bg-transparent font-sans text-xs text-white placeholder-slate-500 outline-none"
              />
              {projectName && (
                <button
                  type="button"
                  onClick={() => onUpdateProjectName?.("")}
                  className="rounded p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Material (Seletor nativo adaptativo) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-sans font-medium text-slate-400">
              Material
            </label>
            <div className="relative">
              <select
                value={material}
                onChange={(e) => onUpdateMaterial?.(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 font-sans text-xs text-white outline-none focus:border-red-500"
              >
                <option value="Aço carbono (1020)">Aço carbono (1020)</option>
                <option value="Aço carbono (A36)">Aço carbono (ASTM A36)</option>
                <option value="Aço inoxidável (304)">Aço inoxidável (AISI 304)</option>
                <option value="Alumínio (5052-H32)">Alumínio naval (5052-H32)</option>
                <option value="Aço corten">Aço Corten / Resistente à corrosão</option>
              </select>
            </div>
          </div>

          {/* Espessura da chapa */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "thickness",
                label: "Espessura da Chapa",
                symbol: "e",
                value: thickness,
                unit: "mm",
                min: 0.5,
                max: 50,
                defaultStep: 0.5,
                stepOptions: [0.1, 0.5, 1, 2],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Espessura da chapa</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white">
              <span>{thickness.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>
        </div>
      );
    }

    // 3. CÍRCULO (DIÂMETRO, CENTRO X, CENTRO Y - PAINEL 1 DA REFERÊNCIA)
    if (entity.type === "circle") {
      const diameter = entity.r * 2;
      return (
        <div className="flex flex-col gap-1.5 py-1">
          {/* Ø Diâmetro */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "diameter",
                label: "Diâmetro",
                symbol: "Ø",
                value: diameter,
                unit: "mm",
                min: 0.5,
                defaultStep: 1,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-red-500/50 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-1.5 font-sans text-xs text-slate-300">
              <span className="font-mono text-red-400 font-bold">Ø</span>
              <span>Diâmetro</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
              <span>{diameter.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-red-500" />
            </div>
          </button>

          {/* Centro X */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "cx",
                label: "Centro X",
                symbol: "X",
                value: entity.cx,
                unit: "mm",
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
                allowNegative: true,
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Centro X</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{entity.cx.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>

          {/* Centro Y */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "cy",
                label: "Centro Y",
                symbol: "Y",
                value: entity.cy,
                unit: "mm",
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
                allowNegative: true,
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Centro Y</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{entity.cy.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>
        </div>
      );
    }

    // 4. ARCO (RAIO, ÂNGULO, CENTRO X, CENTRO Y)
    if (entity.type === "arc") {
      let sweep = entity.a1 - entity.a0;
      while (sweep < 0) sweep += Math.PI * 2;
      const sweepDeg = deg(sweep);

      return (
        <div className="flex flex-col gap-1.5 py-1">
          {/* Raio (R) */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "radius",
                label: "Raio (R)",
                symbol: "R",
                value: entity.r,
                unit: "mm",
                min: 0.5,
                defaultStep: 1,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-red-500/50 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-1.5 font-sans text-xs text-slate-300">
              <span className="font-mono text-red-400 font-bold">R</span>
              <span>Raio</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
              <span>{entity.r.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-red-500" />
            </div>
          </button>

          {/* Ângulo de Abertura */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "sweep",
                label: "Ângulo do Arco",
                symbol: "∠",
                value: sweepDeg,
                unit: "°",
                min: 1,
                max: 360,
                defaultStep: 5,
                stepOptions: [1, 5, 15, 45],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Ângulo</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{sweepDeg.toFixed(1)}°</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>

          {/* Centro X */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "cx",
                label: "Centro X",
                symbol: "X",
                value: entity.cx,
                unit: "mm",
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Centro X</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{entity.cx.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>

          {/* Centro Y */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "cy",
                label: "Centro Y",
                symbol: "Y",
                value: entity.cy,
                unit: "mm",
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Centro Y</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{entity.cy.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>
        </div>
      );
    }

    // 4.5. ELIPSE E ISOCÍRCULO
    if (entity.type === "ellipse") {
      const isIso = !!entity.params?.isIso;
      const realR =
        typeof entity.params?.realRadius === "number"
          ? entity.params.realRadius
          : entity.rx / Math.sqrt(1.5);
      const realDia =
        typeof entity.params?.realDiameter === "number"
          ? entity.params.realDiameter
          : realR * 2;
      const planeLabel = entity.params?.isoPlane
        ? String(entity.params.isoPlane).toUpperCase()
        : null;

      return (
        <div className="flex flex-col gap-1.5 py-1">
          {/* Diâmetro / Isodiâmetro */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "diameter",
                label: isIso ? `Diâmetro Ø (${planeLabel ?? "ISO"})` : "Diâmetro Maior Ø",
                symbol: "Ø",
                value: realDia,
                unit: "mm",
                min: 0.2,
                defaultStep: 5,
                stepOptions: [0.5, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-red-500">Ø</span>
              <span className="text-xs font-medium text-slate-300">
                {isIso ? `Diâmetro (${planeLabel ?? "Isométrico"})` : "Diâmetro Maior"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
              <span>{realDia.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-red-500" />
            </div>
          </button>

          {/* Raio Real */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "radius",
                label: isIso ? `Raio R (${planeLabel ?? "ISO"})` : "Raio Maior R",
                symbol: "R",
                value: realR,
                unit: "mm",
                min: 0.1,
                defaultStep: 5,
                stepOptions: [0.5, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">R</span>
              <span className="text-xs font-medium text-slate-300">Raio Real</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{realR.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>

          {/* Centro X e Y */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                setActiveNumericProp({
                  key: "cx",
                  label: "Centro X",
                  symbol: "X",
                  value: entity.cx,
                  unit: "mm",
                  defaultStep: 5,
                  allowNegative: true,
                })
              }
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-left hover:bg-slate-900 transition-colors"
            >
              <span className="font-mono text-[10px] text-slate-400">CX</span>
              <span className="font-mono text-xs font-semibold text-white">
                {entity.cx.toFixed(1)}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveNumericProp({
                  key: "cy",
                  label: "Centro Y",
                  symbol: "Y",
                  value: entity.cy,
                  unit: "mm",
                  defaultStep: 5,
                  allowNegative: true,
                })
              }
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-left hover:bg-slate-900 transition-colors"
            >
              <span className="font-mono text-[10px] text-slate-400">CY</span>
              <span className="font-mono text-xs font-semibold text-white">
                {entity.cy.toFixed(1)}
              </span>
            </button>
          </div>
        </div>
      );
    }

    // 5. LINHA (COMPRIMENTO, ÂNGULO, X1, Y1, X2, Y2)
    if (entity.type === "line") {
      const len = Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1);
      const ang = deg(Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1));

      return (
        <div className="flex flex-col gap-1.5 py-1">
          {/* Comprimento */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "length",
                label: "Comprimento",
                symbol: "↔",
                value: len,
                unit: "mm",
                min: 0.1,
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-red-500/50 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Comprimento</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
              <span>{len.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-red-500" />
            </div>
          </button>

          {/* Ângulo */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "angle",
                label: "Ângulo da Linha",
                symbol: "∠",
                value: ang,
                unit: "°",
                defaultStep: 5,
                stepOptions: [1, 5, 15, 45],
                allowNegative: true,
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Ângulo</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{ang.toFixed(1)}°</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>

          {/* Coordenadas X1 e Y1 */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                setActiveNumericProp({
                  key: "x1",
                  label: "Início X (X1)",
                  symbol: "X1",
                  value: entity.x1,
                  unit: "mm",
                  defaultStep: 5,
                  allowNegative: true,
                })
              }
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-left hover:bg-slate-900 transition-colors"
            >
              <span className="font-mono text-[10px] text-slate-400">X1</span>
              <span className="font-mono text-xs font-semibold text-white">{entity.x1.toFixed(1)}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveNumericProp({
                  key: "y1",
                  label: "Início Y (Y1)",
                  symbol: "Y1",
                  value: entity.y1,
                  unit: "mm",
                  defaultStep: 5,
                  allowNegative: true,
                })
              }
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-left hover:bg-slate-900 transition-colors"
            >
              <span className="font-mono text-[10px] text-slate-400">Y1</span>
              <span className="font-mono text-xs font-semibold text-white">{entity.y1.toFixed(1)}</span>
            </button>
          </div>
        </div>
      );
    }

    // 6. CHAPA / RETÂNGULO OU POLILINHA (COMPRIMENTO, LARGURA, POS X, POS Y)
    if (entity.type === "polyline" && entity.pts.length > 0) {
      const xs = entity.pts.map((p) => p.x);
      const ys = entity.pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const w = Math.max(...xs) - minX;
      const h = Math.max(...ys) - minY;

      return (
        <div className="flex flex-col gap-1.5 py-1">
          {/* Comprimento / Largura X */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "width",
                label: isRect ? "Comprimento" : "Largura (X)",
                symbol: "↔",
                value: w,
                unit: "mm",
                min: 0.5,
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-red-500/50 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">
              {isRect ? "Comprimento" : "Largura"}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
              <span>{w.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-red-500" />
            </div>
          </button>

          {/* Largura / Altura Y */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "height",
                label: isRect ? "Largura" : "Altura (Y)",
                symbol: "↕",
                value: h,
                unit: "mm",
                min: 0.5,
                defaultStep: 5,
                stepOptions: [0.1, 1, 5, 10],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-red-500/50 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">
              {isRect ? "Largura" : "Altura"}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
              <span>{h.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-red-500" />
            </div>
          </button>

          {/* Espessura da chapa */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "thickness",
                label: "Espessura",
                symbol: "e",
                value: thickness,
                unit: "mm",
                min: 0.5,
                defaultStep: 0.5,
                stepOptions: [0.1, 0.5, 1, 2],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Espessura</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <span>{thickness.toFixed(2)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>
        </div>
      );
    }

    // 7. TEXTO (CONTEÚDO TEXTUAL COM TECLADO NATIVO + MEDIDAS)
    if (entity.type === "text") {
      return (
        <div className="flex flex-col gap-2 py-1">
          {/* Conteúdo do texto com teclado nativo */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-sans font-medium text-slate-400">
              Texto
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 focus-within:border-red-500">
              <input
                type="text"
                value={entity.text}
                onChange={(e) => onUpdateEntity?.({ ...entity, text: e.target.value })}
                className="w-full bg-transparent font-sans text-xs text-white outline-none"
              />
              {entity.text && (
                <button
                  type="button"
                  onClick={() => onUpdateEntity?.({ ...entity, text: "" })}
                  className="rounded p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Altura da Fonte */}
          <button
            type="button"
            onClick={() =>
              setActiveNumericProp({
                key: "size",
                label: "Altura do Texto",
                symbol: "H",
                value: entity.size,
                unit: "mm",
                min: 1,
                defaultStep: 1,
                stepOptions: [0.5, 1, 2, 5],
              })
            }
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-700 hover:bg-slate-900 transition-colors"
          >
            <span className="font-sans text-xs text-slate-300">Altura da fonte</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white">
              <span>{entity.size.toFixed(1)} mm</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      role="region"
      aria-label={`Editor contextual ${entityTitle}`}
      className={cn(
        "relative z-40 flex w-[275px] sm:w-[295px] flex-col rounded-2xl border border-slate-700/80 bg-slate-950/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md select-none",
        "animate-in fade-in zoom-in-95 duration-150",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ---------------------------------------------------- */}
      {/* CABEÇALHO DO EDITOR CONTEXTUAL (PAINEL 1)            */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-red-600/15 text-red-500 border border-red-500/25">
            <EntityIcon className="size-3.5" />
          </div>
          <div>
            <h3 className="font-sans text-xs font-bold text-white leading-tight">
              {entityTitle}
            </h3>
            {entity && (
              <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                {entity.layer}
              </span>
            )}
          </div>
        </div>

        {/* Botão Fechar / Desmarcar */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            onClose();
          }}
          aria-label="Fechar editor"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CORPO DE PROPRIEDADES ESPECÍFICAS DA ENTIDADE        */}
      {/* ---------------------------------------------------- */}
      <div className="my-2">{renderContextualRows()}</div>

      {/* ---------------------------------------------------- */}
      {/* RODAPÉ DE AÇÕES RÁPIDAS (EXCLUIR, DUPLICAR, CAMADA) */}
      {/* ---------------------------------------------------- */}
      {entity && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80 mt-1">
          {/* Seletor Rápido de Camadas Independentes de Fabricação */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              {[
                { id: "corte", label: "Corte", color: "#FFFFFF" },
                { id: "dobra", label: "Dobra", color: "#EC4899" },
                { id: "recorte", label: "Recorte", color: "#F59E0B" },
                { id: "marcacao", label: "Marcação", color: "#3B82F6" },
              ].map((cl) => {
                const isAct = entity.layer === cl.id;
                return (
                  <button
                    key={cl.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("selection");
                      onUpdateEntity?.({ ...entity, layer: cl.id });
                    }}
                    title={`Definir camada como ${cl.label}`}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9px] font-semibold border transition-all cursor-pointer",
                      isAct
                        ? "border-slate-400 bg-slate-800 text-white shadow-xs ring-1 ring-slate-400"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                    )}
                  >
                    <span
                      className="size-2 rounded-full shrink-0 border border-slate-600/60"
                      style={{ backgroundColor: cl.color }}
                    />
                    <span>{cl.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Ações Rápidas: Duplicar e Excluir */}
            <div className="flex items-center gap-1">
            {onDuplicateEntity && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  onDuplicateEntity(entity);
                }}
                title="Duplicar entidade"
                aria-label="Duplicar entidade"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Copy className="size-3.5" />
              </button>
            )}
            {onDeleteEntity && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("warning");
                  onDeleteEntity(entity.id);
                }}
                title="Excluir entidade"
                aria-label="Excluir entidade"
                className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
