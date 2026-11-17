// Small, deterministic material tiles. Generated locally; no asset downloads.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './config.js';
import { natureTexture } from './nature-assets.js';
import { setInstanceBounds } from './instance-bounds.js';

const tiles=new Map(),surfaces=new Map();
function softNoise(x,y,period){
  const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;
  const hash=(a,b)=>{let n=Math.imul((a%period+period)%period+83,374761393)^Math.imul((b%period+period)%period+127,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;};
  const sx=u*u*(3-2*u),sy=v*v*(3-2*v),a=hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx,b=hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx;
  return a*(1-sy)+b*sy-.5;
}
function tile(kind,rx,ry){
  const key=`${kind}:${rx}:${ry}`;if(tiles.has(key))return tiles.get(key);
  const size=128,data=new Uint8Array(size*size*4),rng=seeded(831),tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,noise=rng()-.5;
    let value=238+noise*14;
    if(kind==='wood'||kind==='bark'){
      const wave=kind==='bark'?u*12+Math.sin(v*tau)*.25:v*18+Math.sin(u*tau)*.4+Math.sin(u*tau*3)*.12;
      const grain=Math.pow(.5+.5*Math.sin(wave*tau),10);
      const knot=Math.sin(Math.hypot(Math.sin((u-.3)*Math.PI)*2,Math.sin((v-.6)*Math.PI)*7)*28);
      value=241-grain*(kind==='bark'?66:33)+knot*4+noise*10;
    }else if(kind==='grass'){
      value=238+softNoise(u*4,v*4,4)*18+softNoise(u*16,v*16,16)*9+noise*9;
    }else if(kind==='stone'){
      value=223+Math.sin(u*tau*2+Math.cos(v*tau*3))*12+noise*22;
    }else if(kind==='fabric'){
      value=237+(x%4===0||y%4===0?-19:0)+noise*8;
    }else if(kind==='water'){
      value=231+Math.pow(.5+.5*Math.sin((u*4+v*3)*tau+Math.sin(v*tau)*2),12)*24;
    }
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.max(0,Math.min(255,value));data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.name=`Breezy Bay ${kind}`;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=2;t.needsUpdate=true;tiles.set(key,t);return t;
}
export function surface(kind,color,rx=1,ry=1){
  const key=`${kind}:${color}:${rx}:${ry}`;if(surfaces.has(key))return surfaces.get(key);
  const map=tile(kind,rx,ry),m=new THREE.MeshStandardMaterial({color,map,roughness:kind==='water'?.32:.87});
  if(kind==='stone'){
    m.map=natureTexture('rock_boulder_dry_Diffuse',true);m.normalMap=natureTexture('rock_boulder_dry_nor_gl');m.normalScale=new THREE.Vector2(.75,.75);m.roughnessMap=natureTexture('rock_boulder_dry_Rough');m.color.lerp(new THREE.Color(0xffffff),.38);
  }
  m.name=`${kind} surface`;surfaces.set(key,m);return m;
}
export function rounded(w,h,d,material,x,y,z,parent,radius=.08){
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(radius,w/3,h/3,d/3)),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
// Static opaque decorations only. Matching layouts retain *every* attribute:
// extra UVs, vertex AO/colors, tangents and custom material data. Source geometry
// belongs to its creator (and may be shared outside this subtree); only scratch
// clones are disposed here. Callers own the resulting merged geometries.
function geometryLayout(geometry){
  return `${!!geometry.index}:`+Object.keys(geometry.attributes).sort().map(name=>{
    const a=geometry.attributes[name];
    return `${name}/${a.array.constructor.name}/${a.itemSize}/${a.normalized}/${a.gpuType}`;
  }).join('|');
}
function staticDecoration(mesh){
  const g=mesh.geometry,m=mesh.material;
  return mesh.isMesh&&!mesh.isInstancedMesh&&!mesh.isSkinnedMesh&&!mesh.children.length&&
    g?.attributes.position&&!Object.keys(g.morphAttributes).length&&!g.isInstancedBufferGeometry&&
    g.drawRange.start===0&&(g.drawRange.count===Infinity||g.drawRange.count===(g.index?.count??g.attributes.position.count))&&
    !Array.isArray(m)&&!m.transparent&&!m.transmission&&m.userData.staticBatching!==false&&
    (m.userData.staticBatching===true||!m.isShaderMaterial&&m.onBeforeCompile===THREE.Material.prototype.onBeforeCompile)&&
    mesh.userData.staticBatching!==false&&mesh.onBeforeRender===THREE.Object3D.prototype.onBeforeRender&&
    mesh.onAfterRender===THREE.Object3D.prototype.onAfterRender&&mesh.onBeforeShadow===THREE.Object3D.prototype.onBeforeShadow&&
    mesh.onAfterShadow===THREE.Object3D.prototype.onAfterShadow;
}
function bakedGeometry(source,matrix){
  const geometry=source.clone().applyMatrix4(matrix);
  // A mirrored object used to reverse front-face winding at draw time. Once its
  // transform is baked, preserve that winding and tangent-space handedness.
  if(matrix.determinant()<0){
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
    const index=geometry.index;
    for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
    const tangent=geometry.attributes.tangent;
    if(tangent)for(let i=0;i<tangent.count;i++)tangent.setW(i,-tangent.getW(i));
  }
  return geometry;
}
// A mixed cell should not spend a draw call on every tiny repeated pair of
// window trims or bolts. Merge those with compatible parts. Keep instancing
// when it saves meaningful storage, or when the whole bucket already fits one
// shared geometry draw. 64 KiB was measured against 16 KiB on the coastal kit;
// it reduced CPU/GPU time while retaining all geometry and the existing cells.
const MIN_INSTANCE_SAVINGS=64*1024;
function worthwhileInstances(geometry,count,batchCount){
  if(count===batchCount)return true;
  const bytes=Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,geometry.index?.array.byteLength??0);
  return (count-1)*bytes-count*16*4>=MIN_INSTANCE_SAVINGS;
}
export function batchDecorations(root,protectedMeshes=new Set(),skipRoots=new Set(),cellSize=Infinity){
  if(!(cellSize>0))throw new RangeError('Decoration cell size must be positive');
  root.updateWorldMatrix(true,true);const batches=new Map(),inverse=root.matrixWorld.clone().invert();
  const visit=o=>{
    if(skipRoots.has(o)||!o.visible||o.isLOD||o.isGroup&&o.renderOrder!==0)return;
    if(!protectedMeshes.has(o)&&staticDecoration(o)){
      const center=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      const matrix=new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld);
      // Nonindexed mirrored meshes gain an index to preserve their winding.
      const layout=geometryLayout(o.geometry).replace(/^false:/,matrix.determinant()<0?'true:':'false:');
      const key=`${o.material.uuid}:${o.castShadow}:${o.receiveShadow}:${o.layers.mask}:${o.renderOrder}:${o.frustumCulled}:${o.customDepthMaterial?.uuid}:${o.customDistanceMaterial?.uuid}:${layout}:${Math.floor(center.x/cellSize)},${Math.floor(center.z/cellSize)}`;
      if(!batches.has(key))batches.set(key,{source:o,meshes:[]});
      batches.get(key).meshes.push(o);
    }
    for(const child of o.children)visit(child);
  };for(const child of root.children)visit(child);
  const result={sourceMeshes:0,mergedMeshes:0,instancedMeshes:0};
  const publish=(mesh,sources,ownsGeometry)=>{
    const source=sources[0];mesh.name='Batched island detail';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
    mesh.layers.mask=source.layers.mask;mesh.renderOrder=source.renderOrder;mesh.frustumCulled=source.frustumCulled;
    mesh.customDepthMaterial=source.customDepthMaterial;mesh.customDistanceMaterial=source.customDistanceMaterial;
    mesh.userData.ownsGeometry=ownsGeometry;root.add(mesh);sources.forEach(old=>old.removeFromParent());result.sourceMeshes+=sources.length;
  };
  for(const b of batches.values()){
    if(b.meshes.length<2)continue;
    const repeated=new Map();
    for(const mesh of b.meshes){
      // InstancedMesh does not support negative instance scales.
      if(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld).determinant()<=0)continue;
      if(!repeated.has(mesh.geometry))repeated.set(mesh.geometry,[]);repeated.get(mesh.geometry).push(mesh);
    }
    const instanced=new Set();
    for(const [geometry,sources] of repeated){
      if(sources.length<2||!worthwhileInstances(geometry,sources.length,b.meshes.length))continue;
      const mesh=new THREE.InstancedMesh(geometry,b.source.material,sources.length);
      sources.forEach((source,i)=>{mesh.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld));instanced.add(source);});
      mesh.instanceMatrix.needsUpdate=true;setInstanceBounds(mesh);publish(mesh,sources,false);result.instancedMeshes++;
    }
    const sources=b.meshes.filter(mesh=>!instanced.has(mesh));if(sources.length<2)continue;
    const copies=sources.map(mesh=>bakedGeometry(mesh.geometry,new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));
    let geometry;try{geometry=mergeGeometries(copies);}finally{copies.forEach(g=>g.dispose());}
    if(!geometry)continue;
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    publish(new THREE.Mesh(geometry,b.source.material),sources,true);result.mergedMeshes++;
  }
  return result;
}
