import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchDecorations } from '../src/materials.js';
import { IslandFoliage, canopyLevel, CANOPY_WIND_PADDING, disposeFoliageTemplates } from '../src/nature-foliage.js';
import { setInstanceBounds } from '../src/instance-bounds.js';
import { World } from '../src/world.js';

function richQuad(){
  const geometry=new THREE.PlaneGeometry(2,2);
  geometry.setAttribute('uv1',geometry.attributes.uv.clone());geometry.setAttribute('uv2',geometry.attributes.uv.clone());
  geometry.setAttribute('color',new THREE.Uint8BufferAttribute([255,128,64,128,255,64,64,128,255,255,255,255],3,true));
  geometry.setAttribute('tangent',new THREE.Float32BufferAttribute([1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1],4));
  geometry.setAttribute('terrainMask',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0],2));
  return geometry;
}
function add(root,geometry,material,x=0){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=x;root.add(mesh);return mesh;}

test('decorations merge indexed geometry without losing normalized colors, UV channels or tangents',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});root.position.set(15,3,9);root.rotation.y=.4;
  const original=richQuad();add(root,original,material,2);add(root,original.clone(),material,5);
  const result=batchDecorations(root);assert.equal(result.mergedMeshes,1);assert.equal(root.children.length,1);
  const merged=root.children[0].geometry;assert.ok(merged.index);assert.equal(merged.attributes.position.count,8);assert.equal(merged.index.count,12);
  assert.deepEqual(Object.keys(merged.attributes).sort(),Object.keys(original.attributes).sort());
  for(const name of ['uv','uv1','uv2','color','terrainMask']){
    const expected=Array.from(original.attributes[name].array);
    assert.deepEqual(Array.from(merged.attributes[name].array),[...expected,...expected]);
  }
  assert.equal(merged.attributes.color.normalized,true);assert.equal(merged.attributes.color.array.constructor,Uint8Array);
  assert.ok(Math.abs(merged.attributes.position.getX(0)-(original.attributes.position.getX(0)+2))<1e-6);
  assert.ok(merged.boundingBox&&merged.boundingSphere);assert.equal(root.children[0].userData.ownsGeometry,true);
});

test('batch compatibility keeps missing attributes, layers, partial draws, transparency and visibility separate',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
  const rich=add(root,richQuad(),material),plain=add(root,new THREE.PlaneGeometry(),material),layer=add(root,richQuad(),material);layer.layers.set(2);
  const partial=add(root,richQuad(),material);partial.geometry.setDrawRange(0,3);
  const glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.5}),a=add(root,richQuad(),glass),b=add(root,richQuad(),glass);
  const hidden=new THREE.Group();hidden.visible=false;root.add(hidden);const hiddenChild=add(hidden,richQuad(),material);
  batchDecorations(root);
  for(const mesh of [rich,plain,layer,partial,a,b])assert.equal(mesh.parent,root);
  assert.equal(hiddenChild.parent,hidden);assert.equal(hidden.visible,false);
});

test('static batching preserves LOD hierarchies, group sorting and object-space shader hooks',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),lod=new THREE.LOD(),ordered=new THREE.Group();ordered.renderOrder=3;root.add(lod,ordered);
  const near=add(lod,richQuad(),material),far=add(lod,richQuad(),material),first=add(ordered,richQuad(),material),second=add(ordered,richQuad(),material);
  const custom=new THREE.MeshStandardMaterial();custom.onBeforeCompile=()=>{};
  const a=add(root,richQuad(),custom),b=add(root,richQuad(),custom);batchDecorations(root);
  for(const mesh of [near,far])assert.equal(mesh.parent,lod);for(const mesh of [first,second])assert.equal(mesh.parent,ordered);
  for(const mesh of [a,b])assert.equal(mesh.parent,root);
});

test('shared geometry is instanced without disposal, including references outside the batched subtree',()=>{
  const root=new THREE.Group(),outside=new THREE.Group(),geometry=richQuad(),material=new THREE.MeshStandardMaterial();let disposals=0;
  geometry.addEventListener('dispose',()=>disposals++);
  add(root,geometry,material,1);add(root,geometry,material,7);const survivor=add(outside,geometry,material,12);
  const protectedMesh=add(root,geometry,material,4);const result=batchDecorations(root,new Set([protectedMesh]));
  const instance=root.children.find(o=>o.isInstancedMesh);assert.equal(result.instancedMeshes,1);assert.equal(instance.count,2);assert.equal(instance.geometry,geometry);
  assert.equal(disposals,0);assert.equal(survivor.geometry,geometry);assert.equal(protectedMesh.parent,root);assert.equal(instance.userData.ownsGeometry,false);
  const matrix=new THREE.Matrix4();instance.getMatrixAt(1,matrix);assert.equal(matrix.elements[12],7);
});

