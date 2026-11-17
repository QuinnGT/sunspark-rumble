import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { registerSurfaceLayer, SURFACE_CLEARANCE } from '../src/surface-layers.js';
import { batchDecorations } from '../src/materials.js';
import { auditSurfaceLayers, auditWorldSurfaces } from '../scripts/surface-layer-audit.mjs';

function fixture(gap, { hidden = false, merged = false, instanced = false } = {}) {
  const root = new THREE.Group(), group = new THREE.Group(); root.add(group);
  group.position.set(12, 3, -9); group.rotation.set(.2, .6, .15);
  const material = new THREE.MeshBasicMaterial();
  const geometry = new THREE.PlaneGeometry(2, 2); geometry.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(geometry, material); group.add(top);
  if (instanced) {
    const copies = new THREE.InstancedMesh(geometry, material, 2);
    copies.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, -gap, 0));
    copies.setMatrixAt(1, new THREE.Matrix4().makeTranslation(5, -gap, 0));
    group.add(copies);
  } else {
    const backing = new THREE.Mesh(geometry.clone(), material); backing.position.y = -gap; backing.visible = !hidden; group.add(backing);
  }
  registerSurfaceLayer(group, 'fixture finish', [[.17, 0, -.31], [-.37, 0, -.22]]);
  if (merged) batchDecorations(root);
  return root;
}

test('surface audit rejects coincident and almost-coincident finishes, including merged and instanced geometry', () => {
  for (const gap of [0, .001]) for (const options of [{}, { merged: true }, { instanced: true }]) {
    const result = auditSurfaceLayers(fixture(gap, options));
    assert.equal(result.violations.length, 1); assert.equal(result.violations[0].reason, 'overlapping surface layers');
  }
});

test('surface audit allows real separation and invisible collision, but catches a missing finish', () => {
  for (const options of [{}, { merged: true }, { instanced: true }]) assert.deepEqual(auditSurfaceLayers(fixture(SURFACE_CLEARANCE, options)).violations, []);
  assert.deepEqual(auditSurfaceLayers(fixture(0, { hidden: true })).violations, []);
  const root = fixture(.03); root.children[0].children[0].visible = false;
  assert.equal(auditSurfaceLayers(root).violations[0].reason, 'finish missing at the declared surface');
});

test('surface audit catches sloping terrain piercing a finish or approaching within minimum clearance',()=>{
  const root=new THREE.Group(),plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());
  plane.rotation.x=-Math.PI/2;root.add(plane);registerSurfaceLayer(root,'floor',[[.3,0,.2]]);
  for(const height of [.5,.001,-.001])assert.equal(auditSurfaceLayers(root,{groundHeightAt:()=>height}).violations[0].reason,'terrain intersects finish clearance');
  assert.deepEqual(auditSurfaceLayers(root,{groundHeightAt:()=>-SURFACE_CLEARANCE}).violations,[]);
});

test('all Sunhaven roof, wall, shed-floor and dock finishes clear their actual rendered backing after batching', () => {
  const world = new World(new THREE.Scene(), 'sunhaven'), result = auditWorldSurfaces(world);
  const boathouse=world.coastalAssets.find(a=>a.kind==='boathouse');
  assert.equal(world.scene.userData.joinerySurfaces.length,81,'all nine doorways retain three exposed faces on each post and header');
  assert.equal(result.layers, 11+boathouse.surfaceLayers.length+81, 'eleven retained assemblies plus every boathouse finish and doorway face');
  assert.ok(boathouse.surfaceLayers.length>=9&&result.samples>2900, 'inspect all boards, pitched roof slopes and porch canopy');
  assert.deepEqual(result.violations, []);
  const ray = new THREE.Raycaster();
  for (const layer of world.scene.userData.surfaceLayers) {
    if(layer.kind==='joinery')continue; // Frame finishes are checked separately from walking surfaces and wall cover.
    const [x,y,z] = layer.points[0];
    if(layer.normal[1]>.01){
      assert.ok(Math.abs(world.floorAt(x,z,y)-y)<1e-5, `${layer.name}: walking surface moved`);
      ray.set(new THREE.Vector3(x,y+.06,z),new THREE.Vector3(0,-1,0));
      assert.ok(Math.abs(ray.intersectObjects(world.solids,true)[0].point.y-y)<1e-5, `${layer.name}: shot surface moved`);
    }else{
      // Vertical siding is cover, not a walking surface. Its visible face must
      // still coincide with physical cover along the declared wall normal.
      const point=new THREE.Vector3(x,y,z),normal=new THREE.Vector3(...layer.normal);
      ray.set(point.clone().addScaledVector(normal,.06),normal.negate());
      const owner=world.solids.find(mesh=>mesh.uuid===layer.coverMeshUuid);
      assert.ok(owner, `${layer.name}: missing explicit wall cover owner`);
      const hit=ray.intersectObject(owner,true)[0],first=ray.intersectObjects(world.solids,true)[0];
      assert.ok(hit&&hit.point.distanceTo(point)<1e-5, `${layer.name}: wall cover moved`);
      assert.ok(first&&first.distance<=hit.distance+1e-5, `${layer.name}: wall cover gap`);
    }
  }
  // Recessing wall ends must not carry a see-through slit above the lintel.
  // Check both wall sides, including board seams, at the old opening boundary.
  const doors=world.coastalAssets.filter(a=>a.kind==='coastal-house').flatMap(a=>[-1,1].map(side=>({x:a.x,z:a.z+side*a.depth/2,y:a.y,width:3,height:2.9})));
  doors.push({x:76,z:5,y:3.3,width:4.8,height:4.5},{x:76,z:15,y:3.3,width:4.8,height:4.5},{x:67.5,z:15,y:3.3,width:2.4,height:2.85});
  const visible=[];world.scene.traverseVisible(o=>{if(o.isMesh)visible.push(o);});
  ray.near=0;ray.far=.15;
  for(const door of doors)for(const sign of [-1,1])for(const side of [-1,1])for(const dy of [.15,.35,.55]){
    ray.set(new THREE.Vector3(door.x+sign*(door.width/2+.015),door.y+door.height+dy,door.z+side*.23),new THREE.Vector3(0,0,-side));
    assert.ok(ray.intersectObjects(visible,false).length,`open slit above frame at ${door.x},${door.z} side ${sign}/${side}, height ${dy}`);
  }
});
