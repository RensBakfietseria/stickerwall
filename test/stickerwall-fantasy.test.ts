import {describe,expect,it} from 'vitest';
import {ACCESSORIES,normalizeParts,newPart,aPlus,placeParts,type Asset} from '../src/stickerwall/fantasy.ts';
describe('fantasy layers',()=>{
  it('uses nine unique original assets and two editable parts per preset',()=>{
    expect(new Set(ACCESSORIES).size).toBe(9);
    expect(aPlus('A-moth').map(p=>p.id)).toEqual(['antennae','hands']);
    expect(aPlus('A-frog').map(p=>p.id)).toEqual(['wings','horns']);
    expect(aPlus('A-octopus').map(p=>p.id)).toEqual(['crown','tentacle']);
  });
  it('restricts saved data to known identifiers, numeric bounds and layers',()=>{
    expect(normalizeParts([{...newPart('crown'),x:999,scale:Infinity,layer:'bad',photo:'secret'},newPart('crown'),{id:'bogus'}])).toEqual([{id:'crown',scale:100,x:150,y:0,rotation:0,layer:'front'}]);
    expect(normalizeParts(ACCESSORIES.map(newPart))).toHaveLength(6);
  });
  it('places head adornments with chin and rotation; respects independent movement',()=>{
    const asset={image:{} as HTMLImageElement,width:100,height:50} as Asset;
    const assets=new Map([['crown' as const,asset]]);
    const geo={bw:300,bh:200,hw:180,hh:250,ax:150,ay:70,angle:0};
    const anchor={x:.5,y:.8,faceHeight:.6};
    const [a]=placeParts([newPart('crown')],assets,geo,anchor);
    const [b]=placeParts([{...newPart('crown'),x:30,y:-20,rotation:25}],assets,geo,anchor);
    expect(b.x-a.x).toBe(30);expect(b.y-a.y).toBe(-20);
    expect(b.angle).toBeCloseTo(25*Math.PI/180);
    expect(b.left).toBeLessThan(b.x);expect(b.bottom).toBeGreaterThan(b.y);
    const [c]=placeParts([newPart('crown')],assets,{...geo,angle:.2},anchor);
    expect(c.x).not.toBe(a.x);
  });
});