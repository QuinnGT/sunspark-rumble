import * as THREE from 'three';

// Offscreen scene color stays linear. Three r180 suppresses material tone
// mapping for non-XR render targets; only the final screen pass maps HDR color.
export function sceneColorTarget(name,{depthTexture=false,samples=0}={}){
  const target=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType,colorSpace:THREE.LinearSRGBColorSpace,depthBuffer:true,samples});
  target.texture.name=name;
  if(depthTexture)target.depthTexture=new THREE.DepthTexture(8,8);
  return target;
}

export function supportsSceneHDR(renderer){return !renderer.extensions?.has||renderer.extensions.has('EXT_color_buffer_float');}

export function prepareSceneTarget(renderer,target){
  // An RGBA8 intermediate would clip values above one before the final tone
  // mapping step. Skip the optional pass instead of changing the scene's color.
  if(!supportsSceneHDR(renderer)){target.setSize(8,8);return false;}
  const samples=Math.min(target.samples,renderer.capabilities?.maxSamples??target.samples);
  if(samples!==target.samples){target.dispose();target.samples=samples;}
  return true;
}

export function scaledTargetSize(width,height,scale,maxDimension){
  const factor=Math.min(scale,maxDimension/Math.max(width,height));
  return [Math.max(1,Math.round(width*factor)),Math.max(1,Math.round(height*factor))];
}

export function restoreTarget(renderer,target,face=0,mip=0){renderer.setRenderTarget(target,face,mip);}

export function estimateRenderTargetBytes(target){
  if(!target)return 0;
  const pixels=target.width*target.height*(target.depth||1)*(target.isWebGLCubeRenderTarget?6:1);
  const textures=target.textures||[target.texture];
  const colorBytes=textures.reduce((sum,texture)=>{
    const channels=texture.format===THREE.RedFormat||texture.format===THREE.RedIntegerFormat?1:texture.format===THREE.RGFormat||texture.format===THREE.RGIntegerFormat?2:texture.format===THREE.RGBFormat||texture.format===THREE.RGBIntegerFormat?3:4;
    const componentBytes=[THREE.FloatType,THREE.IntType,THREE.UnsignedIntType].includes(texture.type)?4:[THREE.HalfFloatType,THREE.ShortType,THREE.UnsignedShortType].includes(texture.type)?2:1;
    return sum+pixels*channels*componentBytes*(texture.generateMipmaps?4/3:1);
  },0);
  // Depth24 occupies a conservatively rounded 32-bit attachment. MSAA keeps
  // both the resolved framebuffer and multisampled color/depth renderbuffers.
  const depthBytes=target.depthBuffer?pixels*(target.depthTexture?.type===THREE.FloatType&&target.stencilBuffer?8:4):0;
  return Math.ceil((colorBytes+depthBytes)*(1+(target.samples||0)));
}

export function renderTargetDiagnostics(target){
  return {name:target.texture.name,width:target.width,height:target.height,samples:target.samples||0,color:target.texture.type===THREE.HalfFloatType?'linear-rgba16f':'linear-rgba8',estimatedBytes:estimateRenderTargetBytes(target),estimate:'Configured color/depth/MSAA attachments; excludes driver overhead; allocation is lazy'};
}
