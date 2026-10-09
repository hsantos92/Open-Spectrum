import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioFeatures } from "../src/audio-features.mjs";
import { validatePreset } from "../src/preset-schema.mjs";
import catalog from "../presets/builtin.json" with { type: "json" };
test("attack and decay respond consistently across frame rates", () => {
  const sample = (fps) => {
    const f = new AudioFeatures();
    for (let i = 0; i < fps; i++)
      f.update({ bins: new Array(96).fill(0.8), rms: 0.1 }, i / fps);
    return f.smoothed[0];
  };
  assert.ok(Math.abs(sample(60) - sample(120)) < 0.002);
});
test("onset triggers on a rise, respects refractory period, and decays", () => {
  const f = new AudioFeatures();
  const silence = { bins: new Array(96).fill(0), rms: 0 },
    hit = { bins: new Array(96).fill(0.9), rms: 0.2 };
  f.update(silence, 0);
  assert.equal(f.update(hit, 0.02).onset, true);
  f.update(silence, 0.04);
  assert.equal(f.update(hit, 0.06).onset, false);
  assert.ok(f.update(hit, 0.3).beat < 0.5);
});
test("silence cannot produce spurious onsets", () => {
  const f = new AudioFeatures();
  for (let i = 0; i < 100; i++) {
    const r = f.update({ bins: new Array(96).fill(0), rms: 0 }, i / 60);
    assert.equal(r.onset, false);
    assert.equal(r.bass, 0);
  }
});
test("all 56 built-in presets have unique names and valid bounded parameters", () => {
  assert.equal(catalog.length, 56);
  assert.equal(new Set(catalog.map((p) => p.name)).size, 56);
  catalog.forEach(validatePreset);
});
test("import rejects unknown engines, nonfinite tuning, and out of range density", () => {
  assert.throws(() => validatePreset({ name: "x", kind: "arbitrary-script" }));
  assert.throws(() =>
    validatePreset({ name: "x", kind: "wave", speed: Infinity }),
  );
  assert.throws(() =>
    validatePreset({ name: "x", kind: "wave", density: 100000 }),
  );
});
