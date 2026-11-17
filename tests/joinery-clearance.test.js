import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { coastalSolidBox } from '../src/coastal-kit.js';
import { registerJoineryFaces } from '../src/surface-layers.js';
import { auditSurfaceLayers } from '../scripts/surface-layer-audit.mjs';
import { batchDecorations } from '../src/materials.js';

function frame({recessed=true,butt=true,transformed=false}={}){
  const root=new THREE.Group(),parent=new THREE.Group();root.add(parent);
  if(transformed){parent.position.set(17,4,-9);parent.rotation.set(.13,.52,-.21);}
  const material=new THREE.MeshBasicMaterial();
  const box=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;};
  const h=butt?2.8:3,post=box(.3,h,.6,0,h/2,0);
  box(2,2.8,.32,-.85-(recessed?.03:0),1.4,0);
  const header=box(3,.3,.6,1.35,2.95,0);
  registerJoineryFaces(parent,post,'Post',['+x','+z','-z']);
  registerJoineryFaces(parent,header,'Header',['-y','+z','-z']);
  batchDecorations(parent);return root;
}

test('joinery audit catches narrow wall-end overlap and crossing post/header faces after transformed batching',()=>{
  for(const transformed of [false,true]){
    const reveal=auditSurfaceLayers(frame({recessed:false,transformed}));
    assert.ok(reveal.violations.some(v=>v.surface==='Post +x'&&v.reason==='overlapping surface layers'));
    const joint=auditSurfaceLayers(frame({butt:false,transformed}));
    assert.ok(joint.violations.some(v=>v.surface==='Post +z'&&v.reason==='overlapping surface layers'));
    assert.deepEqual(auditSurfaceLayers(frame({transformed})).violations,[]);
  }
});

test('recessed joinery backing keeps exact collision and cannot enter solid visual batches',()=>{
  const w=Object.assign(Object.create(World.prototype),{scene:new THREE.Scene(),obstacles:[],solids:[],navVersion:0});
  const core=coastalSolidBox(w,2,3,.32,new THREE.MeshBasicMaterial(),0,1.5,0,{bevel:0,renderInset:{left:.03,bottom:.03}});
  assert.equal(core.visible,false);assert.equal(core.userData.instancedVisual,true);
  assert.deepEqual(w.obstacles[0].box.min.toArray(),[-1,0,-.16]);
  assert.deepEqual(w.obstacles[0].box.max.toArray(),[1,3,.16]);
  w.scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(-2,1.5,0),new THREE.Vector3(1,0,0));
  assert.equal(ray.intersectObject(core)[0].point.x,-1);
  const visible=w.scene.children.filter(o=>o.visible);
  assert.ok(Math.abs(ray.intersectObjects(visible)[0].point.x+.97)<1e-6);
});
