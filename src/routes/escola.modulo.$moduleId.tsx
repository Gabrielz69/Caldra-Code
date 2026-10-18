import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Clock, Lock } from "lucide-react";
import { findModule } from "@/lib/education/curriculum";
import { MASTERY_LABEL, moduleProgress, useAcademy } from "@/lib/education/progress";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

export const Route = createFileRoute("/escola/modulo/$moduleId")({
  loader: ({ params }) => {
    const mod = findModule(params.moduleId);
    if (!mod) throw notFound();
    return mod;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Módulo indisponível — CALDRA" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.title} — Estudos | CALDRA`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.summary },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ModulePage,
});

function ModulePage() {
  const mod = Route.useLoaderData();
  const state = useAcademy();
  const pct = moduleProgress(mod.id, state);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          to="/escola"
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          <ChevronLeft className="size-3" /> Estudos
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{mod.title}</h1>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Panel className="p-4">
        <SectionLabel>Aulas</SectionLabel>
        <div className="divide-y divide-line">
          {mod.lessons.map((l) => {
            const st = state.lessons[l.id]?.mastery ?? "nao-iniciado";
            return (
              <Link
                key={l.id}
                to="/escola/aula/$lessonId"
                params={{ lessonId: l.id }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{l.title}</p>
                  <p className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
                    <Clock className="size-3" /> {l.minutes} min · {MASTERY_LABEL[st]}
                  </p>
                </div>
                {!l.free && <Lock className="size-3.5 shrink-0 text-accent" />}
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
