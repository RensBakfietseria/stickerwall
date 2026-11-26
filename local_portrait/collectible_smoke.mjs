// Real browser/model smoke, with a public upstream fixture and explicit exports.
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const base='http://127.0.0.1:8765',fixture=process.argv[2],out=process.argv[3];
assert(fixture&&existsSync(fixture)&&out);
const chrome=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean).find(existsSync);
assert(chrome);
const server=spawn(join(process.cwd(),'.local-portrait-venv','Scripts','python.exe'),['local_portrait/server.py'],{stdio:'inherit'});
let browser;
try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/api/local/status').then(r=>r.json())).protocol===9)break;}catch{}if(i===79)throw Error('server unavailable');await new Promise(r=>setTimeout(r,250));}
  browser=await puppeteer.launch({executablePath:chrome,headless:true});
  const page=await browser.newPage(),external=[],errors=[];
  const client=await page.createCDPSession();
  await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request',r=>{if(r.url().startsWith(base+'/')||r.url().startsWith('data:')||r.url().startsWith('blob:'))void r.continue();else{external.push(r.url());void r.abort();}});
  await page.goto(base+'/stickerwall.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#cartoon-current').disabled&&!document.querySelector('#collectible-current').disabled);
  const slots=['kaal-bril','lang-haar','krullen'];
  for(let i=0;i<slots.length;i++){
    const input=await page.$('#cartoon-file-'+slots[i]);await input.uploadFile(fixture);
    await page.waitForFunction(n=>document.querySelector('#cartoon-status').textContent.startsWith(n+'/3 testportretten ingesteld.'),{},i+1);
  }
  await page.click('#collectible-batch');
  await page.waitForFunction(()=>document.querySelectorAll('#collectible-profiles canvas').length===3&&!document.querySelector('#collectible-pdf').disabled,{timeout:180000});
  const six=await page.$$eval('#collectible-designs canvas',cs=>cs.map(c=>c.toDataURL()));
  assert.equal(new Set(six).size,6);
  await page.select('#collectible-layout','club');
  await page.click('#collectible-accent');
  const front=await page.$eval('#collectible-front',c=>c.toDataURL());
  assert(front.length>10000);
  const back=await page.$eval('#collectible-back',c=>c.toDataURL());
  await page.type('#collectible-brand','Testorganisatie');
  await page.type('#collectible-message','Samen maken we het verschil.');
  const logo=await page.$('#collectible-logo');await logo.uploadFile(fixture);
  await page.waitForFunction(()=>!document.querySelector('#collectible-clear-logo').disabled);
  assert.notEqual(await page.$eval('#collectible-back',c=>c.toDataURL()),back);
  async function file(button,name){
    await page.click(button);
    for(let i=0;i<160;i++){if(existsSync(join(out,name)))return;await new Promise(r=>setTimeout(r,250));}
    throw Error('export missing '+name+': '+await page.$eval('#collectible-status',e=>e.textContent));
  }
  await file('#collectible-png-front','sticky-wall-trading-front.png');
  await file('#collectible-png-back','sticky-wall-trading-back.png');
  await file('#collectible-pdf','sticky-wall-trading-voor-en-achter.pdf');
  await file('#collectible-sheet','sticky-wall-trading-A4.pdf');
  await page.select('#collectible-format','postcard');
  await file('#collectible-png-front','sticky-wall-postcard-front.png');
  await file('#collectible-pdf','sticky-wall-postcard-voor-en-achter.pdf');
  await file('#collectible-sheet','sticky-wall-postcard-A4.pdf');
  await page.click('#collectible-clear-logo');
  // Removing test portrait clears all generated card previews.
  const input=await page.$('#cartoon-file-kaal-bril');
  const handle=await input.evaluateHandle(e=>e.parentElement.querySelector('button:last-child'));
  await handle.asElement().click();
  await page.waitForFunction(()=>document.querySelector('#collectible-pdf').disabled&&document.querySelectorAll('#collectible-designs canvas').length===0);
  for(const slot of slots.slice(1))await fetch(base+'/api/local/testset/'+slot,{method:'DELETE'});
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: real AnimeGAN, all three portraits, six distinct layouts, logo/back, both formats, exports, deletion and no external browser requests.');
}finally{if(browser)await browser.close();server.kill();}
