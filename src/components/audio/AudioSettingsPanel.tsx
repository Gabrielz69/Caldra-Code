import { useState } from "react";
import {
  Volume2,
  VolumeX,
  Volume1,
  Music,
  Sliders,
  Sparkles,
  MousePointer,
  Crosshair,
  Volume,
  Check,
  Download,
  Loader2,
  Play,
  Pause,
  Disc,
} from "lucide-react";
import { toast } from "sonner";
import { useAudio } from "@/lib/audio/AudioProvider";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { cn } from "@/lib/utils";

export function AudioSettingsPanel({ className }: { className?: string }) {
  const {
    masterVolume,
    musicVolume,
    effectsVolume,
    uiVolume,
    isMuted,
    uiSoundsEnabled,
    cadEffectsEnabled,
    musicEnabled,
    selectionSoundsEnabled,
    setMasterVolume,
    setMusicVolume,
    setEffectsVolume,
    setUiVolume,
    toggleMute,
    setVolumePreset,
    toggleUiSounds,
    toggleCadEffects,
    toggleMusic,
    toggleSelectionSounds,
    play,
    playMusic,
    stopMusic,
  } = useAudio();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const handleDownloadMp3 = async () => {
    setIsDownloading(true);
    try {
      play("ui_action");

      // Baixa via Blob para garantir nome e extensão mp3 exatos em qualquer navegador
      const res = await fetch("/audio/caldra-trilha-sonora-principal.mp3");
      if (!res.ok) {
        throw new Error("Arquivo não encontrado.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "caldra-trilha-sonora-principal.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setDownloaded(true);
      toast.success("Download da trilha sonora principal concluído!", {
        description: "CALDRA Horizon · MP3 320 kbps (4.5 MB)",
      });
      setTimeout(() => setDownloaded(false), 4000);
    } catch (err) {
      console.warn("Fallback para download direto do MP3:", err);
      // Fallback direto
      const a = document.createElement("a");
      a.href = "/audio/caldra-trilha-sonora-principal.mp3";
      a.download = "caldra-trilha-sonora-principal.mp3";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Iniciando download do MP3...");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTogglePreview = () => {
    if (isPlayingPreview) {
      stopMusic();
      setIsPlayingPreview(false);
      play("ui_click");
    } else {
      playMusic("caldra_main");
      setIsPlayingPreview(true);
      play("ui_select");
    }
  };

  return (
    <Panel className={cn("space-y-4 p-4", className)}>
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <SectionLabel
          action={
            isMuted ? (
              <VolumeX className="size-4 text-destructive" />
            ) : (
              <Volume2 className="size-4 text-accent" />
            )
          }
        >
          Áudio & Identidade Sonora
        </SectionLabel>

        {/* BOTÃO MODO SILENCIOSO */}
        <button
          type="button"
          onClick={() => {
            toggleMute();
            if (isMuted) play("ui_action");
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wider uppercase transition-all shadow-2xs",
            isMuted
              ? "border-destructive/40 bg-destructive/15 text-destructive"
              : "border-line bg-card hover:bg-muted text-muted-foreground",
          )}
        >
          {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          <span>{isMuted ? "Silencioso Ativo" : "Modo Silencioso"}</span>
        </button>
      </div>

      <p className="text-[12.5px] text-muted-foreground">
        Identidade sonora com ambiência espacial e resposta tátil inspirada nos menus tecnológicos
        dos clássicos consoles industriais dos anos 2000.
      </p>

      {/* PRESETS DE VOLUME RÁPIDOS */}
      <div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Nível de Volume
        </span>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {(
            [
              { id: "mute", label: "Mudo", icon: VolumeX },
              { id: "low", label: "Baixo (30%)", icon: Volume },
              { id: "mid", label: "Médio (65%)", icon: Volume1 },
              { id: "high", label: "Alto (100%)", icon: Volume2 },
            ] as const
          ).map((p) => {
            const isSelected =
              p.id === "mute"
                ? isMuted
                : !isMuted &&
                  ((p.id === "low" && masterVolume <= 0.4) ||
                    (p.id === "mid" && masterVolume > 0.4 && masterVolume <= 0.8) ||
                    (p.id === "high" && masterVolume > 0.8));

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setVolumePreset(p.id);
                  if (p.id !== "mute") play("ui_select");
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border p-2 font-mono text-[10px] font-medium transition-all",
                  isSelected
                    ? "border-accent/30 bg-accent/10 text-accent font-bold shadow-2xs"
                    : "border-line text-muted-foreground hover:bg-muted/60",
                )}
              >
                <p.icon className="size-3.5" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTROLES DESLIZANTES INDEPENDENTES */}
      <div className="space-y-3 pt-2 border-t border-line/60">
        {/* VOLUME GERAL */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <Volume2 className="size-3.5 text-accent" /> Volume Geral (SOM)
            </span>
            <span className="text-muted-foreground">
              {isMuted ? "0%" : `${Math.round(masterVolume * 100)}%`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : Math.round(masterVolume * 100)}
            onChange={(e) => {
              setMasterVolume(Number(e.target.value) / 100);
            }}
            className="h-1.5 w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>

        {/* MÚSICA AMBIENTE */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <Music className="size-3.5 text-accent" /> Música Ambiente
            </span>
            <span className="text-muted-foreground">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(musicVolume * 100)}
            onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
            className="h-1.5 w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>

        {/* EFEITOS CAD */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <Crosshair className="size-3.5 text-accent" /> Efeitos CAD & Kernel
            </span>
            <span className="text-muted-foreground">{Math.round(effectsVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(effectsVolume * 100)}
            onChange={(e) => setEffectsVolume(Number(e.target.value) / 100)}
            className="h-1.5 w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>

        {/* INTERFACE */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <MousePointer className="size-3.5 text-accent" /> Sons da Interface
            </span>
            <span className="text-muted-foreground">{Math.round(uiVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(uiVolume * 100)}
            onChange={(e) => setUiVolume(Number(e.target.value) / 100)}
            className="h-1.5 w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>
      </div>

      {/* OPÇÕES BOOLEANAS COM CHECKBOX */}
      <div className="space-y-2 pt-2 border-t border-line/60">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Canais de Feedback
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* SONS DA INTERFACE */}
          <label className="flex items-center gap-2.5 rounded-xl border border-line p-2.5 font-mono text-[11px] cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={uiSoundsEnabled}
              onChange={toggleUiSounds}
              className="size-4 rounded accent-[var(--accent)]"
            />
            <span className="text-foreground">Sons da interface</span>
          </label>

          {/* EFEITOS CAD */}
          <label className="flex items-center gap-2.5 rounded-xl border border-line p-2.5 font-mono text-[11px] cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={cadEffectsEnabled}
              onChange={toggleCadEffects}
              className="size-4 rounded accent-[var(--accent)]"
            />
            <span className="text-foreground">Efeitos CAD & Kernel</span>
          </label>

          {/* MÚSICA AMBIENTE */}
          <label className="flex items-center gap-2.5 rounded-xl border border-line p-2.5 font-mono text-[11px] cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={musicEnabled}
              onChange={toggleMusic}
              className="size-4 rounded accent-[var(--accent)]"
            />
            <span className="text-foreground">Música ambiente</span>
          </label>

          {/* SONS DE SELEÇÃO */}
          <label className="flex items-center gap-2.5 rounded-xl border border-line p-2.5 font-mono text-[11px] cursor-pointer hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={selectionSoundsEnabled}
              onChange={toggleSelectionSounds}
              className="size-4 rounded accent-[var(--accent)]"
            />
            <span className="text-foreground">Sons de seleção (B-Rep)</span>
          </label>
        </div>
      </div>

      {/* BAIXAR TRILHA SONORA PRINCIPAL EM MP3 */}
      <div className="pt-3 border-t border-line/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Music className="size-3.5 text-accent" />
            Trilha Sonora Principal
          </span>
          <span className="rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-accent">
            CALDRA HORIZON · MP3 320 KBPS
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-muted/20 p-3.5 space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Disc className={cn("size-4 text-accent", isPlayingPreview && "animate-spin")} />
                <h4 className="font-mono text-[12.5px] font-bold text-foreground">
                  CALDRA Horizon — Trilha Sonora Original
                </h4>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Identidade musical analógica e espacial, com pads harmônicos abertos e notas cristalinas. Baixe o arquivo de áudio MP3 de alta definição diretamente para o seu dispositivo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* BOTÃO BAIXAR MP3 */}
            <button
              type="button"
              onClick={handleDownloadMp3}
              disabled={isDownloading}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-[11.5px] font-bold transition-all shadow-xs cursor-pointer",
                downloaded
                  ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                  : "brand-gradient text-background hover:opacity-90 active:scale-[0.98]",
              )}
            >
              {isDownloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : downloaded ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>
                {isDownloading
                  ? "Baixando MP3..."
                  : downloaded
                    ? "Trilha Baixada!"
                    : "Baixar Trilha Sonora (MP3)"}
              </span>
            </button>

            {/* BOTÃO OUVIR / PREVIEW */}
            <button
              type="button"
              onClick={handleTogglePreview}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-[11px] font-medium transition-colors cursor-pointer",
                isPlayingPreview
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-line bg-card hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {isPlayingPreview ? (
                <>
                  <Pause className="size-3.5 text-accent" />
                  <span>Pausar Trilha</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  <span>Ouvir no Navegador</span>
                </>
              )}
            </button>

            <span className="font-mono text-[10.5px] text-muted-foreground ml-auto">
              4.5 MB · 320 kbps · 01:58
            </span>
          </div>
        </div>
      </div>

      {/* BOTÕES DE AMOSTRA SONORA */}
      <div className="pt-2 border-t border-line/60 flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[10px] text-muted-foreground">Testar:</span>
        <button
          type="button"
          onClick={() => play("ui_click")}
          className="rounded-lg border border-line bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Click
        </button>
        <button
          type="button"
          onClick={() => play("ui_action")}
          className="rounded-lg border border-line bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Ação
        </button>
        <button
          type="button"
          onClick={() => play("chamfer_init")}
          className="rounded-lg border border-line bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          CHAMFER
        </button>
        <button
          type="button"
          onClick={() => play("kernel_success")}
          className="rounded-lg border border-line bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Kernel OCCT
        </button>
        <button
          type="button"
          onClick={() => play("planify_sequence")}
          className="rounded-lg border border-line bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Planificar
        </button>
      </div>
    </Panel>
  );
}
