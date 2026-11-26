import { describe, expect, it } from 'vitest';
import { finishU2 } from '../src/stickerwall/u2-finish.ts';
import { finishAdaptive } from '../src/stickerwall/u2-adaptive.ts';

describe('adaptive U2 finishing',()=>{
  const w=30,h=24;
  function fixture(){
    const rgba=new Uint8ClampedArray(w*h*4).fill(255);
    const regions=new Uint8ClampedArray(w*h*4);
    for(let i=0;i<w*h;i++)regions[i*4+3]=255;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=(y*w+x)*4;
      if(x===0||x===w-1||y===0||y===h-1)rgba[p+3]=0;
      else if(y===1||y===h-2||x===1||x===w-2)regions[p+2]=255;
      else if(x<12)regions[p]=255;
      else if(x>17)regions[p+1]=255;
      const tone=(x===5||x===21)?85:(x===6?207:(x===22?219:255));
      if(y>4&&y<19)rgba[p]=rgba[p+1]=rgba[p+2]=tone;
    }
    return {rgba,regions};
  }
  it('only removes ink in hair and adds it in features, preserving alpha and other areas',()=>{
    const {rgba,regions}=fixture(),base=finishU2(rgba,w,h,'sticker'),a=finishAdaptive(rgba,w,h,regions);
    let hair=0,detail=0;
    for(let i=0;i<w*h;i++){
      const p=i*4;
      expect(a[p+3]).toBe(base[p+3]);
      if(regions[p+2]||!base[p+3]||(!regions[p]&&!regions[p+1])) expect(a[p]).toBe(base[p]);
      else if(regions[p]) {expect(a[p]).toBeGreaterThanOrEqual(base[p]);if(a[p]>base[p])hair++;}
      else {expect(a[p]).toBeLessThanOrEqual(base[p]);if(a[p]<base[p])detail++;}
    }
    expect(hair).toBeGreaterThan(0);
    expect(detail).toBeGreaterThan(0);
  });
  it('zero settings and missing maps exactly preserve Sticker',()=>{
    const {rgba,regions}=fixture(),base=finishU2(rgba,w,h,'sticker');
    expect(finishAdaptive(rgba,w,h,regions,180,0,0,0)).toEqual(base);
    expect(finishAdaptive(rgba,w,h,null)).toEqual(base);
  });
  it('never draws unsupported ink on a white face',()=>{
    const {regions}=fixture();
    const rgba=new Uint8ClampedArray(w*h*4).fill(255);
    expect(finishAdaptive(rgba,w,h,regions).every(v=>v===255)).toBe(true);
  });
});
