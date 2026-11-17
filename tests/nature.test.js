import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World, heightAt } from '../src/world.js';
import { IslandWater, createWaterDepth } from '../src/nature-water.js';
import { createActor } from '../src/actor.js';

test('quality and canopy distance changes preserve all collision bodies and routes',()=>{
  const world=new World(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
  const solids=[...world.solids],bounds=world.obstacles.map(o=>o.box.clone());
  assert.ok(world.foliage.trees.length>=40,'retain a wooded island');
  assert.ok(world.foliage.leafCount>0,'the world is renderable before its first simulation tick');
  assert.ok(world.obstacles.filter(o=>o.mesh.geometry.type==='IcosahedronGeometry').length>=13,'retain rock cover and shoreline detail');
  camera.position.set(0,5,0);world.update(1,0,camera);
  const detailed=world.foliage.leafCount;assert.ok(detailed>10000,'full canopies use detailed cutout geometry');
  world.setQuality(true);world.update(2,0,camera);assert.ok(world.foliage.leafCount<detailed);assert.equal(world.groundCover.visible,false);
  const nearbySmooth=world.foliage.leafCount;
  camera.position.set(300,5,300);world.update(3,0,camera);assert.ok(world.foliage.leafCount<nearbySmooth,'distant trees reduce geometry further');
  world.setQuality(false);world.update(4,0,camera);assert.equal(world.groundCover.visible,true);
  assert.deepEqual(world.solids,solids);world.obstacles.forEach((o,i)=>assert.ok(o.box.equals(bounds[i])));
  for(const mesh of world.foliage.batches)assert.ok(mesh.isInstancedMesh&&mesh.customDepthMaterial,'wind and cutout shadows use the same geometry');
});

test('leaf cutouts have matching depth materials and shoreline data follows actual depth',()=>{
  const world=new World(new THREE.Scene()),leaf=world.foliage.texture;
  assert.equal(leaf.generateMipmaps,true);
  for(const mesh of world.foliage.batches){assert.equal(mesh.material.map,mesh.customDepthMaterial.map);assert.equal(mesh.material.alphaTest,mesh.customDepthMaterial.alphaTest);assert.ok(mesh.material.alphaTest>0);}
  const depth=createWaterDepth(heightAt),data=depth.image.data;
  const at=(x,z)=>data[(Math.round((z/160+.5)*255)*256+Math.round((x/160+.5)*255))*4];
  assert.equal(at(0,0),0);assert.ok(at(79,0)>at(72,0));
  assert.ok(data.every(Number.isFinite));
});

test('refraction budgets resize with the viewport and always restore the scene/render target',()=>{
  const water=new IslandWater(heightAt),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,16/9,.1,600);
  scene.add(water);camera.position.set(55,5,35);camera.lookAt(80,0,55);camera.updateMatrixWorld(true);
  const previous={name:'main color target'};let target=previous,renders=0;
  const renderer={shadowMap:{autoUpdate:true,needsUpdate:true},xr:{enabled:true},getDrawingBufferSize:v=>v.set(1600,900),getRenderTarget:()=>target,setRenderTarget:v=>target=v,clear(){},render(){renders++;assert.equal(water.visible,false);assert.equal(this.shadowMap.needsUpdate,false);}};
  water.setQuality('balanced');water.refractCoast(renderer,scene,camera);
  assert.equal(water.refractionTarget.width,800);assert.equal(water.refractionTarget.height,450);assert.equal(renders,1);
  assert.equal(target,previous);assert.equal(water.visible,true);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.needsUpdate,true);
  water.setQuality('high');water.refractCoast(renderer,scene,camera);assert.equal(water.refractionTarget.width,1120);assert.equal(water.refractionTarget.height,630);
  water.setQuality('low');water.refractCoast(renderer,scene,camera);assert.equal(renders,2);assert.equal(water.material.uniforms.refracting.value,0);
  water.setQuality('high');renderer.render=()=>{throw new Error('refraction failure');};
  assert.throws(()=>water.refractCoast(renderer,scene,camera),/refraction failure/);assert.equal(target,previous);assert.equal(water.visible,true);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.shadowMap.needsUpdate,true);
});

