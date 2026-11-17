// Sunhaven's shared construction language: real board thickness, deep reveals,
// paint, end grain, restrained hardware, and open boats. Gameplay footprints stay
// authoritative; surface dressing does not silently add movement obstacles.
import * as THREE from 'three';
import { coastalMaterial } from './coastal-materials.js';
import { coastalBoxGeometry,coastalCylinderGeometry,coastalTubeGeometry,coastalRingGeometry,coastalPedimentGeometry,boatHullGeometry,boatOutline } from './coastal-geometry.js';
import { SEA_LEVEL } from './nature-water.js';
import { registerSurfaceLayer, registerJoineryFaces, SURFACE_CLEARANCE } from './surface-layers.js';

const C={cream:0xf2e7cd,navy:0x294956,wood:0xc5a373,lightWood:0xd7bc8c,coral:0xc87460,metal:0x344b54};
const timber=()=>coastalMaterial('timber',C.wood),trim=()=>coastalMaterial('trim',C.cream),metal=()=>coastalMaterial('metal',C.metal);
function mesh(parent,geometry,material,x=0,y=0,z=0,name='Coastal detail'){
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.name=name;parent.add(m);return m;
}
export function coastalBox(parent,width,height,depth,material,x=0,y=0,z=0,options={}){
  return mesh(parent,coastalBoxGeometry(width,height,depth,options),material,x,y,z,'Coastal timber and trim');
}
function cylinder(parent,top,bottom,height,material,x,y,z,segments=10){return mesh(parent,coastalCylinderGeometry(top,bottom,height,segments),material,x,y,z);}
function ring(parent,radius,tube,material,x,y,z,flat=false){const m=mesh(parent,coastalRingGeometry(radius,tube),material,x,y,z);if(flat)m.rotation.x=Math.PI/2;return m;}
function beam(parent,from,to,width,depth,material){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),m=coastalBox(parent,width,a.distanceTo(b),depth,material,...a.clone().add(b).multiplyScalar(.5).toArray(),{grain:'y',bevel:.015});
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());return m;
}
function record(w,value){(w.coastalAssets??=[]).push(value);}
export function coastalSolidBox(w,width,height,depth,material,x,y,z,options={}){
  const m=w.addBox(width,height,depth,material,x,y,z);m.geometry.dispose();m.geometry=coastalBoxGeometry(width,height,depth,options);
  if(options.renderInset){
    const {left=0,right=0,bottom=0,top=0,back=0,front=0}=options.renderInset;
    if(![left,right,bottom,top,back,front].every(v=>Number.isFinite(v)&&v>=0))throw new RangeError('Rendered backing insets must be nonnegative metres');
    m.visible=false;m.userData.instancedVisual=true;m.userData.collisionOnlyReason='Joinery: exact collision with recessed rendered backing';
    coastalBox(w.scene,width-left-right,height-bottom-top,depth-back-front,material,x+(left-right)/2,y+(bottom-top)/2,z+(back-front)/2,options);
  }
  return m;
}
function bolt(parent,x,y,z,axis='z',radius=.032){
  const m=cylinder(parent,radius,radius,.022,metal(),x,y,z,6);if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;return m;
}

export function coastalSunBadge(parent,x,y,z,radius=.27){
  const back=cylinder(parent,radius*1.8,radius*1.8,.075,coastalMaterial('paintedWood',C.navy),x,y,z,20);back.rotation.x=Math.PI/2;
  const face=cylinder(parent,radius,radius,.095,coastalMaterial('metal',0xe3b84d),x,y,z+.015,16);face.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,m=coastalBox(parent,.055,radius*.48,.065,coastalMaterial('metal',0xe3b84d),x+Math.sin(a)*radius*1.4,y+Math.cos(a)*radius*1.4,z+.047,{bevel:.012});m.rotation.z=-a;
  }
}

