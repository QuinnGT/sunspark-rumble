import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TerrainHeightfield } from '../src/terrain-heightfield.js';
import { createTerrainChunks,createMapTerrain } from '../src/terrain-surface.js';
import { mapTerrain,MAPS,breezyHeightSource,sunhavenHeightSource } from '../src/maps.js';
import { terrainMaterial } from '../src/nature-ground.js';
import { TERRAIN_LAYERS,terrainLayerWeights,terrainProjectionWeights,terrainWetness } from '../src/terrain-layers.js';
import { createWaterDepth,SEA_LEVEL } from '../src/nature-water.js';

test('terrain interpolation follows the rendered diagonal, including both halves and cell boundaries',()=>{
  const field=new TerrainHeightfield((x,z)=>x===1&&z===1?4:0,{extent:2,spacing:2,chunkCells:1});
  assert.equal(field.heightAt(-.5,-.5),0,'bilinear interpolation would incorrectly raise this triangle');
  assert.equal(field.heightAt(.5,.5),2);assert.equal(field.heightAt(0,0),0);assert.equal(field.heightAt(1,1),4);
  const root=createTerrainChunks(field,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();
  root.updateMatrixWorld(true);
  for(const [x,z] of [[-.5,-.5],[.5,.5],[0,0],[1,.2],[-1,1]]){
    ray.set(new THREE.Vector3(x,10,z),new THREE.Vector3(0,-1,0));
    assert.ok(Math.abs(ray.intersectObject(root)[0].point.y-field.heightAt(x,z))<1e-6);
  }
  root.dispose();
});

test('chunk seams share bit-identical positions, shading normals, masks and color',()=>{
  const field=new TerrainHeightfield((x,z)=>Math.sin(x)*2+Math.cos(z*.5),{extent:12,spacing:1,chunkCells:4});
  const root=createTerrainChunks(field,new THREE.MeshBasicMaterial(),(x,y,z)=>({color:new THREE.Color((x+6)/12,.4,(z+6)/12),mask:[.1,(x+6)/12,(z+6)/12]}));
  const seen=new Map();let seams=0;
  for(const mesh of root.children){
    const g=mesh.geometry;assert.ok(g.index,'retain shared indexed vertices');assert.ok(mesh.frustumCulled);assert.ok(g.boundingBox&&g.boundingSphere);
    for(let i=0;i<g.attributes.position.count;i++){
      const p=g.attributes.position,key=`${p.getX(i)},${p.getZ(i)}`,values=['position','normal','terrainMask','color'].flatMap(name=>Array.from(g.attributes[name].array.slice(i*3,i*3+3)));
      if(seen.has(key)){assert.deepEqual(values,seen.get(key));seams++;}else seen.set(key,values);
      assert.ok(Math.abs(Math.hypot(...values.slice(3,6))-1)<1e-6);
    }
  }
  assert.ok(seams>40);assert.equal(root.children.length,9);root.dispose();
});

test('exact terrain rays agree with triangle raycasts, including narrow crests and chunk crossings',()=>{
  const field=new TerrainHeightfield((x,z)=>Math.max(0,5-Math.abs(x)*8)+Math.sin(z*2),{extent:12,spacing:.5,chunkCells:4});
  const root=createTerrainChunks(field,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();let hitCount=0;
  const cases=[[[ -5,3,0],[1,0,0]],[[5,3,0],[-1,0,0]],[[0,20,0],[0,-1,0]],[[0,-10,0],[0,1,0]],[[6,10,6],[0,-1,0]],[[8,2,0],[-1,0,0]],[[8,20,8],[0,-1,0]]];
  for(let i=0;i<120;i++)cases.push([[Math.sin(i*4.1)*8,3+Math.cos(i*2.1)*8,Math.cos(i*2.7)*8],[Math.sin(i*.72),-.2+Math.cos(i*.3),Math.cos(i*.81)]]);
  for(const [from,toward] of cases){
    const origin=new THREE.Vector3(...from),direction=new THREE.Vector3(...toward).normalize();ray.set(origin,direction);ray.far=30;
    const actual=field.raycast(origin,direction,30),expected=ray.intersectObject(root)[0];
    assert.equal(!!actual,!!expected,JSON.stringify({from,toward,actual,expected:expected?.point}));
    if(expected){hitCount++;assert.ok(Math.abs(actual.distance-expected.distance)<2e-5);assert.ok(Math.abs(actual.point.y-field.heightAt(actual.point.x,actual.point.z))<2e-5);}
  }
  assert.ok(hitCount>20);root.dispose();
});

test('both map renderers and water depth use the authoritative sampled surface without changing authored pads',()=>{
  for(const [id,source] of [['breezy',breezyHeightSource],['sunhaven',sunhavenHeightSource]]){
    const map=MAPS[id],field=mapTerrain(map),ground=createMapTerrain(map),ray=new THREE.Raycaster();ground.updateMatrixWorld(true);
    assert.equal(field,ground.userData.heightfield);assert.ok(ground.children.length>1);
    for(const [x,z,y] of map.pads)assert.ok(Math.abs(map.heightAt(x,z)-source(x,z))<1e-5,'authored pad center is sampled exactly');
    for(let i=0;i<70;i++){
      const x=Math.sin(i*1.2)*map.radius,z=Math.cos(i*3.1)*map.radius;
      assert.ok(Math.abs(map.heightAt(x,z)-source(x,z))<.25,'sampling preserves the established landforms');
      ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));
      assert.ok(Math.abs(ray.intersectObject(ground)[0].point.y-map.heightAt(x,z))<1e-5,'movement and the visible surface agree');
    }
    const size=16,depth=createWaterDepth(map.heightAt,size,map.waterExtent);
    for(let iz=0;iz<size;iz++)for(let ix=0;ix<size;ix++){
      const x=(ix/(size-1)-.5)*map.waterExtent,z=(iz/(size-1)-.5)*map.waterExtent;
      const expected=Math.round(Math.min(1,Math.max(0,SEA_LEVEL-map.heightAt(x,z))/8)*255);
      assert.ok(Math.abs(depth.image.data[(iz*size+ix)*4]-expected)<=1);
    }
    depth.dispose();ground.dispose();
  }
});

