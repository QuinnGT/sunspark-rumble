import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './config.js';
import { routeDistance } from './maps.js';
import { surface } from './materials.js';
import { ResourceScope } from './resource-scope.js';
import { approvedRockRegion } from './approved-docks-rocks.js';

// Compact authored beds frame the district edges. Open grass between beds is
// intentional: this is a composition pass rather than another scattering layer.
export const DOCKS_PLANT_BEDS=Object.freeze([
  ['dock-north-crown',90,-5,4.0],['dock-north-lip',97,4,3.2],['dock-north-flowers',88,7,2.5],
  ['dock-south-crown',89,53,4.4],['dock-south-lip',97,48,3.4],['dock-south-flowers',82,50,2.7],
  ['dock-beach',102,51,2.7],['dock-path',59,36,3],['dock-backdrop',68,-8,3.3],
  ['dock-meadow',72,54,3.6],['dock-west-approach',58,21,2.4]
]);
export const SUNHAVEN_PLANT_BEDS=Object.freeze([
  ...DOCKS_PLANT_BEDS,
  ['village-west',-27,-17,3.5],['village-garden',-25,24,3.5],['village-east',31,0,4],['village-south',24,26,3.6],
  ['lantern-west',-19,-90,4.2],['lantern-east',22,-88,4.8],['lantern-south',18,-69,3.3],['lantern-lane',-18,-63,3.4],
  ['orchard-coast',-102,-26,5],['orchard-north',-99,-50,3.5],['orchard-gate',-68,-64,4],['orchard-wall',-58,-47,3.6],['orchard-south',-58,-7,3.4],
  ['quarry-north',-68,48,3.8],['quarry-east',-22,71,3.4],['quarry-south',-56,98,4],['quarry-west',-76,78,3.6]
]);
const ROCK_SITES=[
  [85,-5,1.6],[91,-8,2],[100,1,1.7],[96,8,1.25],
  [87,47,1.7],[95,45,1.25],[100,48,1.75],[104,54,1.2],[89,59,1.65],
  [88,31,.72],[92,33,.58],[95,29,.82],[103,32,.65],[108,26,1.15],
  [-22,-91,1.85],[-13,-98,1.7],[23,-93,1.9],[26,-83,1.7],[20,-69,1.25],
  [-109,-30,1.7],[-105,-43,1.45],[-96,-62,1.5],[-107,-9,1.5],
  [-72,48,1.6],[-24,77,1.15],[-56,99,1.5],[-77,83,1.8]
];
// The docks use dedicated spreading oaks; retain the established distant grove
// landmarks here. Root installs createDocksOaks before composing these beds.
const HERO_OAKS=[[-19,-88,1.28],[23,-89,1.3],[-102,-29,1.2]];
const CELL_SIZE=24;

