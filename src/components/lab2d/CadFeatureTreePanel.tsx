/**
 * CALDRA CAD — PARAMETRIC FEATURE TREE PANEL (FASE 05)
 *
 * Painel interativo de gestão da Árvore de Recursos (Feature Tree).
 * Permite inserção de operações (Caixa, Furo, Filete, Chanfro, Extrusão),
 * edição inline de parâmetros, supressão, exclusão e Rollback histórico.
 */

import { useState } from "react";
import {
  Box,
  CircleDot,
  Layers,
  Scissors,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  History,
  RotateCcw,
  Download,
} from "lucide-react";
import type { CadFeatureNode, CadFeatureType } from "@/lib/cad/features/CadFeatureModel";
import type { CadFeatureTree } from "@/lib/cad/features/CadFeatureTree";
import { cn } from "@/lib/utils";

interface CadFeatureTreePanelProps {
  tree: CadFeatureTree;
  features: readonly CadFeatureNode[];
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onRebuild: () => Promise<void>;
  rollbackIndex: number;
  onSetRollback: (index: number) => void;
  className?: string;
}

export function CadFeatureTreePanel({
  tree,
  features,
  selectedFeatureId,
  onSelectFeature,
  onRebuild,
  rollbackIndex,
  onSetRollback,
  className,
}: CadFeatureTreePanelProps) {
  const [isAdding, setIsAdding] = useState(false);

  const selectedFeature = features.find((f) => f.id === selectedFeatureId);

  // Manipulador de adição rápida de novo recurso CAD
  const handleAddFeature = async (type: CadFeatureType) => {
    setIsAdding(false);
    switch (type) {
      case "base_box":
        tree.addFeature({
          name: `Caixa Sólida ${features.length + 1}`,
          type: "base_box",
          parameters: { width: 100, length: 100, height: 50, centered: true },
        });
        break;

      case "hole_cut":
        tree.addFeature({
          name: `Furo Ø20 mm`,
          type: "hole_cut",
          parameters: { diameter: 20, depth: 60, isThrough: true, position: { x: 0, y: 0, z: -25 } },
        });
        break;

      case "fillet":
        tree.addFeature({
          name: `Filete R4 mm`,
          type: "fillet",
          parameters: { radius: 4, edgeIndices: [0, 1] },
        });
        break;

      case "chamfer":
        tree.addFeature({
          name: `Chanfro 3 mm`,
          type: "chamfer",
          parameters: { distance: 3, edgeIndices: [2, 3] },
        });
        break;

      case "base_cylinder":
        tree.addFeature({
          name: `Cilindro Base`,
          type: "base_cylinder",
          parameters: { radius: 25, height: 60, centered: true },
        });
        break;
    }

    await onRebuild();
  };

  // Manipulador de supressão de recurso
  const handleToggleSuppression = async (featureId: string, currentSuppressed: boolean) => {
    tree.setFeatureSuppression(featureId, !currentSuppressed);
    await onRebuild();
  };

  // Manipulador de exclusão de recurso
  const handleDeleteFeature = async (featureId: string) => {
    tree.deleteFeature(featureId);
    if (selectedFeatureId === featureId) {
      onSelectFeature(null);
    }
    await onRebuild();
  };

  // Ícone por tipo de recurso
  const getFeatureIcon = (type: CadFeatureType) => {
    switch (type) {
      case "base_box":
        return <Box className="size-3.5 text-accent" />;
      case "base_cylinder":
        return <CircleDot className="size-3.5 text-blue-400" />;
      case "hole_cut":
        return <Scissors className="size-3.5 text-red-400" />;
      case "fillet":
        return <Sparkles className="size-3.5 text-emerald-400" />;
      case "chamfer":
        return <Sparkles className="size-3.5 text-amber-400" />;
      default:
        return <Layers className="size-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-line bg-card/95 p-3 shadow-2xl backdrop-blur-md font-mono text-[11px]",
        className,
      )}
    >
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-foreground">
          <Layers className="size-4 text-accent" />
          <span>Árvore de Recursos (DAG)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={async () => {
              try {
                const doc = await tree.toCadDocument();
                const blob = doc.toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${doc.name || "modelo_paramétrico"}.chamfer`;
                a.click();
                URL.revokeObjectURL(a.href);
              } catch (err) {
                console.error("Falha ao exportar .chamfer:", err);
              }
            }}
            className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-foreground transition-colors hover:bg-muted"
            title="Exportar Formato Nativo Paramétrico (.chamfer)"
          >
            <Download className="size-2.5 text-accent" /> .CHAMFER
          </button>
          <button
            type="button"
            onClick={() => onRebuild()}
            className="flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent transition-colors hover:bg-accent/25"
            title="Reconstruir Árvore (Rebuild)"
          >
            <RotateCcw className="size-2.5" /> REBUILD
          </button>
        </div>
      </div>

      {/* BARRA DE ADIÇÃO DE OPERAÇÕES */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsAdding((a) => !a)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line/80 bg-background/60 py-1.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="size-3 text-accent" /> Adicionar Operação Paramétrica
        </button>

        {isAdding && (
          <div className="absolute top-8 left-0 right-0 z-30 flex flex-col gap-1 rounded-lg border border-line bg-popover p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => handleAddFeature("base_box")}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-muted text-foreground"
            >
              <Box className="size-3 text-accent" /> Caixa Sólida (Base Box)
            </button>
            <button
              type="button"
              onClick={() => handleAddFeature("hole_cut")}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-muted text-foreground"
            >
              <Scissors className="size-3 text-red-400" /> Furo Cilíndrico (Hole Cut)
            </button>
            <button
              type="button"
              onClick={() => handleAddFeature("fillet")}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-muted text-foreground"
            >
              <Sparkles className="size-3 text-emerald-400" /> Filete de Arestas (Fillet)
            </button>
            <button
              type="button"
              onClick={() => handleAddFeature("chamfer")}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-muted text-foreground"
            >
              <Sparkles className="size-3 text-amber-400" /> Chanfro de Arestas (Chamfer)
            </button>
            <button
              type="button"
              onClick={() => handleAddFeature("base_cylinder")}
              className="flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] hover:bg-muted text-foreground"
            >
              <CircleDot className="size-3 text-blue-400" /> Cilindro Base
            </button>
          </div>
        )}
      </div>

      {/* LISTA VERTICAL DE OPERAÇÕES PARAMÉTRICAS */}
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-0.5">
        {features.length === 0 ? (
          <div className="py-4 text-center text-[10px] text-muted-foreground italic">
            Nenhuma operação cadastrada.
          </div>
        ) : (
          features.map((feat, index) => {
            const isSelected = feat.id === selectedFeatureId;
            const isPastRollback = rollbackIndex >= 0 && index > rollbackIndex;

            return (
              <div
                key={feat.id}
                onClick={() => onSelectFeature(feat.id)}
                className={cn(
                  "group relative flex items-center justify-between rounded-lg border p-1.5 transition-all cursor-pointer",
                  isSelected
                    ? "border-accent bg-accent/15 text-accent-foreground"
                    : "border-line/60 bg-background/50 hover:bg-background/80 text-foreground",
                  feat.isSuppressed && "opacity-50 grayscale",
                  isPastRollback && "opacity-40 border-dashed",
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[9px] text-muted-foreground w-3 text-right">{index + 1}</span>
                  {getFeatureIcon(feat.type)}
                  <span className="truncate font-semibold text-[10px]">{feat.name}</span>
                </div>

                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                  {/* Status Badge */}
                  {feat.state === "VALID" ? (
                    <CheckCircle2 className="size-3 text-emerald-400" />
                  ) : feat.state === "ERROR" ? (
                    <AlertCircle className="size-3 text-destructive" />
                  ) : null}

                  {/* Toggle Supressão */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleSuppression(feat.id, feat.isSuppressed);
                    }}
                    title={feat.isSuppressed ? "Ativar recurso" : "Suprimir recurso"}
                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    {feat.isSuppressed ? (
                      <EyeOff className="size-3 text-muted-foreground" />
                    ) : (
                      <Eye className="size-3 text-accent" />
                    )}
                  </button>

                  {/* Excluir */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteFeature(feat.id);
                    }}
                    title="Excluir recurso"
                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONTROLE DE ROLLBACK HISTÓRICO */}
      <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <History className="size-3 text-accent" /> Histórico Rollback:
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSetRollback(-1)}
            className={cn(
              "rounded px-1.5 py-0.5 font-bold uppercase",
              rollbackIndex === -1 ? "bg-accent/20 text-accent" : "hover:text-foreground",
            )}
          >
            Fim
          </button>
          {features.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSetRollback(i)}
              className={cn(
                "rounded px-1.5 py-0.5 font-bold",
                rollbackIndex === i ? "bg-accent/20 text-accent font-bold" : "hover:text-foreground",
              )}
            >
              #{i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* INSPETOR INLINE DO RECURSO SELECIONADO */}
      {selectedFeature && (
        <div className="flex flex-col gap-1.5 border-t border-line/80 pt-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-foreground">
            <span>Parâmetros: {selectedFeature.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[8.5px] uppercase text-muted-foreground">
              {selectedFeature.type}
            </span>
          </div>

          {/* PARÂMETROS PARA CAIXA BASE */}
          {selectedFeature.type === "base_box" && (
            <div className="grid grid-cols-3 gap-1.5 text-[9px]">
              <div>
                <label className="text-muted-foreground">Largura X</label>
                <input
                  type="number"
                  value={(selectedFeature.parameters as any).width}
                  onChange={(e) => {
                    tree.updateFeature(selectedFeature.id, {
                      width: Math.max(5, Number(e.target.value)),
                    });
                    void onRebuild();
                  }}
                  className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
                />
              </div>
              <div>
                <label className="text-muted-foreground">Compr. Y</label>
                <input
                  type="number"
                  value={(selectedFeature.parameters as any).length}
                  onChange={(e) => {
                    tree.updateFeature(selectedFeature.id, {
                      length: Math.max(5, Number(e.target.value)),
                    });
                    void onRebuild();
                  }}
                  className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
                />
              </div>
              <div>
                <label className="text-muted-foreground">Espessura Z</label>
                <input
                  type="number"
                  value={(selectedFeature.parameters as any).height}
                  onChange={(e) => {
                    tree.updateFeature(selectedFeature.id, {
                      height: Math.max(2, Number(e.target.value)),
                    });
                    void onRebuild();
                  }}
                  className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
                />
              </div>
            </div>
          )}

          {/* PARÂMETROS PARA FURO CILÍNDRICO */}
          {selectedFeature.type === "hole_cut" && (
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              <div>
                <label className="text-muted-foreground">Diâmetro Ø (mm)</label>
                <input
                  type="number"
                  value={(selectedFeature.parameters as any).diameter}
                  onChange={(e) => {
                    tree.updateFeature(selectedFeature.id, {
                      diameter: Math.max(2, Number(e.target.value)),
                    });
                    void onRebuild();
                  }}
                  className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
                />
              </div>
              <div>
                <label className="text-muted-foreground">Profundidade (mm)</label>
                <input
                  type="number"
                  value={(selectedFeature.parameters as any).depth}
                  onChange={(e) => {
                    tree.updateFeature(selectedFeature.id, {
                      depth: Math.max(1, Number(e.target.value)),
                    });
                    void onRebuild();
                  }}
                  className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
                />
              </div>
            </div>
          )}

          {/* PARÂMETROS PARA FILETE */}
          {selectedFeature.type === "fillet" && (
            <div className="text-[9px]">
              <label className="text-muted-foreground">Raio do Filete (mm)</label>
              <input
                type="number"
                value={(selectedFeature.parameters as any).radius}
                onChange={(e) => {
                  tree.updateFeature(selectedFeature.id, {
                    radius: Math.max(0.5, Number(e.target.value)),
                  });
                  void onRebuild();
                }}
                className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
              />
            </div>
          )}

          {/* PARÂMETROS PARA CHANFRO */}
          {selectedFeature.type === "chamfer" && (
            <div className="text-[9px]">
              <label className="text-muted-foreground">Distância do Chanfro (mm)</label>
              <input
                type="number"
                value={(selectedFeature.parameters as any).distance}
                onChange={(e) => {
                  tree.updateFeature(selectedFeature.id, {
                    distance: Math.max(0.5, Number(e.target.value)),
                  });
                  void onRebuild();
                }}
                className="mt-0.5 w-full rounded border border-line bg-background px-1.5 py-0.5 text-foreground"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
