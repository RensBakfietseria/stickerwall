import { drawCardAnimal } from './artwork.ts';
import {compositionGeometry,illustratedName,DEFAULT_COMPOSITION,type BodyAsset,type Composition} from './composition.ts';
import { creatureName, type Creature, type Quality } from './model.ts';

export const FORMATS = { trading: [63,88], postcard: [100,150] } as const;
export type Format = keyof typeof FORMATS;
export const LAYOUTS = ['atelier','club','archive'] as const;
export type Layout = typeof LAYOUTS[number];
export const LAYOUT_NAMES: Record<Layout,string> = {atelier:'Atelier · klassieke prent',club:'Club · grafisch & speels',archive:'Archief · karakterstudie'};
export type Portrait = {image: CanvasImageSource; width:number; height:number; anchor:{x:number;y:number;faceHeight:number}};
export type Design = {format:Format;layout:Layout;accent:boolean;creature:Creature;qualities:readonly Quality[];portrait:Portrait;body?:BodyAsset;composition?:Composition};
export type Back = {brand:string;message:string;logo:CanvasImageSource|null;logoWidth:number;logoHeight:number};
const INK='#24231f';
const palettes={
  atelier:{paper:'#fff9ed',accent:'#3c716e',soft:'#deebe1',body:'#bdd8cf'},
  club:{paper:'#fff5da',accent:'#ad4235',soft:'#f2c15e',body:'#efb99b'},
  archive:{paper:'#f4f3e8',accent:'#4d603e',soft:'#dce3c9',body:'#c9d6ad'},
};
export function pixels(mm:number):number{return Math.round(mm*300/25.4);}
function canvas(w:number,h:number):HTMLCanvasElement{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function text(c:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color=INK,font='Arial',weight='normal',align:CanvasTextAlign='center'){
  c.fillStyle=color;c.font=weight+' '+size+'px '+font;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);
}
function fit(c:CanvasRenderingContext2D,s:string,x:number,y:number,max:number,size:number,color=INK,font='Georgia',weight='bold',align:CanvasTextAlign='center'){
  while(size>15){c.font=weight+' '+size+'px '+font;if(c.measureText(s).width<=max)break;size--;}
  text(c,s,x,y,size,color,font,weight,align);
}
function line(c:CanvasRenderingContext2D,x:number,y:number,x2:number,y2:number,color:string,width=2){
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
}
function ring(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,width=2){
  c.strokeStyle=color;c.lineWidth=width;c.strokeRect(x,y,w,h);
}
function star(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){
  c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+2,y-2,x+r,y);c.quadraticCurveTo(x+2,y+2,x,y+r);c.quadraticCurveTo(x-2,y+2,x-r,y);c.quadraticCurveTo(x-2,y-2,x,y-r);c.fillStyle=color;c.fill();
}
function wrap(c:CanvasRenderingContext2D,value:string,width:number,maxLines:number):string[]{
  const lines:string[]=[];
  for(const para of value.split('\n')){
    let row='';
    for(const word of para.split(/\s+/)){
      const candidate=row?row+' '+word:word;
      if(row&&c.measureText(candidate).width>width){lines.push(row);row=word;}else row=candidate;
      while(c.measureText(row).width>width&&row.length>1){
        let n=row.length-1;while(n>1&&c.measureText(row.slice(0,n)).width>width)n--;
        lines.push(row.slice(0,n));row=row.slice(n);
      }
    }
    lines.push(row);
  }
  if(lines.length>maxLines){lines.length=maxLines;let last=lines[maxLines-1];while(last&&c.measureText(last+'…').width>width)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
  return lines;
}
function title(c:CanvasRenderingContext2D,value:string,y:number,maxWidth:number,size:number,color=INK){
  c.font='bold '+size+'px Georgia';const rows=wrap(c,value,maxWidth,2);
  for(let i=0;i<rows.length;i++)fit(c,rows[i],315,y+(i-(rows.length-1)/2)*size*1.12,maxWidth,size,color);
}
/** Alpha-backed white die-cut rim, not a rectangular background. */
const cutoutCache=new WeakMap<object,HTMLCanvasElement>();
function cutout(p:Portrait):HTMLCanvasElement{
  const cached=cutoutCache.get(p.image);if(cached)return cached;
  const c=canvas(p.width+16,p.height+16),ctx=c.getContext('2d')!;
  const silhouette=canvas(p.width,p.height),s=silhouette.getContext('2d')!;
  s.drawImage(p.image,0,0,p.width,p.height);s.globalCompositeOperation='source-in';s.fillStyle='#fff';s.fillRect(0,0,p.width,p.height);
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8)ctx.drawImage(silhouette,8+Math.cos(angle)*6,8+Math.sin(angle)*6);
  ctx.drawImage(p.image,8,8,p.width,p.height);cutoutCache.set(p.image,c);return c;
}
function character(c:CanvasRenderingContext2D,d:Design,x:number,y:number,w:number,h:number){
  if(d.body){
    const body=d.body,settings=d.composition??DEFAULT_COMPOSITION,p=d.portrait,cut=cutout(p);
    const geo=compositionGeometry(body,p,settings),fitScale=Math.min((w-22)/(geo.right-geo.left),(h-22)/(geo.bottom-geo.top));
    c.save();
    c.translate(x+w/2-(geo.left+geo.right)*fitScale/2,y+h/2-(geo.top+geo.bottom)*fitScale/2);
    c.scale(fitScale,fitScale);
    // White paper is kept opaque; optional body tint affects the white areas only.
    if(d.accent){
      const tint=canvas(body.width,body.height),g=tint.getContext('2d')!;
      g.drawImage(body.image,0,0);g.globalCompositeOperation='multiply';g.fillStyle=palettes[d.layout].body;g.fillRect(0,0,tint.width,tint.height);g.globalCompositeOperation='destination-in';g.drawImage(body.image,0,0);
      c.drawImage(tint,0,0,geo.bw,geo.bh);
    }else c.drawImage(body.image,0,0,geo.bw,geo.bh);
    c.save();c.translate(geo.ax,geo.ay);c.rotate(geo.angle);c.drawImage(cut,geo.dx,geo.dy,cut.width*geo.hs,cut.height*geo.hs);c.restore();
    if(settings.tentacle&&body.front)c.drawImage(body.front,0,0,geo.bw,geo.bh);
    c.restore();return;
  }
  const scale=Math.min(w/465,h/545);
  c.save();
  c.translate(x+w/2-276*scale,y+h/2-375*scale);
  c.scale(scale,scale);
  drawCardAnimal(c,d.creature,d.accent?palettes[d.layout].body:null);
  const p=d.portrait,cut=cutout(p);
  // Anchor the chin near the shoulder, preserving aspect ratio and long hair.
  const fh=Math.max(.15,p.anchor.faceHeight);
  const headScale=Math.min(175/(fh*p.height),300/p.width,305/p.height);
  const dw=p.width*headScale,dh=p.height*headScale;
  c.drawImage(cut,276-p.anchor.x*dw-8*headScale,373-p.anchor.y*dh-8*headScale,cut.width*headScale,cut.height*headScale);
  c.restore();
}
function base(format:Format,preview:boolean){
  const [mmW,mmH]=FORMATS[format],w=preview?315:pixels(mmW),h=preview?Math.round(w*mmH/mmW):pixels(mmH);
  const c=canvas(w,h),ctx=c.getContext('2d')!;
  const H=630*mmH/mmW;ctx.scale(w/630,h/H);return {c,ctx,H};
}
function qualities(c:CanvasRenderingContext2D,q:readonly Quality[],y:number,accent:string){
  const values=q.length?q:['Kies kwaliteiten'];const gap=9,w=(540-gap*(values.length-1))/values.length;
  values.forEach((v,i)=>{const x=45+i*(w+gap);c.fillStyle='#fffdf7';c.fillRect(x,y,w,42);ring(c,x,y,w,42,accent,1.4);fit(c,v,x+w/2,y+27,w-12,21,INK,'Arial','bold');});
}
export function renderFront(d:Design,preview=false):HTMLCanvasElement{
  const {c,ctx:g,H}=base(d.format,preview),p=palettes[d.layout],name=d.body?illustratedName(d.body.id,d.qualities):creatureName(d.creature,d.qualities);
  const background=d.body&&d.composition?.background?d.composition.background:p.soft;
  g.fillStyle=p.paper;g.fillRect(0,0,630,H);
  if(d.layout==='atelier'){
    ring(g,24,24,582,H-48,p.accent,3);ring(g,36,36,558,H-72,p.accent,1);
    text(g,'S T I C K Y   W A L L',315,77,24,p.accent,'Arial','bold');
    text(g,'EEN BIJZONDER BEEST',315,112,17,p.accent,'Arial');
    star(g,70,100,14,p.accent);star(g,560,100,14,p.accent);
    g.fillStyle=background;g.beginPath();g.ellipse(315,373,233,251,0,0,Math.PI*2);g.fill();
    character(g,d,58,125,514,H-350);
    line(g,60,H-228,570,H-228,p.accent);
    title(g,name,H-162,514,36);
    qualities(g,d.qualities,H-102,p.accent);
  }else if(d.layout==='club'){
    g.fillStyle=p.accent;g.fillRect(25,25,580,164);
    text(g,'STICKY WALL / COLLECTIBLES',315,65,21,'#fff9e8','Arial','bold');
    title(g,name,124,515,33,'#fff9e8');
    g.fillStyle=background;g.fillRect(25,200,580,H-367);
    // graphic stripes and sparks are deliberately separate from the collage.
    for(let i=0;i<5;i++){line(g,41,227+i*15,117,227+i*15,p.accent,3);}
    star(g,542,263,25,p.accent);star(g,87,H-228,19,p.accent);
    character(g,d,60,205,510,H-385);
    text(g,'JOUW BIJZONDERE KRACHTEN',315,H-120,19,p.accent,'Arial','bold');
    qualities(g,d.qualities,H-96,p.accent);
  }else{
    ring(g,24,24,582,H-48,p.accent,2);
    text(g,'S T I C K Y   W A L L',49,70,21,p.accent,'Arial','bold','left');
    text(g,'KARAKTERARCHIEF',581,70,16,p.accent,'Arial','normal','right');
    line(g,49,89,581,89,p.accent);
    g.fillStyle=background;g.beginPath();g.arc(315,350,230,0,Math.PI*2);g.fill();
    g.setLineDash([4,8]);g.strokeStyle=p.accent;g.lineWidth=2;g.beginPath();g.arc(315,350,247,0,Math.PI*2);g.stroke();g.setLineDash([]);
    character(g,d,57,105,516,H-344);
    line(g,49,H-231,581,H-231,p.accent);
    text(g,'PORTRET VAN EEN KWALITEITENBEEST',315,H-206,15,p.accent,'Arial','bold');
    title(g,name,H-155,530,34);
    qualities(g,d.qualities,H-100,p.accent);
  }
  return c;
}
export function renderBack(format:Format,layout:Layout,b:Back,preview=false):HTMLCanvasElement{
  const {c,ctx:g,H}=base(format,preview),p=palettes[layout];
  g.fillStyle=p.paper;g.fillRect(0,0,630,H);
  ring(g,24,24,582,H-48,p.accent,3);ring(g,39,39,552,H-78,p.accent,1);
  text(g,'S T I C K Y   W A L L',315,100,26,p.accent,'Arial','bold');
  star(g,315,159,18,p.accent);
  g.fillStyle=p.soft;g.beginPath();g.arc(315,H*.39,155,0,Math.PI*2);g.fill();
  if(b.logo&&b.logoWidth>0&&b.logoHeight>0){
    const sc=Math.min(260/b.logoWidth,180/b.logoHeight);
    g.drawImage(b.logo,315-b.logoWidth*sc/2,H*.39-b.logoHeight*sc/2,b.logoWidth*sc,b.logoHeight*sc);
  }else{
    text(g,'EEN BIJZONDER',315,H*.39-8,25,p.accent,'Georgia','bold');
    text(g,'BEEST',315,H*.39+36,44,p.accent,'Georgia','bold');
  }
  title(g,b.brand||'Een kaart om te bewaren',H*.64,510,32);
  g.font='24px Arial';
  wrap(g,b.message||'Iedereen heeft iets bijzonders. Welke kwaliteit zie jij in een ander?',500,5).forEach((row,i)=>text(g,row,315,H*.70+i*30,24,INK));
  star(g,315,H-76,15,p.accent);
  return c;
}
