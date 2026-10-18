/**
 * CALDRA TECHNICAL KNOWLEDGE BASE
 *
 * Camada de CONTEÚDO TÉCNICO — sem estado de usuário, sem interface, sem
 * cálculo. Os motores matemáticos continuam em @/lib/geometry e a calculadora
 * em @/lib/calculator.
 */

/** Estado editorial do item. */
export type ContentState = "verificado" | "needs-review" | "content-gap";

export type Variable = { symbol: string; meaning: string; unit?: string };

export type Formula = {
  id: string;
  category:
    | "geometria"
    | "trigonometria"
    | "arcos"
    | "cilindros"
    | "cones"
    | "reducoes"
    | "curvas"
    | "tubulacao"
    | "planificacao"
    | "desenvolvimento";
  expression: string;
  /** Expressão pronta para a Calculadora Científica, quando aplicável. */
  calculatorExpression?: string;
  computes: string;
  whenToUse: string;
  why: string;
  variables: Variable[];
  example?: string;
  state: ContentState;
};

export type KnowledgeItem = {
  id: string;
  title: string;
  category: CompetencyId;
  concept: string;
  definition: string;
  formulas: string[];
  method?: string[];
  example?: string;
  warnings?: string[];
  commonErrors?: string[];
  prerequisites?: string[];
  relatedParts?: string[];
  relatedTools?: ("calculadora" | "tracagem" | "chamfer")[];
  state: ContentState;
};

/* ---------------------------------------------------------------- competências */

export type CompetencyId =
  "matematica" | "desenho-tecnico" | "tracagem" | "planificacao" | "tubulacao" | "fabricacao";

export const COMPETENCIES: { id: CompetencyId; title: string; summary: string }[] = [
  {
    id: "matematica",
    title: "Matemática",
    summary: "Unidades, geometria, Pitágoras e trigonometria aplicadas.",
  },
  {
    id: "desenho-tecnico",
    title: "Desenho técnico",
    summary: "Vistas, cotas, escalas e leitura de projeto.",
  },
  {
    id: "tracagem",
    title: "Traçagem",
    summary: "Instrumentos, referências e transferência para a chapa.",
  },
  {
    id: "planificacao",
    title: "Planificação",
    summary: "Desenvolvimento de superfícies e escolha do método.",
  },
  {
    id: "tubulacao",
    title: "Tubulação",
    summary: "Planta, elevação, isométricos e cálculos de linha.",
  },
  {
    id: "fabricacao",
    title: "Fabricação",
    summary: "Corte, dobra, calandra, montagem e conferência.",
  },
];

/* ------------------------------------------------------------------- fórmulas */

