// Connected cliff faces are a material partition of the authoritative terrain,
// not a second surface laid over it. Tops, collision and raycasts remain exact.
import * as THREE from 'three';
import { coastalMaterial } from './coastal-materials.js';
import { DOCKS_LANDFORM_BOUNDS, docksShelfMask, inDocksLandformBounds } from './maps.js';
import { patchShader } from './shader-patches.js';

export function addDocksLandforms(world){
  if(world.map.id!=='sunhaven')return null;
  if(world.docksLandforms)return world.docksLandforms;
  const ground=world.ground,material=coastalMaterial('stone',0xc1bca6).clone();
  material.name='Docks connected coastal stone';
  material.color.setHex(0x929c8d);material.normalScale.set(.14,.14);
  // Retain subtle mineral detail beneath the broad painted-rock forms. This is
  // the original terrain face, with no additional coplanar surface or decal.
  material.onBeforeCompile=s=>{s.fragmentShader=patchShader(s.fragmentShader,'#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*.65,.72);','coastal cliff mineral contrast');};
  material.customProgramCacheKey=()=> 'approved-coastal-cliff-v1';
  const meshes=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
  let faces=0;
  for(const chunk of [...ground.children]){
    const source=chunk.geometry,index=source.index,position=source.getAttribute('position');
    if(!index||!position)continue;
    const keep=[],vertices=[],normals=[],colors=[],uv=[],masks=[];
    for(let i=0;i<index.count;i+=3){
      const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
      a.fromBufferAttribute(position,ids[0]);b.fromBufferAttribute(position,ids[1]);c.fromBufferAttribute(position,ids[2]);
      const x=(a.x+b.x+c.x)/3,y=(a.y+b.y+c.y)/3,z=(a.z+b.z+c.z)/3;
      normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();
      if(!inDocksLandformBounds(x,z)||docksShelfMask(x,z)<.025||normal.y>.86||y< -1.5){keep.push(...ids);continue;}
      // Facet color supplies a restrained bed/joint variation. Metre UVs use
      // each face's dominant plane, avoiding stretched horizontal terrain UVs.
      const shade=.91+.07*Math.sin(x*.47+z*.36+Math.floor(y/.85)*1.7);
      const side=Math.abs(normal.x)>Math.abs(normal.z);
      for(const point of [a,b,c]){
        vertices.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);
        colors.push(shade,shade,shade*.98);uv.push(side?point.z:point.x,point.y);masks.push(0,0,1);
      }
      faces++;
    }
    if(!vertices.length)continue;
    // Replace, never overlap: this exact triangle belongs to the stone mesh.
    source.setIndex(keep);
    const geometry=new THREE.BufferGeometry();
    for(const [name,data,size] of [['position',vertices,3],['normal',normals,3],['color',colors,3],['uv',uv,2],['terrainMask',masks,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.uvUnits='metres';
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Connected granite ${chunk.name}`;
    mesh.castShadow=mesh.receiveShadow=true;mesh.userData.terrain=true;mesh.userData.docksCliff=true;
    mesh.userData.sourceChunk=chunk.name;ground.add(mesh);meshes.push(mesh);
  }
  // The ground's existing disposer owns every attached geometry. This sole
  // cloned material owns no textures; the shared nature cache keeps those.
  let disposed=false;const disposeGround=ground.dispose.bind(ground);
  ground.dispose=()=>{if(disposed)return;disposed=true;disposeGround();material.dispose();};
  const result={meshes,bounds:DOCKS_LANDFORM_BOUNDS,collision:'shared terrain heightfield',diagnostics:()=>({faces,drawCalls:meshes.length,triangles:faces,materialCount:1,terrainOwned:true})};
  ground.userData.docksCliffFaces=faces;world.docksLandforms=result;return result;
}
