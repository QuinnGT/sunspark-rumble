import * as THREE from 'three';
import {approvedGeometry} from './approved-models.js';
import {natureTexture} from './nature-assets.js';
import {ResourceScope} from './resource-scope.js';

// Closed authored blocks bed into the original heightfield. No duplicate terrain
// skin or raised collision-only shelf is introduced. Widths are in metres.
export const APPROVED_ROCK_SITES=Object.freeze([
  [85.5,8,7.4,1,.12],[91,8.4,8.2,2,-.1],[97,8.1,8,3,.1],[102.5,6.8,7.4,1,-.2],[106,3,6.2,2,.15],
  [84.5,1,6.8,3,.3],[90,1.5,7.6,1,-.1],[96,1.3,8,2,.16],[101.5,.8,7,3,-.2],
  [84.5,47,7.4,2,.1],[90,47.2,8,3,-.1],[96,47.5,8,1,.12],[102,49,7,2,-.18],
]);
export function approvedRockRegion(x,z){return (x>82&&x<109&&(z>-3&&z<14||z>43&&z<55));}
export function createApprovedDocksRocks(world){
  const root=new THREE.Group(),scope=new ResourceScope('approved docks rocks');root.name='Authored coastal rock formations';root.userData.staticBatching=false;world.scene.add(root);world.approvedRocks=root;
  const old=new Set(world.obstacles.filter(o=>o.kind==='rock'&&approvedRockRegion(o.mesh.position.x,o.mesh.position.z)).map(o=>o.mesh));for(const mesh of old){mesh.removeFromParent();mesh.geometry.dispose();}world.obstacles=world.obstacles.filter(o=>!old.has(o.mesh));world.solids=world.solids.filter(m=>!old.has(m));world.navVersion++;
  const map=natureTexture('approved_rock_color',true);map.flipY=false;
  const material=scope.retain(new THREE.MeshStandardMaterial({name:'Approved coastal painted rock',map,roughness:1}));scope.retain(map);
  const geometries=[1,2,3].map(i=>scope.retain(approvedGeometry(`approved-rock-${i}`))),rocks=[];
  for(const [x,z,width,variant,yaw]of APPROVED_ROCK_SITES){
    const geometry=geometries[variant-1],mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,0,z);mesh.scale.set(width,width,width);mesh.rotation.y=yaw;root.add(mesh);mesh.updateWorldMatrix(true,false);
    const bounds=new THREE.Box3().setFromObject(mesh);let base=Infinity;for(let sx=bounds.min.x;sx<=bounds.max.x+.01;sx+=.45)for(let sz=bounds.min.z;sz<=bounds.max.z+.01;sz+=.45)base=Math.min(base,world.heightAt(sx,sz));mesh.position.y=base-.15;
    mesh.name=`Approved coastal rock ${rocks.length+1}`;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.instancedVisual=true;mesh.userData.staticBatching=false;mesh.userData.approvedRock=true;const obstacle=world.rockCollider(mesh,'approved-rock');rocks.push({mesh,obstacle,x,z,width,variant,base});
    (world.approvedModelSlots??=[]).push({key:`approved-rock-${variant}`,source:geometry,visual:mesh,matrix:new THREE.Matrix4(),releaseOldGeometry:false,retainGeometry:g=>scope.retain(g)});
  }
  root.rocks=rocks;root.diagnostics=()=>({rocks:rocks.length,triangles:rocks.reduce((n,r)=>n+r.mesh.geometry.index.count/3,0),removedOldRocks:old.size});let disposed=false;root.dispose=()=>{if(disposed)return;disposed=true;scope.dispose();root.clear();root.removeFromParent();};return root;
}
