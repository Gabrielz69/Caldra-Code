import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    /* O módulo da tela é buscado na INTENÇÃO (hover/toque), não no clique.
       Sem isto, o primeiro toque em cada botão pagava o download + parse do
       código daquela tela — a origem da espera na primeira interação. */
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    /* Preload reaproveitado por 30s: navegar não refaz o mesmo trabalho. */
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
