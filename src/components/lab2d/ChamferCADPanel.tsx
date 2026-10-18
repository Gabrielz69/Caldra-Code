// @ts-nocheck
/**
 * CALDRA CAD — CHAMFER CAD PANEL (FASE 08)
 *
 * Painel lateral interativo da Árvore de Recursos Paramétrica e Controle de Estados CAD:
 * 3D Dobrado ↔ 2D Planificado ↔ Percurso CNC / G-Code
 */

import { useState } from "react";
import {
  Layers,
  Box,
  FileCode2,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileText,
  Columns,
  Download,
  LayoutGrid,
  Hammer,
  ShieldCheck,
  Target,
  CheckCheck,
  X,
  Gauge,
  Scale,
  Coins,
  AlertCircle,
  Info,
  Activity,
} from "lucide-react";
import type { PartDocument, CADViewState } from "@/lib/cad/kernel/types";
import { ChamferKernel } from "@/lib/cad/kernel/chamferKernel";
import { DrawingExporter } from "@/lib/cad/drafting/drawingExporter";
import { NestingDxfExporter } from "@/lib/cad/nesting/nestingDxfExporter";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

interface ChamferCADPanelProps {
  open: boolean;
  onClose: () => void;
  document: PartDocument;
  onDocumentChange: (updated: PartDocument) => void;
}

