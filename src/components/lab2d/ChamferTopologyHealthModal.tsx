/**
 * CALDRA CHAMFER — MODAL DE DIAGNÓSTICO TOPOLÓGICO E AUTO-HEAL (ETAPA 11 & 36)
 *
 * Painel completo de integridade técnica do desenho:
 *  - Indicadores: Geometria OK, Contornos OK, Fabricação CNC OK
 *  - Listagem detalhada de anomalias com coordenadas reais
 *  - Ação com 1 clique de "Auto-Heal" para fechar frestas e eliminar redundâncias
 */

import React, { useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Sparkles,
  CheckCircle2,
  Activity,
  Layers,
  Wrench,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/lib/lab2d/core";
import {
  analyzeTopology,
  autoHealEntities,
  type DiagnosticReport,
} from "@/lib/lab2d/cadTopologyDiagnostics";
import { triggerHaptic } from "@/lib/ui/haptics";
import { AudioManager } from "@/lib/audio/AudioManager";

interface ChamferTopologyHealthModalProps {
  open: boolean;
  onClose: () => void;
  entities: Entity[];
  onApplyHeal: (healed: Entity[]) => void;
}

export function ChamferTopologyHealthModal({
  open,
  onClose,
  entities,
  onApplyHeal,
}: ChamferTopologyHealthModalProps) {
  const report: DiagnosticReport = useMemo(() => {
    if (!open) {
      return {
        isHealthy: true,
        score: 100,
        totalEntities: 0,
        openContourCount: 0,
        gapCount: 0,
        duplicateCount: 0,
        zeroLengthCount: 0,
        issues: [],
      };
    }
    return analyzeTopology(entities);
  }, [open, entities]);

  const handleHeal = () => {
    triggerHaptic("success");
    AudioManager.play("cad_core_init");
    const { healedEntities, fixedIssuesCount } = autoHealEntities(entities);
    onApplyHeal(healedEntities);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card/95 border-border/80 backdrop-blur-xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-accent">
            <Activity className="w-5 h-5 animate-pulse" />
            <DialogTitle className="text-base font-bold tracking-tight">
              Diagnóstico de Saúde Geométrica (CAD Topology)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Auditoria matemática de contornos para corte limpo e conformidade de fabricação.
          </DialogDescription>
        </DialogHeader>

        {/* Score & Status Card */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Índice de Integridade
            </div>
            <div className="text-2xl font-mono font-bold mt-0.5 flex items-center gap-2">
              <span
                className={
                  report.score >= 90
                    ? "text-emerald-500"
                    : report.score >= 60
                    ? "text-amber-500"
                    : "text-rose-500"
                }
              >
                {report.score} / 100
              </span>
              <span className="text-xs font-sans font-normal px-2 py-0.5 rounded-full bg-muted border border-border">
                {report.totalEntities} entidades
              </span>
            </div>
          </div>

          <div className="text-right space-y-1 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 justify-end">
              <span>Geometria:</span>
              <span className={report.zeroLengthCount === 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                {report.zeroLengthCount === 0 ? "OK" : `${report.zeroLengthCount} Erros`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <span>Frestas (Gaps):</span>
              <span className={report.gapCount === 0 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                {report.gapCount === 0 ? "OK" : `${report.gapCount} Frestas`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <span>Duplicatas:</span>
              <span className={report.duplicateCount === 0 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                {report.duplicateCount === 0 ? "0" : report.duplicateCount}
              </span>
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {report.issues.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-500 font-medium flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-500/80" />
              <span>Nenhuma anomalia detectada. O desenho está perfeito para corte e fabricação!</span>
            </div>
          ) : (
            report.issues.map((iss) => (
              <div
                key={iss.id}
                className="p-2.5 rounded-lg border border-border/40 bg-card/60 flex items-start gap-2.5"
              >
                {iss.severity === "error" ? (
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {iss.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      X:{iss.location.x.toFixed(1)} Y:{iss.location.y.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {iss.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fechar
          </Button>
          {report.issues.length > 0 && (
            <Button
              size="sm"
              onClick={handleHeal}
              className="brand-gradient text-background font-semibold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reparar Automaticamente (Auto-Heal)</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
