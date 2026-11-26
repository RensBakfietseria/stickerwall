import {describe,expect,it} from 'vitest';
import {BODY_IDS,DEFAULT_COMPOSITION,normalizeComposition,compositionGeometry,parsePack,loadPreferences,illustratedName} from '../src/stickerwall/composition.ts';

describe('composition settings and geometry',()=>{
  const body={width:500,height:300,anchor:{x:.5,y:.25}};
  const portrait={width:240,height:360,anchor:{x:.5,y:.8,faceHeight:.6}};
  it('keeps eight unique art IDs and validates pack shape',()=>{
    expect(new Set(BODY_IDS).size).toBe(8);
    const png='data:image/png;base64,iVBORw0KGgoAAA=';
    const raw=JSON.stringify({version:1,bodies:Object.fromEntries(BODY_IDS.map(id=>[id,{png,anchor:{x:.5,y:.3}}]))});
    expect(Object.keys(parsePack(raw).bodies)).toHaveLength(8);
    expect(()=>parsePack(raw.replace(png,'https://example.com/image.png'))).toThrow();
    expect(()=>parsePack('{"version":1,"bodies":{}}')).toThrow();
  });
  it('clamps only settings, never persists portrait data',()=>{
    expect(normalizeComposition({scale:999,x:-100,y:20,rotation:Infinity,background:'url(https://example.com)'})).toEqual({scale:180,x:-70,y:20,rotation:0,background:'',tentacle:false});
    const p=loadPreferences(JSON.stringify({'A-frog':{scale:150,photo:'secret'},other:{scale:100}}));
    expect(p).toEqual({'A-frog':{...DEFAULT_COMPOSITION,scale:150}});
    expect(loadPreferences('bad json')).toEqual({});
  });
  it('scales and rotates around chin, keeping full composite in bounds',()=>{
    const a=compositionGeometry(body,portrait,DEFAULT_COMPOSITION);
    const b=compositionGeometry(body,portrait,{...DEFAULT_COMPOSITION,scale:160,x:20,y:-10,rotation:12});
    expect(b.hw).toBeGreaterThan(a.hw);expect(b.bw).toBe(a.bw);expect(b.ax-a.ax).toBe(20);expect(b.ay-a.ay).toBe(-10);
    expect(b.left).toBeLessThanOrEqual(0);expect(b.right).toBeGreaterThanOrEqual(b.bw);expect(b.top).toBeLessThan(0);expect(b.bottom).toBeGreaterThanOrEqual(b.bh);
    expect(b.angle).toBeCloseTo(Math.PI/15);
  });
  it('gives both styles the same animal name, but different animals their own names',()=>{
    expect(illustratedName('A-frog',['Creatief'])).toEqual(illustratedName('B-frog',['Creatief']));
    expect(illustratedName('A-frog',['Creatief'])).not.toEqual(illustratedName('A-dragon',['Creatief']));
  });
});
