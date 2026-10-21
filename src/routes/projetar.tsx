import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Calculator,
  Compass,
  PenTool,
  ArrowRight,
  ChevronRight,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Box,
  FileCode,
  Maximize2,
  Minimize2,
  FolderOpen,
} from "lucide-react";
import { PART_REGISTRY } from "@/lib/library/registry";
import { listProjects as listChamferProjects } from "@/lib/lab2d/projects";
import { useProjects as useDossierProjects } from "@/lib/projects/store";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { cn } from "@/lib/utils";
import { buildWire } from "@/lib/viz3d/wire";
import { Wire3D } from "@/components/chameleon/Wire3D";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { NavigationAreaContainer } from "@/components/layout/NavigationAreaContainer";

export const Route = createFileRoute("/projetar")({
  head: () => ({
    meta: [
      { title: "Crie e Calcule — Projetar | CALDRA" },
      {
        name: "description",
        content:
          "Desenvolvimento geométrico de peças, traçagens paramétricas, ambiente CAD CHAMFER e calculadora científica.",
      },
      { property: "og:title", content: "Crie e Calcule — Projetar | CALDRA" },
      {
        property: "og:description",
        content: "Projete traçados, desenhos técnicos e cálculos geométricos de caldeiraria.",
      },
    ],
  }),
  component: ProjetarPage,
});

/* =========================================================================
   1. GRÁFICOS TÉCNICOS ESPECÍFICOS PARA O AMBIENTE DE PROJETO
   ========================================================================= */

/** Gráficos técnicos específicos por família de caldeiraria para reconhecimento imediato */
function TransitionDraftGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" fill="#080A0E" />
      {/* Blueprint grid */}
      <g stroke="#38BDF8" strokeWidth="0.25" strokeOpacity="0.18">
        <line x1="0" y1="35" x2="100" y2="35" />
        <line x1="50" y1="0" x2="50" y2="70" />
      </g>
      {/* Base retangular/quadrada */}
      <rect x="20" y="15" width="60" height="40" stroke="#64748B" strokeWidth="0.8" rx="1" />
      {/* Colar redondo concêntrico */}
      <circle cx="50" cy="35" r="13" stroke="#38BDF8" strokeWidth="1" />
      {/* Geratrizes de triangulação dos cantos para a circunferência */}
      <line x1="20" y1="15" x2="41" y2="26" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="20" y1="15" x2="50" y2="22" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="80" y1="15" x2="50" y2="22" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="80" y1="15" x2="59" y2="26" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="20" y1="55" x2="41" y2="44" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="20" y1="55" x2="50" y2="48" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="80" y1="55" x2="50" y2="48" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <line x1="80" y1="55" x2="59" y2="44" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.85" />
      <circle cx="20" cy="15" r="1.2" fill="#F59E0B" />
      <circle cx="80" cy="15" r="1.2" fill="#F59E0B" />
      <circle cx="20" cy="55" r="1.2" fill="#F59E0B" />
      <circle cx="80" cy="55" r="1.2" fill="#F59E0B" />
    </svg>
  );
}

function ConeDraftGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" fill="#080A0E" />
      {/* Blueprint grid */}
      <g stroke="#38BDF8" strokeWidth="0.25" strokeOpacity="0.18">
        <line x1="0" y1="20" x2="100" y2="20" />
        <line x1="0" y1="46" x2="100" y2="46" />
        <line x1="50" y1="0" x2="50" y2="70" />
      </g>
      {/* Arco de planificação do cone */}
      <path d="M 15 56 C 26 26, 74 26, 85 56" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2.5 1.5" />
      <path d="M 28 56 C 36 40, 64 40, 72 56" stroke="#38BDF8" strokeWidth="0.8" />
      {/* Geratrizes cardinais de caldeiraria */}
      <line x1="50" y1="10" x2="15" y2="56" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.8" />
      <line x1="50" y1="10" x2="33" y2="56" stroke="#F59E0B" strokeWidth="0.4" strokeOpacity="0.5" />
      <line x1="50" y1="10" x2="50" y2="56" stroke="#F59E0B" strokeWidth="0.7" strokeOpacity="0.9" />
      <line x1="50" y1="10" x2="67" y2="56" stroke="#F59E0B" strokeWidth="0.4" strokeOpacity="0.5" />
      <line x1="50" y1="10" x2="85" y2="56" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.8" />
      <circle cx="50" cy="10" r="1.3" fill="#38BDF8" />
    </svg>
  );
}

function ElbowDraftGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" fill="#080A0E" />
      <g stroke="#38BDF8" strokeWidth="0.25" strokeOpacity="0.18">
        <line x1="20" y1="0" x2="20" y2="70" />
        <line x1="50" y1="0" x2="50" y2="70" />
        <line x1="0" y1="50" x2="100" y2="50" />
      </g>
      {/* Contorno do cotovelo segmentado (gomos de 90°) */}
      <path d="M 22 58 L 22 42 L 36 28 L 56 18 L 78 18" stroke="#38BDF8" strokeWidth="1" />
      <path d="M 42 58 L 42 48 L 54 38 L 70 32 L 78 32" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="2 1.5" />
      {/* Linhas de corte dos gomos (mitre joints) */}
      <line x1="22" y1="42" x2="42" y2="48" stroke="#F59E0B" strokeWidth="0.6" strokeOpacity="0.85" />
      <line x1="36" y1="28" x2="54" y2="38" stroke="#F59E0B" strokeWidth="0.6" strokeOpacity="0.85" />
      <line x1="56" y1="18" x2="70" y2="32" stroke="#F59E0B" strokeWidth="0.6" strokeOpacity="0.85" />
      {/* Raio de curvatura central */}
      <path d="M 32 58 A 36 36 0 0 1 78 25" stroke="#F59E0B" strokeWidth="0.5" strokeDasharray="1.5 1.5" strokeOpacity="0.6" />
    </svg>
  );
}

function IntersectDraftGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" fill="#080A0E" />
      <g stroke="#38BDF8" strokeWidth="0.25" strokeOpacity="0.18">
        <line x1="0" y1="35" x2="100" y2="35" />
        <line x1="50" y1="0" x2="50" y2="70" />
      </g>
      {/* Tubo principal horizontal */}
      <line x1="16" y1="26" x2="84" y2="26" stroke="#64748B" strokeWidth="0.75" />
      <line x1="16" y1="46" x2="84" y2="46" stroke="#64748B" strokeWidth="0.75" />
      {/* Ramal vertical (Boca de lobo) */}
      <line x1="38" y1="12" x2="38" y2="28" stroke="#38BDF8" strokeWidth="0.8" />
      <line x1="62" y1="12" x2="62" y2="28" stroke="#38BDF8" strokeWidth="0.8" />
      {/* Curva de sela (fishmouth saddle intersection) */}
      <path d="M 38 28 Q 50 38 62 28" stroke="#F59E0B" strokeWidth="1.1" />
      <path d="M 38 28 Q 50 20 62 28" stroke="#F59E0B" strokeWidth="0.7" strokeDasharray="1.5 1.5" strokeOpacity="0.7" />
    </svg>
  );
}

function FlangeDraftGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" fill="#080A0E" />
      <g stroke="#38BDF8" strokeWidth="0.25" strokeOpacity="0.18">
        <line x1="0" y1="35" x2="100" y2="35" />
        <line x1="50" y1="0" x2="50" y2="70" />
      </g>
      {/* Círculo externo do flange */}
      <circle cx="50" cy="35" r="26" stroke="#64748B" strokeWidth="0.8" />
      {/* Círculo de furação (PCD) */}
      <circle cx="50" cy="35" r="20" stroke="#F59E0B" strokeWidth="0.5" strokeDasharray="2 1.5" strokeOpacity="0.8" />
      {/* Furo central */}
      <circle cx="50" cy="35" r="10" stroke="#38BDF8" strokeWidth="1" />
      {/* 8 Furos dos parafusos */}
      <circle cx="50" cy="15" r="1.8" fill="#38BDF8" />
      <circle cx="50" cy="55" r="1.8" fill="#38BDF8" />
      <circle cx="30" cy="35" r="1.8" fill="#38BDF8" />
      <circle cx="70" cy="35" r="1.8" fill="#38BDF8" />
      <circle cx="36" cy="21" r="1.8" fill="#38BDF8" />
      <circle cx="64" cy="21" r="1.8" fill="#38BDF8" />
      <circle cx="36" cy="49" r="1.8" fill="#38BDF8" />
      <circle cx="64" cy="49" r="1.8" fill="#38BDF8" />
    </svg>
  );
}

