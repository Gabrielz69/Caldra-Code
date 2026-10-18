# Roadmap CALDRA / CHAMFER

Regra do usuário: **executar uma fase inteira por vez**, na ordem.

## Concluído

- Fase 1 — Calculadora impecável (módulos puros, QA 60/60, conferência, peso/custo, materiais, unidades)
- Fase 2A — Plano de corte (ordem, direção, ponto de partida, corte comum, grupos)

## Calculadora Científica (CONCLUÍDO)

- [x] Criar módulo independente, funcional e fiel à referência visual
- [x] Adicionar card CALCULADORA CIENTÍFICA ao lado de ESTUDOS sem mover os demais cards
- [x] Validar motor matemático, histórico, configurações, ferramentas rápidas e responsividade

## Ajustes de refino (CONCLUÍDO)

- [x] AURORA suave mais rápido + novo estilo PADRÃO (sem fundo animado)
- [x] Meus Materiais movido de Configurações para a Oficina
- [x] Configurações reordenadas (Backup, Privacidade e Suporte no fim)
- [x] Paywall com comparativo completo (VISION, plano de corte, DXF CNC, nuvem, AURORA)
- [x] Calculadora: ângulo/casas nas preferências centrais, DEG padrão, %, fatorial, tema do app, display vazio
- [x] QA da calculadora (28 casos) — 103/103 OK
- [x] 3D deixou de ser etapa: virou alternância 2D/3D na área de resultado, com carregamento sob demanda

## Biblioteca de peças / Traçagem (CONCLUÍDO)

- [x] Registro único de modelos (caldeiraria, tubulações, CNC 2D) com capacidades e metadados
- [x] Abas Todas / Caldeiraria / Tubulações / CNC 2D + filtros por família contextuais
- [x] Busca inteligente (nome, sinônimos, categoria, números) e cards com prévia real
- [x] Favoritos, Recentes e Meus Modelos como atalhos (referência única, sem duplicar peças)
- [x] Geradores vetoriais CNC 2D → CHAMFER (1:1 em mm)

## Escola CALDRA (CONCLUÍDO)

- [x] Currículo de 16 módulos com 41 aulas publicadas (fundamentos → fabricação)
- [x] Base de conhecimento única (conceito, fórmula, passo a passo, erros comuns)
- [x] Diagnóstico de nível, mapa de competências e progresso por aula
- [x] Simuladores de triângulo e arco + envio de fórmula para a calculadora
- [x] Exercícios gerados por fórmula com correção passo a passo e placar por aula

## Fase 3 — Lançamento (EM ANDAMENTO)

### Etapa A — Monetização e entitlement

- [ ] Ativar Lovable Cloud (perfil com `plan`, tabela `activation_codes`)
- [ ] `entitlementService` como fonte única (substituir checagens espalhadas)
- [ ] Camada de compra: Play Billing (TWA) com degradação para web
- [ ] Código de ativação CALDRA-XXXXX-XXXXX-XXXXX (atômico, sem reuso)
- [ ] Paywall único: comparativo FREE × PRO real, mensal/anual/já tenho/restaurar
- [ ] Gate suave por feature (modal específico, nunca genérico)

### Etapa B — Conformidade Play Store / LGPD

- [ ] Rotas públicas /privacidade e /termos (constantes de empresa e contato)
- [ ] Excluir conta e dados (confirmação em 2 etapas, cascade, fallback offline)
- [ ] Coleta consentida (opt-in na 1ª execução, revogável em Configurações)

### Etapa C — Onboarding, qualidade e retenção

- [ ] Onboarding máx. 3 telas, pulável
- [ ] Projeto-exemplo marcado EXEMPLO, removível, com dicas contextuais
- [ ] Sentry via env + analytics de funil (provider plugável, sem PII)
- [x] Backup .cal exportar/importar (schema versionado, substituir ou mesclar)
- [ ] Histórico de cálculos, favoritos, duplicar peça, biblioteca de componentes
- [ ] Modo Oficina (alto contraste, alvos 56px, persistente)
- [ ] QA ampliado: migração de backup, entitlement, funil

