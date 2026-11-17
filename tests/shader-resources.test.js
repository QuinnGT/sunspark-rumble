import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { patchShader, assertShaderRevision } from '../src/shader-patches.js';
import { ResourceScope, captureSceneResources } from '../src/resource-scope.js';

test('shader changes fail loudly on missing/ambiguous chunks and mismatched Three revision', () => {
  assert.equal(patchShader('a <chunk> b', '<chunk>', 'new', 'known'), 'a new b');
  assert.throws(() => patchShader('changed', '<chunk>', 'new', 'missing'), /expected 1 occurrence/);
  assert.throws(() => patchShader('x x', 'x', 'y', 'ambiguous'), /found 2/);
  assert.equal(patchShader('x x', 'x', 'y', 'multiple', { count: 2 }), 'y y');
  assert.throws(() => assertShaderRevision('181'), /Revalidate/);
});

test('shared GPU resources survive until their final owner releases them', () => {
  let disposed = 0; const resource = { dispose() { disposed++; } };
  const a = new ResourceScope('a'), b = new ResourceScope('b');
  a.retain(resource); a.retain(resource); b.retain(resource);
  a.dispose(); assert.equal(disposed, 0); a.dispose(); assert.equal(disposed, 0);
  b.dispose(); assert.equal(disposed, 1); assert.throws(() => b.retain(resource), /already disposed/);
});

test('scene cleanup deduplicates geometry and preserves external and target textures', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), map = new THREE.Texture(), target = new THREE.WebGLRenderTarget(2, 2);
  const material = new THREE.MeshStandardMaterial({ map }), scope = new ResourceScope();
  material.roughnessMap = target.texture;
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  let geometries = 0, materials = 0, textures = 0;
  geometry.addEventListener('dispose', () => geometries++); material.addEventListener('dispose', () => materials++);
  map.addEventListener('dispose', () => textures++); target.texture.addEventListener('dispose', () => textures++);
  captureSceneResources(scene, scope, { externalTextures: new Set([map]) }).dispose();
  assert.equal(geometries, 1); assert.equal(materials, 1); assert.equal(textures, 0); target.dispose(); map.dispose();
});

test('scene cleanup releases instance buffers and respects module-owned subtrees',()=>{
  const scene=new THREE.Scene(),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),2),owned=new THREE.Group();
  const untouched=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1);owned.add(untouched);scene.add(mesh,owned);
  let releases=0,skipped=0;mesh.addEventListener('dispose',()=>releases++);untouched.addEventListener('dispose',()=>skipped++);
  captureSceneResources(scene,new ResourceScope(),{skipRoots:new Set([owned])}).dispose();
  assert.equal(releases,1);assert.equal(skipped,0);untouched.dispose();untouched.geometry.dispose();untouched.material.dispose();
});
