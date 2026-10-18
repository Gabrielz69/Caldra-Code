import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  FolderKanban,
  FileText,
  Wrench,
  Plus,
  ChevronRight,
  Grid2x2,
  Wallet,
  Receipt,
  QrCode,
  Layers,
  ArrowRight,
  Flame,
  Activity,
  Scissors,
  SlidersHorizontal,
  PenTool,
  Play,
  CheckCircle2,
  Box,
} from "lucide-react";
import {
  useProjects,
  createProject,
  projectProgress,
  type NewProjectInput,
  type Project,
  PROJECT_STATUS_LABEL,
} from "@/lib/projects/store";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { NavigationAreaContainer } from "@/components/layout/NavigationAreaContainer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produzir")({
  head: () => ({
    meta: [
      { title: "Orce e Fabrique — Produzir | CALDRA" },
      {
        name: "description",
        content:
          "Gestão de projetos de fabricação, documentação técnica, gabaritos, orçamentos e ferramentas de oficina metálica.",
      },
      { property: "og:title", content: "Orce e Fabrique — Produzir | CALDRA" },
      {
        property: "og:description",
        content: "Organize projetos, emita documentação de corte e execute na oficina com precisão.",
      },
    ],
  }),
  component: ProduzirPage,
});

/* =========================================================================
   1. ILUSTRAÇÕES TÉCNICAS VETORIAIS (NETFLIX CINEMA + CAD INDUSTRIAL)
   ========================================================================= */

/** Ilustração técnica de chapa de aço com Nesting CNC e feixe de corte */
function SheetNestingGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="metalPlateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E222D" />
          <stop offset="50%" stopColor="#151821" />
          <stop offset="100%" stopColor="#0E1017" />
        </linearGradient>
        <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Chapa base retangular 1200x3000mm standard */}
      <rect
        x="6"
        y="6"
        width="188"
        height="98"
        rx="6"
        fill="url(#metalPlateGrad)"
        stroke="#2E3444"
        strokeWidth="1.2"
      />

      {/* Grade de coordenadas de corte */}
      <g stroke="#262C3A" strokeWidth="0.5" strokeDasharray="3 3">
        <line x1="6" y1="36" x2="194" y2="36" />
        <line x1="6" y1="68" x2="194" y2="68" />
        <line x1="55" y1="6" x2="55" y2="104" />
        <line x1="110" y1="6" x2="110" y2="104" />
        <line x1="160" y1="6" x2="160" y2="104" />
      </g>

      {/* Peça 1: Disco flangeado com furos */}
      <circle cx="34" cy="52" r="22" stroke="#10B981" strokeWidth="1.2" fill="#10B981" fillOpacity="0.08" />
      <circle cx="34" cy="52" r="10" stroke="#10B981" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <circle cx="34" cy="38" r="2" fill="#38BDF8" />
      <circle cx="34" cy="66" r="2" fill="#38BDF8" />
      <circle cx="20" cy="52" r="2" fill="#38BDF8" />
      <circle cx="48" cy="52" r="2" fill="#38BDF8" />

      {/* Peça 2: Setor de cone planificado */}
      <path
        d="M 68 84 L 86 20 C 104 18, 128 24, 142 38 L 126 84 C 110 76, 88 76, 68 84 Z"
        stroke="#F59E0B"
        strokeWidth="1.2"
        fill="#F59E0B"
        fillOpacity="0.09"
      />
      <path d="M 78 52 C 92 48, 114 54, 126 62" stroke="#F59E0B" strokeWidth="0.6" strokeDasharray="2 2" />

      {/* Peça 3: Retângulo de reforço com chanfros */}
      <polygon
        points="152,22 184,22 188,26 188,70 184,74 152,74 148,70 148,26"
        stroke="#38BDF8"
        strokeWidth="1.1"
        fill="#38BDF8"
        fillOpacity="0.07"
      />
      <circle cx="168" cy="48" r="4" stroke="#38BDF8" strokeWidth="0.7" />

      {/* Cabeçote Laser CNC com ponto de queima */}
      <circle cx="106" cy="32" r="3.5" fill="#EF4444" className="animate-pulse" />
      <circle cx="106" cy="32" r="7" stroke="#EF4444" strokeWidth="0.8" strokeOpacity="0.6" />
      <line x1="106" y1="10" x2="106" y2="28" stroke="#EF4444" strokeWidth="0.7" strokeDasharray="2 1" />
      <line x1="84" y1="32" x2="102" y2="32" stroke="#EF4444" strokeWidth="0.7" strokeDasharray="2 1" />

      {/* Cotas e dados de aproveitamento */}
      <text x="12" y="20" fill="#64748B" fontSize="6" fontFamily="monospace" fontWeight="600">
        CHAPA #1020 • e=6.35mm
      </text>
      <text x="136" y="98" fill="#10B981" fontSize="7" fontFamily="monospace" fontWeight="bold">
        91.8% UTIL
      </text>
    </svg>
  );
}

