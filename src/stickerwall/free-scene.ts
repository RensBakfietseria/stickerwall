// Build 0.12: only geometry, never portrait data, in a saved scene.
export const CATEGORIES=[
  ['01-lichamen','Lichamen'],['02-hoofdaccessoires','Hoofdaccessoires'],
  ['03-armen-handen','Armen & handen'],['04-voorwerpen','Voorwerpen'],
  ['05-vleugels','Vleugels'],['06-staarten','Staarten'],['07-poten','Poten'],['08-fantasie','Fantasie']
] as const;
export type Piece={id:string;category:string;width:number;height:number;png:string};
export type Asset=Piece & {image:HTMLImageElement};
export type Item={id:string;assetId:string;x:number;y:number;w:number;h:number;rotation:number;flip:boolean};
export type Scene={version:1;title:string;items:Item[]};
export type Frame={x:number;y:number;w:number;h:number};
export const HEAD='portrait-head', SIZE=500;
export const LEGACY_PACK_HASH='a4cc91a77beceb9bb0918f9ee92659b245797005112ad0e16ac4aed70be346d7';
export const PACK_HASH='3f5d14b6968569b1131270874a82de03dd92e70ab315b75401e0b0aae2030d80';
const assetPattern=/^0[1-8]-[a-z0-9-]+$/;
const instancePattern=/^[a-zA-Z0-9_-]{1,80}$/;
const num=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Ongeldige compositiecoördinaten.');return v;};
export function headItem():Item{return {id:HEAD,assetId:HEAD,x:250,y:180,w:210,h:250,rotation:0,flip:false};}
export function emptyScene():Scene{return {version:1,title:'',items:[headItem()]};}
export function cleanScene(raw:unknown):Scene{
  const v=raw as Partial<Scene>;
  if(!v||v.version!==1||typeof v.title!=='string'||v.title.length>80||!Array.isArray(v.items)||v.items.length>300)throw Error('Ongeldig ontwerpbestand.');
  const ids=new Set<string>();let head=false;
  const items=v.items.map(p=>{
    if(!p||typeof p.id!=='string'||!instancePattern.test(p.id)||ids.has(p.id)||typeof p.assetId!=='string'||(p.assetId!==HEAD&&!assetPattern.test(p.assetId)))throw Error('Ongeldig onderdeel.');
    ids.add(p.id);
    if(p.assetId===HEAD){if(head||p.id!==HEAD)throw Error('Maximaal één portret.');head=true;}
    else if(p.id===HEAD)throw Error('Ongeldige instantie.');
    return {id:p.id,assetId:p.assetId,x:num(p.x,-2500,3000),y:num(p.y,-2500,3000),w:num(p.w,8,2000),h:num(p.h,8,2000),rotation:num(p.rotation,-180,180),flip:p.assetId!==HEAD&&p.flip===true};
  });
  return {version:1,title:v.title,items};
}
export function parsePack(raw:string):Piece[]{
  if(raw.length>12_000_000)throw Error('Illustratiepakket te groot.');
  const p=JSON.parse(raw);
  if((p?.version!==1&&p?.version!==2)||!Array.isArray(p.assets)||p.assets.length!==92)throw Error('Verwacht sprint 1 met 92 illustraties.');
  const counts=[12,18,19,24,6,4,5,4], seen=new Set<string>();
  const result:Piece[]=p.assets.map((a:Piece)=>{
    const i=CATEGORIES.findIndex(([c])=>c===a?.category);
    if(i<0||typeof a.id!=='string'||!assetPattern.test(a.id)||!a.id.startsWith(a.category+'-')||seen.has(a.id)||typeof a.png!=='string'||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(a.png))throw Error('Ongeldige illustratie.');
    seen.add(a.id);counts[i]--;
    return {id:a.id,category:a.category,width:num(a.width,1,1024),height:num(a.height,1,1024),png:a.png};
  });
  if(counts.some(v=>v!==0))throw Error('Onvolledige categorieën.');
  return result;
}
export function angle(n:number){return ((n+180)%360+360)%360-180;}
export function frameFor(layout:string,H:number):Frame{
  if(layout==='club')return {x:60,y:205,w:510,h:H-385};
  if(layout==='archive')return {x:57,y:105,w:516,h:H-344};
  return {x:58,y:125,w:514,h:H-350};
}
export function sceneFrame(f:Frame):Frame{
  const s=Math.min(f.w,f.h)/SIZE;
  return {x:f.x+(f.w-SIZE*s)/2,y:f.y+(f.h-SIZE*s)/2,w:SIZE*s,h:SIZE*s};
}
export function localPoint(p:{x:number;y:number},item:Item){
  const a=-item.rotation*Math.PI/180,dx=p.x-item.x,dy=p.y-item.y;
  return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};
}
export function worldPoint(p:{x:number;y:number},item:Item){
  const a=item.rotation*Math.PI/180;
  return {x:item.x+p.x*Math.cos(a)-p.y*Math.sin(a),y:item.y+p.x*Math.sin(a)+p.y*Math.cos(a)};
}
export function hit(p:{x:number;y:number},item:Item){const q=localPoint(p,item);return Math.abs(q.x)<=item.w/2&&Math.abs(q.y)<=item.h/2;}
export function bounds(items:Item[]):Item|null{
  if(!items.length)return null;
  const corners=items.flatMap(i=>[-1,1].flatMap(x=>[-1,1].map(y=>worldPoint({x:x*i.w/2,y:y*i.h/2},i))));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  return {id:'group',assetId:'group',x:(left+right)/2,y:(top+bottom)/2,w:right-left,h:bottom-top,rotation:0,flip:false};
}
export function scaleItems(items:Item[],center:{x:number;y:number},ratio:number){
  const min=Math.max(...items.map(i=>8/Math.min(i.w,i.h))),max=Math.min(...items.map(i=>2000/Math.max(i.w,i.h)));
  const s=Math.min(max,Math.max(min,ratio));
  return items.map(i=>({...i,x:center.x+(i.x-center.x)*s,y:center.y+(i.y-center.y)*s,w:i.w*s,h:i.h*s}));
}
export function drawScene(c:CanvasRenderingContext2D,scene:Scene,assets:Map<string,Asset>,portrait:CanvasImageSource|null,portraitSize:{width:number;height:number}|null,frame:Frame,placeholder=false,accent?:string){
  const f=sceneFrame(frame);
  c.save();c.beginPath();c.rect(frame.x,frame.y,frame.w,frame.h);c.clip();c.translate(f.x,f.y);c.scale(f.w/SIZE,f.h/SIZE);
  for(const i of scene.items){
    c.save();c.translate(i.x,i.y);c.rotate(i.rotation*Math.PI/180);if(i.flip)c.scale(-1,1);
    if(i.assetId===HEAD){
      if(portrait&&portraitSize){const s=Math.min(i.w/portraitSize.width,i.h/portraitSize.height),w=portraitSize.width*s,h=portraitSize.height*s;c.drawImage(portrait,-w/2,-h/2,w,h);}
      else if(placeholder){c.fillStyle='#eee2cc';c.strokeStyle='#9f8c72';c.lineWidth=1.5;c.setLineDash([5,4]);c.beginPath();c.ellipse(0,0,i.w*.46,i.h*.46,0,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);c.fillStyle='#645748';c.font='15px Arial';c.textAlign='center';c.fillText('Lokaal portret',0,4);}
    }else{
      const a=assets.get(i.assetId);
      if(a){
        if(accent&&a.category==='01-lichamen'){
          const tint=document.createElement('canvas');tint.width=a.width;tint.height=a.height;const g=tint.getContext('2d')!;
          g.drawImage(a.image,0,0);g.globalCompositeOperation='multiply';g.fillStyle=accent;g.fillRect(0,0,a.width,a.height);g.globalCompositeOperation='destination-in';g.drawImage(a.image,0,0);
          c.drawImage(tint,-i.w/2,-i.h/2,i.w,i.h);
        }else c.drawImage(a.image,-i.w/2,-i.h/2,i.w,i.h);
      }
    }
    c.restore();
  }
  c.restore();
}

