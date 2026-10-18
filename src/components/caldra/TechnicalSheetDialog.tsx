import React, { useMemo, useState } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  Sparkles,
  Layers,
  X,
} from "lucide-react";
import {
  buildTechnicalSheet,
  type PaperSize,
  type SheetOrientation,
  type SheetTheme,
  type SheetOptions,
} from "@/lib/export/technicalSheetEngine";
import {
  downloadTechnicalSheetPdf,
  renderTechnicalSheetSvg,
} from "@/lib/export/technicalPdfGenerator";
import type { GeometryResult } from "@/lib/geometry/types";
import type { EngineValues } from "@/lib/geometry/engines";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/ui/haptics";

interface TechnicalSheetDialogProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  pieceName: string;
  values: EngineValues;
  result: GeometryResult | null;
  material?: string;
  thickness?: number | string;
  quantity?: number | string;
  projectName?: string;
}

export function TechnicalSheetDialog({
  open,
  onClose,
  slug,
  pieceName,
  values,
  result,
  material = "Aço Carbono ASTM A36",
  thickness = 3,
  quantity = 1,
  projectName = "CALDRA — Traçagem",
}: TechnicalSheetDialogProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [orientation, setOrientation] = useState<SheetOrientation>("landscape");
  const [theme, setTheme] = useState<SheetTheme>("blueprint");
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const sheetDoc = useMemo(() => {
    return buildTechnicalSheet(slug, values, result, {
      paperSize,
      orientation,
      theme,
      pieceName,
      projectName,
      material,
      thickness,
      quantity,
    });
  }, [slug, values, result, paperSize, orientation, theme, pieceName, projectName, material, thickness, quantity]);

  const svgContent = useMemo(() => {
    return renderTechnicalSheetSvg(sheetDoc, theme);
  }, [sheetDoc, theme]);

  if (!open) return null;

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      triggerHaptic("action");
      await downloadTechnicalSheetPdf(sheetDoc);
      toast.success("PDF técnico vetorial gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF da folha técnica.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSvg = () => {
    try {
      triggerHaptic("action");
      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CALDRA_${sheetDoc.modelSlug}_FOLHA_TECNICA.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Arquivo SVG vetorial exportado!");
    } catch {
      toast.error("Falha ao exportar SVG.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2 backdrop-blur-md sm:p-4">
      <div className="relative flex h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        {/* CABEÇALHO DO DIÁLOGO */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-background/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/25">
              <FileText className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-bold tracking-wide text-foreground uppercase">
                  Folha Técnica de Fabricação — {sheetDoc.modelName}
                </h2>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[9px] font-bold text-accent border border-accent/25">
                  {sheetDoc.scaleText}
                </span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">
                Projeção ortográfica (1º Diedro) · Perspectiva Isométrica · Planificação Vetorial
              </p>
            </div>
          </div>

          {/* BOTÕES DE CONTROLE SUPERIOR */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChecklist((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-medium transition-colors",
                sheetDoc.validation.valid
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400",
              )}
            >
              {sheetDoc.validation.valid ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
              Validação ({sheetDoc.validation.checks.filter((c) => c.passed).length}/
              {sheetDoc.validation.checks.length})
            </button>

            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg border border-line text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* BARRA DE CONFIGURAÇÃO RÁPIDA DA FOLHA */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-secondary/30 px-4 py-2 font-mono text-[11px]">
          <div className="flex items-center gap-3">
            {/* Formato */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Formato:</span>
              <div className="flex rounded-md border border-line p-0.5">
                {(["A4", "A3"] as PaperSize[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setPaperSize(fmt)}
                    className={cn(
                      "rounded px-2 py-0.5 transition-colors",
                      paperSize === fmt ? "bg-accent text-background font-bold" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientação */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Orientação:</span>
              <div className="flex rounded-md border border-line p-0.5">
                {(["landscape", "portrait"] as SheetOrientation[]).map((ori) => (
                  <button
                    key={ori}
                    onClick={() => setOrientation(ori)}
                    className={cn(
                      "rounded px-2 py-0.5 transition-colors",
                      orientation === ori ? "bg-accent text-background font-bold" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {ori === "landscape" ? "Paisagem" : "Retrato"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tema de visualização */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Aparência:</span>
              <div className="flex rounded-md border border-line p-0.5">
                <button
                  onClick={() => setTheme("blueprint")}
                  className={cn(
                    "rounded px-2 py-0.5 transition-colors",
                    theme === "blueprint" ? "bg-accent text-background font-bold" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Blueprint Escuro
                </button>
                <button
                  onClick={() => setTheme("white")}
                  className={cn(
                    "rounded px-2 py-0.5 transition-colors",
                    theme === "white" ? "bg-accent text-background font-bold" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Papel Branco
                </button>
              </div>
            </div>
          </div>

          {/* Zoom da prancha */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              className="flex size-7 items-center justify-center rounded border border-line text-muted-foreground hover:text-foreground"
              title="Diminuir Zoom"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="w-12 text-center text-[10px] text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="flex size-7 items-center justify-center rounded border border-line text-muted-foreground hover:text-foreground"
              title="Aumentar Zoom"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="flex size-7 items-center justify-center rounded border border-line text-muted-foreground hover:text-foreground ml-1"
              title="Ajustar 100%"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* ÁREA DE PRÉ-VISUALIZAÇÃO TÉCNICA */}
        <div className="relative flex-1 overflow-auto bg-black/60 p-4">
          <div
            className="mx-auto transition-transform duration-200 shadow-2xl"
            style={{
              width: `${sheetDoc.sheetW * 2.8 * zoom}px`,
              aspectRatio: `${sheetDoc.sheetW} / ${sheetDoc.sheetH}`,
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* CHECKLIST OVERLAY DE VALIDAÇÃO (ITEM 25) */}
          {showChecklist && (
            <div className="absolute top-4 right-4 z-30 w-80 rounded-xl border border-line bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                  Checklist Técnico (Item 25)
                </span>
                <button
                  onClick={() => setShowChecklist(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="mt-2.5 space-y-1.5 font-mono text-[10px]">
                {sheetDoc.validation.checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground truncate">{c.label}</span>
                    <span
                      className={cn(
                        "shrink-0 font-bold",
                        c.passed ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {c.passed ? "PASSOU [✓]" : "REVISAR [!]"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2 border-t border-line font-mono text-[9px] text-muted-foreground">
                Todas as cotas e vistas derivam da geometria canônica real.
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO DIÁLOGO COM AÇÕES PRINCIPAIS */}
        <div className="flex shrink-0 items-center justify-between border-t border-line bg-background/80 px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px]">
            <span>Norma: ABNT/ISO 1º Diedro</span>
            <span>·</span>
            <span>Espessura: {thickness} mm</span>
            <span>·</span>
            <span>Material: {material}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSvg}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-secondary/50 px-3 py-2 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
            >
              <Download className="size-3.5" /> SVG Vetorial
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 font-mono text-xs font-bold text-background shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <FileText className="size-4" />
              {isExporting ? "Gerando PDF Vetorial..." : "Baixar Folha Técnica em PDF (Vetorial)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
