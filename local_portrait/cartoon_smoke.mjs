// Public fixture only; test explicit local persistence and the actual models.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const base='http://127.0.0.1:8765';
const fixture=process.argv[2];
assert(fixture&&existsSync(fixture));
const chrome=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean).find(existsSync);
assert(chrome);
const server=spawn(join(process.cwd(),'.local-portrait-venv','Scripts','python.exe'),['local_portrait/server.py'],{stdio:'inherit'});
const slots=['kaal-bril','lang-haar','krullen'];
let browser;
try{
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/api/local/status').then(r=>r.json())).protocol===9)break;}catch{}
    if(i===79)throw Error('server not ready');
    await new Promise(r=>setTimeout(r,250));
  }
  browser=await puppeteer.launch({executablePath:chrome,headless:true});
  const page=await browser.newPage(),external=[],errors=[];
  let posts=0,saves=0;
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request',r=>{
    const url=r.url();
    if(url.startsWith(base+'/')||url.startsWith('data:')||url.startsWith('blob:')){
      if(r.method()==='POST'&&url.includes('/api/local/compare?cartoons=1'))posts++;
      if(r.method()==='POST'&&url.includes('/api/local/testset/'))saves++;
      void r.continue();
    }else{external.push(url);void r.abort();}
  });
  await page.goto(base+'/stickerwall.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#cartoon-current').disabled);
  assert(await page.$eval('#cartoon-batch',b=>b.disabled));
  for(let i=0;i<slots.length;i++){
    const slot=slots[i];
    const input=await page.$('#cartoon-file-'+slot);
    await input.uploadFile(fixture);
    await page.waitForFunction(n=>document.querySelector('#cartoon-status').textContent.startsWith(n+'/3 testportretten ingesteld.'),{},i+1);
  }
  assert.equal(saves,3);
  assert(!(await page.$eval('#cartoon-batch',b=>b.disabled)));
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#cartoon-batch').disabled);
  assert.equal(saves,3,'reload must not write portraits');
  await page.click('#cartoon-batch');
  await page.waitForFunction(()=>document.querySelectorAll('.cartoon-row').length===3,{timeout:240000});
  assert.equal(posts,3);
  const counts=await page.$$eval('.cartoon-row',rows=>rows.map(r=>({cards:r.querySelectorAll('.cartoon-card').length,buttons:r.querySelectorAll('button').length})));
  assert.deepEqual(counts,[{cards:8,buttons:5},{cards:8,buttons:5},{cards:8,buttons:5}], 'both models and both final routes must succeed for each image');
  const snapshots=await page.$$eval('.cartoon-row:first-child canvas',cs=>cs.map(c=>c.toDataURL()));
  assert(new Set(snapshots).size>=6,'cartoon stages have distinct output');
  await page.click('#cartoon-body');
  assert.equal(await page.$eval('.cartoon-row .cartoon-card:nth-child(2) canvas',c=>c.width),552);
  const before=await page.$eval('#sticker',c=>c.toDataURL());
  await page.click('.cartoon-row .cartoon-card:nth-child(4) button');
  assert.notEqual(await page.$eval('#sticker',c=>c.toDataURL()),before);
  const selected=await page.$eval('#sticker',c=>c.toDataURL());
  await page.waitForFunction(()=>!document.querySelector('#cartoon-current').disabled);
  for(const slot of slots){
    const button=await page.$('#cartoon-file-'+slot);
    const handle=await button.evaluateHandle(input=>input.parentElement.querySelector('button:last-child'));
    await handle.asElement().click();
    await page.waitForFunction(()=>!document.querySelector('#cartoon-current').disabled);
    assert.equal((await fetch(base+'/api/local/testset/'+slot)).status,404);
  }
  assert(await page.$eval('#cartoon-batch',b=>b.disabled));
  assert.notEqual(await page.$eval('#sticker',c=>c.toDataURL()),selected,'deleted test result removed from active sticker');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: three persistent private fixture slots, reload, sequential batch, both real cartoon routes, sticker preview/selection, delete, zero external requests.');
}finally{
  if(browser)await browser.close();
  server.kill();
}
