// Offline non-generative photo-to-ink experiments. No network or persistence.
export type PortraitStyle = 'marker' | 'contour' | 'hybrid';
export type Crop = { zoom: number; panX: number; panY: number; thickness: number };
export const PORTRAIT_STYLES: { id: PortraitStyle; label: string }[] = [
  { id: 'marker', label: 'Stiftlijnen' },
  { id: 'contour', label: 'Contouren' },
  { id: 'hybrid', label: 'Illustratief' },
];
const W = 240, H = 270;

function cropImage(image: ImageBitmap, opts: Crop): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D niet beschikbaar.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, W, H);
  const scale = Math.max(W / image.width, H / image.height) * opts.zoom;
  const width = image.width * scale, height = image.height * scale;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (W - width) / 2 + opts.panX * W / 100, (H - height) / 2 + opts.panY * H / 100, width, height);
  return context.getImageData(0, 0, W, H);
}

function grayscale(data: ImageData): Float32Array {
  const gray = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data.data[p] + 0.587 * data.data[p + 1] + 0.114 * data.data[p + 2];
  }
  return gray;
}

// Lightweight bilateral-like 3x3 neighborhood: keeps sharp facial edges.
function smoothEdges(input: Float32Array): Float32Array {
  const result = new Float32Array(input.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, center = input[i];
    let sum = 0, weights = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.max(0, Math.min(W - 1, x + dx));
      const yy = Math.max(0, Math.min(H - 1, y + dy));
      const other = input[yy * W + xx], difference = other - center;
      const weight = (dx === 0 && dy === 0 ? 2 : 1) * Math.exp(-difference * difference / 1100);
      sum += weight * other;
      weights += weight;
    }
    result[i] = sum / weights;
  }
  return result;
}

function localMeans(gray: Float32Array): Float32Array {
  const stride = W + 1;
  const integral = new Float64Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y++) {
    let sum = 0;
    for (let x = 1; x <= W; x++) {
      sum += gray[(y - 1) * W + x - 1];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + sum;
    }
  }
  const means = new Float32Array(gray.length);
  const radius = 10; // 21x21 block, approximate OpenCV adaptive threshold.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const left = Math.max(0, x - radius), right = Math.min(W, x + radius + 1);
    const top = Math.max(0, y - radius), bottom = Math.min(H, y + radius + 1);
    const total = integral[bottom * stride + right] - integral[top * stride + right]
      - integral[bottom * stride + left] + integral[top * stride + left];
    means[y * W + x] = total / ((right - left) * (bottom - top));
  }
  return means;
}

function sobel(gray: Float32Array): Float32Array {
  const strength = new Float32Array(gray.length);
  const at = (x: number, y: number) => gray[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = -at(x-1,y-1) + at(x+1,y-1) -2*at(x-1,y) +2*at(x+1,y) -at(x-1,y+1) +at(x+1,y+1);
    const gy = -at(x-1,y-1) -2*at(x,y-1) -at(x+1,y-1) +at(x-1,y+1) +2*at(x,y+1) +at(x+1,y+1);
    strength[y * W + x] = Math.hypot(gx, gy);
  }
  return strength;
}
function thicken(ink: Uint8Array, count: number): Uint8Array {
  let current = ink;
  for (let pass = 0; pass < count; pass++) {
    const next = new Uint8Array(current);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!current[i] && (current[i-1] || current[i+1] || current[i-W] || current[i+W])) next[i] = 1;
    }
    current = next;
  }
  return current;
}
function asCanvas(ink: Uint8Array): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D niet beschikbaar.');
  const data = context.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = i * 4;
    const ex = (x - W/2) / (W * 0.485), ey = (y - H*0.515) / (H*0.48);
    const visible = ex*ex + ey*ey <= 1;
    const tone = ink[i] ? 0 : 255;
    data.data[p] = tone; data.data[p+1] = tone; data.data[p+2] = tone; data.data[p+3] = visible ? 255 : 0;
  }
  context.putImageData(data, 0, 0);
  return canvas;
}

export function makePortraitStyles(image: ImageBitmap, opts: Crop): Record<PortraitStyle, HTMLCanvasElement> {
  const gray = smoothEdges(grayscale(cropImage(image, opts)));
  const mean = localMeans(gray), edges = sobel(gray);
  const results = {} as Record<PortraitStyle, HTMLCanvasElement>;
  for (const style of PORTRAIT_STYLES) {
    const ink = new Uint8Array(W * H);
    for (let i = 0; i < ink.length; i++) {
      const v = gray[i], e = edges[i], adaptive = v < mean[i] - 8 && v < 205;
      let isBlack = false;
      if (style.id === 'marker') isBlack = adaptive || v < 73;
      if (style.id === 'contour') isBlack = (e > 62 && v < 237) || v < 55;
      if (style.id === 'hybrid') isBlack = v < 65 || (adaptive && v < 150) || (e > 51 && v < 216);
      ink[i] = isBlack ? 1 : 0;
    }
    results[style.id] = asCanvas(thicken(ink, opts.thickness));
  }
  return results;
}

/** High-resolution, portrait-aligned input for the two local engines.
 * The original full-size photo never leaves the browser. Only this 512x576
 * cropped derivative is POSTed to the same computer after a user click.
 */
export function makePortraitInput(image: ImageBitmap, opts: Crop): HTMLCanvasElement {
  const width = 512, height = 576;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D niet beschikbaar.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.max(width / image.width, height / image.height) * opts.zoom;
  const drawW = image.width * scale, drawH = image.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, (width - drawW) / 2 + opts.panX * width / 100,
    (height - drawH) / 2 + opts.panY * height / 100, drawW, drawH);
  return canvas;
}
