import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import {
  GraduationCap,
  BookOpen,
  Binary,
  TableProperties,
  Library,
  ChevronRight,
  ArrowRight,
  Compass,
  Play,
  Clock,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  Layers,
  Award,
  Zap,
  Bookmark,
  Share2,
  FileSpreadsheet,
  Maximize2,
  Sliders,
  Flame,
  Gauge,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { useAcademy, nextLesson, COMPETENCY_MAP, competencyLevel } from "@/lib/education/progress";
import { CURRICULUM, type AcademyModule, type AcademyLesson } from "@/lib/education/curriculum";
import { LIBRARY_CATEGORIES, LIBRARY_ITEMS, type LibraryItem } from "@/lib/library/catalog";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { NavigationAreaContainer } from "@/components/layout/NavigationAreaContainer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aprenda")({
  head: () => ({
    meta: [
      { title: "Aprenda & Domine — CALDRA" },
      {
        name: "description",
        content:
          "Formação em caldeiraria, fundamentos de traçagem, fórmulas matemáticas aplicadas, tabelas técnicas e biblioteca.",
      },
      { property: "og:title", content: "Aprenda & Domine — CALDRA" },
      {
        property: "og:description",
        content: "Estudos, fórmulas de caldeiraria, tabelas normativas e biblioteca técnica industrial.",
      },
    ],
  }),
  component: AprendaPage,
});

/* =========================================================================
   DADOS TÉCNICOS & CATÁLOGOS DE ENGENHARIA
   ========================================================================= */

/** Fórmulas essenciais com dados ricos para o modal técnico e cálculo */
interface FormulaDetail {
  id: string;
  code: string;
  name: string;
  category: string;
  formula: string;
  unit: string;
  description: string;
  application: string;
  stepByStep: string[];
  variables: { sym: string; name: string; unit: string }[];
  practicalTool: string;
  toolLabel: string;
  diagram: "cylinder" | "cone" | "transition" | "elbow" | "sheet";
}

