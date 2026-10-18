import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cncCounts, cncCutLength, layerMapping } from "@/lib/dxf/cncExport";
import {
  DXF_PROFILE_LASER,
  downloadDXF,
  exportDXF,
  type DxfExportRequest,
} from "@/lib/dxf/exportService";
import { verify, type Entity, type Layer } from "@/lib/lab2d/core";
import { downloadSvg, renderSvg } from "@/lib/lab2d/render";
import { DXF_PROFILES, ROLE_LABEL, USER_ROLES } from "@/lib/lab2d/roles";
import { previewDxfSvg } from "@/lib/dxf/previewRenderer";
import { downloadSheetPdf, downloadSheetPng, renderSheet } from "@/lib/export/renderSheet";
import { cn } from "@/lib/utils";
import type { CncRole } from "@/lib/dxf/cncExport";

type Format = "dxf" | "svg" | "png" | "pdf";
type Scope = "selection" | "plan" | "project";

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "dxf", label: "DXF", hint: "Corte CNC" },
  { id: "svg", label: "SVG", hint: "Vetor" },
  { id: "png", label: "PNG", hint: "Imagem" },
  { id: "pdf", label: "PDF", hint: "Prancha" },
];

/** Conteúdo exportável — as quatro funções que o usuário desenha. */
const CONTENT: { role: CncRole; label: string }[] = USER_ROLES.map((role) => ({
  role,
  label: ROLE_LABEL[role],
}));

