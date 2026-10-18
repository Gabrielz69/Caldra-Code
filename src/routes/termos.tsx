import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — CALDRA" },
      {
        name: "description",
        content:
          "Termos de uso do CALDRA: assinatura, cancelamento, responsabilidade sobre os cálculos de traçagem e conferência antes do corte.",
      },
      { property: "og:title", content: "Termos de Uso — CALDRA" },
      {
        property: "og:description",
        content: "Assinatura, cancelamento e responsabilidade técnica.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Termos,
});

const BLOCKS: { title: string; body: string[] }[] = [
  {
    title: "O serviço",
    body: [
      "O CALDRA é uma ferramenta de traçagem, planificação e desenho 2D para caldeiraria. O plano Free dá acesso às peças e cálculos básicos; o plano PRO libera peças avançadas, cálculo passo a passo, CHAMFER, exportação DXF e PDF e projetos ilimitados.",
    ],
  },
  {
    title: "Assinatura e cancelamento",
    body: [
      "Assinaturas contratadas pelo Google Play são renovadas e canceladas na própria conta Google. O cancelamento mantém o acesso PRO até o fim do período já pago.",
      "Códigos de ativação são de uso único e ficam vinculados à conta que os resgatou.",
    ],
  },
  {
    title: "Responsabilidade técnica",
    body: [
      "Os resultados são calculados a partir das medidas informadas por você. Confira sempre o traçado na chapa antes de cortar: espessura, fresta de corte, folgas de solda e tolerâncias de máquina são responsabilidade do profissional.",
      "O CALDRA não responde por perdas de material decorrentes de dados incorretos ou de falta de conferência.",
    ],
  },
  {
    title: "Uso aceitável",
    body: [
      "É proibido revender, redistribuir ou tentar burlar a verificação de plano do aplicativo. Contas envolvidas em fraude de código ou compra podem ser encerradas.",
    ],
  },
  { title: "Contato", body: ["suporte@caldra.app."] },
];

function Termos() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Termos de Uso</h1>
      </header>
      {BLOCKS.map((block) => (
        <Panel key={block.title} className="space-y-2 p-4">
          <SectionLabel>{block.title}</SectionLabel>
          {block.body.map((p) => (
            <p key={p} className="text-[13px] leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </Panel>
      ))}
    </div>
  );
}
