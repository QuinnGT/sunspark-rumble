import * as THREE from 'three';
import { clamp } from './config.js';
import { mapTerrain,routeDistance,quarryRise,sunhavenLandformMask } from './maps.js';
import { terrainMaterial } from './nature-ground.js';

export function terrainAppearance(map,x,y,z){
  const r=Math.hypot(x,z);
  let beach,trail,rock=0,color;
  if(map.id==='sunhaven'){
    const field=mapTerrain(map),slope=Math.hypot(field.heightAt(x+.7,z)-field.heightAt(x-.7,z),field.heightAt(x,z+.7)-field.heightAt(x,z-.7))/1.4;
    const shoulder=sunhavenLandformMask(x,z),quarry=clamp(quarryRise(x,z)/.8,0,1),lantern=clamp(1-Math.hypot(x/30,(z+78)/30),0,1);
    // A few metre-scale bends break path edges, without changing their clear
    // centerline. The harbor landing paths connect both permanent ramp mouths.
    const harborPath=x>62&&x<84?Math.min(Math.abs(z-20),Math.abs(z-39)):Infinity;
    const pathDistance=Math.min(routeDistance(x,z),harborPath),edgeDrift=.3*Math.sin(x*.36+z*.29)+.17*Math.cos(z*.51-x*.18);
    trail=1-clamp((pathDistance-1.65+edgeDrift)/2.15,0,1);
    const geology=Math.max(quarry,shoulder*.96,lantern*.75,clamp((r-114)/8,0,1)*.8);
    rock=clamp((slope-.16)/.43,0,1)*geology;
    rock=Math.max(rock,quarry*.65)*(1-trail*.65);
    // Rock is exposed on steep banks; shallow horizontal sand remains visible
    // through the water. Local shoals replace the former uniform sand ring.
    beach=Math.max(clamp((.8-y)/2.35,0,1),clamp((r-113+Math.sin(x*.15+z*.12)*1.8)/13,0,1))*(1-rock*.86);
    const dryPatch=.5+.5*Math.sin(x*.095+z*.067)*Math.cos(z*.12);
    color=new THREE.Color(0x88a54d).lerp(new THREE.Color(0xabb467),dryPatch*.22).lerp(new THREE.Color(0xe2c58c),trail*.9).lerp(new THREE.Color(0xbdbba8),rock).lerp(new THREE.Color(0xefdaad),beach);
    color.multiplyScalar(.98+.028*Math.sin(x*.17)*Math.cos(z*.19));
  }else{
    const shore=clamp((r-56+Math.sin(x*.34)*.8+Math.cos(z*.3)*.7)/10,0,1);
    beach=shore*shore*(3-2*shore);
    const path=Math.min(Math.abs(x+Math.sin(z*.06)*8)/2.5,Math.abs(z-8+Math.sin(x*.07)*5)/2);
    trail=r<61?clamp(1.5-path,0,1):0;
    color=new THREE.Color(0x88ad52).lerp(new THREE.Color(0xd6c38c),trail*.8).lerp(new THREE.Color(0xf3dfa9),beach);
    if(r<61)color.multiplyScalar(.96+.06*Math.sin(x*.2)*Math.cos(z*.27));
  }
  return {color,mask:[beach,trail,rock]};
}

export function createTerrainChunks(field,material,appearance=()=>({color:new THREE.Color(0xffffff),mask:[0,0,0]})){
  const root=new THREE.Group();root.name='Sampled terrain chunks';root.userData.terrain=true;root.userData.heightfield=field;
  const step=field.chunkCells,stride=field.stride;
  for(let startZ=0;startZ<field.cells;startZ+=step)for(let startX=0;startX<field.cells;startX+=step){
    const countX=Math.min(step,field.cells-startX),countZ=Math.min(step,field.cells-startZ),width=countX+1,count=width*(countZ+1);
    const positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3),masks=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];
    for(let z=0;z<=countZ;z++)for(let x=0;x<=countX;x++){
      const id=z*width+x,global=(startZ+z)*stride+startX+x,px=field.min+(startX+x)*field.spacing,pz=field.min+(startZ+z)*field.spacing,y=field.heights[global],paint=appearance(px,y,pz);
      positions.set([px,y,pz],id*3);normals.set(field.normals.subarray(global*3,global*3+3),id*3);colors.set(paint.color.toArray(),id*3);masks.set(paint.mask,id*3);uv.set([px,-pz],id*2);
      if(x<countX&&z<countZ){const a=id,b=a+1,c=a+width,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    const geometry=new THREE.BufferGeometry();
    for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['color',colors,3],['terrainMask',masks,3],['uv',uv,2]])geometry.setAttribute(name,new THREE.BufferAttribute(data,size));
    geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`Terrain ${startX},${startZ}`;mesh.receiveShadow=true;mesh.userData.terrain=true;root.add(mesh);
  }
  // The root owns chunk geometry/material; the shared texture cache owns maps.
  let disposed=false;root.dispose=()=>{if(disposed)return;disposed=true;for(const chunk of root.children)chunk.geometry.dispose();material.dispose();root.removeFromParent();};
  return root;
}

export function createMapTerrain(map){
  const root=createTerrainChunks(mapTerrain(map),terrainMaterial(true),(x,y,z)=>terrainAppearance(map,x,y,z));
  root.name=`${map.name} terrain`;return root;
}
