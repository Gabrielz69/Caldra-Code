import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Bug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button, InlineError } from "@/components/caldra/ds";
import { APP_VERSION, APP_BUILD, SUPPORT_EMAIL } from "@/lib/app/version";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";

/** Coleta descrição + diagnóstico local e abre e-mail ou copia o relatório. Nenhum dado sai sem ação do usuário. */
export function ReportProblemDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { plan } = useFeatureAccess();
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  const diagnostic = [
    `Versão: ${APP_VERSION} (${APP_BUILD})`,
    `Tela: ${typeof window !== "undefined" ? window.location.pathname : "-"}`,
    `Plano: ${plan}`,
    `Navegador: ${typeof navigator !== "undefined" ? navigator.userAgent : "-"}`,
    `Online: ${typeof navigator !== "undefined" ? navigator.onLine : "-"}`,
  ].join("\n");

  const report = `RELATÓRIO DE PROBLEMA — CALDRA\n\n${text.trim()}\n\n— Diagnóstico —\n${diagnostic}`;
  const valid = text.trim().length >= 10;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Relatório copiado. Cole no seu e-mail ou mensagem.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const sendMail = () => {
    const subject = encodeURIComponent(`Problema no CALDRA ${APP_VERSION}`);
    const body = encodeURIComponent(report);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70dvh] w-[min(90vw,480px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="size-4 text-primary" /> Reportar um problema
          </DialogTitle>
          <DialogDescription>
            Descreva o que aconteceu. O diagnóstico técnico é anexado automaticamente — nada é
            enviado sem você escolher copiar ou enviar por e-mail.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={5}
          placeholder="Ex.: ao exportar o DXF da transição, o arquivo abriu vazio…"
          className="w-full resize-y rounded-xl border border-border bg-background/60 p-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          aria-label="Descrição do problema"
        />
        {touched && !valid && (
          <InlineError>Descreva o problema em pelo menos 10 caracteres.</InlineError>
        )}

        <details className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3">
          <summary className="cursor-pointer font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Diagnóstico anexado
          </summary>
          <pre className="mt-2 font-mono text-[10px] break-all whitespace-pre-wrap text-muted-foreground">
            {diagnostic}
          </pre>
        </details>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="secondary" icon={Copy} disabled={!valid} onClick={copy}>
            Copiar
          </Button>
          <Button variant="primary" icon={Mail} disabled={!valid} onClick={sendMail}>
            Enviar por e-mail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
