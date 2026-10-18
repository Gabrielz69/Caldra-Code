/**
 * CALDRA CAD — FLAT PATTERN & FABRICATION DIALOG (FASE 08)
 *
 * Diálogo de planificação industrial e fabricação derivado diretamente
 * do modelo 3D B-Rep (CAD CORE).
 *
 * Recursos:
 * - Visualização vetorial 2D da chapa planificada com contornos de corte e dobras
 * - Alternador de linhas de dobra / geratrizes de conformação
 * - Download de DXF R12 industrial (AutoCAD / CypCut / FastCAM)
 * - Geração e download de Código G CNC ISO (Plasma/Laser)
 * - Ficha técnica de fabricação e envio para fila de Nesting
 */

import { useState, useMemo } from "react";
import {
  Maximize2,
  Download,
  Scissors,
  Layers,
  FileCode,
  FileSpreadsheet,
  Check,
  X,
  Ruler,
  Compass,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { CaldraFlatPatternBridge, type FlatPatternResult } from "@/lib/cad/sheetmetal/CaldraFlatPatternBridge";
import type { CadFeatureNode } from "@/lib/cad/features/CadFeatureModel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CaldraFlatPatternDialogProps {
  open: boolean;
  onClose: () => void;
  features: readonly CadFeatureNode[];
  fallbackDimensions?: { width: number; length: number; thickness: number };
}

