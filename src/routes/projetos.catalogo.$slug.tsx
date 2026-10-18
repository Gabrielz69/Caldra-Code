import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ProjectConfigurator } from "@/components/projects/catalog/ProjectConfigurator";
import { findCatalogModel } from "@/lib/project-catalog/registry";
export const Route = createFileRoute("/projetos/catalogo/$slug")({
  head: () => ({
    meta: [
      { title: "Projeto Paramétrico — CALDRA" },
      {
        name: "description",
        content:
          "Configure um projeto paramétrico e gere geometria, peças, BOM e montagem coerentes.",
      },
      { property: "og:title", content: "Projeto Paramétrico — CALDRA" },
      {
        property: "og:description",
        content: "Modelo paramétrico completo para fabricação no CALDRA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogProjectPage,
});
function CatalogProjectPage() {
  const { slug } = Route.useParams();
  const model = findCatalogModel(slug);
  if (!model?.generate)
    return (
      <div className="p-8 text-center">
        <h1 className="font-display text-2xl">Projeto indisponível</h1>
        <Link to="/projetos" className="mt-3 inline-block text-accent underline">
          Voltar ao catálogo
        </Link>
      </div>
    );
  return (
    <div className="space-y-4">
      <Link
        to="/projetos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
      >
        <ChevronLeft className="size-4" />
        Projetos
      </Link>
      <header>
        <p className="t-eyebrow">Golden Project · {model.category}</p>
        <h1 className="font-display text-3xl font-semibold">{model.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{model.description}</p>
      </header>
      <ProjectConfigurator model={model} />
    </div>
  );
}
