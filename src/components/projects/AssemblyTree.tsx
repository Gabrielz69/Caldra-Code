/**
 * ESTRUTURA DO PROJETO — conjuntos e subconjuntos.
 *
 * Apresenta a árvore CONJUNTO → SUBCONJUNTO → PEÇA sobre a mesma entidade
 * já armazenada no projeto (fonte única de verdade). Nada é duplicado aqui:
 * as peças continuam vivendo em `project.parts`.
 */

import { useState } from "react";
import { ChevronRight, Layers, Plus, Trash2 } from "lucide-react";
import {
  addAssembly,
  addSubassembly,
  removeAssembly,
  removeSubassembly,
  type Project,
  type ProjectPart,
} from "@/lib/projects/store";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { cn } from "@/lib/utils";

export function AssemblyTree({
  project,
  onOpenPart,
}: {
  project: Project;
  onOpenPart: (part: ProjectPart) => void;
}) {
  const [newAssembly, setNewAssembly] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const loose = project.parts.filter((p) => !p.assemblyId);

  const create = () => {
    const name = newAssembly.trim();
    if (!name) return;
    addAssembly(project.id, name);
    setNewAssembly("");
  };

  return (
    <Panel className="p-4">
      <SectionLabel>Estrutura</SectionLabel>

      <div className="mb-3 flex gap-2">
        <input
          value={newAssembly}
          onChange={(e) => setNewAssembly(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Novo conjunto (Estrutura, Degraus, Guarda-corpo…)"
          aria-label="Nome do novo conjunto"
          className="min-w-0 flex-1 rounded-lg border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        />
        <button
          onClick={create}
          className="flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-2 font-mono text-[10px] tracking-wider text-accent uppercase ring-1 ring-accent/25"
        >
          <Plus className="size-3.5" /> Conjunto
        </button>
      </div>

      {project.assemblies.length === 0 && loose.length === 0 && (
        <p className="t-caption">
          Crie conjuntos para organizar o serviço. Peças avulsas continuam funcionando sem conjunto.
        </p>
      )}

      <ul className="space-y-1.5">
        {[...project.assemblies]
          .sort((a, b) => a.order - b.order)
          .map((asm) => {
            const subs = project.subassemblies
              .filter((s) => s.assemblyId === asm.id)
              .sort((a, b) => a.order - b.order);
            const parts = project.parts.filter((p) => p.assemblyId === asm.id);
            const expanded = open[asm.id] ?? true;
            return (
              <li key={asm.id} className="rounded-xl border border-line">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [asm.id]: !expanded }))}
                    aria-label={expanded ? `Recolher ${asm.name}` : `Expandir ${asm.name}`}
                    className="grid size-6 place-items-center text-muted-foreground"
                  >
                    <ChevronRight
                      className={cn("size-4 transition-transform", expanded && "rotate-90")}
                    />
                  </button>
                  <Layers className="size-3.5 text-accent" />
                  <span className="text-[13px] font-medium">{asm.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {project.code}-{asm.code} · {parts.length} peça(s)
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => {
                        const name = window.prompt("Nome do subconjunto");
                        if (name) addSubassembly(project.id, asm.id, name);
                      }}
                      className="rounded-lg px-2 py-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase hover:text-accent"
                    >
                      + Sub
                    </button>
                    <button
                      onClick={() => removeAssembly(project.id, asm.id)}
                      aria-label={`Remover conjunto ${asm.name}`}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-1 border-t border-line px-3 py-2">
                    {subs.map((sub) => (
                      <div key={sub.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-muted-foreground">{sub.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            {sub.code}
                          </span>
                          <button
                            onClick={() => removeSubassembly(project.id, sub.id)}
                            aria-label={`Remover subconjunto ${sub.name}`}
                            className="ml-auto grid size-6 place-items-center text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                        <PartLines
                          parts={parts.filter((p) => p.subassemblyId === sub.id)}
                          onOpenPart={onOpenPart}
                        />
                      </div>
                    ))}
                    <PartLines
                      parts={parts.filter((p) => !p.subassemblyId)}
                      onOpenPart={onOpenPart}
                      empty="Nenhuma peça neste conjunto."
                    />
                  </div>
                )}
              </li>
            );
          })}

        {loose.length > 0 && (
          <li className="rounded-xl border border-dashed border-border px-3 py-2">
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Sem conjunto
            </p>
            <PartLines parts={loose} onOpenPart={onOpenPart} />
          </li>
        )}
      </ul>
    </Panel>
  );
}

function PartLines({
  parts,
  onOpenPart,
  empty,
}: {
  parts: ProjectPart[];
  onOpenPart: (part: ProjectPart) => void;
  empty?: string;
}) {
  if (!parts.length) return empty ? <p className="t-caption">{empty}</p> : null;
  return (
    <ul className="mt-1 space-y-0.5">
      {parts.map((p) => (
        <li key={p.instanceId}>
          <button
            onClick={() => onOpenPart(p)}
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] hover:bg-foreground/5"
          >
            <span className="font-mono text-[10px] text-accent">{p.code}</span>
            <span className="truncate">{p.name}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              REV {p.revision} · {p.quantity}×
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