/** Ilustração técnica da Ficha de Produção com QR e Rastreabilidade */
function ProductionTravelerGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Prancha de ordem de serviço */}
      <rect x="8" y="6" width="144" height="78" rx="5" fill="#12151D" stroke="#2A3040" strokeWidth="1" />
      
      {/* Cabeçalho da ficha */}
      <line x1="8" y1="26" x2="152" y2="26" stroke="#2A3040" strokeWidth="0.8" />
      <rect x="14" y="11" width="38" height="8" rx="2" fill="#38BDF8" fillOpacity="0.15" />
      <text x="17" y="17" fill="#38BDF8" fontSize="5" fontFamily="monospace" fontWeight="bold">
        OS #CALDRA-094
      </text>
      
      {/* QR Code estilizado */}
      <rect x="14" y="32" width="34" height="34" rx="3" fill="#0A0C10" stroke="#38BDF8" strokeWidth="0.8" />
      <rect x="18" y="36" width="9" height="9" fill="#38BDF8" />
      <rect x="35" y="36" width="9" height="9" fill="#38BDF8" />
      <rect x="18" y="53" width="9" height="9" fill="#38BDF8" />
      <rect x="30" y="48" width="4" height="4" fill="#38BDF8" />
      <rect x="39" y="55" width="5" height="5" fill="#38BDF8" />

      {/* Roteiro de fabricação (checkpoints) */}
      <g>
        <circle cx="62" cy="38" r="3.5" fill="#10B981" />
        <text x="70" y="40" fill="#E2E8F0" fontSize="5.5" fontFamily="sans-serif" fontWeight="600">
          01. Corte CNC (Validado)
        </text>

        <circle cx="62" cy="52" r="3.5" fill="#F59E0B" />
        <text x="70" y="54" fill="#E2E8F0" fontSize="5.5" fontFamily="sans-serif" fontWeight="600">
          02. Calandragem R=450mm
        </text>

        <circle cx="62" cy="66" r="3.5" fill="#475569" />
        <text x="70" y="68" fill="#94A3B8" fontSize="5.5" fontFamily="sans-serif">
          03. Soldagem & Teste END
        </text>
      </g>
    </svg>
  );
}

/** Ilustração técnica de Pranchas e Gabaritos CAD 1:1 */
function CadBlueprintTravelerGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="8" y="6" width="144" height="78" rx="5" fill="#0F1218" stroke="#1E293B" strokeWidth="1" />
      
      {/* Linhas de grade blueprint */}
      <g stroke="#1E293B" strokeWidth="0.5">
        <line x1="8" y1="30" x2="152" y2="30" />
        <line x1="8" y1="55" x2="152" y2="55" />
        <line x1="45" y1="6" x2="45" y2="84" />
        <line x1="90" y1="6" x2="90" y2="84" />
        <line x1="130" y1="6" x2="130" y2="84" />
      </g>

      {/* Geometria isométrica de curva de gomos */}
      <path
        d="M 30 65 L 50 65 L 75 40 L 95 40 L 115 20 L 130 20"
        stroke="#38BDF8"
        strokeWidth="1.4"
      />
      <path
        d="M 30 75 L 56 75 L 85 46 L 105 46 L 125 26 L 130 26"
        stroke="#38BDF8"
        strokeWidth="1.4"
      />
      <line x1="50" y1="65" x2="56" y2="75" stroke="#F59E0B" strokeWidth="1" />
      <line x1="75" y1="40" x2="85" y2="46" stroke="#F59E0B" strokeWidth="1" />
      <line x1="95" y1="40" x2="105" y2="46" stroke="#F59E0B" strokeWidth="1" />
      <line x1="115" y1="20" x2="125" y2="26" stroke="#F59E0B" strokeWidth="1" />

      {/* Linhas de cota e tolerância */}
      <line x1="30" y1="80" x2="130" y2="80" stroke="#64748B" strokeWidth="0.7" strokeDasharray="2 1" />
      <text x="65" y="82" fill="#94A3B8" fontSize="5" fontFamily="monospace">
        ESCALA 1:1 • DXF R12
      </text>
    </svg>
  );
}

