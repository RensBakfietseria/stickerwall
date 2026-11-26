import { drawSticker } from './artwork.ts';
import { type Creature, type Quality } from './model.ts';
import { makePortraitInput, type Crop } from './portrait.ts';
import { finishAdaptive } from './u2-adaptive.ts';
import { finishU2 } from './u2-finish.ts';
import { thresholdInk } from './ink.ts';

const SLOTS = [['kaal-bril','Kaal + bril'],['lang-haar','Lang haar + bril'],['krullen','Krullend haar']] as const;
type Slot = typeof SLOTS[number][0];
type ModelResult = {ok: boolean; png?: string; error?: string; elapsed_ms?: number};
type Results = Record<string,ModelResult | undefined>;
type Config = {getImage:()=>ImageBitmap|null; getCrop:()=>Crop; getCreature:()=>Creature; getQualities:()=>readonly Quality[]; onSelect:(head:HTMLCanvasElement)=>void};
type Preview = {canvas:HTMLCanvasElement; head:HTMLCanvasElement};
function el<T extends HTMLElement>(id:string):T {
  const value=document.getElementById(id);
  if(!value) throw Error('Cartoonlab: '+id);
  return value as T;
}
function canvas(w:number,h:number):HTMLCanvasElement{
  const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}
function blob(c:HTMLCanvasElement):Promise<Blob>{
  return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG mislukt')),'image/png'));
}
function decode(src:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Afbeelding onleesbaar'));img.src=src;});
}
function fromResult(r:ModelResult):Promise<HTMLImageElement>{return decode('data:image/png;base64,'+r.png);}
function frame(img:CanvasImageSource,w:number,h:number,smooth=true):HTMLCanvasElement{
  const c=canvas(w,h),ctx=c.getContext('2d')!;
  ctx.imageSmoothingEnabled=smooth;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);return c;
}
function copy(dest:HTMLCanvasElement,src:HTMLCanvasElement){
  dest.width=src.width;dest.height=src.height;dest.getContext('2d')!.drawImage(src,0,0);
}
function makeHead(img:HTMLImageElement,kind:'adaptive'|'u2'|'direct',regions:Uint8ClampedArray|null):HTMLCanvasElement{
  const c=frame(img,226,252),ctx=c.getContext('2d')!,data=ctx.getImageData(0,0,c.width,c.height);
  const rgba=data.data;
  const output=kind==='adaptive'?finishAdaptive(rgba,226,252,regions):
    kind==='u2'?finishU2(rgba,226,252,'sticker'):thresholdInk(rgba,226,252,145,0);
  for(let i=3;i<output.length;i+=4){
    output[i]=rgba[i]>=128?255:0;
    if(!output[i])output.fill(255,i-3,i);
  }
  rgba.set(output);ctx.putImageData(data,0,0);return c;
}
function message(error:unknown):string{return error instanceof Error?error.message:String(error);}
async function checked(response:Response):Promise<Response>{
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'HTTP '+response.status);}
  return response;
}
const localFetch=(path:string,init:RequestInit={})=>fetch(path,{...init,cache:'no-store',redirect:'error'});

