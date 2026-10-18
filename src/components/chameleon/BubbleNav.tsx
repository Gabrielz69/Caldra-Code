import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Compass,
  Wrench,
  Home,
  BookOpen,
  User,
  Calculator,
  PenTool,
  Layers,
  ChevronRight,
} from "lucide-react";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { createProject, type NewProjectInput } from "@/lib/projects/store";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";
import { useSettings, type AccentColor } from "@/lib/settings/SettingsProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface NavDestination {
  id: string;
  label: string;
  to: string;
  icon: typeof Home;
  matches: (pathname: string) => boolean;
}

const DESTINATIONS: NavDestination[] = [
  {
    id: "projetar",
    label: "Projetar",
    to: "/projetar",
    icon: Compass,
    matches: (p) =>
      p.startsWith("/projetar") ||
      p.startsWith("/tracagem") ||
      p.startsWith("/desenho-2d") ||
      p.startsWith("/calculadora"),
  },
  {
    id: "produzir",
    label: "Produzir",
    to: "/produzir",
    icon: Wrench,
    matches: (p) =>
      p.startsWith("/produzir") ||
      p.startsWith("/projetos") ||
      p.startsWith("/oficina") ||
      p.startsWith("/planificacao"),
  },
  {
    id: "inicio",
    label: "Início",
    to: "/",
    icon: Home,
    matches: (p) => p === "/",
  },
  {
    id: "aprenda",
    label: "Aprenda",
    to: "/aprenda",
    icon: BookOpen,
    matches: (p) =>
      p.startsWith("/aprenda") ||
      p.startsWith("/escola") ||
      p.startsWith("/biblioteca"),
  },
  {
    id: "perfil",
    label: "Perfil",
    to: "/perfil",
    icon: User,
    matches: (p) =>
      p.startsWith("/perfil") ||
      p.startsWith("/conta") ||
      p.startsWith("/configuracoes") ||
      p.startsWith("/pro"),
  },
];

const NUM_ITEMS = DESTINATIONS.length; // 5

const ACCENT_COLOR_CLASSES: Record<AccentColor, string> = {
  default: "text-[#0088CC] dark:text-[#00CCFF]",
  blue: "text-[#0088CC] dark:text-[#00CCFF]",
  amber: "text-[#D97706] dark:text-[#F59E0B]",
  crimson: "text-[#E11D48] dark:text-[#FB7185]",
  magenta: "text-[#C026D3] dark:text-[#E879F9]",
};