test('mixed small repeated decorations share one draw while keeping every authored attribute and transform',()=>{
  const root=new THREE.Group(),outside=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});
  root.position.set(12,3,-4);root.rotation.y=.3;
  const first=richQuad(),second=richQuad();second.attributes.terrainMask.setXY(0,.25,.75);
  let disposals=0;for(const geometry of [first,second])geometry.addEventListener('dispose',()=>disposals++);
  const originals=[add(root,first,material,-3),add(root,first,material,0),add(root,second,material,3),add(root,second,material,6)];
  add(outside,first,material);const result=batchDecorations(root);
  assert.equal(result.mergedMeshes,1);assert.equal(result.instancedMeshes,0);assert.equal(root.children.length,1);assert.equal(disposals,0);
  const merged=root.children[0].geometry;assert.equal(merged.index.count,24);assert.equal(merged.attributes.position.count,16);
  for(let mesh=0;mesh<originals.length;mesh++)for(const name of ['uv','uv1','uv2','color','terrainMask']){
    const original=originals[mesh].geometry.attributes[name],actual=merged.attributes[name];
    assert.deepEqual(Array.from(actual.array.slice(mesh*original.array.length,(mesh+1)*original.array.length)),Array.from(original.array));
    assert.equal(actual.normalized,original.normalized);assert.equal(actual.array.constructor,original.array.constructor);
  }
  for(let mesh=0;mesh<originals.length;mesh++)for(let vertex=0;vertex<4;vertex++)assert.ok(Math.abs(merged.attributes.position.getX(mesh*4+vertex)-originals[mesh].geometry.attributes.position.getX(vertex)-originals[mesh].position.x)<1e-6);
});

test('mixed batching keeps shared instances for heavy pairs and numerous lightweight repeats',()=>{
  for(const [geometry,count]of [[new THREE.SphereGeometry(1,64,32),2],[richQuad(),400]]){
    const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
    // Match layouts while forcing a mixed material bucket with another source.
    const unique=geometry.clone();add(root,unique,material,-1);
    for(let i=0;i<count;i++)add(root,geometry,material,i);
    const result=batchDecorations(root),instance=root.children.find(mesh=>mesh.isInstancedMesh);
    assert.equal(result.instancedMeshes,1);assert.equal(instance.geometry,geometry);assert.equal(instance.count,count);assert.equal(instance.userData.ownsGeometry,false);
    assert.equal(root.children.length,2);assert.ok(root.children.some(mesh=>mesh.geometry===unique));
  }
});

test('small repeated meshes merged across mirror signs preserve front faces and tangent handedness',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometry=richQuad();
  for(const x of [-6,-2,2,6]){const mesh=add(root,geometry,material,x);if(x<0)mesh.scale.x=-1;}
  const result=batchDecorations(root);root.updateMatrixWorld(true);assert.equal(result.mergedMeshes,1);assert.equal(result.instancedMeshes,0);
  const merged=root.children[0];assert.equal(merged.geometry.index.count,24);
  for(const x of [-6,-2,2,6])assert.ok(new THREE.Raycaster(new THREE.Vector3(x,0,5),new THREE.Vector3(0,0,-1)).intersectObject(merged).length);
  for(let i=0;i<16;i++)assert.equal(merged.geometry.attributes.tangent.getW(i),i<8?-1:1);
});

test('batching preserves parents with children and source geometry ownership when merging',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometry=richQuad();let disposals=0;
  geometry.addEventListener('dispose',()=>disposals++);
  const parent=add(root,richQuad(),material),child=new THREE.Object3D();parent.add(child);child.position.set(2,3,4);
  add(root,geometry,material);add(root,geometry.clone(),material,3);
  batchDecorations(root);assert.equal(parent.parent,root);assert.equal(child.parent,parent);assert.equal(disposals,0);
});

test('mirrored transforms retain front-face ray hits and tangent handedness after merging',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),first=add(root,richQuad(),material,-2),second=add(root,richQuad(),material,2);
  first.scale.x=-1;second.scale.x=-1;root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(-2,0,5),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(first).length);
  batchDecorations(root);root.updateMatrixWorld(true);const merged=root.children[0];assert.ok(ray.intersectObject(merged).length);
  for(let i=0;i<merged.geometry.attributes.tangent.count;i++)assert.equal(merged.geometry.attributes.tangent.getW(i),-1);
});

