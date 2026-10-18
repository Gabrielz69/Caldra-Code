/**
 * CALDRA CAD — WELDMENTS & ESTRUTURAS METÁLICAS DIALOG (FASE 10)
 *
 * Diálogo interativo para modelagem de perfis industriais normalizados,
 * quadros soldados paramétricos e geração de Lista de Corte (Cut-List)
 * de serralheria industrial.
 */

import { useState, useMemo } from "react";
import {
  Boxes,
  Download,
  Plus,
  Scissors,
  Layers,
  FileSpreadsheet,
  X,
  Check,
  ShieldCheck,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  CaldraWeldmentBridge,
  type CutListItem,
  type WeldmentReport,
} from "@/lib/cad/weldments/CaldraWeldmentBridge";
import type { ProfileSection, ProfileType } from "@/lib/cad/weldments/types";
import type { CadFeatureTree } from "@/lib/cad/features/CadFeatureTree";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CaldraWeldmentDialogProps {
  open: boolean;
  onClose: () => void;
  tree: CadFeatureTree;
  onRebuild: () => Promise<void>;
}

export function CaldraWeldmentDialog({
  open,
  onClose,
  tree,
  onRebuild,
}: CaldraWeldmentDialogProps) {
  const [activeTab, setActiveTab] = useState<"catalog" | "frame" | "cutlist">("catalog");
  const [profileType, setProfileType] = useState<ProfileType>("RECT_TUBE");
  const [selectedDesignation, setSelectedDesignation] = useState("Tubo 80x40x3.00");
  const [memberLengthMm, setMemberLengthMm] = useState(800);
  const [miterLeftDeg, setMiterLeftDeg] = useState(90);
  const [miterRightDeg, setMiterRightDeg] = useState(90);

  // Quadro Soldado Parâmetros
  const [frameWidthMm, setFrameWidthMm] = useState(600);
  const [frameLengthMm, setFrameLengthMm] = useState(900);
  const [frameHeightMm, setFrameHeightMm] = useState(40);
  const [cornerTreatment, setCornerTreatment] = useState<"MITER" | "BUTT_1">("MITER");

  // Perfis disponíveis filtrados
  const availableProfiles = useMemo(() => {
    return CaldraWeldmentBridge.getProfilesByType(profileType);
  }, [profileType]);

  // Perfil selecionado atual
  const currentProfile: ProfileSection = useMemo(() => {
    const p = availableProfiles.find((x) => x.designation === selectedDesignation);
    return (
      p ||
      availableProfiles[0] || {
        type: "RECT_TUBE",
        designation: "Tubo Padrão",
        standard: "NBR",
        heightMm: 40,
        widthMm: 80,
        webThicknessMm: 3,
        flangeThicknessMm: 3,
        linearMassKgM: 5.35,
        areaCm2: 6.8,
      }
    );
  }, [availableProfiles, selectedDesignation]);

  // Relatório de Lista de Corte atualizado
  const report: WeldmentReport = useMemo(() => {
    return CaldraWeldmentBridge.generateCutList(tree.getFeatures());
  }, [tree, open, activeTab]);

  if (!open) return null;

  // 1. Inserir Membro Estrutural no 3D
  const handleInsertBeam = async () => {
    try {
      await tree.addFeature({
        name: `${currentProfile.designation} (L=${memberLengthMm}mm)`,
        type: "weldment_beam",
        parameters: {
          profileDesignation: currentProfile.designation,
          profileType: currentProfile.type,
          lengthMm: memberLengthMm,
          widthMm: currentProfile.widthMm,
          heightMm: currentProfile.heightMm,
          thicknessMm: currentProfile.webThicknessMm,
          linearMassKgM: currentProfile.linearMassKgM,
          miterLeftDeg,
          miterRightDeg,
        },
      });

      await onRebuild();
      toast.success(`Perfil ${currentProfile.designation} inserido no CAD Core!`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao inserir perfil.");
    }
  };

  // 2. Inserir Quadro Soldado no 3D
  const handleInsertFrame = async () => {
    try {
      await tree.addFeature({
        name: `Chassi Soldado ${frameWidthMm}x${frameLengthMm} mm`,
        type: "weldment_frame",
        parameters: {
          frameName: `Quadro ${frameWidthMm}x${frameLengthMm}`,
          profileDesignation: currentProfile.designation,
          frameWidthMm,
          frameLengthMm,
          frameHeightMm,
          cornerTreatment,
        },
      });

      await onRebuild();
      toast.success("Estrutura de chassi soldada instanciada com sucesso!");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao inserir quadro.");
    }
  };

  // 3. Download do Cut-List em CSV
  const handleDownloadCsv = () => {
    const blob = new Blob([report.csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista_de_corte_serralheria_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista de Corte (Cut-List) exportada em CSV!");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex w-[min(96vw,860px)] max-h-[min(92vh,560px)] overflow-y-auto flex-col gap-3 rounded-2xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-md font-mono text-[10px] text-foreground">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-accent" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Estruturas Metálicas & Perfis Industriais (Weldments)
                </h3>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-[8.5px] text-accent">
                  ABNT / ASTM
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground">
                Modelagem de vigas W/I, canais U, cantoneiras, tubos e lista de corte de serralheria
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

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex items-center gap-1 border-b border-line pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "rounded px-2.5 py-1 text-[9px] font-bold uppercase transition-colors",
              activeTab === "catalog"
                ? "bg-accent/20 text-accent font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Membro Estrutural
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("frame")}
            className={cn(
              "rounded px-2.5 py-1 text-[9px] font-bold uppercase transition-colors",
              activeTab === "frame"
                ? "bg-accent/20 text-accent font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Quadro / Chassi Soldado
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cutlist")}
            className={cn(
              "rounded px-2.5 py-1 text-[9px] font-bold uppercase transition-colors",
              activeTab === "cutlist"
                ? "bg-accent/20 text-accent font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Lista de Corte (Cut-List)
          </button>
        </div>

        {/* CONTEÚDO DA ABA 1: MEMBRO ESTRUTURAL */}
        {activeTab === "catalog" && (
          <div className="flex flex-col gap-3">
            {/* SELEÇÃO DE FAMÍLIA DE PERFIL */}
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { type: "RECT_TUBE", label: "Tubo Metalon" },
                { type: "I_BEAM", label: "Viga W / I" },
                { type: "U_CHANNEL", label: "Canal U" },
                { type: "L_ANGLE", label: "Cantoneira L" },
                { type: "ROUND_TUBE", label: "Tubo Sch 40" },
              ].map((f) => (
                <button
                  key={f.type}
                  type="button"
                  onClick={() => {
                    setProfileType(f.type as ProfileType);
                    const list = CaldraWeldmentBridge.getProfilesByType(f.type as ProfileType);
                    if (list[0]) setSelectedDesignation(list[0].designation);
                  }}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-center font-mono text-[8.5px] font-bold uppercase transition-colors",
                    profileType === f.type
                      ? "border-accent bg-accent/15 text-accent shadow-xs"
                      : "border-line bg-background/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* PARÂMETROS DO MEMBRO */}
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-line bg-background/60 p-3">
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Designação do Perfil</label>
                <select
                  value={selectedDesignation}
                  onChange={(e) => setSelectedDesignation(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono font-bold text-foreground"
                >
                  {availableProfiles.map((p) => (
                    <option key={p.designation} value={p.designation}>
                      {p.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Comprimento (L, mm)</label>
                <input
                  type="number"
                  value={memberLengthMm}
                  onChange={(e) => setMemberLengthMm(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                />
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Corte Esquerdo (°)</label>
                <select
                  value={miterLeftDeg}
                  onChange={(e) => setMiterLeftDeg(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                >
                  <option value={90}>90° (Reto)</option>
                  <option value={45}>45° (Esquadria)</option>
                  <option value={60}>60°</option>
                </select>
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Corte Direito (°)</label>
                <select
                  value={miterRightDeg}
                  onChange={(e) => setMiterRightDeg(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                >
                  <option value={90}>90° (Reto)</option>
                  <option value={45}>45° (Esquadria)</option>
                  <option value={60}>60°</option>
                </select>
              </div>
            </div>

            {/* FICHA TÉCNICA DO PERFIL SELECIONADO */}
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-line/60 bg-muted/20 p-2.5 text-[8.5px]">
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Dimensões da Seção</span>
                <div className="font-bold text-foreground">
                  {currentProfile.heightMm} × {currentProfile.widthMm} <span className="text-[7.5px] font-normal text-muted-foreground">mm</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Espessura Parede/Alma</span>
                <div className="font-bold text-foreground">
                  {currentProfile.webThicknessMm} <span className="text-[7.5px] font-normal text-muted-foreground">mm</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Massa Linear</span>
                <div className="font-bold text-foreground">
                  {currentProfile.linearMassKgM} <span className="text-[7.5px] font-normal text-muted-foreground">kg/m</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Massa Total Calculada</span>
                <div className="font-bold text-accent">
                  {((memberLengthMm / 1000) * currentProfile.linearMassKgM).toFixed(2)} <span className="text-[7.5px] font-normal text-muted-foreground">kg</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleInsertBeam}
                className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/20 px-3.5 py-1.5 font-bold text-accent uppercase hover:bg-accent/30 transition-colors shadow-xs"
              >
                <Plus className="size-3.5" /> Inserir Membro no CAD Core
              </button>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: QUADRO / CHASSI */}
        {activeTab === "frame" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-line bg-background/60 p-3">
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Largura do Quadro (mm)</label>
                <input
                  type="number"
                  value={frameWidthMm}
                  onChange={(e) => setFrameWidthMm(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                />
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Comprimento do Quadro (mm)</label>
                <input
                  type="number"
                  value={frameLengthMm}
                  onChange={(e) => setFrameLengthMm(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                />
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Altura do Perfil (mm)</label>
                <input
                  type="number"
                  value={frameHeightMm}
                  onChange={(e) => setFrameHeightMm(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                />
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Tratamento de Cantos</label>
                <select
                  value={cornerTreatment}
                  onChange={(e) => setCornerTreatment(e.target.value as "MITER" | "BUTT_1")}
                  className="mt-1 w-full rounded border border-line bg-background px-2 py-1 font-mono text-foreground"
                >
                  <option value="MITER">Esquadria 45° (Miter)</option>
                  <option value="BUTT_1">Encontro de Topo (Butt)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleInsertFrame}
                className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/20 px-3.5 py-1.5 font-bold text-accent uppercase hover:bg-accent/30 transition-colors shadow-xs"
              >
                <Plus className="size-3.5" /> Gerar Chassi Soldado no 3D
              </button>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 3: LISTA DE CORTE (CUT-LIST) */}
        {activeTab === "cutlist" && (
          <div className="flex flex-col gap-2">
            {/* MÉTRICAS DE SERRALHERIA */}
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-line/60 bg-background/50 p-2.5 text-[8.5px]">
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Massa Total da Estrutura</span>
                <div className="font-bold text-foreground text-xs">{report.totalMassKg} kg</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Comprimento Linear Total</span>
                <div className="font-bold text-foreground text-xs">{report.totalLengthM.toFixed(2)} m</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Barras Comerciais (6m)</span>
                <div className="font-bold text-accent text-xs">{report.commercialBars6mNeeded} barras</div>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[7.5px]">Consumo Est. Solda MIG</span>
                <div className="font-bold text-foreground text-xs">{report.weldElectrodeMassKg} kg</div>
              </div>
            </div>

            {/* TABELA DE CORTE */}
            <div className="flex h-56 flex-col overflow-auto rounded-xl border border-line bg-background/60 p-2">
              <table className="w-full text-left font-mono text-[8.5px]">
                <thead>
                  <tr className="border-b border-line text-muted-foreground uppercase text-[7.5px]">
                    <th className="py-1 px-1.5"># Item</th>
                    <th className="py-1 px-1.5">Perfil</th>
                    <th className="py-1 px-1.5">Comprimento</th>
                    <th className="py-1 px-1.5">Corte Esq</th>
                    <th className="py-1 px-1.5">Corte Dir</th>
                    <th className="py-1 px-1.5">Qtd</th>
                    <th className="py-1 px-1.5">Massa (kg)</th>
                    <th className="py-1 px-1.5">Barra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {report.cutList.map((item) => (
                    <tr key={item.itemNumber} className="hover:bg-muted/30">
                      <td className="py-1 px-1.5 font-bold text-accent">{item.itemNumber}</td>
                      <td className="py-1 px-1.5 text-foreground font-semibold">{item.profileDesignation}</td>
                      <td className="py-1 px-1.5 text-foreground">{item.lengthMm.toFixed(1)} mm</td>
                      <td className="py-1 px-1.5 text-muted-foreground">{item.miterLeftDeg}°</td>
                      <td className="py-1 px-1.5 text-muted-foreground">{item.miterRightDeg}°</td>
                      <td className="py-1 px-1.5 font-bold text-foreground">{item.quantity}</td>
                      <td className="py-1 px-1.5 text-accent">{item.totalMassKg} kg</td>
                      <td className="py-1 px-1.5 text-muted-foreground">{item.commercialBarLengthM}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/20 px-3 py-1.5 font-bold text-accent uppercase hover:bg-accent/30 transition-colors shadow-xs"
              >
                <FileSpreadsheet className="size-3.5" /> Exportar Cut-List (CSV)
              </button>
            </div>
          </div>
        )}

        {/* RODAPÉ */}
        <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[8.5px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>Massa Linear baseada nas tabelas NBR 5884 e ASTM A6 (Densidade 7.85 g/cm³)</span>
          </div>
        </div>
      </div>
    </>
  );
}
