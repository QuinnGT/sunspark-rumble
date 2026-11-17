// Rules and geometry regression tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyDamage, stormRadius, RULES } from '../src/config.js';
import { World, heightAt } from '../src/world.js';
import { Navigation } from '../src/navigation.js';
import { ROCK_GAPS } from './rock-cases.js';

test('shields absorb hits; storm bypasses them; health never becomes negative',()=>{
  const a={health:100,shield:25};assert.deepEqual(applyDamage(a,40),{absorbed:25,healthDamage:15,eliminated:false});assert.equal(a.health,85);a.shield=100;applyDamage(a,20,true);assert.equal(a.shield,100);assert.equal(a.health,65);assert.equal(applyDamage(a,300).eliminated,true);assert.equal(a.health,0);
});
test('storm grants a 45-second opening and closes monotonically by 4:15',()=>{
  assert.equal(stormRadius(0),65);assert.equal(stormRadius(44.9),65);let previous=65;for(let t=45;t<=300;t++){const r=stormRadius(t);assert.ok(r<=previous&&r>=0);previous=r;}assert.equal(stormRadius(255),0);assert.ok(stormRadius(180)<24);
});
const world=new World(new THREE.Scene());
test('large rocks do not intersect tree trunks or other solid scenery',()=>{
  const rocks=world.obstacles.filter(o=>o.mesh.geometry.type==='IcosahedronGeometry');
  assert.ok(rocks.length>5,'the island should retain useful rock cover');
  for(const rock of rocks){
    const bounds=new THREE.Box3().setFromObject(rock.mesh).expandByScalar(.2);
    for(const other of world.obstacles){
      if(other===rock)continue;
      // Branches can hang over a rock; the rooted trunk footprint must stay clear.
      const b=other.kind==='tree'?other.box:new THREE.Box3().setFromObject(other.mesh);
      assert.ok(!(bounds.min.x<b.max.x&&bounds.max.x>b.min.x&&bounds.min.z<b.max.z&&bounds.max.z>b.min.z),`rock at ${rock.mesh.position.toArray()} overlaps ${other.mesh.geometry.type} at ${other.mesh.getWorldPosition(new THREE.Vector3()).toArray()}`);
    }
  }
});

test('players can approach the actual rock surface inside the former inflated box',()=>{
  const rock=world.obstacles.find(o=>o.mesh.geometry.type==='IcosahedronGeometry'),bounds=new THREE.Box3().setFromObject(rock.mesh,true);
  const x=bounds.max.x+RULES.playerRadius+.08,z=(bounds.min.z+bounds.max.z)/2,y=heightAt(x,z);
  assert.ok(world.canStand(x,y,z),'clear ground beside the visible rock must be walkable');
  const actor={pos:new THREE.Vector3(x+1,y,z),radius:RULES.playerRadius};
  for(let i=0;i<10;i++){world.move(actor,-.1,0);actor.pos.y=world.floorAt(actor.pos.x,actor.pos.z,actor.pos.y);}
  assert.ok(Math.abs(actor.pos.x-x)<.03,'walking must reach the visible rock instead of its former bounding box');
});

test('real gaps between rocks allow walking and sprinting in both directions',()=>{
  const nav=new Navigation(world);
  for(const gap of ROCK_GAPS)for(const reverse of [false,true]){
    const from=new THREE.Vector3().fromArray(reverse?gap.to:gap.from),to=new THREE.Vector3().fromArray(reverse?gap.from:gap.to);
    assert.ok(world.canWalk(from,to));assert.ok(nav.route(from,to).length,'bot route must use the open gap');
    for(const speed of [RULES.walk,RULES.sprint])for(const hz of [20,60,144]){
      const actor={pos:from.clone(),radius:RULES.playerRadius},direction=to.clone().sub(from).setY(0).normalize();
      for(let i=0;i<hz*2&&Math.hypot(to.x-actor.pos.x,to.z-actor.pos.z)>.01;i++){
        const travel=Math.min(speed/hz,Math.hypot(to.x-actor.pos.x,to.z-actor.pos.z));world.move(actor,direction.x*travel,direction.z*travel);actor.pos.y=world.floorAt(actor.pos.x,actor.pos.z,actor.pos.y);
      }
      assert.ok(actor.pos.distanceTo(to)<.05,`blocked gap at ${speed} units/s, ${hz}Hz: ${actor.pos.toArray()}`);
    }
  }
});

