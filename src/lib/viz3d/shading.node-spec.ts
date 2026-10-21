import test from "node:test";
import assert from "node:assert/strict";
import { FACE_MATERIALS, KEY_LIGHT, FILL_LIGHT } from "./shading.ts";

test("FACE_MATERIALS defines technical metallic materials for outer, inner, rim, and cap", () => {
  assert.ok(FACE_MATERIALS.outer);
  assert.ok(FACE_MATERIALS.inner);
  assert.ok(FACE_MATERIALS.rim);
  assert.ok(FACE_MATERIALS.cap);
  assert.equal(FACE_MATERIALS.outer.base, "var(--solid-lo)");
  assert.equal(FACE_MATERIALS.outer.hi, "var(--solid-hi)");
  assert.equal(FACE_MATERIALS.inner.base, "#232b38");
});

test("KEY_LIGHT and FILL_LIGHT provide top-left primary light and subtle right fill", () => {
  assert.ok(KEY_LIGHT.x < 0 && KEY_LIGHT.y > 0 && KEY_LIGHT.z > 0);
  assert.ok(FILL_LIGHT.x > 0 && FILL_LIGHT.z > 0);
});
