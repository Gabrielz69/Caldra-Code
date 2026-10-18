import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  ChevronRight,
  Compass,
  FileSpreadsheet,
  History,
  Layers,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Wrench,
  PenTool,
} from "lucide-react";
import { CaldraLogo } from "@/components/caldra/Logo";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import {
  createProject,
  useProjects,
  type NewProjectInput,
} from "@/lib/projects/store";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { NavigationAreaContainer } from "@/components/layout/NavigationAreaContainer";
import { cn } from "@/lib/utils";

/* =========================================================================
   1. GRÁFICOS VETORIAIS DE ALTA FIDELIDADE (DIMENSIONADOS PARA CARDS COMPACTOS)
   ========================================================================= */

/**
 * HERO — Redução Cônica Usinada com Cotas Técnicas (Ø 60, Ø 120, 80) e Brilho Âmbar
 * Proporção 2.1:1, perfeitamente posicionada na metade direita do banner.
 */
function HeroMachinedConeGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 135"
      className={cn("pointer-events-none select-none", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Glow âmbar de fundo atrás do cone */}
        <radialGradient id="hero-amber-glow" cx="105" cy="65" r="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFA000" stopOpacity="0.8" />
          <stop offset="30%" stopColor="#FF6D00" stopOpacity="0.4" />
          <stop offset="70%" stopColor="#D84315" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Gradiente realista do corpo de aço usinado */}
        <linearGradient id="cone-body-steel" x1="50" y1="30" x2="160" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#252830" />
          <stop offset="16%" stopColor="#64748B" />
          <stop offset="36%" stopColor="#E2E8F0" />
          <stop offset="52%" stopColor="#334155" />
          <stop offset="76%" stopColor="#94A3B8" />
          <stop offset="90%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1E222A" />
        </linearGradient>

        {/* Face superior torneada */}
        <radialGradient id="cone-top-face" cx="105" cy="30" r="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B0D12" />
          <stop offset="60%" stopColor="#1E232B" />
          <stop offset="85%" stopColor="#94A3B8" />
          <stop offset="98%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#475569" />
        </radialGradient>

        {/* Chanfro da borda inferior */}
        <linearGradient id="cone-bottom-lip" x1="60" y1="98" x2="150" y2="102" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="35%" stopColor="#94A3B8" />
          <stop offset="65%" stopColor="#E2E8F0" />
          <stop offset="88%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1E222A" />
        </linearGradient>
      </defs>

      {/* Aura âmbar de fundo */}
      <circle cx="105" cy="65" r="62" fill="url(#hero-amber-glow)" />

      {/* Grid de desenho técnico blueprint */}
      <g stroke="#38BDF8" strokeWidth="0.35" strokeOpacity="0.16" strokeDasharray="2 2">
        <line x1="15" y1="30" x2="195" y2="30" />
        <line x1="15" y1="65" x2="195" y2="65" />
        <line x1="15" y1="102" x2="195" y2="102" />
        <line x1="60" y1="10" x2="60" y2="125" />
        <line x1="105" y1="10" x2="105" y2="125" />
        <line x1="150" y1="10" x2="150" y2="125" />
      </g>

      {/* Linha de centro técnica */}
      <line x1="105" y1="12" x2="105" y2="122" stroke="#EF4444" strokeWidth="0.5" strokeDasharray="6 2 1 2" strokeOpacity="0.4" />

      {/* Corpo 3D do cone usinado */}
      <path
        d="M 86 30 L 124 30 L 148 100 C 148 107, 62 107, 62 100 Z"
        fill="url(#cone-body-steel)"
      />
      <path
        d="M 62 100 C 62 107, 148 107, 148 100 L 148 102 C 148 109, 62 109, 62 102 Z"
        fill="url(#cone-bottom-lip)"
      />

      {/* Face superior torneada com furo central */}
      <ellipse cx="105" cy="30" rx="19" ry="6" fill="url(#cone-top-face)" stroke="#94A3B8" strokeWidth="0.5" />
      <ellipse cx="105" cy="30" rx="11" ry="3.5" fill="#0A0B0E" stroke="#475569" strokeWidth="0.4" />

      {/* Borda frontal inferior destacada */}
      <path
        d="M 62 100 C 62 107, 148 107, 148 100"
        stroke="#E2E8F0"
        strokeWidth="0.75"
        fill="none"
        strokeOpacity="0.8"
      />

      {/* COTAS TÉCNICAS */}
      {/* 1. Cota superior: Ø 60 */}
      <g stroke="#9CA3AF" strokeWidth="0.65" strokeOpacity="0.85">
        <line x1="86" y1="28" x2="86" y2="14" />
        <line x1="124" y1="28" x2="124" y2="14" />
        <line x1="86" y1="17" x2="124" y2="17" />
        <polygon points="86,17 89,16 89,18" fill="#9CA3AF" />
        <polygon points="124,17 121,16 121,18" fill="#9CA3AF" />
      </g>
      <text x="105" y="13" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="7.5" fontFamily="monospace" fontWeight="600" textAnchor="middle">
        Ø 60
      </text>

      {/* 2. Cota inferior: Ø 120 */}
      <g stroke="#9CA3AF" strokeWidth="0.65" strokeOpacity="0.85">
        <line x1="62" y1="104" x2="62" y2="120" />
        <line x1="148" y1="104" x2="148" y2="120" />
        <line x1="62" y1="116" x2="148" y2="116" />
        <polygon points="62,116 65,115 65,117" fill="#9CA3AF" />
        <polygon points="148,116 145,115 145,117" fill="#9CA3AF" />
      </g>
      <text x="105" y="128" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="7.5" fontFamily="monospace" fontWeight="600" textAnchor="middle">
        Ø 120
      </text>

      {/* 3. Cota lateral de altura: 80 */}
      <g stroke="#9CA3AF" strokeWidth="0.65" strokeOpacity="0.85">
        <line x1="126" y1="30" x2="168" y2="30" />
        <line x1="150" y1="101" x2="168" y2="101" />
        <line x1="164" y1="30" x2="164" y2="101" />
        <polygon points="164,30 163,33 165,33" fill="#9CA3AF" />
        <polygon points="164,101 163,98 165,98" fill="#9CA3AF" />
      </g>
      <text x="171" y="67" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="7" fontFamily="monospace" fontWeight="600" transform="rotate(-90 171 67)" textAnchor="middle">
        80
      </text>
    </svg>
  );
}