export function ChamferCADPanel({
  open,
  onClose,
  document: doc,
  onDocumentChange,
}: ChamferCADPanelProps) {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<"features" | "analysis">("features");

  if (!open) return null;

  const features = doc.featureTree.getFeatures();

  const handleToggleState = (newState: CADViewState) => {
    triggerHaptic("selection");
    if (newState === "2D_FLAT") {
      AudioManager.play("planify_sequence");
      const updated = ChamferKernel.unfold(doc);
      setActiveTab("features");
      onDocumentChange({ ...updated });
    } else if (newState === "3D_FOLDED") {
      AudioManager.play("cad_core_init");
      const updated = ChamferKernel.fold(doc);
      setActiveTab("features");
      onDocumentChange({ ...updated });
    } else {
      AudioManager.play("ui_select");
      if (newState === "CAM_TOOLPATH") {
        const updated = ChamferKernel.generateCAM(doc);
        setActiveTab("analysis");
        onDocumentChange({ ...updated });
      } else if (newState === "2D_DRAWING") {
        ChamferKernel.generateTechnicalDrawing(doc);
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      } else if (newState === "WELDMENTS") {
        if (!doc.structuralReport) {
          ChamferKernel.generateWeldmentCutList(doc);
        }
        doc.activeState = "WELDMENTS";
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      } else if (newState === "NESTING") {
        if (!doc.nestingJob) {
          ChamferKernel.generateNesting(doc);
        }
        doc.activeState = "NESTING";
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      } else if (newState === "FORMING") {
        if (!doc.pressBrakeSimulation) {
          ChamferKernel.simulatePressBrake(doc);
        }
        ChamferKernel.rebuildForming(doc);
        doc.activeState = "FORMING";
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      } else if (newState === "DFM") {
        ChamferKernel.auditDfm(doc);
        doc.activeState = "DFM";
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      } else if (newState === "METROLOGY") {
        if (!doc.metrologyReport) {
          ChamferKernel.generateMetrology(doc);
        }
        doc.activeState = "METROLOGY";
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      } else if (newState === "FEA") {
        if (!doc.feaReport) {
          ChamferKernel.runFeaSimulation(doc);
        }
        doc.activeState = "FEA";
        setActiveTab("analysis");
        onDocumentChange({ ...doc });
      }
    }
  };

  const handleRebuild = () => {
    triggerHaptic("action");
    setIsRebuilding(true);
    AudioManager.play("kernel_loading");
    setTimeout(() => {
      try {
        const { doc: updated } = ChamferKernel.rebuild(doc, {
          generateFlatPattern: doc.activeState === "2D_FLAT",
          generateCamToolpath: doc.activeState === "CAM_TOOLPATH",
        });
        if (doc.activeState === "2D_DRAWING") {
          ChamferKernel.generateTechnicalDrawing(updated);
        }
        onDocumentChange({ ...updated });
        AudioManager.play("kernel_success");
      } catch {
        AudioManager.play("kernel_error");
      } finally {
        setIsRebuilding(false);
      }
    }, 150);
  };

  const triggerExport = (action: () => void) => {
    AudioManager.play("export_start");
    try {
      action();
      AudioManager.play("export_success");
    } catch {
      AudioManager.play("export_error");
    }
  };

  const handleDownloadGCode = () => {
    triggerExport(() => {
      const updated = doc.gcode ? doc : ChamferKernel.generateCAM(doc);
      if (!updated.gcode) return;

      const blob = new Blob([updated.gcode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${doc.name.toLowerCase().replace(/\s+/g, "_")}.nc`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadDrawingSVG = () => {
    triggerExport(() => {
      const drawing = doc.technicalDrawing || ChamferKernel.generateTechnicalDrawing(doc);
      const svg = DrawingExporter.exportToSVG(drawing);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `prancha_${doc.name.toLowerCase().replace(/\s+/g, "_")}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadDrawingDXF = () => {
    triggerExport(() => {
      const drawing = doc.technicalDrawing || ChamferKernel.generateTechnicalDrawing(doc);
      const dxf = DrawingExporter.exportToDXF(drawing);
      const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `prancha_${doc.name.toLowerCase().replace(/\s+/g, "_")}.dxf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadCutListCSV = () => {
    triggerExport(() => {
      const report = doc.structuralReport || ChamferKernel.generateWeldmentCutList(doc);
      let csv =
        "Item,Perfil,Material,Comprimento_mm,Qtd,Angulo1,Angulo2,Massa_Linear_kg_m,Massa_Total_kg\n";
      report.cutList.forEach((it) => {
        csv += `${it.itemNumber},"${it.profileDesignation}","${it.material}",${it.cutLengthMm},${it.quantity},${it.angle1Deg},${it.angle2Deg},${it.linearMassKgM},${it.totalMassKg}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `cutlist_${doc.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadNestingDXF = () => {
    triggerExport(() => {
      const job = doc.nestingJob || ChamferKernel.generateNesting(doc);
      if (!job.sheets.length) return;
      const dxf = ChamferKernel.exportNestingDxf(doc, 1);
      const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `nesting_chapa_${doc.name.toLowerCase().replace(/\s+/g, "_")}.dxf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadNestingCSV = () => {
    triggerExport(() => {
      const job = doc.nestingJob || ChamferKernel.generateNesting(doc);
      const csv = NestingDxfExporter.generateReportCsv(job);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `aproveitamento_chapa_${doc.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadPressBrakeCSV = () => {
    triggerExport(() => {
      const sim = doc.pressBrakeSimulation || ChamferKernel.simulatePressBrake(doc);
      let csv = "CALDRA CAD — RELATORIO DE CONFORMACAO E PRENSA DOBRADEIRA\n";
      csv += `Peca;${doc.name};Material;${sim.material};Espessura (mm);${sim.thicknessMm}\n`;
      csv += `Comprimento Dobra (mm);${sim.bendLengthMm};Angulo Desejado;${sim.targetAngleDeg} graus\n`;
      csv += `Canal V Utilizado (mm);${sim.dieOpeningVMm};V Recomendado;${sim.recommendedDieOpeningVMm} mm\n`;
      csv += `Raio Puncao (mm);${sim.punchRadiusMm};Raio Interno Natural;${sim.naturalInsideRadiusMm} mm\n`;
      csv += `Forca por Metro (ton/m);${sim.tonnagePerMeterTonM};Tonelagem Total (ton);${sim.totalTonnageTon}\n`;
      csv += `Retorno Elastico / Springback;${sim.springbackAngleDeg} graus;Angulo Penetracao / Sobredobra;${sim.overbendAngleDeg} graus\n`;
      csv += `Aba Minima Recomendada (mm);${sim.minFlangeLengthMm}\n\n`;

      csv += "RECURSOS DE CONFORMACAO / FERRAMENTAL\n";
      csv += "TIPO;NOME;CODIGO FERRAMENTAL;DESCRICAO\n";
      if (doc.formingResult && doc.formingResult.formingToolCount > 0) {
        [
          ...doc.formingResult.gussetAnnotations,
          ...doc.formingResult.louverAnnotations,
          ...doc.formingResult.embossAnnotations,
        ].forEach((ann) => {
          csv += `${ann.toolType};"${ann.name}";"${ann.toolingCode}";"${ann.notes}"\n`;
        });
      } else {
        csv += "PADRAO;Dobra Convencional em Prensa;V-DIE_STANDARD;Dobra a ar com matriz V\n";
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `simulacao_dobra_${doc.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadDfmCSV = () => {
    triggerExport(() => {
      const csv = ChamferKernel.exportDfmReportCsv(doc);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `dfm_custos_${doc.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadDfmDXF = () => {
    triggerExport(() => {
      const dxf = ChamferKernel.exportDfmDxf(doc);
      const blob = new Blob([dxf], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `dfm_auditoria_${doc.name.toLowerCase().replace(/\s+/g, "_")}.dxf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadMetrologyCSV = () => {
    triggerExport(() => {
      const csv = ChamferKernel.exportMetrologyCsv(doc);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `inspecao_fai_${doc.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadMetrologySVG = () => {
    triggerExport(() => {
      const svg = ChamferKernel.exportMetrologySvg(doc);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `prancha_baloneada_${doc.name.toLowerCase().replace(/\s+/g, "_")}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadFeaCSV = () => {
    triggerExport(() => {
      const csv = ChamferKernel.exportFeaCsv(doc);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `memorial_calculo_fea_${doc.name.toLowerCase().replace(/\s+/g, "_")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadFeaSVG = () => {
    triggerExport(() => {
      const svg = ChamferKernel.exportFeaHeatmapSvg(doc);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `mapa_tensoes_fea_${doc.name.toLowerCase().replace(/\s+/g, "_")}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 bottom-0 z-[85] flex w-80 flex-col border-l border-line bg-background/95 backdrop-blur-md shadow-2xl transition-transform duration-260 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
        open ? "translate-x-0" : "translate-x-full",
      )}
      aria-label="Painel CAD Kernel"
    >
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-accent" />
          <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-foreground">
            Árvore CAD · Chamfer
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("tap");
            onClose();
          }}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all touch-manipulation cursor-pointer"
          aria-label="Fechar painel CAD"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* SELETOR DE MODO DE VISUALIZAÇÃO (10 ESTADOS CAD) */}
      <div className="grid grid-cols-5 gap-1 border-b border-line bg-muted/20 p-1.5">
        <button
          type="button"
          onClick={() => handleToggleState("3D_FOLDED")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "3D_FOLDED"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Box className="mb-1 size-3.5" />
          3D
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("2D_FLAT")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "2D_FLAT"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Layers className="mb-1 size-3.5" />
          PLANO
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("CAM_TOOLPATH")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "CAM_TOOLPATH"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Flame className="mb-1 size-3.5" />
          CNC
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("2D_DRAWING")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "2D_DRAWING"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <FileText className="mb-1 size-3.5" />
          FOLHA
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("WELDMENTS")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "WELDMENTS"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Columns className="mb-1 size-3.5" />
          PERFIS
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("NESTING")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "NESTING"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <LayoutGrid className="mb-1 size-3.5" />
          CHAPA
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("FORMING")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "FORMING"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Hammer className="mb-1 size-3.5" />
          ESTAMPO
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("DFM")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "DFM"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <ShieldCheck className="mb-1 size-3.5" />
          DFM
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("METROLOGY")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "METROLOGY"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Target className="mb-1 size-3.5" />
          QUALIDADE
        </button>
        <button
          type="button"
          onClick={() => handleToggleState("FEA")}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg p-1.5 font-mono text-[7px] tracking-wider touch-manipulation select-none cursor-pointer transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-95",
            doc.activeState === "FEA"
              ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-xs"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Activity className="mb-1 size-3.5" />
          FEA
        </button>
      </div>

      {/* METADADOS DA PEÇA */}
      <div className="grid grid-cols-2 gap-2 border-b border-line p-3 font-mono text-[11px]">
        <div className="rounded-lg border border-line bg-card/40 p-2">
          <span className="text-[9px] text-muted-foreground block uppercase">ESPESSURA (mm)</span>
          <input
            type="number"
            min={0.2}
            step={0.1}
            value={doc.thickness}
            onChange={(e) => {
              const val = Math.max(0.2, Number(e.target.value) || 0.2);
              doc.thickness = val;
              doc.innerRadius = val;
              onDocumentChange({ ...doc });
            }}
            className="w-full bg-transparent font-semibold text-foreground outline-none text-xs"
          />
        </div>
        <div className="rounded-lg border border-line bg-card/40 p-2">
          <span className="text-[9px] text-muted-foreground block uppercase">FATOR K</span>
          <input
            type="number"
            min={0.1}
            max={0.6}
            step={0.01}
            value={doc.kFactor}
            onChange={(e) => {
              doc.kFactor = Number(e.target.value) || 0.44;
              onDocumentChange({ ...doc });
            }}
            className="w-full bg-transparent font-semibold text-foreground outline-none text-xs"
          />
        </div>
      </div>

      {/* AÇÕES PARAMÉTRICAS: BASE FLANGE, DOBRA, CALDEIRARIA */}
      <div className="border-b border-line p-2.5 bg-muted/10 space-y-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">
          Adicionar Operação
        </span>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => {
              const updated = ChamferKernel.addBaseFlange(
                doc,
                doc.baseWidth ?? 120,
                doc.baseLength ?? 100,
              );
              onDocumentChange({ ...updated });
            }}
            className="flex items-center justify-center gap-1 rounded-md border border-line bg-card/60 px-2 py-1.5 font-mono text-[8.5px] hover:text-accent hover:border-accent/40 transition-colors uppercase tracking-wider"
          >
            + Base Flange
          </button>
          <button
            type="button"
            onClick={() => {
              const nextEdge =
                !doc.flanges || doc.flanges.length === 0
                  ? "right"
                  : doc.flanges.length === 1
                    ? "left"
                    : doc.flanges.length === 2
                      ? "top"
                      : "bottom";
              const updated = ChamferKernel.addFlange(doc, {
                edgeId: nextEdge,
                flangeLength: 50,
                angleDeg: 90,
                insideRadius: doc.thickness,
              });
              onDocumentChange({ ...updated });
            }}
            className="flex items-center justify-center gap-1 rounded-md border border-line bg-card/60 px-2 py-1.5 font-mono text-[8.5px] hover:text-accent hover:border-accent/40 transition-colors uppercase tracking-wider"
          >
            + Dobra 90°
          </button>
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              let updated: PartDocument | null = null;
              if (val === "cone") {
                updated = ChamferKernel.addBoilermakingFeature(doc, "cone", {
                  D: 200,
                  d: 100,
                  H: 250,
                  divisions: 32,
                });
              } else if (val === "square_to_round") {
                updated = ChamferKernel.addBoilermakingFeature(doc, "square_to_round", {
                  baseWidth: 200,
                  baseLength: 200,
                  topDiameter: 140,
                  height: 220,
                });
              } else if (val === "elbow") {
                updated = ChamferKernel.addBoilermakingFeature(doc, "elbow", {
                  diameter: 150,
                  bendRadius: 225,
                  totalAngleDeg: 90,
                  segmentsCount: 4,
                });
              } else if (val === "branch") {
                updated = ChamferKernel.addBoilermakingFeature(doc, "branch", {
                  mainDiameter: 200,
                  branchDiameter: 120,
                  angleDeg: 90,
                  branchHeight: 180,
                });
              }
              if (updated) onDocumentChange({ ...updated });
              e.target.value = "";
            }}
            className="rounded-md border border-line bg-card/60 px-1 py-1.5 font-mono text-[8.5px] text-muted-foreground hover:text-foreground outline-none uppercase tracking-wider"
            defaultValue=""
          >
            <option value="" disabled>
              + Caldeiraria
            </option>
            <option value="cone">Cone / Redução</option>
            <option value="square_to_round">Quadrado-Redondo</option>
            <option value="elbow">Curva Gomos</option>
            <option value="branch">Boca Lobo / Tê</option>
          </select>
        </div>
      </div>

      {/* SELETOR DE ABA INTERNA: RECURSOS VS PAINEL TÉCNICO */}
      <div className="flex border-b border-line bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("features");
          }}
          className={cn(
            "flex-1 py-1 font-mono text-[9px] uppercase tracking-wider rounded-md transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-[0.98] text-center touch-manipulation cursor-pointer",
            activeTab === "features"
              ? "bg-background text-accent font-semibold shadow-xs border border-line/60"
              : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
          )}
        >
          Recursos ({features.length})
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("analysis");
          }}
          className={cn(
            "flex-1 py-1 font-mono text-[9px] uppercase tracking-wider rounded-md transition-all duration-140 [transition-timing-function:var(--ease-natural)] active:scale-[0.98] text-center flex items-center justify-center gap-1 touch-manipulation cursor-pointer",
            activeTab === "analysis"
              ? "bg-background text-accent font-semibold shadow-xs border border-line/60"
              : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
          )}
        >
          <span>Painel: {doc.activeState.replace(/_/g, " ")}</span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "features" ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Recursos ({features.length})
              </span>
              <button
                type="button"
                onClick={handleRebuild}
                disabled={isRebuilding}
                className="flex items-center gap-1 rounded-md border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", isRebuilding && "animate-spin")} />
                Rebuild
              </button>
            </div>

            <ul className="space-y-1.5">
              {features.map((feat) => {
                const isSuppressed = feat.isSuppressed;
                return (
                  <li
                    key={feat.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-line/60 bg-card/30 p-2 transition-colors",
                      isSuppressed && "opacity-40 bg-muted/20",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {feat.state === "VALID" ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                      ) : feat.state === "STALE" ? (
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                      ) : (
                        <Box className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-mono text-xs text-foreground">
                        {feat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                        {feat.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          doc.featureTree.suppressFeature(feat.id, !isSuppressed);
                          onDocumentChange({ ...doc });
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title={isSuppressed ? "Ativar recurso" : "Suprimir recurso"}
                      >
                        {isSuppressed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          /* ABA DO PAINEL TÉCNICO CONFORME O ESTADO ATIVO */
          <div className="space-y-3 font-mono">
            {doc.activeState === "DFM" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Auditoria DFM & Custos
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      ChamferKernel.auditDfm(doc);
                      onDocumentChange({ ...doc });
                    }}
                    className="rounded border border-line px-1.5 py-0.5 text-[8.5px] uppercase tracking-wider hover:text-accent"
                  >
                    Reauditar
                  </button>
                </div>

                {doc.dfmReport ? (
                  <>
                    <div className="rounded-lg border border-line bg-card/50 p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase">
                          Índice DFM
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            doc.dfmReport.audit.summary.isApproved
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-red-500/15 text-red-500",
                          )}
                        >
                          {doc.dfmReport.audit.summary.isApproved ? "Aprovado" : "Não Conforme"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="rounded bg-muted/30 p-1">
                          <span className="text-[8px] text-muted-foreground block">SCORE</span>
                          <span className="text-xs font-bold text-accent">
                            {doc.dfmReport.audit.summary.score}/100
                          </span>
                        </div>
                        <div className="rounded bg-muted/30 p-1">
                          <span className="text-[8px] text-muted-foreground block">ERROS</span>
                          <span className="text-xs font-bold text-red-500">
                            {doc.dfmReport.audit.summary.errorCount}
                          </span>
                        </div>
                        <div className="rounded bg-muted/30 p-1">
                          <span className="text-[8px] text-muted-foreground block">AVISOS</span>
                          <span className="text-xs font-bold text-amber-500">
                            {doc.dfmReport.audit.summary.warningCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LISTA DE NÃO CONFORMIDADES DFM */}
                    {doc.dfmReport.audit.issues.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase font-semibold block">
                          Apontamentos Técnicos ({doc.dfmReport.audit.issues.length})
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                          {doc.dfmReport.audit.issues.map((issue) => (
                            <div
                              key={issue.id}
                              className={cn(
                                "rounded-lg border p-2 text-[9px] space-y-1",
                                issue.severity === "ERROR"
                                  ? "border-red-500/30 bg-red-500/5 text-red-400"
                                  : "border-amber-500/30 bg-amber-500/5 text-amber-400",
                              )}
                            >
                              <div className="flex items-center gap-1 font-bold">
                                {issue.severity === "ERROR" ? (
                                  <AlertCircle className="size-3 shrink-0 text-red-500" />
                                ) : (
                                  <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                                )}
                                <span className="truncate">{issue.title}</span>
                              </div>
                              <p className="text-[8.5px] text-muted-foreground leading-tight">
                                {issue.description}
                              </p>
                              <p className="text-[8px] text-foreground font-sans">
                                💡 <span className="font-semibold text-accent">Solução:</span>{" "}
                                {issue.suggestedFix}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ORÇAMENTO ANALÍTICO DE FABRICAÇÃO */}
                    <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-foreground uppercase">
                        <Coins className="size-3 text-accent" /> Orçamento & Tempo de Ciclo
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[9px]">
                        <div className="text-muted-foreground">Massa estimada:</div>
                        <div className="text-right font-bold text-foreground">
                          {doc.dfmReport.cost.partWeightKg.toFixed(2)} kg
                        </div>
                        <div className="text-muted-foreground">Custo matéria-prima:</div>
                        <div className="text-right text-foreground">
                          R$ {doc.dfmReport.cost.materialCost.toFixed(2)}
                        </div>
                        <div className="text-muted-foreground">Corte CNC térmico:</div>
                        <div className="text-right text-foreground">
                          R$ {doc.dfmReport.cost.cuttingCost.toFixed(2)}
                        </div>
                        <div className="text-muted-foreground">Dobra em prensa:</div>
                        <div className="text-right text-foreground">
                          R$ {doc.dfmReport.cost.bendingCost.toFixed(2)}
                        </div>
                        <div className="text-muted-foreground">Tempo de ciclo:</div>
                        <div className="text-right font-bold text-accent">
                          {doc.dfmReport.cost.totalCycleTimeMinutes.toFixed(1)} min
                        </div>
                        <div className="border-t border-line pt-1 font-bold text-foreground">
                          Preço sugerido:
                        </div>
                        <div className="border-t border-line pt-1 text-right font-bold text-emerald-500">
                          R$ {doc.dfmReport.cost.suggestedSellingPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Clique em Reauditar para calcular.
                  </p>
                )}
              </div>
            )}

            {doc.activeState === "METROLOGY" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target className="size-4 text-accent" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Metrologia, GD&T & FAI
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      ChamferKernel.generateMetrology(doc);
                      onDocumentChange({ ...doc });
                    }}
                    className="rounded border border-line px-1.5 py-0.5 text-[8.5px] uppercase tracking-wider hover:text-accent"
                  >
                    Reinspecionar
                  </button>
                </div>

                {doc.metrologyReport ? (
                  <>
                    <div className="rounded-lg border border-line bg-card/50 p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase">
                          Veredito FAI
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            doc.metrologyReport.summary.overallVerdict === "APPROVED"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : doc.metrologyReport.summary.overallVerdict === "CONDITIONALLY_APPROVED"
                                ? "bg-amber-500/15 text-amber-500"
                                : doc.metrologyReport.summary.overallVerdict === "REJECTED"
                                  ? "bg-red-500/15 text-red-500"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {doc.metrologyReport.summary.overallVerdict === "APPROVED"
                            ? "Aprovado"
                            : doc.metrologyReport.summary.overallVerdict === "CONDITIONALLY_APPROVED"
                              ? "Aprov. Condicional"
                              : doc.metrologyReport.summary.overallVerdict === "REJECTED"
                                ? "Reprovado"
                                : "Em Inspeção"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="rounded bg-muted/30 p-1">
                          <span className="text-[8px] text-muted-foreground block">COTAS</span>
                          <span className="text-xs font-bold text-accent">
                            {doc.metrologyReport.summary.totalDimensions}
                          </span>
                        </div>
                        <div className="rounded bg-muted/30 p-1">
                          <span className="text-[8px] text-muted-foreground block">CONFORME</span>
                          <span className="text-xs font-bold text-emerald-500">
                            {doc.metrologyReport.summary.passed}
                          </span>
                        </div>
                        <div className="rounded bg-muted/30 p-1">
                          <span className="text-[8px] text-muted-foreground block">TAXA</span>
                          <span className="text-xs font-bold text-foreground">
                            {doc.metrologyReport.summary.conformanceRate}%
                          </span>
                        </div>
                      </div>
                      {doc.metrologyReport.capability && (
                        <div className="flex justify-between border-t border-line/60 pt-1.5 text-[9px]">
                          <span className="text-muted-foreground">Capabilidade do Processo:</span>
                          <span className="font-mono font-bold text-accent">
                            Cp = {doc.metrologyReport.capability.cp} | Cpk = {doc.metrologyReport.capability.cpk}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* LISTA DE PONTOS DE INSPEÇÃO BALONEADOS */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold block">
                        Cotas Baloneadas ({doc.metrologyReport.points.length}) · ISO 2768
                      </span>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                        {doc.metrologyReport.points.map((pt) => (
                          <div
                            key={pt.id}
                            className="rounded-lg border border-line bg-card/40 p-2 text-[9px] space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="flex size-4 items-center justify-center rounded-full bg-accent/20 font-bold text-[8.5px] text-accent">
                                  #{pt.balloonNumber}
                                </span>
                                <span className="font-semibold text-foreground truncate max-w-[140px]">
                                  {pt.label}
                                </span>
                              </div>
                              <span className="font-mono text-[8.5px] text-muted-foreground">
                                {pt.nominal} (+{pt.upperTol}/{pt.lowerTol})
                              </span>
                            </div>
                            {pt.notes && (
                              <p className="font-mono text-[8px] text-accent/90 bg-muted/30 px-1.5 py-0.5 rounded">
                                {pt.notes}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[8px] text-muted-foreground pt-0.5">
                              <span>Inst: {pt.instrument}</span>
                              <span
                                className={cn(
                                  "font-bold uppercase",
                                  pt.status === "PASS"
                                    ? "text-emerald-500"
                                    : pt.status === "WARNING"
                                      ? "text-amber-500"
                                      : pt.status === "FAIL"
                                        ? "text-red-500"
                                        : "text-muted-foreground",
                                )}
                              >
                                {pt.status === "PASS"
                                  ? "Aprovado"
                                  : pt.status === "WARNING"
                                    ? "Atenção"
                                    : pt.status === "FAIL"
                                      ? "Reprovado"
                                      : "Pendente"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Clique em Reinspecionar para gerar o plano FAI.
                  </p>
                )}
              </div>
            )}

            {doc.activeState === "FEA" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Activity className="size-4 text-accent" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Análise Estrutural FEA
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("action");
                      ChamferKernel.runFeaSimulation(doc);
                      onDocumentChange({ ...doc });
                    }}
                    className="flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent hover:bg-accent/30 transition-colors"
                  >
                    <RefreshCw className="size-2.5" />
                    Simular
                  </button>
                </div>

                {doc.feaReport ? (
                  <>
                    <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-2 text-[9px]">
                      {/* STATUS E FOS */}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Fator de Segurança (FOS):</span>
                        <span
                          className={cn(
                            "font-mono font-bold text-[10px] px-1.5 py-0.5 rounded",
                            doc.feaReport.status === "SAFE"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : doc.feaReport.status === "MARGINAL"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-red-500/20 text-red-400",
                          )}
                        >
                          {doc.feaReport.minFactorOfSafety} ({doc.feaReport.status === "SAFE" ? "SEGURO" : doc.feaReport.status === "MARGINAL" ? "ATENÇÃO" : "FALHA"})
                        </span>
                      </div>

                      {/* TENSÃO DE VON MISES VS ESCOAMENTO */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px]">
                          <span className="text-muted-foreground">Pico Von Mises:</span>
                          <span className="font-bold text-foreground">
                            {doc.feaReport.maxVonMisesMPa} / {doc.feaReport.yieldStrengthMPa} MPa (fy)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              doc.feaReport.maxVonMisesMPa > doc.feaReport.yieldStrengthMPa
                                ? "bg-red-500"
                                : doc.feaReport.maxVonMisesMPa > doc.feaReport.yieldStrengthMPa * 0.7
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                            style={{
                              width: `${Math.min(100, (doc.feaReport.maxVonMisesMPa / doc.feaReport.yieldStrengthMPa) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* DEFLEXÃO MÁXIMA VS LIMITE NBR 8800 */}
                      <div className="flex justify-between border-t border-line/60 pt-1.5">
                        <span className="text-muted-foreground">Deflexão máxima (δ):</span>
                        <span className="font-mono text-foreground">
                          {doc.feaReport.maxDeflectionMm} mm (Limite: {doc.feaReport.allowableDeflectionMm} mm)
                        </span>
                      </div>

                      {/* NÚMERO DE NÓS E ELEMENTOS */}
                      <div className="flex justify-between text-[8px] text-muted-foreground border-t border-line/40 pt-1">
                        <span>Malha: {doc.feaReport.mesh.numElements} el (CST)</span>
                        <span>Nós: {doc.feaReport.mesh.numNodes}</span>
                        <span>Espessura: {doc.feaReport.thicknessMm} mm</span>
                      </div>
                    </div>

                    {/* PONTOS DE CONCENTRAÇÃO DE TENSÃO (HOTSPOTS) */}
                    {doc.feaReport.hotspots && doc.feaReport.hotspots.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase font-semibold block">
                          Concentração de Tensão (Hotspots)
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                          {doc.feaReport.hotspots.map((h, i) => (
                            <div
                              key={i}
                              className="rounded border border-line/60 bg-muted/20 p-1.5 text-[8.5px] flex items-center justify-between"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-red-500 inline-block" />
                                <span className="text-foreground">{h.description}</span>
                              </div>
                              <span className="font-mono font-bold text-accent">
                                {h.vonMisesMPa} MPa
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Clique em Simular para processar a malha de elementos finitos.
                  </p>
                )}
              </div>
            )}

            {doc.activeState === "FORMING" && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Hammer className="size-4 text-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Prensa Dobradeira & Conformação
                  </span>
                </div>
                {doc.pressBrakeSimulation ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5 text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tonelagem total:</span>
                        <span className="font-bold text-accent">
                          {doc.pressBrakeSimulation.totalTonnageTon.toFixed(1)} ton
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Força por metro:</span>
                        <span className="text-foreground">
                          {doc.pressBrakeSimulation.tonnagePerMeterTonM.toFixed(1)} ton/m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Canal V recomendado:</span>
                        <span className="text-foreground">
                          {doc.pressBrakeSimulation.recommendedDieOpeningVMm} mm (V=
                          {doc.pressBrakeSimulation.dieOpeningVMm} mm)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Retorno elástico:</span>
                        <span className="text-foreground">
                          {doc.pressBrakeSimulation.springbackAngleDeg.toFixed(1)}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sobredobra necessária:</span>
                        <span className="text-foreground">
                          {doc.pressBrakeSimulation.overbendAngleDeg.toFixed(1)}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aba mínima de segurança:</span>
                        <span className="font-bold text-emerald-500">
                          {doc.pressBrakeSimulation.minFlangeLengthMm.toFixed(1)} mm
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Simulação de conformação calculada.
                  </p>
                )}
              </div>
            )}

            {doc.activeState === "NESTING" && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <LayoutGrid className="size-4 text-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Aproveitamento & Nesting
                  </span>
                </div>
                {doc.nestingJob ? (
                  <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5 text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Eficiência de chapa:</span>
                      <span className="font-bold text-emerald-500">
                        {doc.nestingJob.globalEfficiency.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peças aninhadas:</span>
                      <span className="text-foreground">{doc.nestingJob.totalPartsNested} un</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chapas utilizadas:</span>
                      <span className="text-foreground">
                        {doc.nestingJob.sheets.length} chapa(s)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nesting pronto para exportação.</p>
                )}
              </div>
            )}

            {doc.activeState === "WELDMENTS" && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Columns className="size-4 text-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Perfis & Lista de Corte
                  </span>
                </div>
                {doc.structuralReport ? (
                  <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5 text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total de membros:</span>
                      <span className="font-bold text-foreground">
                        {doc.structuralReport.totalMembers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Massa linear total:</span>
                      <span className="font-bold text-accent">
                        {doc.structuralReport.totalMassKg.toFixed(2)} kg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comprimento total:</span>
                      <span className="text-foreground">
                        {(doc.structuralReport.totalCutLengthMm / 1000).toFixed(2)} m
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Lista de corte calculada.</p>
                )}
              </div>
            )}

            {doc.activeState === "CAM_TOOLPATH" && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Flame className="size-4 text-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Percurso CNC & G-Code
                  </span>
                </div>
                <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Furos térmicos (Pierces):</span>
                    <span className="font-bold text-accent">
                      {doc.camResult?.totalPierces ??
                        doc.flatPatternResult?.innerLoops?.length ??
                        0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comprimento de corte:</span>
                    <span className="text-foreground">
                      {(doc.camResult?.totalCutLengthMm ?? 0).toFixed(1)} mm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status do G-Code:</span>
                    <span className="font-bold text-emerald-500">
                      {doc.gcode ? "Gerado (.NC)" : "Pronto para gerar"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {doc.activeState === "2D_DRAWING" && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <FileText className="size-4 text-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Folha Técnica ABNT
                  </span>
                </div>
                <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Projeção:</span>
                    <span className="text-foreground">1º Diedro (ABNT / ISO)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Formato:</span>
                    <span className="text-foreground">A3 Paisagem (420 x 297 mm)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vistas automáticas:</span>
                    <span className="font-bold text-accent">Frontal, Superior, Lat. Esq., Iso</span>
                  </div>
                </div>
              </div>
            )}

            {(doc.activeState === "3D_FOLDED" || doc.activeState === "2D_FLAT") && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Box className="size-4 text-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Estado do Modelo Paramétrico
                  </span>
                </div>
                <div className="rounded-lg border border-line bg-card/40 p-2.5 space-y-1.5 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Material:</span>
                    <span className="font-bold text-foreground">{doc.material}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Espessura (t):</span>
                    <span className="text-foreground">{doc.thickness} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Raio interno (r):</span>
                    <span className="text-foreground">{doc.innerRadius} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fator K:</span>
                    <span className="text-foreground">{doc.kFactor}</span>
                  </div>
                  {doc.flatPatternResult && (
                    <div className="flex justify-between border-t border-line/60 pt-1">
                      <span className="text-muted-foreground">Blank Planificado:</span>
                      <span className="font-bold text-accent">
                        {doc.flatPatternResult.blankWidth.toFixed(1)} x{" "}
                        {doc.flatPatternResult.blankLength.toFixed(1)} mm
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RODAPÉ COM AÇÕES DE EXPORTAÇÃO CNC & PRANCHA TÉCNICA */}
      <div className="border-t border-line bg-muted/20 p-3 space-y-1.5">
        <button
          type="button"
          onClick={handleDownloadGCode}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 font-mono text-xs font-semibold text-accent-foreground uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          <FileCode2 className="size-3.5" />
          Baixar G-Code CNC (.NC)
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadDrawingSVG}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[10px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Download className="size-3" />
            Prancha (SVG)
          </button>
          <button
            type="button"
            onClick={handleDownloadDrawingDXF}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[10px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Download className="size-3" />
            Prancha (DXF)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadNestingDXF}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[10px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Download className="size-3" />
            Chapa (DXF)
          </button>
          <button
            type="button"
            onClick={handleDownloadNestingCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[10px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <LayoutGrid className="size-3" />
            Nesting (CSV)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadCutListCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Columns className="size-3" />
            Perfis (CSV)
          </button>
          <button
            type="button"
            onClick={handleDownloadPressBrakeCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Hammer className="size-3" />
            Dobra/Estampo
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadDfmCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <ShieldCheck className="size-3 text-emerald-500" />
            DFM (CSV)
          </button>
          <button
            type="button"
            onClick={handleDownloadDfmDXF}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Download className="size-3 text-emerald-500" />
            DFM (DXF)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadMetrologyCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Target className="size-3 text-accent" />
            FAI (CSV)
          </button>
          <button
            type="button"
            onClick={handleDownloadMetrologySVG}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Download className="size-3 text-accent" />
            Balões (SVG)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleDownloadFeaCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Activity className="size-3 text-accent" />
            FEA (CSV)
          </button>
          <button
            type="button"
            onClick={handleDownloadFeaSVG}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card/60 px-2 py-1.5 font-mono text-[9px] font-semibold text-foreground uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Download className="size-3 text-accent" />
            Tensões (SVG)
          </button>
        </div>
      </div>
    </aside>
  );
}
