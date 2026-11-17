// Sunhaven integration for the shared coastal kit. Core collision dimensions and
// roof/ramp connections remain the established gameplay surfaces.
import * as THREE from 'three';
import {coastalMaterial} from './coastal-materials.js';
import {coastalBoxGeometry} from './coastal-geometry.js';
import {decorateCoastalCabin,coastalLayeredDeck} from './coastal-kit.js';

function coreBox(world,width,height,depth,material,x,y,z){
  const mesh=world.addBox(width,height,depth,material,x,y,z);
  mesh.geometry.dispose();mesh.geometry=coastalBoxGeometry(width,height,depth,{bevel:0,shade:.04});
  return mesh;
}
export function coastalCabin(world,x,z,y,color){
  coreBox(world,7.4,.45,6.4,coastalMaterial('stone',0xc9c5ad),x,y+.2,z);
  coreBox(world,6.5,3.5,5.5,coastalMaterial('paintedWood',color),x,y+2,z);
  coastalLayeredDeck(world,x,z,y+4.25,7.4,6.4,.5,coastalMaterial('trim',0xd77759),{roof:true,finishWidth:7.03,finishDepth:6.03});
  decorateCoastalCabin(world,x,z,y,color);
  const length=8,width=3,roofEdge=x+3.7,lowEdge=roofEdge+length;
  const base=Math.min(...[-width/2,0,width/2].map(dz=>world.heightAt(lowEdge,z+dz)));
  world.addRamp({x:roofEdge+length/2,z,y:base},Math.PI/2,width,length,y+4.25-base,false);
  const crate=coreBox(world,1.1,.65,1.1,coastalMaterial('timber',0xc79b58),x-2,y+4.575,z-1);
  crate.userData.prop='roof-crate';
  for(const dx of [-.38,.38]){
    const band=new THREE.Mesh(coastalBoxGeometry(.10,.69,1.12,{bevel:.018,grain:'z',shade:.035}),coastalMaterial('metal'));
    band.position.set(x-2+dx,y+4.575,z-1);band.castShadow=band.receiveShadow=true;world.scene.add(band);
  }
}

export function metreRampUVs(geometry){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    if(Math.abs(n.getY(i))>=Math.max(Math.abs(n.getX(i)),Math.abs(n.getZ(i))))uv.setXY(i,p.getX(i),p.getZ(i));
    else if(Math.abs(n.getX(i))>Math.abs(n.getZ(i)))uv.setXY(i,p.getZ(i),p.getY(i));
    else uv.setXY(i,p.getX(i),p.getY(i));
  }
  uv.needsUpdate=true;geometry.userData.uvUnits='metres';return geometry;
}

export function dressCoastalRamp(group,width,length,rise){
  const angle=Math.atan2(rise,length),span=Math.hypot(length,rise),count=Math.ceil(span/.62),piece=span/count;
  const shades=[0xc8a475,0xbe9b6e,0xd0ad7d,0xc2a072];
  for(let i=0;i<count;i++){
    const t=(i+.5)/count,mesh=new THREE.Mesh(coastalBoxGeometry(width,.04,piece-.018,{grain:'x',bevel:.008,shade:.035}),coastalMaterial('timber',shades[i%shades.length]));
    mesh.position.set(0,t*rise-.004, length/2-t*length);mesh.rotation.x=angle;
    mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
}