export function coastalLantern(parent,x,y,z,scale=1){
  // Opaque warm panes avoid transparency sorting and extra per-light render passes.
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);g.name='Harbor lantern';
  const h=.44*scale,r=.14*scale;
  cylinder(g,r*1.12,r*1.25,.055*scale,metal(),0,-h*.5,0,6);
  cylinder(g,.025*scale,r*1.35,.17*scale,metal(),0,h*.65,0,6);
  const pane=coastalMaterial('metal',0xebcb83,{roughness:.26,metalness:.05});
  cylinder(g,r*.82,r*.82,h,pane,0,0,0,6);
  for(const dx of [-r*.75,r*.75])for(const dz of [-r*.75,r*.75])coastalBox(g,.025*scale,h+.05*scale,.025*scale,metal(),dx,0,dz,{grain:'y',bevel:.004});
  ring(g,.065*scale,.016*scale,metal(),0,h*.96,0);
  beam(g,[0,h*1.1,-.02],[0,h*1.1,-.22*scale],.035*scale,.035*scale,metal());
  coastalBox(g,.105*scale,.23*scale,.04*scale,metal(),0,h*.82,-.24*scale,{grain:'y',bevel:.008});
  return g;
}

// This finish belongs with coastalLayeredDeck, which recesses its visible backing.
// deckY is the single authority for board tops, collision and ramp landings.
function coastalDeckSurface(parent,x,z,deckY,width,depth,{roof=false}={}){
  const boardCount=Math.ceil(width/.42),boardWidth=width/boardCount,gap=.012;
  const shades=[C.wood,C.lightWood,0xbfa079],material=shades.map(c=>coastalMaterial('timber',roof?0xd6ba8c:c));
  const maxLength=4,sections=Math.max(1,Math.ceil(depth/maxLength)),length=depth/sections;
  const samples=[];
  for(let i=0;i<boardCount;i++)for(let j=0;j<sections;j++){
    const bx=x-width/2+(i+.5)*boardWidth,bz=z-depth/2+(j+.5)*length;
    const m=coastalBox(parent,boardWidth-gap,.095,length-gap,material[(i*7+j*3)%3],bx,deckY-.0475,bz,{grain:'z',bevel:.009,shade:.06});m.userData.coastalBoard=true;
    // Interior samples avoid the bevel, seams and shared triangle diagonals.
    for(const [u,v] of [[.13,.21],[-.29,.27],[.31,-.23]])samples.push([bx+u*(boardWidth-gap),deckY,bz+v*(length-gap)]);
    if(!roof)for(const end of [-1,1]){
      bolt(parent,bx+(i%2?.045:-.045),deckY-.004,bz+end*(length*.5-.12),'y',.012);
      coastalBox(parent,boardWidth-gap,.077,.009,coastalMaterial('endGrain',C.wood),bx,deckY-.05,bz+end*(length*.5-.003),{grain:'x',bevel:.001,shade:.025});
    }
  }
  registerSurfaceLayer(parent,`${roof?'Roof/floor':'Boardwalk'} at ${x},${z}`,samples);
  return {boards:boardCount*sections,top:deckY,gap};
}

export function coastalLayeredDeck(w,x,z,top,width,depth,thickness,material,{roof=false,finishWidth=width,finishDepth=depth,bevel=0}={}){
  if(!Number.isFinite(thickness)||thickness<=SURFACE_CLEARANCE)throw new RangeError('Layered deck backing must be thicker than its surface clearance');
  // Retain exact walking/shot collision. This proxy must never be copied into the
  // rendered solid batch: its top deliberately coincides with the finish.
  const core=coastalSolidBox(w,width,thickness,depth,material,x,top-thickness/2,z,{bevel});
  core.visible=false;core.userData.instancedVisual=true;
  core.userData.collisionOnlyReason='Layered deck: separate recessed visual backing';
  // Lower just the visual top, keeping the structural underside in its old place.
  const backing=coastalBox(w.scene,width,thickness-SURFACE_CLEARANCE,depth,material,x,top-(thickness+SURFACE_CLEARANCE)/2,z,{bevel});
  backing.name='Recessed deck backing';
  return {core,...coastalDeckSurface(w.scene,x,z,top,finishWidth,finishDepth,{roof})};
}

