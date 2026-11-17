import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDocksOakTemplate, createDocksOaks, DOCKS_OAK_SITES, DOCKS_OAK_WIND_PADDING, DOCKS_OAK_COLOR_GAIN, docksOakReserved } from '../src/docks-oaks.js';
import { RockCollision } from '../src/rock-collision.js';
import { createCloud, createIslandSky } from '../src/nature-water.js';
import { DOCKS_LIGHTING, configureDocksClouds } from '../src/docks-lighting.js';

function stubWorld() {
  return { map: { id: 'sunhaven' }, scene: new THREE.Scene(), heightAt: (x, z) => 2 + x * .015 + z * .002, obstacles: [],
    rockCollider(mesh, kind) { const shape = new RockCollision(mesh), obstacle = { mesh, kind, shape, box: shape.bounds.clone() }; this.obstacles.push(obstacle); return obstacle; } };
}
test('spreading oak templates preserve broad lobed silhouettes at each detail level', () => {
  const template = createDocksOakTemplate(0);
  assert.equal(template.clusters.length, 7); assert.equal(template.cardCount, 5880);
  const boxes = template.levels.map(geometry => geometry.boundingBox), high = boxes[0].getSize(new THREE.Vector3());
  assert.ok(high.x > 10.5 && high.x < 12); assert.ok(boxes[0].min.y > 2.9); assert.ok(boxes[0].max.y > 9.9 && boxes[0].max.y < 10.8);
  assert.ok(Math.max(...template.clusters.map(c=>c[1]))-Math.min(...template.clusters.map(c=>c[1]))>2.5,'asymmetric crown lobes must not collapse to one flat umbrella');
  for (let level = 0; level < 3; level++) {
    const g = template.levels[level]; assert.equal(g.index.count / 6, template.cardCount / 2 ** level);
    assert.equal(g.attributes.color.count, g.attributes.position.count); assert.equal(g.attributes.uv.count, g.attributes.position.count);
    assert.ok(g.attributes.color.array instanceof Uint8Array); assert.equal(g.attributes.color.normalized,true);
    assert.ok(g.userData.maxColorQuantizationError <= DOCKS_OAK_COLOR_GAIN / 510 + 1e-8);
    assert.ok(g.attributes.color.array.some(value=>value/255*DOCKS_OAK_COLOR_GAIN>1),'sunlit color headroom must survive compact encoding');
    const raw = new THREE.Box3().setFromBufferAttribute(g.attributes.position), pad = DOCKS_OAK_WIND_PADDING;
    assert.ok(g.boundingBox.min.x <= raw.min.x - pad.x + 1e-7); assert.ok(g.boundingBox.max.z >= raw.max.z + pad.z - 1e-7);
    assert.ok(g.boundingBox.getSize(new THREE.Vector3()).x >= high.x * .94, 'distant canopy retains its spreading silhouette');
  }
  for (const g of [template.branches, ...template.levels]) g.dispose();
});

test('oak trunk raycasts agree with visible branches and LOD never changes collision', () => {
  const world = stubWorld(), oaks = createDocksOaks(world), camera = new THREE.PerspectiveCamera(), first = oaks.trees[0], bounds = world.obstacles.map(o => o.box.clone());
  assert.equal(world.obstacles.length, 3); assert.equal(createDocksOaks(world), oaks);
  const ray = new THREE.Raycaster(new THREE.Vector3(first.x + 3, first.y + 1.2, first.z), new THREE.Vector3(-1, 0, 0));
  first.trunk.updateWorldMatrix(true, false); const hits = ray.intersectObject(first.trunk, false); assert.ok(hits.length); assert.ok(hits[0].distance > 2 && hits[0].distance < 3.5);
  assert.ok(world.obstacles.every(o => o.mesh.userData.instancedVisual && o.kind === 'docks-oak'));
  camera.position.set(first.x + 8, 6, first.z); oaks.setQuality('high'); oaks.update(0, camera); assert.equal(first.level, 0);
  camera.position.set(600, 10, 600); oaks.update(1, camera); assert.ok(oaks.trees.every(tree => tree.level === 2));
  camera.position.set(first.x + 8, 6, first.z); oaks.setQuality('low'); oaks.update(2, camera); assert.equal(first.level, 0);
  world.obstacles.forEach((o, i) => assert.ok(o.box.equals(bounds[i])));
  assert.ok(docksOakReserved(DOCKS_OAK_SITES[0].x + 2, DOCKS_OAK_SITES[0].z)); assert.equal(docksOakReserved(0, 0), false);
  let disposedGeometry = 0, disposedTexture = 0;
  for (const tree of oaks.trees) for (const g of [tree.trunk.geometry, ...tree.levels.map(m => m.geometry)]) g.addEventListener('dispose', () => disposedGeometry++);
  first.levels[0].material.map.addEventListener('dispose', () => disposedTexture++); oaks.dispose(); oaks.dispose(); assert.equal(disposedGeometry, 12); assert.equal(disposedTexture, 0); assert.equal(oaks.children.length, 0);
});

