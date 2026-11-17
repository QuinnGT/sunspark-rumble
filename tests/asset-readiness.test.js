import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetReadiness } from '../src/asset-readiness.js';
import { natureTexture, textureDescriptor, estimateTextureBytes, natureTextureDiagnostics } from '../src/nature-assets.js';
test('loading waits for assets registered during loading', async () => {
  const tracker = new AssetReadiness(); let finishA, finishB, done = false;
  tracker.track('a', new Promise(resolve => { finishA = resolve; }));
  const ready = tracker.ready().then(() => { done = true; });
  tracker.track('b', new Promise(resolve => { finishB = resolve; }));
  finishA(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(done, false);
  finishB(); await ready; assert.equal(done, true);
});
test('asset errors reject readiness with useful names', async () => {
  const tracker = new AssetReadiness(); tracker.track('broken-normal', Promise.reject(new Error('decode')));
  await assert.rejects(tracker.ready(), /broken-normal/); assert.equal(tracker.pending.size, 0);
});
test('texture semantics, shared sources, and mip memory accounting are consistent', () => {
  const first = natureTexture('sand_01_Diffuse', true), repeated = natureTexture('sand_01_Diffuse', true, 3);
  assert.equal(first.source, repeated.source); assert.equal(first.repeat.x, 1); assert.equal(repeated.repeat.x, 3);
  assert.equal(textureDescriptor('sand_01_Rough').channel, 'g');
  assert.throws(() => natureTexture('sand_01_nor_gl', true), /non-color/);
  assert.throws(() => natureTexture('unknown'), /Unknown embedded/);
  assert.equal(estimateTextureBytes(2, 2), 20);
  assert.equal(estimateTextureBytes(2048, 2048), 22369620);
  assert.equal(natureTextureDiagnostics().sourceCount, 1);
});
