/**
 * CALDRA LEARNING ENGINE
 *
 * Estado do aluno — separado do conteúdo técnico (knowledge.ts) e do currículo
 * (curriculum.ts). Regras determinísticas, sem IA. Persistência local.
 */

import { useSyncExternalStore } from "react";
import { ALL_LESSONS, CURRICULUM, findAcademyLesson } from "./curriculum";
import { COMPETENCIES, type CompetencyId } from "./knowledge";

export type Mastery = "nao-iniciado" | "em-estudo" | "praticado" | "dominado";

export const MASTERY_LABEL: Record<Mastery, string> = {
  "nao-iniciado": "Não iniciado",
  "em-estudo": "Em estudo",
  praticado: "Praticado",
  dominado: "Dominado",
};

const ORDER: Mastery[] = ["nao-iniciado", "em-estudo", "praticado", "dominado"];
const rank = (m: Mastery) => ORDER.indexOf(m);

export type LessonState = {
  mastery: Mastery;
  attempts: number;
  correct: number;
  lastAt: number;
  notes?: string;
  favorite?: boolean;
};

export type AcademyState = {
  version: 1;
  lessons: Record<string, LessonState>;
  /** Resultado do diagnóstico inicial, quando feito. */
  diagnosis?: {
    at: number;
    level: "iniciante" | "intermediario" | "avancado";
    byCompetency: Record<string, number>;
  };
};

const KEY = "caldra.academy.v1";

const empty: AcademyState = { version: 1, lessons: {} };

let state: AcademyState = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load(): AcademyState {
  if (loaded) return state;
  loaded = true;
  if (typeof window === "undefined") return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AcademyState;
      if (parsed && parsed.version === 1 && parsed.lessons) state = parsed;
    }
  } catch {
    /* estado corrompido: começa limpo, sem apagar outros dados */
  }
  return state;
}

function commit(next: AcademyState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* cota cheia: mantém em memória */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAcademy(): AcademyState {
  return useSyncExternalStore(subscribe, load, () => empty);
}

export function lessonState(id: string): LessonState {
  return load().lessons[id] ?? { mastery: "nao-iniciado", attempts: 0, correct: 0, lastAt: 0 };
}

function patchLesson(id: string, patch: Partial<LessonState>) {
  const cur = lessonState(id);
  commit({
    ...load(),
    lessons: { ...load().lessons, [id]: { ...cur, ...patch, lastAt: Date.now() } },
  });
}

/** Nunca rebaixa o domínio automaticamente. */
export function raiseMastery(id: string, mastery: Mastery) {
  const cur = lessonState(id);
  if (rank(mastery) <= rank(cur.mastery)) {
    patchLesson(id, {});
    return;
  }
  patchLesson(id, { mastery });
}

export function markOpened(id: string) {
  raiseMastery(id, "em-estudo");
}

export function recordExercise(id: string, ok: boolean) {
  const cur = lessonState(id);
  patchLesson(id, { attempts: cur.attempts + 1, correct: cur.correct + (ok ? 1 : 0) });
  if (ok) raiseMastery(id, cur.correct + 1 >= 2 ? "dominado" : "praticado");
}

export function setMastery(id: string, mastery: Mastery) {
  patchLesson(id, { mastery });
}

export function toggleFavorite(id: string) {
  patchLesson(id, { favorite: !lessonState(id).favorite });
}

export function setNotes(id: string, notes: string) {
  patchLesson(id, { notes });
}

export function saveDiagnosis(d: NonNullable<AcademyState["diagnosis"]>) {
  commit({ ...load(), diagnosis: d });
}

/* ------------------------------------------------------------------- métricas */

const WEIGHT: Record<Mastery, number> = {
  "nao-iniciado": 0,
  "em-estudo": 0.35,
  praticado: 0.7,
  dominado: 1,
};

export function moduleProgress(moduleId: string, s: AcademyState): number {
  const mod = CURRICULUM.find((m) => m.id === moduleId);
  if (!mod || mod.lessons.length === 0) return 0;
  const sum = mod.lessons.reduce(
    (acc, l) => acc + WEIGHT[s.lessons[l.id]?.mastery ?? "nao-iniciado"],
    0,
  );
  return Math.round((sum / mod.lessons.length) * 100);
}

export type CompetencyLevel =
  "precisa-praticar" | "em-desenvolvimento" | "dominado" | "nao-iniciado";

export function competencyLevel(
  id: CompetencyId,
  s: AcademyState,
): { level: CompetencyLevel; pct: number } {
  const lessons = ALL_LESSONS.filter((x) => x.lesson.competency === id);
  if (lessons.length === 0) return { level: "nao-iniciado", pct: 0 };
  const sum = lessons.reduce(
    (a, x) => a + WEIGHT[s.lessons[x.lesson.id]?.mastery ?? "nao-iniciado"],
    0,
  );
  const pct = Math.round((sum / lessons.length) * 100);
  const level: CompetencyLevel =
    pct === 0
      ? "nao-iniciado"
      : pct >= 80
        ? "dominado"
        : pct >= 40
          ? "em-desenvolvimento"
          : "precisa-praticar";
  return { level, pct };
}

export const COMPETENCY_MAP = COMPETENCIES;

export const COMPETENCY_LEVEL_LABEL: Record<CompetencyLevel, string> = {
  "nao-iniciado": "Não iniciado",
  "precisa-praticar": "Precisa praticar",
  "em-desenvolvimento": "Em desenvolvimento",
  dominado: "Dominado",
};

/* --------------------------------------------------------------- recomendação */

/** Pré-requisitos ainda não praticados. */
export function missingPrerequisites(lessonId: string, s: AcademyState): string[] {
  const found = findAcademyLesson(lessonId);
  if (!found) return [];
  return (found.lesson.prerequisites ?? []).filter(
    (p) => rank(s.lessons[p]?.mastery ?? "nao-iniciado") < rank("praticado"),
  );
}

/** Próxima aula recomendada: regra determinística, pré-requisito antes de avanço. */
export function nextLesson(s: AcademyState) {
  const available = ALL_LESSONS.filter((x) => x.lesson.status === "disponivel");
  const pending = available.filter(
    (x) => rank(s.lessons[x.lesson.id]?.mastery ?? "nao-iniciado") < rank("praticado"),
  );
  const ready = pending.find((x) => missingPrerequisites(x.lesson.id, s).length === 0);
  return ready ?? pending[0] ?? null;
}

/** Aulas praticadas há mais de 14 dias — revisão espaçada simples. */
export function reviewQueue(s: AcademyState) {
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  return ALL_LESSONS.filter((x) => {
    const st = s.lessons[x.lesson.id];
    return st && rank(st.mastery) >= rank("praticado") && st.lastAt < cutoff;
  });
}
