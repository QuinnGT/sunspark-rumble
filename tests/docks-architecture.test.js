import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { DOCKS_ARCHITECTURE,createDocksRoofGeometry } from '../src/docks-architecture.js';
import { auditWorldSurfaces } from '../scripts/surface-layer-audit.mjs';

const toPoint=p=>({x:p[0],y:p[1],z:p[2]});

test('authored roof shells have outward faces, usable UVs and a hollow attic silhouette',()=>{
  const ray=new THREE.Raycaster(),normal=new THREE.Vector3();
  for(const side of [-1,1]){
    const geometry=createDocksRoofGeometry({side}),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
    assert.ok(geometry.index);assert.equal(geometry.attributes.color.count,geometry.attributes.position.count);
    assert.equal(geometry.userData.uvUnits,'metres');
    const uv=geometry.attributes.uv,index=geometry.index;
    for(let i=0;i<index.count;i+=3){
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
      const area=(uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a));
      assert.ok(Math.abs(area)>1e-5,'every face supports a stable normal-map tangent frame');
    }
    for(const distance of [.3,1.7,3.5,6.6]){
      const x=side*distance,top=3.6-distance*3.6/7;
      ray.set(new THREE.Vector3(x,5,.31),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];
      assert.ok(hit);assert.ok(Math.abs(hit.point.y-top)<1e-6);assert.ok(hit.face.normal.y>.85);normal.copy(hit.face.normal);
      ray.set(new THREE.Vector3(x,-1,.31),new THREE.Vector3(0,1,0));const underside=ray.intersectObject(mesh)[0];
      assert.ok(underside);assert.ok(Math.abs(underside.point.y-(top-.24))<1e-6,'underside follows the pitch instead of filling the attic');
      assert.ok(normal.dot(underside.face.normal)<-.999);
    }
  }
});

test('substantial boathouse keeps both wide entrances, dock access and tucked terrace playable',()=>{
  const world=new World(new THREE.Scene(),'sunhaven'),a=world.docksArchitecture;
  assert.equal(a.roofType,'full-pitched');assert.equal(a.ridge,13.2);assert.equal(a.width,12);assert.equal(a.doorWidth,4.8);assert.equal(a.doorHeight,4.5);
  assert.equal(a.terrace,7.3);assert.equal(world.ramps.filter(r=>r.accessId==='boathouse-terrace').length,1);
  assert.ok(!world.ramps.some(r=>r.x>82&&r.x<91&&Math.abs(r.z-10)<1),'old dominant east roof ramp is removed');
  for(const [name,route] of Object.entries(DOCKS_ARCHITECTURE.routes))for(let i=1;i<route.length;i++){
    const from=toPoint(route[i-1]),to=toPoint(route[i]);
    assert.ok(world.canWalk(from,to),`${name} segment ${i} forward`);assert.ok(world.canWalk(to,from),`${name} segment ${i} reverse`);
  }
  for(const z of [4,5,10,15,16.3])for(const x of [74.9,76,77.1])assert.ok(world.canStand(x,3.3,z),`clear doorway/interior ${x},${z}`);
  assert.ok(world.canStand(67.5,7.3,10),'terrace has full player headroom');
  assert.ok(world.canStand(76,8,10),'attic space is not filled by an invented rectangular roof collider');
});

test('assembled pitched cover matches collision, and every new structural finish survives the surface audit',()=>{
  const world=new World(new THREE.Scene(),'sunhaven'),a=world.docksArchitecture,report=auditWorldSurfaces(world);
  assert.equal(a.surfaceLayers.length,39,'original nine decks/roof finishes plus thirty exterior/interior wall and gable finishes');
  assert.equal(a.surfaceLayers.filter(l=>l.normal[1]>.01&&l.normal[1]<.999).length,3,'inclined surfaces are audited along their real normals');
  assert.deepEqual(report.violations,[]);
  const shells=world.obstacles.filter(o=>o.kind==='boathouse-pitched-roof');assert.equal(shells.length,2);
  assert.deepEqual(shells.map(o=>o.mesh.userData.authoredModel).sort(),['boathouse-roof-left','boathouse-roof-right']);
  const ray=new THREE.Raycaster();
  for(const layer of world.scene.userData.surfaceLayers.filter(l=>l.kind!=='joinery'&&Math.abs(l.normal[1])<.01)){
    const owner=world.solids.find(mesh=>mesh.uuid===layer.coverMeshUuid);assert.ok(owner,`${layer.name}: registered physical owner`);
    const point=new THREE.Vector3(...layer.points[0]),normal=new THREE.Vector3(...layer.normal);
    ray.set(point.clone().addScaledVector(normal,.06),normal.negate());
    const hit=ray.intersectObject(owner)[0];assert.ok(hit&&hit.point.distanceTo(point)<1e-5,`${layer.name}: owning wall face matches finish`);
    const first=ray.intersectObjects(world.solids,true)[0];assert.ok(first&&first.distance<=hit.distance+1e-5,'projecting trim may provide cover before the wall');
  }
  for(const shell of shells)for(const x of [shell.mesh.userData.authoredModel.endsWith('left')?72:80])for(const z of [5.2,10.4,15.3]){
    ray.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(shell.mesh)[0];assert.ok(hit);
    assert.ok(Math.abs(shell.shape.surfaceAt(x,z)-hit.point.y)<1e-5,'walking and shot support share roof triangles');
    assert.ok(Math.abs(shell.shape.surfaceAt(x,z,true)-(hit.point.y-.24))<1e-5,'roof collision preserves the hollow interior');
  }
  const porch=world.obstacles.find(o=>o.kind==='boathouse-porch-roof');assert.ok(porch?.shape);
  assert.ok(porch.box.min.y>7.8,'deep porch retains the tall central door opening');
});
