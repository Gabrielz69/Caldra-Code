import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Heart, Lock, Search, Star, Trash2, User } from "lucide-react";
import {
  CAPABILITY_LABEL,
  CATEGORY_LABEL,
  FAMILIES,
  PART_REGISTRY,
  findPart,
  partHref,
  type PartCategory,
  type PartModel,
} from "@/lib/library/registry";
import { searchParts } from "@/lib/library/search";
import {
  markRecent,
  removeCustom,
  toggleFavorite,
  useLibraryState,
  type CustomModel,
} from "@/lib/library/store";
import { getGenerator, defaultValues } from "@/lib/cnc2d/generators";
import { VectorPreview } from "@/components/chameleon/VectorPreview";
import { buildWire, DEFAULT_PARAMS } from "@/lib/viz3d/wire";
import { Wire3D } from "@/components/chameleon/Wire3D";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { NavigationAreaHeader } from "@/components/ui/NavigationAreaHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tracagem/")({
  head: () => ({
    meta: [
      { title: "Traçagem — Biblioteca de peças CALDRA" },
      {
        name: "description",
        content:
          "Biblioteca profissional de caldeiraria, tubulações e CNC 2D: transições, cones, curvas de gomos, interseções, flanges e geometria vetorial para fabricação.",
      },
      { property: "og:title", content: "Traçagem — Biblioteca de peças CALDRA" },
      {
        property: "og:description",
        content: "Encontre a peça e siga direto para 3D, planificação ou CHAMFER.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TracagemIndex,
});

type Tab = "todas" | PartCategory;
type Shortcut = "recentes" | "favoritos" | "meus" | null;

const TABS: { id: Tab; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "caldeiraria", label: "Caldeiraria" },
  { id: "tubulacoes", label: "Tubulações" },
  { id: "cnc2d", label: "CNC 2D" },
];

function TracagemIndex() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("todas");
  const [family, setFamily] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState<Shortcut>(null);
  const { favorites, recents, custom } = useLibraryState();

  useEffect(() => setFamily(null), [tab]);

  const parts = useMemo(() => {
    let list = PART_REGISTRY;
    if (tab !== "todas") list = list.filter((p) => p.category === tab);
    if (family) list = list.filter((p) => p.family === family);
    if (shortcut === "favoritos") list = list.filter((p) => favorites.includes(p.id));
    if (shortcut === "recentes")
      list = recents
        .map((id) => findPart(id))
        .filter((p): p is PartModel => !!p && list.includes(p));
    return searchParts(list, query);
  }, [tab, family, shortcut, favorites, recents, query]);

  const families = tab === "todas" ? [] : FAMILIES[tab];
  const showCustom = shortcut === "meus";

  return (
    <div className="space-y-4">
      <NavigationAreaHeader
        badgeText="BIBLIOTECA & MODELOS PARAMÉTRICOS"
        badgeColor="text-sky-500"
        indicatorColor="bg-sky-500"
        secondaryBadge={
          <span className="rounded bg-sky-500/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-sky-500 border border-sky-500/30">
            {PART_REGISTRY.length} MODELOS
          </span>
        }
        title="Traçagem Paramétrica"
      />

      <label className="metal flex min-w-0 items-center gap-2 rounded-full px-4 sm:max-w-md">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar peça"
          placeholder="Buscar peça, tubo, flange, suporte..."
          className="w-full bg-transparent py-2.5 text-[13px] outline-none placeholder:text-muted-foreground/60"
        />
      </label>

      {/* Categorias principais */}
      <div
        role="tablist"
        aria-label="Categorias da biblioteca"
        className="flex gap-1 overflow-x-auto pb-0.5"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors",
              tab === t.id
                ? "bg-accent/12 text-accent ring-1 ring-accent/25"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Atalhos inteligentes */}
      <div className="flex flex-wrap gap-1.5">
        <Chip
          icon={Clock}
          label="Recentes"
          active={shortcut === "recentes"}
          onClick={() => setShortcut((s) => (s === "recentes" ? null : "recentes"))}
        />
        <Chip
          icon={Star}
          label={`Favoritos${favorites.length ? ` (${favorites.length})` : ""}`}
          active={shortcut === "favoritos"}
          onClick={() => setShortcut((s) => (s === "favoritos" ? null : "favoritos"))}
        />
        <Chip
          icon={User}
          label="Meus modelos"
          active={shortcut === "meus"}
          onClick={() => setShortcut((s) => (s === "meus" ? null : "meus"))}
        />
      </div>

      {/* Filtros contextuais — famílias da categoria ativa */}
      {!showCustom && families.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <FamilyChip label="Tudo" active={!family} onClick={() => setFamily(null)} />
          {families.map((f) => (
            <FamilyChip
              key={f}
              label={f}
              active={family === f}
              onClick={() => setFamily(family === f ? null : f)}
            />
          ))}
        </div>
      )}

      {showCustom ? (
        <CustomList items={custom} />
      ) : parts.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-center text-[13px] text-muted-foreground">
          Nenhuma peça encontrada para esta combinação.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {parts.map((p, i) => (
            <PartCard key={p.id} part={p} index={i} favorite={favorites.includes(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-line text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}

function FamilyChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors",
        active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** Renderiza a prévia apenas quando o card entra na tela (performance). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSeen(true)),
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

function PartCard({
  part,
  index,
  favorite,
}: {
  part: PartModel;
  index: number;
  favorite: boolean;
}) {
  const { can } = useFeatureAccess();
  const { ref, seen } = useInView<HTMLDivElement>();
  const locked = !can(part.feature);
  const href = partHref(part, part.id);

  return (
    <div ref={ref} className="relative">
      <Link
        to={href.to}
        params={href.params as never}
        search={href.search as never}
        onClick={() => markRecent(part.id)}
        style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
        className="metal pop-in group relative flex aspect-[4/5] flex-col overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.02] hover:amber-ring"
      >
        <span
          aria-hidden
          className="grid-bg-fine pointer-events-none absolute inset-0 opacity-40"
        />
        <div className="relative min-h-0 flex-1 p-3">{seen && <Preview part={part} />}</div>
        <div className="relative space-y-1 bg-gradient-to-t from-background/92 to-transparent px-3 pt-4 pb-2.5">
          <p className="truncate font-mono text-[10px] tracking-[0.14em] uppercase">{part.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {CATEGORY_LABEL[part.category]} · {part.kind === "vector" ? "Vetorial" : "Paramétrica"}
          </p>
          {part.specs[0] && (
            <p className="truncate font-mono text-[10px] text-muted-foreground/80">
              {part.specs[0]}
            </p>
          )}
          <p className="truncate font-mono text-[9px] tracking-[0.16em] text-accent/80 uppercase">
            {part.capabilities
              .filter((c) => c !== "top-view")
              .map((c) => CAPABILITY_LABEL[c])
              .join(" · ")}
          </p>
        </div>
        {locked && (
          <Lock
            className="absolute top-2.5 left-3 size-3 text-accent/70"
            aria-label="Recurso PRO"
          />
        )}
      </Link>
      <button
        onClick={() => toggleFavorite(part.id)}
        aria-label={favorite ? `Remover ${part.name} dos favoritos` : `Favoritar ${part.name}`}
        aria-pressed={favorite}
        className="absolute top-1 right-1 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-accent"
      >
        <Heart className={cn("size-3.5", favorite && "fill-accent text-accent")} />
      </button>
    </div>
  );
}

function Preview({ part }: { part: PartModel }) {
  if (part.preview.mode === "vector") {
    const gen = getGenerator(part.preview.generator);
    if (!gen) return null;
    return (
      <VectorPreview
        entities={gen.build(defaultValues(gen))}
        className="text-foreground/85 transition-transform duration-700 group-hover:scale-105"
      />
    );
  }
  return (
    <Wire3D
      model={buildWire(part.preview.slug, { ...DEFAULT_PARAMS, seg: 32 })}
      edgeMode="shaded"
      showRefLines={false}
      className="size-full text-foreground/85 transition-transform duration-700 group-hover:scale-110"
    />
  );
}

function CustomList({ items }: { items: CustomModel[] }) {
  if (!items.length)
    return (
      <p className="glass rounded-2xl p-6 text-center text-[13px] text-muted-foreground">
        Ainda não há modelos seus. Abra uma peça, ajuste as medidas e salve em Meus Modelos.
      </p>
    );
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => {
        const base = findPart(c.baseId);
        if (!base) return null;
        const href = partHref(base, c.baseId);
        const search = { ...(href.search ?? {}), modelo: c.id };
        return (
          <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-3">
            <Link
              to={href.to}
              params={href.params as never}
              search={search as never}
              onClick={() => markRecent(base.id)}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-[13px]">{c.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground uppercase">
                {CATEGORY_LABEL[base.category]} · {base.name}
              </p>
            </Link>
            <button
              onClick={() => removeCustom(c.id)}
              aria-label={`Excluir ${c.name}`}
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
