// Offline ocean with depth-aware refraction, coastal reflections and embedded normal maps.
import * as THREE from 'three';
import { seeded } from './config.js';
import { graphicsProfile } from './graphics.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { natureTexture } from './nature-assets.js';
import { patchShader } from './shader-patches.js';
import { profileRenderPass } from './render-profiler.js';
import { sceneColorTarget, prepareSceneTarget, scaledTargetSize, restoreTarget, renderTargetDiagnostics } from './render-targets.js';
import { WaterVisibility } from './water-visibility.js';

export const SEA_LEVEL=-1.1;
const sunDirection=new THREE.Vector3(-35,65,25).normalize();
export function createWaterDepth(heightAt,size=256,extent=160){
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const wx=(x/(size-1)-.5)*extent,wz=(y/(size-1)-.5)*extent;
    const depth=Math.max(0,SEA_LEVEL-heightAt(wx,wz));
    const i=(y*size+x)*4;data[i]=Math.round(Math.min(1,depth/8)*255);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  texture.name='Island water depth';return texture;
}

const vertexShader=`
uniform float shoreRadius;uniform float time; varying vec3 seaPosition; varying vec4 mirrorPosition;varying float surfaceViewDepth;
uniform mat4 textureMatrix;
#include <fog_pars_vertex>
void main(){
  vec3 p=position;
  float offshore=smoothstep(shoreRadius,shoreRadius+22.,length(p.xz));
  p.y+=offshore*(sin(p.x*.18+p.z*.11+time*.7)*.08+sin(p.z*.31-time*.9)*.035);
  vec4 world=modelMatrix*vec4(p,1.);
  seaPosition=world.xyz;mirrorPosition=textureMatrix*world;
  vec4 mvPosition=viewMatrix*world;surfaceViewDepth=-mvPosition.z;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const fragmentShader=`
