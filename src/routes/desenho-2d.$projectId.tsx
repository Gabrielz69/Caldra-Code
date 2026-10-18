import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/chameleon/ui";
import { Lab2DEditor } from "@/components/lab2d/Lab2DEditor";

export const Route = createFileRoute("/desenho-2d/$projectId")({
  head: () => ({
    meta: [
      { title: "CHAMFER — CALDRA" },
      {
        name: "description",
        content:
          "Prancheta vetorial em milímetros: snap geométrico, planos, cotas de conferência e exportação DXF/SVG/PNG/PDF.",
      },
      { property: "og:title", content: "CHAMFER — CALDRA" },
      {
        property: "og:description",
        content: "Estação CAD de bolso para caldeiraria e corte CNC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lab2DPage,
});

function Lab2DPage() {
  const { projectId } = Route.useParams();
  return (
    <FeatureGate
      feature="lab2d"
      title="CHAMFER"
      description="A prancheta vetorial faz parte do Modo Mestre."
    >
      <Lab2DEditor projectId={projectId} />
    </FeatureGate>
  );
}