## Fase 4 — Inteligência (CONCLUÍDA)

- [x] A1 Reconstrução paramétrica (chapa perfurada / flange / anel) com tabela editável, preview e template em CORTE (original preservado em CONSTRUÇÃO)
- [x] A2 OCR técnico com Tesseract.js lazy, caixas na imagem, confirmação individual/em massa, texto corrigível, medida reaproveitável na calibração
- [x] B1 Botão APRENDER com 4 passos (parâmetros, cálculo, desenvolvimento, fabricação) usando os motores puros
- [x] B2 Modos APRENDIZ / MESTRE em Configurações (só apresentação, um único caminho de cálculo)

## Fase 5 — Plataforma (CONCLUÍDA)

- [x] Nesting modo CHAPA (chapas comerciais, folga, margem, giro 90°, aproveitamento e sobra)
- [x] Custo de fabricação (corte, furos, dobras, solda, mão de obra, setup, fator de espessura)
- [x] Orçamento em PDF (fornecedor/cliente, margem, desconto, imposto regional, validade)
- [x] Ficha de produção em PDF com QR de rastreio e cotas de conferência
- [x] Nuvem e versões (sincronização por `updatedAt`, snapshots nomeados, restauro)
- [x] Regional (Brasil/Portugal/EUA/Europa: moeda, formato, chapas e imposto padrão)
- Rota `/oficina` reúne CHAPA · CUSTO · ORÇAMENTO · FICHA · NUVEM

## Professionalization Pass

- [x] Parte 3.0 — CHAMFER em tela cheia + paisagem obrigatória + modais contidos
- [x] Parte 1 — WORKSPACE_FRAME 1500x3000 paramétrico, auto-fit da Traçagem, Centralizar Peça
- [x] Parte 2 — Design System CALDRA (escala tipográfica, foco/desabilitado, botões, skeleton/spinner, estados de erro) em `src/components/caldra/ds.tsx` + tokens em `styles.css`
- [x] Parte 3 — Feedback de instrumento técnico (barra GEOMETRIA · PLANIFICAÇÃO · FABRICAÇÃO nos estúdios)
- [x] Parte 4 — Cold start (splash pré-JS), ícone/splash (favicon + manifest + apple-touch), matriz visual (/matriz-visual), changelog (/novidades), reportar problema (diagnóstico + copiar/e-mail)

- [x] Fase LXDS/UI — LXDS REFERENCE MAP (`docs/LXDS-REFERENCE-MAP.md`), modo de análise LXDS somente leitura, amostra CYPCT_GOLDEN_SAMPLE_01 no QA, janelas de exportação tematizadas e pinch-zoom sem deslocamento
- [x] Fase CNC — layers CUT/MARK/BEND, exportador DXF CNC com conferência, trajetória (direção, start point, lead-in/out), FLUXO CALDRA + prévia animada, painel de multi-seleção e lado do painel estável (sem oscilação)

## Decisões pendentes do usuário

- Preços do paywall (mensal / anual / vitalício Pix) — usar placeholders configuráveis até definir

## Projetos como dossiê de fabricação (CONCLUÍDO)

- Projeto = cliente/obra com peças-instância independentes, progresso e histórico.
- Peças abrem a mesma tela de Traçagem (paramétricas e CNC 2D) com breadcrumb e autosave.

## Ecossistema CALDRA (evolução em fases)

