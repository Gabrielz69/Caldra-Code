import { describe, expect, it } from "vitest";
import { getEngine } from "@/lib/geometry/engines";
import { buildTraceSequence } from "./steps";
import {
  buildTraceActions,
  resolveGeometryRef,
  resolveTraceAction,
  sampleTraceAction,
  validateTraceActions,
} from "./animation";

const MODELS = [
  "quadrado-redondo",
  "cone",
  "tronco-de-cone",
  "reducao-circular",
  "curva-de-gomos",
  "boca-de-lobo",
];

describe("animação canônica da Traçagem Guiada", () => {
  for (const slug of MODELS) {
    const engine = getEngine(slug);
    if (!engine || engine.validate(engine.defaults).length) continue;
    const result = engine.calculate(engine.defaults);
    const steps = buildTraceSequence(slug, result);

    it(`${slug}: todas as ações resolvem referências e coordenadas finitas`, () => {
      expect(validateTraceActions(result.development, steps)).toEqual([]);
      for (const step of steps) {
        const actions = buildTraceActions(step, result.development);
        expect(actions.length).toBeGreaterThan(0);
        for (const action of actions) {
          for (const ref of action.geometryRefs)
            expect(resolveGeometryRef(result.development, ref)).not.toBeNull();
          const resolved = resolveTraceAction(result.development, step, action);
          for (const point of [resolved.startPoint, resolved.endPoint]) {
            if (!point) continue;
            expect(Number.isFinite(point.x)).toBe(true);
            expect(Number.isFinite(point.y)).toBe(true);
          }
        }
      }
    });
  }

  it("Quadrado → Redondo começa na linha real, com cota viva e avanço sincronizado", () => {
    const engine = getEngine("quadrado-redondo");
    if (!engine) return;
    const result = engine.calculate(engine.defaults);
    const step = buildTraceSequence("quadrado-redondo", result)[0];
    if (!step) return;
    const actions = buildTraceActions(step, result.development);
    const draw = actions.find((action) => action.type === "DRAW");
    expect(draw).toBeTruthy();
    if (!draw) return;
    expect(draw.measurementRefs.length).toBe(1);
    const resolved = resolveTraceAction(result.development, step, draw);
    expect(resolved.measurement?.value).toBe(step.measurements[0]?.value);
    const start = sampleTraceAction(resolved, 0);
    const half = sampleTraceAction(resolved, 0.5);
    const end = sampleTraceAction(resolved, 1);
    expect(start.toolPoint).toEqual(resolved.startPoint);
    expect(end.toolPoint).toEqual(resolved.endPoint);
    expect(half.partialEnd?.x).toBeCloseTo(
      ((resolved.startPoint?.x ?? 0) + (resolved.endPoint?.x ?? 0)) / 2,
    );
    expect(half.partialEnd?.y).toBeCloseTo(
      ((resolved.startPoint?.y ?? 0) + (resolved.endPoint?.y ?? 0)) / 2,
    );
  });

  it("alterar a medida reconstrói ação e trajetória sem coordenada armazenada", () => {
    const engine = getEngine("cone");
    if (!engine) return;
    const original = engine.calculate(engine.defaults);
    const changed = engine.calculate({
      ...engine.defaults,
      h: (engine.defaults["h"] ?? 200) * 1.4,
    });
    const firstA = buildTraceSequence("cone", original)[0];
    const firstB = buildTraceSequence("cone", changed)[0];
    if (!firstA || !firstB) return;
    const actionA = buildTraceActions(firstA, original.development).find(
      (action) => action.type === "DRAW",
    );
    const actionB = buildTraceActions(firstB, changed.development).find(
      (action) => action.type === "DRAW",
    );
    expect(JSON.stringify({ firstA, actionA })).not.toBe(JSON.stringify({ firstB, actionB }));
    expect(actionA).not.toHaveProperty("startPoint");
    expect(actionB).not.toHaveProperty("endPoint");
  });
});
