/**
 * CALDRA AUDIO SYSTEM — PS2-INSPIRED TECHNOLOGICAL SOUND ENGINE
 *
 * Características da Identidade Sonora da CALDRA:
 * - Minimalista, tecnológica, espacial, elegante, nostálgica e imersiva.
 * - Síntese analítica procedural com Web Audio API nativa:
 *   - 0 KB de downloads adicionais, latência zero, 100% confiável e offline.
 *   - Sem dependência de arquivos externos ou quebra de autoplay.
 *   - AudioContext unificado com desbloqueio automático no primeiro gesto do usuário.
 *   - Trilha ambiente contínua com pads suaves, acordes espaciais flutuantes e texturas digitais sutis.
 *   - Efeitos táteis de alta precisão para botões, navegação, operações CAD, B-Rep e metrologia.
 */

export type AudioCategory = "ui" | "cad" | "music" | "selection";

export type SoundEffectId =
  // Botões & Interface Geral
  | "ui_click"
  | "ui_select"
  | "ui_action"
  | "ui_nav"
  | "ui_ratchet"
  | "ui_toggle_open"
  | "ui_toggle_close"
  // CHAMFER & CAD Core
  | "chamfer_init"
  | "cad_core_init"
  | "kernel_loading"
  | "kernel_success"
  | "kernel_error"
  // Operações CAD
  | "cad_create"
  | "cad_move"
  | "cad_rotate"
  | "cad_copy"
  | "cad_delete"
  | "cad_join"
  | "cad_cut"
  | "cad_extrude"
  | "cad_apply"
  | "cad_undo"
  | "cad_redo"
  | "cad_gizmo"
  | "cad_reset"
  | "cad_measure"
  // Seleção
  | "cad_select_face"
  | "cad_select_edge"
  | "cad_select_vertex"
  // Planificação & Transformação
  | "planify_sequence"
  // Exportação
  | "export_start"
  | "export_success"
  | "export_error"
  // Notificações
  | "notify_success"
  | "notify_warning"
  | "notify_error";

export interface AudioSettingsState {
  masterVolume: number; // 0.0 a 1.0
  musicVolume: number; // Padrão: 0.20 (20%)
  effectsVolume: number; // Padrão: 0.25 (25%)
  uiVolume: number; // Padrão: 0.30 (30%)
  isMuted: boolean;
  uiSoundsEnabled: boolean;
  cadEffectsEnabled: boolean;
  musicEnabled: boolean;
  selectionSoundsEnabled: boolean;
}

const STORAGE_KEY = "caldra.audio_settings";

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsState = {
  masterVolume: 0.8,
  musicVolume: 0.2, // 20%
  effectsVolume: 0.25, // 25%
  uiVolume: 0.3, // 30%
  isMuted: false,
  uiSoundsEnabled: true,
  cadEffectsEnabled: true,
  musicEnabled: true,
  selectionSoundsEnabled: true,
};

export class AudioManager {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  // Barramentos de Ganho (Mixer Hierárquico)
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private uiGain: GainNode | null = null;

  // Estado Atual
  private settings: AudioSettingsState = { ...DEFAULT_AUDIO_SETTINGS };
  private listeners: Set<(s: AudioSettingsState) => void> = new Set();

  // Motor da Nova Trilha Sonora — "CALDRA HORIZON" (Mistério, Curiosidade & Exploração)
  private isMusicPlaying = false;
  private ambientTimer: number | null = null;
  private pulseTimer: number | null = null;
  private pulseStep = 0;
  private currentChordIndex = 0;
  private activeVoices: { oscs: (OscillatorNode | AudioBufferSourceNode)[]; gain: GainNode }[] = [];
  private musicDelayNode: DelayNode | null = null;
  private musicFeedbackGain: GainNode | null = null;

