import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Clock, Lock } from "lucide-react";
import { findLesson } from "@/lib/education/courses";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { Panel, PlanBadge, SectionLabel } from "@/components/chameleon/ui";

export const Route = createFileRoute("/escola/$slug")({
  loader: ({ params }) => {
    const found = findLesson(params.slug);
    if (!found) throw notFound();
    return found;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Aula indisponível — CALDRA" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.lesson.title} — Escola CALDRA`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.lesson.theory.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.lesson.theory.slice(0, 155) },
      ],
    };
  },
  component: LessonPage,
});

function LessonPage() {
  const { lesson, module } = Route.useLoaderData();
  const { can } = useFeatureAccess();
  const locked = !lesson.free && !can("school.full");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          to="/escola"
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          <ChevronLeft className="size-3" /> {module.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-semibold lg:text-2xl">{lesson.title}</h1>
          <PlanBadge premium={!lesson.free} />
        </div>
        <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Clock className="size-3" /> {lesson.minutes} min de leitura
        </p>
      </div>

      {locked ? (
        <Panel className="p-6 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
            <Lock className="size-4" />
          </div>
          <h2 className="mt-3 font-display text-base">Aula do CALDRA PRO</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Teoria completa, exemplo resolvido e exercício desta aula fazem parte do plano PRO.
          </p>
          <Link
            to="/pro"
            className="brand-gradient mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-background"
          >
            Conhecer o CALDRA PRO
          </Link>
        </Panel>
      ) : (
        <div className="space-y-3">
          <Block title="Teoria">{lesson.theory}</Block>
          <Panel className="p-4">
            <SectionLabel>Fórmula</SectionLabel>
            <p className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2.5 text-center font-mono text-sm text-accent">
              {lesson.formula}
            </p>
          </Panel>
          <Block title="Exemplo numérico">{lesson.example}</Block>
          <Block title="Aplicação prática">{lesson.application}</Block>
          <Panel className="p-4">
            <SectionLabel>Exercício</SectionLabel>
            <p className="text-[13px] leading-relaxed">{lesson.exercise}</p>
            <Link
              to="/tracagem"
              className="mt-3 inline-block rounded-xl border border-accent/25 bg-accent/10 px-3 py-1.5 font-mono text-[11px] text-accent"
            >
              Resolver no laboratório
            </Link>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <SectionLabel>{title}</SectionLabel>
      <p className="text-[13px] leading-relaxed text-foreground/90">{children}</p>
    </Panel>
  );
}