function PartThumbnailGraphic({ family, className }: { family: string; className?: string }) {
  switch (family) {
    case "Transições":
      return <TransitionDraftGraphic className={className} />;
    case "Cones":
      return <ConeDraftGraphic className={className} />;
    case "Curvas":
      return <ElbowDraftGraphic className={className} />;
    case "Interseções":
      return <IntersectDraftGraphic className={className} />;
    case "Flanges":
      return <FlangeDraftGraphic className={className} />;
    default:
      return <ConeDraftGraphic className={className} />;
  }
}

/* =========================================================================
   2. MODELOS TÉCNICOS EM DESTAQUE PARA O HERO CAD INTERATIVO
   ========================================================================= */

type FeaturedModel = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  norma: string;
  method: string;
  level: string;
  d1: number;
  d2: number;
  h: number;
  e: number;
};

const FEATURED_MODELS: FeaturedModel[] = [
  {
    id: "quadrado-redondo",
    slug: "quadrado-redondo",
    title: "Quadrado → Redondo",
    subtitle: "Transição por triangulação de geratrizes",
    category: "Transições",
    norma: "DIN 2448 / ASME",
    method: "Triangulação",
    level: "Avançado",
    d1: 800,
    d2: 400,
    h: 500,
    e: 0,
  },
  {
    id: "tronco-de-cone",
    slug: "tronco-de-cone",
    title: "Tronco de Cone",
    subtitle: "Redução cônica concêntrica pelo raio verdadeiro",
    category: "Cones",
    norma: "ASME B16.9",
    method: "Radial",
    level: "Intermediário",
    d1: 900,
    d2: 450,
    h: 600,
    e: 0,
  },
  {
    id: "curva-de-gomos",
    slug: "curva-de-gomos",
    title: "Curva de Gomos 90°",
    subtitle: "Cotovelo segmentado para tubulações industriais",
    category: "Curvas",
    norma: "AWWA C208",
    method: "Projeção Cilíndrica",
    level: "Avançado",
    d1: 600,
    d2: 600,
    h: 600,
    e: 0,
  },
  {
    id: "boca-de-lobo",
    slug: "boca-de-lobo",
    title: "Boca de Lobo 90°",
    subtitle: "Interseção ortogonal de tubulações com penetração",
    category: "Interseções",
    norma: "API 5L / ASME B31.3",
    method: "Interseção 3D",
    level: "Avançado",
    d1: 500,
    d2: 350,
    h: 600,
    e: 0,
  },
  {
    id: "cone-excentrico",
    slug: "cone-excentrico",
    title: "Cone Excêntrico",
    subtitle: "Redução plana de fundo para drenos e bombas",
    category: "Cones",
    norma: "DIN EN 10253",
    method: "Radial Oblíquo",
    level: "Avançado",
    d1: 800,
    d2: 400,
    h: 550,
    e: 200,
  },
];

/* =========================================================================
   3. CATEGORIAS DE TRAÇAGEM (CARROSSEL HORIZONTAL)
   ========================================================================= */

const TRACAGEM_CATEGORIES = [
  { id: "todas", label: "Todas as Peças", count: PART_REGISTRY.length },
  { id: "Transições", label: "Transições", count: 8 },
  { id: "Cones", label: "Cones & Reduções", count: 6 },
  { id: "Curvas", label: "Curvas de Gomos", count: 4 },
  { id: "Interseções", label: "Interseções & Tês", count: 7 },
  { id: "Cilíndricas", label: "Cilíndricas & Virolas", count: 5 },
  { id: "Flanges", label: "Flanges & Tampas", count: 6 },
];

/* =========================================================================
   COMPONENTE PRINCIPAL — PROJETAR (CRIE E CALCULE)
   ========================================================================= */

