import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeWall } from './wall.js';
import { broadleafAdaptation } from './tree-adaptation.js';
import { createConceptOak } from './concept-oak.js';
import { IslandFoliage } from '../../src/nature-foliage.js';
import { createDocksOaks } from '../../src/docks-oaks.js';
import { prepareNatureAssets, natureTextureDiagnostics } from '../../src/nature-assets.js';
import { DOCKS_LIGHTING as light } from '../../src/docks-lighting.js';
import { createMapTerrain } from '../../src/terrain-surface.js';
import { MAPS } from '../../src/maps.js';
import { addDocksLandforms } from '../../src/docks-landforms.js';
import { auditSurfaceLayers } from '../../scripts/surface-layer-audit.mjs';

const host=document.querySelector('#viewport'),renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=light.exposure;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb4d4de);
const camera=new THREE.PerspectiveCamera(43,1,.1,150),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=45;controls.maxPolarAngle=Math.PI*.49;
const sun=new THREE.DirectionalLight(light.sunColor,light.sunIntensity);sun.position.set(-9,14,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-14;sun.shadow.camera.right=sun.shadow.camera.top=14;sun.shadow.camera.far=60;sun.shadow.normalBias=.025;scene.add(sun,new THREE.HemisphereLight(light.skyColor,light.groundColor,light.hemisphereIntensity));
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room);scene.environment=environment.texture;scene.environmentIntensity=light.environmentIntensity;room.dispose();pmrem.dispose();
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xc6c9ac,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
const loader=new GLTFLoader(),assetRoot='../../assets/art-proof/',failures=[];let asset='wall',version='candidate',variant='1';
const groups={wall:{},cliff:{},oak:{}},treeVariants={},currentTreeVariants={},rockVariants={},sharedTextures=new Map();
function normalize(object,dimension,value){object.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(object),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),scale=value/s[dimension];const wrapper=new THREE.Group();object.position.add(new THREE.Vector3(-c.x,-b.min.y,-c.z));wrapper.add(object);wrapper.scale.setScalar(scale);return wrapper;}
function configure(object){object.traverse(m=>{if(!m.isMesh)return;m.castShadow=m.receiveShadow=true;for(const mat of [m.material].flat()){for(const slot of ['map','normalMap','roughnessMap','metalnessMap','aoMap']){const map=mat[slot];if(!map)continue;const key=[map.name||map.image?.src||map.uuid,map.colorSpace,map.channel,map.flipY,map.wrapS,map.wrapT].join('|');if(sharedTextures.has(key)){mat[slot]=sharedTextures.get(key);if(map!==mat[slot])map.dispose();}else{map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());sharedTextures.set(key,map);}}if(mat.alphaTest){mat.alphaToCoverage=true;m.customDepthMaterial=new THREE.MeshDepthMaterial({map:mat.map,alphaTest:mat.alphaTest,side:mat.side,depthPacking:THREE.RGBADepthPacking});}}});return object;}
function currentCliff(){
  const ground=createMapTerrain(MAPS.sunhaven),world={map:MAPS.sunhaven,ground},landforms=addDocksLandforms(world),result=new THREE.Group();
  // Actual north-cove triangles, cropped for the asset viewer, not a replica.
  for(const mesh of ground.children){const source=mesh.geometry,p=source.attributes.position,index=source.index,attrs=Object.fromEntries(Object.keys(source.attributes).map(key=>[key,[]]));for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),x=ids.reduce((v,id)=>v+p.getX(id),0)/3,z=ids.reduce((v,id)=>v+p.getZ(id),0)/3;if(x<85||x>99||z<2||z>12)continue;for(const id of ids)for(const [key,out]of Object.entries(attrs)){const a=source.attributes[key];for(let k=0;k<a.itemSize;k++)out.push(a.array[id*a.itemSize+k]);}}if(!attrs.position.length)continue;const g=new THREE.BufferGeometry();for(const [key,data]of Object.entries(attrs))g.setAttribute(key,new THREE.Float32BufferAttribute(data,source.attributes[key].itemSize));const m=new THREE.Mesh(g,mesh.material);m.castShadow=m.receiveShadow=true;result.add(m);}
  for(const mesh of ground.children)mesh.geometry.dispose();ground.clear();return normalize(result,'x',9);
}
const titles={wall:'Painted timber',cliff:'Rock formations',oak:'Broadleaf tree'};
const descriptions={
  wall:{current:'The earlier coastal paint material on the same wall sample. This isolates texture quality from geometry and lighting.',candidate:'Approved timber, now used on the v1.12 boathouse: teal artwork, visible grain, knots and warm edge wear on individual beveled boards.'},
  cliff:{current:'The underlying north-cove terrain, without the additional authored rock blocks. This shows the grid-derived form and current cliff finish.',candidate:'Approved rock direction, now composed along the playable cove. Compare the stylized source models with the scanned cliff benchmark.'},
  oak:{current:'The original natural island oak and ash are used throughout the island again, including the docks in v1.12.1. The older special docks oak remains a historical comparison.',candidate:'Concept oak study: low branching trunk, spreading limbs and a rounded crown. The user preferred the more natural original woodland, restored in v1.12.1. This study asset is retained for reference.'}
};
function frame(){const views={wall:[[4.1,3.4,7.2],[0,2,0]],cliff:[[8,5.8,12],[0,2,0]],oak:[[10,6.8,15],[0,4.6,0]]};camera.position.set(...views[asset][0]);controls.target.set(...views[asset][1]);controls.update();}
function select(nextAsset=asset,nextVersion=version,nextVariant=variant,reset=false){
  asset=nextAsset;version=nextVersion;variant=nextVariant;
  for(const family of Object.values(groups))for(const object of Object.values(family))object.visible=false;
  for(const object of [...Object.values(treeVariants),...Object.values(currentTreeVariants),...Object.values(rockVariants)])object.visible=false;
  let options=[],object;
  if(asset==='oak'){
    const choices=version==='candidate'?treeVariants:currentTreeVariants;
    options=version==='candidate'?[['concept','Concept oak v2'],['previous','Previous candidate']]:[['island','Island oak'],['ash','Island ash'],['docks','Docks oak (3 sites)']];
    if(!choices[variant])variant=options[0][0];object=choices[variant];
  }else if(asset==='cliff'&&version==='candidate'){
    options=[['stylized','Stylized rocks'],['scan','Cliff scan']];if(!rockVariants[variant])variant='stylized';object=rockVariants[variant];
  }else object=groups[asset][version];
  object.visible=true;
  document.querySelectorAll('[data-asset]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.asset===asset));
  document.querySelectorAll('[data-version]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.version===version));
  document.querySelector('[data-version="current"]').textContent=asset==='cliff'?'Underlying terrain':asset==='oak'?'Original trees':'Earlier assets';
  document.querySelector('#asset-title').textContent=titles[asset];document.querySelector('#description').textContent=descriptions[asset][version];
  const variantTitle=options.find(([id])=>id===variant)?.[1];
  document.querySelector('#view-label').textContent=variantTitle||`${titles[asset]} / ${version==='candidate'?'Candidate':'Current'}`;
  const label=document.querySelector('#variant-label'),dropdown=document.querySelector('#variant');label.hidden=!options.length;
  dropdown.replaceChildren(...options.map(([value,text])=>new Option(text,value)));dropdown.value=variant;
  if(reset)frame();renderer.compile(scene,camera);return object;
}
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);
async function start(){
  const atlas=await new THREE.TextureLoader().loadAsync(assetRoot+'teal-plank-atlas-v1.png');atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  groups.wall.current=makeWall(null,false);groups.wall.candidate=makeWall(atlas,true);groups.cliff.current=currentCliff();
  const oakWorld={map:{id:'sunhaven'},scene:new THREE.Scene(),heightAt:()=>0,rockCollider:()=>{}};
  currentTreeVariants.docks=createDocksOaks(oakWorld,{sites:[{id:'special-docks-oak',x:0,z:0,scale:1,yaw:0,variant:0}]});
  for(const [key,variant] of [['island',0],['ash',1]]){
    const foliage=new IslandFoliage();foliage.addTree(0,0,0,1,false);foliage.trees[0].variant=variant;foliage.update(0,{position:new THREE.Vector3(0,2,12)});foliage.name='Current '+key+' tree';currentTreeVariants[key]=foliage;
  }
  const leafMap=await new THREE.TextureLoader().loadAsync(assetRoot+'oak-sprays-v2.png');leafMap.colorSpace=THREE.SRGBColorSpace;leafMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  treeVariants.concept=createConceptOak(leafMap);
  const [trees,rocks,scan]=await Promise.all([loader.loadAsync(assetRoot+'nature/CommonTree_1.gltf'),Promise.all([1,2,3].map(i=>loader.loadAsync(assetRoot+`nature/Rock_Medium_${i}.gltf`))),loader.loadAsync(assetRoot+'rock-face/rock_face_01_1k.gltf')]);
  treeVariants.previous=normalize(configure(broadleafAdaptation(trees.scene)),'y',9.8);
  const arrangement=new THREE.Group();rocks.forEach((g,i)=>{const r=normalize(configure(g.scene),'x',[5.6,4.9,3.6][i]);r.position.set([-1.7,1.8,.8][i],[0,0,1.25][i],[.1,-.8,-1.8][i]);r.rotation.y=[.2,1.3,-.6][i];arrangement.add(r);});rockVariants.stylized=normalize(arrangement,'x',9);rockVariants.scan=normalize(configure(scan.scene),'x',9);
  for(const family of Object.values(groups))for(const object of Object.values(family))scene.add(object);for(const object of [...Object.values(treeVariants),...Object.values(currentTreeVariants),...Object.values(rockVariants)])scene.add(object);
  await prepareNatureAssets(renderer);const initialAsset=new URLSearchParams(location.search).get('asset')||'wall';select(initialAsset,'candidate',initialAsset==='oak'?'concept':'1',true);resize();const audit=auditSurfaceLayers(groups.wall.candidate);if(audit.violations.length)throw new Error('Wall surface audit failed: '+JSON.stringify(audit.violations));
  document.querySelectorAll('[data-asset]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.asset,version,b.dataset.asset==='cliff'?'stylized':b.dataset.asset==='oak'?(version==='candidate'?'concept':'island'):'1',true)));document.querySelectorAll('[data-version]').forEach(b=>b.addEventListener('click',()=>select(asset,b.dataset.version)));document.querySelector('#variant').addEventListener('change',e=>select(asset,version,e.target.value));document.querySelector('#reset').addEventListener('click',frame);
  document.querySelector('#loading').hidden=true;document.querySelector('#loading').style.display='none';
  window.artProof={ready:true,select:(a,v,n)=>select(a,v,n,true),camera,controls,renderer,scene,groups,treeVariants,currentTreeVariants,rockVariants,atlas,audit,failures,
    exportConceptOak:()=>new GLTFExporter().parseAsync(treeVariants.concept,{binary:true,onlyVisible:false,maxTextureSize:2048}),
    importConceptOak:async buffer=>{const gltf=await loader.parseAsync(buffer,'');const root=gltf.scene,meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push({name:m.name,vertices:m.geometry.attributes.position.count,indices:m.geometry.index?.count??0,alphaTest:m.material.alphaTest,hasMap:!!m.material.map});});const b=new THREE.Box3().setFromObject(root);return {meshes,bounds:[b.min.toArray(),b.max.toArray()]};},
    diagnostics:()=>({asset,version,variant,tree:treeVariants.concept.userData.artProof,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,currentTextureBudget:natureTextureDiagnostics(),audit,failures})};
}
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});start().catch(error=>{failures.push(error.message);document.querySelector('#loading').textContent=error.message;console.error(error);window.artProof={ready:false,error:error.message};});
