/**
 * CALDRA CAD — BOILERMAKING TEMPLATES DIALOG (FASE 07)
 *
 * Diálogo industrial para seleção e configuração de modelos clássicos
 * de caldeiraria e traçagem da CALDRA diretamente no CAD CORE B-Rep:
 * 1. Cone Truncado / Reduções
 * 2. Transição Quadrado para Redondo
 * 3. Curva de Gomos (Cotovelo)
 * 4. Boca de Lobo / Tê
 * 5. Chapéu Chinês
 */

import { useState } from "react";
import {
  Layers,
  Wand2,
  X,
  Check,
  Flame,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { CadFeatureTree } from "@/lib/cad/features/CadFeatureTree";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type BoilermakingModelId =
  | "cone"
  | "square_to_round"
  | "elbow"
  | "branch"
  | "hood";

interface CaldraBoilermakingDialogProps {
  open: boolean;
  onClose: () => void;
  tree: CadFeatureTree;
  onRebuild: () => Promise<void>;
}

export function CaldraBoilermakingDialog({
  open,
  onClose,
  tree,
  onRebuild,
}: CaldraBoilermakingDialogProps) {
  const [selectedModel, setSelectedModel] = useState<BoilermakingModelId>("square_to_round");
  const [loading, setLoading] = useState(false);

  // Parâmetros Cone Truncado
  const [coneD, setConeD] = useState(120);
  const [coneDMinor, setConeDMinor] = useState(70);
  const [coneH, setConeH] = useState(100);
  const [coneT, setConeT] = useState(3.17);

  // Parâmetros Quadrado para Redondo
  const [qtrW, setQtrW] = useState(120);
  const [qtrL, setQtrL] = useState(120);
  const [qtrDia, setQtrDia] = useState(80);
  const [qtrH, setQtrH] = useState(100);
  const [qtrT, setQtrT] = useState(4.75);

  // Parâmetros Curva de Gomos
  const [elbowDia, setElbowDia] = useState(80);
  const [elbowRadius, setElbowRadius] = useState(120);
  const [elbowAngle, setElbowAngle] = useState(90);
  const [elbowSegs, setElbowSegs] = useState(4);
  const [elbowT, setElbowT] = useState(3.17);

  // Parâmetros Boca de Lobo / Tê
  const [teeMainDia, setTeeMainDia] = useState(100);
  const [teeBranchDia, setTeeBranchDia] = useState(60);
  const [teeMainLen, setTeeMainLen] = useState(180);
  const [teeBranchH, setTeeBranchH] = useState(80);
  const [teeT, setTeeT] = useState(4.75);

  // Parâmetros Chapéu Chinês
  const [hoodBaseDia, setHoodBaseDia] = useState(160);
  const [hoodTopDia, setHoodTopDia] = useState(35);
  const [hoodH, setHoodH] = useState(60);
  const [hoodT, setHoodT] = useState(2.0);

  if (!open) return null;

  const handleApplyTemplate = async () => {
    setLoading(true);
    try {
      tree.dispose(); // Limpa sólido anterior para gerar a peça de caldeiraria como base

      if (selectedModel === "cone") {
        tree.addFeature({
          name: `Cone Truncado Ø${coneD}×Ø${coneDMinor} mm`,
          type: "boilermaking_cone",
          parameters: {
            D: coneD,
            d: coneDMinor,
            height: coneH,
            thickness: coneT,
          },
        });
      } else if (selectedModel === "square_to_round") {
        tree.addFeature({
          name: `Transição QtoR ${qtrW}×${qtrL} ➔ Ø${qtrDia} mm`,
          type: "boilermaking_transition",
          parameters: {
            width: qtrW,
            length: qtrL,
            diameter: qtrDia,
            height: qtrH,
            thickness: qtrT,
          },
        });
      } else if (selectedModel === "elbow") {
        tree.addFeature({
          name: `Curva de Gomos Ø${elbowDia} mm (${elbowSegs} gomos, ${elbowAngle}°)`,
          type: "boilermaking_elbow",
          parameters: {
            diameter: elbowDia,
            radius: elbowRadius,
            angleDeg: elbowAngle,
            segments: elbowSegs,
            thickness: elbowT,
          },
        });
      } else if (selectedModel === "branch") {
        tree.addFeature({
          name: `Boca de Lobo / Tê Ø${teeMainDia} ➔ Ø${teeBranchDia} mm`,
          type: "boilermaking_branch",
          parameters: {
            mainDiameter: teeMainDia,
            branchDiameter: teeBranchDia,
            mainLength: teeMainLen,
            branchHeight: teeBranchH,
            thickness: teeT,
          },
        });
      } else if (selectedModel === "hood") {
        tree.addFeature({
          name: `Chapéu Chinês Ø${hoodBaseDia} mm`,
          type: "boilermaking_hood",
          parameters: {
            baseDiameter: hoodBaseDia,
            topDiameter: hoodTopDia,
            height: hoodH,
            thickness: hoodT,
          },
        });
      }

      await onRebuild();
      toast.success("Modelo de caldeiraria gerado no CAD Core B-Rep com sucesso!");
      onClose();
    } catch (err) {
      console.error("[CaldraBoilermakingDialog] Erro:", err);
      toast.error("Falha ao gerar sólido de caldeiraria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex w-[min(94vw,560px)] max-h-[min(92vh,560px)] overflow-y-auto flex-col gap-3 rounded-2xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-md font-mono text-[10px] text-foreground">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-accent" />
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                Modelos Paramétricos de Caldeiraria CALDRA
              </h3>
              <p className="text-[8.5px] text-muted-foreground">
                Gera sólidos B-Rep analíticos no OCCT integrados à árvore de recursos
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

        {/* SELETOR DE MODELOS DE TRAÇAGEM */}
        <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-line/60 bg-background/50 p-1">
          {[
            { id: "square_to_round", label: "QtoR", desc: "Transição Quadrado-Redondo" },
            { id: "cone", label: "Cone", desc: "Cone Truncado / Redução" },
            { id: "elbow", label: "Cotovelo", desc: "Curva de Gomos" },
            { id: "branch", label: "Boca Lobo", desc: "Tê / Derivação" },
            { id: "hood", label: "Chapéu", desc: "Chapéu Chinês" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModel(m.id as BoilermakingModelId)}
              className={cn(
                "flex flex-col items-center justify-center rounded-md py-1.5 px-1 text-center font-mono transition-all",
                selectedModel === m.id
                  ? "bg-accent/20 text-accent font-bold border border-accent/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              <span className="text-[9.5px] uppercase font-bold">{m.label}</span>
            </button>
          ))}
        </div>

        {/* ÁREA DE CONFIGURAÇÃO DE PARÂMETROS DO MODELO */}
        <div className="flex flex-col gap-2 rounded-xl border border-line/60 bg-background/40 p-3">
          {/* TRANSIÇÃO QUADRADO PARA REDONDO */}
          {selectedModel === "square_to_round" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Base Largura X (mm)</label>
                <input
                  type="number"
                  value={qtrW}
                  onChange={(e) => setQtrW(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Base Comprimento Y (mm)</label>
                <input
                  type="number"
                  value={qtrL}
                  onChange={(e) => setQtrL(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Superior Ø (mm)</label>
                <input
                  type="number"
                  value={qtrDia}
                  onChange={(e) => setQtrDia(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Altura Total H (mm)</label>
                <input
                  type="number"
                  value={qtrH}
                  onChange={(e) => setQtrH(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[8.5px] text-muted-foreground uppercase">Espessura da Chapa (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={qtrT}
                  onChange={(e) => setQtrT(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-accent font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* CONE TRUNCADO */}
          {selectedModel === "cone" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Maior Base D (mm)</label>
                <input
                  type="number"
                  value={coneD}
                  onChange={(e) => setConeD(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Menor Topo d (mm)</label>
                <input
                  type="number"
                  value={coneDMinor}
                  onChange={(e) => setConeDMinor(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Altura H (mm)</label>
                <input
                  type="number"
                  value={coneH}
                  onChange={(e) => setConeH(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Espessura da Chapa (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={coneT}
                  onChange={(e) => setConeT(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-accent font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* CURVA DE GOMOS (COTOVELO) */}
          {selectedModel === "elbow" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Nominal Ø (mm)</label>
                <input
                  type="number"
                  value={elbowDia}
                  onChange={(e) => setElbowDia(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Raio Curvatura R (mm)</label>
                <input
                  type="number"
                  value={elbowRadius}
                  onChange={(e) => setElbowRadius(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Ângulo Total (°)</label>
                <input
                  type="number"
                  value={elbowAngle}
                  onChange={(e) => setElbowAngle(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Quantidade de Gomos</label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={elbowSegs}
                  onChange={(e) => setElbowSegs(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[8.5px] text-muted-foreground uppercase">Espessura da Chapa (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={elbowT}
                  onChange={(e) => setElbowT(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-accent font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* BOCA DE LOBO / TÊ */}
          {selectedModel === "branch" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Tubo Principal (mm)</label>
                <input
                  type="number"
                  value={teeMainDia}
                  onChange={(e) => setTeeMainDia(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Ramal (mm)</label>
                <input
                  type="number"
                  value={teeBranchDia}
                  onChange={(e) => setTeeBranchDia(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Comprimento Tubo Principal (mm)</label>
                <input
                  type="number"
                  value={teeMainLen}
                  onChange={(e) => setTeeMainLen(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Altura do Ramal (mm)</label>
                <input
                  type="number"
                  value={teeBranchH}
                  onChange={(e) => setTeeBranchH(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[8.5px] text-muted-foreground uppercase">Espessura da Chapa (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={teeT}
                  onChange={(e) => setTeeT(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-accent font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* CHAPÉU CHINÊS */}
          {selectedModel === "hood" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Base D (mm)</label>
                <input
                  type="number"
                  value={hoodBaseDia}
                  onChange={(e) => setHoodBaseDia(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Diâmetro Topo d (mm)</label>
                <input
                  type="number"
                  value={hoodTopDia}
                  onChange={(e) => setHoodTopDia(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Altura H (mm)</label>
                <input
                  type="number"
                  value={hoodH}
                  onChange={(e) => setHoodH(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-foreground font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[8.5px] text-muted-foreground uppercase">Espessura da Chapa (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hoodT}
                  onChange={(e) => setHoodT(Number(e.target.value))}
                  className="w-full rounded border border-line bg-background px-2 py-1 text-accent font-mono font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ DO DIÁLOGO */}
        <div className="flex items-center justify-between border-t border-line/60 pt-2">
          <div className="flex items-center gap-1 text-[8.5px] text-muted-foreground">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>Topologia B-Rep Analítica (OpenCascade)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-line px-3 py-1 font-mono text-[9px] uppercase text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplyTemplate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/20 px-3 py-1 font-mono text-[9px] font-bold text-accent uppercase hover:bg-accent/30 transition-colors shadow-xs"
            >
              {loading ? "Calculando B-Rep..." : "Inserir no CAD Core"}
              <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
