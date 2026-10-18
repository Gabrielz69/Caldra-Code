import { useState } from "react";
import { FileText, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { useMaterials } from "@/lib/materials/MaterialsProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { fabricationPackagePdf, partLabelsPdf } from "@/lib/projects/dossier";
import type { Project } from "@/lib/projects/store";

/** Pacote de fabricação (PDF completo) e etiquetas com QR de rastreio. */
export function FabricationPackage({ project }: { project: Project }) {
  const { materials } = useMaterials();
  const { regionConfig } = useSettings();
  const [busy, setBusy] = useState<"pacote" | "etiquetas" | null>(null);

  if (project.parts.length === 0) return null;

  const base = project.code ?? project.name;

  const run = async (kind: "pacote" | "etiquetas") => {
    setBusy(kind);
    try {
      const doc =
        kind === "pacote"
          ? await fabricationPackagePdf(project, materials, regionConfig)
          : await partLabelsPdf(project, materials);
      doc.save(`${base}-${kind === "pacote" ? "pacote-fabricacao" : "etiquetas"}.pdf`);
      toast.success(kind === "pacote" ? "Pacote gerado." : "Etiquetas geradas.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel className="p-4">
      <SectionLabel>Pacote de fabricação</SectionLabel>
      <p className="t-caption">
        Documento único para a oficina: capa, estrutura, lista de materiais, conferência e uma ficha
        por peça com QR de rastreio.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => run("pacote")}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl bg-accent/12 px-3 py-2 font-mono text-[10px] tracking-wider text-accent uppercase ring-1 ring-accent/25 disabled:opacity-50"
        >
          <FileText className="size-3.5" />
          {busy === "pacote" ? "Gerando..." : "Gerar pacote PDF"}
        </button>
        <button
          onClick={() => run("etiquetas")}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 font-mono text-[10px] tracking-wider uppercase disabled:opacity-50"
        >
          <QrCode className="size-3.5" />
          {busy === "etiquetas" ? "Gerando..." : "Etiquetas QR"}
        </button>
      </div>
    </Panel>
  );
}