function dockPiling(w,x,z,deckY){
  const sites=w.coastalPilingSites??=[];
  const shared=sites.find(p=>Math.hypot(p.x-x,p.z-z)<1.05&&Math.abs(p.y-deckY)<.1);
  if(shared)return shared;
  const site={x,z,y:deckY};sites.push(site);
  const bottom=Math.min(w.heightAt(x,z)-.25,SEA_LEVEL-.45),top=deckY+.61,height=top-bottom;
  const p=cylinder(w.scene,.235,.28,height,timber(),x,(top+bottom)/2,z,10);p.name='Solid harbor piling';
  w.collider(p,new THREE.Vector3(x-.28,bottom,z-.28),new THREE.Vector3(x+.28,top,z+.28),'dock-piling');
  coastalBox(w.scene,.55,.14,.55,trim(),x,top-.025,z,{grain:'y',bevel:.045});
  coastalBox(w.scene,.45,.026,.45,coastalMaterial('endGrain',0xdfd0a9,{repeat:[.53,.53]}),x,top+.055,z,{bevel:.005,uvOffset:[.225,.225]});
  for(let i=0;i<4;i++)ring(w.scene,.255,.035,coastalMaterial('rope',0xc5b28b),x,deckY+.18+i*.065,z,true);
  cylinder(w.scene,.245,.275,.37,coastalMaterial('timber',0x698078),x,SEA_LEVEL+.05,z,10);
  cylinder(w.scene,.257,.257,.07,metal(),x,deckY-.35,z,10);
  for(const side of [-1,1])bolt(w.scene,x+side*.245,deckY-.35,z,'x',.046);
  return site;
}

export function createCoastalDock(w,x,z,width,depth,deckY){
  const {core,...result}=coastalLayeredDeck(w,x,z,deckY,width,depth,.32,coastalMaterial('timber',0x70634e));
  for(const side of [-1,1]){
    coastalBox(w.scene,width,.28,.16,timber(),x,deckY-.2,z+side*(depth*.5-.055),{bevel:.016});
    coastalBox(w.scene,.16,.28,depth,timber(),x+side*(width*.5-.055),deckY-.2,z,{grain:'z',bevel:.016});
  }
  const horizontal=width>depth,long=horizontal?width:depth,short=horizontal?depth:width,count=Math.max(1,Math.ceil((long-.8)/5));
  for(let i=0;i<=count;i++)for(const side of [-1,1]){
    // Mount pilings outside the walking strip. Putting stout posts on its inner
    // corners pinches the existing cargo bypass below the navigation clearance.
    const a=-long*.5+.36+(long-.72)*i/count,b=side*(short*.5+.30),px=x+(horizontal?a:b),pz=z+(horizontal?b:a);
    const piling=dockPiling(w,px,pz,deckY);
    // Braces remain entirely below the supported deck, outside passage space.
    if(i<count){const next=a+(long-.72)/count*.64;beam(w.scene,[piling.x,deckY-1.8,piling.z],[x+(horizontal?next:b),deckY-.34,z+(horizontal?b:next)],.19,.18,timber());}
  }
  record(w,{kind:'boardwalk',x,z,width,depth,y:deckY,...result});return core;
}

