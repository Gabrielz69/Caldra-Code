/**
 * ADICIONAR AO CHAMFER — envia PEÇAS FABRICÁVEIS reais (geometria vetorial em
 * mm), nunca imagens. Mantém o projeto como contexto: cada peça vira um plano
 * próprio do CHAMFER, vinculado ao dossiê.
 */

import { useNavigate } from "@tanstack/react-router";
import { PenTool } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openPartInChamfer } from "@/lib/projects/chamfer";
import { createCatalogProject, getProject } from "@/lib/projects/store";
import type { CanonicalProject } from "@/lib/project-catalog/types";

export function SendToChamferDialog({
  result,
  open,
  onOpenChange,
  existingProjectId,
}: {
  result: CanonicalProject;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingProjectId?: string;
}) {
  const nav = useNavigate();
  const fabricable = useMemo(() => result.parts.filter((p) => p.fabricable), [result]);
  const [sel, setSel] = useState<Set<string>>(() => new Set(fabricable.map((p) => p.key)));
  const [busy, setBusy] = useState(false);
  const all = sel.size === fabricable.length && fabricable.length > 0;

  const toggle = (key: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const send = () => {
    if (!sel.size) return;
    setBusy(true);
    try {
      const project = existingProjectId
        ? getProject(existingProjectId)
        : createCatalogProject(result);
      if (!project) throw new Error("projeto indisponível");
      let count = 0;
      let firstLabId: string | null = null;
      for (const part of project.parts) {
        const key = part.catalogPart?.key;
        if (!key || !sel.has(key) || !part.catalogPart?.fabricable) continue;
        const labId = openPartInChamfer(getProject(project.id) ?? project, part);
        if (!firstLabId) firstLabId = labId;
        count++;
      }
      toast.success(`${count} peça(s) preparada(s) no CHAMFER`);
      onOpenChange(false);
      if (firstLabId && count === 1) {
        nav({ to: "/desenho-2d/$projectId", params: { projectId: firstLabId } });
      } else {
        nav({ to: "/projetos/$projectId", params: { projectId: project.id } });
      }
    } catch {
      toast.error("Não foi possível preparar as peças");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] w-[min(90vw,560px)] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Adicionar ao CHAMFER</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {result.modelName} → conjuntos → subconjuntos → peças fabricáveis. Somente peças com
          geometria real de corte são enviadas; perfis e componentes não-CNC permanecem no dossiê.
        </p>
        <label className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-background/40 p-2 text-xs">
          <Checkbox
            checked={all}
            onCheckedChange={() => setSel(all ? new Set() : new Set(fabricable.map((p) => p.key)))}
          />
          TODAS AS PEÇAS FABRICÁVEIS
        </label>
        <div className="mt-2 flex-1 space-y-3 overflow-auto">
          {result.assemblies.map((asm) => {
            const parts = fabricable.filter((p) => p.assemblyKey === asm.key);
            if (!parts.length) return null;
            return (
              <div key={asm.key}>
                <p className="t-eyebrow">{asm.name}</p>
                <ul className="mt-1 space-y-1">
                  {parts.map((p) => (
                    <li key={p.key}>
                      <label className="flex items-center gap-2 rounded-lg border border-line bg-background/40 p-2 text-xs">
                        <Checkbox checked={sel.has(p.key)} onCheckedChange={() => toggle(p.key)} />
                        <span className="font-mono text-accent">{p.codeSuffix}</span>
                        <span className="flex-1">{p.name}</span>
                        <span className="font-mono text-muted-foreground">
                          {p.quantity} un · {p.dimensions.length.toFixed(0)}×
                          {p.dimensions.width.toFixed(0)} mm
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <Button className="mt-3" disabled={!sel.size || busy} onClick={send}>
          <PenTool /> Enviar {sel.size} peça(s) ao CHAMFER
        </Button>
      </DialogContent>
    </Dialog>
  );
}
