/**
 * CALDRA CHAMFER — MODAL DE PRESETS PARAMÉTRICOS COM VISUALIZADOR 2D INTERATIVO (ETAPA 33)
 *
 * Suporte a todos os modelos de caldeiraria e mecânica:
 *  - Flange Circular DIN/ANSI
 *  - Sapata / Placa Base Retangular
 *  - Tubo Estrutural Metalon
 *  - Chapa com Grade de Rasgos Oblongos
 *  - Gomo de Curva / Cotovelo Planificado
 *  - Transição Quadrado para Redondo Planificada
 *  - Boca de Lobo / Derivação Planificada
 *  - Redução Cônica / Cone Truncado
 *
 * Inclui JANELA DE VISUALIZAÇÃO DA VISTA 2D em tempo real:
 *  - Atualização instantânea com qualquer alteração de parâmetro;
 *  - Controles de Zoom (+/-), Ajuste Automático (Fit) e Reset;
 *  - Cores técnicas normalizadas de caldeiraria (Corte, Dobra, Recorte, Marcação, Construção);
 *  - Medidas cotadas de envoltória (Bounding Box W x H mm) e contagem de entidades.
 */

import React, { useMemo, useState } from "react";
import {
  Boxes,
  Check,
  Disc,
  Eye,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Sliders,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Vec2 } from "@/lib/geometry/types";
import { bbox, type Entity } from "@/lib/lab2d/core";
import {
  CAD_PRESETS_CATALOG,
  type PresetDefinition,
} from "@/lib/lab2d/cadPresetsCatalog";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

interface ChamferPresetsModalProps {
  open: boolean;
  onClose: () => void;
  insertPosition?: Vec2;
  onInsertEntities: (entities: Entity[]) => void;
  isDark?: boolean;
}

