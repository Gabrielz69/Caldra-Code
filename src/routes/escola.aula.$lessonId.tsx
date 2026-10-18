import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertTriangle, Calculator, ChevronLeft, Clock, Lock, Star } from "lucide-react";
import { findAcademyLesson } from "@/lib/education/curriculum";
import { formulaById, knowledgeById } from "@/lib/education/knowledge";
import {
  MASTERY_LABEL,
  lessonState,
  markOpened,
  missingPrerequisites,
  raiseMastery,
  toggleFavorite,
  useAcademy,
} from "@/lib/education/progress";
import { ArcSim, TriangleSim } from "@/components/education/Simulators";
import { ExercisePanel } from "@/components/education/ExercisePanel";
import { Panel, PlanBadge, SectionLabel } from "@/components/chameleon/ui";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/escola/aula/$lessonId")({
  loader: ({ params }) => {
    const found = findAcademyLesson(params.lessonId);
    if (!found) throw notFound();
    return found;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Aula indisponível — CALDRA" }, { name: "robots", content: "noindex" }],
      };
    }
    const first = knowledgeById(loaderData.lesson.knowledge[0] ?? "");
    const desc = first?.concept ?? "Aula da escola de caldeiraria do CALDRA.";
    const title = `${loaderData.lesson.title} — Estudos | CALDRA`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: LessonPage,
});

function LessonPage() {
  const { module, lesson } = Route.useLoaderData();
  const state = useAcademy();
  const { can } = useFeatureAccess();
  const locked = !lesson.free && !can("school.full");
  const st = lessonState(lesson.id);
  const missing = missingPrerequisites(lesson.id, state);
  const lessonFormulas = lesson.knowledge.flatMap((kid) => knowledgeById(kid)?.formulas ?? []);

  useEffect(() => {
    if (!locked) markOpened(lesson.id);
  }, [lesson.id, locked]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          to="/escola/modulo/$moduleId"
          params={{ moduleId: module.id }}
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          <ChevronLeft className="size-3" /> {module.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-semibold lg:text-2xl">{lesson.title}</h1>
          <PlanBadge premium={!lesson.free} />
          <button
            onClick={() => toggleFavorite(lesson.id)}
            aria-label="Favoritar aula"
            className="ml-auto rounded-lg border border-line p-1.5"
          >
            <Star
              className={cn(
                "size-3.5",
                st.favorite ? "fill-accent text-accent" : "text-muted-foreground",
              )}
            />
          </button>
        </div>
        <p className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
          <Clock className="size-3" /> {lesson.minutes} min · {MASTERY_LABEL[st.mastery]}
        </p>
      </div>

      {locked ? (
        <Panel className="p-6 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
            <Lock className="size-4" />
          </div>
          <h2 className="mt-3 font-display text-base">Aula do CALDRA PRO</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Conceito completo, simulador e prática desta aula fazem parte do plano PRO.
          </p>
          <Link
            to="/pro"
            className="brand-gradient mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-background"
          >
            Conhecer o CALDRA PRO
          </Link>
        </Panel>
      ) : (
        <>
          {missing.length > 0 && (
            <Panel className="p-3">
              <p className="text-[12px] text-muted-foreground">
                Recomendamos revisar antes:{" "}
                {missing.map((id) => (
                  <Link
                    key={id}
                    to="/escola/aula/$lessonId"
                    params={{ lessonId: id }}
                    className="text-accent underline underline-offset-2"
                  >
                    {findAcademyLesson(id)?.lesson.title ?? id}
                  </Link>
                ))}
              </p>
            </Panel>
          )}

          {lesson.knowledge.map((kid) => {
            const k = knowledgeById(kid);
            if (!k) return null;
            return (
              <div key={kid} className="space-y-3">
                <Panel className="p-4">
                  <SectionLabel>Conceito</SectionLabel>
                  <p className="text-[13px] leading-relaxed text-foreground/90">{k.concept}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {k.definition}
                  </p>
                  {k.state !== "verificado" && (
                    <p className="mt-3 flex items-start gap-1.5 font-mono text-[10px] text-muted-foreground uppercase">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {k.state === "needs-review"
                        ? "Conteúdo em revisão técnica"
                        : "Conteúdo em preparação"}
                    </p>
                  )}
                </Panel>

                {k.formulas.map((fid) => {
                  const f = formulaById(fid);
                  if (!f) return null;
                  return (
                    <Panel key={fid} className="p-4">
                      <SectionLabel>Fórmula</SectionLabel>
                      <p className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2.5 text-center font-mono text-sm text-accent">
                        {f.expression}
                      </p>
                      <dl className="mt-3 space-y-1">
                        {f.variables.map((v) => (
                          <div key={v.symbol} className="flex gap-2 text-[12px]">
                            <dt className="w-8 shrink-0 font-mono text-accent">{v.symbol}</dt>
                            <dd className="text-muted-foreground">
                              {v.meaning}
                              {v.unit ? ` (${v.unit})` : ""}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-3 text-[12px] leading-relaxed">
                        <span className="font-mono text-[10px] text-accent uppercase">
                          Por quê?{" "}
                        </span>
                        {f.why}
                      </p>
                      {f.example && (
                        <p className="mt-2 text-[12px] text-muted-foreground">
                          Exemplo: {f.example}
                        </p>
                      )}
                      <Link
                        to="/calculadora"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent uppercase"
                      >
                        <Calculator className="size-3" /> Usar na calculadora
                      </Link>
                    </Panel>
                  );
                })}

                {k.method?.length ? (
                  <Panel className="p-4">
                    <SectionLabel>Passo a passo</SectionLabel>
                    <ol className="space-y-1.5 text-[12px] text-muted-foreground">
                      {k.method.map((m, i) => (
                        <li key={m} className="flex gap-2">
                          <span className="font-mono text-[10px] text-accent">{i + 1}</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ol>
                  </Panel>
                ) : null}

                {(k.warnings?.length || k.commonErrors?.length) && (
                  <Panel className="p-4">
                    <SectionLabel>Atenção na prática</SectionLabel>
                    <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                      {[...(k.warnings ?? []), ...(k.commonErrors ?? [])].map((w) => (
                        <li key={w}>· {w}</li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </div>
            );
          })}

          {lesson.simulator === "triangulo" && <TriangleSim />}
          {lesson.simulator === "arco" && <ArcSim />}

          <ExercisePanel lessonId={lesson.id} formulaIds={lessonFormulas} />

          <Panel className="p-4">
            <SectionLabel>Prática</SectionLabel>
            <p className="text-[13px] text-muted-foreground">
              Aplique o conteúdo em uma peça real e marque o seu domínio desta aula.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/tracagem"
                className="rounded-xl border border-line px-3 py-1.5 font-mono text-[10px] uppercase"
              >
                Abrir traçagem
              </Link>
              <button
                onClick={() => raiseMastery(lesson.id, "praticado")}
                className="rounded-xl border border-line px-3 py-1.5 font-mono text-[10px] uppercase"
              >
                Já pratiquei
              </button>
              <button
                onClick={() => raiseMastery(lesson.id, "dominado")}
                className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent uppercase"
              >
                Domino este conteúdo
              </button>
            </div>
          </Panel>

          {lesson.legacySlug && (
            <Link
              to="/escola/$slug"
              params={{ slug: lesson.legacySlug }}
              className="block text-center font-mono text-[10px] text-muted-foreground uppercase"
            >
              Ver aula longa
            </Link>
          )}
        </>
      )}
    </div>
  );
}
