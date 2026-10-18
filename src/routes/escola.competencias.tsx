import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ALL_LESSONS } from "@/lib/education/curriculum";
import {
  COMPETENCY_LEVEL_LABEL,
  COMPETENCY_MAP,
  MASTERY_LABEL,
  competencyLevel,
  useAcademy,
} from "@/lib/education/progress";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

export const Route = createFileRoute("/escola/competencias")({
  head: () => ({
    meta: [
      { title: "Minhas competências — Estudos | CALDRA" },
      {
        name: "description",
        content:
          "Acompanhe seu domínio em matemática aplicada, desenho técnico, traçagem, planificação, tubulação e fabricação.",
      },
      { property: "og:title", content: "Minhas competências — Estudos | CALDRA" },
      {
        property: "og:description",
        content: "Painel de domínio por competência, aula por aula.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompetenciasPage,
});

function CompetenciasPage() {
  const state = useAcademy();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          to="/escola"
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          <ChevronLeft className="size-3" /> Estudos
        </Link>
        <h1 className="mt-2 font-display text-xl font-semibold lg:text-2xl">Minhas competências</h1>
      </div>

      {COMPETENCY_MAP.map((c) => {
        const { level, pct } = competencyLevel(c.id, state);
        const lessons = ALL_LESSONS.filter((x) => x.lesson.competency === c.id);
        return (
          <Panel key={c.id} className="p-4">
            <div className="flex items-baseline justify-between gap-2">
              <SectionLabel>{c.title}</SectionLabel>
              <span className="font-mono text-[10px] text-accent">{pct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {c.summary} · {COMPETENCY_LEVEL_LABEL[level]}
            </p>

            {lessons.length === 0 ? (
              <p className="mt-3 font-mono text-[10px] text-muted-foreground uppercase">
                Aulas em breve
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {lessons.map(({ lesson }) => {
                  const mastery = state.lessons[lesson.id]?.mastery ?? "nao-iniciado";
                  return (
                    <li key={lesson.id}>
                      <Link
                        to="/escola/aula/$lessonId"
                        params={{ lessonId: lesson.id }}
                        className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12px]">{lesson.title}</span>
                        <span className="font-mono text-[10px] text-muted-foreground uppercase">
                          {MASTERY_LABEL[mastery]}
                        </span>
                        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
