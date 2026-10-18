import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  User,
  ShieldCheck,
  Sparkles,
  HardDriveDownload,
  PenTool,
  RotateCcw,
  Check,
  Compass,
  Sun,
  Moon,
  Monitor,
  Bug,
  LogOut,
  ChevronDown,
  ChevronRight,
  Palette,
  SlidersHorizontal,
  ExternalLink,
  Award,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { NavigationAreaContainer } from "@/components/layout/NavigationAreaContainer";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { PLAN_LABEL } from "@/lib/subscription/features";
import {
  useSettings,
  type AccentColor,
  type ThemeMode,
  type Unit,
  type AuroraStyle,
  type AppLanguage,
} from "@/lib/settings/SettingsProvider";
import {
  getChamferSettings,
  saveChamferSettings,
  DEFAULT_CHAMFER_SETTINGS,
  type ChamferSettings,
} from "@/lib/lab2d/projectSettings";
import { REGIONS, type RegionId } from "@/lib/regional/regional";
import { PhotoPicker } from "@/components/chameleon/Profile";
import { ReportProblemDialog } from "@/components/chameleon/ReportProblemDialog";
import { BackupDialog } from "@/components/chameleon/BackupDialog";
import { MySubscriptionPanel } from "@/components/chameleon/MySubscriptionPanel";
import { AudioSettingsPanel } from "@/components/audio/AudioSettingsPanel";
import { APP_VERSION, APP_BUILD } from "@/lib/app/version";
import { useAIProcessing } from "@/lib/ai/aiProcessingContext";
import { readConsent, setConsent } from "@/lib/analytics/consent";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { cn } from "@/lib/utils";

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
  { id: "amoled", label: "AMOLED", icon: Sparkles },
];

const AURORA_STYLES: { id: AuroraStyle; label: string; hint: string }[] = [
  { id: "fluido", label: "Fluido", hint: "Shader líquido em movimento contínuo" },
  { id: "suave", label: "Fluid Aurora", hint: "Campos de luz flutuando em espaço profundo" },
  { id: "padrao", label: "Padrão", hint: "Sem fundo animado — cor sólida do tema" },
];

const ACCENTS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: "default", label: "Neutro / Monocromático", swatch: "var(--foreground)" },
  { id: "amber", label: "Âmbar Caldeiraria", swatch: "#F59E0B" },
  { id: "blue", label: "Azul Técnico", swatch: "#00CCFF" },
  { id: "crimson", label: "Vermelho Carmesim", swatch: "#B22222" },
];