- [x] Fase 1 — Master Project Model: código único do projeto (ESC-001), revisão, migração segura dos projetos existentes.
- [x] Fase 2 — Conjuntos / subconjuntos / peças: árvore de estrutura, código único por peça (ESC-EST-001), vínculo e revisão de peça.
- [x] Fase 3 — vínculo Traçagem → Projeto (salvar no conjunto).
- [x] Fase 4 — vínculo Planificação → Projeto (modo "Do projeto" com aninhamento real).
- [x] Fase 5 — CHAMFER Modo Projeto (peça do dossiê abre desenho vinculado, com volta ao projeto).
- [x] Fase 6 — BOM + Lista de Corte (painel no dossiê + CSV).
- [x] Fase 7 — Validação de Fabricação (impedimentos, alertas e observações por peça).
- [x] Fase 8 — Pacote de Fabricação (PDF único: capa, estrutura, BOM, conferência e ficha por peça).
- [x] Fase 9 — Vista Explodida (esquema por conjunto, afastamento ajustável, peça clicável).
- [x] Fase 10 — Modo Montagem (roteiro derivado da estrutura + checklist local por passo).
- [x] Fase 11 — QR / identificação (etiquetas QR por peça + abertura do dossiê com a peça destacada).
- [x] Fase 12 — Campo / obra (checklist de instalação por peça, ocorrências com foto, resumo instaladas × pendentes, offline).

## Catálogo de projetos paramétricos (NOVA EVOLUÇÃO)

- [x] Fundação — contrato canônico único, derivados versionados e criação atômica.
- [x] Golden Project — Escada Reta completa: parâmetros → cálculo → 2D/3D → decomposição → BOM/corte → CHAMFER → fabricação → montagem.
- [x] Invalidação — marcar derivados desatualizados após mudança crítica e regenerá-los sem apagar artefatos CNC de revisões anteriores.
- [x] Revisões — preservar parâmetros, mudanças, derivados e artefatos por REV A/B/C.
- [x] Testes matemáticos — garantir consistência entre geometria, vistas, peças, BOM, corte e montagem.
- [x] Regressão do fluxo principal — catálogo, dossiê atômico, 2D/3D, peças, BOM, corte, montagem, invalidação, REV B e CHAMFER vetorial sem erros.
- [ ] Regressão ampliada — projetos antigos, demais exportações, temas, celular e paisagem antes de liberar o próximo modelo.
- [ ] Plataforma Industrial — somente após validação da Escada Reta.
- [ ] Suporte de Tubulação — somente após regressão da Plataforma.

## Refinamento técnico (set/2026)

- [x] Vista 2D técnica da Escada (frontal + lateral + superior, 1º diedro, cotas, notas, quadro CALDRA)
- [x] Aba Perspectiva técnica (2D TÉCNICO | 3D | EXPLODIDA | PERSPECTIVA)
- [x] Sincronização 2D ↔ 3D ↔ árvore mantida (mesmas instâncias canônicas)
- [x] CHAMFER: linha de CORTE preta no tema claro e branca no tema escuro (exportação segue preta)
- [ ] CHAMFER: ferramenta ESPESSURA + vista 3D com extrusão real
- [ ] Temas: revisão de FLUIDO/SUAVE/ESTÁTICO no tema claro, tema PADRÃO neutro e AMOLED redesenhado

## Unificação paramétrica da Traçagem (set/2026)

- [ ] Consolidar registro: uma família = um modelo (Curva de Gomos, Boca de Lobo, Quadrado→Redondo) com aliases dos IDs antigos preservando parâmetros históricos.
- [ ] Boca de Lobo: método interno (corte oblíquo | derivação em tubo) com interseção cilindro/cilindro real e ângulo paramétrico.
- [ ] Curva de Gomos: ângulo e quantidade livres; gomos como entidades com planificação própria e meios-gomos nas extremidades.
- [ ] Quadrado→Redondo: superfície 3D derivada das mesmas geratrizes da triangulação (sem cone genérico).
- [ ] CHAMFER: enviar todos os gomos ou o gomo selecionado, geometria vetorial real.
- [ ] REGRA: não alterar o motor 3D existente — só a geometria canônica que ele recebe.
- [ ] Regressão: valores, geometria, planificação e exportação antes/depois; casos 30/45/60/90°, curvas 45°-3, 90°-3, 90°-5.

## Correção global 2D/3D + Quadrado → Redondo (set/2026)

