import * as THREE from 'three';
import natureUrls from './generated/nature-textures.js';
import coastalUrls from './generated/coastal-textures.js';
import approvedUrls from './generated/approved-textures.js';
import { ResourceScope } from './resource-scope.js';
import { AssetReadiness } from './asset-readiness.js';
const textures = new Map(), sources = new Map(), readiness = new AssetReadiness();
const urls = Object.freeze({ ...natureUrls, ...coastalUrls, ...approvedUrls });
const ownership = new ResourceScope('embedded nature textures');
let anisotropy = 4;
export const TEXTURE_BUDGET = Object.freeze({ maxDimension: 2048, residentBytes: 256 * 1024 * 1024 });
export const natureAssets = { pending: 0, failed: [] };
export function textureDescriptor(name) {
  if (!Object.hasOwn(urls, name)) throw new Error(`Unknown embedded texture: ${name}`);
  const role = /Diffuse|color/.test(name) ? 'color' : /Rough|roughness/.test(name) ? 'roughness' : 'normal';
  return { name, role, colorSpace: role === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace, channel: role === 'roughness' ? 'g' : 'rgb', maxDimension: TEXTURE_BUDGET.maxDimension };
}
export function estimateTextureBytes(width, height, mipmaps = true, bytesPerPixel = 4) {
  let bytes = 0, w = Math.max(1, width), h = Math.max(1, height);
  do { bytes += w * h * bytesPerPixel; if (!mipmaps || (w === 1 && h === 1)) break; w = Math.max(1, Math.floor(w / 2)); h = Math.max(1, Math.floor(h / 2)); } while (true);
  return bytes;
}
export function natureTexture(name, color, repeat = 1) {
  const descriptor = textureDescriptor(name);
  if (color !== undefined && color !== (descriptor.role === 'color')) throw new Error(`Texture ${name} requires ${descriptor.role === 'color' ? 'sRGB color' : 'non-color data'} interpretation.`);
  const repeats = Array.isArray(repeat) ? repeat : [repeat, repeat];
  if (repeats.length !== 2 || repeats.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Texture repeat must be positive.');
  const [repeatX, repeatY] = repeats;
  const key = `${name}:${repeatX}:${repeatY}`; if (textures.has(key)) return textures.get(key);
  let texture = sources.get(name);
  if (!texture) {
    if (typeof Image !== 'undefined') {
      natureAssets.pending++;
      let resolve, reject;
      const loaded = new Promise((a, b) => { resolve = a; reject = b; });
      readiness.track(name, loaded);
      texture = new THREE.TextureLoader().load(urls[name], () => {
        natureAssets.pending--;
        for (const variant of textures.values()) if (variant.name === name) variant.needsUpdate = true;
        resolve();
      }, undefined, error => { natureAssets.pending--; natureAssets.failed.push(name); reject(error || new Error(name)); });
    } else texture = new THREE.DataTexture(new Uint8Array([180, 190, 170, 255]), 1, 1);
    texture.name = name; texture.colorSpace = descriptor.colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy; texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.needsUpdate = true;
    sources.set(name, ownership.retain(texture));
  }
  // Texture transforms share a decoded image Source instead of loading it again.
  const variant = repeatX === 1 && repeatY === 1 ? texture : ownership.retain(texture.clone());
  variant.repeat.set(repeatX, repeatY); textures.set(key, variant); return variant;
}
export async function prepareNatureAssets(renderer) {
  await readiness.ready();
  anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 1);
  for (const texture of new Set([...sources.values(), ...textures.values()])) {
    texture.anisotropy = anisotropy; texture.needsUpdate = true; renderer.initTexture?.(texture);
  }
}
export function natureTextureSet() { return new Set([...sources.values(), ...textures.values()]); }
export function natureTextureDiagnostics() {
  const assets = [...sources].map(([name, texture]) => {
    const image = texture.image, width = image?.naturalWidth || image?.width || 0, height = image?.naturalHeight || image?.height || 0;
    return { ...textureDescriptor(name), width, height, estimatedBytes: width && height ? estimateTextureBytes(width, height) : 0 };
  });
  const estimatedBytes = assets.reduce((sum, asset) => sum + asset.estimatedBytes, 0);
  return { assets, sourceCount: sources.size, samplerCount: textures.size, estimatedBytes, budgetBytes: TEXTURE_BUDGET.residentBytes, withinBudget: estimatedBytes <= TEXTURE_BUDGET.residentBytes && assets.every(a => Math.max(a.width, a.height) <= TEXTURE_BUDGET.maxDimension), estimate: 'RGBA8 with mipmaps for embedded nature and coastal maps; excludes render targets and other procedural textures' };
}
export function disposeNatureAssets() { ownership.dispose(); textures.clear(); sources.clear(); }
