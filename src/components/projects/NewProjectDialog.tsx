import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROJECT_TYPE_LABEL, type ProjectType, type NewProjectInput } from "@/lib/projects/store";

const TYPES = Object.keys(PROJECT_TYPE_LABEL) as ProjectType[];

const field =
  "w-full rounded-lg border border-line bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent/50";

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (input: NewProjectInput) => void;
}) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType>("cliente");
  const [owner, setOwner] = useState("");
  const [place, setPlace] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setClient("");
    setDescription("");
    setType("cliente");
    setOwner("");
    setPlace("");
    setDeadline("");
    setNotes("");
    setMore(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] w-[min(90vw,520px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Novo projeto</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate({ name, client, description, type, owner, place, deadline, notes });
          }}
        >
          <label className="block space-y-1">
            <span className="t-eyebrow">Nome do projeto</span>
            <input
              autoFocus
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chaminé Industrial"
            />
          </label>
          <label className="block space-y-1">
            <span className="t-eyebrow">Cliente</span>
            <input
              className={field}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="João da Silva"
            />
          </label>
          <label className="block space-y-1">
            <span className="t-eyebrow">Descrição</span>
            <textarea
              className={`${field} min-h-16 resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fabricação e instalação de chaminé industrial."
            />
          </label>

          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="t-caption text-accent underline"
          >
            {more ? "Ocultar campos opcionais" : "Campos opcionais"}
          </button>

          {more && (
            <div className="space-y-3 border-t border-line pt-3">
              <label className="block space-y-1">
                <span className="t-eyebrow">Tipo</span>
                <select
                  className={field}
                  value={type}
                  onChange={(e) => setType(e.target.value as ProjectType)}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROJECT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="t-eyebrow">Responsável</span>
                  <input
                    className={field}
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="t-eyebrow">Local</span>
                  <input
                    className={field}
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="t-eyebrow">Prazo</span>
                <input
                  type="date"
                  className={field}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="t-eyebrow">Observações</span>
                <textarea
                  className={`${field} min-h-16 resize-y`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-xl bg-accent/15 px-4 py-2 text-sm font-semibold text-accent ring-1 ring-accent/30 disabled:opacity-40"
            >
              Criar projeto
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
