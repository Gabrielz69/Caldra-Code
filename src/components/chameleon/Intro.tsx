import { useEffect, useRef, useState } from "react";
import { ArrowRight, PenTool, Box, Settings, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { CaldraGenesisPreIntro } from "@/components/caldra/CaldraGenesisPreIntro";
import {
  IntroLogoHero,
  IntroChamfer2DVisual,
  IntroCaldra3DVisual,
  IntroCncNestingVisual,
} from "@/components/caldra/IntroVisuals";

const KEY = "caldra.intro.v2";

interface SlideData {
  id: number;
  icon?: typeof PenTool;
  title: string;
  text: string;
}

const SLIDES: SlideData[] = [
  {
    id: 0,
    title: "Da ideia à fabricação,\nem um só lugar.",
    text: "Projeto, traçagem, planificação\ne preparação para corte, com precisão\ne eficiência.",
  },
  {
    id: 1,
    icon: PenTool,
    title: "Desenho 2D\nprofissional",
    text: "Ferramentas precisas para criar,\neditar e documentar geometrias\ncom rapidez e controle.",
  },
  {
    id: 2,
    icon: Box,
    title: "Modelagem 3D\ne caldeiraria",
    text: "Crie, adapte e visualize suas peças\ncom realismo. Desenvolva projetos\npensando na fabricação.",
  },
  {
    id: 3,
    icon: Settings,
    title: "Do projeto\nao corte",
    text: "Gere planificações, listas de materiais\ne arquivos prontos para CNC, com\nagilidade e confiabilidade.",
  },
];

/**
 * TELA DE INTRODUÇÃO / ONBOARDING CALDRA
 * Layout, proporções, textos e direção visual rigorosamente baseados na referência aprovada.
 * Fundo claro com iluminação orgânica suave, textura técnica e vitrine de elementos reais da CALDRA.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [showPreIntro, setShowPreIntro] = useState(false);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    const handleReopenPreIntro = () => {
      setShowPreIntro(true);
    };
    window.addEventListener("caldra:open-preintro", handleReopenPreIntro);
    return () => window.removeEventListener("caldra:open-preintro", handleReopenPreIntro);
  }, []);

  const finish = () => {
    setLeaving(true);
    window.setTimeout(onDone, 380);
  };

  const next = () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  // Suporte a teclas de navegação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  return (
    <>
      {showPreIntro && (
        <CaldraGenesisPreIntro
          onComplete={() => setShowPreIntro(false)}
        />
      )}
      <div
        className={cn(
          "fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-opacity duration-500",
          "bg-[#FAF9F6] text-zinc-900 select-none",
          leaving ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null) return;
          if (start - end > 45) next();
          if (end - start > 45 && step > 0) prev();
        }}
      >
      {/* ============================================================== */}
      {/* FUNDO CLARO TÉCNICO COM ILUMINAÇÃO ORGÂNICA (DIREÇÃO VISUAL)  */}
      {/* ============================================================== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Luz orgânica âmbar suave no canto superior direito */}
        <div
          className="absolute -top-16 -right-16 size-[32rem] sm:size-[38rem] rounded-full blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(249, 115, 22, 0.12) 50%, transparent 75%)",
          }}
        />

        {/* Luz orgânica violeta / azul suave no quadrante inferior esquerdo */}
        <div
          className="absolute -bottom-20 -left-16 size-[30rem] sm:size-[36rem] rounded-full blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.12) 45%, transparent 75%)",
          }}
        />

        {/* Luz suave centralizada de suporte */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[24rem] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(254, 243, 199, 0.45) 0%, transparent 70%)",
          }}
        />

        {/* Grade técnica sutil de desenho (24px) */}
        <svg className="absolute inset-0 size-full opacity-[0.045]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="caldra-intro-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0F172A" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#caldra-intro-grid)" />
        </svg>

        {/* Miras técnicas de calibração nos cantos */}
        <div className="absolute top-6 left-6 text-zinc-400/40 text-[10px] font-mono tracking-widest">+ 00.00</div>
        <div className="absolute top-6 right-6 text-zinc-400/40 text-[10px] font-mono tracking-widest">+ CAD.REF</div>
        <div className="absolute bottom-6 left-6 text-zinc-400/40 text-[10px] font-mono tracking-widest">+ 100%</div>
        <div className="absolute bottom-6 right-6 text-zinc-400/40 text-[10px] font-mono tracking-widest">+ ISO</div>
      </div>

      {/* ============================================================== */}
      {/* CARD PRINCIPAL / CONTAINER DA TELA (MOBILE / RESPONSIVO)        */}
      {/* ============================================================== */}
      <div className="relative z-10 flex h-full w-full max-w-md sm:max-w-lg flex-col justify-between px-6 sm:px-8 py-7 sm:py-9">
        {/* SLIDES DESLIZÁVEIS / TRANSIÇÃO */}
        <div className="relative flex flex-1 flex-col justify-between overflow-hidden">
          <div
            className="flex flex-1 w-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(-${step * 100}%)` }}
          >
            {/* -------------------------------------------------------- */}
            {/* TELA 1: PRIMEIRA TELA                                    */}
            {/* -------------------------------------------------------- */}
            <div className="flex h-full w-full shrink-0 flex-col justify-between pt-2 pb-4">
              {/* Visual Superior: Logotipo CALDRA oficial 3D */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <IntroLogoHero />
                <button
                  type="button"
                  onClick={() => setShowPreIntro(true)}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-zinc-500 hover:text-zinc-900 bg-zinc-100/90 hover:bg-zinc-200/90 border border-zinc-200 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Rever animação técnica de abertura da marca CALDRA"
                >
                  <Compass className="size-3.5 text-rose-600" />
                  <span>Ver gênese da marca</span>
                </button>
              </div>

              {/* Bloco de Texto Inferior */}
              <div className="mt-2 text-left">
                <h1 className="font-display text-[26px] sm:text-[30px] font-bold leading-[1.18] tracking-tight text-zinc-900 whitespace-pre-line">
                  {SLIDES[0]!.title}
                </h1>
                {/* Linha de acento vermelha horizontal aprovada */}
                <div className="my-3.5 h-[3.5px] w-8 rounded-full bg-[#DC2626]" />
                <p className="text-[14px] sm:text-[15px] font-normal leading-[1.48] text-zinc-600 whitespace-pre-line max-w-sm">
                  {SLIDES[0]!.text}
                </p>
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* TELA 2: SEGUNDA TELA                                     */}
            {/* -------------------------------------------------------- */}
            <div className="flex h-full w-full shrink-0 flex-col justify-between pt-1 pb-4">
              {/* Topo: Ícone + Título + Linha + Texto */}
              <div className="text-left">
                {/* Squircle com ícone da ferramenta 2D */}
                <div className="flex size-11 items-center justify-center rounded-2xl border border-rose-200/90 bg-rose-50/80 text-[#DC2626] shadow-xs">
                  <PenTool className="size-5" strokeWidth={1.8} />
                </div>
                <h1 className="mt-4 font-display text-[26px] sm:text-[30px] font-bold leading-[1.18] tracking-tight text-zinc-900 whitespace-pre-line">
                  {SLIDES[1]!.title}
                </h1>
                <div className="my-3 h-[3.5px] w-8 rounded-full bg-[#DC2626]" />
                <p className="text-[14px] sm:text-[15px] font-normal leading-[1.48] text-zinc-600 whitespace-pre-line max-w-sm">
                  {SLIDES[1]!.text}
                </p>
              </div>

              {/* Visual Central/Inferior: Geometria 2D real do CHAMFER */}
              <div className="flex-1 flex items-center justify-center mt-2">
                <IntroChamfer2DVisual />
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* TELA 3: TERCEIRA TELA                                    */}
            {/* -------------------------------------------------------- */}
            <div className="flex h-full w-full shrink-0 flex-col justify-between pt-1 pb-4">
              {/* Topo: Ícone + Título + Linha + Texto */}
              <div className="text-left">
                {/* Squircle com ícone de modelagem 3D */}
                <div className="flex size-11 items-center justify-center rounded-2xl border border-rose-200/90 bg-rose-50/80 text-[#DC2626] shadow-xs">
                  <Box className="size-5" strokeWidth={1.8} />
                </div>
                <h1 className="mt-4 font-display text-[26px] sm:text-[30px] font-bold leading-[1.18] tracking-tight text-zinc-900 whitespace-pre-line">
                  {SLIDES[2]!.title}
                </h1>
                <div className="my-3 h-[3.5px] w-8 rounded-full bg-[#DC2626]" />
                <p className="text-[14px] sm:text-[15px] font-normal leading-[1.48] text-zinc-600 whitespace-pre-line max-w-sm">
                  {SLIDES[2]!.text}
                </p>
              </div>

              {/* Visual Central/Inferior: Modelo 3D e Caldeiraria real */}
              <div className="flex-1 flex items-center justify-center mt-2">
                <IntroCaldra3DVisual />
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* TELA 4: QUARTA TELA                                      */}
            {/* -------------------------------------------------------- */}
            <div className="flex h-full w-full shrink-0 flex-col justify-between pt-1 pb-4">
              {/* Topo: Ícone + Título + Linha + Texto */}
              <div className="text-left">
                {/* Squircle com ícone de corte / engrenagem */}
                <div className="flex size-11 items-center justify-center rounded-2xl border border-rose-200/90 bg-rose-50/80 text-[#DC2626] shadow-xs">
                  <Settings className="size-5" strokeWidth={1.8} />
                </div>
                <h1 className="mt-4 font-display text-[26px] sm:text-[30px] font-bold leading-[1.18] tracking-tight text-zinc-900 whitespace-pre-line">
                  {SLIDES[3]!.title}
                </h1>
                <div className="my-3 h-[3.5px] w-8 rounded-full bg-[#DC2626]" />
                <p className="text-[14px] sm:text-[15px] font-normal leading-[1.48] text-zinc-600 whitespace-pre-line max-w-sm">
                  {SLIDES[3]!.text}
                </p>
              </div>

              {/* Visual Central/Inferior: Planificação e corte CNC */}
              <div className="flex-1 flex items-center justify-center mt-2">
                <IntroCncNestingVisual />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RODAPÉ DE NAVEGAÇÃO: PONTOS DE PROGRESSO + PULAR + PRÓXIMO/COMEÇAR */}
        {/* ============================================================== */}
        <div className="relative z-20 flex items-center justify-between pt-4 mt-2 border-t border-zinc-200/60">
          {/* Indicadores de progresso inferiores (4 passos) */}
          <div className="flex items-center gap-2">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setStep(idx)}
                aria-label={`Ir para a tela ${idx + 1}`}
                className={cn(
                  "rounded-full transition-all duration-300",
                  idx === step
                    ? "size-2.5 bg-[#DC2626] shadow-xs"
                    : "size-2 bg-zinc-300 hover:bg-zinc-400",
                )}
              />
            ))}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3">
            <button
              onClick={finish}
              className="px-2 py-1.5 font-mono text-[11px] sm:text-[12px] font-semibold tracking-[0.2em] text-zinc-500 hover:text-zinc-800 transition-colors uppercase cursor-pointer"
            >
              PULAR
            </button>
            <button
              onClick={next}
              className="group flex items-center justify-center gap-1.5 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] active:scale-95 px-6 py-2.5 font-sans text-[13.5px] font-semibold text-white shadow-md shadow-rose-900/20 transition-all cursor-pointer"
            >
              <span>{step < SLIDES.length - 1 ? "Próximo" : "Começar"}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
);
}

export { CaldraGenesisPreIntro };

export function useIntro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("autostart") === "1") {
        window.sessionStorage.setItem(KEY, "done");
        setShow(false);
        return;
      }
      if (!window.sessionStorage.getItem(KEY)) {
        setShow(true);
      }
    } catch {
      /* ignore */
    }

    // Permite reabrir a introdução a qualquer momento via evento global
    const handleReopen = () => setShow(true);
    window.addEventListener("caldra:open-intro", handleReopen);
    return () => window.removeEventListener("caldra:open-intro", handleReopen);
  }, []);

  const done = () => {
    setShow(false);
    try {
      window.sessionStorage.setItem(KEY, "done");
    } catch {
      /* ignore */
    }
  };

  return { show, done };
}