const TECHNICAL_FORMULAS: FormulaDetail[] = [
  {
    id: "circunferencia-neutra",
    code: "FORM-01",
    name: "Comprimento da Linha Neutra",
    category: "Calandragem & Rolos",
    formula: "C = π × (De - e)",
    unit: "mm",
    description: "Cálculo exato do corte reto da chapa considerando a fibra neutra do material. Elimina sobra ou conicidade na junta.",
    application: "Calandras mecânicas, tubos estruturais, silos e reservatórios de pressão.",
    stepByStep: [
      "1. Meça o diâmetro externo nominal do projeto (De).",
      "2. Subtraia a espessura nominal da chapa de aço (e).",
      "3. Multiplique pelo fator pi (π ≈ 3,14159) para obter o perímetro neutro planificado.",
    ],
    variables: [
      { sym: "De", name: "Diâmetro externo total", unit: "mm" },
      { sym: "e", name: "Espessura da chapa", unit: "mm" },
      { sym: "C", name: "Comprimento de corte", unit: "mm" },
    ],
    practicalTool: "/tracagem/cilindro",
    toolLabel: "Traçagem de Cilindro",
    diagram: "cylinder",
  },
  {
    id: "desenvolvimento-conico",
    code: "FORM-02",
    name: "Ângulo do Leque Cônico",
    category: "Transição Cônica",
    formula: "θ = 360° × (R / G)",
    unit: "graus (°)",
    description: "Determina o ângulo de abertura da chapa planificada de cones completos e reduções concêntricas industriais.",
    application: "Fonis de descarga, reduções concêntricas de tubulação, tremonhas e coifas cilíndricas.",
    stepByStep: [
      "1. Determine o raio da base menor ou maior (R).",
      "2. Obtenha a geratriz real (G) pelo Teorema de Pitágoras no triângulo de corte.",
      "3. Calcule θ = 360 × (R / G) para abrir o compasso no setor circular.",
    ],
    variables: [
      { sym: "R", name: "Raio da base", unit: "mm" },
      { sym: "G", name: "Geratriz do cone", unit: "mm" },
      { sym: "θ", name: "Ângulo de corte", unit: "graus (°)" },
    ],
    practicalTool: "/tracagem/tronco-de-cone",
    toolLabel: "Tronco de Cone",
    diagram: "cone",
  },
  {
    id: "triangulacao",
    code: "FORM-03",
    name: "Geratriz por Triangulação 3D",
    category: "Quadrado p/ Redondo",
    formula: "L = √(Δx² + Δy² + H²)",
    unit: "mm",
    description: "Hipotenusa no espaço tridimensional usada para obter a verdadeira grandeza das retas em transições complexas.",
    application: "Dutos de ar-condicionado industrial, ciclones, transições de bomba e captores de pó.",
    stepByStep: [
      "1. Divida o quadrante circular em 3 a 6 partes iguais em planta.",
      "2. Meça a projeção horizontal no plano da mesa (Δx e Δy).",
      "3. Projete no plano vertical com a altura axial (H) para encontrar a VG.",
    ],
    variables: [
      { sym: "Δx", name: "Deslocamento no eixo X", unit: "mm" },
      { sym: "Δy", name: "Deslocamento no eixo Y", unit: "mm" },
      { sym: "H", name: "Altura de centro a centro", unit: "mm" },
      { sym: "L", name: "Verdadeira Grandeza", unit: "mm" },
    ],
    practicalTool: "/tracagem/quadrado-redondo",
    toolLabel: "Quadrado → Redondo",
    diagram: "transition",
  },
  {
    id: "curva-gomos",
    code: "FORM-04",
    name: "Ângulo por Gomo em Curvas",
    category: "Segmentos Angulares",
    formula: "α = Ângulo Total / (2 × (N - 1))",
    unit: "graus (°)",
    description: "Determina o ângulo de corte das pontas (meios-gomos) e do corpo central de curvas segmentadas para tubulação.",
    application: "Curvas de grandes diâmetros em aço carbono e inox para transporte pneumático e hidráulica.",
    stepByStep: [
      "1. Defina o ângulo total da curva da tubulação (geralmente 45°, 60° ou 90°).",
      "2. Escolha o número total de segmentos da curva (N).",
      "3. Os gomos internos possuem 2α e os dois das pontas possuem α.",
    ],
    variables: [
      { sym: "Ângulo", name: "Curvatura total", unit: "graus (°)" },
      { sym: "N", name: "Qtd. de segmentos", unit: "un" },
      { sym: "α", name: "Meio-gomo de ponta", unit: "graus (°)" },
    ],
    practicalTool: "/tracagem/curva-de-gomos",
    toolLabel: "Curva de Gomos",
    diagram: "elbow",
  },
  {
    id: "massa-chapa",
    code: "FORM-05",
    name: "Massa da Chapa Metálica",
    category: "Engenharia de Custos",
    formula: "M = Área (m²) × e (mm) × 7,85",
    unit: "kg",
    description: "Calcula a massa líquida em quilogramas de peças retangulares ou perfis planos em chapas de aço comercial.",
    application: "Dimensionamento de pontes rolantes, compra de matéria-prima e orçamento comercial.",
    stepByStep: [
      "1. Converta largura e comprimento da chapa bruta para metros.",
      "2. Multiplique pela espessura em milímetros.",
      "3. Aplique a densidade normativa do aço (7,85 kg/m²/mm).",
    ],
    variables: [
      { sym: "Área", name: "Superfície da chapa", unit: "m²" },
      { sym: "e", name: "Espessura da chapa", unit: "mm" },
      { sym: "M", name: "Massa líquida", unit: "kg" },
    ],
    practicalTool: "/calculadora",
    toolLabel: "Calculadora de Massa",
    diagram: "sheet",
  },
];

