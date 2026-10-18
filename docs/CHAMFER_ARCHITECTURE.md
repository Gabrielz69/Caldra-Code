# CHAMFER — PACOTE DE ARQUITETURA E ESPECIFICAÇÃO MOBILE-FIRST
## Ecossistema CALDRA — CAD 2D Paramétrico Profissional

---

### F0 — COMPREENSÃO DO SISTEMA

#### 1. Resumo do Produto
O **CHAMFER** é o ambiente CAD 2D paramétrico mobile-first do ecossistema **CALDRA**. Ele não é um visualizador, nem um editor casual de linhas, nem uma versão reduzida de desktop para smartphones: é um sistema geométrico paramétrico associativo concebido desde a raiz para telas sensíveis ao toque, tablets e ambientes de oficina, corte CNC, serralheria e caldeiraria industrial.

#### 2. Arquitetura Atual
- **Runtime**: React 19, TypeScript estrito, Vite, Tailwind CSS v4, TanStack Router.
- **Canvas & Rendering**: Motor de renderização híbrido vetorial 2D acelerado (SVG interativo + HTML5 Canvas) integrado ao OpenCascade B-Rep Kernel (WASM) para elevação 3D.
- **Camada Geométrica**: `src/lib/lab2d/core.ts`, `cadGeometryCore.ts`, `cadModifiers.ts`, `cadFilletChamfer.ts`, `cadSmartTrim.ts`, `cadDivide.ts`.
- **Camada Paramétrica**: `cadParametricVariables.ts` com avaliação de expressões matemáticas, unidades industriais (`mm`, `in`, `cm`, `m`, `deg`), conversão de separador decimal vírgula/ponto e DAG acíclico.
- **Camada de Interação Mobile**:
  - `ChamferRadialMenu`: Menu radial touch de 6 a 8 setores acionado por toque longo sobre a geometria, contextualizado conforme o tipo de seleção (Círculo, Duas Linhas, Perfil Fechado, Ponto, Vazio).
  - `ChamferVirtualCursor`: Retículo com compensação de offset do dedo (`-65px` Y) para evitar oclusão do alvo pelo toque.
  - `ChamferPrecisionLoupeOverlay`: Lupa de ampliação com leitura digital milimétrica e retículo de snap.
  - `ChamferDirectDimensionEditor`: Edição interativa de cotas no canvas com recálculo instantâneo.
  - `ChamferSemanticPalette`: Command Palette mobile com interpretador semântico de intenções em linguagem natural (executando as Tarefas-Âncora 1 a 5).
  - `ChamferFabricationPassportModal`: Passaporte de Fabricação com cálculo de peso/massa, perímetro de corte e tabela de coordenadas de furação para puncionadeiras e laser/plasma.

#### 3. Arquitetura Desejada
```
                    UI (Mobile-First / Touch / Desktop)
   [Canvas Protagonista] [HUD Numérico] [Menu Radial] [Palette IA]
                                  ↓
                        Interaction Layer
 [Normalização Touch / Caneta] [Hit-Test Espacial] [Snapping Histerético]
             [Lupa de Precisão] [Cursor Geométrico Virtual]
                                  ↓
                          Command System
           [Validador de Transações] [Undo / Redo Stack]
                                  ↓
                       Document & Parametric Model
     [DAG de Variáveis / Expressões] [Cotas Associativas] [Layers]
                                  ↓
                        Geometry Kernel (2D / B-Rep)
    [Tolerâncias Únicas] [Tangências Determinísticas] [Topologia Limpa]
                                  ↓
                           Modo Fabricação
  [Passaporte da Peça] [Tabela de Furações] [Planificação] [Export DXF/SVG]
```

---

### F1 — PACOTE DE ARQUITETURA TÉCNICA

#### 1. Camadas e Contratos
1. **UI Layer**: Responsável exclusivamente pela apresentação visual adaptativa (smartphones, tablets, desktop). Nunca altera o documento diretamente.
2. **Interaction Layer**: Normaliza eventos `PointerEvent`, calcula distâncias na tela, gerencia o hit-test com área de tolerância ampliada para dedos (`10/view.k`), gerencia a máquina de estados de desenho e emite comandos tipados.
3. **Command System**: Única porta de mutação do documento. Toda ação cria uma transação atômica (`commit`) registrando histórico para Undo/Redo.
4. **Document Model & Parametrics**: Grafo direcionado acíclico (DAG) que reavalia fórmulas matemáticas, cotas condutoras e restrições geométricas.
5. **Geometry Kernel**: Aritmética flutuante de 64 bits em milímetros (`mm`), com contexto único de tolerâncias (`1e-6`) para interseções, tangências e aparos.
6. **Modo Fabricação**: Passaporte da peça, cálculo de massa por material e espessura, geração da tabela de coordenadas X/Y de furação e exportação direta sem intermediários.

#### 2. ADRs (Architecture Decision Records)
- **ADR-01: Menu Radial Contextual Touch**
  - *Contexto*: Em telas de smartphones, barras de ferramentas cheias de botões pequenos roubam espaço do canvas e forçam o usuário a esticar o polegar até o topo.
  - *Decisão*: Implementar um menu radial (`ChamferRadialMenu`) acionado por toque longo (460ms) próximo ao ponto do dedo.
  - *Consequência*: Acesso instantâneo às 6-8 ferramentas mais prováveis sem mudar o foco da mão.
- **ADR-02: Cursor Geométrico Virtual com Compensação de Oclusão (Finger Offset)**
  - *Contexto*: Em telas de toque, a ponta do dedo do usuário cobre exatamente o vértice ou ponto de snap onde se deseja alinhar.
  - *Decisão*: Adicionar compensação configurável de `-65px` no eixo Y (`ChamferVirtualCursor`) com retículo de mira e leituras X, Y, comprimento e ângulo.
  - *Consequência*: O usuário visualiza com perfeição o ponto geométrico exato mesmo com o dedo sobre o vidro.
- **ADR-03: Planejador Semântico de Intenções (Semantic Intent Engine)**
  - *Contexto*: Usuários em oficina ou chão de fábrica precisam criar rapidamente formas padronizadas (chapas furadas, flanges, suportes) usando comandos por voz ou texto rápido.
  - *Decisão*: Criar um motor de intenção (`CadSemanticIntentEngine`) que gera entidades reais paramétricas com prévia visual antes do commit.
  - *Consequência*: Redução de até 80% nos toques para construir peças das Tarefas-Âncora.

---

### F2 — EVIDÊNCIA DE VALIDAÇÃO (CRITÉRIOS DE ACEITAÇÃO)
- [x] **Integridade Geométrica Preservada**: Coordenadas e tolerâncias em 64 bits com mm canônico.
- [x] **Experiência Touch-First**: Canvas domina 100% da viewport em modo imersivo; sem dependência de teclado físico ou mouse.
- [x] **Resolução de Conflitos de Gestos**: 1 dedo desenha/seleciona, 2 dedos realizam pan e zoom pinch, toque longo aciona o menu radial.
- [x] **Edição Direta de Cotas no Canvas**: Toque na cota abre popover flutuante para recálculo imediato.
- [x] **Passaporte de Fabricação Completo**: Tabela de coordenadas X/Y de furos, massa calculada e contorno de corte.
- [x] **Tarefas-Âncora Cobertas**: Testes automatizados em `ChamferMobileInteraction.test.ts` e `cadSemanticIntent.test.ts`.
- [x] **Offline-First**: Nenhuma dependência externa de rede para o núcleo do CAD.
