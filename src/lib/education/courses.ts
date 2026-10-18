export type Lesson = {
  slug: string;
  title: string;
  minutes: number;
  free: boolean;
  theory: string;
  example: string;
  formula: string;
  application: string;
  exercise: string;
};

export type Module = {
  slug: string;
  title: string;
  summary: string;
  lessons: Lesson[];
};

const lesson = (
  slug: string,
  title: string,
  minutes: number,
  free: boolean,
  theory: string,
  example: string,
  formula: string,
  application: string,
  exercise: string,
): Lesson => ({ slug, title, minutes, free, theory, example, formula, application, exercise });

export const MODULES: Module[] = [
  {
    slug: "fundamentos",
    title: "Fundamentos da Caldeiraria",
    summary: "Materiais, processos e vocabulário técnico do chão de fábrica.",
    lessons: [
      lesson(
        "o-que-e-caldeiraria",
        "Fundamentos da Caldeiraria",
        12,
        true,
        "Caldeiraria é a fabricação de peças a partir de chapas e perfis conformados: traçagem, corte, calandragem, dobra e solda. O traçador transforma medidas de projeto em desenvolvimento plano.",
        "Um duto Ø400 × 1500 mm parte de uma chapa de 1256,6 × 1500 mm, calandrada e soldada de topo.",
        "C = π × D",
        "Todo cilindro tem seu desenvolvimento igual ao perímetro pela altura.",
        "Calcule o comprimento da chapa para um duto Ø350 mm.",
      ),
      lesson(
        "leitura-desenho",
        "Leitura de Desenho Técnico",
        18,
        true,
        "Vistas ortográficas, cortes, cotas, tolerâncias e simbologia de solda. Ler o desenho é reconstruir mentalmente a peça no espaço.",
        "Vista frontal e superior de um tronco de cone definem Ø maior, Ø menor e altura.",
        "Escala = medida no desenho ÷ medida real",
        "Confirme sempre a escala antes de escalar medidas ausentes.",
        "Identifique num desenho quais cotas são funcionais e quais são construtivas.",
      ),
      lesson(
        "unidades",
        "Unidades e Conversões",
        10,
        true,
        "Milímetro é a unidade padrão da fabricação metálica. Polegadas aparecem em tubos e chapas importadas.",
        "1'' = 25,4 mm; 1/2'' = 12,7 mm.",
        "mm = pol × 25,4",
        "Converta a espessura antes de qualquer cálculo de massa.",
        "Converta 3/8'' para milímetros.",
      ),
    ],
  },
  {
    slug: "matematica",
    title: "Matemática Aplicada",
    summary: "Álgebra, trigonometria e geometria a serviço da traçagem.",
    lessons: [
      lesson(
        "matematica-aplicada",
        "Matemática Aplicada",
        16,
        true,
        "Proporções, potências e raízes aplicadas a comprimentos verdadeiros e áreas.",
        "Diagonal de um retângulo 400 × 300 = 500 mm.",
        "d = √(a² + b²)",
        "A diagonal é a base do comprimento verdadeiro em triangulação.",
        "Calcule a diagonal de 250 × 180 mm.",
      ),
      lesson(
        "trigonometria",
        "Trigonometria",
        20,
        false,
        "Seno, cosseno e tangente permitem obter ângulos de corte, inclinações e alturas inacessíveis.",
        "Inclinação de um cone com Ø maior 700, Ø menor 400 e h 600.",
        "tg α = (D − d) / (2 × h)",
        "O ângulo de meia-abertura define o corte da chapa e o gabarito.",
        "Determine α para D=700, d=400, h=600.",
      ),
      lesson(
        "geometria",
        "Geometria",
        14,
        false,
        "Lugares geométricos, arcos, cordas e divisão de circunferência.",
        "Dividir Ø300 em 12 partes gera cordas de 77,65 mm.",
        "corda = 2 × R × sen(180°/n)",
        "Divisão por cordas é o método de marcação na chapa.",
        "Calcule a corda para Ø500 em 16 divisões.",
      ),
    ],
  },
  {
    slug: "planificacao",
    title: "Planificação e Traçagem",
    summary: "Métodos de desenvolvimento e sua escolha correta.",
    lessons: [
      lesson(
        "planificacao",
        "Planificação",
        18,
        false,
        "Superfícies desenvolvíveis (cilindros, cones) x não desenvolvíveis (esferas). O método muda conforme a superfície.",
        "Cone reto se desenvolve como setor circular de raio igual à geratriz.",
        "θ = 360° × R / g",
        "Escolher o método errado gera peça que não fecha.",
        "Planifique um cone com R=200 e g=520.",
      ),
      lesson(
        "triangulacao",
        "Triangulação",
        22,
        false,
        "Divide a superfície em triângulos e rebate cada um pelo comprimento verdadeiro. Método obrigatório em transições oblíquas.",
        "Transição 400×400 → Ø300 com 6 divisões por quadrante gera 28 triângulos.",
        "L = √(Δx² + Δy² + Δz²)",
        "Base do módulo Quadrado → Redondo do CALDRA.",
        "Calcule a geratriz do vértice (200;200;0) até (150;0;500).",
      ),
      lesson(
        "interseccoes",
        "Interseções",
        20,
        false,
        "Linha de penetração entre sólidos, obtida por planos auxiliares ou geratrizes correspondentes.",
        "Tê Ø400 × Ø250: pontos obtidos por geratrizes correspondentes.",
        "z = √(R² − x²)",
        "Necessária em boca de lobo, tê e Y.",
        "Determine 5 pontos da penetração para R=200 e r=125.",
      ),
      lesson(
        "tracagem",
        "Traçagem",
        12,
        false,
        "Transferência do desenvolvimento para a chapa: referências, riscador, punção e conferência.",
        "Marque sempre a linha de costura e a numeração das geratrizes.",
        "—",
        "Conferir diagonais evita peça torta após a dobra.",
        "Liste a sequência de traçagem de uma virola.",
      ),
    ],
  },
  {
    slug: "dobra",
    title: "Dobra e Descontos",
    summary: "Fator K, bend allowance e bend deduction.",
    lessons: [
      lesson(
        "desconto",
        "Desconto de Dobra",
        14,
        false,
        "O material estira na dobra: o desenvolvimento plano é menor que a soma das abas.",
        "Chapa 3 mm, dobra 90°, raio interno 3 mm.",
        "BD = 2 × (Ri + e) − BA",
        "Sem desconto, a peça sai maior que o projeto.",
        "Calcule o desconto para Ri=3, e=3, 90°.",
      ),
      lesson(
        "fator-k",
        "Fator K",
        16,
        false,
        "Posição da linha neutra em relação à espessura. Depende de material, raio e processo.",
        "Aço carbono dobrado a 90°: K entre 0,38 e 0,44.",
        "K = t / e (t = distância da face interna à linha neutra)",
        "É o parâmetro que calibra o BA com a realidade da máquina.",
        "Meça uma peça-teste e determine o K da sua dobradeira.",
      ),
      lesson(
        "bend-allowance",
        "Bend Allowance",
        14,
        false,
        "Comprimento de arco da linha neutra dentro da dobra.",
        "Ri=3, e=3, K=0,42, ângulo 90°.",
        "BA = (π/180) × α × (Ri + K × e)",
        "Somado às abas retas, dá o desenvolvimento total.",
        "Calcule o BA do exemplo acima.",
      ),
      lesson(
        "bend-deduction",
        "Bend Deduction",
        12,
        false,
        "Valor subtraído da soma das cotas externas para obter o corte plano.",
        "Duas abas de 100 mm com BD 5,4 mm → corte de 194,6 mm.",
        "L = A + B − BD",
        "É o número que vai para a serra ou o laser.",
        "Determine o corte para abas de 120 e 80 mm com BD 6 mm.",
      ),
    ],
  },
];

export function findLesson(slug: string) {
  for (const m of MODULES) {
    const l = m.lessons.find((x) => x.slug === slug);
    if (l) return { module: m, lesson: l };
  }
  return null;
}
