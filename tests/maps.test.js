import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World,heightAt} from '../src/world.js';
import {MAPS,stormState} from '../src/maps.js';
import {Navigation} from '../src/navigation.js';
import {spawnLayout,supplySites} from '../src/map-match.js';
import {computeBuildPlacement} from '../src/building.js';
const world=new World(new THREE.Scene(),'sunhaven'),nav=new Navigation(world),ray=new THREE.Raycaster();
function blockedSight(a,b){
  const from=new THREE.Vector3(a.x,a.y+1.5,a.z),delta=new THREE.Vector3(b.x,b.y+1.5,b.z).sub(from),length=delta.length();delta.normalize();ray.set(from,delta);ray.far=length;
  return !!ray.intersectObjects(world.solids.filter(m=>m!==world.ground),false)[0]||Array.from({length:Math.floor(length)},(_,i)=>i).some(i=>from.y+delta.y*i<world.heightAt(from.x+delta.x*i,from.z+delta.z*i));
}
function routeWorks(a,b){
  const from={x:a[0],z:a[1],y:world.floorAt(a[0],a[1])},to={x:b[0],z:b[1],y:world.floorAt(b[0],b[1])},route=nav.route(from,to);
  assert.ok(route.length,`No route ${a} → ${b}`);let previous=from;
  for(const p of route){assert.ok(world.canWalk(previous,p),`Unwalkable ${JSON.stringify(previous)} → ${JSON.stringify(p)}`);previous=p;}
}
test('the expanded map has independent terrain, bounds, vegetation and water coverage',()=>{
  const compact=new World(new THREE.Scene());assert.equal(compact.map.radius,67);assert.equal(world.map.radius,120);assert.equal(compact.heightAt(0,42),heightAt(0,42));
  assert.equal(world.water.material.uniforms.waterExtent.value,280);assert.equal(world.water.material.uniforms.depthMap.value.image.width,512);
  assert.ok(world.foliage.trees.some(t=>Math.hypot(t.x,t.z)>95));assert.ok(world.meadowGrass.batches.some(b=>b.userData.x>90));
  assert.ok(world.heightAt(98,26)<-1.1);assert.ok(!world.canStand(98,world.heightAt(98,26),26),'deep cove is visibly water, not a walking route');
  const actor={pos:new THREE.Vector3(119,20,0)};world.move(actor,5,0);assert.equal(actor.pos.x,120);
});
test('all expansion storm circles stay nested and end at reachable dry finales',()=>{
  for(let seed=0;seed<5;seed++){
    let previous=stormState(MAPS.sunhaven,0,seed);
    for(let t=1;t<=285;t++){const next=stormState(MAPS.sunhaven,t,seed);assert.ok(Math.hypot(next.x-previous.x,next.z-previous.z)+next.radius<=previous.radius+1e-8);previous=next;}
    assert.equal(previous.radius,0);assert.ok(world.canStand(previous.x,world.heightAt(previous.x,previous.z),previous.z));routeWorks([0,4],[previous.x,previous.z]);
  }
});
test('seeded expansion spawns are clear, hidden and separated; nearby supplies are reachable',()=>{
  for(let seed=1;seed<=20;seed++){
    const layout=spawnLayout(world,seed,blockedSight);assert.equal(layout.bots.length,10);assert.deepEqual(layout,spawnLayout(world,seed,blockedSight));
    for(const p of layout.bots){assert.ok(world.canStand(p.x,p.y,p.z,.75));assert.ok(Math.hypot(p.x-layout.player.x,p.z-layout.player.z)>=35);assert.ok(blockedSight(layout.player,p));}
    const supplies=supplySites(world,seed,layout.player);assert.ok(supplies.length>=40);
    for(const type of ['ammo','shield','wood']){
      const near=supplies.find(p=>p.type===type&&Math.hypot(p.x-layout.player.x,p.z-layout.player.z)<8);assert.ok(near);assert.ok(nav.route(layout.player,near).length);
    }
  }
});
test('both directions through every new interior and each main district route are walkable',()=>{
  for(const p of world.landmarks.filter(p=>p.id==='interior')){routeWorks([p.x,p.z+5],[p.x,p.z-5]);routeWorks([p.x,p.z-5],[p.x,p.z+5]);}
  for(const start of MAPS.sunhaven.spawns.slice(0,4)){routeWorks(start,[0,4]);routeWorks([0,4],start);}
});
test('every expansion ramp has a usable ground or platform entrance and exit',()=>{
  for(const ramp of world.ramps){
    const point=local=>{const x=ramp.x+Math.sin(ramp.yaw)*local,z=ramp.z+Math.cos(ramp.yaw)*local;return {x,z,y:world.floorAt(x,z,ramp.y+ramp.rise+.1)};};
    const from=point(ramp.length/2+.7),to=point(-ramp.length/2-.6),route=nav.route(from,to);
    assert.ok(route.length,`ramp ${ramp.x},${ramp.z} route`);let previous=from;
    for(const p of route){assert.ok(world.canWalk(previous,p),`ramp ${ramp.x},${ramp.z} walk`);previous=p;}
    assert.ok(world.canWalk(from,point(-ramp.length/2+.15)),`ramp ${ramp.x},${ramp.z} direct climb`);
  }
});
test('expanded docks have two permanent land exits and a continuous outer boardwalk',()=>{
  for(const [a,b] of [[[70,20],[98,20]],[[70,39],[98,39]],[[98,20],[98,39]]]){routeWorks(a,b);routeWorks(b,a);}
});
test('building past the original boundary works and updates only nearby navigation cells',()=>{
  const p=computeBuildPlacement(world,{kind:'wall',position:new THREE.Vector3(-78,world.heightAt(-78,-12),-12),yaw:0,wood:80,actors:[]});assert.ok(p.valid,p.reason);
  const center=nav.nodes.find(p=>Math.hypot(p.x,p.z)>70&&Math.hypot(p.x,p.z)<100&&world.canStand(p.x,p.y,p.z,3));assert.ok(center);
  const before=nav.blocked.slice(),m=world.addBox(4,3,.18,0xe1b25f,center.x,center.y+1.5,center.z),o=world.obstacles.find(o=>o.mesh===m);o.kind='build';nav.refresh();
  assert.ok(nav.lastDirtyCount<100);assert.notDeepEqual(nav.blocked,before);world.removeBuild(o);nav.refresh();assert.deepEqual(nav.blocked,before);
});

test('walkable ground waypoints around quarry ramps use their actual supported height',()=>{
  let count=0;
  for(let id=0;id<nav.blocked.length;id++){
    const p=nav.nodes[id];if(nav.blocked[id]||p.x< -73||p.x> -60||p.z<61||p.z>75)continue;
    count++;assert.ok(Math.abs(p.y-world.floorAt(p.x,p.z,p.y))<.01);assert.ok(world.canStand(p.x,p.y,p.z,.7));
  }
  assert.ok(count>=10,'retain navigable approaches around the ramp');
});