/** Tabelas técnicas normativas com filtros e dados expandidos */
const SHOP_FLOOR_TABLES = [
  {
    id: "bitolas-chapa",
    title: "Bitolas de Chapa (MSG / Polegada / mm)",
    badge: "Chapa Comercial",
    code: "NBR 11888",
    data: [
      { spec: "MSG 20", mm: "0,90 mm", pol: '0,0359"', peso: "7,07 kg/m²" },
      { spec: "MSG 18", mm: "1,20 mm", pol: '0,0478"', peso: "9,42 kg/m²" },
      { spec: "MSG 16", mm: "1,50 mm", pol: '0,0598"', peso: "11,78 kg/m²" },
      { spec: "MSG 14", mm: "1,90 mm", pol: '0,0747"', peso: "14,92 kg/m²" },
      { spec: "MSG 12", mm: "2,65 mm", pol: '0,1046"', peso: "20,80 kg/m²" },
      { spec: "MSG 1/8", mm: "3,18 mm", pol: '0,1250"', peso: "24,96 kg/m²" },
      { spec: "MSG 3/16", mm: "4,75 mm", pol: '0,1875"', peso: "37,29 kg/m²" },
      { spec: "MSG 1/4", mm: "6,35 mm", pol: '0,2500"', peso: "49,85 kg/m²" },
      { spec: "MSG 5/16", mm: "7,94 mm", pol: '0,3125"', peso: "62,33 kg/m²" },
      { spec: "MSG 3/8", mm: "9,52 mm", pol: '0,3750"', peso: "74,73 kg/m²" },
    ],
  },
  {
    id: "tubos-sch40",
    title: "Tubos Schedule 40 (ASTM A53 / A106)",
    badge: "Tubulações",
    code: "ANSI B36.10",
    data: [
      { spec: '1" (25 mm)', mm: "Parede 3,38 mm", pol: "DE 33,4 mm", peso: "2,50 kg/m" },
      { spec: '1.1/2" (40 mm)', mm: "Parede 3,68 mm", pol: "DE 48,3 mm", peso: "4,05 kg/m" },
      { spec: '2" (50 mm)', mm: "Parede 3,91 mm", pol: "DE 60,3 mm", peso: "5,44 kg/m" },
      { spec: '2.1/2" (65 mm)', mm: "Parede 5,16 mm", pol: "DE 73,0 mm", peso: "8,63 kg/m" },
      { spec: '3" (75 mm)', mm: "Parede 5,49 mm", pol: "DE 88,9 mm", peso: "11,29 kg/m" },
      { spec: '4" (100 mm)', mm: "Parede 6,02 mm", pol: "DE 114,3 mm", peso: "16,07 kg/m" },
      { spec: '6" (150 mm)', mm: "Parede 7,11 mm", pol: "DE 168,3 mm", peso: "28,26 kg/m" },
      { spec: '8" (200 mm)', mm: "Parede 8,18 mm", pol: "DE 219,1 mm", peso: "42,55 kg/m" },
      { spec: '10" (250 mm)', mm: "Parede 9,27 mm", pol: "DE 273,0 mm", peso: "60,31 kg/m" },
      { spec: '12" (300 mm)', mm: "Parede 10,31 mm", pol: "DE 323,8 mm", peso: "79,73 kg/m" },
    ],
  },
  {
    id: "densidade-metais",
    title: "Densidade & Massas Específicas dos Metais",
    badge: "Materiais",
    code: "DIN / ASTM",
    data: [
      { spec: "Aço Carbono SAE 1020", mm: "7,85 kg/dm³", pol: "Padrão Estrutural", peso: "Ref. 100%" },
      { spec: "Aço Inox AISI 304 / 316", mm: "8,00 kg/dm³", pol: "Anti-corrosivo", peso: "+1,9%" },
      { spec: "Alumínio 6061 / 5052", mm: "2,70 kg/dm³", pol: "Ligas Estruturais", peso: "-65,6%" },
      { spec: "Cobre Puro Eletrolítico", mm: "8,96 kg/dm³", pol: "Alta Condutividade", peso: "+14,1%" },
      { spec: "Latão Naval (Cu-Zn)", mm: "8,50 kg/dm³", pol: "Resistente a Salinidade", peso: "+8,3%" },
      { spec: "Titânio Grau 2 / 5", mm: "4,51 kg/dm³", pol: "Aeroespacial & Químico", peso: "-42,5%" },
      { spec: "Ferro Fundido Cinzento", mm: "7,20 kg/dm³", pol: "Fundição Mecânica", peso: "-8,3%" },
      { spec: "Bronze Fosforoso", mm: "8,80 kg/dm³", pol: "Mancais & Atrito", peso: "+12,1%" },
    ],
  },
];

/* =========================================================================
   COMPONENTE PRINCIPAL
   ========================================================================= */

