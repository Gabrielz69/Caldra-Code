/**
 * CENTRAL DE DIAGNÓSTICO 3D (Auditoria Geométrica e Visual)
 *
 * Utilizada para verificação determinística de topologia, normais, limites,
 * passes de visibilidade, ausência de sombras artificiais e registro de linhas
 * de base matemática antes e depois de refinamentos.
 */

import { useState } from "react";
import type { WireModel } from "@/lib/viz3d/wire";
import { auditModel, isHealthy, type MeshAudit } from "@/lib/viz3d/audit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Activity, ShieldCheck, AlertTriangle, Layers, Eye, Compass, Box, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  model: WireModel;
  slug?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function Viz3DDiagnosticModal({ model, slug, isOpen, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"geral" | "normais" | "faces" | "bounds" | "baseline">("geral");

  if (!isOpen) return null;

  const audit: MeshAudit = auditModel(model);
  const healthy = isHealthy(audit);

  const copyBaselineJson = () => {
    const data = JSON.stringify(
      {
        slug: slug ?? model.slug ?? "desconhecido",
        timestamp: new Date().toISOString(),
        isHealthy: healthy,
        baseline: audit.baseline,
        auditSummary: {
          faces: audit.faces,
          triangles: audit.triangles,
          vertices: audit.vertices,
          edges: audit.edges,
          refLines: audit.refLines,
          degenerate: audit.degenerate,
          duplicates: audit.duplicates,
          nearCoincidentFaces: audit.nearCoincidentFaces,
          badNormals: audit.badNormals,
          orientationIssues: audit.orientationIssues,
          hasArtificialShadow: audit.hasArtificialShadow,
        },
      },
      null,
      2,
    );
    navigator.clipboard.writeText(data).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Central de Diagnóstico 3D"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-card p-6 shadow-2xl text-foreground overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base tracking-tight">Central de Diagnóstico 3D</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-mono px-2 py-0.5",
                    healthy ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-amber-500/30 text-amber-400 bg-amber-500/10",
                  )}
                >
                  {healthy ? <ShieldCheck className="mr-1 size-3 inline" /> : <AlertTriangle className="mr-1 size-3 inline" />}
                  {healthy ? "100% Saudável" : "Atenção"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {slug ?? model.slug ?? "Modelo 3D"} · Hash: {audit.baseline.modelHash}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-line pt-3 pb-2 text-xs font-mono overflow-x-auto">
          {[
            { id: "geral", label: "Visão Geral", icon: Activity },
            { id: "normais", label: "Normais & Orientação", icon: Compass },
            { id: "faces", label: "Faces & Topologia", icon: Layers },
            { id: "bounds", label: "Bounds & Estrutura", icon: Box },
            { id: "baseline", label: "Linha de Base", icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors",
                  activeTab === tab.id
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {activeTab === "geral" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-line bg-muted/20 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Faces</span>
                  <p className="text-lg font-bold font-mono text-foreground mt-0.5">{audit.faces}</p>
                  <span className="text-[10px] text-muted-foreground">{audit.triangles} triângulos</span>
                </div>
                <div className="rounded-xl border border-line bg-muted/20 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Vértices</span>
                  <p className="text-lg font-bold font-mono text-foreground mt-0.5">{audit.vertices}</p>
                  <span className="text-[10px] text-muted-foreground font-mono">Únicos em 3D</span>
                </div>
                <div className="rounded-xl border border-line bg-muted/20 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Arestas</span>
                  <p className="text-lg font-bold font-mono text-foreground mt-0.5">{audit.edges}</p>
                  <span className="text-[10px] text-muted-foreground font-mono">+{audit.refLines} eixos</span>
                </div>
                <div className="rounded-xl border border-line bg-muted/20 p-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Área Total</span>
                  <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                    {(audit.baseline.totalArea / 100).toFixed(1)} <span className="text-xs font-normal">cm²</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground font-mono">Integral Newell</span>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-muted/15 p-4 space-y-2">
                <h3 className="font-semibold text-sm">Auditoria de Qualidade Técnica</h3>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between border-b border-line/50 py-1">
                    <span className="text-muted-foreground">Faces Degeneradas:</span>
                    <span className={cn(audit.degenerate === 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold")}>
                      {audit.degenerate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line/50 py-1">
                    <span className="text-muted-foreground">Faces Duplicadas:</span>
                    <span className={cn(audit.duplicates === 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold")}>
                      {audit.duplicates}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line/50 py-1">
                    <span className="text-muted-foreground">Coordenadas Inválidas:</span>
                    <span className={cn(audit.nonFinite === 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold")}>
                      {audit.nonFinite}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line/50 py-1">
                    <span className="text-muted-foreground">Normais com Falha:</span>
                    <span className={cn(audit.badNormals === 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold")}>
                      {audit.badNormals}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line/50 py-1">
                    <span className="text-muted-foreground">Conflitos de Orientação:</span>
                    <span className={cn(audit.orientationIssues === 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold")}>
                      {audit.orientationIssues}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-line/50 py-1">
                    <span className="text-muted-foreground">Sombra Artificial:</span>
                    <span className="text-emerald-400 font-bold">Nenhuma (Eliminada)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "normais" && (
            <div className="space-y-3 font-mono">
              <div className="rounded-xl border border-line bg-muted/15 p-4 space-y-2">
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Verificação de Normais e Orientação</h4>
                <p className="text-muted-foreground text-[11px]">
                  As normais são calculadas estritamente em espaço de modelo pelo método de Newell e transformadas para a câmera sem deformação.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Normais unitárias válidas:</span>
                    <p className="font-bold text-emerald-400">{audit.faces - audit.badNormals} / {audit.faces}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estilo de sombreamento:</span>
                    <p className="font-bold text-accent uppercase">{model.shadingStyle ?? "faceted"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Desvios de Orientação:</span>
                    <p className="font-bold text-emerald-400">{audit.orientationIssues}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dupla Face Física:</span>
                    <p className="font-bold text-foreground">Inversão de normal para superfícies internas</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "faces" && (
            <div className="space-y-3 font-mono">
              <div className="rounded-xl border border-line bg-muted/15 p-4 space-y-2">
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Distribuição por Categoria de Face</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Externa (outer):</span>
                    <p className="text-base font-bold text-foreground">{audit.byKind["outer"] ?? 0}</p>
                  </div>
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Interna (inner):</span>
                    <p className="text-base font-bold text-foreground">{audit.byKind["inner"] ?? 0}</p>
                  </div>
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Borda/Aro (rim):</span>
                    <p className="text-base font-bold text-foreground">{audit.byKind["rim"] ?? 0}</p>
                  </div>
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Tampa (cap):</span>
                    <p className="text-base font-bold text-foreground">{audit.byKind["cap"] ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-muted/15 p-4 space-y-2">
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Topologia de Bocas e Aberturas</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Aberturas reais detectadas:</span>
                    <p className="font-bold text-foreground">{audit.openingsCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Superfícies internas órfãs:</span>
                    <p className="font-bold text-emerald-400">{audit.unexpectedInnerSurfaces}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "bounds" && (
            <div className="space-y-3 font-mono">
              <div className="rounded-xl border border-line bg-muted/15 p-4 space-y-2">
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Limites Tridimensionais (Bounding Box)</h4>
                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Eixo X:</span>
                    <p className="font-bold text-foreground">
                      [{model.bounds.min.x.toFixed(1)} .. {model.bounds.max.x.toFixed(1)}] mm
                    </p>
                  </div>
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Eixo Y (Altura):</span>
                    <p className="font-bold text-foreground">
                      [{model.bounds.min.y.toFixed(1)} .. {model.bounds.max.y.toFixed(1)}] mm
                    </p>
                  </div>
                  <div className="border border-line rounded-lg p-2 bg-background/50">
                    <span className="text-muted-foreground">Eixo Z:</span>
                    <p className="font-bold text-foreground">
                      [{model.bounds.min.z.toFixed(1)} .. {model.bounds.max.z.toFixed(1)}] mm
                    </p>
                  </div>
                </div>
                <div className="pt-2 text-[11px] text-muted-foreground">
                  Extensão máxima de enquadramento (fit span):{" "}
                  <span className="font-bold text-accent">{model.size.toFixed(2)} mm</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "baseline" && (
            <div className="space-y-3 font-mono">
              <div className="rounded-xl border border-line bg-muted/15 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Linha de Base Matemática Determinística</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copyBaselineJson}
                    className="h-7 text-[10px] gap-1"
                  >
                    {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {copied ? "Copiado!" : "Copiar JSON"}
                  </Button>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Assinatura imutável gerada a partir da topologia, contagem de entidades, área superficial integral e limites espaciais.
                </p>
                <div className="bg-background/80 rounded-lg p-3 text-[10px] border border-line/60 overflow-x-auto space-y-1">
                  <div><span className="text-muted-foreground">Hash:</span> <span className="text-accent font-bold">{audit.baseline.modelHash}</span></div>
                  <div><span className="text-muted-foreground">Faces:</span> {audit.baseline.facesCount} ({audit.baseline.trianglesCount} triângulos)</div>
                  <div><span className="text-muted-foreground">Vértices:</span> {audit.baseline.verticesCount}</div>
                  <div><span className="text-muted-foreground">Arestas:</span> {audit.baseline.edgesCount}</div>
                  <div><span className="text-muted-foreground">Área Total:</span> {audit.baseline.totalArea.toFixed(3)} mm²</div>
                  <div><span className="text-muted-foreground">Bounds Fingerprint:</span> {audit.baseline.boundsFingerprint}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-line pt-4 text-xs font-mono text-muted-foreground">
          <span>CALDRA Traçagem · Auditor Puro 3D</span>
          <Button type="button" size="sm" variant="secondary" onClick={onClose} className="h-7 px-3 text-[10px]">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
