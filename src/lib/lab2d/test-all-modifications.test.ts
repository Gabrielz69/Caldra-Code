import { describe, it, expect } from "vitest";
import {
  rectPolyline,
  translate,
  rotate,
  scaleEntity,
  mirror,
  bbox,
  boxOf,
  type Entity,
} from "./core";
import {
  rotateEntityAroundPoint,
  mirrorAcrossAxis,
  explodeEntity,
  breakEntityAtPoint,
  joinEntities,
  stretchSelection,
} from "./cadModifiers";
import { buildIndex, viewportBox } from "./spatialIndex";
import { drawScene } from "./canvasScene";
import { revalidateShared } from "./sharedCut";

describe("Test all modify actions on rectPolyline", () => {
  const rect = rectPolyline({ x: 50, y: 50 }, { x: 200, y: 150 }, "corte");

  it("translates correctly", () => {
    const moved = translate(rect, 10, 10);
    expect(boxOf(moved)).toEqual({ minX: 60, maxX: 210, minY: 60, maxY: 160 });
  });

  it("rotates with rotate in core", () => {
    const center = { x: 125, y: 100 };
    const rotated = rotate(rect, center, 90);
    const b = boxOf(rotated);
    expect(b.maxX - b.minX).toBeCloseTo(100, 1);
    expect(b.maxY - b.minY).toBeCloseTo(150, 1);
  });

  it("rotates with rotateEntityAroundPoint in cadModifiers", () => {
    const center = { x: 125, y: 100 };
    const rotated = rotateEntityAroundPoint(rect, center, Math.PI / 2);
    const b = boxOf(rotated);
    expect(b.maxX - b.minX).toBeCloseTo(100, 1);
    expect(b.maxY - b.minY).toBeCloseTo(150, 1);
    expect(rotated.id).toBe(rect.id); // ID must be preserved!
  });

  it("mirrors with mirrorAcrossAxis in cadModifiers", () => {
    const mirrored = mirrorAcrossAxis(rect, { x: 125, y: 0 }, { x: 125, y: 100 });
    console.log("mirrorAcrossAxis rect id:", mirrored.id, "original id:", rect.id);
    expect(mirrored.id).toBe(rect.id); // IF ID CHANGES, SELECTION IS LOST!
  });

  it("revalidateShared on rect", () => {
    const validated = revalidateShared([rect]);
    expect(validated).toHaveLength(1);
    expect(validated[0]?.id).toBe(rect.id);
  });
});
