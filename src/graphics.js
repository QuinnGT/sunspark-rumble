// Shared render presets. They never alter physics, opponents, or match rules.
export const GRAPHICS={
  low:{name:'Smooth',pixelRatio:1,shadows:false,shadowSize:512,shadowHz:0,reflections:false,refraction:false,waterScale:.4,meadow:false,grassDensity:0,grassDistance:0,leafDistance:26,actorDistance:26,description:'Extra speed with detailed materials, simpler distant canopies, clear water and sky reflections. No grass or dynamic shadows.'},
  balanced:{name:'Balanced',pixelRatio:1.25,shadows:true,shadowSize:1536,shadowHz:20,reflections:false,refraction:true,waterScale:.5,meadow:true,grassDensity:.55,grassDistance:38,leafDistance:48,actorDistance:38,description:'Rich trees, nearby meadow grass, canopy shadows, and clear refracting shallows. A good starting point.'},
  high:{contactShadows:true,name:'Detailed',pixelRatio:1.5,shadows:true,shadowSize:2048,shadowHz:30,reflections:true,refraction:true,waterScale:.7,meadow:true,grassDensity:1,grassDistance:58,leafDistance:76,actorDistance:48,description:'Full meadow density, longer foliage detail, crisp nearby shadows, refracting shallows and reflected coastline.'}
};
export function qualityKey(value){
  if(value===true)return 'low';if(value===false)return 'high';
  return Object.hasOwn(GRAPHICS,value)?value:'balanced';
}
export const graphicsProfile=value=>GRAPHICS[qualityKey(value)];

for(const [key,profile] of Object.entries(GRAPHICS))Object.assign(profile,{
  maxPixels:key==='low'?1600000:key==='balanced'?2600000:4000000,
  waterMaxDimension:key==='high'?1600:1200,reflectionSize:768,reflectionHz:20,waterMinCoverage:.01,waterDetailDistance:key==='high'?70:key==='balanced'?55:0
});
export function renderPixelRatio(profile,width,height,deviceRatio=1,maxDimension=16384){
  const w=Math.max(1,width),h=Math.max(1,height);
  return Math.max(.05,Math.min(deviceRatio||1,profile.pixelRatio,Math.sqrt(profile.maxPixels/(w*h)),maxDimension/w,maxDimension/h));
}

// Use real frame intervals, not the capped physics delta. A one-second window
// is readable during play and still includes genuinely slow frames.
export class FrameMeter {
  constructor(){this.reset();}
  reset(){this.frames=0;this.seconds=0;this.value=null;}
  sample(seconds){
    if(!Number.isFinite(seconds)||seconds<=0)return false;
    this.frames++;this.seconds+=seconds;
    if(this.seconds<1-1e-9)return false;
    this.value=this.frames/this.seconds;this.frames=0;this.seconds=0;return true;
  }
}
