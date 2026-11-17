import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MAPS } from '../src/maps.js';
import { IslandWater, SEA_LEVEL } from '../src/nature-water.js';
import { NatureRenderer } from '../src/nature-renderer.js';
import { RenderProfiler, profileRenderPass } from '../src/render-profiler.js';
import { sceneColorTarget, prepareSceneTarget, scaledTargetSize, estimateRenderTargetBytes } from '../src/render-targets.js';

function stubRenderer(){
  let target=null;
  return {isWebGLRenderer:true,shadowMap:{autoUpdate:true,needsUpdate:true},xr:{enabled:true},getDrawingBufferSize:v=>v.set(1600,900),getRenderTarget:()=>target,setRenderTarget:value=>target=value,clear(){},render(){}};
}

test('inland-facing harbor sees refraction and reflection; dry and sky views skip passes',()=>{
  const water=new IslandWater(MAPS.sunhaven.heightAt,MAPS.sunhaven),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,16/9,.1,600),renderer=stubRenderer();scene.add(water);
  camera.position.set(108,6,26);camera.lookAt(95,SEA_LEVEL,26);camera.updateMatrixWorld(true);water.setQuality('high');water.update(1);
  assert.ok(camera.position.dot(camera.getWorldDirection(new THREE.Vector3()))<-8,'fixture faces inland and formerly failed radial gate');
  water.refractCoast(renderer,scene,camera);water.reflectCoast(renderer,scene,camera);
  assert.equal(water.refractionPasses,1);assert.equal(water.reflectionPasses,1);
  camera.position.set(0,8,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);water.update(2);water.refractCoast(renderer,scene,camera);water.reflectCoast(renderer,scene,camera);
  assert.equal(water.refractionPasses,1);assert.equal(water.reflectionPasses,1);
  camera.lookAt(0,100,1);camera.updateMatrixWorld(true);assert.equal(water.coastVisible(camera),false);
  water.dispose();
});

test('water visibility is conservative for multiple views, with a projected area cutoff',()=>{
  const water=new IslandWater(MAPS.sunhaven.heightAt,MAPS.sunhaven),wet=new THREE.PerspectiveCamera(62,16/9,.1,600),dry=wet.clone();
  wet.position.set(108,6,26);wet.lookAt(95,SEA_LEVEL,26);wet.updateMatrixWorld(true);
  dry.position.set(0,8,0);dry.lookAt(0,0,0);dry.updateMatrixWorld(true);
  assert.equal(water.waterVisibility.isVisible(dry),false);assert.equal(water.waterVisibility.isVisible(new THREE.ArrayCamera([dry,wet])),true);
  // A one-square-unit water patch in a 100x100 orthographic view is too small.
  const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,100);camera.position.set(0,10,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  water.waterVisibility.boxes=[new THREE.Box3(new THREE.Vector3(-.5,SEA_LEVEL,-.5),new THREE.Vector3(.5,SEA_LEVEL,.5))];
  assert.equal(water.waterVisibility.isVisible(camera,.01),false);assert.equal(water.waterVisibility.isVisible(camera,.00001),true);water.dispose();
});

test('distant visible ocean uses analytic fallback while nearby inland-facing inlet keeps detailed passes',()=>{
  const water=new IslandWater(MAPS.sunhaven.heightAt,MAPS.sunhaven),renderer=stubRenderer(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,16/9,.1,600);
  camera.position.set(0,8,0);camera.lookAt(100,SEA_LEVEL,26);camera.updateMatrixWorld(true);
  assert.equal(water.waterVisibility.isVisible(camera),true,'distant ocean remains in the camera frustum');
  for(const quality of ['balanced','high']){
    water.setQuality(quality);water.refractCoast(renderer,scene,camera);water.reflectCoast(renderer,scene,camera);
    assert.equal(water.coastVisible(camera),false,'village camera has no nearby submerged tile');assert.equal(water.refractionPasses,0);assert.equal(water.reflectionPasses,0);
  }
  camera.position.set(108,6,26);camera.lookAt(95,SEA_LEVEL,26);camera.updateMatrixWorld(true);water.update(1);
  assert.equal(water.coastVisible(camera),true);water.refractCoast(renderer,scene,camera);water.reflectCoast(renderer,scene,camera);
  assert.equal(water.refractionPasses,1);assert.equal(water.reflectionPasses,1);water.dispose();
});

test('offscreen color is linear HDR; unsupported targets skip instead of clamping color',()=>{
  const target=sceneColorTarget('test',{depthTexture:true,samples:4});
  assert.equal(target.texture.colorSpace,THREE.LinearSRGBColorSpace);assert.equal(target.texture.type,THREE.HalfFloatType);
  assert.equal(estimateRenderTargetBytes(target),8*8*(8+4)*5,'RGBA16F + depth32 + four multisample attachments');
  const renderer={extensions:{has:()=>false},capabilities:{maxSamples:2}};target.setSize(640,360);assert.equal(prepareSceneTarget(renderer,target),false);
  assert.equal(target.texture.type,THREE.HalfFloatType);assert.equal(target.width,8);
  renderer.extensions.has=()=>true;assert.equal(prepareSceneTarget(renderer,target),true);assert.equal(target.samples,2);
  assert.deepEqual(scaledTargetSize(7680,4320,.7,1600),[1600,900]);
  target.dispose();
});

