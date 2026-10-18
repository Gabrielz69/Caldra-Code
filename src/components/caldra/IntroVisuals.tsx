import React from "react";
import {
  MousePointer2,
  Move,
  Circle,
  Disc,
  Minus,
  Type,
  Save,
  FileCode2,
  FileText,
  Box as BoxIcon,
  Layers,
  Sparkles,
  ChevronRight,
  FolderClosed,
} from "lucide-react";

/**
 * 1. VISUAL DA PRIMEIRA TELA:
 * Logotipo 3D canônico da CALDRA com facetamento metálico,
 * pastilha carmesim chanfrada com reflexos especulares,
 * sombras suaves de profundidade e tipografia de engenharia.
 */
export function IntroLogoHero() {
  return (
    <div className="relative flex flex-col items-center justify-center py-4 select-none">
      {/* Luz ambiente orgânica e marcas técnicas de referência */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 size-64 rounded-full bg-gradient-to-tr from-amber-400/25 via-orange-500/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 size-64 rounded-full bg-gradient-to-br from-violet-500/15 via-blue-500/15 to-transparent blur-3xl"
      />

      {/* Grid técnico com mira de alinhamento ao fundo */}
      <svg
        className="pointer-events-none absolute inset-0 size-full opacity-35"
        viewBox="0 0 320 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="160" cy="115" r="95" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="3 3" />
        <circle cx="160" cy="115" r="125" stroke="#E2E8F0" strokeWidth="0.6" strokeDasharray="2 4" />
        <line x1="20" y1="115" x2="300" y2="115" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="4 4" />
        <line x1="160" y1="10" x2="160" y2="230" stroke="#CBD5E1" strokeWidth="0.8" strokeDasharray="4 4" />
        {/* Cruz de centro técnica */}
        <path d="M152 115h16 M160 107v16" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M40 35h12 M46 29v12" stroke="#CBD5E1" strokeWidth="1" />
        <path d="M275 35h12 M281 29v12" stroke="#CBD5E1" strokeWidth="1" />
      </svg>

      {/* EMBLEMA 3D CALDRA */}
      <div className="relative z-10 size-36 sm:size-40 transition-transform duration-500 hover:scale-105">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-full overflow-visible"
          style={{
            filter: "drop-shadow(0 26px 28px rgba(15, 23, 42, 0.24)) drop-shadow(0 8px 10px rgba(15, 23, 42, 0.12))",
          }}
        >
          <defs>
            {/* Gradiente do corpo metálico escuro com chanfros */}
            <linearGradient id="caldra-body-metal" x1="20" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3F3F46" />
              <stop offset="35%" stopColor="#27272A" />
              <stop offset="70%" stopColor="#18181B" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>

            {/* Chanfro superior iluminado especular */}
            <linearGradient id="caldra-bevel-top" x1="18" y1="18" x2="82" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#71717A" />
              <stop offset="50%" stopColor="#D4D4D8" />
              <stop offset="100%" stopColor="#3F3F46" />
            </linearGradient>

            {/* Gradiente da pastilha interna carmesim com brilho de rubi */}
            <linearGradient id="caldra-ruby-gem" x1="43" y1="42.5" x2="75.5" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="30%" stopColor="#E11D48" />
              <stop offset="75%" stopColor="#BE123C" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>

            {/* Reflexo chanfrado especular na pastilha */}
            <linearGradient id="caldra-ruby-sheen" x1="43" y1="42.5" x2="65" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
              <stop offset="45%" stopColor="#FDA4AF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
            </linearGradient>

            {/* Sombra de oclusão interna no alojamento da pastilha */}
            <radialGradient id="caldra-socket-shadow" cx="55" cy="50" r="30" gradientUnits="userSpaceOnUse">
              <stop offset="40%" stopColor="#000000" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sombra de oclusão de contato inferior */}
          <ellipse cx="50" cy="85" rx="35" ry="6" fill="rgba(15,23,42,0.18)" filter="blur(4px)" />

          {/* Sombra interna do rebaixo */}
          <path
            d="M 38 18 L 82 18 L 66.5 33.5 L 50 33.5 L 33.5 50 L 50 66.5 L 82 66.5 L 66.5 82 L 38 82 L 18 62 L 18 38 Z"
            fill="url(#caldra-socket-shadow)"
          />

          {/* CORPO 'C' CHANFRADO - Metálico */}
          <path
            d="M 38 18 L 82 18 L 66.5 33.5 L 50 33.5 L 33.5 50 L 50 66.5 L 82 66.5 L 66.5 82 L 38 82 L 18 62 L 18 38 Z"
            fill="url(#caldra-body-metal)"
            stroke="#18181B"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Chanfros facetados superiores com luz especular metálica */}
          <path
            d="M 38 18 L 82 18 L 66.5 33.5 L 50 33.5 L 33.5 50 L 18 38 Z"
            fill="url(#caldra-bevel-top)"
            opacity="0.28"
          />
          <path
            d="M 18 38 L 38 18 L 82 18 L 66.5 33.5"
            stroke="#A1A1AA"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />

          {/* Borda chanfrada de precisão */}
          <path
            d="M 38 82 L 18 62 L 18 38"
            stroke="#52525B"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* PASTILHA INTERNA CARMESIM (Paralelogramo 45° lapidado) */}
          <g style={{ filter: "drop-shadow(0 4px 10px rgba(225, 29, 72, 0.45))" }}>
            <path
              d="M 43 42.5 L 60 42.5 L 75.5 58 L 58.5 58 Z"
              fill="url(#caldra-ruby-gem)"
              stroke="#E11D48"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            {/* Faceta de reflexo de luz na aresta superior da pastilha */}
            <path
              d="M 43 42.5 L 60 42.5 L 58.5 45 L 43 45 Z"
              fill="url(#caldra-ruby-sheen)"
            />
            <path
              d="M 43 42.5 L 60 42.5"
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.9"
            />
          </g>
        </svg>
      </div>

      {/* LOGOTIPO E SUBLINHA VERBATIM DA REFERÊNCIA */}
      <div className="relative z-10 mt-5 text-center">
        <h2 className="flex items-center justify-center font-display text-[26px] sm:text-[30px] font-extrabold tracking-[0.24em] text-zinc-900 uppercase">
          CALDRA
          <span className="ml-1 text-[11px] font-bold text-zinc-500 self-start mt-1">®</span>
        </h2>
        <p className="mt-1 font-mono text-[10.5px] sm:text-[11.5px] font-semibold tracking-[0.28em] text-zinc-600 uppercase">
          CALDEIRARIA E TRAÇAGEM
        </p>
      </div>
    </div>
  );
}

