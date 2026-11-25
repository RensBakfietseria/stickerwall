import { thresholdInk } from './ink.ts';

export type U2Finish = 'basis' | 'bold' | 'sticker';

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Remove only disconnected tiny black specks; never delete white highlights.
 * Eight-connected ink keeps diagonals, thin frames and facial lines together.
 */
function removeSpecks(ink: Uint8Array, w: number, h: number, minSize: number): void {
  const visited = new Uint8Array(ink.length);
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || visited[start]) continue;
    const region = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < region.length; cursor++) {
      const i = region[cursor];
      const x = i % w, y = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const n = ny * w + nx;
          if (ink[n] && !visited[n]) {
            visited[n] = 1;
            region.push(n);
          }
        }
      }
    }
    if (region.length < minSize) for (const i of region) ink[i] = 0;
  }
}

/** All presets use the same U² model pixels at the actual head print size.
 * Preserve the original semantic alpha. No facial feature generation.
 * Basis reproduces 0.5; Bold is deliberately stronger; Sticker strengthens
 * only supported local edges, then removes isolated specks.
 */
export function finishU2(
  rgba: Uint8ClampedArray, w: number, h: number, preset: U2Finish,
  cutoff = 180, thickness = 0,
): Uint8ClampedArray {
  if (w < 1 || h < 1 || rgba.length !== w * h * 4) throw new Error('Ongeldige portretafmetingen.');
  const n = w * h;
  const inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) inside[i] = rgba[4 * i + 3] >= 128 ? 1 : 0;
  if (preset !== 'sticker') {
    const out = thresholdInk(rgba, w, h, clamp(cutoff + (preset === 'bold' ? 25 : 0), 0, 255),
      clamp(thickness + (preset === 'bold' ? 1 : 0), 0, 2));
    for (let i = 0; i < n; i++) {
      out[4 * i + 3] = inside[i] ? 255 : 0;
      if (!inside[i]) out.fill(255, 4 * i, 4 * i + 3);
    }
    return out;
  }

  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = 4 * i;
    const a = rgba[p + 3] / 255;
    gray[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) * a + 255 * (1 - a);
  }
  const offset = cutoff - 180;
  const strong = clamp(160 + offset, 25, 245);
  const weak = clamp(218 + offset, 30, 250);
  const edge = new Uint8Array(n);
  let ink = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inside[i] || gray[i] >= weak) continue;
      let light = gray[i];
      // Compare with nearby original tones, not invented features.
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) light = Math.max(light, gray[ny * w + nx]);
      }
      edge[i] = light - gray[i] >= 18 ? 1 : 0;
      if (gray[i] < strong || (edge[i] && gray[i] < weak - 12)) ink[i] = 1;
    }
  }
  // Add one supported weak edge pixel next to a strong line, not a blanket dilation.
  const next = new Uint8Array(ink);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inside[i] || !edge[i] || ink[i]) continue;
      if ((x > 0 && ink[i - 1]) || (x + 1 < w && ink[i + 1]) ||
          (y > 0 && ink[i - w]) || (y + 1 < h && ink[i + w])) next[i] = 1;
    }
  }
  ink = next;
  removeSpecks(ink, w, h, 3);
  // Optional extra ink uses the existing control; clip every step to the head.
  for (let pass = 0; pass < clamp(thickness, 0, 2); pass++) {
    const expanded = new Uint8Array(ink);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (inside[i] && ((x > 0 && ink[i - 1]) || (x + 1 < w && ink[i + 1]) ||
            (y > 0 && ink[i - w]) || (y + 1 < h && ink[i + w]))) expanded[i] = 1;
      }
    }
    ink = expanded;
  }
  const output = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const p = 4 * i;
    output[p] = output[p + 1] = output[p + 2] = inside[i] && ink[i] ? 0 : 255;
    output[p + 3] = inside[i] ? 255 : 0;
  }
  return output;
}
