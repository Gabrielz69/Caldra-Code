import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";
import { saveDiagnosis, setMastery, useAcademy } from "@/lib/education/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/escola/diagnostico")({
  head: () => ({
    meta: [
      { title: "Descubra seu nível — Estudos | CALDRA" },
      {
        name: "description",
        content:
          "Responda seis perguntas rápidas de traçagem e matemática aplicada e receba a trilha de estudo indicada para o seu nível.",
      },
      { property: "og:title", content: "Descubra seu nível — Estudos | CALDRA" },
      {
        property: "og:description",
        content: "Diagnóstico rápido que define por onde começar na escola de caldeiraria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticoPage,
});

type Q = {
  id: string;
  lesson: string;
  question: string;
  options: string[];
  answer: number;
};

const QUESTIONS: Q[] = [
  {
    id: "q1",
    lesson: "unidades-medida",
    question: 'Quanto vale 3/8" em milímetros?',
    options: ["9,525 mm", "8,375 mm", "12,7 mm"],
    answer: 0,
  },
  {
    id: "q2",
    lesson: "raio-diametro-perimetro",
    question: "Qual o desenvolvimento de um cilindro de Ø400 na linha média?",
    options: ["1256,6 mm", "628,3 mm", "1600,0 mm"],
    answer: 0,
  },
  {
    id: "q3",
    lesson: "triangulo-retangulo",
    question: "Catetos de 400 e 300 mm. Qual o comprimento verdadeiro?",
    options: ["700 mm", "500 mm", "350 mm"],
    answer: 1,
  },
  {
    id: "q4",
    lesson: "arco-corda-flecha",
    question: "Na peça calandrada, o que é a flecha?",
    options: [
      "A reta entre as pontas do arco",
      "A altura do arco em relação à corda",
      "O raio interno da peça",
    ],
    answer: 1,
  },
  {
    id: "q5",
    lesson: "trigonometria-basica",
    question: "Em um tronco de cone, tg α depende de:",
    options: [
      "Diferença dos diâmetros e altura",
      "Soma dos diâmetros e espessura",
      "Perímetro e número de gomos",
    ],
    answer: 0,
  },
  {
    id: "q6",
    lesson: "verdadeira-grandeza",
    question: "Uma medida só pode ser riscada na chapa quando:",
    options: [
      "Está em verdadeira grandeza",
      "Aparece na vista frontal",
      "Está cotada em polegadas",
    ],
    answer: 0,
  },
];

function DiagnosticoPage() {
  const state = useAcademy();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const correct = QUESTIONS.filter((q) => answers[q.id] === q.answer);
  const score = correct.length;
  const level = score >= 5 ? "avancado" : score >= 3 ? "intermediario" : "iniciante";
  const levelLabel =
    level === "avancado" ? "Avançado" : level === "intermediario" ? "Intermediário" : "Iniciante";
  const weak = QUESTIONS.filter((q) => answers[q.id] !== q.answer);

  function finish() {
    for (const q of correct) setMastery(q.lesson, "praticado");
    saveDiagnosis({
      at: Date.now(),
      level,
      byCompetency: { matematica: Math.round((score / QUESTIONS.length) * 100) },
    });
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          to="/escola"
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          <ChevronLeft className="size-3" /> Estudos
        </Link>
        <h1 className="mt-2 font-display text-xl font-semibold lg:text-2xl">Descubra seu nível</h1>
      </div>

      {done ? (
        <Panel className="p-5 text-center">
          <SectionLabel>Resultado</SectionLabel>
          <p className="font-display text-2xl">{levelLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {score} de {QUESTIONS.length} corretas
            {state.diagnosis ? "" : ""}
          </p>
          {weak.length > 0 && (
            <div className="mt-4 text-left">
              <SectionLabel>Comece por aqui</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {weak.map((q) => (
                  <Link
                    key={q.id}
                    to="/escola/aula/$lessonId"
                    params={{ lessonId: q.lesson }}
                    className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase"
                  >
                    {q.lesson.replace(/-/g, " ")}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Link
            to="/escola"
            className="brand-gradient mt-5 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-background"
          >
            Ir para a trilha
          </Link>
        </Panel>
      ) : (
        <>
          {QUESTIONS.map((q, i) => (
            <Panel key={q.id} className="p-4">
              <SectionLabel>Pergunta {i + 1}</SectionLabel>
              <p className="text-[13px] leading-relaxed">{q.question}</p>
              <div className="mt-3 space-y-1.5">
                {q.options.map((opt, oi) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className={cn(
                      "block w-full rounded-xl border px-3 py-2 text-left text-[12px]",
                      answers[q.id] === oi
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line text-muted-foreground",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Panel>
          ))}
          <button
            onClick={finish}
            disabled={Object.keys(answers).length < QUESTIONS.length}
            className="brand-gradient w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
          >
            Ver meu nível
          </button>
        </>
      )}
    </div>
  );
}