test('water reflections throttle, respect Smooth mode, and restore render state even on failure',()=>{
  const water=new IslandWater(heightAt),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,16/9,.1,600),plants=new THREE.Group();
  scene.add(water,plants);water.exclude=[plants];camera.position.set(55,5,35);camera.lookAt(80,0,55);camera.updateMatrixWorld(true);
  let renders=0,target=null;const previousTarget={name:'previous'};target=previousTarget;
  const renderer={shadowMap:{autoUpdate:false,needsUpdate:true},xr:{enabled:true},getRenderTarget:()=>target,setRenderTarget:value=>target=value,clear(){},render(){renders++;assert.equal(water.visible,false);assert.equal(plants.visible,false);assert.equal(this.shadowMap.needsUpdate,false);}};
  water.update(1);water.reflectCoast(renderer,scene,camera);assert.equal(renders,1);assert.equal(target,previousTarget);assert.equal(water.visible,true);assert.equal(plants.visible,true);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.needsUpdate,true);
  water.update(1.01);water.reflectCoast(renderer,scene,camera);assert.equal(renders,1);
  water.setQuality(true);water.update(2);water.reflectCoast(renderer,scene,camera);assert.equal(renders,1);assert.equal(water.material.uniforms.reflectionStrength.value,0);
  water.setQuality(false);camera.position.set(0,5,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);water.update(3);water.reflectCoast(renderer,scene,camera);assert.equal(renders,1,'dry inland view does not need a reflection pass');
  camera.position.set(55,5,35);camera.lookAt(80,0,55);camera.updateMatrixWorld(true);water.update(4);renderer.render=()=>{throw new Error('test render failure');};
  assert.throws(()=>water.reflectCoast(renderer,scene,camera),/test render failure/);assert.equal(water.visible,true);assert.equal(plants.visible,true);assert.equal(renderer.shadowMap.needsUpdate,true);assert.equal(target,previousTarget);
});

test('distant opponent detail does not move its target body or muzzle',()=>{
  const scene=new THREE.Scene(),actor=createActor(scene,0xffaa55,true);actor.pos.set(20,4,-15);actor.animate(.1,4,.7);scene.updateMatrixWorld(true);
  const muzzle=actor.muzzle.getWorldPosition(new THREE.Vector3()),head=actor.head.getWorldPosition(new THREE.Vector3());
  actor.setDetail(true);scene.updateMatrixWorld(true);assert.equal(actor.body.visible,false);assert.ok(actor.muzzle.getWorldPosition(new THREE.Vector3()).equals(muzzle));assert.ok(actor.head.getWorldPosition(new THREE.Vector3()).equals(head));
  actor.setDetail(false);assert.equal(actor.body.visible,true);assert.equal(actor.health,100);
});

test('settled crouch and slide poses fit their lowered collision height with feet on the floor',()=>{
  const actor=createActor(new THREE.Scene());
  for(const height of [1.7,1.5]){actor.poseHeight=height;actor.animate(.1,0,0);actor.root.updateWorldMatrix(true,true);const body=new THREE.Box3().setFromObject(actor.body,true);assert.ok(body.max.y<=height+.02,'helmet stays beneath the low ceiling');assert.ok(body.min.y>=-.02,'boots do not sink into the floor');assert.ok(body.min.y<.03,'boots stay planted');}
});

test('crouching preserves every mesh scale and keeps head and blaster level through the transition',()=>{
  const actor=createActor(new THREE.Scene());actor.animate(.1,0,0);actor.root.updateWorldMatrix(true,true);
  const scales=new Map();actor.body.traverse(m=>{if(m.isMesh)scales.set(m,m.getWorldScale(new THREE.Vector3()));});
  for(const height of [2.15,1.95,1.8,1.7,1.6,1.5]){
    actor.poseHeight=height;actor.animate(.1,0,0);actor.root.updateWorldMatrix(true,true);
    for(const [mesh,scale] of scales)assert.ok(mesh.getWorldScale(new THREE.Vector3()).distanceTo(scale)<1e-6,'helmet, pack, weapon and limbs retain all three dimensions');
    const up=new THREE.Vector3(0,1,0).transformDirection(actor.neck.matrixWorld),barrel=new THREE.Vector3(0,0,-1).transformDirection(actor.gun.matrixWorld);
    assert.ok(up.distanceTo(new THREE.Vector3(0,1,0))<1e-6);assert.ok(Math.abs(barrel.y)<1e-6);
  }
  assert.ok(actor.upper.rotation.x<-1,'height comes from hip/spine flexion');assert.ok(Math.abs(actor.knees[0].rotation.x)>.4,'knees actually bend');
});
test('crouch steps keep feet above the floor and the firing grip within reach',()=>{
  const actor=createActor(new THREE.Scene());actor.poseHeight=1.7;
  for(let i=0;i<60;i++){
    actor.animate(1/60,3.3,0);actor.root.updateWorldMatrix(true,true);
    for(const foot of actor.feet)assert.ok(new THREE.Box3().setFromObject(foot,true).min.y>-.01);
    const grip=actor.gun.localToWorld(new THREE.Vector3(0,-.2,.06)),hand=actor.hands[1].getWorldPosition(new THREE.Vector3());assert.ok(hand.distanceTo(grip)<.12);
  }
});
