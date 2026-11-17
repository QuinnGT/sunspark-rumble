import * as THREE from 'three';
import { seeded } from './config.js';
import { box,ball,cylinder,PALETTE } from './world.js';
import { surface } from './materials.js';
import { rockGeometry } from './nature-ground.js';
import { createMapTerrain } from './terrain-surface.js';
import { routeDistance } from './maps.js';
import { createCloud } from './nature-water.js';
import { docksOakReserved } from './docks-oaks.js';
import { coastalMaterial } from './coastal-materials.js';
import { SURFACE_CLEARANCE } from './surface-layers.js';
import { createDocksArchitecture } from './docks-architecture.js';
import { createCoastalCrate,createCoastalDock,createCoastalBoat,createCoastalShed,decorateCoastalHouse,coastalSolidBox,coastalBox,coastalLantern,coastalLayeredDeck } from './coastal-kit.js';

// Authored gameplay geometry first; seeded scenery respects every travel corridor.
export function generateSunhaven(w){
  // The legacy rail/rock helpers do not author vertex colors. Their material
  // variants must not read a missing color buffer as black in WebGL.
  const H=w.heightAt,rng=seeded(180927),wood=coastalMaterial('timber',0xcdb17e,{vertexColors:false}),stone=coastalMaterial('stone',0xc1bca6,{vertexColors:false});
  w.ground=createMapTerrain(w.map);w.scene.add(w.ground);w.solids.push(w.ground);
  w.landmarks=[];
  const crate=(x,z,size=2.2,base=H(x,z))=>createCoastalCrate(w,x,z,size,base);
  const ramp=(x,z,y,yaw,width,length,rise)=>w.addRamp({x,z,y},yaw,width,length,rise,false);
  const lowWall=(x,z,width,height,depth)=>{
    const top=H(x,z)+height,bottom=Math.min(...[-width/2,0,width/2].flatMap(dx=>[-depth/2,0,depth/2].map(dz=>H(x+dx,z+dz))))-.12;
    coastalSolidBox(w,width,top-bottom,depth,coastalMaterial('stone',0xc1bca6),x,(top+bottom)/2,z,{bevel:.045});
    // Offset, individually capped courses read as built retaining walls rather
    // than a single smooth stone block. They remain inside the original cover.
    const count=Math.ceil(width/.85),span=width/count;
    for(let i=0;i<count;i++)coastalBox(w.scene,span-.018,.16,depth+.035,coastalMaterial('stone',i%2?0xd2c8ae:0xc4bca5),x-width*.5+(i+.5)*span,top-.075,z,{bevel:.025});
  };
  const rock=(x,z,size,seed)=>{
    if(w.map.finales.some(p=>Math.hypot(x-p[0],z-p[1])<size*1.6+2)||!w.sceneryFree(x,z,size*1.6)||w.isRampApproach(x,z,2))return;
    const m=new THREE.Mesh(rockGeometry(size,seed),stone);m.position.set(x,H(x,z)+size*.38,z);m.scale.set(1.3,.88,1);m.rotation.y=seed*.7;m.castShadow=m.receiveShadow=true;w.scene.add(m);w.rockCollider(m);
  };
  const sign=(x,z,color)=>{
    const y=H(x,z);cylinder(.06,.06,1.8,PALETTE.navy,x,y+.9,z,w.scene,6);
    box(1.5,.5,.12,color,x,y+1.65,z,w.scene);
    const badge=cylinder(.15,.15,.13,0xffdc62,x,y+1.65,z+.1,w.scene,12);badge.rotation.x=Math.PI/2;
  };

  // Sunbeam Village: two true interiors and two familiar solid roof platforms.
  for(const [x,z,color] of [[-12,-12,0x61adad],[12,-12,0xe99178]])openHouse(w,x,z,3.2,color);
  w.cabin(-12,12,3.2,0x6a9dba);w.cabin(12,12,3.2,0xd9b861);
  for(const [x,z] of [[-4,-4],[4,4],[-4,4]])lowWall(x,z,3,1.2,.55);
  const plaza=new THREE.Mesh(new THREE.CircleGeometry(6.5,48),surface('stone',0xe0d3ac));plaza.rotation.x=-Math.PI/2;plaza.position.set(0,3.215,0);plaza.receiveShadow=true;w.scene.add(plaza);
  const sun=new THREE.Mesh(new THREE.RingGeometry(1.2,1.45,32),new THREE.MeshBasicMaterial({color:0xe8bb4d}));sun.rotation.x=-Math.PI/2;sun.position.set(0,3.23,0);w.scene.add(sun);
  for(const [x,z] of [[-23,3],[23,-2],[3,24],[-24,-23]])crate(x,z);
  w.landmarks.push({id:'village',x:0,z:0});

  // Northern headland: broad natural access from both sides, usable lookout cover.
  w.lighthouse(0,-78,10);
  for(const [x,z] of [[-9,-81],[9,-80],[-10,-68],[12,-70]])lowWall(x,z,4,1.1,.7);
  crate(6,-88);crate(-12,-75);sign(13,-58,PALETTE.coral);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;rock(Math.cos(a)*19,-78+Math.sin(a)*19,1.3+i%3*.25,300+i);}

  // Orchard: deliberate rows, low walls and an open two-door equipment shed.
  openHouse(w,-83,-32,3.3,0x8eb470,true);
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
    const x=-91+row*8,z=-55+col*9;if(Math.hypot(x+83,z+32)<10||routeDistance(x,z)<4)continue;
    if(w.sceneryFree(x,z,2)){w.tree(x,z,.72+(row%2)*.12,false);
      for(let j=0;j<4;j++){const a=j*1.7;ball(.15,0xefb347,x+Math.cos(a)*1.25,H(x,z)+3.1+j*.14,z+Math.sin(a)*1.25,w.scene,1);}}
  }
  for(const z of [-58,-3])for(const x of [-89,-76,-61])lowWall(x,z,7,.95,.65);
  for(const [x,z] of [[-65,-35],[-79,-3]])crate(x,z);sign(-59,-22,0x92b763);

  // Rounded quarry shelves are part of the terrain heightfield. Short timber
  // access ramps cross the slopes; there are no rectangular stone collision boxes.
  const qy=2.8,deckLift=.32;
  for(const [x,z,y,width,depth] of [[-53,67,qy+2,16,16],[-53,62,qy+4,12,6],[-38,61,qy+2,10,10]]){
    w.landmarks.push({id:'terrace',x,z,y:H(x,z)});
  }
  ramp(-53,79,qy+deckLift,0,5,8,2);ramp(-65,67,qy+deckLift,-Math.PI/2,5,8,2);
  ramp(-53,69,qy+2+deckLift,0,5,8,2);ramp(-38,70,qy+deckLift,0,4,8,2);
  for(const [x,z] of [[-60,84],[-33,77]])crate(x,z);
  crate(-58,66);crate(-49,60);
  openShed(w,-30,58,H(-30,58),0xbea16d);
  for(let i=0;i<9;i++)rock(-65+(i%3)*17,47+Math.floor(i/3)*22,1.2+(i%2)*.3,420+i);
  sign(-22,61,0xc3a174);

  // Docks: grounded land approach, connected decks above actual clear shallows.
  createDocksArchitecture(w);
  const deckY=3.3;
  for(const [x,z,width,depth] of [[89.25,20,22.5,5],[80,29.5,4,14],[89.25,39,22.5,5],[98,29.5,5,14]]){
    createCoastalDock(w,x,z,width,depth,deckY);
  }
  // Gentle permanent ramp mouths, both approaching from the mainland.
  const northBase=H(72,20),southBase=H(72,39);
  ramp(75,20,Math.min(northBase,deckY),northBase<deckY?-Math.PI/2:Math.PI/2,4,6,Math.abs(deckY-northBase));
  ramp(75,39,Math.min(southBase,deckY),southBase<deckY?-Math.PI/2:Math.PI/2,4,6,Math.abs(deckY-southBase));
  crate(85,20,2,deckY);crate(94,39,2,deckY);crate(70,28);crate(80,45);
  for(const z of [20,33]){
    for(const dz of [-2.5,2.5])w.addBox(.2,1,.2,wood,100.3,deckY+.5,z+dz);
    w.addBox(.16,.16,5.2,PALETTE.cream,100.3,deckY+.92,z);
  }
  for(const x of [82,90]){
    for(const dx of [-2,2])w.addBox(.2,1,.2,wood,x+dx,deckY+.5,41.3);
    w.addBox(4.2,.16,.16,PALETTE.cream,x,deckY+.92,41.3);
  }
  createCoastalBoat(w,92,26,0xc87661,{yaw:-.18});createCoastalBoat(w,107,39,0x81b3a8,{yaw:.28});
  // Lanterns attach to the existing rail posts instead of adding freestanding
  // obstructions to the boardwalk or either mainland ramp mouth.
  coastalLantern(w.scene,100.3,deckY+1.31,22.5,.9);coastalLantern(w.scene,92,deckY+1.31,41.3,.9);
  sign(64,24,PALETTE.teal);

  // Route cover and a low dune rest stop; no extra full district.
  openShed(w,35,77,H(35,77),0xd4b866);
  for(const [x,z] of [[-48,-58],[-80,9],[-62,31],[-14,78],[12,72],[47,57],[60,43],[49,8],[59,-20],[37,-51],[15,-43],[-29,-9],[-13,36],[20,48]]){
    crate(x,z);rock(x+5,z+4,1.1,Math.round(x-z));
  }
  // Scenery excludes authored spawn/loot corridors, doors and physical props.
  for(let i=0;i<300;i++){
    const a=rng()*Math.PI*2,r=20+Math.sqrt(rng())*90,x=Math.cos(a)*r,z=Math.sin(a)*r;
    // Keep the narrow harbor-to-lighthouse view open beside the taller roof.
    // Low planted beds still occupy this bank; a random full crown obscures it.
    const harborView=x>84&&x<100&&z>1&&z<16;
    if(harborView||docksOakReserved(x,z)||H(x,z)<.6||routeDistance(x,z)<5||w.map.pads.some(p=>Math.hypot(x-p[0],z-p[1])<p[3]+3)||w.map.spawns.some(p=>Math.hypot(x-p[0],z-p[1])<5)||w.isRampApproach(x,z,3))continue;
    if(w.map.finales.every(p=>Math.hypot(x-p[0],z-p[1])>4)&&w.foliage.trees.length<145&&w.sceneryFree(x,z,2.3))w.tree(x,z,.7+rng()*.6,rng()>.90);
  }
  for(let i=0;i<80;i++){
    const a=rng()*6.283,r=20+Math.sqrt(rng())*91,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(routeDistance(x,z)<5||w.map.pads.some(p=>Math.hypot(x-p[0],z-p[1])<p[3]+4)||w.map.spawns.some(p=>Math.hypot(x-p[0],z-p[1])<5)||H(x,z)<.5)continue;rock(x,z,.8+rng()*1.1,500+i);
  }
  for(let i=0;i<50;i++){const a=i*2.39996,r=124+i%4*1.2;const m=new THREE.Mesh(rockGeometry(.4+i%3*.16,i+900),stone);m.position.set(Math.cos(a)*r,H(Math.cos(a)*r,Math.sin(a)*r)+.2,Math.sin(a)*r);m.scale.y=.6;m.receiveShadow=true;w.scene.add(m);}
  for(let i=0;i<9;i++){const g=new THREE.Group(),a=i*2.4;g.position.set(Math.cos(a)*200,47+i%3*8,Math.sin(a)*200);const c=createCloud({coastal:true,variant:i%3});c.scale.set(30,16,1);g.add(c);w.clouds.push(g);w.scene.add(g);}
}