export function createCoastalCrate(w,x,z,size=2.2,base=w.heightAt(x,z),{height=1.65}={}){
  const depth=size*.85,body=coastalSolidBox(w,size,height,depth,timber(),x,base+height*.5,z,{bevel:.025,grain:'x'});body.userData.prop='coastal-crate';
  const rows=Math.max(2,Math.round(height/.4)),rowHeight=(height-.14)/rows;
  for(const side of [-1,1])for(let row=0;row<rows;row++){
    coastalBox(w.scene,size-.12,rowHeight-.012,.045,coastalMaterial('timber',row%2?0xd2ae79:0xbc995f),x,base+.07+(row+.5)*rowHeight,z+side*(depth*.5+.013),{grain:'x',bevel:.009});
    coastalBox(w.scene,.045,rowHeight-.012,depth-.12,coastalMaterial('timber',row%2?0xc39e65:0xd0b17e),x+side*(size*.5+.012),base+.07+(row+.5)*rowHeight,z,{grain:'z',bevel:.009});
  }
  for(const side of [-1,1]){
    const bx=x+side*size*.39;coastalBox(w.scene,.13,height+.06,depth+.095,metal(),bx,base+height*.5,z,{grain:'y',bevel:.014,shade:.06});
    for(const face of [-1,1])for(const y of [.15,height-.15]){
      coastalBox(w.scene,.29,.25,.065,metal(),bx,base+y,z+face*(depth*.5+.055),{bevel:.016});
      bolt(w.scene,bx,base+y,z+face*(depth*.5+.09),'z',.042);
    }
    for(const dz of [-depth*.3,depth*.3])bolt(w.scene,bx,base+height+.043,z+dz,'y',.032);
  }
  for(let i=0;i<4;i++)coastalBox(w.scene,(size-.18)/4-.009,.034,depth-.11,timber(),x-(size-.18)*.5+(i+.5)*(size-.18)/4,base+height+.005,z,{grain:'z',bevel:.006});
  if(size>1.7)coastalSunBadge(w.scene,x,base+height*.5,z+depth*.5+.049,.13);
  record(w,{kind:'crate',x,z,y:base,size,height,depth});return body;
}

function clapboards(parent,x,z,y,width,depth,height,color,{doorGap=0}={}){
  const courses=Math.ceil(height/.32),course=height/courses,paints=[color,new THREE.Color(color).multiplyScalar(.96).getHex()];
  for(let row=0;row<courses;row++){
    const cy=y+(row+.5)*course,m=coastalMaterial('paintedWood',paints[row%2]);
    for(const side of [-1,1]){
      const segments=doorGap&&cy<y+2.95?[[-(doorGap+(width-doorGap)/2)*.5,(width-doorGap)/2],[(doorGap+(width-doorGap)/2)*.5,(width-doorGap)/2]]:[[0,width]];
      for(const [cx,w]of segments)coastalBox(parent,w-.015,course-.012,.075,m,x+cx,cy,z+side*(depth*.5+.025),{grain:'x',bevel:.012,shade:.055});
      coastalBox(parent,.075,course-.012,depth-.015,m,x+side*(width*.5+.025),cy,z,{grain:'z',bevel:.012,shade:.055});
    }
  }
  for(const side of [-1,1]){
    for(const dx of [-width*.5+.03,width*.5-.03])coastalBox(parent,.23,height+.07,.19,trim(),x+dx,y+height*.5,z+side*(depth*.5+.045),{grain:'y',bevel:.02});
    coastalBox(parent,.18,height+.07,.23,trim(),x+side*(width*.5+.045),y+height*.5,z-depth*.5+.03,{grain:'y',bevel:.02});
    coastalBox(parent,width+.14,.2,.15,trim(),x,y+height-.025,z+side*(depth*.5+.045),{bevel:.014});
  }
}

function windowFrame(parent,x,y,z,side=1,{shutters=false}={}){
  const g=new THREE.Group();g.position.set(x,y,z);if(side<0)g.rotation.y=Math.PI;parent.add(g);g.name='Recessed coastal window';
  coastalBox(g,1.29,1.38,.07,coastalMaterial('paintedWood',0x304953),0,0,0,{bevel:.012});
  coastalBox(g,1.06,1.15,.065,coastalMaterial('metal',0x547f88,{roughness:.31,metalness:.12}),0,0,.042,{bevel:.008});
  for(const dx of [-.64,.64])coastalBox(g,.15,1.5,.22,trim(),dx,0,.09,{grain:'y',bevel:.018});
  for(const dy of [-.68,.68])coastalBox(g,1.43,.15,.22,trim(),0,dy,.09,{bevel:.018});
  coastalBox(g,.065,1.22,.105,trim(),0,0,.117,{grain:'y',bevel:.008});coastalBox(g,1.13,.065,.105,trim(),0,.03,.117,{bevel:.008});
  coastalBox(g,1.59,.135,.4,trim(),0,-.79,.13,{bevel:.018});coastalBox(g,1.57,.12,.25,trim(),0,.84,.1,{bevel:.018});
  if(shutters)for(const side of [-1,1]){
    coastalBox(g,.29,1.39,.10,coastalMaterial('paintedWood',C.navy),side*.93,0,.015,{grain:'y',bevel:.015});
    for(const dy of [-.45,-.15,.15,.45])coastalBox(g,.28,.1,.06,coastalMaterial('paintedWood',0x446978),side*.93,dy,.075,{bevel:.008});
  }
}

