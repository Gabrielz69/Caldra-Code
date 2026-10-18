/**
 * CALDRA CHAMFER — QUICK COMMAND (BARRA RÁPIDA DE COMANDOS CAD)
 *
 * Busca inteligente estilo Spotlight com reconhecimento de sinônimos técnicos:
 *  - "centralizar", "alinhar centro", "colocar no meio" -> Comando Centralizar;
 *  - "aparar", "cortar", "trim" -> Comando Smart Trim;
 *  - "dividir", "traçagem", "geratrizes" -> Divisão Paramétrica;
 *  - "slot", "rasgo", "oblongo" -> Criar Slot;
 *  - "flange", "tubo", "base", "sapata" -> Inserir Preset;
 *  - "analisar", "limpar", "diagnóstico", "frestas" -> Diagnóstico Topológico / Heal;
 *  - "folha", "prancha", "a3", "carimbo" -> Gerar Folha Técnica.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Scissors,
  AlignCenter,
  Divide,
  Copy,
  FlipHorizontal,
  Box,
  CircleDot,
  Minus,
  Square,
  Sparkles,
  Layers,
  Wrench,
  Activity,
  FileText,
  Sliders,
  CornerDownRight,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

export interface QuickCommandItem {
  id: string;
  title: string;
  keywords: string[];
  category: "criar" | "modificar" | "analise" | "documento" | "dual_tool";
  description: string;
  icon: typeof Search;
  shortcut?: string;
  action: () => void;
}

interface ChamferQuickCommandModalProps {
  open: boolean;
  onClose: () => void;
  commands: QuickCommandItem[];
}

export function ChamferQuickCommandModal({
  open,
  onClose,
  commands,
}: ChamferQuickCommandModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 10);

    return commands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.description.toLowerCase().includes(q)) return true;
      return cmd.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [query, commands]);

  const handleSelect = (cmd: QuickCommandItem) => {
    triggerHaptic("selection");
    AudioManager.play("ui_select");
    onClose();
    cmd.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]!);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">Quick Command CAD</DialogTitle>
        <div className="flex items-center px-4 py-3 border-b border-border/50 gap-3">
          <Search className="w-5 h-5 text-accent shrink-0 animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Comando rápido... (ex: centralizar, trim, flange, dividir)"
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm font-sans"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted/60 text-muted-foreground rounded border border-border">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/20 p-1.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum comando CAD correspondente. Tente "linha", "trim", "centralizar", "furo".
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? "bg-accent/15 text-accent border border-accent/30" : "hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-accent text-accent-foreground" : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wide truncate">
                        {cmd.title}
                      </span>
                      {cmd.shortcut && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted/80 rounded border border-border/40 text-muted-foreground">
                          {cmd.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {cmd.description}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>CALDRA CAD QUICK COMMAND</span>
          <span>ENTER para executar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
