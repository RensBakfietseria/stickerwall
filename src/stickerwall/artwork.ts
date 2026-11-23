import type { Creature, Quality } from './model.ts';
import { creatureName } from './model.ts';

export const PRINT_WIDTH = 552;
export const PRINT_HEIGHT = 800;

// Technical placeholder drawings: not the final illustrated animal assets.
const ink = '#171717';
function path(ctx: CanvasRenderingContext2D, commands: (ctx: CanvasRenderingContext2D) => void, fill = '#fff', width = 5) {
  ctx.beginPath();
  commands(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill = '#fff', width = 5) {
  path(ctx, (c) => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), fill, width);
}
function line(ctx: CanvasRenderingContext2D, coordinates: number[], width = 3) {
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(coordinates[0], coordinates[1]);
  for (let i = 2; i < coordinates.length; i += 2) ctx.lineTo(coordinates[i], coordinates[i + 1]);
  ctx.stroke();
}
function serif(ctx: CanvasRenderingContext2D, text: string, y: number, maxWidth = 505, size = 38) {
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = 'bold ' + size + 'px Georgia, serif';
  ctx.fillText(text, PRINT_WIDTH / 2, y, maxWidth);
}
function axolotl(ctx: CanvasRenderingContext2D) {
  // Tail sits behind the body.
  path(ctx, (c) => {
    c.moveTo(343, 498); c.bezierCurveTo(505, 418, 478, 559, 407, 563);
    c.bezierCurveTo(381, 551, 387, 533, 332, 550); c.closePath();
  }, '#fff', 6);
  for (const [s, flip] of [[-1, 0], [1, 0]] as const) {
    ctx.save(); ctx.translate(276, 260); ctx.scale(s, 1);
    for (const angle of [-0.64, 0, 0.57]) {
      ctx.save(); ctx.rotate(angle);
      path(ctx, (c) => { c.moveTo(91, 4); c.bezierCurveTo(154, -33, 192, -23, 191, 1);
        c.bezierCurveTo(179, 25, 145, 16, 90, 24); c.closePath(); }, '#fff', 5);
      line(ctx, [114, 11, 174, 3], 3);
      ctx.restore();
    }
    ctx.restore();
    void flip;
  }
  ellipse(ctx, 276, 448, 117, 156);
  ellipse(ctx, 276, 475, 78, 116, '#fff', 3);
  path(ctx, (c) => { c.moveTo(172, 440); c.bezierCurveTo(111, 430, 102, 496, 138, 529);
    c.bezierCurveTo(154, 545, 169, 521, 181, 489); c.closePath(); });
  path(ctx, (c) => { c.moveTo(382, 440); c.bezierCurveTo(452, 430, 459, 496, 421, 529);
    c.bezierCurveTo(408, 545, 386, 521, 370, 489); c.closePath(); });
  ellipse(ctx, 225, 580, 41, 19);
  ellipse(ctx, 329, 580, 41, 19);
  for (const x of [219, 329]) for (let i = 0; i < 3; i++) line(ctx, [x - 15 + i * 15, 582, x - 16 + i * 15, 592], 2);
}
function dragon(ctx: CanvasRenderingContext2D) {
  path(ctx, (c) => { c.moveTo(198, 363); c.bezierCurveTo(113, 288, 100, 335, 65, 346);
    c.bezierCurveTo(84, 375, 86, 428, 65, 469); c.bezierCurveTo(120, 449, 136, 483, 189, 491); c.closePath(); });
  path(ctx, (c) => { c.moveTo(357, 363); c.bezierCurveTo(446, 275, 460, 342, 484, 350);
    c.bezierCurveTo(474, 378, 478, 431, 502, 464); c.bezierCurveTo(442, 449, 421, 489, 366, 495); c.closePath(); });
  path(ctx, (c) => { c.moveTo(341, 505); c.bezierCurveTo(470, 516, 462, 560, 426, 579);
    c.bezierCurveTo(435, 540, 378, 549, 349, 562); c.closePath(); });
  ellipse(ctx, 276, 458, 117, 145);
  ellipse(ctx, 276, 483, 69, 98, '#fff', 3);
  for (let y = 413; y < 555; y += 19) line(ctx, [231, y, 321, y], 2);
  path(ctx, (c) => { c.moveTo(181, 440); c.bezierCurveTo(120, 450, 126, 522, 165, 533);
    c.lineTo(187, 512); c.lineTo(185, 481); c.closePath(); });
  path(ctx, (c) => { c.moveTo(371, 440); c.bezierCurveTo(433, 449, 426, 518, 387, 533);
    c.lineTo(365, 512); c.lineTo(365, 481); c.closePath(); });
  ellipse(ctx, 226, 579, 42, 23);
  ellipse(ctx, 326, 579, 42, 23);
  for (const x of [211, 226, 241, 311, 326, 341]) line(ctx, [x, 590, x + 4, 601], 3);
}
function penguin(ctx: CanvasRenderingContext2D) {
  path(ctx, (c) => { c.moveTo(182, 409); c.bezierCurveTo(92, 381, 121, 502, 150, 537);
    c.bezierCurveTo(175, 544, 186, 495, 211, 454); c.closePath(); });
  path(ctx, (c) => { c.moveTo(369, 409); c.bezierCurveTo(469, 387, 429, 516, 403, 538);
    c.bezierCurveTo(379, 548, 366, 484, 342, 452); c.closePath(); });
  ellipse(ctx, 276, 450, 112, 156, ink, 5);
  ellipse(ctx, 276, 462, 76, 124, '#fff', 4);
  path(ctx, (c) => { c.moveTo(250, 580); c.bezierCurveTo(198, 590, 188, 614, 217, 621);
    c.lineTo(275, 612); c.closePath(); }, '#fff', 5);
  path(ctx, (c) => { c.moveTo(302, 580); c.bezierCurveTo(355, 590, 370, 616, 333, 621);
    c.lineTo(280, 612); c.closePath(); }, '#fff', 5);
  for (const y of [490, 502, 515]) line(ctx, [243, y, 261, y + 6], 2);
}

