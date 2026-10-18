import { Link } from "@tanstack/react-router";
import { Box, Heart, Layers3, Ruler, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PROJECT_CATALOG } from "@/lib/project-catalog/registry";
import { toggleFavorite, useCatalogPreferences } from "@/lib/project-catalog/preferences";
import { cn } from "@/lib/utils";

const categories = ["todos", "escadas", "plataformas", "suportes"] as const;
function Preview({ slug }: { slug: string }) {
  return (
    <svg viewBox="0 0 520 260" className="h-full w-full" aria-label={`Prévia técnica de ${slug}`}>
      <defs>
        <pattern id={`g-${slug}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".08" />
        </pattern>
      </defs>
      <rect width="520" height="260" fill={`url(#g-${slug})`} />
      {slug === "escada-reta" ? (
        <g fill="none" stroke="var(--accent)" strokeWidth="3">
          <path d="M58 212 380 56M82 226 404 70" />
          <path d="M92 196h58v-28h58v-28h58v-28h58V84h58V56" strokeWidth="2" />
          <path d="M380 56v-50M404 70v-50M380 20h24" />
          <path d="M58 212h346" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
        </g>
      ) : slug === "plataforma-industrial" ? (
        <g fill="none" stroke="var(--accent)" strokeWidth="3">
          <path d="M90 80h320v70H90zM110 150v82m280-82v82M90 80l55-38h320l-55 38M410 80l55-38v70l-55 38" />
          <path d="M110 108h280" strokeWidth="1" />
        </g>
      ) : (
        <g fill="none" stroke="var(--accent)" strokeWidth="3">
          <path d="M120 220h280M155 220V70h210v150M155 120h210M205 120q55-85 110 0" />
          <circle cx="260" cy="90" r="34" />
        </g>
      )}
    </svg>
  );
}
export function ProjectCatalog() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("todos");
  const { favorites, recent } = useCatalogPreferences();
  const list = useMemo(
    () =>
      PROJECT_CATALOG.filter(
        (m) =>
          (category === "todos" || m.category === category) &&
          [m.name, m.category, m.type, ...m.applications]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [q, category],
  );
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, categoria, aplicação ou estrutura"
          className="w-full rounded-xl border border-line bg-background/60 py-3 pl-10 pr-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? "default" : "outline"}
            onClick={() => setCategory(c)}
            className="shrink-0 capitalize"
          >
            {c}
          </Button>
        ))}
      </div>
      {recent.length > 0 && (
        <p className="t-caption">
          Recentes:{" "}
          {recent
            .map((s) => PROJECT_CATALOG.find((m) => m.slug === s)?.name)
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((model) => (
          <article
            key={model.slug}
            className="overflow-hidden rounded-xl border border-line bg-card"
          >
            <div className="relative aspect-[2/1] bg-background/50 text-foreground">
              <Preview slug={model.slug} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Favoritar ${model.name}`}
                onClick={() => toggleFavorite(model.slug)}
                className={cn(
                  "absolute right-3 top-3",
                  favorites.includes(model.slug) && "text-accent",
                )}
              >
                <Heart className={cn(favorites.includes(model.slug) && "fill-current")} />
              </Button>
              <span className="absolute bottom-3 left-3 rounded border border-line bg-background/80 px-2 py-1 font-mono text-[9px] uppercase">
                {model.status === "pronto" ? "Paramétrico" : "Em preparação"}
              </span>
            </div>
            <div className="p-4">
              <p className="t-eyebrow">
                {model.category} · {model.complexity}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold">{model.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers3 className="size-3" />
                  {model.componentCount}
                </span>
                <span className="flex items-center gap-1">
                  <Ruler className="size-3" />
                  medidas adaptáveis
                </span>
                <span className="flex items-center gap-1">
                  <Box className="size-3" />
                  2D + 3D
                </span>
              </div>
              {model.status === "pronto" ? (
                <Button asChild className="mt-4 w-full">
                  <Link to="/projetos/catalogo/$slug" params={{ slug: model.slug }}>
                    Abrir projeto
                  </Link>
                </Button>
              ) : (
                <Button className="mt-4 w-full" disabled>
                  Disponível após validação da Escada
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