function AprendaPage() {
  const navigate = useNavigate();
  const academyState = useAcademy();
  const next = nextLesson(academyState);

  // Estados locais interativos
  const [activeTab, setActiveTab] = useState<"todos" | "trilhas" | "formulas" | "tabelas" | "biblioteca">("todos");
  const [selectedFormula, setSelectedFormula] = useState<FormulaDetail | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<string>("bitolas-chapa");
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Refs para rolagem horizontal suave
  const modulesScrollRef = useRef<HTMLDivElement>(null);
  const formulasScrollRef = useRef<HTMLDivElement>(null);
  const tablesScrollRef = useRef<HTMLDivElement>(null);
  const libraryScrollRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, offset: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: offset, behavior: "smooth" });
      triggerHaptic("selection");
    }
  };

  const handleCopyFormula = (f: FormulaDetail) => {
    navigator.clipboard?.writeText(f.formula);
    setCopiedFormula(f.id);
    triggerHaptic("tap");
    AudioManager.play("ui_pop");
    setTimeout(() => setCopiedFormula(null), 2000);
  };

  // Itens da biblioteca filtrados
  const filteredLibraryItems = useMemo(() => {
    return LIBRARY_ITEMS.filter((item) => {
      const matchesCategory = libraryFilter === "Todos" || item.category === libraryFilter;
      const matchesSearch =
        searchQuery === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detail.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [libraryFilter, searchQuery]);

  // Estatísticas de aprendizado do usuário
  const totalCompleted = useMemo(() => {
    return Object.values(academyState.lessons).filter(
      (l) => l.mastery === "dominado" || l.mastery === "praticado",
    ).length;
  }, [academyState.lessons]);

  const totalLessonsCount = useMemo(() => {
    return CURRICULUM.reduce((acc, m) => acc + m.lessons.length, 0);
  }, []);

  const progressPct = Math.min(100, Math.round((totalCompleted / Math.max(1, totalLessonsCount)) * 100));

  return (
    <div className="w-full bg-transparent text-foreground min-h-screen selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
      <NavigationAreaContainer>
        {/* =========================================================================
            CABEÇALHO DA SEÇÃO CENTRAL (SEM DUPLICAR CABEÇALHO GLOBAL)
            Título obrigatório: "Aprenda & Domine"
            ========================================================================= */}
        <NavigationAreaHeader
          badgeText="FORMAÇÃO & ACADEMIA TÉCNICA"
          badgeColor="text-amber-500"
          indicatorColor="bg-amber-500"
          secondaryBadge={
            <span className="rounded bg-amber-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-amber-500 border border-amber-500/30">
              PRO CALDRA
            </span>
          }
          title="Aprenda & Domine"
          actions={
            <div className="flex items-center gap-3 bg-card/60 border border-border/70 rounded-xl px-3.5 py-2 shrink-0">
              <div className="relative size-10 flex items-center justify-center">
                <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    className="stroke-amber-500"
                    strokeWidth="3"
                    strokeDasharray="94.2"
                    strokeDashoffset={94.2 - (progressPct / 100) * 94.2}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[10px] font-bold text-amber-500">
                  {progressPct}%
                </span>
              </div>
              <div className="min-w-[110px]">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Progresso Geral
                </span>
                <span className="font-display text-xs font-bold text-foreground">
                  {totalCompleted} de {totalLessonsCount} lições
                </span>
              </div>
            </div>
          }
        />

        {/* Barra de Filtros Rápido por Abas */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 border-b border-border/40">
          {[
            { id: "todos", label: "Visão Geral", icon: Sparkles },
            { id: "trilhas", label: "01. Escola & Trilhas", icon: GraduationCap },
            { id: "formulas", label: "02. Relações & Fórmulas", icon: Binary },
            { id: "tabelas", label: "03. Tabelas Normativas", icon: TableProperties },
            { id: "biblioteca", label: "04. Biblioteca Técnica", icon: Library },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  triggerHaptic("selection");
                  AudioManager.play("ui_pop");
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                  isActive
                    ? "bg-amber-500 text-black font-semibold shadow-lg shadow-amber-500/20"
                    : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800/50",
                )}
              >
                <Icon className={cn("size-3.5", isActive ? "text-black" : "text-zinc-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      {/* =========================================================================
          BANNER HERO CINEMATOGRÁFICO DE APRENDIZADO (ESTILO STREAMING PREMIUM)
          Com chamada para a próxima lição, ilustração técnica de traçagem e CTA direto
          ========================================================================= */}
      {(activeTab === "todos" || activeTab === "trilhas") && (
        <section className="w-full pt-1">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 shadow-2xl">
            {/* Grid de fundo sutil & iluminação âmbar */}
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="absolute -top-24 -left-24 size-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 size-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-7 items-center">
              {/* Lado Esquerdo: Textos & Próxima Lição */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                    <Sparkles className="size-3" />
                    EM ANDAMENTO • TRILHA MASTER
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                    MÓDULO {next ? next.module.code : "01"}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    <CheckCircle2 className="size-3" />
                    Acesso Completo
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {next ? next.lesson.title : "Fundamentos & Trigonometria de Caldeiraria"}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed max-w-xl">
                    {next
                      ? `Continue seus estudos no módulo ${next.module.title}. Domine traçagem por triangulação, cálculo de geratriz e corte neutro em chapas.`
                      : "Desenvolva raciocínio espacial avançado para fabricação de silos, transições, curvas de gomos e tubulações industriais."}
                  </p>
                </div>

                {/* Métricas da Lição */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-4 text-amber-500" />
                    <span>{next ? `${next.lesson.minutes} min de conteúdo` : "15 min estimados"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Compass className="size-4 text-sky-400" />
                    <span>Prática de Traçagem</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award className="size-4 text-emerald-400" />
                    <span>Certificação Progressiva</span>
                  </div>
                </div>

                {/* Botões de Ação do Hero */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {next ? (
                    <Link
                      to="/escola/aula/$lessonId"
                      params={{ lessonId: next.lesson.id }}
                      onClick={() => {
                        triggerHaptic("selection");
                        AudioManager.play("ui_pop");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="size-4 fill-black text-black" />
                      <span>Continuar Lição Agora</span>
                    </Link>
                  ) : (
                    <Link
                      to="/escola/diagnostico"
                      onClick={() => {
                        triggerHaptic("selection");
                        AudioManager.play("ui_pop");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="size-4 fill-black text-black" />
                      <span>Iniciar Diagnóstico</span>
                    </Link>
                  )}

                  <Link
                    to="/escola"
                    onClick={() => {
                      triggerHaptic("tap");
                      AudioManager.play("ui_nav");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 font-medium text-xs sm:text-sm px-3.5 py-2.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Ver Currículo Completo</span>
                    <ChevronRight className="size-4 text-zinc-400" />
                  </Link>
                </div>
              </div>

              {/* Lado Direito: Ilustração Técnica Cinematográfica (SVG CAD Industrial) */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                <div className="relative w-full aspect-[4/3] max-w-sm rounded-xl overflow-hidden bg-zinc-950/80 border border-zinc-800 shadow-inner flex items-center justify-center p-4">
                  {/* Fundo com retícula técnica */}
                  <svg className="w-full h-full" viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#27272a" strokeWidth="0.75" />
                      </pattern>
                      <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    <rect width="320" height="240" fill="url(#cad-grid)" />

                    {/* Geometria de Traçagem: Triângulo Retângulo e Cilindro Desenvolvido */}
                    <g transform="translate(40, 20)">
                      {/* Eixos e Cotas */}
                      <path d="M 20 180 L 220 180" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />
                      <path d="M 20 20 L 20 180" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Triângulo de Pitágoras da Traçagem */}
                      <polygon points="20,180 180,180 180,60" fill="url(#metal-grad)" stroke="#f59e0b" strokeWidth="2" />
                      <line x1="20" y1="180" x2="180" y2="60" stroke="#f59e0b" strokeWidth="2.5" />
                      <text x="75" y="110" fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        H = √(A² + B²)
                      </text>

                      {/* Arco de Planificação Conforme Raio */}
                      <path d="M 180 60 Q 210 110 180 180" stroke="#38bdf8" strokeWidth="2" fill="none" strokeDasharray="4 2" />
                      <circle cx="180" cy="60" r="3" fill="#38bdf8" />
                      <circle cx="180" cy="180" r="3" fill="#38bdf8" />
                      <circle cx="20" cy="180" r="3" fill="#f59e0b" />

                      {/* Ângulo de corte */}
                      <path d="M 60 180 A 40 40 0 0 1 50 155" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
                      <text x="65" y="165" fill="#f59e0b" fontSize="9" fontFamily="monospace">θ = 36.8°</text>

                      {/* Linhas de cota técnicas */}
                      <line x1="20" y1="195" x2="180" y2="195" stroke="#a1a1aa" strokeWidth="1" />
                      <polyline points="25,192 20,195 25,198" stroke="#a1a1aa" strokeWidth="1" fill="none" />
                      <polyline points="175,192 180,195 175,198" stroke="#a1a1aa" strokeWidth="1" fill="none" />
                      <text x="85" y="208" fill="#a1a1aa" fontSize="9" fontFamily="monospace">Base: 160 mm</text>

                      {/* Cota vertical */}
                      <line x1="195" y1="60" x2="195" y2="180" stroke="#a1a1aa" strokeWidth="1" />
                      <polyline points="192,65 195,60 198,65" stroke="#a1a1aa" strokeWidth="1" fill="none" />
                      <polyline points="192,175 195,180 198,175" stroke="#a1a1aa" strokeWidth="1" fill="none" />
                      <text x="202" y="125" fill="#a1a1aa" fontSize="9" fontFamily="monospace">H: 120</text>
                    </g>
                  </svg>

                  {/* Badge de Real-time Overlay */}
                  <div className="absolute bottom-2.5 left-2.5 bg-zinc-900/90 border border-zinc-800 px-2 py-1 rounded text-[10px] font-mono text-zinc-300 flex items-center gap-1.5 backdrop-blur-sm">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SIMULADOR CAD INTERATIVO
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          SEÇÃO 1: ESTUDOS & TRILHAS DE FORMAÇÃO (CARROSSEL HORIZONTAL NETFLIX)
          ========================================================================= */}
      {(activeTab === "todos" || activeTab === "trilhas") && (
        <section className="w-full pt-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500">
                <GraduationCap className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-amber-500">01</span>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    Estudos & Módulos da Escola
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Currículo completo de caldeiraria e traçagem geométrica para chão de fábrica.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollCarousel(modulesScrollRef, -320)}
                aria-label="Rolar para esquerda"
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => scrollCarousel(modulesScrollRef, 320)}
                aria-label="Rolar para direita"
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
              <Link
                to="/escola"
                onClick={() => {
                  triggerHaptic("tap");
                  AudioManager.play("ui_nav");
                }}
                className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
              >
                <span>Ver todos</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Carrossel de Módulos */}
          <div
            ref={modulesScrollRef}
            className="flex items-stretch gap-4 overflow-x-auto scrollbar-none pb-2 pt-1"
          >
            {CURRICULUM.map((module) => {
              const lessonsDone = module.lessons.filter(
                (l) => academyState.lessons[l.id]?.mastery === "dominado" || academyState.lessons[l.id]?.mastery === "praticado",
              ).length;
              const modulePct = Math.round((lessonsDone / Math.max(1, module.lessons.length)) * 100);

              return (
                <div
                  key={module.id}
                  className="w-[280px] sm:w-[320px] shrink-0 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-amber-500/40 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                        MÓDULO {module.code}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                        {module.lessons.length} aulas
                      </span>
                    </div>

                    <h3 className="font-display text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {module.summary}
                    </p>

                    {/* Barra de Progresso do Módulo */}
                    <div className="mt-3.5">
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="text-zinc-400">Progresso</span>
                        <span className="text-amber-400 font-bold">{modulePct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${modulePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Prévia da Primeira Aula ou Próxima */}
                    <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
                      {module.lessons.slice(0, 2).map((lesson) => {
                        const isDone = academyState.lessons[lesson.id]?.mastery === "dominado";
                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-zinc-800/50"
                          >
                            <span className="text-zinc-300 truncate text-[11px] flex items-center gap-1.5">
                              {isDone ? (
                                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                              ) : (
                                <span className="size-1.5 rounded-full bg-zinc-600 shrink-0" />
                              )}
                              {lesson.title}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                              {lesson.minutes}m
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Link
                    to="/escola"
                    onClick={() => {
                      triggerHaptic("selection");
                      AudioManager.play("ui_pop");
                    }}
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-800/80 hover:bg-amber-500 hover:text-black text-zinc-200 text-xs font-semibold py-2 transition-all cursor-pointer"
                  >
                    <span>Acessar Módulo</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================================
          SEÇÃO 2: RELAÇÕES MATEMÁTICAS & FÓRMULAS APLICADAS (NETFLIX CARDS)
          Com atalho para calculadora/traçagem e modal detalhado de cálculo
          ========================================================================= */}
      {(activeTab === "todos" || activeTab === "formulas") && (
        <section className="w-full pt-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[#FF3B30]">
                <Binary className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-[#FF3B30]">02</span>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    Relações Matemáticas & Fórmulas
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Formulário técnico com desenvolvimento prático para corte e dobra.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollCarousel(formulasScrollRef, -320)}
                aria-label="Rolar para esquerda"
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => scrollCarousel(formulasScrollRef, 320)}
                aria-label="Rolar para direita"
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Carrossel de Fórmulas Técnicas */}
          <div
            ref={formulasScrollRef}
            className="flex items-stretch gap-4 overflow-x-auto scrollbar-none pb-2 pt-1"
          >
            {TECHNICAL_FORMULAS.map((f) => (
              <div
                key={f.id}
                className="w-[290px] sm:w-[330px] shrink-0 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-red-500/40 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400 font-semibold bg-zinc-800/80 px-2 py-0.5 rounded">
                      {f.category}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-red-400">
                      {f.code}
                    </span>
                  </div>

                  <h3 className="font-display text-sm sm:text-base font-bold text-white group-hover:text-red-300 transition-colors">
                    {f.name}
                  </h3>

                  {/* Bloco de Fórmula em Destaque */}
                  <div className="mt-3 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <span className="font-mono text-sm sm:text-base font-bold text-[#FF453A] tracking-wide">
                      {f.formula}
                    </span>
                    <button
                      onClick={() => handleCopyFormula(f)}
                      aria-label="Copiar fórmula"
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Copiar fórmula"
                    >
                      {copiedFormula === f.id ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <p className="mt-2.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {f.description}
                  </p>
                </div>

                {/* Ações: Detalhes e Ferramenta Prática */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedFormula(f);
                      triggerHaptic("tap");
                      AudioManager.play("ui_pop");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-mono text-zinc-300 hover:text-white hover:underline cursor-pointer"
                  >
                    <Sliders className="size-3 text-red-400" />
                    <span>Detalhar cálculo</span>
                  </button>

                  <Link
                    to={f.practicalTool}
                    onClick={() => {
                      triggerHaptic("selection");
                      AudioManager.play("ui_nav");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors cursor-pointer"
                  >
                    <span>{f.toolLabel}</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          SEÇÃO 3: TABELAS TÉCNICAS NORMATIVAS DE OFICINA (CONSULTA RÁPIDA)
          Bitolas MSG, Tubos Schedule 40 e Densidade de Materiais
          ========================================================================= */}
      {(activeTab === "todos" || activeTab === "tabelas") && (
        <section className="w-full pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
                <TableProperties className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-sky-400">03</span>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    Tabelas Normativas de Oficina
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Valores normalizados de bitolas, tubos industriais e pesos específicos.
                </p>
              </div>
            </div>

            {/* Alternador de tabelas */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
              {SHOP_FLOOR_TABLES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTableTab(t.id);
                    triggerHaptic("selection");
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer",
                    activeTableTab === t.id
                      ? "bg-sky-500 text-black font-semibold shadow"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  {t.badge}
                </button>
              ))}
            </div>
          </div>

          {/* Renderização da Tabela Selecionada com Estilo Industrial Escuro */}
          {(() => {
            const currentTable = SHOP_FLOOR_TABLES.find((t) => t.id === activeTableTab) || SHOP_FLOOR_TABLES[0];
            return (
              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>{currentTable.title}</span>
                      <span className="text-[10px] font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded">
                        {currentTable.code}
                      </span>
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">
                    {currentTable.data.length} especificações registradas
                  </span>
                </div>

                {/* Grade de Dados com Alta Legibilidade */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-[11px]">
                        <th className="py-2.5 px-3 font-semibold">Especificação / Bitola</th>
                        <th className="py-2.5 px-3 font-semibold">Dimensão Métrica (mm)</th>
                        <th className="py-2.5 px-3 font-semibold">Referência Comercial</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Massa / Propriedade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {currentTable.data.map((row, idx) => (
                        <tr
                          key={row.spec}
                          className="hover:bg-zinc-800/40 transition-colors group"
                        >
                          <td className="py-2.5 px-3 font-semibold text-white group-hover:text-sky-300">
                            {row.spec}
                          </td>
                          <td className="py-2.5 px-3 text-sky-400 font-bold">
                            {row.mm}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400">
                            {row.pol}
                          </td>
                          <td className="py-2.5 px-3 text-right text-zinc-300 font-medium">
                            {row.peso}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* =========================================================================
          SEÇÃO 4: BIBLIOTECA & ACERVO TÉCNICO (CATÁLOGO DE ENGENHARIA)
          Tubulações, perfis laminados, soldagem e normas
          ========================================================================= */}
      {(activeTab === "todos" || activeTab === "biblioteca") && (
        <section className="w-full pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Library className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-emerald-400">04</span>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    Biblioteca & Acervo Técnico
                  </h2>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {LIBRARY_ITEMS.length} itens catalogados: normas, perfis I/W, soldagem e tolerâncias.
                </p>
              </div>
            </div>

            {/* Barra de Pesquisa Rápida na Biblioteca */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Pesquisar catálogo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 w-44 sm:w-56"
                />
              </div>

              <Link
                to="/biblioteca"
                onClick={() => {
                  triggerHaptic("tap");
                  AudioManager.play("ui_nav");
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 shrink-0"
              >
                <span>Catálogo completo</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Categorias da Biblioteca em Pílulas */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-2 pt-1">
            {["Todos", ...LIBRARY_CATEGORIES.slice(0, 6)].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setLibraryFilter(cat);
                  triggerHaptic("selection");
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                  libraryFilter === cat
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800/60",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grade de Cards da Biblioteca */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-2">
            {filteredLibraryItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-emerald-500/40 p-3.5 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5 group"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    {item.category}
                  </span>
                  {item.premium && (
                    <span className="font-mono text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                      PRO
                    </span>
                  )}
                </div>

                <h3 className="font-display text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.detail}
                </p>

                {/* Dados resumidos */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800/60 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {item.data.slice(0, 2).map((d) => (
                    <div key={d.label}>
                      <span className="text-zinc-500 block text-[9px] uppercase">{d.label}</span>
                      <span className="text-zinc-200 font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/biblioteca"
                  onClick={() => {
                    triggerHaptic("selection");
                    AudioManager.play("ui_nav");
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 pt-2 border-t border-zinc-800/50"
                >
                  <span>Consultar especificações</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          MODAL DETALHADO DE FÓRMULA TÉCNICA (CÁLCULO & EXPLICAÇÃO DETALHADA)
          ========================================================================= */}
      {selectedFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                  {selectedFormula.category} • {selectedFormula.code}
                </span>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white mt-1.5">
                  {selectedFormula.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFormula(null)}
                aria-label="Fechar modal"
                className="p-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Caixa da Fórmula */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-zinc-400 block uppercase">Expressão Algébrica</span>
                <span className="font-mono text-lg font-bold text-[#FF453A]">
                  {selectedFormula.formula}
                </span>
              </div>
              <button
                onClick={() => handleCopyFormula(selectedFormula)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
              >
                {copiedFormula === selectedFormula.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>Copiar</span>
              </button>
            </div>

            {/* Descrição & Aplicação */}
            <div className="space-y-2 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                {selectedFormula.description}
              </p>
              <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
                <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold block mb-0.5">
                  Aplicação Industrial
                </span>
                <p className="text-zinc-400">{selectedFormula.application}</p>
              </div>
            </div>

            {/* Variáveis e Passo a Passo */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold block">
                Variáveis da Equação
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedFormula.variables.map((v) => (
                  <div key={v.sym} className="p-2 rounded bg-zinc-900/80 border border-zinc-800 text-xs font-mono">
                    <span className="font-bold text-red-400">{v.sym}</span>
                    <p className="text-[10px] text-zinc-400 truncate">{v.name}</p>
                    <span className="text-[9px] text-zinc-500">[{v.unit}]</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Passo a Passo */}
            <div className="space-y-1.5 pt-1">
              <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold block">
                Procedimento de Traçagem
              </span>
              <div className="space-y-1 text-xs text-zinc-300">
                {selectedFormula.stepByStep.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 bg-zinc-900/40 p-1.5 rounded">
                    <span className="font-mono text-[10px] text-red-400 font-bold">•</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão de Aplicação Prática */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
              <button
                onClick={() => setSelectedFormula(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
              <Link
                to={selectedFormula.practicalTool}
                onClick={() => {
                  setSelectedFormula(null);
                  triggerHaptic("selection");
                  AudioManager.play("ui_pop");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-4 py-2 transition-all cursor-pointer"
              >
                <span>Abrir Ferramenta ({selectedFormula.toolLabel})</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Espaçamento final limpo integrado no container */}
      </NavigationAreaContainer>
    </div>
  );
}
