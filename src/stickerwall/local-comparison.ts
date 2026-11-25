import { thresholdInk } from './ink.ts';
import { type Crop, makePortraitInput } from './portrait.ts';

const STYLES = ['opensketch', 'contour', 'anime'] as const;
type Style = (typeof STYLES)[number];
const LABELS: Record<Style, string> = {
  opensketch: 'OpenSketch',
  contour: 'Contour',
  anime: 'Anime',
};
type BackendResult = { ok: boolean; png?: string; error?: string; elapsed_ms?: number };
type ComparisonResponse = { results: Record<Style, BackendResult> };
type Config = {
  getImage: () => ImageBitmap | null;
  getCrop: () => Crop;
  onSelect: (portrait: HTMLCanvasElement | null) => void;
};

function required<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Ontbrekend Hoofdlab-element: ${id}`);
  return found as T;
}

function onLoopback(): boolean {
  return location.origin === 'http://127.0.0.1:8765' || location.origin === 'http://localhost:8765';
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Kon geen PNG maken.')), 'image/png');
  });
}

function fromPng(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Ongeldige PNG-uitvoer.'));
    image.src = `data:image/png;base64,${base64}`;
  });
}

/** Preserve raw output for judging style, or create a pure black/white print layer.
 * Print layer dimensions match artwork.ts (226 x 252 printer dots).
 */
function frameResult(image: HTMLImageElement, print: boolean, mask: boolean, cutoff: number, thickness: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = print ? 226 : image.naturalWidth;
  canvas.height = print ? 252 : image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: print });
  if (!ctx) throw new Error('Canvas 2D ontbreekt.');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, w, h);
  if (print) {
    const pixels = ctx.getImageData(0, 0, w, h);
    pixels.data.set(thresholdInk(pixels.data, w, h, cutoff, thickness));
    ctx.putImageData(pixels, 0, 0);
  }
  if (mask) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.515, w * 0.485, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

function paint(target: HTMLCanvasElement, source: HTMLCanvasElement | null): void {
  if (source) {
    target.width = source.width;
    target.height = source.height;
  }
  const ctx = target.getContext('2d');
  ctx?.clearRect(0, 0, target.width, target.height);
  if (source) ctx?.drawImage(source, 0, 0);
}

export function mountLocalComparison(config: Config): {
  reset: () => void;
  updateOriginal: () => void;
  deselect: () => void;
} {
  const compareButton = required<HTMLButtonElement>('local-compare-run');
  const status = required<HTMLParagraphElement>('local-compare-status');
  const original = required<HTMLCanvasElement>('local-original');
  const cutoffInput = required<HTMLInputElement>('local-ink-cutoff');
  const thicknessInput = required<HTMLInputElement>('local-ink-thickness');
  const maskInput = required<HTMLInputElement>('local-oval-mask');
  const rawButton = required<HTMLButtonElement>('local-mode-raw');
  const inkButton = required<HTMLButtonElement>('local-mode-ink');
  const chooseButtons = Object.fromEntries(STYLES.map((s) => [s, required<HTMLButtonElement>(`local-select-${s}`)])) as Record<Style, HTMLButtonElement>;
  const previews = Object.fromEntries(STYLES.map((s) => [s, required<HTMLCanvasElement>(`local-preview-${s}`)])) as Record<Style, HTMLCanvasElement>;
  const messages = Object.fromEntries(STYLES.map((s) => [s, required<HTMLParagraphElement>(`local-message-${s}`)])) as Record<Style, HTMLParagraphElement>;
  const rawResults: Partial<Record<Style, HTMLImageElement>> = {};
  let selected: Style | null = null;
  let mode: 'raw' | 'ink' = 'raw';
  let current = 0;
  let controller: AbortController | null = null;
  let serverReady = false;

  function show(message: string): void {
    status.textContent = message;
  }

  function updateOriginal(): void {
    const image = config.getImage();
    paint(original, image ? makePortraitInput(image, config.getCrop()) : null);
  }

  function renderSelected(): void {
    const image = selected ? rawResults[selected] : undefined;
    config.onSelect(image ? frameResult(image, true, maskInput.checked, Number(cutoffInput.value), Number(thicknessInput.value)) : null);
  }

  function deselect(): void {
    selected = null;
    for (const style of STYLES) chooseButtons[style].setAttribute('aria-pressed', 'false');
    config.onSelect(null);
  }

  function renderPreviews(): void {
    required<HTMLOutputElement>('local-cutoff-value').value = cutoffInput.value;
    required<HTMLOutputElement>('local-thickness-value').value = thicknessInput.value;
    rawButton.setAttribute('aria-pressed', String(mode === 'raw'));
    inkButton.setAttribute('aria-pressed', String(mode === 'ink'));
    for (const style of STYLES) {
      const image = rawResults[style];
      if (image) paint(previews[style], frameResult(image, mode === 'ink', maskInput.checked, Number(cutoffInput.value), Number(thicknessInput.value)));
    }
    if (selected) renderSelected();
  }

  function reset(): void {
    ++current;
    controller?.abort();
    controller = null;
    compareButton.disabled = !serverReady;
    for (const style of STYLES) {
      delete rawResults[style];
      chooseButtons[style].disabled = true;
      paint(previews[style], null);
      messages[style].textContent = 'Nog niet getest';
    }
    deselect();
    updateOriginal();
    if (serverReady) show('Kies Vergelijk om deze uitsnede met alle drie de modellen te verwerken.');
  }

  compareButton.disabled = true;
  if (!onLoopback()) {
    show('Lokale AI is uitsluitend beschikbaar via de lokale server op 127.0.0.1:8765. Er worden geen portretten naar de publieke site verstuurd.');
  } else {
    void fetch('/api/local/status', { cache: 'no-store', redirect: 'error' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Geen lokale server.');
        return response.json() as Promise<{ protocol: number; local: boolean; engines: Record<Style, { ready: boolean }> }>;
      })
      .then((info) => {
        if (info.protocol !== 4 || !info.local) throw new Error('Start eerst de 0.4-server.');
        serverReady = true;
        compareButton.disabled = false;
        show(`Lokale 0.4-server · ${STYLES.filter((s) => info.engines?.[s]?.ready).length}/3 modellen gevonden.`);
      })
      .catch(() => {
        show('Geen lokale 0.4-server gevonden. Sluit versie 0.3 en start de nieuwe versie.');
      });
  }

  compareButton.addEventListener('click', async () => {
    if (!serverReady || !onLoopback()) return;
    const image = config.getImage();
    if (!image) { show('Kies eerst een originele portretfoto.'); return; }
    reset();
    const turn = ++current;
    controller = new AbortController();
    compareButton.disabled = true;
    show('Drie modellen verwerken dezelfde uitsnede lokaal op de CPU…');
    try {
      const cropped = makePortraitInput(image, config.getCrop());
      paint(original, cropped);
      const png = await toBlob(cropped);
      if (turn !== current) return;
      const response = await fetch('/api/local/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: png,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      const data = await response.json() as ComparisonResponse;
      if (turn !== current) return;
      let ok = 0;
      for (const style of STYLES) {
        const result = data.results?.[style];
        if (!result?.ok || !result.png) {
          messages[style].textContent = result?.error || 'Geen uitvoer ontvangen.';
          continue;
        }
        try {
          const drawing = await fromPng(result.png);
          if (turn !== current) return;
          rawResults[style] = drawing;
          chooseButtons[style].disabled = false;
          messages[style].textContent = `${result.elapsed_ms ?? '?'} ms · echte modeluitvoer`;
          ++ok;
        } catch {
          messages[style].textContent = 'Kon de modeluitvoer niet openen.';
        }
      }
      renderPreviews();
      show(`${ok}/3 modellen klaar. Wissel tussen originele lijnen en zwart-witdruk; kies een resultaat voor de sticker.`);
    } catch (error) {
      if (turn !== current) return;
      show(`Vergelijken mislukt: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (turn === current) {
        compareButton.disabled = !serverReady;
        controller = null;
      }
    }
  });

  for (const style of STYLES) {
    chooseButtons[style].addEventListener('click', () => {
      if (!rawResults[style]) return;
      selected = style;
      for (const other of STYLES) chooseButtons[other].setAttribute('aria-pressed', String(style === other));
      renderSelected();
      show(`${LABELS[style]} staat in zwart-wit op de sticker. Pas de afwerking aan zonder opnieuw AI te draaien.`);
    });
  }
  rawButton.addEventListener('click', () => { mode = 'raw'; renderPreviews(); });
  inkButton.addEventListener('click', () => { mode = 'ink'; renderPreviews(); });
  maskInput.addEventListener('change', renderPreviews);
  for (const input of [cutoffInput, thicknessInput]) input.addEventListener('input', () => {
    mode = 'ink';
    renderPreviews();
  });

  return { reset, updateOriginal, deselect };
}
