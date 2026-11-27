import {FORMATS,LAYOUTS,LAYOUT_NAMES,renderFront,renderBack,type Design,type Format,type Layout,type Portrait,type Back} from './collectible-art.ts';
import {canvasPng,download,makePdf,printSheet} from './collectible-print.ts';
import {mountFreeEditor,type FreeEditor} from './free-editor.ts';
import {makePortraitInput,type Crop} from './portrait.ts';
import type {Creature,Quality} from './model.ts';
import {BODY_IDS,BODY_LABEL,PALETTES,ART_KEY,PREF_KEY,DEFAULT_COMPOSITION,normalizeComposition,loadPreferences,loadPack,type BodyId,type BodyAsset,type Composition} from './composition.ts';

import {ACCESSORIES,PART_LABEL,PART_KEY,newPart,normalizeParts,aPlus,loadAccessories,type AccessoryId,type Asset,type Part,type Layer} from './fantasy.ts';

const SLOTS=[['kaal-bril','Testportret 1'],['lang-haar','Testportret 2'],['krullen','Testportret 3']] as const;
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
  const artInput=el<HTMLInputElement>('composition-import'),artStatus=el<HTMLParagraphElement>('composition-status'),bodyChoice=el<HTMLSelectElement>('composition-body');
  const bodyGrid=el<HTMLDivElement>('composition-designs'),scale=el<HTMLInputElement>('composition-scale'),x=el<HTMLInputElement>('composition-x'),y=el<HTMLInputElement>('composition-y'),rotation=el<HTMLInputElement>('composition-rotation');
  const background=el<HTMLSelectElement>('composition-color'),tentacle=el<HTMLInputElement>('composition-tentacle');
  const savePrefs=el<HTMLButtonElement>('composition-save'),resetPrefs=el<HTMLButtonElement>('composition-reset'),removeArt=el<HTMLButtonElement>('composition-remove');
  const compareBodies=el<HTMLDetailsElement>('compare-bodies'),compareLayouts=el<HTMLDetailsElement>('compare-layouts'),compareProfiles=el<HTMLDetailsElement>('compare-profiles');
  const partChoice=el<HTMLSelectElement>('fantasy-choice'),partActive=el<HTMLSelectElement>('fantasy-active'),partAdd=el<HTMLButtonElement>('fantasy-add'),partRemove=el<HTMLButtonElement>('fantasy-remove'),partPreset=el<HTMLButtonElement>('fantasy-preset'),partClear=el<HTMLButtonElement>('fantasy-clear'),partStatus=el<HTMLParagraphElement>('fantasy-status');
  const partScale=el<HTMLInputElement>('fantasy-scale'),partX=el<HTMLInputElement>('fantasy-x'),partY=el<HTMLInputElement>('fantasy-y'),partRotation=el<HTMLInputElement>('fantasy-rotation'),partLayer=el<HTMLSelectElement>('fantasy-layer');
  const partInputs=[partScale,partX,partY,partRotation];
  let accessories=new Map<AccessoryId,Asset>(),partDrafts:Partial<Record<BodyId,Part[]>>={},savedParts:Partial<Record<BodyId,Part[]>>={};
  let art=new Map<BodyId,BodyAsset>(),preferences:Partial<Record<BodyId,Composition>>={},drafts:Partial<Record<BodyId,Composition>>={},importSerial=0,compositionFrame=0;
  let editor:FreeEditor|undefined;
  const placeholder:Entry={key:'placeholder',label:'Zonder portret',portrait:{image:document.createElement('canvas'),width:1,height:1,anchor:{x:.5,y:.8,faceHeight:.6}}};
  let entries:Entry[]=[],logo:ImageBitmap|null=null,ready=false,busy=false,exporting=false,serial=0,logoSerial=0,controller:AbortController|null=null;
  function show(s:string){status.textContent=s;}
  function selected(){return entries.find(e=>e.key===person.value)??entries[0];}
  async function loadBundledArt(turn:number){
    const response=await checked(await local('/stickerwall-illustratiepakket-0.10.json'));
    await installArt(await response.text(),false,turn);
  }
  function selectedBody(){return art.get(bodyChoice.value as BodyId);}
  function settings(id:BodyId):Composition{return normalizeComposition(drafts[id]??preferences[id]??DEFAULT_COMPOSITION);}
  function parts(id:BodyId):Part[]{return normalizeParts(partDrafts[id]??savedParts[id]??[]);}
  function activePart(){const b=selectedBody();return b?parts(b.id).find(p=>p.id===partActive.value):undefined;}
  function updatePartControls(){
    const b=selectedBody(),list=b?parts(b.id):[],previous=partActive.value;
    partActive.replaceChildren(...list.map(p=>new Option(PART_LABEL[p.id],p.id)));
    if(list.some(p=>p.id===previous))partActive.value=previous;
    const p=activePart();
    partChoice.disabled=!b||!accessories.size;
    partAdd.disabled=!b||!accessories.size||list.length>=6||list.some(p=>p.id===partChoice.value);
    partPreset.disabled=!b||!accessories.size;
    partClear.disabled=!list.length;partRemove.disabled=!p;partActive.disabled=!list.length;
    partScale.value=String(p?.scale??100);partX.value=String(p?.x??0);partY.value=String(p?.y??0);partRotation.value=String(p?.rotation??0);partLayer.value=p?.layer??'front';
    for(const input of partInputs){input.disabled=!p;el<HTMLOutputElement>(input.id+'-value').value=input.value;}
    partLayer.disabled=!p;
  }
  function changeParts(list:Part[],active?:AccessoryId){
    const b=selectedBody();if(!b)return;
    partDrafts[b.id]=normalizeParts(list);updatePartControls();
    if(active){partActive.value=active;updatePartControls();}
    refresh();
  }
  function readPart(){
    const b=selectedBody(),p=activePart();if(!b||!p)return;
    partDrafts[b.id]=normalizeParts(parts(b.id).map(a=>a.id===p.id?{...a,scale:Number(partScale.value),x:Number(partX.value),y:Number(partY.value),rotation:Number(partRotation.value),layer:partLayer.value as Layer}:a));
    for(const input of partInputs)el<HTMLOutputElement>(input.id+'-value').value=input.value;
    cancelAnimationFrame(compositionFrame);compositionFrame=requestAnimationFrame(refresh);
  }
  function legacyDesign(entry:Entry,l=layout.value as Layout,a=accent.checked,b=selectedBody()):Design{return {format:format.value as Format,layout:l,accent:a,creature:config.getCreature(),qualities:config.getQualities(),portrait:entry.portrait,body:b,composition:b?settings(b.id):undefined,parts:b?parts(b.id):[],accessories};}
  function design(entry:Entry,l=layout.value as Layout,a=accent.checked):Design{
    const base=legacyDesign(entry,l,a);if(!editor?.active)return base;
    return {...base,body:undefined,composition:undefined,parts:undefined,accessories:undefined,free:{scene:editor.scene,assets:editor.assets,hasPortrait:entry!==placeholder}};
  }
  function updateControls(){
    const b=selectedBody(),v=b?settings(b.id):DEFAULT_COMPOSITION;
    scale.value=String(v.scale);x.value=String(v.x);y.value=String(v.y);rotation.value=String(v.rotation);background.value=v.background;tentacle.checked=v.tentacle;
    for(const input of [scale,x,y,rotation,background,savePrefs,resetPrefs])input.disabled=!b;
    tentacle.disabled=!b?.front;removeArt.disabled=!art.size;updatePartControls();
    for(const input of [scale,x,y,rotation])el<HTMLOutputElement>(input.id+'-value').value=input.value;
  }
  function readControls(){
    const b=selectedBody();if(!b)return;
    drafts[b.id]=normalizeComposition({scale:Number(scale.value),x:Number(x.value),y:Number(y.value),rotation:Number(rotation.value),background:background.value,tentacle:tentacle.checked});
    for(const input of [scale,x,y,rotation])el<HTMLOutputElement>(input.id+'-value').value=input.value;
    cancelAnimationFrame(compositionFrame);compositionFrame=requestAnimationFrame(refresh);
  }
  function selectBody(id:string){bodyChoice.value=id;updateControls();refresh();}
  function populateArt(){
    const previous=bodyChoice.value;bodyChoice.replaceChildren(new Option('Bestaand lijf (0.9)',''));
    for(const id of BODY_IDS)if(art.has(id))bodyChoice.add(new Option(BODY_LABEL[id],id));
    bodyChoice.value=art.has(previous as BodyId)?previous:art.size?'A-octopus':'';
    updateControls();refresh();
  }
  async function installArt(raw:string,persist:boolean,turn:number){
    const loaded=await loadPack(raw);if(turn!==importSerial)return;
    if(persist){try{localStorage.setItem(ART_KEY,raw);}catch{artStatus.textContent='Opslaglimiet bereikt. Pakket alleen voor deze sessie geladen.';art=loaded;populateArt();return;}}
    art=loaded;populateArt();artStatus.textContent='8 illustraties lokaal klaar. A en B zijn direct vergelijkbaar.';
  }
  function backData():Back{return {brand:brand.value,message:message.value,logo,logoWidth:logo?.width??0,logoHeight:logo?.height??0};}
  function sync(){
    batch.disabled=!ready||busy||exporting;current.disabled=!ready||busy||exporting;
    exportButtons.forEach(b=>b.disabled=!selected()||busy||exporting||!!(editor?.active&&!editor.complete));
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
    paint(back,renderBack(f,l,backData(),true));editor?.refresh();
    comparisons.replaceChildren();profiles.replaceChildren();bodyGrid.replaceChildren();
    el<HTMLElement>('collectible-empty').hidden=!!entry;
    if(!entry){front.width=315;front.height=440;front.getContext('2d')!.clearRect(0,0,315,440);sync();return;}
    if(!editor?.active)paint(front,renderFront(legacyDesign(entry)));
    if(compareLayouts.open)for(const style of LAYOUTS)for(const colored of [false,true]){
      thumbnail(comparisons,renderFront(design(entry,style,colored),true),LAYOUT_NAMES[style]+' · '+(colored?'kleuraccent':'zwart-wit lijf'),()=>{
        layout.value=style;accent.checked=colored;refresh();
      });
    }
    if(compareBodies.open)for(const id of BODY_IDS){
      const b=art.get(id);if(b)thumbnail(bodyGrid,renderFront(legacyDesign(entry,l,accent.checked,b),true),BODY_LABEL[id],()=>selectBody(id));
    }
    if(compareProfiles.open)for(const e of entries)thumbnail(profiles,renderFront(design(e),true),e.label,()=>{person.value=e.key;refresh();});
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
    if(!items.length){show('Geen testfoto’s beschikbaar. Stel de drie plekken in bij Testfoto’s beheren.');return;}
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
    const image=config.getImage();if(!image){show('Kies en kadreer eerst een foto bij Testfoto’s beheren.');return;}
    const turn=serial;
    try{const source=await toPng(makePortraitInput(image,config.getCrop()));if(turn===serial)await run([{key:'current',label:'Huidige foto',source}]);}
    catch(e){show(errorMessage(e));}
  });
  for(const id of ACCESSORIES)partChoice.add(new Option(PART_LABEL[id],id));
  for(const panel of [compareBodies,compareLayouts,compareProfiles])panel.addEventListener('toggle',refresh);
  partChoice.addEventListener('change',updatePartControls);
  partActive.addEventListener('change',updatePartControls);
  partAdd.addEventListener('click',()=>{const b=selectedBody();if(b&&ACCESSORIES.includes(partChoice.value as AccessoryId))changeParts([...parts(b.id),newPart(partChoice.value as AccessoryId)],partChoice.value as AccessoryId);});
  partRemove.addEventListener('click',()=>{const b=selectedBody();if(b)changeParts(parts(b.id).filter(p=>p.id!==partActive.value));});
  partClear.addEventListener('click',()=>changeParts([]));
  partPreset.addEventListener('click',()=>{
    const b=selectedBody();if(!b)return;
    const id=('A-'+b.id.split('-')[1]) as BodyId;
    if(art.has(id)){selectBody(id);changeParts(aPlus(id));}
  });
  for(const input of partInputs)input.addEventListener('input',readPart);
  partLayer.addEventListener('change',readPart);
  for(const [color,label] of PALETTES)background.add(new Option(label,color));
  bodyChoice.addEventListener('change',()=>{updateControls();refresh();});
  for(const input of [scale,x,y,rotation])input.addEventListener('input',readControls);
  for(const input of [background,tentacle])input.addEventListener('change',readControls);
  resetPrefs.addEventListener('click',()=>{const b=selectedBody();if(b){drafts[b.id]={...DEFAULT_COMPOSITION};updateControls();refresh();}});
  savePrefs.addEventListener('click',()=>{const b=selectedBody();if(!b)return;preferences[b.id]=settings(b.id);try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences));savedParts[b.id]=parts(b.id);localStorage.setItem(PART_KEY,JSON.stringify(savedParts));artStatus.textContent='Compositie voor '+BODY_LABEL[b.id]+' lokaal bewaard (alleen instellingen).';}catch{artStatus.textContent='Instellingen konden niet blijvend worden opgeslagen.';}});
  artInput.addEventListener('change',async()=>{const file=artInput.files?.[0],turn=++importSerial;artInput.value='';if(!file)return;try{if(file.size>2500000)throw Error('Illustratiepakket te groot.');await installArt(await file.text(),true,turn);}catch(e){if(turn===importSerial)artStatus.textContent=errorMessage(e);}});
  removeArt.addEventListener('click',()=>{const turn=++importSerial;try{localStorage.removeItem(ART_KEY);}catch{}void loadBundledArt(turn).catch(e=>{if(turn===importSerial)artStatus.textContent=errorMessage(e);});});
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
    const entry=selected();if(!entry||busy||exporting||(editor?.active&&!editor.complete))return;
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
  const legacy=root.querySelector<HTMLElement>('.studio-editor')!;
  const fields=legacy.querySelector<HTMLElement>('.studio-controls > .collectible-fields')!;
  root.insertBefore(fields,legacy);
  root.insertBefore(el<HTMLElement>('back-settings'),compareBodies);
  editor=mountFreeEditor(root,legacy,refresh,()=>renderFront(design(selected()??placeholder)),()=>({format:format.value as Format,layout:layout.value as Layout}));
  updateControls();refresh();
  const artTurn=++importSerial;
  void (async()=>{
    let raw:string|null=null;
    try{const p=JSON.parse(localStorage.getItem(PART_KEY)||'{}');savedParts=Object.fromEntries(BODY_IDS.filter(id=>p?.[id]).map(id=>[id,normalizeParts(p[id])]));}catch{}
    try{preferences=loadPreferences(localStorage.getItem(PREF_KEY));raw=localStorage.getItem(ART_KEY);}catch{}
    try{if(raw)await installArt(raw,false,artTurn);else await loadBundledArt(artTurn);}
    catch(e){if(artTurn===importSerial){try{await loadBundledArt(artTurn);}catch{artStatus.textContent=errorMessage(e);}}}
  })();
  void (async()=>{
    try{const r=await checked(await local('/stickerwall-accessoires-0.11.json'));accessories=await loadAccessories(await r.text());partStatus.textContent='9 losse illustraties klaar. Begin met A+ of voeg zelf onderdelen toe.';updatePartControls();refresh();}
    catch(e){partStatus.textContent='Accessoires niet geladen: '+errorMessage(e);}
  })();
  void (async()=>{
    try{
      const info=await (await checked(await local('/api/local/status'))).json();
      if(info.protocol!==9||!info.engines?.animegan?.ready||!info.engines?.bisenet?.ready)throw Error('Start de lokale 0.9-server met de bestaande modellen.');
      ready=true;show('Lokaal klaar. Gebruik de vaste testset of je huidige foto.');
    }catch(e){show(errorMessage(e));}finally{sync();}
  })();
  return {refresh,clear};
}
