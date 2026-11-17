// Curved branching from EZ-Tree; Sunspark canopy shading, matched wind/shadows,
// shared geometry and stable detail levels. All textures are bundled offline.
import * as THREE from 'three';
import { Tree } from './generated/tree-generator.js';
import { seeded } from './config.js';
import { natureTexture } from './nature-assets.js';
import { graphicsProfile } from './graphics.js';
import { patchShader } from './shader-patches.js';
import { setInstanceBounds } from './instance-bounds.js';
import { ResourceScope } from './resource-scope.js';
const bank=[];
let templateResources=new ResourceScope('shared tree templates');
// Analytical amplitudes are .123/.055m; leave a small float-rounding margin.
export const CANOPY_WIND_PADDING=new THREE.Vector3(.125,0,.06);
export const FOLIAGE_CELL_SIZE=32;
// Branches are opaque and cheaper per tree than canopies. The 64m grouping
// reduced CPU/GPU cost in the three fixed Sunhaven views; 96m overdraw regressed.
export const BRANCH_CELL_SIZE=64;
const windCode=`
  vec4 leafWorld=vec4(transformed,1.);
  #ifdef USE_INSTANCING
    leafWorld=instanceMatrix*leafWorld;
  #endif
  leafWorld=modelMatrix*leafWorld;
  float crown=smoothstep(1.8,6.8,position.y);
  transformed.x+=sin(leafTime*.95+leafWorld.x*.21+leafWorld.z*.13)*.11*crown;
  transformed.z+=sin(leafTime*1.3+leafWorld.z*.28)*.055*crown;
  transformed.x+=sin(leafTime*3.2+leafWorld.x*3.+leafWorld.z*2.)*.013;
`;
function addWind(material,time,leaves=false){
  material.onBeforeCompile=shader=>{
    shader.uniforms.leafTime=time;
    shader.vertexShader='uniform float leafTime;\n'+patchShader(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\n'+windCode,'canopy wind position');
    if(leaves){
      const canopyNormal=patchShader(THREE.ShaderChunk.normal_fragment_begin,'normal *= faceDirection;','','canopy face normal');
      shader.fragmentShader=patchShader(shader.fragmentShader,'#include <normal_fragment_begin>',canopyNormal,'canopy normal chunk');
      shader.fragmentShader=patchShader(shader.fragmentShader,'#include <lights_fragment_end>','#include <lights_fragment_end>\nfloat leafGlow=pow(max(dot(normalize(vec3(-.61,.69,.39)),normalize(vViewPosition)),0.),3.);\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*(.025+leafGlow*.13);','canopy transmitted light');
    }
  };
  material.customProgramCacheKey=()=>'sunspark-canopy-v3-'+leaves;
  material.userData.staticBatching=false;return material;
}
export function canopyLevel(distance,previous,leafDistance){
  const near=leafDistance*.55,far=leafDistance*1.3;
  if(previous===0)return distance>far+4?2:distance>near+3?1:0;
  if(previous===2)return distance<near-3?0:distance<far-4?1:2;
  return distance<near-3?0:distance>far+4?2:1;
}
function thinLeaves(source,stride){
  const positions=[],normals=[],uvs=[],colors=[],indices=[],p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv,c=source.attributes.color;
  for(let q=0;q<p.count/8;q+=stride){
    const center=new THREE.Vector3();for(let j=0;j<8;j++)center.add(new THREE.Vector3().fromBufferAttribute(p,q*8+j));center.multiplyScalar(1/8);
    const start=positions.length/3;
    for(let j=0;j<8;j++){
      const i=q*8+j,v=new THREE.Vector3().fromBufferAttribute(p,i).sub(center).multiplyScalar(stride===1?1:stride===2?1.13:1.25).add(center);
      positions.push(v.x,v.y,v.z);normals.push(n.getX(i),n.getY(i),n.getZ(i));uvs.push(uv.getX(i),uv.getY(i));colors.push(c.getX(i),c.getY(i),c.getZ(i));
    }
    for(const off of [0,4])indices.push(start+off,start+off+1,start+off+2,start+off,start+off+2,start+off+3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
function createTemplates(){
  if(bank.length)return;
  if(templateResources.disposed)templateResources=new ResourceScope('shared tree templates');
  for(let variant=0;variant<6;variant++){
    const tree=new Tree();tree.loadPreset(variant%3===0?'Oak Medium':variant%3===1?'Ash Medium':'Oak Small');
    tree.options.seed=947+variant*379;tree.options.bark.textured=false;
    tree.options.branch.segments={0:10,1:7,2:5,3:4};tree.options.branch.sections={0:12,1:8,2:5,3:3};
    tree.options.leaves.count=variant%3===1?24:28;tree.options.leaves.size*=1.75;tree.options.leaves.sizeVariance=.32;
    tree.generate();
    const branches=tree.branchesMesh.geometry,leaves=tree.leavesMesh.geometry;
    leaves.computeBoundingBox();const height=leaves.boundingBox.max.y,scale=(6.5+variant%3*.4)/height;
    branches.scale(scale,scale,scale);leaves.scale(scale,scale,scale);leaves.computeBoundingBox();
    const center=leaves.boundingBox.getCenter(new THREE.Vector3()),p=leaves.attributes.position,n=leaves.attributes.normal,colors=[],rng=seeded(variant+744);
    for(let q=0;q<p.count/4;q++){
      const v=new THREE.Vector3();for(let j=0;j<4;j++)v.add(new THREE.Vector3().fromBufferAttribute(p,q*4+j));v.multiplyScalar(.25);
      const normal=v.clone().sub(center).multiply(new THREE.Vector3(.8,1.2,.8)).normalize(),ao=.70+.25*Math.min(1,v.distanceTo(center)/2.4),tone=.9+rng()*.2;
      for(let j=0;j<4;j++){n.setXYZ(q*4+j,normal.x,normal.y,normal.z);colors.push(ao*tone,ao*tone,ao*(.88+tone*.12));}
    }
    leaves.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const levels=[thinLeaves(leaves,1),thinLeaves(leaves,2),thinLeaves(leaves,4)];
    for(const geometry of [branches,...levels])templateResources.retain(geometry);
    bank.push({branches,levels,ash:variant%3===1});
    leaves.dispose();tree.branchesMesh.material.dispose();tree.leavesMesh.material.dispose();
  }
}
export function disposeFoliageTemplates(){templateResources.dispose();bank.length=0;}
export class IslandFoliage extends THREE.Group {
  constructor(){
    super();createTemplates();this.name='Breezy Bay woodland';this.trees=[];this.time={value:0};this.nextLOD=0;this.batches=[];this.branchBatches=[];this.cells=[];this.dirty=false;this.disposed=false;
    this.leafMaterials=new Map();this.resources=new ResourceScope('island foliage');this.batchResources=new ResourceScope('foliage instances');this.templates=[...bank];
    for(const template of this.templates)for(const geometry of [template.branches,...template.levels])this.resources.retain(geometry);
    const ownMaterial=material=>{this.resources.retain(material);for(const value of Object.values(material))if(value?.isTexture)this.resources.retain(value);return material;};
    this.texture=natureTexture('oak_color',true);this.bark=new THREE.MeshStandardMaterial({color:0xc2b8a0,map:natureTexture('oak_color_1k',true),normalMap:natureTexture('oak_normal_1k'),normalScale:new THREE.Vector2(.85,.85),roughnessMap:natureTexture('oak_roughness_1k'),roughness:1});this.bark.name='Weathered oak bark';
    ownMaterial(this.bark);this.resources.retain(this.texture);
    for(const ash of [false,true])for(let palette=0;palette<2;palette++){
      const map=natureTexture(ash?'ash_color':'oak_color',true);
      const material=addWind(new THREE.MeshStandardMaterial({map,color:palette?0xe7b36b:0xe2efba,side:THREE.DoubleSide,alphaTest:.24,alphaToCoverage:true,roughness:.85,vertexColors:true}),this.time,true);
      const depth=addWind(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map,alphaTest:.24,side:THREE.DoubleSide}),this.time);
      const distance=addWind(new THREE.MeshDistanceMaterial({map,alphaTest:.24,side:THREE.DoubleSide}),this.time);
      this.leafMaterials.set(`${ash}:${palette}`,{material:ownMaterial(material),depth:ownMaterial(depth),distance:ownMaterial(distance)});
    }
  }
  addTree(x,y,z,scale,pink){
    if(this.disposed)throw new Error('Cannot add a tree to disposed foliage');
    const rng=seeded(Math.round(x*43+z*73)),variant=Math.floor(rng()*6),dummy=new THREE.Object3D();
    dummy.position.set(x,y,z);dummy.rotation.y=rng()*Math.PI*2;dummy.scale.setScalar(scale);dummy.updateMatrix();
    // Keep the exact old mesh/transform for explicit gameplay raycasts. World
    // skips its static-visual clone because branch instances render it instead.
    const branch=new THREE.Mesh(this.templates[variant].branches,this.bark);branch.matrix.copy(dummy.matrix);branch.matrixAutoUpdate=false;branch.castShadow=branch.receiveShadow=true;branch.name='Tree branch collision';branch.visible=false;branch.userData.instancedVisual=true;this.add(branch);
    this.trees.push({x,z,y,scale,variant,palette:pink?1:0,matrix:dummy.matrix.clone(),level:0});this.nextLOD=0;this.dirty=true;return branch;
  }
  rebuildBatches(){
    for(const mesh of [...this.batches,...this.branchBatches])mesh.removeFromParent();
    this.batchResources.dispose();this.batchResources=new ResourceScope('foliage instances');
    this.batches=[];this.branchBatches=[];this.cells=[];
    const canopies=new Map(),branches=new Map();
    for(const tree of this.trees){
      const cell=`${Math.floor(tree.x/FOLIAGE_CELL_SIZE)},${Math.floor(tree.z/FOLIAGE_CELL_SIZE)}`,leafKey=`${cell}:${tree.variant}:${tree.palette}`;
      const branchKey=`${Math.floor(tree.x/BRANCH_CELL_SIZE)},${Math.floor(tree.z/BRANCH_CELL_SIZE)}:${tree.variant}`;
      if(!canopies.has(leafKey))canopies.set(leafKey,{key:leafKey,trees:[]});canopies.get(leafKey).trees.push(tree);
      if(!branches.has(branchKey))branches.set(branchKey,{key:branchKey,trees:[]});branches.get(branchKey).trees.push(tree);
    }
    for(const cell of branches.values()){
      const mesh=this.batchResources.retain(new THREE.InstancedMesh(this.templates[cell.trees[0].variant].branches,this.bark,cell.trees.length));
      mesh.name=`Tree branches ${cell.key}`;mesh.castShadow=mesh.receiveShadow=true;
      cell.trees.forEach((tree,i)=>mesh.setMatrixAt(i,tree.matrix));mesh.instanceMatrix.needsUpdate=true;setInstanceBounds(mesh);
      this.add(mesh);this.branchBatches.push(mesh);
    }
    for(const cell of canopies.values()){
      const {variant,palette}=cell.trees[0],template=this.templates[variant],materials=this.leafMaterials.get(`${template.ash}:${palette}`);cell.levels=[];
      for(let level=0;level<3;level++){
        const mesh=this.batchResources.retain(new THREE.InstancedMesh(template.levels[level],materials.material,cell.trees.length));mesh.count=0;mesh.visible=false;
        mesh.name=`Tree canopy ${cell.key} detail ${level}`;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=true;
        mesh.customDepthMaterial=materials.depth;mesh.customDistanceMaterial=materials.distance;
        mesh.userData={variant,palette,level,cell:cell.key};mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.add(mesh);this.batches.push(mesh);cell.levels.push(mesh);
      }
      this.cells.push(cell);
    }
    this.dirty=false;
  }
  setQuality(value){this.profile=graphicsProfile(value);this.nextLOD=0;}
  update(t,camera){
    if(this.disposed)return;this.time.value=t;if(!camera||t<this.nextLOD&&!this.dirty)return;this.nextLOD=t+.3;
    if(this.dirty)this.rebuildBatches();
    this.updateWorldMatrix(true,false);
    const distance=this.profile?.leafDistance??65,cameraPosition=camera.getWorldPosition?camera.getWorldPosition(new THREE.Vector3()):camera.position,position=new THREE.Vector3();
    for(const cell of this.cells){
      const counts=[0,0,0];
      for(const tree of cell.trees){
        position.set(tree.x,tree.y,tree.z).applyMatrix4(this.matrixWorld);
        const d=Math.hypot(position.x-cameraPosition.x,position.z-cameraPosition.z);
        tree.level=canopyLevel(d,tree.level,distance);cell.levels[tree.level].setMatrixAt(counts[tree.level]++,tree.matrix);
      }
      cell.levels.forEach((mesh,i)=>{
        mesh.count=counts[i];mesh.visible=counts[i]>0;mesh.instanceMatrix.needsUpdate=true;
        setInstanceBounds(mesh,CANOPY_WIND_PADDING);
      });
    }
  }
  get leafCount(){return this.batches.reduce((sum,mesh)=>sum+mesh.count*mesh.geometry.attributes.position.count/4,0);}
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.batchResources.dispose();this.resources.dispose();this.clear();this.trees=[];this.batches=[];this.branchBatches=[];this.cells=[];this.templates=[];this.leafMaterials.clear();
    // Other worlds and the template/texture caches retain their own references.
  }
}

