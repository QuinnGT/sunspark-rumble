import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const dir = 'tests/artifacts/coastal-materials'; await mkdir(dir, { recursive: true });
await build({ entryPoints: ['tests/coastal-materials-fixture.js'], bundle: true, minify: true, format: 'iife', outfile: `${dir}/fixture.bundle.js` });
await writeFile(`${dir}/fixture.html`, '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Sunspark coastal material library</title><style>html,body{margin:0;background:#e5e0d2;width:1440px;height:960px;overflow:hidden}canvas{display:block}.label{position:absolute;width:25%;font:600 15px system-ui;letter-spacing:.12em;color:#263d47;text-align:center;pointer-events:none}</style></head><body><canvas></canvas><script src="fixture.bundle.js"></script></body></html>');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); }); page.on('request', request => requests.push(request.url()));
try {
  await page.goto(`http://127.0.0.1:4173/${dir}/fixture.html`); await page.waitForFunction(() => window.coastalFixture?.ready || window.coastalFixture?.error);
  const result = await page.evaluate(() => ({ ...window.coastalFixture, shutdown: undefined })); assert.equal(result.error, undefined);
  assert.equal(result.materials, 12); assert.ok(result.programs > 0); assert.equal(result.textures.assets.length, 27);
  assert.ok(result.textures.assets.every(asset => asset.width > 0 && asset.height > 0 && Math.max(asset.width, asset.height) <= 1024)); assert.ok(result.textures.withinBudget);
  await page.screenshot({ path: `${dir}/coastal-library.png` }); assert.deepEqual(errors, []);
  assert.ok(requests.every(url => url.startsWith('http://127.0.0.1:4173/') || url.startsWith('data:')), 'actual material fixture must use only local or embedded resources');
  const disposal = await page.evaluate(() => window.coastalFixture.shutdown()); assert.deepEqual(disposal, { geometries: 0, cached: 0 });
  await writeFile(`${dir}/report.json`, JSON.stringify({ ...result, disposal, errors, requests }, null, 2)); console.log(JSON.stringify({ sources: result.textures.sourceCount, residentMiB: result.textures.estimatedBytes / 1048576, errors, disposal }));
} finally { await browser.close(); }