  private constructor() {
    this.loadSettings();
    this.setupUnlockListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /** Atalho estático para tocar efeitos sonoros */
  public static play(soundId: SoundEffectId): void {
    AudioManager.getInstance().play(soundId);
  }

  /** Atalho estático para iniciar trilha ambiente */
  public static playMusic(trackId = "caldra_main"): void {
    AudioManager.getInstance().playMusic(trackId);
  }

  /** Atalho estático para parar a trilha ambiente */
  public static stopMusic(): void {
    AudioManager.getInstance().stopMusic();
  }

  // =========================================================================
  // INICIALIZAÇÃO E RESPEITO AO AUTOPLAY
  // =========================================================================

  private setupUnlockListeners(): void {
    if (typeof window === "undefined") return;

    const unlock = () => {
      this.ensureAudioContext();
      if (this.ctx && this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
      this.isUnlocked = true;

      // Se a música estiver habilitada e ainda não iniciada, inicia suavemente
      if (this.settings.musicEnabled && !this.settings.isMuted && !this.isMusicPlaying) {
        this.playMusic("caldra_main");
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) return null;

      try {
        this.ctx = new AudioCtxClass();

        // Cria nós do mixer
        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.effectsGain = this.ctx.createGain();
        this.uiGain = this.ctx.createGain();

        // Conexões
        this.musicGain.connect(this.masterGain);
        this.effectsGain.connect(this.masterGain);
        this.uiGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // Barramento de delay estéreo espacial para a música de exploração ("CALDRA Horizon")
        try {
          this.musicDelayNode = this.ctx.createDelay();
          this.musicDelayNode.delayTime.setValueAtTime(0.28, this.ctx.currentTime);
          this.musicFeedbackGain = this.ctx.createGain();
          this.musicFeedbackGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

          const delayFilter = this.ctx.createBiquadFilter();
          delayFilter.type = "lowpass";
          delayFilter.frequency.setValueAtTime(2800, this.ctx.currentTime);

          this.musicDelayNode.connect(delayFilter);
          delayFilter.connect(this.musicFeedbackGain);
          this.musicFeedbackGain.connect(this.musicDelayNode);
          delayFilter.connect(this.musicGain);
        } catch (delayErr) {
          void delayErr;
        }

        // Aplica volumes salvos
        this.updateGainNodes();
      } catch (err) {
        console.warn("[AudioManager] Falha ao inicializar AudioContext:", err);
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  // =========================================================================
  // GERENCIAMENTO DE ESTADO E PERSISTÊNCIA
  // =========================================================================

  private loadSettings(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_AUDIO_SETTINGS };
    }
  }

  private saveSettings(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      void err;
    }
    this.notify();
    this.updateGainNodes();
  }

  private updateGainNodes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const master = this.settings.isMuted ? 0 : Math.max(0, Math.min(1, this.settings.masterVolume));
    const music = this.settings.musicEnabled ? this.settings.musicVolume : 0;
    const effects = this.settings.cadEffectsEnabled ? this.settings.effectsVolume : 0;
    const ui = this.settings.uiSoundsEnabled ? this.settings.uiVolume : 0;

    this.masterGain?.gain.setTargetAtTime(master, now, 0.05);
    this.musicGain?.gain.setTargetAtTime(music, now, 0.05);
    this.effectsGain?.gain.setTargetAtTime(effects, now, 0.05);
    this.uiGain?.gain.setTargetAtTime(ui, now, 0.05);
  }

  public getSettings(): AudioSettingsState {
    return { ...this.settings };
  }

  public subscribe(listener: (s: AudioSettingsState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const s = this.getSettings();
    this.listeners.forEach((l) => l(s));
  }

  // =========================================================================
  // MÉTODOS DE CONTROLE DE VOLUME
  // =========================================================================

  public setMasterVolume(vol: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.settings.masterVolume > 0 && this.settings.isMuted) {
      this.settings.isMuted = false;
    }
    this.saveSettings();
  }

  public setMusicVolume(vol: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setEffectsVolume(vol: number): void {
    this.settings.effectsVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setUiVolume(vol: number): void {
    this.settings.uiVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public toggleMute(): boolean {
    this.settings.isMuted = !this.settings.isMuted;
    this.saveSettings();
    if (!this.settings.isMuted && this.settings.musicEnabled && !this.isMusicPlaying) {
      this.playMusic();
    }
    return this.settings.isMuted;
  }

  public setSilentMode(silent: boolean): void {
    this.settings.isMuted = silent;
    this.saveSettings();
  }

  public setVolumePreset(preset: "mute" | "low" | "mid" | "high"): void {
    switch (preset) {
      case "mute":
        this.settings.isMuted = true;
        break;
      case "low":
        this.settings.isMuted = false;
        this.settings.masterVolume = 0.3;
        break;
      case "mid":
        this.settings.isMuted = false;
        this.settings.masterVolume = 0.65;
        break;
      case "high":
        this.settings.isMuted = false;
        this.settings.masterVolume = 1.0;
        break;
    }
    this.saveSettings();
  }

  public toggleUiSounds(): void {
    this.settings.uiSoundsEnabled = !this.settings.uiSoundsEnabled;
    this.saveSettings();
    if (this.settings.uiSoundsEnabled) this.play("ui_click");
  }

  public toggleCadEffects(): void {
    this.settings.cadEffectsEnabled = !this.settings.cadEffectsEnabled;
    this.saveSettings();
    if (this.settings.cadEffectsEnabled) this.play("cad_core_init");
  }

  public toggleMusic(): void {
    this.settings.musicEnabled = !this.settings.musicEnabled;
    this.saveSettings();
    if (this.settings.musicEnabled) {
      this.playMusic();
    } else {
      this.stopMusic();
    }
  }

  public toggleSelectionSounds(): void {
    this.settings.selectionSoundsEnabled = !this.settings.selectionSoundsEnabled;
    this.saveSettings();
    if (this.settings.selectionSoundsEnabled) this.play("cad_select_face");
  }

  // =========================================================================
  // REPRODUÇÃO DE EFEITOS SONOROS (PROCEDURAL SINTETIZADO PS2 AESTHETIC)
  // =========================================================================

  public play(soundId: SoundEffectId): void {
    if (this.settings.isMuted) return;

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    // Roteamento por categoria e checagem de habilitação
    let targetBus: GainNode | null = this.uiGain;
    if (soundId.startsWith("cad_") || soundId.startsWith("kernel_") || soundId === "chamfer_init" || soundId === "planify_sequence") {
      if (soundId.startsWith("cad_select_")) {
        if (!this.settings.selectionSoundsEnabled) return;
        targetBus = this.effectsGain;
      } else {
        if (!this.settings.cadEffectsEnabled) return;
        targetBus = this.effectsGain;
      }
    } else if (soundId.startsWith("export_") || soundId.startsWith("notify_")) {
      targetBus = this.effectsGain;
    } else {
      if (!this.settings.uiSoundsEnabled) return;
      targetBus = this.uiGain;
    }

    if (!targetBus) return;

    try {
      const now = ctx.currentTime;

      switch (soundId) {
        // ---------------------------------------------------------------
        // 1. BOTÃO NORMAL — "click" eletrônico suave (50-100 ms)
        // ---------------------------------------------------------------
        case "ui_click": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          // Variação micro tonal de pitch (evita efeito metralhadora)
          const pitchJitter = 1 + (Math.random() - 0.5) * 0.08;
          osc.type = "sine";
          osc.frequency.setValueAtTime(1450 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1100, now);
          filter.Q.setValueAtTime(3.5, now);

          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(targetBus);

          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        // ---------------------------------------------------------------
        // 2. BOTÃO SELECIONADO — Mais grave e definido (70-120 ms)
        // ---------------------------------------------------------------
        case "ui_select": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(440, now);
          osc1.frequency.exponentialRampToValueAtTime(370, now + 0.09);

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(220, now);
          osc2.frequency.exponentialRampToValueAtTime(185, now + 0.09);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(900, now);
          filter.Q.setValueAtTime(2, now);

          gain.gain.setValueAtTime(0.32, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.11);
          osc2.stop(now + 0.11);
          break;
        }

        // ---------------------------------------------------------------
        // 3. AÇÃO PRINCIPAL — Som eletrônico curto com confirmação (100-180 ms)
        // ---------------------------------------------------------------
        case "ui_action": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(587.33, now); // D5
          osc1.frequency.setValueAtTime(880, now + 0.04); // A5

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(880, now);
          osc2.frequency.setValueAtTime(1174.66, now + 0.04); // D6

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.17);
          osc2.stop(now + 0.17);
          break;
        }

        // ---------------------------------------------------------------
        // 4. TRANSIÇÃO DE NAVEGAÇÃO — Digital sweep suave (100-250 ms)
        // ---------------------------------------------------------------
        case "ui_nav": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(600, now);
          filter.frequency.exponentialRampToValueAtTime(1800, now + 0.16);
          filter.Q.setValueAtTime(4, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.28, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(targetBus);

          osc.start(now);
          osc.stop(now + 0.19);
          break;
        }

        // ---------------------------------------------------------------
        // 4b. CATRACA MECÂNICA DE NAVEGAÇÃO INFINITA (Clique seco e preciso: 22 ms)
        // ---------------------------------------------------------------
        case "ui_ratchet": {
          const osc = ctx.createOscillator();
          const oscMetal = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          const jitter = 1 + (Math.random() - 0.5) * 0.05;
          osc.type = "sine";
          osc.frequency.setValueAtTime(2800 * jitter, now);
          osc.frequency.exponentialRampToValueAtTime(450, now + 0.022);

          oscMetal.type = "triangle";
          oscMetal.frequency.setValueAtTime(1850 * jitter, now);
          oscMetal.frequency.exponentialRampToValueAtTime(320, now + 0.02);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1900, now);
          filter.Q.setValueAtTime(6.0, now);

          gain.gain.setValueAtTime(0.26, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

          osc.connect(filter);
          oscMetal.connect(filter);
          filter.connect(gain);
          gain.connect(targetBus);

          osc.start(now);
          oscMetal.start(now);
          osc.stop(now + 0.025);
          oscMetal.stop(now + 0.025);
          break;
        }

        // ---------------------------------------------------------------
        // MENUS EXPANSÍVEIS: Tick Ascendente (Abrir) e Descendente (Fechar)
        // ---------------------------------------------------------------
        case "ui_toggle_open": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        }

        case "ui_toggle_close": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1300, now);
          osc.frequency.exponentialRampToValueAtTime(720, now + 0.05);

          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        }

        // ---------------------------------------------------------------
        // 5. CHAMFER — Sequência curta de inicialização CAD (~450 ms)
        // Pulso eletrônico -> Pequeno sweep -> Confirmação suave
        // ---------------------------------------------------------------
        case "chamfer_init": {
          // Fase 1: Pulso sub grave de abertura (0ms - 100ms)
          const sub = ctx.createOscillator();
          const subGain = ctx.createGain();
          sub.type = "sine";
          sub.frequency.setValueAtTime(85, now);
          sub.frequency.exponentialRampToValueAtTime(50, now + 0.12);
          subGain.gain.setValueAtTime(0.3, now);
          subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
          sub.connect(subGain);
          subGain.connect(targetBus);
          sub.start(now);
          sub.stop(now + 0.13);

          // Fase 2: Sweep de escaneamento digital (100ms - 260ms)
          const sweep = ctx.createOscillator();
          const sweepGain = ctx.createGain();
          const sweepFilter = ctx.createBiquadFilter();
          sweep.type = "sawtooth";
          sweep.frequency.setValueAtTime(320, now + 0.1);
          sweep.frequency.exponentialRampToValueAtTime(1150, now + 0.25);
          sweepFilter.type = "lowpass";
          sweepFilter.frequency.setValueAtTime(800, now + 0.1);
          sweepFilter.frequency.exponentialRampToValueAtTime(2400, now + 0.25);
          sweepFilter.Q.setValueAtTime(3.5, now + 0.1);

          sweepGain.gain.setValueAtTime(0.001, now + 0.1);
          sweepGain.gain.linearRampToValueAtTime(0.18, now + 0.16);
          sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);

          sweep.connect(sweepFilter);
          sweepFilter.connect(sweepGain);
          sweepGain.connect(targetBus);
          sweep.start(now + 0.1);
          sweep.stop(now + 0.28);

          // Fase 3: Confirmação harmônica cristalina (260ms - 460ms)
          const chord1 = ctx.createOscillator();
          const chord2 = ctx.createOscillator();
          const chordGain = ctx.createGain();

          chord1.type = "sine";
          chord1.frequency.setValueAtTime(659.25, now + 0.26); // E5
          chord2.type = "sine";
          chord2.frequency.setValueAtTime(987.77, now + 0.26); // B5

          chordGain.gain.setValueAtTime(0.001, now + 0.26);
          chordGain.gain.linearRampToValueAtTime(0.24, now + 0.29);
          chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

          chord1.connect(chordGain);
          chord2.connect(chordGain);
          chordGain.connect(targetBus);

          chord1.start(now + 0.26);
          chord2.start(now + 0.26);
          chord1.stop(now + 0.49);
          chord2.stop(now + 0.49);
          break;
        }