const LANGUAGES: { id: AppLanguage; label: string }[] = [
  { id: "pt", label: "Português (BR)" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

const UNITS: Unit[] = ["mm", "cm", "m", "in"];

export type PerfilSectionId =
  | "perfil"
  | "conta"
  | "pro"
  | "aparencia"
  | "preferencias"
  | "dados";

interface PerfilEContaCentralProps {
  initialSection?: PerfilSectionId;
}

export function PerfilEContaCentral({ initialSection }: PerfilEContaCentralProps) {
  const profile = useProfile();
  const { user, signOut } = useAuth();
  const { plan, isMestre, requirePro, unlockWithCode, reset: resetPro } = useFeatureAccess();
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    unit,
    setUnit,
    precision,
    setPrecision,
    level,
    setLevel,
    region,
    setRegion,
    auroraStyle,
    setAuroraStyle,
    language,
    setLanguage,
    cardOpacity,
    setCardOpacity,
    bubbleOpacity,
    setBubbleOpacity,
    resetAppearance,
  } = useSettings();

  // Apenas a seção de perfil inicia aberta por padrão para reduzir a rolagem excessiva
  const [openSections, setOpenSections] = useState<Record<PerfilSectionId, boolean>>({
    perfil: true,
    conta: false,
    pro: false,
    aparencia: false,
    preferencias: false,
    dados: false,
  });

  const [code, setCode] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [consent, setConsentState] = useState(false);

  useEffect(() => {
    setConsentState(readConsent());
  }, []);

  // Se uma seção inicial for fornecida via prop ou âncora, garanta que ela esteja aberta
  useEffect(() => {
    if (initialSection) {
      setOpenSections((prev) => ({
        ...prev,
        [initialSection]: true,
      }));
    }
  }, [initialSection]);

  const toggleSection = (id: PerfilSectionId) => {
    triggerHaptic("selection");
    AudioManager.play("ui_pop");
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    triggerHaptic("tap");
    setOpenSections({
      perfil: true,
      conta: true,
      pro: true,
      aparencia: true,
      preferencias: true,
      dados: true,
    });
  };

  const collapseAll = () => {
    triggerHaptic("tap");
    setOpenSections({
      perfil: false,
      conta: false,
      pro: false,
      aparencia: false,
      preferencias: false,
      dados: false,
    });
  };

  const {
    isProcessing,
    isContinuous,
    statusText,
    triggerProcessing,
    stopProcessing,
    toggleContinuous,
  } = useAIProcessing();

  const [chamferSettings, setChamferSettings] = useState<ChamferSettings>(DEFAULT_CHAMFER_SETTINGS);

  useEffect(() => {
    setChamferSettings(getChamferSettings());
    const onSettingsChanged = () => {
      setChamferSettings(getChamferSettings());
    };
    window.addEventListener("chamfer-settings-changed", onSettingsChanged);
    return () => {
      window.removeEventListener("chamfer-settings-changed", onSettingsChanged);
    };
  }, []);

  const updateChamfer = (patch: Partial<ChamferSettings>) => {
    const updated = saveChamferSettings(patch);
    setChamferSettings(updated);
    toast.success("Preferências do CHAMFER salvas.");
  };

  const resetChamfer = () => {
    const updated = saveChamferSettings(DEFAULT_CHAMFER_SETTINGS);
    setChamferSettings(updated);
    toast.success("Padrões do CHAMFER restaurados.");
  };

  const submitProCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const res = await unlockWithCode(code);
    if (res.ok) {
      setCode("");
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  return (
    <NavigationAreaContainer>
      {/* =========================================================================
          CABEÇALHO DA CENTRAL — COMPACTO E TÉCNICO
          ========================================================================= */}
      <NavigationAreaHeader
        badgeText="CENTRAL UNIFICADA"
        badgeColor="text-amber-500"
        indicatorColor="bg-amber-500"
        title="Perfil e Conta"
        description="Gerenciamento profissional, assinatura, preferências e personalização do CALDRA."
        actions={
          <>
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-all active:scale-95 cursor-pointer"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-all active:scale-95 cursor-pointer"
            >
              Recolher tudo
            </button>
          </>
        }
      />

      {/* =========================================================================
          01 — PERFIL PROFISSIONAL
          - Foto de perfil: 96 px (faixa recomendada de 88–104 px)
          - Campos de formulário de largura total: altura 48–52 px
          - Rótulos, campos e descrições claramente separados
          ========================================================================= */}
      <section
        id="perfil-profissional"
        aria-labelledby="heading-perfil"
        className="caldra-card rounded-2xl overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => toggleSection("perfil")}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-sky size-11 shrink-0">
              <User className="size-5 text-sky-500" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-sky-500">01</span>
                <h2 id="heading-perfil" className="font-display text-sm sm:text-base font-bold text-foreground">
                  Perfil Profissional
                </h2>
                <span className="hidden xs:inline-flex rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-[9px] text-sky-500 font-medium">
                  {profile.name || "Caldeireiro"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Foto, identificação técnica, especialização e cargo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-block font-mono text-[10px] text-muted-foreground">
              {level === "mestre" ? "Nível Mestre" : "Nível Aprendiz"}
            </span>
            <div className={cn("size-7 rounded-full grid place-items-center text-muted-foreground transition-transform duration-200", openSections.perfil && "rotate-180")}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {openSections.perfil && (
          <div className="border-t border-border/50 p-4 sm:p-5 space-y-4 bg-card/30">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Foto de perfil: 96 px com controles claramente identificados */}
              <div className="shrink-0 flex flex-col items-center">
                <PhotoPicker
                  photo={profile.photo}
                  size={96}
                  label={profile.photo ? "Alterar foto" : "Adicionar foto"}
                  onPhoto={(p) => {
                    profile.update({ photo: p });
                    toast.success("Foto do perfil atualizada.");
                  }}
                />
                {profile.photo && (
                  <button
                    type="button"
                    onClick={() => {
                      profile.update({ photo: null });
                      toast.success("Foto do perfil removida.");
                    }}
                    className="mt-1 font-mono text-[10px] text-destructive hover:underline cursor-pointer"
                  >
                    Remover foto
                  </button>
                )}
              </div>

              {/* Campos de dados profissionais em largura total (altura 48–52 px) */}
              <div className="flex-1 w-full space-y-3.5">
                <div>
                  <label htmlFor="field-name" className="block font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    Nome Completo / Identificação Técnica
                  </label>
                  <input
                    id="field-name"
                    value={profile.name}
                    onChange={(e) => profile.update({ name: e.target.value })}
                    placeholder={profile.displayName || "Ex: Carlos Silva"}
                    className="w-full h-12 rounded-xl border border-border/80 bg-background/60 px-4 font-display text-sm font-semibold text-foreground outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  <span className="block text-[11px] text-muted-foreground mt-1">
                    Exibido nos dossiês de projetos, relatórios e memoriais de cálculo.
                  </span>
                </div>

                <div>
                  <label htmlFor="field-role" className="block font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    Especialização Técnica / Cargo
                  </label>
                  <input
                    id="field-role"
                    value={profile.role}
                    onChange={(e) => profile.update({ role: e.target.value })}
                    placeholder="Ex: Caldeireiro Traçador Especialista"
                    className="w-full h-12 rounded-xl border border-border/80 bg-background/60 px-4 font-mono text-xs text-foreground outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  <span className="block text-[11px] text-muted-foreground mt-1">
                    Sua atuação principal na oficina mecânica ou caldeiraria pesada.
                  </span>
                </div>

                {/* Seleção de Nível Técnico — botões de largura total com altura 48 px */}
                <div>
                  <span className="block font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    Nível de Experiência na Interface
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLevel("aprendiz")}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-xl border px-3 font-mono text-xs transition-all cursor-pointer",
                        level === "aprendiz"
                          ? "border-sky-500 bg-sky-500/15 text-sky-500 font-bold"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <User className="size-4" />
                      <span>Aprendiz (Com dicas e guias)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLevel("mestre")}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-xl border px-3 font-mono text-xs transition-all cursor-pointer",
                        level === "mestre"
                          ? "border-amber-500 bg-amber-500/15 text-amber-500 font-bold"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <Award className="size-4" />
                      <span>Mestre (Fluxo direto de oficina)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          02 — CONTA E SEGURANÇA
          - Linhas compactas (48–52 px) com controles claros
          - Estado da sessão confirmado
          - Ações diretas e acessíveis
          ========================================================================= */}
      <section
        id="conta-seguranca"
        aria-labelledby="heading-conta"
        className="caldra-card rounded-2xl overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => toggleSection("conta")}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-emerald size-11 shrink-0">
              <ShieldCheck className="size-5 text-emerald-500" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-emerald-500">02</span>
                <h2 id="heading-conta" className="font-display text-sm sm:text-base font-bold text-foreground">
                  Conta e Segurança
                </h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[9px] text-emerald-500 font-medium">
                  {user ? "Conectado" : "Modo Local"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Estado da sessão, modo de utilização, privacidade e acesso.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("size-7 rounded-full grid place-items-center text-muted-foreground transition-transform duration-200", openSections.conta && "rotate-180")}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {openSections.conta && (
          <div className="border-t border-border/50 p-4 sm:p-5 space-y-4 bg-card/30">
            {/* Estado da sessão atual com linha de ação de 48–52 px */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Modo de Utilização / Sessão Ativa
                  </span>
                  <p className="font-mono text-xs sm:text-sm font-semibold text-foreground mt-0.5">
                    {user ? user.email : "Modo Offline · Armazenamento Local no Dispositivo"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {user
                      ? "Conta autenticada com sincronização na nuvem."
                      : "Seus dados de projetos, traçados e orçamentos ficam seguros na memória do navegador."}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 sm:pt-0 shrink-0">
                  <Link
                    to="/conta"
                    onClick={() => {
                      triggerHaptic("tap");
                      AudioManager.play("ui_nav");
                    }}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 font-mono text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 active:scale-95 transition-all"
                  >
                    <span>{user ? "Gerenciar Conta" : "Entrar / Criar Conta"}</span>
                    <ChevronRight className="size-3.5" />
                  </Link>

                  {user && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("tap");
                        void signOut();
                        toast.success("Sessão encerrada com sucesso.");
                      }}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 font-mono text-xs font-semibold text-destructive hover:bg-destructive/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <LogOut className="size-3.5" />
                      <span>Sair</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Privacidade e telemetria anônima em linha compacta de 48 px */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                Privacidade & Diagnóstico Anônimo
              </span>
              <label className="flex min-h-[48px] items-center gap-3 cursor-pointer text-xs sm:text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsentState(e.target.checked);
                    void setConsent(e.target.checked);
                    toast.success(
                      e.target.checked
                        ? "Envio de estatísticas anônimas ativado."
                        : "Envio de estatísticas anônimas desativado.",
                    );
                  }}
                  className="size-4.5 accent-amber-500 rounded cursor-pointer shrink-0"
                />
                <span className="text-foreground">
                  Compartilhar diagnósticos e métricas anônimas de uso
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Nenhum desenho técnico, cota, projeto ou fórmula é transmitido externamente.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-[11px] text-muted-foreground uppercase border-t border-border/40">
                <Link to="/privacidade" className="hover:text-foreground hover:underline">
                  Privacidade
                </Link>
                <span>·</span>
                <Link to="/termos" className="hover:text-foreground hover:underline">
                  Termos de Uso
                </Link>
                <span>·</span>
                <Link to="/conta" className="hover:text-destructive hover:underline">
                  Excluir Dados Locais
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          03 — CALDRA PRO E ASSINATURA
          - Plano atual e status claramente identificados
          - Recursos inclusos vs diferenciais Pro explicados de forma objetiva
          - Próximo passo com destaque moderado (sem escassez artificial)
          - Chave técnica de oficina / código de ativação
          ========================================================================= */}
      <section
        id="caldra-pro"
        aria-labelledby="heading-pro"
        className="caldra-card rounded-2xl overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => toggleSection("pro")}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-amber size-11 shrink-0">
              <Sparkles className="size-5 text-amber-500" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-amber-500">03</span>
                <h2 id="heading-pro" className="font-display text-sm sm:text-base font-bold text-foreground">
                  CALDRA Pro e Assinatura
                </h2>
                <span className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase border",
                  plan === "pro" || isMestre
                    ? "bg-amber-500/20 text-amber-500 border-amber-500/40"
                    : "bg-muted text-muted-foreground border-border/60",
                )}>
                  {isMestre ? "Modo Mestre" : PLAN_LABEL[plan] || "CALDRA Free"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Plano ativo, recursos inclusos, exportação DXF/PDF e licença.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("size-7 rounded-full grid place-items-center text-muted-foreground transition-transform duration-200", openSections.pro && "rotate-180")}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {openSections.pro && (
          <div className="border-t border-border/50 p-4 sm:p-5 space-y-4 bg-card/30">
            {/* Status do plano atual e chamada de ação de destaque moderado */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] uppercase text-amber-500 font-bold block">
                  Plano Atual Vigente
                </span>
                <p className="font-display text-base font-bold text-foreground mt-0.5">
                  {isMestre ? "CALDRA Pro · Licença Modo Mestre Ativa" : PLAN_LABEL[plan] || "CALDRA Free"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isMestre || plan === "pro"
                    ? "Acesso completo a planificações 3D ilimitadas, exportação DXF 1:1, cálculos com Fator K e relatórios técnicos."
                    : "Acesso à traçagem paramétrica básica no navegador. Atualize para exportar DXF e destravar relatórios."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/pro"
                  onClick={() => {
                    triggerHaptic("tap");
                    AudioManager.play("ui_nav");
                  }}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 font-mono text-xs font-bold text-black shadow-md hover:bg-amber-400 active:scale-95 transition-all"
                >
                  <span>{plan === "pro" || isMestre ? "Gerenciar Assinatura" : "Ver Planos Pro"}</span>
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </div>

            {/* Comparativo transparente de recursos reais (sem escassez artificial) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* No seu plano atual */}
              <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Incluído no Seu Plano ({isMestre ? "PRO" : PLAN_LABEL[plan] || "FREE"})
                </span>
                <ul className="space-y-1.5 text-xs text-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Traçagem paramétrica 2D e 3D no navegador</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Geometria analítica e planificação em chapa plana</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Operação 100% offline para uso na oficina</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Salvamento local no dispositivo</span>
                  </li>
                </ul>
              </div>

              {/* Diferenciais CALDRA Pro */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3.5 space-y-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-500 font-bold block">
                  Diferenciais do CALDRA Pro
                </span>
                <ul className="space-y-1.5 text-xs text-foreground">
                  <li className="flex items-start gap-2">
                    <Sparkles className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>Exportação vetorial DXF 1:1 para corte CNC e laser</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>Memoriais de cálculo detalhados e fichas em PDF</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>Compensação de dobra com Fator K configurável</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>Biblioteca técnica completa de caldeiraria pesada</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Ativação via Código de Licença / Modo Mestre */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                Ativação por Código de Licença / Chave Técnica
              </span>
              {isMestre ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Licença técnica ativa neste dispositivo.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      resetPro();
                      toast.success("CALDRA Pro desativado neste aparelho.");
                    }}
                    className="h-10 rounded-xl border border-border px-3 font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Desativar Licença
                  </button>
                </div>
              ) : (
                <form onSubmit={submitProCode} className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="DIGITE O CÓDIGO DA OFICINA"
                    autoCapitalize="characters"
                    className="flex-1 h-12 rounded-xl border border-border bg-background px-3.5 font-mono text-xs tracking-widest uppercase outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    type="submit"
                    className="h-12 rounded-xl bg-amber-500 px-5 font-mono text-xs font-bold text-black hover:bg-amber-400 active:scale-95 cursor-pointer shrink-0"
                  >
                    Ativar Chave
                  </button>
                </form>
              )}
            </div>

            {/* Painel de Diagnóstico e Restauração de Assinatura */}
            <MySubscriptionPanel />
          </div>
        )}
      </section>

      {/* =========================================================================
          04 — APARÊNCIA E PERSONALIZAÇÃO
          - Linhas compactas (48–52 px) para opções simples
          - Sliders de opacidade com rótulos e feedback visual
          - Pré-visualização reativa em tempo real
          - Restauração de padrão acessível
          ========================================================================= */}
      <section
        id="aparencia-personalizacao"
        aria-labelledby="heading-aparencia"
        className="caldra-card rounded-2xl overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => toggleSection("aparencia")}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-center size-11 shrink-0 border border-amber-500/40 text-amber-500">
              <Palette className="size-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-amber-500">04</span>
                <h2 id="heading-aparencia" className="font-display text-sm sm:text-base font-bold text-foreground">
                  Aparência e Personalização
                </h2>
                <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 font-mono text-[9px] text-amber-500 font-medium">
                  {theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : theme === "amoled" ? "AMOLED" : "Sistema"} · {cardOpacity}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Tema claro/escuro, opacidade de cartões/bolhas, cor e fundo fluido.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("size-7 rounded-full grid place-items-center text-muted-foreground transition-transform duration-200", openSections.aparencia && "rotate-180")}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {openSections.aparencia && (
          <div className="border-t border-border/50 p-4 sm:p-5 space-y-4 bg-card/30">
            {/* Cabeçalho de restauração de padrão */}
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Estilo Visual Global
                </span>
                <p className="text-xs text-muted-foreground">
                  Afeta todas as áreas: Projetar, Produzir, Início, Aprenda e Perfil.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  resetAppearance();
                  toast.success("Aparência restaurada para o padrão do CALDRA.");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/70 px-2.5 font-mono text-[10px] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Restaurar Padrão</span>
              </button>
            </div>

            {/* A. Seleção de Tema — botões de 44–48 px */}
            <div className="space-y-1.5">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Modo de Exibição
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THEMES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("tap");
                        setTheme(t.id);
                        if (t.id === "light") {
                          setAuroraStyle("fluido");
                        }
                      }}
                      className={cn(
                        "relative flex h-11 items-center justify-between rounded-xl border px-3 font-mono text-xs transition-all cursor-pointer",
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 text-amber-500 font-bold shadow-xs ring-1 ring-amber-500/30"
                          : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <span>{t.label}</span>
                      </div>
                      {isSelected && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-black">
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* B & C. Controles Deslizantes de Opacidade (20% a 100%) */}
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4 space-y-4">
              {/* Opacidade dos cartões */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-xs font-bold text-foreground block">
                      Opacidade dos Cartões
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Transparência dos blocos e painéis de dados.
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    {cardOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={cardOpacity}
                  onChange={(e) => setCardOpacity(Number(e.target.value))}
                  aria-label="Opacidade dos cartões"
                  className="w-full accent-amber-500 h-2 bg-muted rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Translúcido (20%)</span>
                  <span>Intermediário (60%)</span>
                  <span>Padrão (90%)</span>
                  <span>Opaco (100%)</span>
                </div>
              </div>

              {/* Opacidade das bolhas */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display text-xs font-bold text-foreground block">
                      Opacidade das Bolhas e Badges
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Transparência de círculos de ícones e indicadores.
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    {bubbleOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={bubbleOpacity}
                  onChange={(e) => setBubbleOpacity(Number(e.target.value))}
                  aria-label="Opacidade das bolhas"
                  className="w-full accent-amber-500 h-2 bg-muted rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Suave (20%)</span>
                  <span>Recomendado (35%)</span>
                  <span>Intermediário (60%)</span>
                  <span>Opaco (100%)</span>
                </div>
              </div>

              {/* Pré-visualização em tempo real */}
              <div className="pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Pré-visualização em Tempo Real
                </span>
                <div className="caldra-card rounded-xl p-3 flex items-center justify-between transition-all">
                  <div className="flex items-center gap-2.5">
                    <div className="caldra-bubble-base caldra-bubble-amber size-9 shrink-0">
                      <Compass className="size-4.5" />
                    </div>
                    <div>
                      <span className="font-display text-xs font-bold text-foreground block leading-tight">
                        Exemplo de Superfície CAD
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Reage instantaneamente aos ajustes de opacidade e tema
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="caldra-bubble-base caldra-bubble-red size-6.5 text-[9px] font-bold">
                      C
                    </div>
                    <div className="caldra-bubble-base caldra-bubble-sky size-6.5 text-[9px] font-bold">
                      2D
                    </div>
                    <div className="caldra-bubble-base caldra-bubble-center size-6.5 text-[9px] font-bold border border-amber-500/50 text-amber-500">
                      ✦
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cor de destaque — botões de 44 px */}
            <div className="space-y-1.5">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Cor de Destaque
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ACCENTS.map((a) => {
                  const isActive = accent === a.id || (a.id === "crimson" && accent === "magenta");
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("tap");
                        if (a.id !== "blue" && a.id !== "crimson" && !requirePro("accent.colors")) return;
                        setAccent(a.id);
                      }}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-xl border px-2.5 font-mono text-xs transition-colors cursor-pointer",
                        isActive
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500 font-semibold"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                        style={{ background: a.swatch }}
                      />
                      <span className="truncate">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estilo do Fundo / Aurora */}
            <div className="space-y-1.5">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Estilo do Fundo (Aurora)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {AURORA_STYLES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("tap");
                      setAuroraStyle(a.id);
                    }}
                    className={cn(
                      "h-11 rounded-xl border text-center font-mono text-xs uppercase transition-colors cursor-pointer",
                      auroraStyle === a.id
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold"
                        : "border-border/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {AURORA_STYLES.find((a) => a.id === auroraStyle)?.hint}
              </p>
            </div>

            {/* Estado Híbrido de IA do Organic Light Field */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-foreground font-semibold block">
                    Estado de IA do Fundo Orgânico
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Pulsos e ondas dinâmicas enquanto cálculos de traçado são executados.
                  </p>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase border",
                  isContinuous
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                    : isProcessing
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
                    : "border-border/60 text-muted-foreground",
                )}>
                  <span className={cn(
                    "size-1.5 rounded-full",
                    isContinuous ? "bg-cyan-400" : isProcessing ? "bg-amber-500" : "bg-muted-foreground",
                  )} />
                  {isContinuous ? "Contínuo" : isProcessing ? (statusText ?? "Ativo") : "Ocioso"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isProcessing && !isContinuous) {
                      stopProcessing();
                    } else {
                      triggerProcessing(8000, "Calculando Traçado & Malha IA");
                    }
                  }}
                  className="flex-1 h-10 rounded-xl border border-amber-500/30 bg-amber-500/10 font-mono text-[10px] text-amber-500 hover:bg-amber-500/20 active:scale-95 cursor-pointer"
                >
                  {isProcessing && !isContinuous ? "Parar Simulação" : "Simular IA (8s)"}
                </button>
                <button
                  type="button"
                  onClick={toggleContinuous}
                  className="h-10 rounded-xl border border-border/70 bg-card px-4 font-mono text-[10px] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
                >
                  {isContinuous ? "Desativar Contínuo" : "Modo Contínuo"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          05 — PREFERÊNCIAS DO APLICATIVO
          - Agrupadas por finalidade em linhas compactas (48–52 px)
          - Unidades, casas decimais, idioma, região e autosave
          - Painel de áudio e vibração tátil
          ========================================================================= */}
      <section
        id="preferencias-app"
        aria-labelledby="heading-preferencias"
        className="caldra-card rounded-2xl overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => toggleSection("preferencias")}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-indigo size-11 shrink-0">
              <SlidersHorizontal className="size-5 text-indigo-400" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-indigo-400">05</span>
                <h2 id="heading-preferencias" className="font-display text-sm sm:text-base font-bold text-foreground">
                  Preferências do Aplicativo
                </h2>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 font-mono text-[9px] text-indigo-400 font-medium">
                  {unit} · {precision} decimais
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Unidades, precisão, idioma, áudio, haptics e autosave do CHAMFER.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("size-7 rounded-full grid place-items-center text-muted-foreground transition-transform duration-200", openSections.preferencias && "rotate-180")}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {openSections.preferencias && (
          <div className="border-t border-border/50 p-4 sm:p-5 space-y-4 bg-card/30">
            {/* Unidades & Precisão em linhas compactas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Unidade Padrão de Exibição
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={cn(
                        "h-11 rounded-xl border text-center font-mono text-xs uppercase transition-colors cursor-pointer",
                        unit === u
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Casas Decimais
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-500">
                    {precision} ({precision === 0 ? "Inteiro" : `${precision} casas`})
                  </span>
                </div>
                <div className="flex items-center h-11">
                  <input
                    type="range"
                    min={0}
                    max={4}
                    value={precision}
                    onChange={(e) => setPrecision(Number(e.target.value))}
                    aria-label="Precisão decimal"
                    className="w-full accent-amber-500 h-2 bg-muted rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Idioma & Região */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
              <div>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Idioma da Interface
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLanguage(l.id)}
                      className={cn(
                        "h-11 rounded-xl border text-center font-mono text-[11px] transition-colors cursor-pointer",
                        language === l.id
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Formato Regional & Moeda
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(REGIONS) as RegionId[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegion(r)}
                      className={cn(
                        "h-11 rounded-xl border px-2.5 text-left font-mono text-[10px] transition-colors cursor-pointer flex flex-col justify-center",
                        region === r
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="block font-bold truncate">{REGIONS[r].label}</span>
                      <span className="text-[9px] text-muted-foreground">({REGIONS[r].currency})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Configurações da Prancheta CHAMFER CAD & Autosave em linhas de 48–52 px */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <PenTool className="size-4 text-amber-500" />
                  <span className="font-display text-xs font-bold text-foreground">
                    Prancheta CHAMFER CAD & Gravação Automática
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetChamfer}
                  className="font-mono text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Restaurar Padrão
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex min-h-[48px] items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-foreground block">
                      Autosave Automático
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      Gravação contínua no navegador
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChamfer({ autoSave: !chamferSettings.autoSave })}
                    className={cn(
                      "h-8 px-3 rounded-lg font-mono text-[10px] font-bold uppercase transition-all",
                      chamferSettings.autoSave
                        ? "bg-amber-500 text-black shadow-xs"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {chamferSettings.autoSave ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="flex min-h-[48px] items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-foreground block">
                      Recuperação de Sessão (Crash Recovery)
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      Restaura se a aba fechar
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChamfer({ recoveryEnabled: !chamferSettings.recoveryEnabled })}
                    className={cn(
                      "size-8 rounded-lg grid place-items-center border transition-all",
                      chamferSettings.recoveryEnabled
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-500"
                        : "border-border text-transparent",
                    )}
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              </div>

              {/* Intervalo do Autosave */}
              {chamferSettings.autoSave && (
                <div className="pt-1">
                  <span className="block font-mono text-[10px] text-muted-foreground mb-1">
                    Intervalo de Gravação do Autosave
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { sec: 10, label: "10s" },
                      { sec: 15, label: "15s" },
                      { sec: 30, label: "30s" },
                      { sec: 60, label: "1m" },
                      { sec: 120, label: "2m" },
                    ].map((item) => (
                      <button
                        key={item.sec}
                        type="button"
                        onClick={() => updateChamfer({ autoSaveIntervalSec: item.sec })}
                        className={cn(
                          "h-9 rounded-lg border font-mono text-[10px] font-bold text-center transition-all",
                          chamferSettings.autoSaveIntervalSec === item.sec
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-500 shadow-xs"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Painel de Áudio & Retorno Tátil */}
            <AudioSettingsPanel />
          </div>
        )}
      </section>

      {/* =========================================================================
          06 — DADOS, ARMAZENAMENTO E MANUTENÇÃO
          - Backup e restauração JSON em linhas compactas
          - Informações de versão e suporte
          ========================================================================= */}
      <section
        id="dados-manutencao"
        aria-labelledby="heading-dados"
        className="caldra-card rounded-2xl overflow-hidden transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => toggleSection("dados")}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-neutral size-11 shrink-0">
              <HardDriveDownload className="size-5 text-muted-foreground" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">06</span>
                <h2 id="heading-dados" className="font-display text-sm sm:text-base font-bold text-foreground">
                  Dados, Armazenamento e Manutenção
                </h2>
                <span className="rounded-full bg-muted border border-border/60 px-2 py-0.5 font-mono text-[9px] text-muted-foreground font-medium">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Backup, restauração JSON, diagnóstico, versão e suporte técnico.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("size-7 rounded-full grid place-items-center text-muted-foreground transition-transform duration-200", openSections.dados && "rotate-180")}>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </button>

        {openSections.dados && (
          <div className="border-t border-border/50 p-4 sm:p-5 space-y-4 bg-card/30">
            {/* Backup e Restauração com botão de 48 px */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                Backup e Portabilidade Local
              </span>
              <p className="text-xs text-muted-foreground">
                Exporte todos os projetos, materiais personalizados, traçados e preferências em um único arquivo JSON seguro.
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  setBackupOpen(true);
                }}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-border/80 bg-card px-4 font-mono text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              >
                <HardDriveDownload className="size-4 text-amber-500" />
                <span>Abrir Backup e Restauração</span>
              </button>
            </div>

            {/* Suporte, Apresentação e Diagnóstico */}
            <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Informações do Sistema
                  </span>
                  <p className="font-mono text-xs text-foreground mt-0.5">
                    CALDRA Suite · Versão {APP_VERSION} (Build {APP_BUILD})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("tap");
                    setReportOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 font-mono text-[11px] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
                >
                  <Bug className="size-3.5 text-rose-500" />
                  <span>Reportar Problema</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("caldra:open-intro"))}
                  className="h-10 rounded-xl border border-border/70 bg-muted/30 px-3 font-mono text-[10px] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
                >
                  ✦ Apresentação da CALDRA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("caldra:open-intro"));
                    window.dispatchEvent(new CustomEvent("caldra:open-preintro"));
                  }}
                  className="h-10 rounded-xl border border-border/70 bg-muted/30 px-3 font-mono text-[10px] text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
                >
                  ✦ Gênese da Marca
                </button>
                <Link
                  to="/novidades"
                  className="inline-flex h-10 items-center rounded-xl border border-border/70 bg-muted/30 px-3 font-mono text-[10px] text-muted-foreground hover:text-foreground active:scale-95"
                >
                  ✦ Novidades & Atualizações
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Diálogos modais de suporte */}
      <ReportProblemDialog open={reportOpen} onOpenChange={setReportOpen} />
      <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} />

      <footer className="text-center pt-2">
        <p className="font-mono text-[10px] text-muted-foreground">
          CALDRA · Central de Perfil e Engenharia de Caldeiraria
        </p>
      </footer>
    </NavigationAreaContainer>
  );
}
