import * as THREE from 'three';
import { natureTexture } from './nature-assets.js';
import { seeded } from './config.js';
import { patchShader } from './shader-patches.js';
import { TERRAIN_LAYERS,TERRAIN_MATERIAL_BUDGET,TERRAIN_PROJECTION_GLSL } from './terrain-layers.js';
export const groundTime={value:0};
export function terrainMaterial(useMask=false){
  // Declare/load every channel during scene creation so startup can await the
  // shared asset cache before compilation (onBeforeCompile never starts I/O).
  const layers=TERRAIN_LAYERS.map(layer=>({...layer,map:natureTexture(layer.color,true),normalMap:natureTexture(layer.normal),roughnessMap:natureTexture(layer.roughness)}));
  const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.93,map:layers[0].map,normalMap:layers[0].normalMap,normalScale:new THREE.Vector2(.65,.65),roughnessMap:layers[0].roughnessMap});
  m.name='Layered grass, trail, beach and rock';
  m.userData.terrainLayers=TERRAIN_LAYERS;m.userData.materialBudget=TERRAIN_MATERIAL_BUDGET;
  m.onBeforeCompile=s=>{
    for(const layer of layers.slice(1)){
      s.uniforms[layer.id+'Map']={value:layer.map};
      s.uniforms[layer.id+'Normal']={value:layer.normalMap};
      s.uniforms[layer.id+'Roughness']={value:layer.roughnessMap};
    }
    s.uniforms.terrainScale={value:new THREE.Vector4(...TERRAIN_LAYERS.map(layer=>layer.repeatsPerMeter))};s.uniforms.groundTime=groundTime;
    s.vertexShader=(useMask?'attribute vec3 terrainMask; varying vec3 vTerrainMask;\n':'')+'varying vec3 vTerrain; varying vec3 vTerrainNormal;\n'+s.vertexShader;
    s.vertexShader=patchShader(s.vertexShader,'#include <begin_vertex>',`#include <begin_vertex>
      vTerrain=(modelMatrix*vec4(position,1.)).xyz;
      vTerrainNormal=inverseTransformDirection(transformedNormal,viewMatrix);
      ${useMask?'vTerrainMask=terrainMask;':''}`,'terrain.world-position-normal');
    s.fragmentShader=patchShader(s.fragmentShader,'#include <common>','#include <common>\n'+TERRAIN_PROJECTION_GLSL+(useMask?'varying vec3 vTerrainMask;\n':''),'terrain.projection-helpers');
    s.fragmentShader=patchShader(s.fragmentShader,'#include <map_fragment>',`
      terrainWorldDx=dFdx(vTerrain);terrainWorldDy=dFdy(vTerrain);
      vec3 terrainBaseNormal=normalize(vTerrainNormal);
      vec3 terrainProjection=terrainAxes(terrainBaseNormal),terrainSign=terrainSigns(terrainBaseNormal);
      vec3 terrainMaskValue=${useMask?'clamp(vTerrainMask,0.,1.)':`vec3(smoothstep(57.,67.,length(vTerrain.xz)),1.-smoothstep(1.4,3.1,min(abs(vTerrain.x+sin(vTerrain.z*.06)*8.),abs(vTerrain.z-8.+sin(vTerrain.x*.07)*5.))),0.)`};
      float beach=terrainMaskValue.x,trail=terrainMaskValue.y,rock=terrainMaskValue.z;
      vec4 terrainWeights=vec4((1.-beach)*(1.-rock)*(1.-trail),(1.-beach)*(1.-rock)*trail,beach,(1.-beach)*rock);
      vec3 terrainGrassUV=vTerrain*terrainScale.x,terrainTrailUV=vTerrain*terrainScale.y,terrainSandUV=vTerrain*terrainScale.z,terrainRockUV=vTerrain*terrainScale.w;
      vec3 soil=vec3(0.);
      if(terrainWeights.x>.0001)soil+=terrainSample(map,terrainGrassUV,terrainProjection,terrainSign,terrainScale.x)*terrainWeights.x;
      if(terrainWeights.y>.0001)soil+=terrainSample(trailMap,terrainTrailUV,terrainProjection,terrainSign,terrainScale.y)*terrainWeights.y;
      if(terrainWeights.z>.0001)soil+=terrainSample(sandMap,terrainSandUV,terrainProjection,terrainSign,terrainScale.z)*terrainWeights.z;
      if(terrainWeights.w>.0001)soil+=terrainSample(rockMap,terrainRockUV,terrainProjection,terrainSign,terrainScale.w)*terrainWeights.w;
      float detail=dot(soil,vec3(.299,.587,.114));
      vec3 tint=soil/max(detail,.05);
      diffuseColor.rgb*=mix(vec3(1.),tint,terrainWeights.x*.40)*clamp(.48+detail*1.9,.52,1.35);
      float terrainWet=1.-smoothstep(-1.05,-.32,vTerrain.y);
      diffuseColor.rgb*=1.-terrainWet*.23;
    `,'terrain.albedo');
    s.fragmentShader=patchShader(s.fragmentShader,'#include <roughnessmap_fragment>',`
      float terrainRoughness=0.;
      if(terrainWeights.x>.0001)terrainRoughness+=terrainSample(roughnessMap,terrainGrassUV,terrainProjection,terrainSign,terrainScale.x).g*terrainWeights.x;
      if(terrainWeights.y>.0001)terrainRoughness+=terrainSample(trailRoughness,terrainTrailUV,terrainProjection,terrainSign,terrainScale.y).g*terrainWeights.y;
      if(terrainWeights.z>.0001)terrainRoughness+=terrainSample(sandRoughness,terrainSandUV,terrainProjection,terrainSign,terrainScale.z).g*terrainWeights.z;
      if(terrainWeights.w>.0001)terrainRoughness+=terrainSample(rockRoughness,terrainRockUV,terrainProjection,terrainSign,terrainScale.w).g*terrainWeights.w;
      float roughnessFactor=mix(clamp(roughness*terrainRoughness,.36,1.),.24,terrainWet*.65);
    `,'terrain.roughness');
    s.fragmentShader=patchShader(s.fragmentShader,'#include <normal_fragment_maps>',`
      vec3 terrainGradient=vec3(0.);
      if(terrainWeights.x>.0001)terrainGradient+=terrainNormalGradient(normalMap,terrainGrassUV,terrainProjection,terrainSign,normalScale,terrainScale.x)*terrainWeights.x;
      if(terrainWeights.y>.0001)terrainGradient+=terrainNormalGradient(trailNormal,terrainTrailUV,terrainProjection,terrainSign,normalScale,terrainScale.y)*terrainWeights.y;
      if(terrainWeights.z>.0001)terrainGradient+=terrainNormalGradient(sandNormal,terrainSandUV,terrainProjection,terrainSign,normalScale,terrainScale.z)*terrainWeights.z;
      if(terrainWeights.w>.0001)terrainGradient+=terrainNormalGradient(rockNormal,terrainRockUV,terrainProjection,terrainSign,normalScale,terrainScale.w)*terrainWeights.w;
      terrainGradient-=terrainBaseNormal*dot(terrainBaseNormal,terrainGradient);
      normal=normalize(mat3(viewMatrix)*(terrainBaseNormal+terrainGradient*(1.-terrainWet*.25)));
    `,'terrain.normal');
    s.fragmentShader=patchShader(s.fragmentShader,'#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float underwater=1.-smoothstep(-1.12,-1.05,vTerrain.y);
      vec2 c=vTerrain.xz*3.;float lace=pow(1.-abs(sin(c.x+sin(c.y+groundTime*.6))*.5+sin(c.y-groundTime*.5)*.5),14.);
      totalEmissiveRadiance+=vec3(.08,.12,.08)*lace*underwater*exp((vTerrain.y+1.1)*.3);
    `,'terrain.caustics');
  };m.customProgramCacheKey=()=>'sunspark-layered-ground-v6-triplanar-'+useMask;return m;
}
export function rockGeometry(radius,seed){
  const g=new THREE.IcosahedronGeometry(radius,3),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i)/radius,y=p.getY(i)/radius,z=p.getZ(i)/radius;
    const shape=1+.09*Math.sin(x*7+seed)+.07*Math.cos(z*6-y*3+seed*.7)+.06*Math.sin((x+z)*11);
    x*=shape;y=Math.min(y*shape,.76+.08*Math.sin(x*4+z*5));z*=shape;
    p.setXYZ(i,x*radius,y*radius,z*radius);
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export class Meadow extends THREE.Group {
  constructor(heightAt,canPlant,coverSites=[],map={grassRadius:61}){
    super();this.name='Living meadow';this.time={value:0};this.batches=[];const rng=seeded(5106);
    // Tufts contain bent, tapered blades with varied height, never billboards.
    const vertices=[],indices=[],colors=[];
    for(let b=0;b<11;b++){
      const angle=rng()*Math.PI*2,w=.008+rng()*.013,h=.14+rng()*.24,x=(rng()-.5)*.23,z=(rng()-.5)*.23,dx=Math.cos(angle),dz=Math.sin(angle),base=vertices.length/3;
      for(let row=0;row<3;row++)for(const side of [-1,1]){const t=row/2,spread=w*(1-t*.92);vertices.push(x+dx*spread*side+dz*t*t*.11,h*t,z+dz*spread*side+dx*t*t*.11);colors.push(.47+t*.48,.52+t*.48,.38+t*.50);}
      indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const normal=geometry.attributes.normal;for(let i=0;i<normal.count;i++){const n=new THREE.Vector3(normal.getX(i)*.30,.92,normal.getZ(i)*.30).normalize();normal.setXYZ(i,n.x,n.y,n.z);}
    const material=new THREE.MeshStandardMaterial({color:0x9aaf62,roughness:.93,vertexColors:true,side:THREE.DoubleSide});
    material.onBeforeCompile=s=>{s.uniforms.meadowTime=this.time;s.vertexShader='uniform float meadowTime;\n'+patchShader(s.vertexShader,'#include <begin_vertex>',`#include <begin_vertex>
      vec3 w=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
      transformed.x+=sin(meadowTime*1.3+w.x*.8+w.z*.6)*position.y*.17;
      transformed.z+=cos(meadowTime+w.z*.5)*position.y*.10;`,'meadow.wind');s.fragmentShader=patchShader(s.fragmentShader,'#include <normal_fragment_begin>',patchShader(THREE.ShaderChunk.normal_fragment_begin,'normal *= faceDirection;','','meadow.two-sided-normal'),'meadow.normal-chunk');};material.customProgramCacheKey=()=>'meadow-wind-v4';
    const dummy=new THREE.Object3D();
    const extent=map.grassRadius===61?60:Math.ceil(map.grassRadius/15)*15;
    for(let cx=-extent;cx<extent;cx+=15)for(let cz=-extent;cz<extent;cz+=15){
      const matrices=[];
      for(let i=0;i<1600;i++){
        const x=cx+rng()*15,z=cz+rng()*15,r=Math.hypot(x,z),patch=.55+.25*Math.sin(x*.51)*Math.cos(z*.39)+.20*Math.sin(x*.17+z*.21);
        if(r>map.grassRadius||rng()>patch||!canPlant(x,z))continue;
        dummy.position.set(x,heightAt(x,z)-.025,z);dummy.rotation.y=rng()*6.28;dummy.scale.setScalar(.6+rng()*.8);dummy.updateMatrix();matrices.push(dummy.matrix.clone());
      }
      if(!matrices.length)continue;
      const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.boundingBox.expandByScalar(.15);mesh.boundingSphere.radius+=.15;mesh.userData={total:matrices.length,x:cx+7.5,z:cz+7.5,windMargin:.15};this.add(mesh);this.batches.push(mesh);
    }
    const frondPositions=[];
    for(let f=0;f<7;f++){
      const a=f*2.39996,axis=new THREE.Vector3(Math.sin(a),0,Math.cos(a)),side=new THREE.Vector3(axis.z,0,-axis.x);
      for(let j=1;j<9;j++){
        const t=j/9,center=axis.clone().multiplyScalar(t*.65);center.y=.05+Math.sin(t*2.3)*.35;
        for(const sign of [-1,1]){const tip=center.clone().addScaledVector(side,sign*Math.sin(t*Math.PI)*.19).addScaledVector(axis,.07);tip.y+=.02;
          const base=center.clone().addScaledVector(axis,-.055),end=center.clone().addScaledVector(axis,.075),ridge=center.clone().lerp(tip,.5);ridge.y+=.035;
          for(const v of [base,tip,ridge,tip,end,ridge])frondPositions.push(v.x,v.y,v.z);
        }
      }
    }
    const fernGeometry=new THREE.BufferGeometry();fernGeometry.setAttribute('position',new THREE.Float32BufferAttribute(frondPositions,3));fernGeometry.computeVertexNormals();
    const fernMaterial=new THREE.MeshStandardMaterial({color:0x6e9853,roughness:.9,side:THREE.DoubleSide});
    const ferns=new THREE.InstancedMesh(fernGeometry,fernMaterial,coverSites.length*3);let count=0;
    for(const site of coverSites)for(let i=0;i<3;i++){
      const a=rng()*6.28,r=1+rng()*1.6,x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r;if(!canPlant(x,z))continue;
      dummy.position.set(x,heightAt(x,z),z);dummy.rotation.y=a;dummy.scale.setScalar(.8+rng()*.7);dummy.updateMatrix();ferns.setMatrixAt(count++,dummy.matrix);
    }
    ferns.count=count;ferns.receiveShadow=true;ferns.computeBoundingSphere();this.add(ferns);
  }
  setQuality(profile){this.profile=profile;}
  update(t,camera){this.time.value=t;if(!camera)return;const distance=this.profile?.grassDistance??44,density=this.profile?.grassDensity??1;
    for(const mesh of this.batches){const d=Math.hypot(mesh.userData.x-camera.position.x,mesh.userData.z-camera.position.z);mesh.visible=d<distance+11;mesh.count=Math.floor(mesh.userData.total*density*(d>distance*.65?.6:1));}
  }
}
