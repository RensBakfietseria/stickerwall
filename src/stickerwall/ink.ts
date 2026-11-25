/** Print finishing only: does not alter the underlying model or invent features. */
export function thresholdInk(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  cutoff: number,
  thickness: number,
): Uint8ClampedArray {
  const count = width * height;
  let ink = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const a = rgba[p + 3] / 255;
    const gray = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) * a + 255 * (1 - a);
    ink[i] = gray < cutoff ? 1 : 0;
  }
  for (let pass = 0; pass < Math.max(0, Math.min(2, thickness)); pass++) {
    const next = new Uint8Array(ink);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (
          (x > 0 && ink[i - 1]) ||
          (x + 1 < width && ink[i + 1]) ||
          (y > 0 && ink[i - width]) ||
          (y + 1 < height && ink[i + width])
        ) next[i] = 1;
      }
    }
    ink = next;
  }
  const out = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const tone = ink[i] ? 0 : 255;
    out[p] = tone;
    out[p + 1] = tone;
    out[p + 2] = tone;
    out[p + 3] = 255;
  }
  return out;
}