test('without HDR render targets contact uses direct rendering and water uses analytic fallback',()=>{
  const renderer=stubRenderer(),water=new IslandWater(MAPS.sunhaven.heightAt,MAPS.sunhaven),nature=new NatureRenderer(renderer),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,16/9,.1,600);let draws=0;
  renderer.extensions={has:()=>false};renderer.render=()=>draws++;renderer.setRenderTarget=()=>{throw new Error('unsupported target was bound');};
  camera.position.set(108,6,26);camera.lookAt(95,SEA_LEVEL,26);camera.updateMatrixWorld(true);
  nature.setQuality({contactShadows:true});nature.render(scene,camera);assert.equal(draws,1);assert.equal(nature.enabled,false);assert.equal(nature.diagnostics().hdrSupported,false);
  water.setQuality('high');water.refractCoast(renderer,scene,camera);water.reflectCoast(renderer,scene,camera);
  assert.equal(draws,1);assert.equal(water.refractionPasses,0);assert.equal(water.reflectionPasses,0);assert.equal(water.material.uniforms.refracting.value,0);assert.equal(water.material.uniforms.reflectionStrength.value,0);assert.equal(water.diagnostics().hdrSupported,false);
  nature.dispose();water.dispose();
});

test('quality transitions release water and contact allocations, and disposed resources stay disposed',()=>{
  const water=new IslandWater(MAPS.sunhaven.heightAt,MAPS.sunhaven),renderer=stubRenderer(),nature=new NatureRenderer(renderer),camera=new THREE.PerspectiveCamera(62,16/9,.1,600);
  camera.position.set(108,6,26);camera.lookAt(95,SEA_LEVEL,26);camera.updateMatrixWorld(true);
  renderer.getDrawingBufferSize=v=>v.set(7680,4320);water.refractCoast(renderer,new THREE.Scene(),camera);water.reflectCoast(renderer,new THREE.Scene(),camera);
  assert.equal(water.refractionTarget.width,1600);assert.ok(water.target.width<=768);
  nature.target.setSize(1600,900);nature.setQuality({contactShadows:false});water.setQuality('low');
  assert.equal(nature.target.width,8);assert.equal(water.refractionTarget.width,8);assert.equal(water.target.width,8);
  let depthDisposals=0,waterDisposals=0,contactDisposals=0,sharedDisposals=0;
  water.material.uniforms.depthMap.value.addEventListener('dispose',()=>depthDisposals++);
  water.material.uniforms.rippleMap.value.addEventListener('dispose',()=>sharedDisposals++);
  water.target.addEventListener('dispose',()=>waterDisposals++);nature.target.addEventListener('dispose',()=>contactDisposals++);
  water.dispose();water.dispose();nature.dispose();nature.dispose();nature.setQuality({contactShadows:true});
  assert.equal(depthDisposals,1);assert.equal(waterDisposals,1);assert.equal(contactDisposals,1);assert.equal(sharedDisposals,0);assert.equal(nature.enabled,false);
});

test('failed reflection/contact passes restore target face/mip and object visibility',()=>{
  const renderer=stubRenderer(),previous={name:'cube target'},calls=[];renderer.setRenderTarget=(...args)=>calls.push(args);renderer.getRenderTarget=()=>previous;renderer.getActiveCubeFace=()=>3;renderer.getActiveMipmapLevel=()=>2;
  renderer.render=()=>{throw new Error('draw failure');};
  const water=new IslandWater(MAPS.sunhaven.heightAt,MAPS.sunhaven),camera=new THREE.PerspectiveCamera(62,16/9,.1,600),excluded=new THREE.Group();excluded.visible=false;water.exclude=[excluded];water.visible=false;
  camera.position.set(108,6,26);camera.lookAt(95,SEA_LEVEL,26);camera.updateMatrixWorld(true);
  assert.throws(()=>water.reflectCoast(renderer,new THREE.Scene(),camera),/draw failure/);assert.deepEqual(calls.at(-1),[previous,3,2]);
  assert.equal(water.visible,false);assert.equal(excluded.visible,false);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.needsUpdate,true);assert.equal(water.nextReflection,0);assert.equal(water.material.uniforms.reflectionStrength.value,0);
  const nature=new NatureRenderer(renderer);nature.setQuality({contactShadows:true});assert.throws(()=>nature.render(new THREE.Scene(),camera),/draw failure/);assert.deepEqual(calls.at(-1),[previous,3,2]);
  water.dispose();nature.dispose();
});

function countingRenderer(gl){
  return {info:{autoReset:true,render:{calls:0,triangles:0,points:0,lines:0},memory:{textures:4},programs:[],reset(){for(const key of Object.keys(this.render))this.render[key]=0;}},getContext:()=>gl,shadowMap:{render(){}}};
}

