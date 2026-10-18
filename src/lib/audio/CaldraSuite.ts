/**
 * CALDRA ORIGINAL AMBIENT SOUNDTRACK — "THE ARCHITECTURE OF CURIOSITY"
 *
 * Uma composição instrumental 100% original criada para o CALDRA.
 * Inspirada na arquitetura sonora sutil e minimalista de obras atmosféricas
 * como as de C418 (Haggstrom, Key, Living Mice, Minecraft):
 *
 * - Piano acústico/elétrico extremamente suave e espaçado
 * - Kalimba / mallets cristalinos e orgânicos respondendo nos espaços
 * - Celesta e glockenspiel pontuais em mudanças harmônicas
 * - Harpa dedilhada delicada como textura
 * - Cordas sustentadas lentas e serenas na expansão
 * - Pad analógico quente como "ar" atrás do piano (Moog/Prophet style)
 * - Textura synth ambiente, shimmer granular e ruído tonal sutil
 * - Sub-bass eletrônico discreto (profundidade pura, sem batida)
 * - Grande sensação de espaço, reverberação longa e silêncio ativo
 *
 * Estrutura:
 * [0:00 - 0:30] INTRO — CURIOSIDADE: Piano sozinho, muito espaço e silêncio.
 * [0:30 - 1:00] AR & ESPAÇO: Piano + pad analógico distante.
 * [1:00 - 1:30] REFLEXO: Pequeno elemento cristalino (celesta/glockenspiel).
 * [1:30 - 2:05] EXPLORAÇÃO: Kalimba / mallet orgânico respondendo.
 * [2:05 - 2:40] EXPANSÃO HARMÔNICA: Cordas muito leves, harpa textural e subgrave.
 * [2:40 - 3:10] CONTEMPLAÇÃO: Retirada lenta das camadas.
 * [3:10 - 3:30] RETORNO & LOOP PERFEITO: Piano + ambiente com resolução aberta.
 */

export interface MovementDescriptor {
  index: number;
  name: string;
  narrative: string;
  startTime: number;
  endTime: number;
  description: string;
}

export const CALDRA_MOVEMENTS: MovementDescriptor[] = [
  {
    index: 0,
    name: "Intro — Curiosidade",
    narrative: "CURIOSITY",
    startTime: 0,
    endTime: 30,
    description: "Piano íntimo e solitário, notas raras com reverb longo e silêncio generoso.",
  },
  {
    index: 1,
    name: "Ar & Espaço — Pad Distante",
    narrative: "ATMOSPHERE",
    startTime: 30,
    endTime: 60,
    description: "Pad analógico suave entra como ar morno por trás das frases do piano.",
  },
  {
    index: 2,
    name: "Reflexo — Ponto de Luz",
    narrative: "DISCOVERY",
    startTime: 60,
    endTime: 90,
    description: "Sinos cristalinos e glockenspiel pontual destacando mudanças harmônicas.",
  },
  {
    index: 3,
    name: "Exploração — Resposta da Kalimba",
    narrative: "EXPLORATION",
    startTime: 90,
    endTime: 125,
    description: "Mallets de kalimba macia respondem aos vazios melódicos com leveza e movimento.",
  },
  {
    index: 4,
    name: "Expansão Harmônica — Cordas & Harpa",
    narrative: "EXPANSION",
    startTime: 125,
    endTime: 160,
    description: "Cordas sutis, arpejos de harpa e subgrave discreto sem bateria ou peso excessivo.",
  },
  {
    index: 5,
    name: "Contemplação — Recolhimento",
    narrative: "CONTEMPLATION",
    startTime: 160,
    endTime: 190,
    description: "Retirada gradual e serena das camadas acústicas e eletrônicas.",
  },
  {
    index: 6,
    name: "Retorno & Loop Perfeito",
    narrative: "RENEWAL",
    startTime: 190,
    endTime: 210,
    description: "Piano e ambiência final com resolução aberta que conecta de volta ao início.",
  },
];

export const TOTAL_SUITE_DURATION = 210; // 3 minutos e 30 segundos (Loop Perfeito)

export type InstrumentType =
  | "felt_piano"
  | "kalimba"
  | "handpan"
  | "celesta"
  | "harp"
  | "strings"
  | "cello"
  | "double_bass"
  | "analog_pad"
  | "synth_texture"
  | "woodwind"
  | "ancient_choir"
  | "sub_bass";

