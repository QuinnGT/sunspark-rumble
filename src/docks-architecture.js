// Authored harbor kit: metre dimensions, exact solid silhouettes and one finish
// per surface. The two roof shells are reusable indexed geometry for glTF export.
import * as THREE from 'three';
import { coastalMaterial } from './coastal-materials.js';
import { coastalCylinderGeometry, coastalRingGeometry, coastalTubeGeometry, coastalPedimentGeometry } from './coastal-geometry.js';
import { coastalBox, coastalSolidBox, coastalLayeredDeck, coastalLantern, coastalSunBadge } from './coastal-kit.js';
import { registerSurfaceLayer, registerJoineryFaces, SURFACE_CLEARANCE } from './surface-layers.js';
import { mapApprovedBoard } from './approved-timber.js';

export const DOCKS_ARCHITECTURE = Object.freeze({
  x:76,z:10,floor:3.3,width:12,depth:10,eave:9.6,ridge:13.2,
  roofWidth:14,roofDepth:12.2,doorWidth:4.8,doorHeight:4.5,
  porch:{x:76,z:16.25,width:14,depth:2.5,top:3.3},
  rearLanding:{x:76,z:4,width:5,depth:2,top:3.3},
  annex:{x:67.5,z:10,width:5,depth:10,top:7.3},
  terraceLanding:{x:63.4,z:5.4,width:3.2,depth:1.2,top:7.3},
  terraceRamp:{x:63.4,z:11.75,y:3.3,yaw:0,width:3.2,length:11.5,rise:4},
  routes:{
    front:[[76,3.3,10],[76,3.3,16.3],[80,3.3,16.3],[80,3.3,20]],
    rear:[[76,3.3,10],[76,3.3,4],[76,3.3,2]],
    terrace:[[63.4,3.3,18.1],[63.4,3.3,17.5],[63.4,7.3,5.5],[66,7.3,5.5],[67.5,7.3,10]],
  },
});