function openHouse(w,x,z,y,color,small=false,boathouse=false){
  y+=.22; // A real raised floor/foundation, clearly separated from terrain depth.
  const width=small?8:9,depth=8,wood=coastalMaterial('paintedWood',color),roof=y+3.9;
  const bottom=Math.min(...[-width/2,0,width/2].flatMap(dx=>[-depth/2,0,depth/2].map(dz=>w.heightAt(x+dx,z+dz))))-.12;
  coastalSolidBox(w,width,y-bottom,depth,coastalMaterial('stone',0xccbea0),x,(y+bottom)/2,z,{bevel:0});
  for(const dx of [-width/2,width/2])coastalSolidBox(w,.32,3.6,depth,wood,x+dx,y+1.8,z,{grain:'z',bevel:0});
  const gap=3,part=(width-gap)/2;
  for(const side of [-1,1]){
    for(const dx of [-(gap+part)/2,(gap+part)/2])coastalSolidBox(w,part,3.6,.32,wood,x+dx,y+1.8,z+side*depth/2,{bevel:0,renderInset:{[dx<0?'right':'left']:SURFACE_CLEARANCE+.01}});
    const header=coastalSolidBox(w,gap,.7,.32,wood,x,y+3.25,z+side*depth/2,{bevel:0}),inset=SURFACE_CLEARANCE+.01;
    header.visible=false;header.userData.instancedVisual=true;header.userData.collisionOnlyReason='Door header: recessed underside and continuous rendered wall above jambs';
    coastalBox(w.scene,gap+2*inset,.7-inset,.32,wood,x,y+3.25+inset/2,z+side*depth/2,{bevel:0});
  }
  coastalLayeredDeck(w,x,z,roof,width+.7,depth+.7,.3,coastalMaterial('trim',boathouse?0x375366:0xcb8067),{roof:true,finishWidth:width+.46,finishDepth:depth+.46,bevel:.018});
  // A reachable exterior roof, and broad doors for both movement and bot routing.
  const low=x+width/2+9,base=Math.min(...[-1.75,0,1.75].map(dz=>w.heightAt(low,z+dz)));
  w.addRamp({x:x+width/2+4.5,z,y:base},Math.PI/2,3.5,9,roof-base,false).roofAccess=true;
  for(const dx of [-width/2+.7,width/2-.7])coastalSolidBox(w,.7,1,.7,coastalMaterial('timber',0xb58b50),x+dx,y+.5,z-2.8,{bevel:.022});
  decorateCoastalHouse(w,{x,z,y,width,depth,color,roof,boathouse});
  w.landmarks.push({id:'interior',x,z,y,roof});
}
function openShed(w,x,z,y,color){
  createCoastalShed(w,x,z,y,color);
  w.landmarks.push({id:'shed',x,z,y});
}
