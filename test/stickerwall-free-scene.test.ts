import {describe,it,expect} from 'vitest';
import {emptyScene,cleanScene,HEAD,headItem,hit,worldPoint,localPoint,bounds,scaleItems,sceneFrame,frameFor,parsePack,angle} from '../src/stickerwall/free-scene.ts';
describe('free atelier geometry and storage',()=>{
  it('only persists geometry and unique instances',()=>{
    const a={...headItem(),id:'a',assetId:'05-vleugels-mot',photo:'not saved'};
    const b={...a,id:'b',rotation:30};
    const s=cleanScene({...emptyScene(),items:[headItem(),a,b],photo:'not saved'});
    expect(s.items).toHaveLength(3);expect(s.items[1]).not.toHaveProperty('photo');expect(s).not.toHaveProperty('photo');
    expect(()=>cleanScene({...s,items:[a,a]})).toThrow();
    expect(()=>cleanScene({...s,items:[headItem(),{...headItem(),id:'other'}]})).toThrow();
    expect(()=>cleanScene({...s,items:[{...a,assetId:'https://example.com/image.png'}]})).toThrow();
    expect(()=>cleanScene({...s,items:[{...a,x:NaN}]})).toThrow();
    expect(s.items[0].assetId).toBe(HEAD);
  });
  it('maps rotated coordinates and scales groups proportionally',()=>{
    const a={...headItem(),rotation:90},p=worldPoint({x:20,y:10},a),q=localPoint(p,a);
    expect(q.x).toBeCloseTo(20);expect(q.y).toBeCloseTo(10);expect(hit(p,a)).toBe(true);
    const b={...a,id:'x',x:350},g=bounds([a,b])!;
    const scaled=scaleItems([a,b],g,1.5);expect(scaled[1].x-scaled[0].x).toBeCloseTo(150);expect(scaled[0].w).toBe(315);expect(angle(270)).toBe(-90);
    for(const l of ['atelier','club','archive']){const f=frameFor(l,880),r=sceneFrame(f);expect(r.w).toBe(r.h);expect(r.x).toBeGreaterThanOrEqual(f.x);}
  });
  it('rejects invalid packs',()=>{expect(()=>parsePack('{"version":1,"assets":[]}')).toThrow();});
});
