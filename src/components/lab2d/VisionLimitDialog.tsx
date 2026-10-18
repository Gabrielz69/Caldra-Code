/** Modal do limite diário do CHAMFER VISION (plano Free). */

import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FREE_DAILY_VECTORIZATIONS } from "@/lib/vision/visionQuota";

const MODES = [
  { name: "TÉCNICO", pitch: "Reconhece LINHA, ARCO e CÍRCULO — geometria CAD editável e cotável." },
  { name: "LOGO", pitch: "Preserva as curvas como Bézier/SPLINE e os furos como círculos reais." },
  { name: "TRAÇADO", pitch: "Extrai a linha central de desenhos e riscos, pronta para o corte." },
];

export function VisionLimitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[70dvh] w-[min(90vw,28rem)] max-w-none overflow-y-auto border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="size-4 text-pro" />
            Vetorizações de hoje esgotadas
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Suas {FREE_DAILY_VECTORIZATIONS} vetorizações de hoje acabaram. Volte amanhã ou libere o
          PRO — no PRO o VISION é ilimitado, todos os dias.
        </p>

        <ul className="space-y-2 rounded-xl border border-line p-3">
          {MODES.map((m) => (
            <li key={m.name} className="text-[13px]">
              <span className="font-mono text-[10px] tracking-[0.18em] text-pro uppercase">
                {m.name}
              </span>
              <span className="block text-muted-foreground">{m.pitch}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/pro"
          onClick={() => onOpenChange(false)}
          className="pro-gradient block rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
        >
          Conhecer o CALDRA PRO
        </Link>
      </DialogContent>
    </Dialog>
  );
}
