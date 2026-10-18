/**
 * CALDRA CHAMFER — MODAL DE FOLHA DE DESENHO TÉCNICO (ETAPA 26)
 *
 * Configura e insere prancha normalizada (A4, A3, A2) com legenda técnica da CALDRA:
 *  - Enquadra automaticamente a geometria do projeto;
 *  - Metadados do carimbo: Peça/TAG, Material, Espessura, Escala, Projetista, Revisão;
 *  - Criação de geometria vetorial pura editável.
 */

import React, { useState } from "react";
import { FileText, Check, LayoutGrid } from "lucide-react";
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
import type { Entity } from "@/lib/lab2d/core";
import {
  generateTechnicalSheetEntities,
  type SheetFormat,
  type TechnicalSheetMetadata,
} from "@/lib/lab2d/cadTechnicalSheet";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

interface ChamferTechnicalSheetModalProps {
  open: boolean;
  onClose: () => void;
  suggestedOrigin: Vec2;
  onInsertSheet: (entities: Entity[]) => void;
}

export function ChamferTechnicalSheetModal({
  open,
  onClose,
  suggestedOrigin,
  onInsertSheet,
}: ChamferTechnicalSheetModalProps) {
  const [format, setFormat] = useState<SheetFormat>("A3");
  const [meta, setMeta] = useState<TechnicalSheetMetadata>({
    title: "CONJUNTO DE CALDEIRARIA INDUSTRIAL",
    pieceTag: "PC-01",
    material: "Aço Carbono ASTM A36",
    thickness: "6.35 mm",
    scale: "1:1",
    drafter: "CALDRA METAL LAB",
    revision: "R0",
    date: new Date().toLocaleDateString("pt-BR"),
  });

  const handleGenerate = () => {
    triggerHaptic("success");
    AudioManager.play("cad_core_init");
    const entities = generateTechnicalSheetEntities(format, suggestedOrigin, meta);
    onInsertSheet(entities);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card/95 border-border/80 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-accent">
            <FileText className="w-5 h-5" />
            <DialogTitle className="text-base font-bold tracking-tight">
              Gerar Folha e Legenda Técnica Normalizada
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Insere margem ABNT/ISO e carimbo de fabricação CALDRA no desenho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Formato da Folha */}
          <div>
            <label className="text-xs font-semibold text-foreground">
              Formato da Prancha:
            </label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {(
                [
                  { id: "A4_LANDSCAPE", label: "A4 Paisagem (297×210)" },
                  { id: "A3", label: "A3 (420×297)" },
                  { id: "A2", label: "A2 (594×420)" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`p-2 rounded-xl text-center text-xs font-semibold border transition-all ${
                    format === f.id
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campos do Carimbo */}
          <div className="space-y-2 pt-1 border-t border-border/40 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label className="text-muted-foreground font-medium">Título:</label>
              <input
                type="text"
                value={meta.title}
                onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                className="w-56 px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-accent text-xs font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-muted-foreground font-medium">TAG da Peça:</label>
              <input
                type="text"
                value={meta.pieceTag}
                onChange={(e) => setMeta({ ...meta, pieceTag: e.target.value })}
                className="w-56 px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-accent text-xs font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-muted-foreground font-medium">Material:</label>
              <input
                type="text"
                value={meta.material}
                onChange={(e) => setMeta({ ...meta, material: e.target.value })}
                className="w-56 px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-accent text-xs font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-muted-foreground font-medium">Espessura:</label>
              <input
                type="text"
                value={meta.thickness}
                onChange={(e) => setMeta({ ...meta, thickness: e.target.value })}
                className="w-56 px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-accent text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border/40 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            className="brand-gradient text-background font-semibold text-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Inserir Prancha Técnica</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
