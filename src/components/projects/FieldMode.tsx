import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, HardHat, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";

import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  addOccurrence,
  fieldSummary,
  readPhoto,
  removeOccurrence,
  resetField,
  toggleInstalled,
  toggleOccurrence,
  useFieldRecord,
} from "@/lib/projects/field";
import { formatDateTime } from "@/lib/projects/links";
import type { Project } from "@/lib/projects/store";
import { cn } from "@/lib/utils";

/**
 * CAMPO / OBRA — checklist de instalação e ocorrências no local.
 * Alvos grandes, alto contraste e funcionamento offline (tudo local).
 */
export function FieldMode({
  project,
  onOpenPart,
  highlight,
}: {
  project: Project;
  onOpenPart?: (instanceId: string) => void;
  highlight?: string | undefined;
}) {
  const rec = useFieldRecord(project.id);
  const { displayName } = useProfile();
  const summary = useMemo(() => fieldSummary(project, rec), [project, rec]);

  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!project.parts.length) return null;

  const codeOf = (id?: string) => project.parts.find((p) => p.instanceId === id)?.code ?? "Obra";

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await readPhoto(file));
    } catch {
      toast.error("Não foi possível usar esta foto.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!text.trim()) {
      toast.error("Descreva a ocorrência.");
      return;
    }
    addOccurrence(project.id, {
      text,
      instanceId: target || undefined,
      photo: photo ?? undefined,
      by: displayName || undefined,
    });
    setText("");
    setTarget("");
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Ocorrência registrada.");
  };

  return (
    <Panel className="p-4">
      <SectionLabel
        action={
          <button
            onClick={() => {
              resetField(project.id);
              toast.success("Registro de campo reiniciado.");
            }}
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase hover:text-accent"
          >
            <RotateCcw className="size-3.5" /> Reiniciar
          </button>
        }
      >
        Campo / obra
      </SectionLabel>

      <div className="mb-3 flex items-center gap-3">
        <HardHat className="size-4 text-accent" />
        <div className="h-1 flex-1 overflow-hidden rounded bg-border">
          <div className="h-full bg-accent" style={{ width: `${summary.pct}%` }} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {summary.installed}/{summary.total} instaladas · {summary.pct}%
        </span>
      </div>

      {summary.open > 0 && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-warn/10 px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-warn uppercase">
          <TriangleAlert className="size-3.5" /> {summary.open} ocorrência(s) em aberto
        </p>
      )}

      {/* Checklist de instalação */}
      <ul className="space-y-1.5">
        {project.parts.map((p) => {
          const inst = rec.installed[p.instanceId];
          const isHi = highlight === p.instanceId;
          return (
            <li
              key={p.instanceId}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-line bg-background/40 px-3 py-2.5",
                inst && "border-accent/40 bg-accent/5",
                isHi && "ring-1 ring-accent/50",
              )}
            >
              <button
                type="button"
                onClick={() => toggleInstalled(project.id, p.instanceId, displayName || undefined)}
                aria-label={`Marcar ${p.code} como instalada`}
                aria-pressed={!!inst}
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-lg border",
                  inst
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-line text-muted-foreground",
                )}
              >
                <Check className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => onOpenPart?.(p.instanceId)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13px]">{p.name}</p>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  {p.code}
                  {p.quantity > 1 ? ` ×${p.quantity}` : ""}
                  {inst ? ` · instalada ${formatDateTime(inst.at)}` : ""}
                  {inst?.by ? ` · ${inst.by}` : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Nova ocorrência */}
      <div className="mt-4 rounded-xl border border-line bg-background/40 p-3">
        <p className="t-eyebrow mb-2">Registrar ocorrência</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="O que aconteceu no local? (medida divergente, furação, interferência...)"
          className="min-h-16 w-full resize-y rounded-lg border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Peça relacionada"
            className="min-h-11 rounded-lg border border-line bg-background/60 px-2 py-1 font-mono text-[10px] tracking-wider uppercase"
          >
            <option value="">Obra (geral)</option>
            {project.parts.map((p) => (
              <option key={p.instanceId} value={p.instanceId}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 font-mono text-[10px] tracking-wider uppercase"
          >
            <Camera className="size-3.5" /> {busy ? "Carregando…" : photo ? "Trocar foto" : "Foto"}
          </button>

          {photo && (
            <span className="relative">
              <img
                src={photo}
                alt="Foto da ocorrência"
                className="size-11 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                aria-label="Remover foto"
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-line bg-background text-muted-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={submit}
            className="ml-auto min-h-11 rounded-xl bg-accent/12 px-4 font-mono text-[10px] tracking-wider text-accent uppercase ring-1 ring-accent/25"
          >
            Registrar
          </button>
        </div>
      </div>

      {rec.occurrences.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rec.occurrences.map((o) => (
            <li
              key={o.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-line bg-background/40 px-3 py-2.5",
                o.resolved && "opacity-60",
              )}
            >
              {o.photo && (
                <img src={o.photo} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px]", o.resolved && "line-through")}>{o.text}</p>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  {codeOf(o.instanceId)} · {formatDateTime(o.at)}
                  {o.by ? ` · ${o.by}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleOccurrence(project.id, o.id)}
                aria-label="Resolver ocorrência"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg border",
                  o.resolved ? "border-accent/40 text-accent" : "border-line text-muted-foreground",
                )}
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => removeOccurrence(project.id, o.id)}
                aria-label="Remover ocorrência"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