export function ExportDialog({
  open,
  onOpenChange,
  layers,
  scopes,
  projectName,
  planName,
  material,
  thickness,
  quantity,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  layers: Layer[];
  scopes: Record<Scope, Entity[]>;
  projectName: string;
  planName: string;
  material?: string;
  thickness?: number;
  quantity?: number;
}) {
  const [format, setFormat] = useState<Format>("dxf");
  const [scope, setScope] = useState<Scope>("plan");
  const [dimensions, setDimensions] = useState(false);
  // curvas saem como SPLINE por padrão; achatar só para máquinas antigas
  const [flattenCurves, setFlattenCurves] = useState(false);
  const [profile, setProfile] = useState(DXF_PROFILE_LASER);
  const [roles, setRoles] = useState<Partial<Record<CncRole, boolean>>>({});
  const [leads, setLeads] = useState(true);

  const entities = scopes[scope];

  const preview = useMemo(
    () =>
      renderSvg(entities, layers, {
        dimensions,
        background: "white",
      }),
    [entities, layers, dimensions],
  );

  const issues = useMemo(() => verify(entities), [entities]);
  const filename = `${projectName}-${planName}`.replace(/\s+/g, "-").toLowerCase();

  /** Pedido único de exportação DXF — mesmo objeto usado na prévia e no download. */
  const request = useMemo<DxfExportRequest>(
    () => ({
      geometry: entities,
      profile,
      roles,
      leads,
      flattenCurves,
      metadata: {
        project: projectName,
        plan: planName,
        ...(material ? { material } : {}),
        ...(thickness ? { thickness } : {}),
        ...(quantity ? { quantity } : {}),
      },
    }),
    [
      entities,
      profile,
      roles,
      leads,
      flattenCurves,
      projectName,
      planName,
      material,
      thickness,
      quantity,
    ],
  );

  const dxf = useMemo(
    () => (format === "dxf" && entities.length ? exportDXF(request) : null),
    [format, entities, request],
  );

  /** A prévia do DXF vem do próprio arquivo gerado; os demais formatos, da folha. */
  const dxfPreview = useMemo(() => (dxf ? previewDxfSvg(dxf.doc) : null), [dxf]);
  const shown = dxfPreview ?? preview;
  const counts = useMemo(() => cncCounts(entities), [entities]);
  const mapping = useMemo(() => (dxf ? layerMapping(dxf.options) : []), [dxf]);
  const activeRoles = dxf?.options.roles;

  const run = async () => {
    if (!entities.length) {
      toast.error("Nada para exportar neste escopo.");
      return;
    }
    try {
      if (format === "dxf") {
        if (!dxf) return;
        if (dxf.errors.length) {
          toast.error("Erro de fabricação — corrija antes de exportar o DXF.");
          return;
        }
        const result = downloadDXF(request, filename);
        if (!result.verification.ok)
          toast.warning("DXF gerado com divergências — veja a conferência.");
      } else if (format === "svg") {
        downloadSvg(preview.svg, filename);
      } else {
        // PDF e PNG partem da MESMA pipeline de folha, redesenhada a partir do
        // modelo: zoom/pan da tela não influenciam o arquivo.
        const started = Date.now();
        const notify = window.setTimeout(
          () => toast.loading("Gerando folha…", { id: "sheet-export" }),
          1000,
        );
        await new Promise((r) => setTimeout(r, 0)); // libera a interface
        const plan = renderSheet(
          entities,
          layers,
          { project: projectName, plan: planName },
          { dimensions },
        );
        await new Promise((r) => setTimeout(r, 0));
        if (format === "png") await downloadSheetPng(plan);
        else await downloadSheetPdf(plan);
        window.clearTimeout(notify);
        if (Date.now() - started > 1000) toast.dismiss("sheet-export");
      }
      toast.success(`${format.toUpperCase()} gerado.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na exportação.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70dvh] w-[min(90vw,32rem)] max-w-none flex-col overflow-y-auto border border-border bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {format === "dxf" ? "Exportar DXF" : "Exportar"}
          </DialogTitle>
        </DialogHeader>

        <div
          className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-border bg-white p-2 [&_svg]:size-full"
          // prévia real do arquivo gerado
          dangerouslySetInnerHTML={{ __html: shown.svg }}
        />

        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "rounded-xl border border-border px-3 py-2 text-left transition-all active:scale-95",
                format === f.id && "border-accent/50 bg-accent/10 text-accent",
              )}
            >
              <span className="block font-mono text-[11px] tracking-widest">{f.label}</span>
              <span className="block text-[10px] text-muted-foreground">{f.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase">
          {(["selection", "plan", "project"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              disabled={!scopes[s].length}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 disabled:opacity-30",
                scope === s && "border-accent/50 text-accent",
              )}
            >
              {s === "selection" ? "Seleção" : s === "plan" ? "Plano" : "Projeto"}
            </button>
          ))}
          {format !== "dxf" && (
            <button
              onClick={() => setDimensions((d) => !d)}
              className={cn(
                "rounded-full border border-border px-2.5 py-1",
                dimensions && "border-warn/60 text-warn",
              )}
            >
              Cotas
            </button>
          )}
        </div>

        {format === "dxf" && (
          <div className="space-y-3">
            {/* peça / projeto */}
            <div className="rounded-xl border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
              <p className="text-foreground">
                {projectName} · {planName}
              </p>
              <p>
                {material ? `Material ${material} · ` : ""}
                {thickness ? `Espessura ${thickness} mm · ` : ""}
                {quantity ? `Quantidade ${quantity} · ` : ""}
                {cncCutLength(entities).toFixed(1)} mm de corte
              </p>
            </div>

            {/* geometria por função de fabricação */}
            <div className="space-y-1">
              {USER_ROLES.map((r) => {
                const on = activeRoles?.[r as CncRole] ?? false;
                const layer = mapping.find((m) => m.role === r)?.layer;
                return (
                  <div
                    key={r}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-border px-3 py-1.5",
                      on ? "border-accent/40" : "opacity-60",
                    )}
                  >
                    <span className="font-mono text-[11px] tracking-widest">
                      {ROLE_LABEL[r].toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {counts[r as CncRole]}
                      {r === "CUT" &&
                        ` · ${counts.contours} contornos · ${counts.outer} externo · ${counts.holes} furos`}
                    </span>
                    <span className="ml-auto font-mono text-[9px] uppercase">
                      {on && layer ? (
                        <span className="text-accent">→ {layer}</span>
                      ) : (
                        <span className="text-muted-foreground">não exportado</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* conteúdo */}
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px] tracking-wider uppercase">
              {CONTENT.map((c) => {
                const on = activeRoles?.[c.role] ?? false;
                return (
                  <button
                    key={c.role}
                    onClick={() => setRoles((r) => ({ ...r, [c.role]: !on }))}
                    className={cn(
                      "rounded-full border border-border px-2.5 py-1",
                      on && "border-accent/50 text-accent",
                    )}
                  >
                    {on ? "☑" : "☐"} {c.label}
                  </button>
                );
              })}
              <button
                onClick={() => setLeads((v) => !v)}
                className={cn(
                  "rounded-full border border-border px-2.5 py-1",
                  leads && "border-accent/50 text-accent",
                )}
              >
                {leads ? "☑" : "☐"} Entrada/Saída
              </button>
              {entities.some((e) => e.type === "path") && (
                <button
                  onClick={() => setFlattenCurves((v) => !v)}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1",
                    flattenCurves && "border-warn/60 text-warn",
                  )}
                >
                  {flattenCurves ? "Curvas achatadas" : "Curvas como SPLINE"}
                </button>
              )}
            </div>

            {/* perfil — duas configurações do MESMO exportador */}
            <div className="flex flex-wrap gap-1.5">
              {DXF_PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProfile(p.id);
                    setRoles({});
                  }}
                  className={cn(
                    "rounded-xl border border-border px-3 py-2 text-left transition-colors",
                    profile === p.id && "border-accent/50 bg-accent/10 text-accent",
                  )}
                >
                  <span className="block font-mono text-[10px] tracking-widest">{p.name}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {DXF_PROFILES.find((p) => p.id === profile)?.description}
            </p>

            {/* preflight */}
            {dxf && (
              <div className="rounded-xl border border-border px-3 py-2">
                <p className="font-mono text-[10px] tracking-widest uppercase">
                  DXF CNC READY {dxf.preflight.every((r) => r.ok) ? "✓" : "—"}
                </p>
                <div className="mt-1 grid grid-cols-1 gap-0.5 font-mono text-[10px] sm:grid-cols-2">
                  {dxf.preflight.map((row, idx) => (
                    <p key={`${row.label}-${idx}`} className={row.ok ? "text-muted-foreground" : "text-warn"}>
                      {row.ok ? "✓" : "✕"} {row.label}: {row.value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {dxf && dxf.errors.length > 0 && (
              <p className="rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-[11px] text-danger">
                {dxf.errors.map((i) => `${i.scope}: ${i.message}`).join(" · ")}
              </p>
            )}

            {/* o que o arquivo contém — linguagem direta de fabricação */}
            <div className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-mono text-[10px] tracking-widest text-foreground uppercase">
                O que este arquivo contém
              </p>
              <p className="mt-1">
                Escala 1:1 em milímetros · {dxfPreview?.widthMm.toFixed(1) ?? "—"} ×{" "}
                {dxfPreview?.heightMm.toFixed(1) ?? "—"} mm · {dxf?.doc.entities.length ?? 0}{" "}
                objetos em {dxf?.doc.layers.map((l) => l.name).join(", ") || "—"}.
              </p>
              <p className="mt-1">
                Cada camada é uma operação: CORTE corta, RECORTE corta por dentro, MARCAÇÃO risca e
                DOBRA indica a linha de dobra. Nada é convertido em outra operação e a ordem do
                plano de corte é preservada.
              </p>
            </div>
          </div>
        )}

        {format !== "dxf" && (
          <p className="font-mono text-[10px] text-muted-foreground">
            {projectName} · {planName} · {preview.count} objetos · {preview.widthMm.toFixed(1)} ×{" "}
            {preview.heightMm.toFixed(1)} mm · escala 1:1
          </p>
        )}

        {issues.length > 0 && (
          <p className="rounded-xl border border-warn/40 bg-warn/5 px-3 py-2 text-[11px] text-warn">
            {issues.length} aviso(s):{" "}
            {Array.from(new Set(issues.map((i) => i.message))).join(" · ")}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={run}
            className="brand-gradient flex-1 rounded-xl py-2.5 font-display text-sm font-semibold text-background transition-transform active:scale-[0.98]"
          >
            {format === "dxf" ? "Exportar DXF" : "Exportar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