function colorGeometry(geometry,color,shade=0){
  const p=geometry.attributes.position,c=new THREE.Color(color),colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const gain=1+shade*Math.sin(p.getX(i)*5+p.getY(i)*2+p.getZ(i)*3);
    colors.set([c.r*gain,c.g*gain,c.b*gain],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
function part(parts,geometry,color,position,scale=[1,1,1],rotation=[0,0,0]){
  colorGeometry(geometry,color,.025);const object=new THREE.Object3D();object.position.set(...position);object.scale.set(...scale);object.rotation.set(...rotation);object.updateMatrix();geometry.applyMatrix4(object.matrix);
  // All generated primitives share the position/normal/color layout. UVs would
  // serve no purpose on these opaque vertex-colored plant surfaces.
  geometry.deleteAttribute('uv');parts.push(geometry);
}
function leafGeometry(width=.16,length=.32,rounded=false){
  const g=new THREE.BufferGeometry();
  if(rounded){
    const p=[0,length*.45,.026],indices=[];
    for(let i=0;i<8;i++){const a=i*Math.PI/4;p.push(Math.sin(a)*width*.5,length*.45-Math.cos(a)*length*.45,.008*Math.sin(a)**2);indices.push(0,1+i,1+(i+1)%8);}
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-width*.5,length*.4,.035,0,length*.54,.07,width*.5,length*.4,.035,0,length,0],3));
  g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);g.computeVertexNormals();return g;
}
function combine(parts){const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;}
function shrubGeometry(){
  const parts=[],rng=seeded(1951),greens=[0x638e3e,0x80a348,0x9bb657,0xb5bf6a];
  part(parts,new THREE.CylinderGeometry(.018,.035,.36,5),0x667647,[0,.16,0]);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;part(parts,new THREE.CylinderGeometry(.012,.022,.29,5),0x748849,[Math.sin(a)*.11,.23,Math.cos(a)*.11],[1,1,1],[Math.cos(a)*.5,0,-Math.sin(a)*.5]);}
  // Real overlapping leaves supply both the crown volume and its serrated edge;
  // opaque sphere fillers made the earlier shrubs read as smooth green stones.
  for(let i=0;i<164;i++){
    const angle=i*2.39996,level=(i+.5)/164,shell=i%4?.86+rng()*.14:.38+rng()*.3,radius=Math.sqrt(1-level*level)*.67*shell;
    part(parts,leafGeometry(.19+rng()*.07,.23+rng()*.11,true),greens[i%greens.length],[Math.sin(angle)*radius,.13+level*.51,Math.cos(angle)*radius],[1,1,1],[1.05-level*.42,angle,rng()*.8-.4]);
  }
  return combine(parts);
}
function flowerGeometry(){
  const parts=[],rng=seeded(471),petals=[0xffecc1,0xf5d466,0xdfd8ef,0xb3a6d0,0xffecc1];
  for(let i=0;i<6;i++){
    const angle=i*2.39996,radius=.12+Math.sqrt(rng())*.27,x=Math.sin(angle)*radius,z=Math.cos(angle)*radius,height=.28+rng()*.29;
    part(parts,new THREE.CylinderGeometry(.009,.013,height,4),0x708c43,[x,height/2,z]);
    for(let side=0;side<2;side++)part(parts,leafGeometry(.065,.18),0x708c43,[x,height*.2+side*.08,z],[1,1,1],[.8,angle+side*Math.PI,0]);
    for(let petal=0;petal<5;petal++){
      const a=petal*Math.PI*2/5;
      part(parts,leafGeometry(.095,.15,true),petals[i%petals.length],[x+Math.sin(a)*.021,height+.008,z+Math.cos(a)*.021],[1,1,1],[Math.PI/2,0,-a]);
    }
    part(parts,new THREE.SphereGeometry(.035,6,3),0xe7ad39,[x,height+.026,z],[1,.65,1]);
  }
  return combine(parts);
}
function tuftGeometry(){
  const parts=[],rng=seeded(315),greens=[0x839348,0xa2a761,0xc0b675,0x688445];
  for(let i=0;i<17;i++){
    const angle=i*2.39996,radius=rng()*.23,length=.24+rng()*.4;
    part(parts,leafGeometry(.033+rng()*.04,length),greens[i%greens.length],[Math.sin(angle)*radius,0,Math.cos(angle)*radius],[1,1,1],[.1+rng()*.3,angle,0]);
  }
  return combine(parts);
}
function graniteGeometry(seed){
  const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.1*Math.sin(x*4+z*3+seed)+.07*Math.cos(z*6-y*3+seed*.6);
    // Broad, worn blocks; horizontal ledges catch warm light, softened edges
    // break the silhouette. No overhang changes the terrain authority.
    p.setXYZ(i,x*r,Math.min(y*r,.7+.04*Math.sin(x*5+seed)),z*r);
  }
  g.computeVertexNormals();colorGeometry(g,0xffffff,.06);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function landscapePlantClear(world,x,z,radius=.65){
  if(world.heightAt(x,z)<.12||routeDistance(x,z)<4.5+radius||world.isRampApproach(x,z,radius+1.2))return false;
  if(world.map.pads.some(([px,pz,,r])=>Math.hypot(x-px,z-pz)<r+1.2+radius))return false;
  for(const sites of [world.map.spawns,world.map.finales])if(sites.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<3.5+radius))return false;
  // The two landing paths are wider than their ramps; leave those approach
  // shoulders and the boathouse door corridors entirely free of dressing.
  if(x>63-radius&&x<84+radius&&(Math.abs(z-20)<2.6+radius||Math.abs(z-39)<2.6+radius))return false;
  if(x>73-radius&&x<79+radius&&z>2-radius&&z<18+radius)return false;
  return !world.nearObstacles(x,z,radius).some(o=>{
    if(o.kind==='docks-oak'){const trunk=o.mesh.getWorldPosition(new THREE.Vector3());return Math.hypot(x-trunk.x,z-trunk.z)<radius+.95;}
    return x+radius>o.box.min.x&&x-radius<o.box.max.x&&z+radius>o.box.min.z&&z-radius<o.box.max.z;
  });
}
function rockClear(world,x,z,size){
  const radius=size*1.5;
  if(routeDistance(x,z)<4+radius||world.isRampApproach(x,z,radius+1.3))return false;
  if(world.map.pads.some(([px,pz,,r])=>Math.hypot(x-px,z-pz)<r+radius+1))return false;
  for(const sites of [world.map.spawns,world.map.finales])if(sites.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<4+radius))return false;
  if(x>63-radius&&x<84+radius&&(Math.abs(z-20)<2.6+radius||Math.abs(z-39)<2.6+radius))return false;
  return world.sceneryFree(x,z,radius);
}

