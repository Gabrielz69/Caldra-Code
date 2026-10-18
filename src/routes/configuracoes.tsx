import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PerfilEContaCentral, type PerfilSectionId } from "@/components/profile/PerfilEContaCentral";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Perfil e Conta — CALDRA" },
      {
        name: "description",
        content:
          "Central unificada de perfil profissional, conta, CALDRA Pro, aparência, preferências e dados.",
      },
      { property: "og:title", content: "Perfil e Conta — CALDRA" },
      {
        property: "og:description",
        content:
          "Gerenciamento completo do profissional, licença, temas, opacidade, prancheta e configurações da oficina.",
      },
    ],
  }),
  component: ConfiguracoesRouteComponent,
});

function ConfiguracoesRouteComponent() {
  const [initialSection, setInitialSection] = useState<PerfilSectionId>("aparencia");

  useEffect(() => {
    try {
      const hash = window.location.hash.replace("#", "");
      if (
        hash === "perfil" ||
        hash === "conta" ||
        hash === "pro" ||
        hash === "aparencia" ||
        hash === "preferencias" ||
        hash === "dados"
      ) {
        setInitialSection(hash as PerfilSectionId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return <PerfilEContaCentral initialSection={initialSection} />;
}