- [x] Área principal única e reutilizável com alternância 2D ↔ 3D em todos os modelos de Traçagem.
- [x] Preservar a câmera 3D durante a alternância mantendo o visor montado após o primeiro uso.
- [x] Quadrado → Redondo: malha facetada derivada dos mesmos pontos, geratrizes e divisões da planificação.
- [x] Testar bases quadrada/retangular, alturas, diâmetros, coerência 2D/3D/traçado/planificação e regressão.

## Exportação DXF para CypCut (papéis de fabricação)

- [x] `ManufacturingRole` (CUT/MARK/BEND/REFERENCE/DIMENSION/LEAD_IN/LEAD_OUT/DIRECTION) em `src/lib/lab2d/roles.ts` — operação pela layer/role, nunca pela cor
- [x] `DxfExportProfile` com mapeamento papel → layer: DXF TÉCNICO, DXF PRODUÇÃO, CYP CUT
- [x] `toDxf` (DXF completo) passa a nomear layers pelos papéis
- [x] Classificação estrutural: contorno externo, furos, rasgos, cortes internos
- [x] Pré-visualização CNC com liga/desliga por papel, contagem por layer e correspondência visível
- [x] Validação antes do download: não classificados (erro), contorno fechado, duplicatas, degenerados, mm, 1:1
- [x] Golden sample `src/lib/dxf/__fixtures__/quadrado-redondo-p01.dxf` + regressão geométrica/semântica (11 testes)
- [ ] Conferir o arquivo gerado no CypCut real do usuário

## Exportação DXF simplificada (tipos de linha + dois perfis)

- [x] Quatro tipos de linha: Corte (verde), Marcação (azul), Dobra (rosa), Recorte (âmbar)
- [x] Camadas internas (construção, referência, cota) ocultas da interface
- [x] Dois perfis: DXF TÉCNICO e DXF LASER CNC (ids antigos mantidos como alias)
- [x] Dobra nunca é convertida em marcação (opção bendAs removida)
- [x] Prévia gerada a partir do próprio DXF, fundo claro e cores fixas
- [x] Análise LXDS removida da interface de exportação
- [x] CHAMFER: dobra usa a geometria BEND completa P1→P2 em rosa, igual à Traçagem; exportação e role BEND permanecem intactos

## Correção coordenada — fabricação, exportação e preferências (set/2026)

- [x] Quadrado→Redondo em 2 partes: recalcular metades canônicas equivalentes com emendas nos centros das faces, nunca sobre dobras; validar remontagem A+B e alimentar o 3D existente.
- [x] PNG exclusivo de Traçado: prancha técnica colorida, dimensionada, em alta resolução, com auto-fit, metadados e nome descritivo; demais formatos inalterados.
- [x] Calculadora: remover barra de categorias e implementar semântica percentual convencional em operações relativas, com regressão matemática.
- [x] Meus Modelos: snapshots versionados dos parâmetros atuais, nome configurável, restauração exata e atualização da instância sem alterar defaults.
- [x] Configurações: remover Estático com migração segura, adicionar destaque Padrão neutro, adicionar Idioma e preservar configuração regional separadamente.
- [ ] Internacionalização: infraestrutura, persistência, fallback e navegação global concluídos; tradução progressiva das superfícies internas permanece.
- [x] Regressão final automatizada: 82 testes cobrindo geometria, BEND/DXF, calculadora e projetos; smoke visual de temas, idiomas e Traçagem.

## Correções de interface e interação do CHAMFER (set/2026)

- [ ] Corrigir contraste e estados visuais do CHAMFER VISION nos temas claro, escuro e AMOLED.
- [ ] Simplificar e reordenar a barra lateral: Selecionar, Linha, Polilinha, Círculo, Retângulo, Texto e Importar CNC 2D.
- [ ] Corrigir ciclo completo da Polilinha, entidade de Texto dimensional, cópia da seleção, clipboard por pressão longa e Tesoura por entidade.
- [ ] Tornar PAN/zoom por dois dedos independente da ferramenta ativa.
- [ ] Mover P01/P02/+ para a barra inferior, remover SNAP dessa barra e preservar planos independentes.
- [ ] Estabilizar o painel de propriedades e criar tokens técnicos visíveis para grid/eixos no AMOLED.
- [ ] Ampliar a importação CNC 2D com análise, preview navegável, fit, layers e confirmação explícita para DXF/SVG.
- [ ] Validar BEND completo, roles técnicos, grupos e ausência de regressão nos exportadores.

