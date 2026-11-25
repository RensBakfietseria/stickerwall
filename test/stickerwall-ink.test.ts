import { describe, expect, it } from 'vitest';
import { thresholdInk } from '../src/stickerwall/ink.ts';

describe('Artistiek Portretlab print finishing', () => {
  it('creates strictly binary opaque pixels and respects threshold', () => {
    const rgba = new Uint8ClampedArray([100,100,100,255,200,200,200,255,0,0,0,0]);
    expect(Array.from(thresholdInk(rgba,3,1,180,0))).toEqual([0,0,0,255,255,255,255,255,255,255,255,255]);
    expect(thresholdInk(rgba,3,1,220,0)[4]).toBe(0);
  });
  it('thickens lines without wrapping from one row to another', () => {
    const rgba = new Uint8ClampedArray(3*2*4).fill(255);
    rgba[8] = rgba[9] = rgba[10] = 0;
    const result = thresholdInk(rgba,3,2,180,1);
    expect([0,4,8,12,16,20].map(i=>result[i])).toEqual([255,0,0,255,255,0]);
  });
});