function doorFrame(parent,x,z,y,depth,gap,side){
  const face=z+side*(depth*.5+.10),postHeight=3.01-.25/2;
  for(const dx of [-1,1]){
    // A continuous lining covers the wall end; posts butt below the header.
    const post=coastalBox(parent,.25,postHeight,.60,trim(),x+dx*(gap*.5+.125),y+postHeight/2,face,{grain:'y',bevel:.026});
    registerJoineryFaces(parent,post,`House ${x},${z} ${side} jamb ${dx}`,[dx<0?'+x':'-x','+z','-z']);
    coastalBox(parent,.075,2.46,.05,coastalMaterial('paintedWood',C.navy),x+dx*(gap*.5+.1175),y+1.57,face+side*.325,{grain:'y',bevel:.008});
    coastalBox(parent,.35,.31,.68,trim(),x+dx*(gap*.5+.135),y+.155,face,{bevel:.025});
  }
  const header=coastalBox(parent,gap+.53,.25,.60,trim(),x,y+3.01,face,{bevel:.025});
  registerJoineryFaces(parent,header,`House ${x},${z} ${side} header`,['-y','+z','-z']);
}

function canopy(parent,x,z,y,width,{slate=false}={}){
  const material=slate?coastalMaterial('roof',C.navy):coastalMaterial('fabric',C.coral);
  const top=coastalBox(parent,width,.12,1.25,material,x,y,z,{bevel:.018});top.rotation.x=.1;
  for(let i=0;i<6;i++)if(!slate)coastalBox(parent,width/6-.015,.026,1.25,coastalMaterial('fabric',i%2?C.cream:C.coral),x-width/2+(i+.5)*width/6,y+.069,z,{bevel:.006}).rotation.x=.1;
  coastalBox(parent,width+.07,.16,.13,slate?trim():coastalMaterial('fabric',C.cream),x,y-.06,z+.61,{bevel:.02});
  for(const side of [-1,1])beam(parent,[x+side*(width*.5-.28),y-.75,z-.42],[x+side*(width*.5-.28),y-.13,z+.41],.13,.12,trim());
}

