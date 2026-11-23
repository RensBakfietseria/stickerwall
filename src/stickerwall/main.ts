// Privacy-first sample entrypoint. No camera, photos, uploads, analytics, persistence or AI.
import { printPhoto } from '../photo.ts';
import type { PrinterBase } from '../printers/base.ts';
import { connectPrinter } from '../printers/index.ts';
import { transport } from '../printers/transport.ts';
import { canvasToRaster, rasterToCanvas } from '../raster.ts';
import type { Raster } from '../types.ts';
import { drawSticker } from './artwork.ts';
import { CREATURES, QUALITIES, type Creature, type Quality, creatureName, toggleQuality } from './model.ts';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('Ontbrekend element: ' + id);
  return found as T;
}
const qualityRoot = el<HTMLDivElement>('qualities');
const creatureRoot = el<HTMLDivElement>('creatures');
const status = el<HTMLParagraphElement>('printer-status');
const nameLabel = el<HTMLParagraphElement>('sticker-name');
const stickerCanvas = el<HTMLCanvasElement>('sticker');
const connectButton = el<HTMLButtonElement>('connect');
const printButton = el<HTMLButtonElement>('print');

let creature: Creature = 'axolotl';
let qualities: Quality[] = ['Zorgzaam', 'Creatief', 'Verbindend'];
let printer: PrinterBase | null = null;
let raster: Raster | null = null;
let printing = false;

function setStatus(message: string): void {
  status.textContent = message;
}

function renderChoices(): void {
  qualityRoot.replaceChildren();
  for (const quality of QUALITIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip' + (qualities.includes(quality) ? ' selected' : '');
    button.textContent = quality;
    button.setAttribute('aria-pressed', String(qualities.includes(quality)));
    button.disabled = printing || (qualities.length === 3 && !qualities.includes(quality));
    button.addEventListener('click', () => {
      qualities = toggleQuality(qualities, quality);
      render();
    });
    qualityRoot.append(button);
  }
  creatureRoot.replaceChildren();
  for (const item of CREATURES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'creature' + (creature === item.id ? ' selected' : '');
    button.setAttribute('aria-pressed', String(creature === item.id));
    button.innerHTML = '<strong>' + item.label + '</strong><small>' + item.character + '</small>';
    button.disabled = printing;
    button.addEventListener('click', () => {
      creature = item.id;
      render();
    });
    creatureRoot.append(button);
  }
}

function render(): void {
  renderChoices();
  const source = drawSticker(creature, qualities);
  // Photoboot's 1-bit raster pipeline: threshold keeps crisp illustration outlines.
  raster = canvasToRaster(source, { dither: 'threshold' });
  const preview = rasterToCanvas(raster);
  stickerCanvas.width = preview.width;
  stickerCanvas.height = preview.height;
  stickerCanvas.getContext('2d')?.drawImage(preview, 0, 0);
  nameLabel.textContent = creatureName(creature, qualities);
  printButton.disabled = !printer?.connected || printing;
}

connectButton.addEventListener('click', async () => {
  connectButton.disabled = true;
  setStatus('Zoeken naar een Bluetooth-printer…');
  try {
    printer = await connectPrinter('auto', {
      onLog: (message) => setStatus(message),
      onDisconnect: () => {
        setStatus('Printerverbinding verbroken. Klik opnieuw op verbinden.');
        printer = null;
        connectButton.disabled = false;
        render();
      },
    });
    setStatus('Verbonden met ' + (printer.device?.name || 'Bluetooth-printer') + '. Klaar voor een proefafdruk.');
  } catch (error) {
    setStatus('Verbinding mislukt: ' + (error instanceof Error ? error.message : String(error)));
    printer = null;
  } finally {
    connectButton.disabled = Boolean(printer?.connected);
    render();
  }
});

printButton.addEventListener('click', async () => {
  if (printing || !printer || !raster) return;
  printing = true;
  render();
  setStatus('Proefsticker wordt geprint…');
  try {
    if (!printer.connected) await printer.reconnect();
    await printPhoto(printer, raster, { copies: 1, density: 4 });
    setStatus('Proefsticker verzonden naar de printer.');
  } catch (error) {
    setStatus('Printen mislukt: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    printing = false;
    render();
  }
});

if (!transport().available) {
  connectButton.disabled = true;
  setStatus('Web Bluetooth is hier niet beschikbaar. Open de app in Chrome of Edge op localhost; het stickerontwerp werkt zonder printer.');
}
render();
