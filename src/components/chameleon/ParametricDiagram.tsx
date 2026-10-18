import { SchematicViews } from "./SchematicViews";
import type { WireParams } from "@/lib/viz3d/wire";
import type { GeometryRef } from "@/lib/geometry/refs";
import { cn } from "@/lib/utils";

export type CotaSpec = {
  /** Campo do motor de cálculo. */
  field: string;
  /** Cota correspondente nas vistas. */
  dim: keyof WireParams | null;
  label: string;
  value: number;
  unit?: string;
};

/**
 * Diagrama paramétrico técnico da peça em 2D.
 * Exibe vistas ortográficas sem bolhas flutuantes invasivas,
 * com suporte a geratrizes interativas selecionáveis por clique.
 */
export function ParametricDiagram({
  slug,
  params,
  cotas = [],
  active,
  pulse: _pulse,
  onPick: _onPick,
  className,
  showGeneratrices = true,
  selectedRef = null,
  onSelectRef,
}: {
  slug: string;
  params: WireParams;
  cotas?: CotaSpec[];
  active?: string | null;
  pulse?: string | null;
  onPick?: (field: string) => void;
  className?: string;
  showGeneratrices?: boolean;
  selectedRef?: GeometryRef | null;
  onSelectRef?: (ref: GeometryRef | null) => void;
}) {
  const highlight = cotas.find((c) => c.field === active)?.dim ?? null;

  return (
    <div className={cn("relative size-full", className)}>
      <SchematicViews
        slug={slug}
        params={params}
        highlight={highlight}
        showGeneratrices={showGeneratrices}
        selectedRef={selectedRef}
        onSelectRef={onSelectRef}
      />
    </div>
  );
}
