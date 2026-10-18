import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { MasterModeDialog } from "./MasterModeDialog";
import { BubbleNav } from "./BubbleNav";
import { Intro, useIntro } from "./Intro";
import { Onboarding } from "./Onboarding";
import { Avatar, ProfileDialog } from "./Profile";
import { PaywallDialog } from "./Paywall";
import { AuroraBackground } from "./Aurora";
import { ShellActionsProvider } from "./ShellActions";
import { triggerHaptic } from "@/lib/ui/haptics";
import { CaldraGenesisPreIntro } from "./CaldraGenesisPreIntro";

/** Rotas com fundo AURORA. O editor CHAMFER (desenho-2d) e a Home nunca entram aqui. */
const AURORA_ROUTES = ["/tracagem", "/escola", "/projetos", "/oficina", "/configuracoes"];

function auroraVisible(pathname: string) {
  return AURORA_ROUTES.some((r) => pathname.startsWith(r));
}

/** Editor CHAMFER aberto: tela cheia imersiva, sem navegação global. */
function immersiveRoute(pathname: string) {
  return /^\/desenho-2d\/[^/]+/.test(pathname);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [masterOpen, setMasterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { isMestre, closeGate } = useFeatureAccess();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const intro = useIntro();
  const profile = useProfile();

  // Executa na abertura do aplicativo por exatamente 5,000 segundos
  const [startupGenesis, setStartupGenesis] = useState(false);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("autostart") === "1") {
        setAutostart(true);
        setStartupGenesis(false);
        window.sessionStorage.setItem("caldra.genesis_session_done", "1");
        window.sessionStorage.setItem("caldra.intro.v2", "done");
        return;
      }
      if (sp.has("genesis") || sp.has("abertura") || sp.has("preintro")) {
        setStartupGenesis(true);
        return;
      }
      if (!window.sessionStorage.getItem("caldra.genesis_session_done")) {
        setStartupGenesis(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handleReopen = () => setStartupGenesis(true);
    window.addEventListener("caldra:open-preintro", handleReopen);
    return () => window.removeEventListener("caldra:open-preintro", handleReopen);
  }, []);

  const showOnboarding =
    profile.ready && !intro.show && !profile.onboarded && !startupGenesis && !autostart;
  const editorPath = immersiveRoute(pathname);
  const immersive = editorPath;
  const standalone = pathname.startsWith("/calculadora");

  /* A troca de rota encerra o gate antes de o editor montar. Assim, o portal,
     o bloqueio de scroll e o backdrop nunca sobrevivem dentro do CHAMFER. */
  useEffect(() => {
    if (editorPath) closeGate();
  }, [closeGate, editorPath]);

  return (
    <ShellActionsProvider
      value={{ openProfile: () => setProfileOpen(true), openMaster: () => setMasterOpen(true) }}
    >
      <div className="relative flex min-h-screen flex-col overflow-x-hidden text-foreground">
        <AuroraBackground active={auroraVisible(pathname)} className="fixed inset-0 z-0" />
        {/* iluminação ambiente */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-40 -left-32 size-[26rem] rounded-full bg-accent/8 blur-[120px]" />
          <div className="absolute -right-32 bottom-0 size-[26rem] rounded-full bg-accent2/8 blur-[120px]" />
          {isMestre && (
            <div className="absolute top-1/3 left-1/2 size-[22rem] -translate-x-1/2 rounded-full bg-accent/6 blur-[140px]" />
          )}
        </div>

        {!immersive && !standalone && (
          <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic("tap");
                setMasterOpen(true);
              }}
              aria-label={isMestre ? "Modo Mestre ativo" : "Ativar Modo Mestre"}
              className={cn(
                "grid size-9 place-items-center rounded-full transition-all duration-180 [transition-timing-function:var(--ease-natural)] touch-manipulation select-none cursor-pointer",
                "metal backdrop-blur-xl hover:scale-105 active:scale-95",
                isMestre ? "text-accent glow-ring" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="size-4" />
            </button>
            <button
              onClick={() => {
                triggerHaptic("tap");
                setProfileOpen(true);
              }}
              aria-label="Abrir perfil"
              className="rounded-full transition-transform duration-180 [transition-timing-function:var(--ease-natural)] hover:scale-105 active:scale-95 touch-manipulation cursor-pointer"
            >
              <Avatar photo={profile.photo} size={36} className="backdrop-blur-xl shadow-sm" />
            </button>
          </div>
        )}

        <main
          className={cn(
            "relative z-10 min-w-0 flex-1",
            !immersive && "fade-up",
            immersive || standalone ? "p-0" : "px-4 pt-16 pb-28 lg:px-10 lg:pt-16 lg:pb-24",
          )}
        >
          <div className={cn(immersive || standalone ? "w-full" : "mx-auto w-full max-w-6xl")}>
            {children}
          </div>
        </main>

        {!immersive && !standalone && <BubbleNav />}
        <MasterModeDialog open={masterOpen} onOpenChange={setMasterOpen} />
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        <PaywallDialog />
        {intro.show && !startupGenesis && <Intro onDone={intro.done} />}
        {showOnboarding && <Onboarding />}
        {startupGenesis && (
          <CaldraGenesisPreIntro
            onComplete={() => {
              setStartupGenesis(false);
              try {
                window.sessionStorage.setItem("caldra.genesis_session_done", "1");
              } catch {
                /* ignore */
              }
            }}
          />
        )}
      </div>
    </ShellActionsProvider>
  );
}
