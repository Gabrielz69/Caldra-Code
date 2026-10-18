import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { Panel, SectionLabel } from "@/components/caldra/ui";
import { checkAnswer, generateExercise, type Exercise } from "@/lib/education/exercises";
import { lessonState, recordExercise } from "@/lib/education/progress";
import { cn } from "@/lib/utils";

type Props = { lessonId: string; formulaIds: string[] };

type Result = { ok: boolean; expected: string } | null;

export function ExercisePanel({ lessonId, formulaIds }: Props) {
  const [ex, setEx] = useState<Exercise | null>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result>(null);

  const draw = useCallback(() => {
    setEx(generateExercise(formulaIds));
    setValue("");
    setResult(null);
  }, [formulaIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draw();
  }, [draw]);

  if (!ex) return null;

  const st = lessonState(lessonId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ex || result) return;
    const r = checkAnswer(ex, value);
    if (r.value === null) return;
    setResult({ ok: r.ok, expected: r.expected });
    recordExercise(lessonId, r.ok);
  }

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Exercício</SectionLabel>
        <span className="font-mono text-[10px] text-muted-foreground uppercase">
          {st.correct}/{st.attempts} certos
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-foreground/90">{ex.prompt}</p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5">
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!!result}
            placeholder="0,00"
            aria-label="Sua resposta"
            className="w-28 bg-transparent font-mono text-sm outline-none"
          />
          <span className="font-mono text-[10px] text-muted-foreground">{ex.unit}</span>
        </div>
        {!result ? (
          <button
            type="submit"
            className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-1.5 font-mono text-[10px] text-accent uppercase"
          >
            Conferir
          </button>
        ) : (
          <button
            type="button"
            onClick={draw}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 font-mono text-[10px] uppercase"
          >
            <RefreshCw className="size-3" /> Outro exercício
          </button>
        )}
      </form>

      {result && (
        <div className="mt-3 space-y-2">
          <p
            className={cn(
              "flex items-center gap-1.5 font-mono text-[11px] uppercase",
              result.ok ? "text-emerald-400" : "text-red-400",
            )}
          >
            {result.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {result.ok ? "Correto" : `Resposta: ${result.expected}`}
          </p>
          <div className="rounded-lg border border-line/70 bg-foreground/[0.03] p-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Resolução</p>
            <ol className="mt-1.5 space-y-1">
              {ex.steps.map((s, i) => (
                <li key={s} className="flex gap-2 font-mono text-[12px] text-foreground/85">
                  <span className="text-accent">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Panel>
  );
}
