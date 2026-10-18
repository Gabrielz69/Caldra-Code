import { createFileRoute } from "@tanstack/react-router";
import { WorkshopDashboard } from "@/components/home/WorkshopDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CALDRA — Sua oficina digital, na palma da sua mão" },
      {
        name: "description",
        content:
          "Projete peças e estruturas. Gere desenhos técnicos, listas de corte, materiais e orçamentos. Especialização em Caldeiraria, Serralheria e Traçagem.",
      },
      { property: "og:title", content: "CALDRA — Sua oficina digital, na palma da sua mão" },
      {
        property: "og:description",
        content:
          "Projete peças e estruturas. Gere desenhos técnicos, listas de corte, materiais e orçamentos. Especialização em Caldeiraria, Serralheria e Traçagem.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  return <WorkshopDashboard />;
}