/** Ilustração técnica de Custos e Orçamentos da Oficina */
function WorkshopEconomicsGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="8" y="6" width="144" height="78" rx="5" fill="#0C1310" stroke="#132B20" strokeWidth="1" />

      {/* Gráfico de barras de composição de custos */}
      <g>
        {/* Barra 1: Material */}
        <rect x="22" y="38" width="16" height="36" rx="2" fill="#10B981" />
        <text x="22" y="32" fill="#10B981" fontSize="5" fontFamily="monospace" fontWeight="bold">
          45%
        </text>
        <text x="20" y="80" fill="#6EE7B7" fontSize="4.5" fontFamily="sans-serif">
          Matéria
        </text>

        {/* Barra 2: Máquina / Corte */}
        <rect x="52" y="46" width="16" height="28" rx="2" fill="#38BDF8" />
        <text x="52" y="40" fill="#38BDF8" fontSize="5" fontFamily="monospace" fontWeight="bold">
          30%
        </text>
        <text x="50" y="80" fill="#BAE6FD" fontSize="4.5" fontFamily="sans-serif">
          Máquina
        </text>

        {/* Barra 3: Mão de Obra */}
        <rect x="82" y="56" width="16" height="18" rx="2" fill="#F59E0B" />
        <text x="82" y="50" fill="#F59E0B" fontSize="5" fontFamily="monospace" fontWeight="bold">
          15%
        </text>
        <text x="80" y="80" fill="#FDE68A" fontSize="4.5" fontFamily="sans-serif">
          Solda
        </text>

        {/* Barra 4: Margem */}
        <rect x="112" y="42" width="16" height="32" rx="2" fill="#8B5CF6" />
        <text x="112" y="36" fill="#8B5CF6" fontSize="5" fontFamily="monospace" fontWeight="bold">
          25%
        </text>
        <text x="110" y="80" fill="#DDD6FE" fontSize="4.5" fontFamily="sans-serif">
          Margem
        </text>
      </g>

      {/* Linha de total / margem de contribuição */}
      <line x1="16" y1="20" x2="144" y2="20" stroke="#1E4432" strokeWidth="0.8" />
      <text x="18" y="16" fill="#10B981" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
        FORMAÇÃO DE PREÇO COMERCIAL (BDI)
      </text>
    </svg>
  );
}

/* =========================================================================
   2. CATEGORIAS DE FILTRO PARA CARROSSEL DE PROJETOS (UX NETFLIX)
   ========================================================================= */

type ProjectFilter = "todos" | "em-producao" | "em-desenvolvimento" | "concluido";

const PROJECT_FILTERS: { id: ProjectFilter; label: string }[] = [
  { id: "todos", label: "Todos os Dossiês" },
  { id: "em-producao", label: "Em Produção" },
  { id: "em-desenvolvimento", label: "Em Desenvolvimento" },
  { id: "concluido", label: "Concluídos" },
];