test('whole-frame pass accounting subtracts nested water and shadows, even after a failed draw',()=>{
  const renderer=countingRenderer(),original=renderer.shadowMap.render;let time=0;
  renderer.shadowMap.render=()=>{renderer.info.render.calls+=2;renderer.info.render.triangles+=20;time+=1;};
  const shadow=renderer.shadowMap.render,profiler=new RenderProfiler(renderer,{clock:()=>time,gpu:false});
  profiler.beginFrame(1/60);time+=3;
  assert.throws(()=>profileRenderPass(renderer,'main',()=>{
    renderer.shadowMap.render();renderer.info.render.calls+=4;renderer.info.render.triangles+=40;time+=2;
    profileRenderPass(renderer,'refraction',()=>{renderer.info.render.calls+=3;renderer.info.render.triangles+=30;time+=1;});
    throw new Error('drawing failed');
  }),/drawing failed/);
  profileRenderPass(renderer,'contact',()=>{renderer.info.render.calls++;renderer.info.render.triangles++;time+=1;});profiler.endFrame();
  const stats=profiler.snapshot();assert.equal(stats.total.calls,10);assert.equal(stats.total.triangles,91);assert.equal(stats.passes.main.calls,4);assert.equal(stats.passes.shadow.calls,2);assert.equal(stats.passes.refraction.calls,3);assert.equal(stats.passes.contact.calls,1);
  assert.equal(stats.cpuMs,8);assert.equal(stats.passes.main.cpuMs,2);assert.equal(stats.gpu.status,'unsupported');assert.equal(stats.frameTimes.p95,1000/60);
  profiler.dispose();assert.equal(renderer.shadowMap.render,shadow);assert.equal(renderer.info.autoReset,true);renderer.shadowMap.render=original;
});

function timerContext(){
  let id=0;
  const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,CURRENT_QUERY:5,available:false,disjoint:false,resultReads:0,deleted:[],getExtension:()=>ext,getParameter:()=>gl.disjoint,getQuery:()=>null,createQuery:()=>({id:++id}),beginQuery(){},endQuery(){},isContextLost:()=>false,getQueryParameter(query,key){if(key===gl.QUERY_RESULT_AVAILABLE)return gl.available;gl.resultReads++;return 2500000;},deleteQuery(query){gl.deleted.push(query);}};return gl;
}

test('GPU timing polls availability without waiting and drops all disjoint results',()=>{
  const gl=timerContext(),profiler=new RenderProfiler(countingRenderer(gl));
  profiler.beginFrame(1/60);profiler.beginRender();profiler.endFrame();profiler.pollGPU();
  assert.equal(gl.resultReads,0);assert.equal(profiler.snapshot().gpu.pending,1);
  gl.available=true;profiler.pollGPU();assert.equal(profiler.snapshot().gpu.ms,2.5);assert.equal(profiler.snapshot().gpu.frame,1);
  profiler.beginFrame(1/60);profiler.beginRender();profiler.endFrame();gl.disjoint=true;profiler.pollGPU();
  assert.equal(gl.resultReads,1);assert.equal(profiler.snapshot().gpu.ms,null);assert.equal(profiler.snapshot().gpu.status,'disjoint');assert.equal(profiler.snapshot().gpu.pending,0);assert.equal(gl.deleted.length,2);profiler.dispose();
});

test('GPU query backlog is bounded and disposal releases outstanding queries',()=>{
  const gl=timerContext(),profiler=new RenderProfiler(countingRenderer(gl),{historySize:3});
  for(let i=0;i<12;i++){profiler.beginFrame(1/60);profiler.beginRender();profiler.endFrame();}
  assert.equal(profiler.snapshot().gpu.pending,4);assert.equal(profiler.snapshot().cpuTimes.samples,3);assert.equal(gl.resultReads,0);profiler.dispose();assert.equal(gl.deleted.length,4);
});

test('quality reset and context loss discard GPU samples without touching another timer owner',()=>{
  const gl=timerContext(),profiler=new RenderProfiler(countingRenderer(gl));
  gl.getQuery=()=>({external:true});profiler.beginFrame(1/60);profiler.beginRender();profiler.endFrame();assert.equal(profiler.snapshot().gpu.pending,0);
  gl.getQuery=()=>null;profiler.beginFrame(1/60);profiler.beginRender();profiler.endFrame();profiler.reset();assert.equal(gl.deleted.length,1);assert.equal(profiler.snapshot().gpu.ms,null);assert.equal(profiler.snapshot().frameTimes.samples,0);
  profiler.beginFrame(1/60);profiler.beginRender();profiler.endFrame();gl.isContextLost=()=>true;profiler.pollGPU();
  assert.equal(profiler.snapshot().gpu.status,'context-lost');assert.equal(profiler.snapshot().gpu.pending,0);assert.equal(gl.resultReads,0);profiler.dispose();
});
