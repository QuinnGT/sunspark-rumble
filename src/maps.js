import { clamp, stormRadius } from './config.js';
import { TerrainHeightfield } from './terrain-heightfield.js';
import { SURFACE_CLEARANCE } from './surface-layers.js';

export const BREEZY_PADS=[[-19,-11,5.5,6],[20,-18,5.5,6],[28,22,5,6],[-29,24,3,6],[0,-28,9,5]];
export function breezyHeightSource(x,z){
  const r=Math.hypot(x,z);
  let y=1.3+6.5*Math.exp(-((x+4)**2+(z+28)**2)/420)+3.2*Math.exp(-((x+31)**2+(z-5)**2)/260)+3.8*Math.exp(-((x-30)**2+(z-24)**2)/380);
  y+=.48*Math.sin(x*.10)*Math.cos(z*.13);
  for(const [px,pz,py,rad] of BREEZY_PADS){const t=clamp((rad+4-Math.hypot(x-px,z-pz))/4,0,1);y=y*(1-t)+py*t;}
  const edge=clamp((73-r)/13,0,1);return y*edge-(1-edge)*1.4-Math.max(0,r-73)*.2;
}
export const DISTRICTS=[
  {id:'heights',name:'Lantern Heights',x:0,z:-78,r:24},
  {id:'grove',name:'Orchard Grove',x:-72,z:-28,r:28},
  {id:'village',name:'Sunbeam Village',x:0,z:0,r:29},
  {id:'docks',name:'Driftwood Docks',x:78,z:22,r:26},
  {id:'quarry',name:'Pebble Quarry',x:-46,z:68,r:29}
];
export const SUNHAVEN_ROUTES=[
  [[0,-78],[-36,-66],[-72,-28],[-76,24],[-46,68],[18,81],[59,64],[78,22],[67,-25],[35,-65],[0,-78]],
  [[0,-78],[8,-40],[0,0]],[[-72,-28],[-35,-10],[0,0]],[[78,22],[44,15],[0,0]],[[-46,68],[-18,38],[0,0]]
];
export function routeDistance(x,z,routes=SUNHAVEN_ROUTES){
  let distance=Infinity;for(const route of routes)for(let i=1;i<route.length;i++){
    const [ax,az]=route[i-1],[bx,bz]=route[i],dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
  }return distance;
}
const SUNHAVEN_PADS=[[-12,-12,3.2,7],[12,-12,3.2,7],[-12,12,3.2,7],[12,12,3.2,7],[0,0,3.2,10],[0,-78,10,6],[-83,-32,3.3,7],[76,10,1.5,7],[-46,68,2.8,25]];
export function quarryRise(x,z){
  const shelf=(cx,cz,rx,rz,inner)=>{
    const dx=(x-cx)/rx,dz=(z-cz)/rz,a=Math.atan2(dz,dx),r=Math.hypot(dx,dz)/(1+.035*Math.sin(a*3)+.025*Math.sin(a*5));
    const t=clamp((r-inner)/(1-inner),0,1);return 2*(1-t*t*(3-2*t));
  };
  return Math.max(shelf(-53,67,14,15,.56)+shelf(-53,61,9,7.5,.48),shelf(-38,61,10,10,.54));
}
// The established gameplay shell remains available to verify unchanged support
// outside the explicitly approved docks/headland revisions.
export function sunhavenBaseHeight(x,z){
  const r=Math.hypot(x,z);
  let y=2.1+8*Math.exp(-(x*x+(z+77)**2)/650)+3.3*Math.exp(-((x+72)**2+(z+28)**2)/650)+2.4*Math.exp(-((x-49)**2+(z-60)**2)/700);
  y+=.55*Math.sin(x*.07)*Math.cos(z*.09);
  for(const [px,pz,py,rad] of SUNHAVEN_PADS){const t=clamp((rad+7-Math.hypot(x-px,z-pz))/7,0,1);y=y*(1-t)+py*t;}
  y+=quarryRise(x,z);
  // The eastern cove is shallow and small. Its dry boardwalks provide two exits.
  const inlet=Math.exp(-((x-98)**2/130+(z-26)**2/340));y-=5.7*inlet+2.8*clamp((x-100)/8,0,1)*Math.exp(-((z-26)**2)/300);
  const edge=clamp((126-r)/15,0,1);return y*edge-(1-edge)*1.6-Math.max(0,r-126)*.22;
}
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const SUNHAVEN_SHED_PADS=[[-30,58],[35,77]];
export function sunhavenFoundationHeight(x,z,height){
  for(const [cx,cz] of SUNHAVEN_SHED_PADS){
    // Cover the 6x5 floor plus its bounding one-metre terrain vertices. Cut
    // only the protruding ground, blending out over two metres. The existing
    // centre height and floor/collision top remain unchanged.
    const edge=Math.max(Math.abs(x-cx)-3.25,Math.abs(z-cz)-3);
    if(edge>=2)continue;
    const ceiling=Math.fround(sunhavenBaseHeight(cx,cz))+.18-SURFACE_CLEARANCE-.005;
    if(height>ceiling)height+=(ceiling-height)*(1-smooth(0,2,edge));
  }
  return height;
}
export const SUNHAVEN_LANDFORMS=Object.freeze([
  {id:'dock-north',x:91,z:0,rx:13,rz:10,height:2.1},
  {id:'dock-bank',x:61,z:31,rx:10,rz:8,height:1.2},
  {id:'dock-south',x:87,z:51,rx:13,rz:9,height:1.7},
  {id:'lantern-west',x:-16,z:-91,rx:12,rz:9,height:1.6},
  {id:'lantern-east',x:19,z:-85,rx:10,rz:16,height:1.8},
  {id:'orchard-west',x:-104,z:-25,rx:9,rz:20,height:1.15},
  {id:'orchard-north',x:-75,z:-64,rx:15,rz:8,height:.9},
  {id:'village-east',x:32,z:-4,rx:9,rz:10,height:.9}
]);
const ART_RAMP_CLEARANCES=[
  [1.5,-12,7,4.5],[25.5,-12,7,4.5],[-.5,12,7,4.5],[23.5,12,7,4.5],
  [-74.5,-32,7,4.5],[84.5,10,7,4.5],[75,20,9,4.5],[75,39,9,4.5],
  [-53,79,5,7],[-65,67,7,5],[-53,69,5,7],[-38,70,5,7]
];
export function sunhavenArtClearance(x,z){
  let fade=smooth(4.6,8.2,routeDistance(x,z));
  if(!fade)return 0;
  for(const [px,pz,,radius] of SUNHAVEN_PADS)fade=Math.min(fade,smooth(radius+2,radius+6,Math.hypot(x-px,z-pz)));
  for(const [cx,cz,rx,rz] of ART_RAMP_CLEARANCES)fade=Math.min(fade,smooth(0,3,Math.max(Math.abs(x-cx)-rx,Math.abs(z-cz)-rz)));
  // Constants are resolved only when sampled after MAPS has initialized.
  for(const sites of [MAPS.sunhaven.spawns,MAPS.sunhaven.finales])for(const [sx,sz] of sites)fade=Math.min(fade,smooth(4.5,8,Math.hypot(x-sx,z-sz)));
  return fade;
}
export function sunhavenLandformMask(x,z){
  let shoulder=0;
  for(const form of SUNHAVEN_LANDFORMS){
    const u=(x-form.x)/form.rx,v=(z-form.z)/form.rz,angle=Math.atan2(v,u),radius=Math.hypot(u,v)/(1+.07*Math.sin(angle*3)+.035*Math.cos(angle*5));
    shoulder=Math.max(shoulder,1-smooth(.28,1,radius));
  }
  const docks=docksShelfMask(x,z);
  return Math.max(shoulder*sunhavenArtClearance(x,z),docks?docks*docksShelfClearance(x,z):0,docksCoveBankMask(x,z));
}
export function sunhavenHarborBasin(x,z){
  // A broad curved basin beneath the existing boardwalks joins the moored boat
  // to the open cove. The route/ramp/pad clearance mask still protects the land.
  const angle=Math.atan2(z-29.5,x-91),edge=1+.035*Math.sin(angle*3);
  const radius=Math.hypot((x-91)/14,(z-29.5)/11)/edge;
  return 1-smooth(.42,1,radius);
}
export function sunhavenArtHeightSource(x,z){
  const base=sunhavenFoundationHeight(x,z,sunhavenBaseHeight(x,z)),clearance=sunhavenArtClearance(x,z);
  if(!clearance)return base;
  let sculpture=0;
  for(const form of SUNHAVEN_LANDFORMS){
    const u=(x-form.x)/form.rx,v=(z-form.z)/form.rz,angle=Math.atan2(v,u),radius=Math.hypot(u,v)/(1+.07*Math.sin(angle*3)+.035*Math.cos(angle*5));
    sculpture+=form.height*(1-smooth(.28,1,radius));
  }
  const harborFloor=-2.65+.16*Math.sin(x*.39)*Math.cos(z*.31);
  sculpture-=Math.max(0,base-harborFloor)*sunhavenHarborBasin(x,z);
  const radius=Math.hypot(x,z),angle=Math.atan2(z,x);
  // Broad headlands and small beaches break the old perfectly circular edge.
  // All detail lives in this sampled source: visual and gameplay heights agree.
  const coastShift=2.1*Math.sin(angle*5+.4)+1.25*Math.cos(angle*9-.6);
  sculpture+=coastShift*.17*smooth(109,116,radius)*(1-smooth(132,142,radius));
  if(base<-.85){
    const cove=Math.exp(-((x-99)**2/170+(z-27)**2/280));
    const shelf=.65*Math.exp(-((x-94)**2/18+(z-32)**2/70))-.72*Math.exp(-((x-103)**2/30+(z-25)**2/105));
    const seabed=.34*Math.sin(x*.28+z*.11)*Math.cos(z*.21)*smooth(114,122,radius)*(1-smooth(134,145,radius));
    // Keep all raised seabed safely submerged; shoreline wet/dry transition
    // stays continuous while a visibly deeper channel runs out of the harbor.
    sculpture+=Math.min(shelf*cove+seabed,Math.max(0,-1.38-base));
  }
  return base+sculpture*clearance;
}
// The docks milestone deliberately revises selected architecture/access heights.
// Keep the 1.10.1 art source above as an independent baseline for scope checks.
export const DOCKS_LANDFORM_BOUNDS=Object.freeze([
  {id:'docks-architecture',minX:58,maxX:86,minZ:-3,maxZ:23},
  {id:'north-cove',minX:77,maxX:112,minZ:-17,maxZ:13},
  {id:'south-cove',minX:74,maxX:114,minZ:39,maxZ:67},
  {id:'open-harbor',minX:78,maxX:109,minZ:17.25,maxZ:42.1},
  {id:'lantern-terraces',minX:-28,maxX:28,minZ:-102,maxZ:-58}
]);
export const DOCKS_SHELVES=Object.freeze([
  {id:'north-cove',x:94,z:-2,rx:15,rz:13,lower:2.8,upper:2.7,phase:.7},
  {id:'south-cove',x:94,z:53,rx:17,rz:12,lower:2.6,upper:1.7,phase:2.2},
  {id:'lantern-west',x:-14,z:-80,rx:11,rz:17,lower:1.2,upper:1.25,phase:1.4},
  {id:'lantern-east',x:14,z:-81,rx:11,rz:17,lower:1.7,upper:1.4,phase:3.1}
]);
export function inDocksLandformBounds(x,z,padding=0){
  return DOCKS_LANDFORM_BOUNDS.some(b=>x>=b.minX-padding&&x<=b.maxX+padding&&z>=b.minZ-padding&&z<=b.maxZ+padding);
}
function shelfRadius(form,x,z){
  const u=(x-form.x)/form.rx,v=(z-form.z)/form.rz,a=Math.atan2(v,u);
  return Math.hypot(u,v)/(1+.065*Math.sin(a*3+form.phase)+.035*Math.cos(a*7-form.phase));
}
export function docksShelfMask(x,z){
  return Math.max(...DOCKS_SHELVES.map(f=>1-smooth(.72,1,shelfRadius(f,x,z))),docksCoveBankMask(x,z));
}
// The boardwalk outlines water, not a grassy trench. This local cove cut
// deliberately overrides the old route-art mask beneath the permanent decks.
// West and north/south curves blend to the bank; x<=78 keeps both ramp mouths.
export function docksCoveWeight(x,z){
  if(x<=78||x>=109||z<=17.25||z>=42.1)return 0;
  const west=78.25+.18*Math.sin((z-18)*.42);
  const north=17.8+.45*Math.sin((x-79)*.34),south=41.5+.55*Math.sin((x-79)*.31+1);
  return smooth(west,west+2.2,x)*smooth(north,north+3,z)*(1-smooth(39.3,south,z))*(1-smooth(104,109,x));
}
export function docksCoveBankMask(x,z){
  const weight=docksCoveWeight(x,z);return 4*weight*(1-weight);
}
export function docksCoveHeight(x,z,height){
  const weight=docksCoveWeight(x,z);
  // Shallow sand around the piles leads into the already deeper natural cove.
  // Cutting only high terrain keeps existing offshore channels unmodified.
  const shallows=-1.62-.25*smooth(82,103,x)+.10*Math.sin(x*.39)*Math.cos(z*.26);
  return height>shallows?height+(shallows-height)*weight:height;
}
function docksShelfClearance(x,z){
  let fade=smooth(3.5,7,routeDistance(x,z));
  // The summit tower and existing cover retain their authored support surface.
  fade=Math.min(fade,smooth(7.5,11,Math.hypot(x,z+78)));
  for(const sites of [MAPS.sunhaven.spawns,MAPS.sunhaven.finales])for(const [sx,sz] of sites)fade=Math.min(fade,smooth(4.5,8,Math.hypot(x-sx,z-sz)));
  return fade;
}
function rectangleWeight(x,z,minX,maxX,minZ,maxZ,blend){
  return 1-smooth(0,blend,Math.max(minX-x,x-maxX,minZ-z,z-maxZ));
}
export function docksMilestoneHeight(x,z,baseline){
  if(!inDocksLandformBounds(x,z))return baseline;
  let height=baseline,added=0;
  for(const form of DOCKS_SHELVES){
    const radius=shelfRadius(form,x,z);
    // Broad crowns and two compact escarpments form connected shelves. The
    // one-metre field owns every top and the exposed cliff-face triangles.
    added+=form.lower*(1-smooth(.76,1,radius))+form.upper*(1-smooth(.33,.54,radius));
  }
  const rise=added*docksShelfClearance(x,z);
  // Keep the lighthouse summit visually above its flanking terraces.
  height+=z< -50?Math.min(rise,Math.max(0,9.55-baseline)):rise;
  // Raising these two short approach pads gives the new entrance and folded
  // terrace ramp a grounded landing. The old north/south dock ramps stay clear.
  for(const rect of [[61,65.5,4,19.5,3],[73.5,78.5,0,5,2.5]]){
    const weight=rectangleWeight(x,z,...rect);height+=(3.25-height)*weight;
  }
  // Floor + bounding terrain vertices, with a blend outside the assembly. Only
  // cut protrusions elsewhere: the boathouse still reads as timber on pilings.
  for(const rect of [[65,82,5,15,2],[69,83,15,17.5,1],[73,79,3,5,1],[61,65.5,4,19.5,1]]){
    const weight=rectangleWeight(x,z,...rect);
    if(height>3.25)height+=(3.25-height)*weight;
  }
  return docksCoveHeight(x,z,height);
}
export function sunhavenHeightSource(x,z){
  return docksMilestoneHeight(x,z,sunhavenArtHeightSource(x,z));
}
const fields=new Map();
export function mapTerrain(map='breezy'){
  const id=(typeof map==='string'?map:map.id)==='sunhaven'?'sunhaven':'breezy';
  if(!fields.has(id))fields.set(id,new TerrainHeightfield(id==='sunhaven'?sunhavenHeightSource:breezyHeightSource,{extent:id==='sunhaven'?320:220,spacing:1,chunkCells:32}));
  return fields.get(id);
}
// Every consumer (including older World.heightAt imports) sees the exact same
// sampled triangles, never a separate analytic approximation of the renderer.
export const breezyHeight=(x,z)=>mapTerrain('breezy').heightAt(x,z);
export const sunhavenHeight=(x,z)=>mapTerrain('sunhaven').heightAt(x,z);
export const MAPS={
  breezy:{id:'breezy',name:'Breezy Bay',radius:67,navRadius:64,buildRadius:62,shore:73,waterExtent:160,grassRadius:61,pads:BREEZY_PADS,heightAt:breezyHeight,botCount:8,districts:[],spawns:[[0,42]],finales:[[0,0]]},
  sunhaven:{id:'sunhaven',name:'Sunhaven Island',radius:120,navRadius:116,buildRadius:115,shore:126,waterExtent:280,grassRadius:113,pads:SUNHAVEN_PADS,heightAt:sunhavenHeight,botCount:10,districts:DISTRICTS,
    spawns:[[-78,-12],[12,-91],[73,45],[-60,88],[-88,-47],[-30,-79],[48,-73],[87,-13],[55,72],[-20,92],[-88,20],[-40,-30],[26,38],[34,-31],[-27,21],[4,57]],
    finales:[[0,4],[-67,-14],[63,29],[-40,84],[7,-60]]}
};
export const mapKey=value=>value==='sunhaven'?'sunhaven':'breezy';

