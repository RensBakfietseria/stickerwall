// Real browser/API test on public upstream fixture; never use private portraits.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const base = 'http://127.0.0.1:8765';
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = candidates.find(existsSync);
assert(chrome, 'Chrome not installed on test runner');
const python = join(process.cwd(), '.local-portrait-venv', 'Scripts', 'python.exe');
const server = spawn(python, ['local_portrait/server.py'], { stdio: 'inherit' });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      const status = await fetch(base + '/api/local/status').then(r => r.json());
      if (status.protocol === 9) break;
    } catch {}
    if (i === 79) throw Error('local server startup failed');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage();
  let posts = 0;
  const compareUrls = [];
  const external = [];
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(base + '/') || url.startsWith('data:') || url.startsWith('blob:')) {
      if (request.method() === 'POST' && url.includes('/api/local/compare')) { posts++; compareUrls.push(url); }
      void request.continue();
    } else {
      external.push(url);
      void request.abort();
    }
  });
  await page.goto(base + '/stickerwall.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
  await page.waitForFunction(() => !document.querySelector('#local-compare-run').disabled);
  const fixture = process.argv[2];
  assert(fixture && existsSync(fixture), 'public fixture missing');
  const upload = await page.$('#portrait-file');
  await upload.uploadFile(fixture);
  await page.waitForFunction(() => !document.querySelector('#portrait-controls').hidden);
  await page.$eval('#portrait-zoom', el => { el.value = '100'; el.dispatchEvent(new Event('input')); });
  await page.click('#local-compare-run');
  await page.waitForFunction(() => ['u2net','u2bold','u2sticker','u2adaptive'].every(s => !document.getElementById('local-select-'+s).disabled), {timeout: 120000});
  assert(await page.$eval('#local-select-u2sticker', el => el.getAttribute('aria-pressed') === 'true'));
  const variants = await page.evaluate(() => ['u2net','u2bold','u2sticker','u2adaptive'].map(s => document.getElementById('local-preview-'+s).toDataURL()));
  assert(new Set(variants.slice(0,3)).size===3, 'three original preset outputs preserved');
  const binary = await page.evaluate(() => ['u2net','u2bold','u2sticker','u2adaptive'].every(s => {
    const c = document.getElementById('local-preview-'+s);
    const data = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return c.width === 226 && c.height === 252 && data.every(v => v===0 || v===255);
  }));
  assert(binary, 'three 226x252 binary print layers');
  const masksMatch = await page.evaluate(() => {
    const alpha = id => {
      const c = document.getElementById('local-preview-'+id);
      return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data).filter((_,i)=>i%4===3);
    };
    const a=alpha('u2net'), b=alpha('u2bold'), c=alpha('u2sticker'), d=alpha('u2adaptive');
    return a.includes(0) && a.includes(255) && a.every((v,i)=>v===b[i] && v===c[i] && v===d[i]);
  });
  assert(masksMatch, 'head alpha identical across all presets');
  await page.$eval('#local-hair-relief', el => { el.value = '0'; el.dispatchEvent(new Event('input')); });
  await page.$eval('#local-face-detail', el => { el.value = '0'; el.dispatchEvent(new Event('input')); });
  assert.equal(await page.$eval('#local-preview-u2adaptive',c=>c.toDataURL()),await page.$eval('#local-preview-u2sticker',c=>c.toDataURL()));
  await page.click('#local-reset-finish');
  await page.click('#local-select-u2adaptive');
  assert(await page.$eval('#local-select-u2adaptive',el=>el.getAttribute('aria-pressed')==='true'));
  // Basis and Bold are in a collapsed reference panel; open before clicking.
  await page.$eval('#local-select-u2bold', el => el.closest('details').open=true);
  const stickerBefore = await page.$eval('#sticker', el => el.toDataURL());
  await page.click('#local-select-u2bold');
  assert.notEqual(stickerBefore, await page.$eval('#sticker', el => el.toDataURL()));
  await page.$eval('#local-ink-thickness', el => { el.value = '2'; el.dispatchEvent(new Event('input')); });
  assert.equal(posts, 1, 'preset selection and finishing do not rerun inference');
  assert.equal(compareUrls[0], base+'/api/local/compare');
  await page.click('#local-reset-finish');
  assert.deepEqual(await page.evaluate(() => ['u2net','u2bold','u2sticker','u2adaptive'].map(s => document.getElementById('local-preview-'+s).toDataURL())),variants);
  await page.click('#local-mode-raw');
  assert.equal(await page.$eval('#local-preview-u2net',el=>el.width),512);
  assert.equal(await page.$eval('#local-preview-u2bold',el=>el.width),226);
  assert.equal(await page.$eval('#local-preview-u2adaptive',el=>el.width),226);
  await page.click('#local-mode-ink');
  await page.click('#local-include-references');
  await page.click('#local-compare-run');
  await page.waitForFunction(() => ['contour','contourplus','opensketch','anime','u2sticker'].every(s => !document.getElementById('local-select-'+s).disabled), {timeout: 120000});
  assert.equal(posts,2);
  assert.equal(compareUrls[1],base+'/api/local/compare?references=1');
  await page.click('#local-select-contourplus');
  await page.click('#remove-photo');
  assert(await page.$eval('#portrait-controls', el => el.hidden));
  assert(await page.$eval('#local-select-contour', el => el.disabled));
  assert.equal(await page.$eval('#local-original', c => c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(x=>x!==0)), false);
  assert(await page.$eval('#local-select-u2adaptive',el=>el.disabled));
  assert.equal(await page.$eval('#local-regions',c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(x=>x!==0)),false);
  assert.deepEqual(external, [], 'no outbound browser requests');
  assert.deepEqual(pageErrors, [], 'no browser runtime errors');
  console.log('PASS: four U2 presets, adaptive controls, shared alpha, default focus, optional references, reset, local sticker selection, no outbound requests.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