test('leaf cutout, wind and shadow materials share exactly the same shader displacement', () => {
  const oaks = createDocksOaks(stubWorld()), leaf = oaks.trees[0].levels[0], shaders = [];
  const expectedColor=new THREE.Color(0xe9f5ad).multiplyScalar(DOCKS_OAK_COLOR_GAIN);
  assert.ok(leaf.material.color.equals(expectedColor),'material must restore packed vertex-color headroom');
  for (const [material, lib] of [[leaf.material, THREE.ShaderLib.standard], [leaf.customDepthMaterial, THREE.ShaderLib.depth], [leaf.customDistanceMaterial, THREE.ShaderLib.distanceRGBA]]) {
    assert.equal(material.map, leaf.material.map); assert.equal(material.alphaTest, leaf.material.alphaTest);
    const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {} }; material.onBeforeCompile(shader); shaders.push(shader);
  }
  for (const shader of shaders) { assert.ok(shader.vertexShader.includes('transformed.x+=sin(oakTime*.83')); assert.equal(shader.uniforms.oakTime, shaders[0].uniforms.oakTime); }
  for (const mesh of oaks.trees.flatMap(tree => tree.levels)) assert.equal(mesh.frustumCulled, true);
  oaks.dispose();
});

test('coastal sky and cloud options retain the original map path and make self-contained local cloud banks', () => {
  const old = createIslandSky(), coast = createIslandSky({ coastal: true }); assert.equal(old.material.uniforms.turbidity.value, 2); assert.equal(coast.material.uniforms.turbidity.value, 1.55);
  assert.ok(coast.material.fragmentShader.includes('vec3(0.075,0.175,0.39)'));
  const clouds = [0, 1, 2].map(variant => { const group = new THREE.Group(); group.add(createCloud({ coastal: true, variant })); return group; }); configureDocksClouds(clouds);
  const cloudImages=clouds.map(group=>group.children[0].material.map.image.data);
  let differentSilhouettePixels=0;for(let i=3;i<cloudImages[0].length;i+=4)if((cloudImages[0][i]>160)!==(cloudImages[1][i]>160))differentSilhouettePixels++;
  assert.ok(differentSilhouettePixels>2000,'cloud variants need different major puff silhouettes, not just random edge noise');
  for (const group of clouds) {
    const cloud = group.children[0]; assert.equal(cloud.material.map.image.width, 512); assert.equal(cloud.material.map.colorSpace, THREE.SRGBColorSpace); assert.equal(cloud.material.depthWrite, false); assert.ok(cloud.scale.x >= 60); assert.ok(group.position.y > 50);
    const pixels = cloud.material.map.image.data; assert.ok(pixels.some((value, i) => i % 4 === 3 && value > 230)); assert.ok(pixels.some((value, i) => i % 4 === 3 && value === 0));
    let minLit=255,maxLit=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>230){minLit=Math.min(minLit,pixels[i]);maxLit=Math.max(maxLit,pixels[i]);}
    assert.ok(maxLit-minLit>45,'opaque cloud interiors retain useful puff/underside contrast before tone mapping');
    cloud.material.map.dispose(); cloud.material.dispose();
  }
  assert.equal(createCloud().material.map.image.width, 256); assert.ok(DOCKS_LIGHTING.sunIntensity < 2.6); assert.ok(DOCKS_LIGHTING.hemisphereIntensity > .55);
  old.geometry.dispose(); old.material.dispose(); coast.geometry.dispose(); coast.material.dispose();
});
