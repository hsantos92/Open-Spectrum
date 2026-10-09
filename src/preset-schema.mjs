export const engines = new Set([
  "radial",
  "terrain",
  "stars",
  "rings",
  "globe",
  "network",
  "waterfall",
  "tunnel",
  "orbits",
  "prisms",
  "ribbons",
  "bars",
  "contours",
  "sphere",
  "cubes",
  "halos",
  "vortex",
  "crystals",
  "wave",
  "hex",
  "liquid",
  "satellite",
  "pixels",
  "flower",
  "cells",
  "blobs",
  "kaleidoscope",
  "plasma",
]);
export function validatePreset(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Preset must be a JSON object.");
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80
  )
    throw Error("Preset name must have 1–80 characters.");
  if (!engines.has(value.kind)) throw Error("Unknown visual engine.");
  const result = {
    name: value.name.trim(),
    kind: value.kind,
    collection: "Custom",
  };
  for (const [key, min, max, def] of [
    ["speed", 0.1, 3, 1],
    ["scale", 0.5, 2, 1],
    ["density", 0.5, 2, 1],
    ["deform", 0.1, 3, 1],
    ["twist", 0, 2, 0],
    ["tilt", 0, 1, 0],
  ]) {
    const number = value[key] ?? def;
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      number < min ||
      number > max
    )
      throw Error(`${key} must be between ${min} and ${max}.`);
    result[key] = number;
  }
  if (value.palette !== undefined) {
    const palette = value.palette;
    if (
      !palette ||
      !["rainbow", "custom"].includes(palette.mode) ||
      !Array.isArray(palette.colors) ||
      palette.colors.length !== 2 ||
      !palette.colors.every(
        (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
      )
    )
      throw Error("Palette must contain a mode and two hex colors.");
    result.palette = { mode: palette.mode, colors: [...palette.colors] };
  }
  if (value.bloom !== undefined) {
    if (
      typeof value.bloom !== "number" ||
      !Number.isFinite(value.bloom) ||
      value.bloom < 0 ||
      value.bloom > 2
    )
      throw Error("Glow must be between 0 and 2.");
    result.bloom = value.bloom;
  }
  return result;
}
