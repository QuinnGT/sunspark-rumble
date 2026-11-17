import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World} from '../src/world.js';
import {prepareAuthoredModels} from '../src/authored-models.js';
import {NATURAL_DOCKS_SITES} from '../src/natural-docks-trees.js';

test('docks restore the original woodland trees with grounded trunks clear of the new rocks',()=>{
  const world=new World(new THREE.Scene(),'sunhaven');
  const trees=world.foliage.trees.filter(t=>t.x>=55&&t.x<=112&&t.z>=-20&&t.z<=70);
  assert.equal(trees.length,7);assert.equal(world.docksTrees.style,'original island woodland');
  assert.equal(world.docksOaks,undefined);assert.equal(world.obstacles.filter(o=>o.kind==='docks-oak').length,0);
  for(const site of NATURAL_DOCKS_SITES)assert.ok(trees.some(t=>t.x===site.x&&t.z===site.z));
  for(const t of trees){
    assert.equal(t.y,world.heightAt(t.x,t.z));
    assert.ok(world.obstacles.some(o=>o.kind==='tree'&&Math.hypot(o.mesh.matrix.elements[12]-t.x,o.mesh.matrix.elements[14]-t.z)<.001));
    for(const r of world.approvedRocks.rocks)assert.equal(r.obstacle.shape.blocks(t.x,t.z,.5*t.scale,t.y,3.4*t.scale,0),false,'trunk is clear of the rock body');
  }
  const before=world.obstacles.map(o=>o.box.clone());world.foliage.update(1,{position:new THREE.Vector3(500,50,500)});
  world.obstacles.forEach((o,i)=>assert.ok(o.box.equals(before[i]),'foliage LOD preserves collision'));
});

test('imported rock instances share geometry and dispose their resources once',async()=>{
  const world=new World(new THREE.Scene(),'sunhaven');await prepareAuthoredModels(world);
  const meshes=world.approvedRocks.rocks.map(r=>r.mesh),geometries=new Set(meshes.map(m=>m.geometry)),events=new Map();
  assert.equal(geometries.size,3);
  for(const g of geometries){events.set(g,0);g.addEventListener('dispose',()=>events.set(g,events.get(g)+1));}
  world.approvedRocks.dispose();world.approvedRocks.dispose();assert.ok([...events.values()].every(n=>n===1));
});
test('approved rock collision follows visible glTF faces and foundations stay embedded',async()=>{
  const world=new World(new THREE.Scene(),'sunhaven');await prepareAuthoredModels(world);world.scene.updateMatrixWorld(true);
  const rocks=world.approvedRocks.rocks,ray=new THREE.Raycaster();assert.equal(rocks.length,13);let exposed=0;
  for(const {mesh,obstacle,base}of rocks){
    const box=new THREE.Box3().setFromObject(mesh);assert.ok(box.min.y<base,'closed rock base is buried');
    let samples=0;
    for(let x=box.min.x+.3;x<box.max.x;x+=.7)for(let z=box.min.z+.3;z<box.max.z;z+=.7){
      ray.set(new THREE.Vector3(x,box.max.y+1,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];if(!hit)continue;
      assert.ok(Math.abs(hit.point.y-obstacle.shape.surfaceAt(x,z))<1e-5,'walk/shot surface agrees with the imported visual');samples++;
      if(hit.point.y>world.heightAt(x,z)+.2)exposed++;
    }
    assert.ok(samples>10);assert.ok(world.solids.includes(mesh));
    assert.equal(mesh.userData.authoredGLTF,true);
  }
  assert.ok(exposed>150,'formations have visible surfaces above the terrain');
  // Both established boardwalk approaches remain clear of new rock bounds.
  for(const z of [20,39])for(let x=69;x<=103;x+=.5)for(const {obstacle}of rocks)assert.equal(obstacle.shape.blocks(x,z,.5,world.floorAt(x,z,5)),false);
});

