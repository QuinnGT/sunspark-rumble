// Checks the hosted page: serves dist/ over HTTP like the nginx image does (precompressed .gz, ETag revalidation, strict CSP)
// and drives loader.js. Needs `npm run build && npm run build:web`, and `npm run package:release` for the file:// check.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

setTimeout(() => { console.error('browser-web-loader: hard timeout'); process.exit(1); }, 280000).unref();

const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'";
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', txt: 'text/plain; charset=utf-8', jpg: 'image/jpeg' };
const files = new Map(), requests = [];

async function load(name) {
  if (!files.has(name)) {
    const entry = { raw: await readFile(`dist/${name}`), gz: await readFile(`dist/${name}.gz`).catch(() => null) };
    for (const body of [entry.raw, entry.gz]) if (body) body.etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
    files.set(name, entry);
  }
  return files.get(name);
}

const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://x').pathname.slice(1) || 'index.html', record = { name, status: 0, bytes: 0 };
  requests.push(record);
  try {
    if (!/^[\w.-]+$/.test(name)) throw new Error('bad path');
    const entry = await load(name), gzip = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || ''), body = gzip ? entry.gz : entry.raw;
    const ext = name.split('.').pop(), headers = {
      'Content-Type': types[ext] || 'application/octet-stream', ETag: body.etag, Vary: 'Accept-Encoding', 'Content-Security-Policy': csp,
      'Cache-Control': ext === 'jpg' || ext === 'svg' ? 'public, max-age=86400' : 'no-cache',
    };
    if (gzip) headers['Content-Encoding'] = 'gzip';
    if (req.headers['if-none-match'] === body.etag) { record.status = 304; res.writeHead(304, headers).end(); return; }
    record.status = 200; headers['Content-Length'] = body.length; res.writeHead(200, headers);
    // Send the bundle in slow chunks so progress is observable instead of jumping from 0 to 100.
    const chunk = name === 'game.bundle.js' ? 262144 : body.length;
    for (let at = 0; at < body.length && !res.destroyed; at += chunk) {
      res.write(body.subarray(at, at + chunk)); record.bytes += Math.min(chunk, body.length - at);
      if (chunk < body.length) await new Promise(done => setTimeout(done, 15));
    }
    res.end();
  } catch { record.status = 404; res.writeHead(404, { 'Content-Security-Policy': csp }).end('Not found'); }
});

let port;
for (port = 4310; port <= 4319; port++) {
  try { await new Promise((ok, bad) => { server.once('error', bad); server.listen(port, '127.0.0.1', () => { server.off('error', bad); ok(); }); }); break; }
  catch (error) { if (error.code !== 'EADDRINUSE' || port === 4319) throw error; }
}
const base = `http://127.0.0.1:${port}`;

const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const checks = [];
const ready = () => window.sunspark?.snapshot().startup.ready;

// Records CSP violations and every progress value the loader publishes.
const instrument = context => context.addInitScript(() => {
  window.__csp = []; window.__progress = [];
  document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  new MutationObserver(() => window.__progress.push(+document.getElementById('load-bar').getAttribute('aria-valuenow')))
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-valuenow'] });
});
// A persistent profile has a real disk cache; an incognito-style context's in-memory cache is too small to keep the 16+ MB bundle.
async function open(options, persistent = false) {
  const dir = persistent ? await mkdtemp(join(tmpdir(), 'sunspark-web-')) : null;
  const context = persistent ? await chromium.launchPersistentContext(dir, { executablePath, headless: true, ...options }) : await browser.newContext(options);
  const page = await context.newPage(), errors = [];
  await instrument(context);
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { page, errors, close: async () => { await context.close(); if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {}); } };
}
const bundleRequests = () => requests.filter(r => r.name === 'game.bundle.js');

try {
  await mkdir('tests/artifacts', { recursive: true });

  // Desktop over HTTP: progress, title screen, one full download, no CSP violations.
  {
    const { page, errors, close } = await open({ viewport: { width: 1280, height: 720 } }, true);
    const response = await page.goto(`${base}/`);
    assert.equal(response.headers()['content-security-policy'], csp);
    await page.waitForFunction(() => +document.getElementById('load-bar').getAttribute('aria-valuenow') >= 40, {}, { timeout: 30000 });
    assert.ok(await page.locator('#load-progress').isVisible(), 'progress bar is shown during the download');
    await page.screenshot({ path: 'tests/artifacts/web-loader-progress.png' });
    await page.waitForFunction(ready, {}, { timeout: 90000 });
    const progress = await page.evaluate(() => window.__progress);
    assert.ok(progress.some(p => p > 0 && p < 100), `intermediate progress seen: ${progress}`);
    assert.equal(progress.at(-1), 100); assert.deepEqual(progress, [...progress].sort((a, b) => a - b), 'progress never goes backwards');
    assert.match(await page.locator('#load-text').textContent(), /^100%.*\bMB\b/);
    assert.ok(await page.locator('#title').isVisible()); assert.ok(await page.locator('#loading').evaluate(el => el.classList.contains('hidden')));
    const bundle = bundleRequests();
    assert.equal(bundle.filter(r => r.status === 200).length, 1, `bundle downloaded in full once: ${JSON.stringify(bundle)}`);
    assert.ok(bundle.length <= 2 && bundle.slice(1).every(r => r.status === 304), 'second bundle request is a 304 revalidation');
    assert.equal(requests.find(r => r.name === 'favicon.svg')?.status, 200);
    assert.deepEqual(await page.evaluate(() => window.__csp), [], 'no CSP violations');
    assert.deepEqual(errors, []);
    checks.push(`progress ${progress.length} updates to 100%`, `bundle requests: ${bundle.map(r => r.status).join(', ')}`, 'title screen appears; zero CSP violations; no console errors');
    await close();
  }

  // Touch-only device: notice first, no bundle request until "Load anyway".
  {
    requests.length = 0;
    const { page, errors, close } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true);
    await page.goto(`${base}/`);
    await page.locator('#touch-notice').waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(await page.locator('#loading').evaluate(el => el.classList.contains('hidden')));
    await page.screenshot({ path: 'tests/artifacts/web-loader-touch-notice.png' });
    await page.waitForTimeout(2000);
    assert.deepEqual(bundleRequests(), [], 'bundle is not requested while the notice is up');
    await page.locator('#load-anyway').click();
    await page.waitForFunction(ready, {}, { timeout: 120000 });
    assert.equal(bundleRequests().filter(r => r.status === 200).length, 1);
    assert.equal((await page.evaluate(() => window.__progress)).at(-1), 100);
    assert.ok(await page.locator('#touch-notice').evaluate(el => el.classList.contains('hidden')));
    assert.deepEqual(await page.evaluate(() => window.__csp), []); assert.deepEqual(errors, []);
    checks.push('touch notice shown, bundle held back until "Load anyway", then loads to the title screen');
    await close();
  }

  // Portable edition from file://: no fetch, straight to the title screen.
  {
    const { page, errors, close } = await open({ viewport: { width: 1280, height: 720 } });
    await page.goto(pathToFileURL(resolve('release/Sunspark Rumble/index.html')).href);
    await page.waitForFunction(ready, {}, { timeout: 90000 });
    assert.ok(await page.locator('#title').isVisible()); assert.ok(await page.locator('#load-progress').evaluate(el => el.classList.contains('hidden')));
    assert.deepEqual(errors, []);
    checks.push('file:// release loads to the title screen without the progress bar');
    await close();
  }

  console.log(JSON.stringify({ url: base, checks }, null, 2));
} finally {
  await browser.close(); server.close();
}