export interface ScoreEvent {
  t: number; // Offset em segundos (0 a 210)
  instrument: InstrumentType;
  frequencies: number[]; // Frequência(s) em Hz
  velocity: number; // 0.01 a 0.08
  duration: number; // Duração do sustain em segundos
  pan?: number; // Panorâmica estéreo (-0.8 a 0.8)
}

/**
 * PARTITURA COMPLETA DE "CALDRA — THE ARCHITECTURE OF CURIOSITY"
 *
 * ESCRITA HARMÔNICA APERFEIÇOADA DO PIANO DE FELTRO:
 * - Acompanhamento harmônico rico: acordes simultâneos, intervalos e voicings abertos
 * - Separação de registros: mão esquerda fornecendo graves e quintas/oitavas, mão direita tecendo o tema com extensões
 * - Evolução gradual da densidade:
 *   [0:00 - 0:30] INTRO: Simples, intervalos abertos (5ªs, 6ªs), grande espaço e silêncio ativo.
 *   [0:30 - 1:00] EXPLORAÇÃO: Voicings abertos, tríades com 9ª, diálogo suave.
 *   [1:00 - 1:30] DESCOBERTA: Acordes completos (Gmaj7#11, Bm9), arpejos suaves e movimento harmônico.
 *   [1:30 - 2:05] TENSÃO: Acordes suspensos (sus2, sus4), inversões e extensões expressivas.
 *   [2:05 - 2:40] CLÍMAX: Plenitude harmônica máxima, acordes de 4-5 notas em múltiplos registros.
 *   [2:40 - 3:10] CONTEMPLAÇÃO: Desaceleração gradual, dissolução em acordes espaçados e flutuantes.
 *   [3:10 - 3:30] RESOLUÇÃO & LOOP: Retorno às díades essenciais e acorde final Dadd9 suspenso.
 */
