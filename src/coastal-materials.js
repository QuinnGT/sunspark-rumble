// Shared coastal kit surfaces. Geometry supplies metre-scaled UVs and linear
// vertex-color crevice shading. All maps are requested before shader warmup.
import * as THREE from 'three';
import { natureTexture } from './nature-assets.js';

export const COASTAL_PALETTE = Object.freeze({ teal: 0x4caaa2, coral: 0xd77759, cream: 0xf4e5be, navy: 0x34485d, timber: 0xbd945f, rope: 0xbba681, stone: 0xa8aaa2 });
export const COASTAL_MATERIALS = Object.freeze({
  timber: { asset: 'timber', tileMetres: 1, normalScale: .8, roughness: 1, metalness: 0, color: COASTAL_PALETTE.timber },
  paintedWood: { asset: 'painted', tileMetres: 1, normalScale: .62, roughness: 1, metalness: 0, color: COASTAL_PALETTE.teal },
  trim: { asset: 'painted', tileMetres: 1, normalScale: .32, roughness: .91, metalness: 0, color: COASTAL_PALETTE.cream },
  endGrain: { asset: 'endGrain', tileMetres: .24, normalScale: .65, roughness: 1, metalness: 0, color: COASTAL_PALETTE.timber },
  roof: { asset: 'roof', tileMetres: 1, normalScale: .8, roughness: 1, metalness: 0, color: COASTAL_PALETTE.navy },
  metal: { asset: 'metal', tileMetres: .5, normalScale: .6, roughness: 1, metalness: .68, color: COASTAL_PALETTE.navy },
  rope: { asset: 'rope', tileMetres: .2, normalScale: .58, roughness: 1, metalness: 0, color: COASTAL_PALETTE.rope },
  fabric: { asset: 'fabric', tileMetres: .25, normalScale: .6, roughness: 1, metalness: 0, color: COASTAL_PALETTE.cream },
  planks: { asset: 'planks', tileMetres: 1.5, normalScale: .7, roughness: 1, metalness: 0, color: 0xffffff },
  stone: { asset: null, tileMetres: 1.5, normalScale: .64, roughness: 1, metalness: 0, color: 0xffffff },
});
const cache = new Map();
const aliases = Object.freeze({ painted: 'paintedWood', wood: 'timber', slate: 'roof', endgrain: 'endGrain' });

/** Standard batching-compatible material. UV 1 = one metre, U follows grain.
 * repeat:[u,v] optionally multiplies metre density uniformly across all maps.
 * Materials belong to their scene; textures are borrowed from nature-assets.
 */
export function coastalMaterial(kind, color, options = {}) {
  kind = aliases[kind] || kind;
  const definition = COASTAL_MATERIALS[kind];
  if (!definition) throw new RangeError(`Unknown coastal material: ${kind}`);
  const { tileMetres, asset } = definition, tint = new THREE.Color(color ?? definition.color);
  const normalScale = options.normalScale ?? definition.normalScale, roughness = options.roughness ?? definition.roughness, metalness = options.metalness ?? definition.metalness;
  const repeat = options.repeat ?? [1, 1], repeats = Array.isArray(repeat) ? repeat : [repeat, repeat];
  if (repeats.length !== 2 || repeats.some(value => !Number.isFinite(value) || value <= 0)) throw new RangeError('Coastal repeat requires two positive numbers.');
  if (![normalScale, roughness, metalness].every(Number.isFinite) || normalScale < 0 || roughness < 0 || roughness > 1 || metalness < 0 || metalness > 1) throw new RangeError('Coastal material values are outside their physical ranges.');
  const vertexColors = options.vertexColors ?? true;
  const key = `${kind}:${tint.getHex()}:${repeats.join(',')}:${normalScale}:${roughness}:${metalness}:${vertexColors}`;
  if (cache.has(key)) return cache.get(key);
  const density = repeats.map(value => value / tileMetres);
  const names = asset ? [`coastal_${asset}_color`, `coastal_${asset}_normal`, `coastal_${asset}_roughness`] : ['rock_boulder_dry_Diffuse', 'rock_boulder_dry_nor_gl', 'rock_boulder_dry_Rough'];
  const material = new THREE.MeshStandardMaterial({
    color: tint, map: natureTexture(names[0], true, density), normalMap: natureTexture(names[1], false, density),
    normalScale: new THREE.Vector2(normalScale, normalScale), roughnessMap: natureTexture(names[2], false, density), roughness, metalness, vertexColors,
  });
  material.name = `Coastal ${kind}`;
  material.userData.coastal = { kind, tileMetres, grainAxis: ['timber', 'paintedWood', 'trim', 'planks', 'rope'].includes(kind) ? 'u' : null, maps: names };
  // This cache does not own material disposal; the scene ResourceScope does.
  material.addEventListener('dispose', () => { if (cache.get(key) === material) cache.delete(key); });
  cache.set(key, material); return material;
}