/** Move a selection with a shared clamped translation, preserving relative geometry. */
export function moveItems(items:Item[],ids:ReadonlySet<string>,dx:number,dy:number):Item[]{
  const targets=items.filter(i=>ids.has(i.id));if(!targets.length)return items;
  dx=Math.min(3000-Math.max(...targets.map(i=>i.x)),Math.max(-2500-Math.min(...targets.map(i=>i.x)),dx));
  dy=Math.min(3000-Math.max(...targets.map(i=>i.y)),Math.max(-2500-Math.min(...targets.map(i=>i.y)),dy));
  return items.map(i=>ids.has(i.id)?{...i,x:i.x+dx,y:i.y+dy}:i);
}
export function copyItems(items:Item[],offset:number,uid:()=>string):Item[]{
  const copies=items.filter(i=>i.assetId!==HEAD).map(i=>({id:uid(),assetId:i.assetId,x:i.x,y:i.y,w:i.w,h:i.h,rotation:i.rotation,flip:i.flip}));
  return moveItems(copies,new Set(copies.map(i=>i.id)),offset,offset);
}
export function reorderItems(items:Item[],ids:ReadonlySet<string>,where:'front'|'back'|'up'|'down'):Item[]{
  if(where==='front'||where==='back'){
    const selected=items.filter(i=>ids.has(i.id)),others=items.filter(i=>!ids.has(i.id));
    return where==='front'?[...others,...selected]:[...selected,...others];
  }
  const next=[...items];
  if(where==='up'){for(let i=next.length-2;i>=0;i--)if(ids.has(next[i].id)&&!ids.has(next[i+1].id))[next[i],next[i+1]]=[next[i+1],next[i]];}
  else{for(let i=1;i<next.length;i++)if(ids.has(next[i].id)&&!ids.has(next[i-1].id))[next[i],next[i-1]]=[next[i-1],next[i]];}
  return next;
}
