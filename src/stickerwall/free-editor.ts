import {CATEGORIES,HEAD,SIZE,PACK_HASH,angle,bounds,cleanScene,emptyScene,frameFor,headItem,hit,parsePack,scaleItems,sceneFrame,worldPoint,type Asset,type Item,type Scene} from './free-scene.ts';
import {FORMATS,type Format,type Layout} from './collectible-art.ts';
import {download} from './collectible-print.ts';

const SAVE_KEY='stickerwall-free-designs-v1';
const CACHE='stickerwall-illustrations-012';
type Stored={id:string;scene:Scene};
type Point={x:number;y:number};
type Drag={kind:'move'|'rotate'|'scale';item:Item;start:Point;before:Scene;group:boolean;pointer:number};
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
async function verifiedAssets(raw:string):Promise<Map<string,Asset>>{
  if(raw.length>12_000_000)throw Error('Illustratiepakket te groot.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==PACK_HASH)throw Error('Gebruik het originele afgeleide sprint-1-pakket (geen eigen foto's).');
  const pieces=parsePack(raw);
  const loaded=await Promise.all(pieces.map(async a=>{
    const image=new Image();image.src=a.png;await image.decode();
    if(image.naturalWidth!==a.width||image.naturalHeight!==a.height)throw Error('Afmetingen wijken af: '+a.id);
    return [a.id,{...a,image}] as const;
  }));
  return new Map(loaded);
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
  let active=true,scene=emptyScene(),assets=new Map<string,Asset>(),selected:string|null=HEAD,group=false,drag:Drag|null=null;
  let undo:Scene[]=[],redo:Scene[]=[],saved=getSaved(),currentId:string|null=null,frameRequest=0,loadSerial=0;
  const mode=document.createElement('div');mode.className='free-mode studio-inline';
  mode.innerHTML='<button type="button" class="button dark" id="free-mode">Vrij atelier · 0.12</button><button type="button" class="button light" id="legacy-mode">Referentieatelier A/B/A+</button>';
  root.insertBefore(mode,legacy);
  const host=document.createElement('section');host.id='free-atelier';host.className='free-atelier';
  host.innerHTML='<div class="free-top"><div><h3>Fantasiebeestenatelier</h3><p class="helper">Sleep onderdelen naar de kaart. Klik, draai en schaal direct op de illustratie.</p></div><div class="free-actions"><button type="button" id="free-undo" title="Ctrl+Z">Ongedaan</button><button type="button" id="free-redo" title="Ctrl+Y">Herstel</button><button type="button" id="free-group">Hele wezen</button><button type="button" id="free-head">Hoofd toevoegen</button></div></div><div class="free-grid"><aside class="free-library"><h4>Illustraties</h4><p id="free-pack-status" role="status">Illustraties laden…</p><label class="free-file">Illustratiepakket laden<input type="file" id="free-pack" accept=".json,application/json"></label><div id="free-categories"></div></aside><div class="free-work"><canvas id="free-canvas" tabindex="0" aria-label="Grafisch compositiecanvas"></canvas><p class="helper">Backspace/Delete · Ctrl+D dupliceren · Ctrl+Z ongedaan · pijltjes verplaatsen · Esc deselecteren</p></div><aside class="free-layers"><h4>Lagen</h4><div id="free-layer-list"></div><div class="free-actions" id="free-layer-actions"><button type="button" id="free-frontmost" title="Helemaal naar voren">Bovenaan</button><button type="button" id="free-forward" title="Eén laag naar voren">↑</button><button type="button" id="free-backward" title="Eén laag naar achteren">↓</button><button type="button" id="free-backmost" title="Helemaal naar achteren">Onderaan</button><button type="button" id="free-flip">Spiegel</button><button type="button" id="free-duplicate">Dupliceer</button><button type="button" id="free-delete">Verwijder</button></div><h4>Mijn ontwerpen</h4><label>Ontwerpnaam<input id="free-title" maxlength="80" placeholder="Naam van je fantasiebeest"></label><div class="free-actions"><button type="button" id="free-new">Nieuw</button><button type="button" id="free-save">Bewaar</button></div><select id="free-saved" aria-label="Bewaarde ontwerpen"></select><div class="free-actions"><button type="button" id="free-open">Open</button><button type="button" id="free-copy-saved">Kopie</button><button type="button" id="free-remove-saved">Wis</button></div><div class="free-actions"><button type="button" id="free-export">JSON export</button><label class="free-file">JSON import<input type="file" id="free-import" accept=".json,application/json"></label></div><p id="free-status" role="status"></p></aside></div>';
  root.insertBefore(host,legacy);
  const $=<T extends HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
  const cv=$<HTMLCanvasElement>('free-canvas'),ctx=cv.getContext('2d')!,layers=$<HTMLDivElement>('free-layer-list'),categories=$<HTMLDivElement>('free-categories');
  const title=$<HTMLInputElement>('free-title'),savedSelect=$<HTMLSelectElement>('free-saved'),status=$<HTMLParagraphElement>('free-status'),packStatus=$<HTMLParagraphElement>('free-pack-status');
  const btn=(id:string)=>$<HTMLButtonElement>(id);
  function tell(message:string){status.textContent=message;}
  function selectedItem(){return group?bounds(scene.items):scene.items.find(i=>i.id===selected)??null;}
  function frame(){const {format,layout}=getLayout(),[w,h]=FORMATS[format];return {H:630*h/w,f:sceneFrame(frameFor(layout,630*h/w))};}
  function toScene(clientX:number,clientY:number):Point{const r=cv.getBoundingClientRect(),{H,f}=frame();return {x:((clientX-r.left)*630/r.width-f.x)*SIZE/f.w,y:((clientY-r.top)*H/r.height-f.y)*SIZE/f.h};}
  function handles(i:Item){return {corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>worldPoint({x:x*i.w/2,y:y*i.h/2},i)),rotate:worldPoint({x:0,y:-i.h/2-25},i),top:worldPoint({x:0,y:-i.h/2},i)};}
  function draw(){
    if(!active)return;
    const source=render();cv.width=source.width;cv.height=source.height;ctx.drawImage(source,0,0);
    const i=selectedItem();if(!i)return;
    const {H,f}=frame(),h=handles(i);
    ctx.save();ctx.scale(cv.width/630,cv.height/H);ctx.translate(f.x,f.y);ctx.scale(f.w/SIZE,f.h/SIZE);
    ctx.strokeStyle='#087e80';ctx.fillStyle='#fff';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
    ctx.beginPath();h.corners.forEach((p,k)=>k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
    for(const p of h.corners){ctx.fillRect(p.x-5,p.y-5,10,10);ctx.strokeRect(p.x-5,p.y-5,10,10);}
    if(!group){ctx.beginPath();ctx.moveTo(h.top.x,h.top.y);ctx.lineTo(h.rotate.x,h.rotate.y);ctx.stroke();ctx.beginPath();ctx.arc(h.rotate.x,h.rotate.y,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#087e80';ctx.font='14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',h.rotate.x,h.rotate.y);}
    ctx.restore();
  }
  function schedule(){cancelAnimationFrame(frameRequest);frameRequest=requestAnimationFrame(draw);}
  function updateLayers(){
    layers.replaceChildren();
    for(const i of [...scene.items].reverse()){
      const b=document.createElement('button');b.type='button';b.className='free-layer';b.textContent=label(i.assetId);b.setAttribute('aria-pressed',String(!group&&i.id===selected));b.dataset.instance=i.id;
      b.addEventListener('click',()=>{group=false;selected=i.id;updateLayers();schedule();});layers.append(b);
    }
    const i=scene.items.find(i=>i.id===selected);
    for(const id of ['free-frontmost','free-forward','free-backward','free-backmost','free-delete','free-flip','free-duplicate'])btn(id).disabled=group||!i||((id==='free-flip'||id==='free-duplicate')&&i.assetId===HEAD);
    btn('free-group').setAttribute('aria-pressed',String(group));btn('free-group').disabled=!scene.items.length;
    btn('free-head').disabled=scene.items.some(i=>i.assetId===HEAD);
    btn('free-undo').disabled=!undo.length;btn('free-redo').disabled=!redo.length;
  }
  function updateSaved(){const previous=savedSelect.value;savedSelect.replaceChildren(new Option('Kies een ontwerp',''));for(const s of saved)savedSelect.add(new Option(s.scene.title||'Naamloos',s.id));savedSelect.value=currentId??previous;}
  function changed(){updateLayers();schedule();onChange();}
  function remember(before:Scene){undo.push(before);if(undo.length>80)undo.shift();redo=[];}
  function commit(next:Scene){
    try{const clean=cleanScene(next);remember(clone(scene));scene=clean;if(!scene.items.some(i=>i.id===selected))selected=null;title.value=scene.title;changed();}
    catch(e){tell(e instanceof Error?e.message:String(e));}
  }
  function setMode(value:boolean){active=value;host.hidden=!value;legacy.hidden=value;btn('free-mode').className='button '+(value?'dark':'light');btn('legacy-mode').className='button '+(value?'light':'dark');btn('free-mode').setAttribute('aria-pressed',String(value));btn('legacy-mode').setAttribute('aria-pressed',String(!value));onChange();schedule();}
  btn('free-mode').onclick=()=>setMode(true);btn('legacy-mode').onclick=()=>setMode(false);
  legacy.hidden=true;btn('free-mode').setAttribute('aria-pressed','true');btn('legacy-mode').setAttribute('aria-pressed','false');
  function add(id:string,at:Point={x:250,y:300}){
    const a=assets.get(id);if(!a)return;
    const max=a.category==='01-lichamen'?230:a.category==='05-vleugels'?200:105,scale=max/Math.max(a.width,a.height);
    const i:Item={id:uid(),assetId:id,x:clamp(at.x,-2500,3000),y:clamp(at.y,-2500,3000),w:Math.max(8,a.width*scale),h:Math.max(8,a.height*scale),rotation:0,flip:false};
    group=false;selected=i.id;commit({...scene,items:[...scene.items,i]});cv.focus();
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
    packStatus.textContent=assets.size+' illustraties klaar';changed();
  }
  async function install(raw:string,persist:boolean,turn:number){
    const loaded=await verifiedAssets(raw);if(turn!==loadSerial)return;
    assets=loaded;populate();
    if(persist){try{await cacheWrite(raw);if(turn===loadSerial)packStatus.textContent=assets.size+' illustraties lokaal bewaard';}catch{if(turn===loadSerial)packStatus.textContent='92 illustraties geladen voor deze sessie; opslag mislukt.';}}
  }
  const pack=$<HTMLInputElement>('free-pack');pack.onchange=async()=>{const f=pack.files?.[0],turn=++loadSerial;pack.value='';if(!f)return;try{if(f.size>12_000_000)throw Error('Pakket te groot.');await install(await f.text(),true,turn);}catch(e){if(turn===loadSerial)packStatus.textContent=String(e);}};
  const initial=++loadSerial;
  void (async()=>{try{const raw=await cacheRead();if(raw){await install(raw,false,initial);return;}}catch{}
    if(initial!==loadSerial)return;
    try{const r=await fetch('/stickerwall-illustratiepakket-0.12.json',{cache:'no-store',redirect:'error'});if(r.ok){await install(await r.text(),true,initial);return;}}catch{}
    if(initial===loadSerial)packStatus.textContent='Laad eenmalig stickerwall-illustratiepakket-0.12.json.';
  })();
  function remove(){if(!selected||group)return;commit({...scene,items:scene.items.filter(i=>i.id!==selected)});}
  function duplicate(){const i=selectedItem();if(!i||group||i.assetId===HEAD)return;const id=uid();selected=id;commit({...scene,items:[...scene.items,{...i,id,x:clamp(i.x+18,-2500,3000),y:clamp(i.y+18,-2500,3000)}]});}
  function reorder(where:'front'|'back'|'up'|'down'){
    const n=scene.items.findIndex(i=>i.id===selected);if(n<0||group)return;const items=[...scene.items],to=where==='front'?items.length-1:where==='back'?0:clamp(n+(where==='up'?1:-1),0,items.length-1);if(to===n)return;
    const [i]=items.splice(n,1);items.splice(to,0,i);commit({...scene,items});
  }
  function restore(from:Scene[],to:Scene[]){const s=from.pop();if(!s)return;to.push(clone(scene));scene=s;selected=scene.items.some(i=>i.id===selected)?selected:null;title.value=scene.title;changed();}
  btn('free-undo').onclick=()=>restore(undo,redo);btn('free-redo').onclick=()=>restore(redo,undo);
  btn('free-delete').onclick=remove;btn('free-duplicate').onclick=duplicate;btn('free-flip').onclick=()=>{const i=selectedItem();if(i&&!group&&i.assetId!==HEAD)commit({...scene,items:scene.items.map(a=>a.id===i.id?{...a,flip:!a.flip}:a)});};
  btn('free-frontmost').onclick=()=>reorder('front');btn('free-forward').onclick=()=>reorder('up');btn('free-backward').onclick=()=>reorder('down');btn('free-backmost').onclick=()=>reorder('back');
  btn('free-head').onclick=()=>{if(scene.items.some(i=>i.assetId===HEAD))return;selected=HEAD;group=false;commit({...scene,items:[...scene.items,headItem()]});};
  btn('free-group').onclick=()=>{group=!group;if(group)selected=null;updateLayers();schedule();cv.focus();};
  cv.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('application/x-stickerwall-asset')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  cv.addEventListener('drop',e=>{e.preventDefault();const id=e.dataTransfer?.getData('application/x-stickerwall-asset');if(id)add(id,toScene(e.clientX,e.clientY));});
  cv.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;e.preventDefault();cv.focus();
    const p=toScene(e.clientX,e.clientY),old=selectedItem();let kind:Drag['kind']='move',i:Item|null=null;
    if(old){const h=handles(old);if(!group&&distance(p,h.rotate)<14){kind='rotate';i=old;}else if(h.corners.some(q=>distance(p,q)<12)){kind='scale';i=old;}else if(group&&hit(p,old))i=old;}
    if(!i){group=false;i=[...scene.items].reverse().find(a=>hit(p,a))??null;selected=i?.id??null;}
    if(!i){updateLayers();schedule();return;}
    drag={kind,item:{...i},start:p,before:clone(scene),group,pointer:e.pointerId};
    cv.setPointerCapture(e.pointerId);updateLayers();schedule();
  });
  cv.addEventListener('pointermove',e=>{
    const d=drag;if(!d||e.pointerId!==d.pointer)return;
    const p=toScene(e.clientX,e.clientY),i=d.item;
    let items=d.before.items;
    const targets=d.group?items:items.filter(a=>a.id===i.id);
    if(d.kind==='move'){
      const dx=clamp(p.x-d.start.x,-2500-Math.min(...targets.map(a=>a.x)),3000-Math.max(...targets.map(a=>a.x)));
      const dy=clamp(p.y-d.start.y,-2500-Math.min(...targets.map(a=>a.y)),3000-Math.max(...targets.map(a=>a.y)));
      items=items.map(a=>d.group||a.id===i.id?{...a,x:a.x+dx,y:a.y+dy}:a);
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
  function end(e:PointerEvent,cancel=false){const d=drag;if(!d||e.pointerId!==d.pointer)return;drag=null;if(cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);if(cancel)scene=d.before;else if(JSON.stringify(scene)!==JSON.stringify(d.before))remember(d.before);changed();}
  cv.addEventListener('pointerup',e=>end(e));cv.addEventListener('pointercancel',e=>end(e,true));cv.addEventListener('lostpointercapture',e=>end(e,true));
  host.addEventListener('keydown',e=>{
    const target=e.target as HTMLElement;if(!active||drag||target.closest('input,textarea,select,[contenteditable=true]'))return;
    if(e.key==='Escape'){selected=null;group=false;updateLayers();schedule();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(e.shiftKey?redo:undo,e.shiftKey?undo:redo);return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restore(redo,undo);return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){if(selectedItem()){e.preventDefault();duplicate();}return;}
    if(e.key==='Delete'||e.key==='Backspace'){if(selected&&!group){e.preventDefault();remove();}return;}
    const i=selectedItem();if(!i||e.ctrlKey||e.metaKey)return;
    const delta:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!delta[e.key])return;
    e.preventDefault();const [x,y]=delta[e.key],s=e.shiftKey?10:1,items=scene.items.map(a=>group||a.id===selected?{...a,x:clamp(a.x+x*s,-2500,3000),y:clamp(a.y+y*s,-2500,3000)}:a);commit({...scene,items});
  });
  title.onchange=()=>{if(title.value!==scene.title)commit({...scene,title:title.value.trim()});};
  function store(next:Stored[]){try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));saved=next;updateSaved();return true;}catch{tell('Opslag mislukt. Exporteer het ontwerp als JSON.');return false;}}
  function openScene(next:Scene,id:string|null){scene=clone(next);currentId=id;selected=null;group=false;undo=[];redo=[];title.value=scene.title;updateSaved();changed();}
  btn('free-new').onclick=()=>{if(scene.items.length>1&&!confirm('Nieuw ontwerp starten? Bewaar wijzigingen eerst indien nodig.'))return;openScene(emptyScene(),null);tell('Nieuw ontwerp.');};
  btn('free-save').onclick=()=>{const name=title.value.trim();if(!name){tell('Geef het ontwerp eerst een naam (geen persoonsgegevens).');title.focus();return;}
    if(!scene.items.every(i=>i.assetId===HEAD||assets.has(i.assetId))){tell('Laad eerst de ontbrekende illustraties.');return;}
    const next=cleanScene({...scene,title:name}),id=currentId??uid();if(!currentId&&saved.length>=200){tell('Bibliotheek vol. Exporteer of verwijder een ontwerp.');return;}
    if(store([...saved.filter(s=>s.id!==id),{id,scene:next}])){currentId=id;scene=next;updateSaved();changed();tell('Ontwerp lokaal bewaard, zonder portret.');}
  };
  btn('free-open').onclick=()=>{const s=saved.find(s=>s.id===savedSelect.value);if(s){openScene(s.scene,s.id);tell('Ontwerp geopend.');}};
  btn('free-copy-saved').onclick=()=>{const s=saved.find(s=>s.id===savedSelect.value);if(s){openScene({...s.scene,title:(s.scene.title+' kopie').slice(0,80)},null);tell('Kopie geopend; bewaar onder een eigen naam.');}};
  btn('free-remove-saved').onclick=()=>{const id=savedSelect.value;if(id&&confirm('Dit bewaarde ontwerp verwijderen?')&&store(saved.filter(s=>s.id!==id))){if(currentId===id)currentId=null;updateSaved();tell('Bewaard ontwerp verwijderd.');}};
  btn('free-export').onclick=()=>{const s=cleanScene({...scene,title:title.value.trim()});download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),'stickywall-ontwerp.json');};
  const imp=$<HTMLInputElement>('free-import');imp.onchange=async()=>{const f=imp.files?.[0];imp.value='';if(!f)return;try{if(f.size>500_000)throw Error('Ontwerpbestand te groot.');const s=cleanScene(JSON.parse(await f.text()));if(assets.size&&s.items.some(i=>i.assetId!==HEAD&&!assets.has(i.assetId)))throw Error('Onbekende illustratie.');openScene(s,null);tell('Ontwerp geïmporteerd.');}catch(e){tell(String(e));}};
  updateSaved();updateLayers();schedule();
  return {get active(){return active;},get scene(){return scene;},get assets(){return assets;},get complete(){return scene.items.every(i=>i.assetId===HEAD||assets.has(i.assetId));},refresh:schedule};
}