export function BubbleNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { accent } = useSettings();

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Identifica o índice do destino ativo (0 a 4)
  const activeIndex = DESTINATIONS.findIndex((d) => d.matches(pathname));
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 2; // Default Início

  // Largura do contêiner para calcular a largura de cada slot (W / 5)
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 390,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Estados de arrasto do tambor rotativo infinito
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Refs de rastreamento do gesto
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const lastSlotCrossedRef = useRef<number>(0);
  const isHorizontalGestureRef = useRef<boolean | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // Atualiza a largura do contêiner em resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(w);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);

    window.addEventListener("resize", updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  // Escuta evento personalizado para novo projeto caso disparado
  useEffect(() => {
    const handleOpenNewProject = () => setNewProjectOpen(true);
    window.addEventListener("caldra:new-project", handleOpenNewProject);
    return () => {
      window.removeEventListener("caldra:new-project", handleOpenNewProject);
    };
  }, []);

  const slotWidth = containerWidth / NUM_ITEMS;

  const navigateToDestination = useCallback(
    (index: number) => {
      const dest = DESTINATIONS[index];
      if (!dest) return;
      triggerHaptic("selection");
      AudioManager.play("ui_nav");
      void navigate({ to: dest.to });
    },
    [navigate],
  );

  // Início do toque / ponteiro
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Apenas clique principal / toque primário
    if (e.button !== 0) return;

    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentXRef.current = e.clientX;
    lastSlotCrossedRef.current = 0;
    isHorizontalGestureRef.current = null;

    setIsDragging(true);
    setIsAnimating(false);
  };

  // Movimento contínuo do tambor
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detecta intenção do gesto (horizontal vs vertical)
    if (isHorizontalGestureRef.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          isHorizontalGestureRef.current = true;
          // Captura o ponteiro para seguir fora da tela se necessário
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        } else {
          isHorizontalGestureRef.current = false;
          setIsDragging(false);
          return;
        }
      } else {
        return;
      }
    }

    if (!isHorizontalGestureRef.current) return;

    currentXRef.current = e.clientX;
    setDragOffset(dx);

    // Feedback sonoro de catraca ao cruzar cada ranhura/slot físico
    const slotCrossed = Math.round(dx / slotWidth);
    if (slotCrossed !== lastSlotCrossedRef.current) {
      lastSlotCrossedRef.current = slotCrossed;
      AudioManager.play("ui_nav");
      triggerHaptic("selection");
    }
  };

  // Finalização do gesto com encaixe (snap) e navegação
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerIdRef.current !== e.pointerId) return;

    const totalDx = e.clientX - startXRef.current;
    const wasHorizontal = isHorizontalGestureRef.current === true;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    setIsDragging(false);
    pointerIdRef.current = null;
    isHorizontalGestureRef.current = null;

    // Se o movimento foi mínimo (< 8 px), foi um clique/toque direto em um destino
    if (!wasHorizontal || Math.abs(totalDx) < 8) {
      setDragOffset(0);
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickedSlot = Math.floor(clickX / slotWidth);
      const targetIndex = Math.max(0, Math.min(NUM_ITEMS - 1, clickedSlot));
      navigateToDestination(targetIndex);
      return;
    }

    // Caso de deslizamento: calcular quantidade de slots deslocados
    const slotsMoved = Math.round(totalDx / slotWidth);

    if (slotsMoved === 0) {
      // Snap suave de volta para a posição original
      setIsAnimating(true);
      setDragOffset(0);
      setTimeout(() => setIsAnimating(false), 240);
    } else {
      // O usuário girou o tambor:
      // Se arrastou para a esquerda (totalDx negativo), o tambor gira para frente (+ slots)
      // Se arrastou para a direita (totalDx positivo), o tambor gira para trás (- slots)
      const targetOffset = slotsMoved * slotWidth;
      setIsAnimating(true);
      setDragOffset(targetOffset);

      const newIndex = ((resolvedActiveIndex - slotsMoved) % NUM_ITEMS + NUM_ITEMS) % NUM_ITEMS;

      setTimeout(() => {
        setIsAnimating(false);
        setDragOffset(0);
        navigateToDestination(newIndex);
      }, 220);
    }
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setIsAnimating(true);
    setDragOffset(0);
    pointerIdRef.current = null;
    isHorizontalGestureRef.current = null;
    setTimeout(() => setIsAnimating(false), 200);
  };

  const handleCreateProject = (input: NewProjectInput) => {
    try {
      const created = createProject(input);
      setNewProjectOpen(false);
      triggerHaptic("success");
      AudioManager.play("ui_pop");
      void navigate({ to: "/projetos/$projectId", params: { projectId: created.id } });
    } catch (e) {
      console.error("Erro ao criar projeto:", e);
    }
  };

  // Três ciclos de 5 itens para garantir rotação infinita contínua sem quebras
  // Ciclo -1: índices -5 a -1 (wrap à esquerda)
  // Ciclo  0: índices  0 a  4 (visão padrão em repouso)
  // Ciclo  1: índices  5 a  9 (wrap à direita)
  const CYCLES = [-1, 0, 1];

  const activeColorClass = ACCENT_COLOR_CLASSES[accent] || ACCENT_COLOR_CLASSES.default;

  return (
    <>
      <nav
        aria-label="Navegação principal da oficina digital"
        className="fixed inset-x-0 bottom-0 z-40 w-full select-none bg-white dark:bg-[#0B0E14] amoled:bg-black border-t border-zinc-200/90 dark:border-zinc-800/80 transition-colors pointer-events-auto shadow-xs"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)",
        }}
      >
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="relative w-full h-[58px] sm:h-[62px] overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing"
        >
          {/* Trilho contínuo de 3 ciclos (300% da largura) */}
          <div
            className="flex h-full"
            style={{
              width: "300%",
              transform: `translate3d(calc(-33.333333% + ${dragOffset}px), 0, 0)`,
              transition: isDragging
                ? "none"
                : isAnimating
                ? "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
                : "none",
              willChange: "transform",
            }}
          >
            {CYCLES.map((cycle) => (
              <div
                key={cycle}
                className="flex h-full"
                style={{ width: "33.333333%" }}
                aria-hidden={cycle !== 0}
              >
                {DESTINATIONS.map((dest, destIdx) => {
                  const isCurrent = destIdx === resolvedActiveIndex;
                  const Icon = dest.icon;

                  return (
                    <button
                      key={`${cycle}-${dest.id}`}
                      type="button"
                      tabIndex={cycle === 0 ? 0 : -1}
                      aria-label={dest.label}
                      aria-current={cycle === 0 && isCurrent ? "page" : undefined}
                      onClick={(e) => {
                        // Previne clique sintético se foi um arraste físico
                        if (Math.abs(dragOffset) > 6) {
                          e.preventDefault();
                          return;
                        }
                        navigateToDestination(destIdx);
                      }}
                      className={cn(
                        "flex flex-1 flex-col items-center justify-center gap-1 h-full py-1 transition-colors outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800/50 cursor-pointer touch-manipulation",
                        isCurrent
                          ? activeColorClass
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-6 transition-transform",
                          isCurrent ? "scale-105" : "scale-100",
                        )}
                        strokeWidth={isCurrent ? 2.2 : 1.75}
                      />
                      <span
                        className={cn(
                          "text-[11.5px] sm:text-[12.5px] tracking-tight leading-none transition-all",
                          isCurrent
                            ? "font-semibold"
                            : "font-normal text-zinc-500 dark:text-zinc-400",
                        )}
                      >
                        {dest.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Modal de Criação de Projeto Operacional (Preservado) */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreate={handleCreateProject}
      />

      {/* Bancada de Ferramentas Técnicas (Preservado) */}
      <NavToolsModal open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </>
  );
}

/** Modal de ferramentas acessível quando chamado por atalhos */
function NavToolsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85dvh] w-[min(92vw,500px)] overflow-y-auto border border-border bg-card p-5 text-card-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <Wrench className="size-4.5" />
            <DialogTitle className="font-display text-lg font-bold text-foreground">
              Bancada de Ferramentas
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Ferramentas técnicas operacionais de cálculo, traçado e oficina metálica.
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
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3 text-left transition-all hover:border-border hover:bg-muted/60 active:scale-[0.99] cursor-pointer touch-manipulation"
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