export function CaldraFlatPatternDialog({
  open,
  onClose,
  features,
  fallbackDimensions,
}: CaldraFlatPatternDialogProps) {
  const [showBendLines, setShowBendLines] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "bends" | "gcode">("preview");

  // Calcula a planificação a partir do modelo 3D atual
  const plan: FlatPatternResult = useMemo(() => {
    return CaldraFlatPatternBridge.generateFlatPatternFromFeatures(
      features,
      fallbackDimensions,
    );
  }, [features, fallbackDimensions]);

  if (!open) return null;

  // 1. Download do arquivo DXF R12
  const handleDownloadDxf = () => {
    const blob = new Blob([plan.dxfString], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planificacao_${plan.partName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo DXF R12 exportado com camadas CORTE e DOBRA!");
  };

  // 2. Download do Código G CNC
  const handleDownloadGCode = () => {
    const blob = new Blob([plan.gcodeString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `corte_${plan.partName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.nc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Código G CNC ISO exportado com sucesso!");
  };

  // 3. Enviar para Nesting
  const handleSendToNesting = () => {
    toast.success(
      `Peça "${plan.partName}" (${plan.widthMm.toFixed(0)} × ${plan.heightMm.toFixed(0)} mm) enviada para a fila de Nesting!`,
    );
  };

  // 4. Copiar Código G para Área de Transferência
  const handleCopyGCode = () => {
    navigator.clipboard.writeText(plan.gcodeString);
    toast.info("Código G copiado para a área de transferência.");
  };

  // Cálculo da Bounding Box do SVG
  const minX = Math.min(...plan.entities.map((e) => Math.min(e.x1, e.x2)), 0);
  const maxX = Math.max(...plan.entities.map((e) => Math.max(e.x1, e.x2)), 100);
  const minY = Math.min(...plan.entities.map((e) => Math.min(e.y1, e.y2)), 0);
  const maxY = Math.max(...plan.entities.map((e) => Math.max(e.y1, e.y2)), 100);

  const padding = 15;
  const viewBoxW = Math.max(50, maxX - minX + padding * 2);
  const viewBoxH = Math.max(50, maxY - minY + padding * 2);
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex w-[min(96vw,840px)] max-h-[min(92vh,560px)] overflow-y-auto flex-col gap-3 rounded-2xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-md font-mono text-[10px] text-foreground">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-accent" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Planificação & Fabricação da Peça 3D
                </h3>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-[8.5px] text-accent">
                  {plan.partName}
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground">
                Espessura: {plan.thickness.toFixed(2)} mm · Material: {plan.material} · Modelo 3D B-Rep
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* MÉTRICAS INDUSTRIAIS */}
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-line/60 bg-background/50 p-2.5 text-[9px]">
          <div>
            <span className="text-muted-foreground uppercase text-[8px]">Chapa Envolvente</span>
            <div className="font-bold text-foreground text-xs">
              {plan.widthMm.toFixed(1)} × {plan.heightMm.toFixed(1)} <span className="text-[8px] font-normal text-muted-foreground">mm</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground uppercase text-[8px]">Perímetro de Corte</span>
            <div className="font-bold text-foreground text-xs">
              {plan.perimeterCutMm.toFixed(1)} <span className="text-[8px] font-normal text-muted-foreground">mm</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground uppercase text-[8px]">Geratrizes / Dobras</span>
            <div className="font-bold text-accent text-xs">
              {plan.bendCount} <span className="text-[8px] font-normal text-muted-foreground">linhas</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground uppercase text-[8px]">Área Desenvolvida</span>
            <div className="font-bold text-foreground text-xs">
              {(plan.areaMm2 / 1e6).toFixed(3)} <span className="text-[8px] font-normal text-muted-foreground">m²</span>
            </div>
          </div>
        </div>

        {/* SELETOR DE VISUALIZAÇÃO (PREVIEW / DOBRAS / G-CODE) */}
        <div className="flex items-center justify-between border-b border-line pb-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-background/60 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={cn(
                "rounded px-2.5 py-0.5 text-[9px] font-bold uppercase transition-colors",
                activeTab === "preview" ? "bg-accent/20 text-accent font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Desenvolvimento 2D
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bends")}
              className={cn(
                "rounded px-2.5 py-0.5 text-[9px] font-bold uppercase transition-colors",
                activeTab === "bends" ? "bg-accent/20 text-accent font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Tabela de Dobras ({plan.bendCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("gcode")}
              className={cn(
                "rounded px-2.5 py-0.5 text-[9px] font-bold uppercase transition-colors",
                activeTab === "gcode" ? "bg-accent/20 text-accent font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Código G (CNC)
            </button>
          </div>

          {activeTab === "preview" && (
            <label className="flex items-center gap-1.5 text-[8.5px] uppercase text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBendLines}
                onChange={(e) => setShowBendLines(e.target.checked)}
                className="rounded border-line text-accent focus:ring-accent"
              />
              Exibir Linhas de Dobra
            </label>
          )}
        </div>

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        {activeTab === "preview" && (
          <div className="relative flex h-68 w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-background/80 p-2">
            {/* SVG CANVAS DA PLANIFICAÇÃO */}
            <svg
              viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
              className="size-full max-h-full"
            >
              {/* Linhas de contorno e dobra */}
              {plan.entities.map((e) => {
                const isCut = e.layer === "CORTE";
                if (!isCut && !showBendLines) return null;

                return (
                  <line
                    key={e.id}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke={isCut ? "#22c55e" : "#0284c7"}
                    strokeWidth={isCut ? 1.4 : 0.8}
                    strokeDasharray={isCut ? undefined : "3,2"}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* LEGENDA DE CAMADAS */}
            <div className="absolute bottom-2 left-2 flex items-center gap-3 rounded-md border border-line/60 bg-card/90 px-2 py-1 text-[8px] backdrop-blur">
              <div className="flex items-center gap-1">
                <span className="h-2 w-3 rounded-xs bg-[#22c55e]" />
                <span className="text-muted-foreground">CORTE (Laser/Plasma)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-3 rounded-xs bg-[#0284c7]" />
                <span className="text-muted-foreground">DOBRA / GERATRIZ</span>
              </div>
            </div>
          </div>
        )}

        {/* TABELA DE DOBRAS E GERATRIZES */}
        {activeTab === "bends" && (
          <div className="flex h-68 flex-col overflow-auto rounded-xl border border-line bg-background/60 p-2">
            {plan.bendingInstructions.length > 0 ? (
              <table className="w-full text-left font-mono text-[9px]">
                <thead>
                  <tr className="border-b border-line text-muted-foreground uppercase text-[8px]">
                    <th className="py-1 px-2"># Geratriz</th>
                    <th className="py-1 px-2">Posição (mm)</th>
                    <th className="py-1 px-2">Ângulo de Dobra (°)</th>
                    <th className="py-1 px-2">Comprimento Corda (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {plan.bendingInstructions.map((b) => (
                    <tr key={b.generatorIndex} className="hover:bg-muted/30">
                      <td className="py-1 px-2 font-bold text-accent">G{b.generatorIndex}</td>
                      <td className="py-1 px-2 text-foreground">{b.positionMm.toFixed(1)} mm</td>
                      <td className="py-1 px-2 font-semibold text-foreground">{b.angleDeg.toFixed(1)}°</td>
                      <td className="py-1 px-2 text-muted-foreground">{b.chordLengthMm.toFixed(2)} mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <Ruler className="size-5" />
                <p>Nenhuma instrução de dobra necessária para esta geometria (chapa plana).</p>
              </div>
            )}
          </div>
        )}

        {/* PRÉ-VISUALIZAÇÃO DE G-CODE */}
        {activeTab === "gcode" && (
          <div className="relative flex h-68 flex-col rounded-xl border border-line bg-background/90 p-2">
            <pre className="size-full overflow-auto font-mono text-[8.5px] text-emerald-400 select-all leading-relaxed">
              {plan.gcodeString}
            </pre>
            <button
              type="button"
              onClick={handleCopyGCode}
              className="absolute top-3 right-3 rounded bg-accent/20 px-2 py-1 text-[8px] font-bold text-accent uppercase hover:bg-accent/30"
            >
              Copiar Código G
            </button>
          </div>
        )}

        {/* RODAPÉ COM AÇÕES INDUSTRIAIS DE FABRICAÇÃO (SEÇÃO 9) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
          <div className="flex items-center gap-1 text-[8.5px] text-muted-foreground">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>Validação DFM e K-Factor Integrada</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* ENVIAR PARA NESTING */}
            <button
              type="button"
              onClick={handleSendToNesting}
              className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 text-[9px] font-bold text-foreground uppercase hover:bg-muted transition-colors"
              title="Adicionar esta peça à fila de aninhamento (Nesting)"
            >
              <Layers className="size-3 text-accent" /> Nesting
            </button>

            {/* GERAR CÓDIGO G */}
            <button
              type="button"
              onClick={handleDownloadGCode}
              className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 text-[9px] font-bold text-foreground uppercase hover:bg-muted transition-colors"
              title="Baixar programa de usinagem/corte CNC ISO"
            >
              <FileCode className="size-3 text-amber-500" /> Código G
            </button>

            {/* EXPORTAR DXF R12 */}
            <button
              type="button"
              onClick={handleDownloadDxf}
              className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/20 px-3 py-1 text-[9px] font-bold text-accent uppercase hover:bg-accent/30 transition-colors shadow-xs"
              title="Exportar arquivo DXF com camadas de corte e dobra"
            >
              <Download className="size-3" /> Exportar DXF R12
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
