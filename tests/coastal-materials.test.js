import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { coastalMaterial, COASTAL_MATERIALS } from '../src/coastal-materials.js';
import { natureTexture, textureDescriptor, estimateTextureBytes } from '../src/nature-assets.js';
import { COASTAL_RECIPES, coastalPixel, renderCoastalMaps } from '../scripts/prepare-coastal.mjs';

test('coastal surfaces preserve the physical UV scale and texture channel contract', () => {
  for (const [kind, definition] of Object.entries(COASTAL_MATERIALS)) {
    const material = coastalMaterial(kind, undefined, { repeat: [2, 3] });
    assert.ok(material.isMeshStandardMaterial); assert.equal(material.vertexColors, true);
    assert.equal(material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile, 'standard shader remains batchable');
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    for (const map of [material.normalMap, material.roughnessMap]) assert.equal(map.colorSpace, THREE.NoColorSpace);
    for (const map of [material.map, material.normalMap, material.roughnessMap]) {
      assert.equal(map.repeat.x, 2 / definition.tileMetres); assert.equal(map.repeat.y, 3 / definition.tileMetres);
      assert.equal(map.wrapS, THREE.RepeatWrapping); assert.ok(map.generateMipmaps);
    }
    assert.equal(textureDescriptor(material.roughnessMap.name).channel, 'g');
  }
  assert.equal(coastalMaterial('painted'), coastalMaterial('paintedWood'));
  assert.throws(() => coastalMaterial('missing'), /Unknown coastal material/);
  assert.throws(() => coastalMaterial('timber', undefined, { repeat: [-1, 1] }), /positive/);
});

test('material cache recreation preserves borrowed texture ownership and isolated transforms', () => {
  const first = coastalMaterial('timber'), same = coastalMaterial('wood'), map = first.map;
  assert.equal(first, same);
  const stretched = natureTexture(map.name, true, [4, 2]);
  assert.equal(map.source, stretched.source); assert.deepEqual(map.repeat.toArray(), [1, 1]);
  let textureDisposals = 0; map.addEventListener('dispose', () => textureDisposals++);
  first.dispose(); assert.equal(textureDisposals, 0);
  const next = coastalMaterial('timber'); assert.notEqual(next, first); assert.equal(next.map, map);
});

test('authored materials tile periodically and produce matching OpenGL normals and scalar roughness', () => {
  for (const kind of Object.keys(COASTAL_RECIPES)) {
    for (const t of [.13, .32, .77]) {
      for (const field of ['height', 'value', 'rough']) {
        assert.ok(Math.abs(coastalPixel(kind, 0, t)[field] - coastalPixel(kind, 1, t)[field]) < 1e-6, `${kind} horizontal ${field} seam`);
        assert.ok(Math.abs(coastalPixel(kind, t, 0)[field] - coastalPixel(kind, t, 1)[field]) < 1e-6, `${kind} vertical ${field} seam`);
      }
    }
    const size = 64, { normal, roughness, heights } = renderCoastalMaps(kind, size), metres = COASTAL_RECIPES[kind].metres;
    for (let i = 0; i < size * size; i++) {
      assert.equal(roughness[i * 3], roughness[i * 3 + 1]); assert.equal(roughness[i * 3], roughness[i * 3 + 2]);
      const x = i % size, y = Math.floor(i / size), sample = (dx, dy) => heights[((y + dy + size) % size) * size + (x + dx + size) % size];
      const dx = (sample(1, 0) - sample(-1, 0)) * size / (2 * metres), dy = (sample(0, 1) - sample(0, -1)) * size / (2 * metres);
      const length = Math.hypot(dx, dy, 1), expected = [-dx / length, dy / length, 1 / length];
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(normal[i * 3 + c] / 255 * 2 - 1 - expected[c]) < .004);
    }
  }
});

test('embedded coastal sources are reproducible, hashed, one kilopixel or smaller, and budgeted', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/coastal/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.assets.length, 24); let residentBytes = 0;
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(`../${asset.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(asset.size <= 1024); residentBytes += estimateTextureBytes(asset.size, asset.size);
    if (asset.file.endsWith('.png')) { assert.equal(bytes.readUInt32BE(16), asset.size); assert.equal(bytes.readUInt32BE(20), asset.size); }
    if (asset.license === 'CC0') { assert.equal(asset.modified, false); assert.equal(createHash('md5').update(bytes).digest('hex'), asset.md5); }
  }
  assert.ok(residentBytes <= 81 * 1024 * 1024, 'leaves ample room below the shared 256MiB ceiling with existing 96MiB assets');
});
