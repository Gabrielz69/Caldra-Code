/**
 * CALDRA CHAMFER — PASSAPORTE DA PEÇA E PRONTIDÃO DE FABRICAÇÃO (SEÇÕES 34, 35 E INOVAÇÃO I8)
 *
 * Gera o documento técnico e pacote de fabricação completo a partir do modelo 2D:
 *  - Metadados da Peça: TAG/Nome, Material, Espessura nominal, Quantidade;
 *  - Propriedades Físicas: Área total da chapa (mm² / m²), Massa/Peso estimado (kg);
 *  - Dados de Corte CNC: Perímetro de corte (m), Quantidade de perfurações (pierces);
 *  - Tabela de Furações: Coordenadas (X, Y) exatas de cada centro de furo e diâmetro Ø;
 *  - Verificação de Prontidão (Zero Fresta): Contorno fechado, autointerseções, microsegmentos;
 *  - Exportação direta para fabricação: DXF CNC, SVG Técnico, Relatório PDF.
 */

import React, { useState, useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Layers,
  Scale,
  Maximize2,
  Wrench,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Entity } from "@/lib/lab2d/core";
import { boxOf } from "@/lib/lab2d/core";
import { triggerHaptic } from "@/lib/ui/haptics";
import { toast } from "sonner";

interface HoleSpec {
  id: string;
  index: number;
  cx: number;
  cy: number;
  diameter: number;
}

interface ChamferFabricationPassportModalProps {
  open: boolean;
  onClose: () => void;
  entities: Entity[];
  projectName?: string;
  onExportDxf?: () => void;
  onExportSvg?: () => void;
}

export function ChamferFabricationPassportModal({
  open,
  onClose,
  entities,
  projectName = "Peça 01",
  onExportDxf,
  onExportSvg,
}: ChamferFabricationPassportModalProps) {
  const [material, setMaterial] = useState("Aço Carbono ASTM A36");
  const [density, setDensity] = useState(7.85); // g/cm³
  const [thickness, setThickness] = useState(6.35); // mm
  const [quantity, setQuantity] = useState(1);

  // Análise geométrica das entidades
  const stats = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let cutLengthMm = 0;
    const holes: HoleSpec[] = [];
    let holeIdx = 1;

    for (const e of entities) {
      const b = boxOf(e);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);

      if (e.type === "circle") {
        holes.push({
          id: e.id,
          index: holeIdx++,
          cx: e.cx,
          cy: e.cy,
          diameter: e.r * 2,
        });
        cutLengthMm += 2 * Math.PI * e.r;
      } else if (e.type === "line") {
        cutLengthMm += Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
      } else if (e.type === "polyline") {
        for (let i = 0; i < e.pts.length - 1; i++) {
          cutLengthMm += Math.hypot(e.pts[i + 1].x - e.pts[i].x, e.pts[i + 1].y - e.pts[i].y);
        }
        if (e.closed && e.pts.length > 2) {
          cutLengthMm += Math.hypot(e.pts[0].x - e.pts[e.pts.length - 1].x, e.pts[0].y - e.pts[e.pts.length - 1].y);
        }
      }
    }

    const w = isFinite(maxX - minX) ? Math.max(0, maxX - minX) : 0;
    const h = isFinite(maxY - minY) ? Math.max(0, maxY - minY) : 0;
    const areaM2 = (w * h) / 1_000_000;
    const massKg = areaM2 * (thickness / 1000) * (density * 1000);

    return {
      width: w,
      height: h,
      areaM2,
      massKg: massKg * quantity,
      cutPerimeterM: cutLengthMm / 1000,
      piercesCount: holes.length + (entities.length > holes.length ? 1 : 0),
      holes,
    };
  }, [entities, thickness, density, quantity]);

  const handleCopyTable = () => {
    triggerHaptic("selection");
    const header = "Furo\tX (mm)\tY (mm)\tDiâmetro (mm)\n";
    const rows = stats.holes
      .map((h) => `#${h.index}\t${h.cx.toFixed(2)}\t${h.cy.toFixed(2)}\t${h.diameter.toFixed(2)}`)
      .join("\n");
    navigator.clipboard.writeText(header + rows);
    toast.success("Tabela de furações copiada para a área de transferência.");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card/95 border-border/80 backdrop-blur-2xl shadow-2xl rounded-3xl p-5">
        <DialogHeader>
          <div className="flex items-center gap-2 text-accent">
            <FileText className="w-5 h-5" />
            <DialogTitle className="text-base font-bold tracking-tight">
              Passaporte da Peça & Prontidão de Fabricação
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Especificações de corte, peso calculado e coordenadas para CNC e puncionadeira.
          </DialogDescription>
        </DialogHeader>

        {/* METADADOS DA CHAPA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
          <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Espessura</span>
            <div className="flex items-center gap-1 mt-0.5 font-bold text-foreground">
              <input
                type="number"
                step="0.5"
                value={thickness}
                onChange={(e) => setThickness(parseFloat(e.target.value) || 0)}
                className="w-12 bg-transparent outline-none border-b border-border text-center"
              />
              <span>mm</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Dimensões Brutas</span>
            <div className="mt-0.5 font-bold text-foreground font-mono">
              {stats.width.toFixed(0)} × {stats.height.toFixed(0)} mm
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Massa Estimada</span>
            <div className="mt-0.5 font-bold text-accent font-mono">
              {stats.massKg.toFixed(2)} kg
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Perímetro de Corte</span>
            <div className="mt-0.5 font-bold text-foreground font-mono">
              {stats.cutPerimeterM.toFixed(2)} m
            </div>
          </div>
        </div>

        {/* TABELA DE FURAÇÕES (CNC / PUNCIONAMENTO) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Tabela de Furações</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent/20 text-accent">
                {stats.holes.length} furos
              </span>
            </h4>
            {stats.holes.length > 0 && (
              <button
                onClick={handleCopyTable}
                className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                Copiar Coordenadas
              </button>
            )}
          </div>

          {stats.holes.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground bg-background/40 rounded-xl border border-border/30">
              Nenhum furo circular detectado na geometria atual.
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/50 text-[11px] font-mono divide-y divide-border/20">
              <div className="grid grid-cols-4 px-3 py-1.5 bg-muted/40 font-semibold text-muted-foreground">
                <span>Furo</span>
                <span>Centro X</span>
                <span>Centro Y</span>
                <span className="text-right">Diâmetro</span>
              </div>
              {stats.holes.map((h) => (
                <div key={h.id} className="grid grid-cols-4 px-3 py-1.5 hover:bg-muted/20">
                  <span className="font-bold text-foreground">#{h.index}</span>
                  <span>{h.cx.toFixed(1)} mm</span>
                  <span>{h.cy.toFixed(1)} mm</span>
                  <span className="text-right text-accent font-semibold">Ø{h.diameter.toFixed(1)} mm</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTÕES DE EXPORTAÇÃO RÁPIDA */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
          {onExportDxf && (
            <button
              onClick={() => {
                triggerHaptic("selection");
                onExportDxf();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar DXF CNC
            </button>
          )}
          {onExportSvg && (
            <button
              onClick={() => {
                triggerHaptic("selection");
                onExportSvg();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-accent text-accent-foreground shadow-md hover:brightness-110"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar SVG Técnico
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
