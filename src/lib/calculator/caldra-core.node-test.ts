import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExpression, formatResult, toFraction } from "./engine.ts";
import { KFactor } from "../cad/sheetmetal/KFactor.ts";

test("CALDRA calculator engine evaluates trigonometry, powers, and industrial expressions", () => {
  assert.equal(evaluateExpression("2 + 3 * 4", "DEG"), 14);
  assert.ok(Math.abs(evaluateExpression("sin(30)", "DEG") - 0.5) < 1e-12);
  assert.equal(evaluateExpression("sqrt(144)", "DEG"), 12);
  assert.equal(evaluateExpression("10% * 250", "DEG"), 25);
  assert.equal(toFraction(0.5), "1/2");
  assert.equal(formatResult(12.5, 2), "12,50");
});

test("CALDRA sheet metal KFactor computes material-specific K and Y factors", () => {
  assert.equal(KFactor.getDefault("carbon-steel", 0.8), 0.38);
  assert.equal(KFactor.getDefault("stainless-steel", 1.5), 0.44);
  assert.equal(KFactor.getDefault("aluminum", 3.0), 0.48);
  assert.ok(Math.abs(KFactor.toYFactor(0.44) - 0.44 * (Math.PI / 2)) < 1e-9);
});
