// Original deterministic coastal materials plus unchanged CC0 photographed planks.
// Offline and dependency-free: node scripts/prepare-coastal.mjs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mod = (v, n) => ((v % n) + n) % n;
const smooth = v => v * v * (3 - 2 * v);
function hash(x, y, seed = 17) {
  let v = Math.imul(x + seed * 37, 374761393) ^ Math.imul(y + seed * 71, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177); return (v >>> 0) / 4294967295;
}
function noise(u, v, nx, ny, seed = 17) {
  const x = u * nx, y = v * ny, ix = Math.floor(x), iy = Math.floor(y), sx = smooth(x - ix), sy = smooth(y - iy);
  const h = (a, b) => hash(mod(a, nx), mod(b, ny), seed);
  return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
}
function fBm(u, v, nx = 4, ny = nx, seed = 17) {
  return noise(u, v, nx, ny, seed) * .57 + noise(u, v, nx * 2, ny * 2, seed + 1) * .28 + noise(u, v, nx * 4, ny * 4, seed + 2) * .15;
}
function timber(u, v) {
  let warp = Math.sin(u * TAU) * .28 + Math.sin(u * TAU * 3 + .7) * .07, knot = 0;
  for (const [ku, kv, size] of [[.28, .36, 1], [.77, .74, .73]]) {
    const dx = mod(u - ku + .5, 1) - .5, dy = mod(v - kv + .5, 1) - .5;
    const radius = Math.sqrt(dx * dx * 17 + dy * dy * 260) / size;
    warp += Math.exp(-radius * radius * .7) * dy * 180;
    knot += Math.exp(-radius * radius * 7);
  }
  const long = fBm(u, v, 5, 80, 41), medium = fBm(u, v, 7, 28, 72), wear = fBm(u, v, 4, 4, 96);
  const grainV = v + warp * .014 + noise(u, v, 4, 13, 23) * .012;
  // Irregular, interrupted fibres avoid the equal-width contour bands of a
  // sine-wave wood shader. Knots bend the same anisotropic fibre field.
  const fibres = noise(u, grainV, 9, 256, 171) * .7 + noise(u, grainV, 31, 512, 511) * .3;
  const vein = Math.pow(clamp((fibres - .43) * 2.8), 1.7) * (.42 + medium * .58);
  const pores = Math.pow(clamp((long - .37) * 2.7), 2) * .6;
  const silver = clamp((wear - .47) * 2.3), split = Math.pow(clamp((noise(u, v, 8, 140, 88) - .66) * 3), 5);
  return { value: 226 - vein * 45 - pores * 19 - knot * 28 - split * 38 + silver * 13 + (medium - .5) * 28,
    height: (medium - .5) * .00027 - vein * .00035 - pores * .00013 - split * .0005,
    rough: .72 + silver * .16 + vein * .04, vein, pores, wear, medium, knot };
}
export const COASTAL_RECIPES = Object.freeze({
  timber: { size: 1024, metres: 1, author: 'Sunspark original', description: 'Seamless U-directed grain, knots, open pores and silvered fibres; no board seams.' },
  painted: { size: 1024, metres: 1, author: 'Sunspark original', description: 'Low-contrast paint over matching timber grain; sparse recessed chips, no baked directional light.' },
  roof: { size: 1024, metres: 1, author: 'Sunspark original', description: 'Quarter-metre staggered slate courses with lapped edges and restrained mineral variation.' },
  endGrain: { size: 512, metres: .24, author: 'Sunspark original', description: 'Growth rings and small radial checks for 24cm timber ends.' },
  metal: { size: 512, metres: .5, author: 'Sunspark original', description: 'Fine marine fixture patina and small hammered surface marks.' },
  rope: { size: 512, metres: .2, author: 'Sunspark original', description: 'Twisted sisal fibres; U follows the rope length.' },
  fabric: { size: 512, metres: .25, author: 'Sunspark original', description: 'Coarse cotton canvas warp/weft with soft fibre variation.' },
});
export function coastalPixel(kind, u, v) {
  if (kind === 'timber') return timber(u, v);
  if (kind === 'painted') {
    const wood = timber(u, v), patch = noise(u, v, 23, 37, 271);
    const chip = clamp((patch - .78) * 9) * clamp((wood.pores + wood.vein - .58) * 6);
    return { value: 245 + (wood.medium - .5) * 8 - wood.vein * 6 - chip * 37 - wood.knot * 3,
      height: wood.height * .25 - chip * .00025, rough: .60 + wood.wear * .13 + chip * .18 };
  }
  if (kind === 'roof') {
    const row = Math.floor(v * 4) % 4, sy = mod(v * 4, 1), x = u * 4 + (row % 2) * .5;
    const col = Math.floor(x) % 4, sx = mod(x, 1), variation = hash(col, row, 52), broad = fBm(u, v, 14, 14, 67);
    const side = smooth(clamp(Math.min(sx, 1 - sx) / .045)), lip = smooth(clamp(sy / .03));
    const edge = side * lip, grain = noise(u, v, 24, 80, 49);
    return { value: (212 + variation * 23 + (broad - .5) * 13 + (grain - .5) * 5) * (.69 + edge * .31),
      height: edge * (.005 + sy * .0015) + (broad - .5) * .0003,
      rough: .72 + broad * .13 + (1 - edge) * .07 };
  }
  if (kind === 'endGrain') {
    // One off-centre pith per timber-cut tile, with uneven annual rings. Fade
    // rings gently before the periodic distance changes owner, avoiding the
    // diamond lattice produced by stretching a radial pattern onto a torus.
    const x = mod(u - .36 + .5, 1) - .5, y = mod(v - .43 + .5, 1) - .5;
    const radius = Math.hypot(x * 1.04, y * .94), angle = Math.atan2(y, x), broad = fBm(u, v, 5, 5, 72);
    const eccentric = radius + (.011 * Math.sin(angle * 3 + .6) + .006 * Math.sin(angle * 7 - 1.1)) * smooth(clamp(radius * 12)) + (broad - .5) * .024;
    const ringMask = 1 - smooth(clamp((radius - .23) / .24));
    const phase = eccentric * 33 + Math.sin(eccentric * 48) * .16;
    const rings = Math.pow(.5 + .5 * Math.sin(phase * TAU), 7) * ringMask;
    // A single short, irregular drying check, not repeated radial spokes.
    const checkT = (x - .05) / .24, checkY = x * .34 + .007 * Math.sin(x * 45);
    const crack = checkT > 0 && checkT < 1 ? Math.exp(-(((y - checkY) / .0015) ** 2)) * Math.sin(checkT * Math.PI) : 0;
    const grain = noise(u, v, 90, 90, 291), pith = Math.exp(-radius * radius * 1300);
    return { value: 233 - rings * 26 - crack * 24 - pith * 13 + (grain - .5) * 8 + (broad - .5) * 12,
      height: -rings * .00011 - crack * .00024 - pith * .0001, rough: .84 + grain * .05 + rings * .035 };
  }
  if (kind === 'metal') {
    const patina = fBm(u, v, 6, 6, 441), micro = noise(u, v, 90, 90, 42), pit = Math.pow(clamp((micro - .7) * 3), 4);
    return { value: 231 + (patina - .5) * 18 - pit * 14, height: (patina - .5) * .000025 - pit * .00006, rough: .42 + patina * .17 + pit * .12 };
  }
  if (kind === 'rope') {
    const braid = .5 + .5 * Math.sin((u * 12 - v * 3) * TAU), fine = Math.pow(.5 + .5 * Math.sin((u * 68 - v * 17) * TAU), 6);
    const micro = fBm(u, v, 16, 24, 923), groove = Math.pow(1 - braid, 5);
    return { value: 232 - groove * 47 - fine * 13 + (micro - .5) * 12, height: braid * .0008 + fine * .00010, rough: .9 + micro * .07 };
  }
  if (kind === 'fabric') {
    const nx = Math.cos(u * TAU * 64), ny = Math.cos(v * TAU * 64), weave = (nx * ny + 1) * .5;
    const variation = fBm(u, v, 8, 8, 119);
    return { value: 246 - weave * 15 + (variation - .5) * 8, height: weave * .000065, rough: .91 + variation * .06 };
  }
  throw new Error(`Unknown coastal recipe: ${kind}`);
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function chunk(type, data) {
  const label = Buffer.from(type), all = Buffer.concat([label, data]); let crc = 0xffffffff;
  for (const v of all) crc = crcTable[(crc ^ v) & 255] ^ (crc >>> 8);
  const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); label.copy(result, 4); data.copy(result, 8); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
}
export function encodePng(width, height, data) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 3, width * 3).copy(rows, y * (width * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
export function renderCoastalMaps(kind, size = COASTAL_RECIPES[kind].size) {
  const { metres } = COASTAL_RECIPES[kind], color = new Uint8Array(size * size * 3), normal = new Uint8Array(color.length), roughness = new Uint8Array(color.length), heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = coastalPixel(kind, x / size, y / size), i = y * size + x, shade = clamp(Math.round(p.value), 0, 255), rough = clamp(Math.round(p.rough * 255), 0, 255);
    heights[i] = p.height;
    for (let c = 0; c < 3; c++) { color[i * 3 + c] = shade; roughness[i * 3 + c] = rough; }
  }
  const at = (x, y) => heights[mod(y, size) * size + mod(x, size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // TextureLoader flips source rows: increasing texture V moves up the image.
    const dx = (at(x + 1, y) - at(x - 1, y)) * size / (2 * metres), dy = (at(x, y + 1) - at(x, y - 1)) * size / (2 * metres);
    const inv = 1 / Math.hypot(dx, dy, 1), i = (y * size + x) * 3;
    normal[i] = Math.round((-dx * inv * .5 + .5) * 255); normal[i + 1] = Math.round((dy * inv * .5 + .5) * 255); normal[i + 2] = Math.round((inv * .5 + .5) * 255);
  }
  return { color, normal, roughness, heights };
}
export async function prepareCoastal() {
  await mkdir('assets/coastal', { recursive: true }); await mkdir('src/generated', { recursive: true });
  const urls = {}, manifest = { prepared: '2026-09-08', color: 'sRGB', normal: 'OpenGL tangent-space; source PNG rows flip on upload', roughness: 'linear, same scalar in RGB; Three.js samples G', assets: [] };
  const record = async (name, file, metadata) => {
    const data = await readFile(file), format = file.endsWith('.jpg') ? 'jpeg' : 'png';
    urls[name] = `data:image/${format};base64,${data.toString('base64')}`;
    manifest.assets.push({ name, file, ...metadata, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  };
  for (const [kind, recipe] of Object.entries(COASTAL_RECIPES)) {
    const maps = renderCoastalMaps(kind);
    for (const channel of ['color', 'normal', 'roughness']) {
      const name = `coastal_${kind}_${channel}`, file = `assets/coastal/${name}.png`;
      await writeFile(file, encodePng(recipe.size, recipe.size, maps[channel]));
      await record(name, file, { ...recipe, channel, license: 'Original project-authored asset; same terms as project source', generator: 'scripts/prepare-coastal.mjs' });
    }
  }
  const source = JSON.parse(await readFile('assets/coastal/source/wood_planks.json', 'utf8'));
  for (const [sourceName, channel] of Object.entries({ Diffuse: 'color', nor_gl: 'normal', Rough: 'roughness' })) {
    const item = source[sourceName]['1k'].jpg, file = `assets/coastal/source/wood_planks_${sourceName}.jpg`, data = await readFile(file);
    if (createHash('md5').update(data).digest('hex') !== item.md5) throw new Error(`CC0 source digest mismatch: ${file}`);
    await record(`coastal_planks_${channel}`, file, { channel, size: 1024, metres: 1.5, license: 'CC0', author: 'Amal Kumar / Poly Haven', source: 'https://polyhaven.com/a/wood_planks', url: item.url, md5: item.md5, modified: false });
  }
  await writeFile('assets/coastal/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile('src/generated/coastal-textures.js', `// Embedded coastal maps; reproducible sources and hashes: assets/coastal/manifest.json\nexport default ${JSON.stringify(urls)};\n`);
  console.log(`Prepared ${manifest.assets.length} coastal texture maps (${(manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0) / 1048576).toFixed(2)} MiB encoded source).`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prepareCoastal();
