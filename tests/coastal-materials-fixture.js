import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { coastalMaterial } from '../src/coastal-materials.js';
import { prepareNatureAssets, natureTextureDiagnostics, disposeNatureAssets, natureTextureSet } from '../src/nature-assets.js';
import { captureSceneResources, ResourceScope } from '../src/resource-scope.js';

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1440, 960); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe5e0d2);
  scene.add(new THREE.HemisphereLight(0xcde9ff, 0x7b674b, 2.3));
  const light = new THREE.DirectionalLight(0xffedcd, 2.8); light.position.set(-6, 8, 10); scene.add(light);
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, .1, 100); camera.position.set(0, 0, 16); camera.lookAt(0, 0, 0);
  const samples = [['timber', undefined, 'AGED TIMBER'], ['planks', undefined, 'CC0 BOARD SHEET'], ['paintedWood', 0x4caaa2, 'TEAL PAINT'], ['paintedWood', 0xd77759, 'CORAL PAINT'], ['trim', undefined, 'CREAM TRIM'], ['roof', undefined, 'NAVY SLATE'], ['roof', 0xc76550, 'CORAL ROOF'], ['endGrain', undefined, 'END GRAIN'], ['metal', undefined, 'MARINE METAL'], ['rope', undefined, 'SISAL ROPE'], ['fabric', undefined, 'COTTON CANVAS'], ['stone', undefined, 'COASTAL STONE']];
  for (let i = 0; i < samples.length; i++) {
    const [kind, tint, label] = samples[i], geometry = new RoundedBoxGeometry(2.48, 1.9, .16, 1, .045), uv = geometry.attributes.uv, color = [];
    for (let k = 0; k < uv.count; k++) { uv.setXY(k, uv.getX(k) * 2.48, uv.getY(k) * 1.9); color.push(1, 1, 1); }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    const mesh = new THREE.Mesh(geometry, coastalMaterial(kind, tint)); mesh.position.set((i % 4 - 1.5) * 2.95, (1 - Math.floor(i / 4)) * 2.6 + .17, 0); scene.add(mesh);
    const el = document.createElement('div'); el.textContent = label; el.className = 'label'; el.style.left = `${i % 4 * 25}%`; el.style.top = `${(Math.floor(i / 4) + 1) * 32.5 - 2}%`; document.body.appendChild(el);
  }
  await prepareNatureAssets(renderer); await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
  window.coastalFixture = { ready: true, textures: natureTextureDiagnostics(), materials: samples.length, programs: renderer.info.programs.length, shutdown() {
    const scope = captureSceneResources(scene, new ResourceScope('coastal fixture'), { externalTextures: natureTextureSet() });
    scope.dispose(); disposeNatureAssets(); renderer.dispose(); return { geometries: renderer.info.memory.geometries, cached: natureTextureDiagnostics().sourceCount };
  } };
}
boot().catch(error => { window.coastalFixture = { error: error.stack }; throw error; });
