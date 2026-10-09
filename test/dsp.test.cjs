const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spectrum, PCMFrames } = require("../src/dsp.cjs");
test("FFT locates a 440 Hz sine wave with expected RMS", () => {
  const a = Float32Array.from(
    { length: 2048 },
    (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000),
  );
  const f = spectrum(a);
  assert.ok(Math.abs(f.rms - 0.5 / Math.sqrt(2)) < 0.003);
  const peak = f.bins.indexOf(Math.max(...f.bins));
  const hz = 30 * Math.pow(600, (peak + 0.5) / 96);
  assert.ok(Math.abs(hz - 440) < 45);
});
test("silence remains silent and finite", () => {
  const f = spectrum(new Float32Array(2048));
  assert.equal(f.rms, 0);
  assert.ok(f.bins.every((x) => x === 0));
});
test("PCM byte fragments retain sample alignment across frames", () => {
  const values = Float32Array.from({ length: 4096 }, (_, i) => Math.sin(i));
  const bytes = Buffer.from(values.buffer),
    frames = [];
  const stream = new PCMFrames((f) => frames.push(f));
  for (let i = 0; i < bytes.length; i += 137)
    stream.push(bytes.subarray(i, i + 137));
  assert.equal(frames.length, 2);
  assert.deepEqual(frames[0], values.subarray(0, 2048));
  assert.deepEqual(frames[1], values.subarray(2048));
  assert.equal(stream.pending.length, 0);
});
test("overlapping stereo frames downmix correctly without losing alignment", () => {
  const bytes = Buffer.alloc(4096 * 2 * 4);
  for (let i = 0; i < 4096; i++) {
    bytes.writeFloatLE(0.25, i * 8);
    bytes.writeFloatLE(0.75, i * 8 + 4);
  }
  const frames = [];
  const stream = new PCMFrames((f) => frames.push(f), 2048, 512, 2);
  for (let i = 0; i < bytes.length; i += 137)
    stream.push(bytes.subarray(i, i + 137));
  assert.equal(frames.length, 5);
  for (const f of frames) assert.ok(f.every((x) => x === 0.5));
});