// Fictional drawn portrait. Real portrait AI will replace only this layer.
function placeholderHead(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(276, 272);
  // Neck is tucked into the animal collar instead of pasted on top.
  path(ctx, (c) => { c.moveTo(-31, 79); c.lineTo(-31, 123); c.quadraticCurveTo(0, 144, 32, 123);
    c.lineTo(32, 78); c.closePath(); }, '#fff', 5);
  ellipse(ctx, -75, 3, 16, 26, '#fff', 4);
  ellipse(ctx, 75, 3, 16, 26, '#fff', 4);
  path(ctx, (c) => { c.moveTo(-77, -51); c.bezierCurveTo(-80, -109, 72, -114, 77, -43);
    c.lineTo(68, 45); c.bezierCurveTo(55, 104, -56, 104, -68, 43);
    c.closePath(); }, '#fff', 5);
  // Hair sits on the silhouette and is a deliberately stylized sample.
  path(ctx, (c) => { c.moveTo(-76, -34); c.bezierCurveTo(-88, -115, 67, -125, 78, -47);
    c.lineTo(70, -11); c.lineTo(58, -52); c.bezierCurveTo(38, -42, 19, -71, 4, -62);
    c.bezierCurveTo(-18, -38, -48, -42, -62, -15); c.closePath(); }, ink, 2);
  // Distinctive eyebrows, eyes and glasses.
  line(ctx, [-55, -10, -14, -16], 5);
  line(ctx, [14, -16, 53, -10], 5);
  ctx.lineWidth = 4;
  ctx.strokeStyle = ink;
  for (const x of [-33, 33]) { ctx.beginPath(); ctx.ellipse(x, 7, 28, 20, 0, 0, Math.PI * 2); ctx.stroke(); }
  line(ctx, [-5, 7, 5, 7], 4);
  for (const x of [-33, 33]) { ellipse(ctx, x, 10, 3, 4, ink, 0); }
  line(ctx, [-1, 4, -10, 35, 5, 39], 3);
  path(ctx, (c) => { c.moveTo(-26, 55); c.quadraticCurveTo(0, 71, 25, 55);
    c.quadraticCurveTo(0, 79, -26, 55); }, '#fff', 2.5);
  line(ctx, [-57, 39, -49, 40], 2);
  line(ctx, [50, 39, 58, 38], 2);
  // Foreground collar hides the head-body joint.
  path(ctx, (c) => { c.moveTo(-47, 95); c.lineTo(-6, 137); c.lineTo(0, 122);
    c.lineTo(10, 138); c.lineTo(49, 95); c.quadraticCurveTo(0, 114, -47, 95); c.closePath(); }, '#fff', 4);
  ctx.restore();
}

// A photo-derived line drawing replaces only the fictional head, never the body.
// The neck/collar is drawn last to disguise the head-body seam.
function portraitHead(ctx: CanvasRenderingContext2D, head: HTMLCanvasElement) {
  ctx.drawImage(head, 163, 148, 226, 252);
  ctx.save();
  ctx.translate(276, 272);
  path(ctx, (c) => {
    c.moveTo(-32, 95); c.lineTo(-33, 122); c.quadraticCurveTo(0, 145, 33, 122);
    c.lineTo(31, 95); c.closePath();
  }, '#fff', 4);
  path(ctx, (c) => {
    c.moveTo(-48, 95); c.lineTo(-7, 139); c.lineTo(0, 120);
    c.lineTo(10, 138); c.lineTo(49, 95); c.quadraticCurveTo(0, 116, -48, 95);
    c.closePath();
  }, '#fff', 4);
  ctx.restore();
}

export function drawSticker(creature: Creature, qualities: readonly Quality[], portrait: HTMLCanvasElement | null = null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PRINT_WIDTH;
  canvas.height = PRINT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is niet beschikbaar.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PRINT_WIDTH, PRINT_HEIGHT);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, PRINT_WIDTH - 36, PRINT_HEIGHT - 36);
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('EEN BIJZONDER BEEST', PRINT_WIDTH / 2, 64);
  line(ctx, [70, 83, 482, 83], 2);
  switch (creature) {
    case 'axolotl': axolotl(ctx); break;
    case 'dragon': dragon(ctx); break;
    case 'penguin': penguin(ctx); break;
  }
  if (portrait) portraitHead(ctx, portrait);
  else placeholderHead(ctx);
  line(ctx, [76, 640, 476, 640], 2);
  const name = creatureName(creature, qualities);
  serif(ctx, name, 686, 469, 31);
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText(qualities.length ? qualities.join(' · ').toUpperCase() : 'KIES DRIE MOOIE KWALITEITEN', 276, 732, 470);
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('STICKERWALL / ILLUSTRATIEPROEF MET FICTIEF HOOFD', 276, 759);
  return canvas;
}
