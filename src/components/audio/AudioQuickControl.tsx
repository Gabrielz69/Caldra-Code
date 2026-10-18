import { useState } from "react";
import { Volume2, VolumeX, Music, Sliders, ChevronDown } from "lucide-react";
import { useAudio } from "@/lib/audio/AudioProvider";
import { cn } from "@/lib/utils";

export function AudioQuickControl({ className }: { className?: string }) {
  const {
    isMuted,
    masterVolume,
    musicVolume,
    musicEnabled,
    toggleMute,
    setMasterVolume,
    toggleMusic,
    play,
  } = useAudio();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        onClick={() => {
          toggleMute();
          if (isMuted) play("ui_click");
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        title={isMuted ? "Áudio desativado (Clique para ativar)" : "Áudio ativo (Clique para silenciar)"}
        className={cn(
          "flex h-[30px] items-center gap-1 rounded-full border px-2.5 font-mono text-[10px] font-bold tracking-wider uppercase transition-colors shadow-2xs",
          isMuted
            ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        )}
      >
        {isMuted ? (
          <VolumeX className="size-3 text-destructive" />
        ) : (
          <Volume2 className="size-3 text-slate-600" />
        )}
        <span className="hidden sm:inline" suppressHydrationWarning>
          {isMuted ? "MUDO" : `${Math.round(masterVolume * 100)}%`}
        </span>
      </button>

      {/* BOTÃO EXPANDIR MINI MENU */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Controle rápido de volume"
        className="ml-0.5 rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <ChevronDown className={cn("size-2.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-9 right-0 z-50 flex w-56 flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md font-mono text-[10px] text-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="font-bold uppercase tracking-wider text-slate-900">
                Áudio CALDRA
              </span>
              <button
                type="button"
                onClick={toggleMute}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  isMuted ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700",
                )}
              >
                {isMuted ? "Mudo" : "Ativo"}
              </button>
            </div>

            {/* SLIDER MASTER */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9.5px]">
                <span className="text-slate-500">Volume Geral:</span>
                <span className="font-bold">{isMuted ? "0%" : `${Math.round(masterVolume * 100)}%`}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : Math.round(masterVolume * 100)}
                onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
                className="h-1.5 w-full accent-red-600 cursor-pointer"
              />
            </div>

            {/* TOGGLE MÚSICA AMBIENTE */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1 text-[9.5px] text-slate-600">
                <Music className="size-3 text-slate-500" /> Trilha Ambiente
              </span>
              <button
                type="button"
                onClick={() => {
                  toggleMusic();
                  play("ui_click");
                }}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase transition-colors",
                  musicEnabled && !isMuted
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-slate-100 text-slate-400",
                )}
              >
                {musicEnabled && !isMuted ? "Ligada" : "Desligada"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