export const CALDRA_SCORE: ScoreEvent[] = [
  // =========================================================================
  // 1. INTRO [0:00 - 0:30] — CURIOSIDADE (SOLITÁRIO → ESPAÇO)
  // Tema principal reconhecível, agora apoiado por intervalos e díades abertas.
  // Mão esquerda ancorando a fundamental em espaço generoso.
  // =========================================================================

  // Abertura: Quinta aberta acolhedora na mão esquerda + início do tema (D4)
  { t: 3.0, instrument: "felt_piano", frequencies: [146.83, 220.0], velocity: 0.046, duration: 4.8, pan: -0.08 }, // Mão esquerda: D3 + A3 (5ª aberta)
  { t: 3.3, instrument: "felt_piano", frequencies: [293.66], velocity: 0.052, duration: 4.4, pan: 0.0 }, // Mão direita: D4 (tema)

  // Desenvolvimento do motivo: Intervalo de 6ª expressiva [A3 + F#4]
  { t: 6.4, instrument: "felt_piano", frequencies: [220.0, 369.99], velocity: 0.05, duration: 4.5, pan: 0.02 },

  // Continuação: Baixo D3 segurando + díade de oitava e quinta [D4 + A4]
  { t: 9.6, instrument: "felt_piano", frequencies: [146.83], velocity: 0.044, duration: 5.0, pan: -0.06 }, // Baixo D3
  { t: 9.8, instrument: "felt_piano", frequencies: [293.66, 440.0], velocity: 0.052, duration: 4.5, pan: 0.05 }, // [D4, A4]

  // A Pergunta Musical: Suspensão lírica de 9ª sobre a 7ª maior [C#4 + E5]
  { t: 13.0, instrument: "felt_piano", frequencies: [277.18, 659.25], velocity: 0.056, duration: 5.2, pan: 0.08 },

  // Resolução no ar: Intervalo aberto de 5ª [F#4 + C#5]
  { t: 16.5, instrument: "felt_piano", frequencies: [369.99, 554.37], velocity: 0.048, duration: 5.5, pan: 0.0 },

  // [17.5s a 20.5s: Silêncio ativo, respiração e cauda de reverberação]

  // Resposta do tema: Mão esquerda entra em Si menor com 5ª aberta [B2 + F#3], mão direita [D4 + B4]
  { t: 21.0, instrument: "felt_piano", frequencies: [123.47, 185.0], velocity: 0.045, duration: 4.2, pan: -0.08 }, // [B2, F#3]
  { t: 21.3, instrument: "felt_piano", frequencies: [293.66, 493.88], velocity: 0.05, duration: 4.0, pan: 0.04 }, // [D4, B4]

  // Nota de passagem conectando: Intervalo suave [A3 + F#4]
  { t: 23.8, instrument: "felt_piano", frequencies: [220.0, 369.99], velocity: 0.046, duration: 3.8, pan: 0.0 },

  // Penúltima resposta: Díade [D4 + A4]
  { t: 26.2, instrument: "felt_piano", frequencies: [293.66, 440.0], velocity: 0.048, duration: 4.0, pan: 0.04 },

  // Fechamento da Intro: Acorde aberto Dadd9 repousando antes do pad [D3 + A3 + E4 + F#4]
  { t: 28.5, instrument: "felt_piano", frequencies: [146.83, 220.0, 329.63, 369.99], velocity: 0.046, duration: 5.5, pan: -0.02 },

  // =========================================================================
  // 2. AR & ESPAÇO [0:30 - 1:00] — EXPLORAÇÃO (HARMÔNICO & VOICINGS ABERTOS)
  // O piano desenvolve acordes suaves e voicings abertos sobre a cama analógica.
  // Mão esquerda provê o baixo profundo; mão direita desenvolve o tema com 3ª, 5ª e extensões.
  // =========================================================================
  {
    t: 30.0,
    instrument: "analog_pad",
    frequencies: [146.83, 220.0, 293.66, 369.99], // D3, A3, D4, F#4
    velocity: 0.026,
    duration: 14.0,
    pan: 0.0,
  },

  // Acorde quebrado aberto Dmaj9: Mão esquerda no registro grave, mão direita responde com o tema
  { t: 32.5, instrument: "felt_piano", frequencies: [73.42, 146.83], velocity: 0.044, duration: 5.5, pan: -0.1 }, // Mão esquerda: D2 + D3 (oitava profunda)
  { t: 33.0, instrument: "felt_piano", frequencies: [220.0, 277.18, 369.99], velocity: 0.05, duration: 4.2, pan: 0.0 }, // Mão direita: [A3, C#4, F#4]

  // Desenvolvimento melódico apoiado por harmonia: Acorde aberto [D4 + A4] com nota de passagem
  { t: 36.0, instrument: "felt_piano", frequencies: [293.66, 440.0], velocity: 0.052, duration: 3.8, pan: 0.04 },
  { t: 37.5, instrument: "felt_piano", frequencies: [369.99, 493.88], velocity: 0.048, duration: 3.2, pan: 0.06 }, // Passagem [F#4, B4]

  // F#m7(add11) em voicing aberto: Mão esquerda [F#2 + C#3], mão direita [A3 + E4 + C#5]
  { t: 39.2, instrument: "felt_piano", frequencies: [92.5, 138.59], velocity: 0.046, duration: 5.0, pan: -0.08 },
  { t: 39.5, instrument: "felt_piano", frequencies: [220.0, 329.63, 554.37], velocity: 0.053, duration: 4.4, pan: 0.05 },

  // O motivo atinge a 10ª luminosa [F#5] sustentada por acorde aberto [D4 + A4 + F#5]
  { t: 42.5, instrument: "felt_piano", frequencies: [146.83, 220.0], velocity: 0.046, duration: 5.2, pan: -0.04 },
  { t: 42.8, instrument: "felt_piano", frequencies: [293.66, 440.0, 739.99], velocity: 0.055, duration: 5.0, pan: 0.08 },

  // Modulação suave para Sol Maior com nona no pad
  {
    t: 45.0,
    instrument: "analog_pad",
    frequencies: [196.0, 246.94, 293.66, 440.0], // G3, B3, D4, A4
    velocity: 0.028,
    duration: 14.0,
    pan: 0.0,
  },

  // Progressão do piano para Gmaj9: Mão esquerda [G2 + D3], mão direita [B3 + F#4 + A4]
  { t: 47.0, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.046, duration: 5.2, pan: -0.08 },
  { t: 47.4, instrument: "felt_piano", frequencies: [246.94, 369.99, 440.0], velocity: 0.051, duration: 4.2, pan: 0.02 },

  // Arpejo suave quebrado ascendente com o tema
  { t: 50.2, instrument: "felt_piano", frequencies: [293.66, 392.0, 493.88], velocity: 0.05, duration: 4.0, pan: 0.04 }, // [D4, G4, B4]

  // Em9 em voicing aberto: Mão esquerda [E2 + B2], mão direita [G3 + D4 + D5]
  { t: 53.0, instrument: "felt_piano", frequencies: [82.41, 123.47], velocity: 0.045, duration: 5.0, pan: -0.06 },
  { t: 53.3, instrument: "felt_piano", frequencies: [196.0, 293.66, 587.33], velocity: 0.052, duration: 4.2, pan: 0.05 },

  // Cadência lídia aberta com a 9ª suspensa [F#4 + A4 + C#5 + E5]
  { t: 56.5, instrument: "felt_piano", frequencies: [369.99, 440.0, 554.37, 659.25], velocity: 0.052, duration: 5.0, pan: 0.06 },

  // =========================================================================
  // 3. REFLEXO [1:00 - 1:30] — DESCOBERTA (ACORDES COMPLETOS & MOVIMENTO)
  // O piano introduz acordes mais completos e arpejos suaves, dialogando com
  // a celesta e preparando a expansão.
  // =========================================================================
  {
    t: 60.0,
    instrument: "analog_pad",
    frequencies: [185.0, 246.94, 293.66, 369.99], // F#3, B3, D4, F#4 (Bm9)
    velocity: 0.025,
    duration: 15.0,
    pan: 0.0,
  },

  // Textura synth ambiente muito distante
  { t: 61.0, instrument: "synth_texture", frequencies: [880.0, 1318.51], velocity: 0.016, duration: 16.0, pan: 0.4 },

  // Bm9 com arpejo e voicing completo:
  // Mão esquerda [B2 + F#3], mão direita entra com acorde quebrado [D4 + A4 + C#5]
  { t: 61.8, instrument: "felt_piano", frequencies: [123.47, 185.0], velocity: 0.046, duration: 5.0, pan: -0.08 },
  { t: 62.2, instrument: "felt_piano", frequencies: [293.66, 440.0, 554.37], velocity: 0.052, duration: 4.2, pan: 0.02 },

  // Movimento harmônico de passagem para Aadd9/C#: Mão esquerda [C#3 + G#3], mão direita [E4 + B4 + C#5]
  { t: 65.2, instrument: "felt_piano", frequencies: [138.59, 207.65], velocity: 0.046, duration: 4.5, pan: -0.04 },
  { t: 65.5, instrument: "felt_piano", frequencies: [329.63, 493.88, 554.37], velocity: 0.05, duration: 4.0, pan: 0.03 },

  // Ponto de luz da Celesta (E6)
  { t: 67.5, instrument: "celesta", frequencies: [1318.51], velocity: 0.032, duration: 3.2, pan: 0.35 },

  // O piano acolhe a Celesta com o acorde revelador de Gmaj7#11 (Dó# lídio):
  // Mão esquerda [G2 + D3], mão direita [B3 + F#4 + C#5 + E5]
  { t: 69.5, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.048, duration: 5.5, pan: -0.08 },
  { t: 69.8, instrument: "felt_piano", frequencies: [246.94, 369.99, 554.37, 659.25], velocity: 0.054, duration: 4.8, pan: 0.06 },

  // Arpejo descendente suave de resolução: [D5 -> A4 -> F#4] sobre o pedal de baixo
  { t: 73.2, instrument: "felt_piano", frequencies: [369.99, 440.0, 587.33], velocity: 0.05, duration: 4.2, pan: 0.02 },

  // Segundo ponto cristalino da celesta (#11 em G#6)
  { t: 76.0, instrument: "celesta", frequencies: [1661.22], velocity: 0.03, duration: 3.0, pan: -0.3 },

  // Resposta do piano em D/F# rico: Mão esquerda [F#2 + C#3], mão direita [A3 + E4 + A4]
  { t: 77.8, instrument: "felt_piano", frequencies: [92.5, 138.59], velocity: 0.046, duration: 4.8, pan: -0.06 },
  { t: 78.1, instrument: "felt_piano", frequencies: [220.0, 329.63, 440.0], velocity: 0.049, duration: 4.2, pan: 0.0 },

  // Progressão cadencial acolhedora em Gadd9 -> Asus4:
  { t: 81.2, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.046, duration: 5.0, pan: -0.06 },
  { t: 81.5, instrument: "felt_piano", frequencies: [246.94, 293.66, 369.99, 493.88], velocity: 0.05, duration: 4.2, pan: 0.04 }, // [B3, D4, F#4, B4]

  // Cadência resolutiva em Asus4 para A: [A2 + E3] no baixo, [C#4 + E4 + A4 + C#5] no topo
  { t: 84.8, instrument: "felt_piano", frequencies: [110.0, 164.81], velocity: 0.045, duration: 5.5, pan: -0.04 },
  { t: 85.1, instrument: "felt_piano", frequencies: [277.18, 329.63, 440.0, 554.37], velocity: 0.048, duration: 5.0, pan: 0.02 },

  // =========================================================================
  // 4. EXPLORAÇÃO [1:30 - 2:05] — TENSÃO & INCERTEZA (SUSPENSÃO & EXTENSÕES)
  // Acordes suspensos (sus2, sus4), inversões, pequenas dissonâncias controladas
  // e diálogo responsivo com a kalimba/handpan.
  // =========================================================================
  {
    t: 90.0,
    instrument: "analog_pad",
    frequencies: [146.83, 220.0, 277.18, 369.99], // D3, A3, C#4, F#4 (Dmaj7)
    velocity: 0.026,
    duration: 16.0,
    pan: 0.0,
  },

  // Pergunta com suspensão Dsus4/2: Mão esquerda [D3 + G3], mão direita [A3 + D4 + E4]
  { t: 91.8, instrument: "felt_piano", frequencies: [146.83, 196.0], velocity: 0.048, duration: 4.6, pan: -0.08 },
  { t: 92.1, instrument: "felt_piano", frequencies: [220.0, 293.66, 329.63], velocity: 0.052, duration: 4.2, pan: 0.0 },

  // Inversão em D/F# com 9ª: Mão esquerda [F#2 + D3], mão direita [A3 + C#4 + F#4]
  { t: 94.6, instrument: "felt_piano", frequencies: [92.5, 146.83], velocity: 0.046, duration: 4.4, pan: -0.06 },
  { t: 94.9, instrument: "felt_piano", frequencies: [220.0, 277.18, 369.99], velocity: 0.05, duration: 4.0, pan: 0.02 },

  // Tensão suave com intervalo de 2ª menor / cluster controlado:
  // Mão esquerda [G2 + D3], mão direita [F#4 + G4 + B4 + D5] (tensão harmônica expressiva que busca resolução)
  { t: 97.0, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.048, duration: 5.0, pan: -0.06 },
  { t: 97.3, instrument: "felt_piano", frequencies: [369.99, 392.0, 493.88, 587.33], velocity: 0.053, duration: 4.5, pan: 0.05 },

  // RESPOSTA DA KALIMBA / HANDPAN NO ESPAÇO ENTRE ACORDES
  { t: 99.0, instrument: "kalimba", frequencies: [739.99], velocity: 0.044, duration: 2.8, pan: 0.22 }, // F#5
  { t: 100.2, instrument: "kalimba", frequencies: [659.25], velocity: 0.042, duration: 2.8, pan: 0.2 }, // E5
  { t: 101.5, instrument: "kalimba", frequencies: [587.33], velocity: 0.04, duration: 3.2, pan: 0.25 }, // D5

  // Piano responde com modulação suspensa para Em11:
  // Mão esquerda [E2 + B2], mão direita acorde estendido [G3 + D4 + F#4 + C#5]
  { t: 103.5, instrument: "felt_piano", frequencies: [82.41, 123.47], velocity: 0.048, duration: 5.2, pan: -0.08 },
  { t: 103.8, instrument: "felt_piano", frequencies: [196.0, 293.66, 369.99, 554.37], velocity: 0.054, duration: 4.4, pan: 0.04 },

  // Movimento de contraponto: Melodia [D5 -> E5 -> F#5] sobre inversão de baixo [C#3 + G#3]
  { t: 106.8, instrument: "felt_piano", frequencies: [138.59, 207.65], velocity: 0.046, duration: 4.5, pan: -0.04 },
  { t: 107.1, instrument: "felt_piano", frequencies: [329.63, 440.0, 659.25], velocity: 0.052, duration: 4.0, pan: 0.08 },

  // Segunda resposta delicada da Kalimba / Handpan
  { t: 109.5, instrument: "kalimba", frequencies: [880.0], velocity: 0.045, duration: 2.8, pan: -0.22 }, // A5
  { t: 111.0, instrument: "kalimba", frequencies: [739.99], velocity: 0.042, duration: 3.0, pan: -0.2 }, // F#5
  { t: 112.5, instrument: "kalimba", frequencies: [554.37], velocity: 0.038, duration: 3.5, pan: -0.18 }, // C#5

  // Preparação para o clímax: Acorde suspenso Asus4(add9) com resolução suave
  { t: 114.5, instrument: "felt_piano", frequencies: [110.0, 164.81], velocity: 0.048, duration: 4.8, pan: -0.04 },
  { t: 114.8, instrument: "felt_piano", frequencies: [293.66, 392.0, 493.88], velocity: 0.05, duration: 4.0, pan: 0.02 }, // Asus4
  { t: 117.8, instrument: "felt_piano", frequencies: [277.18, 329.63, 440.0, 554.37], velocity: 0.051, duration: 5.2, pan: 0.04 }, // Resolução em Aadd9

  { t: 121.5, instrument: "celesta", frequencies: [1108.73], velocity: 0.03, duration: 3.2, pan: 0.3 },

  // =========================================================================
  // 5. EXPANSÃO HARMÔNICA [2:05 - 2:40] — CLÍMAX & COMPREENSÃO (PLENITUDE)
  // O piano atinge sua maior riqueza harmônica: acordes completos de 4-5 notas,
  // voicings amplos entre mão esquerda (fundamentos profundos) e direita (tema pleno).
  // =========================================================================
  // Sub-bass eletrônico discreto (profundidade acústica sem batida)
  { t: 125.0, instrument: "sub_bass", frequencies: [36.71], velocity: 0.042, duration: 16.0, pan: 0.0 }, // D1

  // Cordas suaves sustentadas
  {
    t: 125.5,
    instrument: "strings",
    frequencies: [185.0, 220.0, 277.18, 369.99], // F#3, A3, C#4, F#4
    velocity: 0.032,
    duration: 16.0,
    pan: 0.0,
  },

  // Harpa dedilhada delicada em arpejo textural
  { t: 126.8, instrument: "harp", frequencies: [146.83], velocity: 0.034, duration: 3.5, pan: 0.2 },
  { t: 127.3, instrument: "harp", frequencies: [220.0], velocity: 0.036, duration: 3.5, pan: 0.24 },
  { t: 127.8, instrument: "harp", frequencies: [369.99], velocity: 0.038, duration: 3.6, pan: 0.28 },
  { t: 128.3, instrument: "harp", frequencies: [554.37], velocity: 0.04, duration: 3.8, pan: 0.32 },
  { t: 128.8, instrument: "harp", frequencies: [659.25], velocity: 0.042, duration: 4.2, pan: 0.35 },

  // ENTRADA DO CLÍMAX DO PIANO — GRANDE ACORDE ABERTO Dmaj9:
  // Mão esquerda no registro orquestral [D2 + A2 + D3], mão direita [F#3 + C#4 + F#4 + A4]
  { t: 129.5, instrument: "felt_piano", frequencies: [73.42, 110.0, 146.83], velocity: 0.056, duration: 6.0, pan: -0.1 },
  { t: 129.9, instrument: "felt_piano", frequencies: [185.0, 277.18, 369.99, 440.0], velocity: 0.058, duration: 5.2, pan: 0.02 },

  // Arpejo ascendente estendido conectando o tema em registro amplo
  { t: 132.8, instrument: "felt_piano", frequencies: [146.83, 220.0], velocity: 0.048, duration: 5.0, pan: -0.06 },
  { t: 133.1, instrument: "felt_piano", frequencies: [293.66, 369.99, 440.0, 554.37], velocity: 0.056, duration: 4.8, pan: 0.06 }, // [D4, F#4, A4, C#5]

  // Inversão com o tema em expansão lírica: Mão esquerda [F#2 + C#3], mão direita [A3 + E4 + A4 + D5]
  { t: 135.5, instrument: "felt_piano", frequencies: [92.5, 138.59], velocity: 0.05, duration: 5.2, pan: -0.08 },
  { t: 135.8, instrument: "felt_piano", frequencies: [220.0, 329.63, 440.0, 587.33], velocity: 0.058, duration: 4.8, pan: 0.04 },

  // Ponto de iluminação máxima: Mão esquerda [G2 + D3], mão direita acorde com a 9ª e 10ª elevadas [B3 + F#4 + D5 + E5]
  { t: 138.2, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.052, duration: 5.5, pan: -0.08 },
  { t: 138.5, instrument: "felt_piano", frequencies: [246.94, 369.99, 587.33, 659.25], velocity: 0.06, duration: 5.0, pan: 0.08 },

  // Celesta chime com a harpa
  { t: 139.0, instrument: "celesta", frequencies: [1318.51], velocity: 0.034, duration: 3.5, pan: 0.28 },

  // Ápice lírico do piano: Acorde aberto suspenso [F#4 + C#5 + A5] iluminando a orquestra
  { t: 141.5, instrument: "felt_piano", frequencies: [369.99, 554.37, 880.0], velocity: 0.058, duration: 5.5, pan: 0.06 },

  // Segunda frase da expansão: Sol Maior / Si Menor
  { t: 143.0, instrument: "sub_bass", frequencies: [49.0], velocity: 0.04, duration: 15.0, pan: 0.0 }, // G1
  {
    t: 143.5,
    instrument: "strings",
    frequencies: [196.0, 246.94, 293.66, 440.0],
    velocity: 0.034,
    duration: 15.0,
    pan: 0.0,
  },

  // Harpa cascata descendente
  { t: 144.5, instrument: "harp", frequencies: [880.0], velocity: 0.036, duration: 3.2, pan: -0.22 },
  { t: 145.0, instrument: "harp", frequencies: [739.99], velocity: 0.034, duration: 3.2, pan: -0.24 },
  { t: 145.5, instrument: "harp", frequencies: [587.33], velocity: 0.032, duration: 3.4, pan: -0.26 },
  { t: 146.0, instrument: "harp", frequencies: [440.0], velocity: 0.03, duration: 3.6, pan: -0.28 },

  // Kalimba eco suave
  { t: 148.0, instrument: "kalimba", frequencies: [587.33], velocity: 0.038, duration: 3.2, pan: 0.18 },
  { t: 149.5, instrument: "kalimba", frequencies: [493.88], velocity: 0.036, duration: 3.4, pan: 0.15 },

  // Cadência grandiosa do piano em Bm11 -> Gmaj9:
  // Mão esquerda [B2 + F#3], mão direita [D4 + A4 + C#5 + F#5]
  { t: 151.2, instrument: "felt_piano", frequencies: [123.47, 185.0], velocity: 0.052, duration: 5.2, pan: -0.08 },
  { t: 151.5, instrument: "felt_piano", frequencies: [293.66, 440.0, 554.37, 739.99], velocity: 0.056, duration: 4.8, pan: 0.04 },

  // Resolução em cascata [B3 + F#4 + B4 + D5]
  { t: 154.5, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.048, duration: 5.0, pan: -0.06 },
  { t: 154.8, instrument: "felt_piano", frequencies: [246.94, 369.99, 493.88, 587.33], velocity: 0.052, duration: 4.5, pan: 0.02 },

  // Acorde de repouso quente em Aadd9: Mão esquerda [A2 + E3], mão direita [C#4 + E4 + A4 + E5]
  { t: 157.5, instrument: "felt_piano", frequencies: [110.0, 164.81], velocity: 0.046, duration: 5.5, pan: -0.04 },
  { t: 157.8, instrument: "felt_piano", frequencies: [277.18, 329.63, 440.0, 659.25], velocity: 0.05, duration: 5.0, pan: 0.0 },

  // =========================================================================
  // 6. CONTEMPLAÇÃO [2:40 - 3:10] — RECOLHIMENTO (DESACELERAÇÃO & SERENIDADE)
  // Redução gradual da densidade harmônica. O piano retorna a voicings espaçados,
  // tríades suaves e intervalos tranquilos.
  // =========================================================================
  {
    t: 162.0,
    instrument: "analog_pad",
    frequencies: [146.83, 220.0, 293.66],
    velocity: 0.024,
    duration: 16.0,
    pan: 0.0,
  },

  // Tríade flutuante suave D6/9: Mão esquerda [D3 + A3], mão direita [F#4 + B4 + D5]
  { t: 163.5, instrument: "felt_piano", frequencies: [146.83, 220.0], velocity: 0.044, duration: 5.0, pan: -0.06 },
  { t: 163.8, instrument: "felt_piano", frequencies: [369.99, 493.88, 587.33], velocity: 0.048, duration: 4.5, pan: 0.02 },

  // Díade de repouso suave [E4 + A4]
  { t: 166.8, instrument: "felt_piano", frequencies: [329.63, 440.0], velocity: 0.046, duration: 4.2, pan: 0.0 },

  // Última resposta suave da kalimba
  { t: 169.5, instrument: "kalimba", frequencies: [659.25], velocity: 0.036, duration: 3.0, pan: 0.15 },
  { t: 171.0, instrument: "kalimba", frequencies: [554.37], velocity: 0.034, duration: 3.2, pan: 0.12 },
  { t: 172.5, instrument: "kalimba", frequencies: [440.0], velocity: 0.032, duration: 3.5, pan: 0.1 },

  // Acorde sereno em Sol: Mão esquerda [G2 + D3], mão direita [B3 + D4 + F#4]
  { t: 174.5, instrument: "felt_piano", frequencies: [98.0, 146.83], velocity: 0.042, duration: 4.8, pan: -0.06 },
  { t: 174.8, instrument: "felt_piano", frequencies: [246.94, 293.66, 369.99], velocity: 0.046, duration: 4.2, pan: 0.0 },

  // Intervalo de 5ª aberta com nota de passagem lírica
  { t: 178.0, instrument: "felt_piano", frequencies: [220.0, 329.63], velocity: 0.044, duration: 4.5, pan: 0.0 },
  { t: 179.5, instrument: "felt_piano", frequencies: [369.99], velocity: 0.042, duration: 3.8, pan: 0.02 }, // Passagem F#4

  // Resolução em tríade de Lá com nona [A2 + E3] / [C#4 + E4 + A4]
  { t: 181.8, instrument: "felt_piano", frequencies: [110.0, 164.81], velocity: 0.042, duration: 5.0, pan: -0.04 },
  { t: 182.1, instrument: "felt_piano", frequencies: [277.18, 329.63, 440.0], velocity: 0.045, duration: 4.8, pan: 0.0 },

  // Sopro de textura analógica esvaindo-se
  { t: 184.0, instrument: "synth_texture", frequencies: [587.33, 880.0], velocity: 0.014, duration: 12.0, pan: -0.3 },

  // =========================================================================
  // 7. RETORNO & LOOP PERFEITO [3:10 - 3:30] — CURIOSIDADE RENOVADA
  // O tema retorna com simplicidade purificada, mas enriquecido com díades
  // de sustentação e um acorde final Dadd9 aberto que conecta de volta ao início.
  // =========================================================================

  // Tema em díades suaves: Mão esquerda [D3 + A3], mão direita [D4 + F#4]
  { t: 191.0, instrument: "felt_piano", frequencies: [146.83, 220.0], velocity: 0.042, duration: 5.0, pan: -0.06 },
  { t: 191.3, instrument: "felt_piano", frequencies: [293.66, 369.99], velocity: 0.046, duration: 4.5, pan: 0.0 },

  // Intervalo de 3ª [F#4 + A4]
  { t: 194.2, instrument: "felt_piano", frequencies: [369.99, 440.0], velocity: 0.044, duration: 4.2, pan: 0.02 },

  // Mão esquerda [D3 + F#3], mão direita [A4 + D5]
  { t: 197.5, instrument: "felt_piano", frequencies: [146.83, 185.0], velocity: 0.042, duration: 4.8, pan: -0.04 },
  { t: 197.8, instrument: "felt_piano", frequencies: [440.0, 587.33], velocity: 0.046, duration: 4.4, pan: 0.04 },

  // Suspensão final luminosa [C#4 + E5]
  { t: 200.8, instrument: "felt_piano", frequencies: [277.18, 659.25], velocity: 0.046, duration: 5.2, pan: 0.06 },

  // Acorde final aberto Dadd9 suspenso em decaimento natural perfeito:
  // Mão esquerda: fundamental e oitava aberta [D2 + A2 + D3]
  // Mão direita: [F#3 + C#4 + E4 + A4] (acorde luminoso, acolhedor e perfeitamente equilibrado)
  {
    t: 204.0,
    instrument: "felt_piano",
    frequencies: [73.42, 110.0, 146.83, 185.0, 277.18, 329.63, 440.0],
    velocity: 0.042,
    duration: 6.2,
    pan: 0.0,
  },

  // 205s a 210s: Cauda longa de reverberação e eco suave.
  // Aos 210s, o ciclo reinicia no silêncio e na primeira nota de 3.0s com naturalidade total.
];
