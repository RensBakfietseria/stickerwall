import {CATEGORIES,HEAD,SIZE,PACK_HASH,LEGACY_PACK_HASH,moveItems,reorderItems,copyItems,angle,bounds,cleanScene,emptyScene,frameFor,headItem,hit,parsePack,scaleItems,sceneFrame,worldPoint,type Asset,type Item,type Scene} from './free-scene.ts';
import {FORMATS,type Format,type Layout} from './collectible-art.ts';
import {download} from './collectible-print.ts';

const SAVE_KEY='stickerwall-free-designs-v1';
const CACHE='stickerwall-illustrations-012';
type Stored={id:string;scene:Scene};
type Point={x:number;y:number};
type Drag={kind:'move'|'rotate'|'scale';item:Item;start:Point;before:Scene;ids:Set<string>;pointer:number;collapse:string|null};
const uid=()=>crypto.randomUUID();
const clone=(s:Scene):Scene=>structuredClone(s);
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const label=(id:string)=>id===HEAD?'Portret':id.replace(/^0[1-8]-(lichamen|hoofdaccessoires|armen-handen|voorwerpen|vleugels|staarten|poten|fantasie)-/,'').replaceAll('-',' ');
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(CACHE,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('library');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function cacheRead():Promise<string|null>{
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const r=db.transaction('library').objectStore('library').get('sprint1');r.onsuccess=()=>resolve(typeof r.result==='string'?r.result:null);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
async function cacheWrite(raw:string){
  const db=await openDb();
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('library','readwrite');tx.objectStore('library').put(raw,'sprint1');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
async function verifiedAssets(raw:string):Promise<{assets:Map<string,Asset>;version:number}>{
  if(raw.length>12_000_000)throw Error('Illustratiepakket te groot.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==PACK_HASH&&hash!==LEGACY_PACK_HASH)throw Error("Gebruik het originele afgeleide sprint-1-pakket (geen eigen foto’s).");
  const version=JSON.parse(raw).version;
  if(version!==(hash===PACK_HASH?2:1))throw Error("Onjuiste pakketversie.");
  const pieces=parsePack(raw);
  const loaded=await Promise.all(pieces.map(async a=>{
    const image=new Image();image.src=a.png;await image.decode();
    if(image.naturalWidth!==a.width||image.naturalHeight!==a.height)throw Error('Afmetingen wijken af: '+a.id);
    return [a.id,{...a,image}] as const;
  }));
  return {assets:new Map(loaded),version};
}
function getSaved():Stored[]{
  try{
    const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'[]');
    if(!Array.isArray(raw))return [];
    return raw.slice(0,200).flatMap(v=>{try{return typeof v.id==='string'?[{id:v.id,scene:cleanScene(v.scene)}]:[];}catch{return [];}});
  }catch{return [];}
}
export type FreeState={scene:Scene;assets:Map<string,Asset>;hasPortrait:boolean};
export type FreeEditor={readonly active:boolean;readonly scene:Scene;readonly assets:Map<string,Asset>;readonly complete:boolean;refresh:()=>void};
export function mountFreeEditor(root:HTMLElement,legacy:HTMLElement,onChange:()=>void,render:()=>HTMLCanvasElement,getLayout:()=>{format:Format;layout:Layout}):FreeEditor{
  let active=true,scene=emptyScene(),assets=new Map<string,Asset>(),selected=new Set<string>([HEAD]),group=false,drag:Drag|null=null,clipboard:Item[]=[],pasteCount=0,packVersion=0;
  let undo:Scene[]=[],redo:Scene[]=[],saved=getSaved(),currentId:string|null=null,frameRequest=0,loadSerial=0;
  const mode=document.createElement('div');mode.className='free-mode studio-inline';
  mode.innerHTML='<button type="button" class="button dark" id="free-mode">Vrij atelier · 0.12.1</button><button type="button" class="button light" id="legacy-mode">Referentieatelier A/B/A+</button>';
  root.insertBefore(mode,legacy);
  const host=document.createElement('section');host.id='free-atelier';host.className='free-atelier';
  host.innerHTML='<div class="free-top"><div><h3>Fantasiebeestenatelier</h3><p class="helper">Sleep onderdelen naar de kaart. Klik, draai en schaal direct op de illustratie.</p></div><div class="free-actions"><button type="button" id="free-undo" title="Ctrl+Z">Ongedaan</button><button type="button" id="free-redo" title="Ctrl+Y">Herstel</button><button type="button" id="free-group">Hele wezen</button><button type="button" id="free-head">Hoofd toevoegen</button></div></div><div class="free-grid"><aside class="free-library"><h4>Illustraties</h4><p id="free-pack-status" role="status">Illustraties laden…</p><label class="free-file">Illustratiepakket laden<input type="file" id="free-pack" accept=".json,application/json"></label><div id="free-categories"></div></aside><div class="free-work"><canvas id="free-canvas" tabindex="0" aria-label="Grafisch compositiecanvas"></canvas><p class="helper">Ctrl+klik: meerdere selecteren · Ctrl+C/V kopiëren/plakken · Ctrl+D dupliceren · Backspace/Delete · Ctrl+Z ongedaan · Esc deselecteren</p></div><aside class="free-layers"><h4>Lagen</h4><div id="free-layer-list"></div><div class="free-actions" id="free-layer-actions"><button type="button" id="free-frontmost" title="Helemaal naar voren">Bovenaan</button><button type="button" id="free-forward" title="Eén laag naar voren">↑</button><button type="button" id="free-backward" title="Eén laag naar achteren">↓</button><button type="button" id="free-backmost" title="Helemaal naar achteren">Onderaan</button><button type="button" id="free-flip">Spiegel</button><button type="button" id="free-duplicate">Dupliceer</button><button type="button" id="free-delete">Verwijder</button></div><h4>Mijn ontwerpen</h4><label>Ontwerpnaam<input id="free-title" maxlength="80" placeholder="Naam van je fantasiebeest"></label><div class="free-actions"><button type="button" id="free-new">Nieuw</button><button type="button" id="free-save">Bewaar</button></div><select id="free-saved" aria-label="Bewaarde ontwerpen"></select><div class="free-actions"><button type="button" id="free-open">Open</button><button type="button" id="free-copy-saved">Kopie</button><button type="button" id="free-remove-saved">Wis</button></div><div class="free-actions"><button type="button" id="free-export">JSON export</button><label class="free-file">JSON import<input type="file" id="free-import" accept=".json,application/json"></label></div><p id="free-status" role="status"></p></aside></div>';
  root.insertBefore(host,legacy);
  const $=<T extends HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
  const cv=$<HTMLCanvasElement>('free-canvas'),ctx=cv.getContext('2d')!,layers=$<HTMLDivElement>('free-layer-list'),categories=$<HTMLDivElement>('free-categories');
  const title=$<HTMLInputElement>('free-title'),savedSelect=$<HTMLSelectElement>('free-saved'),status=$<HTMLParagraphElement>('free-status'),packStatus=$<HTMLParagraphElement>('free-pack-status');
  const btn=(id:string)=>$<HTMLButtonElement>(id);
  function tell(message:string){status.textContent=message;}
  function selectedItems(){return group?scene.items:scene.items.filter(i=>selected.has(i.id));}
  function selectedItem(){const items=selectedItems();return group?bounds(items):items.length===1?items[0]:null;}
  function pruneSelection(){selected=new Set(scene.items.filter(i=>selected.has(i.id)).map(i=>i.id));if(!scene.items.length)group=false;}
  function choose(id:string|null,toggle=false){group=false;if(!id){selected.clear();return;}if(toggle){if(selected.has(id))selected.delete(id);else selected.add(id);}else selected=new Set([id]);}
  function frame(){const {format,layout}=getLayout(),[w,h]=FORMATS[format];return {H:630*h/w,f:sceneFrame(frameFor(layout,630*h/w))};}
  function toScene(clientX:number,clientY:number):Point{const r=cv.getBoundingClientRect(),{H,f}=frame();return {x:((clientX-r.left)*630/r.width-f.x)*SIZE/f.w,y:((clientY-r.top)*H/r.height-f.y)*SIZE/f.h};}
  function handles(i:Item){return {corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>worldPoint({x:x*i.w/2,y:y*i.h/2},i)),rotate:worldPoint({x:0,y:-i.h/2-25},i),top:worldPoint({x:0,y:-i.h/2},i)};}
  function draw(){
    if(!active)return;
    const source=render();cv.width=source.width;cv.height=source.height;ctx.drawImage(source,0,0);
    const i=selectedItem(),items=selectedItems();if(!items.length)return;
    const {H,f}=frame();
    ctx.save();ctx.scale(cv.width/630,cv.height/H);ctx.translate(f.x,f.y);ctx.scale(f.w/SIZE,f.h/SIZE);
    ctx.strokeStyle='#087e80';ctx.fillStyle='#fff';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
    for(const part of i?[i]:items){const h=handles(part);ctx.beginPath();h.corners.forEach((p,k)=>k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();}
    ctx.setLineDash([]);if(!i){ctx.restore();return;}const h=handles(i);
    for(const p of h.corners){ctx.fillRect(p.x-5,p.y-5,10,10);ctx.strokeRect(p.x-5,p.y-5,10,10);}
    if(!group){ctx.beginPath();ctx.moveTo(h.top.x,h.top.y);ctx.lineTo(h.rotate.x,h.rotate.y);ctx.stroke();ctx.beginPath();ctx.arc(h.rotate.x,h.rotate.y,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#087e80';ctx.font='14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',h.rotate.x,h.rotate.y);}
    ctx.restore();
  }
  function schedule(){cancelAnimationFrame(frameRequest);frameRequest=requestAnimationFrame(draw);}
  function updateLayers(){
    layers.replaceChildren();
    for(const i of [...scene.items].reverse()){
      const b=document.createElement('button');b.type='button';b.className='free-layer';b.textContent=label(i.assetId);b.setAttribute('aria-pressed',String(group||selected.has(i.id)));b.dataset.instance=i.id;
      b.addEventListener('click',e=>{choose(i.id,e.ctrlKey||e.metaKey);updateLayers();schedule();cv.focus();});layers.append(b);
    }
    const items=selectedItems();
    for(const id of ['free-frontmost','free-forward','free-backward','free-backmost','free-delete','free-flip','free-duplicate'])btn(id).disabled=group||!items.length||(id==='free-flip'&&(items.length!==1||items[0].assetId===HEAD))||(id==='free-duplicate'&&!items.some(i=>i.assetId!==HEAD));
    btn('free-group').setAttribute('aria-pressed',String(group));btn('free-group').disabled=!scene.items.length;
    btn('free-head').disabled=scene.items.some(i=>i.assetId===HEAD);
    btn('free-undo').disabled=!undo.length;btn('free-redo').disabled=!redo.length;
  }
  function updateSaved(){const previous=savedSelect.value;savedSelect.replaceChildren(new Option('Kies een ontwerp',''));for(const s of saved)savedSelect.add(new Option(s.scene.title||'Naamloos',s.id));savedSelect.value=currentId??previous;}
  function changed(){updateLayers();schedule();onChange();}
  function remember(before:Scene){undo.push(before);if(undo.length>80)undo.shift();redo=[];}
  function commit(next:Scene){
    try{const clean=cleanScene(next);remember(clone(scene));scene=clean;pruneSelection();title.value=scene.title;changed();}
    catch(e){tell(e instanceof Error?e.message:String(e));}
  }
  function setMode(value:boolean){active=value;host.hidden=!value;legacy.hidden=value;btn('free-mode').className='button '+(value?'dark':'light');btn('legacy-mode').className='button '+(value?'light':'dark');btn('free-mode').setAttribute('aria-pressed',String(value));btn('legacy-mode').setAttribute('aria-pressed',String(!value));onChange();schedule();}
  btn('free-mode').onclick=()=>setMode(true);btn('legacy-mode').onclick=()=>setMode(false);
  legacy.hidden=true;btn('free-mode').setAttribute('aria-pressed','true');btn('legacy-mode').setAttribute('aria-pressed','false');
  function add(id:string,at:Point={x:250,y:300}){
    const a=assets.get(id);if(!a)return;
    const max=a.category==='01-lichamen'?230:a.category==='05-vleugels'?200:105,scale=max/Math.max(a.width,a.height);
    const i:Item={id:uid(),assetId:id,x:clamp(at.x,-2500,3000),y:clamp(at.y,-2500,3000),w:Math.max(8,a.width*scale),h:Math.max(8,a.height*scale),rotation:0,flip:false};
    choose(i.id);commit({...scene,items:[...scene.items,i]});cv.focus();
  }
  function populate(){
    categories.replaceChildren();
    for(const [category,name] of CATEGORIES){
      const section=document.createElement('details'),summary=document.createElement('summary'),grid=document.createElement('div');grid.className='free-thumbs';
      const list=[...assets.values()].filter(a=>a.category===category);summary.textContent=name+' ('+list.length+')';section.open=category==='01-lichamen';section.append(summary,grid);
      for(const a of list){
        const b=document.createElement('button'),img=document.createElement('img'),t=document.createElement('span');b.type='button';b.draggable=true;b.dataset.asset=a.id;b.title=label(a.id);img.src=a.png;img.alt='';img.draggable=false;t.textContent=label(a.id);b.append(img,t);b.onclick=()=>add(a.id);
        b.ondragstart=e=>{e.dataTransfer?.setData('application/x-stickerwall-asset',a.id);if(e.dataTransfer)e.dataTransfer.effectAllowed='copy';};grid.append(b);
      }
      categories.append(section);
    }
    packStatus.textContent=assets.size+' illustraties klaar'+(packVersion===1?' · laad het gecorrigeerde pakket 0.12.1.':' · gecorrigeerd 0.12.1');changed();
  }
  async function install(raw:string,persist:boolean,turn:number){
    const loaded=await verifiedAssets(raw);if(turn!==loadSerial)return;
    if(packVersion===2&&loaded.version===1)throw Error('Het gecorrigeerde pakket is al geladen.');
    assets=loaded.assets;packVersion=loaded.version;populate();
    if(persist){try{await cacheWrite(raw);if(turn===loadSerial)packStatus.textContent=assets.size+' illustraties lokaal bewaard'+(packVersion===1?' · update naar 0.12.1 beschikbaar.':' · gecorrigeerd 0.12.1');}catch{if(turn===loadSerial)packStatus.textContent='92 illustraties geladen voor deze sessie; opslag mislukt.';}}
  }
  const pack=$<HTMLInputElement>('free-pack');pack.onchange=async()=>{const f=pack.files?.[0],turn=++loadSerial;pack.value='';if(!f)return;try{if(f.size>12_000_000)throw Error('Pakket te groot.');await install(await f.text(),true,turn);}catch(e){if(turn===loadSerial)packStatus.textContent=String(e);}};
  const initial=++loadSerial;
  void (async()=>{try{const raw=await cacheRead();if(raw){await install(raw,false,initial);return;}}catch{}
    if(initial!==loadSerial)return;
    try{const r=await fetch('/stickerwall-illustratiepakket-0.12.json',{cache:'no-store',redirect:'error'});if(r.ok){await install(await r.text(),true,initial);return;}}catch{}
    if(initial===loadSerial)packStatus.textContent='Laad eenmalig het gecorrigeerde illustratiepakket 0.12.1 (JSON).';
  })();
  function remove(){if(!selected.size||group)return;commit({...scene,items:scene.items.filter(i=>!selected.has(i.id))});}
  function copy(){if(group)return;const items=selectedItems().filter(i=>i.assetId!==HEAD);if(!items.length)return;clipboard=items.map(i=>({...i}));pasteCount=0;tell(clipboard.length+' onderdeel/onderdelen gekopieerd (zonder portret).');}
  function insertCopies(items:Item[],offset:number){
    const copies=copyItems(items,offset,uid);if(!copies.length)return;
    if(scene.items.length+copies.length>300){tell('Te veel onderdelen.');return;}
    group=false;selected=new Set(copies.map(i=>i.id));commit({...scene,items:[...scene.items,...copies]});
  }
  function duplicate(){if(!group)insertCopies(selectedItems(),18);}
  function paste(){if(clipboard.length){pasteCount++;insertCopies(clipboard,18*pasteCount);}}
  function reorder(where:'front'|'back'|'up'|'down'){
    if(group||!selected.size)return;const items=reorderItems(scene.items,selected,where);
    if(items.some((i,n)=>i!==scene.items[n]))commit({...scene,items});
  }
  function restore(from:Scene[],to:Scene[]){const s=from.pop();if(!s)return;to.push(clone(scene));scene=s;pruneSelection();title.value=scene.title;changed();}
  btn('free-undo').onclick=()=>restore(undo,redo);btn('free-redo').onclick=()=>restore(redo,undo);
  btn('free-delete').onclick=remove;btn('free-duplicate').onclick=duplicate;btn('free-flip').onclick=()=>{const i=selectedItem();if(i&&!group&&i.assetId!==HEAD)commit({...scene,items:scene.items.map(a=>a.id===i.id?{...a,flip:!a.flip}:a)});};
  btn('free-frontmost').onclick=()=>reorder('front');btn('free-forward').onclick=()=>reorder('up');btn('free-backward').onclick=()=>reorder('down');btn('free-backmost').onclick=()=>reorder('back');
  btn('free-head').onclick=()=>{if(scene.items.some(i=>i.assetId===HEAD))return;choose(HEAD);commit({...scene,items:[...scene.items,headItem()]});};
  btn('free-group').onclick=()=>{group=!group;if(group)selected.clear();updateLayers();schedule();cv.focus();};
  cv.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('application/x-stickerwall-asset')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  cv.addEventListener('drop',e=>{e.preventDefault();const id=e.dataTransfer?.getData('application/x-stickerwall-asset');if(id)add(id,toScene(e.clientX,e.clientY));});
  cv.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;e.preventDefault();cv.focus();
    const p=toScene(e.clientX,e.clientY),old=selectedItem();let kind:Drag['kind']='move',i:Item|null=null,collapse:string|null=null;
    const toggle=e.ctrlKey||e.metaKey;
    if(!toggle&&old){const h=handles(old);if(!group&&distance(p,h.rotate)<14){kind='rotate';i=old;}else if(h.corners.some(q=>distance(p,q)<12)){kind='scale';i=old;}else if(group&&hit(p,old))i=old;}
    if(!i){
      const target=[...scene.items].reverse().find(a=>hit(p,a))??null;
      if(toggle){choose(target?.id??null,true);if(!target||!selected.has(target.id)){updateLayers();schedule();return;}i=target;}
      else if(target&&selected.has(target.id)&&selected.size>1&&!group){i=target;collapse=target.id;}
      else{choose(target?.id??null);i=target;}
    }
    if(!i){updateLayers();schedule();return;}
    drag={kind,item:{...i},start:p,before:clone(scene),ids:new Set(selectedItems().map(a=>a.id)),pointer:e.pointerId,collapse};
    cv.setPointerCapture(e.pointerId);updateLayers();schedule();
  });
  cv.addEventListener('pointermove',e=>{
    const d=drag;if(!d||e.pointerId!==d.pointer)return;
    const p=toScene(e.clientX,e.clientY),i=d.item;
    let items=d.before.items;
    const targets=items.filter(a=>d.ids.has(a.id));
    if(d.kind==='move'){
      const dx=clamp(p.x-d.start.x,-2500-Math.min(...targets.map(a=>a.x)),3000-Math.max(...targets.map(a=>a.x)));
      const dy=clamp(p.y-d.start.y,-2500-Math.min(...targets.map(a=>a.y)),3000-Math.max(...targets.map(a=>a.y)));
      items=moveItems(items,d.ids,dx,dy);
    }else if(d.kind==='rotate'){
      const a=Math.atan2(p.y-i.y,p.x-i.x),b=Math.atan2(d.start.y-i.y,d.start.x-i.x);
      items=items.map(v=>v.id===i.id?{...v,rotation:angle(i.rotation+(a-b)*180/Math.PI)}:v);
    }else{
      const scaled=scaleItems(targets,i,distance(p,i)/Math.max(1,distance(d.start,i)));
      if(scaled.some(a=>a.x< -2500||a.x>3000||a.y< -2500||a.y>3000))return;
      items=items.map(a=>scaled.find(v=>v.id===a.id)??a);
    }
    scene={...d.before,items};schedule();
  });
  function end(e:PointerEvent,cancel=false){const d=drag;if(!d||e.pointerId!==d.pointer)return;drag=null;if(cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);if(cancel)scene=d.before;else if(JSON.stringify(scene)!==JSON.stringify(d.before))remember(d.before);else if(d.collapse)choose(d.collapse);changed();}
  cv.addEventListener('pointerup',e=>end(e));cv.addEventListener('pointercancel',e=>end(e,true));cv.addEventListener('lostpointercapture',e=>end(e,true));
  host.addEventListener('keydown',e=>{
    const target=e.target as HTMLElement;if(!active||drag||target.closest('input,textarea,select,[contenteditable=true]'))return;
    if(e.key==='Escape'){choose(null);updateLayers();schedule();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(e.shiftKey?redo:undo,e.shiftKey?undo:redo);return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restore(redo,undo);return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){if(!group&&selectedItems().some(i=>i.assetId!==HEAD)){e.preventDefault();copy();}return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){if(clipboard.length){e.preventDefault();paste();}return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){if(!group&&selectedItems().some(i=>i.assetId!==HEAD)){e.preventDefault();duplicate();}return;}
    if(e.key==='Delete'||e.key==='Backspace'){if(selected.size&&!group){e.preventDefault();remove();}return;}
    if(!selectedItems().length||e.ctrlKey||e.metaKey)return;
    const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!delta[e.key])return;
    e.preventDefault();const [x,y]=delta[e.key],s=e.shiftKey?10:1,items=moveItems(scene.items,new Set(selectedItems().map(a=>a.id)),x*s,y*s);commit({...scene,items});
  });
  title.onchange=()=>{if(title.value!==scene.title)commit({...scene,title:title.value.trim()});};
  function store(next:Stored[]){try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));saved=next;updateSaved();return true;}catch{tell('Opslag mislukt. Exporteer het ontwerp als JSON.');return false;}}
  function mayDiscard(){const baseline=saved.find(s=>s.id===currentId)?.scene??emptyScene();return JSON.stringify(scene)===JSON.stringify(baseline)||confirm('Niet-bewaarde wijzigingen verwerpen?');}
  function openScene(next:Scene,id:string|null){scene=clone(next);currentId=id;choose(null);undo=[];redo=[];title.value=scene.title;updateSaved();changed();}
  btn('free-new').onclick=()=>{if(!mayDiscard())return;openScene(emptyScene(),null);tell('Nieuw ontwerp.');};
  btn('free-save').onclick=()=>{const name=title.value.trim();if(!name){tell('Geef het ontwerp eerst een naam (geen persoonsgegevens).');title.focus();return;}
    if(!scene.items.every(i=>i.assetId===HEAD||assets.has(i.assetId))){tell('Laad eerst de ontbrekende illustraties.');return;}
    const next=cleanScene({...scene,title:name}),id=currentId??uid();if(!currentId&&saved.length>=200){tell('Bibliotheek vol. Exporteer of verwijder een ontwerp.');return;}
    if(store([...saved.filter(s=>s.id!==id),{id,scene:next}])){currentId=id;scene=next;updateSaved();changed();tell('Ontwerp lokaal bewaard, zonder portret.');}
  };
  btn('free-open').onclick=()=>{const s=saved.find(s=>s.id===savedSelect.value);if(s&&mayDiscard()){openScene(s.scene,s.id);tell('Ontwerp geopend.');}};
  btn('free-copy-saved').onclick=()=>{const s=saved.find(s=>s.id===savedSelect.value);if(s&&mayDiscard()){openScene({...s.scene,title:(s.scene.title+' kopie').slice(0,80)},null);tell('Kopie geopend; bewaar onder een eigen naam.');}};
  btn('free-remove-saved').onclick=()=>{const id=savedSelect.value;if(id&&confirm('Dit bewaarde ontwerp verwijderen?')&&store(saved.filter(s=>s.id!==id))){if(currentId===id)currentId=null;updateSaved();tell('Bewaard ontwerp verwijderd.');}};
  btn('free-export').onclick=()=>{const s=cleanScene({...scene,title:title.value.trim()});download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),'stickywall-ontwerp.json');};
  const imp=$<HTMLInputElement>('free-import');imp.onchange=async()=>{const f=imp.files?.[0];imp.value='';if(!f)return;try{if(f.size>500_000)throw Error('Ontwerpbestand te groot.');const s=cleanScene(JSON.parse(await f.text()));if(assets.size&&s.items.some(i=>i.assetId!==HEAD&&!assets.has(i.assetId)))throw Error('Onbekende illustratie.');if(mayDiscard()){openScene(s,null);tell('Ontwerp geïmporteerd.');}}catch(e){tell(String(e));}};
  updateSaved();updateLayers();schedule();
  return {get active(){return active;},get scene(){return scene;},get assets(){return assets;},get complete(){return scene.items.every(i=>i.assetId===HEAD||assets.has(i.assetId));},refresh:schedule};
}
