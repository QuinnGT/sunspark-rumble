import * as THREE from 'three';
import {natureTexture} from './nature-assets.js';
const ROWS=[0,.132,.264,.400,.529,.660,.787,.893,1];
let material;
export function approvedTimberMaterial(){
  if(!material){material=new THREE.MeshStandardMaterial({name:'Approved weathered teal timber',map:natureTexture('approved_teal_color',true),roughness:.89,vertexColors:true});material.addEventListener('dispose',()=>{material=null;});}
  return material;
}
// Structural positions and collision are unchanged. Assign one measured atlas
// strip to each board. Short boards crop a five-metre reference strip; longer
// spans use the whole strip, without tiling its non-seamless end grain.
export function mapApprovedBoard(mesh,row,width,height,axis='x'){
  const original=mesh.geometry;mesh.geometry=original.clone();const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
  const band=(row*3+1)%8,v0=1-ROWS[band+1]+.009,v1=1-ROWS[band]-.009;
  for(let i=0;i<uv.count;i++){const x=axis==='z'?p.getZ(i):p.getX(i);uv.setXY(i,.015+(x/Math.max(width,5)+.5)*.97,v0+(p.getY(i)/height+.5)*(v1-v0));}
  mesh.material=approvedTimberMaterial();mesh.userData.approvedTimber=true;return mesh;
}
