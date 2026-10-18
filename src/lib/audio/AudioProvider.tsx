import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  audioManager,
  AudioManager,
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettingsState,
  type SoundEffectId,
} from "./AudioManager";

interface AudioContextValue extends AudioSettingsState {
  play: (soundId: SoundEffectId) => void;
  playMusic: (trackId?: string) => void;
  stopMusic: () => void;
  setMasterVolume: (val: number) => void;
  setMusicVolume: (val: number) => void;
  setEffectsVolume: (val: number) => void;
  setUiVolume: (val: number) => void;
  toggleMute: () => boolean;
  setSilentMode: (silent: boolean) => void;
  setVolumePreset: (preset: "mute" | "low" | "mid" | "high") => void;
  toggleUiSounds: () => void;
  toggleCadEffects: () => void;
  toggleMusic: () => void;
  toggleSelectionSounds: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioSettingsState>(DEFAULT_AUDIO_SETTINGS);

  useEffect(() => {
    setState(audioManager.getSettings());
    return audioManager.subscribe((newSettings) => {
      setState(newSettings);
    });
  }, []);

  // Delegação global para sons de botões e toques táteis
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastClickTime = 0;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const now = performance.now();
      if (now - lastClickTime < 35) return;

      const target = (e.target as HTMLElement | null)?.closest(
        "button, a, [role='button'], input[type='button'], input[type='submit']",
      ) as HTMLElement | null;

      if (!target) return;
      if (target.dataset.noAudio === "true") return;

      lastClickTime = now;

      const customSound = target.dataset.audio as SoundEffectId | undefined;
      if (customSound) {
        audioManager.play(customSound);
        return;
      }

      const isAction =
        target.getAttribute("type") === "submit" ||
        target.classList.contains("brand-gradient") ||
        target.classList.contains("bg-primary") ||
        target.classList.contains("pro-surface");

      const isSelected =
        target.getAttribute("aria-pressed") === "true" ||
        target.getAttribute("aria-selected") === "true" ||
        target.dataset.selected === "true" ||
        target.classList.contains("amber-ring") ||
        target.classList.contains("glow-ring");

      if (isAction) {
        audioManager.play("ui_action");
      } else if (isSelected) {
        audioManager.play("ui_select");
      } else {
        audioManager.play("ui_click");
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, []);

  const play = useCallback((soundId: SoundEffectId) => {
    audioManager.play(soundId);
  }, []);

  const playMusic = useCallback((trackId?: string) => {
    audioManager.playMusic(trackId);
  }, []);

  const stopMusic = useCallback(() => {
    audioManager.stopMusic();
  }, []);

  const setMasterVolume = useCallback((val: number) => {
    audioManager.setMasterVolume(val);
  }, []);

  const setMusicVolume = useCallback((val: number) => {
    audioManager.setMusicVolume(val);
  }, []);

  const setEffectsVolume = useCallback((val: number) => {
    audioManager.setEffectsVolume(val);
  }, []);

  const setUiVolume = useCallback((val: number) => {
    audioManager.setUiVolume(val);
  }, []);

  const toggleMute = useCallback(() => {
    return audioManager.toggleMute();
  }, []);

  const setSilentMode = useCallback((silent: boolean) => {
    audioManager.setSilentMode(silent);
  }, []);

  const setVolumePreset = useCallback((preset: "mute" | "low" | "mid" | "high") => {
    audioManager.setVolumePreset(preset);
  }, []);

  const toggleUiSounds = useCallback(() => {
    audioManager.toggleUiSounds();
  }, []);

  const toggleCadEffects = useCallback(() => {
    audioManager.toggleCadEffects();
  }, []);

  const toggleMusic = useCallback(() => {
    audioManager.toggleMusic();
  }, []);

  const toggleSelectionSounds = useCallback(() => {
    audioManager.toggleSelectionSounds();
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      play,
      playMusic,
      stopMusic,
      setMasterVolume,
      setMusicVolume,
      setEffectsVolume,
      setUiVolume,
      toggleMute,
      setSilentMode,
      setVolumePreset,
      toggleUiSounds,
      toggleCadEffects,
      toggleMusic,
      toggleSelectionSounds,
    }),
    [
      state,
      play,
      playMusic,
      stopMusic,
      setMasterVolume,
      setMusicVolume,
      setEffectsVolume,
      setUiVolume,
      toggleMute,
      setSilentMode,
      setVolumePreset,
      toggleUiSounds,
      toggleCadEffects,
      toggleMusic,
      toggleSelectionSounds,
    ],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    // Fallback gracioso se usado fora do Provider
    return {
      masterVolume: 0.8,
      musicVolume: 0.2,
      effectsVolume: 0.25,
      uiVolume: 0.3,
      isMuted: false,
      uiSoundsEnabled: true,
      cadEffectsEnabled: true,
      musicEnabled: true,
      selectionSoundsEnabled: true,
      play: (id) => AudioManager.play(id),
      playMusic: (t) => AudioManager.playMusic(t),
      stopMusic: () => AudioManager.stopMusic(),
      setMasterVolume: (v) => audioManager.setMasterVolume(v),
      setMusicVolume: (v) => audioManager.setMusicVolume(v),
      setEffectsVolume: (v) => audioManager.setEffectsVolume(v),
      setUiVolume: (v) => audioManager.setUiVolume(v),
      toggleMute: () => audioManager.toggleMute(),
      setSilentMode: (s) => audioManager.setSilentMode(s),
      setVolumePreset: (p) => audioManager.setVolumePreset(p),
      toggleUiSounds: () => audioManager.toggleUiSounds(),
      toggleCadEffects: () => audioManager.toggleCadEffects(),
      toggleMusic: () => audioManager.toggleMusic(),
      toggleSelectionSounds: () => audioManager.toggleSelectionSounds(),
    };
  }
  return ctx;
}
