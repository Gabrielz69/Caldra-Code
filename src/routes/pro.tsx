import { createFileRoute } from "@tanstack/react-router";
import { PaywallPanel } from "@/components/chameleon/Paywall";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "CALDRA PRO — traçagem completa e exportação para a máquina" },
      {
        name: "description",
        content:
          "Compare Free e PRO: peças avançadas, cálculo passo a passo, CHAMFER, exportação DXF e PDF e projetos ilimitados.",
      },
      { property: "og:title", content: "CALDRA PRO" },
      {
        property: "og:description",
        content: "Da medida ao corte em 2 minutos. Assine o CALDRA PRO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

function ProPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">CALDRA PRO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O laboratório completo: da medida ao arquivo que a máquina corta.
        </p>
      </header>
      <PaywallPanel />
    </div>
  );
}
