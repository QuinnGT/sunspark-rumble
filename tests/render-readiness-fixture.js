// Standalone, deterministic pipeline reference. Bundled by browser-render-readiness.
import * as THREE from 'three';
import { NatureRenderer } from '../src/nature-renderer.js';
import { IslandWater,createIslandSky,SEA_LEVEL } from '../src/nature-water.js';
import { terrainMaterial } from '../src/nature-ground.js';
import { TerrainHeightfield } from '../src/terrain-heightfield.js';
import { createTerrainChunks } from '../src/terrain-surface.js';
import { graphicsProfile } from '../src/graphics.js';
import { prepareNatureAssets,natureTextureDiagnostics } from '../src/nature-assets.js';
import { shaderDiagnostics } from '../src/shader-patches.js';
import { RenderProfiler } from '../src/render-profiler.js';

async function boot(){
  const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,640);renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const nature=new NatureRenderer(renderer),profiler=new RenderProfiler(renderer),colors=new THREE.Scene(),shore=new THREE.Scene(),layers=new THREE.Scene();
  for(const scene of [colors,shore,layers]){scene.background=new THREE.Color(0xaccbdb);scene.add(new THREE.HemisphereLight(0xffffff,0x566644,2));const light=new THREE.DirectionalLight(0xffefca,3);light.position.set(-10,24,14);scene.add(light);}
  const swatches=[],palette=[[.018,.018,.018],[.18,.18,.18],[.6,.15,.05],[.025,.12,.65],[1,1,1],[4,4,4],[3,.4,.03],[.1,1.6,.4]];
  palette.forEach((rgb,i)=>{const swatch=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6),new THREE.MeshBasicMaterial({color:new THREE.Color(...rgb)}));swatch.position.set((i%4-1.5)*2.2,(i<4?1:-1)*1.2,0);colors.add(swatch);swatches.push(swatch);});
  const colorCamera=new THREE.PerspectiveCamera(48,1.5,.1,100);colorCamera.position.set(0,0,12);colorCamera.lookAt(0,0,0);colorCamera.updateMatrixWorld(true);
  const field=new TerrainHeightfield((x,z)=>SEA_LEVEL+.10*x+2.2*Math.exp(-((x-11)**2+(z+5)**2)/18),{extent:64,spacing:.5,chunkCells:16});
  const terrain=createTerrainChunks(field,terrainMaterial(true),(x,y,z)=>({color:new THREE.Color(y<.2?0xe8d4a3:0x9bb86a),mask:y<.2?[1,0,0]:z>4?[0,1,0]:x>8&&z<0?[0,0,1]:[0,0,0]}));shore.add(terrain,createIslandSky());
  const water=new IslandWater(field.heightAt,{shore:28,waterExtent:64});shore.add(water);
  const pier=new THREE.Mesh(new THREE.BoxGeometry(2.2,.35,10),new THREE.MeshStandardMaterial({color:0xa16f42,roughness:.7}));pier.position.set(-1,.5,3);shore.add(pier);
  const shorelineCamera=new THREE.PerspectiveCamera(54,1.5,.1,250);shorelineCamera.position.set(-15,9,20);shorelineCamera.lookAt(2,-.3,0);shorelineCamera.updateMatrixWorld(true);
  const maskValues=[[0,0,0],[0,1,0],[1,0,0],[0,0,1]];
  for(let i=0;i<4;i++){
    const geometry=new THREE.BoxGeometry(3,4,3,1,4,1),count=geometry.attributes.position.count;
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(count).fill([1,1,1]).flat(),3));geometry.setAttribute('terrainMask',new THREE.Float32BufferAttribute(Array(count).fill(maskValues[i]).flat(),3));
    const sample=new THREE.Mesh(geometry,terrainMaterial(true));sample.position.set((i-1.5)*4,.7,0);sample.rotation.y=.35;layers.add(sample);
  }
  const layerCamera=new THREE.PerspectiveCamera(48,1.5,.1,100);layerCamera.position.set(11,8,20);layerCamera.lookAt(0,.5,0);layerCamera.updateMatrixWorld(true);
  await prepareNatureAssets(renderer);
  for(const [scene,camera] of [[colors,colorCamera],[shore,shorelineCamera],[layers,layerCamera]])await renderer.compileAsync(scene,camera);
  let time=0;
  const draw=(mode,quality='high',ao=.5)=>{
    const scene=mode==='colors'?colors:mode==='layers'?layers:shore,camera=mode==='colors'?colorCamera:mode==='layers'?layerCamera:shorelineCamera;
    nature.setQuality(graphicsProfile(quality));nature.uniforms.strength.value=ao;water.setQuality(quality);water.update(time+=1/60);
    profiler.beginFrame(1/60);profiler.beginRender();try{nature.render(scene,camera);}finally{profiler.endFrame();}
    return {profile:profiler.snapshot(),water:water.diagnostics(),contact:nature.diagnostics(),textures:natureTextureDiagnostics(),shaders:shaderDiagnostics()};
  };
  const captureColors=quality=>{
    draw('colors',quality,0);const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const context=canvas.getContext('2d');context.drawImage(renderer.domElement,0,0);
    return swatches.map(mesh=>{const p=mesh.position.clone().project(colorCamera),x=Math.round((p.x+1)*480),y=Math.round((1-p.y)*320),pixels=context.getImageData(x-5,y-5,11,11).data,sums=[0,0,0];for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)sums[c]+=pixels[i+c];return sums.map(sum=>sum/121);});
  };
  window.renderReadiness={draw,captureColors,ready:true,terrain:{chunks:terrain.children.length,spacing:field.spacing},shutdown(){profiler.dispose();water.dispose();nature.dispose();terrain.dispose();renderer.dispose();}};
  draw('shore');
}
boot().catch(error=>{window.renderReadiness={ready:false,error:error.stack};throw error;});
