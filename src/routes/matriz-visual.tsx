import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Panel, SectionLabel, EmptyState } from "@/components/chameleon/ui";
import {
  Display,
  Title,
  Subtitle,
  Body,
  Caption,
  Eyebrow,
  Button,
  Skeleton,
  SkeletonList,
  LoadingState,
  ErrorState,
  InlineError,
} from "@/components/chameleon/ds";

export const Route = createFileRoute("/matriz-visual")({
  head: () => ({
    meta: [{ title: "Matriz visual — CALDRA" }, { name: "robots", content: "noindex" }],
  }),
  component: MatrizVisual,
});

/** Amostra renderizada dentro de um contexto de tema forçado. */
function Cell({ theme, label }: { theme: string; label: string }) {
  return (
    <div
      className={`${theme} rounded-2xl border border-border/40 bg-background p-4 text-foreground`}
    >
      <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="space-y-3">
        <Display>Display 30</Display>
        <Title>Título de seção</Title>
        <Subtitle>Subtítulo de apoio</Subtitle>
        <Body>Texto corrido com leitura confortável em qualquer tema.</Body>
        <Caption>Legenda auxiliar · 12px</Caption>
        <Eyebrow className="block">Rótulo técnico</Eyebrow>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm">
            Primário
          </Button>
          <Button variant="secondary" size="sm">
            Secundário
          </Button>
          <Button variant="ghost" size="sm">
            Fantasma
          </Button>
          <Button variant="danger" size="sm" icon={Trash2}>
            Perigo
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={Plus}>
            Com ícone
          </Button>
          <Button size="sm" loading>
            Carregando
          </Button>
          <Button size="sm" disabled>
            Desativado
          </Button>
        </div>
        <InlineError>Mensagem de erro inline.</InlineError>
      </div>
    </div>
  );
}

function MatrizVisual() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Matriz visual</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conferência dos componentes do Design System nos temas e estados suportados.
        </p>
      </header>

      <section className="space-y-3">
        <SectionLabel>Tipografia e botões por tema</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          <Cell theme="dark" label="Escuro" />
          <Cell theme="" label="Claro" />
          <Cell theme="dark amoled" label="AMOLED" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Carregamento</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="space-y-3 p-4">
            <Skeleton className="h-5 w-2/5" />
            <SkeletonList rows={3} />
          </Panel>
          <Panel className="p-4">
            <LoadingState label="Calculando desenvolvimento" />
          </Panel>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Erro e vazio</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <ErrorState
            hint="Falha simulada para conferência visual do estado de erro."
            onRetry={() => {}}
          />
          <Panel className="p-4">
            <EmptyState
              title="Nenhum projeto ainda"
              hint="Estado vazio padrão com chamada para ação."
            />
          </Panel>
        </div>
      </section>
    </div>
  );
}
