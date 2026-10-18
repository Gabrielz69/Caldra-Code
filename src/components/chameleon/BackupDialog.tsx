import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, HardDriveDownload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button, Caption, InlineError } from "@/components/chameleon/ds";
import {
  applyBackup,
  downloadBackup,
  parseBackup,
  summarize,
  type BackupFile,
  type ImportMode,
} from "@/lib/backup/backup";
import { cn } from "@/lib/utils";

const dateLabel = (t: number) => new Date(t).toLocaleString();

/** Exporta e importa o arquivo .cal com tudo o que está guardado no aparelho. */
export function BackupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [mode, setMode] = useState<ImportMode>("mesclar");
  const [error, setError] = useState<string | null>(null);

  const exportar = async () => {
    setBusy(true);
    try {
      const s = await downloadBackup();
      toast.success(`Backup gerado: ${s.projects} projeto(s) e ${s.materials} material(is).`);
    } catch {
      toast.error("Não foi possível gerar o backup agora.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const res = parseBackup(await file.text());
    if (!res.ok) {
      setPending(null);
      setError(res.message);
      return;
    }
    setPending(res.backup);
  };

  const confirmar = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const s = await applyBackup(pending, mode);
      toast.success(`Backup aplicado: ${s.projects} projeto(s) e ${s.materials} material(is).`);
      setPending(null);
      onOpenChange(false);
      window.location.reload();
    } catch {
      toast.error("Não foi possível aplicar o backup.");
    } finally {
      setBusy(false);
    }
  };

  const info = pending ? summarize(pending) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70dvh] w-[min(90vw,480px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDriveDownload className="size-4 text-primary" /> Backup
          </DialogTitle>
          <DialogDescription>
            Guarde um arquivo com seus projetos, materiais, preferências e perfil — e traga tudo de
            volta quando quiser. Nada sai do aparelho sem a sua ação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={Download} loading={busy} onClick={exportar}>
              Salvar backup
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
              Escolher arquivo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".cal,application/json"
              className="hidden"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {error && <InlineError>{error}</InlineError>}

          {info && (
            <div className="space-y-3 rounded-2xl border border-border p-3">
              <Caption>
                Arquivo de {dateLabel(info.createdAt)} · versão {info.appVersion} · {info.projects}{" "}
                projeto(s), {info.materials} material(is)
                {info.settings && " · preferências"}
                {info.profile && " · perfil"}
              </Caption>

              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    [
                      "mesclar",
                      "Juntar",
                      "Mantém o que já existe; em conflito vence o mais recente.",
                    ],
                    [
                      "substituir",
                      "Substituir",
                      "Apaga os projetos atuais e usa só os do arquivo.",
                    ],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition-colors",
                      mode === id
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:bg-foreground/5",
                    )}
                  >
                    <span className="font-mono text-[11px] tracking-[0.16em] uppercase">
                      {label}
                    </span>
                    <span className="mt-1 block text-[12px] text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                  Cancelar
                </Button>
                <Button
                  variant={mode === "substituir" ? "danger" : "primary"}
                  size="sm"
                  loading={busy}
                  onClick={confirmar}
                >
                  {mode === "substituir" ? "Substituir tudo" : "Juntar ao que tenho"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