/** Card: Projetos recentes (Blueprint duto/flange) */
function BlueprintDrawingGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" className="fill-slate-100/90 dark:fill-[#0C1017] transition-colors" />
      <g stroke="#38BDF8" strokeWidth="0.3" strokeOpacity="0.2">
        <line x1="5" y1="15" x2="95" y2="15" />
        <line x1="5" y1="35" x2="95" y2="35" />
        <line x1="5" y1="55" x2="95" y2="55" />
        <line x1="20" y1="5" x2="20" y2="65" />
        <line x1="50" y1="5" x2="50" y2="65" />
        <line x1="80" y1="5" x2="80" y2="65" />
      </g>
      <rect x="22" y="14" width="56" height="42" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.8" />
      <circle cx="50" cy="35" r="15" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.9" />
      <circle cx="50" cy="35" r="9" stroke="#38BDF8" strokeWidth="0.6" strokeOpacity="0.6" strokeDasharray="2 1.5" />
      <circle cx="28" cy="20" r="2" stroke="#38BDF8" strokeWidth="0.6" />
      <circle cx="72" cy="20" r="2" stroke="#38BDF8" strokeWidth="0.6" />
      <circle cx="28" cy="50" r="2" stroke="#38BDF8" strokeWidth="0.6" />
      <circle cx="72" cy="50" r="2" stroke="#38BDF8" strokeWidth="0.6" />
      <line x1="50" y1="10" x2="50" y2="60" stroke="#EF4444" strokeWidth="0.45" strokeDasharray="4 1.5 1 1.5" strokeOpacity="0.5" />
      <line x1="16" y1="35" x2="84" y2="35" stroke="#EF4444" strokeWidth="0.45" strokeDasharray="4 1.5 1 1.5" strokeOpacity="0.5" />
    </svg>
  );
}

/** Card: CHAMFER (Chanfro usinado 45° em bloco de aço) */
function ChamferBlockGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <defs>
        <linearGradient id="ch-top-c" x1="15" y1="15" x2="85" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4A4E5A" />
          <stop offset="50%" stopColor="#2D3038" />
          <stop offset="100%" stopColor="#1E2026" />
        </linearGradient>
        <linearGradient id="ch-bevel-c" x1="35" y1="28" x2="75" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="45%" stopColor="#F8FAFC" />
          <stop offset="85%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="ch-front-c" x1="20" y1="40" x2="80" y2="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1F232B" />
          <stop offset="60%" stopColor="#13151A" />
          <stop offset="100%" stopColor="#0B0C0E" />
        </linearGradient>
      </defs>
      <rect width="100" height="70" className="fill-slate-100/90 dark:fill-[#0B0D11] transition-colors" />
      <polygon points="18,30 50,12 82,30 50,48" fill="url(#ch-top-c)" stroke="#64748B" strokeWidth="0.5" />
      <polygon points="44,45 56,45 66,54 54,54" fill="url(#ch-bevel-c)" stroke="#E2E8F0" strokeWidth="0.6" />
      <polygon points="18,30 50,48 50,66 18,48" fill="url(#ch-front-c)" stroke="#475569" strokeWidth="0.5" />
      <polygon points="50,48 82,30 82,48 50,66" fill="url(#ch-front-c)" stroke="#334155" strokeWidth="0.5" />
      <line x1="50" y1="12" x2="50" y2="48" stroke="#94A3B8" strokeWidth="0.75" strokeOpacity="0.8" />
      <line x1="18" y1="30" x2="50" y2="48" stroke="#CBD5E1" strokeWidth="0.6" strokeOpacity="0.6" />
      <line x1="50" y1="48" x2="82" y2="30" stroke="#CBD5E1" strokeWidth="0.6" strokeOpacity="0.6" />
    </svg>
  );
}

/** Card: Traçagem (Compasso e geratrizes de planificação) */
function TracingDraftGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" className="fill-slate-100/90 dark:fill-[#0B0E14] transition-colors" />
      <g stroke="#38BDF8" strokeWidth="0.25" strokeOpacity="0.18">
        <line x1="0" y1="18" x2="100" y2="18" />
        <line x1="0" y1="36" x2="100" y2="36" />
        <line x1="0" y1="54" x2="100" y2="54" />
        <line x1="20" y1="0" x2="20" y2="70" />
        <line x1="50" y1="0" x2="50" y2="70" />
        <line x1="80" y1="0" x2="80" y2="70" />
      </g>
      <path d="M 20 54 C 30 28, 70 28, 80 54" stroke="#38BDF8" strokeWidth="0.9" strokeDasharray="2 1" />
      <path d="M 32 54 C 40 38, 60 38, 68 54" stroke="#38BDF8" strokeWidth="0.75" />
      <line x1="50" y1="10" x2="20" y2="54" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.7" />
      <line x1="50" y1="10" x2="50" y2="54" stroke="#F59E0B" strokeWidth="0.6" strokeOpacity="0.9" />
      <line x1="50" y1="10" x2="80" y2="54" stroke="#F59E0B" strokeWidth="0.5" strokeOpacity="0.7" />
      <polygon points="65,28 78,15 82,19 69,32" fill="#475569" stroke="#94A3B8" strokeWidth="0.5" />
      <line x1="65" y1="28" x2="62" y2="31" stroke="#1E293B" strokeWidth="1" />
      <circle cx="62" cy="31" r="1.2" fill="#38BDF8" />
    </svg>
  );
}

