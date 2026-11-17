// All channels in a layer use the same world-space repeat and projection. These
// are repeats per game metre, not per-mesh UVs, so asset/chunk size cannot stretch them.
export const TERRAIN_LAYERS=Object.freeze([
  Object.freeze({id:'grass',base:'grass_path_2',repeatsPerMeter:.68,color:'grass_path_2_Diffuse',normal:'grass_path_2_nor_gl',roughness:'grass_path_2_Rough'}),
  Object.freeze({id:'trail',base:'forest_ground_04',repeatsPerMeter:.34,color:'forest_ground_04_Diffuse',normal:'forest_ground_04_nor_gl',roughness:'forest_ground_04_Rough'}),
  Object.freeze({id:'sand',base:'sand_01',repeatsPerMeter:.2448,color:'sand_01_Diffuse',normal:'sand_01_nor_gl',roughness:'sand_01_Rough'}),
  Object.freeze({id:'rock',base:'rock_boulder_dry',repeatsPerMeter:.22,color:'rock_boulder_dry_Diffuse',normal:'rock_boulder_dry_nor_gl',roughness:'rock_boulder_dry_Rough'})
]);
const saturate=v=>Math.max(0,Math.min(1,v));
export function terrainLayerWeights([beach,trail,rock]){
  beach=saturate(beach);trail=saturate(trail);rock=saturate(rock);
  return [(1-beach)*(1-rock)*(1-trail),(1-beach)*(1-rock)*trail,beach,(1-beach)*rock];
}
export function terrainProjectionWeights([x,y,z]){
  const weights=[x,y,z].map(v=>Math.abs(v)**4),sum=weights.reduce((a,b)=>a+b,0);
  return sum?weights.map(v=>v/sum):[0,1,0];
}
export function terrainWetness(height){const t=saturate((height+1.05)/.73);return 1-t*t*(3-2*t);}
export const TERRAIN_MATERIAL_BUDGET=Object.freeze({maxTextureSize:1024,layers:4,channelsPerLayer:3,roughnessChannel:'g',normalConvention:'OpenGL',projection:'world triplanar',colorSpace:'sRGB color; linear normal/roughness'});

// Explicit sampler arguments compile in WebGL2 without dynamic sampler indexing.
// Almost-horizontal surfaces take only the Y projection; steep faces take X/Z.
// World derivatives are evaluated before mask/projection branches, and explicit
// texture gradients keep mip selection stable where neighboring pixels diverge.
export const TERRAIN_PROJECTION_GLSL=`
varying vec3 vTerrain;
varying vec3 vTerrainNormal;
uniform vec4 terrainScale;
uniform float groundTime;
uniform sampler2D trailMap,trailNormal,trailRoughness;
uniform sampler2D sandMap,sandNormal,sandRoughness;
uniform sampler2D rockMap,rockNormal,rockRoughness;
vec3 terrainWorldDx,terrainWorldDy;
vec3 terrainAxes(vec3 n){vec3 a=pow(abs(n),vec3(4.));return a/max(dot(a,vec3(1.)),.00001);}
vec3 terrainSigns(vec3 n){return step(vec3(0.),n)*2.-1.;}
vec3 terrainSample(sampler2D tex,vec3 p,vec3 axes,vec3 signs,float repeatScale){
  vec3 dx=terrainWorldDx*repeatScale,dy=terrainWorldDy*repeatScale;
  vec3 value=vec3(0.);
  if(axes.x>.0001)value+=textureGrad(tex,vec2(-p.z*signs.x,p.y),vec2(-dx.z*signs.x,dx.y),vec2(-dy.z*signs.x,dy.y)).rgb*axes.x;
  if(axes.y>.0001)value+=textureGrad(tex,vec2(p.x*signs.y,-p.z),vec2(dx.x*signs.y,-dx.z),vec2(dy.x*signs.y,-dy.z)).rgb*axes.y;
  if(axes.z>.0001)value+=textureGrad(tex,vec2(p.x*signs.z,p.y),vec2(dx.x*signs.z,dx.y),vec2(dy.x*signs.z,dy.y)).rgb*axes.z;
  return value;
}
vec2 terrainNormalSlope(vec3 texel,vec2 scale){vec3 n=texel*2.-1.;return n.xy*scale/max(n.z,.2);}
vec3 terrainNormalGradient(sampler2D tex,vec3 p,vec3 axes,vec3 signs,vec2 scale,float repeatScale){
  vec3 dx=terrainWorldDx*repeatScale,dy=terrainWorldDy*repeatScale;
  vec3 gradient=vec3(0.);vec2 slope;
  if(axes.x>.0001){slope=terrainNormalSlope(textureGrad(tex,vec2(-p.z*signs.x,p.y),vec2(-dx.z*signs.x,dx.y),vec2(-dy.z*signs.x,dy.y)).rgb,scale);gradient+=vec3(0.,slope.y,-slope.x*signs.x)*axes.x;}
  if(axes.y>.0001){slope=terrainNormalSlope(textureGrad(tex,vec2(p.x*signs.y,-p.z),vec2(dx.x*signs.y,-dx.z),vec2(dy.x*signs.y,-dy.z)).rgb,scale);gradient+=vec3(slope.x*signs.y,0.,-slope.y)*axes.y;}
  if(axes.z>.0001){slope=terrainNormalSlope(textureGrad(tex,vec2(p.x*signs.z,p.y),vec2(dx.x*signs.z,dx.y),vec2(dy.x*signs.z,dy.y)).rgb,scale);gradient+=vec3(slope.x*signs.z,slope.y,0.)*axes.z;}
  return gradient;
}
`;
