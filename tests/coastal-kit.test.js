import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { batchDecorations } from '../src/materials.js';
import { coastalBoxGeometry,boatHullGeometry,coastalPedimentGeometry,disposeCoastalGeometry } from '../src/coastal-geometry.js';
import { coastalMaterial } from '../src/coastal-materials.js';
import { createCoastalDock,createCoastalCrate,decorateCoastalHouse } from '../src/coastal-kit.js';
import { ResourceScope,captureSceneResources } from '../src/resource-scope.js';

function simpleWorld(){
  const world=Object.create(World.prototype);
  return Object.assign(world,{scene:new THREE.Scene(),map:{id:'sunhaven',radius:120},heightAt:()=>-2,obstacles:[],solids:[],ramps:[],navVersion:0});
}

test('timber face UV spans equal physical metres with grain along the authored long axis',()=>{
  for(const grain of ['x','y','z']){
    const dimensions={x:4,y:.4,z:1.6},g=coastalBoxGeometry(dimensions.x,dimensions.y,dimensions.z,{grain,bevel:0});
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    assert.ok(g.index);assert.equal(g.userData.uvUnits,'metres');assert.equal(g.attributes.color.count,p.count);
    for(const face of ['x','y','z'])if(face!==grain){
      const a=['x','y','z'].indexOf(face),values=[];
      for(let i=0;i<p.count;i++)if(n.getComponent(i,a)>.99)values.push(uv.getX(i));
      assert.ok(Math.abs(Math.max(...values)-Math.min(...values)-dimensions[grain])<1e-6,`${grain} grain on ${face} face`);
    }
  }
  assert.throws(()=>coastalBoxGeometry(0,1,1),/positive/);
});

test('dock boards, seams and shot slab agree with the continuous gameplay deck',()=>{
  const w=simpleWorld(),deck=3.3,core=createCoastalDock(w,0,0,12,5,deck);w.scene.updateMatrixWorld(true);
  const boards=[];w.scene.traverse(o=>{if(o.userData.coastalBoard)boards.push(o);});assert.ok(boards.length>=50);
  const ray=new THREE.Raycaster();
  for(const board of boards){
    ray.set(new THREE.Vector3(board.position.x,deck+1,board.position.z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(board)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-deck)<1e-6);
    assert.ok(Math.abs(w.floorAt(board.position.x,board.position.z,deck)-deck)<1e-6);
  }
  ray.set(new THREE.Vector3(0,deck+1,0),new THREE.Vector3(0,-1,0));
  assert.ok(Math.abs(ray.intersectObject(core)[0].point.y-deck)<=.007,'hidden shot slab differs by only seam depth');
  assert.ok(w.obstacles.filter(o=>o.kind==='dock-piling').every(o=>o.box.max.z< -2.5||o.box.min.z>2.5),'stout posts preserve cargo bypass width');
  for(let x=-5.5;x<5.6;x+=.5)assert.ok(w.canStand(x,deck,0,.7));
});

test('open boat hull has a real recessed interior and outward-facing waterline walls',()=>{
  const outside=new THREE.Mesh(boatHullGeometry(),new THREE.MeshBasicMaterial()),inside=new THREE.Mesh(boatHullGeometry(2.05,4.8,'inner'),new THREE.MeshBasicMaterial());
  outside.updateMatrixWorld();inside.updateMatrixWorld();const ray=new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0));
  assert.equal(ray.intersectObject(outside).length,0,'hull does not cap its opening');
  const floor=ray.intersectObject(inside)[0];assert.ok(floor);assert.ok(Math.abs(floor.point.y-.13)<1e-6);assert.ok(floor.face.normal.y>.99);
  ray.set(new THREE.Vector3(3,.45,0),new THREE.Vector3(-1,0,0));const wall=ray.intersectObject(outside)[0];assert.ok(wall);assert.ok(wall.point.x>.8);assert.ok(wall.face.normal.x>.5);
});