/** Card: Calculadora Científica */
function ScientificCalculatorGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 70" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="70" className="fill-slate-100/90 dark:fill-[#0A0B0E] transition-colors" />
      <rect x="24" y="6" width="52" height="58" rx="6" fill="#1C1E24" stroke="#374151" strokeWidth="0.75" />
      <rect x="30" y="11" width="40" height="13" rx="2.5" fill="#0D1117" stroke="#1F2937" strokeWidth="0.5" />
      <text x="34" y="17" fill="#9CA3AF" fontSize="3.8" fontFamily="monospace">sin(45°)·√2</text>
      <text x="67" y="21.5" fill="#10B981" fontSize="4.8" fontFamily="monospace" fontWeight="bold" textAnchor="end">1.0000</text>
      <g fill="#262B34" stroke="#374151" strokeWidth="0.35">
        <rect x="30" y="27" width="7" height="4.5" rx="1" />
        <rect x="38.5" y="27" width="7" height="4.5" rx="1" />
        <rect x="47" y="27" width="7" height="4.5" rx="1" />
        <rect x="55.5" y="27" width="7" height="4.5" rx="1" />
        <rect x="64" y="27" width="6" height="4.5" rx="1" fill="#E65100" />

        <rect x="30" y="34" width="8" height="5.5" rx="1.2" />
        <rect x="40.5" y="34" width="8" height="5.5" rx="1.2" />
        <rect x="51" y="34" width="8" height="5.5" rx="1.2" />
        <rect x="61.5" y="34" width="8" height="5.5" rx="1.2" />

        <rect x="30" y="42" width="8" height="5.5" rx="1.2" />
        <rect x="40.5" y="42" width="8" height="5.5" rx="1.2" />
        <rect x="51" y="42" width="8" height="5.5" rx="1.2" />
        <rect x="61.5" y="42" width="8" height="5.5" rx="1.2" />

        <rect x="30" y="50" width="8" height="5.5" rx="1.2" />
        <rect x="40.5" y="50" width="8" height="5.5" rx="1.2" />
        <rect x="51" y="50" width="8" height="5.5" rx="1.2" />
        <rect x="61.5" y="50" width="8" height="5.5" rx="1.2" fill="#F59E0B" />
      </g>
    </svg>
  );
}

/** Card: Projetar (Isometric Wireframe com Ø 50, Ø 30, 100) */
function ExploreProjetarGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 85" className={cn("size-full select-none", className)} fill="none">
      <rect width="120" height="85" className="fill-slate-100/90 dark:fill-[#0B1322] transition-colors" />
      <g stroke="#0284C7" strokeWidth="0.25" strokeOpacity="0.25">
        <line x1="5" y1="18" x2="115" y2="18" />
        <line x1="5" y1="44" x2="115" y2="44" />
        <line x1="5" y1="70" x2="115" y2="70" />
        <line x1="25" y1="5" x2="25" y2="80" />
        <line x1="60" y1="5" x2="60" y2="80" />
        <line x1="95" y1="5" x2="95" y2="80" />
      </g>
      <g stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.9">
        <ellipse cx="60" cy="28" rx="22" ry="7.5" fill="#0369A1" fillOpacity="0.15" />
        <line x1="38" y1="28" x2="38" y2="64" />
        <line x1="82" y1="28" x2="82" y2="64" />
        <path d="M 38 64 C 38 71.5, 82 71.5, 82 64" fill="none" />
        <ellipse cx="60" cy="48" rx="11" ry="5" strokeDasharray="1.5 1.5" stroke="#F59E0B" />
      </g>
      <text x="60" y="16" fill="#38BDF8" fontSize="6.5" fontFamily="monospace" textAnchor="middle">Ø 50</text>
      <line x1="38" y1="19" x2="82" y2="19" stroke="#38BDF8" strokeWidth="0.4" strokeDasharray="1.5 1" />
      <text x="82" y="50" fill="#F59E0B" fontSize="5.5" fontFamily="monospace">Ø 30</text>
      <text x="96" y="48" fill="#94A3B8" fontSize="6" fontFamily="monospace" transform="rotate(-90 96 48)" textAnchor="middle">100</text>
      <line x1="91" y1="28" x2="91" y2="64" stroke="#94A3B8" strokeWidth="0.4" />
    </svg>
  );
}

/** Card: Produzir (Peça usinada com fagulhas de solda) */
function ExploreProduzirGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 85" className={cn("size-full select-none", className)} fill="none">
      <defs>
        <radialGradient id="prod-spark-c" cx="80" cy="42" r="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFA000" stopOpacity="0.85" />
          <stop offset="30%" stopColor="#FF5722" stopOpacity="0.4" />
          <stop offset="70%" stopColor="#BF360C" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="85" className="fill-slate-100/90 dark:fill-[#0C0D10] transition-colors" />
      <circle cx="80" cy="42" r="40" fill="url(#prod-spark-c)" />
      <polygon points="30,32 65,18 90,30 55,45" fill="#525866" stroke="#6B7280" strokeWidth="0.6" />
      <polygon points="30,32 55,45 55,65 30,52" fill="#1C1E24" stroke="#4B5563" strokeWidth="0.6" />
      <polygon points="55,45 90,30 90,50 55,65" fill="#2E323B" stroke="#4B5563" strokeWidth="0.6" />
      <ellipse cx="65" cy="27" rx="10" ry="4.5" fill="#1F232B" stroke="#F59E0B" strokeWidth="0.8" />
      <g fill="#FFA726">
        <circle cx="82" cy="40" r="1.8" fill="#FFF" />
        <circle cx="88" cy="46" r="1.1" />
        <circle cx="94" cy="36" r="0.9" />
        <circle cx="76" cy="50" r="1" />
        <line x1="82" y1="40" x2="98" y2="48" stroke="#FFB74D" strokeWidth="0.8" />
        <line x1="82" y1="40" x2="91" y2="56" stroke="#FF7043" strokeWidth="0.7" />
      </g>
    </svg>
  );
}

/** Card: Aprenda (Chalkboard com fórmulas e trigonometria) */
function ExploreAprendaGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 85" className={cn("size-full select-none", className)} fill="none">
      <rect width="120" height="85" className="fill-slate-100/90 dark:fill-[#0A0F14] transition-colors" />
      <g stroke="#38BDF8" strokeWidth="0.3" strokeOpacity="0.15">
        <line x1="10" y1="12" x2="110" y2="12" />
        <line x1="10" y1="40" x2="110" y2="40" />
        <line x1="10" y1="68" x2="110" y2="68" />
      </g>
      <polygon points="25,60 50,22 70,60" className="stroke-slate-700 dark:stroke-[#E2E8F0]" strokeWidth="0.65" fill="none" strokeDasharray="2 1" />
      <path d="M 25 60 C 38 52, 52 52, 70 60" stroke="#38BDF8" strokeWidth="0.75" />
      <text x="48" y="20" fill="#F59E0B" fontSize="5.5" fontFamily="monospace">θ = 45°</text>
      <text x="32" y="70" fill="#94A3B8" fontSize="5.5" fontFamily="monospace">a² + b² = c²</text>
      <text x="78" y="32" fill="#38BDF8" fontSize="5.5" fontFamily="monospace">R_g = R·360/α</text>
      <text x="78" y="46" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="5" fontFamily="monospace">P = 2π·r</text>
      <text x="78" y="60" fill="#F59E0B" fontSize="5.5" fontFamily="monospace">K = t/2</text>
    </svg>
  );
}