test('instance bounds contain wind displacement after rotated nonuniform scales in any parent transform',()=>{
  const geometry=new THREE.BoxGeometry(2,4,1),mesh=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial(),2),dummy=new THREE.Object3D();
  for(let i=0;i<2;i++){dummy.position.set(i*23,3,-i*14);dummy.rotation.set(.2,i*.7,.15);dummy.scale.set(1+i,3,.4);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
  setInstanceBounds(mesh,CANOPY_WIND_PADDING);const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let i=0;i<2;i++){
    mesh.getMatrixAt(i,matrix);
    for(const x of [-1,1])for(const y of [-2,2])for(const z of [-.5,.5])for(const dx of [-.123,.123])for(const dz of [-.055,.055]){
      point.set(x+dx,y,z+dz).applyMatrix4(matrix);assert.ok(mesh.boundingBox.containsPoint(point));assert.ok(mesh.boundingSphere.containsPoint(point));
    }
  }
  mesh.position.set(100,9,-20);mesh.rotation.y=.8;mesh.scale.set(2,1,3);mesh.updateMatrixWorld(true);
  const worldBox=mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);assert.ok(worldBox.containsPoint(point.applyMatrix4(mesh.matrixWorld)));
});

test('spatial foliage batches retain every branch and canopy beyond former capacity and far distance',()=>{
  const foliage=new IslandFoliage();let collision;
  for(let i=0;i<75;i++)collision=foliage.addTree(4,0,4,1,false);
  foliage.addTree(150,0,4,1,false);foliage.update(0,{position:new THREE.Vector3(4,5,4)});
  assert.equal(collision.visible,false);assert.equal(collision.userData.instancedVisual,true);assert.equal(collision.parent,foliage);
  assert.equal(foliage.branchBatches.reduce((sum,m)=>sum+m.count,0),76);assert.ok(foliage.branchBatches.some(m=>m.count===75));
  assert.equal(foliage.batches.reduce((sum,m)=>sum+m.count,0),76);const detailed=foliage.leafCount;
  foliage.update(1,{position:new THREE.Vector3(2000,5,2000)});
  assert.equal(foliage.batches.reduce((sum,m)=>sum+m.count,0),76);assert.ok(foliage.leafCount>0&&foliage.leafCount<detailed);
  assert.ok(foliage.batches.filter(m=>m.count).every(m=>m.userData.level===2&&m.castShadow&&m.frustumCulled));
  foliage.dispose();
});

test('canopy LOD hysteresis resists threshold jitter and supports large camera jumps',()=>{
  const distance=60,near=distance*.55,far=distance*1.3;
  for(const d of [near-2,near+2]){assert.equal(canopyLevel(d,0,distance),0);assert.equal(canopyLevel(d,1,distance),1);}
  for(const d of [far-3,far+3]){assert.equal(canopyLevel(d,1,distance),1);assert.equal(canopyLevel(d,2,distance),2);}
  assert.equal(canopyLevel(1000,0,distance),2);assert.equal(canopyLevel(0,2,distance),0);
});

test('foliage visibility works independently for main, reflected and shadow cameras',()=>{
  const foliage=new IslandFoliage();foliage.addTree(-120,0,0,1,false);foliage.addTree(120,0,0,1,false);
  foliage.update(0,{position:new THREE.Vector3()});foliage.updateMatrixWorld(true);
  const visible=facing=>{
    const camera=new THREE.PerspectiveCamera(45,1,.1,300);camera.position.set(0,4,0);camera.lookAt(facing,4,0);camera.updateMatrixWorld(true);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    return foliage.batches.filter(m=>m.visible&&frustum.intersectsObject(m));
  };
  const left=visible(-120),right=visible(120);assert.equal(left.length,1);assert.equal(right.length,1);assert.notEqual(left[0],right[0]);
  const light=new THREE.OrthographicCamera(-10,10,10,-10,.1,60);light.position.set(120,30,0);light.lookAt(120,0,0);light.updateMatrixWorld(true);
  const shadow=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(light.projectionMatrix,light.matrixWorldInverse));
  assert.ok(shadow.intersectsObject(right[0]));assert.ok(!shadow.intersectsObject(left[0]));
  foliage.dispose();
});

