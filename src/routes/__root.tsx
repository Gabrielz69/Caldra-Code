import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { SubscriptionProvider } from "@/lib/subscription/SubscriptionProvider";
import { SettingsProvider } from "@/lib/settings/SettingsProvider";
import { ProfileProvider } from "@/lib/profile/ProfileProvider";
import { MaterialsProvider } from "@/lib/materials/MaterialsProvider";
import { AudioProvider } from "@/lib/audio/AudioProvider";
import { AIProcessingProvider } from "@/lib/ai/aiProcessingContext";
import { AppShell } from "@/components/chameleon/AppShell";
import {
  CORE_ROUTES,
  measureFirstInteraction,
  onIdle,
  prefetchAllowed,
} from "@/lib/perf/firstInteraction";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O recurso solicitado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="brand-gradient inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-background"
          >
            Voltar ao Laboratório
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo falhou no processamento. Tente novamente ou volte ao Laboratório.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

/** Tema aplicado SINCRONAMENTE antes do primeiro paint — sem flash. Padrão inicial: Claro ('light') e Azul ('blue' / '#0066FF'). */
const THEME_BOOT = `(function(){try{
var tm=localStorage.getItem("caldra_theme_mode");
var ac=localStorage.getItem("caldra_accent_color");
var s=JSON.parse(localStorage.getItem("caldra.settings")||"{}");
var t=tm||s.theme||"light";
var a=ac||s.accent||"blue";
if(a==="#0066FF"||a==="#0066ff"||a==="#007AFF"||a==="#00CCFF")a="blue";
if(a==="#F59E0B"||a==="#f59e0b")a="amber";
if(a==="#B22222"||a==="#b22222"||a==="magenta")a="crimson";
var r=document.documentElement;
var prefersDark=!window.matchMedia||window.matchMedia("(prefers-color-scheme: dark)").matches;
var dark=t==="dark"||t==="amoled"||(t==="system"&&prefersDark);
r.classList.toggle("dark",dark);r.classList.toggle("amoled",t==="amoled");
r.classList.toggle("accent-default",a==="default");r.classList.toggle("accent-blue",a==="blue");
var isCrimson=a==="crimson";
r.classList.toggle("accent-crimson",isCrimson);r.classList.toggle("accent-magenta",isCrimson);
var co=typeof s.cardOpacity==="number"?Math.min(100,Math.max(20,s.cardOpacity)):90;
var bo=typeof s.bubbleOpacity==="number"?Math.min(100,Math.max(20,s.bubbleOpacity)):35;
r.style.setProperty("--card-opacity",(co/100).toFixed(2));
r.style.setProperty("--bubble-opacity",(bo/100).toFixed(2));
r.lang=s.language==="en"?"en":s.language==="es"?"es":"pt-BR";
}catch(e){}})();`;

/** Splash de abertura: pinta antes do JS e some com fade após a montagem. */
const BOOT_SPLASH_STYLE = `
#caldra-boot{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0B0B0C;transition:opacity .35s ease;font-family:'Space Grotesk',system-ui,sans-serif}
#caldra-boot .mark{width:76px;height:76px;border-radius:22px;background:#141416;border:1px solid rgba(245,158,11,0.3);box-shadow:0 0 24px rgba(245,158,11,0.2);display:grid;place-items:center;animation:caldra-boot-pulse 2s ease-in-out infinite}
#caldra-boot .mark svg{width:50px;height:50px}
#caldra-boot p{color:#F4F4F5;font-size:16px;font-weight:700;letter-spacing:.15em;margin:0}
#caldra-boot span{color:#A1A1AA;font-size:10px;letter-spacing:.22em;text-transform:uppercase}
#caldra-boot.done{opacity:0;pointer-events:none}
@keyframes caldra-boot-pulse{0%,100%{transform:scale(1);box-shadow:0 0 20px rgba(245,158,11,0.15)}50%{transform:scale(1.05);box-shadow:0 0 36px rgba(245,158,11,0.38)}}
`;
const BOOT_SPLASH_HTML = `<div class="mark"><svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M 38 18 L 82 18 L 66.5 33.5 L 50 33.5 L 33.5 50 L 50 66.5 L 82 66.5 L 66.5 82 L 38 82 L 18 62 L 18 38 Z" fill="#EDEDF2" stroke="#EDEDF2" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M 43 42.5 L 60 42.5 L 75.5 58 L 58.5 58 Z" fill="#007AFF" stroke="#007AFF" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/></svg></div><p>CALDRA</p><span>Traçado · Planificação Zero Fresta</span>`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CALDRA - Metal Lab Suite" },
      {
        name: "description",
        content:
          "Traçagem, planificação, cálculo técnico e projetos paramétricos para caldeiraria industrial.",
      },
      { property: "og:title", content: "CALDRA - Metal Lab Suite" },
      {
        property: "og:description",
        content:
          "Traçagem, planificação, cálculo técnico e projetos paramétricos para caldeiraria industrial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [
      {
        children: THEME_BOOT,
      },
    ],
    styles: [
      {
        children: BOOT_SPLASH_STYLE,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="accent-blue bg-background" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground min-h-screen overflow-x-hidden m-0 p-0" suppressHydrationWarning>
        <div id="caldra-boot" dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_HTML }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Cold start: remove o splash assim que o app monta.
  useEffect(() => {
    const el = document.getElementById("caldra-boot");
    if (!el) return;
    el.classList.add("done");
    const t = window.setTimeout(() => el.remove(), 420);
    return () => window.clearTimeout(t);
  }, []);

  // Medição de latência da primeira interação (somente desenvolvimento).
  useEffect(() => measureFirstInteraction(), []);

  /* Prefetch das telas de navegação essencial, UMA de cada vez, só com o
     navegador ocioso e nunca durante uma navegação — para não disputar a
     linha principal justamente quando o usuário toca em algo.
     Fica fora do modo de desenvolvimento: ali cada tela é servida em
     centenas de arquivos soltos e o prefetch atrapalharia em vez de ajudar
     (no aplicativo publicado cada tela é um único pacote). */
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!prefetchAllowed()) return;

    let cancelled = false;
    let cancel: () => void = () => {};
    const queue = [...CORE_ROUTES];
    const step = () => {
      if (cancelled) return;
      /* Navegação em curso: o toque do usuário tem prioridade absoluta. */
      if (router.state.isLoading || router.state.isTransitioning) {
        cancel = onIdle(step, 4000);
        return;
      }
      const to = queue.shift();
      if (!to) return;
      void Promise.resolve(router.preloadRoute({ to }))
        .catch(() => {})
        .finally(() => {
          if (!cancelled) cancel = onIdle(step, 4000);
        });
    };
    cancel = onIdle(step, 4000);
    return () => {
      cancelled = true;
      cancel();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <SettingsProvider>
            <ProfileProvider>
              <MaterialsProvider>
                <AudioProvider>
                  <AIProcessingProvider>
                    <AppShell>
                      <Outlet />
                    </AppShell>
                    <Toaster position="top-center" />
                  </AIProcessingProvider>
                </AudioProvider>
              </MaterialsProvider>
            </ProfileProvider>
          </SettingsProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