        // ---------------------------------------------------------------
        // 6. CAD CORE 3D & CAD KERNEL
        // ---------------------------------------------------------------
        case "cad_core_init": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.setValueAtTime(784, now + 0.05); // G5
          osc.frequency.setValueAtTime(1046.5, now + 0.1); // C6

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.29);
          break;
        }

        case "kernel_loading": {
          // Processamento discreto
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case "kernel_success": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(880, now);
          osc1.frequency.setValueAtTime(1320, now + 0.06);

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1320, now);
          osc2.frequency.setValueAtTime(1760, now + 0.06);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.26);
          osc2.stop(now + 0.26);
          break;
        }

        case "kernel_error": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.16);
          break;
        }

        // ---------------------------------------------------------------
        // 7. OPERAÇÕES CAD ESPECÍFICAS (Extremamente curtas)
        // ---------------------------------------------------------------
        case "cad_create": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.setValueAtTime(840, now + 0.03);

          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case "cad_move": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.linearRampToValueAtTime(360, now + 0.06);

          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case "cad_rotate": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(580, now + 0.07);

          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }

        case "cad_apply": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(440, now);
          osc1.frequency.setValueAtTime(659.25, now + 0.04);

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(220, now);
          osc2.frequency.setValueAtTime(329.6, now + 0.04);

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.17);
          osc2.stop(now + 0.17);
          break;
        }

        case "cad_undo": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.setValueAtTime(360, now + 0.04);

          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }

        case "cad_redo": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.setValueAtTime(520, now + 0.04);

          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }

        case "cad_gizmo": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);

          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        }

        case "cad_reset": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(523.25, now);
          osc1.frequency.setValueAtTime(659.25, now + 0.05);

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(783.99, now);
          osc2.frequency.setValueAtTime(523.25, now + 0.05);

          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.15);
          osc2.stop(now + 0.15);
          break;
        }

        case "cad_measure": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.setValueAtTime(1800, now + 0.02);

          gain.gain.setValueAtTime(0.26, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        // ---------------------------------------------------------------
        // 8. SELEÇÃO B-REP
        // Face: curto e agudo | Aresta: ressonância média | Vértice: ultra-curto
        // ---------------------------------------------------------------
        case "cad_select_face": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(940, now + 0.06);

          gain.gain.setValueAtTime(0.26, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.075);
          break;
        }

        case "cad_select_edge": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(540, now + 0.06);

          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        case "cad_select_vertex": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1480, now);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.045);
          break;
        }

        // ---------------------------------------------------------------
        // 9. PLANIFICAÇÃO — Sequência Sonora 3D -> Processamento -> Concluído
        // ---------------------------------------------------------------
        case "planify_sequence": {
          // Fase 1: Desdobramento 3D (0ms)
          const unfold = ctx.createOscillator();
          const unfoldGain = ctx.createGain();
          unfold.type = "triangle";
          unfold.frequency.setValueAtTime(260, now);
          unfold.frequency.exponentialRampToValueAtTime(680, now + 0.2);

          unfoldGain.gain.setValueAtTime(0.22, now);
          unfoldGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          unfold.connect(unfoldGain);
          unfoldGain.connect(targetBus);
          unfold.start(now);
          unfold.stop(now + 0.23);

          // Fase 2: Chime de planificação vetorial concluída (240ms)
          const chime1 = ctx.createOscillator();
          const chime2 = ctx.createOscillator();
          const chimeGain = ctx.createGain();

          chime1.type = "sine";
          chime1.frequency.setValueAtTime(783.99, now + 0.22); // G5
          chime1.frequency.setValueAtTime(1046.5, now + 0.32); // C6

          chime2.type = "sine";
          chime2.frequency.setValueAtTime(1046.5, now + 0.22); // C6
          chime2.frequency.setValueAtTime(1567.98, now + 0.32); // G6

          chimeGain.gain.setValueAtTime(0.001, now + 0.22);
          chimeGain.gain.linearRampToValueAtTime(0.32, now + 0.27);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

          chime1.connect(chimeGain);
          chime2.connect(chimeGain);
          chimeGain.connect(targetBus);

          chime1.start(now + 0.22);
          chime2.start(now + 0.22);
          chime1.stop(now + 0.6);
          chime2.stop(now + 0.6);
          break;
        }

        // ---------------------------------------------------------------
        // 10. EXPORTAÇÃO (DXF, STEP, STL, PDF, SVG, PNG)
        // ---------------------------------------------------------------
        case "export_start": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case "export_success": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(523.25, now);
          osc1.frequency.setValueAtTime(659.25, now + 0.05);
          osc1.frequency.setValueAtTime(783.99, now + 0.1);

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(783.99, now);
          osc2.frequency.setValueAtTime(1046.5, now + 0.08);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.24);
          osc2.stop(now + 0.24);
          break;
        }

        case "export_error": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.setValueAtTime(180, now + 0.06);

          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.13);
          break;
        }

        // ---------------------------------------------------------------
        // 11. NOTIFICAÇÕES (SUCCESS, WARNING, ERROR)
        // ---------------------------------------------------------------
        case "notify_success": {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(659.25, now); // E5
          osc1.frequency.setValueAtTime(880, now + 0.05); // A5

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1318.5, now + 0.05); // E6

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.32, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(targetBus);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.23);
          osc2.stop(now + 0.23);
          break;
        }

        case "notify_warning": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.setValueAtTime(320, now + 0.06);

          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }

        case "notify_error": {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.setValueAtTime(240, now + 0.06);

          gain.gain.setValueAtTime(0.26, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

          osc.connect(gain);
          gain.connect(targetBus);
          osc.start(now);
          osc.stop(now + 0.17);
          break;
        }

        default:
          break;
      }
    } catch (e) {
      // Falha silenciosa para não travar a aplicação
      console.debug("[AudioManager.play] Erro no efeito:", e);
    }
  }

  // =========================================================================
  // NOVA TRILHA SONORA PRINCIPAL — "CALDRA HORIZON" (COMPOSIÇÃO ORIGINAL)
  // Mistério Tecnológico, Curiosidade, Descoberta, Exploração e Precisão
  // Zero melancolia, harmonia aberta/lídia/add9, motivo interrogativo cristalino
  // =========================================================================

  public playMusic(trackId = "caldra_main"): void {
    void trackId;
    if (this.isMusicPlaying) return;
    if (!this.settings.musicEnabled || this.settings.isMuted) return;

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    this.isMusicPlaying = true;
    this.startAmbientEngine();
  }

  public stopMusic(): void {
    this.isMusicPlaying = false;
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    if (this.pulseTimer !== null) {
      window.clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }

    // Suaviza e cessa vozes ativas
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.activeVoices.forEach((v) => {
        try {
          v.gain.gain.setTargetAtTime(0.0001, now, 0.4);
          window.setTimeout(() => {
            v.oscs.forEach((o) => {
              try {
                if ("stop" in o && typeof o.stop === "function") {
                  o.stop();
                }
              } catch (e) {
                void e;
              }
            });
          }, 800);
        } catch (e) {
          void e;
        }
      });
      this.activeVoices = [];
    }
  }

  private startAmbientEngine(): void {
    if (!this.ctx || !this.isMusicPlaying) return;

    // -----------------------------------------------------------------------
    // HARMONIA: Mistério Aberto, Curiosidade e Exploração Tecnológica
    // (Zero melancolia, zero tristeza, acordes abertos, suspensos e lídios)
    // -----------------------------------------------------------------------
    const chordProgressions = [
      // 1. "Despertar do Espaço" — Eadd9 / Esus2 (Aberto, limpo, curioso)
      {
        bass: 82.41, // E2
        pad: [164.81, 246.94, 293.66, 329.63, 415.30, 493.88], // E3, B3, D4, E4, G#4, B4
        filterBase: 650,
        filterPeak: 1750,
        melody: [
          { f: 493.88, delay: 1.8, pan: -0.25 }, // B4
          { f: 739.99, delay: 3.1, pan: 0.3 },   // F#5
          { f: 830.61, delay: 4.3, pan: -0.15 }, // G#5
          { f: 659.25, delay: 5.5, pan: 0.2 },   // E5 (pergunta melódica: "o que há aqui?")
        ],
      },
      // 2. "O Enigma Lídio / Descoberta" — Amaj9#11 (Mágico, luminoso, futurista)
      {
        bass: 110.00, // A2
        pad: [164.81, 207.65, 246.94, 311.13, 329.63, 415.30], // E3, G#3, B3, D#4 (#11 lídia!), E4, G#4
        filterBase: 700,
        filterPeak: 2100,
        melody: [
          { f: 659.25, delay: 1.7, pan: 0.25 },  // E5
          { f: 987.77, delay: 2.9, pan: -0.3 },  // B5
          { f: 1244.51, delay: 4.1, pan: 0.35 }, // D#6
          { f: 830.61, delay: 5.2, pan: -0.2 },  // G#5 (fascínio e admiração)
        ],
      },
      // 3. "Precisão & Engenharia" — C#m7(add11) / Bsus (Foco, geometria limpa)
      {
        bass: 65.41, // C#2
        pad: [123.47, 164.81, 246.94, 277.18, 369.99, 415.30], // B2, E3, B3, C#4, F#4, G#4
        filterBase: 600,
        filterPeak: 1650,
        melody: [
          { f: 739.99, delay: 1.9, pan: -0.3 },  // F#5
          { f: 830.61, delay: 3.1, pan: 0.25 },  // G#5
          { f: 622.25, delay: 4.4, pan: -0.1 },  // D#5 (precisão cristalina)
        ],
      },
      // 4. "Impulso de Criação" — F#7sus4(add9) (Atração, movimento contínuo)
      {
        bass: 92.50, // F#2
        pad: [138.59, 164.81, 207.65, 277.18, 329.63, 369.99], // C#3, E3, G#3, C#4, E4, F#4
        filterBase: 750,
        filterPeak: 1950,
        melody: [
          { f: 554.37, delay: 1.8, pan: 0.2 },   // C#5
          { f: 659.25, delay: 3.0, pan: -0.25 }, // E5
          { f: 830.61, delay: 4.2, pan: 0.3 },   // G#5
          { f: 987.77, delay: 5.3, pan: -0.1 },  // B5 (impulso de explorar ferramentas)
        ],
      },
      // 5. "O Horizonte Revelado" — Dmaj7#11 (Brilho e amplitude máxima, clímax sutil)
      {
        bass: 73.42, // D2
        pad: [146.83, 207.65, 277.18, 293.66, 329.63, 440.00], // D3, G#3 (#11), C#4, D4, E4, A4
        filterBase: 800,
        filterPeak: 2200,
        melody: [
          { f: 830.61, delay: 1.7, pan: -0.2 },  // G#5
          { f: 659.25, delay: 2.9, pan: 0.3 },   // E5
          { f: 739.99, delay: 4.1, pan: -0.3 },  // F#5
          { f: 987.77, delay: 5.3, pan: 0.25 },  // B5 (visão ampla de design 3D)
        ],
      },
      // 6. "Conexão e Loop Infinito" — Badd9(sus4) (Resolução suspensa aberta)
      {
        bass: 61.74, // B1
        pad: [123.47, 164.81, 185.00, 246.94, 277.18, 369.99], // B2, E3, F#3, B3, C#4, F#4
        filterBase: 650,
        filterPeak: 1700,
        melody: [
          { f: 739.99, delay: 1.8, pan: 0.2 },   // F#5
          { f: 659.25, delay: 3.0, pan: -0.2 },  // E5
          { f: 493.88, delay: 4.2, pan: 0.15 },  // B4
          { f: 369.99, delay: 5.4, pan: -0.25 }, // F#4 (conecta naturalmente de volta ao início)
        ],
      },
    ];

    const CHORD_DURATION = 8.4; // Duração total de cada acorde com fade out
    const CHORD_INTERVAL = 6.0; // Intervalo para o próximo acorde (2.4s de crossfade perfeito)
    this.currentChordIndex = 0;

    const playNextChord = () => {
      if (!this.isMusicPlaying || !this.ctx) return;

      const current = chordProgressions[this.currentChordIndex];
      this.currentChordIndex = (this.currentChordIndex + 1) % chordProgressions.length;

      this.triggerAmbientSection(current, CHORD_DURATION);
    };

    // Toca o primeiro acorde imediatamente
    playNextChord();

    // Agenda os próximos acordes em ciclo perpétuo sem costuras
    this.ambientTimer = window.setInterval(playNextChord, CHORD_INTERVAL * 1000);

    // Pulso espacial sutil sincronizado com a evolução harmônica (a cada 6s)
    this.pulseStep = 0;
    this.pulseTimer = window.setInterval(() => {
      if (!this.isMusicPlaying || !this.ctx) return;
      this.triggerTechPulse();
    }, CHORD_INTERVAL * 1000);
  }

  private triggerAmbientSection(
    section: {
      bass: number;
      pad: number[];
      filterBase: number;
      filterPeak: number;
      melody: { f: number; delay: number; pan: number }[];
    },
    duration: number,
  ): void {
    if (!this.ctx || !this.musicGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const oscs: (OscillatorNode | AudioBufferSourceNode)[] = [];

    // Master bus local deste acorde
    const chordGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Filtro analógico passa-baixas com curva orgânica de abertura e respiração
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(section.filterBase, now);
    filter.frequency.linearRampToValueAtTime(section.filterPeak, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(section.filterBase + 120, now + duration);
    filter.Q.setValueAtTime(2.2, now);

    // Envelope de ganho do pad: ataque sedoso de 2.2s, sustentação e decaimento exponencial
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.linearRampToValueAtTime(0.18, now + 2.2);
    chordGain.gain.setValueAtTime(0.18, now + duration - 2.4);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.connect(chordGain);
    chordGain.connect(this.musicGain);

    // Subgrave fundamental limpo (senóide quente e estável)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(section.bass, now);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.12, now + 2.0);
    subGain.gain.setValueAtTime(0.12, now + duration - 2.4);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    subOsc.connect(subGain);
    subGain.connect(this.musicGain);
    subOsc.start(now);
    subOsc.stop(now + duration + 0.1);
    oscs.push(subOsc);

    // Camada polifônica do pad (combinando senóides e triângulos com micro-detune)
    section.pad.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? "sine" : "triangle";

      // Micro detune estéreo para espacialidade ampla
      const detune = (idx - section.pad.length / 2) * 4.5;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detune, now);

      osc.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.1);
      oscs.push(osc);
    });

    const voice = { oscs, gain: chordGain };
    this.activeVoices.push(voice);

    // Dispara o motivo melódico de curiosidade ("A Pergunta Musical") com gotas cristalinas
    section.melody.forEach((note) => {
      this.triggerCrystalNote(note.f, now + note.delay, note.pan);
    });

    // Limpeza após o fim do acorde
    window.setTimeout(() => {
      const idx = this.activeVoices.indexOf(voice);
      if (idx !== -1) {
        this.activeVoices.splice(idx, 1);
      }
    }, (duration + 0.5) * 1000);
  }

  private triggerCrystalNote(frequency: number, startTime: number, pan: number): void {
    if (!this.ctx || !this.musicGain || !this.isMusicPlaying) return;

    try {
      const ctx = this.ctx;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Timbre cristalino tecnológico (onda senoidal com segundo harmônico sutil)
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(frequency, startTime);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(frequency * 2, startTime); // oitava acima

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3400, startTime);
      filter.Q.setValueAtTime(1.5, startTime);

      // Envelope rápido com decaimento longo (som de gota digital iluminada)
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.linearRampToValueAtTime(0.075, startTime + 0.025);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.6);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(noteGain);

      // Panorâmica estéreo se suportado
      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), startTime);
        noteGain.connect(panner);
        panner.connect(this.musicGain);
        if (this.musicDelayNode) {
          panner.connect(this.musicDelayNode);
        }
      } else {
        noteGain.connect(this.musicGain);
        if (this.musicDelayNode) {
          noteGain.connect(this.musicDelayNode);
        }
      }

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + 1.7);
      osc2.stop(startTime + 1.7);
    } catch (e) {
      void e;
    }
  }

  private triggerTechPulse(): void {
    if (!this.ctx || !this.musicGain || !this.isMusicPlaying) return;

    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      this.pulseStep++;
      // Alterna panorâmica sutilmente a cada pulso
      const pan = this.pulseStep % 2 === 0 ? -0.22 : 0.22;

      // Micro pulso digital com timbre de sonar tecnológico / clock de precisão
      osc.type = "sine";
      osc.frequency.setValueAtTime(1900, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.028);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1500, now);
      filter.Q.setValueAtTime(3.8, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(filter);
      filter.connect(gain);

      if (typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, now);
        gain.connect(panner);
        panner.connect(this.musicGain);
      } else {
        gain.connect(this.musicGain);
      }

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      void e;
    }
  }
}

export const audioManager = AudioManager.getInstance();