export function decorateCoastalHouse(w,{x,z,y,width,depth=8,height=3.6,color,roof=y+3.9,boathouse=false}){
  // Existing wall colliders include 0.16m outside their nominal centre lines.
  clapboards(w.scene,x,z,y,width+.30,depth+.30,height,color,{doorGap:3+2*(SURFACE_CLEARANCE+.01)});
  for(const side of [-1,1]){
    doorFrame(w.scene,x,z,y,depth,3,side);
    for(const dx of [-(width+3)*.25,(width+3)*.25])windowFrame(w.scene,x+dx,y+1.76,z+side*(depth*.5+.20),side);
  }
  for(const side of [-1,1])coastalBox(w.scene,width+.75,.22,.23,trim(),x,roof-.25,z+side*(depth*.5+.25),{bevel:.022});
  if(boathouse){
    // A proper harbor gable projects forward of the fighting deck. Its taller
    // silhouette and slate pitch therefore leave the main roof and east ramp free.
    const rise=1.6,base=y+3.18,canopyDepth=1.8,g=coastalPedimentGeometry(width+.6,canopyDepth,rise),front=z+depth*.5+1.16;
    const pediment=mesh(w.scene,g,coastalMaterial('paintedWood',color),x,base,front,'Solid boathouse pediment');w.rockCollider(pediment,'roof-canopy');
    const run=(width+.6)*.5,slope=Math.atan2(rise,run);
    for(const side of [-1,1]){
      const roofPanel=coastalBox(w.scene,Math.hypot(run,rise)+.08,.065,canopyDepth+.24,coastalMaterial('roof',C.navy),x+side*run*.5,base+rise*.5+.032,front,{grain:'z',bevel:.01});roofPanel.rotation.z=-side*slope;
      w.rockCollider(roofPanel,'roof-canopy-panel');
      const bar=coastalBox(w.scene,Math.hypot(run,rise)+.12,.20,.23,trim(),x+side*run*.5,base+rise*.5,front+canopyDepth*.5+.035,{bevel:.02});bar.rotation.z=-side*slope;
      beam(w.scene,[x+side*(run-.35),base-.65,front-canopyDepth*.45],[x+side*(run-.35),base-.06,front+canopyDepth*.36],.16,.15,trim());
    }
    for(let row=0;row<5;row++){
      const course=rise/5,boardWidth=Math.max(.13,(width+.6)*(1-(row+1)*course/rise)+.13);
      coastalBox(w.scene,boardWidth,course-.012,.055,coastalMaterial('paintedWood',row%2?color:new THREE.Color(color).multiplyScalar(.96).getHex()),x,base+(row+.5)*course,front+canopyDepth*.5+.014,{bevel:.01});
    }
    coastalBox(w.scene,width+.7,.19,.23,trim(),x,base+.015,front+canopyDepth*.5+.035,{bevel:.018});
    coastalSunBadge(w.scene,x,base+.68,front+canopyDepth*.5+.071,.28);
    for(const side of [-1,1])coastalLantern(w.scene,x+side*2.1,y+2.24,z+depth*.5+.43,.85);
    // Shelves/workbench stay inside the existing interior crate footprints.
    for(const side of [-1,1]){
      const sx=x+side*(width*.5-.7);coastalBox(w.scene,.7,.1,.7,timber(),sx,y+1.025,z-2.8,{bevel:.018});
      coastalBox(w.scene,.53,.045,.45,metal(),sx,y+1.10,z-2.8,{bevel:.01});
    }
  }else{
    canopy(w.scene,x,z+depth*.5+.67,y+3.18,width*.71);
    coastalSunBadge(w.scene,x,y+3.43,z+depth*.5+.27,.20);
    coastalLantern(w.scene,x-1.98,y+2.26,z+depth*.5+.44,.78);
  }
  record(w,{kind:boathouse?'boathouse':'coastal-house',x,z,y,width,depth,roof,doorGap:3});
}

export function decorateCoastalCabin(w,x,z,y,color){
  clapboards(w.scene,x,z,y+.26,6.5,5.5,3.48,color);
  for(const dx of [-2.1,2.1])windowFrame(w.scene,x+dx,y+2.20,z+2.83,1,{shutters:true});
  coastalBox(w.scene,1.4,2.44,.17,coastalMaterial('paintedWood',C.navy),x,y+1.50,z+2.83,{grain:'y',bevel:.018});
  for(const side of [-1,1])coastalBox(w.scene,.16,2.58,.25,trim(),x+side*.78,y+1.55,z+2.87,{grain:'y',bevel:.018});
  coastalBox(w.scene,1.74,.17,.25,trim(),x,y+2.81,z+2.87,{bevel:.018});
  for(const cy of [y+.97,y+2.02])coastalBox(w.scene,1.05,.78,.065,coastalMaterial('paintedWood',0x416f7c),x,cy,z+2.95,{grain:'y',bevel:.018});
  bolt(w.scene,x+.49,y+1.5,z+3.01,'z',.065);
  for(const side of [-1,1]){
    coastalBox(w.scene,7.42,.16,.18,trim(),x,y+3.88,z+side*3.13,{bevel:.016});
    coastalBox(w.scene,.18,.16,6.25,trim(),x+side*3.62,y+3.88,z,{grain:'z',bevel:.016});
  }
  canopy(w.scene,x,z+3.3,y+3.34,6.5);
  coastalSunBadge(w.scene,x,y+3.12,z+2.95,.23);
  coastalLantern(w.scene,x-1.15,y+2.15,z+3.03,.72);
  record(w,{kind:'coastal-cabin',x,z,y,width:6.5,depth:5.5,roof:y+4.25});
}

