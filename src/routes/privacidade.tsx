import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — CALDRA" },
      {
        name: "description",
        content:
          "Como o CALDRA trata seus dados: cálculos e projetos ficam no aparelho; conta e plano são opcionais e podem ser excluídos a qualquer momento.",
      },
      { property: "og:title", content: "Política de Privacidade — CALDRA" },
      {
        property: "og:description",
        content: "Dados no aparelho, conta opcional e exclusão total sob seu controle.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacidade,
});

const BLOCKS: { title: string; body: string[] }[] = [
  {
    title: "O que fica no seu aparelho",
    body: [
      "Projetos, desenhos do CHAMFER, materiais cadastrados, preferências de tema, unidade e precisão são gravados apenas no armazenamento local do aparelho (localStorage e IndexedDB).",
      "Esses dados não são enviados a nenhum servidor e desaparecem se você desinstalar o aplicativo ou limpar os dados do navegador.",
    ],
  },
  {
    title: "O que é enviado quando você cria uma conta",
    body: [
      "A conta é opcional. Ao criá-la, guardamos seu e-mail, um nome de exibição, o plano contratado e o registro das compras ou códigos de ativação usados.",
      "Esses dados existem para reconhecer seu plano em outro aparelho e atender às exigências de cobrança das lojas de aplicativos.",
    ],
  },
  {
    title: "Pagamentos",
    body: [
      "As assinaturas são processadas pelo Google Play ou pelo provedor de pagamento do site. O CALDRA não recebe nem armazena números de cartão.",
      "Guardamos apenas o identificador da compra necessário para validar e restaurar seu plano.",
    ],
  },
  {
    title: "Uso anônimo",
    body: [
      "Coletamos estatísticas de uso anônimas apenas com o seu consentimento, que pode ser ligado e desligado em Configurações a qualquer momento.",
      "Nenhuma medida, desenho ou projeto seu é enviado nessas estatísticas.",
    ],
  },
  {
    title: "Exclusão de conta e dados",
    body: [
      "Em Conta você pode excluir sua conta permanentemente. A exclusão apaga o perfil, o plano e o histórico de compras vinculados a você.",
      "Projetos gravados somente no aparelho continuam com você e podem ser apagados desinstalando o aplicativo.",
    ],
  },
  {
    title: "Contato",
    body: ["Dúvidas sobre privacidade: suporte@caldra.app."],
  },
];

function Privacidade() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Última atualização: setembro de 2026. Em resumo: seu trabalho é seu e fica no seu
          aparelho.
        </p>
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
