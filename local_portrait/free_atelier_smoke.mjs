// Real browser gestures and exports. Synthetic artwork only; no personal images.
// The production SHA gate is tested separately; a scoped test-only digest substitute
// lets CI exercise asset decoding without distributing the artist's 7 MB package.
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base='http://127.0.0.1:8765',fixture=process.argv[2];
assert(fixture&&existsSync(fixture));
const chrome=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean).find(existsSync);
assert(chrome);
const out=mkdtempSync(join(tmpdir(),'sw-free-'));
const server=spawn(join(process.cwd(),'.local-portrait-venv','Scripts','python.exe'),['local_portrait/server.py'],{stdio:'inherit'});
let browser;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/api/local/status').then(r=>r.json())).protocol===9)break;}catch{}if(i===79)throw Error('server unavailable');await new Promise(r=>setTimeout(r,250));}
  browser=await puppeteer.launch({executablePath:chrome,headless:true});
  const page=await browser.newPage(),errors=[],external=[];
  await page.setViewport({width:1500,height:1100});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request',r=>{if(r.url().startsWith(base+'/')||r.url().startsWith('data:')||r.url().startsWith('blob:'))void r.continue();else{external.push(r.url());void r.abort();}});
  const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
  await page.goto(base+'/stickerwall.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#free-canvas',{visible:true});
  const raw=await page.evaluate(()=>{
    const cats=[['01-lichamen',12],['02-hoofdaccessoires',18],['03-armen-handen',19],['04-voorwerpen',24],['05-vleugels',6],['06-staarten',4],['07-poten',5],['08-fantasie',4]];
    const assets=[];for(const [category,count] of cats)for(let i=0;i<count;i++){
      const c=document.createElement('canvas');c.width=48;c.height=32;
      const ctx=c.getContext('2d');ctx.fillStyle='#252525';ctx.fillRect(2,2,44,28);ctx.clearRect(8,8,8,8);
      assets.push({id:category+'-test-'+i,category,width:48,height:32,png:c.toDataURL()});
    }return JSON.stringify({version:1,assets});
  });
  const pack=join(out,'synthetic.json');writeFileSync(pack,raw);
  await (await page.$('#free-pack')).uploadFile(pack);
  await page.waitForFunction(()=>document.querySelector('#free-pack-status').textContent.includes('originele afgeleide'));
  assert.equal(await page.$$eval('[data-asset]',e=>e.length),0,'untrusted package rejected');
  const digest=createHash('sha256').update(raw).digest('hex');
  await page.evaluateOnNewDocument((digest,expected)=>{
    const original=crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest=async(...args)=>{
      const result=await original(...args);
      const hex=Array.from(new Uint8Array(result),n=>n.toString(16).padStart(2,'0')).join('');
      return hex===digest?Uint8Array.from(expected.match(/../g),s=>parseInt(s,16)).buffer:result;
    };
  },digest,'a4cc91a77beceb9bb0918f9ee92659b245797005112ad0e16ac4aed70be346d7');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#free-pack');
  await (await page.$('#free-pack')).uploadFile(pack);
  await page.waitForFunction(()=>document.querySelectorAll('[data-asset]').length===92&&document.querySelector('#free-pack-status').textContent.includes('bewaard'));
  const layerCount=()=>page.$$eval('#free-layer-list button',e=>e.length);
  assert.equal(await layerCount(),1);
  // Drop a body into the canvas with native DragEvent and test pointer interactions.
  await page.$eval('#free-canvas',c=>c.scrollIntoView({block:'center'}));
  async function pos(x,y){
    return page.$eval('#free-canvas',(c,x,y)=>{const r=c.getBoundingClientRect();return {x:r.left+(58+x*514/500)*r.width/630,y:r.top+(133+y*514/500)*r.height/880};},x,y);
  }
  const drop=await pos(235,335);
  await page.evaluate(({x,y})=>{const d=new DataTransfer();d.setData('application/x-stickerwall-asset','01-lichamen-test-0');document.querySelector('#free-canvas').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d,clientX:x,clientY:y}));},drop);
  assert.equal(await layerCount(),2);
  async function pointer(a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}
  await pointer(await pos(235,335),await pos(270,350));
  const sizeH=230*32/48;
  await pointer(await pos(270+115,350+sizeH/2),await pos(270+115*1.2,350+sizeH/2*1.2));
  await pointer(await pos(270,350-sizeH*1.2/2-25),await pos(270+sizeH*1.2/2+25,350));
  await page.click('#free-flip');
  await page.$eval('#free-canvas',e=>e.focus());
  async function ctrl(key){await page.keyboard.down('Control');try{await page.keyboard.press(key);}finally{await page.keyboard.up('Control');}}
  await ctrl('d');assert.equal(await layerCount(),3);
  await page.keyboard.press('Backspace');assert.equal(await layerCount(),2);
  await ctrl('z');assert.equal(await layerCount(),3);
  await ctrl('y');assert.equal(await layerCount(),2);
  // Verify movement, rotation, scaling and flipping via explicit local save.
  await page.type('#free-title','Proefwezen');await page.click('#free-save');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('stickerwall-free-designs-v1')));
  assert.equal(saved.length,1);const s=saved[0].scene;
  assert.equal(s.items.length,2);
  const a=s.items.find(i=>i.assetId==='01-lichamen-test-0');
  assert(Math.abs(a.x-270)<3&&Math.abs(a.y-350)<3,'pointer move');
  assert(a.w>255&&a.w<300,'corner scale');assert(Math.abs(a.rotation-90)<5,'rotation handle');assert.equal(a.flip,true);
  assert.deepEqual(Object.keys(a).sort(),['assetId','flip','h','id','rotation','w','x','y']);
  // Browser persistence; same scene is reapplied to a real public fixture.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('[data-asset]').length===92);
  await page.select('#free-saved',saved[0].id);await page.click('#free-open');assert.equal(await layerCount(),2);
  await page.evaluate(()=>document.querySelector('#testset-settings').open=true);
  await (await page.$('#cartoon-file-kaal-bril')).uploadFile(fixture);
  await page.waitForFunction(()=>document.querySelector('#cartoon-status').textContent.startsWith('1/3 testportretten ingesteld.'));
  await page.click('#collectible-batch');await page.waitForFunction(()=>!document.querySelector('#collectible-png-front').disabled,{timeout:180000});
  await page.$eval('#free-canvas',e=>e.focus());await page.keyboard.press('Escape');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const preview=await page.$eval('#free-canvas',c=>c.toDataURL());
  await page.evaluate(()=>document.querySelector('#print-exports').open=true);
  await page.click('#collectible-png-front');
  const file=join(out,'sticky-wall-trading-front.png');
  for(let i=0;i<160&&!existsSync(file);i++)await new Promise(r=>setTimeout(r,250));
  assert(existsSync(file));
  const exported=await page.evaluate(async data=>{const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);return c.toDataURL();},'data:image/png;base64,'+readFileSync(file).toString('base64'));
  assert.equal(exported,preview,'preview and print pixels match without editor handles');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: hash rejection, 92 synthetic assets, direct gestures, keyboard, storage, reload, public portrait, pixel-identical export and no external browser requests.');
}finally{
  try{await fetch(base+'/api/local/testset/kaal-bril',{method:'DELETE'});}catch{}
  if(browser)await browser.close();server.kill();rmSync(out,{recursive:true,force:true});
}
