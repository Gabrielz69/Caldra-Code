import { createFileRoute } from "@tanstack/react-router";
import { ScientificCalculator } from "@/components/calculator/ScientificCalculator";

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora Científica — CALDRA" },
      {
        name: "description",
        content:
          "Calculadora científica profissional do CALDRA com trigonometria, potências, raízes, histórico e conversões.",
      },
      { property: "og:title", content: "Calculadora Científica — CALDRA" },
      {
        property: "og:description",
        content: "Cálculos científicos rápidos, precisos e essenciais para a oficina.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScientificCalculator,
});
