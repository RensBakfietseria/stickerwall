import {FORMATS,LAYOUTS,LAYOUT_NAMES,renderFront,renderBack,type Design,type Format,type Layout,type Portrait,type Back} from './collectible-art.ts';
import {canvasPng,download,makePdf,printSheet} from './collectible-print.ts';
import {makePortraitInput,type Crop} from './portrait.ts';
import type {Creature,Quality} from './model.ts';

const SLOTS=[['kaal-bril','Kaal + bril'],['lang-haar','Lang haar + bril'],['krullen','Krullend haar']] as const;
type Entry={key:string;label:string;portrait:Portrait};
type Config={getImage:()=>ImageBitmap|null;getCrop:()=>Crop;getCreature:()=>Creature;getQualities:()=>readonly Quality[]};
type Result={ok:boolean;png?:string;error?:string;anchor?:Portrait['anchor']};
function el<T extends HTMLElement>(id:string):T{const node=document.getElementById(id);if(!node)throw Error('Ontbrekend element '+id);return node as T;}
function paint(c:HTMLCanvasElement,source:HTMLCanvasElement){c.width=source.width;c.height=source.height;c.getContext('2d')!.drawImage(source,0,0);}
function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Afbeelding onleesbaar'));img.src=src;});}
function toPng(c:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG mislukt')),'image/png'));}
async function checked(r:Response){if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'HTTP '+r.status);}return r;}
function local(path:string,options:RequestInit={}){return fetch(path,{...options,cache:'no-store',redirect:'error'});}
function errorMessage(e:unknown){return e instanceof Error?e.message:String(e);}
export function mountCollectibles(config:Config):{refresh:()=>void;clear:()=>void}{
  const root=el<HTMLElement>('collectible-lab'),status=el<HTMLParagraphElement>('collectible-status');
  const batch=el<HTMLButtonElement>('collectible-batch'),current=el<HTMLButtonElement>('collectible-current');
  const format=el<HTMLSelectElement>('collectible-format'),layout=el<HTMLSelectElement>('collectible-layout'),accent=el<HTMLInputElement>('collectible-accent');
  const person=el<HTMLSelectElement>('collectible-person'),front=el<HTMLCanvasElement>('collectible-front'),back=el<HTMLCanvasElement>('collectible-back');
  const comparisons=el<HTMLDivElement>('collectible-designs'),profiles=el<HTMLDivElement>('collectible-profiles');
  const brand=el<HTMLInputElement>('collectible-brand'),message=el<HTMLTextAreaElement>('collectible-message'),logoInput=el<HTMLInputElement>('collectible-logo');
  const clearLogo=el<HTMLButtonElement>('collectible-clear-logo'),clearButton=el<HTMLButtonElement>('collectible-clear');
  const exportButtons=[el<HTMLButtonElement>('collectible-png-front'),el<HTMLButtonElement>('collectible-png-back'),el<HTMLButtonElement>('collectible-pdf'),el<HTMLButtonElement>('collectible-sheet')];
  let entries:Entry[]=[],logo:ImageBitmap|null=null,ready=false,busy=false,exporting=false,serial=0,logoSerial=0,controller:AbortController|null=null;
  function show(s:string){status.textContent=s;}
  function selected(){return entries.find(e=>e.key===person.value)??entries[0];}
  function design(entry:Entry,l=layout.value as Layout,a=accent.checked):Design{return {format:format.value as Format,layout:l,accent:a,creature:config.getCreature(),qualities:config.getQualities(),portrait:entry.portrait};}
  function backData():Back{return {brand:brand.value,message:message.value,logo,logoWidth:logo?.width??0,logoHeight:logo?.height??0};}
  function sync(){
    batch.disabled=!ready||busy||exporting;current.disabled=!ready||busy||exporting;
    exportButtons.forEach(b=>b.disabled=!selected()||busy||exporting);
    clearLogo.disabled=!logo;clearButton.disabled=!entries.length&&!busy;
  }
  function thumbnail(grid:HTMLElement,c:HTMLCanvasElement,label:string,action?:()=>void){
    const div=document.createElement('div');div.className='collectible-thumb';
    c.setAttribute('aria-label',label);
    const caption=document.createElement('p');caption.textContent=label;
    div.append(c,caption);
    if(action){const b=document.createElement('button');b.type='button';b.className='button light';b.textContent='Kies';b.addEventListener('click',action);div.append(b);}
    grid.append(div);
  }
  function refresh(){
    const entry=selected(),f=format.value as Format,l=layout.value as Layout;
    paint(back,renderBack(f,l,backData(),true));
    comparisons.replaceChildren();profiles.replaceChildren();
    if(!entry){front.width=315;front.height=440;front.getContext('2d')!.clearRect(0,0,315,440);sync();return;}
    paint(front,renderFront(design(entry),true));
    for(const style of LAYOUTS)for(const colored of [false,true]){
      thumbnail(comparisons,renderFront(design(entry,style,colored),true),LAYOUT_NAMES[style]+' · '+(colored?'kleuraccent':'zwart-wit lijf'),()=>{
        layout.value=style;accent.checked=colored;refresh();
      });
    }
    for(const e of entries)thumbnail(profiles,renderFront(design(e),true),e.label,()=>{person.value=e.key;refresh();});
    sync();
  }
  function updatePeople(){
    const previous=person.value;person.replaceChildren();
    for(const entry of entries){const opt=document.createElement('option');opt.value=entry.key;opt.textContent=entry.label;person.append(opt);}
    if(entries.some(e=>e.key===previous))person.value=previous;
    refresh();
  }
  function clear(){
    ++serial;controller?.abort();entries=[];updatePeople();show('Kaartresultaten uit het geheugen verwijderd. Vaste testfoto’s blijven staan.');
  }
  async function run(items:readonly {key:string;label:string;source:Blob}[]){
    if(!items.length){show('Geen testfoto’s beschikbaar. Stel de drie plekken in bij 03C.');return;}
    if(busy||!ready||exporting)return;
    clear();const turn=serial;busy=true;controller=new AbortController();sync();const failures:string[]=[];
    try{
      for(let i=0;i<items.length;i++){
        if(turn!==serial)return;
        const item=items[i];show('Maak kleurhoofd '+(i+1)+'/'+items.length+': '+item.label+'…');
        try{
          const r=await checked(await local('/api/local/compare?collectible=1',{method:'POST',headers:{'Content-Type':'image/png'},body:item.source,signal:controller.signal}));
          const data=(await r.json() as {result:Result}).result;
          if(!data.ok||!data.png||!data.anchor)throw Error(data.error||'Geen kleurhoofd.');
          const image=await loadImage('data:image/png;base64,'+data.png);
          if(turn!==serial)return;
          entries.push({key:item.key,label:item.label,portrait:{image,width:image.naturalWidth,height:image.naturalHeight,anchor:data.anchor}});
          updatePeople();
        }catch(e){if(turn!==serial)return;failures.push(item.label+': '+errorMessage(e));}
      }
      if(turn===serial)show(entries.length+' kaartportretten klaar.'+(failures.length?' Niet gelukt: '+failures.join('; '):' Kies een ontwerp en exporteer.'));
    }finally{busy=false;controller=null;sync();}
  }
  batch.addEventListener('click',async()=>{
    if(busy||exporting||!ready)return;
    // Loading the stored images is explicit; do not generate or save on page load.
    busy=true;sync();const turn=serial;const items:{key:string;label:string;source:Blob}[]=[];
    try{for(const [key,label] of SLOTS){const r=await local('/api/local/testset/'+key);if(r.status===404)continue;await checked(r);items.push({key,label,source:await r.blob()});}}
    catch(e){show(errorMessage(e));return;}finally{busy=false;sync();}
    if(turn===serial)await run(items);
  });
  current.addEventListener('click',async()=>{
    if(busy||exporting||!ready)return;
    const image=config.getImage();if(!image){show('Kies en kadreer eerst een foto in Hoofdlab.');return;}
    const turn=serial;
    try{const source=await toPng(makePortraitInput(image,config.getCrop()));if(turn===serial)await run([{key:'current',label:'Huidige foto',source}]);}
    catch(e){show(errorMessage(e));}
  });
  for(const node of [format,layout,accent,person])node.addEventListener('change',refresh);
  for(const node of [brand,message])node.addEventListener('input',refresh);
  logoInput.addEventListener('change',async()=>{
    const f=logoInput.files?.[0],turn=++logoSerial;logoInput.value='';if(!f)return;
    if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>8_000_000){show('Kies een PNG, JPG of WEBP-logo van maximaal 8 MB.');return;}
    try{
      const bitmap=await createImageBitmap(f);
      if(turn!==logoSerial){bitmap.close();return;}
      logo?.close();logo=bitmap;refresh();
    }catch(e){show(errorMessage(e));}
  });
  clearLogo.addEventListener('click',()=>{++logoSerial;logo?.close();logo=null;refresh();});
  clearButton.addEventListener('click',clear);
  // Clearing or replacing a saved portrait invalidates its generated cards.
  window.addEventListener('stickerwall-testset-change',clear);
  async function exportFile(kind:'front'|'back'|'pdf'|'sheet'){
    const entry=selected();if(!entry||busy||exporting)return;
    exporting=true;sync();const turn=serial;
    try{
      // Snapshot current selections before any asynchronous conversion.
      const d=design(entry),f=d.format,l=d.layout,b=backData(),[mmW,mmH]=FORMATS[f];
      const frontCanvas=renderFront(d),backCanvas=renderBack(f,l,b);
      const name='sticky-wall-'+f;
      let output:Blob,filename:string;
      if(kind==='front'||kind==='back'){
        output=await canvasPng(kind==='front'?frontCanvas:backCanvas);filename=name+'-'+kind+'.png';
      }else if(kind==='pdf'){
        output=await makePdf([{canvas:frontCanvas,mmW,mmH},{canvas:backCanvas,mmW,mmH}]);filename=name+'-voor-en-achter.pdf';
      }else{
        const cards=entries.map(e=>renderFront({...d,portrait:e.portrait}));
        // 6 trading cards: repeat the available profiles. Large cards use selected portrait.
        const fronts= f==='trading'?cards:[frontCanvas];
        output=await makePdf([{canvas:printSheet(fronts,f),mmW:210,mmH:297},{canvas:printSheet([backCanvas],f,true),mmW:210,mmH:297}]);
        filename=name+'-A4.pdf';
      }
      if(turn===serial){download(output,filename);show('Printbestand gemaakt: '+filename+'. Print op 100% (ware grootte).');}
    }catch(e){if(turn===serial)show('Export mislukt: '+errorMessage(e));}
    finally{exporting=false;sync();}
  }
  exportButtons.forEach((b,i)=>b.addEventListener('click',()=>void exportFile((['front','back','pdf','sheet'] as const)[i])));
  if(location.origin!=='http://127.0.0.1:8765'&&location.origin!=='http://localhost:8765'){root.hidden=true;return {refresh,clear};}
  refresh();
  void (async()=>{
    try{
      const info=await (await checked(await local('/api/local/status'))).json();
      if(info.protocol!==9||!info.engines?.animegan?.ready||!info.engines?.bisenet?.ready)throw Error('Start de lokale 0.9-server met de bestaande modellen.');
      ready=true;show('Lokaal klaar. Gebruik de vaste testset of je huidige foto.');
    }catch(e){show(errorMessage(e));}finally{sync();}
  })();
  return {refresh,clear};
}
