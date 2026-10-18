/**
 * CALDRA CHAMFER — MODAL DE VARIÁVEIS E EQUAÇÕES PARAMÉTRICAS (ETAPA 21)
 *
 * Tabela interativa de parâmetros de projeto:
 *  - Criação de variáveis (LARGURA = 500, ALTURA = 300, MARGEM = 25, FURO = LARGURA / 10);
 *  - Avaliador em tempo real de expressões matemáticas;
 *  - Atualização do projeto paramétrico.
 */

import React, { useState, useEffect } from "react";
import { Sliders, Plus, Trash2, Check, RefreshCw, Variable } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  globalParametricStore,
  type ParametricVariable,
} from "@/lib/lab2d/cadParametricVariables";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

interface ChamferVariablesModalProps {
  open: boolean;
  onClose: () => void;
  onVariablesChange?: () => void;
}

export function ChamferVariablesModal({
  open,
  onClose,
  onVariablesChange,
}: ChamferVariablesModalProps) {
  const [variables, setVariables] = useState<ParametricVariable[]>([]);
  const [newName, setNewName] = useState("");
  const [newExpr, setNewExpr] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const refresh = () => {
    setVariables(globalParametricStore.getAll());
    onVariablesChange?.();
  };

  useEffect(() => {
    if (open) {
      setVariables(globalParametricStore.getAll());
    }
  }, [open]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newExpr.trim()) return;

    triggerHaptic("selection");
    AudioManager.play("ui_select");
    globalParametricStore.setVariable(newName, newExpr, newDesc);
    setNewName("");
    setNewExpr("");
    setNewDesc("");
    refresh();
  };

  const handleRemove = (name: string) => {
    triggerHaptic("selection");
    globalParametricStore.removeVariable(name);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card/95 border-border/80 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-accent">
            <Variable className="w-5 h-5" />
            <DialogTitle className="text-base font-bold tracking-tight">
              Tabela de Variáveis e Relações Paramétricas
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Defina cotas vinculadas, fórmulas e variáveis globais para desenho adaptativo.
          </DialogDescription>
        </DialogHeader>

        {/* Formulário de Nova Variável */}
        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
          <input
            type="text"
            placeholder="NOME (ex: RAIO_BASE)"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
            className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs font-mono uppercase bg-background border border-border rounded-lg outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="Expressão (ex: LARGURA / 2)"
            value={newExpr}
            onChange={(e) => setNewExpr(e.target.value)}
            className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs font-mono bg-background border border-border rounded-lg outline-none focus:border-accent"
          />
          <Button type="submit" size="sm" className="brand-gradient text-background text-xs font-semibold px-3 h-8">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adicionar
          </Button>
        </form>

        {/* Tabela de Variáveis */}
        <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-border/20">
          {variables.map((v) => (
            <div key={v.name} className="flex items-center justify-between pt-2 px-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">
                    {v.name}
                  </span>
                  <span className="text-muted-foreground text-xs">=</span>
                  <span className="font-mono text-xs text-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                    {v.expression}
                  </span>
                </div>
                {v.description && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {v.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-foreground">
                    {v.value.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {v.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(v.name)}
                  className="w-6 h-6 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2 border-t border-border/40 flex items-center justify-end">
          <Button size="sm" onClick={onClose} className="text-xs">
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
