import {describe,expect,it} from 'vitest';
import {FORMATS,pixels} from '../src/stickerwall/collectible-art.ts';
import {png300,sheetPlan} from '../src/stickerwall/collectible-print.ts';

describe('collectible print geometry',()=>{
  it('uses 300 ppi at both physical sizes',()=>{
    expect(FORMATS.trading.map(pixels)).toEqual([744,1039]);
    expect(FORMATS.postcard.map(pixels)).toEqual([1181,1772]);
    expect([pixels(210),pixels(297)]).toEqual([2480,3508]);
  });
  it('keeps six trading cards inside A4 with room for crop marks',()=>{
    const plan=sheetPlan('trading');expect(plan).toHaveLength(6);
    for(const p of plan){expect(p.x).toBeGreaterThan(2);expect(p.y).toBeGreaterThan(2);expect(p.x+p.w).toBeLessThan(208);expect(p.y+p.h).toBeLessThan(295);}
    expect(plan[1].x-plan[0].x-plan[0].w).toBe(5);
    expect(sheetPlan('postcard')).toHaveLength(1);
  });
  it('writes one pHYs chunk with 11811 pixels per meter',()=>{
    const signature=new Uint8Array([137,80,78,71,13,10,26,10]);
    const src=new Uint8Array(8+25+12);
    src.set(signature);const v=new DataView(src.buffer);v.setUint32(8,13);src.set(new TextEncoder().encode('IHDR'),12);src.set(new TextEncoder().encode('IEND'),37);
    const out=png300(src);expect(out.length).toBe(src.length+21);
    const d=new DataView(out.buffer);expect(d.getUint32(41)).toBe(11811);expect(d.getUint32(45)).toBe(11811);
    expect(png300(out)).toEqual(out);
  });
});
