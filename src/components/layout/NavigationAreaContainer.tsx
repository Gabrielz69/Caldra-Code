import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavigationAreaContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Contêiner unificado e compartilhado para as áreas principais do CALDRA:
 * - Perfil e Conta (modelo de referência visual e métrica)
 * - Início (Dashboard da Oficina)
 * - Projetar (Ambiente CAD & Traçagem)
 * - Produzir (Fabricação & Dossiês de Chão de Fábrica)
 * - Aprenda (Academia Técnica & Escola de Caldeiraria)
 *
 * Padroniza com rigor absoluto:
 * 1. Ponto de partida superior idêntico em todas as telas (pt-16 / safe area)
 * 2. Largura máxima unificada dos cartões e contêineres: max-w-3xl (768px)
 * 3. Margens laterais e preenchimento responsivo idêntico: px-3 sm:px-4
 * 4. Alinhamento horizontal à esquerda: mx-auto
 * 5. Espaçamento vertical entre cabeçalho, separador e cartões: space-y-4
 * 6. Espaçamento inferior para a barra de navegação flutuante: pb-32
 */
export function NavigationAreaContainer({
  children,
  className,
}: NavigationAreaContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl space-y-4 px-5 sm:px-6 pt-16 pb-[calc(7.5rem+env(safe-area-inset-bottom,24px))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