test('boathouse pitched entrance canopy uses its visible triangles for support and shot cover',()=>{
  const w=simpleWorld();decorateCoastalHouse(w,{x:0,z:0,y:1.72,width:8,color:0x549eaa,boathouse:true});w.scene.updateMatrixWorld(true);
  const canopy=w.obstacles.find(o=>o.kind==='roof-canopy');assert.ok(canopy?.shape);
  const ray=new THREE.Raycaster();
  for(const x of [-3,-1,0,1,3]){
    ray.set(new THREE.Vector3(x,10,5.16),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(canopy.mesh)[0];assert.ok(hit);
    assert.ok(Math.abs(canopy.shape.surfaceAt(x,5.16)-hit.point.y)<1e-6);
  }
  assert.ok(canopy.box.max.y>6.4,'entrance has a decisive taller gable silhouette');
  assert.ok(canopy.box.min.z>=4.25,'tall canopy sits beyond the main fighting platform');
  assert.ok(w.canStand(0,5.62,0),'flat roof center stays usable');
  assert.ok(canopy.box.min.y>1.72+3,'clear headroom through the broad entrance');
  const geometric=coastalPedimentGeometry(8.6,1.3,.72);assert.ok(geometric.index&&geometric.attributes.color);
  const uv=geometric.attributes.uv,indices=geometric.index;
  for(let i=0;i<indices.count;i+=3){
    const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2),area=(uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a));
    assert.ok(Math.abs(area)>.0001,'all canopy faces have a usable normal-map UV tangent frame');
  }
});

test('crate has matching body cover and shared indexed hardware that survives static batching',()=>{
  const w=simpleWorld(),crate=createCoastalCrate(w,0,0,2.2,1),obstacle=w.obstacles.find(o=>o.mesh===crate);
  assert.equal(obstacle.box.max.y,2.65);assert.equal(obstacle.box.min.x,-1.1);assert.ok(!w.canStand(0,1,0));
  const geometries=new Set();w.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
  assert.ok(geometries.size<30,'hardware shares geometries');
  const before=w.scene.children.length,result=batchDecorations(w.scene,new Set(w.solids));assert.ok(result.instancedMeshes>0);assert.ok(w.scene.children.length<before/2);
  for(const child of w.scene.children)if(child.geometry){assert.ok(child.geometry.index);assert.ok(child.geometry.attributes.color);}
});

test('coastal geometry cache releases only after both cache and live scene owners finish',()=>{
  const geometry=coastalBoxGeometry(1.127,.334,2.213),scene=new THREE.Scene(),scope=new ResourceScope('coastal test scene');
  scene.add(new THREE.Mesh(geometry,coastalMaterial('timber')));let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
  captureSceneResources(scene,scope);disposeCoastalGeometry();assert.equal(disposed,0,'scene still retains shared source');
  scope.dispose();scope.dispose();assert.equal(disposed,1);
});

test('all coastal materials in the assembled island receive the vertex colors they require',()=>{
  const world=new World(new THREE.Scene(),'sunhaven'),missing=[];
  world.scene.traverse(o=>{if(o.isMesh&&o.material?.userData.coastal&&o.material.vertexColors&&!o.geometry.attributes.color)missing.push(`${o.name}:${o.material.name}`);});
  assert.deepEqual(missing,[],'legacy rock and rail geometries require non-vertex-color material variants');
  assert.equal(world.coastalAssets.filter(a=>a.kind==='boardwalk').length,4);assert.equal(world.coastalAssets.filter(a=>a.kind==='boathouse').length,1);assert.equal(world.coastalAssets.filter(a=>a.kind==='boat'&&a.open).length,2);
  for(let i=0;i<world.coastalPilingSites.length;i++)for(let j=i+1;j<world.coastalPilingSites.length;j++){
    const a=world.coastalPilingSites[i],b=world.coastalPilingSites[j];assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=1.05,'junctions share a single piling');
  }
});