test('rock footing follows triangle heights and empty corners have no invisible top or ceiling',()=>{
  for(const rock of world.obstacles.filter(o=>o.shape)){
    const b=rock.box,ray=new THREE.Raycaster();
    for(const fx of [.1,.5,.9])for(const fz of [.1,.5,.9]){
      const x=THREE.MathUtils.lerp(b.min.x,b.max.x,fx),z=THREE.MathUtils.lerp(b.min.z,b.max.z,fz);
      ray.set(new THREE.Vector3(x,b.max.y+1,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(rock.mesh,false)[0],top=rock.shape.surfaceAt(x,z);
      if(hit)assert.ok(Math.abs(top-hit.point.y)<1e-6,'support must match rendered triangles');else assert.equal(top,-Infinity);
    }
  }
  const rock=world.obstacles.find(o=>o.shape),x=rock.box.min.x+.1,z=rock.box.min.z+.1;
  assert.equal(rock.shape.surfaceAt(x,z),-Infinity);assert.equal(world.floorAt(x,z),heightAt(x,z));assert.equal(world.ceilingAt(x,z,rock.box.min.y-.1),Infinity);
});

test('rocks remain solid at their center and still block shots after visual batching',()=>{
  for(const rock of world.obstacles.filter(o=>o.kind==='rock')){
    const center=rock.box.getCenter(new THREE.Vector3()),floor=heightAt(center.x,center.z);
    assert.equal(world.canStand(center.x,floor,center.z),false,'no entering the visible rock interior');
    const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(8,0,0)),new THREE.Vector3(-1,0,0),0,9);
    assert.ok(ray.intersectObjects(world.solids,false).some(h=>h.object===rock.mesh),'the actual rock must still provide shot cover');
  }
});
test('all rooftop crates stop walking, support standing on top, and block shots',()=>{
  for(const [x,z,y] of [[-21,-12,5.5],[18,-19,5.5],[26,21,5],[-31,23,3]]){
    const roof=y+4.25,top=roof+.65;
    for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const a={pos:new THREE.Vector3(x+dx*2,roof,z+dz*2),radius:RULES.playerRadius};
      for(let i=0;i<30;i++)world.move(a,-dx*.1,-dz*.1);
      assert.ok(Math.hypot(a.pos.x-x,a.pos.z-z)>=1,'crate sides must keep feet outside');
      const ray=new THREE.Raycaster(new THREE.Vector3(x+dx*2,roof+.3,z+dz*2),new THREE.Vector3(-dx,0,-dz),0,2);
      assert.ok(ray.intersectObjects(world.solids,false).length,'the visible crate must stop shots');
    }
    assert.equal(world.canStand(x,roof,z),false,'bots cannot plan through the crate');
    assert.ok(Math.abs(world.floorAt(x,z,top)-top)<.01,'landing on a crate must put feet on its lid');
  }
});

test('rooftop crate bands and wooden lids have separated rendered surfaces after batching',()=>{
  const visible=object=>{for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};
  world.scene.updateMatrixWorld(true);
  const meshes=[];world.scene.traverse(o=>{if(o.isMesh&&visible(o))meshes.push(o);});
  for(const crate of world.obstacles.filter(o=>o.mesh.userData.prop==='roof-crate')){
    const center=crate.box.getCenter(new THREE.Vector3());
    for(const dx of [-.38,.38])for(const dz of [-.35,.17,.4]){
      const ray=new THREE.Raycaster(new THREE.Vector3(center.x+dx,crate.box.max.y+.15,center.z+dz),new THREE.Vector3(0,-1,0),0,.3);
      const hits=ray.intersectObjects(meshes,false);
      assert.ok(hits.length>=2,'probe must include both the decorative band and the wooden body');
      assert.ok(hits[1].distance-hits[0].distance>.005,`coincident crate lid/band at ${center.toArray()}: ${hits.slice(0,2).map(h=>h.distance)}`);
    }
  }
});
test('solid cover stops movement while diagonal input slides along it',()=>{
  const p={pos:new THREE.Vector3(-8,heightAt(-8,28),28),radius:.48};for(let i=0;i<40;i++)world.move(p,0,-.1);assert.ok(p.pos.z>=26.45);const x=p.pos.x;for(let i=0;i<15;i++)world.move(p,.1,-.1);assert.ok(p.pos.x>x+.5);
});
test('placed ramps support a continuous climb in all four directions and cleanly reset',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const p={x:0,z:40,y:heightAt(0,40)},r=world.addRamp(p,yaw);let feet=p.y;
    for(let z=2.45;z>=-2.5;z-=.1){const x=p.x+Math.sin(yaw)*z,wz=p.z+Math.cos(yaw)*z;feet=world.floorAt(x,wz,feet);}
    assert.ok(feet>=p.y+2.85,`ramp at ${yaw} climbed to ${feet-p.y}`);world.removeBuild(r);assert.ok(!world.solids.includes(r.mesh));
  }
});
test('ramp sides are solid and bot paths avoid the solid volume',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const ramp=world.addRamp({x:0,z:40,y:heightAt(0,40)},yaw),c=Math.cos(yaw),s=Math.sin(yaw);
    const actor={pos:new THREE.Vector3(c*3.5,heightAt(c*3.5,40-s*3.5),40-s*3.5),radius:.48};
    for(let i=0;i<30;i++)world.move(actor,-c*.1,s*.1);
    assert.ok(world.rampLocal(ramp,actor.pos.x,actor.pos.z).x>2.4,'side entry must stop outside the ramp');
    const nav=new Navigation(world);assert.equal(nav.free(0,40),false,'bots should route around the solid middle');world.removeBuild(ramp);
  }
});
test('navigation routes around cabins without cutting diagonally through blocked cells',()=>{
  const nav=new Navigation(world),path=nav.path({x:-19,z:4},{x:-19,z:-25});assert.ok(path.length>5);for(const p of path)assert.ok(nav.free(p.x,p.z));assert.ok(path.some(p=>Math.abs(p.x+19)>4));
});
test('every arena position has a finite floor and the beach stays within playable bounds',()=>{
  for(let x=-RULES.radius;x<=RULES.radius;x+=2.5)for(let z=-RULES.radius;z<=RULES.radius;z+=2.5)assert.ok(Number.isFinite(heightAt(x,z)));assert.ok(heightAt(0,-28)>heightAt(0,42)+5);
});