## Correção cirúrgica — Paywall e abertura do CHAMFER (set/2026)

- [x] Isolar backdrop e modal do Paywall, mantendo somente o fundo atenuado e o conteúdo nítido.
- [x] Garantir rolagem interna e contenção do Paywall em celular, tablet, desktop e paisagem.
- [x] Fechar integralmente o Paywall antes da navegação para a rota real do CHAMFER.
- [x] Restaurar o CHAMFER em 100vw × 100dvh, sem padding, limite ou deslocamento herdado.
- [x] Validar os cenários CHAMFER, DXF Laser CNC, Oficina e acesso direto, sem alterar entitlements ou motores.

## Traçagem Guiada + vínculo + assinatura (2026-09-15)

- [x] Traçagem Guiada (steps.ts, TracagemPanel, BenchTools) nas abas de Traçagem
- [x] Vínculo parâmetro ↔ cota ↔ entidade (refs.ts, destaque temporário sem trocar cor técnica)
- [x] Assinatura: tabela subscriptions + resolve_entitlement + verifyPurchase/syncEntitlement/restorePurchases + RTDN
- [x] Configurações → Minha assinatura (status, validade, restaurar, verificar)
- [ ] Credenciais do Google Play (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, GOOGLE_PLAY_PACKAGE_NAME) e RTDN_SHARED_SECRET — pendente do usuário

## Traçagem Guiada — execução visual e cota viva

- [x] Iniciar a reprodução com a chapa limpa e a primeira operação geométrica real.
- [x] Vincular cada TraceAction a geometryRefs e measurementRefs canônicas.
- [x] Manter a cota real visível no palco durante todo o movimento do instrumento.
- [x] Separar geometria executada, em execução e futura; revelar progressivamente desde a primeira linha.
- [x] Implementar Ver como fazer, Passo a passo e Repetir etapa sem antecipar o desenho final.
- [x] Validar Quadrado → Redondo em celular e desktop, incluindo redução de movimento.

## Latência da primeira interação (16/09)

- Causa: cada tela só começava a ser baixada no instante do clique (router sem preload).
- Correção: preload na intenção (toque/hover) + prefetch ocioso das telas essenciais no app publicado.
- Medido (celular simulado 4x mais lento): 1º toque 1786ms -> 657ms; 2º toque 1976ms -> 493ms.

## Refinamento profissional do 3D da Traçagem (17/09)

- [x] Fase A — diagnóstico geométrico e baseline dos cinco modelos (auditor puro em src/lib/viz3d/audit.ts).
- [x] Fase B — topologia/normais auditadas; recorte real da interseção (Boca de Lobo e Tê) com curva canônica e viés por grupo de casca.
- [x] Fase C — halo eliminado (sombra artificial opt-in), ghost/listras corrigidos (ordenação por face inteira), parede interna só visível quando observável.
- [x] Fase D — iluminação/material centralizados e ordenação estável por intervalo de profundidade, prioridade e ID.
- [x] Fase E — modos de aresta (SOMB / SOMB+AR / ARAME) e vistas padrão ISO/FR/LAT/SUP com reenquadramento (src/lib/viz3d/cameraPresets.ts).
- [x] Fase F — seleção no 3D por proximidade ao segmento (alvo ≥12 px no mobile), overlay de seleção com rótulo ("Geratriz 7"), refs canônicas estáveis (tags rim/geratriz por aresta/face) e sincronização 2D↔3D↔Traçagem/planificação comprovada em desktop, mobile e três temas (18/09).
- [x] Fase G — projeção/ordenação memorizadas; pausa fora da viewport e em aba oculta (IntersectionObserver).
- [x] Fase H — regressão matemática, esférica e interativa do Wire3D + seleção/2D validadas; fabricação segue nas fases C2/D2.