test('terrain material uses matched layer masks, physical repeat, wetness and linear data channels',()=>{
  assert.deepEqual(terrainLayerWeights([0,0,0]),[1,0,0,0]);assert.deepEqual(terrainLayerWeights([1,1,1]),[0,0,1,0]);assert.deepEqual(terrainLayerWeights([0,0,1]),[0,0,0,1]);
  assert.ok(Math.abs(terrainLayerWeights([.2,.3,.4]).reduce((a,b)=>a+b)-1)<1e-12);
  assert.deepEqual(terrainProjectionWeights([1,0,0]),[1,0,0]);assert.deepEqual(terrainProjectionWeights([0,1,0]),[0,1,0]);assert.deepEqual(terrainProjectionWeights([0,0,-1]),[0,0,1]);
  assert.equal(terrainWetness(-1.2),1);assert.equal(terrainWetness(0),0);assert.ok(terrainWetness(-.8)>terrainWetness(-.4));
  for(const masked of [false,true]){
    const material=terrainMaterial(masked),shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
    assert.deepEqual(shader.uniforms.terrainScale.value.toArray(),TERRAIN_LAYERS.map(layer=>layer.repeatsPerMeter));
    assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(material.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(material.roughnessMap.colorSpace,THREE.NoColorSpace);
    for(const layer of TERRAIN_LAYERS.slice(1)){
      for(const [suffix,property,colorSpace] of [['Map','color',THREE.SRGBColorSpace],['Normal','normal',THREE.NoColorSpace],['Roughness','roughness',THREE.NoColorSpace]]){
        const texture=shader.uniforms[layer.id+suffix].value;assert.equal(texture.name,layer[property]);assert.equal(texture.colorSpace,colorSpace);
      }
      const cap=layer.id[0].toUpperCase()+layer.id.slice(1),uv=`terrain${cap}UV`;
      for(const suffix of ['Map','Normal','Roughness'])assert.ok(shader.fragmentShader.includes(`${layer.id+suffix},${uv},terrainProjection,terrainSign`),'every channel shares projection and physical scale');
    }
    assert.ok(!shader.fragmentShader.includes('#include <roughnessmap_fragment>'));assert.ok(shader.fragmentShader.includes('.g*terrainWeights.'));
    assert.ok(shader.fragmentShader.includes('terrainWet*.65'));assert.ok(shader.fragmentShader.includes('terrainWet*.25'));
    assert.throws(()=>material.onBeforeCompile({vertexShader:'void main(){}',fragmentShader:'',uniforms:{}}),/terrain.world-position-normal/);
    material.dispose();
  }
});
