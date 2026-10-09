// Bound postprocessing allocations when a window expands onto a high-DPI/4K display.
export function renderSize(width, height, dpr = 1, quality = 1.5) {
  const budget =
    quality >= 2 ? 8_294_400 : quality >= 1.5 ? 3_686_400 : 2_073_600;
  const ratio = Math.min(
    dpr,
    quality,
    Math.sqrt(budget / Math.max(1, width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
    ratio,
    budget,
  };
}