export function createCoastalBoat(w,x,z,color,{yaw=0,width=2.05,length=4.8}={}){
  const base=SEA_LEVEL-.27,g=new THREE.Group();g.position.set(x,base,z);g.rotation.y=yaw;g.name='Open clinker harbor boat';w.scene.add(g);
  const hull=mesh(g,boatHullGeometry(width,length,'outer'),coastalMaterial('paintedWood',color),0,0,0,'Solid shaped boat hull');
  mesh(g,boatHullGeometry(width,length,'inner'),timber());
  const outline=boatOutline(width,length);mesh(g,coastalTubeGeometry(outline,.06,64,true),trim());
  const lower=outline.map(([x,y,z])=>[x*.875,.32,z*.95]);mesh(g,coastalTubeGeometry(lower,.033,64,true),coastalMaterial('paintedWood',new THREE.Color(color).multiplyScalar(.76).getHex()));
  for(const z of [-.92,.25,1.1]){
    const seat=coastalBox(g,width*(Math.abs(z)>1?.64:.79),.095,.32,timber(),0,.51,z,{bevel:.018});w.solids.push(seat);
    for(const side of [-1,1])coastalBox(g,.065,.3,.10,coastalMaterial('paintedWood',color),side*width*.34,.32,z,{grain:'y',bevel:.01});
  }
  for(const z of [-1.5,-.9,-.3,.3,.9,1.5]){
    const widthAt=width*.42*(1-Math.abs(z)/length*.65);beam(g,[-widthAt,.36,z],[-widthAt*.52,.16,z],.045,.045,timber());beam(g,[widthAt,.36,z],[widthAt*.52,.16,z],.045,.045,timber());
  }
  // Oars rest inside the rim, rather than floating over the water beside it.
  const oar=coastalBox(g,.055,.045,3.2,timber(),.23,.62,.12,{grain:'z',bevel:.012});oar.rotation.y=.14;
  coastalBox(g,.18,.046,.65,timber(),.42,.62,1.47,{grain:'z',bevel:.03}).rotation.y=.14;
  w.rockCollider(hull,'boat-hull');record(w,{kind:'boat',x,z,y:base,width,length,open:true});return g;
}

export function createCoastalShed(w,x,z,y,color){
  coastalLayeredDeck(w,x,z,y+.18,6,5,.18,timber(),{roof:true,finishWidth:5.85,finishDepth:4.85,bevel:.012});
  for(const dx of [-2.8,2.8])for(const dz of [-2.3,2.3]){
    coastalSolidBox(w,.24,3,.24,timber(),x+dx,y+1.5,z+dz,{grain:'y',bevel:.025});
    coastalBox(w.scene,.29,.11,.29,metal(),x+dx,y+.25,z+dz,{bevel:.013});
    beam(w.scene,[x+dx,y+2.35,z+dz],[x+dx-Math.sign(dx)*.68,y+2.88,z+dz],.14,.14,timber());
  }
  coastalSolidBox(w,6.4,.22,5.4,coastalMaterial('roof',color),x,y+3,z,{bevel:.02});
  for(const side of [-1,1]){
    coastalBox(w.scene,6.45,.19,.16,trim(),x,y+2.96,z+side*2.68,{bevel:.016});
    coastalBox(w.scene,.16,.19,5.4,trim(),x+side*3.18,y+2.96,z,{grain:'z',bevel:.016});
  }
  coastalLantern(w.scene,x-2.8,y+2.4,z+2.44,.8);record(w,{kind:'coastal-shed',x,z,y});
}
