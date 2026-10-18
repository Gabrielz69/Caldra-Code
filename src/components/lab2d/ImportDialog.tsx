import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Crosshair, FileSearch, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/chameleon/ds";
import { SmartNumberInput } from "@/components/chameleon/SmartNumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { defaultValues, getGenerator, visibleFields } from "@/lib/cnc2d/generators";
import { PART_REGISTRY } from "@/lib/library/registry";
import type { Entity, Layer } from "@/lib/lab2d/core";
import { renderSvg } from "@/lib/lab2d/render";

/** Modelos CNC 2D do próprio CALDRA — geometria vetorial real, nunca imagem. */
const CATALOG = PART_REGISTRY.filter((m) => m.category === "cnc2d" && m.generator);

/** O SVG exportado traz medidas em mm; no preview ele deve preencher a moldura. */
const fitSvg = (svg: string) =>
  svg
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace("<svg ", '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ');

export function ImportDialog({
  open,
  layers,
  onClose,
  onConfirm,
}: {
  open: boolean;
  layers: Layer[];
  onClose: () => void;
  onConfirm: (entities: Entity[]) => void;
}) {
  const [modelId, setModelId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const model = useMemo(() => CATALOG.find((m) => m.id === modelId) ?? null, [modelId]);
  const gen = model?.generator ? getGenerator(model.generator) : null;

  useEffect(() => {
    if (open) {
      setModelId(null);
      setValues({});
    }
  }, [open]);

  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 });
    if (gen) setValues(defaultValues(gen));
  }, [gen]);

  const entities = useMemo(() => {
    if (!gen || !Object.keys(values).length) return [];
    try {
      return gen.build(values);
    } catch {
      return [];
    }
  }, [gen, values]);

  const preview = useMemo(
    () =>
      entities.length
        ? renderSvg(entities, layers, { dimensions: false, background: "white" })
        : null,
    [entities, layers],
  );
  const layerNames = useMemo(
    () => [...new Set(entities.map((e) => layers.find((l) => l.id === e.layer)?.name ?? e.layer))],
    [entities, layers],
  );
  const fields = gen ? visibleFields(gen, values) : [];
  const back = () => {
    setModelId(null);
    setValues({});
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="metal flex max-h-[82dvh] w-[min(94vw,42rem)] max-w-none flex-col overflow-y-auto border-line">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Importar Traçado CNC 2D</DialogTitle>
        </DialogHeader>
        {!model ? (
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">
              Catálogo CNC 2D CALDRA · {CATALOG.length} modelos
            </p>
            <div className="grid max-h-[58dvh] gap-2 overflow-y-auto sm:grid-cols-2">
              {CATALOG.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModelId(item.id)}
                  className="rounded-xl border border-line bg-background/40 p-3 text-left transition-colors hover:border-accent"
                >
                  <span className="block font-medium text-foreground">{item.name}</span>
                  <span className="block font-mono text-[10px] uppercase text-accent">
                    {item.family}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.summary}</span>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    {item.specs.join(" · ")} · {item.id}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs text-foreground">
                <FileSearch className="size-4 text-accent" />
                {model.name}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  aria-label="Diminuir preview"
                  onClick={() => setView((v) => ({ ...v, scale: Math.max(0.5, v.scale / 1.2) }))}
                >
                  <Minus className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  aria-label="Ajustar preview"
                  onClick={() => setView({ scale: 1, x: 0, y: 0 })}
                >
                  <Crosshair className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  aria-label="Ampliar preview"
                  onClick={() => setView((v) => ({ ...v, scale: Math.min(8, v.scale * 1.2) }))}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
            <div
              className="relative aspect-[4/3] touch-none overflow-hidden rounded-xl border border-line bg-white"
              onWheel={(e) => {
                e.preventDefault();
                setView((v) => ({
                  ...v,
                  scale: Math.min(8, Math.max(0.5, v.scale * Math.exp(-e.deltaY * 0.0015))),
                }));
              }}
              onPointerDown={(e) => {
                drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d)
                  setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
            >
              {preview ? (
                <div
                  className="size-full p-3"
                  style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
                  dangerouslySetInnerHTML={{ __html: fitSvg(preview.svg) }}
                />
              ) : (
                <p className="grid size-full place-items-center font-mono text-[11px] text-neutral-500">
                  Parâmetros sem geometria válida.
                </p>
              )}
            </div>
            {fields.length > 0 && (
              <div className="space-y-2 rounded-xl border border-line bg-background/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-accent">
                  Parâmetros
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <SmartNumberInput
                        value={values[f.key] ?? f.def}
                        unit={f.suffix ?? "mm"}
                        ariaLabel={f.label}
                        className="w-28"
                        onChange={(n) =>
                          setValues((v) => ({
                            ...v,
                            [f.key]: Math.min(
                              f.max,
                              Math.max(f.min, Number.isFinite(n) ? n : f.def),
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
              <span>
                {model.family} · {model.id}
              </span>
              <span>{preview?.count ?? 0} objetos</span>
              <span>
                {(preview?.widthMm ?? 0).toFixed(1)} × {(preview?.heightMm ?? 0).toFixed(1)} mm
              </span>
              <span>Layers: {layerNames.join(", ") || "—"}</span>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={back}>
                <ArrowLeft className="size-3.5" /> Voltar
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  if (!entities.length) return;
                  onConfirm(entities);
                  toast.success(`${entities.length} objetos inseridos no plano.`);
                  onClose();
                }}
              >
                Importar para o CHAMFER
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
