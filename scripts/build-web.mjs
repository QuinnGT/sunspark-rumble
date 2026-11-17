// Builds the hosted site into dist/. Run `npm run build` first; this only packages its output.
// Optional env SITE_URL (e.g. https://rumble.example.com) makes the share tags and canonical link absolute.
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dist = 'dist';
const copies = [
  ['style.css', 'style.css'], ['game.bundle.js', 'game.bundle.js'], ['loader.js', 'loader.js'], ['favicon.svg', 'favicon.svg'],
  ['assets/web/og-image.jpg', 'og-image.jpg'], ['THIRD-PARTY-NOTICES.txt', 'THIRD-PARTY-NOTICES.txt'], ['LICENSE', 'LICENSE.txt'],
];
const compressed = /\.(html|js|css|svg|txt)$/;

for (const [source] of [['index.html'], ...copies]) {
  if (!await stat(source).then(s => s.isFile(), () => false)) {
    throw new Error(`build:web needs ${source}.${source === 'game.bundle.js' ? ' Run "npm run build" first.' : ''}`);
  }
}

const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
if (siteUrl && !/^https?:\/\/[^\s"'<>&]+$/.test(siteUrl)) throw new Error(`SITE_URL must look like https://example.com, got: ${siteUrl}`);

const bundleBytes = (await stat('game.bundle.js')).size;
let html = await readFile('index.html', 'utf8');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`index.html no longer contains: ${from}`);
  html = html.replaceAll(from, () => to);
};
swap('data-bundle="game.bundle.js"', `data-bundle="game.bundle.js" data-bytes="${bundleBytes}"`);
swap('content="assets/web/og-image.jpg"', `content="${siteUrl ? siteUrl + '/' : ''}og-image.jpg"`);
if (siteUrl) swap('</head>', `<meta property="og:url" content="${siteUrl}/"><link rel="canonical" href="${siteUrl}/"></head>`);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(`${dist}/index.html`, html);
for (const [source, name] of copies) await copyFile(source, `${dist}/${name}`);

const names = ['index.html', ...copies.map(([, name]) => name)];
for (const name of names.filter(n => compressed.test(n))) {
  await writeFile(`${dist}/${name}.gz`, gzipSync(await readFile(`${dist}/${name}`), { level: 9 }));
}
for (const name of [...names, ...names.filter(n => compressed.test(n)).map(n => `${n}.gz`)]) {
  console.log(`${String((await stat(`${dist}/${name}`)).size).padStart(10)}  ${dist}/${name}`);
}
console.log(`Built ${dist}/${siteUrl ? ` for ${siteUrl}` : ''} (bundle ${bundleBytes} bytes uncompressed)`);