## Correção crítica do Wire3D — oclusão e rotação esférica (17/09)

- [x] Remover integralmente sombra/halo do modo técnico padrão, inclusive composição e enquadramento.
- [x] Separar políticas de superfície, aresta, linha técnica, referência, cota e seleção.
- [x] Manter linhas técnicas persistentes por identidade estável em toda a rotação.
- [x] Implementar oclusão espacial opcional por subsegmentos, sem alterar a entidade canônica.
- [x] Tornar a ordenação determinística por intervalo de profundidade, prioridade e ID estável.
- [x] Liberar inclinação vertical suportada de −90° a +90° sem trocar a câmera.
- [x] Validar azimute 0–360°, elevação −90°–+90°, esfera, estresse e os cinco modelos nos três temas.

## Espessura, dobra e Fator K (17/09)

- [ ] Fase C2 — espessura real derivada do modelo canônico, sem parede fictícia.
- [ ] Fase D2 — camada de fabricação separada: dobra, raio, linha neutra, Fator K, métodos suportados.
- [ ] Modos Dobra e Linha neutra no 3D quando houver dados reais.
- [ ] Estado técnico da dobra entregue ao CHAMFER.
- [ ] Invalidação de derivados por espessura, raio, ângulo, K ou método.
- [ ] Testes: sem dobra, uma dobra, múltiplas dobras, espessura, K, raio e ângulo.

## Núcleo CAD Industrial do CHAMFER (Evolução Contínua)

- [x] Fase 01 — B-Rep Canônico, Topologia Sólida e Validadores (`src/lib/cad/canonical.ts`)
- [x] Fase 02 — Esboço Paramétrico e Solucionador de Restrições Geométricas (`src/lib/cad/sketch/`)
- [x] Fase 03 — Árvore de Recursos Paramétrica DAG e Rebuild Engine (`src/lib/cad/features/`)
- [x] Fase 04 — Núcleo de Chapa Metálica, Dobras Analíticas e Planificação Técnica (`src/lib/cad/sheetmetal/`)
- [x] Fase 05 — Caldeiraria 3D e Superfícies Transicionais Desenvolvíveis (`src/lib/cad/boilermaking/`)
- [x] Fase 06 — Multicorpos, Operações Booleanas CSG, Mates e BOM Hierárquica (`src/lib/cad/assembly/`)
- [x] Fase 07 — Manufatura CNC, Leads, Micro-juntas e Pós-Processador G-Code (`src/lib/cad/cam/`)
- [x] Fase 08 — Núcleo Mestre Unificado e Painel CAD Chamfer (`src/lib/cad/kernel/`, `ChamferCADPanel.tsx`)
- [x] Fase 09 — Folhas Técnicas 2D, Projeções Ortográficas e Bloco de Título (`src/lib/cad/drafting/`)
- [x] Fase 10 — Perfis Estruturais e Estruturas Soldadas Weldments (`src/lib/cad/weldments/`)
- [x] Fase 11 — Nesting Industrial Multichapas e Aproveitamento de Sobras (`src/lib/cad/nesting/`)
- [x] Fase 12 — Ferramentas de Estampagem, Alívios e Simulação de Prensa Dobradeira (`src/lib/cad/forming/`)
- [x] Fase 13 — DFM (Design for Manufacturing), Auditoria de Fabricabilidade e Orçamento (`src/lib/cad/dfm/`)
- [x] Fase 14 — Metrologia Industrial, GD&T (ASME Y14.5 / ISO 1101), Relatório FAI e Prancha Baloneada (`src/lib/cad/metrology/`)
- [x] Fase 15 — CAE: Análise Estrutural por Elementos Finitos (FEA), Tensões de Von Mises, Deflexão e Fator de Segurança (`src/lib/cad/fea/`)
