/**
 * CALDRA CHAMFER — COMMAND PALETTE MOBILE COM IA E INTENÇÃO GEOMÉTRICA (SEÇÕES 17 E 18)
 *
 * Busca universal inteligente com execução tipada e prévia interativa:
 *  - Reconhece intenções complexas em linguagem natural:
 *      * "Chapa 500x300 com quatro furos 12mm a 25mm das bordas"
 *      * "Flange com PCD 320 e 8 furos"
 *      * "Suporte com rasgo oblongo"
 *      * "Desenvolvimento de cone truncado"
 *      * "Transição quadrado-redondo"
 *      * "Inserir 4 furos nos cantos"
 *  - Mostra prévia detalhada com entidades geradas e cotas associativas;
 *  - Confirmação explícita pelo operador antes de qualquer mutação;
 *  - Interface mobile-first (bottom sheet / modal compacto adaptativo).
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  Check,
  X,
  FileText,
  CornerDownRight,
  Layers,
  CircleDot,
  Square,
  Wrench,
  Activity,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import {
  CadSemanticIntentEngine,
  type SemanticIntentPlan,
} from "@/lib/lab2d/cadSemanticIntent";
import type { Entity, LayerId } from "@/lib/lab2d/core";
import type { QuickCommandItem } from "./ChamferQuickCommandModal";

interface ChamferSemanticPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: QuickCommandItem[];
  existingEntities: Entity[];
  activeLayer: LayerId;
  onExecutePlan: (plan: SemanticIntentPlan) => void;
}

export function ChamferSemanticPalette({
  open,
  onClose,
  commands,
  existingEntities,
  activeLayer,
  onExecutePlan,
}: ChamferSemanticPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePlan, setActivePlan] = useState<SemanticIntentPlan | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setActivePlan(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Avalia se o texto contém intenção geométrica em linguagem natural
  useEffect(() => {
    if (!query.trim()) {
      setActivePlan(null);
      return;
    }
    const plan = CadSemanticIntentEngine.parseIntent(query, existingEntities, activeLayer);
    setActivePlan(plan);
  }, [query, existingEntities, activeLayer]);

  // Filtra comandos tradicionais
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 8);

    return commands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.description.toLowerCase().includes(q)) return true;
      return cmd.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [query, commands]);

  const handleSelectCommand = (cmd: QuickCommandItem) => {
    triggerHaptic("selection");
    AudioManager.play("ui_select");
    onClose();
    cmd.action();
  };

  const handleConfirmPlan = () => {
    if (!activePlan) return;
    triggerHaptic("success");
    AudioManager.play("cad_core_init");
    onExecutePlan(activePlan);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-border/80 shadow-2xl rounded-3xl">
        <DialogTitle className="sr-only">Busca Universal & Intenção CAD</DialogTitle>

        {/* Campo de Busca com Estilo Spotlight */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/50 gap-3">
          <Sparkles className="w-5 h-5 text-accent shrink-0 animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite um comando ou descreva o que deseja criar..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setActivePlan(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* SEÇÃO 1: PLANO DE INTENÇÃO GEOMÉTRICA (IA / SEMÂNTICA) */}
        {activePlan ? (
          <div className="p-4 bg-accent/5 border-b border-accent/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-accent uppercase font-mono">
                  Plano Paramétrico Gerado
                </span>
                <h4 className="text-sm font-bold text-foreground mt-0.5">
                  {activePlan.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {activePlan.description}
                </p>
              </div>
            </div>

            {/* Resumo das entidades que serão criadas */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono bg-background/60 p-2.5 rounded-xl border border-border/40">
              <div>
                <span className="text-muted-foreground">Entidades: </span>
                <span className="font-semibold text-foreground">
                  {activePlan.generatedEntities.length} elementos
                </span>
              </div>
              {activePlan.generatedDimensions && (
                <div>
                  <span className="text-muted-foreground">Cotas: </span>
                  <span className="font-semibold text-foreground">
                    {activePlan.generatedDimensions.length} cotas associativas
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setActivePlan(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmPlan}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-accent text-accent-foreground shadow-md hover:brightness-110 active:scale-95 transition-transform"
              >
                <Check className="w-3.5 h-3.5" />
                Confirmar e Inserir no Modelo
              </button>
            </div>
          </div>
        ) : null}

        {/* SEÇÃO 2: LISTA DE COMANDOS CAD FILTRADOS */}
        <div className="max-h-72 overflow-y-auto divide-y divide-border/20 p-2">
          {filteredCommands.length === 0 && !activePlan ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum comando correspondente. Tente "chapa 500x300", "flange pcd", "suporte", "trim", "cone".
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSelectCommand(cmd)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? "bg-accent/15 text-accent border border-accent/30" : "hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted/60 text-muted-foreground">
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

        {/* Rodapé com Atalhos */}
        <div className="px-4 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>CALDRA CAD INTENT ENGINE</span>
          <span>Toque ou ENTER para executar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
