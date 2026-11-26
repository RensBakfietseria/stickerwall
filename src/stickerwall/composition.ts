import type {Quality} from './model.ts';
export const BODY_IDS=['A-octopus','B-octopus','A-moth','B-moth','A-frog','B-frog','A-dragon','B-dragon'] as const;
export type BodyId=typeof BODY_IDS[number];
export type BodyAsset={id:BodyId;image:HTMLImageElement;width:number;height:number;anchor:{x:number;y:number};front?:HTMLImageElement};
export type Composition={scale:number;x:number;y:number;rotation:number;background:string;tentacle:boolean};
export const DEFAULT_COMPOSITION:Composition={scale:125,x:0,y:0,rotation:0,background:'',tentacle:false};
export const BODY_LABEL:Record<BodyId,string>={'A-octopus':'Octopus · A','B-octopus':'Octopus · B','A-moth':'Nachtvlinder · A','B-moth':'Nachtvlinder · B','A-frog':'Kikker · A','B-frog':'Kikker · B','A-dragon':'Draak · A','B-dragon':'Draak · B'};
export const PALETTES=[['','Kaartstandaard'],['#d5e6db','Verbinding'],['#e1d8ee','Verbeelding'],['#f1d2bb','Warmte'],['#f6dda0','Daadkracht'],['#d8e4ef','Vertrouwen'],['#e0e7cc','Groei']] as const;
export const ART_KEY='stickerwall-composition-art-v1';
export const PREF_KEY='stickerwall-composition-prefs-v1';
const png='data:image/png;base64,';
type BodyData={png:string;anchor:{x:number;y:number};front?:string};
type Pack={version:1;bodies:Record<BodyId,BodyData>};
function finite(value:unknown,low:number,high:number,fallback:number):number{return typeof value==='number'&&Number.isFinite(value)?Math.min(high,Math.max(low,value)):fallback;}
export function normalizeComposition(value:Partial<Composition>|null|undefined):Composition{
  return {scale:finite(value?.scale,75,180,125),x:finite(value?.x,-70,70,0),y:finite(value?.y,-70,70,0),rotation:finite(value?.rotation,-20,20,0),background:PALETTES.some(p=>p[0]===value?.background)?value!.background!:'',tentacle:value?.tentacle===true};
}
function validPng(s:unknown):s is string{return typeof s==='string'&&s.startsWith(png+'iVBORw0KGgo')&&s.length<750000&&/^[A-Za-z0-9+/=]+$/.test(s.slice(png.length));}
export function parsePack(raw:string):Pack{
  if(raw.length>2500000)throw Error('Illustratiepakket te groot.');
  const p=JSON.parse(raw) as Pack;
  if(p?.version!==1||!p.bodies||Object.keys(p.bodies).length!==8)throw Error('Dit is niet het acht-dierenpakket voor 0.10.');
  for(const id of BODY_IDS){
    const d=p.bodies[id];if(!d||!validPng(d.png)||!d.anchor||!Number.isFinite(d.anchor.x)||!Number.isFinite(d.anchor.y)||d.anchor.x<0||d.anchor.x>1||d.anchor.y<0||d.anchor.y>1||(d.front!==undefined&&!validPng(d.front)))throw Error('Ongeldige illustratie: '+id);
  }
  return p;
}
function decode(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Illustratie onleesbaar'));i.src=src;});}
export async function loadPack(raw:string):Promise<Map<BodyId,BodyAsset>>{
  const p=parsePack(raw),out=new Map<BodyId,BodyAsset>();
  for(const id of BODY_IDS){
    const d=p.bodies[id],image=await decode(d.png),width=image.naturalWidth,height=image.naturalHeight;
    if(width<32||height<32||width>2048||height>2048)throw Error('Ongeldig illustratieformaat: '+id);
    const front=d.front?await decode(d.front):undefined;
    if(front&&(front.naturalWidth!==width||front.naturalHeight!==height))throw Error('Voorgrond past niet op illustratie.');
    out.set(id,{id,image,width,height,anchor:d.anchor,front});
  }
  return out;
}
export function loadPreferences(raw:string|null):Partial<Record<BodyId,Composition>>{
  try{const parsed=JSON.parse(raw||'{}');return Object.fromEntries(BODY_IDS.filter(id=>parsed?.[id]).map(id=>[id,normalizeComposition(parsed[id])]));}catch{return {};}
}
export function illustratedName(id:BodyId,qualities:readonly Quality[]):string{
  const q=qualities[0]??'Creatief';
  const names={
    octopus:['De Zorgzame Zeearm','De Creatieve Koraalkunstenaar','De Nieuwsgierige Nautilus','De Onvermoeibare Oceaangrapjas','De Dappere Dieptewerker','De Rustige Rifreiziger','De Verbindende Veelarmer','De Vindingrijke Veelarmer'],
    moth:['De Zachtmoedige Zwerver','De Creatieve Cocondromer','De Nieuwsgierige Nachtnavigator','De Humoristische Hemelfladderaar','De Dappere Dauwdanser','De Rustige Ritselreiziger','De Verbindende Vleugelvriend','De Vindingrijke Vleugelwachter'],
    frog:['De Zorgzame Zompzitter','De Creatieve Kikkerkunstenaar','De Nieuwsgierige Natuurvorscher','De Kwieke Kikkergrappenmaker','De Daadkrachtige Dijkduiker','De Rustige Rietreiziger','De Verbindende Vijvervriend','De Vindingrijke Vijvervorser'],
    dragon:['De Zorgzame Zwaardvleugel','De Dromerige Draak','De Nieuwsgierige Neveldraak','De Vrolijke Vuurdraak','De Dappere Dromendraak','De Rustige Rookreiziger','De Verbindende Vuurvriend','De Vindingrijke Vuurmeester'],
  };
  const qs=['Zorgzaam','Creatief','Nieuwsgierig','Humor','Daadkrachtig','Rustig','Verbindend','Vindingrijk'];
  return names[id.split('-')[1] as keyof typeof names][Math.max(0,qs.indexOf(q))];
}
/** Bounds of body and rotated head, in body-relative units. The final drawing
 * fits its card's illustration area without changing the chosen proportions. */
export function compositionGeometry(body:{width:number;height:number;anchor:{x:number;y:number}},portrait:{width:number;height:number;anchor:{x:number;y:number;faceHeight:number}},settings:Composition){
  const c=normalizeComposition(settings),bs=Math.min(450/body.width,280/body.height),bw=body.width*bs,bh=body.height*bs;
  const hs=Math.min(205/Math.max(.15,portrait.anchor.faceHeight)/portrait.height,340/portrait.width,365/portrait.height)*c.scale/100;
  const hw=portrait.width*hs,hh=portrait.height*hs;
  const ax=body.anchor.x*bw+c.x,ay=body.anchor.y*bh+c.y,angle=c.rotation*Math.PI/180;
  const dx=-portrait.anchor.x*hw-8*hs,dy=-portrait.anchor.y*hh-8*hs;
  const corners=[[dx,dy],[dx+hw+16*hs,dy],[dx,dy+hh+16*hs],[dx+hw+16*hs,dy+hh+16*hs]].map(([x,y])=>[ax+x*Math.cos(angle)-y*Math.sin(angle),ay+x*Math.sin(angle)+y*Math.cos(angle)]);
  const left=Math.min(0,...corners.map(p=>p[0])),right=Math.max(bw,...corners.map(p=>p[0])),top=Math.min(0,...corners.map(p=>p[1])),bottom=Math.max(bh,...corners.map(p=>p[1]));
  return {bw,bh,hs,hw,hh,ax,ay,angle,dx,dy,left,right,top,bottom};
}
