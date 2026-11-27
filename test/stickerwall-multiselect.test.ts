import {describe,it,expect} from 'vitest';
import {HEAD,headItem,moveItems,copyItems,reorderItems,type Item} from '../src/stickerwall/free-scene.ts';
const part=(id:string,x=100):Item=>({...headItem(),id,assetId:'05-vleugels-mot',x});
describe('multiselect',()=>{
  it('moves a group without distorting its offsets, even at the boundary',()=>{
    const items=[part('a',2990),part('b',2950),headItem()];
    const moved=moveItems(items,new Set(['a','b']),50,12);
    expect(moved.map(i=>i.x)).toEqual([3000,2960,250]);expect(moved[1].y-items[1].y).toBe(12);
  });
  it('duplicates only geometry, preserves positions and never duplicates portrait',()=>{
    let n=0;const items=[part('a'),headItem(),{...part('b',160),rotation:42,flip:true}];
    const c=copyItems(items,18,()=>String(++n));
    expect(c.map(i=>i.id)).toEqual(['1','2']);expect(c.map(i=>i.x)).toEqual([118,178]);expect(c[1].rotation).toBe(42);expect(c[1].flip).toBe(true);
    expect(c.some(i=>i.assetId===HEAD)).toBe(false);expect(copyItems([headItem()],18,()=>String(++n))).toEqual([]);
  });
  it('keeps relative z-order for group reordering',()=>{
    const items=['a','b','c','d','e'].map(id=>part(id));const ids=new Set(['b','d']);
    expect(reorderItems(items,ids,'up').map(i=>i.id)).toEqual(['a','c','b','e','d']);
    expect(reorderItems(items,ids,'down').map(i=>i.id)).toEqual(['b','a','d','c','e']);
    expect(reorderItems(items,ids,'front').map(i=>i.id)).toEqual(['a','c','e','b','d']);
    expect(reorderItems(items,ids,'back').map(i=>i.id)).toEqual(['b','d','a','c','e']);
  });
});