/* Projetos modelo para preencher o ambiente visual caso o usuário esteja iniciando */
const DEMO_PROJECTS: Array<Pick<Project, "id" | "name" | "client" | "status" | "parts">> = [
  {
    id: "demo-spool-01",
    name: "Spool & Linha de Vapor 400mm",
    client: "Refinaria Norte • Linha B",
    status: "em-producao",
    parts: [
      { instanceId: "p1", modelId: "curva-de-gomos", code: "CV-01", name: "Curva 90° 4 Gomos", parameters: {}, material: "ASTM A-106", thickness: 8, quantity: 4, status: "em-producao", notes: "", revision: "A", createdAt: 0, updatedAt: 0, version: 1 },
      { instanceId: "p2", modelId: "tronco-de-cone", code: "RD-01", name: "Redução Cônica", parameters: {}, material: "ASTM A-106", thickness: 8, quantity: 2, status: "validada", notes: "", revision: "A", createdAt: 0, updatedAt: 0, version: 1 },
    ],
  },
  {
    id: "demo-tanque-02",
    name: "Tanque Cônico de Decantação Ø1800",
    client: "Indústria de Papel & Celulose",
    status: "em-desenvolvimento",
    parts: [
      { instanceId: "p3", modelId: "tronco-de-cone", code: "TQ-01", name: "Fundo Cônico 60°", parameters: {}, material: "Inox 304L", thickness: 6.35, quantity: 1, status: "rascunho", notes: "", revision: "A", createdAt: 0, updatedAt: 0, version: 1 },
      { instanceId: "p4", modelId: "quadrado-redondo", code: "TQ-02", name: "Boca de Alimentação", parameters: {}, material: "Inox 304L", thickness: 4.75, quantity: 1, status: "rascunho", notes: "", revision: "A", createdAt: 0, updatedAt: 0, version: 1 },
    ],
  },
  {
    id: "demo-duto-03",
    name: "Duto de Exaustão & Ciclone Ø1200",
    client: "Cerâmica Industrial",
    status: "em-producao",
    parts: [
      { instanceId: "p5", modelId: "quadrado-redondo", code: "EX-01", name: "Transição Quadrado-Redondo", parameters: {}, material: "Aço A-36", thickness: 4.75, quantity: 2, status: "em-producao", notes: "", revision: "B", createdAt: 0, updatedAt: 0, version: 1 },
    ],
  },
];

/* =========================================================================
   3. HELPER DE ESTADO E FLUXO OPERACIONAL DE PROJETO
   ========================================================================= */

type ProjectStageInfo = {
  currentStage: string;
  nextAction: string;
  actionText: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  statusLabel: string;
  progressColor: string;
  pct: number;
  detail: string;
};

function getProjectStageInfo(project: Project): ProjectStageInfo {
  const parts = project.parts || [];
  const pct = projectProgress(project);

  if (project.status === "concluido" || project.status === "entregue") {
    return {
      currentStage: "Fabricação Concluída",
      nextAction: "Conferir memorial técnico & expedição",
      actionText: "Ver detalhes",
      badgeBg: "bg-sky-500/10 border-sky-500/30",
      badgeText: "text-sky-400",
      dotColor: "bg-sky-400",
      statusLabel: "Concluído",
      progressColor: "bg-sky-500",
      pct: 100,
      detail: `${parts.length} ${parts.length === 1 ? "peça finalizada" : "peças finalizadas"}`,
    };
  }

  if (project.status === "em-producao") {
    const validatedCount = parts.filter(
      (p) => p.status === "validada" || p.status === "em-producao" || p.status === "finalizada",
    ).length;
    return {
      currentStage: "Corte CNC & Calandragem",
      nextAction: "Executar corte e conformação de virolas",
      actionText: "Continuar trabalho",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30",
      badgeText: "text-emerald-400",
      dotColor: "bg-emerald-400",
      statusLabel: "Em produção",
      progressColor: "bg-emerald-500",
      pct: pct > 0 ? pct : 65,
      detail: `${validatedCount} de ${parts.length} peças validadas`,
    };
  }

  return {
    currentStage: "Modelagem & Detalhamento",
    nextAction: "Validar parâmetros e materiais para corte",
    actionText: "Retomar etapa",
    badgeBg: "bg-amber-500/10 border-amber-500/30",
    badgeText: "text-amber-400",
    dotColor: "bg-amber-400",
    statusLabel: "Em desenvolvimento",
    progressColor: "bg-amber-500",
    pct: pct > 0 ? pct : 30,
    detail: `${parts.length} ${parts.length === 1 ? "peça cadastrada" : "peças cadastradas"}`,
  };
}

