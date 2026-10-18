import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { Eyebrow, Caption } from "@/components/chameleon/ds";
import { CHANGELOG, APP_VERSION, APP_BUILD } from "@/lib/app/version";

export const Route = createFileRoute("/novidades")({
  head: () => ({
    meta: [
      { title: "Novidades — CALDRA" },
      { name: "description", content: "Histórico de versões e melhorias do CALDRA." },
      { property: "og:title", content: "Novidades — CALDRA" },
      { property: "og:description", content: "O que mudou em cada versão do laboratório." },
    ],
  }),
  component: Novidades,
});

function Novidades() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Novidades</h1>
      </header>

      {CHANGELOG.map((entry) => (
        <Panel key={entry.version} className="space-y-3 px-4 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel action={<Sparkles className="size-4 text-primary" />}>
              {entry.title}
            </SectionLabel>
            <Caption className="font-mono">
              v{entry.version} · {entry.date}
            </Caption>
          </div>
          <ul className="space-y-1.5">
            {entry.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground/90">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <Eyebrow className="block text-center normal-case opacity-60">
        Sugestões e problemas: use “Reportar um problema” nas Configurações.
      </Eyebrow>
    </div>
  );
}
