/**
 * CALDRA CAD — DRAFTING & DETALHAMENTO TÉCNICO DIALOG (FASE 09)
 *
 * Diálogo interativo de desenho técnico industrial ABNT NBR 10067 / ISO 128
 * gerado diretamente do sólido B-Rep 3D:
 * - Vistas ortográficas com projeções no 1º diedro (ABNT) e 3º diedro (ANSI);
 * - Carimbo técnico com escala automática, cálculo de massa real e notas de fabricação;
 * - Visualizador da prancha em SVG com zoom e enquadramento;
 * - Exportação de prancha em DXF técnico multicamadas e SVG para plotagem/impressão.
 */

import { useState, useMemo } from "react";
import {
  FileText,
  Download,
  Printer,
  X,
  Layers,
  Check,
  Maximize2,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { CaldraDraftingBridge, type DraftingSheetResult } from "@/lib/cad/drafting/CaldraDraftingBridge";
import type { CadFeatureNode } from "@/lib/cad/features/CadFeatureModel";
import type { MassProperties } from "@/lib/cad/core/CadKernel";
import type { SheetSize, ProjectionAngle } from "@/lib/cad/drafting/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CaldraDraftingDialogProps {
  open: boolean;
  onClose: () => void;
  features: readonly CadFeatureNode[];
  massProps?: MassProperties | null;
  dimensions?: { width: number; length: number; height: number };
}

export function CaldraDraftingDialog({
  open,
  onClose,
  features,
  massProps,
  dimensions,
}: CaldraDraftingDialogProps) {
  const [sheetSize, setSheetSize] = useState<SheetSize>("A4_LANDSCAPE");
  const [projection, setProjection] = useState<ProjectionAngle>("FIRST_ANGLE");
  const [company, setCompany] = useState("CALDRA INDUSTRIAL CAD");
  const [author, setAuthor] = useState("PROJETISTA CALDRA");

  // Gera a prancha técnica a partir dos recursos atuais do modelo CAD
  const result: DraftingSheetResult = useMemo(() => {
    return CaldraDraftingBridge.generateDrawingSheet(features, massProps, {
      sheetSize,
      projectionAngle: projection,
      company,
      author,
      dimensions,
    });
  }, [features, massProps, sheetSize, projection, company, author, dimensions]);

  if (!open) return null;

  // 1. Download da Prancha em DXF
  const handleDownloadDxf = () => {
    const blob = new Blob([result.dxfString], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desenho_tecnico_${Date.now()}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Prancha técnica DXF exportada com camadas normalizadas!");
  };

  // 2. Download da Prancha em SVG
  const handleDownloadSvg = () => {
    const blob = new Blob([result.svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prancha_${sheetSize.toLowerCase()}_${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Prancha técnica SVG vetorial exportada!");
  };

  // 3. Imprimir / Plotar Folha
  const handlePrintSheet = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permita pop-ups no navegador para imprimir a prancha técnica.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prancha Técnica - ${result.sheet.titleBlock.title}</title>
          <style>
            @page { size: ${result.sheet.widthMm}mm ${result.sheet.heightMm}mm; margin: 0; }
            body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            svg { width: 100vw; height: 100vh; max-width: 100%; max-height: 100%; }
          </style>
        </head>
        <body>
          ${result.svgString}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex w-[min(96vw,920px)] max-h-[min(92vh,560px)] overflow-y-auto flex-col gap-3 rounded-2xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-md font-mono text-[10px] text-foreground">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-accent" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Drafting & Prancha Técnica 2D Industrial (ABNT / ISO)
                </h3>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-[8.5px] text-accent">
                  {result.sheet.titleBlock.scale}
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground">
                Vistas ortográficas, carimbo normalizado e cotagem automática em milímetros
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

        {/* BARRA DE CONFIGURAÇÃO DA PRANCHA */}
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-line/60 bg-background/50 p-2.5 text-[9px]">
          <div>
            <label className="text-[8px] text-muted-foreground uppercase">Formato da Folha</label>
            <select
              value={sheetSize}
              onChange={(e) => setSheetSize(e.target.value as SheetSize)}
              className="mt-0.5 w-full rounded border border-line bg-background px-2 py-1 font-mono font-bold text-foreground"
            >
              <option value="A4_LANDSCAPE">A4 Paisagem (297 × 210 mm)</option>
              <option value="A4_PORTRAIT">A4 Retrato (210 × 297 mm)</option>
              <option value="A3_LANDSCAPE">A3 Paisagem (420 × 297 mm)</option>
              <option value="A2_LANDSCAPE">A2 Paisagem (594 × 420 mm)</option>
            </select>
          </div>

          <div>
            <label className="text-[8px] text-muted-foreground uppercase">Diedro de Projeção</label>
            <select
              value={projection}
              onChange={(e) => setProjection(e.target.value as ProjectionAngle)}
              className="mt-0.5 w-full rounded border border-line bg-background px-2 py-1 font-mono font-bold text-foreground"
            >
              <option value="FIRST_ANGLE">1º Diedro (ABNT / ISO 128)</option>
              <option value="THIRD_ANGLE">3º Diedro (ANSI / ASME)</option>
            </select>
          </div>

          <div>
            <label className="text-[8px] text-muted-foreground uppercase">Organização / Empresa</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-0.5 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
            />
          </div>

          <div>
            <label className="text-[8px] text-muted-foreground uppercase">Projetista / Autor</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="mt-0.5 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
            />
          </div>
        </div>

        {/* ÁREA DE PRÉ-VISUALIZAÇÃO DA FOLHA TÉCNICA */}
        <div className="relative flex h-84 w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-2 shadow-inner">
          <div
            className="size-full max-h-full flex items-center justify-center pointer-events-none"
            dangerouslySetInnerHTML={{ __html: result.svgString }}
          />

          <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/90 px-2 py-1 text-[8.5px] text-slate-700 shadow-xs">
            <span className="font-bold">{result.sheet.titleBlock.title}</span>
            <span>·</span>
            <span>Escala {result.sheet.titleBlock.scale}</span>
            <span>·</span>
            <span>Massa: {result.sheet.titleBlock.estimatedMassKg} kg</span>
          </div>
        </div>

        {/* RODAPÉ COM EXPORTAÇÕES */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
          <div className="flex items-center gap-1 text-[8.5px] text-muted-foreground">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>Normas ABNT NBR 10067 / ISO 128 / Tolerâncias ISO 2768-mK</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* IMPRIMIR / PLOTAR */}
            <button
              type="button"
              onClick={handlePrintSheet}
              className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 text-[9px] font-bold text-foreground uppercase hover:bg-muted transition-colors"
              title="Imprimir prancha técnica em escala ou gerar PDF"
            >
              <Printer className="size-3 text-accent" /> Imprimir / Plotar
            </button>

            {/* EXPORTAR SVG VETORIAL */}
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 text-[9px] font-bold text-foreground uppercase hover:bg-muted transition-colors"
              title="Baixar prancha completa em SVG de alta resolução"
            >
              <Download className="size-3 text-blue-400" /> Vetor SVG
            </button>

            {/* EXPORTAR DXF TÉCNICO */}
            <button
              type="button"
              onClick={handleDownloadDxf}
              className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/20 px-3 py-1 text-[9px] font-bold text-accent uppercase hover:bg-accent/30 transition-colors shadow-xs"
              title="Exportar arquivo DXF com moldura, legenda, cotas e vistas"
            >
              <Download className="size-3" /> Exportar Prancha DXF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