function ProjetarPage() {
  const navigate = useNavigate();

  // Projetos salvos no CHAMFER e no dossiê
  const chamferProjects = useMemo(() => listChamferProjects(), []);
  const dossierProjects = useDossierProjects();

  // Estado do modelo em exibição no Hero CAD
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const activeModel = FEATURED_MODELS[activeModelIndex];

  // Estado da categoria de traçagem selecionada
  const [selectedCategory, setSelectedCategory] = useState("todas");

  // Estado do modo de visualização da viewport 3D
  const [edgeMode, setEdgeMode] = useState<"shaded-edges" | "wireframe">("shaded-edges");
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewNonce, setViewNonce] = useState(0);
  const [isExpandedViewport, setIsExpandedViewport] = useState(false);

  // Construção reativa do modelo 3D matemático
  const wireModel = useMemo(() => {
    return buildWire(activeModel.slug, {
      d1: activeModel.d1,
      d2: activeModel.d2,
      h: activeModel.h,
      e: activeModel.e,
      seg: 48,
      divisions: 6,
      t: 6,
    });
  }, [activeModel]);

  // Lista de peças filtradas pela categoria
  const filteredParts = useMemo(() => {
    if (selectedCategory === "todas") {
      return PART_REGISTRY.slice(0, 10);
    }
    return PART_REGISTRY.filter((p) => p.family === selectedCategory).slice(0, 8);
  }, [selectedCategory]);

  return (
    <div className="relative w-full min-h-screen bg-transparent text-foreground overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      <NavigationAreaContainer>
        {/* =========================================================================
            CABEÇALHO DA SEÇÃO DE PROJETO
            - Identificador: "PROJETO TÉCNICO & CAD"
            ========================================================================= */}
        <NavigationAreaHeader
          badgeText="PROJETO TÉCNICO & CAD"
          badgeColor="text-sky-500"
          indicatorColor="bg-sky-500"
          secondaryBadge={
            <span className="rounded bg-sky-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-sky-500 border border-sky-500/30">
              CALDRA LAB
            </span>
          }
          title="Projetar"
          actions={
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground bg-card/60 border border-border/70 rounded-lg px-2.5 py-1">
              <Box className="size-3 text-sky-500" />
              <span>{PART_REGISTRY.length} MODELOS CAD</span>
            </div>
          }
        />

        {/* =========================================================================
            NÍVEL 1: FERRAMENTAS PRIORITÁRIAS (AÇÕES IMEDIATAS)
            1.1 FERRAMENTA COMPLEXA EM DESTAQUE (LARGURA TOTAL):
                TRAÇAGEM PARAMÉTRICA & MODELAGEM 3D B-REP
            ========================================================================= */}
        <section
          aria-label="Ambiente CAD em Destaque"
          className="caldra-hero relative overflow-hidden rounded-2xl border dark:border-zinc-800/90 border-border/80 dark:bg-gradient-to-b dark:from-[#13151B] dark:to-[#0D0E12] shadow-2xl p-3 sm:p-3.5 space-y-2.5"
        >
          {/* Header do Hero: Seletor de modelo + Norma técnica */}
          <div className="flex items-center justify-between gap-2 border-b dark:border-zinc-800/60 border-border/60 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="caldra-bubble-base caldra-bubble-amber size-8 shrink-0">
                <Compass className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[8.5px] font-bold text-amber-500 uppercase">
                    TRAÇAGEM 3D
                  </span>
                  <span className="font-mono text-[7.5px] text-zinc-400 bg-zinc-800/80 px-1 rounded">
                    {activeModel.norma}
                  </span>
                </div>
                <h2 className="font-display text-sm font-bold text-foreground dark:text-zinc-100 truncate">
                  {activeModel.title}
                </h2>
              </div>
            </div>

            {/* Alternar modelo demonstrativo */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  AudioManager.play("ui_pop");
                  setActiveModelIndex((prev) => (prev + 1) % FEATURED_MODELS.length);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-2 py-1 font-mono text-[9px] font-medium text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
                title="Alternar modelo demonstrativo"
              >
                <span>Alternar</span>
                <ChevronRight className="size-3 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Viewport 3D Principal Interativa */}
          <div
            className={cn(
              "relative w-full rounded-xl border border-zinc-800/90 bg-gradient-to-b from-[#090B0F] to-[#050608] overflow-hidden transition-all",
              isExpandedViewport
                ? "fixed inset-3 z-50 h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] rounded-2xl border-zinc-700/90 shadow-2xl"
                : "h-44 sm:h-48",
            )}
          >
            {/* Grid blueprint CAD de fundo */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(#38bdf8 0.75px, transparent 0.75px), radial-gradient(#f59e0b 0.5px, transparent 0.5px)",
                backgroundSize: "20px 20px, 40px 40px",
                backgroundPosition: "0 0, 10px 10px",
              }}
            />
            {/* Iluminação direcional radial superior-esquerda */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 26% 22%, rgba(148, 163, 184, 0.14) 0%, rgba(15, 23, 42, 0.04) 48%, transparent 75%)",
              }}
            />

            {/* Canvas 3D Paramétrico Real */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Wire3D
                model={wireModel}
                className="size-full"
                interactive={true}
                autoSpin={autoRotate}
                edgeMode={edgeMode}
                viewNonce={viewNonce}
                showRefLines={false}
              />
            </div>

            {/* Cotas técnicas em tempo real */}
            <div className="pointer-events-none absolute top-2.5 left-3 flex flex-col gap-0.5">
              <span className="font-mono text-[8px] font-semibold text-zinc-400 tracking-wider">
                GEOMETRIA PARAMÉTRICA • 360°
              </span>
              <span className="font-mono text-[9px] font-bold text-amber-400">
                D1={activeModel.d1} • D2={activeModel.d2} • H={activeModel.h} mm
              </span>
            </div>

            {/* Barra de Ferramentas Flutuante (Bottom-Right do Visor: 3 botões circulares escuros com ícones dourados/brancos) */}
            <div
              className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5"
              role="group"
              aria-label="Controles flutuantes do visor 3D"
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  setViewNonce((n) => n + 1);
                  setAutoRotate(true);
                }}
                className="flex size-8 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/90 text-amber-400 shadow-lg backdrop-blur-md transition-all hover:border-amber-500/50 hover:bg-zinc-800 active:scale-95 cursor-pointer"
                title="Resetar Rotação / Vista Padrão"
                aria-label="Resetar Rotação / Vista Padrão"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  setEdgeMode((m) => (m === "shaded-edges" ? "wireframe" : "shaded-edges"));
                }}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer",
                  edgeMode === "shaded-edges"
                    ? "border-amber-500/50 bg-zinc-900/90 text-amber-400 hover:bg-zinc-800"
                    : "border-zinc-700/80 bg-zinc-900/90 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800",
                )}
                title="Alternar Modo de Camadas / Wireframe vs. Sólido"
                aria-label="Alternar Modo de Camadas / Wireframe vs. Sólido"
              >
                <Layers className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setIsExpandedViewport((v) => !v);
                }}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer",
                  isExpandedViewport
                    ? "border-amber-500/50 bg-zinc-900/90 text-amber-400 hover:bg-zinc-800"
                    : "border-zinc-700/80 bg-zinc-900/90 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800",
                )}
                title={isExpandedViewport ? "Recolher Tela Cheia" : "Tela Cheia / Expandir"}
                aria-label={isExpandedViewport ? "Recolher Tela Cheia" : "Tela Cheia / Expandir"}
              >
                {isExpandedViewport ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Parâmetros técnicos essenciais */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800/70 p-2 text-center">
            <div className="flex flex-col">
              <span className="font-mono text-[7.5px] text-zinc-400 uppercase">MÉTODO</span>
              <span className="font-mono text-[9.5px] font-bold text-zinc-200 truncate">
                {activeModel.method}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[7.5px] text-zinc-400 uppercase">NÍVEL</span>
              <span className="font-mono text-[9.5px] font-bold text-amber-400">
                {activeModel.level}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[7.5px] text-zinc-400 uppercase">FABRICAÇÃO</span>
              <span className="font-mono text-[9.5px] font-bold text-emerald-400">
                Zero Fresta
              </span>
            </div>
          </div>

          {/* Ação contextual clara: Traçar Esta Peça Agora */}
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              to="/tracagem/$slug"
              params={{ slug: activeModel.slug }}
              onClick={() => {
                triggerHaptic("success");
                AudioManager.play("ui_action");
              }}
              className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-3 font-display text-xs font-bold text-zinc-950 shadow-md transition-all cursor-pointer"
            >
              <Compass className="size-4" strokeWidth={2.2} />
              <span>Traçar esta peça agora</span>
              <ArrowRight className="size-3.5 ml-auto stroke-[2.5]" />
            </Link>

            <Link
              to="/tracagem"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="flex h-10 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-3 font-mono text-xs font-semibold text-zinc-300 hover:bg-zinc-700 active:scale-[0.98] transition-all cursor-pointer"
              title="Ver todas as traçagens"
            >
              <span>Todas</span>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            1.2 GRADE DE DUAS COLUNAS: FERRAMENTAS PRIORITÁRIAS (ALTURA 112–144 PX)
            - Cartões compactos com área clicável integral
            - Bolhas de 42 px e badges contextuais
            - CHAMFER 2D CAD e Calculadora Científica
            ========================================================================= */}
        <section aria-label="Ferramentas prioritárias" className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="size-1.5 rounded-full bg-amber-500" />
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ações Rápidas de Criação
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Ferramenta 1 — Prancheta CAD 2D CHAMFER */}
            <Link
              to="/desenho-2d"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[118px] sm:min-h-[126px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-red-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-red size-10.5">
                  <PenTool className="size-5 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7.5px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded">
                  DXF · 2D
                </span>
              </div>

              <div className="my-1.5">
                <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-red-500 transition-colors">
                  Prancheta CAD 2D
                </h3>
                <p className="text-[9.5px] sm:text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  Desenho vetorial de perfis, furos, chanfros e exportação DXF.
                </p>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span className="truncate">
                  {chamferProjects.length > 0
                    ? `${chamferProjects.length} desenhos`
                    : "Novo traçado"}
                </span>
                <ChevronRight className="size-3 text-red-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>

            {/* Ferramenta 2 — Calculadora Científica */}
            <Link
              to="/calculadora"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[118px] sm:min-h-[126px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-amber-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-amber size-10.5">
                  <Calculator className="size-5 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7.5px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  TRIGONOMETRIA
                </span>
              </div>

              <div className="my-1.5">
                <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-amber-500 transition-colors">
                  Calculadora Científica
                </h3>
                <p className="text-[9.5px] sm:text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  Trigonometria, arcos, cordas e fórmulas de oficina.
                </p>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span className="truncate">sen • cos • tan • √</span>
                <ChevronRight className="size-3 text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            NÍVEL 2: FERRAMENTAS COMPLEMENTARES AGRUPADAS POR FINALIDADE
            2.1 BIBLIOTECA DE TRAÇAGEM PARAMÉTRICA (CARROSSEL HORIZONTAL CONFINADO)
            ========================================================================= */}
        <section aria-label="Biblioteca de Traçagem Paramétrica" className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-sky-500" />
              <h2 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                Modelos de Caldeiraria
              </h2>
            </div>
            <Link
              to="/tracagem"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="font-mono text-[10px] text-amber-500 hover:underline flex items-center gap-0.5"
            >
              <span>Ver todos ({PART_REGISTRY.length})</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>

          {/* Filtros em pílulas deslizáveis funcionais */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar overscroll-x-contain -mx-4 sm:-mx-5 px-4 sm:px-5">
            {TRACAGEM_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    AudioManager.play("ui_select");
                    setSelectedCategory(cat.id);
                  }}
                  className={cn(
                    "shrink-0 min-h-[34px] rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold transition-all cursor-pointer touch-manipulation active:scale-95",
                    active
                      ? "bg-amber-500 text-black font-bold shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Carrossel de Peças com largura de 142–150 px */}
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar overscroll-x-contain snap-x snap-mandatory -mx-4 sm:-mx-5 px-4 sm:px-5">
            {filteredParts.map((part) => (
              <Link
                key={part.id}
                to="/tracagem/$slug"
                params={{ slug: part.engineSlug || "quadrado-redondo" }}
                onClick={() => {
                  triggerHaptic("selection");
                  AudioManager.play("ui_pop");
                }}
                className="caldra-card group relative flex w-[142px] xs:w-[150px] shrink-0 flex-col justify-between rounded-xl p-2.5 transition-all hover:border-amber-500/50 active:scale-[0.98] snap-start cursor-pointer text-left"
              >
                {/* Thumbnail técnico vetorial específico da geometria */}
                <div className="relative h-18 w-full rounded-lg bg-slate-100/80 dark:bg-[#07090D] border border-border/80 overflow-hidden flex items-center justify-center p-1">
                  <PartThumbnailGraphic family={part.family} className="size-full opacity-75 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-1 right-1 font-mono text-[7px] text-muted-foreground bg-card/90 px-1 rounded border border-border/70">
                    {part.family}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-col min-w-0">
                  <span className="font-display text-[11px] font-bold text-foreground truncate group-hover:text-amber-500 transition-colors">
                    {part.name}
                  </span>
                  <span className="font-mono text-[8px] text-muted-foreground line-clamp-1">
                    {part.summary}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-border/60 text-[8.5px] font-mono text-amber-500">
                  <span>Traçar</span>
                  <ArrowRight className="size-2.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* =========================================================================
            2.2 GRADE DE DUAS COLUNAS: FERRAMENTAS COMPLEMENTARES DE FABRICAÇÃO
            - Planificação de Chapa (Nesting/Retalho) e Dossiê de Montagem (BOM)
            - Altura determinada pelo conteúdo (112–144 px)
            ========================================================================= */}
        <section aria-label="Ferramentas complementares" className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Planejamento & Montagem
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Ferramenta 3 — Planificação de Chapa */}
            <Link
              to="/planificacao"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group flex min-h-[118px] sm:min-h-[126px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-sky-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-sky size-10.5">
                  <Layers className="size-5 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7.5px] font-bold text-sky-500 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded">
                  CHAPA PLANA
                </span>
              </div>

              <div className="my-1.5">
                <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-sky-500 transition-colors">
                  Planificação de Chapa
                </h3>
                <p className="text-[9.5px] sm:text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  Distribuição comercial, cálculo de retalho, sobras e massa.
                </p>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span className="truncate">Aproveitamento</span>
                <ChevronRight className="size-3 text-sky-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>

            {/* Ferramenta 4 — Dossiê de Projetos & Montagem */}
            <Link
              to="/projetos"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group flex min-h-[118px] sm:min-h-[126px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-emerald-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-emerald size-10.5">
                  <FolderOpen className="size-5 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7.5px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  {dossierProjects.length > 0 ? `${dossierProjects.length} PROJ` : "MONTAGEM"}
                </span>
              </div>

              <div className="my-1.5">
                <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-emerald-500 transition-colors">
                  Dossiê de Projetos
                </h3>
                <p className="text-[9.5px] sm:text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  Árvore de subconjuntos, revisão técnica e lista de corte.
                </p>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span className="truncate">Conjuntos & BOM</span>
                <ChevronRight className="size-3 text-emerald-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            NÍVEL 3: RECURSOS AVANÇADOS DE ENGENHARIA (DESCOBERTA PROGRESSIVA)
            - Pós-Processamento CNC (G-Code) e Fator K / Compensação de Dobra
            - Grade de 2 colunas, 112–144 px
            ========================================================================= */}
        <section aria-label="Recursos avançados" className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="size-1.5 rounded-full bg-indigo-500" />
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recursos Avançados de Fabricação
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Recurso 1 — Pós-Processador CNC */}
            <Link
              to="/tracagem"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group flex min-h-[114px] sm:min-h-[122px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-indigo-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-indigo size-10">
                  <FileCode className="size-4.5 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7.5px] font-bold text-indigo-500 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                  G-CODE · CNC
                </span>
              </div>

              <div className="my-1">
                <h3 className="font-display text-[12.5px] sm:text-[13px] font-bold text-foreground leading-tight group-hover:text-indigo-400 transition-colors">
                  Pós-Processador CNC
                </h3>
                <p className="text-[9px] sm:text-[9.5px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  Trajetórias para plasma e oxicorte com compensação de raio.
                </p>
              </div>

              <div className="flex items-center justify-between text-[8.5px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span>Código G</span>
                <ChevronRight className="size-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>

            {/* Recurso 2 — Compensação de Dobra & Fator K */}
            <Link
              to="/oficina"
              search={{ tab: "chapa" }}
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group flex min-h-[114px] sm:min-h-[122px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-amber-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-amber size-10">
                  <SlidersHorizontal className="size-4.5 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7.5px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  FATOR K
                </span>
              </div>

              <div className="my-1">
                <h3 className="font-display text-[12.5px] sm:text-[13px] font-bold text-foreground leading-tight group-hover:text-amber-500 transition-colors">
                  Compensação de Dobra
                </h3>
                <p className="text-[9px] sm:text-[9.5px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  Dedução de dobra neutra por espessura e abertura de V.
                </p>
              </div>

              <div className="flex items-center justify-between text-[8.5px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span>Tabelas de conformação</span>
                <ChevronRight className="size-3 text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>
          </div>
        </section>

        {/* Rodapé técnico discreto */}
        <footer className="pt-2 pb-1 text-center font-mono text-[9px] text-muted-foreground/70">
          CALDRA Metal Lab Suite • Precisão Sub-Milimétrica • Offline-First
        </footer>
      </NavigationAreaContainer>
    </div>
  );
}

