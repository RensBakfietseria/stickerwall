import type { BodyId } from './composition.ts';
export const ACCESSORIES=['crown','horns','antennae','wings','hands','tentacle','flower','key','glass'] as const;
export type AccessoryId=typeof ACCESSORIES[number];
export type Layer='back'|'behind-head'|'front';
export type Part={id:AccessoryId;scale:number;x:number;y:number;rotation:number;layer:Layer};
export type Asset={image:HTMLImageElement;width:number;height:number};
export type Placed={part:Part;asset:Asset;x:number;y:number;w:number;h:number;angle:number;left:number;right:number;top:number;bottom:number};
export const PART_LABEL:Record<AccessoryId,string>={crown:'Kroontje',horns:'Hoorntjes',antennae:'Voelsprieten',wings:'Fantasievleugels',hands:'Armpjes met handjes',tentacle:'Tentakel met sleutel',flower:'Bloem',key:'Sleutel',glass:'Vergrootglas'};
export const PART_KEY='stickerwall-fantasy-prefs-v1';
const defaults:Record<AccessoryId,Layer>={crown:'front',horns:'behind-head',antennae:'behind-head',wings:'back',hands:'front',tentacle:'front',flower:'front',key:'front',glass:'front'};
export function newPart(id:AccessoryId):Part{return {id,scale:100,x:0,y:0,rotation:0,layer:defaults[id]};}
function clamp(n:unknown,min:number,max:number,fallback:number){return typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
export function normalizeParts(value:unknown):Part[]{
  if(!Array.isArray(value))return [];
  const parts:Part[]=[];
  for(const p of value){
    if(!p||!ACCESSORIES.includes(p.id)||parts.some(a=>a.id===p.id)||parts.length>=6)continue;
    const id=p.id as AccessoryId;
    parts.push({id,scale:clamp(p.scale,30,180,100),x:clamp(p.x,-150,150,0),y:clamp(p.y,-150,150,0),rotation:clamp(p.rotation,-180,180,0),layer:['back','behind-head','front'].includes(p.layer)?p.layer:defaults[id]});
  }
  return parts;
}
export function aPlus(id:BodyId):Part[]{
  const animal=id.split('-')[1];
  if(animal==='octopus')return [newPart('crown'),newPart('tentacle')];
  if(animal==='moth')return [newPart('antennae'),newPart('hands')];
  if(animal==='frog')return [newPart('wings'),newPart('horns')];
  return [newPart('horns'),newPart('flower')];
}
export async function loadAccessories(raw:string):Promise<Map<AccessoryId,Asset>>{
  if(raw.length>1500000)throw Error('Accessoirepakket te groot.');
  const pack=JSON.parse(raw);
  if(pack?.version!==1||Object.keys(pack.accessories??{}).length!==9)throw Error('Ongeldig accessoirepakket.');
  const out=new Map<AccessoryId,Asset>();
  for(const id of ACCESSORIES){
    const src=pack.accessories[id];
    if(typeof src!=='string'||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(src))throw Error('Ongeldige illustratie: '+id);
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Accessoire onleesbaar'));i.src=src;});
    if(image.naturalWidth<20||image.naturalHeight<20||image.naturalWidth>1024||image.naturalHeight>1024)throw Error('Ongeldig accessoireformaat.');
    out.set(id,{image,width:image.naturalWidth,height:image.naturalHeight});
  }
  return out;
}
/** Position in body coordinates. Head adornments track the top of the rotated
 * portrait; other parts are relative to the chin and body. */
export function placeParts(parts:Part[],assets:Map<AccessoryId,Asset>,g:{bw:number;bh:number;hw:number;hh:number;ax:number;ay:number;angle:number},anchor:{x:number;y:number;faceHeight:number}):Placed[]{
  const result:Placed[]=[];
  for(const part of normalizeParts(parts)){
    const asset=assets.get(part.id);if(!asset)continue;
    const headWidth=Math.min(g.hw,Math.max(100,g.hh*anchor.faceHeight*1.1));
    const headTop=-anchor.y*g.hh;
    const headCenter=(.5-anchor.x)*g.hw;
    let x=g.ax,y=g.ay,w=100,angle=0;
    if(['crown','horns','antennae'].includes(part.id)){
      w=headWidth*(part.id==='crown'?.68:part.id==='horns'?1.02:.98);
      const h=w*asset.height/asset.width*part.scale/100;
      const dx=headCenter,dy=headTop+(part.id==='crown'?.09*g.hh:.12*g.hh)-h*.36;
      x=g.ax+dx*Math.cos(g.angle)-dy*Math.sin(g.angle);
      y=g.ay+dx*Math.sin(g.angle)+dy*Math.cos(g.angle);
      angle=g.angle;
    }else if(part.id==='wings'){
      x=g.bw*.5;y=g.bh*.40;w=g.bw*1.25;
    }else if(part.id==='hands'){
      x=g.ax;y=g.ay+g.bh*.23;w=Math.max(headWidth*1.18,g.bw*.65);
    }else if(part.id==='tentacle'){
      x=g.bw*.82;y=g.bh*.37;w=g.bw*.37;
    }else{
      x=g.bw*.20;y=g.bh*.55;w=g.bw*.23;
    }
    w*=part.scale/100;
    const h=w*asset.height/asset.width; x+=part.x;y+=part.y;angle+=part.rotation*Math.PI/180;
    const rx=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h)/2;
    const ry=(Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h)/2;
    result.push({part,asset,x,y,w,h,angle,left:x-rx,right:x+rx,top:y-ry,bottom:y+ry});
  }
  return result;
}