export const FORMULAS: Formula[] = [
  {
    id: "circunferencia",
    category: "geometria",
    expression: "C = π × D",
    calculatorExpression: "π×",
    computes: "Comprimento da circunferência a partir do diâmetro.",
    whenToUse: "Desenvolvimento de cilindros, virolas, anéis e qualquer contorno circular.",
    why: "A circunferência é o próprio contorno da peça aberta: ao planificar um cilindro, esse comprimento vira o lado reto da chapa.",
    variables: [
      { symbol: "C", meaning: "Comprimento desenvolvido", unit: "mm" },
      { symbol: "D", meaning: "Diâmetro da linha média da chapa", unit: "mm" },
    ],
    example: "Ø400 → C = π × 400 = 1256,6 mm.",
    state: "verificado",
  },
  {
    id: "pitagoras",
    category: "geometria",
    expression: "d = √(a² + b²)",
    calculatorExpression: "√(",
    computes: "Comprimento verdadeiro de um segmento inclinado.",
    whenToUse: "Diagonais, geratrizes e todo comprimento verdadeiro em triangulação.",
    why: "Na chapa só existem comprimentos verdadeiros. Pitágoras converte projeções (altura e afastamento) na medida real que será riscada.",
    variables: [
      { symbol: "a", meaning: "Cateto — afastamento horizontal", unit: "mm" },
      { symbol: "b", meaning: "Cateto — altura", unit: "mm" },
      { symbol: "d", meaning: "Hipotenusa — comprimento verdadeiro", unit: "mm" },
    ],
    example: "400 e 300 → d = 500 mm.",
    state: "verificado",
  },
  {
    id: "corda-divisao",
    category: "arcos",
    expression: "corda = 2 × R × sen(180° / n)",
    computes: "Corda para dividir a circunferência em n partes iguais.",
    whenToUse: "Marcação de geratrizes e divisão de bocas na chapa, sem transferidor.",
    why: "O compasso mede cordas, não arcos. Dividir por cordas é o que se consegue realmente executar na chapa.",
    variables: [
      { symbol: "R", meaning: "Raio", unit: "mm" },
      { symbol: "n", meaning: "Número de divisões" },
    ],
    example: "Ø300 em 12 partes → corda 77,65 mm.",
    state: "verificado",
  },
  {
    id: "arco-corda-flecha",
    category: "arcos",
    expression: "R = (c² / (8 × f)) + (f / 2)",
    computes: "Raio de um arco a partir da corda e da flecha medidas na peça.",
    whenToUse: "Conferência de calandragem e levantamento de raio em peça existente.",
    why: "Corda e flecha são as duas medidas que dá para tirar com régua na peça pronta; delas se recupera o raio real.",
    variables: [
      { symbol: "c", meaning: "Corda", unit: "mm" },
      { symbol: "f", meaning: "Flecha", unit: "mm" },
      { symbol: "R", meaning: "Raio do arco", unit: "mm" },
    ],
    state: "needs-review",
  },
  {
    id: "polegada",
    category: "geometria",
    expression: "mm = polegada × 25,4",
    computes: "Conversão de polegada para milímetro.",
    whenToUse: "Chapas, tubos e acessórios especificados em polegadas.",
    why: "O traçado é executado em milímetro; misturar unidades no meio do cálculo é a origem mais comum de peça fora de medida.",
    variables: [{ symbol: "pol", meaning: "Medida em polegadas" }],
    example: '3/8" = 9,525 mm.',
    state: "verificado",
  },
  {
    id: "tangente-cone",
    category: "cones",
    expression: "tg α = (D − d) / (2 × h)",
    computes: "Ângulo de meia-abertura de um tronco de cone.",
    whenToUse: "Definir inclinação, gabarito e corte de troncos de cone e reduções.",
    why: "O ângulo descreve a inclinação da geratriz — é ele que governa o setor da planificação.",
    variables: [
      { symbol: "D", meaning: "Diâmetro maior", unit: "mm" },
      { symbol: "d", meaning: "Diâmetro menor", unit: "mm" },
      { symbol: "h", meaning: "Altura no eixo", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "escala",
    category: "geometria",
    expression: "medida real = medida do desenho × fator da escala",
    computes: "Conversão entre a medida do desenho e a medida da peça.",
    whenToUse: "Leitura de projeto em escala 1:2, 1:5, 1:10 e ampliações.",
    why: "A cota manda; a escala só existe para caber no papel. Quando falta cota, é a escala que devolve a medida real.",
    variables: [{ symbol: "fator", meaning: "Denominador da escala (1:5 → 5)" }],
    example: "Traço de 38 mm em 1:10 → 380 mm na peça.",
    state: "verificado",
  },
  {
    id: "perimetro-poligono",
    category: "geometria",
    expression: "P = n × L",
    computes: "Perímetro de um polígono regular de n lados.",
    whenToUse: "Anéis poligonais, bases quadradas e estruturas de n faces.",
    why: "É o desenvolvimento reto da peça poligonal — o mesmo papel que a circunferência tem no cilindro.",
    variables: [
      { symbol: "n", meaning: "Número de lados" },
      { symbol: "L", meaning: "Comprimento de um lado", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "linha-neutra",
    category: "planificacao",
    expression: "Dm = De − e",
    calculatorExpression: "De - e",
    computes: "Diâmetro médio (linha neutra) da chapa calandrada.",
    whenToUse: "Sempre que o diâmetro dado for externo e a chapa tiver espessura relevante.",
    why: "Ao calandrar, a face externa estica e a interna comprime; só a linha do meio mantém o comprimento original. É ela que vale no desenvolvimento.",
    variables: [
      { symbol: "De", meaning: "Diâmetro externo", unit: "mm" },
      { symbol: "e", meaning: "Espessura da chapa", unit: "mm" },
    ],
    example: "De 500 mm, chapa 8 mm → Dm = 492 mm.",
    state: "verificado",
  },
  {
    id: "desenvolvimento-cilindro",
    category: "cilindros",
    expression: "L = π × (De − e)",
    calculatorExpression: "pi * (De - e)",
    computes: "Comprimento da chapa plana de uma virola cilíndrica.",
    whenToUse: "Planificar tubos, virolas, anéis e costados cilíndricos.",
    why: "A virola é a circunferência da linha neutra aberta em linha reta.",
    variables: [
      { symbol: "De", meaning: "Diâmetro externo", unit: "mm" },
      { symbol: "e", meaning: "Espessura", unit: "mm" },
    ],
    example: "Tubo Ø 500 externo, chapa 8 mm → L = π × 492 ≈ 1545,7 mm.",
    state: "verificado",
  },
  {
    id: "boca-inclinada",
    category: "cilindros",
    expression: "y = h + (D / 2) × tg α × cos θ",
    computes: "Altura de cada geratriz de um cilindro cortado em ângulo.",
    whenToUse: "Boca de lobo, tubo cortado em esquadria e emenda inclinada.",
    why: "O corte inclinado vira uma senoide quando a virola é aberta: cada geratriz cresce conforme sua posição no círculo.",
    variables: [
      { symbol: "h", meaning: "Altura média do tubo", unit: "mm" },
      { symbol: "D", meaning: "Diâmetro médio", unit: "mm" },
      { symbol: "α", meaning: "Ângulo do corte com a horizontal", unit: "°" },
      { symbol: "θ", meaning: "Posição angular da geratriz", unit: "°" },
    ],
    state: "verificado",
  },
  {
    id: "cone-geratriz",
    category: "cones",
    expression: "G = √(h² + R²)",
    calculatorExpression: "sqrt(h^2 + R^2)",
    computes: "Geratriz (lado inclinado) de um cone completo.",
    whenToUse: "Planificar cones inteiros e definir o raio do setor circular.",
    why: "A geratriz é a hipotenusa do triângulo formado pela altura e pelo raio da base — e ela vira o raio do desenvolvimento.",
    variables: [
      { symbol: "h", meaning: "Altura do cone", unit: "mm" },
      { symbol: "R", meaning: "Raio da base", unit: "mm" },
    ],
    example: "h = 400, R = 300 → G = 500 mm.",
    state: "verificado",
  },
  {
    id: "cone-setor",
    category: "cones",
    expression: "α = 360° × R / G",
    calculatorExpression: "360 * R / G",
    computes: "Ângulo do setor circular que planifica o cone.",
    whenToUse: "Traçar o desenvolvimento do cone com compasso ou gerar o gabarito.",
    why: "O arco do setor precisa medir exatamente o perímetro da base; a razão R/G é o que fecha essa igualdade.",
    variables: [
      { symbol: "R", meaning: "Raio da base", unit: "mm" },
      { symbol: "G", meaning: "Geratriz", unit: "mm" },
    ],
    example: "R = 300, G = 500 → α = 216°.",
    state: "verificado",
  },
  {
    id: "tronco-geratriz",
    category: "cones",
    expression: "g = √(h² + (R − r)²)",
    calculatorExpression: "sqrt(h^2 + (R - r)^2)",
    computes: "Geratriz do tronco de cone (redução).",
    whenToUse: "Reduções concêntricas e troncos de cone em geral.",
    why: "A diferença entre os raios é o cateto horizontal do triângulo da geratriz.",
    variables: [
      { symbol: "h", meaning: "Altura do tronco", unit: "mm" },
      { symbol: "R", meaning: "Raio maior", unit: "mm" },
      { symbol: "r", meaning: "Raio menor", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "tronco-vertice",
    category: "cones",
    expression: "G = g × R / (R − r)",
    calculatorExpression: "g * R / (R - r)",
    computes: "Distância do vértice imaginário até a base maior.",
    whenToUse: "Traçar o tronco como diferença de dois setores circulares.",
    why: "O tronco é um cone completo com a ponta cortada; para riscar os dois arcos é preciso reconstruir o vértice.",
    variables: [
      { symbol: "g", meaning: "Geratriz do tronco", unit: "mm" },
      { symbol: "R", meaning: "Raio maior", unit: "mm" },
      { symbol: "r", meaning: "Raio menor", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "curva-gomos",
    category: "curvas",
    expression: "β = θ / (2 × (n − 1))",
    calculatorExpression: "theta / (2 * (n - 1))",
    computes: "Ângulo de corte de cada face dos gomos.",
    whenToUse: "Curvas de 45°, 60° e 90° feitas com gomos de tubo ou chapa calandrada.",
    why: "Os gomos das pontas são meios-gomos; por isso o total de faces de corte é 2(n−1), e cada uma leva a mesma fração do ângulo.",
    variables: [
      { symbol: "θ", meaning: "Ângulo total da curva", unit: "°" },
      { symbol: "n", meaning: "Número de gomos (contando os dois meios)" },
    ],
    example: "Curva 90° com 4 gomos → β = 15° por face.",
    state: "verificado",
  },
  {
    id: "curva-recuo",
    category: "curvas",
    expression: "s = (D / 2) × tg β",
    calculatorExpression: "(D / 2) * tan(beta)",
    computes: "Diferença entre a geratriz longa e a curta de um gomo.",
    whenToUse: "Marcar o corte do gomo diretamente no tubo ou na virola aberta.",
    why: "O corte inclinado desloca a boca do gomo; esse recuo é a amplitude da senoide traçada na chapa.",
    variables: [
      { symbol: "D", meaning: "Diâmetro médio", unit: "mm" },
      { symbol: "β", meaning: "Ângulo de corte da face", unit: "°" },
    ],
    state: "verificado",
  },
  {
    id: "raio-curva",
    category: "curvas",
    expression: "L_eixo = R × θ × π / 180",
    calculatorExpression: "R * theta * pi / 180",
    computes: "Comprimento do eixo da curva.",
    whenToUse: "Distribuir os gomos e conferir o comprimento total da curva montada.",
    why: "O eixo da curva é um arco; dividido pelos gomos, dá o comprimento de cada trecho.",
    variables: [
      { symbol: "R", meaning: "Raio da curva no eixo", unit: "mm" },
      { symbol: "θ", meaning: "Ângulo da curva", unit: "°" },
    ],
    state: "verificado",
  },
  {
    id: "intersecao-tubos",
    category: "tubulacao",
    expression: "y = √(R² − x²)",
    calculatorExpression: "sqrt(R^2 - x^2)",
    computes: "Profundidade do recorte do tubo menor sobre o maior.",
    whenToUse: "Boca de lobo, derivações a 90° e penetrações de tubo em costado.",
    why: "O recorte acompanha o contorno circular do tubo maior; cada geratriz do tubo menor encosta numa altura diferente.",
    variables: [
      { symbol: "R", meaning: "Raio do tubo maior", unit: "mm" },
      { symbol: "x", meaning: "Afastamento da geratriz em relação ao eixo", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "derivacao-angulo",
    category: "tubulacao",
    expression: "e = d / sen α",
    calculatorExpression: "d / sin(alpha)",
    computes: "Alongamento da boca do tubo derivado quando a entrada é inclinada.",
    whenToUse: "Derivações a 45° e 60° em tubulações.",
    why: "Quanto mais deitada a entrada, mais comprida fica a elipse de encontro entre os tubos.",
    variables: [
      { symbol: "d", meaning: "Diâmetro do tubo derivado", unit: "mm" },
      { symbol: "α", meaning: "Ângulo entre os eixos", unit: "°" },
    ],
    state: "verificado",
  },
  {
    id: "deslocamento-45",
    category: "tubulacao",
    expression: "L = d × 1,4142",
    calculatorExpression: "d * sqrt(2)",
    computes: "Distância entre centros de curvas em um desvio a 45°.",
    whenToUse: "Desvios (pescoço de ganso) com duas curvas de 45°.",
    why: "O desvio forma um triângulo retângulo isósceles: a diagonal é o cateto vezes a raiz de dois.",
    variables: [{ symbol: "d", meaning: "Deslocamento entre os eixos das linhas", unit: "mm" }],
    example: "Desvio de 300 mm → 424,3 mm entre centros.",
    state: "verificado",
  },
  {
    id: "deslocamento-generico",
    category: "tubulacao",
    expression: "L = d / sen α",
    calculatorExpression: "d / sin(alpha)",
    computes: "Distância entre centros para qualquer ângulo de desvio.",
    whenToUse: "Desvios com curvas de 30°, 60° ou ângulos livres.",
    why: "O deslocamento é o cateto oposto ao ângulo do desvio; a diagonal é a hipotenusa.",
    variables: [
      { symbol: "d", meaning: "Deslocamento", unit: "mm" },
      { symbol: "α", meaning: "Ângulo do desvio", unit: "°" },
    ],
    state: "verificado",
  },
  {
    id: "niple-takeout",
    category: "tubulacao",
    expression: "C = L − (t₁ + t₂)",
    calculatorExpression: "L - (t1 + t2)",
    computes: "Comprimento de corte do tubo entre dois acessórios.",
    whenToUse: "Cortar niples entre curvas, tês e flanges.",
    why: "A medida de projeto é de centro a centro; cada acessório ocupa um pedaço dessa distância.",
    variables: [
      { symbol: "L", meaning: "Distância entre centros", unit: "mm" },
      { symbol: "t₁, t₂", meaning: "Ocupação de cada acessório (take-out)", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "bend-allowance",
    category: "planificacao",
    expression: "BA = (π / 180) × A × (r + K × e)",
    calculatorExpression: "(pi/180) * A * (r + K * e)",
    computes: "Comprimento da linha neutra dentro da dobra.",
    whenToUse: "Calcular a chapa plana de peças dobradas na prensa.",
    why: "A fibra neutra não fica no meio exato da chapa; o fator K diz onde ela está e é o que torna o cálculo confiável.",
    variables: [
      { symbol: "A", meaning: "Ângulo de dobra", unit: "°" },
      { symbol: "r", meaning: "Raio interno da dobra", unit: "mm" },
      { symbol: "K", meaning: "Fator K (0,33 a 0,50)" },
      { symbol: "e", meaning: "Espessura", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "bend-deduction",
    category: "planificacao",
    expression: "BD = 2 × (r + e) × tg(A / 2) − BA",
    calculatorExpression: "2 * (r + e) * tan(A/2) - BA",
    computes: "Desconto a subtrair das medidas externas da peça dobrada.",
    whenToUse: "Quando o desenho traz cotas externas em vez de comprimentos de aba.",
    why: "Somar as abas externas conta duas vezes a região da dobra; o desconto devolve o comprimento real da chapa.",
    variables: [
      { symbol: "r", meaning: "Raio interno", unit: "mm" },
      { symbol: "e", meaning: "Espessura", unit: "mm" },
      { symbol: "A", meaning: "Ângulo de dobra", unit: "°" },
      { symbol: "BA", meaning: "Bend allowance", unit: "mm" },
    ],
    state: "verificado",
  },
  {
    id: "chapa-plana-dobra",
    category: "planificacao",
    expression: "L = Σ abas + Σ BA",
    computes: "Comprimento total da chapa antes de dobrar.",
    whenToUse: "Fechar o desenvolvimento de perfis, cantoneiras e caixas dobradas.",
    why: "Cada trecho reto entra pelo valor real e cada dobra entra pelo comprimento da fibra neutra.",
    variables: [
      { symbol: "abas", meaning: "Trechos retos entre dobras", unit: "mm" },
      { symbol: "BA", meaning: "Bend allowance de cada dobra", unit: "mm" },
    ],
    state: "verificado",
  },
];

export const formulaById = (id: string) => FORMULAS.find((f) => f.id === id) ?? null;

/* --------------------------------------------------------------- conhecimento */

export const KNOWLEDGE: KnowledgeItem[] = [
  {
    id: "unidades-medida",
    title: "Unidades e conversões",
    category: "matematica",
    concept:
      "Toda a fabricação metálica trabalha em milímetro; polegadas aparecem em material importado e tubulação.",
    definition:
      "Milímetro é a unidade de traçagem. A polegada é convertida antes de qualquer conta, nunca depois.",
    formulas: ["polegada"],
    example: '1/2" = 12,7 mm · 3/8" = 9,525 mm',
    commonErrors: ["Converter só no final e arrastar erro de arredondamento para todas as cotas."],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "raio-diametro-perimetro",
    title: "Raio, diâmetro e perímetro",
    category: "matematica",
    concept:
      "As três medidas que descrevem qualquer seção circular e sustentam todo desenvolvimento.",
    definition:
      "Raio é do centro à borda; diâmetro é o dobro; perímetro é o contorno desenvolvido da seção.",
    formulas: ["circunferencia"],
    warnings: ["Use sempre o diâmetro da linha média da chapa, não o externo."],
    commonErrors: ["Usar diâmetro externo em chapa grossa e obter virola comprida demais."],
    relatedTools: ["calculadora", "tracagem"],
    state: "verificado",
  },
  {
    id: "arco-corda-flecha",
    title: "Arco, corda e flecha",
    category: "matematica",
    concept: "As medidas práticas de um arco na peça real.",
    definition:
      "Corda é a reta entre as extremidades do arco; flecha é a altura do arco em relação à corda; delas se obtém o raio.",
    formulas: ["arco-corda-flecha", "corda-divisao"],
    prerequisites: ["raio-diametro-perimetro"],
    relatedTools: ["calculadora"],
    state: "needs-review",
  },
  {
    id: "triangulo-retangulo",
    title: "Triângulo retângulo e Pitágoras",
    category: "matematica",
    concept: "A ferramenta que transforma projeções em comprimento verdadeiro.",
    definition:
      "Em todo triângulo retângulo a hipotenusa é a raiz da soma dos quadrados dos catetos.",
    formulas: ["pitagoras"],
    prerequisites: ["unidades-medida"],
    relatedTools: ["calculadora", "tracagem"],
    state: "verificado",
  },
  {
    id: "trigonometria-basica",
    title: "Seno, cosseno e tangente",
    category: "matematica",
    concept:
      "Relações que ligam ângulos e lados — inclinações, ângulos de corte e alturas inacessíveis.",
    definition:
      "sen = cateto oposto / hipotenusa · cos = cateto adjacente / hipotenusa · tg = oposto / adjacente.",
    formulas: ["tangente-cone", "pitagoras"],
    prerequisites: ["triangulo-retangulo"],
    relatedTools: ["calculadora", "tracagem"],
    state: "verificado",
  },
  {
    id: "o-que-e-caldeiraria",
    title: "O que é caldeiraria",
    category: "fabricacao",
    concept: "Fabricar peças a partir de chapas e perfis conformados.",
    definition:
      "Traçagem, corte, calandragem, dobra, montagem e solda. O traçador converte medidas de projeto em desenvolvimento plano.",
    formulas: ["circunferencia"],
    relatedTools: ["tracagem", "chamfer"],
    state: "verificado",
  },
  {
    id: "verdadeira-grandeza",
    title: "Verdadeira grandeza",
    category: "desenho-tecnico",
    concept: "Só se risca na chapa aquilo que está em verdadeira grandeza.",
    definition:
      "Uma medida aparece em verdadeira grandeza quando o plano que a contém é paralelo ao plano de projeção; caso contrário está encurtada.",
    formulas: ["pitagoras"],
    prerequisites: ["triangulo-retangulo"],
    state: "needs-review",
  },
  {
    id: "vistas-ortograficas",
    title: "Vistas ortográficas",
    category: "desenho-tecnico",
    concept: "Uma peça de três dimensões descrita por vistas planas relacionadas entre si.",
    definition:
      "Frontal, superior e lateral mostram a mesma peça em direções perpendiculares. Cada ponto guarda a mesma altura entre frontal e lateral, e o mesmo afastamento entre frontal e superior.",
    formulas: [],
    method: [
      "Escolha a frontal: a vista que melhor mostra o contorno da peça.",
      "Projete alturas na horizontal para a lateral.",
      "Projete larguras na vertical para a superior.",
      "Confira: toda medida deve fechar nas três vistas.",
    ],
    commonErrors: ["Ler uma face inclinada como se estivesse em verdadeira grandeza."],
    prerequisites: ["verdadeira-grandeza"],
    relatedTools: ["tracagem"],
    state: "verificado",
  },
  {
    id: "cotas-escalas",
    title: "Cotas e escalas",
    category: "desenho-tecnico",
    concept: "A cota é a lei da peça; a escala é só o tamanho do desenho.",
    definition:
      "Cota é a medida escrita no desenho e prevalece sobre qualquer medição feita no papel. Escala indica a proporção entre desenho e peça real.",
    formulas: ["escala"],
    warnings: [
      "Nunca meça o desenho com régua para obter medida de fabricação quando existe cota.",
    ],
    commonErrors: ["Aplicar escala em desenho impresso fora de proporção."],
    prerequisites: ["unidades-medida"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "cortes-secoes",
    title: "Cortes e seções",
    category: "desenho-tecnico",
    concept: "Cortar o desenho para enxergar o que está escondido.",
    definition:
      "O corte remove imaginariamente parte da peça para revelar espessuras, furos e paredes internas; o hachurado marca o material atingido pelo plano de corte.",
    formulas: [],
    method: [
      "Localize a linha de corte e o sentido das setas.",
      "Leia a vista em corte olhando na direção das setas.",
      "Use as hachuras para separar material de vazio.",
    ],
    prerequisites: ["vistas-ortograficas"],
    state: "verificado",
  },
  {
    id: "instrumentos-tracagem",
    title: "Instrumentos de traçagem",
    category: "tracagem",
    concept: "Cada instrumento resolve um tipo de medida; a precisão da peça começa aqui.",
    definition:
      "Riscador marca a linha, compasso transfere raios e cordas, esquadro garante o ângulo reto, punção fixa centros e a trena resolve grandes distâncias.",
    formulas: [],
    method: [
      "Limpe e prepare a chapa antes de riscar.",
      "Defina uma aresta de referência e trabalhe sempre a partir dela.",
      "Punce os centros antes de abrir o compasso.",
      "Risque uma vez só: linha repetida vira erro de corte.",
    ],
    warnings: ["Riscador desgastado engorda a linha e some com a precisão."],
    relatedTools: ["tracagem"],
    state: "verificado",
  },
  {
    id: "referencias-tracagem",
    title: "Referências e conferência",
    category: "tracagem",
    concept: "Medidas acumuladas a partir de uma única referência não somam erro.",
    definition:
      "Escolhe-se uma aresta e uma linha de centro como origem de todas as cotas. A conferência final compara diagonais e simetria antes do corte.",
    formulas: ["pitagoras"],
    method: [
      "Marque a aresta de referência e a linha de centro.",
      "Cote tudo a partir dessa origem, nunca de marca em marca.",
      "Confira as diagonais: iguais, o traçado está em esquadro.",
    ],
    commonErrors: ["Medir de marca em marca e acumular folga em cada passo."],
    prerequisites: ["triangulo-retangulo"],
    relatedTools: ["tracagem", "calculadora"],
    state: "verificado",
  },
  {
    id: "divisao-circunferencia",
    title: "Divisão da circunferência",
    category: "tracagem",
    concept: "Dividir a boca da peça em partes iguais com o compasso, sem transferidor.",
    definition:
      "As geratrizes de um desenvolvimento nascem de divisões iguais da circunferência, marcadas por cordas calculadas.",
    formulas: ["corda-divisao", "circunferencia"],
    method: [
      "Defina o número de divisões (12 e 16 são os usuais).",
      "Calcule a corda e abra o compasso nela.",
      "Percorra a circunferência; o fechamento confirma o cálculo.",
    ],
    warnings: [
      "Se a última divisão não fecha, o erro está na abertura do compasso, não na fórmula.",
    ],
    prerequisites: ["raio-diametro-perimetro"],
    relatedTools: ["calculadora", "tracagem"],
    state: "verificado",
  },
  {
    id: "superficies-desenvolviveis",
    title: "Superfícies desenvolvíveis",
    category: "planificacao",
    concept: "Nem toda peça pode ser aberta na chapa sem esticar o material.",
    definition:
      "Cilindros, cones e superfícies formadas por retas paralelas ou que convergem para um ponto abrem exatamente no plano. Esferas e superfícies de dupla curvatura só se aproximam por gomos ou por conformação.",
    formulas: [],
    method: [
      "Identifique se a peça é gerada por retas (cilindro, cone, transição).",
      "Se for, escolha o método de desenvolvimento adequado.",
      "Se não for, divida em gomos ou fatias que sejam desenvolvíveis.",
    ],
    warnings: ["Calota e esfera não têm planificação exata: o gabarito é sempre uma aproximação."],
    relatedTools: ["tracagem"],
    state: "verificado",
  },
  {
    id: "metodos-planificacao",
    title: "Os três métodos de desenvolvimento",
    category: "planificacao",
    concept: "Paralelas, radial e triangulação — a peça diz qual usar.",
    definition:
      "Linhas paralelas serve para peças de geratrizes paralelas (cilindros e prismas). Radial serve para peças com vértice comum (cones e troncos). Triangulação serve para transições sem vértice, como quadrado → redondo.",
    formulas: ["desenvolvimento-cilindro", "cone-setor"],
    method: [
      "Geratrizes paralelas → método das paralelas.",
      "Geratrizes que convergem a um vértice → método radial.",
      "Bocas de formatos diferentes → triangulação.",
    ],
    commonErrors: [
      "Tentar usar o método radial em transição quadrado → redondo, que não tem vértice único.",
    ],
    prerequisites: ["superficies-desenvolviveis"],
    relatedTools: ["tracagem", "chamfer"],
    state: "verificado",
  },
  {
    id: "linha-neutra-espessura",
    title: "Linha neutra e espessura",
    category: "planificacao",
    concept: "Chapa grossa desenvolve pelo meio, não pela face.",
    definition:
      "Na conformação a face externa alonga e a interna encurta; a fibra do meio conserva o comprimento. O desenvolvimento é sempre feito pelo diâmetro médio.",
    formulas: ["linha-neutra", "desenvolvimento-cilindro"],
    warnings: ["Usar o diâmetro externo em chapa grossa gera virola sobrando e emenda montada."],
    prerequisites: ["raio-diametro-perimetro"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "virola-cilindrica",
    title: "Virola cilíndrica",
    category: "planificacao",
    concept: "Um cilindro aberto é um retângulo.",
    definition:
      "O comprimento do retângulo é o perímetro da linha neutra e a largura é a altura da virola, mais as sobras de solda quando o processo exigir.",
    formulas: ["desenvolvimento-cilindro", "linha-neutra"],
    method: [
      "Converta o diâmetro dado para diâmetro médio.",
      "Calcule L = π × Dm.",
      "Marque altura, linhas de centro e chanfros de solda.",
    ],
    example: "Virola Ø 800 externo, chapa 10 mm, altura 1200 → chapa 2482,0 × 1200 mm.",
    prerequisites: ["linha-neutra-espessura"],
    relatedParts: ["virola"],
    relatedTools: ["calculadora", "chamfer"],
    state: "verificado",
  },
  {
    id: "cilindro-boca-inclinada",
    title: "Cilindro com boca inclinada",
    category: "planificacao",
    concept: "Corte inclinado no tubo vira uma onda na chapa aberta.",
    definition:
      "Dividindo a circunferência em partes iguais e medindo a altura de cada geratriz, a planificação aparece como uma curva senoidal ligando os pontos.",
    formulas: ["boca-inclinada", "desenvolvimento-cilindro", "corda-divisao"],
    method: [
      "Divida a boca em 12 ou 16 partes iguais.",
      "Levante cada geratriz e meça sua altura na vista.",
      "Transporte as alturas para o desenvolvimento, na mesma ordem.",
      "Una os pontos com curva suave.",
    ],
    commonErrors: ["Trocar a ordem das geratrizes ao transportar as alturas."],
    prerequisites: ["virola-cilindrica", "divisao-circunferencia"],
    relatedTools: ["tracagem", "chamfer"],
    state: "verificado",
  },
  {
    id: "emendas-virolas",
    title: "Emendas e casamento de virolas",
    category: "fabricacao",
    concept: "Emenda alinhada enfraquece o costado: desencontre as soldas.",
    definition:
      "Ao montar costados com várias virolas, as soldas longitudinais são defasadas entre anéis, e cada virola recebe marcas de casamento antes da calandra.",
    formulas: [],
    method: [
      "Numere as virolas e marque a posição da solda longitudinal.",
      "Gire cada anel para desencontrar as emendas.",
      "Confira circularidade antes de soldar o anel seguinte.",
    ],
    prerequisites: ["virola-cilindrica"],
    state: "verificado",
  },
  {
    id: "cone-completo",
    title: "Cone completo",
    category: "planificacao",
    concept: "O cone abre como um setor circular de raio igual à geratriz.",
    definition:
      "O raio do setor é a geratriz e o ângulo do setor é a fração do círculo cujo arco vale exatamente o perímetro da base.",
    formulas: ["cone-geratriz", "cone-setor", "circunferencia"],
    method: [
      "Calcule a geratriz G a partir de altura e raio.",
      "Calcule o ângulo do setor α = 360 × R / G.",
      "Risque o arco com compasso aberto em G e feche o setor.",
    ],
    example: "R = 300, h = 400 → G = 500 e α = 216°.",
    prerequisites: ["metodos-planificacao", "triangulo-retangulo"],
    relatedParts: ["cone"],
    relatedTools: ["calculadora", "tracagem"],
    state: "verificado",
  },
  {
    id: "tronco-cone",
    title: "Tronco de cone",
    category: "planificacao",
    concept: "O tronco é a diferença entre dois setores do mesmo vértice.",
    definition:
      "Reconstrói-se o vértice imaginário, risca-se o setor da base maior e, do mesmo centro, o arco da base menor. A coroa entre os dois arcos é a peça.",
    formulas: ["tronco-geratriz", "tronco-vertice", "cone-setor", "tangente-cone"],
    method: [
      "Calcule a geratriz do tronco g.",
      "Reconstrua o vértice: G = g × R / (R − r).",
      "Calcule o ângulo do setor com R e G.",
      "Risque os dois arcos do mesmo centro e feche a coroa.",
    ],
    warnings: [
      "Com R e r muito próximos o vértice fica longe demais: use triangulação ou traçado por cordas.",
    ],
    prerequisites: ["cone-completo"],
    relatedParts: ["reducao-concentrica"],
    relatedTools: ["calculadora", "chamfer"],
    state: "verificado",
  },
  {
    id: "gabarito-cone",
    title: "Gabarito e conferência do cone",
    category: "tracagem",
    concept: "O gabarito confirma na chapa o que a conta prometeu.",
    definition:
      "Antes do corte confere-se o arco desenvolvido contra o perímetro real da boca; a diferença aceitável é a folga de solda, não erro de cálculo.",
    formulas: ["circunferencia", "cone-setor"],
    method: [
      "Meça o arco riscado com fita.",
      "Compare com π × D da boca correspondente.",
      "Ajuste antes de cortar, nunca depois.",
    ],
    prerequisites: ["cone-completo"],
    relatedTools: ["tracagem"],
    state: "verificado",
  },
  {
    id: "reducao-concentrica",
    title: "Redução concêntrica",
    category: "planificacao",
    concept: "É um tronco de cone com os dois eixos alinhados.",
    definition:
      "As duas bocas são circulares e coaxiais; o desenvolvimento é a coroa circular do tronco de cone.",
    formulas: ["tronco-geratriz", "tronco-vertice", "cone-setor"],
    prerequisites: ["tronco-cone"],
    relatedParts: ["reducao-concentrica"],
    relatedTools: ["calculadora", "chamfer"],
    state: "verificado",
  },
  {
    id: "reducao-excentrica",
    title: "Redução excêntrica",
    category: "planificacao",
    concept: "Com os eixos deslocados, cada geratriz tem um comprimento diferente.",
    definition:
      "Não existe setor único: divide-se a boca em partes iguais e mede-se cada geratriz em verdadeira grandeza, planificando por triangulação.",
    formulas: ["pitagoras", "corda-divisao"],
    method: [
      "Divida as duas bocas no mesmo número de partes.",
      "Ligue os pontos formando triângulos alternados.",
      "Obtenha cada geratriz em verdadeira grandeza.",
      "Monte o desenvolvimento triângulo a triângulo.",
    ],
    commonErrors: ["Tratar a excêntrica como concêntrica e cortar a peça torta."],
    prerequisites: ["reducao-concentrica", "verdadeira-grandeza"],
    relatedParts: ["reducao-excentrica"],
    relatedTools: ["chamfer"],
    state: "verificado",
  },
  {
    id: "quadrado-redondo",
    title: "Transição quadrado → redondo",
    category: "planificacao",
    concept: "Quatro triângulos planos e quatro setores de cone, alternados.",
    definition:
      "A peça é formada por triângulos que nascem dos lados do quadrado e por partes cônicas que nascem dos cantos, ligando-se à boca redonda.",
    formulas: ["pitagoras", "corda-divisao"],
    method: [
      "Divida cada quarto da boca redonda em partes iguais.",
      "Ligue cada divisão ao canto correspondente do quadrado.",
      "Obtenha o comprimento verdadeiro de cada ligação.",
      "Desenvolva alternando triângulo do lado e leque do canto.",
    ],
    prerequisites: ["reducao-excentrica"],
    relatedParts: ["quadrado-redondo"],
    relatedTools: ["tracagem", "chamfer"],
    state: "verificado",
  },
  {
    id: "curva-gomos-conceito",
    title: "Curva em gomos",
    category: "planificacao",
    concept: "A curva é feita de fatias de cilindro cortadas em ângulo.",
    definition:
      "Uma curva de θ graus com n gomos tem dois meios-gomos nas pontas e gomos inteiros no meio; cada face de corte leva a mesma fração do ângulo total.",
    formulas: ["curva-gomos", "raio-curva", "curva-recuo"],
    method: [
      "Defina o ângulo da curva e o número de gomos.",
      "Calcule β = θ / (2 × (n − 1)).",
      "Marque o corte de cada face com esse ângulo.",
    ],
    example: "Curva 90° com 4 gomos → 6 faces de corte a 15°.",
    prerequisites: ["cilindro-boca-inclinada"],
    relatedParts: ["curva-gomos"],
    relatedTools: ["calculadora", "chamfer"],
    state: "verificado",
  },
  {
    id: "curva-90-pratica",
    title: "Traçado da curva de 90°",
    category: "planificacao",
    concept: "Um gomo traçado, todos os outros por espelhamento.",
    definition:
      "Desenvolve-se um único gomo inteiro; os demais saem por rotação de 180° e os meios-gomos das pontas são metade do mesmo gabarito.",
    formulas: ["curva-gomos", "curva-recuo", "desenvolvimento-cilindro"],
    method: [
      "Desenvolva a virola do gomo com L = π × Dm.",
      "Divida em 12 partes e marque as alturas do corte.",
      "Corte o gabarito e espelhe para os demais gomos.",
      "Monte alternando os gomos e confira o ângulo final.",
    ],
    warnings: ["Aproveitamento de chapa melhora encaixando gomos invertidos lado a lado."],
    prerequisites: ["curva-gomos-conceito"],
    relatedTools: ["chamfer"],
    state: "verificado",
  },
  {
    id: "penetracao-tubos",
    title: "Penetração de tubos",
    category: "planificacao",
    concept: "Dois cilindros que se cruzam se encontram numa curva, nunca numa reta.",
    definition:
      "O tubo menor precisa ser recortado no contorno do maior. Dividindo a boca em partes iguais e medindo a altura de cada geratriz, o recorte aparece no desenvolvimento como uma curva simétrica.",
    formulas: ["intersecao-tubos", "desenvolvimento-cilindro", "corda-divisao"],
    method: [
      "Divida a boca do tubo menor em 12 partes.",
      "Para cada geratriz, calcule a altura de encontro com o tubo maior.",
      "Transporte as alturas para a virola aberta.",
      "Una os pontos e recorte o gabarito.",
    ],
    warnings: [
      "Considere a espessura: o recorte é feito pela face interna que apoia no tubo maior.",
    ],
    prerequisites: ["cilindro-boca-inclinada"],
    relatedTools: ["chamfer", "tracagem"],
    state: "verificado",
  },
  {
    id: "boca-de-lobo",
    title: "Boca de lobo",
    category: "planificacao",
    concept: "É a penetração de tubos vista do lado do tubo derivado.",
    definition:
      "O nome de chão de fábrica para o recorte em sela que permite encaixar um tubo perpendicular ou inclinado em outro de diâmetro igual ou maior.",
    formulas: ["intersecao-tubos", "derivacao-angulo"],
    method: [
      "Confirme diâmetros, ângulo e se o encaixe é sobreposto ou passante.",
      "Trace o recorte pela divisão de geratrizes.",
      "Prove o gabarito no tubo antes de cortar.",
    ],
    commonErrors: [
      "Cortar o recorte pelo diâmetro externo do tubo maior e sobrar folga na raiz da solda.",
    ],
    prerequisites: ["penetracao-tubos"],
    relatedParts: ["boca-de-lobo"],
    relatedTools: ["chamfer"],
    state: "verificado",
  },
  {
    id: "derivacoes-inclinadas",
    title: "Derivações inclinadas",
    category: "planificacao",
    concept: "Quanto mais deitada a derivação, mais comprida fica a boca.",
    definition:
      "Em derivações a 45° ou 60° a boca do tubo derivado vira uma elipse alongada, e o recorte no tubo principal deixa de ser simétrico nos dois sentidos.",
    formulas: ["derivacao-angulo", "intersecao-tubos"],
    warnings: [
      "A abertura no tubo principal enfraquece a linha: reforço pode ser exigido pelo projeto.",
    ],
    prerequisites: ["boca-de-lobo"],
    relatedTools: ["chamfer"],
    state: "verificado",
  },
  {
    id: "acessorios-tubulacao",
    title: "Acessórios de tubulação",
    category: "tubulacao",
    concept: "Cada acessório muda a direção, o diâmetro ou o acesso à linha.",
    definition:
      "Curvas mudam direção, tês derivam, reduções mudam diâmetro, flanges e luvas fazem a ligação e válvulas controlam o fluxo. Cada um ocupa um comprimento próprio na linha.",
    formulas: ["niple-takeout"],
    method: [
      "Identifique o acessório e seu diâmetro nominal.",
      "Levante a ocupação (take-out) de cada um.",
      "Desconte essa ocupação da distância entre centros.",
    ],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "diametro-schedule",
    title: "Diâmetro nominal e schedule",
    category: "tubulacao",
    concept: "O nominal é um nome; quem muda com o schedule é a parede.",
    definition:
      "Para um mesmo diâmetro nominal, o diâmetro externo é fixo e o schedule define a espessura da parede — logo, o diâmetro interno é o que varia.",
    formulas: ["linha-neutra"],
    warnings: ['Tubo de 2" não mede 50,8 mm de diâmetro externo: o nominal não é medida real.'],
    commonErrors: ["Planificar usando o diâmetro nominal em vez do externo real."],
    prerequisites: ["unidades-medida"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "planta-elevacao",
    title: "Planta e elevação",
    category: "tubulacao",
    concept: "Planta é a vista de cima; elevação é a vista de lado.",
    definition:
      "A planta mostra deslocamentos no plano horizontal e a elevação mostra alturas. Um trecho vertical vira um ponto na planta e um trecho horizontal aparece em verdadeira grandeza nela.",
    formulas: ["pitagoras"],
    method: [
      "Localize o norte e a referência de nível.",
      "Leia os deslocamentos na planta e as cotas de altura na elevação.",
      "Combine as duas para obter o percurso real da linha.",
    ],
    commonErrors: [
      "Medir na planta um trecho que está inclinado e tratá-lo como comprimento real.",
    ],
    prerequisites: ["vistas-ortograficas"],
    state: "verificado",
  },
  {
    id: "isometrico",
    title: "Isométricos de tubulação",
    category: "tubulacao",
    concept: "Uma única figura que mostra as três direções da linha.",
    definition:
      "No isométrico os três eixos aparecem a 120° entre si, sem escala, com as medidas escritas. Ele serve para pré-fabricação, lista de material e sequência de montagem.",
    formulas: [],
    method: [
      "Identifique a direção de cada trecho pelos eixos do desenho.",
      "Anote acessórios, soldas de campo e de oficina.",
      "Confira a lista de material contra o traçado.",
    ],
    warnings: ["Isométrico não tem escala: só valem as medidas escritas."],
    prerequisites: ["planta-elevacao"],
    state: "verificado",
  },
  {
    id: "desvios-tubulacao",
    title: "Desvios e deslocamentos",
    category: "tubulacao",
    concept: "Desviar de um obstáculo é resolver um triângulo retângulo.",
    definition:
      "Duas curvas iguais formam o desvio; o deslocamento entre eixos e o ângulo das curvas definem a distância entre centros e, com o desconto dos acessórios, o comprimento de corte.",
    formulas: ["deslocamento-45", "deslocamento-generico", "niple-takeout", "pitagoras"],
    method: [
      "Meça o deslocamento entre as duas linhas.",
      "Escolha o ângulo das curvas.",
      "Calcule a distância entre centros.",
      "Desconte a ocupação dos acessórios e corte o niple.",
    ],
    example: "Desvio de 300 mm com curvas de 45° → 424,3 mm entre centros.",
    prerequisites: ["acessorios-tubulacao", "triangulo-retangulo"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "travessias",
    title: "Travessias e desvios compostos",
    category: "tubulacao",
    concept: "Desvio em duas direções ao mesmo tempo: resolve-se em dois triângulos.",
    definition:
      "Quando a linha se desloca na horizontal e na vertical, calcula-se primeiro a diagonal no plano e depois a diagonal real com essa medida e a altura.",
    formulas: ["pitagoras", "deslocamento-generico", "niple-takeout"],
    method: [
      "Calcule a diagonal no plano: √(a² + b²).",
      "Use essa diagonal e a altura para achar o comprimento real.",
      "Determine o ângulo e escolha as curvas.",
    ],
    prerequisites: ["desvios-tubulacao"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "fator-k",
    title: "Fator K e a fibra neutra",
    category: "fabricacao",
    concept: "A dobra come material: o fator K diz o quanto.",
    definition:
      "O fator K localiza a fibra que não estica nem comprime dentro da espessura. Ele depende do material, do raio e do processo, e é o que separa um desenvolvimento certo de um chute.",
    formulas: ["bend-allowance"],
    warnings: [
      "Fator K adotado sem prova prática gera peça fora de medida: dobre um corpo de prova.",
    ],
    prerequisites: ["linha-neutra-espessura"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "desconto-dobra",
    title: "Desconto de dobra",
    category: "fabricacao",
    concept: "Cotas externas somadas dão sempre mais chapa do que o necessário.",
    definition:
      "O bend deduction é o valor subtraído da soma das abas externas para chegar ao comprimento real da chapa plana.",
    formulas: ["bend-deduction", "bend-allowance", "chapa-plana-dobra"],
    method: [
      "Some as abas externas do desenho.",
      "Calcule o BA de cada dobra.",
      "Calcule o BD e subtraia uma vez por dobra.",
    ],
    example: "Chapa 3 mm, raio 3 mm, dobra 90°, K = 0,44 → BA ≈ 6,79 mm.",
    prerequisites: ["fator-k"],
    relatedTools: ["calculadora"],
    state: "verificado",
  },
  {
    id: "corte-preparacao",
    title: "Corte e preparação de borda",
    category: "fabricacao",
    concept: "A largura do corte e o chanfro precisam entrar no traçado.",
    definition:
      "Todo processo remove material na sangria e a solda exige preparação de borda. Ambos são previstos no desenvolvimento, não corrigidos depois.",
    formulas: [],
    method: [
      "Considere a sangria do processo ao encostar peças no aninhamento.",
      "Marque o chanfro conforme a espessura e o processo de solda.",
      "Identifique cada peça antes de separar do esqueleto da chapa.",
    ],
    relatedTools: ["chamfer"],
    state: "verificado",
  },
  {
    id: "calandra-montagem",
    title: "Calandra e montagem",
    category: "fabricacao",
    concept: "As pontas são a parte mais difícil de curvar.",
    definition:
      "A calandra deixa trechos retos nas extremidades da chapa; por isso as bordas são pré-curvadas ou sobra-se material para corte posterior. Na montagem, o casamento e a circularidade são conferidos antes de soldar.",
    formulas: ["circunferencia"],
    method: [
      "Pré-curve as pontas antes de calandrar o corpo.",
      "Confira o raio com gabarito ao longo de toda a virola.",
      "Ponteie, meça circularidade e diagonais, e só então solde.",
    ],
    warnings: ["Soldar antes de conferir circularidade transforma um ajuste em retrabalho."],
    prerequisites: ["virola-cilindrica"],
    state: "verificado",
  },
  {
    id: "conferencia-final",
    title: "Conferência final",
    category: "fabricacao",
    concept: "Peça conferida na bancada não vira problema no campo.",
    definition:
      "A verificação final compara medidas principais, diagonais, esquadro, circularidade e posição de furação contra o desenho, antes da expedição.",
    formulas: ["pitagoras"],
    method: [
      "Confira as cotas principais e as diagonais.",
      "Verifique esquadro e planeza das faces de apoio.",
      "Confirme furação, identificação e acabamento.",
    ],
    prerequisites: ["referencias-tracagem"],
    state: "verificado",
  },
];

export const knowledgeById = (id: string) => KNOWLEDGE.find((k) => k.id === id) ?? null;