/** Card: Curva de gomos 90° em aço calandrado e soldado */
function WeldedElbowGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 65" className={cn("size-full select-none", className)} fill="none">
      <defs>
        <linearGradient id="elbow-steel-c" x1="15" y1="15" x2="85" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4A4E5A" />
          <stop offset="35%" stopColor="#D1D5DB" />
          <stop offset="60%" stopColor="#2A2D35" />
          <stop offset="90%" stopColor="#9CA3AF" />
          <stop offset="100%" stopColor="#1E2026" />
        </linearGradient>
      </defs>
      <rect width="100" height="65" className="fill-slate-100/90 dark:fill-[#0A0B0E] transition-colors" />
      <path
        d="M 18 52 L 18 32 L 35 22 L 58 16 L 80 16 L 80 31 L 64 40 L 48 52 Z"
        fill="url(#elbow-steel-c)"
        stroke="#64748B"
        strokeWidth="0.6"
      />
      <line x1="35" y1="22" x2="48" y2="52" stroke="#F59E0B" strokeWidth="0.6" strokeDasharray="1.5 1" />
      <line x1="58" y1="16" x2="64" y2="40" stroke="#F59E0B" strokeWidth="0.6" strokeDasharray="1.5 1" />
      <ellipse cx="18" cy="42" rx="4" ry="10" fill="#1C1E24" stroke="#CBD5E1" strokeWidth="0.6" />
      <ellipse cx="80" cy="23.5" rx="9" ry="4" fill="#1C1E24" stroke="#CBD5E1" strokeWidth="0.6" />
    </svg>
  );
}

/** Card: Tabela de pesos e materiais de engenharia */
function MaterialTableGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 65" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="65" className="fill-slate-100/90 dark:fill-[#0A0E14] transition-colors" />
      <g stroke="#38BDF8" strokeWidth="0.3" strokeOpacity="0.25">
        <line x1="8" y1="10" x2="92" y2="10" />
        <line x1="8" y1="22" x2="92" y2="22" />
        <line x1="8" y1="34" x2="92" y2="34" />
        <line x1="8" y1="46" x2="92" y2="46" />
        <line x1="8" y1="58" x2="92" y2="58" />
        <line x1="8" y1="10" x2="8" y2="58" />
        <line x1="36" y1="10" x2="36" y2="58" />
        <line x1="66" y1="10" x2="66" y2="58" />
        <line x1="92" y1="10" x2="92" y2="58" />
      </g>
      <text x="22" y="18" fill="#F59E0B" fontSize="4.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">BITOLA</text>
      <text x="51" y="18" fill="#F59E0B" fontSize="4.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">ESP(mm)</text>
      <text x="79" y="18" fill="#F59E0B" fontSize="4.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">KG/M²</text>

      <text x="22" y="29" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="4.5" fontFamily="monospace" textAnchor="middle"># 16</text>
      <text x="51" y="29" fill="#94A3B8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">1.50</text>
      <text x="79" y="29" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">12.00</text>

      <text x="22" y="41" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="4.5" fontFamily="monospace" textAnchor="middle"># 14</text>
      <text x="51" y="41" fill="#94A3B8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">1.90</text>
      <text x="79" y="41" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">15.20</text>

      <text x="22" y="53" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="4.5" fontFamily="monospace" textAnchor="middle">1/8"</text>
      <text x="51" y="53" fill="#94A3B8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">3.18</text>
      <text x="79" y="53" fill="#38BDF8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">25.44</text>
    </svg>
  );
}

/** Card: Fórmulas e cálculos */
function FormulasBoardGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 65" className={cn("size-full select-none", className)} fill="none">
      <rect width="100" height="65" className="fill-slate-100/90 dark:fill-[#0A0B0E] transition-colors" />
      <g stroke="#64748B" strokeWidth="0.25" strokeOpacity="0.2">
        <line x1="8" y1="15" x2="92" y2="15" />
        <line x1="8" y1="33" x2="92" y2="33" />
        <line x1="8" y1="50" x2="92" y2="50" />
      </g>
      <text x="12" y="18" fill="#38BDF8" fontSize="6" fontFamily="monospace">P = π · D</text>
      <text x="52" y="18" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="5.5" fontFamily="monospace">R_g = √(H²+R²)</text>
      <text x="12" y="36" fill="#F59E0B" fontSize="6" fontFamily="monospace">K_e = e / 3</text>
      <text x="52" y="36" fill="#38BDF8" fontSize="5.5" fontFamily="monospace">α = (R/G)·360°</text>
      <text x="12" y="54" className="fill-slate-800 dark:fill-[#E2E8F0]" fontSize="5.5" fontFamily="monospace">Corda = 2R·sin(θ/2)</text>
    </svg>
  );
}

/* =========================================================================
   2. BARRA INDICADORA DE ROLAGEM HORIZONTAL SINCRONIZADA
   ========================================================================= */
function ScrollProgressTrack({ scrollContainerRef }: { scrollContainerRef: React.RefObject<HTMLDivElement | null> }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) {
        setProgress(0);
        return;
      }
      const ratio = el.scrollLeft / maxScroll;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef]);

  return (
    <div className="flex items-center gap-1.5 px-0.5 pt-0.5">
      <div className="relative h-0.75 w-16 overflow-hidden rounded-full bg-border">
        <div
          className="absolute top-0 h-full w-7 rounded-full bg-amber-500 transition-transform duration-75"
          style={{
            transform: `translateX(${progress * 36}px)`,
          }}
        />
      </div>
      <div className="h-0.75 w-6 rounded-full bg-border" />
      <div className="h-0.75 w-3 rounded-full bg-border" />
    </div>
  );
}

