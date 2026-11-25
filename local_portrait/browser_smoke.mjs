// Real browser/API test with a synthetic canvas; never use private portraits.
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
      if (status.protocol === 4) break;
    } catch {}
    if (i === 79) throw Error('local server startup failed');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage();
  let posts = 0;
  const external = [];
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(base + '/') || url.startsWith('data:') || url.startsWith('blob:')) {
      if (request.method() === 'POST' && url.endsWith('/api/local/compare')) posts++;
      void request.continue();
    } else {
      external.push(url);
      void request.abort();
    }
  });
  await page.goto(base + '/stickerwall.html', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.querySelector('#local-compare-run').disabled);
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 576;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e5ddd1'; ctx.fillRect(0,0,512,576);
    ctx.fillStyle = '#f2e4d8';
    ctx.strokeStyle = '#222'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.ellipse(256,250,142,201,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(183,200,30,18); ctx.fillRect(299,200,30,18);
    ctx.beginPath(); ctx.arc(256,330,55,0,Math.PI); ctx.stroke();
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'synthetic.png', {type: 'image/png'}));
    const input = document.querySelector('#portrait-file');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => !document.querySelector('#portrait-controls').hidden);
  await page.click('#local-compare-run');
  await page.waitForFunction(() => ['opensketch','contour','anime'].every(s => !document.getElementById('local-select-'+s).disabled), {timeout: 120000});
  const styles = await page.evaluate(() => ['opensketch','contour','anime'].map(s => document.getElementById('local-preview-'+s).toDataURL()));
  assert.equal(new Set(styles).size, 3, 'three distinct model outputs');
  await page.click('#local-mode-ink');
  await page.click('#local-oval-mask'); // disable mask
  const binary = await page.evaluate(() => ['opensketch','contour','anime'].every(s => {
    const c = document.getElementById('local-preview-'+s);
    const data = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return c.width === 226 && c.height === 252 && data.every((v,i) => i%4===3 ? v===255 : v===0 || v===255);
  }));
  assert(binary, 'preview is 226x252 pure black/white');
  await page.click('#local-select-contour');
  const stickerBefore = await page.$eval('#sticker', el => el.toDataURL());
  await page.$eval('#local-ink-thickness', el => { el.value = '2'; el.dispatchEvent(new Event('input')); });
  const stickerAfter = await page.$eval('#sticker', el => el.toDataURL());
  assert.notEqual(stickerBefore, stickerAfter, 'ink finishing updates selected sticker');
  assert.equal(posts, 1, 'ink finishing does not rerun inference');
  await page.click('#remove-photo');
  assert(await page.$eval('#portrait-controls', el => el.hidden));
  assert(await page.$eval('#local-select-contour', el => el.disabled));
  assert.equal(await page.$eval('#local-original', c => c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(x=>x!==0)), false);
  assert.deepEqual(external, [], 'no outbound browser requests');
  assert.deepEqual(pageErrors, [], 'no browser runtime errors');
  console.log('PASS: three local model previews, black/white finishing, selection, clear photo, no outbound requests.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
