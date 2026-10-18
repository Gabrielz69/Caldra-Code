import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Save,
  RotateCcw,
  Sliders,
  Ruler,
  Grid,
  Check,
  Clock,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  getChamferSettings,
  saveChamferSettings,
  type ChamferSettings,
} from "@/lib/lab2d/projectSettings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChamferProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | undefined;
  projectName?: string | undefined;
}

export function ChamferProjectSettingsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ChamferProjectSettingsDialogProps) {
  const [settings, setSettings] = useState<ChamferSettings>(() =>
    getChamferSettings(projectId),
  );

  useEffect(() => {
    if (open) {
      setSettings(getChamferSettings(projectId));
    }
  }, [open, projectId]);

  const handleUpdate = (patch: Partial<ChamferSettings>) => {
    const updated = saveChamferSettings(patch, projectId);
    setSettings(updated);
  };

  const handleSaveAndClose = () => {
    toast.success("Configurações do CHAMFER salvas com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[min(90vh,600px)] overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-slate-100 shadow-2xl font-mono text-[11px]">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
                <Sliders className="size-4" />
              </div>
              <div>
                <DialogTitle className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                  Configurações · CHAMFER CAD
                </DialogTitle>
                <DialogDescription className="font-mono text-[10px] text-slate-400">
                  {projectName
                    ? `Preferências do projeto: ${projectName}`
                    : "Configurações padrão para novos projetos"}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SEÇÃO 1: SALVAMENTO AUTOMÁTICO */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="size-4 text-red-400" />
                <div>
                  <h4 className="font-bold text-[11px] text-slate-200 uppercase tracking-wide">
                    Salvamento Automático
                  </h4>
                  <p className="text-[9.5px] text-slate-400">
                    Gravação periódica em segundo plano no armazenamento local do navegador
                  </p>
                </div>
              </div>

              {/* TOGGLE ON / OFF */}
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                <button
                  type="button"
                  onClick={() => handleUpdate({ autoSave: true })}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                    settings.autoSave
                      ? "bg-red-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  ON
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ autoSave: false })}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                    !settings.autoSave
                      ? "bg-slate-700 text-slate-200 shadow-xs"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  OFF
                </button>
              </div>
            </div>

            {/* INTERVALO DE SALVAMENTO AUTOMÁTICO */}
            <div
              className={cn(
                "pt-2 border-t border-slate-800/80 transition-opacity",
                !settings.autoSave && "opacity-40 pointer-events-none",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-300">
                  <Clock className="size-3.5 text-slate-400" />
                  Intervalo de Gravação Automática
                </span>
                <span className="font-bold text-red-400 text-[10px]">
                  {settings.autoSaveIntervalSec < 60
                    ? `${settings.autoSaveIntervalSec} segundos`
                    : `${settings.autoSaveIntervalSec / 60} min`}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { sec: 10, label: "10s" },
                  { sec: 15, label: "15s" },
                  { sec: 30, label: "30s" },
                  { sec: 60, label: "1 min" },
                  { sec: 120, label: "2 min" },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => handleUpdate({ autoSaveIntervalSec: item.sec })}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-center font-bold text-[9.5px] transition-all",
                      settings.autoSaveIntervalSec === item.sec
                        ? "border-red-500 bg-red-950/60 text-red-300 shadow-xs"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RECUPERAÇÃO DE SESSÃO */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span className="text-[10px] text-slate-300">
                  Proteção e Recuperação contra Falhas (Crash Recovery)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdate({ recoveryEnabled: !settings.recoveryEnabled })}
                className={cn(
                  "size-5 rounded grid place-items-center border transition-all",
                  settings.recoveryEnabled
                    ? "border-emerald-500 bg-emerald-950 text-emerald-400"
                    : "border-slate-700 bg-slate-900 text-transparent",
                )}
              >
                <Check className="size-3.5" />
              </button>
            </div>
          </div>

          {/* SEÇÃO 2: UNIDADES E PRECISÃO */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Ruler className="size-4 text-amber-400" />
              <h4 className="font-bold text-[11px] text-slate-200 uppercase tracking-wide">
                Unidades & Precisão Dimensional
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[9.5px] text-slate-400 mb-1 uppercase tracking-wider">
                  Unidade Padrão
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: "mm", label: "Milímetro (mm)" },
                    { id: "cm", label: "Centímetro (cm)" },
                    { id: "pol", label: "Polegada (in)" },
                  ].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleUpdate({ unit: u.id as ChamferSettings["unit"] })}
                      className={cn(
                        "rounded-lg border px-1.5 py-1 text-center font-bold text-[9px] uppercase transition-all",
                        settings.unit === u.id
                          ? "border-amber-500 bg-amber-950/60 text-amber-300"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                      )}
                    >
                      {u.id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] text-slate-400 mb-1 uppercase tracking-wider">
                  Casas Decimais
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { val: 0, label: "0 (1 mm)" },
                    { val: 1, label: "1 (0.1 mm)" },
                    { val: 2, label: "2 (0.01 mm)" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => handleUpdate({ dimPrecision: p.val })}
                      className={cn(
                        "rounded-lg border px-1.5 py-1 text-center font-bold text-[9px] uppercase transition-all",
                        settings.dimPrecision === p.val
                          ? "border-amber-500 bg-amber-950/60 text-amber-300"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                      )}
                    >
                      {p.val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: VISUALIZAÇÃO E INTERFACE */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Grid className="size-4 text-blue-400" />
              <h4 className="font-bold text-[11px] text-slate-200 uppercase tracking-wide">
                Preferências de Visualização e Interface
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2 cursor-pointer hover:border-slate-700">
                <span className="text-[10px] text-slate-300">Grade CAD Inicial Ativa</span>
                <input
                  type="checkbox"
                  checked={settings.showGridOnLoad}
                  onChange={(e) => handleUpdate({ showGridOnLoad: e.target.checked })}
                  className="rounded border-slate-700 accent-red-600 size-3.5"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2 cursor-pointer hover:border-slate-700">
                <span className="text-[10px] text-slate-300">Snap Magnético Inicial</span>
                <input
                  type="checkbox"
                  checked={settings.snapOnLoad}
                  onChange={(e) => handleUpdate({ snapOnLoad: e.target.checked })}
                  className="rounded border-slate-700 accent-red-600 size-3.5"
                />
              </label>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => {
              handleUpdate({
                autoSave: true,
                autoSaveIntervalSec: 30,
                recoveryEnabled: true,
                unit: "mm",
                dimPrecision: 1,
                showGridOnLoad: true,
                snapOnLoad: true,
              });
              toast.info("Configurações redefinidas para os padrões.");
            }}
            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-200"
          >
            <RotateCcw className="size-3" /> Restaurar Padrões
          </button>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/50 bg-red-600 px-4 py-2 font-bold text-white uppercase shadow-md hover:bg-red-500 transition-colors"
          >
            <Check className="size-3.5" /> Concluir & Salvar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