export function mountCartoonLab(config:Config):{clearResults:()=>void}{
  const root=el<HTMLElement>('cartoon-lab'),status=el<HTMLParagraphElement>('cartoon-status');
  const batch=el<HTMLButtonElement>('cartoon-batch'),current=el<HTMLButtonElement>('cartoon-current');
  const bodyToggle=el<HTMLInputElement>('cartoon-body');
  const resultRoot=el<HTMLDivElement>('cartoon-results');
  const slotRoot=el<HTMLDivElement>('cartoon-slots');
  const slots=new Map<Slot,Blob>();
  const previews:Preview[]=[];
  const controls:HTMLButtonElement[]=[];
  let ready=false,busy=false,serial=0,controller:AbortController|null=null;
  function show(s:string){status.textContent=s;}
  function sync(){
    batch.disabled=!ready||busy||slots.size!==3;
    current.disabled=!ready||busy;
    controls.forEach(b=>b.disabled=!ready||busy);
  }
  function clearResults(){
    ++serial;controller?.abort();controller=null;
    previews.length=0;resultRoot.replaceChildren();
    // Keep busy until an outstanding request has actually settled.
    sync();
  }
  function showBodies(){
    for(const p of previews)copy(p.canvas,bodyToggle.checked?drawSticker(config.getCreature(),config.getQualities(),p.head):p.head);
  }
  bodyToggle.addEventListener('change',showBodies);
  function card(grid:HTMLElement,title:string):{card:HTMLDivElement;desc:HTMLParagraphElement;c:HTMLCanvasElement}{
    const div=document.createElement('div');div.className='local-candidate cartoon-card';
    const strong=document.createElement('strong');strong.textContent=title;
    const c=canvas(226,252);c.setAttribute('aria-label',title);
    const desc=document.createElement('p');div.append(strong,c,desc);grid.append(div);
    return {card:div,desc,c};
  }
  async function renderResult(title:string,source:Blob,results:Results,turn:number){
    const row=document.createElement('section');row.className='cartoon-row';
    const heading=document.createElement('h4');heading.textContent=title;
    const grid=document.createElement('div');grid.className='cartoon-grid';row.append(heading,grid);
    const sourceBitmap=await createImageBitmap(source);
    if(turn!==serial){sourceBitmap.close();return;}
    const orig=card(grid,'Vaste invoer');copy(orig.c,frame(sourceBitmap,226,252));sourceBitmap.close();
    orig.desc.textContent='Onbewerkte uitsnede';
    let regions:Uint8ClampedArray|null=null;
    if(results.regions?.ok&&results.regions.png){
      const img=await fromResult(results.regions);
      if(turn!==serial)return;
      regions=frame(img,226,252,false).getContext('2d')!.getImageData(0,0,226,252).data;
    }
    const variants=[
      ['u2net','U² Adaptief · 0.7','adaptive'],
      ['photo2cartoon','Photo2Cartoon · kleur','color'],
      ['photo2cartoon_u2','Photo2Cartoon → U²','u2'],
      ['photo2cartoon_direct','Photo2Cartoon → zwart-wit','direct'],
      ['animegan','AnimeGANv2 · kleur','color'],
      ['animegan_u2','AnimeGANv2 → U²','u2'],
      ['animegan_direct','AnimeGANv2 → zwart-wit','direct'],
    ] as const;
    for(const [key,label,kind] of variants){
      if(turn!==serial)return;
      const item=card(grid,label),r=results[key];
      if(!r?.ok||!r.png){
        item.desc.textContent=r?.error||results[key.split('_')[0]]?.error||'Geen resultaat';
        continue;
      }
      try{
        const img=await fromResult(r);if(turn!==serial)return;
        if(kind==='color'){copy(item.c,frame(img,226,252));item.desc.textContent=(r.elapsed_ms??'?')+' ms · cartoon tussenstap';continue;}
        const head=makeHead(img,kind,regions);
        const b=document.createElement('button');b.type='button';b.className='button light';b.textContent='Gebruik op sticker';
        b.addEventListener('click',()=>config.onSelect(head));item.card.append(b);
        previews.push({canvas:item.c,head});
        copy(item.c,bodyToggle.checked?drawSticker(config.getCreature(),config.getQualities(),head):head);
        item.desc.textContent=kind==='direct'?'Vaste zwart-witdrempel 145':kind==='adaptive'?'Standaard 180 / 0 / 1 / 1':'U² Sticker-afwerking 180 / 0';
      }catch(error){item.desc.textContent=message(error);}
    }
    if(turn===serial)resultRoot.append(row);
  }
  async function run(items:readonly {label:string;source:Blob}[]){
    if(busy||!ready||!items.length)return;
    clearResults();const turn=serial;busy=true;controller=new AbortController();sync();
    try{
      for(let i=0;i<items.length;i++){
        if(turn!==serial)return;
        const item=items[i];show('Verwerk '+(i+1)+'/'+items.length+': '+item.label+'…');
        const res=await checked(await localFetch('/api/local/compare?cartoons=1',{method:'POST',headers:{'Content-Type':'image/png'},body:item.source,signal:controller.signal}));
        const data=await res.json() as {results:Results};
        if(turn!==serial)return;
        await renderResult(item.label,item.source,data.results,turn);
      }
      if(turn===serial)show('Vergelijking klaar. Beoordeel eerst de cartoon, daarna de sticker. Resultaten blijven alleen in geheugen.');
    }catch(error){if(turn===serial)show('Vergelijking onderbroken: '+message(error));}
    finally{busy=false;controller=null;sync();}
  }
  const slotCards=new Map<Slot,{c:HTMLCanvasElement;label:HTMLParagraphElement}>();
  async function refresh(slot:Slot){
    const entry=slotCards.get(slot)!;
    const response=await localFetch('/api/local/testset/'+slot);
    if(response.status===404){slots.delete(slot);entry.c.getContext('2d')!.clearRect(0,0,entry.c.width,entry.c.height);entry.label.textContent='Nog niet ingesteld';return;}
    await checked(response);const data=await response.blob();const img=await createImageBitmap(data);
    slots.set(slot,data);copy(entry.c,frame(img,226,252));img.close();
    entry.label.textContent='Lokaal bewaard · vaste uitsnede';
  }
  async function save(slot:Slot,source:Blob){
    await checked(await localFetch('/api/local/testset/'+slot,{method:'POST',headers:{'Content-Type':'image/png'},body:source}));
    await refresh(slot);sync();
  }
  async function mutate(fn:()=>Promise<void>){
    if(busy||!ready)return;busy=true;sync();
    try{await fn();show(slots.size+'/3 testportretten ingesteld.');}
    catch(error){show('Testset: '+message(error));}
    finally{busy=false;sync();}
  }
  for(const [slot,label] of SLOTS){
    const item=card(slotRoot,label);
    slotCards.set(slot,{c:item.c,label:item.desc});
    const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.className='visually-hidden';file.id='cartoon-file-'+slot;
    const choose=document.createElement('button');choose.type='button';choose.className='button light';choose.textContent='Kies testfoto';choose.addEventListener('click',()=>file.click());
    file.addEventListener('change',()=>{
      const f=file.files?.[0];file.value='';if(!f)return;
      void mutate(async()=>{
        if(f.size>15_000_000||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('Kies JPG, PNG of WEBP (max. 15 MB).');
        const img=await createImageBitmap(f);
        try{
          if(img.width<100||img.height<100)throw Error('Foto te klein.');
          await save(slot,await blob(makePortraitInput(img,{zoom:1,panX:0,panY:0,thickness:0})));
        }finally{img.close();}
      });
    });
    const saveCrop=document.createElement('button');saveCrop.type='button';saveCrop.className='button light';saveCrop.textContent='Bewaar huidige uitsnede';
    saveCrop.addEventListener('click',()=>void mutate(async()=>{
      const img=config.getImage();if(!img)throw Error('Kies en kadreer eerst een foto in Hoofdlab.');
      await save(slot,await blob(makePortraitInput(img,config.getCrop())));
    }));
    const remove=document.createElement('button');remove.type='button';remove.className='button light';remove.textContent='Wis testfoto';
    remove.addEventListener('click',()=>void mutate(async()=>{
      await checked(await localFetch('/api/local/testset/'+slot,{method:'DELETE'}));await refresh(slot);clearResults();
    }));
    controls.push(choose,saveCrop,remove);item.card.append(file,choose,saveCrop,remove);
  }
  current.addEventListener('click',async()=>{
    if(busy||!ready)return;
    const img=config.getImage();if(!img){show('Kies eerst een foto in Hoofdlab.');return;}
    try{await run([{label:'Huidige foto (niet bewaard)',source:await blob(makePortraitInput(img,config.getCrop()))}]);}catch(error){show(message(error));}
  });
  batch.addEventListener('click',()=>void run(SLOTS.flatMap(([slot,label])=>{const source=slots.get(slot);return source?[{label,source}]:[];})));
  sync();
  if(location.origin!=='http://127.0.0.1:8765'&&location.origin!=='http://localhost:8765'){
    root.hidden=true;return {clearResults};
  }
  void (async()=>{
    try{
      const info=await (await checked(await localFetch('/api/local/status'))).json();
      if(info.protocol!==8)throw Error('Start eerst de 0.8-server.');
      for(const [slot] of SLOTS)await refresh(slot);
      ready=true;show(slots.size+'/3 testportretten ingesteld · kies een foto of vergelijk de vaste set.');
    }catch(error){show(message(error));}
    finally{sync();}
  })();
  return {clearResults};
}