/**
 * 2. VISUAL DA SEGUNDA TELA:
 * Geometria 2D real do CHAMFER com interface de CAD flutuante em perspectiva,
 * barra de ferramentas técnicas, cotas cotadas (450.00, 120.00, R20.00, R18.00),
 * alinhada sobre chapa usinada real em aço com furos e chanfros.
 */
export function IntroChamfer2DVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[360px] h-[250px] sm:h-[270px] select-none">
      {/* Linhas de blueprint técnico de fundo */}
      <svg
        className="pointer-events-none absolute inset-0 size-full opacity-40"
        viewBox="0 0 340 260"
        fill="none"
      >
        <defs>
          <pattern id="grid-pattern-cad" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#CBD5E1" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern-cad)" />
        {/* Linhas de chamada de cota gerais */}
        <line x1="20" y1="230" x2="320" y2="230" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="3 3" />
        <line x1="290" y1="20" x2="290" y2="240" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="3 3" />
      </svg>

      {/* Chapa física usinada em aço na base (CNC laser + centros de furação) */}
      <div
        className="absolute -right-2 bottom-2 w-[220px] sm:w-[240px] h-[130px] rounded-2xl bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 border border-zinc-600/60 shadow-2xl p-2"
        style={{
          transform: "rotate(-7deg) skewX(-4deg)",
          boxShadow: "0 22px 30px -8px rgba(15, 23, 42, 0.45), inset 0 1px 1px rgba(255,255,255,0.25)",
        }}
      >
        {/* Textura de aço escovado e furos de precisão usinados */}
        <div className="relative size-full rounded-xl bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 border border-zinc-900/60 overflow-hidden flex items-center justify-around p-3">
          {/* Furos usinados escareados */}
          <div className="size-9 rounded-full bg-zinc-950 border-2 border-zinc-600/80 shadow-inner flex items-center justify-center">
            <div className="size-4 rounded-full bg-black/90 border border-zinc-700" />
          </div>
          <div className="h-14 w-12 rounded-lg bg-zinc-950/90 border border-zinc-600/70 shadow-inner" />
          <div className="size-9 rounded-full bg-zinc-950 border-2 border-zinc-600/80 shadow-inner flex items-center justify-center">
            <div className="size-4 rounded-full bg-black/90 border border-zinc-700" />
          </div>
          {/* Reflexo luminoso da chapa cortada a laser */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-amber-500/10 to-white/10"
            style={{ mixBlendMode: "overlay" }}
          />
        </div>
      </div>

      {/* Janela CAD CHAMFER em perspectiva isométrica flutuante */}
      <div
        className="absolute top-2 left-2 w-[250px] sm:w-[270px] h-[175px] sm:h-[185px] rounded-xl bg-[#0F141F] border border-slate-700/80 shadow-2xl overflow-hidden flex"
        style={{
          transform: "perspective(800px) rotateX(12deg) rotateY(-8deg) rotateZ(3deg)",
          boxShadow: "0 25px 35px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {/* Barra lateral de ferramentas do CHAMFER */}
        <div className="w-8 shrink-0 bg-[#0A0D14] border-r border-slate-800 flex flex-col items-center py-2.5 gap-2 text-slate-400">
          <div className="size-5 rounded bg-rose-600/20 text-rose-400 flex items-center justify-center">
            <MousePointer2 className="size-3" />
          </div>
          <Move className="size-3 hover:text-slate-200" />
          <Circle className="size-3 hover:text-slate-200" />
          <Disc className="size-3 hover:text-slate-200" />
          <Minus className="size-3 hover:text-slate-200" />
          <Type className="size-3 hover:text-slate-200" />
          <Save className="size-3 hover:text-slate-200 mt-auto" />
        </div>

        {/* Viewport 2D com desenho técnico vetorial do CHAMFER */}
        <div className="relative flex-1 bg-[#0F141F] p-2 overflow-hidden">
          {/* Grid de desenho CAD */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(#38BDF8 0.75px, transparent 0.75px)",
              backgroundSize: "10px 10px",
            }}
          />

          {/* SVG com geometria técnica dimensionada */}
          <svg className="relative size-full" viewBox="0 0 180 130" fill="none">
            {/* Contorno da peça usinada com cantos arredondados */}
            <path
              d="M 28 32 L 140 32 A 10 10 0 0 1 150 42 L 150 88 A 10 10 0 0 1 140 98 L 28 98 A 10 10 0 0 1 18 88 L 18 42 A 10 10 0 0 1 28 32 Z"
              stroke="#38BDF8"
              strokeWidth="1.5"
              fill="rgba(56, 189, 248, 0.04)"
            />

            {/* Furos passantes concêntricos */}
            <circle cx="48" cy="65" r="14" stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="3 2" />
            <circle cx="48" cy="65" r="7" stroke="#38BDF8" strokeWidth="1.2" />
            <circle cx="120" cy="65" r="9" stroke="#38BDF8" strokeWidth="1.2" />

            {/* Linhas de centro com cruz */}
            <line x1="30" y1="65" x2="66" y2="65" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="4 2" />
            <line x1="48" y1="47" x2="48" y2="83" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="4 2" />

            {/* Cota horizontal superior: 450.00 */}
            <line x1="18" y1="20" x2="150" y2="20" stroke="#F43F5E" strokeWidth="0.8" />
            <line x1="18" y1="16" x2="18" y2="24" stroke="#F43F5E" strokeWidth="0.8" />
            <line x1="150" y1="16" x2="150" y2="24" stroke="#F43F5E" strokeWidth="0.8" />
            <text x="84" y="16" fill="#F43F5E" fontSize="8" fontFamily="monospace" textAnchor="middle">
              450.00
            </text>

            {/* Cota vertical esquerda: 120.00 */}
            <line x1="8" y1="32" x2="8" y2="98" stroke="#F43F5E" strokeWidth="0.8" />
            <line x1="5" y1="32" x2="11" y2="32" stroke="#F43F5E" strokeWidth="0.8" />
            <line x1="5" y1="98" x2="11" y2="98" stroke="#F43F5E" strokeWidth="0.8" />
            <text
              x="6"
              y="68"
              fill="#F43F5E"
              fontSize="7"
              fontFamily="monospace"
              textAnchor="middle"
              transform="rotate(-90 6 68)"
            >
              120.00
            </text>

            {/* Raio R20.00 */}
            <line x1="140" y1="42" x2="160" y2="30" stroke="#F43F5E" strokeWidth="0.8" />
            <text x="162" y="29" fill="#F43F5E" fontSize="7" fontFamily="monospace">
              R20.00
            </text>

            {/* Raio R18.00 */}
            <line x1="54" y1="58" x2="72" y2="48" stroke="#F43F5E" strokeWidth="0.8" />
            <text x="74" y="47" fill="#F43F5E" fontSize="7" fontFamily="monospace">
              R18.00
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * 3. VISUAL DA TERCEIRA TELA:
 * Modelagem 3D e Caldeiraria real da CALDRA com árvore de operações CAD
 * (Peça, Base, Cortes, Furos, Dobras, Chanfros) e peça 3D industrial
 * de caldeiraria com transição de malha wireframe para sólido usinado.
 */
export function IntroCaldra3DVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[360px] h-[250px] sm:h-[270px] select-none">
      {/* Blueprint técnico no plano do piso */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 w-full h-[150px] opacity-30"
        viewBox="0 0 340 150"
        fill="none"
      >
        <ellipse cx="200" cy="110" rx="120" ry="35" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="3 3" />
        <ellipse cx="200" cy="110" rx="70" ry="20" stroke="#CBD5E1" strokeWidth="0.8" />
        <line x1="80" y1="110" x2="320" y2="110" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="4 4" />
        <line x1="200" y1="75" x2="200" y2="145" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="4 4" />
      </svg>

      {/* Árvore de Operações CAD à esquerda (Feature Tree) */}
      <div
        className="absolute top-2 left-2 z-20 w-[125px] sm:w-[135px] rounded-xl bg-zinc-950/90 backdrop-blur-md border border-zinc-700/80 shadow-2xl p-2.5 text-zinc-300"
        style={{
          boxShadow: "0 18px 25px -5px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-800 text-[11px] font-semibold text-zinc-100">
          <FolderClosed className="size-3 text-rose-500" />
          <span>Peça</span>
        </div>
        <div className="mt-2 flex flex-col gap-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-1 text-rose-400 font-semibold bg-rose-500/10 rounded px-1 py-0.5">
            <ChevronRight className="size-2.5" />
            <span>Base</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 px-1">
            <ChevronRight className="size-2.5 text-zinc-600" />
            <span>Cortes</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 px-1">
            <ChevronRight className="size-2.5 text-zinc-600" />
            <span>Furos</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 px-1">
            <ChevronRight className="size-2.5 text-zinc-600" />
            <span>Dobras</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 px-1">
            <ChevronRight className="size-2.5 text-zinc-600" />
            <span>Chanfros</span>
          </div>
        </div>
      </div>

      {/* Peça 3D de Caldeiraria Industrial (Suporte/Transição angular estrutural soldada) */}
      <div
        className="absolute right-1 top-3 w-[220px] sm:w-[240px] h-[220px] sm:h-[235px] z-10"
        style={{
          filter: "drop-shadow(0 25px 30px rgba(15, 23, 42, 0.4))",
        }}
      >
        <svg viewBox="0 0 240 230" fill="none" className="size-full">
          <defs>
            {/* Gradientes metálicos do aço carbono industrial usinado */}
            <linearGradient id="metal-face-front" x1="60" y1="60" x2="180" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#52525B" />
              <stop offset="50%" stopColor="#3F3F46" />
              <stop offset="100%" stopColor="#18181B" />
            </linearGradient>

            <linearGradient id="metal-face-top" x1="80" y1="40" x2="160" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A1A1AA" />
              <stop offset="60%" stopColor="#71717A" />
              <stop offset="100%" stopColor="#3F3F46" />
            </linearGradient>

            <linearGradient id="metal-face-side" x1="140" y1="80" x2="220" y2="190" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>

            <linearGradient id="gusset-grad" x1="90" y1="90" x2="150" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#71717A" />
              <stop offset="100%" stopColor="#27272A" />
            </linearGradient>
          </defs>

          {/* Sombra de projeção da peça */}
          <path
            d="M 50 185 L 140 215 L 230 180 L 160 160 Z"
            fill="rgba(15, 23, 42, 0.3)"
            filter="blur(6px)"
          />

          {/* BASE INFERIOR FLANGEADA COM FUROS */}
          <path
            d="M 45 165 L 145 198 L 220 168 L 125 140 Z"
            fill="url(#metal-face-top)"
            stroke="#71717A"
            strokeWidth="0.8"
          />
          <path
            d="M 45 165 L 145 198 L 145 210 L 45 177 Z"
            fill="url(#metal-face-front)"
            stroke="#3F3F46"
            strokeWidth="0.8"
          />
          <path
            d="M 145 198 L 220 168 L 220 180 L 145 210 Z"
            fill="url(#metal-face-side)"
            stroke="#27272A"
            strokeWidth="0.8"
          />

          {/* Furos usinados na base */}
          <ellipse cx="185" cy="172" rx="7" ry="3.5" fill="#09090B" stroke="#52525B" strokeWidth="0.8" />
          <ellipse cx="75" cy="168" rx="7" ry="3.5" fill="#09090B" stroke="#52525B" strokeWidth="0.8" />

          {/* COLUNA VERTICAL / CORPO DO BLOCO DE TRANSIÇÃO */}
          <path
            d="M 80 65 L 145 88 L 145 185 L 80 160 Z"
            fill="url(#metal-face-front)"
            stroke="#71717A"
            strokeWidth="1"
          />
          <path
            d="M 145 88 L 195 68 L 195 160 L 145 185 Z"
            fill="url(#metal-face-side)"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <path
            d="M 80 65 L 130 45 L 195 68 L 145 88 Z"
            fill="url(#metal-face-top)"
            stroke="#A1A1AA"
            strokeWidth="1"
          />

          {/* NERVURA TRIANGULAR DE REFORÇO (GUSSET) */}
          <path
            d="M 145 110 L 145 185 L 190 168 Z"
            fill="url(#gusset-grad)"
            stroke="#71717A"
            strokeWidth="0.8"
          />

          {/* GRANDE ORIFÍCIO CILÍNDRICO MANDRILHADO */}
          <ellipse cx="112" cy="120" rx="18" ry="24" fill="#09090B" stroke="#A1A1AA" strokeWidth="1.2" />
          <ellipse cx="116" cy="122" rx="14" ry="19" fill="#000000" />

          {/* CAMADA WIREFRAME / CAD MESH (Lado esquerdo mostrando linhas de modelagem matemática) */}
          <g opacity="0.85">
            {/* Linhas de malha isométrica no topo */}
            <line x1="80" y1="65" x2="195" y2="68" stroke="#38BDF8" strokeWidth="0.75" strokeDasharray="3 2" />
            <line x1="105" y1="55" x2="170" y2="78" stroke="#38BDF8" strokeWidth="0.75" strokeDasharray="3 2" />
            {/* Vértices wireframe frontais com nós */}
            <line x1="80" y1="65" x2="80" y2="160" stroke="#38BDF8" strokeWidth="1" />
            <line x1="145" y1="88" x2="145" y2="185" stroke="#38BDF8" strokeWidth="1" />
            <circle cx="80" cy="65" r="2" fill="#38BDF8" />
            <circle cx="130" cy="45" r="2" fill="#38BDF8" />
            <circle cx="145" cy="88" r="2" fill="#38BDF8" />
            <circle cx="195" cy="68" r="2" fill="#38BDF8" />
            <circle cx="145" cy="185" r="2" fill="#38BDF8" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/**
 * 4. VISUAL DA QUARTA TELA:
 * Do projeto ao corte: Mesa de corte CNC com nesting real de caldeiraria,
 * tocha laser em operação cortando com fresta incandescente e fagulhas,
 * e card flutuante com os 4 formatos de exportação verídicos da CALDRA
 * (DXF Corte CNC, PDF Desenho técnico, STEP Modelo 3D, Lista de materiais).
 */
export function IntroCncNestingVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[360px] h-[250px] sm:h-[270px] select-none overflow-hidden rounded-2xl">
      {/* CHAPA EM PLANIFICAÇÃO NO LEITO DE CORTE CNC */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#18181B] via-[#1C1917] to-[#0C0A09] rounded-2xl border border-zinc-700/60 overflow-hidden shadow-2xl">
        {/* Grade de réguas da mesa de corte a laser */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: "linear-gradient(90deg, #F59E0B 1px, transparent 1px), linear-gradient(0deg, #71717A 1px, transparent 1px)",
            backgroundSize: "28px 18px",
          }}
        />

        {/* Geometrias reais planificadas e nestadas em corte */}
        <svg className="absolute inset-0 size-full" viewBox="0 0 340 260" fill="none">
          {/* Peça 1: Gomo de curva / pétala de transição cortada */}
          <path
            d="M 25 35 Q 90 20 155 35 L 140 105 Q 85 95 35 105 Z"
            fill="#27272A"
            stroke="#D97706"
            strokeWidth="1.4"
          />
          {/* Furos de alívio e centro na pétala */}
          <circle cx="90" cy="65" r="8" fill="#18181B" stroke="#D97706" strokeWidth="1" />

          {/* Peça 2: Flange anelar segmentada cortada ao lado */}
          <path
            d="M 180 25 A 65 65 0 0 1 295 70 L 265 95 A 35 35 0 0 0 190 60 Z"
            fill="#27272A"
            stroke="#71717A"
            strokeWidth="1.2"
          />

          {/* Peça 3: Suporte de caldeiraria em corte no quadrante inferior */}
          <path
            d="M 20 135 L 105 135 L 130 195 L 45 220 L 20 175 Z"
            fill="#27272A"
            stroke="#D97706"
            strokeWidth="1.4"
          />
          <circle cx="65" cy="175" r="9" fill="#18181B" stroke="#D97706" strokeWidth="1" />
          <circle cx="95" cy="165" r="5" fill="#18181B" stroke="#D97706" strokeWidth="1" />

          {/* Linha de corte ativa incandescente (Molten Kerf Glow) */}
          <path
            d="M 175 110 L 210 110 L 235 145"
            stroke="#F97316"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 6px #F97316) drop-shadow(0 0 14px #EA580C)",
            }}
          />
          <path
            d="M 175 110 L 210 110 L 235 145"
            stroke="#FEF08A"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Foco do Laser: Ponto incandescente de alta energia */}
          <circle cx="235" cy="145" r="4" fill="#FFFFFF" />
          <circle cx="235" cy="145" r="8" fill="#FEF08A" opacity="0.8" filter="blur(2px)" />
          <circle cx="235" cy="145" r="18" fill="#F97316" opacity="0.4" filter="blur(4px)" />

          {/* Fagulhas de corte (Sparks) */}
          <circle cx="242" cy="138" r="1" fill="#FEF08A" />
          <circle cx="246" cy="148" r="1.2" fill="#FEF08A" />
          <circle cx="239" cy="155" r="1" fill="#F97316" />
          <circle cx="252" cy="142" r="0.8" fill="#FBBF24" />
          <circle cx="228" cy="158" r="1" fill="#EA580C" />
        </svg>

        {/* Bico da tocha de corte CNC Laser (Cabeçote superior focalizado) */}
        <div
          className="absolute top-14 right-20 z-10 w-8 h-16 flex flex-col items-center pointer-events-none"
          style={{ transform: "rotate(-18deg)" }}
        >
          {/* Corpo metálico do cabeçote laser */}
          <div className="w-5 h-9 rounded-t bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-400 border border-zinc-500 shadow-md" />
          {/* Bico cônico de cobre */}
          <div className="w-3 h-5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-700 clip-path-cone" />
          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#FFF]" />
        </div>
      </div>

      {/* CARD FLUTUANTE DE FORMATOS DE EXPORTAÇÃO (VERBATIM DA REFERÊNCIA) */}
      <div
        className="absolute bottom-2.5 right-2.5 z-20 w-[170px] sm:w-[180px] rounded-xl bg-zinc-950/92 backdrop-blur-md border border-zinc-700/80 shadow-2xl p-2 flex flex-col gap-1.5 text-left"
        style={{
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {/* DXF - Corte CNC */}
        <div className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
          <div className="size-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
            <FileCode2 className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-zinc-100 leading-none">DXF</div>
            <div className="text-[9px] text-zinc-400 leading-tight">Corte CNC</div>
          </div>
        </div>

        {/* PDF - Desenho técnico */}
        <div className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
          <div className="size-6 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
            <FileText className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-zinc-100 leading-none">PDF</div>
            <div className="text-[9px] text-zinc-400 leading-tight">Desenho técnico</div>
          </div>
        </div>

        {/* STEP - Modelo 3D */}
        <div className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
          <div className="size-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
            <BoxIcon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-zinc-100 leading-none">STEP</div>
            <div className="text-[9px] text-zinc-400 leading-tight">Modelo 3D</div>
          </div>
        </div>

        {/* Lista de materiais - Quantidades e peso */}
        <div className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
          <div className="size-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Layers className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-zinc-100 leading-none truncate">Lista de materiais</div>
            <div className="text-[9px] text-zinc-400 leading-tight truncate">Quantidades e peso</div>
          </div>
        </div>
      </div>
    </div>
  );
}
