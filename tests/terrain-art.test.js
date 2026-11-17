import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { MAPS,SUNHAVEN_ROUTES,SUNHAVEN_SHED_PADS,sunhavenBaseHeight,sunhavenFoundationHeight,sunhavenHeightSource,mapTerrain,inDocksLandformBounds } from '../src/maps.js';
import { TerrainHeightfield } from '../src/terrain-heightfield.js';
import { terrainAppearance } from '../src/terrain-surface.js';
import { decorateSunhavenLandscape,landscapePlantClear } from '../src/sunhaven-landscape.js';

const world=new World(new THREE.Scene(),'sunhaven'),landscape=decorateSunhavenLandscape(world);
// The baseline includes the intentional 1.10.1 shed foundation cut. Terrain art
// retains all old gameplay corridors outside the approved docks/headland bounds.
// docks-landforms.test.js independently checks the new grades and shelf heights.
const previous=new TerrainHeightfield((x,z)=>sunhavenFoundationHeight(x,z,sunhavenBaseHeight(x,z)),{extent:320,spacing:1,chunkCells:32});

test('shed foundation cuts stay local, only lower ground and retain existing floor heights',()=>{
  let changed=0;
  for(let x=-115;x<=115;x++)for(let z=-115;z<=115;z++){
    const old=sunhavenBaseHeight(x,z),next=sunhavenFoundationHeight(x,z,old);
    assert.ok(next<=old);
    if(SUNHAVEN_SHED_PADS.every(([cx,cz])=>Math.abs(x-cx)>=5.25||Math.abs(z-cz)>=5))assert.equal(next,old);
    if(next!==old)changed++;
  }
  assert.ok(changed>10&&changed<200);
  for(const [x,z] of SUNHAVEN_SHED_PADS){
    assert.equal(world.heightAt(x,z),Math.fround(sunhavenBaseHeight(x,z)));
    const from=new THREE.Vector3(x,world.floorAt(x,z+4),z+4),to=new THREE.Vector3(x,world.floorAt(x,z-4),z-4);
    assert.ok(world.canWalk(from,to),`shed at ${x},${z} remains traversable`);
  }
});

test('terrain art retains original gameplay supports outside the approved docks/headland revision',()=>{
  let unchanged=0,revised=0;const ray=new THREE.Raycaster();world.ground.updateMatrixWorld(true);
  const fixed=(x,z)=>{unchanged++;assert.ok(Math.abs(world.heightAt(x,z)-previous.heightAt(x,z))<1e-6,`original gameplay surface moved at ${x},${z}`);};
  const same=(x,z)=>{
    if(!inDocksLandformBounds(x,z,1)){fixed(x,z);return;}
    // A one-cell border includes interpolation from changed boundary vertices.
    // Changes here are intentional, but every revised sample must still match
    // visible collision triangles; the dedicated docks suite fixes new grades,
    // shelf heights, locality and all extraction-face clearances numerically.
    revised++;ray.set(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(world.ground,true)[0];
    assert.ok(hit&&Math.abs(hit.point.y-world.heightAt(x,z))<1e-5,`revised surface mismatch at ${x},${z}`);
  };
  for(const [x,z,,radius] of MAPS.sunhaven.pads)for(let a=0;a<12;a++)for(const r of [0,radius*.5,radius])same(x+Math.sin(a)*r,z+Math.cos(a)*r);
  for(const sites of [MAPS.sunhaven.spawns,MAPS.sunhaven.finales])for(const [x,z] of sites)for(const [dx,dz] of [[0,0],[-2,0],[2,0],[0,-2],[0,2]])fixed(x+dx,z+dz);
  for(const route of SUNHAVEN_ROUTES)for(let i=1;i<route.length;i++){
    const [ax,az]=route[i-1],[bx,bz]=route[i],length=Math.hypot(bx-ax,bz-az);
    for(let t=0;t<=1;t+=.025)for(const side of [-2.5,0,2.5])same(ax+(bx-ax)*t+(bz-az)/length*side,az+(bz-az)*t-(bx-ax)/length*side);
  }
  for(const r of world.ramps)for(let along=-r.length/2-1;along<=r.length/2+1;along+=.5)for(const side of [-r.width/2,0,r.width/2])(r.accessId==='boathouse-terrace'||r.x===75&&(r.z===20||r.z===39)?same:fixed)(r.x+Math.sin(r.yaw)*along+Math.cos(r.yaw)*side,r.z+Math.cos(r.yaw)*along-Math.sin(r.yaw)*side);
  assert.ok(unchanged>2500,'the original support invariants remain active over most of the map');
  assert.ok(revised>100,'the new scene and its ground samples are exercised');
});

test('authored shoulders, broken outer banks and harbor channels alter the authoritative terrain',()=>{
  for(const [x,z] of [[87,-5],[89,50],[20,-86],[-100,-31]])assert.ok(world.heightAt(x,z)-previous.heightAt(x,z)>.6,`raised landform at ${x},${z}`);
  const channel=world.heightAt(103,26)-previous.heightAt(103,26);assert.ok(channel<-.25,'harbor channel is carved into the seabed');
  let shorelineVariation=0;
  for(let i=0;i<40;i++){const a=i*Math.PI/20,x=Math.cos(a)*124,z=Math.sin(a)*124;shorelineVariation=Math.max(shorelineVariation,Math.abs(world.heightAt(x,z)-previous.heightAt(x,z)));}
  assert.ok(shorelineVariation>.4,'headlands and beaches break the old circular edge');
  const field=mapTerrain('sunhaven'),ray=new THREE.Raycaster();world.ground.updateMatrixWorld(true);
  for(const [x,z] of [[86.4,-4.8],[91.7,1.3],[90.2,51.7],[-101.6,-29.1],[101.4,25.6]]){
    ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));
    assert.ok(Math.abs(ray.intersectObject(world.ground)[0].point.y-field.heightAt(x,z))<1e-5);
    assert.ok(Math.abs(field.heightAt(x,z)-sunhavenHeightSource(x,z))<.15,'one-metre grid retains the broad authored forms');
  }
});

