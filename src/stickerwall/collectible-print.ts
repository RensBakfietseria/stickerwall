import {FORMATS,pixels,type Format} from './collectible-art.ts';

const encoder=new TextEncoder();
const bytes=(s:string)=>encoder.encode(s);
const mmpt=(mm:number)=>Number((mm*72/25.4).toFixed(5));
function crc32(data:Uint8Array):number{
  let c=0xffffffff;
  for(const x of data){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
  return (c^0xffffffff)>>>0;
}
function join(parts:Uint8Array[]):Uint8Array<ArrayBuffer>{
  const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let off=0;
  for(const p of parts){result.set(p,off);off+=p.length;}return result;
}
export function png300(input:Uint8Array):Uint8Array<ArrayBuffer>{
  const view=new DataView(input.buffer,input.byteOffset,input.byteLength);
  if(input.length<33||view.getUint32(0)!==0x89504e47)throw Error('Ongeldige PNG.');
  const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);
  v.setUint32(0,9);chunk.set(bytes('pHYs'),4);v.setUint32(8,11811);v.setUint32(12,11811);chunk[16]=1;v.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts=[input.subarray(0,8)];let off=8;
  while(off+12<=input.length){
    const n=view.getUint32(off),end=off+n+12;
    if(end>input.length)throw Error('Onvolledige PNG.');
    const type=String.fromCharCode(...input.subarray(off+4,off+8));
    if(type!=='pHYs')parts.push(input.subarray(off,end));
    if(type==='IHDR')parts.push(chunk);
    off=end;
  }
  if(off!==input.length)throw Error('Ongeldige PNG-chunk.');
  return join(parts);
}
export async function canvasPng(c:HTMLCanvasElement):Promise<Blob>{
  const png=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG mislukt')),'image/png'));
  return new Blob([png300(new Uint8Array(await png.arrayBuffer()))],{type:'image/png'});
}
export type Page={canvas:HTMLCanvasElement;mmW:number;mmH:number};
/** Local raster PDF: lossless Flate RGB, exact physical media box, no dependencies. */
export async function makePdf(pages:Page[]):Promise<Blob>{
  if(!pages.length)throw Error('Geen pagina.');
  const parts:Uint8Array[]=[];let length=0;
  const offsets=[0];
  const push=(p:Uint8Array)=>{parts.push(p);length+=p.length;};
  const obj=(n:number,body:Uint8Array[])=>{offsets[n]=length;push(bytes(n+' 0 obj\n'));body.forEach(push);push(bytes('\nendobj\n'));};
  push(bytes('%PDF-1.4\n%'));push(new Uint8Array([0xe2,0xe3,0xcf,0xd3,10]));
  obj(1,[bytes('<< /Type /Catalog /Pages 2 0 R >>')]);
  obj(2,[bytes('<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+3*i)+' 0 R').join(' ')+'] >>')]);
  for(let i=0;i<pages.length;i++){
    const p=pages[i],n=3+3*i,w=mmpt(p.mmW),h=mmpt(p.mmH);
    const rgba=p.canvas.getContext('2d')!.getImageData(0,0,p.canvas.width,p.canvas.height).data;
    const rgb=new Uint8Array(p.canvas.width*p.canvas.height*3);
    for(let j=0,k=0;j<rgba.length;j+=4,k+=3){const a=rgba[j+3]/255;for(let c=0;c<3;c++)rgb[k+c]=Math.round(rgba[j+c]*a+255*(1-a));}
    const compressed=new Uint8Array(await new Response(new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    obj(n,[bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im '+(n+1)+' 0 R >> >> /Contents '+(n+2)+' 0 R >>')]);
    obj(n+1,[bytes('<< /Type /XObject /Subtype /Image /Width '+p.canvas.width+' /Height '+p.canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length '+compressed.length+' >>\nstream\n'),compressed,bytes('\nendstream')]);
    const cmd=bytes('q '+w+' 0 0 '+h+' 0 0 cm /Im Do Q\n');
    obj(n+2,[bytes('<< /Length '+cmd.length+' >>\nstream\n'),cmd,bytes('endstream')]);
  }
  const xref=length;
  push(bytes('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'));
  return new Blob([join(parts)],{type:'application/pdf'});
}
export function sheetPlan(format:Format){
  const [w,h]=FORMATS[format],cols=format==='trading'?2:1,rows=format==='trading'?3:1,gap=5;
  const x=(210-(cols*w+(cols-1)*gap))/2,y=(297-(rows*h+(rows-1)*gap))/2;
  return Array.from({length:cols*rows},(_,i)=>({x:x+(i%cols)*(w+gap),y:y+Math.floor(i/cols)*(h+gap),w,h}));
}
export function printSheet(cards:readonly HTMLCanvasElement[],format:Format,back=false):HTMLCanvasElement{
  if(!cards.length)throw Error('Geen kaarten.');
  const c=document.createElement('canvas');c.width=pixels(210);c.height=pixels(297);
  const g=c.getContext('2d')!;g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.scale(c.width/210,c.height/297);
  for(const [i,p] of sheetPlan(format).entries()){
    const x=back?210-p.x-p.w:p.x,y=p.y,w=p.w,h=p.h;
    g.drawImage(cards[i%cards.length],x,y,w,h);
    g.strokeStyle='#222';g.lineWidth=.15;g.beginPath();
    for(const [cx,cy,sx,sy] of [[x,y,-1,-1],[x+w,y,1,-1],[x,y+h,-1,1],[x+w,y+h,1,1]]){
      g.moveTo(cx+sx*.7,cy);g.lineTo(cx+sx*2.2,cy);
      g.moveTo(cx,cy+sy*.7);g.lineTo(cx,cy+sy*2.2);
    }
    g.stroke();
  }
  return c;
}
export function download(data:Blob,name:string):void{
  const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
