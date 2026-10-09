import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSize } from "../src/render-size.mjs";
test("high quality on a 4K 2x display stays within the 1440p allocation budget", () => {
  const r = renderSize(3840, 2160, 2, 1.5);
  assert.ok(r.width * r.height <= r.budget);
  assert.equal(r.width, 2560);
  assert.equal(r.height, 1440);
});
test("ordinary window dimensions retain requested quality without exceeding budget", () => {
  const r = renderSize(1280, 850, 1, 1.5);
  assert.equal(r.width, 1280);
  assert.equal(r.height, 850);
});
test("all quality levels remain bounded for ultrawide and large displays", () => {
  for (const quality of [1, 1.5, 2])
    for (const [w, h] of [
      [7680, 4320],
      [5120, 1440],
      [3840, 2160],
    ]) {
      const r = renderSize(w, h, 2, quality);
      assert.ok(r.width * r.height <= r.budget);
      assert.ok(r.width > 0 && r.height > 0);
    }
});