// Each half is a thin closed shell, not a solid attic-sized wedge. Physical
// support and ray cover use these exact triangles. No separately rendered slab
// sits under the finish, so normal clearance is the shell's actual thickness.
export function createDocksRoofGeometry({width=14,depth=12.2,rise=3.6,thickness=.24,side=1}={}){
  if(![width,depth,rise,thickness].every(v=>Number.isFinite(v)&&v>0)||![-1,1].includes(side))throw new RangeError('Invalid pitched roof dimensions');
  const run=width/2,half=depth/2,points=[[0,rise,-half],[side*run,0,-half],[side*run,0,half],[0,rise,half]];
  if(side>0)points.reverse();
  const bottom=points.map(([x,y,z])=>[x,y-thickness,z]);
  const faces=[points,[...bottom].reverse(),...points.map((p,i)=>[p,bottom[i],bottom[(i+1)%4],points[(i+1)%4]])];
  const positions=[],uv=[],colors=[],indices=[];
  for(let f=0;f<faces.length;f++){
    const start=positions.length/3;
    for(const [x,y,z] of faces[f]){
      positions.push(x,y,z);
      if(f<2)uv.push(z,Math.hypot(x,y-rise));
      else if(f===2||f===4)uv.push(x,y);
      else uv.push(z,y);
      const shade=f===0?.88+.12*Math.max(0,y/rise):f===1?.62:.79;
      colors.push(shade,shade,shade);
    }
    for(let i=1;i<faces[f].length-1;i++)indices.push(start,start+i,start+i+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  g.userData={authoredAsset:'sunhaven-boathouse-roof',part:side>0?'east-shell':'west-shell',uvUnits:'metres',thickness};return g;
}

function mesh(parent,geometry,material,x,y,z,name){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
const trim=()=>coastalMaterial('trim',0xf0e5ca),wood=()=>coastalMaterial('timber',0xbfa073),paint=()=>coastalMaterial('paintedWood',0x83c0ae),metal=()=>coastalMaterial('metal',0x344955);
function detailBeam(w,a,b,width,depth,material=trim()){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),m=coastalBox(w.scene,width,from.distanceTo(to),depth,material,...from.clone().add(to).multiplyScalar(.5).toArray(),{grain:'y',bevel:.015,shade:.12});
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return m;
}
function solid(w,width,height,depth,material,x,y,z,options={}){return coastalSolidBox(w,width,height,depth,material,x,y,z,{bevel:0,...options});}
function concealWallCore(core){core.visible=false;core.userData.instancedVisual=true;core.userData.collisionOnlyReason='Clapboard wall: exact collision and recessed rendered backing';}
function boardMaterial(row,exterior){
  return exterior?coastalMaterial('paintedWood',[0x83c0ae,0x8ac5b4,0x80bba9,0x89bfae][row%4]):coastalMaterial('timber',[0xc7ad86,0xbea17b,0xd0b18a][row%3]);
}
// A wall owns two separately registered finishes. Both faces of its backing are
// recessed by25mm; clapboards keep the original collider's outer dimensions.
function clapboardWall(w,width,height,depth,x,y,z,{axis='z',outside=1,name='Boathouse wall',doorSide=0,doorHeader=false}={}){
  const core=solid(w,width,height,depth,paint(),x,y,z);core.name=`${name} collision core`;concealWallCore(core);
  // Recess the entire rendered end (backing and both claddings) behind its jamb.
  // The original core remains the authority for cover and doorway clearance.
  if(doorSide){const inset=SURFACE_CLEARANCE+.01;width-=inset;x+=doorSide*inset/2;}
  // Above the opening, the header fills the recessed ends with a butt joint;
  // carrying the reveal gap up the wall would leave visible vertical slits.
  if(doorHeader)width+=2*(SURFACE_CLEARANCE+.01);
  const clearance=SURFACE_CLEARANCE+.005;
  // Recess end grain too: otherwise the backing and cladding end faces coincide
  // in the narrow reveal behind the frame even after moving that reveal back.
  coastalBox(w.scene,width+(doorHeader?clearance*2:-clearance*2),height,depth-clearance*2,coastalMaterial('timber',0x887963),x,y,z,{bevel:0,shade:.08});
  const count=Math.ceil(height/.30),course=height/count,span=axis==='z'?width:depth,thickness=.05;
  for(const sign of [-1,1]){
    const points=[],face=(axis==='z'?z+sign*depth/2:x+sign*width/2),exterior=sign===outside;
    for(let row=0;row<count;row++){
      const cy=y-height/2+(row+.5)*course;
      const board=coastalBox(w.scene,axis==='z'?width:thickness,course-.012,axis==='z'?thickness:depth,boardMaterial(row,exterior),axis==='x'?face-sign*thickness/2:x,cy,axis==='z'?face-sign*thickness/2:z,{grain:axis==='z'?'x':'z',bevel:.008,shade:.075});
      board.name=exterior?'Weathered teal clapboard':'Warm workshop interior board';
      if(exterior)mapApprovedBoard(board,row,span,course-.012,axis==='z'?'x':'z');
      for(const u of [-.31,.073,.29])points.push(axis==='z'?[x+span*u,cy+.047*course,face]:[face,cy+.047*course,z+span*u]);
    }
    const layer=registerSurfaceLayer(w.scene,`${name} ${exterior?'exterior':'interior'}`,points,axis==='z'?[0,0,sign]:[sign,0,0]);
    layer.coverMeshUuid=core.uuid;
  }
  return core;
}
function trapezoidBoard(widthBottom,widthTop,height,thickness){
  const shape=new THREE.Shape();shape.moveTo(-widthBottom/2,-height/2);shape.lineTo(widthBottom/2,-height/2);shape.lineTo(widthTop/2,height/2);shape.lineTo(-widthTop/2,height/2);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:false});g.translate(0,0,-thickness);g.clearGroups();
  const p=g.attributes.position,n=g.attributes.normal,color=[];
  for(let i=0;i<p.count;i++){const shade=n.getZ(i)>.9?.94:.78;color.push(shade,shade,shade);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setIndex(Array.from({length:p.count},(_,i)=>i));return g;
}
function cladGable(w,z,side){
  const width=12,rise=3.08,base=9.88,depth=.32,clearance=SURFACE_CLEARANCE+.005;
  const core=mesh(w.scene,coastalPedimentGeometry(width,depth,rise),paint(),76,base,z,'Solid upper boathouse gable');w.rockCollider(core,'boathouse-gable');concealWallCore(core);
  mesh(w.scene,coastalPedimentGeometry(width,depth-clearance*2,rise),coastalMaterial('timber',0x887963),76,base,z,'Recessed gable backing');
  const rows=11,course=rise/rows;
  for(const sign of [-1,1]){
    const points=[],face=z+sign*depth/2;
    for(let row=0;row<rows;row++){
      const bottom=row*course+.006,top=(row+1)*course-.006,wb=width*(1-bottom/rise),wt=width*(1-top/rise),cy=base+(bottom+top)/2;
      const board=mesh(w.scene,trapezoidBoard(wb,wt,top-bottom,.05),boardMaterial(row,sign===side),76,cy,face,'Tapered gable clapboard');if(sign<0)board.rotation.y=Math.PI;
      if(sign===side){const original=board.geometry;mapApprovedBoard(board,row,wb,top-bottom);original.dispose();}
      for(const u of [-.23,.13,.29])points.push([76+wt*u,cy+(top-bottom)*.043,face]);
    }
    const layer=registerSurfaceLayer(w.scene,`Boathouse ${side>0?'front':'rear'} gable ${sign===side?'exterior':'interior'}`,points,[0,0,sign]);
    layer.coverMeshUuid=core.uuid;
  }
}
function window(w,x,y,z,{width=1.25,height=1.6,yaw=0}={}){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;g.name='Deep upper harbor window';w.scene.add(g);
  coastalBox(g,width+.30,height+.28,.15,trim(),0,0,0,{bevel:.02,shade:.15});
  coastalBox(g,width,height,.12,coastalMaterial('metal',0x365766,{roughness:.33,metalness:.07}),0,0,.105,{bevel:.01});
  for(const dx of [-width/2-.09,width/2+.09])coastalBox(g,.13,height+.17,.20,trim(),dx,0,.11,{grain:'y',bevel:.015});
  coastalBox(g,.075,height,.10,trim(),0,0,.22,{grain:'y',bevel:.008});
  const crossWidth=(width-.075-.012)/2;
  for(const sign of [-1,1])coastalBox(g,crossWidth,.07,.10,trim(),sign*(.0375+.006+crossWidth/2),0,.22,{bevel:.008});
  coastalBox(g,width+.43,.16,.4,trim(),0,-height/2-.13,.13,{bevel:.02});
}
function door(w,z,side,width=4.8,height=4.5,x=76){
  for(const sign of [-1,1]){
    const core=solid(w,.30,height+.22,.58,trim(),x+sign*(width/2+.15),3.3+height/2,z+side*.10,{grain:'y',bevel:.02});
    core.visible=false;core.userData.instancedVisual=true;core.userData.collisionOnlyReason='Door post: exact collision, rendered butt joint below header';
    const post=coastalBox(w.scene,.30,height-.05,.58,trim(),x+sign*(width/2+.15),3.3+(height-.05)/2,z+side*.10,{grain:'y',bevel:.02});
    registerJoineryFaces(w.scene,post,`Harbor ${x},${z} jamb ${sign}`,[sign<0?'+x':'-x','+z','-z']);
    coastalBox(w.scene,.39,.30,.66,trim(),x+sign*(width/2+.15),3.45,z+side*.10,{bevel:.025});
  }
  const header=solid(w,width+.6,.3,.58,trim(),x,3.3+height+.10,z+side*.10,{bevel:.02});
  registerJoineryFaces(w.scene,header,`Harbor ${x},${z} header`,['-y','+z','-z']);
  // Upper diagonal brackets give the broad opening the reference's chamfered
  // silhouette without filling its clear 4.5m central headroom.
  for(const sign of [-1,1])detailBeam(w,[x+sign*width/2,3.3+height-.5,z+side*.36],[x+sign*(width/2-.6),3.3+height+.02,z+side*.36],.18,.16);
}
function deck(w,x,z,top,width,depth,{finishWidth=width,finishDepth=depth,name}={}){
  const result=coastalLayeredDeck(w,x,z,top,width,depth,.32,coastalMaterial('timber',0x77664e),{roof:true,finishWidth,finishDepth,bevel:.012});
  if(name)w.scene.userData.surfaceLayers.at(-1).name=name;
  return result;
}
function barrel(w,x,z,base,scale=1){
  const r=.42*scale,h=1.12*scale;
  const g=new THREE.CylinderGeometry(r*.87,r*.87,h,12,3),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const bulge=1+.14*(1-Math.pow(p.getY(i)/(h/2),2));p.setX(i,p.getX(i)*bulge);p.setZ(i,p.getZ(i)*bulge);}
  g.computeVertexNormals();g.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:p.count*3},(_,i)=>i%3===0?.9:.9),3));
  const body=mesh(w.scene,g,wood(),x,base+h/2,z,'Solid harbor barrel');w.rockCollider(body,'harbor-barrel');
  for(const offset of [-.4,0,.4])mesh(w.scene,coastalCylinderGeometry(r*1.06,r*1.06,.07*scale,12),metal(),x,base+h/2+offset*scale,z,'Barrel iron hoop');
  mesh(w.scene,coastalCylinderGeometry(r*.75,r*.75,.06*scale,12),coastalMaterial('endGrain',0xc5ad84),x,base+h+.035,z,'Barrel inset lid');
}
function ropeCoil(w,x,y,z,radius=.36){
  const rope=coastalMaterial('rope',0xc3b08a);
  for(let i=0;i<3;i++){const ring=mesh(w.scene,coastalRingGeometry(radius-i*.07,.031,20),rope,x,y+.045,z,'Coiled mooring rope');ring.rotation.x=Math.PI/2;}
  mesh(w.scene,coastalTubeGeometry([[0,.045,0],[.2,.045,.15],[.55,.045,.28],[.69,.045,.5]],.027,14),rope,x,y,z,'Loose rope tail');
}
function dressHarbor(w){
  // A loading group, a repair bench, and mooring tackle. Every large item is
  // solid; small ropes/net strands remain underfoot or attached to a wall.
  barrel(w,81.45,16.55,3.3);barrel(w,82.45,15.75,3.3,.8);ropeCoil(w,81.8,3.3,17.12,.27);
  const bx=71.5,bz=10;
  for(const dx of [-.9,.9])for(const dz of [-.32,.32])solid(w,.13,.9,.13,wood(),bx+dx,3.75,bz+dz,{grain:'y'});
  solid(w,2.15,.16,.9,wood(),bx,4.25,bz,{bevel:.018});
  coastalBox(w.scene,.60,.12,.35,metal(),bx+.35,4.40,bz,{bevel:.025});ropeCoil(w,bx-.5,4.34,bz,.19);
  for(const zz of [11.7,12.2]){
    detailBeam(w,[70.35,3.4,zz],[70.65,6.1,zz+.14],.065,.065,wood());
    const paddle=coastalBox(w.scene,.18,.64,.07,coastalMaterial('timber',0xd6b883),70.40,3.95,zz+.03,{grain:'y',bevel:.025});paddle.rotation.z=-.11;
  }
  const rope=coastalMaterial('rope',0x92886e);
  // A hanging repair net on the eastern interior wall: clear of both doors and
  // the through path. Its silhouette is geometry, not an alpha-sorted decal.
  for(let i=0;i<7;i++){
    const zz=9.1+i*.27;mesh(w.scene,coastalTubeGeometry([[81.70,6.0,zz],[81.60,5.0,zz+.15],[81.71,4.35,zz+.30]],.018,6),rope,0,0,0,'Hanging repair net');
    const yy=4.5+i*.24;mesh(w.scene,coastalTubeGeometry([[81.70,yy,9.1],[81.60,yy-.12,10.0],[81.71,yy,11.0]],.018,6),rope,0,0,0,'Hanging repair net');
  }
  coastalLantern(w.scene,73,6.0,15.52,1.1);coastalLantern(w.scene,79,6.0,15.52,1.1);
  coastalSunBadge(w.scene,76,9.65,15.30,.43);
  // Cream oculus and cross on the main gable establish a readable upper story.
  const ring=mesh(w.scene,coastalRingGeometry(.64,.095,24),trim(),76,11.35,15.25,'Gable oculus');
  const pane=mesh(w.scene,coastalCylinderGeometry(.55,.55,.07,20),coastalMaterial('metal',0x3e5d68,{roughness:.5,metalness:.04}),76,11.35,15.235,'Oculus glazing');pane.rotation.x=Math.PI/2;
  coastalBox(w.scene,.08,1.15,.1,trim(),76,11.35,15.32,{bevel:.01});
  const crossWidth=(1.15-.08-.012)/2;
  for(const sign of [-1,1])coastalBox(w.scene,crossWidth,.08,.1,trim(),76+sign*(.04+.006+crossWidth/2),11.35,15.32,{bevel:.01});
  ring.userData.authoredFeature='gable-oculus';
}