test('terrain paint reveals rocky slopes, grassy caps and warm clear landing paths',()=>{
  const paint=(x,z)=>terrainAppearance(MAPS.sunhaven,x,world.heightAt(x,z),z);
  assert.ok(paint(72,20).mask[1]>.9);assert.ok(paint(72,39).mask[1]>.9);
  assert.ok(paint(90,51).mask[0]<.1,'dry shoulder has a grass cap rather than a sand covering');
  let rock=0;
  for(let x=84;x<=99;x++)for(let z=-9;z<=5;z++)rock=Math.max(rock,paint(x,z).mask[2]);
  assert.ok(rock>.5,'new steep harbor shoulder exposes granite');
  for(const [x,z] of [[103,26],[95,45],[104,54]])assert.ok(paint(x,z).mask.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
});

test('the inner boardwalk basin contains connected shallows while both land approaches stay dry',()=>{
  let beforeWet=0,afterWet=0,total=0;
  for(let x=84;x<=96;x++)for(let z=24;z<=35;z++){
    total++;if(previous.heightAt(x,z)<-1.1)beforeWet++;if(world.heightAt(x,z)<-1.1)afterWet++;
  }
  assert.ok(afterWet/total>.85,'most of the basin reads as water');
  assert.ok(afterWet>beforeWet+35,'a substantial dry mound was replaced by connected shallows');
  for(let x=86;x<=104;x+=.5)assert.ok(world.heightAt(x,28)<-1.1,'water connects the inner basin and boat to the sea');
  for(const z of [20,39])for(let x=69;x<=78;x+=.5){
    assert.equal(world.heightAt(x,z),previous.heightAt(x,z));assert.ok(world.floorAt(x,z)>-.5);
  }
});

test('authored plants stay grounded and clear of movement corridors, solids and entrance footprints',()=>{
  assert.equal(decorateSunhavenLandscape(world),landscape,'decoration is added only once');
  const info=landscape.diagnostics();assert.ok(info.shrubs>35&&info.flowers>80&&info.tufts>80&&info.heroOaks>=2);
  const beds=new Set();
  for(const p of landscape.userData.placements.filter(p=>p.kind!=='rock')){
    beds.add(p.bed);assert.ok(landscapePlantClear(world,p.x,p.z,p.radius),`clearance lost at ${p.x},${p.z}`);
    assert.ok(Math.abs(p.y-(world.heightAt(p.x,p.z)-.035))<1e-8);
  }
  assert.ok(beds.size>=18,'every district receives composed vegetation');
  for(const [x,z] of [[76,4],[76,16],[72,20],[72,39],[0,4],[-53,69]])assert.equal(landscapePlantClear(world,x,z),false);
});

test('new shore rocks use exact collision geometry and compact instanced visuals',()=>{
  const instances=landscape.children.filter(m=>m.isInstancedMesh),matrix=new THREE.Matrix4(),center=new THREE.Vector3(),ray=new THREE.Raycaster();
  landscape.updateMatrixWorld(true);assert.ok(instances.length>0);
  for(const mesh of instances){
    assert.ok(mesh.frustumCulled&&mesh.boundingBox&&mesh.boundingSphere);assert.ok(mesh.boundingSphere.radius<22,'no giant invisible cross-island bounds');
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);assert.ok(mesh.boundingBox.containsPoint(center));}
  }
  for(const p of landscape.userData.placements.filter(p=>p.kind==='rock')){
    const collider=world.solids.find(m=>m.uuid===p.collider);assert.ok(collider&&!collider.visible&&collider.userData.instancedVisual);
    const obstacle=world.obstacles.find(o=>o.mesh===collider);assert.ok(obstacle.shape&&obstacle.kind==='shore-rock');
    ray.set(new THREE.Vector3(p.x,p.y+p.size*3,p.z),new THREE.Vector3(0,-1,0));
    const visible=ray.intersectObjects(instances.filter(m=>m.userData.landscapeKind.startsWith('rock')),false)[0],physical=ray.intersectObject(collider)[0];
    assert.ok(visible&&physical);assert.ok(visible.point.distanceTo(physical.point)<1e-5,'visible boulder and shot/movement proxy agree');
  }
});

test('landscape releases each owned GPU object once while borrowing shared stone textures',()=>{
  const resources=new Set(),events=new Map();
  landscape.traverse(o=>{if(o.isInstancedMesh)resources.add(o);if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
  for(const resource of resources){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}
  const stone=landscape.children.find(o=>o.material?.name==='Sunhaven worn shore granite').material;let mapDisposed=0;stone.map.addEventListener('dispose',()=>mapDisposed++);
  landscape.dispose();landscape.dispose();assert.equal(landscape.parent,null);assert.equal(mapDisposed,0);
  for(const count of events.values())assert.equal(count,1);
});
