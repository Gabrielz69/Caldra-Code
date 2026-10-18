import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./engine";

describe("porcentagem convencional", () => {
  it.each([
    ["10%", 0.1],
    ["10%*250", 25],
    ["200+10%", 220],
    ["200-10%", 180],
    ["200+10%+10%", 242],
    ["(200+10%)*2", 440],
    ["200/10%", 2000],
    ["50+20%", 60],
    ["50-20%", 40],
  ])("%s = %s", (expression, expected) => {
    expect(evaluateExpression(expression, "DEG")).toBeCloseTo(expected, 10);
  });
});
