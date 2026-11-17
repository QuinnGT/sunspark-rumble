import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MAPS, sunhavenArtHeightSource, sunhavenHeightSource, mapTerrain, inDocksLandformBounds, docksCoveWeight, docksCoveHeight } from '../src/maps.js';
import { createMapTerrain } from '../src/terrain-surface.js';
import { addDocksLandforms } from '../src/docks-landforms.js';

const field=mapTerrain('sunhaven');

test('docks silhouette changes remain within their approved bounds and protect spawn/finale support',()=>{
  let changed=0;
  for(let x=-125;x<=125;x++)for(let z=-125;z<=125;z++){
    const previous=sunhavenArtHeightSource(x,z),next=sunhavenHeightSource(x,z);
    if(!inDocksLandformBounds(x,z))assert.equal(next,previous,`terrain outside milestone at ${x},${z}`);
    else if(Math.abs(next-previous)>.0001)changed++;
  }
  assert.ok(changed>1000&&changed<4500,`${changed} changed terrain vertices`);
  for(const sites of [MAPS.sunhaven.spawns,MAPS.sunhaven.finales])for(const [x,z] of sites)for(const [dx,dz] of [[0,0],[-2,0],[2,0],[0,-2],[0,2]])assert.equal(sunhavenHeightSource(x+dx,z+dz),sunhavenArtHeightSource(x+dx,z+dz));
  assert.ok(field.heightAt(94,-2)-sunhavenArtHeightSource(94,-2)>5,'substantial north headland');
  assert.ok(field.heightAt(94,53)-sunhavenArtHeightSource(94,53)>4,'substantial south shelf');
  assert.equal(field.heightAt(0,-78),10,'tower summit remains authoritative');
  for(const [x,z] of [[-14,-80],[14,-81]])assert.ok(field.heightAt(x,z)<=9.551&&field.heightAt(x,z)>=9,'terraces stay below lighthouse summit');
});

test('the expanded building floors and both new approach landings clear sampled terrain',()=>{
  const floors=[[70,82,5,15],[69,83,15,17.5],[73.5,78.5,3,5],[65,70,5,15],[61.8,65,6,19]];
  for(const [minX,maxX,minZ,maxZ] of floors)for(let x=minX;x<=maxX;x+=.2)for(let z=minZ;z<=maxZ;z+=.2)assert.ok(field.heightAt(x,z)<=3.275,`terrain through floor at ${x},${z}`);
  for(const [x,z] of [[76,2],[63,19]])assert.ok(Math.abs(field.heightAt(x,z)-3.25)<1e-6);
  for(const centreZ of [20,39])for(let x=69;x<=78;x+=.5)for(let z=centreZ-2;z<=centreZ+2;z+=.5){
    assert.equal(sunhavenHeightSource(x,z),sunhavenArtHeightSource(x,z),'entire established dock ramp footprint');
    assert.ok(field.heightAt(x,z)>-.5,'both approaches remain dry');
  }
  for(let x=86;x<=106;x+=.5)assert.ok(field.heightAt(x,28)<-1.1,'connected water below the boardwalk basin');
});

test('the harbor reaches every inner boardwalk edge with connected shallows and bounded natural banks',()=>{
  // Every interior sample, including the formerly grassy north/west strips,
  // stays safely submerged. A shared-source test also verifies the entire cut
  // is local, never raises terrain, and preserves architecture and ramp mouths.
  for(let x=82;x<=100;x+=.25)for(let z=22.5;z<=36.5;z+=.25)assert.ok(field.heightAt(x,z)<-1.35,`exposed mound in harbor at ${x},${z}`);
  for(const [x,z] of [[81,23],[82,21.5],[90,21.5],[95,22.5],[82,37],[97,37]])assert.ok(field.heightAt(x,z)<-1.25,`water reaches boardwalk at ${x},${z}`);
  let transitions=0;
  for(let x=74;x<=113;x+=.5)for(let z=14;z<=45;z+=.5){
    const before=sunhavenArtHeightSource(x,z),after=docksCoveHeight(x,z,before),weight=docksCoveWeight(x,z);
    assert.ok(after<=before,'cove cut never raises a seabed ridge');
    if(weight===0)assert.equal(after,before);
    if(weight>0&&weight<1)transitions++;
    if(x<=78||z<=17.25)assert.equal(after,before,'building and dry approach boundary stays fixed');
  }
  assert.ok(transitions>300,'a blended shoreline surrounds the open bay');
  for(let x=81;x<=106;x+=.25)assert.ok(field.heightAt(x,28)<-1.35,'an open water path reaches the sea');
});

test('stone faces replace terrain triangles exactly, preserving raycasts and a single rendered surface',()=>{
  const world={map:MAPS.sunhaven,ground:createMapTerrain(MAPS.sunhaven)},ground=world.ground;
  const before=ground.children.reduce((count,m)=>count+m.geometry.index.count/3,0);
  const landforms=addDocksLandforms(world);assert.equal(addDocksLandforms(world),landforms);
  const after=ground.children.reduce((count,m)=>count+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
  assert.equal(after,before,'partitioning cannot add duplicate or missing triangles');
  const info=landforms.diagnostics();assert.ok(info.faces>1200&&info.faces<3500);assert.ok(info.drawCalls<=16);assert.equal(info.materialCount,1);
  ground.updateMatrixWorld(true);const ray=new THREE.Raycaster(),p=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const mesh of landforms.meshes){
    assert.equal(mesh.parent,ground);assert.ok(mesh.frustumCulled&&mesh.geometry.boundingBox&&mesh.geometry.boundingSphere);
    const geometry=mesh.geometry,position=geometry.attributes.position;
    for(const name of ['normal','color','uv','terrainMask'])assert.equal(geometry.attributes[name].count,position.count);
    for(let i=0;i<position.count;i+=3){
      a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);
      p.copy(a).multiplyScalar(.19).addScaledVector(b,.34).addScaledVector(c,.47);
      assert.ok(Math.abs(p.y-field.heightAt(p.x,p.z))<1e-5,'visible rock and authoritative heightfield agree');
      ray.set(new THREE.Vector3(p.x,p.y+1,p.z),new THREE.Vector3(0,-1,0));ray.far=2;
      const hits=ray.intersectObject(ground,true);
      assert.equal(hits.length,1,'one triangle at an interior face sample, without an overlaid finish');
      assert.ok(Math.abs(hits[0].point.y-p.y)<1e-5);
    }
  }
  const events=new Map(),resources=new Set(ground.children.map(m=>m.geometry));resources.add(landforms.meshes[0].material);
  for(const resource of resources){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}
  let texturesDisposed=0;landforms.meshes[0].material.map.addEventListener('dispose',()=>texturesDisposed++);
  ground.dispose();ground.dispose();
  for(const count of events.values())assert.equal(count,1,'ground owns new geometry and cloned material exactly once');
  assert.equal(texturesDisposed,0,'shared coastal maps remain borrowed');
});