export function createDocksArchitecture(w){
  const a=DOCKS_ARCHITECTURE,startLayers=w.scene.userData.surfaceLayers?.length??0;
  deck(w,76,10,3.3,12,10,{finishWidth:11.6,finishDepth:9.6,name:'Boathouse main timber floor'});
  deck(w,a.porch.x,a.porch.z,a.porch.top,a.porch.width,a.porch.depth,{name:'Boathouse porch deck'});
  deck(w,a.rearLanding.x,a.rearLanding.z,a.rearLanding.top,a.rearLanding.width,a.rearLanding.depth,{name:'Boathouse rear entry deck'});
  for(const x of [70.4,76,81.6])for(const z of [5.5,14.5]){
    const bottom=w.heightAt(x,z)-.25,height=3.02-bottom;
    if(height>0)solid(w,.36,height,.36,wood(),x,bottom+height/2,z,{grain:'y'});
  }
  const wallTop=9.88,wallHeight=wallTop-3.3;
  for(const x of [70,82])clapboardWall(w,.32,wallHeight,10,x,3.3+wallHeight/2,10,{axis:'x',outside:x<76?-1:1,name:`Boathouse ${x<76?'west':'east'} wall`});
  for(const side of [-1,1]){
    const z=10+side*5;
    for(const dx of [-4.2,4.2])clapboardWall(w,3.6,wallHeight,.32,76+dx,3.3+wallHeight/2,z,{outside:side,doorSide:Math.sign(dx),name:`Boathouse ${side>0?'front':'rear'} ${dx<0?'left':'right'} wall`});
    clapboardWall(w,4.8,wallTop-7.8,.32,76,(wallTop+7.8)/2,z,{outside:side,doorHeader:true,name:`Boathouse ${side>0?'front':'rear'} header`});
    cladGable(w,z,side);
    door(w,z,side);
    for(const dx of [-4.1,4.1])window(w,76+dx,side>0?9.5:8.53,z+side*.24,{width:1.15,height:1.52,yaw:side<0?Math.PI:0});
  }
  // Deep corner posts and a cream stringcourse reinforce a tall two-level facade.
  for(const x of [69.99,82.01])for(const z of [4.99,15.01])coastalBox(w.scene,.4,wallHeight+.08,.4,trim(),x,3.3+wallHeight/2,z,{grain:'y',bevel:.02,shade:.15});
  for(const x of [69.79,82.21]){
    coastalBox(w.scene,.17,.20,10.4,trim(),x,7.45,10,{grain:'z',bevel:.02});
    for(const z of [7.1,12.8])window(w,x,8.57,z,{width:1.4,height:1.65,yaw:x<76?-Math.PI/2:Math.PI/2});
  }
  // Each roof is a single full-size pitched shell; a normal-aware audit samples
  // its exposed finish after batching, and exact triangles provide shot/support.
  const run=a.roofWidth/2,rise=a.ridge-a.eave,slope=Math.atan2(rise,run);
  for(const side of [-1,1]){
    const roof=mesh(w.scene,createDocksRoofGeometry({width:a.roofWidth,depth:a.roofDepth,rise,side}),coastalMaterial('roof',0x374f65),a.x,a.eave,a.z,`Boathouse ${side<0?'west':'east'} roof shell`);roof.userData.authoredModel=side<0?'boathouse-roof-left':'boathouse-roof-right';w.rockCollider(roof,'boathouse-pitched-roof');
    const points=[];
    for(let i=0;i<12;i++)for(let j=0;j<18;j++){const xx=side*(.25+(i+.31)*(run-.5)/12),zz=-a.roofDepth/2+.2+(j+.27)*(a.roofDepth-.4)/18;points.push([a.x+xx,a.ridge-Math.abs(xx)*rise/run,a.z+zz]);}
    registerSurfaceLayer(w.scene,`Boathouse ${side<0?'west':'east'} pitched roof`,points,[side*Math.sin(slope),Math.cos(slope),0]);
    for(const z of [a.z-a.roofDepth/2-.03,a.z+a.roofDepth/2+.03]){
      const bar=coastalBox(w.scene,Math.hypot(run,rise)+.12,.27,.24,trim(),a.x+side*run/2,a.eave+rise/2-.04,z,{bevel:.022,shade:.12});bar.rotation.z=-side*slope;
    }
    coastalBox(w.scene,.25,.31,a.roofDepth+.25,trim(),a.x+side*(run-.04),a.eave-.12,a.z,{grain:'z',bevel:.02});
    // Widely spaced raised tile courses catch the sunlight without coplanar
    // sheets or hundreds of overlapping decorative tile faces.
    for(let row=1;row<8;row++){
      const xx=side*run*row/8,yy=a.ridge-Math.abs(xx)*rise/run+.08;
      const lip=coastalBox(w.scene,.09,.075,a.roofDepth-.05,coastalMaterial('roof',row%2?0x415c70:0x354c60),a.x+xx,yy,a.z,{grain:'z',bevel:.012,shade:.05});lip.rotation.z=-side*slope;
    }
  }
  const ridge=coastalBox(w.scene,.24,.24,a.roofDepth+.4,coastalMaterial('roof',0x426077),76,13.28,10,{grain:'z',bevel:.08});ridge.name='Rounded continuous ridge cap';
  // An attached low-volume workshop gives a useful flat terrace alongside the
  // pitched roof. Its compact side access no longer dominates the cove facade.
  deck(w,67.5,10,3.3,5,10,{finishWidth:4.6,finishDepth:9.6,name:'Boathouse workshop floor'});
  clapboardWall(w,.28,3.68,10,65,5.14,10,{axis:'x',outside:-1,name:'Workshop west wall'});
  clapboardWall(w,5,3.68,.28,67.5,5.14,5,{outside:-1,name:'Workshop rear wall'});
  for(const x of [65.65,69.35])clapboardWall(w,1.3,3.68,.28,x,5.14,15,{doorSide:Math.sign(x-67.5),name:`Workshop front ${x<67?'left':'right'} wall`});
  clapboardWall(w,2.4,.76,.28,67.5,6.60,15,{doorHeader:true,name:'Workshop door header'});door(w,15,1,2.4,2.85,67.5);
  deck(w,67.5,10,7.3,5,10,{name:'Boathouse workshop terrace'});deck(w,63.4,5.4,7.3,3.2,1.2,{name:'Boathouse terrace landing'});
  const r=a.terraceRamp,ramp=w.addRamp({x:r.x,z:r.z,y:r.y},r.yaw,r.width,r.length,r.rise,false);ramp.roofAccess=true;ramp.accessId='boathouse-terrace';
  // Rails are real narrow cover and keep the north landing/terrace connection open.
  for(const x of [65.13])for(const z of [8,11,14.6])solid(w,.16,.95,.16,trim(),x,7.775,z,{grain:'y'});
  for(const x of [65.13])solid(w,.13,.13,7.1,trim(),x,8.21,11.2,{grain:'z'});
  for(const x of [66,68,69.87])solid(w,.16,.95,.16,trim(),x,7.775,14.87,{grain:'y'});
  solid(w,4.84,.13,.13,trim(),67.5,8.21,14.87);
  // Porch supports are tucked to its corners, leaving the door-to-dock path wide.
  for(const x of [69.3,82.7]){
    solid(w,.24,4.70,.24,trim(),x,5.65,17.25,{grain:'y',bevel:.02});
    detailBeam(w,[x,7.05,17.25],[x,8.18,16.3],.16,.16);
    for(const z of [15.5,17.2]){const bottom=Math.min(w.heightAt(x,z),-.2),height=3.0-bottom;solid(w,.3,height,.3,wood(),x,bottom+height/2,z,{grain:'y'});}
  }
  const awningSlope=Math.atan2(.5,2.5),awningNormal=[0,Math.cos(awningSlope),Math.sin(awningSlope)];
  const awning=coastalBox(w.scene,14,.16,Math.hypot(2.5,.5),coastalMaterial('roof',0x3f5b6d),76,8.25-.08*awningNormal[1],16.25-.08*awningNormal[2],{grain:'x',bevel:0,shade:.12});
  awning.rotation.x=awningSlope;awning.name='Deep porch slate canopy';w.rockCollider(awning,'boathouse-porch-roof');
  const porchSamples=[];
  for(let i=0;i<20;i++)for(let j=0;j<4;j++){const xx=69.2+(i+.27)*13.6/20,zz=15.12+(j+.37)*2.26/4;porchSamples.push([xx,8.5-(zz-15)*.2,zz]);}
  registerSurfaceLayer(w.scene,'Boathouse inclined porch canopy',porchSamples,awningNormal);
  coastalBox(w.scene,14.2,.23,.22,trim(),76,7.91,17.51,{bevel:.02});
  dressHarbor(w);
  const layers=w.scene.userData.surfaceLayers.slice(startLayers).filter(layer=>layer.kind!=='joinery').map(layer=>({name:layer.name,normal:layer.normal,samples:layer.points.length}));
  const metadata={kind:'boathouse',...a,y:a.floor,roof:a.ridge,terrace:a.annex.top,roofType:'full-pitched',surfaceLayers:layers,accessId:'boathouse-terrace'};
  (w.coastalAssets??=[]).push(metadata);w.docksArchitecture=metadata;
  w.landmarks.push({id:'interior',x:76,z:10,y:3.3,roof:7.3,accessId:'boathouse-terrace'});
  return metadata;
}