test('leaf color, depth and point-light distance shaders use matching wind and alpha cutouts with guarded patches',()=>{
  const foliage=new IslandFoliage();foliage.addTree(0,0,0,1,false);foliage.update(0,{position:new THREE.Vector3()});
  const mesh=foliage.batches.find(m=>m.count),shaders=[];
  for(const [material,source] of [[mesh.material,THREE.ShaderLib.standard],[mesh.customDepthMaterial,THREE.ShaderLib.depth],[mesh.customDistanceMaterial,THREE.ShaderLib.distanceRGBA]]){
    assert.equal(material.map,mesh.material.map);assert.equal(material.alphaTest,mesh.material.alphaTest);
    const shader={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);shaders.push(shader);
    assert.equal(shader.uniforms.leafTime,foliage.time);assert.ok(shader.vertexShader.includes('transformed.x+=sin(leafTime*.95'));
    assert.throws(()=>material.onBeforeCompile({vertexShader:'void main(){}',fragmentShader:source.fragmentShader,uniforms:{}}),/canopy wind position/);
  }
  const deformation=shader=>shader.vertexShader.slice(shader.vertexShader.indexOf('vec4 leafWorld'),shader.vertexShader.indexOf('#include <morphtarget_vertex>'));
  assert.equal(deformation(shaders[0]),deformation(shaders[1]));assert.equal(deformation(shaders[0]),deformation(shaders[2]));foliage.dispose();
});

test('foliage disposal releases instance buffers and owned materials without invalidating another world',()=>{
  const first=new IslandFoliage(),second=new IslandFoliage();first.addTree(0,0,0,1,false);second.addTree(0,0,0,1,false);
  for(const foliage of [first,second])foliage.update(0,{position:new THREE.Vector3()});
  assert.equal(first.branchBatches[0].geometry,second.branchBatches[0].geometry);
  let geometries=0,textures=0,instances=0,materials=0;
  first.branchBatches[0].geometry.addEventListener('dispose',()=>geometries++);first.texture.addEventListener('dispose',()=>textures++);
  first.branchBatches[0].addEventListener('dispose',()=>instances++);first.bark.addEventListener('dispose',()=>materials++);
  first.dispose();first.dispose();assert.equal(geometries,0);assert.equal(textures,0);assert.equal(instances,1);assert.equal(materials,1);
  second.update(1,{position:new THREE.Vector3(20,5,20)});assert.ok(second.leafCount>0);second.dispose();
});

test('clearing the template cache keeps live foliage valid and the next world receives fresh templates',()=>{
  const first=new IslandFoliage(),second=new IslandFoliage();const original=first.addTree(0,0,0,1,false).geometry;second.addTree(0,0,0,1,false);
  let disposals=0;original.addEventListener('dispose',()=>disposals++);disposeFoliageTemplates();assert.equal(disposals,0);
  first.dispose();assert.equal(disposals,0);assert.equal(second.addTree(0,0,0,1,false).geometry,original);
  second.update(0,{position:new THREE.Vector3()});assert.ok(second.leafCount>0);
  const fresh=new IslandFoliage();assert.notEqual(fresh.addTree(0,0,0,1,false).geometry,original);second.dispose();fresh.dispose();
});

test('the actual Sunhaven map batches its static environment without deleting visible content',()=>{
  const world=new World(new THREE.Scene(),'sunhaven');
  const excluded=new Set([world.ground,world.foliage,world.meadowGrass,world.dynamic,world.water,world.sky,...world.clouds,...world.flags]);
  let submissions=0,triangles=0,instanceBytes=0;const geometries=new Set();
  const visit=object=>{
    if(excluded.has(object)||!object.visible)return;
    if(object.isMesh){submissions++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);geometries.add(object.geometry);instanceBytes+=object.instanceMatrix?.array.byteLength??0;}
    object.children.forEach(visit);
  };
  visit(world.scene);
  // The detailed coastal kit measured 610 unculled submissions versus 921 with
  // pair-by-pair instancing, and 713,500 triangles in either case. Keep headroom
  // for art iteration while catching a regression to many tiny instance draws.
  assert.ok(submissions<750,`static environment needs ${submissions} submissions`);
  assert.ok(triangles>650000,'detailed buildings, boardwalks and props remain present');
  const geometryBytes=[...geometries].reduce((sum,g)=>sum+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),instanceBytes);
  assert.ok(geometryBytes<16*1024*1024,`static scene geometry and instance buffers need ${geometryBytes} bytes`);
  assert.ok(world.solidVisuals.children.length<40,'permanent collision visuals are batched');
  assert.ok(world.solids.length>=350,'gameplay solids remain independently raycastable');
  world.foliage.dispose();world.ground.dispose();world.water.dispose();
});
