import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {World} from '../src/world.js';
import {Movement} from '../src/movement.js';
import {RULES} from '../src/config.js';
const cases=JSON.parse(readFileSync(new URL('./rock-trapping-cases.json',import.meta.url)));
const world=new World(new THREE.Scene(),'sunhaven');
const actor=position=>({pos:new THREE.Vector3(...position),radius:RULES.playerRadius,vy:0,grounded:false});
const rockOverlap=a=>world.nearObstacles(a.pos.x,a.pos.z,a.radius).some(o=>o.shape?.blocks(a.pos.x,a.pos.z,a.radius,a.pos.y,a.height,0));

test('falling against each authored rock edge resolves the whole body at 20/60/144 Hz',()=>{
  assert.equal(cases.length,13);
  for(const hz of [20,60,144])for(const c of cases){
    const a=actor(c.drop),movement=new Movement(a,world);
    for(let frame=0;frame<hz*2;frame++){
      movement.update(1/hz,{x:0,z:0,jumpHeld:false});
      assert.equal(rockOverlap(a),false,`${c.rock} embeds while falling at ${hz} Hz: ${a.pos.toArray()}`);
    }
    assert.ok(world.canStand(a.pos.x,a.pos.y,a.pos.z),`${c.rock} lands in traversable space`);
  }
});

test('an already embedded actor recovers locally without reloading or ignoring solidity',()=>{
  for(const c of cases){
    const a=actor(c.trapped),movement=new Movement(a,world),start=a.pos.clone();
    assert.equal(rockOverlap(a),true,'captured v1.12 trap must still intersect the unchanged rock');
    movement.update(1/60,{x:0,z:0,jumpHeld:false});
    assert.equal(rockOverlap(a),false,`${c.rock} recovery`);assert.ok(world.canStand(a.pos.x,a.pos.y,a.pos.z));
    assert.ok(a.pos.distanceTo(start)<4,'recovery stays beside the formation');
    for(let i=0;i<120;i++){
      movement.update(1/120,{x:0,z:0,jumpHeld:false});
      assert.ok(world.canStand(a.pos.x,a.pos.y,a.pos.z),`${c.rock} remains walkable after settling`);
      assert.equal(rockOverlap(a),false);
    }
    const freed=a.pos.clone();movement.jump();let height=freed.y;
    for(let i=0;i<90;i++){movement.update(1/120,{x:0,z:0,jumpHeld:true});height=Math.max(height,a.pos.y);}
    assert.ok(height>freed.y+1,'jump is usable after recovery');
  }
});

test('walking and repeated jumping around overlapping rock groups never strands an actor',()=>{
  for(const c of cases){
    const a=actor(c.drop),movement=new Movement(a,world);
    for(let frame=0;frame<300;frame++){
      if(frame%65===0)movement.jump();const angle=frame*.02;
      movement.update(1/60,{x:Math.cos(angle),z:Math.sin(angle),sprint:true,jumpHeld:true});
      assert.equal(rockOverlap(a),false,`${c.rock}: ${a.pos.toArray()}`);
      if(a.pos.y<-.5)break; // Deep-water recovery belongs to the game harness.
    }
  }
});

test('grounded rock footing is stable and recovery does not move an unobstructed actor',()=>{
  for(const {mesh,obstacle}of world.approvedRocks.rocks){
    const centre=obstacle.box.getCenter(new THREE.Vector3()),y=world.floorAt(centre.x,centre.z),a=actor([centre.x,y,centre.z]),movement=new Movement(a,world);
    for(let i=0;i<60;i++)movement.update(1/120,{x:0,z:0,jumpHeld:false});
    const settled=a.pos.clone();for(let i=0;i<120;i++)movement.update(1/120,{x:0,z:0,jumpHeld:false});
    assert.ok(a.pos.distanceTo(settled)<.015,`${mesh.name} stable support`);
  }
  const a=actor([0,world.floorAt(0,0),0]),p=a.pos.clone();world.resolveRockContacts(a);assert.ok(a.pos.equals(p));
});
