import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Triangle} from 'three';
import {Capsule} from 'three/addons/math/Capsule.js';
import {capsuleTriangleContact} from '../src/capsule-contact.js';
import {seeded} from '../src/config.js';
const result=()=>({normal:new Vector3(),depth:0});

test('capsule distance gives exact floor and wall separation, without contacts outside reach',()=>{
  const floor=new Triangle(new Vector3(-3,0,-3),new Vector3(0,0,3),new Vector3(3,0,-3));
  const body=new Capsule(new Vector3(0,.4,0),new Vector3(0,1.8,0),.5),hit=capsuleTriangleContact(body,floor,result());
  assert.ok(hit);assert.ok(Math.abs(hit.depth-.1)<1e-9);assert.ok(hit.normal.distanceTo(new Vector3(0,1,0))<1e-9);
  body.translate(new Vector3(0,.2,0));assert.equal(capsuleTriangleContact(body,floor,result()),false);
  const wall=new Triangle(new Vector3(0,-3,-3),new Vector3(0,3,-3),new Vector3(0,0,3));
  body.start.set(.4,0,0);body.end.set(.4,1,0);const side=capsuleTriangleContact(body,wall,result());
  assert.ok(side);assert.ok(Math.abs(side.depth-.1)<1e-9);assert.ok(side.normal.distanceTo(new Vector3(1,0,0))<1e-9);
});

test('a longer body cannot lose an oblique face or edge contact reported for its step capsule',()=>{
  const random=seeded(52933),full=new Capsule(new Vector3(0,.48,0),new Vector3(0,1.77,0),.48),step=full.clone();step.start.y+=.55;
  let contacts=0;
  for(let i=0;i<2000;i++){
    const point=()=>new Vector3(random()*2-1,random()*3,random()*2-1),triangle=new Triangle(point(),point(),point());
    if(capsuleTriangleContact(step,triangle,result())){contacts++;assert.ok(capsuleTriangleContact(full,triangle,result()),'full capsule contains the complete step capsule');}
  }
  assert.ok(contacts>500,'exercise faces and edges throughout the body height');
});