export function decorateSunhavenLandscape(world){
  if(world.map.id!=='sunhaven')return null;
  if(world.landscape)return world.landscape;
  const root=new THREE.Group();root.name='Authored Sunhaven landscape';root.userData.staticBatching=false;world.scene.add(root);world.landscape=root;
  const scope=new ResourceScope(),geometry={shrub:scope.retain(shrubGeometry()),flowers:scope.retain(flowerGeometry()),tuft:scope.retain(tuftGeometry())};
  for(let i=0;i<3;i++)geometry['rock'+i]=scope.retain(graniteGeometry(i+731));
  const plants=scope.retain(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.94,side:THREE.DoubleSide}));plants.name='Sunhaven shrub, petal and coastal-grass colors';
  const stone=scope.retain(surface('stone',0xbabbaa).clone());stone.name='Sunhaven worn shore granite';stone.vertexColors=true;stone.normalScale.multiplyScalar(.55);
  const batches=new Map(),dummy=new THREE.Object3D(),records=[],counts={shrubs:0,flowers:0,tufts:0,rocks:0,heroOaks:0};
  function instance(kind,x,y,z,scale,yaw,color=0xffffff){
    const key=kind+':'+Math.floor(x/CELL_SIZE)+','+Math.floor(z/CELL_SIZE);
    if(!batches.has(key))batches.set(key,{kind,items:[]});
    dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(...scale);dummy.updateMatrix();
    batches.get(key).items.push({matrix:dummy.matrix.clone(),color:new THREE.Color(color)});
  }
  for(const [cx,cz,scale] of HERO_OAKS){
    for(const [dx,dz] of [[0,0],[2,0],[-2,0],[0,2],[0,-2]]){
      const x=cx+dx,z=cz+dz;
      if(!landscapePlantClear(world,x,z,1.3)||!world.sceneryFree(x,z,3.5)||world.foliage.trees.some(t=>Math.hypot(t.x-x,t.z-z)<6.5))continue;
      world.tree(x,z,scale,false);counts.heroOaks++;break;
    }
  }
  for(let i=0;i<ROCK_SITES.length;i++){
    const [x,z,size]=ROCK_SITES[i];if(approvedRockRegion(x,z)||!rockClear(world,x,z,size))continue;
    const kind='rock'+i%3,y=world.heightAt(x,z)+size*.34,scale=[size*1.3,size*.78,size],yaw=i*1.73;
    const collider=new THREE.Mesh(geometry[kind],stone);collider.position.set(x,y,z);collider.scale.set(...scale);collider.rotation.y=yaw;collider.visible=false;collider.userData.instancedVisual=true;collider.userData.landscapeRock=true;root.add(collider);world.rockCollider(collider,'shore-rock');
    instance(kind,x,y,z,scale,yaw);counts.rocks++;
    records.push({kind:'rock',x,z,size,y,collider:collider.uuid});
  }
  for(let bedIndex=0;bedIndex<SUNHAVEN_PLANT_BEDS.length;bedIndex++){
    const [id,cx,cz,radius]=SUNHAVEN_PLANT_BEDS[bedIndex],rng=seeded(6400+bedIndex);
    const dockBed=id.startsWith('dock-');
    for(let i=0;i<(dockBed?38:26);i++){
      const kind=i<(dockBed?7:5)?'shrub':i<(dockBed?23:15)?'flowers':'tuft',ring=kind==='shrub'?.55:1,angle=i*2.39996+rng()*.5,r=Math.sqrt(rng())*radius*ring;
      const x=cx+Math.sin(angle)*r,z=cz+Math.cos(angle)*r,scale=kind==='shrub'?.85+rng()*.75:.8+rng()*.65,footprint=(kind==='shrub'?.66:.4)*scale;
      if(!landscapePlantClear(world,x,z,footprint))continue;
      const y=world.heightAt(x,z)-.035;
      instance(kind,x,y,z,[scale,scale,scale],rng()*Math.PI*2,kind==='shrub'?(i%2?0xf4f3d2:0xe6eecd):0xffffff);
      counts[kind==='shrub'?'shrubs':kind==='flowers'?'flowers':'tufts']++;
      records.push({kind,bed:id,x,z,y,radius:footprint});
    }
  }
  let triangles=0;
  for(const [key,{kind,items}] of batches){
    const mesh=scope.retain(new THREE.InstancedMesh(geometry[kind],kind.startsWith('rock')?stone:plants,items.length));mesh.name='Landscape '+key;mesh.userData.landscapeKind=kind;
    for(let i=0;i<items.length;i++){mesh.setMatrixAt(i,items[i].matrix);mesh.setColorAt(i,items[i].color);}
    mesh.castShadow=kind.startsWith('rock')||kind==='shrub';mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    triangles+=(geometry[kind].index?.count??geometry[kind].attributes.position.count)/3*items.length;
  }
  root.userData.placements=records;
  root.diagnostics=()=>({...counts,plantBeds:SUNHAVEN_PLANT_BEDS.length,batches:batches.size,triangles,cellSize:CELL_SIZE,disposed});
  let disposed=false;root.dispose=()=>{if(disposed)return;disposed=true;scope.dispose();root.removeFromParent();};
  return root;
}
