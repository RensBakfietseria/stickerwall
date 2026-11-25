import { makePortraitInput, type Crop } from './portrait.ts';

type Engine = 'gmic' | 'informative';
type BackendResult = { ok: boolean; png?: string; error?: string; elapsed_ms?: number };
type ComparisonResponse = { results: Record<Engine, BackendResult> };
type Config = {
  getImage: () => ImageBitmap | null;
  getCrop: () => Crop;
  onSelect: (portrait: HTMLCanvasElement | null) => void;
};
function required<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('Ontbrekend Hoofdlab-element: ' + id);
  return found as T;
}
function onLoopback(): boolean {
  return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
}
function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Kon geen PNG maken.')), 'image/png');
  });
}
function fromPng(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Ongeldige PNG-uitvoer.'));
    image.src = 'data:image/png;base64,' + base64;
  });
}
function frameResult(image: HTMLImageElement): HTMLCanvasElement {
  // Match the existing transparent elliptical portrait layer, 240x270.
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 270;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D ontbreekt.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(120, 139, 116.4, 129.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

/** Adds a real local quality comparison to the EXISTING Proefatelier. */
export function mountLocalComparison(config: Config): { reset: () => void } {
  const compareButton = required<HTMLButtonElement>('local-compare-run');
  const localStatus = required<HTMLParagraphElement>('local-compare-status');
  const engineResults = {} as Partial<Record<Engine, HTMLCanvasElement>>;
  const chooseButtons: Record<Engine, HTMLButtonElement> = {
    gmic: required('local-select-gmic'),
    informative: required('local-select-informative'),
  };
  let current = 0;
  let controller: AbortController | null = null;

  function show(message: string): void { localStatus.textContent = message; }
  function reset(): void {
    ++current;
    controller?.abort();
    controller = null;
    for (const key of ['gmic', 'informative'] as const) {
      delete engineResults[key];
      chooseButtons[key].disabled = true;
      const preview = required<HTMLCanvasElement>('local-preview-' + key);
      preview.getContext('2d')?.clearRect(0, 0, preview.width, preview.height);
      const msg = required<HTMLParagraphElement>('local-message-' + key);
      msg.textContent = 'Nog niet getest';
    }
    config.onSelect(null);
  }

  // Public Vercel demo may show the button but MUST NEVER send image pixels
  // to Vercel or a non-loopback host. Same-origin loopback is required.
  if (!onLoopback()) {
    compareButton.disabled = true;
    show('Lokale AI is alleen beschikbaar via het Proefatelier op je eigen computer (127.0.0.1). De publieke kijkdemo verstuurt geen portretten.');
  } else {
    void fetch('/api/local/status', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('geen lokale server');
        return response.json() as Promise<{ engines: Record<Engine, { ready: boolean }> }>;
      })
      .then(info => show('Lokale server bereikbaar. G’MIC: ' +
        (info.engines.gmic.ready ? 'klaar' : 'ontbreekt') +
        ' · Informative Drawings: ' +
        (info.engines.informative.ready ? 'klaar' : 'ontbreekt') +
        '. Selecteer een foto en klik op vergelijken.'))
      .catch(() => {
        compareButton.disabled = true;
        show('Geen lokale AI-server gevonden. Start de Python-server op 127.0.0.1:8765; de gewone foto-filters blijven beschikbaar.');
      });
  }

  compareButton.addEventListener('click', async () => {
    if (!onLoopback()) return;
    const image = config.getImage();
    if (!image) { show('Kies eerst een onbewerkte portretfoto.'); return; }
    reset();
    const turn = ++current;
    controller = new AbortController();
    compareButton.disabled = true;
    show('Foto wordt op deze computer verwerkt door G’MIC en Informative Drawings. Dit kan even duren…');
    try {
      const cropped = makePortraitInput(image, config.getCrop());
      const png = await toBlob(cropped);
      if (turn !== current) return;
      // The origin and destination are both this PC: http://127.0.0.1:8765
      const response = await fetch('/api/local/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: png,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as {error?: string};
        throw new Error(err.error || 'Lokale verwerking mislukt: HTTP ' + response.status);
      }
      const data = await response.json() as ComparisonResponse;
      if (turn !== current) return;
      let ok = 0;
      for (const key of ['gmic', 'informative'] as const) {
        const result = data.results?.[key];
        const msg = required<HTMLParagraphElement>('local-message-' + key);
        if (!result?.ok || !result.png) {
          msg.textContent = result?.error || 'Geen uitvoer ontvangen.';
          continue;
        }
        const drawing = frameResult(await fromPng(result.png));
        if (turn !== current) return;
        engineResults[key] = drawing;
        const preview = required<HTMLCanvasElement>('local-preview-' + key);
        const ctx = preview.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, preview.width, preview.height);
          ctx.drawImage(drawing, 0, 0, preview.width, preview.height);
        }
        chooseButtons[key].disabled = false;
        msg.textContent = 'Klaar in ' + (result.elapsed_ms ?? '?') + ' ms';
        ++ok;
      }
      show(ok === 2 ? 'Beide echte lokale technieken klaar. Kies welke je op het wezen wilt zien.' :
        ok === 1 ? 'Eén techniek werkte. De andere geeft hierboven aan wat ontbreekt.' :
        'Geen van beide technieken werkte. Controleer de foutmeldingen en lokale installatie.');
    } catch (error) {
      if (turn !== current) return;
      show('Vergelijken mislukt: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (turn === current) compareButton.disabled = false;
    }
  });

  for (const key of ['gmic', 'informative'] as const) {
    chooseButtons[key].addEventListener('click', () => {
      const result = engineResults[key];
      if (!result) return;
      for (const other of ['gmic', 'informative'] as const) {
        chooseButtons[other].setAttribute('aria-pressed', String(other === key));
      }
      config.onSelect(result);
      show((key === 'gmic' ? 'G’MIC Line Art' : 'Informative Drawings') +
        ' staat op het dierenlichaam. De originele foto is niet opgeslagen.');
    });
  }
  return { reset };
}
