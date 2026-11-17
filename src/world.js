import * as THREE from 'three';
import { clamp, seeded, RULES } from './config.js';
import { surface, batchDecorations } from './materials.js';
import { IslandWater, createIslandSky, createCloud } from './nature-water.js';
import { IslandFoliage } from './nature-foliage.js';
import { graphicsProfile } from './graphics.js';
import { terrainMaterial, rockGeometry, Meadow, groundTime } from './nature-ground.js';
import { RockCollision } from './rock-collision.js';
import { MAPS,mapKey,BREEZY_PADS,breezyHeight,stormState,routeDistance } from './maps.js';
import { generateSunhaven } from './sunhaven.js';
import { groundedRampVertices } from './ramp-geometry.js';
import { createMapTerrain } from './terrain-surface.js';
import { decorateSunhavenLandscape } from './sunhaven-landscape.js';
import { coastalCabin, metreRampUVs, dressCoastalRamp } from './coastal-world.js';
import { coastalMaterial } from './coastal-materials.js';
import { coastalBoxGeometry } from './coastal-geometry.js';
import { addDocksLandforms } from './docks-landforms.js';
import { addNaturalDocksTrees } from './natural-docks-trees.js';
import { createApprovedDocksRocks } from './approved-docks-rocks.js';
import { configureDocksClouds } from './docks-lighting.js';

