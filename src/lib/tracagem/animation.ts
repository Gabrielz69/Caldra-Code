import type { DevelopmentPattern, Vec2 } from "@/lib/geometry/types";
import { refId, refKind, type GeometryRef } from "@/lib/geometry/refs";
import type { TraceMeasurement, TraceStep, TraceTool } from "./steps";

export type TraceActionType =
  | "MOVE"
  | "POSITION"
  | "OPEN"
  | "ROTATE"
  | "DRAW"
  | "TRANSFER"
  | "MARK"
  | "HIGHLIGHT"
  | "MEASURE"
  | "COMPLETE";

export type MeasurementRef = `measure:${string}:${number}`;

export type TraceAction = {
  id: string;
  type: TraceActionType;
  geometryRefs: GeometryRef[];
  measurementRefs: MeasurementRef[];
  tool: TraceTool;
  duration: number;
  instruction: string;
  order: number;
};

export type ResolvedEntity =
  | { kind: "segment"; ref: GeometryRef; startPoint: Vec2; endPoint: Vec2; length: number }
  | { kind: "point"; ref: GeometryRef; startPoint: Vec2; endPoint: Vec2; length: 0 };

export type ResolvedTraceAction = TraceAction & {
  entities: ResolvedEntity[];
  startPoint: Vec2 | null;
  endPoint: Vec2 | null;
  measurement: TraceMeasurement | null;
  angleDeg: number;
  radius: number | null;
};

export type TraceFrame = {
  action: ResolvedTraceAction;
  progress: number;
  toolPoint: Vec2 | null;
  partialEnd: Vec2 | null;
};

export const measurementRef = (stepId: string, index: number): MeasurementRef =>
  `measure:${stepId}:${index}`;

export function resolveGeometryRef(
  pattern: DevelopmentPattern,
  ref: GeometryRef,
): ResolvedEntity | null {
  const kind = refKind(ref);
  const id = refId(ref);
  if (kind === "outline") {
    const i = Number(id);
    const a = pattern.outline[i];
    const b = pattern.outline[(i + 1) % pattern.outline.length];
    if (!a || !b) return null;
    return {
      kind: "segment",
      ref,
      startPoint: a,
      endPoint: b,
      length: Math.hypot(b.x - a.x, b.y - a.y),
    };
  }
  if (kind === "fold") {
    const segment = pattern.foldLines[Number(id)];
    if (!segment) return null;
    return {
      kind: "segment",
      ref,
      startPoint: segment.a,
      endPoint: segment.b,
      length: Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y),
    };
  }
  if (kind === "point") {
    const point = pattern.points.find((candidate) => candidate.id === id)?.p;
    return point ? { kind: "point", ref, startPoint: point, endPoint: point, length: 0 } : null;
  }
  return null;
}

function actionDuration(entities: ResolvedEntity[], type: TraceActionType): number {
  if (type === "POSITION" || type === "MEASURE" || type === "HIGHLIGHT") return 700;
  if (type === "MARK" || type === "COMPLETE") return 850;
  const length = entities.reduce((sum, entity) => sum + entity.length, 0);
  return Math.max(1500, Math.min(4800, 1200 + length * 4));
}

function action(
  step: TraceStep,
  type: TraceActionType,
  refs: GeometryRef[],
  order: number,
  instruction: string,
): TraceAction {
  return {
    id: `${step.id}:${order}:${type.toLowerCase()}`,
    type,
    geometryRefs: refs,
    measurementRefs: step.measurements.length ? [measurementRef(step.id, 0)] : [],
    tool: step.tool,
    duration: 0,
    instruction,
    order,
  };
}