/* =========================================================================
   3. COMPONENTE PRINCIPAL — WORKSHOP DASHBOARD HOME
   ========================================================================= */
export function WorkshopDashboard() {
  const navigate = useNavigate();
  const projects = useProjects();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Refs para as faixas de rolagem
  const scrollRefTrabalhando = useRef<HTMLDivElement>(null);
  const scrollRefConhecimento = useRef<HTMLDivElement>(null);

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

  const sortedProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const projectCountText =
    projects.length === 0
      ? "Nenhum projeto"
      : projects.length === 1
        ? "1 projeto ativo"
        : `${projects.length} projetos ativos`;

  return (
    <div className="relative w-full min-h-screen text-foreground overflow-x-hidden">
      <NavigationAreaContainer>
        {/* =========================================================================
            A. CABEÇALHO COMPACTO
            - Indicador âmbar pulsante + "SUA OFICINA DIGITAL" + Título "Início"
            - Alinhamento horizontal estrito à esquerda
            ========================================================================= */}
        <NavigationAreaHeader
          badgeText="SUA OFICINA DIGITAL"
          badgeColor="text-amber-500"
          indicatorColor="bg-amber-500"
          secondaryBadge={
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-amber-500 border border-amber-500/30">
              <CaldraLogo size={12} animated glow />
              <span>CALDRA</span>
            </span>
          }
          title="Início"
          description="Sua oficina digital, na palma da sua mão. Projete peças e estruturas. Gere desenhos técnicos, listas de corte, materiais e orçamentos. Especialização em Caldeiraria, Serralheria e Traçagem."
          actions={
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  AudioManager.play("ui_nav");
                  setToolsOpen(true);
                }}
                aria-label="Buscar ferramentas"
                className="caldra-bubble-base caldra-bubble-neutral flex size-8.5 items-center justify-center hover:border-amber-500/50 hover:text-amber-500 active:scale-95 transition-all cursor-pointer"
              >
                <Search className="size-4" strokeWidth={1.8} />
              </button>

              <Link
                to="/perfil"
                onClick={() => {
                  triggerHaptic("tap");
                  AudioManager.play("ui_nav");
                }}
                aria-label="Perfil e Conta"
                className="caldra-bubble-base caldra-bubble-neutral flex size-8.5 items-center justify-center hover:border-amber-500/50 hover:text-amber-500 active:scale-95 transition-all cursor-pointer"
              >
                <User className="size-4" strokeWidth={1.8} />
              </Link>
            </div>
          }
        />

        {/* =========================================================================
            1. BANNER PRINCIPAL (HERO COMPACTO: 180–230 PX)
            - Proporção calibrada para mobile sem empurrar a tela
            - Título conciso, descrição essencial, CTA com ação real
            - Composição técnica que preserva legibilidade total
            ========================================================================= */}
        <section
          aria-label="Destaque principal"
          className="caldra-hero group relative w-full h-[195px] xs:h-[205px] sm:h-[215px] min-h-[185px] max-h-[225px] overflow-hidden rounded-2xl p-3.5 sm:p-4 shadow-xl transition-all"
        >
          {/* Glow âmbar sutil concentrado atrás da peça técnica */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-36 w-44 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.22)_0%,rgba(245,158,11,0.03)_60%,transparent_75%)] blur-xl"
          />

          <div className="relative z-10 flex h-full w-full flex-row items-center justify-between">
            {/* Lado esquerdo (~52% de largura) */}
            <div className="flex h-full w-[53%] xs:w-[51%] flex-col justify-between py-0.5 pr-1.5 shrink-0">
              {/* Badge CALDEIRARIA, SERRALHERIA & TRAÇAGEM */}
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[8.5px] xs:text-[9px] font-bold tracking-wider text-amber-500 uppercase">
                  <span className="text-[9px] leading-none">✦</span>
                  <span>CALDEIRARIA, SERRALHERIA & CAD</span>
                </span>
              </div>

              {/* Título de alto impacto */}
              <h1 className="font-display text-[15px] xs:text-[17px] sm:text-[19px] font-black tracking-tight text-foreground leading-[1.12] uppercase">
                PROJETE PEÇAS E ESTRUTURAS
              </h1>

              {/* Descrição curta e objetiva */}
              <p className="text-[9.5px] xs:text-[10px] sm:text-[11px] text-muted-foreground leading-snug line-clamp-2">
                Gere desenhos técnicos multi-vistas, listas de corte 6m, materiais Costa Ferro e orçamentos.
              </p>

              {/* Chamada principal: Ação real para iniciar trabalho */}
              <div className="pt-0.5">
                <Link
                  to="/desenho-2d"
                  onClick={() => {
                    triggerHaptic("selection");
                    AudioManager.play("ui_pop");
                  }}
                  className="inline-flex h-7.5 sm:h-8.5 items-center justify-center gap-1.5 rounded-full bg-[#F59E0B] hover:bg-[#FBBF24] active:scale-95 px-3.5 font-mono text-[9.5px] xs:text-[10.5px] font-bold tracking-wide text-black shadow-md transition-all cursor-pointer"
                >
                  <span>Abrir CHAMFER CAD</span>
                  <ArrowRight className="size-3 stroke-[2.5]" />
                </Link>
              </div>

              {/* Indicadores de ritmo visual */}
              <div className="flex items-center gap-1 pt-0.5">
                <span className="h-0.75 w-4 rounded-full bg-amber-500" />
                <span className="size-1 rounded-full bg-border" />
                <span className="size-1 rounded-full bg-border" />
                <span className="size-1 rounded-full bg-border" />
              </div>
            </div>

            {/* Lado direito (~48% de largura): Peça metálica com cotas */}
            <div className="relative flex h-full w-[47%] xs:w-[49%] items-center justify-center overflow-hidden">
              <HeroMachinedConeGraphic className="h-full w-full object-contain" />
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. ATALHOS PRINCIPAIS — GRADE DE DUAS COLUNAS (ALTURA 92–118 PX)
            - Novo projeto, Projetos, Ferramentas e Orçamentos
            - Bolhas de 40 px, títulos funcionais e descrições essenciais
            - Área clicável confortável em todo o cartão
            ========================================================================= */}
        <section aria-label="Atalhos principais" className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Atalho 1 — Novo projeto */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              AudioManager.play("ui_pop");
              setNewProjectOpen(true);
            }}
            className="caldra-card group flex min-h-[96px] sm:min-h-[104px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-red-500/40 active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="caldra-bubble-base caldra-bubble-red size-10 mb-2">
              <Plus className="size-4.5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-display text-[13px] sm:text-[14px] font-bold text-foreground block leading-tight group-hover:text-red-500 transition-colors">
                Novo projeto
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5 font-mono truncate">
                Criar do zero
              </span>
            </div>
          </button>

          {/* Atalho 2 — Projetos */}
          <Link
            to="/projetos"
            onClick={() => {
              triggerHaptic("tap");
              AudioManager.play("ui_nav");
            }}
            className="caldra-card group flex min-h-[96px] sm:min-h-[104px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-sky-500/40 active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="caldra-bubble-base caldra-bubble-sky size-10 mb-2">
              <Layers className="size-4.5 stroke-[2]" />
            </div>
            <div>
              <span className="font-display text-[13px] sm:text-[14px] font-bold text-foreground block leading-tight group-hover:text-sky-500 transition-colors">
                Projetos
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5 font-mono truncate">
                {projectCountText}
              </span>
            </div>
          </Link>

          {/* Atalho 3 — Ferramentas */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              AudioManager.play("ui_nav");
              setToolsOpen(true);
            }}
            className="caldra-card group flex min-h-[96px] sm:min-h-[104px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-amber-500/40 active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="caldra-bubble-base caldra-bubble-amber size-10 mb-2">
              <Wrench className="size-4.5 stroke-[2]" />
            </div>
            <div>
              <span className="font-display text-[13px] sm:text-[14px] font-bold text-foreground block leading-tight group-hover:text-amber-500 transition-colors">
                Ferramentas
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5 font-mono truncate">
                Bancada CAD
              </span>
            </div>
          </button>

          {/* Atalho 4 — Orçamentos */}
          <Link
            to="/oficina"
            search={{ tab: "orcamento" }}
            onClick={() => {
              triggerHaptic("tap");
              AudioManager.play("ui_nav");
            }}
            className="caldra-card group flex min-h-[96px] sm:min-h-[104px] flex-col justify-between rounded-xl p-3 sm:p-3.5 transition-all hover:border-emerald-500/40 active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="caldra-bubble-base caldra-bubble-emerald size-10 mb-2">
              <Calculator className="size-4.5 stroke-[2]" />
            </div>
            <div>
              <span className="font-display text-[13px] sm:text-[14px] font-bold text-foreground block leading-tight group-hover:text-emerald-500 transition-colors">
                Orçamentos
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5 font-mono truncate">
                Custos & chapa
              </span>
            </div>
          </Link>
        </section>

        {/* =========================================================================
            3. CONTEÚDO EDUCACIONAL OU ESPECIALIZAÇÃO (HIERARQUIA DE CONVERSÃO #3)
            - Faixa de Especialização em Caldeiraria
            ========================================================================= */}
        <section
          aria-label="Faixa de Especialização"
          className="caldra-specialization rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 group transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="caldra-bubble-base caldra-bubble-indigo size-9 shrink-0">
              <Sparkles className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono text-[8px] font-bold tracking-wider text-amber-500 uppercase">
                <span>ESPECIALIZAÇÃO</span>
                <span aria-hidden className="opacity-50">·</span>
                <span>CALDEIRARIA</span>
              </div>
              <h2 className="font-display text-[11px] sm:text-[12px] font-bold text-foreground leading-tight truncate">
                Métodos de Traçado e Planificação Zero Fresta
              </h2>
              <p className="text-[8.5px] sm:text-[9.5px] text-muted-foreground leading-none truncate mt-0.5">
                Conformação de chapas, ângulos e normas técnicas de caldeiraria.
              </p>
            </div>
          </div>

          <Link
            to="/aprenda"
            onClick={() => {
              triggerHaptic("selection");
              AudioManager.play("ui_nav");
            }}
            className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 font-mono text-[9px] sm:text-[9.5px] font-bold text-amber-500 hover:bg-amber-500 hover:text-black active:scale-95 transition-all cursor-pointer"
          >
            <span>Acessar</span>
            <ArrowRight className="size-2.5 stroke-[2.5]" />
          </Link>
        </section>

        {/* =========================================================================
            4. CONTINUE TRABALHANDO (CARROSSEL HORIZONTAL: LARGURA 140–170 PX)
            - Cartões de 152–168 px com o próximo parcialmente visível
            - Miniaturas técnicas compactas e tipografia nítida
            - Prioriza projetos reais existentes; estado vazio útil se não houver
            ========================================================================= */}
        <section aria-label="Continue trabalhando" className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-display text-sm font-bold text-foreground tracking-tight sm:text-base">
              Continue trabalhando
            </h2>
            <Link
              to="/projetos"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              aria-label="Ver todos os trabalhos"
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Ver todos</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {/* Trilho horizontal independente: cartões de 152–168 px com o próximo visível */}
          <div
            ref={scrollRefTrabalhando}
            className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x snap-mandatory -mx-5 sm:-mx-6 px-5 sm:px-6"
          >
            {/* Se houver projetos reais do usuário, exibe os mais recentes */}
            {sortedProjects.length > 0 ? (
              sortedProjects.slice(0, 4).map((proj) => (
                <Link
                  key={proj.id}
                  to="/projetos/$projectId"
                  params={{ projectId: proj.id }}
                  onClick={() => {
                    triggerHaptic("tap");
                    AudioManager.play("ui_nav");
                  }}
                  className="caldra-card group relative flex w-[152px] xs:w-[160px] sm:w-[168px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 p-2 transition-all hover:border-amber-500/60 active:scale-[0.98] cursor-pointer text-left"
                >
                  <div className="relative h-[80px] w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                    <BlueprintDrawingGraphic />
                    <div className="caldra-bubble-base caldra-bubble-amber absolute top-1.5 left-1.5 size-5">
                      <History className="size-3" />
                    </div>
                    {proj.code && (
                      <span className="absolute top-1.5 right-1.5 rounded bg-background/80 px-1 py-0.5 font-mono text-[7.5px] font-bold text-muted-foreground">
                        {proj.code}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 px-0.5">
                    <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-amber-500 truncate">
                      {proj.name}
                    </h3>
                    <p className="mt-1 text-[10px] text-muted-foreground font-mono truncate leading-none">
                      {proj.parts.length} {proj.parts.length === 1 ? "peça" : "peças"} · {proj.status}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              /* Estado vazio útil: Convite de início imediato sem inventar conteúdo */
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  AudioManager.play("ui_pop");
                  setNewProjectOpen(true);
                }}
                className="caldra-card group relative flex w-[152px] xs:w-[160px] sm:w-[168px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-dashed border-amber-500/50 p-2 transition-all hover:border-amber-500 active:scale-[0.98] cursor-pointer text-left"
              >
                <div className="relative h-[80px] w-full overflow-hidden rounded-lg border border-border/40 bg-slate-100/60 dark:bg-black/40 flex flex-col items-center justify-center gap-1.5 p-2">
                  <div className="caldra-bubble-base caldra-bubble-red size-7.5">
                    <Plus className="size-4 stroke-[2.5]" />
                  </div>
                  <span className="font-mono text-[8.5px] font-bold text-amber-500 tracking-wider">
                    NOVO PROJETO
                  </span>
                </div>
                <div className="mt-2 px-0.5">
                  <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-amber-500 truncate">
                    Iniciar projeto
                  </h3>
                  <p className="mt-1 text-[10px] text-muted-foreground font-mono truncate leading-none">
                    Comece do zero
                  </p>
                </div>
              </button>
            )}

            {/* Ferramenta 1 — CHAMFER CAD */}
            <Link
              to="/desenho-2d"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex w-[152px] xs:w-[160px] sm:w-[168px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-2 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="relative h-[80px] w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <ChamferBlockGraphic />
                <div className="caldra-bubble-base caldra-bubble-amber absolute top-1.5 left-1.5 size-5">
                  <TrendingUp className="size-3" />
                </div>
              </div>
              <div className="mt-2 px-0.5">
                <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-amber-500 truncate">
                  CHAMFER CAD
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground font-mono truncate leading-none">
                  Prancheta 2D & Cotas
                </p>
              </div>
            </Link>

            {/* Ferramenta 2 — Traçagem */}
            <Link
              to="/tracagem"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex w-[152px] xs:w-[160px] sm:w-[168px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-2 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="relative h-[80px] w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <TracingDraftGraphic />
                <div className="caldra-bubble-base caldra-bubble-amber absolute top-1.5 left-1.5 size-5">
                  <Compass className="size-3" />
                </div>
              </div>
              <div className="mt-2 px-0.5">
                <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-amber-500 truncate">
                  Traçagem 3D
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground font-mono truncate leading-none">
                  Planificação Zero Fresta
                </p>
              </div>
            </Link>

            {/* Ferramenta 3 — Calculadora Científica */}
            <Link
              to="/calculadora"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex w-[152px] xs:w-[160px] sm:w-[168px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-2 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="relative h-[80px] w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <ScientificCalculatorGraphic />
                <div className="caldra-bubble-base caldra-bubble-amber absolute top-1.5 left-1.5 size-5">
                  <Calculator className="size-3" />
                </div>
              </div>
              <div className="mt-2 px-0.5">
                <h3 className="font-display text-[12px] font-bold text-foreground leading-tight group-hover:text-amber-500 truncate">
                  Calculadora Científica
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground font-mono truncate leading-none">
                  Trigonometria & Ângulos
                </p>
              </div>
            </Link>
          </div>

          {/* Indicador de rolagem âmbar sincronizado */}
          <ScrollProgressTrack scrollContainerRef={scrollRefTrabalhando} />
        </section>

        {/* =========================================================================
            5. OUTRAS INFORMAÇÕES SECUNDÁRIAS: EXPLORE SUAS FERRAMENTAS
            - Projetar, Produzir, Aprenda com dimensões próprias para a Home
            ========================================================================= */}
        <section aria-label="Explore suas ferramentas" className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-display text-sm font-bold text-foreground tracking-tight sm:text-base">
              Explore suas ferramentas
            </h2>
            <Link
              to="/projetar"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              aria-label="Ver todas as ferramentas"
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Ver todas</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* Card 1 — Projetar */}
            <Link
              to="/projetar"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex flex-col justify-between overflow-hidden rounded-xl p-2 sm:p-2.5 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer"
            >
              <div className="relative h-14 sm:h-16 w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <ExploreProjetarGraphic />
              </div>

              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="caldra-bubble-base caldra-bubble-amber size-5.5 shrink-0">
                    <Compass className="size-3" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[11px] font-bold text-foreground leading-tight truncate group-hover:text-amber-500">
                      Projetar
                    </h3>
                    <p className="text-[8px] text-muted-foreground leading-none truncate mt-0.5">
                      CAD & 3D
                    </p>
                  </div>
                </div>

                <div className="hidden xs:flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground group-hover:border-amber-500 group-hover:text-amber-500 transition-colors">
                  <ArrowRight className="size-2.5" />
                </div>
              </div>
            </Link>

            {/* Card 2 — Produzir */}
            <Link
              to="/produzir"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex flex-col justify-between overflow-hidden rounded-xl p-2 sm:p-2.5 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer"
            >
              <div className="relative h-14 sm:h-16 w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <ExploreProduzirGraphic />
              </div>

              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="caldra-bubble-base caldra-bubble-red size-5.5 shrink-0">
                    <Wrench className="size-3" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[11px] font-bold text-foreground leading-tight truncate group-hover:text-amber-500">
                      Produzir
                    </h3>
                    <p className="text-[8px] text-muted-foreground leading-none truncate mt-0.5">
                      Fábrica & Custo
                    </p>
                  </div>
                </div>

                <div className="hidden xs:flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground group-hover:border-amber-500 group-hover:text-amber-500 transition-colors">
                  <ArrowRight className="size-2.5" />
                </div>
              </div>
            </Link>

            {/* Card 3 — Aprenda */}
            <Link
              to="/aprenda"
              onClick={() => {
                triggerHaptic("selection");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex flex-col justify-between overflow-hidden rounded-xl p-2 sm:p-2.5 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer"
            >
              <div className="relative h-14 sm:h-16 w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <ExploreAprendaGraphic />
              </div>

              <div className="mt-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="caldra-bubble-base caldra-bubble-sky size-5.5 shrink-0">
                    <BookOpen className="size-3" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[11px] font-bold text-foreground leading-tight truncate group-hover:text-amber-500">
                      Aprenda
                    </h3>
                    <p className="text-[8px] text-muted-foreground leading-none truncate mt-0.5">
                      Academia
                    </p>
                  </div>
                </div>

                <div className="hidden xs:flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground group-hover:border-amber-500 group-hover:text-amber-500 transition-colors">
                  <ArrowRight className="size-2.5" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            6. CONHECIMENTO TÉCNICO (SEGUNDA ÁREA DE DESCOBERTA)
            - Curvas, Tabelas de materiais e Fórmulas de cálculo
            ========================================================================= */}
        <section aria-label="Conhecimento técnico" className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-display text-sm font-bold text-foreground tracking-tight sm:text-base">
              Conhecimento técnico
            </h2>
            <Link
              to="/aprenda"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              aria-label="Ver biblioteca de conhecimento"
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Biblioteca</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div
            ref={scrollRefConhecimento}
            className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x snap-mandatory -mx-5 sm:-mx-6 px-5 sm:px-6"
          >
            {/* Card 1 — Curvas e transições metálicas */}
            <Link
              to="/aprenda"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex w-[140px] xs:w-[150px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-2 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer"
            >
              <div className="relative h-13 w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <WeldedElbowGraphic />
              </div>
              <div className="mt-1.5 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h3 className="font-display text-[10.5px] font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-amber-500">
                    Curvas e transições
                  </h3>
                  <p className="text-[8px] text-muted-foreground font-mono leading-none mt-0.5">
                    Estudos
                  </p>
                </div>
                <BookOpen className="size-3 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            </Link>

            {/* Card 2 — Tabelas de materiais e pesos */}
            <Link
              to="/oficina"
              search={{ tab: "chapa" }}
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex w-[140px] xs:w-[150px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-2 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer"
            >
              <div className="relative h-13 w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <MaterialTableGraphic />
              </div>
              <div className="mt-1.5 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h3 className="font-display text-[10.5px] font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-amber-500">
                    Tabelas de materiais
                  </h3>
                  <p className="text-[8px] text-muted-foreground font-mono leading-none mt-0.5">
                    Bitolas & Pesos
                  </p>
                </div>
                <FileSpreadsheet className="size-3 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            </Link>

            {/* Card 3 — Fórmulas e cálculos */}
            <Link
              to="/aprenda"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
              }}
              className="caldra-card group relative flex w-[140px] xs:w-[150px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-2 transition-all hover:border-amber-500/50 active:scale-[0.98] cursor-pointer"
            >
              <div className="relative h-13 w-full overflow-hidden rounded-lg border border-border/60 bg-slate-100/80 dark:bg-black/50">
                <FormulasBoardGraphic />
              </div>
              <div className="mt-1.5 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h3 className="font-display text-[10.5px] font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-amber-500">
                    Fórmulas e cálculos
                  </h3>
                  <p className="text-[8px] text-muted-foreground font-mono leading-none mt-0.5">
                    Fórmulas de Oficina
                  </p>
                </div>
                <span className="font-mono text-[9px] font-bold italic text-muted-foreground shrink-0">
                  fx
                </span>
              </div>
            </Link>
          </div>

          {/* Indicador de rolagem âmbar da seção */}
          <ScrollProgressTrack scrollContainerRef={scrollRefConhecimento} />
        </section>

        {/* =========================================================================
            MODAIS E DIÁLOGOS INTEGRADOS (100% Funcionais)
            ========================================================================= */}
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          onCreate={handleCreateProject}
        />

        <TechnicalToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
      </NavigationAreaContainer>
    </div>
  );
}

/** Modal da Bancada de Ferramentas Técnicas */
function TechnicalToolsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  if (!open) return null;

  const tools = [
    {
      title: "Calculadora Científica",
      desc: "Trigonometria, caldeiraria e conversões angulares",
      icon: Calculator,
      color: "caldra-bubble-amber text-amber-500",
      to: "/calculadora",
    },
    {
      title: "Traçagem Paramétrica",
      desc: "Modelos 3D, planificação zero fresta e traçagem passo a passo",
      icon: Compass,
      color: "caldra-bubble-sky text-sky-500",
      to: "/tracagem",
    },
    {
      title: "Prancheta CAD 2D CHAMFER",
      desc: "Desenho vetorial técnico, cotas e exportação DXF",
      icon: PenTool,
      color: "caldra-bubble-red text-red-500",
      to: "/desenho-2d",
    },
    {
      title: "Bancada de Chapas e Nesting",
      desc: "Aproveitamento de retalho e plano de corte na chapa",
      icon: Layers,
      color: "caldra-bubble-emerald text-emerald-500",
      to: "/oficina",
      search: { tab: "chapa" },
    },
    {
      title: "Tarifas de Máquina e Custos",
      desc: "Cálculo de corte por metro, perfuração e dobra",
      icon: TrendingUp,
      color: "caldra-bubble-indigo text-indigo-500",
      to: "/oficina",
      search: { tab: "custo" },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85dvh] w-[min(92vw,480px)] overflow-y-auto border border-border bg-card p-5 text-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <Wrench className="size-4.5" />
            <DialogTitle className="font-display text-lg font-bold text-foreground">
              Bancada de Ferramentas
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Acesso rápido a todos os recursos técnicos de cálculo, desenho e fabricação.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          {tools.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                AudioManager.play("ui_nav");
                onClose();
                if (t.search) {
                  void navigate({ to: t.to, search: t.search });
                } else {
                  void navigate({ to: t.to });
                }
              }}
              className="caldra-card flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-all hover:border-amber-500/50 active:scale-[0.99] cursor-pointer touch-manipulation"
            >
              <div className="flex items-center gap-3">
                <div className={cn("caldra-bubble-base size-10 shrink-0", t.color)}>
                  <t.icon className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{t.title}</h4>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
