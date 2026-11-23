// Privacy-first sample entrypoint. No camera, photos, uploads, analytics, persistence or AI.
import { printPhoto } from '../photo.ts';
import type { PrinterBase } from '../printers/base.ts';
import { connectPrinter } from '../printers/index.ts';
import { transport } from '../printers/transport.ts';
import { canvasToRaster, rasterToCanvas } from '../raster.ts';
import type { Raster } from '../types.ts';
import { drawSticker } from './artwork.ts';
import { makePortraitStyles, PORTRAIT_STYLES, type Crop, type PortraitStyle } from './portrait.ts';
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
const photoFile = el<HTMLInputElement>('portrait-file');
const removePhoto = el<HTMLButtonElement>('remove-photo');
const photoStatus = el<HTMLParagraphElement>('portrait-status');
const photoControls = el<HTMLDivElement>('portrait-controls');
const zoomSlider = el<HTMLInputElement>('portrait-zoom');
const xSlider = el<HTMLInputElement>('portrait-x');
const ySlider = el<HTMLInputElement>('portrait-y');
const thicknessSlider = el<HTMLInputElement>('portrait-thickness');
const styleButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-portrait-style]')];
let photo: ImageBitmap | null = null;
let portraitStyles: Record<PortraitStyle, HTMLCanvasElement> | null = null;
let portraitStyle: PortraitStyle = 'marker';
let scheduled: number | null = null;
let fileSelection = 0;

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
  const source = drawSticker(creature, qualities, portraitStyles?.[portraitStyle] ?? null);
  // Photoboot's 1-bit raster pipeline: threshold keeps crisp illustration outlines.
  raster = canvasToRaster(source, { dither: 'threshold' });
  const preview = rasterToCanvas(raster);
  stickerCanvas.width = preview.width;
  stickerCanvas.height = preview.height;
  stickerCanvas.getContext('2d')?.drawImage(preview, 0, 0);
  nameLabel.textContent = creatureName(creature, qualities);
  printButton.disabled = !printer?.connected || printing;
}

// File input is strictly local: there are no upload endpoints or persistence calls here.
function cropOptions(): Crop {
  return {
    zoom: Number(zoomSlider.value) / 100,
    panX: Number(xSlider.value),
    panY: Number(ySlider.value),
    thickness: Number(thicknessSlider.value),
  };
}

function rebuildPortrait(): void {
  scheduled = null;
  if (!photo) return;
  portraitStyles = makePortraitStyles(photo, cropOptions());
  for (const style of PORTRAIT_STYLES) {
    const canvas = el<HTMLCanvasElement>(style.id + '-preview');
    const result = portraitStyles[style.id];
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(result, 0, 0);
    }
  }
  photoStatus.textContent = 'Foto lokaal verwerkt. Kies de beste tekenstijl en bekijk je hoofd rechts op het wezen.';
  render();
}
function scheduleRebuild(): void {
  if (scheduled !== null) cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(rebuildPortrait);
  el<HTMLOutputElement>('zoom-value').value = zoomSlider.value + '%';
  el<HTMLOutputElement>('x-value').value = xSlider.value;
  el<HTMLOutputElement>('y-value').value = ySlider.value;
  el<HTMLOutputElement>('thickness-value').value = thicknessSlider.value;
}
function clearPhoto(): void {
  ++fileSelection;
  if (scheduled !== null) cancelAnimationFrame(scheduled);
  scheduled = null;
  photo?.close();
  photo = null;
  portraitStyles = null;
  photoFile.value = '';
  photoControls.hidden = true;
  removePhoto.disabled = true;
  photoStatus.textContent = 'Foto verwijderd uit de sessie. Het fictieve voorbeeldhoofd staat terug.';
  for (const style of PORTRAIT_STYLES) {
    const canvas = el<HTMLCanvasElement>(style.id + '-preview');
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }
  render();
}
photoFile.addEventListener('change', async () => {
  const chosen = photoFile.files?.[0];
  const serial = ++fileSelection;
  if (!chosen) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type) || chosen.size > 15_000_000) {
    photoStatus.textContent = 'Kies een JPG, PNG of WEBP van maximaal 15 MB.';
    photoFile.value = '';
    return;
  }
  photoStatus.textContent = 'Foto wordt op dit apparaat verwerkt…';
  try {
    const bitmap = await createImageBitmap(chosen);
    if (serial !== fileSelection) {
      bitmap.close();
      return;
    }
    if (bitmap.width < 100 || bitmap.height < 100) {
      bitmap.close();
      throw new Error('De foto is te klein (minimaal 100 × 100 pixels).');
    }
    photo?.close();
    photo = bitmap;
    photoControls.hidden = false;
    removePhoto.disabled = false;
    scheduleRebuild();
  } catch (error) {
    if (serial === fileSelection) {
      photoStatus.textContent = 'Foto kan niet worden geopend: ' + (error instanceof Error ? error.message : String(error));
    }
  } finally {
    photoFile.value = '';
  }
});
removePhoto.addEventListener('click', clearPhoto);
for (const slider of [zoomSlider, xSlider, ySlider, thicknessSlider]) {
  slider.addEventListener('input', () => { if (photo) scheduleRebuild(); });
}
for (const button of styleButtons) {
  button.addEventListener('click', () => {
    portraitStyle = button.dataset.portraitStyle as PortraitStyle;
    for (const other of styleButtons) {
      const active = other === button;
      other.classList.toggle('selected', active);
      other.setAttribute('aria-pressed', String(active));
    }
    render();
  });
}
window.addEventListener('pagehide', () => {
  photo?.close();
  photo = null;
  portraitStyles = null;
});

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