/** Constrói ações somente com referências produzidas pelo passo canônico. */
export function buildTraceActions(step: TraceStep, pattern: DevelopmentPattern): TraceAction[] {
  const refs = step.geometryRefs.filter((ref) => resolveGeometryRef(pattern, ref));
  if (step.animation === "none" || refs.length === 0) {
    return [action(step, "COMPLETE", refs, 1, step.instruction)];
  }

  const actions: TraceAction[] = [];
  const push = (type: TraceActionType, actionRefs: GeometryRef[], instruction: string) => {
    const next = action(step, type, actionRefs, actions.length + 1, instruction);
    const entities = actionRefs.flatMap((ref) => {
      const entity = resolveGeometryRef(pattern, ref);
      return entity ? [entity] : [];
    });
    actions.push({ ...next, duration: actionDuration(entities, type) });
  };

  push(
    "POSITION",
    [refs[0]!],
    `Posicione ${step.tool === "regua" ? "a régua" : "o instrumento"} no início.`,
  );
  if (step.measurements.length)
    push(
      "MEASURE",
      [refs[0]!],
      `Confira ${step.measurements[0]!.value} ${step.measurements[0]!.unit}.`,
    );

  if (step.tool === "compasso" && refs.length > 1) {
    push("OPEN", refs.slice(0, 2), "Abra o compasso entre os pontos calculados.");
    push("ROTATE", refs.slice(0, 2), "Gire mantendo a ponta fixa na referência.");
  }

  for (const ref of refs) {
    const entity = resolveGeometryRef(pattern, ref);
    if (!entity) continue;
    const type: TraceActionType =
      entity.kind === "point" ? "MARK" : step.animation === "transfer" ? "TRANSFER" : "DRAW";
    push(type, [ref], type === "MARK" ? "Marque e identifique este ponto." : step.instruction);
  }
  push("COMPLETE", refs, "Etapa concluída. Confira a construção antes de avançar.");
  return actions;
}

export function resolveMeasurement(
  step: TraceStep,
  ref: MeasurementRef | undefined,
): TraceMeasurement | null {
  if (!ref) return null;
  const index = Number(ref.slice(ref.lastIndexOf(":") + 1));
  return step.measurements[index] ?? null;
}

export function resolveTraceAction(
  pattern: DevelopmentPattern,
  step: TraceStep,
  traceAction: TraceAction,
): ResolvedTraceAction {
  const entities = traceAction.geometryRefs.flatMap((ref) => {
    const entity = resolveGeometryRef(pattern, ref);
    return entity ? [entity] : [];
  });
  const first = entities[0];
  const last = entities.at(-1);
  const startPoint = first?.startPoint ?? null;
  const endPoint = last?.endPoint ?? null;
  const dx = startPoint && endPoint ? endPoint.x - startPoint.x : 0;
  const dy = startPoint && endPoint ? endPoint.y - startPoint.y : 0;
  return {
    ...traceAction,
    entities,
    startPoint,
    endPoint,
    measurement: resolveMeasurement(step, traceAction.measurementRefs[0]),
    angleDeg: Math.atan2(dy, dx) * (180 / Math.PI),
    radius:
      first && last
        ? Math.hypot(last.endPoint.x - first.startPoint.x, last.endPoint.y - first.startPoint.y)
        : null,
  };
}

export function sampleTraceAction(action: ResolvedTraceAction, progress: number): TraceFrame {
  const t = Math.max(0, Math.min(1, progress));
  const a = action.startPoint;
  const b = action.endPoint;
  const partialEnd = a && b ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } : null;
  return { action, progress: t, toolPoint: partialEnd ?? a, partialEnd };
}

export function validateTraceActions(pattern: DevelopmentPattern, steps: TraceStep[]): string[] {
  const problems: string[] = [];
  for (const step of steps) {
    for (const traceAction of buildTraceActions(step, pattern)) {
      for (const ref of traceAction.geometryRefs) {
        if (!resolveGeometryRef(pattern, ref))
          problems.push(`${traceAction.id}: referência inválida ${ref}`);
      }
      const resolved = resolveTraceAction(pattern, step, traceAction);
      for (const point of [resolved.startPoint, resolved.endPoint]) {
        if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) {
          problems.push(`${traceAction.id}: coordenada não finita`);
        }
      }
    }
  }
  return problems;
}
