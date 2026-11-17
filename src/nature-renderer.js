// Small depth-based contact shading pass. It uses the correctly alpha-tested
// scene depth, avoiding the opaque foliage rectangles of an override material.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { profileRenderPass } from './render-profiler.js';
import { sceneColorTarget, prepareSceneTarget, restoreTarget, renderTargetDiagnostics, supportsSceneHDR } from './render-targets.js';
export class NatureRenderer {
  constructor(renderer){
    this.renderer=renderer;this.enabled=false;if(!renderer.isWebGLRenderer)return;
    this.target=sceneColorTarget('Detailed linear scene',{depthTexture:true,samples:4});
    this.uniforms={colorMap:{value:this.target.texture},depthMap:{value:this.target.depthTexture},inverseProjection:{value:new THREE.Matrix4()},resolution:{value:new THREE.Vector2()},strength:{value:.5}};
    this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,depthTest:false,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
      varying vec2 vUv;uniform sampler2D colorMap;uniform sampler2D depthMap;uniform mat4 inverseProjection;uniform vec2 resolution;uniform float strength;
      #include <common>
      vec3 viewPosition(vec2 uv,float depth){vec4 p=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
      void main(){
        vec3 color=texture2D(colorMap,vUv).rgb;float depth=texture2D(depthMap,vUv).r;
        vec3 p=viewPosition(vUv,depth);vec3 n=normalize(cross(dFdx(p),dFdy(p)));
        float radius=clamp(resolution.y*.42/max(.5,-p.z),2.,22.);float occlusion=0.;
        if(depth<.9999&&p.z> -100.){
          for(int i=0;i<12;i++){
            float angle=float(i)*2.399963;float ring=.35+.65*float(i%3)/2.;
            vec2 uv=clamp(vUv+vec2(cos(angle),sin(angle))*radius*ring/resolution,vec2(.001),vec2(.999));
            float d=texture2D(depthMap,uv).r;vec3 delta=viewPosition(uv,d)-p;float distance=length(delta);
            occlusion+=max(0.,dot(n,delta/max(distance,.0001))-.12)*(1.-smoothstep(.2,1.35,distance))*step(.025,distance);
          }
        }
        float ao=clamp(1.-occlusion/12.*strength*2.5,.78,1.);color*=ao;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.quad=new FullScreenQuad(this.material);
  }
  setQuality(profile){this.hdrSupported=supportsSceneHDR(this.renderer);this.enabled=!!this.target&&!!profile.contactShadows&&!this.disposed&&this.hdrSupported;if(this.target&&!this.enabled)this.target.setSize(8,8);}
  render(scene,camera){
    if(this.disposed)return;
    const renderer=this.renderer;if(!this.enabled){profileRenderPass(renderer,'main',()=>renderer.render(scene,camera));return;}
    if(!prepareSceneTarget(renderer,this.target)){this.enabled=false;this.hdrSupported=false;profileRenderPass(renderer,'main',()=>renderer.render(scene,camera));return;}
    const size=renderer.getDrawingBufferSize(this.uniforms.resolution.value);if(size.x!==this.target.width||size.y!==this.target.height)this.target.setSize(size.x,size.y);
    this.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()??0,mip=renderer.getActiveMipmapLevel?.()??0;
    try{renderer.setRenderTarget(this.target);renderer.clear();profileRenderPass(renderer,'main',()=>renderer.render(scene,camera));restoreTarget(renderer,previous,face,mip);profileRenderPass(renderer,'contact',()=>this.quad.render(renderer));}
    finally{restoreTarget(renderer,previous,face,mip);}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.enabled=false;
    this.target?.dispose();this.material?.dispose();this.quad?.dispose();
  }
  diagnostics(){const target=this.target&&!this.disposed?renderTargetDiagnostics(this.target):null;return {owner:'NatureRenderer',enabled:this.enabled,hdrSupported:this.hdrSupported??null,target,estimatedBytes:target?.estimatedBytes??0};}
}
