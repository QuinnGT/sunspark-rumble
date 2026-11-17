import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World} from '../src/world.js';
import {prepareAuthoredModels,assertMatchingGeometry} from '../src/authored-models.js';
import {auditWorldSurfaces} from '../scripts/surface-layer-audit.mjs';

test('embedded roofs and approved rocks match source collision and survive the surface audit',async()=>{
  const world=new World(new THREE.Scene(),'sunhaven');
  assert.equal(world.authoredModelSlots.length,15);
  assert.equal(new Set(world.authoredModelSlots.map(s=>s.key)).size,5);
  const before=world.authoredModelSlots.map(s=>s.visual.geometry),disposed=before.map(()=>0);
  before.forEach((g,i)=>g.addEventListener('dispose',()=>disposed[i]++));
  const status=await prepareAuthoredModels(world);
  assert.equal(status.state,'ready');assert.equal(status.models,15);assert.ok(status.bytes>1000&&status.bytes<128*1024);
  for(const slot of world.authoredModelSlots){
    assert.ok(slot.visual.userData.authoredGLTF&&slot.visual.userData.staticBatching===false);
    const expected=slot.source.clone().applyMatrix4(slot.matrix);assertMatchingGeometry(expected,slot.visual.geometry);expected.dispose();
  }
  assert.deepEqual(disposed,world.authoredModelSlots.map(s=>s.releaseOldGeometry===false?0:1));assert.deepEqual(auditWorldSurfaces(world).violations,[]);
});

test('stale authored geometry fails rather than drifting away from collision',()=>{
  const source=new THREE.BoxGeometry(2,3,4),stale=source.clone();stale.attributes.position.setY(0,7);
  assert.throws(()=>assertMatchingGeometry(source,stale),/differs from collision/);
  const missing=source.clone();missing.deleteAttribute('uv');assert.throws(()=>assertMatchingGeometry(source,missing),/incomplete uv/);
});

test('invalid model data fails startup without replacing the existing visual',async()=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),original=mesh.geometry;
  const world={authoredModelSlots:[{key:'broken',source:original,matrix:new THREE.Matrix4(),visual:mesh}]};
  await assert.rejects(prepareAuthoredModels(world,{base64:btoa('invalid glTF')}));
  assert.equal(world.authoredModelStatus.state,'failed');assert.equal(mesh.geometry,original);
});


test('missing or malformed model payload records a startup failure',async()=>{
  for(const data of [{},{base64:'%invalid%'}]){
    const world={authoredModelSlots:[{}]};
    await assert.rejects(prepareAuthoredModels(world,data));
    assert.equal(world.authoredModelStatus.state,'failed');
  }
});

test('teardown during model loading cancels replacement',async()=>{
  const world={authoredModelSlots:[{}],assetLoadCancelled:true};
  const status=await prepareAuthoredModels(world);
  assert.equal(status.state,'cancelled');assert.equal(status.models,0);
});
