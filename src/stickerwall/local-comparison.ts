import { thresholdInk } from './ink.ts';
import { finishAdaptive } from './u2-adaptive.ts';
import { finishU2, type U2Finish } from './u2-finish.ts';
import { type Crop, makePortraitInput } from './portrait.ts';

const MODELS = ['u2net', 'contour', 'contourplus', 'opensketch', 'anime'] as const;
type Model = (typeof MODELS)[number];
const STYLES = ['u2net', 'u2bold', 'u2sticker', 'u2adaptive', 'contour', 'contourplus', 'opensketch', 'anime'] as const;
type Style = (typeof STYLES)[number];
const PRESETS: Partial<Record<Style, U2Finish>> = { u2net: 'basis', u2bold: 'bold', u2sticker: 'sticker' };
const modelFor = (style: Style): Model => PRESETS[style] || style === 'u2adaptive' ? 'u2net' : style as Model;
const LABELS: Record<Style, string> = {
  opensketch: 'OpenSketch',
  contour: 'Contour',
  contourplus: 'Contour+',
  u2net: 'U² Basis',
  u2bold: 'U² Bold',
  u2sticker: 'U² Sticker',
  u2adaptive: 'U² Adaptief',
  anime: 'Anime',
};
type BackendResult = { ok: boolean; png?: string; error?: string; elapsed_ms?: number };
type ComparisonResponse = { results: Partial<Record<Model | 'isolated' | 'regions', BackendResult>> };
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
function frameResult(image: HTMLImageElement, print: boolean, mask: boolean, cutoff: number, thickness: number, natural = false, preset?: U2Finish, adaptive?: {regions: Uint8ClampedArray; hair: number; detail: number}): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = print ? 226 : image.naturalWidth;
  canvas.height = print ? 252 : image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: print });
  if (!ctx) throw new Error('Canvas 2D ontbreekt.');
  const w = canvas.width;
  const h = canvas.height;
  if (!natural) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, w, h);
  if (print) {
    const pixels = ctx.getImageData(0, 0, w, h);
    const ink = adaptive ? finishAdaptive(pixels.data, w, h, adaptive.regions, cutoff, thickness, adaptive.hair, adaptive.detail) : preset ? finishU2(pixels.data, w, h, preset, cutoff, thickness) : thresholdInk(pixels.data, w, h, cutoff, thickness);
    if (natural && !preset && !adaptive) {
      // Keep the semantic head silhouette instead of a rectangular white box.
      for (let i = 3; i < ink.length; i += 4) ink[i] = pixels.data[i] >= 128 ? 255 : 0;
    }
    pixels.data.set(ink);
    ctx.putImageData(pixels, 0, 0);
  }
  if (mask && !natural) {
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
  const isolated = required<HTMLCanvasElement>('local-isolated');
  const isolatedMessage = required<HTMLParagraphElement>('local-isolated-message');
  const natural = (style: Style) => style === 'contourplus' || Boolean(PRESETS[style]) || style === 'u2adaptive';
  const hairInput = required<HTMLInputElement>('local-hair-relief');
  const detailInput = required<HTMLInputElement>('local-face-detail');
  const regionPreview = required<HTMLCanvasElement>('local-regions');
  const regionMessage = required<HTMLParagraphElement>('local-regions-message');
  let regionPixels: Uint8ClampedArray | null = null;
  const adaptiveFor = (style: Style) => style === 'u2adaptive' && regionPixels ? {regions: regionPixels, hair: Number(hairInput.value), detail: Number(detailInput.value)} : undefined;
  const references = required<HTMLInputElement>('local-include-references');
  const referenceDetails = required<HTMLDetailsElement>('local-reference-details');
  const cutoffInput = required<HTMLInputElement>('local-ink-cutoff');
  const thicknessInput = required<HTMLInputElement>('local-ink-thickness');
  const maskInput = required<HTMLInputElement>('local-oval-mask');
  const rawButton = required<HTMLButtonElement>('local-mode-raw');
  const inkButton = required<HTMLButtonElement>('local-mode-ink');
  const chooseButtons = Object.fromEntries(STYLES.map((s) => [s, required<HTMLButtonElement>(`local-select-${s}`)])) as Record<Style, HTMLButtonElement>;
  const previews = Object.fromEntries(STYLES.map((s) => [s, required<HTMLCanvasElement>(`local-preview-${s}`)])) as Record<Style, HTMLCanvasElement>;
  const messages = Object.fromEntries(STYLES.map((s) => [s, required<HTMLParagraphElement>(`local-message-${s}`)])) as Record<Style, HTMLParagraphElement>;
  const rawResults: Partial<Record<Model, HTMLImageElement>> = {};
  let selected: Style | null = null;
  let mode: 'raw' | 'ink' = 'ink';
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
    const image = selected ? rawResults[modelFor(selected)] : undefined;
    config.onSelect(image && selected ? frameResult(image, true, maskInput.checked, Number(cutoffInput.value), Number(thicknessInput.value), natural(selected), PRESETS[selected], adaptiveFor(selected)) : null);
  }

  function deselect(): void {
    selected = null;
    for (const style of STYLES) chooseButtons[style].setAttribute('aria-pressed', 'false');
    config.onSelect(null);
  }

  function renderPreviews(): void {
    required<HTMLOutputElement>('local-cutoff-value').value = cutoffInput.value;
    required<HTMLOutputElement>('local-thickness-value').value = thicknessInput.value;
    required<HTMLOutputElement>('local-hair-value').value = hairInput.value;
    required<HTMLOutputElement>('local-face-value').value = detailInput.value;
    rawButton.setAttribute('aria-pressed', String(mode === 'raw'));
    inkButton.setAttribute('aria-pressed', String(mode === 'ink'));
    for (const style of STYLES) {
      const image = rawResults[modelFor(style)];
      if (image && (style !== 'u2adaptive' || regionPixels)) paint(previews[style], frameResult(image, mode === 'ink' || style === 'u2bold' || style === 'u2sticker' || style === 'u2adaptive', maskInput.checked, Number(cutoffInput.value), Number(thicknessInput.value), natural(style), PRESETS[style], adaptiveFor(style)));
    }
    if (selected) renderSelected();
  }

  function reset(): void {
    ++current;
    controller?.abort();
    controller = null;
    compareButton.disabled = !serverReady;
    for (const style of STYLES) {
      delete rawResults[modelFor(style)];
      chooseButtons[style].disabled = true;
      paint(previews[style], null);
      messages[style].textContent = 'Nog niet getest';
    }
    regionPixels = null;
    paint(regionPreview, null);
    regionMessage.textContent = 'Nog niet getest';
    paint(isolated, null);
    isolatedMessage.textContent = 'Nog niet getest';
    deselect();
    updateOriginal();
    references.disabled = false;
    if (serverReady) show('Kies Vergelijk om de vier U²-afwerkingen te maken.');
  }

  compareButton.disabled = true;
  if (!onLoopback()) {
    show('Lokale AI is uitsluitend beschikbaar via de lokale server op 127.0.0.1:8765. Er worden geen portretten naar de publieke site verstuurd.');
  } else {
    void fetch('/api/local/status', { cache: 'no-store', redirect: 'error' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Geen lokale server.');
        return response.json() as Promise<{ protocol: number; local: boolean; engines: Record<Model, { ready: boolean }> }>;
      })
      .then((info) => {
        if (info.protocol !== 9 || !info.local) throw new Error('Start eerst de 0.9-server.');
        serverReady = true;
        compareButton.disabled = false;
        show(info.engines?.u2net?.ready ? 'Lokale 0.9-server · U²-Net en hoofdsegmentatie klaar.' : 'Lokale 0.9-server · U²-model of hoofdsegmentatie ontbreekt. Voer setup uit.');
      })
      .catch(() => {
        show('Geen lokale 0.9-server gevonden. Sluit de oude versie en start de nieuwe versie.');
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
    const includeReferences = references.checked;
    references.disabled = true;
    if (includeReferences) referenceDetails.open = true;
    show(includeReferences ? 'U²-Net en oude referentiemodellen worden lokaal verwerkt…' : 'Hoofdsegmentatie en één U²-Net-inferentie worden lokaal verwerkt…');
    try {
      const cropped = makePortraitInput(image, config.getCrop());
      paint(original, cropped);
      const png = await toBlob(cropped);
      if (turn !== current) return;
      const response = await fetch(includeReferences ? '/api/local/compare?references=1' : '/api/local/compare', {
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
      const head = data.results?.isolated;
      if (head?.ok && head.png) {
        try {
          const image = await fromPng(head.png);
          if (turn !== current) return;
          paint(isolated, frameResult(image, false, false, 180, 0));
          isolatedMessage.textContent = 'BiSeNet · alleen het hoofd';
        } catch {
          isolatedMessage.textContent = 'Kon de uitsnede niet openen.';
        }
      } else {
        isolatedMessage.textContent = head?.error || 'Hoofdsegmentatie niet beschikbaar.';
      }
      const regionResult = data.results?.regions;
      if (regionResult?.ok && regionResult.png) {
        try {
          const image = await fromPng(regionResult.png);
          if (turn !== current) return;
          const map = document.createElement('canvas');
          map.width = 226; map.height = 252;
          const ctx = map.getContext('2d', {willReadFrequently: true});
          if (!ctx) throw new Error('Geen regio-canvas.');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 0, 0, 226, 252);
          const pixels = ctx.getImageData(0, 0, 226, 252).data;
          if (!pixels.some((v,i) => (i%4===0 || i%4===1) && v>=128)) throw new Error('Geen bruikbare haar- of detailregio.');
          regionPixels = pixels;
          paint(regionPreview, map);
          regionMessage.textContent = 'Rood = haar, groen = gezichtdetails, blauw = buitenrand.';
        } catch {
          regionMessage.textContent = 'Regiokaart niet bruikbaar; Sticker blijft beschikbaar.';
        }
      } else {
        regionMessage.textContent = 'Regiokaart ontbreekt; Sticker blijft beschikbaar.';
      }
      let ok = 0;
      for (const model of MODELS) {
        const result = data.results?.[model];
        const variants = STYLES.filter((style) => modelFor(style) === model);
        if (!result?.ok || !result.png) {
          for (const style of variants) messages[style].textContent = result?.error || (model === 'u2net' || includeReferences ? 'Geen uitvoer ontvangen.' : 'Niet meegerekend; vink referenties aan.');
          continue;
        }
        try {
          const drawing = await fromPng(result.png);
          if (turn !== current) return;
          rawResults[model] = drawing;
          for (const style of variants) {
            if (style === 'u2adaptive' && !regionPixels) {
              messages[style].textContent = 'Geen bruikbare regiokaart; kies Sticker.';
              continue;
            }
            chooseButtons[style].disabled = false;
            messages[style].textContent = model === 'u2net'
              ? style === 'u2net' ? (result.elapsed_ms ?? '?') + ' ms · één U²-modeluitvoer' : style === 'u2adaptive' ? 'Zelfde U²-uitvoer · regionale afwerking' : 'Zelfde U²-uitvoer · lokale afwerking'
              : (result.elapsed_ms ?? '?') + ' ms · referentie';
          }
          ++ok;
        } catch {
          for (const style of variants) messages[style].textContent = 'Kon de modeluitvoer niet openen.';
        }
      }
      if (rawResults.u2net) {
        selected = 'u2sticker';
        for (const style of STYLES) chooseButtons[style].setAttribute('aria-pressed', String(style === selected));
      }
      renderPreviews();
      show(rawResults.u2net
        ? (regionPixels ? 'Vier U²-afwerkingen klaar. ' : 'Drie U²-afwerkingen klaar; Adaptief niet beschikbaar. ') + 'Sticker blijft de standaard.' + (includeReferences ? ' ' + (ok - 1) + '/4 referenties klaar.' : '')
        : 'U²-Net is niet gelukt; bekijk de foutmeldingen. Beschikbare referenties blijven kiesbaar.');
    } catch (error) {
      if (turn !== current) return;
      show(`Vergelijken mislukt: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (turn === current) {
        compareButton.disabled = !serverReady;
        references.disabled = false;
        controller = null;
      }
    }
  });

  for (const style of STYLES) {
    chooseButtons[style].addEventListener('click', () => {
      if (!rawResults[modelFor(style)] || (style === 'u2adaptive' && !regionPixels)) return;
      selected = style;
      for (const other of STYLES) chooseButtons[other].setAttribute('aria-pressed', String(style === other));
      renderSelected();
      show(`${LABELS[style]} staat in zwart-wit op de sticker. Pas de afwerking aan zonder opnieuw AI te draaien.`);
    });
  }
  required<HTMLButtonElement>('local-reset-finish').addEventListener('click', () => {
    cutoffInput.value = '180';
    thicknessInput.value = '0';
    hairInput.value = '1';
    detailInput.value = '1';
    mode = 'ink';
    renderPreviews();
  });
  rawButton.addEventListener('click', () => { mode = 'raw'; renderPreviews(); });
  inkButton.addEventListener('click', () => { mode = 'ink'; renderPreviews(); });
  maskInput.addEventListener('change', renderPreviews);
  for (const input of [cutoffInput, thicknessInput, hairInput, detailInput]) input.addEventListener('input', () => {
    mode = 'ink';
    renderPreviews();
  });

  return { reset, updateOriginal, deselect };
}