export const PALETTE = { grass: 0x71c85e, green: 0x35ad72, darkGreen: 0x168265, trunk: 0xa9764b, sand: 0xf9dea3, coral: 0xfa795e, navy: 0x23425c, cream: 0xfff4d6, teal: 0x45d0cf };
const pads=BREEZY_PADS;
const crateSites=[[-8,25],[12,16],[-13,0],[8,-6],[33,-1],[-37,-17]];
export const heightAt=breezyHeight;
const materials = new Map();
export function mat(color, extra = {}) {
  if (Object.keys(extra).length) return new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, ...extra });
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true}));
  return materials.get(color);
}
export function box(w,h,d,color,x=0,y=0,z=0,parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), typeof color === 'number' ? mat(color) : color);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true; if(parent) parent.add(m);return m;
}
export function cylinder(rt,rb,h,color,x,y,z,parent,segments=8) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),typeof color==='number'?mat(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;if(parent)parent.add(m);return m;
}
export function ball(radius,color,x,y,z,parent,detail=0) {
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,detail),typeof color==='number'?mat(color):color);m.position.set(x,y,z);m.castShadow=true;if(parent)parent.add(m);return m;
}
export class World {
  constructor(scene,key='breezy') {
    this.map=MAPS[mapKey(key)];this.heightAt=this.map.heightAt;this.matchSeed=0;
    this.scene=scene;this.navVersion=0; this.obstacles=[];this.solids=[];this.ramps=[];this.structures=[];this.clouds=[];this.flags=[];this.dynamic=new THREE.Group();scene.add(this.dynamic);
    this.water=new IslandWater(this.heightAt,this.map);this.sky=createIslandSky({coastal:this.map.id==='sunhaven'});this.foliage=new IslandFoliage();scene.add(this.water,this.sky,this.foliage);
    this.groundCover=new THREE.Group();this.groundCover.name='Meadow plants';scene.add(this.groundCover);this.generate();
    if(this.map.id==='sunhaven'){addDocksLandforms(this);createApprovedDocksRocks(this);addNaturalDocksTrees(this);decorateSunhavenLandscape(this);configureDocksClouds(this.clouds);}
    this.meadowGrass=new Meadow(this.heightAt,(x,z)=>this.canPlant(x,z),this.foliage.trees,this.map);this.groundCover.add(this.meadowGrass);
    this.water.exclude=[this.groundCover];
    batchDecorations(this.groundCover,new Set(),new Set([this.meadowGrass]));
    batchDecorations(scene,new Set(this.solids),new Set([this.ground,this.dynamic,this.groundCover,this.water,this.sky,this.foliage,this.landscape,this.docksOaks,this.approvedRocks,...this.clouds,...this.flags]),this.map.id==='sunhaven'?32:Infinity);
    // Draw permanent collision surfaces in shared material batches. Keep the
    // original meshes and matrices in solids: Three's explicit raycasts still
    // use them when invisible, and movement/nav retain their exact bounds.
    this.solidVisuals=new THREE.Group();this.solidVisuals.name='Permanent cover surfaces';scene.add(this.solidVisuals);this.authoredModelSlots=[...(this.approvedModelSlots??[])];
    for(const solid of this.solids){
      if(solid===this.ground||solid.userData.instancedVisual)continue;
      solid.updateWorldMatrix(true,false);
      const visual=new THREE.Mesh(solid.geometry.clone().applyMatrix4(solid.matrixWorld),solid.material);
      if(solid.userData.authoredModel){
        visual.userData.staticBatching=false;
        this.authoredModelSlots.push({key:solid.userData.authoredModel,source:solid.geometry,matrix:solid.matrixWorld.clone(),visual});
      }
      visual.castShadow=solid.castShadow;visual.receiveShadow=solid.receiveShadow;this.solidVisuals.add(visual);solid.visible=false;
    }
    batchDecorations(this.solidVisuals,new Set(),new Set(),this.map.id==='sunhaven'?32:Infinity);
    this.foliage.update(0,{position:new THREE.Vector3()});
  }
  stormAt(time){return stormState(this.map,time,this.matchSeed);}
  canPlant(x,z){
    if(this.heightAt(x,z)<.6||this.map.pads.some(p=>Math.hypot(x-p[0],z-p[1])<(this.map.id==='sunhaven'?p[3]+1:7))||this.isRampApproach(x,z,.6))return false;
    if(this.map.id==='sunhaven'?routeDistance(x,z)<3.6:Math.abs(x+Math.sin(z*.06)*8)<2.8||Math.abs(z-8+Math.sin(x*.07)*5)<2.3)return false;
    return !this.nearObstacles(x,z,.2).some(o=>x>o.box.min.x-.18&&x<o.box.max.x+.18&&z>o.box.min.z-.18&&z<o.box.max.z+.18);
  }
  nearObstacles(x,z,r=0){
    if(this.spatialVersion!==this.navVersion){
      this.spatial=new Map();for(const o of this.obstacles){const b=o.box;for(let bx=Math.floor(b.min.x/8);bx<=Math.floor(b.max.x/8);bx++)for(let bz=Math.floor(b.min.z/8);bz<=Math.floor(b.max.z/8);bz++){const k=bx+','+bz;if(!this.spatial.has(k))this.spatial.set(k,[]);this.spatial.get(k).push(o);}}
      this.spatialVersion=this.navVersion;
    }
    const found=new Set();for(let bx=Math.floor((x-r)/8);bx<=Math.floor((x+r)/8);bx++)for(let bz=Math.floor((z-r)/8);bz<=Math.floor((z+r)/8);bz++)for(const o of this.spatial.get(bx+','+bz)||[])found.add(o);
    return [...found];
  }
  collider(mesh,min,max,kind='solid') {
    // Combat can run before the next render, including immediately after a build.
    // Publish the mesh in its actual world position before it becomes a solid.
    mesh.updateWorldMatrix(true,false);
    const c={mesh,box:new THREE.Box3(min,max),kind};this.obstacles.push(c);this.solids.push(mesh);this.navVersion++;return c;
  }
  addBox(w,h,d,color,x,y,z,collide=true) {
    const m=box(w,h,d,color,x,y,z,this.scene);
    if(collide)this.collider(m,new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2));return m;
  }
  rockCollider(mesh,kind='rock'){
    const shape=new RockCollision(mesh),o=this.collider(mesh,shape.bounds.min.clone(),shape.bounds.max.clone(),kind);o.shape=shape;return o;
  }
  sceneryFree(x,z,halfSize){
    // Check visual footprints as well as collision bodies. A scaled/rotated rock
    // can extend beyond its movement box; rooftop details must not be planted over.
    const bounds=this.obstacles.map(o=>o.kind==='tree'?o.box:new THREE.Box3().setFromObject(o.mesh));
    for(const [cx,cz] of crateSites)bounds.push(new THREE.Box3(new THREE.Vector3(cx-1.4,0,cz-1.2),new THREE.Vector3(cx+1.4,0,cz+1.2)));
    const r=halfSize+.35;
    return !bounds.some(b=>x+r>b.min.x&&x-r<b.max.x&&z+r>b.min.z&&z-r<b.max.z);
  }
  generate() {
    if(this.map.id==='sunhaven'){generateSunhaven(this);return;}
    const rng=seeded(927);
    this.ground=createMapTerrain(this.map);this.scene.add(this.ground);this.solids.push(this.ground);
    // The terrain's color variation is independent of scenery RNG.
    for(let i=0;i<129*129;i++){const x=(i%129)/128*156-78,z=78-Math.floor(i/129)/128*156;if(Math.hypot(x,z)<61)rng();}
    // Keep the original random sequence: scenery/collision positions are stable
    // even though the old rectangular foam decorations have been replaced.
    for(let i=0;i<40;i++) {
      rng();rng();rng();
    }
    for(const p of pads.slice(0,4))this.cabin(...p.slice(0,3),rng()>.5?PALETTE.coral:0x49b8b0);
    this.lighthouse(0,-28,9);
    for(let i=0;i<60;i++) {
      const a=rng()*Math.PI*2,r=14+Math.sqrt(rng())*47,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(pads.some(p=>Math.hypot(x-p[0],z-p[1])<10)||this.isRampApproach(x,z)|| (Math.abs(x)<6&&z>20))continue;
      const s=.75+rng()*.6,pink=rng()>.77;
      if(this.sceneryFree(x,z,.65*s))this.tree(x,z,s,pink);
    }
    for(let i=0;i<26;i++) {
      const x=(rng()-.5)*112,z=(rng()-.5)*112;if(Math.hypot(x,z)>59||pads.some(p=>Math.hypot(x-p[0],z-p[1])<9)||this.isRampApproach(x,z)||Math.hypot(x,z-39)<9)continue;
      const r=.8+rng()*1.2,rotation=rng()*6;
      if(!this.sceneryFree(x,z,r*1.35))continue;
      const y=this.heightAt(x,z),m=new THREE.Mesh(rockGeometry(r,i+7),surface('stone',0xc0c5ad));m.position.set(x,y+r*.4,z);this.scene.add(m);m.castShadow=m.receiveShadow=true;m.scale.set(1.35,.85,1);m.rotation.y=rotation;
      this.rockCollider(m);
      for(let j=0;j<3;j++){const pebble=ball(.22+j*.09,surface('stone',0xb2c3b1),x+r*(.8+j*.3),y+.14,z+.4-j*.4,this.scene);pebble.scale.y=.5;}
    }
    for(const [x,z] of crateSites) {
      const y=this.heightAt(x,z);this.addBox(2.4,1.65,2,surface('wood',0xc78b49),x,y+.825,z);this.addBox(2.46,.14,2.06,surface('wood',0xffd894),x,y+.22,z,false);this.addBox(2.46,.14,2.06,surface('wood',0xffd894),x,y+1.43,z,false);
      for(const side of [-1,1]){
        for(const dx of [-1.07,1.07])this.addBox(.14,1.65,.08,PALETTE.navy,x+dx,y+.825,z+side*1.04,false);
        const brace=this.addBox(2.7,.15,.07,surface('wood',0xf3c17c),x,y+.825,z+side*1.05,false);brace.rotation.z=.48;
        this.addBox(.36,.32,.08,PALETTE.teal,x,y+.84,z+side*1.1,false);
      }
    }
    // Partly submerged shoreline stones supply real detail through clear water.
    for(let i=0;i<52;i++){
      const a=i*2.39996,r=69.5+(i%7)*1.25,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.28+(i%5)*.16;
      const mesh=new THREE.Mesh(rockGeometry(size,i+80),surface('stone',0xbcc2ac));mesh.position.set(x,this.heightAt(x,z)+size*.3,z);mesh.rotation.y=i;mesh.scale.set(1.2,.65,1);mesh.castShadow=mesh.receiveShadow=true;this.scene.add(mesh);
      if(r<71)this.rockCollider(mesh,'shore-rock');
    }
    this.meadow();
    for(let i=0;i<10;i++) {
      const g=new THREE.Group(),a=i/16*Math.PI*2,r=110+rng()*90;g.position.set(Math.cos(a)*r,40+rng()*26,Math.sin(a)*r);
      const cloud=createCloud();cloud.scale.set(25+rng()*15,13+rng()*7,1);g.add(cloud);
      this.scene.add(g);this.clouds.push(g);
    }
  }
  tree(x,z,s,pink=false) {
    const y=this.heightAt(x,z),branches=this.foliage.addTree(x,y,z,s,pink);
    this.collider(branches,new THREE.Vector3(x-.35*s,y,z-.35*s),new THREE.Vector3(x+.35*s,y+3.4*s,z+.35*s),'tree');
  }
  meadow(){
    const rng=seeded(512),green=[0x438956,0x64a75b,0x84b766],petals=[0xffd76d,0xfff2cc,0xf694b5];
    const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.075,0,0,.075,0,0,.10,.48,.025, -.075,0,0,.10,.48,.025,.01,.25,.06],3));bladeGeometry.computeVertexNormals();
    const bladeMaterials=green.map(c=>mat(c,{side:THREE.DoubleSide}));
    for(let i=0;i<1150;i++){
      const x=(rng()-.5)*120,z=(rng()-.5)*120;
      if(Math.hypot(x,z)>60||pads.some(p=>Math.hypot(x-p[0],z-p[1])<7)||this.isRampApproach(x,z,.5)||Math.abs(x+Math.sin(z*.06)*8)<3||Math.abs(z-8+Math.sin(x*.07)*5)<2.5)continue;
      const y=this.heightAt(x,z),scale=.55+rng()*.6;
      if(i%5===0){
        cylinder(.025,.04,.35,0x4b9255,x,y+.17,z,this.groundCover,5);
        for(let p=0;p<5;p++){const a=p*Math.PI*2/5,m=ball(.115,petals[i%3],x+Math.cos(a)*.10,y+.38,z+Math.sin(a)*.10,this.groundCover);m.scale.y=.4;m.castShadow=false;}
        ball(.08,0xe4a94d,x,y+.41,z,this.groundCover);
      }else for(let j=0;j<3;j++){
        const blade=new THREE.Mesh(bladeGeometry,bladeMaterials[i%3]);blade.position.set(x+j*.06,y,z);blade.rotation.y=rng()*Math.PI*2;blade.scale.setScalar(scale);this.groundCover.add(blade);
      }
    }
  }

  cabin(x,z,y,color) {
    if(this.map.id==='sunhaven')return coastalCabin(this,x,z,y,color);
    this.addBox(7.4,.45,6.4,surface('stone',0xe4d8b4,4,1),x,y+.2,z);
    this.addBox(6.5,3.5,5.5,surface('wood',color,2,3),x,y+2,z);
    // Painted clapboard seams, corner posts, and a lower skirting board.
    for(let j=0;j<8;j++){
      for(const side of [-1,1])this.addBox(6.52,.035,.035,mat(color).color.clone().multiplyScalar(.72).getHex(),x,y+.55+j*.4,z+side*2.76,false);
      for(const side of [-1,1])this.addBox(.035,.035,5.52,mat(color).color.clone().multiplyScalar(.72).getHex(),x+side*3.26,y+.55+j*.4,z,false);
    }
    for(const dx of [-3.18,3.18])for(const dz of [-2.7,2.7])this.addBox(.18,3.55,.18,PALETTE.cream,x+dx,y+2,z+dz,false);
    for(const side of [-1,1])this.addBox(6.5,.18,.10,PALETTE.cream,x,y+.58,z+side*2.77,false);
    for(const dx of [-2.15,2.15]) {
      this.addBox(1.2,1.3,.1,PALETTE.cream,x+dx,y+2.25,z+2.8,false);
      this.addBox(.94,1.02,.13,mat(0x235769,{roughness:.2,metalness:.25}),x+dx,y+2.25,z+2.85,false);
      this.addBox(.1,1.02,.15,0x93e4dc,x+dx,y+2.25,z+2.9,false);
      this.addBox(.96,.06,.15,0x93e4dc,x+dx,y+2.25,z+2.9,false);
      this.addBox(.24,.05,.02,0xb6eee4,x+dx-.2,y+2.55,z+2.93,false).rotation.z=.6;
      this.addBox(1.42,.13,.26,PALETTE.cream,x+dx,y+1.57,z+2.85,false);
      for(const side of [-1,1]){
        this.addBox(.25,1.2,.12,surface('wood',PALETTE.navy),x+dx+side*.77,y+2.25,z+2.83,false);
        for(let j=0;j<4;j++)this.addBox(.22,.035,.03,0x638b93,x+dx+side*.77,y+1.85+j*.25,z+2.91,false);
      }
    }
    this.addBox(1.35,2.4,.15,PALETTE.navy,x,y+1.4,z+2.82,false);
    this.addBox(.12,.12,.1,0xffdf72,x+.4,y+1.4,z+2.92,false);
    this.addBox(.96,.86,.03,surface('wood',0x3a6877),x,y+1.78,z+2.91,false);
    this.addBox(1.05,.15,.03,0x7fb9b6,x,y+2.34,z+2.91,false);
    // Flat roof is a reachable fighting platform, with a striped awning at the front.
    this.addBox(7.4,.5,6.4,surface('stone',PALETTE.coral,3,3),x,y+4,z);
    // All roof trim is flush or inset; the ramp exit and fighting platform stay clear.
    this.addBox(7.42,.10,6.42,PALETTE.cream,x,y+3.82,z,false);
    this.addBox(6.75,.015,5.7,surface('wood',0xe8c17e,3,3),x,y+4.26,z,false);
    for(let j=0;j<6;j++)this.addBox(1.22,.15,1.25,j%2?0xffedc2:0xf96a5b,x-3.05+j*1.22,y+3.3,z+3.2,false);
    for(const dx of [-3.15,3.15])this.addBox(.15,3.2,.15,PALETTE.cream,x+dx,y+1.6,z+3.5,false);
    // Anchor the low edge to its own terrain and the high edge to the roof edge.
    // Sampling the center used to leave a floating entrance and an obstructed exit.
    const rampLength=8,rampWidth=3,roofEdge=x+3.7,lowEdge=roofEdge+rampLength;
    const base=Math.min(...[-rampWidth/2,0,rampWidth/2].map(dz=>this.heightAt(lowEdge,z+dz)));
    this.addRamp({x:roofEdge+rampLength/2,z,y:base},Math.PI/2,rampWidth,rampLength,y+4.25-base,false);
    // This is a physical roof prop: walk around it or jump onto its lid.
    const crate=this.addBox(1.1,.65,1.1,surface('wood',0xffd365),x-2,y+4.575,z-1);
    crate.userData.prop='roof-crate';
    // Bands wrap outside the body. Coplanar band/lid faces flicker as the camera moves.
    for(const dx of [-.38,.38])this.addBox(.10,.69,1.12,PALETTE.navy,x-2+dx,y+4.575,z-1,false);
    // A nautical sun badge makes each little trading cabin recognizable.
    const badge=cylinder(.34,.34,.07,0xffd45c,x,y+3.04,z+2.85,this.scene,16);badge.rotation.x=Math.PI/2;
    for(let j=0;j<8;j++){const a=j*Math.PI/4,ray=box(.07,.17,.05,0xffd45c,x+Math.sin(a)*.44,y+3.04+Math.cos(a)*.44,z+2.87,this.scene);ray.rotation.z=-a;}
  }
  lighthouse(x,z,y) {
    cylinder(3.8,4.6,.8,0xf4e6c1,x,y+.4,z,this.scene);
    for(let i=0;i<4;i++) {const m=cylinder(1.85-i*.12,2-i*.12,2.2,i%2?0xff8168:PALETTE.cream,x,y+1.1+i*2.2,z,this.scene);this.solids.push(m);}
    cylinder(2.7,2.7,.4,PALETTE.navy,x,y+8.8,z,this.scene);
    cylinder(1.5,1.5,1.8,0xffdc7d,x,y+9.8,z,this.scene);
    cylinder(0,2.5,1.8,PALETTE.coral,x,y+11.4,z,this.scene);
    this.collider(this.scene.children[this.scene.children.length-1],new THREE.Vector3(x-2,y,z-2),new THREE.Vector3(x+2,y+11,z+2));
    // Lantern glazing and balcony details, inside the landmark's existing footprint.
    const glass=mat(0x70d9d2,{roughness:.18,metalness:.18});
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      cylinder(.045,.045,1.8,PALETTE.navy,x+Math.sin(a)*1.51,y+9.8,z+Math.cos(a)*1.51,this.scene);
      const pane=box(1.03,1.48,.05,glass,x+Math.sin(a+Math.PI/8)*1.47,y+9.8,z+Math.cos(a+Math.PI/8)*1.47,this.scene);pane.rotation.y=a+Math.PI/8;
    }
    for(const h of [8.97,10.7])cylinder(1.62,1.62,.12,PALETTE.cream,x,y+h,z,this.scene,16);
    for(let i=0;i<3;i++){
      box(.6,.85,.07,PALETTE.navy,x,y+2+i*2.3,z+1.82-i*.12,this.scene);
      box(.4,.6,.08,0x7bc9ce,x,y+2.03+i*2.3,z+1.86-i*.12,this.scene);
    }
    const flag=box(2,.9,.06,0xffe462,x+1.05,y+14,z,this.scene);cylinder(.04,.04,2,PALETTE.navy,x,y+13.3,z,this.scene);this.flags.push(flag);
  }
  addRamp(p,yaw,width=4,length=5,rise=3,build=true) {
    const g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=yaw;this.scene.add(g);
    const geom=new THREE.BufferGeometry();
    // Local +z is the low end; -z is the high end. Wedge includes sides and underside.
    const w=width/2,l=length/2;let v=[-w,0,l,w,0,l,w,rise,-l, -w,0,l,w,rise,-l,-w,rise,-l, -w,0,l,-w,rise,-l,-w,0,-l, w,0,l,w,0,-l,w,rise,-l, -w,0,-l,-w,rise,-l,w,rise,-l, -w,0,-l,w,rise,-l,w,0,-l, -w,0,l,w,0,-l,w,0,l, -w,0,l,-w,0,-l,w,0,-l];
    const grounded=!build&&this.map.id==='sunhaven';if(grounded)v=groundedRampVertices(width,length,rise,p,yaw,this.heightAt);
    geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geom.computeVertexNormals();
    const uv=[];for(let i=0;i<v.length;i+=3)uv.push((v[i]+w)/width,(v[i+1]/rise+(l-v[i+2])/length)/2);
    geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const coastal=!build&&this.map.id==='sunhaven';
    if(coastal)metreRampUVs(geom);
    const wood=coastal?coastalMaterial('timber',0xb99364,{vertexColors:false}).clone():surface('wood',build?0xe4ae62:0xc09a63);wood.side=THREE.DoubleSide;
    if(coastal)wood.userData.owned=true;
    const m=new THREE.Mesh(geom,wood);m.castShadow=true;m.receiveShadow=true;g.add(m);this.solids.push(m);
    if(coastal)dressCoastalRamp(g,width,length,rise);
    else for(let i=0;i<=8;i++){const t=i/8;const plank=box(width+.08,.09,.12,0xffe1a0,0,t*rise+.045,l-t*length,g);plank.rotation.x=Math.atan2(rise,length);}
    for(const side of [-1,1]){
      const beam=box(.11,.07,Math.hypot(length,rise),coastal?coastalMaterial('timber',0xa67e51):surface('wood',0xb48247),side*(w-.14),rise/2+.04,0,g);beam.rotation.x=Math.atan2(rise,length);
      if(coastal){beam.geometry.dispose();beam.geometry=coastalBoxGeometry(.11,.07,Math.hypot(length,rise),{grain:'z',bevel:.015,shade:.04});}
      for(const t of [.06,.5,.94]){const bolt=ball(.065,coastal?coastalMaterial('metal',undefined,{vertexColors:false}):PALETTE.navy,side*(w-.14),t*rise+.10,l-t*length,g,1);bolt.scale.y=.3;}
    }
    batchDecorations(g,new Set([m]));
    const ramp={group:g,mesh:m,x:p.x,z:p.z,y:p.y,yaw,width,length,rise,build,grounded,health:RULES.wallHealth};m.updateWorldMatrix(true,false);this.ramps.push(ramp);m.userData.build=ramp;this.navVersion++;return ramp;
  }
  rampLocal(ramp,x,z) {
    const dx=x-ramp.x,dz=z-ramp.z,c=Math.cos(ramp.yaw),s=Math.sin(ramp.yaw);
    return {x:dx*c-dz*s,z:dx*s+dz*c};
  }
  isRampApproach(x,z,margin=2) {
    return this.ramps.some(r=>{if(r.build)return false;const p=this.rampLocal(r,x,z);return Math.abs(p.x)<r.width/2+margin&&Math.abs(p.z)<r.length/2+margin;});
  }
  floorAt(x,z,feet=Infinity) {
    let floor=this.heightAt(x,z);
    for(const ramp of this.ramps) {const p=this.rampLocal(ramp,x,z);
      if(Math.abs(p.x)<ramp.width/2+.15&&Math.abs(p.z)<ramp.length/2+.15){const y=ramp.y+clamp(.5-p.z/ramp.length,0,1)*ramp.rise;if(y<=feet+RULES.stepHeight)floor=Math.max(floor,y);}}
    for(const o of this.nearObstacles(x,z,.4)){
      if(o.shape){const y=o.shape.surfaceAt(x,z);if(y<=feet+RULES.stepHeight)floor=Math.max(floor,y);}
      else if(x>=o.box.min.x-.05&&x<=o.box.max.x+.05&&z>=o.box.min.z-.05&&z<=o.box.max.z+.05&&o.box.max.y<=feet+RULES.stepHeight)floor=Math.max(floor,o.box.max.y);
    }
    return floor;
  }
  rampBlocks(x,z,radius,feet,height=RULES.playerHeight) {
    return this.ramps.some(ramp=>{
      const local=this.rampLocal(ramp,x,z),cx=clamp(local.x,-ramp.width/2,ramp.width/2),cz=clamp(local.z,-ramp.length/2,ramp.length/2);
      if((local.x-cx)**2+(local.z-cz)**2>radius*radius)return false;
      const surface=ramp.y+(.5-cz/ramp.length)*ramp.rise;
      const bottom=ramp.grounded?Math.min(ramp.y,this.heightAt(x,z)-.16):ramp.y;
      return feet+height>bottom+.05&&feet<surface-RULES.stepHeight;
    });
  }
  ceilingAt(x,z,head) {
    let ceiling=Infinity;
    for(const o of this.obstacles){
      if(o.shape){for(const [dx,dz] of [[0,0],[.3,0],[-.3,0],[0,.3],[0,-.3]]){const y=o.shape.surfaceAt(x+dx,z+dz,true);if(y>=head-.05)ceiling=Math.min(ceiling,y);}}
      else if(x+.3>o.box.min.x&&x-.3<o.box.max.x&&z+.3>o.box.min.z&&z-.3<o.box.max.z&&o.box.min.y>=head-.05)ceiling=Math.min(ceiling,o.box.min.y);
    }
    for(const r of this.ramps){const p=this.rampLocal(r,x,z);if(Math.abs(p.x)<r.width/2+.3&&Math.abs(p.z)<r.length/2+.3&&r.y>=head-.05)ceiling=Math.min(ceiling,r.y);}
    return ceiling;
  }
  move(actor,dx,dz) {
    const p=actor.pos,r=actor.radius||RULES.playerRadius;
    const blocked=(x,z)=>{
      // Check the reachable floor at the candidate position, including the next
      // part of a ramp, so the player's radius does not catch the roof's lip.
      const support=this.floorAt(x,z,p.y);
      if(this.map.id==='sunhaven'&&actor.grounded&&support<-.5)return true;
      const feet=Math.max(p.y,Math.min(p.y+RULES.stepHeight,support));
      if(this.map.id==='sunhaven'&&feet<-.5)return true;
      if(this.nearObstacles(x,z,r).some(o=>this.obstacleBlocks(o,x,feet,z,r,actor.height)))return true;
      return this.rampBlocks(x,z,r,feet,actor.height);
    };
    const ox=p.x,oz=p.z;if(!blocked(p.x+dx,p.z))p.x+=dx;if(!blocked(p.x,p.z+dz))p.z+=dz;
    const d=Math.hypot(p.x,p.z);if(d>this.map.radius){p.x*=this.map.radius/d;p.z*=this.map.radius/d;}
    return Math.hypot(p.x-ox,p.z-oz);
  }
  obstacleBlocks(o,x,y,z,r,height=RULES.playerHeight){
    if(o.shape)return o.shape.blocks(x,z,r,y,height);
    return y+height>o.box.min.y+.01&&y<o.box.max.y-RULES.stepHeight&&x+r>o.box.min.x&&x-r<o.box.max.x&&z+r>o.box.min.z&&z-r<o.box.max.z;
  }
  canStand(x,y,z,r=RULES.playerRadius,height=RULES.playerHeight){
    return (this.map.id!=='sunhaven'||y>=-.5)&&y>=this.heightAt(x,z)-.25&&!this.nearObstacles(x,z,r).some(o=>this.obstacleBlocks(o,x,y,z,r,height))&&!this.rampBlocks(x,z,r,y,height);
  }
  rockContactFloor(actor){
    const support=actor.rockSupportPosition;
    return support&&actor.grounded&&actor.vy<=0&&support.distanceToSquared(actor.pos)<1e-8?support.y:-Infinity;
  }
  resolveRockContacts(actor){
    const p=actor.pos,r=actor.radius||RULES.playerRadius,h=actor.height??RULES.playerHeight;
    const overlaps=point=>this.nearObstacles(point.x,point.z,r).filter(o=>o.shape?o.shape.blocks(point.x,point.z,r,point.y,h,0):this.obstacleBlocks(o,point.x,point.y,point.z,r,h));
    const clear=point=>this.canStand(point.x,point.y,point.z,r,h)&&!overlaps(point).length;
    if(!overlaps(p).length){if(clear(p))(actor.rockSafePosition??=new THREE.Vector3()).copy(p);return false;}
    const origin=p.clone();let supported=false;
    // Project out of sloped faces after gravity as well as horizontal motion.
    // Re-query each pass: adjacent rocks and the terrain can oppose a correction.
    for(let pass=0;pass<12;pass++){
      const contacts=overlaps(p);if(!contacts.length&&clear(p))break;
      let changed=false;
      for(const o of contacts){
        let hit;
        if(o.shape)hit=o.shape.penetration(p.x,p.z,r,p.y,h);
        else{
          // A rock correction can bring the body alongside another prop.
          // Resolve that solid too, retaining the established box step allowance.
          const b=o.box,exits=[[-1,0,0,p.x-(b.min.x-r)],[1,0,0,b.max.x+r-p.x],[0,0,-1,p.z-(b.min.z-r)],[0,0,1,b.max.z+r-p.z],[0,1,0,b.max.y-p.y],[0,-1,0,p.y+h-b.min.y]];
          const exit=exits.reduce((a,b)=>b[3]<a[3]?b:a);hit={normal:new THREE.Vector3(...exit.slice(0,3)),depth:exit[3]};
        }
        if(!hit||hit.depth<.00001)continue;
        p.addScaledVector(hit.normal,Math.min(hit.depth+.003,.5));
        supported ||= hit.normal.y>.35;changed=true;
      }
      p.y=Math.max(p.y,this.heightAt(p.x,p.z));
      if(!changed)break;
    }
    if(!clear(p)){
      // Old saves/debug placements can start deep inside a closed solid, where
      // there is no intersecting surface to project against. Recover locally;
      // prefer the last verified position so a fall cannot strand the player.
      supported=false;const safe=actor.rockSafePosition;
      if(safe&&safe.distanceTo(origin)<6&&clear(safe))p.copy(safe);
      else{
        let best=null,cost=Infinity;
        for(let radius=0;radius<=6;radius+=.25){
          if(radius*radius>cost)break;
          const count=radius?32:1;
          for(let i=0;i<count;i++){
            const angle=i/count*Math.PI*2,x=origin.x+Math.cos(angle)*radius,z=origin.z+Math.sin(angle)*radius;
            for(const y of [Math.max(origin.y,this.heightAt(x,z)),this.floorAt(x,z)]){
              const candidate=new THREE.Vector3(x,y,z),score=candidate.distanceToSquared(origin);
              if(score<cost&&Math.hypot(x,z)<=this.map.radius&&clear(candidate)){best=candidate;cost=score;}
            }
          }
        }
        if(best)p.copy(best);else p.copy(origin);
      }
    }
    if(clear(p)){
      (actor.rockSafePosition??=new THREE.Vector3()).copy(p);
      // Preserve an established capsule contact while stationary. Snapping
      // back to the lower centre ray each frame would make a sloped top drift.
      if(supported)(actor.rockSupportPosition??=new THREE.Vector3()).copy(p);
      if(supported||p.y>origin.y+.001){actor.vy=Math.max(0,actor.vy||0);actor.grounded=true;}
      return true;
    }
    return false;
  }
  canWalk(from,to){
    const actor={pos:new THREE.Vector3(from.x,from.y,from.z),radius:RULES.playerRadius},distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.22));
    for(let i=1;i<=steps;i++){
      const x=from.x+(to.x-from.x)*i/steps,z=from.z+(to.z-from.z)*i/steps,feet=this.floorAt(x,z,actor.pos.y);
      if(feet<actor.pos.y-.6||!this.canStand(x,feet,z))return false;
      this.move(actor,x-actor.pos.x,z-actor.pos.z);if(Math.hypot(actor.pos.x-x,actor.pos.z-z)>.04)return false;actor.pos.y=feet;
    }
    return Math.abs(actor.pos.y-to.y)<.55;
  }
  setQuality(value){this.graphics=graphicsProfile(value);this.low=!this.graphics.shadows;this.groundCover.visible=this.graphics.meadow;this.water.setQuality(value);this.foliage.setQuality(value);this.meadowGrass.setQuality(this.graphics);this.docksOaks?.setQuality(value);}
  update(t,dt,camera) {groundTime.value=t;for(const c of this.clouds)c.position.x+=dt*.35;for(const f of this.flags)f.rotation.y=Math.sin(t*2)*.1;this.water.update(t);this.foliage.update(t,camera);this.meadowGrass.update(t,camera);this.docksOaks?.update(t,camera);}
  resetBuilds() {
    for(const b of [...this.obstacles.filter(o=>o.kind==='build'),...this.ramps.filter(r=>r.build)])this.removeBuild(b);
  }
  removeBuild(b) {
    this.navVersion++;
    const root=b.group||b.mesh;root.removeFromParent();root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material?.userData.owned)o.material.dispose();});
    this.obstacles=this.obstacles.filter(o=>o!==b);this.ramps=this.ramps.filter(r=>r!==b);this.solids=this.solids.filter(m=>m!==b.mesh);this.structures=this.structures.filter(s=>s!==b);
  }
}