export function stormState(map,time,seed=0){
  if(map.id==='breezy'){const radius=stormRadius(time);return {x:0,z:0,radius,next:{x:0,z:0,radius:0},phase:time<45?'waiting':'closing',remaining:Math.max(0,(time<45?45:255)-time),end:255};}
  const [fx,fz]=map.finales[Math.abs(seed)%map.finales.length];
  // Center steps stay nested even for the farthest authored finale (radius < 94).
  const frames=[[0,118,0],[40,118,0],[100,84,.36],[120,84,.36],[180,50,.72],[195,50,.72],[240,23,1],[250,23,1],[285,0,1]];
  let i=frames.findIndex(f=>f[0]>time);if(i<0)i=frames.length-1;
  const a=frames[Math.max(0,i-1)],b=frames[i],t=clamp((time-a[0])/Math.max(1,b[0]-a[0]),0,1),blend=a[2]+(b[2]-a[2])*t;
  const hold=a[1]===b[1],next=frames[Math.min(frames.length-1,hold?i+1:i)];
  return {x:fx*blend,z:fz*blend,radius:a[1]+(b[1]-a[1])*t,next:{x:fx*next[2],z:fz*next[2],radius:next[1]},phase:hold?'waiting':'closing',remaining:Math.max(0,b[0]-time),end:285};
}