uniform float waterExtent;uniform float shoreRadius;uniform float time;uniform float reflectionStrength;uniform sampler2D reflectionMap;uniform sampler2D depthMap;uniform sampler2D rippleMap;
uniform vec3 sunDirection;varying vec3 seaPosition;varying vec4 mirrorPosition;
uniform sampler2D sceneColor;uniform sampler2D sceneDepth;uniform vec2 sceneResolution;uniform float refracting;uniform float cameraNear;uniform float cameraFar;varying float surfaceViewDepth;
#include <common>
#include <packing>
#include <fog_pars_fragment>
void main(){
  vec2 p=seaPosition.xz;
  vec2 ripple=(texture2D(rippleMap,p/19.+vec2(time*.008,time*.003)).rg-.5)*1.4;
  ripple+=(texture2D(rippleMap,p.yx/8.+vec2(-time*.011,time*.004)).rg-.5)*.6;
  vec3 n=normalize(vec3(-ripple.x,1.,-ripple.y));
  vec3 eye=normalize(cameraPosition-seaPosition),reflected=reflect(-eye,n);
  float fresnel=.025+.94*pow(1.-max(dot(n,eye),0.),5.);
  vec3 sky=mix(vec3(.24,.60,.73),vec3(.035,.20,.48),clamp(reflected.y,0.,1.));
  float depth=texture2D(depthMap,clamp(p/waterExtent+.5,0.,1.)).r*8.;
  depth=max(depth,max(0.,length(p)-shoreRadius)*.2+.3);
  float shallows=exp(-depth*.30);
  vec3 seabed=mix(vec3(.012,.13,.19),vec3(.12,.45,.35),shallows);
  if(refracting>.5){
    vec2 screenUV=gl_FragCoord.xy/sceneResolution;
    vec2 offset=ripple*.010*(1.-exp(-depth*.8));
    vec2 sampleUV=clamp(screenUV+offset,.001,.999);
    float behind=-perspectiveDepthToViewZ(texture2D(sceneDepth,sampleUV).x,cameraNear,cameraFar);
    if(behind<surfaceViewDepth+.02)sampleUV=screenUV;
    float sceneZ=-perspectiveDepthToViewZ(texture2D(sceneDepth,sampleUV).x,cameraNear,cameraFar);
    float thickness=max(0.,sceneZ-surfaceViewDepth);
    vec3 transmission=exp(-vec3(.34,.105,.075)*thickness);
    seabed=texture2D(sceneColor,sampleUV).rgb*transmission+vec3(.018,.24,.25)*(1.-transmission);
  }
  vec2 uv=mirrorPosition.xy/max(mirrorPosition.w,.001)+ripple*.008;
  float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  vec3 reflection=mix(sky,texture2D(reflectionMap,clamp(uv,.002,.998)).rgb,reflectionStrength*inside*.75);
  vec3 color=mix(seabed,reflection,fresnel);
  float sun=pow(max(dot(reflected,sunDirection),0.),220.);
  color+=vec3(1.,.88,.64)*sun*2.6;
  // The depth mask follows the actual island, so foam meets sand rather than a fixed ring.
  float shoreDepth=texture2D(depthMap,clamp(p/waterExtent+.5,0.,1.)).r*8.;
  float shore=1.-smoothstep(.04,.30,shoreDepth);
  float wash=.55+.45*sin(time*1.1-p.x*.21-p.y*.15);
  // Crossing world-axis sine waves create a diamond checker in shallow foam.
  // Reuse the already filtered, organic ripple samples; no new texture fetches.
  float foamSignal=dot(ripple,vec2(.8,.6));
  float foamFilter=max(.02,fwidth(foamSignal));
  float lace=smoothstep(-.04-foamFilter,.14+foamFilter,foamSignal);
  float foam=shore*wash*(.35+.65*lace);
  color=mix(color,vec3(.82,.94,.87),foam*.72);
  gl_FragColor=vec4(color,refracting>.5?1.:clamp(.22+depth*.17+fresnel*.8,.22,1.));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class IslandWater extends THREE.Mesh {
  constructor(heightAt,map={shore:73,waterExtent:160}){
    // Radial geometry concentrates small swells at the shore; the horizon is cheap.
    const positions=[],indices=[],rings=25,segments=128;
    for(let r=0;r<=rings;r++){
      const radius=r===0?0:r<=10?map.shore-8+r*2:map.shore+12+(r-10)**2*3.3;
      for(let a=0;a<=segments;a++){const theta=a/segments*Math.PI*2;positions.push(Math.cos(theta)*radius,0,Math.sin(theta)*radius);}
    }
    for(let r=0;r<rings;r++)for(let a=0;a<segments;a++){const i=r*(segments+1)+a,j=i+segments+1;indices.push(i,j,i+1,j,j+1,i+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
    const target=sceneColorTarget('Coast reflection');
    const refractionTarget=sceneColorTarget('Underwater scene',{depthTexture:true});
    const uniforms=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{shoreRadius:{value:map.shore},waterExtent:{value:map.waterExtent},time:{value:0},depthMap:{value:null},rippleMap:{value:null},reflectionMap:{value:null},reflectionStrength:{value:0},sunDirection:{value:sunDirection},textureMatrix:{value:new THREE.Matrix4()},sceneColor:{value:null},sceneDepth:{value:null},sceneResolution:{value:new THREE.Vector2(1,1)},refracting:{value:0},cameraNear:{value:.1},cameraFar:{value:600}}]);
    super(geometry,new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,fog:true,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
    // UniformsUtils clones textures; use the actual render target texture.
    this.material.uniforms.reflectionMap.value=target.texture;
    this.material.uniforms.depthMap.value=createWaterDepth(heightAt,map.waterExtent>160?512:256,map.waterExtent);
    this.waterVisibility=new WaterVisibility(this.material.uniforms.depthMap.value,map.waterExtent,SEA_LEVEL,map.shore+12+(rings-10)**2*3.3);
    this.material.uniforms.rippleMap.value=natureTexture('waternormals');
    this.map=map;this.heightAt=heightAt;this.position.y=SEA_LEVEL;this.name='Breezy Bay living water';this.target=target;this.refractionTarget=refractionTarget;this.low=false;this.nextReflection=0;this.reflectionPasses=0;this.refractionPasses=0;this.exclude=[];this.profile=graphicsProfile('high');this.renderOrder=-5;
    this.material.uniforms.sceneColor.value=refractionTarget.texture;this.material.uniforms.sceneDepth.value=refractionTarget.depthTexture;
    this.mirrorCamera=new THREE.PerspectiveCamera();this.onBeforeRender=(renderer,scene,camera)=>{this.refractCoast(renderer,scene,camera);this.reflectCoast(renderer,scene,camera);};
  }
  setQuality(value){
    this.profile=graphicsProfile(value);this.low=!this.profile.reflections;this.material.uniforms.reflectionStrength.value=0;this.material.uniforms.refracting.value=0;this.nextReflection=0;
    // Drop the large allocations when a pass is disabled. Targets are resized
    // lazily on re-enable, with their original texture uniform references intact.
    if(!this.profile.refraction)this.refractionTarget.setSize(8,8);
    if(!this.profile.reflections)this.target.setSize(8,8);
  }
  update(t){this.material.uniforms.time.value=t;}
  coastVisible(camera){
    const views=camera.isArrayCamera?camera.cameras:[camera];
    return views.some(view=>view.getWorldPosition(new THREE.Vector3()).y>=SEA_LEVEL)&&this.waterVisibility.isVisible(camera,this.profile.waterMinCoverage??.01,this.profile.waterDetailDistance??(this.profile.reflections?70:55));
  }
  refractCoast(renderer,scene,camera){
    const u=this.material.uniforms;u.refracting.value=0;
    if(this.disposed||!this.profile.refraction||!this.coastVisible(camera))return;
    this.hdrSupported=prepareSceneTarget(renderer,this.refractionTarget);if(!this.hdrSupported)return;
    const size=renderer.getDrawingBufferSize(u.sceneResolution.value),[w,h]=scaledTargetSize(size.x,size.y,this.profile.waterScale,Math.min(this.profile.waterMaxDimension??1600,renderer.capabilities?.maxTextureSize??Infinity));
    if(this.refractionTarget.width!==w||this.refractionTarget.height!==h)this.refractionTarget.setSize(w,h);
    u.cameraNear.value=camera.near;u.cameraFar.value=camera.far;
    const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()??0,mip=renderer.getActiveMipmapLevel?.()??0,auto=renderer.shadowMap.autoUpdate,needs=renderer.shadowMap.needsUpdate,xr=renderer.xr.enabled,visible=this.visible;
    this.visible=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    try{renderer.setRenderTarget(this.refractionTarget);renderer.clear();profileRenderPass(renderer,'refraction',()=>renderer.render(scene,camera));u.refracting.value=1;this.refractionPasses++;}
    finally{restoreTarget(renderer,target,face,mip);renderer.shadowMap.autoUpdate=auto;renderer.shadowMap.needsUpdate=needs;renderer.xr.enabled=xr;this.visible=visible;}
  }
  reflectCoast(renderer,scene,camera){
    const uniforms=this.material.uniforms,eye=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const direction=camera.getWorldDirection(new THREE.Vector3());
    if(this.disposed||this.low||!this.coastVisible(camera)){uniforms.reflectionStrength.value=0;return;}
    this.hdrSupported=prepareSceneTarget(renderer,this.target);if(!this.hdrSupported){uniforms.reflectionStrength.value=0;return;}
    if(uniforms.time.value<this.nextReflection)return;
    uniforms.reflectionStrength.value=0;
    const reflectionSize=Math.min(this.profile.reflectionSize??768,renderer.capabilities?.maxTextureSize??Infinity),size=renderer.getDrawingBufferSize?.(new THREE.Vector2())??new THREE.Vector2(reflectionSize,reflectionSize),[w,h]=scaledTargetSize(size.x,size.y,1,reflectionSize);
    if(this.target.width!==w||this.target.height!==h)this.target.setSize(w,h);
    const mirror=this.mirrorCamera;mirror.position.copy(eye);mirror.position.y=2*SEA_LEVEL-eye.y;
    direction.y*=-1;mirror.up.set(0,-1,0);mirror.lookAt(mirror.position.clone().add(direction));
    mirror.near=camera.near;mirror.far=camera.far;mirror.projectionMatrix.copy(camera.projectionMatrix);mirror.updateMatrixWorld();
    uniforms.textureMatrix.value.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Oblique near plane clips the sea floor from the reflected image.
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-SEA_LEVEL).applyMatrix4(mirror.matrixWorldInverse);
    const clip=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant),e=mirror.projectionMatrix.elements;
    const q=new THREE.Vector4((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
    clip.multiplyScalar(2/clip.dot(q));e[2]=clip.x;e[6]=clip.y;e[10]=clip.z+1-.003;e[14]=clip.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    const oldTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()??0,mip=renderer.getActiveMipmapLevel?.()??0,oldAuto=renderer.shadowMap.autoUpdate,oldNeeds=renderer.shadowMap.needsUpdate,oldXR=renderer.xr.enabled,oldVisible=this.visible;
    const visibility=this.exclude.map(o=>o.visible);
    this.visible=false;this.exclude.forEach(o=>o.visible=false);renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    try{renderer.setRenderTarget(this.target);renderer.clear();profileRenderPass(renderer,'reflection',()=>renderer.render(scene,mirror));this.reflectionPasses++;uniforms.reflectionStrength.value=1;this.nextReflection=uniforms.time.value+1/(this.profile.reflectionHz??20);}
    finally{restoreTarget(renderer,oldTarget,face,mip);renderer.shadowMap.autoUpdate=oldAuto;renderer.shadowMap.needsUpdate=oldNeeds;renderer.xr.enabled=oldXR;this.visible=oldVisible;this.exclude.forEach((o,i)=>o.visible=visibility[i]);}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.onBeforeRender=()=>{};
    this.target.dispose();this.refractionTarget.dispose();this.material.uniforms.depthMap.value.dispose();
    this.geometry.dispose();this.material.dispose();this.waterVisibility.dispose();this.exclude=[];
  }
  diagnostics(){
    const targets=this.disposed?[]:[renderTargetDiagnostics(this.target),renderTargetDiagnostics(this.refractionTarget)];
    return {owner:'IslandWater',hdrSupported:this.hdrSupported??null,targets,estimatedBytes:targets.reduce((sum,target)=>sum+target.estimatedBytes,0),detailDistance:this.profile.waterDetailDistance??(this.profile.reflections?70:55),reflectionHz:this.profile.reflectionHz??20,reflections:this.reflectionPasses,refractions:this.refractionPasses};
  }
}

export function createIslandSky({coastal=false}={}){
  const sky=new Sky();sky.scale.setScalar(400);const u=sky.material.uniforms;u.turbidity.value=coastal?1.55:2;u.rayleigh.value=coastal?2.0:2.4;u.mieCoefficient.value=coastal?.0015:.002;u.mieDirectionalG.value=.78;u.sunPosition.value.copy(sunDirection);
  const tint=coastal?'vec3(0.075,0.175,0.39)':'vec3(0.18,0.27,0.42)';
  sky.material.fragmentShader=patchShader(sky.material.fragmentShader,'vec4( retColor, 1.0 )',`vec4( retColor * ${tint}, 1.0 )`,'island sky color');
  sky.name=coastal?'Clear Sunhaven maritime atmosphere':'Breezy Bay atmosphere';sky.frustumCulled=false;return sky;
}

const cloudMaterials=new Map();
export function createCloud({coastal=false,variant=0}={}){
  const key=coastal?`coastal-${Math.abs(Math.trunc(variant))%3}`:'original';
  if(!cloudMaterials.has(key)){
    if(coastal){
      const shape=Math.abs(Math.trunc(variant))%3,size=512,data=new Uint8Array(size*size*4),rng=seeded(1249+shape*79);
      // Different major masses matter more than varying tiny edge noise: the
      // first coastal version repeated the same cloud silhouette nine times.
      const puffs=[
        [[-.60,-.15,.28,.24],[-.37,.04,.32,.40],[-.04,.22,.35,.58],[.34,.1,.29,.45],[.61,-.13,.29,.26],[-.1,-.20,.56,.24]],
        [[-.61,-.16,.27,.23],[-.34,.22,.33,.50],[.02,-.02,.34,.34],[.38,.16,.32,.48],[.64,-.17,.24,.20],[.04,-.22,.60,.20]],
        [[-.57,-.16,.27,.25],[-.23,.26,.36,.59],[.24,.31,.28,.52],[.51,-.01,.30,.37],[.71,-.20,.18,.17],[-.02,-.20,.60,.23]],
      ][shape];
      for(let i=0;i<8;i++)puffs.push([(rng()-.5)*1.36,-.03+rng()*.25,.11+rng()*.14,.12+rng()*.16]);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const u=x/(size-1)*2-1,v=y/(size-1)*2-1,edgeNoise=(Math.sin(u*39+Math.sin(v*19))+Math.sin(v*33+u*17))*.005;let density=0,litDensity=0;
        for(const [cx,cy,rx,ry]of puffs){
          const dx=(u-cx+edgeNoise)/rx,dy=(v-cy)/ry,d=dx*dx+dy*dy,weight=Math.exp(-d*2.9)*.67;
          const light=Math.max(0,Math.min(1,-dx*.32+dy*.62+Math.sqrt(Math.max(0,1-d))*.7));
          density+=weight;litDensity+=weight*light;
        }
        const body=Math.max(0,Math.min(1,(density-.042)*4.9)),upper=Math.max(0,Math.min(1,(v+.27)*2.2));
        const occlusion=Math.min(.14,Math.max(0,density-.62)*.16)*(1-upper),shade=Math.max(0,Math.min(1,(litDensity/Math.max(.001,density))*.56+upper*.44-occlusion)),i=(y*size+x)*4;
        // Deliberately wider source contrast survives ACES' compression of
        // highlights. Cool recessed undersides support overlapping white lobes.
        data[i]=139+shade*116;data[i+1]=163+shade*91;data[i+2]=194+shade*58;data[i+3]=Math.round(body*246);
      }
      const texture=new THREE.DataTexture(data,size,size);texture.name=`Sunhaven cumulus ${variant%3}`;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
      // Clouds belong to the distant atmosphere; ground-distance fog flattened
      // their shaded puff volume into a pale strip at these 200m sky positions.
      const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,fog:false,color:0xffffff});material.name='Soft maritime cumulus';material.addEventListener('dispose',()=>cloudMaterials.delete(key));cloudMaterials.set(key,material);
    }else{
    const size=256,data=new Uint8Array(size*size*4),rng=seeded(459),puffs=[];
    for(let i=0;i<26;i++)puffs.push([(rng()-.5)*1.45,(rng()-.5)*.54,.12+rng()*.22]);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/(size-1)*2-1,v=y/(size-1)*2-1,noise=Math.sin(u*39+Math.sin(v*23))*Math.sin(v*31+Math.sin(u*19))*.035;let density=0;
      for(const [cx,cy,r] of puffs){const d=Math.hypot(u-cx+noise,v-cy+noise)/r;density+=Math.exp(-d*d*3)*.56;}
      const edge=Math.max(0,Math.min(1,(density-.035)*2.8)),i=(y*size+x)*4,shade=220+v*38+Math.min(1,density)*14;
      data[i]=Math.min(255,shade);data[i+1]=Math.min(255,shade+4);data[i+2]=Math.min(255,shade+9);data[i+3]=edge*220;
    }
    const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,fog:true,color:0xffffff});material.addEventListener('dispose',()=>cloudMaterials.delete(key));cloudMaterials.set(key,material);
    }
  }
  const cloud=new THREE.Sprite(cloudMaterials.get(key));cloud.name=coastal?'Broad Sunhaven cumulus':'Soft sea cloud';return cloud;
}