/* =========================================================================
   4. COMPONENTE PRINCIPAL DA PÁGINA PRODUZIR
   ========================================================================= */

function ProduzirPage() {
  const navigate = useNavigate();
  const realProjects = useProjects();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ProjectFilter>("todos");

  const handleCreateProject = (input: NewProjectInput) => {
    try {
      const created = createProject(input);
      setNewProjectOpen(false);
      triggerHaptic("success");
      AudioManager.play("ui_pop");
      void navigate({ to: "/projetos/$projectId", params: { projectId: created.id } });
    } catch (e) {
      console.error("Falha ao criar projeto:", e);
    }
  };

  const hasRealProjects = realProjects.length > 0;
  const allProjects = useMemo(() => {
    if (hasRealProjects) return realProjects;
    return DEMO_PROJECTS as unknown as Project[];
  }, [hasRealProjects, realProjects]);

  const featuredProject = useMemo(() => {
    if (hasRealProjects) {
      return [...realProjects].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    }
    return DEMO_PROJECTS[0] as unknown as Project;
  }, [hasRealProjects, realProjects]);

  const filteredProjects = useMemo(() => {
    if (selectedFilter === "todos") return allProjects;
    return allProjects.filter((p) => {
      if (selectedFilter === "em-producao") return p.status === "em-producao";
      if (selectedFilter === "em-desenvolvimento")
        return p.status === "em-desenvolvimento" || p.status === "rascunho";
      if (selectedFilter === "concluido")
        return p.status === "concluido" || p.status === "entregue";
      return true;
    });
  }, [allProjects, selectedFilter]);

  const totalPartsInProduction = useMemo(() => {
    return allProjects.reduce((acc, p) => acc + (p.parts?.length || 0), 0);
  }, [allProjects]);

  const featuredStage = getProjectStageInfo(featuredProject);

  return (
    <div className="relative w-full min-h-screen bg-transparent text-foreground overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      <NavigationAreaContainer>
        {/* =========================================================================
            A. IDENTIFICADOR DA ÁREA & CHÃO DE FÁBRICA
            ========================================================================= */}
        <NavigationAreaHeader
          badgeText="OPERAÇÃO & CHÃO DE FÁBRICA"
          badgeColor="text-emerald-500"
          indicatorColor="bg-emerald-500"
          secondaryBadge={
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-emerald-500 border border-emerald-500/30">
              CALDRA SHOP
            </span>
          }
          title="Produzir"
          actions={
            <button
              type="button"
              onClick={() => {
                triggerHaptic("success");
                AudioManager.play("ui_pop");
                setNewProjectOpen(true);
              }}
              className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition-all rounded-lg px-2.5 py-1.5 cursor-pointer touch-manipulation"
              title="Iniciar nova ordem de trabalho"
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span>Novo Trabalho</span>
            </button>
          }
        />

        {/* =========================================================================
            B. DESTAQUE OPERACIONAL: TRABALHO PRIORITÁRIO EM ANDAMENTO (LARGURA TOTAL)
            - Altura compacta (110–136 px) determinada pelo conteúdo
            - Marcador de etapa de 32 px
            - Hierarquia vertical clara: Nome -> Estado & Próxima Ação -> Barra -> Ação
            ========================================================================= */}
        <section
          aria-label="Trabalho prioritário em execução"
          className="caldra-hero relative overflow-hidden rounded-2xl border dark:border-zinc-800/90 border-border/80 dark:bg-gradient-to-b dark:from-[#13161F] dark:to-[#0A0D12] shadow-2xl p-3 sm:p-3.5 space-y-2.5"
        >
          {/* Linha superior: Marcador de etapa (32 px) + Título + Status */}
          <div className="flex items-center justify-between gap-2 border-b dark:border-zinc-800/60 border-border/60 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="caldra-bubble-base caldra-bubble-emerald size-8 shrink-0">
                <Flame className="size-4 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[8.5px] font-bold text-emerald-400 uppercase">
                    TRABALHO EM EXECUÇÃO
                  </span>
                  <span className="font-mono text-[7.5px] text-zinc-400 bg-zinc-800/80 px-1 rounded truncate">
                    {featuredProject.client || "Oficina Interna"}
                  </span>
                </div>
                <h2 className="font-display text-sm font-bold text-zinc-100 truncate">
                  {featuredProject.name}
                </h2>
              </div>
            </div>

            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[8px] font-semibold border shrink-0",
                featuredStage.badgeBg,
                featuredStage.badgeText,
              )}
            >
              <span className={cn("size-1.5 rounded-full animate-pulse", featuredStage.dotColor)} />
              {featuredStage.statusLabel}
            </span>
          </div>

          {/* Estado atual e próxima ação de maneira claramente visível */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/70 p-2 space-y-1.5 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[10px] font-mono leading-tight">
              <div>
                <span className="text-zinc-400">Etapa ativa: </span>
                <span className="font-bold text-zinc-200">{featuredStage.currentStage}</span>
              </div>
              <div className="truncate">
                <span className="text-zinc-400">Próxima ação: </span>
                <span className="font-bold text-emerald-400">{featuredStage.nextAction}</span>
              </div>
            </div>

            {/* Barra de progresso discreta + percentual */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-[8.5px] font-mono text-zinc-400">
                <span>Progresso da ordem</span>
                <span className="font-bold text-emerald-400">{featuredStage.pct}% ({featuredStage.detail})</span>
              </div>
              <div className="h-1 w-full bg-zinc-800/90 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", featuredStage.progressColor)}
                  style={{ width: `${featuredStage.pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Ações e fluxo de trabalho: Próxima ação lógica em destaque */}
          <div className="flex items-center gap-2 pt-0.5">
            {hasRealProjects ? (
              <Link
                to="/projetos/$projectId"
                params={{ projectId: featuredProject.id }}
                onClick={() => {
                  triggerHaptic("success");
                  AudioManager.play("ui_action");
                }}
                className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] px-3 font-display text-xs font-bold text-zinc-950 shadow-md transition-all cursor-pointer"
              >
                <Play className="size-3.5 fill-current stroke-none" />
                <span>{featuredStage.actionText}</span>
                <ArrowRight className="size-3.5 ml-auto stroke-[2.5]" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("success");
                  AudioManager.play("ui_action");
                  setNewProjectOpen(true);
                }}
                className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] px-3 font-display text-xs font-bold text-zinc-950 shadow-md transition-all cursor-pointer"
              >
                <Play className="size-3.5 fill-current stroke-none" />
                <span>Iniciar este trabalho</span>
                <ArrowRight className="size-3.5 ml-auto stroke-[2.5]" />
              </button>
            )}

            <Link
              to="/projetos"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="flex h-10 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-3 font-mono text-xs font-semibold text-zinc-300 hover:bg-zinc-700 active:scale-[0.98] transition-all cursor-pointer"
              title="Ver todos os dossiês salvos"
            >
              <span>Ver detalhes</span>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            C. TRABALHOS EM ANDAMENTO — CARTÕES OPERACIONAIS DE LARGURA TOTAL
            - Proporção própria para Produzir: Cartões de 104–136 px de largura total
            - Marcadores de etapa: 28–32 px
            - Hierarquia vertical: Nome principal -> Referência/Cliente -> Estado -> Ação
            ========================================================================= */}
        <section aria-label="Ordens de Fabricação" className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Trabalhos em Andamento
              </h2>
            </div>
            <Link
              to="/projetos"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="font-mono text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              <span>Ver todos ({allProjects.length})</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>

          {/* Filtros operacionais compactos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar overscroll-x-contain -mx-4 sm:-mx-5 px-4 sm:px-5">
            {PROJECT_FILTERS.map((filter) => {
              const active = selectedFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    AudioManager.play("ui_select");
                    setSelectedFilter(filter.id);
                  }}
                  className={cn(
                    "shrink-0 min-h-[32px] rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold transition-all cursor-pointer touch-manipulation active:scale-95",
                    active
                      ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Lista vertical de cartões operacionais de largura total (espaçamento 12–16 px) */}
          <div className="space-y-3">
            {filteredProjects.map((p) => {
              const isReal = realProjects.some((rp) => rp.id === p.id);
              const stage = getProjectStageInfo(p);
              const partCount = p.parts?.length || 0;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    triggerHaptic("selection");
                    AudioManager.play("ui_nav");
                    if (isReal) {
                      void navigate({ to: "/projetos/$projectId", params: { projectId: p.id } });
                    } else {
                      setNewProjectOpen(true);
                    }
                  }}
                  className="caldra-card group flex min-h-[108px] sm:min-h-[116px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-emerald-500/40 active:scale-[0.99] cursor-pointer text-left"
                >
                  {/* Linha 1: Marcador de etapa (28 px) + Nome da tarefa principal + Badge de status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                        <FolderKanban className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight truncate group-hover:text-emerald-400 transition-colors">
                          {p.name}
                        </h3>
                        <p className="font-mono text-[9px] text-muted-foreground truncate">
                          {p.client ? `Cliente: ${p.client}` : "Dossiê técnico de oficina"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[7.5px] font-bold border shrink-0",
                        stage.badgeBg,
                        stage.badgeText,
                      )}
                    >
                      <span className={cn("size-1 rounded-full", stage.dotColor)} />
                      {stage.statusLabel}
                    </span>
                  </div>

                  {/* Linha 2: Estado atual e próxima ação em segundo plano */}
                  <div className="my-1 text-[9.5px] font-mono text-muted-foreground flex items-center justify-between gap-1 leading-snug">
                    <span className="truncate">
                      <strong className="text-foreground">{stage.currentStage}</strong> • {stage.nextAction}
                    </span>
                    <span className="shrink-0 text-emerald-500 font-bold">
                      {partCount} {partCount === 1 ? "peça" : "peças"}
                    </span>
                  </div>

                  {/* Linha 3: Barra fina de progresso + Ação clara com alvo confortável */}
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    <div className="h-1 w-full bg-border/60 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", stage.progressColor)}
                        style={{ width: `${stage.pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-mono text-emerald-400">
                      <span>{stage.actionText}</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            D. ETAPAS DO FLUXO DE FABRICAÇÃO — CARTÕES OPERACIONAIS DE LARGURA TOTAL
            - Sequência de processo: 01. Ficha QR -> 02. Chapa & Nesting -> 03. Custos BDI
            - Marcadores de etapa: 28–32 px
            - Ações contextuais de execução: Emitir, Otimizar, Calcular
            ========================================================================= */}
        <section aria-label="Etapas de Fabricação" className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="size-1.5 rounded-full bg-sky-500" />
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Etapas do Fluxo de Fabricação
            </h2>
          </div>

          <div className="space-y-3">
            {/* Etapa 01: Ficha de Produção & Inspeção de Bancada (QR) */}
            <Link
              to="/oficina"
              search={{ tab: "ficha" }}
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[104px] sm:min-h-[114px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-sky-500/40 active:scale-[0.99] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="caldra-bubble-base caldra-bubble-sky size-8 shrink-0">
                    <FileText className="size-4 stroke-[1.9]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[8px] font-bold text-sky-400 uppercase">
                        ETAPA 01 • RASTREABILIDADE
                      </span>
                    </div>
                    <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-sky-400 transition-colors">
                      Ficha de Produção & Inspeção (QR)
                    </h3>
                  </div>
                </div>

                <span className="font-mono text-[7.5px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded shrink-0">
                  QR SCAN
                </span>
              </div>

              <p className="text-[9.5px] sm:text-[10px] text-muted-foreground my-1 leading-snug">
                Roteiro de corte, calandragem, tolerâncias e apontamento dimensional de bancada.
              </p>

              <div className="flex items-center justify-between text-[9px] font-mono text-sky-400 pt-1 border-t border-border/50">
                <span>Emitir Ficha de Bancada</span>
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>

            {/* Etapa 02: Aproveitamento de Chapa & Nesting CNC */}
            <Link
              to="/planificacao"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[104px] sm:min-h-[114px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-emerald-500/40 active:scale-[0.99] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="caldra-bubble-base caldra-bubble-emerald size-8 shrink-0">
                    <Scissors className="size-4 stroke-[1.9]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[8px] font-bold text-emerald-400 uppercase">
                        ETAPA 02 • CORTE CNC
                      </span>
                    </div>
                    <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-emerald-400 transition-colors">
                      Aproveitamento de Chapa & Nesting
                    </h3>
                  </div>
                </div>

                <span className="font-mono text-[7.5px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                  CHAPA STANDARD
                </span>
              </div>

              <p className="text-[9.5px] sm:text-[10px] text-muted-foreground my-1 leading-snug">
                Distribuição de virolas e flanges em chapas 1200x3000mm com cálculo de retalhos e sobras.
              </p>

              <div className="flex items-center justify-between text-[9px] font-mono text-emerald-400 pt-1 border-t border-border/50">
                <span>Otimizar Chapa & Nesting</span>
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>

            {/* Etapa 03: Custos Operacionais & Orçamento Comercial (BDI) */}
            <Link
              to="/oficina"
              search={{ tab: "custo" }}
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[104px] sm:min-h-[114px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-amber-500/40 active:scale-[0.99] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="caldra-bubble-base caldra-bubble-amber size-8 shrink-0">
                    <Wallet className="size-4 stroke-[1.9]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[8px] font-bold text-amber-500 uppercase">
                        ETAPA 03 • FORMAÇÃO DE PREÇO
                      </span>
                    </div>
                    <h3 className="font-display text-[13px] sm:text-[14px] font-bold text-foreground leading-tight group-hover:text-amber-500 transition-colors">
                      Custos de Máquina & Orçamento Comercial
                    </h3>
                  </div>
                </div>

                <span className="font-mono text-[7.5px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
                  BDI & PDF
                </span>
              </div>

              <p className="text-[9.5px] sm:text-[10px] text-muted-foreground my-1 leading-snug">
                Tarifas de corte, calandra e solda com aplicação de margem de lucro e proposta técnica em PDF.
              </p>

              <div className="flex items-center justify-between text-[9px] font-mono text-amber-500 pt-1 border-t border-border/50">
                <span>Calcular Custos & Proposta</span>
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            E. ATALHOS RÁPIDOS DE BANCADA (GRADE DE 2 COLUNAS PARA FERRAMENTAS SIMPLES)
            - Proporção específica para ferramentas de apoio
            ========================================================================= */}
        <section aria-label="Ferramentas de apoio à bancada" className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="size-1.5 rounded-full bg-zinc-500" />
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ferramentas de Apoio à Bancada
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Atalho 1 — Prancheta CAD 2D */}
            <Link
              to="/desenho-2d"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[96px] sm:min-h-[104px] flex-col justify-between rounded-xl p-3 transition-all hover:border-red-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-red size-8">
                  <PenTool className="size-4 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 px-1 py-0.5 rounded">
                  DXF 1:1
                </span>
              </div>

              <div className="my-1">
                <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-red-500 transition-colors">
                  Prancheta CAD 2D
                </h3>
                <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">
                  Ajuste de perfis e furos.
                </p>
              </div>

              <div className="flex items-center justify-between text-[8.5px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                <span>Gabarito vetorial</span>
                <ChevronRight className="size-3 text-red-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </Link>

            {/* Atalho 2 — Compensação de Dobra */}
            <Link
              to="/oficina"
              search={{ tab: "chapa" }}
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_pop");
              }}
              className="caldra-card group flex min-h-[96px] sm:min-h-[104px] flex-col justify-between rounded-xl p-3 transition-all hover:border-amber-500/40 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="caldra-bubble-base caldra-bubble-amber size-8">
                  <SlidersHorizontal className="size-4 stroke-[1.9]" />
                </div>
                <span className="font-mono text-[7px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1 py-0.5 rounded">
                  FATOR K
                </span>
              </div>

              <div className="my-1">
                <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-amber-500 transition-colors">
                  Compensação de Dobra
                </h3>
                <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">
                  Dedução neutra em V.
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
          CALDRA Metal Shop • Gestão de Produção & Chão de Fábrica • Offline-First
        </footer>
      </NavigationAreaContainer>

      {/* Diálogo de Criação de Projeto (Preservado integralmente) */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
