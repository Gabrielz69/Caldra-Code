import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CircleDashed, Lock } from "lucide-react";
import { CURRICULUM } from "@/lib/education/curriculum";
import {
  COMPETENCY_LEVEL_LABEL,
  COMPETENCY_MAP,
  competencyLevel,
  moduleProgress,
  nextLesson,
  reviewQueue,
  useAcademy,
} from "@/lib/education/progress";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/escola/")({
  head: () => ({
    meta: [
      { title: "Estudos — Escola de caldeiraria | CALDRA" },
      {
        name: "description",
        content:
          "Trilha de formação em caldeiraria: fundamentos, matemática aplicada, traçagem e planificação, com mapa de competências e simuladores.",
      },
      { property: "og:title", content: "Estudos — Escola de caldeiraria | CALDRA" },
      {
        property: "og:description",
        content: "Aprenda por conceito, fórmula, simulação e prática — do zero à competência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstudosIndex,
});

function EstudosIndex() {
  const state = useAcademy();
  const next = nextLesson(state);
  const review = reviewQueue(state);

  return (
    <div className="space-y-5">
      <NavigationAreaHeader
        badgeText="TRILHA DE FORMAÇÃO & CERTIFICAÇÃO"
        badgeColor="text-amber-500"
        indicatorColor="bg-amber-500"
        secondaryBadge={
          <span className="rounded bg-amber-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-amber-500 border border-amber-500/30">
            ESCOLA CALDRA
          </span>
        }
        title="Estudos Técnicos"
        description="Do zero à competência: conceito, fórmula fundamentada, simulação e prática de caldeiraria."
      />

      <Panel className="p-4">
        <SectionLabel>Descubra seu nível</SectionLabel>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            {state.diagnosis
              ? `Nível registrado: ${state.diagnosis.level === "avancado" ? "Avançado" : state.diagnosis.level === "intermediario" ? "Intermediário" : "Iniciante"}. Refazer quando quiser.`
              : "Seis perguntas rápidas definem por onde você começa."}
          </p>
          <Link
            to="/escola/diagnostico"
            className="shrink-0 rounded-xl border border-accent/25 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent uppercase"
          >
            {state.diagnosis ? "Refazer" : "Começar"}
          </Link>
        </div>
      </Panel>

      {next && (
        <Panel className="p-4">
          <SectionLabel>Continuar aprendendo</SectionLabel>
          <Link
            to="/escola/aula/$lessonId"
            params={{ lessonId: next.lesson.id }}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-base">{next.lesson.title}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground uppercase">
                {next.module.code} · {next.module.title} · {next.lesson.minutes} min
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-accent" />
          </Link>
        </Panel>
      )}

      <Panel className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel>Mapa de competências</SectionLabel>
          <Link to="/escola/competencias" className="font-mono text-[10px] text-accent uppercase">
            Ver detalhe
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {COMPETENCY_MAP.map((c) => {
            const { level, pct } = competencyLevel(c.id, state);
            return (
              <div key={c.id} className="rounded-xl border border-line p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm">{c.title}</span>
                  <span className="font-mono text-[10px] text-accent">{pct}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground uppercase">
                  {COMPETENCY_LEVEL_LABEL[level]}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      {review.length > 0 && (
        <Panel className="p-4">
          <SectionLabel>Revisão sugerida</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {review.map((x) => (
              <Link
                key={x.lesson.id}
                to="/escola/aula/$lessonId"
                params={{ lessonId: x.lesson.id }}
                className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase"
              >
                {x.lesson.title}
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <div className="space-y-2">
        <SectionLabel>Currículo</SectionLabel>
        {CURRICULUM.map((m) => {
          const pct = moduleProgress(m.id, state);
          const soon = m.lessons.length === 0;
          const Body = (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
              <span className="font-mono text-[11px] text-muted-foreground">{m.code}</span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm">{m.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{m.summary}</p>
              </div>
              {soon ? (
                <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground uppercase">
                  <CircleDashed className="size-3" /> em breve
                </span>
              ) : (
                <span className="font-mono text-[11px] text-accent">{pct}%</span>
              )}
            </div>
          );
          return soon ? (
            <div key={m.id} className="metal rounded-2xl opacity-60">
              {Body}
            </div>
          ) : (
            <Link
              key={m.id}
              to="/escola/modulo/$moduleId"
              params={{ moduleId: m.id }}
              className="metal block rounded-2xl transition-colors hover:amber-ring"
            >
              {Body}
            </Link>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <BookOpen className="size-3" /> Conteúdo técnico do CALDRA.
        <Lock className="ml-1 size-3" /> Algumas aulas fazem parte do CALDRA PRO.
      </p>
    </div>
  );
}
