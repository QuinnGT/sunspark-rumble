import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World} from '../src/world.js';
import {focusSunShadow} from '../src/sun-shadows.js';
import {SURFACE_CLEARANCE} from '../src/surface-layers.js';
const w=new World(new THREE.Scene(),'sunhaven');

test('all interior floors visibly clear the terrain and keep vegetation outside',()=>{
  const ray=new THREE.Raycaster();
  for(const h of w.landmarks.filter(h=>h.id==='interior'))for(const dx of [-3,0,3])for(const dz of [-3,0,3]){
    const x=h.x+dx,z=h.z+dz;ray.set(new THREE.Vector3(x,h.y+1,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(w.ground)[0];
    // The enlarged boathouse meets its graded 3.25m entry pad at a 3.3m floor.
    // Preserve the old 14cm fixture elsewhere, and the actual structural
    // minimum for the deliberately revised foundation instead of a blanket cut.
    const minimum=h.accessId==='boathouse-terrace'?SURFACE_CLEARANCE:.14;
    assert.ok(h.y-hit.point.y>minimum,`floor clears terrain by ${minimum}m at ${x},${z}`);
    assert.equal(w.canPlant(x,z),false);assert.ok(Math.abs(w.floorAt(x,z,h.y)-h.y)<.025);
  }
});
test('boathouse door approaches stay at floor height with no ramp across either opening',()=>{
  const h=w.landmarks.find(h=>h.id==='interior'&&h.x>60);
  for(const direction of [-1,1])for(const dx of [-.75,0,.75])for(let d=3;d<=6;d+=.25){
    const x=h.x+dx,z=h.z+direction*d,y=w.floorAt(x,z,h.y);
    assert.ok(y<=h.y+.1,`obstruction at doorway ${x},${z}`);assert.ok(w.canStand(x,y,z));
  }
});
test('permanent roof ramps have a continuous grounded underside, not a floating horizontal base',()=>{
  const ray=new THREE.Raycaster();
  for(const r of w.ramps.filter(r=>r.roofAccess))for(const local of [-r.length/2+.2,0,r.length/2-.2]){
    const x=r.x+Math.sin(r.yaw)*local,z=r.z+Math.cos(r.yaw)*local,ground=w.heightAt(x,z);
    ray.set(new THREE.Vector3(x,ground-5,z),new THREE.Vector3(0,1,0));
    const hit=ray.intersectObject(r.mesh)[0];assert.ok(hit&&hit.point.y<=ground+.025,`ramp base rests on terrain at ${x},${z}`);
  }
  // The orchard is the originally reported floating-ramp location.
  const r=w.ramps.find(r=>r.x< -60&&r.z===-32);assert.ok(r);
  const x=r.x+Math.sin(r.yaw)*(-r.length/2+.2),z=r.z;
  ray.set(new THREE.Vector3(x,w.heightAt(x,z)-5,z),new THREE.Vector3(0,1,0));
  assert.ok(ray.intersectObject(r.mesh)[0].point.y<=w.heightAt(x,z)+.025);
});
test('quarry elevation is a continuous rounded terrain hill with a walkable crest',()=>{
  assert.ok(w.heightAt(-53,61)>6.5,'crest is part of terrain, not a box on flat ground');
  const samples=[];for(let x=-72;x<=-32;x+=.25)samples.push(w.heightAt(x,67));
  assert.ok(samples.every((y,i)=>!i||Math.abs(y-samples[i-1])<.28),'no vertical block edges');
  assert.ok(new Set(samples.map(y=>y.toFixed(2))).size>35,'curved slopes between levels');
  assert.ok(w.canStand(-53,w.heightAt(-53,61),61));
});
test('rounded quarry terrain remains below every access-ramp deck',()=>{
  const ray=new THREE.Raycaster();
  for(const r of w.ramps.filter(r=>r.x< -25&&r.z>40))for(let local=-r.length/2;local<=r.length/2;local+=.2)for(const side of [-r.width/2,0,r.width/2]){
    const x=r.x+Math.cos(r.yaw)*side+Math.sin(r.yaw)*local,z=r.z-Math.sin(r.yaw)*side+Math.cos(r.yaw)*local,deck=r.y+(.5-local/r.length)*r.rise;
    ray.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));const ground=ray.intersectObject(w.ground)[0].point.y;
    assert.ok(deck-ground>.045,'visible triangles cannot cut through the timber deck');
  }
});
test('shadow focus moves fixed world points only by whole texels, including during jumps',()=>{
  const sun=new THREE.DirectionalLight(),point=new THREE.Vector3(5,3,-7);sun.shadow.camera.near=1;sun.shadow.camera.far=190;
  for(const size of [1536,2048]){
    let previous;
    for(let i=0;i<40;i++){
      focusSunShadow(sun,new THREE.Vector3(i*.018,2+Math.sin(i*.09),i*.027),48,size);
      sun.updateMatrixWorld(true);sun.target.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
      const uv=point.clone().applyMatrix4(sun.shadow.matrix).multiplyScalar(size);
      if(previous)for(const axis of ['x','y'])assert.ok(Math.abs((uv[axis]-previous[axis])-Math.round(uv[axis]-previous[axis]))<1e-7,'no fractional-texel swimming');
      previous=uv;
    }
  }
});