export function ChamferPresetsModal({
  open,
  onClose,
  insertPosition = { x: 0, y: 0 },
  onInsertEntities,
  isDark = true,
}: ChamferPresetsModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetDefinition>(
    CAD_PRESETS_CATALOG[0]!,
  );
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    CAD_PRESETS_CATALOG[0]?.params.forEach((p) => {
      init[p.id] = p.defaultValue;
    });
    return init;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [showPreviewModal, setShowPreviewModal] = useState(true);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Vec2>({ x: 0, y: 0 });

  // Gera as entidades em tempo real para a pré-visualização 2D
  const generatedEntities = useMemo<Entity[]>(() => {
    try {
      return selectedPreset.generate(paramValues, { x: 0, y: 0 });
    } catch {
      return [];
    }
  }, [selectedPreset, paramValues]);

  // Calcula a envoltória (bounding box) da geometria gerada
  const bounds = useMemo(() => {
    if (generatedEntities.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100, w: 100, h: 100 };
    const b = bbox(generatedEntities);
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    return { ...b, w, h };
  }, [generatedEntities]);

  const handleSelectPreset = (preset: PresetDefinition) => {
    setSelectedPreset(preset);
    const newVals: Record<string, number> = {};
    preset.params.forEach((p) => {
      newVals[p.id] = p.defaultValue;
    });
    setParamValues(newVals);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    triggerHaptic("selection");
    AudioManager.play("ui_select");
  };

  const handleParamChange = (id: string, val: number) => {
    setParamValues((prev) => ({ ...prev, [id]: val }));
  };

  const handleInsert = () => {
    triggerHaptic("success");
    AudioManager.play("cad_core_init");
    const finalEntities = selectedPreset.generate(paramValues, insertPosition);
    onInsertEntities(finalEntities);
    onClose();
  };

  const filteredPresets = useMemo(() => {
    return CAD_PRESETS_CATALOG.filter((p) => {
      const matchCat = activeCategory === "todos" || p.category === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchQuery]);

  // Renderiza entidade SVG técnica
  const renderSvgEntity = (e: Entity) => {
    let strokeColor = "#22c55e"; // Corte = verde
    let strokeDash: string | undefined = undefined;
    let strokeWidth = 1.6;

    if (e.layer === "dobra") {
      strokeColor = "#06b6d4"; // Dobra = ciano
      strokeDash = "4 2";
      strokeWidth = 1.4;
    } else if (e.layer === "recorte") {
      strokeColor = "#ec4899"; // Recorte = rosa/magenta
      strokeWidth = 1.4;
    } else if (e.layer === "construcao" || e.layer === "centro") {
      strokeColor = "#eab308"; // Construção = amarelo
      strokeDash = "6 3 2 3";
      strokeWidth = 1.0;
    } else if (e.layer === "marcacao") {
      strokeColor = "#a855f7"; // Marcação = roxo
      strokeWidth = 1.2;
    }

    if (e.type === "line") {
      return (
        <line
          key={e.id}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    }
    if (e.type === "circle") {
      return (
        <circle
          key={e.id}
          cx={e.cx}
          cy={e.cy}
          r={e.r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    }
    if (e.type === "polyline") {
      const ptsStr = e.pts.map((p) => `${p.x},${p.y}`).join(" ");
      return (
        <polygon
          key={e.id}
          points={ptsStr}
          fill={e.closed ? (isDark ? "rgba(34, 197, 94, 0.04)" : "rgba(34, 197, 94, 0.08)") : "none"}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    }
    if (e.type === "arc") {
      const p0 = { x: e.cx + e.r * Math.cos(e.a0), y: e.cy + e.r * Math.sin(e.a0) };
      const p1 = { x: e.cx + e.r * Math.cos(e.a1), y: e.cy + e.r * Math.sin(e.a1) };
      let sweep = e.a1 - e.a0;
      while (sweep < 0) sweep += Math.PI * 2;
      const large = sweep > Math.PI ? 1 : 0;
      const d = `M ${p0.x} ${p0.y} A ${e.r} ${e.r} 0 ${large} 1 ${p1.x} ${p1.y}`;
      return (
        <path
          key={e.id}
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />
      );
    }
    return null;
  };

  // Coordenadas viewBox do SVG com margem e pan/zoom
  const marginRatio = 0.15;
  const marginW = bounds.w * marginRatio;
  const marginH = bounds.h * marginRatio;
  const vbX = bounds.minX - marginW + panOffset.x;
  const vbY = bounds.minY - marginH + panOffset.y;
  const vbW = (bounds.w + marginW * 2) / zoomScale;
  const vbH = (bounds.h + marginH * 2) / zoomScale;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card/95 border-border/80 backdrop-blur-2xl shadow-2xl rounded-2xl">
        {/* Cabeçalho */}
        <DialogHeader className="p-4 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-accent">
              <Boxes className="w-5 h-5" />
              <div>
                <DialogTitle className="text-base font-bold tracking-tight">
                  Catálogo de Presets Paramétricos CALDRA
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Gere e customize componentes industriais de caldeiraria e mecânica com visualização 2D em tempo real.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewModal((v) => !v)}
              className="text-xs flex items-center gap-1.5 h-8 border-border/60"
            >
              <Eye className="w-3.5 h-3.5 text-accent" />
              <span>{showPreviewModal ? "Ocultar Vista 2D" : "Exibir Vista 2D"}</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo principal: 3 Colunas ou Split com Vista 2D */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-[420px]">
          {/* Coluna 1: Lista e Filtros de Presets (md:col-span-4) */}
          <div className="md:col-span-4 border-r border-border/40 flex flex-col bg-muted/20 overflow-hidden">
            <div className="p-2.5 border-b border-border/30 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar preset..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/60 rounded-xl outline-none focus:border-accent"
                />
              </div>

              {/* Categorias */}
              <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5 scrollbar-none">
                {["todos", "caldeiraria", "mecanica", "estrutural", "chapas"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-0.5 rounded-lg capitalize whitespace-nowrap transition-colors ${
                      activeCategory === cat
                        ? "bg-accent/20 text-accent font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredPresets.map((p) => {
                const isSel = p.id === selectedPreset.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all ${
                      isSel
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] opacity-75 capitalize font-normal mt-0.5 truncate">
                      {p.category} — {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Formulário de Parâmetros (md:col-span-4 ou 8 dependendo da vista) */}
          <div
            className={`${
              showPreviewModal ? "md:col-span-4" : "md:col-span-8"
            } border-r border-border/40 flex flex-col bg-background/50 overflow-hidden`}
          >
            <div className="p-3 border-b border-border/30 bg-muted/10">
              <div className="flex items-center gap-1.5 text-accent text-xs font-bold uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5" />
                <span>Parâmetros Geométricos</span>
              </div>
              <h4 className="text-sm font-bold text-foreground mt-1">
                {selectedPreset.name}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {selectedPreset.description}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {selectedPreset.params.map((par) => {
                const curVal = paramValues[par.id] ?? par.defaultValue;
                return (
                  <div key={par.id} className="space-y-1 bg-muted/20 p-2 rounded-xl border border-border/30">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-foreground font-medium truncate flex-1">
                        {par.label}
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          step={par.unit === "un" ? 1 : 0.5}
                          min={par.min}
                          max={par.max}
                          value={curVal}
                          onChange={(e) =>
                            handleParamChange(par.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 text-right font-mono text-xs bg-background border border-border rounded-lg outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-muted-foreground font-mono w-5">
                          {par.unit}
                        </span>
                      </div>
                    </div>

                    {/* Slider de ajuste fluido */}
                    <input
                      type="range"
                      min={par.min}
                      max={par.max}
                      step={par.unit === "un" ? 1 : 0.5}
                      value={curVal}
                      onChange={(e) =>
                        handleParamChange(par.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-full accent-accent h-1.5 bg-muted rounded-lg cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna 3: JANELA DE VISUALIZAÇÃO DA VISTA 2D (md:col-span-4) */}
          {showPreviewModal && (
            <div className="md:col-span-4 flex flex-col bg-muted/10 overflow-hidden relative select-none">
              {/* Barra de controle da vista 2D */}
              <div className="p-2 border-b border-border/30 flex items-center justify-between bg-card/60">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                  <Eye className="w-3.5 h-3.5 text-accent" />
                  <span>Vista 2D (Pré-visualização)</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomScale((s) => Math.min(4, s * 1.25))}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomScale((s) => Math.max(0.25, s / 1.25))}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setZoomScale(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Ajustar ao Centro (Fit)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Viewport SVG Interativo */}
              <div className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-background/80">
                <svg
                  viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                  className="w-full h-full max-h-[340px]"
                  style={{ transform: "scaleY(-1)" }} // Orientação CAD (Y para cima)
                >
                  {/* Grade de fundo suave */}
                  <defs>
                    <pattern id="preset-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}
                        strokeWidth="0.8"
                      />
                    </pattern>
                  </defs>
                  <rect
                    x={vbX}
                    y={vbY}
                    width={vbW}
                    height={vbH}
                    fill="url(#preset-grid)"
                  />

                  {/* Eixos de referência X/Y */}
                  <line
                    x1={vbX}
                    y1={0}
                    x2={vbX + vbW}
                    y2={0}
                    stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={0}
                    y1={vbY}
                    x2={0}
                    y2={vbY + vbH}
                    stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />

                  {/* Geometria real calculada do preset */}
                  {generatedEntities.map(renderSvgEntity)}
                </svg>

                {/* Badge de dimensões técnicas da envoltória */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono px-2 py-1 rounded-lg bg-card/90 border border-border/60 text-muted-foreground shadow-sm">
                  <span>Envoltória: {bounds.w.toFixed(1)} × {bounds.h.toFixed(1)} mm</span>
                  <span className="text-accent font-semibold">{generatedEntities.length} entidades</span>
                </div>
              </div>

              {/* Legenda de camadas */}
              <div className="p-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Corte
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Dobra
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" /> Recorte
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Centro
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <DialogFooter className="p-3 border-t border-border/50 flex items-center justify-between shrink-0 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
              Inserir em: ({insertPosition.x.toFixed(0)}, {insertPosition.y.toFixed(0)})
            </span>
            <Button
              size="sm"
              onClick={handleInsert}
              className="brand-gradient text-background font-semibold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Inserir no Projeto CAD</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
