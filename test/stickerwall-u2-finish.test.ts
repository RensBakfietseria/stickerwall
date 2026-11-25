import { describe, expect, it } from 'vitest';
import { thresholdInk } from '../src/stickerwall/ink.ts';
import { finishU2 } from '../src/stickerwall/u2-finish.ts';

function sample() {
  const w = 24, h = 24;
  const pixels = new Uint8ClampedArray(w*h*4).fill(255);
  function point(x: number, y: number, tone: number, alpha = 255) {
    const p = (y*w+x)*4;
    pixels.set([tone,tone,tone,alpha],p);
  }
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (x===0 || x===w-1 || y===0 || y===h-1) point(x,y,0,0);
  }
  for (let y=4;y<17;y++) {
    point(5,y,85);
    point(6,y,205);
    point(13,y,193);
  }
  point(20,20,60); // disconnected speck
  for(let y=6;y<12;y++) for(let x=17;x<21;x++) point(x,y,208); // weak flat shading
  return {pixels,w,h};
}
describe('U2 finishing presets', () => {
  it('keeps Basis equal to 0.5 print threshold for visible pixels', () => {
    const {pixels,w,h}=sample();
    const old=thresholdInk(pixels,w,h,180,0);
    const basis=finishU2(pixels,w,h,'basis');
    for(let i=0;i<w*h;i++) {
      if(pixels[i*4+3]) expect(basis[i*4]).toBe(old[i*4]);
    }
  });
  it('produces different binary prints while preserving exact head alpha and input', () => {
    const {pixels,w,h}=sample();
    const original=Array.from(pixels);
    const outputs=(['basis','bold','sticker'] as const).map(p=>finishU2(pixels,w,h,p));
    expect(new Set(outputs.map(o=>Array.from(o).join(','))).size).toBe(3);
    for(const out of outputs) for(let i=0;i<out.length;i++) {
      expect(out[i]===0 || out[i]===255).toBe(true);
      if(i%4===3) expect(out[i]).toBe(pixels[i]);
    }
    expect(Array.from(pixels)).toEqual(original);
  });
  it('removes isolated specks but retains supported fine lines', () => {
    const {pixels,w,h}=sample();
    const sticker=finishU2(pixels,w,h,'sticker');
    expect(sticker[(20*w+20)*4]).toBe(255);
    expect(sticker[(8*w+5)*4]).toBe(0);
    expect(sticker[(8*w+13)*4]).toBe(0);
    expect(sticker[(8*w+19)*4]).toBe(255);
  });
  it('does not invent ink on a completely white head', () => {
    const rgba=new Uint8ClampedArray(8*8*4).fill(255);
    expect(finishU2(rgba,8,8,'sticker').every(x=>x===255)).toBe(true);
  });
});
